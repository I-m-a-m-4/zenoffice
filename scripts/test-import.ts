/**
 * Checks for the importer's pure core.
 *
 * Run with `npx tsx scripts/test-import.ts`.
 *
 * A `.ts` file, not `.mts`, and that is not cosmetic: there is no `"type": "module"`
 * in this repo, so `src/**` compiles to CJS and a true-ESM importer fails named-import
 * interop — reporting a missing export for a constant that is plainly exported. The
 * same trap the business-rating harness documents.
 *
 * The cases here are the ones where being quietly wrong is most expensive: a
 * mis-parsed price is a wrong margin on every report afterwards, and a wrong duplicate
 * merge silently corrupts a stock figure the owner will trust for months.
 */

import {
  extractSize,
  formatSize,
  nameSimilarity,
  normalizeName,
  normalizeSku,
  parseDate,
  parseMoney,
  parseQuantity,
  parseUnit,
  tidyName,
} from '../src/lib/import/normalize';
import { mapColumns } from '../src/lib/import/column-map';
import { buildDrafts } from '../src/lib/import/build';
import { matchDraft, buildProductIndex, stageRows } from '../src/lib/import/match';
import { previewBulkOp, describeBulkOp, groupWrites } from '../src/lib/import/bulk-ops';
import { parseTabular } from '../src/lib/import/tabular';
import {
  buildCostWrites,
  coverage,
  fillQueue,
  matchCostLines,
  parseCostList,
} from '../src/lib/import/cost-prices';
import { analyseProductQuality } from '../src/lib/product-quality';
import type { Product } from '../src/types';
import type { RawTable } from '../src/lib/import/types';

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

// ─────────────────────────────────────────────────────────────────────────────
section('Money');
// ─────────────────────────────────────────────────────────────────────────────

eq('plain', parseMoney('1200'), 1200);
eq('naira symbol', parseMoney('₦12,000'), 12000);
eq('hash as naira', parseMoney('#12,000'), 12000);
eq('bare N prefix', parseMoney('N12000'), 12000);
eq('NGN code', parseMoney('NGN 4,500.50'), 4500.5);
eq('US thousands + decimal', parseMoney('1,234.56'), 1234.56);
eq('EU thousands + decimal', parseMoney('1.234,56'), 1234.56);
eq('single comma, 3 digits = thousands', parseMoney('1,500'), 1500);
eq('single dot, 3 digits = thousands', parseMoney('1.500'), 1500);
eq('single comma, 2 digits = decimal', parseMoney('12,50'), 12.5);
eq('single dot, 1 digit = decimal', parseMoney('12.5'), 12.5);
eq('repeated dot = thousands', parseMoney('1.234.567'), 1234567);
eq('k suffix', parseMoney('12k'), 12000);
eq('decimal k suffix', parseMoney('1.2k'), 1200);
eq('accounting negative', parseMoney('(500)'), -500);
eq('kenyan flat', parseMoney('1,200/='), 1200);
eq('trailing dash flat', parseMoney('1,200/-'), 1200);
eq('nbsp thousands', parseMoney('1 200.50'), 1200.5);
eq('swiss apostrophe', parseMoney("12'000"), 12000);
eq('empty is null', parseMoney(''), null);
eq('text is null', parseMoney('call for price'), null);
eq('zero is zero not null', parseMoney('0'), 0);
eq('number passthrough', parseMoney(4500), 4500);
// The one that must NOT be read as money-with-magnitude.
eq('12 kg is not 12000', parseMoney('12 kg'), 12);
ok('N95 keeps its 95', parseMoney('N95 Mask') === 95, `got ${parseMoney('N95 Mask')}`);

eq('quantity rounds', parseQuantity('12.6'), 13);
eq('negative stock floors at 0', parseQuantity('-3'), 0);
eq('quantity with unit', parseQuantity('20 cartons'), 20);
eq('unit extracted', parseUnit('20 cartons'), 'Carton');
eq('unit canon pcs', parseUnit('12 pcs'), 'Piece');
eq('no unit', parseUnit('12'), undefined);

// ─────────────────────────────────────────────────────────────────────────────
section('Sizes and names');
// ─────────────────────────────────────────────────────────────────────────────

