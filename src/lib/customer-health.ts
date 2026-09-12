/**
 * Customer book integrity — the customers-page answer to the Inventory Health tab.
 *
 * The shape is deliberately the same as `src/lib/forensics.ts` and
 * `src/lib/business-rating.ts`: **pure functions, `now` as an input, no clock
 * read anywhere in the module.** A customer record gets named on screen as a
 * duplicate of another one, and the owner is offered a merge that deletes a
 * document — so every conclusion here has to be reproducible from its inputs and
 * re-checkable by hand. "Why is this flagged" cannot be answered by a function
 * that reads `Date.now()`.
 *
 * What this is *not*: a score out of 100. The Inventory Health tab scores a
 * catalogue because a missing cost price is a spectrum — most shops sit
 * somewhere in the middle and the number tells them which way they are moving.
 * A duplicated customer is not a spectrum. It is either two records for one
 * person or it is not, and the only useful output is the pair, so the owner can
 * look at it and decide. Counting issues is honest; grading the book is not.
 *
 * The severities exist for ordering, not for judgement:
 *   - `critical` — the shop is losing data or money because of it right now
 *                  (a code collision breaks lookup; an unbranched customer is
 *                  invisible to the branch that owns them).
 *   - `warning`  — very likely a mistake, needs a human to confirm
 *                  (same name, same phone).
 *   - `info`     — untidy, costs nothing today (no contact details on file).
 */

import type { Customer } from '@/types';

/**
 * Emails the old CSV importer invented so a row without one would still save.
 *
 * The dialog that did it — `import-customers-dialog.tsx`, unreferenced since the
 * smart customer importer replaced it — built
 * `${sanitizedName}${4 random chars}@zeneva-import.local` for every row missing an
 * email, and that address reached Firestore looking exactly like a real one. Nothing
 * writes them any more, but the ones it wrote are on live customer records and always
 * will be, so this stays. Two consequences this module has to handle:
 *
 *  - It must never be offered as a way to contact anybody, so a customer whose
 *    only email is a placeholder counts as having **no** email.
 *  - It must never be treated as identifying. Two placeholders never collide
 *    (the random suffix guarantees that), so they cannot produce a false
 *    duplicate — but they cannot confirm one either, and a duplicate check that
 *    trusted them would report every imported customer as uniquely contactable.
 */
const PLACEHOLDER_EMAIL_DOMAIN = '@zeneva-import.local';

export function isPlaceholderEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim().endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

/** A real, usable email — or null. Placeholders are not emails. */
export function realEmail(c: Pick<Customer, 'email'>): string | null {
  const e = c.email?.trim();
  if (!e) return null;
  if (isPlaceholderEmail(e)) return null;
  return e;
}

/**
 * Combining diacritical marks, U+0300 to U+036F — what `normalize('NFD')` splits
 * an accented letter into. Built from char codes rather than written as a regex
 * literal on purpose: a literal puts the raw combining bytes in this file, where
 * they are invisible in every editor and silently lost by anything that
 * re-encodes the source.
 */
const COMBINING_MARKS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

/**
 * Names reduced to a comparison key.
 *
 * Diacritics, case, punctuation and runs of whitespace all go, because none of
 * them distinguish two people: "Mrs. Adeyemi", "mrs adeyemi" and "Mrs  Adeyemi"
 * are one customer entered three times. Word *order* is normalised too — a shop
 * that writes "Bello Imam" on one visit and "Imam Bello" on the next has one
 * customer, and this is the single most common way a duplicate hides from an
 * exact-match check.
 *
 * What is deliberately kept: every word. Dropping honorifics or initials would
 * merge "A. Okafor" into "Ada Okafor" on a guess, and a wrong merge deletes a
 * record. Same principle as the importer's `extractSize` — normalise what is
 * certainly noise, keep what might be signal.
 */
export function normalizeName(name: string | undefined | null): string {
  if (!name) return '';
  const cleaned = name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.split(' ').sort().join(' ');
}

/**
 * Phone numbers reduced to a comparison key.
 *
 * Nigerian shops type the same line four ways — `08031234567`,
 * `+2348031234567`, `234 803 123 4567`, `0803-123-4567`. Stripping non-digits
 * gets three of those to agree; the fourth needs the country code handled, so
 * the last **10** digits are the key: that is the national significant number
 * for NG (`803 123 4567`) with the trunk `0` and the `+234` both gone.
 *
 * Ten and not nine: nine would collide two genuinely different numbers whose
 * last nine digits happen to agree, and this key is used to *delete* a record.
 * Shorter than ten digits is kept whole rather than padded — a five-digit
 * scribble is not a phone number, and truncating it would make every short
 * scribble equal to every other.
 */
