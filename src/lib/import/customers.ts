/**
 * The customer half of the importer.
 *
 * Same architecture as the product side and deliberately so: a source becomes a
 * `RawTable`, the table's columns are mapped to a closed list of fields, rows are
 * coerced into drafts, drafts are matched against the customers already on file,
 * and only then does anything get written. Photographs and typed sentences reach
 * that pipeline by being turned into a `RawTable` first, which is why a phone
 * number written `+234 803 123 4567` means the same thing whether it came from
 * Excel, a paste, a photo of a ledger page or a sentence.
 *
 * Two things are shared rather than reimplemented, and both matter:
 *
 *  - **`spreadsheet.ts` and `tabular.ts` are entity-agnostic**, so the hand-written
 *    XLSX reader (pinned SheetJS has CVE-2023-30533, and this parses files people
 *    email each other) and the paste parser serve both importers.
 *  - **Duplicate detection reuses `src/lib/customer-health.ts`.** `normalizePhone`,
 *    `normalizeName`, `normalizeCode` and `realEmail` are the same functions the
 *    Health tab uses. One definition of "the same customer" across the whole app
 *    is worth more than a matcher tuned for import: two rules would mean the
 *    importer silently creating a record the Health tab then flags as a duplicate.
 *
 * Nothing here touches Firestore, React or the network.
 */

import type { RawTable } from './types';
import { normalizeHeader } from './column-map';
import {
  normalizeName,
  normalizePhone,
  normalizeCode,
  realEmail,
  isPlaceholderEmail,
} from '@/lib/customer-health';
import type { Customer } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Fields
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The customer fields an import may fill. A closed list, for the same reason the
 * product one is closed: the AI mapper is handed these names and nothing else, so
 * a hallucinated field becomes a visibly unmapped column rather than a write
 * nothing reads.
 *
 * `totalSpent` and `loyaltyPoints` are here because the commonest reason to
 * import a customer book is leaving another system, and a migration that drops
 * everyone's loyalty balance is a migration the shop cannot use. They default to
 * absent, never to zero — see `buildCustomerDrafts`.
 *
 * Absent on purpose: `branchId` (assigned from the active branch at commit, never
 * from a file), `lastPurchaseDate` and `aiInsights` (both derived from things
 * that happened here, so a file cannot know them).
 */
export const CUSTOMER_IMPORT_FIELDS = [
  'name',
  'phone',
  'email',
  'code',
  'tags',
  'notes',
  'totalSpent',
  'loyaltyPoints',
] as const;

export type CustomerImportField = (typeof CUSTOMER_IMPORT_FIELDS)[number];

export const CUSTOMER_FIELD_LABELS: Record<CustomerImportField, string> = {
  name: 'Customer name',
  phone: 'Phone',
  email: 'Email',
  code: 'Customer code',
  tags: 'Tags',
  notes: 'Notes',
  totalSpent: 'Total spent',
  loyaltyPoints: 'Loyalty points',
};

/**
 * Only `name` is required.
 *
 * The dialog this replaces demanded an email and *invented* one when a row had
 * none — `${name}${4 random chars}@zeneva-import.local` — which put an address
 * that reaches nobody on thousands of real customer records. A row with a name
 * and a phone number is a perfectly good customer; a row with a fabricated email
 * is a worse one.
 */
export const CUSTOMER_REQUIRED_FIELDS: CustomerImportField[] = ['name'];

/**
 * Header aliases, lowercase and punctuation-stripped by `normalizeHeader`.
 *
 * Covers what the other systems in this market actually export — Shopify,
 * WooCommerce, QuickBooks, a Nigerian bank statement, and the handwritten
 * headings people type themselves ("customer name", "gsm", "acct no").
 */
