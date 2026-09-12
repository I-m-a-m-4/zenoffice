/**
 * Checks for the customer importer's pure core.
 *
 * Run with `npm run test:customer-import`.
 *
 * A `.ts` file, not `.mts`: there is no `"type": "module"` in this repo, so `src/**`
 * compiles to CJS and a true-ESM importer fails named-import interop, reporting a
 * missing export for a constant that is plainly exported. The same trap the
 * business-rating and product-import harnesses document.
 *
 * What is tested is chosen by what it costs to be quietly wrong:
 *
 *  - **A wrong merge** silently rewrites somebody's spend history and is unnoticeable
 *    for months. A visible duplicate is deletable in one click. So most of this file
 *    is about the asymmetry between those two mistakes.
 *  - **An invented contact detail** gets used. The shop sends a real debt reminder to
 *    whatever is in the phone field, and a fabricated email bounces silently forever.
 *    The dialog this feature replaces invented an email for every single row.
 *  - **`undefined` versus `0`** decides whether an import preserves a loyalty balance
 *    or wipes it.
 */

import {
  CUSTOMER_IMPORT_FIELDS,
  CUSTOMER_AI_MAPPING_THRESHOLD,
  mapCustomerColumns,
  applyCustomerAiMapping,
  setCustomerMapping,
  buildCustomerDrafts,
  stageCustomerRows,
  planCustomerCommit,
  buildCustomerUpdate,
  buildCustomerWrites,
  type CustomerImportField,
  type DraftCustomer,
} from '../src/lib/import/customers';
import { aiCustomerRowsToTable } from '../src/lib/import/client';
import { normalizePhone, normalizeName, normalizeCode } from '../src/lib/customer-health';
import type { RawTable } from '../src/lib/import/types';
import type { Customer } from '../src/types';

let passed = 0;
const failures: string[] = [];

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) { passed++; return; }
  failures.push(`${label}\n    expected ${b}\n    got      ${a}`);
}

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { passed++; return; }
  failures.push(`${label}${detail ? `\n    ${detail}` : ''}`);
}

function section(name: string) {
  console.log(`\n── ${name}`);
}

/** A table, with the boilerplate out of the way. */
function table(headers: string[], rows: string[][], hasHeaderRow = true): RawTable {
  return { headers, rows, hasHeaderRow, label: 'test' };
}

/** Map and build in one step, which is how every source actually reaches drafts. */
function draftsFor(t: RawTable): DraftCustomer[] {
  return buildCustomerDrafts(t, mapCustomerColumns(t)).drafts;
}

function fieldAt(t: RawTable, index: number): CustomerImportField | null {
  return mapCustomerColumns(t).columns.find(c => c.index === index)?.field ?? null;
}

/** A customer on file, with only the fields a test cares about spelled out. */
function existing(partial: Partial<Customer> & { id: string; name: string }): Customer {
  return { businessId: 'b1', ...partial } as Customer;
}

// ─────────────────────────────────────────────────────────────────────────────
section('Column mapping — headers');
// ─────────────────────────────────────────────────────────────────────────────

const plain = table(
  ['Customer Name', 'Phone Number', 'Email Address', 'Account No'],
  [['Musa Ibrahim', '08031234567', 'musa@example.com', 'ACC-1']],
);
eq('customer name', fieldAt(plain, 0), 'name');
eq('phone number', fieldAt(plain, 1), 'phone');
eq('email address', fieldAt(plain, 2), 'email');
eq('account no maps to code', fieldAt(plain, 3), 'code');
eq('a fully mapped file needs no AI', mapCustomerColumns(plain).needsAi, false);

// The headers people actually type, and the ones other systems export.
eq('gsm is a phone', fieldAt(table(['Name', 'GSM'], [['A', '08031234567']]), 1), 'phone');
eq('whatsapp is a phone', fieldAt(table(['Name', 'WhatsApp'], [['A', '08031234567']]), 1), 'phone');
eq('ltv is total spent', fieldAt(table(['Name', 'LTV'], [['A', '45000']]), 1), 'totalSpent');
eq('points is loyalty', fieldAt(table(['Name', 'Points'], [['A', '120']]), 1), 'loyaltyPoints');
eq('remarks is notes', fieldAt(table(['Name', 'Remarks'], [['A', 'pays late']]), 1), 'notes');
eq('segment is tags', fieldAt(table(['Name', 'Segment'], [['A', 'wholesale']]), 1), 'tags');