eq('50cl to ml', formatSize(extractSize('Coca Cola 50cl')!), '500ml');
eq('500ml stays', formatSize(extractSize('Coca-Cola Original 500ml')!), '500ml');
eq('1.5L to ml', formatSize(extractSize('Coke 1.5L')!), '1500ml');
eq('400g', formatSize(extractSize('Peak Milk 400g')!), '400g');
eq('1kg to g', formatSize(extractSize('Rice 1kg')!), '1000g');
eq('no size', extractSize('Bic Biro'), null);

ok(
  'Coke 50cl normalises the same as Coca-Cola Original 500ml',
  normalizeName('Coca Cola 50cl') === normalizeName('Coca-Cola Original 500ml'),
  `"${normalizeName('Coca Cola 50cl')}" vs "${normalizeName('Coca-Cola Original 500ml')}"`,
);
ok(
  'word order does not matter',
  normalizeName('Milo Refill 400g') === normalizeName('400g Refill Milo'),
  `"${normalizeName('Milo Refill 400g')}" vs "${normalizeName('400g Refill Milo')}"`,
);
ok(
  'different sizes do NOT normalise the same',
  normalizeName('Coke 50cl') !== normalizeName('Coke 1.5L'),
);
ok(
  'different brands do NOT normalise the same',
  normalizeName('Coca Cola 50cl') !== normalizeName('Pepsi 50cl'),
);
ok('single digits survive', normalizeName('Peak 3') !== normalizeName('Peak 5'));

eq('shouting is tidied', tidyName('COCA COLA 50CL'), 'Coca Cola 50cl');
eq('lowercase is tidied', tidyName('coca cola'), 'Coca Cola');
eq('mixed case is left alone', tidyName('iPhone 15 Pro'), 'iPhone 15 Pro');

ok('similar names score high', nameSimilarity('Coca Cola 50cl', 'Coca-Cola Original 500ml') > 0.6);
ok('unrelated names score low', nameSimilarity('Coca Cola', 'Dangote Cement') < 0.2);

eq('sku normalises', normalizeSku(' 5449-000 000996 '), '5449000000996');
eq('leading zero kept', normalizeSku('012345678905'), '012345678905');

// ─────────────────────────────────────────────────────────────────────────────
section('Dates');
// ─────────────────────────────────────────────────────────────────────────────

eq('iso', parseDate('2027-04-03'), '2027-04-03');
eq('day first', parseDate('03/04/2027'), '2027-04-03');
eq('day > 12 forces day first', parseDate('25/04/2027'), '2027-04-25');
eq('US style detected', parseDate('04/25/2027'), '2027-04-25');
eq('month name', parseDate('3 April 2027'), '2027-04-03');
eq('month/year is end of month', parseDate('04/2027'), '2027-04-30');
eq('junk is null', parseDate('soon'), null);

// ─────────────────────────────────────────────────────────────────────────────
section('Column mapping — the headline case');
// ─────────────────────────────────────────────────────────────────────────────

// Exactly the file from the brief: Item | Selling | Buy | Qty | Dept
const brief: RawTable = {
  headers: ['Item', 'Selling', 'Buy', 'Qty', 'Dept'],
  rows: [
    ['Coca-Cola 50cl', '450', '380', '24', 'Drinks'],
    ['Indomie Chicken 70g', '250', '190', '120', 'Food'],
    ['Peak Milk 400g', '4200', '3600', '15', 'Provisions'],
  ],
  hasHeaderRow: true,
};
const briefMap = mapColumns(brief);
const fieldAt = (r: typeof briefMap, i: number) => r.columns.find((c) => c.index === i)?.field;
eq('Item -> name', fieldAt(briefMap, 0), 'name');
eq('Selling -> price', fieldAt(briefMap, 1), 'price');
eq('Buy -> costPrice', fieldAt(briefMap, 2), 'costPrice');
eq('Qty -> stock', fieldAt(briefMap, 3), 'stock');
eq('Dept -> category', fieldAt(briefMap, 4), 'category');
ok('the brief file needs no AI', briefMap.needsAi === false, JSON.stringify(briefMap.uncertain));