export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Unique codes compare case- and punctuation-insensitively, because the shop types
 * them by hand and does not type them consistently.
 *
 * The stripped set is `[\s\-_.]`, character for character the same as `normalizeSku`
 * in `src/lib/import/normalize.ts`, and that is deliberate: a customer code and a
 * SKU are the same kind of thing — a hand-entered identifier — so `ACC-1`, `ACC 1`,
 * `acc_1` and `ACC1` are one code, exactly as they are one SKU.
 *
 * This used to strip whitespace only, which made two promises false. The importer
 * treats a code match as a *fact* and applies it without asking, so a book
 * re-imported with the hyphens typed differently silently created a second record
 * for everybody in it — the precise failure the importer exists to end. And
 * `suggestFreeCode` below claims it "never hands back a code that would collide
 * again", while `ACC-2` and `ACC2` hashed apart, so it would hand back a code the
 * Health tab then flagged as a duplicate.
 *
 * The cost, stated plainly because it is a real one: a suggested replacement code
 * now loses the shop's punctuation (`ACC-1` yields `ACC2`, not `ACC-2`). Cosmetics
 * of a suggested string against a uniqueness guarantee that actually holds.
 */
export function normalizeCode(code: string | undefined | null): string {
  if (!code) return '';
  return code.replace(/[\s\-_.]/g, '').toUpperCase();
}

export type CustomerIssueKind =
  /** Two or more customers share a unique code. Breaks lookup by code. */
  | 'duplicate-code'
  /** Two or more customers share a phone number. */
  | 'duplicate-phone'
  /** Two or more customers share a real email address. */
  | 'duplicate-email'
  /** Two or more customers reduce to the same name. */
  | 'duplicate-name'
  /** No phone and no real email — cannot be contacted or looked up. */
  | 'no-contact'
  /** Email is a `@zeneva-import.local` placeholder from the old CSV importer. */
  | 'placeholder-email'
  /** No `branchId` in a multi-branch shop, so no branch's list shows them. */
  | 'no-branch'
  /** Blank or whitespace-only name. */
  | 'missing-name';

export type IssueSeverity = 'critical' | 'warning' | 'info';

/**
 * A customer already on file who may be the person somebody is about to create.
 *
 * `on` is the evidence, and the caller's wording has to follow it: a `code` or
 * `email` match is a statement ("this customer already exists"), a `phone` match
 * is nearly one, and a `name` match is a question ("is this the same person?").
 * Two people genuinely share a name, so a name match must never block a create.
 */
export interface CustomerDuplicateMatch {
  customer: Customer;
  on: 'code' | 'phone' | 'email' | 'name';
}

export const ISSUE_SEVERITY: Record<CustomerIssueKind, IssueSeverity> = {
  'duplicate-code': 'critical',
  'no-branch': 'critical',
  'duplicate-phone': 'warning',
  'duplicate-email': 'warning',
  'duplicate-name': 'warning',
  'missing-name': 'warning',
  'no-contact': 'info',
  'placeholder-email': 'info',
};

/**
 * A set of customers that appear to be the same person, or to clash on a field
 * that has to be unique.
 */
export interface DuplicateGroup {
  kind: 'duplicate-code' | 'duplicate-phone' | 'duplicate-email' | 'duplicate-name';
  /** The shared value, as the shop typed it on the record kept as primary. */
  value: string;
  /**
   * The members, **primary first**.
   *
   * Primary is the record the merge keeps, and it is chosen by evidence rather
   * than by convenience: most money spent first (that is the record the
   * receipts and the loyalty balance actually belong to), then oldest
   * (`createdAt`), then id, so the order is total and stable across renders.
   * A merge that kept an arbitrary member would move a real spend history onto
   * a blank record about half the time.
   */
  members: Customer[];
}

export interface CustomerIssueCounts {
  duplicateCodes: number;
  duplicatePhones: number;
  duplicateEmails: number;
  duplicateNames: number;
  noContact: number;
  placeholderEmails: number;
  noBranch: number;
  missingNames: number;
}

