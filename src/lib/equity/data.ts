'use client';

/**
 * Cap table data layer — the single place the page writes Firestore.
 *
 * Writes funnel through this module rather than living in the components, for
 * three reasons:
 *
 * 1. **Audit.** Every mutation appends to `cap_table_events` right after it
 *    lands. That collection is append-only (the rules deny update and delete
 *    even to the owner), so the history is trustworthy precisely because nothing
 *    — including this code — can rewrite it afterwards. A component writing
 *    Firestore directly would silently skip the trail.
 * 2. **Dated fields.** Forms edit dates as strings; this module converts them to
 *    `Timestamp.fromDate()` on the way in. That conversion lives here once
 *    instead of in ten different forms.
 * 3. **Integrity.** Share counts are floored and the `kind` discriminator is
 *    always present, so a component cannot write a malformed record.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { EquityKind } from '@/lib/equity/types';

export const CAP_TABLE_COLLECTION = 'cap_table';
export const CAP_TABLE_EVENTS_COLLECTION = 'cap_table_events';

/** Doc id of the settings singleton. */
export const SETTINGS_DOC_ID = 'settings';

export type RecordInput = Record<string, unknown> & { kind: EquityKind };

/**
 * Normalise a payload into what Firestore actually stores.
 *
 * `undefined` is stripped rather than written — Firestore rejects undefined
 * values outright, and a half-filled optional form field is the normal way to
 * produce one.
 */
function toStored(input: Record<string, unknown>): Record<string, unknown> {
  const stored: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;

    if (value instanceof Date) {
      stored[key] = Timestamp.fromDate(value);
    } else if (typeof value === 'string') {
      stored[key] = value.trim();
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Nested objects (vesting terms) need the same Date -> Timestamp pass.
      stored[key] = toStored(value as Record<string, unknown>);
    } else {
      stored[key] = value;
    }
  }

  if (typeof stored.shares === 'number') {
    stored.shares = Math.max(0, Math.floor(stored.shares));
  }

  return stored;
}