// An unrecognised column is left alone rather than forced into a field.
const withJunk = table(
  ['Name', 'Phone', 'Address', 'Salesperson'],
  [['Musa Ibrahim', '08031234567', '12 Awolowo Road', 'Tunde']],
);
eq('an address is not mapped', fieldAt(withJunk, 2), null);
eq(
  'an unmapped extra column does not trigger a paid mapping call',
  mapCustomerColumns(withJunk).needsAi,
  false,
);

/*
 * Two columns that both look like a name must not both claim it. A file with
 * "Name" and "Company" would otherwise lose one of them, and which one it lost
 * would depend on column order.
 */
const twoNames = table(
  ['Name', 'Company Name', 'Phone'],
  [['Musa Ibrahim', 'Musa Stores Ltd', '08031234567']],
);
const twoNamesMapped = mapCustomerColumns(twoNames);
eq(
  'a field is claimed by exactly one column',
  twoNamesMapped.columns.filter(c => c.field === 'name').length,
  1,
);
eq('the first claimant wins', twoNamesMapped.columns[0].field, 'name');

// ─────────────────────────────────────────────────────────────────────────────
section('Column mapping — inference from values');
// ─────────────────────────────────────────────────────────────────────────────

/*
 * A stocktake pasted out of WhatsApp has no header row at all. The values are the
 * only signal, and they are a good one.
 */
const headerless = table(
  [],
  [
    ['Musa Ibrahim', '08031234567', 'musa@example.com'],
    ['Ada Okeke', '08098765432', 'ada@example.com'],
    ['Chinedu Obi', '07011122233', 'chinedu@example.com'],
  ],
  false,
);
eq('headerless: names inferred', fieldAt(headerless, 0), 'name');
eq('headerless: phones inferred', fieldAt(headerless, 1), 'phone');
eq('headerless: emails inferred', fieldAt(headerless, 2), 'email');
eq(
  'a headerless file with a name column still needs no AI',
  mapCustomerColumns(headerless).needsAi,
  false,
);

/*
 * A column of money must not be read as a phone number. `12,000` is five digits
 * and would qualify on a digit count alone, which is why the phone test has a
 * seven-digit floor.
 */
const moneyColumn = table(
  [],
  [['Musa Ibrahim', '12,000'], ['Ada Okeke', '8,500'], ['Chinedu Obi', '45,000']],
  false,
);
ok('a money column is not claimed as a phone', fieldAt(moneyColumn, 1) !== 'phone');

// A single row is not evidence of anything, so nothing is inferred from it.
const oneRow = table([], [['Musa Ibrahim', '08031234567']], false);
eq('one row infers nothing', fieldAt(oneRow, 1), null);

/*
 * `needsAi` is true only when the *required* field is missing. Paying a model to
 * name a notes column the shop can live without is money for nothing.
 */
const noName = table(
  [],
  [['08031234567', '12,000'], ['08098765432', '8,500'], ['07011122233', '45,000']],
  false,
);
eq('no name column is what makes AI worth paying for', mapCustomerColumns(noName).needsAi, true);

// ─────────────────────────────────────────────────────────────────────────────
section('Column mapping — AI suggestions and manual overrides');
// ─────────────────────────────────────────────────────────────────────────────

const forAi = table(['Kunde', 'Telefon', 'Notiz'], [['Musa Ibrahim', '08031234567', 'zahlt spät']]);
const aiApplied = applyCustomerAiMapping(mapCustomerColumns(forAi), [
  { index: 0, field: 'name' },
  { index: 2, field: 'notes' },
]);
eq('AI fills an unmapped column', aiApplied.columns[0].field, 'name');
eq('AI mapping is marked as such', aiApplied.columns[0].via, 'ai');
eq('AI never leaves needsAi set', aiApplied.needsAi, false);