export interface CustomerHealthReport {
  /** Customers examined. */
  examined: number;
  /**
   * Distinct customers carrying at least one issue.
   *
   * Not the sum of the counts below — one record can be a duplicate *and*
   * uncontactable, and a tile that says 9 over a table that lists 7 is worse
   * than either alone. This is the figure the tab badge shows.
   */
  affected: number;
  /** How many records could be retired if every duplicate group were merged. */
  redundantRecords: number;
  counts: CustomerIssueCounts;
  groups: DuplicateGroup[];
  /** Per-customer issue kinds, for filtering the table and badging a row. */
  issuesByCustomer: Map<string, CustomerIssueKind[]>;
}

/**
 * Rank within a duplicate group. Highest spend wins; ties break to the oldest
 * record, then to the id so the order never flickers between renders.
 *
 * `createdAt` is a Firestore Timestamp, a Date, or missing. A missing one sorts
 * last rather than to the epoch: `safeToDate` returns the epoch for a missing
 * value (see the note in `src/lib/achievements.ts`), and the epoch would win an
 * "oldest" tiebreak against every real record — making a customer with no
 * timestamp the primary of every group it lands in.
 */
function createdMillis(c: Customer): number {
  const raw: any = c.createdAt;
  if (!raw) return Number.MAX_SAFE_INTEGER;
  if (typeof raw?.toDate === 'function') {
    const t = raw.toDate().getTime();
    return Number.isFinite(t) && t > 0 ? t : Number.MAX_SAFE_INTEGER;
  }
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) && t > 0 ? t : Number.MAX_SAFE_INTEGER;
  }
  if (typeof raw === 'number' && raw > 0) return raw;
  if (typeof raw?.seconds === 'number') return raw.seconds * 1000;
  return Number.MAX_SAFE_INTEGER;
}

export function comparePrimaryFirst(a: Customer, b: Customer): number {
  const spendDiff = (b.totalSpent || 0) - (a.totalSpent || 0);
  if (spendDiff !== 0) return spendDiff;
  const ageDiff = createdMillis(a) - createdMillis(b);
  if (ageDiff !== 0) return ageDiff;
  return a.id.localeCompare(b.id);
}

/**
 * Group customers by a normalised key, keeping only keys with more than one
 * member. `keyOf` returning `''` opts a record out — an empty phone is not a
 * shared phone, and grouping on it would report the whole book as one duplicate.
 */
function groupByKey(
  customers: Customer[],
  kind: DuplicateGroup['kind'],
  keyOf: (c: Customer) => string,
  displayOf: (c: Customer) => string,
): DuplicateGroup[] {
  const buckets = new Map<string, Customer[]>();
  for (const c of customers) {
    const key = keyOf(c);
    if (!key) continue;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(c);
    else buckets.set(key, [c]);
  }

  const groups: DuplicateGroup[] = [];
  for (const members of buckets.values()) {
    if (members.length < 2) continue;
    const ordered = [...members].sort(comparePrimaryFirst);
    groups.push({ kind, value: displayOf(ordered[0]), members: ordered });
  }
  return groups;
}

/**
 * The whole check, in one pass per dimension.
 *
 * `isMultiBranch` is passed in rather than inferred from the data. Inferring it
 * — "some customer has a branchId, so this is a multi-branch shop" — gets it
 * backwards for the case that matters: a single-branch shop where every record
 * legitimately has no `branchId` would be told nothing, which is right, but a
 * shop that just *created* its second branch has a whole book with no branch and
 * needs telling. Only the caller knows how many branches exist.
 *
 * `now` is accepted and currently unused by any check. It stays in the signature
 * because the next check anybody adds here will be time-based ("no purchase in
 * two years"), and the moment that arrives the alternative is reading the clock
 * inside the function — which is the thing this module exists not to do.
 */
