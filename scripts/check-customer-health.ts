/**
 * Checks over `src/lib/customer-health.ts`.
 *
 * `.ts` and not `.mts` on purpose — there is no `"type": "module"` in this repo,
 * so `src/**` compiles to CJS and a true-ESM importer fails named-import interop,
 * reporting that the module "does not provide an export named X" for a constant
 * that is plainly exported. Same trap as the rating and import harnesses.
 *
 *   npm run test:customer-health
 */

import {
  computeCustomerHealth,
  buildMergePlan,
  normalizeName,
  normalizePhone,
  normalizeCode,
  isPlaceholderEmail,
  realEmail,
  comparePrimaryFirst,
  suggestFreeCode,
  ISSUE_SEVERITY,
} from '../src/lib/customer-health';
import type { Customer } from '../src/types';

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
  } else {
    failures.push(detail ? `${label} — ${detail}` : label);
  }
}

function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(label, ok, ok ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

let seq = 0;
function cust(over: Partial<Customer> = {}): Customer {
  seq++;
  return {
    id: over.id ?? `c${seq}`,
    businessId: 'biz1',
    name: over.name ?? `Customer ${seq}`,
    email: over.email ?? `c${seq}@example.com`,
    ...over,
  } as Customer;
}

// ---------------------------------------------------------------- normalisers

eq('normalizeName lowercases and strips punctuation', normalizeName('Mrs. Adeyemi'), 'adeyemi mrs');
eq('normalizeName collapses whitespace', normalizeName('Mrs   Adeyemi'), 'adeyemi mrs');
eq('normalizeName is word-order independent', normalizeName('Bello Imam'), normalizeName('Imam Bello'));
eq('normalizeName strips diacritics', normalizeName('Zoé'), normalizeName('Zoe'));
eq('normalizeName on empty is empty', normalizeName(''), '');
eq('normalizeName on undefined is empty', normalizeName(undefined), '');
eq('normalizeName on punctuation-only is empty', normalizeName('...'), '');
check('normalizeName keeps every word', normalizeName('A. Okafor') !== normalizeName('Ada Okafor'));

eq('normalizePhone strips the trunk zero via last-10', normalizePhone('08031234567'), '8031234567');
eq('normalizePhone strips +234', normalizePhone('+2348031234567'), '8031234567');
eq('normalizePhone ignores spaces and dashes', normalizePhone('0803-123 4567'), '8031234567');
eq('normalizePhone keeps a short scribble whole', normalizePhone('12345'), '12345');
eq('normalizePhone on empty is empty', normalizePhone(''), '');
eq('normalizePhone on letters is empty', normalizePhone('n/a'), '');
check(
  'normalizePhone agrees across all four written forms',
  new Set(['08031234567', '+2348031234567', '234 803 123 4567', '0803-123-4567'].map(normalizePhone)).size === 1,
);

eq('normalizeCode uppercases', normalizeCode('cust-1'), 'CUST1');
eq('normalizeCode strips spaces', normalizeCode('CUST 1'), 'CUST1');
eq('normalizeCode on empty is empty', normalizeCode(undefined), '');

/*
 * Punctuation is stripped, matching `normalizeSku` character for character. A code
 * the shop types by hand is not typed consistently, and the importer applies a code
 * match as a fact without asking — so these four have to be one key, or a book
 * re-imported with different hyphens duplicates everybody in it.
 */
eq('normalizeCode strips hyphens', normalizeCode('ACC-1'), 'ACC1');
eq('normalizeCode strips underscores', normalizeCode('acc_1'), 'ACC1');
eq('normalizeCode strips dots', normalizeCode('acc.1'), 'ACC1');
eq(
  'so every hand-typed spelling of one code agrees',
  new Set(['ACC-1', 'acc 1', 'acc_1', 'ACC.1', 'acc1'].map(normalizeCode)).size,
  1,
);

check('placeholder email detected', isPlaceholderEmail('adeyemia1b2@zeneva-import.local'));
check('placeholder email detected case-insensitively', isPlaceholderEmail('X@ZENEVA-IMPORT.LOCAL'));
check('real email not flagged as placeholder', !isPlaceholderEmail('real@gmail.com'));
check('empty email not flagged as placeholder', !isPlaceholderEmail(''));
eq('realEmail returns null for a placeholder', realEmail({ email: 'a@zeneva-import.local' }), null);
eq('realEmail returns the address for a real one', realEmail({ email: 'a@gmail.com' }), 'a@gmail.com');
eq('realEmail returns null for empty', realEmail({ email: '' }), null);

// -------------------------------------------------------------- null vs empty

check('null customers returns null, not an empty report', computeCustomerHealth(null, { isMultiBranch: false }) === null);
const emptyReport = computeCustomerHealth([], { isMultiBranch: false });
check('empty array returns a report', emptyReport !== null);
eq('empty array examines nothing', emptyReport!.examined, 0);
eq('empty array affects nobody', emptyReport!.affected, 0);
eq('empty array finds no groups', emptyReport!.groups.length, 0);

// ------------------------------------------------------------ duplicate codes

{
  const a = cust({ id: 'a', code: 'VIP1', totalSpent: 100 });
  const b = cust({ id: 'b', code: 'vip 1', totalSpent: 50 });
  const c = cust({ id: 'c', code: 'OTHER' });
  const r = computeCustomerHealth([a, b, c], { isMultiBranch: false })!;
  eq('code collision found once', r.counts.duplicateCodes, 1);
  const group = r.groups.find(g => g.kind === 'duplicate-code')!;
  check('code group exists', !!group);
  eq('code group has both members', group.members.length, 2);
  eq('code group primary is the higher spender', group.members[0].id, 'a');
  check('unaffected customer is not flagged', !r.issuesByCustomer.has('c'));
  eq('two customers affected', r.affected, 2);
  eq('code collisions are not counted as redundant records', r.redundantRecords, 0);
  eq('duplicate-code is critical', ISSUE_SEVERITY['duplicate-code'], 'critical');
}

// ------------------------------------------------------------ duplicate phone

{
  const a = cust({ id: 'a', name: 'Ada O', phone: '08031234567', totalSpent: 10 });
  const b = cust({ id: 'b', name: 'Ada Okafor', phone: '+2348031234567', totalSpent: 90 });
  const r = computeCustomerHealth([a, b], { isMultiBranch: false })!;
  eq('phone duplicate found', r.counts.duplicatePhones, 1);
  const group = r.groups.find(g => g.kind === 'duplicate-phone')!;
  eq('phone primary is the higher spender', group.members[0].id, 'b');
  eq('one record is redundant', r.redundantRecords, 1);
}

// ------------------------------------------------------------ duplicate email

{
  const a = cust({ id: 'a', email: 'Ada@Gmail.com' });
  const b = cust({ id: 'b', email: 'ada@gmail.com' });
  const r = computeCustomerHealth([a, b], { isMultiBranch: false })!;
  eq('email duplicate found case-insensitively', r.counts.duplicateEmails, 1);
}

{
  const a = cust({ id: 'a', email: 'x1@zeneva-import.local' });
  const b = cust({ id: 'b', email: 'x2@zeneva-import.local' });
  const r = computeCustomerHealth([a, b], { isMultiBranch: false })!;
  eq('placeholder emails never form a duplicate group', r.counts.duplicateEmails, 0);
  eq('both placeholders are flagged', r.counts.placeholderEmails, 2);
  eq('a placeholder-only record counts as uncontactable', r.counts.noContact, 2);
}

// ------------------------------------------------------------- duplicate name

{
  const a = cust({ id: 'a', name: 'Bello Imam', phone: '0801', email: 'a@x.com' });
  const b = cust({ id: 'b', name: 'Imam Bello', phone: '0802', email: 'b@x.com' });
  const r = computeCustomerHealth([a, b], { isMultiBranch: false })!;
  eq('reordered name is a duplicate', r.counts.duplicateNames, 1);
}

// ------------------------------------------- one pair is reported once, not twice

{
  const a = cust({ id: 'a', name: 'Ada Okafor', phone: '08031234567', email: 'ada@x.com', totalSpent: 5 });
  const b = cust({ id: 'b', name: 'Okafor Ada', phone: '08031234567', email: 'ada@x.com', totalSpent: 1 });
  const r = computeCustomerHealth([a, b], { isMultiBranch: false })!;
  eq('a pair matching on phone, email and name yields one group', r.groups.length, 1);
  eq('the group kept is the phone one', r.groups[0].kind, 'duplicate-phone');
  eq('only one record is redundant', r.redundantRecords, 1);
  eq('both are affected', r.affected, 2);
}

// ----------------------- a code collision is still reported alongside a name match

{
  const a = cust({ id: 'a', name: 'Ada Okafor', code: 'C1', phone: '0801', totalSpent: 5 });
  const b = cust({ id: 'b', name: 'Okafor Ada', code: 'c1', phone: '0802', totalSpent: 1 });
  const r = computeCustomerHealth([a, b], { isMultiBranch: false })!;
  const kinds = r.groups.map(g => g.kind).sort();
  eq('both the code collision and the name match are reported', kinds, ['duplicate-code', 'duplicate-name']);
}

// -------------------------------------------------------------- field hygiene

{
  const a = cust({ id: 'a', name: '   ', phone: '', email: '' });
  const r = computeCustomerHealth([a], { isMultiBranch: false })!;
  eq('blank name flagged', r.counts.missingNames, 1);
  eq('no contact flagged', r.counts.noContact, 1);
  eq('one customer affected by two issues', r.affected, 1);
  eq('both kinds recorded for the row', r.issuesByCustomer.get('a')!.sort(), ['missing-name', 'no-contact']);
}

{
  const withBranch = cust({ id: 'a', branchId: 'b1' });
  const without = cust({ id: 'b' });
  const single = computeCustomerHealth([withBranch, without], { isMultiBranch: false })!;
  eq('single-branch shop is not told about missing branchId', single.counts.noBranch, 0);
  const multi = computeCustomerHealth([withBranch, without], { isMultiBranch: true })!;
  eq('multi-branch shop is told', multi.counts.noBranch, 1);
  eq('no-branch is critical', ISSUE_SEVERITY['no-branch'], 'critical');
}

// ------------------------------------------------------- primary-first ordering

{
  const rich = cust({ id: 'rich', totalSpent: 500 });
  const poor = cust({ id: 'poor', totalSpent: 1 });
  check('higher spend sorts first', comparePrimaryFirst(rich, poor) < 0);

  const old = cust({ id: 'old', totalSpent: 0, createdAt: new Date('2024-01-01') });
  const recent = cust({ id: 'new', totalSpent: 0, createdAt: new Date('2026-01-01') });
  check('on equal spend the older record sorts first', comparePrimaryFirst(old, recent) < 0);

  const noStamp = cust({ id: 'nostamp', totalSpent: 0 });
  check('a record with no createdAt never wins the age tiebreak', comparePrimaryFirst(noStamp, recent) > 0);

  const epochish = cust({ id: 'epoch', totalSpent: 0, createdAt: new Date(0) });
  check('an epoch createdAt does not win the age tiebreak either', comparePrimaryFirst(epochish, recent) > 0);

  const t1 = cust({ id: 'aaa', totalSpent: 0 });
  const t2 = cust({ id: 'bbb', totalSpent: 0 });
  check('id breaks the final tie deterministically', comparePrimaryFirst(t1, t2) < 0);
  check('and the comparison is antisymmetric', comparePrimaryFirst(t2, t1) > 0);
}

// ------------------------------------------------------------------ merge plan

eq('merge plan needs two records', buildMergePlan([cust()]), null);
eq('merge plan of nothing is null', buildMergePlan([]), null);

{
  const a = cust({
    id: 'a',
    name: 'Ada Okafor',
    email: 'ada@gmail.com',
    phone: '08031234567',
    totalSpent: 900,
    loyaltyPoints: 40,
    tags: ['wholesale'],
    notes: 'Pays on Fridays',
    lastPurchaseDate: new Date('2026-06-01'),
  });
  const b = cust({
    id: 'b',
    name: 'Okafor Ada',
    email: 'x@zeneva-import.local',
    phone: '',
    code: 'VIP9',
    totalSpent: 100,
    loyaltyPoints: 5,
    tags: ['pays late', 'wholesale'],
    notes: 'Sister of Ngozi',
    branchId: 'ikeja',
    lastPurchaseDate: new Date('2026-08-01'),
  });
  const plan = buildMergePlan([b, a])!;

  eq('primary is the higher spender regardless of input order', plan.primaryId, 'a');
  eq('the other record is the duplicate', plan.duplicateIds, ['b']);
  eq('spend adds up', plan.values.totalSpent, 1000);
  eq('points add up', plan.values.loyaltyPoints, 45);
  check('a real email on the primary is not overwritten', plan.values.email === undefined);
  check('a phone the primary already has is not overwritten', plan.values.phone === undefined);
  eq('a code only the duplicate had is adopted', plan.values.code, 'VIP9');
  eq('a branch only the duplicate had is adopted', plan.values.branchId, 'ikeja');
  eq('tags union without duplicates', plan.values.tags!.sort(), ['pays late', 'wholesale']);
  check('both notes are kept', plan.values.notes!.includes('Pays on Fridays') && plan.values.notes!.includes('Sister of Ngozi'));
  eq('the later purchase date wins', plan.values.lastPurchaseDate, b.lastPurchaseDate);
  check('summary names the primary', plan.summary.includes('Ada Okafor'));
}

{
  // A placeholder email on the primary loses to a real one on the duplicate —
  // the one case where the duplicate's value replaces the primary's.
  const primary = cust({ id: 'p', email: 'p@zeneva-import.local', totalSpent: 500 });
  const dupe = cust({ id: 'd', email: 'real@gmail.com', totalSpent: 10 });
  const plan = buildMergePlan([primary, dupe])!;
  eq('primary is still the higher spender', plan.primaryId, 'p');
  eq('a real email replaces a placeholder', plan.values.email, 'real@gmail.com');
}

{
  // Nothing is invented when neither record has the field.
  const a = cust({ id: 'a', phone: '', code: '', totalSpent: 5 });
  const b = cust({ id: 'b', phone: '', code: '', totalSpent: 1 });
  const plan = buildMergePlan([a, b])!;
  check('no phone is invented', plan.values.phone === undefined);
  check('no code is invented', plan.values.code === undefined);
  check('no lastPurchaseDate is invented', plan.values.lastPurchaseDate === undefined);
  check('no tags key when neither had tags', plan.values.tags === undefined);
  check('no notes key when neither had notes', plan.values.notes === undefined);
  eq('missing spend counts as zero, not NaN', plan.values.totalSpent, 6);
}

{
  // Three-way merge.
  const a = cust({ id: 'a', totalSpent: 30, loyaltyPoints: 3 });
  const b = cust({ id: 'b', totalSpent: 20, loyaltyPoints: 2 });
  const c = cust({ id: 'c', totalSpent: 10, loyaltyPoints: 1 });
  const plan = buildMergePlan([c, a, b])!;
  eq('three-way primary', plan.primaryId, 'a');
  eq('three-way duplicates', plan.duplicateIds.sort(), ['b', 'c']);
  eq('three-way spend', plan.values.totalSpent, 60);
  eq('three-way points', plan.values.loyaltyPoints, 6);
  check('summary is pluralised', plan.summary.includes('2 duplicate records'));
}

// -------------------------------------------------------------- code suggestion

{
  const existing = new Set(['VIP1', 'VIP2']);
  eq('suggests the next free code in the shop scheme', suggestFreeCode('VIP1', existing), 'VIP3');
  eq('falls back to a default root', suggestFreeCode(undefined, new Set()), 'CUST2');
  eq('a suggestion never collides', existing.has(normalizeCode(suggestFreeCode('VIP1', existing))), false);
}

// ---------------------------------------------------------------------- scale

{
  // 4,000 records, the size that prompted this work, with 100 planted duplicates.
  const many: Customer[] = [];
  for (let i = 0; i < 4000; i++) many.push(cust({ id: `s${i}`, name: `Shopper ${i}`, phone: `080${String(i).padStart(8, '0')}` }));
  for (let i = 0; i < 100; i++) many.push(cust({ id: `dupe${i}`, name: `Shopper ${i}`, phone: `080${String(i).padStart(8, '0')}` }));
  const r = computeCustomerHealth(many, { isMultiBranch: false })!;
  eq('all 4,100 records examined', r.examined, 4100);
  eq('100 duplicate groups found', r.groups.length, 100);
  eq('100 records could be retired', r.redundantRecords, 100);
  eq('200 records affected', r.affected, 200);
}

// ---------------------------------------------------------------------- report

console.log(`\ncustomer-health: ${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  failures.forEach(f => console.error(`  FAIL  ${f}`));
  process.exit(1);
}