// `Telefon` is a real alias, so the local pass already had it — and the model does
// not get to overrule a header that matched exactly.
const aiOverrule = applyCustomerAiMapping(mapCustomerColumns(plain), [
  { index: 1, field: 'email' },
  { index: 2, field: 'phone' },
]);
eq('AI cannot overrule an alias hit (phone)', aiOverrule.columns[1].field, 'phone');
eq('AI cannot overrule an alias hit (email)', aiOverrule.columns[2].field, 'email');

// Nor may it claim a field another column already holds.
const aiDouble = applyCustomerAiMapping(mapCustomerColumns(withJunk), [
  { index: 2, field: 'phone' },
]);
eq('AI cannot claim a taken field', aiDouble.columns[2].field, null);

// A hallucinated field name is discarded rather than written to a field nothing reads.
const aiBogus = applyCustomerAiMapping(mapCustomerColumns(withJunk), [
  { index: 2, field: 'address' as CustomerImportField },
]);
eq('a hallucinated field is discarded', aiBogus.columns[2].field, null);

// Assigning a field by hand releases it from wherever it was.
const moved = setCustomerMapping(mapCustomerColumns(plain), 3, 'phone');
eq('a manual choice takes the field', moved.columns[3].field, 'phone');
eq('and releases it from the old column', moved.columns[1].field, null);
eq('a manual choice is fully confident', moved.columns[3].confidence, 1);

const cleared = setCustomerMapping(mapCustomerColumns(plain), 1, null);
eq('a column can be cleared', cleared.columns[1].field, null);
ok(
  'a cleared column counts as uncertain',
  cleared.uncertain.some(c => c.index === 1),
);

// ─────────────────────────────────────────────────────────────────────────────
section('Drafts — contact details are never invented');
// ─────────────────────────────────────────────────────────────────────────────

const bare = draftsFor(table(['Name'], [['Musa Ibrahim']]));
eq('a name-only row imports', bare.length, 1);
eq('no email is invented', bare[0].email, undefined);
eq('no phone is invented', bare[0].phone, undefined);
ok(
  'and the row says why that matters',
  bare[0].issues.some(i => /contact or search/i.test(i.message)),
);

/*
 * The old dialog wrote `${name}${4 random chars}@zeneva-import.local` into every
 * row. Re-importing an export of that data must not carry them back in.
 */
const placeholder = draftsFor(
  table(['Name', 'Email'], [['Musa Ibrahim', 'musaibrahim9x2k@zeneva-import.local']]),
);
eq('a placeholder email is dropped', placeholder[0].email, undefined);
ok(
  'and the drop is explained',
  placeholder[0].issues.some(i => i.field === 'email' && /auto-generated/i.test(i.message)),
);

// A real address survives untouched.
const realMail = draftsFor(table(['Name', 'Email'], [['Musa Ibrahim', 'musa@example.com']]));
eq('a real email survives', realMail[0].email, 'musa@example.com');
eq('a real email raises no issue', realMail[0].issues.length, 0);

// Something that is not an address is kept but flagged — the owner decides.
const oddMail = draftsFor(table(['Name', 'Email'], [['Musa Ibrahim', 'musa at example']]));
eq('an odd email is kept for the owner to see', oddMail[0].email, 'musa at example');
ok('and flagged', oddMail[0].issues.some(i => i.field === 'email'));

// ─────────────────────────────────────────────────────────────────────────────
section('Drafts — phone numbers stay as written');
// ─────────────────────────────────────────────────────────────────────────────

const phones = draftsFor(
  table(
    ['Name', 'Phone'],
    [
      ['Musa Ibrahim', '0803 123 4567'],
      ['Ada Okeke', '+234 809 876 5432'],
      ['Chinedu Obi', 'no phone yet'],
    ],
  ),
);
eq('spacing is preserved verbatim', phones[0].phone, '0803 123 4567');
eq('a +234 number is preserved verbatim', phones[1].phone, '+234 809 876 5432');
ok('prose in a phone column is flagged', phones[2].issues.some(i => i.field === 'phone'));