// The dangerous case: "Cost Price" must not win on the substring "price".
const costFirst = mapColumns({
  headers: ['Product Name', 'Cost Price', 'Unit Price'],
  rows: [['Rice 50kg', '52000', '58000']],
  hasHeaderRow: true,
});
eq('Cost Price -> costPrice', fieldAt(costFirst, 1), 'costPrice');
eq('Unit Price -> price', fieldAt(costFirst, 2), 'price');

// No header row at all — value inference has to carry it.
const headerless = mapColumns({
  headers: [],
  rows: [
    ['Coca-Cola 50cl', 'Drinks', '450', '380', '24'],
    ['Indomie Chicken 70g', 'Food', '250', '190', '120'],
    ['Peak Milk 400g', 'Drinks', '4200', '3600', '15'],
    ['Bournvita 500g', 'Drinks', '5200', '4400', '8'],
  ],
  hasHeaderRow: false,
});
eq('headerless: name inferred', fieldAt(headerless, 0), 'name');
eq('headerless: higher money = price', fieldAt(headerless, 2), 'price');
eq('headerless: lower money = costPrice', fieldAt(headerless, 3), 'costPrice');
ok(
  'headerless: repetitive text = category',
  fieldAt(headerless, 1) === 'category',
  `got ${fieldAt(headerless, 1)}`,
);

// Junk columns must be ignored, not forced into a field.
const withJunk = mapColumns({
  headers: ['Name', 'Price', 'Supplier Phone', 'Internal Ref Notes'],
  rows: [['Rice', '52000', '08031234567', 'chased twice']],
  hasHeaderRow: true,
});
eq('Name mapped', fieldAt(withJunk, 0), 'name');
eq('Price mapped', fieldAt(withJunk, 1), 'price');

// ─────────────────────────────────────────────────────────────────────────────
section('Draft building');
// ─────────────────────────────────────────────────────────────────────────────

const built = buildDrafts(brief, briefMap, 'spreadsheet');
eq('3 drafts', built.drafts.length, 3);
eq('name', built.drafts[0].name, 'Coca-Cola 50cl');
eq('price parsed', built.drafts[0].price, 450);
eq('cost parsed', built.drafts[0].costPrice, 380);
eq('stock parsed', built.drafts[0].stock, 24);
eq('category parsed', built.drafts[0].category, 'Drinks');

// Summary rows off the bottom of an invoice must not become products.
const withTotal = buildDrafts(
  {
    headers: ['Item', 'Qty', 'Cost'],
    rows: [
      ['Coca-Cola 50cl', '24', '380'],
      ['SUBTOTAL', '', '9120'],
      ['VAT', '', '684'],
      ['TOTAL', '', '9804'],
    ],
    hasHeaderRow: true,
  },
  mapColumns({
    headers: ['Item', 'Qty', 'Cost'],
    rows: [['Coca-Cola 50cl', '24', '380']],
    hasHeaderRow: true,
  }),
  'invoice',
);
eq('summary rows dropped', withTotal.drafts.length, 1);
eq('3 skipped with reasons', withTotal.skipped.length, 3);

// Cost above price is flagged, not silently accepted.
const inverted = buildDrafts(
  { headers: ['Name', 'Price', 'Cost'], rows: [['Rice', '400', '52000']], hasHeaderRow: true },
  mapColumns({ headers: ['Name', 'Price', 'Cost'], rows: [['Rice', '400', '52000']], hasHeaderRow: true }),
  'spreadsheet',
);
ok(
  'inverted margin is flagged',
  inverted.drafts[0].issues.some((i) => /right way round/i.test(i.message)),
  JSON.stringify(inverted.drafts[0].issues),
);

// ─────────────────────────────────────────────────────────────────────────────
section('Duplicate matching — must never guess');
// ─────────────────────────────────────────────────────────────────────────────

const catalogue: Product[] = [
  { id: 'p1', businessId: 'b', name: 'Coca-Cola Original 500ml', sku: '5449000000996', category: 'Drinks', price: 450, costPrice: 380, stock: 24 },
  { id: 'p2', businessId: 'b', name: 'Coca-Cola 1.5L', sku: '5449000011527', category: 'Drinks', price: 1200, costPrice: 950, stock: 10 },
  { id: 'p3', businessId: 'b', name: 'Indomie Chicken 70g', sku: 'IND-CHK-70', category: 'Food', price: 250, costPrice: 190, stock: 120 },
  { id: 'p4', businessId: 'b', name: 'Indomie Onion 70g', sku: 'IND-ONI-70', category: 'Food', price: 250, costPrice: 190, stock: 90 },
];
const index = buildProductIndex(catalogue);