export function computeCustomerHealth(
  customers: Customer[] | null,
  options: { isMultiBranch: boolean; now?: number },
): CustomerHealthReport | null {
  /*
   * `null` is not `[]`. Null means the caller has no customer list yet — the
   * sync is still running, or the cache could not be read — and the surface must
   * keep its skeleton up. An empty array asserts the book is empty, which is a
   * real, healthy state for a new shop. Collapsing the two is what puts "No
   * products found" on a POS whose catalogue merely failed to load.
   */
  if (customers === null) return null;

  const issuesByCustomer = new Map<string, CustomerIssueKind[]>();
  const flag = (id: string, kind: CustomerIssueKind) => {
    const list = issuesByCustomer.get(id);
    if (list) {
      if (!list.includes(kind)) list.push(kind);
    } else {
      issuesByCustomer.set(id, [kind]);
    }
  };

  const codeGroups = groupByKey(customers, 'duplicate-code', c => normalizeCode(c.code), c => c.code || '');
  const phoneGroups = groupByKey(customers, 'duplicate-phone', c => normalizePhone(c.phone), c => c.phone || '');
  const emailGroups = groupByKey(
    customers,
    'duplicate-email',
    c => realEmail(c)?.toLowerCase() ?? '',
    c => realEmail(c) || '',
  );
  const nameGroups = groupByKey(customers, 'duplicate-name', c => normalizeName(c.name), c => c.name || '');

  /*
   * A pair already reported as the same phone does not need reporting again as
   * the same name — it is one duplicate with one fix (merge), and listing it
   * twice makes the book look twice as broken as it is.
   *
   * Code collisions sit outside that suppression entirely, in both directions:
   * they neither get suppressed by a name match nor suppress one. A shared code
   * is a *collision*, not evidence of duplication — it has to be resolved even
   * between two genuinely different people, and its fix is to re-code one of
   * them, not to merge. So a pair that shares a code *and* looks like the same
   * person has two separate problems and must appear on both lists; letting the
   * code group hide the name match would have the owner re-code the record and
   * walk away leaving the real duplicate in place.
   */
  const seenPairs = new Set<string>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const groups: DuplicateGroup[] = [];

  for (const group of codeGroups) {
    groups.push(group);
    group.members.forEach(m => flag(m.id, group.kind));
  }

  for (const group of [...phoneGroups, ...emailGroups, ...nameGroups]) {
    const ids = group.members.map(m => m.id);

    let everyPairSeen = true;
    outer: for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!seenPairs.has(pairKey(ids[i], ids[j]))) {
          everyPairSeen = false;
          break outer;
        }
      }
    }
    if (everyPairSeen) continue;

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) seenPairs.add(pairKey(ids[i], ids[j]));
    }
    groups.push(group);
    group.members.forEach(m => flag(m.id, group.kind));
  }

  let noContact = 0;
  let placeholderEmails = 0;
  let noBranch = 0;
  let missingNames = 0;

  for (const c of customers) {
    if (!c.name?.trim()) {
      missingNames++;
      flag(c.id, 'missing-name');
    }
    if (isPlaceholderEmail(c.email)) {
      placeholderEmails++;
      flag(c.id, 'placeholder-email');
    }
    if (!normalizePhone(c.phone) && !realEmail(c)) {
      noContact++;
      flag(c.id, 'no-contact');
    }
    if (options.isMultiBranch && !c.branchId) {
      noBranch++;
      flag(c.id, 'no-branch');
    }
  }

  /*
   * How many records a full merge would retire: every group loses all but its
   * primary. Counted over `groups` (post-suppression) so a pair caught by both
   * phone and name is not counted twice, and code groups are excluded — a code
   * collision between two different people is fixed by re-coding one of them,
   * not by deleting either.
   */
  const redundantRecords = groups
    .filter(g => g.kind !== 'duplicate-code')
    .reduce((sum, g) => sum + (g.members.length - 1), 0);

  return {
    examined: customers.length,
    affected: issuesByCustomer.size,
    redundantRecords,
    counts: {
      duplicateCodes: codeGroups.length,
      duplicatePhones: groups.filter(g => g.kind === 'duplicate-phone').length,
      duplicateEmails: groups.filter(g => g.kind === 'duplicate-email').length,
      duplicateNames: groups.filter(g => g.kind === 'duplicate-name').length,
      noContact,
      placeholderEmails,
      noBranch,
      missingNames,
    },
    groups,
    issuesByCustomer,
  };
}