/*
 * Preserving the raw text is only useful because normalisation happens downstream,
 * in the one place the Health tab also uses. This is the property the whole
 * duplicate story rests on.
 */
eq('two spellings normalise together', normalizePhone('0803 123 4567'), normalizePhone('+2348031234567'));

// ─────────────────────────────────────────────────────────────────────────────
section('Drafts — undefined is not zero');
// ─────────────────────────────────────────────────────────────────────────────

const totals = draftsFor(
  table(
    ['Name', 'Total Spent', 'Points'],
    [
      ['Musa Ibrahim', '₦45,000', '120'],
      ['Ada Okeke', '', ''],
      ['Chinedu Obi', '0', '0'],
      ['Ngozi Eze', '-500', '-10'],
    ],
  ),
);
eq('money parses through the symbol', totals[0].totalSpent, 45000);
eq('points parse', totals[0].loyaltyPoints, 120);
eq('an empty cell is undefined, not zero', totals[1].totalSpent, undefined);
eq('an empty points cell is undefined, not zero', totals[1].loyaltyPoints, undefined);
eq('a stated zero is zero', totals[2].totalSpent, 0);
eq('a stated zero for points is zero', totals[2].loyaltyPoints, 0);
eq('a negative total is dropped', totals[3].totalSpent, undefined);
eq('a negative points balance is dropped', totals[3].loyaltyPoints, undefined);
ok('and the drop is explained', totals[3].issues.some(i => i.field === 'totalSpent'));

// ─────────────────────────────────────────────────────────────────────────────
section('Drafts — tags, names and dropped rows');
// ─────────────────────────────────────────────────────────────────────────────

const tagged = draftsFor(
  table(
    ['Name', 'Tags'],
    [
      ['Musa Ibrahim', 'wholesale, pays late'],
      ['Ada Okeke', 'vip|staff'],
      ['Chinedu Obi', 'retail; church'],
      ['Ngozi Eze', ''],
    ],
  ),
);
eq('comma-separated tags', tagged[0].tags, ['wholesale', 'pays late']);
eq('pipe-separated tags', tagged[1].tags, ['vip', 'staff']);
eq('semicolon-separated tags', tagged[2].tags, ['retail', 'church']);
eq('no tags is undefined, not an empty array', tagged[3].tags, undefined);

const messyNames = buildCustomerDrafts(
  table(
    ['Name', 'Phone'],
    [
      ['  Musa   Ibrahim  ', '08031234567'],
      ['', '08098765432'],
      ['   ', ''],
      ['Ada Okeke', ''],
    ],
  ),
  mapCustomerColumns(table(['Name', 'Phone'], [['x', 'y']])),
);
eq('whitespace in a name is collapsed', messyNames.drafts[0].name, 'Musa Ibrahim');
eq('a nameless row is dropped', messyNames.drafts.length, 2);
eq('and counted', messyNames.skippedRows, 2);
eq('the surviving rows are the named ones', messyNames.drafts.map(d => d.name), ['Musa Ibrahim', 'Ada Okeke']);

// Every field is kept raw alongside the parsed draft, so the review table can show
// what the file actually said next to what Zeneva made of it.
eq('raw values are retained', totals[0].raw.totalSpent, '₦45,000');

// ─────────────────────────────────────────────────────────────────────────────
section('Staging — be certain, or ask');
// ─────────────────────────────────────────────────────────────────────────────

const book: Customer[] = [
  existing({ id: 'c1', name: 'Musa Ibrahim', phone: '08031234567', email: 'musa@example.com', code: 'ACC-1' }),
  existing({ id: 'c2', name: 'Ada Okeke', phone: '08098765432' }),
  existing({ id: 'c3', name: 'Musa Ibrahim', phone: '07055544433' }),
];

const drafted = (rows: Partial<DraftCustomer>[]): DraftCustomer[] =>
  rows.map((r, i) => ({ key: `k${i}`, name: '', raw: {}, issues: [], ...r }));

// A code match is a fact.
const byCode = stageCustomerRows(drafted([{ name: 'M. Ibrahim', code: 'acc 1' }]), book);
eq('a code match is certain', byCode[0].verdict.kind, 'certain');
eq('and resolves to an update', byCode[0].decision, { action: 'update', customerId: 'c1' });