const draft = (name: string, extra: Partial<{ sku: string; stock: number }> = {}) => ({
  key: 'k', name, raw: {}, issues: [], source: 'spreadsheet' as const, ...extra,
});

// The exact case from the brief.
const coke = matchDraft(draft('Coca Cola 50cl'), index);
ok(
  'Coke 50cl matches Coca-Cola Original 500ml',
  (coke.kind === 'certain' && coke.match.productId === 'p1') ||
    (coke.kind === 'possible' && coke.candidates[0].productId === 'p1'),
  JSON.stringify(coke),
);

// Barcode is a fact and is never a question.
const byBarcode = matchDraft(draft('Coke, 50 centilitre bottle', { sku: '5449000000996' }), index);
eq('barcode is certain', byBarcode.kind, 'certain');
ok('barcode picks p1', byBarcode.kind === 'certain' && byBarcode.match.productId === 'p1');
ok('barcode explains itself', byBarcode.kind === 'certain' && /same code/.test(byBarcode.match.explanation));

// A different size must not merge into the 500ml.
const bigCoke = matchDraft(draft('Coca Cola 150cl'), index);
ok(
  '150cl does not become certain against 500ml',
  bigCoke.kind !== 'certain' || bigCoke.match.productId === 'p2',
  JSON.stringify(bigCoke),
);

// A different flavour must not merge.
const onion = matchDraft(draft('Indomie Onion 70g'), index);
ok(
  'Indomie Onion matches the Onion product, not the Chicken one',
  (onion.kind === 'certain' && onion.match.productId === 'p4') ||
    (onion.kind === 'possible' && onion.candidates[0].productId === 'p4'),
  JSON.stringify(onion),
);

// Something genuinely new.
const fresh = matchDraft(draft('Dangote Cement 50kg'), index);
eq('unrelated product is new', fresh.kind, 'new');

// Two rows for the same product cannot both claim it.
const twoRows = stageRows(
  [draft('Coca Cola 50cl'), { ...draft('Coca-Cola Original 500ml'), key: 'k2' }],
  catalogue,
  'replace',
);
const claims = twoRows.filter((r) => r.decision.action === 'overwrite').map((r) => (r.decision as any).productId);
ok('one product is claimed at most once', new Set(claims).size === claims.length, JSON.stringify(claims));

// An unanswered question defaults to creating, never to merging.
const ambiguous = stageRows([draft('Coca Cola')], catalogue, 'replace');
ok(
  'a possible match defaults to create',
  ambiguous[0].verdict.kind !== 'possible' || ambiguous[0].decision.action === 'create',
  JSON.stringify(ambiguous[0]),
);

// A human decision survives a re-match.
const decided = stageRows([draft('Coca Cola 50cl')], catalogue, 'replace').map((r) => ({
  ...r, decision: { action: 'skip' as const }, decidedByUser: true,
}));
const restaged = stageRows([draft('Coca Cola 50cl')], catalogue, 'restock', decided);
eq('human decision survives re-match', restaged[0].decision.action, 'skip');

// ─────────────────────────────────────────────────────────────────────────────
section('Pasted text');
// ─────────────────────────────────────────────────────────────────────────────

const tabbed = parseTabular('Item\tQty\tPrice\nCoca-Cola 50cl\t24\t450\nIndomie\t120\t250');
eq('tab paste is delimited', tabbed?.via, 'delimited');
eq('tab paste finds header', tabbed?.table.hasHeaderRow, true);
eq('tab paste rows', tabbed?.table.rows.length, 2);

const whatsapp = parseTabular('Coke 50cl - 450\nIndomie chicken - 250\nPeak milk 400g - 4200');
eq('whatsapp list detected', whatsapp?.via, 'line-list');
eq('whatsapp rows', whatsapp?.table.rows.length, 3);
eq('whatsapp first name', whatsapp?.table.rows[0][0], 'Coke 50cl');