/**
 * What a merge would write, as a plain object the caller queues.
 *
 * Computed here rather than in the dialog so the arithmetic is testable and so
 * the rules below are stated once:
 *
 *  - **Money and points add up.** Both are running totals of things that really
 *    happened on both records. Keeping only the primary's would silently delete
 *    a spend history the receipts still prove.
 *  - **Contact details fill gaps, never overwrite.** The primary is the record
 *    with the spend; if it has a phone, that is the phone the shop has been
 *    using. A duplicate's phone is only wanted where the primary has none.
 *  - **Placeholder emails lose to real ones**, in either direction — that is the
 *    one case where a duplicate's value replaces the primary's, because a
 *    `@zeneva-import.local` address is not data.
 *  - **Tags union, notes concatenate.** Both are things a human typed about this
 *    person and neither is recoverable once dropped.
 *  - **`lastPurchaseDate` takes the later**, and is left alone when neither
 *    record has one — not defaulted to `now`, which would invent a visit.
 *
 * Receipts are deliberately **not** rewritten. A receipt embeds a snapshot of
 * the customer as they were at the till (`r.customer`), and it is a historical
 * record of what was printed and handed over — editing it to point at a
 * different document would falsify a document the shop may have to produce.
 * The merge therefore reconciles the customer book; it does not rewrite history.
 */
export interface CustomerMergePlan {
  primaryId: string;
  duplicateIds: string[];
  values: Partial<Customer>;
  /** Plain-language summary for the confirm dialog and the audit-log entry. */
  summary: string;
}

export function buildMergePlan(members: Customer[]): CustomerMergePlan | null {
  if (!members || members.length < 2) return null;
  const ordered = [...members].sort(comparePrimaryFirst);
  const [primary, ...duplicates] = ordered;

  const totalSpent = ordered.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const loyaltyPoints = ordered.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);

  const values: Partial<Customer> = { totalSpent, loyaltyPoints };

  if (!primary.name?.trim()) {
    const named = ordered.find(c => c.name?.trim());
    if (named) values.name = named.name;
  }

  if (!normalizePhone(primary.phone)) {
    const withPhone = ordered.find(c => normalizePhone(c.phone));
    if (withPhone) values.phone = withPhone.phone;
  }

  if (!realEmail(primary)) {
    const withEmail = ordered.find(c => realEmail(c));
    if (withEmail) values.email = withEmail.email;
  }

  if (!normalizeCode(primary.code)) {
    const withCode = ordered.find(c => normalizeCode(c.code));
    if (withCode) values.code = withCode.code;
  }

  if (!primary.branchId) {
    const withBranch = ordered.find(c => c.branchId);
    if (withBranch) values.branchId = withBranch.branchId;
  }

  const tags = Array.from(new Set(ordered.flatMap(c => c.tags || []).filter(Boolean)));
  if (tags.length > 0) values.tags = tags;

  const notes = ordered
    .map(c => c.notes?.trim())
    .filter((n): n is string => !!n);
  if (notes.length > 0) values.notes = Array.from(new Set(notes)).join('\n');

  const lastPurchase = ordered
    .map(c => ({ c, ms: lastPurchaseMillis(c) }))
    .filter(x => x.ms > 0)
    .sort((a, b) => b.ms - a.ms)[0];
  if (lastPurchase && lastPurchase.c.id !== primary.id) {
    values.lastPurchaseDate = lastPurchase.c.lastPurchaseDate;
  }

  return {
    primaryId: primary.id,
    duplicateIds: duplicates.map(c => c.id),
    values,
    summary: `Merged ${duplicates.length} duplicate record${duplicates.length === 1 ? '' : 's'} into ${primary.name || 'customer'}`,
  };
}

function lastPurchaseMillis(c: Customer): number {
  const raw: any = c.lastPurchaseDate;
  if (!raw) return 0;
  if (typeof raw?.toDate === 'function') {
    const t = raw.toDate().getTime();
    return Number.isFinite(t) ? t : 0;
  }
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw.getTime() : 0;
  if (typeof raw === 'number') return raw;
  if (typeof raw?.seconds === 'number') return raw.seconds * 1000;
  return 0;
}

/**
 * A free code for a customer caught in a code collision.
 *
 * Derived from the codes already in the book rather than from a random string,
 * so the shop keeps whatever scheme it already types by hand. `existing` is the
 * set of normalised codes in use; the candidate is checked against it, so this
 * never hands back a code that would collide again.
 */
export function suggestFreeCode(base: string | undefined, existing: Set<string>): string {
  const root = normalizeCode(base) || 'CUST';
  const trimmed = root.replace(/\d+$/, '') || 'CUST';
  for (let n = 2; n < 10000; n++) {
    const candidate = `${trimmed}${n}`;
    if (!existing.has(normalizeCode(candidate))) return candidate;
  }
  return `${trimmed}${Date.now()}`;
}