const CUSTOMER_HEADER_ALIASES: Record<CustomerImportField, string[]> = {
  name: [
    'name', 'customer', 'customername', 'customer name', 'fullname', 'full name',
    'client', 'clientname', 'contact', 'contactname', 'firstname', 'surname',
    'company', 'companyname', 'businessname', 'buyer', 'debtor', 'account name',
    'accountname', 'title',
  ],
  phone: [
    'phone', 'phonenumber', 'phone number', 'mobile', 'mobilenumber', 'tel',
    'telephone', 'cell', 'cellphone', 'contactnumber', 'msisdn', 'gsm', 'whatsapp',
    'whatsappnumber', 'number', 'phoneno', 'phone no', 'tel no',
  ],
  email: ['email', 'emailaddress', 'email address', 'mail', 'emailid', 'e mail'],
  code: [
    'code', 'customercode', 'customer code', 'uniquecode', 'unique code',
    'customerid', 'customer id', 'clientid', 'accountnumber', 'accountno',
    'acctno', 'membershipnumber', 'memberid', 'reference', 'ref', 'cardnumber',
  ],
  tags: ['tags', 'tag', 'labels', 'label', 'group', 'groups', 'segment', 'category', 'type'],
  notes: ['notes', 'note', 'comment', 'comments', 'remarks', 'remark', 'description', 'details'],
  totalSpent: [
    'totalspent', 'total spent', 'lifetimevalue', 'ltv', 'totalpurchases',
    'amountspent', 'totalsales', 'revenue', 'turnover', 'totalvalue',
  ],
  loyaltyPoints: [
    'loyaltypoints', 'loyalty points', 'points', 'loyalty', 'rewardpoints',
    'rewards', 'pointsbalance', 'bonus',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Column mapping
// ─────────────────────────────────────────────────────────────────────────────

export type CustomerMappingVia = 'exact' | 'alias' | 'value' | 'ai' | 'manual';

export type CustomerColumnMapping = {
  index: number;
  source: string;
  field: CustomerImportField | null;
  confidence: number;
  via: CustomerMappingVia;
};

export type CustomerMappingResult = {
  columns: CustomerColumnMapping[];
  uncertain: CustomerColumnMapping[];
  /** True when a column could not be placed *and* no column supplied a name. */
  needsAi: boolean;
};

export const CUSTOMER_AI_MAPPING_THRESHOLD = 0.7;

/** Every alias flattened once, so header lookup is a map hit rather than a scan. */
const ALIAS_INDEX: Map<string, CustomerImportField> = (() => {
  const index = new Map<string, CustomerImportField>();
  for (const field of CUSTOMER_IMPORT_FIELDS) {
    for (const alias of CUSTOMER_HEADER_ALIASES[field]) {
      index.set(normalizeHeader(alias), field);
    }
  }
  return index;
})();

/** Looks like an email address. Deliberately loose — this is a hint, not validation. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Looks like a phone number.
 *
 * Seven digits is the floor, because that is a landline without an area code and
 * is the shortest thing anybody in this market would write down as a contact
 * number. Requiring the digits to be most of the string keeps it from claiming a
 * column of prices — `12,000` is five digits and would otherwise qualify.
 */
function looksLikePhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;
  return digits.length / trimmed.replace(/\s/g, '').length >= 0.6;
}

function looksLikeMoney(value: string): boolean {
  return /^[^\d-]{0,3}-?[\d,. ]+$/.test(value.trim()) && /\d/.test(value);
}

/**
 * Infer a column's meaning from its values, for a file with no usable headers.
 *
 * A stocktake pasted out of WhatsApp has no header row at all, and a bank
 * statement's headers name the bank's fields rather than Zeneva's. The values are
 * the more reliable signal in both cases: a column that is 90% email addresses is
 * the email column whatever it is called.
 *
 * Returns `null` rather than guessing when the evidence is weak — an unmapped
 * column is visible in the review table and fixable in one click, while a wrong
 * one silently writes phone numbers into the notes field.
 */
function inferFromValues(values: string[]): { field: CustomerImportField; confidence: number } | null {
  const sample = values.map(v => (v ?? '').trim()).filter(Boolean).slice(0, 40);
  if (sample.length < 2) return null;

  const share = (predicate: (v: string) => boolean) =>
    sample.filter(predicate).length / sample.length;

  const emailShare = share(looksLikeEmail);
  if (emailShare >= 0.7) return { field: 'email', confidence: Math.min(0.95, emailShare) };

  const phoneShare = share(looksLikePhone);
  if (phoneShare >= 0.7) return { field: 'phone', confidence: Math.min(0.9, phoneShare) };

  /*
   * Names, by elimination: mostly letters, more than one word often enough, and
   * not numeric. Capped below the threshold that would make it certain — a column
   * of city names looks exactly like this, so it is offered rather than assumed.
   */
  const wordy = share(v => /[a-z]/i.test(v) && !looksLikeMoney(v) && v.replace(/[^a-z ]/gi, '').length >= v.length * 0.6);
  if (wordy >= 0.8) return { field: 'name', confidence: 0.65 };

  return null;
}

/**
 * Decide what each column means.
 *
 * Header first — an exact alias hit is a lookup and cannot be wrong about what it
 * matched — then value inference for anything left. A field already claimed by a
 * confident column is not claimed again, so a file with both "Name" and "Company"
 * does not map both onto `name` and lose one.
 */
export function mapCustomerColumns(table: RawTable): CustomerMappingResult {
  const width = Math.max(
    table.headers.length,
    ...(table.rows.length > 0 ? table.rows.map(r => r.length) : [0]),
  );

  const columns: CustomerColumnMapping[] = [];
  const claimed = new Set<CustomerImportField>();

  // Pass 1: headers.
  for (let i = 0; i < width; i++) {
    const header = table.hasHeaderRow ? (table.headers[i] ?? '') : '';
    const source = header || `Column ${i + 1}`;

    if (!table.hasHeaderRow || !header.trim()) {
      columns.push({ index: i, source, field: null, confidence: 0, via: 'exact' });
      continue;
    }

    const key = normalizeHeader(header);
    const hit = ALIAS_INDEX.get(key);
    if (hit && !claimed.has(hit)) {
      claimed.add(hit);
      columns.push({ index: i, source, field: hit, confidence: 1, via: 'alias' });
    } else {
      columns.push({ index: i, source, field: null, confidence: 0, via: 'alias' });
    }
  }

  // Pass 2: values, for whatever pass 1 left unplaced.
  for (const column of columns) {
    if (column.field) continue;
    const values = table.rows.map(row => row[column.index] ?? '');
    const inferred = inferFromValues(values);
    if (inferred && !claimed.has(inferred.field)) {
      claimed.add(inferred.field);
      column.field = inferred.field;
      column.confidence = inferred.confidence;
      column.via = 'value';
    }
  }

  const uncertain = columns.filter(c => !c.field || c.confidence < CUSTOMER_AI_MAPPING_THRESHOLD);

  return {
    columns,
    uncertain,
    // Only worth paying a model when the *required* field is missing. A file whose
    // notes column went unrecognised imports perfectly well without one.
    needsAi: uncertain.length > 0 && !claimed.has('name'),
  };
}

/**
 * Fold an AI mapping into a deterministic one.
 *
 * Only fills columns the local pass left unclaimed, and only with fields nothing
 * else already holds. The model is a suggestion engine; it does not get to
 * overrule a header that matched an alias exactly.
 */
export function applyCustomerAiMapping(
  result: CustomerMappingResult,
  suggestions: { index: number; field: CustomerImportField | null }[],
): CustomerMappingResult {
  const columns = result.columns.map(c => ({ ...c }));
  const claimed = new Set(columns.map(c => c.field).filter(Boolean) as CustomerImportField[]);

  for (const suggestion of suggestions) {
    const column = columns.find(c => c.index === suggestion.index);
    if (!column || column.field) continue;
    if (!suggestion.field) continue;
    if (!CUSTOMER_IMPORT_FIELDS.includes(suggestion.field)) continue;
    if (claimed.has(suggestion.field)) continue;

    claimed.add(suggestion.field);
    column.field = suggestion.field;
    column.confidence = 0.8;
    column.via = 'ai';
  }

  const uncertain = columns.filter(c => !c.field || c.confidence < CUSTOMER_AI_MAPPING_THRESHOLD);
  return { columns, uncertain, needsAi: false };
}

/** Set one column by hand. A manual choice is never second-guessed. */
export function setCustomerMapping(
  result: CustomerMappingResult,
  index: number,
  field: CustomerImportField | null,
): CustomerMappingResult {
  const columns = result.columns.map(c => {
    if (c.index === index) return { ...c, field, confidence: field ? 1 : 0, via: 'manual' as const };
    // A field can only be in one column; assigning it here releases it there.
    if (field && c.field === field) return { ...c, field: null, confidence: 0, via: 'manual' as const };
    return { ...c };
  });

  return {
    columns,
    uncertain: columns.filter(c => !c.field || c.confidence < CUSTOMER_AI_MAPPING_THRESHOLD),
    needsAi: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Drafts
// ─────────────────────────────────────────────────────────────────────────────

export type CustomerDraftIssue = {
  field?: CustomerImportField;
  message: string;
  severity: 'warn' | 'error';
};

export type DraftCustomer = {
  key: string;
  name: string;
  phone?: string;
  email?: string;
  code?: string;
  tags?: string[];
  notes?: string;
  totalSpent?: number;
  loyaltyPoints?: number;
  raw: Partial<Record<CustomerImportField, string>>;
  issues: CustomerDraftIssue[];
};

/**
 * A number, or `undefined` when the source said nothing.
 *
 * `undefined` and `0` are different claims and the commit treats them
 * differently: absent means "leave whatever is there", zero means "the file says
 * zero". Returning `0` for an empty cell is how an import wipes a loyalty balance
 * it was never given.
 */
function parseNumberOrUndefined(input: string | undefined): number | undefined {
  if (input === undefined || input === null) return undefined;
  const trimmed = String(input).trim();
  if (!trimmed) return undefined;
  // Currency symbols, thousands separators and stray spaces all go.
  const cleaned = trimmed.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return undefined;
  return value;
}

/** Tags come as "wholesale, pays late" or "wholesale|pays late" or "wholesale; pays late". */
function parseTags(input: string | undefined): string[] | undefined {
  if (!input?.trim()) return undefined;
  const tags = input
    .split(/[,;|/]/)
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 20);
  return tags.length > 0 ? tags : undefined;
}

/**
 * Turn a mapped table into drafts.
 *
 * A row with issues still imports. Refusing rows is how an importer silently
 * drops a tenth of somebody's customer book; naming what was odd about a row and
 * importing it anyway leaves the shop in control.
 *
 * The one exception is a row with no name at all, which is dropped — a customer
 * with no name cannot be found at the till, so importing it creates a record
 * nobody can ever use and the Health tab immediately flags.
 */
export function buildCustomerDrafts(
  table: RawTable,
  mapping: CustomerMappingResult,
): { drafts: DraftCustomer[]; skippedRows: number } {
  const byField = new Map<CustomerImportField, number>();
  for (const column of mapping.columns) {
    if (column.field && !byField.has(column.field)) byField.set(column.field, column.index);
  }

  const cell = (row: string[], field: CustomerImportField): string | undefined => {
    const index = byField.get(field);
    if (index === undefined) return undefined;
    const value = row[index];
    return value === undefined || value === null ? undefined : String(value).trim();
  };

  const drafts: DraftCustomer[] = [];
  let skippedRows = 0;

  table.rows.forEach((row, rowIndex) => {
    const rawName = cell(row, 'name');
    const name = rawName?.replace(/\s+/g, ' ').trim();

    if (!name) {
      // A blank spacer row in a spreadsheet is not a customer, and neither is a
      // row that only carries a phone number with nobody attached to it.
      skippedRows++;
      return;
    }

    const issues: CustomerDraftIssue[] = [];
    const raw: Partial<Record<CustomerImportField, string>> = {};
    for (const field of CUSTOMER_IMPORT_FIELDS) {
      const value = cell(row, field);
      if (value !== undefined && value !== '') raw[field] = value;
    }

    const phoneRaw = cell(row, 'phone');
    const phone = phoneRaw || undefined;
    if (phoneRaw && !normalizePhone(phoneRaw)) {
      issues.push({ field: 'phone', message: `"${phoneRaw}" does not look like a phone number.`, severity: 'warn' });
    }

    const emailRaw = cell(row, 'email');
    let email = emailRaw || undefined;
    if (emailRaw && isPlaceholderEmail(emailRaw)) {
      /*
       * A previous Zeneva CSV import invented these. Re-importing an export of
       * that data would carry them straight back in, so they are dropped here —
       * a missing email is honest, a fabricated one is not.
       */
      email = undefined;
      issues.push({
        field: 'email',
        message: 'That address was auto-generated by an old import and reaches nobody, so it was left out.',
        severity: 'warn',
      });
    } else if (emailRaw && !looksLikeEmail(emailRaw)) {
      issues.push({ field: 'email', message: `"${emailRaw}" does not look like an email address.`, severity: 'warn' });
    }

    if (!normalizePhone(phone) && !realEmail({ email: email || '' })) {
      issues.push({
        message: 'No phone and no email — you will not be able to contact or search for this customer.',
        severity: 'warn',
      });
    }

    const totalSpent = parseNumberOrUndefined(cell(row, 'totalSpent'));
    const loyaltyPoints = parseNumberOrUndefined(cell(row, 'loyaltyPoints'));

    if (totalSpent !== undefined && totalSpent < 0) {
      issues.push({ field: 'totalSpent', message: 'Total spent is negative and was left out.', severity: 'warn' });
    }
    if (loyaltyPoints !== undefined && loyaltyPoints < 0) {
      issues.push({ field: 'loyaltyPoints', message: 'Loyalty points are negative and were left out.', severity: 'warn' });
    }

    drafts.push({
      key: `r${rowIndex}`,
      name,
      phone,
      email,
      code: cell(row, 'code') || undefined,
      tags: parseTags(cell(row, 'tags')),
      notes: cell(row, 'notes') || undefined,
      totalSpent: totalSpent !== undefined && totalSpent >= 0 ? totalSpent : undefined,
      loyaltyPoints: loyaltyPoints !== undefined && loyaltyPoints >= 0 ? loyaltyPoints : undefined,
      raw,
      issues,
    });
  });

  return { drafts, skippedRows };
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching against the customers already on file
// ─────────────────────────────────────────────────────────────────────────────

export type CustomerMatchReason = 'code' | 'phone' | 'email' | 'name-exact' | 'in-file';

export type CustomerMatchCandidate = {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerCode?: string;
  reason: CustomerMatchReason;
  /** One short phrase: "same phone", "same code". Shown next to the row. */
  explanation: string;
};

export type CustomerVerdict =
  | { kind: 'new' }
  | { kind: 'certain'; match: CustomerMatchCandidate }
  | { kind: 'possible'; candidates: CustomerMatchCandidate[] };

export type CustomerRowDecision =
  | { action: 'create' }
  /** Fill blanks on the existing record; never overwrite what is already there. */
  | { action: 'update'; customerId: string }
  | { action: 'skip' };

export type StagedCustomerRow = {
  draft: DraftCustomer;
  verdict: CustomerVerdict;
  decision: CustomerRowDecision;
  decidedByUser: boolean;
};

/**
 * Match every draft against the existing book, and against the file itself.
 *
 * Three rules carried over from the product importer, because they were learned
 * the expensive way:
 *
 *  - **Be certain, or ask.** A code, phone or email match is a fact and is applied
 *    without a question. A name match is a question — two people really are called
 *    Musa Ibrahim — and an unanswered question resolves to `create`, never to an
 *    update. A visible duplicate can be merged from the Health tab in one click; a
 *    wrong merge silently corrupts somebody's spend history for months.
 *  - **A certain match claims its customer**, so a second row pointing at the same
 *    person is forced to be a question rather than quietly updating the same
 *    record twice.
 *  - **Duplicates inside the file itself count.** A spreadsheet listing the same
 *    person on rows 4 and 900 would otherwise create two records in one import —
 *    the exact problem this whole feature exists to end.
 */
export function stageCustomerRows(
  drafts: DraftCustomer[],
  existing: Customer[],
): StagedCustomerRow[] {
  const byCode = new Map<string, Customer>();
  const byPhone = new Map<string, Customer>();
  const byEmail = new Map<string, Customer>();
  const byName = new Map<string, Customer[]>();

  for (const customer of existing) {
    const code = normalizeCode(customer.code);
    if (code && !byCode.has(code)) byCode.set(code, customer);

    const phone = normalizePhone(customer.phone);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, customer);

    const email = realEmail(customer)?.toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, customer);

    const name = normalizeName(customer.name);
    if (name) {
      const bucket = byName.get(name);
      if (bucket) bucket.push(customer);
      else byName.set(name, [customer]);
    }
  }

  const claimed = new Set<string>();
  /** Keys already used *by earlier rows of this same file*. */
  const seenInFile = new Map<string, DraftCustomer>();

  const toCandidate = (
    customer: Customer,
    reason: CustomerMatchReason,
    explanation: string,
  ): CustomerMatchCandidate => ({
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerCode: customer.code,
    reason,
    explanation,
  });

  return drafts.map(draft => {
    const code = normalizeCode(draft.code);
    const phone = normalizePhone(draft.phone);
    const email = realEmail({ email: draft.email || '' })?.toLowerCase();
    const name = normalizeName(draft.name);

    // ── Duplicate within this file, reported before anything else: the fix is to
    // drop the row, without touching the shop's data at all.
    const fileKeys = [
      code ? `code:${code}` : null,
      phone ? `phone:${phone}` : null,
      email ? `email:${email}` : null,
    ].filter((k): k is string => !!k);

    const earlierRow = fileKeys.map(k => seenInFile.get(k)).find(Boolean);
    if (earlierRow) {
      return {
        draft,
        verdict: {
          kind: 'possible' as const,
          candidates: [{
            customerId: '',
            customerName: earlierRow.name,
            reason: 'in-file' as const,
            explanation: 'Also appears earlier in this file',
          }],
        },
        decision: { action: 'skip' as const },
        decidedByUser: false,
      };
    }

    fileKeys.forEach(k => seenInFile.set(k, draft));

    // ── Certain matches against the existing book.
    const certain =
      (code && byCode.get(code) && { customer: byCode.get(code)!, reason: 'code' as const, why: 'Same customer code' }) ||
      (phone && byPhone.get(phone) && { customer: byPhone.get(phone)!, reason: 'phone' as const, why: 'Same phone number' }) ||
      (email && byEmail.get(email) && { customer: byEmail.get(email)!, reason: 'email' as const, why: 'Same email address' }) ||
      null;

    if (certain && !claimed.has(certain.customer.id)) {
      claimed.add(certain.customer.id);
      return {
        draft,
        verdict: { kind: 'certain', match: toCandidate(certain.customer, certain.reason, certain.why) },
        decision: { action: 'update', customerId: certain.customer.id },
        decidedByUser: false,
      };
    }

    // ── A name match is a question.
    const nameHits = (byName.get(name) || []).filter(c => !claimed.has(c.id));
    if (nameHits.length > 0) {
      return {
        draft,
        verdict: {
          kind: 'possible',
          candidates: nameHits.slice(0, 3).map(c => toCandidate(c, 'name-exact', 'Same name')),
        },
        // Unanswered resolves to create, deliberately. See the doc comment.
        decision: { action: 'create' },
        decidedByUser: false,
      };
    }

    return { draft, verdict: { kind: 'new' }, decision: { action: 'create' }, decidedByUser: false };
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// Commit
// ─────────────────────────────────────────────────────────────────────────────

export type CustomerCommitPlan = {
  create: StagedCustomerRow[];
  update: StagedCustomerRow[];
  skipped: StagedCustomerRow[];
};

export function planCustomerCommit(rows: StagedCustomerRow[]): CustomerCommitPlan {
  return {
    create: rows.filter(r => r.decision.action === 'create'),
    update: rows.filter(r => r.decision.action === 'update'),
    skipped: rows.filter(r => r.decision.action === 'skip'),
  };
}

/**
 * The fields an `update` row will actually write.
 *
 * **Fills blanks only.** An import is new information about somebody the shop
 * already knows, not a replacement for what they know — the record on file has
 * been edited by staff, tagged, annotated and attached to receipts, and a
 * supplier's spreadsheet does not get to overwrite that. So a value is written
 * only where the existing record has nothing.
 *
 * The exceptions are the two running totals. `totalSpent` and `loyaltyPoints` are
 * taken at their **maximum**, never summed: an import is a snapshot from another
 * system, and adding a snapshot to a running total double-counts every purchase
 * the shop has already recorded here. Taking the larger keeps a migrated balance
 * without inflating one Zeneva already knows about.
 */
export function buildCustomerUpdate(
  draft: DraftCustomer,
  existing: Customer,
): Partial<Customer> {
  const values: Partial<Customer> = {};

  if (!existing.name?.trim() && draft.name) values.name = draft.name;
  if (!normalizePhone(existing.phone) && draft.phone) values.phone = draft.phone;
  if (!realEmail(existing) && draft.email) values.email = draft.email;
  if (!normalizeCode(existing.code) && draft.code) values.code = draft.code;
  if (!existing.notes?.trim() && draft.notes) values.notes = draft.notes;

  if (draft.tags?.length) {
    const merged = Array.from(new Set([...(existing.tags || []), ...draft.tags]));
    if (merged.length !== (existing.tags || []).length) values.tags = merged;
  }

  if (draft.totalSpent !== undefined && draft.totalSpent > (existing.totalSpent || 0)) {
    values.totalSpent = draft.totalSpent;
  }
  if (draft.loyaltyPoints !== undefined && draft.loyaltyPoints > (existing.loyaltyPoints || 0)) {
    values.loyaltyPoints = draft.loyaltyPoints;
  }

  return values;
}

export type CustomerWrite =
  | { type: 'add-customer'; payload: Record<string, any>; description: string }
  | { type: 'update-customer'; payload: { id: string; values: Record<string, any> }; description: string };

export type CustomerWriteBundle = {
  writes: CustomerWrite[];
  created: number;
  updated: number;
  skipped: number;
  /** Rows decided as an update whose existing record already held everything. */
  alreadyCurrent: number;
};

/**
 * Turn a decided plan into queue actions.
 *
 * Pure, and separate from the hook, so the harness can assert the payloads rather
 * than the payloads being whatever a component happened to assemble. Four of these
 * fields are load-bearing in a way that is invisible until something breaks:
 *
 *  - **`lowercaseName`** is what the customer search queries against, so a customer
 *    imported without it cannot be found at the till — by name, by the search box,
 *    or by the POS's customer picker. `lowercaseEmail` is the same for email.
 *    `pos-context`'s commit switch derives both, but only from the fields it is
 *    given, so they are set here too and stay consistent whichever path writes.
 *  - **`totalSpent` defaults to `0` on a create and is never left absent**, because
 *    the customers list orders by it and Firestore drops a document from an
 *    `orderBy` when the field is missing. An imported customer with no `totalSpent`
 *    is invisible on the very page that imported them.
 *  - **`branchId` is not set here.** `addToQueue` injects the active branch, which is
 *    the only thing that knows it. The dialog this replaces set it from
 *    `useBranch()` and got it right; it got everything around it wrong.
 *  - **An update that would write nothing is dropped**, not queued as an empty
 *    `update-customer`. An empty write still costs a document write, still bumps
 *    `updatedAt`, and would make a re-import of the same file look like it changed
 *    the whole book.
 */
export function buildCustomerWrites(
  plan: CustomerCommitPlan,
  existing: Customer[],
  businessId: string,
  newId: () => string,
): CustomerWriteBundle {
  const byId = new Map(existing.map(c => [c.id, c]));
  const writes: CustomerWrite[] = [];
  let alreadyCurrent = 0;

  for (const row of plan.create) {
    const draft = row.draft;
    writes.push({
      type: 'add-customer',
      payload: {
        id: newId(),
        businessId,
        name: draft.name,
        lowercaseName: draft.name.toLowerCase(),
        // Empty strings rather than absent fields: the customers page reads these
        // straight onto inputs, and `undefined` there makes React drop to an
        // uncontrolled input on first edit.
        phone: draft.phone ?? '',
        email: draft.email ?? '',
        lowercaseEmail: (draft.email ?? '').toLowerCase(),
        code: draft.code ?? '',
        ...(draft.tags?.length ? { tags: draft.tags } : {}),
        ...(draft.notes ? { notes: draft.notes } : {}),
        totalSpent: draft.totalSpent ?? 0,
        loyaltyPoints: draft.loyaltyPoints ?? 0,
      },
      description: `Import customer ${draft.name}`,
    });
  }

  for (const row of plan.update) {
    if (row.decision.action !== 'update') continue;
    const target = byId.get(row.decision.customerId);
    if (!target) continue;

    const values = buildCustomerUpdate(row.draft, target);
    if (Object.keys(values).length === 0) {
      alreadyCurrent++;
      continue;
    }

    // Kept in step with the create path above, and with the commit switch: a name
    // change that did not carry `lowercaseName` would leave the customer findable
    // under their old name only.
    if (values.name) values.lowercaseName = values.name.toLowerCase();
    if (values.email !== undefined) values.lowercaseEmail = (values.email ?? '').toLowerCase();

    writes.push({
      type: 'update-customer',
      payload: { id: target.id, values },
      description: `Update customer ${target.name || row.draft.name}`,
    });
  }

  return {
    writes,
    created: plan.create.length,
    updated: writes.filter(w => w.type === 'update-customer').length,
    skipped: plan.skipped.length,
    alreadyCurrent,
  };
}