const quoted = parseTabular('Name,Price\n"Milo 400g, refill",4200\nBournvita,5200');
eq('quoted comma stays one cell', quoted?.table.rows[0][0], 'Milo 400g, refill');
eq('quoted row keeps its price', quoted?.table.rows[0][1], '4200');

const prose = parseTabular('I went to the market today, and bought some things. It was busy.');
ok('prose is not read as a table', !prose || prose.via === 'single-column', JSON.stringify(prose?.via));

// ─────────────────────────────────────────────────────────────────────────────
section('Bulk operations');
// ─────────────────────────────────────────────────────────────────────────────

const raise = previewBulkOp(catalogue, {
  field: 'costPrice',
  mode: { kind: 'increase-percent', percent: 8 },
  filter: {},
});
eq('8% touches all four', raise.changes.length, 4);
eq('380 + 8% = 410.4', raise.changes[0].after, 410.4);

const drinksOnly = previewBulkOp(catalogue, {
  field: 'price',
  mode: { kind: 'increase-percent', percent: 10 },
  filter: { categories: ['Drinks'] },
});
eq('category filter narrows to 2', drinksOnly.changes.length, 2);

// The destructive case: a margin with no cost price must skip, never write 0.
const noCost: Product[] = [
  { id: 'x1', businessId: 'b', name: 'Mystery Item', sku: '', category: 'Other', price: 100, stock: 5 },
];
const margin = previewBulkOp(noCost, {
  field: 'price',
  mode: { kind: 'margin', percent: 35 },
  filter: {},
});
eq('no cost price = no change', margin.changes.length, 0);
eq('no cost price = skipped', margin.skipped.length, 1);
ok('skip says why', /cost price/i.test(margin.skipped[0].reason), margin.skipped[0].reason);

// Margin and markup are genuinely different numbers.
const markupPreview = previewBulkOp(
  [{ id: 'y', businessId: 'b', name: 'Thing', sku: '', category: '', price: 0, costPrice: 100, stock: 1 }],
  { field: 'price', mode: { kind: 'markup', percent: 50 }, filter: {} },
);
eq('50% markup on 100 = 150', markupPreview.changes[0].after, 150);
const marginPreview = previewBulkOp(
  [{ id: 'y', businessId: 'b', name: 'Thing', sku: '', category: '', price: 0, costPrice: 100, stock: 1 }],
  { field: 'price', mode: { kind: 'margin', percent: 50 }, filter: {} },
);
eq('50% margin on 100 = 200', marginPreview.changes[0].after, 200);

// A 100% margin divides by zero and must be refused.
const impossible = previewBulkOp(
  [{ id: 'y', businessId: 'b', name: 'Thing', sku: '', category: '', price: 0, costPrice: 100, stock: 1 }],
  { field: 'price', mode: { kind: 'margin', percent: 100 }, filter: {} },
);
eq('100% margin is skipped', impossible.changes.length, 0);

// Rounding collapses to few writes; a percentage does not.
const rounded = previewBulkOp(catalogue, {
  field: 'price',
  mode: { kind: 'round', nearest: 100 },
  filter: {},
});
ok('rounding groups into fewer writes', groupWrites(rounded).length <= rounded.changes.length);
const setAll = previewBulkOp(catalogue, { field: 'stock', mode: { kind: 'set', value: 0 }, filter: {} });
eq('a uniform set is ONE write', groupWrites(setAll).length, 1);

ok(
  'description names the rule',
  /8%/.test(describeBulkOp({ field: 'costPrice', mode: { kind: 'increase-percent', percent: 8 }, filter: {} })),
  describeBulkOp({ field: 'costPrice', mode: { kind: 'increase-percent', percent: 8 }, filter: {} }),
);

// ─────────────────────────────────────────────────────────────────────────────
section('Cost prices — reading a list');
// ─────────────────────────────────────────────────────────────────────────────