// So is a phone match, across formatting.
const byPhone = stageCustomerRows(drafted([{ name: 'Musa I', phone: '+234 803 123 4567' }]), book);
eq('a phone match is certain across formatting', byPhone[0].verdict.kind, 'certain');
eq('and points at the right customer', (byPhone[0].decision as any).customerId, 'c1');

// And an email match.
const byEmail = stageCustomerRows(drafted([{ name: 'Different Name', email: 'MUSA@example.com' }]), book);
eq('an email match is certain and case-insensitive', byEmail[0].verdict.kind, 'certain');
eq('and points at the right customer', (byEmail[0].decision as any).customerId, 'c1');

/*
 * A name match is a question, and an unanswered question creates. Two people
 * really are called Musa Ibrahim — this book has two of them.
 */
const byName = stageCustomerRows(drafted([{ name: 'musa  ibrahim' }]), book);
eq('a name match is only a question', byName[0].verdict.kind, 'possible');
eq('and resolves to create, never a merge', byName[0].decision, { action: 'create' });
eq(
  'both same-named customers are offered',
  (byName[0].verdict as any).candidates.length,
  2,
);

// Somebody nobody has seen before is simply new.
const brandNew = stageCustomerRows(drafted([{ name: 'Ngozi Eze', phone: '08123456789' }]), book);
eq('an unknown customer is new', brandNew[0].verdict.kind, 'new');
eq('and is created', brandNew[0].decision, { action: 'create' });

/*
 * A certain match claims its customer, so a second row for the same person is
 * forced to be a question rather than quietly updating the same record twice.
 */
const twoRowsOnePerson = stageCustomerRows(
  drafted([
    { name: 'Musa Ibrahim', code: 'ACC-1' },
    { name: 'Musa Ibrahim', notes: 'second sighting' },
  ]),
  book,
);
eq('the first row claims the customer', twoRowsOnePerson[0].verdict.kind, 'certain');
ok(
  'the second is not allowed to update the same record',
  twoRowsOnePerson[1].decision.action !== 'update',
  JSON.stringify(twoRowsOnePerson[1].decision),
);
eq(
  'and the claimed customer is no longer offered as a candidate',
  (twoRowsOnePerson[1].verdict as any).candidates?.some((c: any) => c.customerId === 'c1') ?? false,
  false,
);

// ─────────────────────────────────────────────────────────────────────────────
section('Staging — duplicates inside the file itself');
// ─────────────────────────────────────────────────────────────────────────────

/*
 * A spreadsheet listing the same person on rows 4 and 900 would otherwise create
 * two records in one import — the exact problem this feature exists to end.
 */
const dupeInFile = stageCustomerRows(
  drafted([
    { name: 'Ngozi Eze', phone: '08123456789' },
    { name: 'N. Eze', phone: '+2348123456789' },
  ]),
  [],
);
eq('the first occurrence is new', dupeInFile[0].verdict.kind, 'new');
eq('the second is skipped', dupeInFile[1].decision, { action: 'skip' });
eq('and named as an in-file duplicate', (dupeInFile[1].verdict as any).candidates[0].reason, 'in-file');
eq(
  'the in-file candidate carries no customer id, because there is no customer yet',
  (dupeInFile[1].verdict as any).candidates[0].customerId,
  '',
);

// The same, on a code and on an email.
const dupeCode = stageCustomerRows(
  drafted([{ name: 'A', code: 'X-1' }, { name: 'B', code: 'x 1' }]),
  [],
);
eq('an in-file code duplicate is skipped', dupeCode[1].decision.action, 'skip');

const dupeEmail = stageCustomerRows(
  drafted([{ name: 'A', email: 'same@example.com' }, { name: 'B', email: 'SAME@example.com' }]),
  [],
);
eq('an in-file email duplicate is skipped', dupeEmail[1].decision.action, 'skip');

/*
 * But two different people who merely share a name are not an in-file duplicate.
 * Names are not identifiers; that is the whole reason a name match is a question.
 */