/** Create a record. Use `saveSettings` for the settings singleton. */
export async function createEquityRecord(
  firestore: Firestore,
  input: RecordInput,
  actorEmail: string,
): Promise<{ id: string }> {
  const stored = {
    ...toStored(input),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const ref = await addDoc(collection(firestore, CAP_TABLE_COLLECTION), stored);

  await logEvent(firestore, {
    actorEmail,
    action: `${input.kind}.create`,
    summary: summaryFor(input.kind, stored, 'Added'),
    recordId: ref.id,
    after: stored,
  });

  return { id: ref.id };
}

/** Update a record in place. `before` is stored on the event so a change is reviewable. */
export async function updateEquityRecord(
  firestore: Firestore,
  id: string,
  input: RecordInput,
  actorEmail: string,
  before?: Record<string, unknown> | null,
): Promise<void> {
  const stored = { ...toStored(input), updatedAt: Timestamp.now() };
  const ref = doc(firestore, CAP_TABLE_COLLECTION, id);

  await updateDoc(ref, stored);

  await logEvent(firestore, {
    actorEmail,
    action: `${input.kind}.update`,
    summary: summaryFor(input.kind, stored, 'Updated'),
    recordId: id,
    before: before ? sanitiseForEvent(before) : null,
    after: stored,
  });
}

/** Delete a record. The audit event keeps a copy of what was removed. */
export async function deleteEquityRecord(
  firestore: Firestore,
  id: string,
  record: RecordInput,
  actorEmail: string,
): Promise<void> {
  const ref = doc(firestore, CAP_TABLE_COLLECTION, id);

  await deleteDoc(ref);

  await logEvent(firestore, {
    actorEmail,
    action: `${record.kind}.delete`,
    summary: summaryFor(record.kind, record, 'Deleted'),
    recordId: id,
    before: sanitiseForEvent(record),
  });
}

/**
 * Company settings — the one record with a fixed document id.
 *
 * Uses `setDoc` with merge so it works whether or not the doc already exists,
 * which removes the need for the caller to know.
 */
export async function saveSettings(
  firestore: Firestore,
  data: Record<string, unknown>,
  actorEmail: string,
): Promise<void> {
  const ref = doc(firestore, CAP_TABLE_COLLECTION, SETTINGS_DOC_ID);
  const existing = await getDoc(ref);

  const stored = {
    ...toStored({ ...data, kind: 'settings' }),
    updatedAt: Timestamp.now(),
    ...(existing.exists() ? {} : { createdAt: Timestamp.now() }),
  };

  await setDoc(ref, stored, { merge: true });

  await logEvent(firestore, {
    actorEmail,
    action: existing.exists() ? 'settings.update' : 'settings.create',
    summary: existing.exists() ? 'Updated company settings' : 'Created company settings',
    recordId: SETTINGS_DOC_ID,
    before: existing.exists() ? sanitiseForEvent(existing.data() as Record<string, unknown>) : null,
    after: stored,
  });
}

/**
 * Seed a brand-new cap table.
 *
 * Zeneva starts with one founder holding 100%, so the first run should land on a
 * populated table rather than an empty grid the owner has to fill in by hand.
 * Written as four records — settings, a common class, the founder, and the
 * founding issuance — because that is exactly what a real incorporation is, and
 * modelling it properly now means the first funding round has something correct
 * to dilute.
 */
export async function seedFoundingCapTable(
  firestore: Firestore,
  params: {
    companyLegalName: string;
    currency: string;
    incorporationDate: Date;
    founderName: string;
    founderEmail: string;
    authorizedShares: number;
    foundingShares: number;
    parValue: number;
  },
  actorEmail: string,
): Promise<void> {
  await saveSettings(
    firestore,
    {
      companyLegalName: params.companyLegalName,
      currency: params.currency,
      incorporationDate: params.incorporationDate,
    },
    actorEmail,
  );

  const shareClass = await createEquityRecord(
    firestore,
    {
      kind: 'shareClass',
      name: 'Common',
      classType: 'common',
      authorizedShares: Math.floor(params.authorizedShares),
      parValue: params.parValue,
      seniorityRank: 0,
      votesPerShare: 1,
      conversionRatio: 1,
      liquidationMultiple: 1,
      participating: false,
      participationCapMultiple: null,
    },
    actorEmail,
  );

  const founder = await createEquityRecord(
    firestore,
    {
      kind: 'stakeholder',
      name: params.founderName,
      email: params.founderEmail,
      entityType: 'individual',
      isFounder: true,
      notes: 'Founder and sole shareholder at incorporation.',
    },
    actorEmail,
  );

  await createEquityRecord(
    firestore,
    {
      kind: 'issuance',
      stakeholderId: founder.id,
      shareClassId: shareClass.id,
      shares: Math.floor(params.foundingShares),
      pricePerShare: params.parValue,
      issueDate: params.incorporationDate,
      certificateNo: 'CS-1',
      consideration: 'ip',
      vesting: null,
    },
    actorEmail,
  );
}

/**
 * Append to the immutable audit trail.
 *
 * Never throws. The mutation has already landed by the time this runs, so a
 * failed audit write must not surface as a failed sale or grant — it is logged
 * to the console and the caller continues.
 */
async function logEvent(
  firestore: Firestore,
  e: {
    actorEmail: string;
    action: string;
    summary: string;
    recordId?: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
): Promise<void> {
  try {
    await addDoc(collection(firestore, CAP_TABLE_EVENTS_COLLECTION), {
      at: Timestamp.now(),
      actorEmail: e.actorEmail,
      action: e.action,
      summary: e.summary,
      recordId: e.recordId ?? null,
      before: e.before ?? null,
      after: e.after ?? null,
    });
  } catch (err) {
    console.error('Failed to write cap table audit event:', err);
  }
}

/** Strip the fields that carry no information into an event snapshot. */
function sanitiseForEvent(record: Record<string, unknown>): Record<string, unknown> {
  const { id, createdAt, updatedAt, ...rest } = record;
  return rest;
}

export function kindLabel(kind: EquityKind): string {
  const labels: Record<EquityKind, string> = {
    settings: 'company settings',
    shareClass: 'share class',
    stakeholder: 'stakeholder',
    issuance: 'share issuance',
    transfer: 'share transfer',
    cancellation: 'share cancellation',
    round: 'funding round',
    convertible: 'convertible instrument',
    poolReservation: 'pool reservation',
    optionGrant: 'option grant',
    valuation: 'company valuation',
  };
  return labels[kind] ?? 'record';
}

/** A human sentence for the History tab. This is what the trail actually renders. */
function summaryFor(
  kind: EquityKind,
  stored: Record<string, unknown>,
  verb: 'Added' | 'Updated' | 'Deleted',
): string {
  const label = kindLabel(kind);
  const parts: string[] = [`${verb} ${label}`];

  if (typeof stored.name === 'string' && stored.name) parts.push(`"${stored.name}"`);
  if (typeof stored.shares === 'number') parts.push(`— ${stored.shares.toLocaleString()} shares`);
  else if (typeof stored.principal === 'number') {
    parts.push(`— ${stored.principal.toLocaleString()} principal`);
  } else if (typeof stored.amount === 'number') {
    // Valuations. The figure is the whole point of the record, so a history
    // entry reading only "Updated company valuation" would be useless.
    parts.push(`— ${stored.amount.toLocaleString()}`);
  }

  return parts.join(' ');
}