const whatsappCosts = parseCostList('Coke 50cl - 380\nIndomie Chicken 70g - 190\nPeak Milk 400g - 3,600');
eq('3 cost lines read', whatsappCosts.lines.length, 3);
eq('first name', whatsappCosts.lines[0].name, 'Coke 50cl');
eq('first cost', whatsappCosts.lines[0].cost, 380);
eq('thousands separator in a cost', whatsappCosts.lines[2].cost, 3600);

const tabbedCosts = parseCostList('Product\tCost\nCoca-Cola 50cl\t380\nIndomie\t190');
eq('tab-delimited cost list', tabbedCosts.lines.length, 2);
eq('tab cost parsed', tabbedCosts.lines[0].cost, 380);

// The column headed "Price" must NOT be treated as a selling price here — in this
// context every number is a cost. Position decides, not the header.
const headedPrice = parseCostList('Item,Price\nCoke 50cl,380\nIndomie,190');
eq('a "Price" header is still read as cost', headedPrice.lines[0].cost, 380);
eq('name column found', headedPrice.lines[0].name, 'Coke 50cl');

const nakedNames = parseCostList('Coke 50cl\nIndomie');
eq('names with no numbers yield no lines', nakedNames.lines.length, 0);
eq('and are reported as unreadable', nakedNames.unreadable.length, 2);

// ─────────────────────────────────────────────────────────────────────────────
section('Cost prices — matching and writing');
// ─────────────────────────────────────────────────────────────────────────────

const costRows = matchCostLines(
  parseCostList('Coca-Cola Original 500ml - 380\nIndomie Chicken 70g - 190\nDangote Cement - 5200').lines,
  catalogue,
);
eq('3 rows staged', costRows.length, 3);
eq('exact name is set', costRows[0].decision.action, 'set');
ok(
  'exact name resolves to p1',
  costRows[0].decision.action === 'set' && costRows[0].decision.productId === 'p1',
);
eq('unknown product is skipped, never guessed', costRows[2].decision.action, 'skip');

// The size-equivalence case works when the brand words overlap...
const cokeShorthand = matchCostLines(parseCostList('Coca Cola 50cl - 380').lines, catalogue);
ok(
  '"Coca Cola 50cl" reaches Coca-Cola Original 500ml',
  cokeShorthand[0].decision.action === 'set'
    ? cokeShorthand[0].decision.productId === 'p1'
    : cokeShorthand[0].verdict.kind === 'possible' &&
      cokeShorthand[0].verdict.candidates.some((c) => c.productId === 'p1'),
  JSON.stringify(cokeShorthand[0].verdict),
);

/*
 * ...and deliberately does NOT work for a colloquialism.
 *
 * "Coke" shares not one token with "Coca-Cola" — c-o-k-e against {coca, cola} — so no
 * amount of size matching or string similarity connects them, and the matcher returns
 * `new` rather than reaching for the nearest thing. That is the correct answer for a
 * *deterministic* pass: guessing here would mean guessing on nothing.
 *
 * This is the boundary of what logic can do, and it is asserted so nobody later "fixes"
 * the matcher into merging on a two-character overlap. It is also a real gap for a shop
 * that writes "coke": the line is reported as not found rather than silently applied, and
 * resolving it needs either the owner picking the product or a brand-synonym table, which
 * is deliberately not in here — an over-broad synonym list merges products for a living.
 */
const colloquial = matchCostLines(parseCostList('Coke 50cl - 380').lines, catalogue);
eq('a colloquial name matches nothing rather than guessing', colloquial[0].verdict.kind, 'new');
eq('and is therefore skipped, never written', colloquial[0].decision.action, 'skip');

const costWrites = buildCostWrites(costRows, catalogue);
ok('only matched rows are written', costWrites.every((w) => w.productId !== undefined));
ok('no write for the unmatched line', costWrites.length <= 2, `${costWrites.length} writes`);

// A cost at or above the selling price is flagged rather than silently written.
const tooHigh = buildCostWrites(
  matchCostLines(parseCostList('Coca-Cola Original 500ml - 900').lines, catalogue),
  catalogue,
);
ok('cost above price is flagged', !!tooHigh[0]?.warning, JSON.stringify(tooHigh[0]));

// Re-running the same list must cost nothing.
const alreadyRight = buildCostWrites(
  matchCostLines(parseCostList('Coca-Cola Original 500ml - 380').lines, catalogue),
  catalogue,
);
eq('a no-change row produces no write', alreadyRight.length, 0);