const sameNameDifferentPeople = stageCustomerRows(
  drafted([
    { name: 'Musa Ibrahim', phone: '08031234567' },
    { name: 'Musa Ibrahim', phone: '07055544433' },
  ]),
  [],
);
eq('a shared name is not an in-file duplicate', sameNameDifferentPeople[1].decision.action, 'create');

// A row with no identifier at all cannot collide with anything.
const noKeys = stageCustomerRows(drafted([{ name: 'A' }, { name: 'B' }]), []);
eq('rows with no identifiers both import', noKeys.filter(r => r.decision.action === 'create').length, 2);

// ─────────────────────────────────────────────────────────────────────────────
section('Commit plan');
// ─────────────────────────────────────────────────────────────────────────────

const staged = stageCustomerRows(
  drafted([
    { name: 'Musa Ibrahim', code: 'ACC-1' },       // certain → update
    { name: 'Ngozi Eze', phone: '08123456789' },   // new → create
    { name: 'N. Eze', phone: '08123456789' },      // in-file dupe → skip
  ]),
  book,
);
const plan = planCustomerCommit(staged);
eq('one update', plan.update.length, 1);
eq('one create', plan.create.length, 1);
eq('one skip', plan.skipped.length, 1);
eq('and nothing is lost', plan.update.length + plan.create.length + plan.skipped.length, staged.length);

// ─────────────────────────────────────────────────────────────────────────────
section('Updates fill blanks and never overwrite');
// ─────────────────────────────────────────────────────────────────────────────

const onFile = existing({
  id: 'c1',
  name: 'Musa Ibrahim',
  phone: '08031234567',
  email: 'musa@example.com',
  notes: 'Buys on credit',
  tags: ['wholesale'],
  totalSpent: 50_000,
  loyaltyPoints: 200,
});

const wouldWrite = buildCustomerUpdate(
  drafted([{
    name: 'MUSA IBRAHIM',
    phone: '09099999999',
    email: 'other@example.com',
    notes: 'Something else',
    code: 'ACC-9',
  }])[0],
  onFile,
);
eq('an existing phone is not overwritten', wouldWrite.phone, undefined);
eq('an existing email is not overwritten', wouldWrite.email, undefined);
eq('an existing note is not overwritten', wouldWrite.notes, undefined);
eq('an existing name is not overwritten', wouldWrite.name, undefined);
eq('a missing code is filled', wouldWrite.code, 'ACC-9');

// A record with nothing on it takes everything the file offers.
const emptyRecord = existing({ id: 'c9', name: '' });
const fills = buildCustomerUpdate(
  drafted([{ name: 'Ada Okeke', phone: '08098765432', email: 'ada@example.com', notes: 'New' }])[0],
  emptyRecord,
);
eq('a blank name is filled', fills.name, 'Ada Okeke');
eq('a blank phone is filled', fills.phone, '08098765432');
eq('a blank email is filled', fills.email, 'ada@example.com');
eq('a blank note is filled', fills.notes, 'New');

/*
 * A placeholder email on the record counts as blank, so a shop that was hit by the
 * old importer gets its real addresses back on the next import rather than being
 * blocked by the fabricated ones.
 */
const hasPlaceholder = existing({ id: 'c8', name: 'Musa', email: 'musa9x2k@zeneva-import.local' });
eq(
  'a placeholder email on file counts as blank',
  buildCustomerUpdate(drafted([{ name: 'Musa', email: 'real@example.com' }])[0], hasPlaceholder).email,
  'real@example.com',
);

// ─────────────────────────────────────────────────────────────────────────────
section('Updates — running totals take the maximum, never the sum');
// ─────────────────────────────────────────────────────────────────────────────

/*
 * An import is a snapshot from another system. Adding it to a running total
 * double-counts every purchase Zeneva has already recorded, which inflates the
 * figure the rating, the segments and the CRM panel all read.
 */
const higher = buildCustomerUpdate(drafted([{ name: 'M', totalSpent: 80_000, loyaltyPoints: 500 }])[0], onFile);
eq('a larger migrated total wins', higher.totalSpent, 80_000);
eq('a larger points balance wins', higher.loyaltyPoints, 500);