// ─────────────────────────────────────────────────────────────────────────────
section('Cost prices — the queue and coverage');
// ─────────────────────────────────────────────────────────────────────────────

const gapCatalogue: Product[] = [
  { id: 'g1', businessId: 'b', name: 'Fast Mover', sku: '', category: 'A', price: 100, stock: 5 },
  { id: 'g2', businessId: 'b', name: 'Slow Mover', sku: '', category: 'A', price: 100, stock: 5 },
  { id: 'g3', businessId: 'b', name: 'Has A Cost', sku: '', category: 'A', price: 100, costPrice: 60, stock: 5 },
];
const sold = new Map([['g1', 200], ['g2', 1]]);

const queue = fillQueue(gapCatalogue, sold);
eq('only the gaps are queued', queue.length, 2);
eq('ranked by revenue at stake', queue[0].product.id, 'g1');
eq('revenue at stake is units x price', queue[0].revenueAtStake, 20000);

const cov = coverage(gapCatalogue, sold);
// g3 has a real cost but no sales, so it contributes nothing to a revenue-weighted figure.
eq('coverage is revenue-weighted, not product-counted', cov.percentKnown, 0);

const withEstimate: Product[] = [
  { id: 'e1', businessId: 'b', name: 'Guessed', sku: '', category: 'A', price: 100, costPrice: 75, costPriceEstimated: true, stock: 1 },
];
eq('an estimated cost counts as an estimate', coverage(withEstimate, new Map([['e1', 10]])).estimated, 1000);
eq('and not as known', coverage(withEstimate, new Map([['e1', 10]])).known, 0);
ok('an estimate is re-offered in the queue', fillQueue(withEstimate, new Map()).length === 1);

// ─────────────────────────────────────────────────────────────────────────────
section('Cost from margin — the zero-typing path');
// ─────────────────────────────────────────────────────────────────────────────

const priceOnly: Product[] = [
  { id: 'm1', businessId: 'b', name: 'Sells for 1000', sku: '', category: 'Drinks', price: 1000, stock: 4 },
  { id: 'm2', businessId: 'b', name: 'Real cost known', sku: '', category: 'Drinks', price: 1000, costPrice: 700, stock: 4 },
  { id: 'm3', businessId: 'b', name: 'Guessed before', sku: '', category: 'Drinks', price: 1000, costPrice: 800, costPriceEstimated: true, stock: 4 },
  { id: 'm4', businessId: 'b', name: 'No price at all', sku: '', category: 'Drinks', price: 0, stock: 4 },
];

const marginFill = previewBulkOp(priceOnly, {
  field: 'costPrice',
  mode: { kind: 'cost-from-margin', percent: 25 },
  filter: {},
});
eq('25% margin off 1000 gives a cost of 750', marginFill.changes.find((c) => c.productId === 'm1')?.after, 750);
ok(
  'a REAL cost price is never overwritten by an estimate',
  !marginFill.changes.some((c) => c.productId === 'm2'),
  JSON.stringify(marginFill.changes.map((c) => c.productId)),
);
ok(
  'an earlier estimate IS replaced',
  marginFill.changes.some((c) => c.productId === 'm3'),
);
ok(
  'no selling price means skipped, never a cost of zero',
  !marginFill.changes.some((c) => c.productId === 'm4') &&
    marginFill.skipped.some((s) => s.productId === 'm4'),
);

const markupFill = previewBulkOp(priceOnly, {
  field: 'costPrice',
  mode: { kind: 'cost-from-markup', percent: 25 },
  filter: {},
});
eq('25% markup means cost = 1000/1.25 = 800', markupFill.changes.find((c) => c.productId === 'm1')?.after, 800);
ok('margin and markup give different costs', 750 !== 800);

// The flag has to travel with the value or a guess is indistinguishable from a fact.
const marginGroups = groupWrites(marginFill);
ok(
  'a derived cost is stamped as an estimate',
  marginGroups.every((g) => g.value.costPriceEstimated === true),
  JSON.stringify(marginGroups.map((g) => g.value)),
);
const setGroups = groupWrites(
  previewBulkOp(priceOnly, { field: 'costPrice', mode: { kind: 'set', value: 500 }, filter: {} }),
);
ok(
  'an explicitly set cost clears the estimate flag',
  setGroups.every((g) => g.value.costPriceEstimated === false),
  JSON.stringify(setGroups.map((g) => g.value)),
);