const lower = buildCustomerUpdate(drafted([{ name: 'M', totalSpent: 10_000, loyaltyPoints: 5 }])[0], onFile);
eq('a smaller total does not reduce what Zeneva knows', lower.totalSpent, undefined);
eq('a smaller points balance does not reduce it either', lower.loyaltyPoints, undefined);
ok(
  'and neither is ever summed',
  higher.totalSpent !== 130_000 && lower.totalSpent !== 60_000,
);

const absent = buildCustomerUpdate(drafted([{ name: 'M' }])[0], onFile);
eq('a silent file leaves the total alone', absent.totalSpent, undefined);
eq('a silent file leaves the points alone', absent.loyaltyPoints, undefined);

// Tags accumulate, because a label is additive information about somebody.
const taggedUpdate = buildCustomerUpdate(drafted([{ name: 'M', tags: ['vip', 'wholesale'] }])[0], onFile);
eq('new tags are merged, existing ones kept', taggedUpdate.tags, ['wholesale', 'vip']);
eq(
  'and a file that adds nothing new writes no tags at all',
  buildCustomerUpdate(drafted([{ name: 'M', tags: ['wholesale'] }])[0], onFile).tags,
  undefined,
);

// ─────────────────────────────────────────────────────────────────────────────
section('Writes');
// ─────────────────────────────────────────────────────────────────────────────

let idCounter = 0;
const nextId = () => `new${++idCounter}`;

/*
 * A plan with one of each. The update row matches Ada by phone and brings an email
 * she does not have on file — a plan whose update row had nothing new would be
 * dropped as already-current, which is asserted separately below.
 */
const writePlan = planCustomerCommit(
  stageCustomerRows(
    drafted([
      { name: 'Ada Okeke', phone: '08098765432', email: 'ada@example.com' }, // certain → update
      { name: 'Ngozi Eze', phone: '08123456789' },                          // new → create
      { name: 'N. Eze', phone: '+2348123456789' },                          // in-file dupe → skip
    ]),
    book,
  ),
);
const writeBundle = buildCustomerWrites(writePlan, book, 'b1', nextId);
const created = writeBundle.writes.find(w => w.type === 'add-customer')!;
const updated = writeBundle.writes.find(w => w.type === 'update-customer')!;

eq('a create is queued as add-customer', created.type, 'add-customer');
eq('an update is queued as update-customer', updated.type, 'update-customer');
eq('a skipped row is queued as nothing', writeBundle.writes.length, 2);
eq('and the skip is counted', writeBundle.skipped, 1);

/*
 * `lowercaseName` is what the customer search queries against. A customer imported
 * without it cannot be found at the till — not by the search box, not by the POS
 * customer picker. The single most likely field to be forgotten and the hardest to
 * notice, because the record looks perfect on the customers page.
 */
eq('a create carries lowercaseName', created.payload.lowercaseName, 'ngozi eze');
eq('a create carries lowercaseEmail', created.payload.lowercaseEmail, '');
eq('a create carries the businessId', created.payload.businessId, 'b1');
eq('a create carries a fresh id', created.payload.id, 'new1');

/*
 * The customers list orders by `totalSpent`, and Firestore drops a document from an
 * `orderBy` when the field is absent — so an imported customer with no figure would
 * be invisible on the very page that imported them.
 */
eq('totalSpent defaults to 0, never absent', created.payload.totalSpent, 0);
eq('loyaltyPoints defaults to 0, never absent', created.payload.loyaltyPoints, 0);
eq('a known phone is written', created.payload.phone, '08123456789');
eq('an absent email is an empty string, not undefined', created.payload.email, '');

/*
 * `branchId` belongs to `addToQueue`, which is the only thing that knows the active
 * branch. Setting it here from stale state is how an imported customer ends up
 * belonging to a branch the owner was not looking at.
 */
ok('a create does not set branchId itself', !('branchId' in created.payload));

// The update fills the blank and carries its derived search field with it.
eq('the update targets the matched customer', (updated.payload as any).id, 'c2');
eq('a filled email is written', (updated.payload as any).values.email, 'ada@example.com');
eq('and carries lowercaseEmail', (updated.payload as any).values.lowercaseEmail, 'ada@example.com');
eq(
  'while the phone already on file is left alone',
  (updated.payload as any).values.phone,
  undefined,
);

// An empty update is dropped rather than queued: it costs a write, bumps
// `updatedAt`, and makes a re-import of the same file look like it changed the book.
const noChange = planCustomerCommit(
  stageCustomerRows(drafted([{ name: 'Musa Ibrahim', code: 'ACC-1' }]), book),
);
const emptyBundle = buildCustomerWrites(noChange, book, 'b1', nextId);
eq('an update that would write nothing is dropped', emptyBundle.writes.length, 0);
eq('and is counted as already current', emptyBundle.alreadyCurrent, 1);
eq('so the updated count is honest', emptyBundle.updated, 0);

// An update naming a customer who is no longer on file is dropped, not thrown on.
const ghost = buildCustomerWrites(
  {
    create: [],
    update: [{ ...writePlan.update[0], decision: { action: 'update', customerId: 'gone' } }],
    skipped: [],
  },
  book,
  'b1',
  nextId,
);
eq('an update for a deleted customer is dropped', ghost.writes.length, 0);

// ─────────────────────────────────────────────────────────────────────────────
section('AI rows meet the same pipeline');
// ─────────────────────────────────────────────────────────────────────────────

/*
 * The claim in `aiCustomerRowsToTable` is that its headers are real aliases, so the
 * mapping step after a photograph is a map hit and cannot ask for AI a second time
 * — which would charge the shop twice for one photograph. Worth asserting rather
 * than trusting, because the failure is invisible: it just costs money.
 */
const fromPhoto = aiCustomerRowsToTable(
  [
    { name: 'Musa Ibrahim', phone: '0803 123 4567', totalSpent: '₦45,000', tags: 'wholesale' },
    { name: 'Ada Okeke', email: 'ada@example.com', loyaltyPoints: '120' },
  ],
  'the photo',
);
const photoMapping = mapCustomerColumns(fromPhoto);
eq('a photo table needs no paid mapping', photoMapping.needsAi, false);
eq(
  'every column of a photo table is recognised',
  photoMapping.columns.filter(c => !c.field).length,
  0,
);
eq(
  'and every one is recognised with full confidence',
  photoMapping.columns.every(c => c.confidence >= CUSTOMER_AI_MAPPING_THRESHOLD),
  true,
);

// Every importable field has a header in that table, or the field is unreachable
// from a photo or a typed sentence and only a spreadsheet could ever fill it.
const photoFields = new Set(photoMapping.columns.map(c => c.field).filter(Boolean));
eq(
  'a photo can reach every importable field',
  CUSTOMER_IMPORT_FIELDS.filter(f => !photoFields.has(f)),
  [],
);

// And the values coerce exactly as a spreadsheet's would.
const photoDrafts = buildCustomerDrafts(fromPhoto, photoMapping).drafts;
eq('money from a photo parses', photoDrafts[0].totalSpent, 45000);
eq('a phone from a photo stays raw', photoDrafts[0].phone, '0803 123 4567');
eq('tags from a photo split', photoDrafts[0].tags, ['wholesale']);
eq('an absent figure from a photo is undefined', photoDrafts[0].loyaltyPoints, undefined);
eq('an absent phone from a photo is undefined', photoDrafts[1].phone, undefined);

/*
 * And the normalisers are shared with the Health tab, which is what stops the
 * importer creating a record the Health tab immediately flags as a duplicate.
 */
eq('name normalisation is shared', normalizeName('  MUSA   Ibrahim '), normalizeName('musa ibrahim'));
eq('code normalisation is shared', normalizeCode('acc 1'), normalizeCode('ACC-1'.replace('-', ' ')));

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
if (failures.length === 0) {
  console.log(`✓ all ${passed} checks passed`);
  process.exit(0);
}
console.log(`✗ ${failures.length} failed, ${passed} passed\n`);
for (const failure of failures) console.log(`  ✗ ${failure}\n`);
process.exit(1);