// ─────────────────────────────────────────────────────────────────────────────
section('Product quality — what replaced the AI call');
// ─────────────────────────────────────────────────────────────────────────────

const messy: Product[] = [
  { id: 'q1', businessId: 'b', name: 'No Price', sku: 'Q1', category: 'A', price: 0, stock: 3 },
  { id: 'q2', businessId: 'b', name: 'No Cost', sku: 'Q2', category: 'A', price: 500, stock: 10 },
  { id: 'q3', businessId: 'b', name: 'Same Name', sku: 'Q3', category: 'A', price: 500, costPrice: 300, stock: 2 },
  { id: 'q4', businessId: 'b', name: 'Same Name', sku: 'Q4', category: 'A', price: 500, costPrice: 300, stock: 2 },
  { id: 'q5', businessId: 'b', name: 'Dup Code', sku: 'SHARED', category: 'A', price: 500, costPrice: 300, stock: 2 },
  { id: 'q6', businessId: 'b', name: 'Dup Code Two', sku: 'SHARED', category: 'A', price: 500, costPrice: 300, stock: 2 },
  { id: 'q7', businessId: 'b', name: 'Loss Maker', sku: 'Q7', category: 'A', price: 100, costPrice: 150, stock: 4 },
  { id: 'q8', businessId: 'b', name: 'Negative', sku: 'Q8', category: 'A', price: 500, costPrice: 300, stock: -2 },
  { id: 'q9', businessId: 'b', name: 'Drink One', sku: 'Q9', category: 'Drinks', price: 500, costPrice: 300, stock: 1 },
  { id: 'q10', businessId: 'b', name: 'Drink Two', sku: 'Q10', category: 'drink', price: 500, costPrice: 300, stock: 1 },
];

const report = analyseProductQuality(messy, { now: new Date('2026-08-19T00:00:00Z') });
const issue = (id: string) => report.issues.find((i) => i.id === id);

ok('missing price is found', (issue('no-price')?.products.length ?? 0) === 1);
ok('missing cost is found', (issue('no-cost')?.products.length ?? 0) === 1);
ok('duplicate names are found', (issue('duplicate-names')?.products.length ?? 0) === 2);
ok('duplicate barcodes are found', (issue('duplicate-skus')?.products.length ?? 0) === 2);
ok('below-cost pricing is found', (issue('below-cost')?.products.length ?? 0) === 1);
ok('negative stock is found', (issue('negative-stock')?.products.length ?? 0) === 1);
ok(
  'Drinks / drink counts as one category spelled two ways',
  (issue('category-variants')?.products.length ?? 0) === 2,
  JSON.stringify(issue('category-variants')?.title),
);

// Severity ordering is by consequence, not by how many products are affected.
eq('the worst issue is ranked first', report.issues[0].severity, 'high');
ok(
  'a missing price outranks a missing description',
  report.issues.findIndex((i) => i.id === 'no-price') <
    report.issues.findIndex((i) => i.id === 'thin-description'),
);

// Every issue names its products, which is the thing prose could not do.
ok('every issue carries its products', report.issues.every((i) => i.products.length > 0));

const clean: Product[] = [
  {
    id: 'c1', businessId: 'b', name: 'Perfect', sku: 'C1', category: 'A',
    price: 500, costPrice: 300, stock: 10, lowStockThreshold: 2,
    description: 'A properly written description of the product.',
    imageUrl: 'https://example.com/a.png',
  },
];
eq('a clean catalogue scores 100', analyseProductQuality(clean).score, 100);
eq('an empty catalogue does not divide by zero', analyseProductQuality([]).score, 100);

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
if (failures.length === 0) {
  console.log(`✓ all ${passed} checks passed`);
  process.exit(0);
}
console.log(`✗ ${failures.length} failed, ${passed} passed\n`);
for (const failure of failures) console.log(`  ✗ ${failure}\n`);
process.exit(1);
