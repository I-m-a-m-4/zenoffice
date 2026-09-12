/**
 * Checks for the Zen AI cost path — `npm run test:zen-cost`.
 *
 * Kept rather than thrown away because every defect this guards against is
 * **invisible**: it costs money on Google's invoice and breaks nothing a user or a
 * typecheck would notice. There is no error, no failed request, no wrong number on
 * screen — just a bill that is quietly larger than it needs to be, arriving weeks
 * later, with no way to attribute it to the change that caused it.
 *
 * What was measured on 20 August 2026, and what makes this worth a harness: input
 * was **98% of the tokens and 85% of the cost** of a Zen AI turn, and ~8,100 tokens
 * of every turn's input was fixed overhead resent verbatim — tool schemas plus the
 * system prompt. Tool *results* are worse than they look, because a result is
 * charged again on every later step of the same turn and again on every later turn
 * of the conversation. So a single unslimmed `imageUrl` is not 300 characters, it is
 * 300 characters times every turn that follows it.
 *
 * The three properties below are the ones that must not regress:
 *
 *   1. **`slimForModel` only ever removes.** It must never rewrite, reorder or round
 *      a value. The full payload still goes to the UI card, so any rewrite here means
 *      the card and the model disagree about the shop's own numbers — the model would
 *      read out a figure the owner cannot see on screen. Section 1 proves this
 *      structurally rather than by eyeballing a diff.
 *   2. **Every tool carries `toModelOutput`.** It is attached set-wide in
 *      `createZenTools` precisely so a new tool cannot forget it; section 3 proves the
 *      wrapper actually reached all of them.
 *   3. **History growth stays bounded.** Section 4 asserts the measured savings hold,
 *      so a change that silently reverts them fails here instead of on an invoice.
 *
 * The savings floors in sections 2 and 4 are deliberately set *below* what was
 * measured. They are a regression alarm, not a target to tune against — a small drop
 * from a legitimate payload change should not fail the build, and a collapse should.
 *
 * Must be `.ts`, never `.mts`: there is no `"type": "module"` in this repo, so
 * `src/**` compiles to CJS and a true-ESM importer fails named-import interop.
 */

import { readFileSync } from 'node:fs';
import { createZenTools, slimForModel, slimHistory } from '../src/app/api/chat/tools';

let pass = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
  } else {
    failures.push(`${name}${detail === undefined ? '' : ` — got ${JSON.stringify(detail)}`}`);
  }
}

/** Tokens, at the 4-characters-per-token rule of thumb. Comparative, not billed. */
const tok = (v: unknown) => Math.round(JSON.stringify(v).length / 4);

/** A real Firebase Storage download URL is this long, and the model cannot see it. */
const IMG =
  'https://firebasestorage.googleapis.com/v0/b/zeneva-app.appspot.com/o/products%2FaBcD1234-5678-90ef-ghij-klmnopqrstuv.jpg?alt=media&token=1f2e3d4c-5b6a-7980-1234-56789abcdef0';

const product = (i: number, sparse: boolean) => ({
  id: `prod-${i}-aBcD1234efgh`,
  name: `Product Number ${i}`,
  sku: sparse ? null : `SKU-${1000 + i}`,
  category: sparse ? null : 'Beverages',
  categoryType: 'product',
  price: 1500 + i * 10,
  costPrice: sparse ? null : 900 + i * 5,
  stock: 40 + i,
  lowStockThreshold: 5,
  imageUrl: IMG,
  baseUnit: sparse ? null : 'bottle',
  expiryDate: sparse ? null : '2027-04-03T00:00:00.000Z',
});

const productList = (sparse: boolean) => ({
  type: 'PRODUCT_LIST',
  title: 'Products matching "milk"',
  totalMatches: 34,
  shown: 12,
  currency: 'NGN',
  products: Array.from({ length: 12 }, (_, i) => product(i, sparse)),
});

/** Both halves on purpose — `products` carries the ids, `rows` is what the card draws. */
const productTable = () => ({
  type: 'PRODUCT_TABLE',
  title: 'Reorder to 30 days of cover',
  currency: 'NGN',
  estimatedTotalCost: 412300,
  products: Array.from({ length: 15 }, (_, i) => ({
    ...product(i, true),
    stats: [
      { label: 'Sells/day', value: 2.4, format: 'number' },
      { label: 'Order', value: 30, format: 'number' },
      { label: 'Est. cost', value: 27000, format: 'currency' },
    ],
  })),
  columns: ['Product', 'In stock', 'Sells/day', 'Order', 'Est. cost'],
  rows: Array.from({ length: 15 }, (_, i) => ({
    Product: `Product Number ${i}`,
    'In stock': 40 + i,
    'Sells/day': 2.4,
    Order: 30,
    'Est. cost': 27000,
  })),
});

/** `summary` already states every conclusion; `report` exists only to draw the card. */
const lossScan = () => ({
  type: 'LOSS_SCAN',
  title: 'Loss-prevention scan',
  summary:
    'Three staff show patterns worth reviewing. Amina voided 14 sales worth 82,400 against a colleague median of 2. '.repeat(
      3,
    ),
  truncated: 0,
  report: {
    generatedAt: '2026-08-20T10:00:00.000Z',
    windowDays: 30,
    currency: 'NGN',
    findings: Array.from({ length: 15 }, (_, i) => ({
      id: `T${i}-amina`,
      code: `T${i}`,
      severity: 'high',
      staffId: `user-${i}`,
      staffName: `Staff ${i}`,
      headline: `Void rate ${10 + i}x the median of their colleagues`,
      detail:
        'Voided 14 receipts totalling 82,400 in the window, against a colleague median of 2 voids. '.repeat(
          2,
        ),
      evidence: Array.from({ length: 5 }, (_, j) => ({
        receiptId: `rec-9f8e7d6c${j}`,
        at: '2026-08-11T14:22:00.000Z',
        amount: 5800 + j * 100,
        soldBy: `Staff ${i}`,
        note: 'voided 4 minutes after the sale',
      })),
    })),
    watchlist: Array.from({ length: 8 }, (_, i) => ({
      staffId: `user-${i}`,
      staffName: `Staff ${i}`,
      score: 40 - i,
      reasons: ['high void rate', 'off-hours sales'],
    })),
  },
});

/* ── 1. slimForModel only ever removes ─────────────────────────────────────── */
/*
 * The property, stated precisely: for every key that survives, the surviving value
 * is `===` the source value (recursing through objects and arrays), arrays keep
 * their length, and no key exists in the output that was absent from the input.
 * Removal is unrestricted; anything else is a defect.
 */
{
  /** Returns a list of violations; empty means the value was only ever narrowed. */
  function onlyRemoves(orig: any, slim: any, path = '$'): string[] {
    const bad: string[] = [];

    if (Array.isArray(slim)) {
      if (!Array.isArray(orig)) return [`${path}: array where source was ${typeof orig}`];
      // `slimForModel` maps over arrays, so a length change means it dropped an
      // element — which would silently shorten a product list the card still shows.
      if (slim.length !== orig.length) bad.push(`${path}: length ${orig.length} → ${slim.length}`);
      slim.forEach((v, i) => bad.push(...onlyRemoves(orig[i], v, `${path}[${i}]`)));
      return bad;
    }

    if (slim !== null && typeof slim === 'object') {
      if (orig === null || typeof orig !== 'object') {
        return [`${path}: object where source was ${typeof orig}`];
      }
      for (const [k, v] of Object.entries(slim)) {
        if (!(k in orig)) {
          bad.push(`${path}.${k}: key invented`);
          continue;
        }
        bad.push(...onlyRemoves(orig[k], v, `${path}.${k}`));
      }
      return bad;
    }

    if (slim !== orig) bad.push(`${path}: ${JSON.stringify(orig)} → ${JSON.stringify(slim)}`);
    return bad;
  }

  for (const [label, value] of [
    ['PRODUCT_LIST sparse', productList(true)],
    ['PRODUCT_LIST filled', productList(false)],
    ['PRODUCT_TABLE', productTable()],
    ['LOSS_SCAN', lossScan()],
  ] as Array<[string, any]>) {
    const violations = onlyRemoves(value, slimForModel(value));
    check(`1: ${label} — only removes`, violations.length === 0, violations.slice(0, 4));
  }

  // Numbers must survive untouched: the card shows the same figure, and a rounded
  // one here is a model reading out money the owner cannot find on screen.
  const money = { type: 'METRICS', revenue: 1234567.89, margin: 0.4173, count: 0 };
  const slimMoney: any = slimForModel(money);
  check('1e: exact money preserved', slimMoney.revenue === 1234567.89, slimMoney.revenue);
  check('1f: exact ratio preserved', slimMoney.margin === 0.4173, slimMoney.margin);
  check('1g: zero is kept, not dropped as falsy', slimMoney.count === 0, slimMoney);

  // Null and undefined carry no information the model can use, and cost tokens.
  const sparse: any = slimForModel({ a: 1, b: null, c: undefined, d: '' });
  check('1h: null dropped', !('b' in sparse), sparse);
  check('1i: undefined dropped', !('c' in sparse), sparse);
  check('1j: empty string kept (it is a value)', sparse.d === '', sparse);

  // Strings are relayed verbatim, not slimmed — LOSS_SCAN's summary is prose.
  check('1k: string passes through', slimForModel('hello') === 'hello');
}

/* ── 2. The savings that pay for all of this ───────────────────────────────── */
/*
 * Floors, not targets. Set below the 20 August 2026 measurement (66/43/55/98%) so a
 * legitimate payload change does not fail the build but a collapse does.
 */
{
  const saved = (v: unknown) => {
    const before = tok(v);
    return { before, pct: Math.round(((before - tok(slimForModel(v))) / before) * 100) };
  };

  const cases: Array<[string, unknown, number]> = [
    ['PRODUCT_LIST (12, sparse)', productList(true), 55],
    ['PRODUCT_LIST (12, filled)', productList(false), 35],
    ['PRODUCT_TABLE (15 rows)', productTable(), 45],
    ['LOSS_SCAN (15 findings)', lossScan(), 90],
  ];

  console.log('\n  tool result payloads, tokens sent to the model');
  console.log('  ' + 'case'.padEnd(28) + 'before'.padStart(8) + 'saved'.padStart(8) + '   floor');
  for (const [label, value, floor] of cases) {
    const { before, pct } = saved(value);
    console.log(
      '  ' + label.padEnd(28) + String(before).padStart(8) + `${pct}%`.padStart(8) + `    ${floor}%`,
    );
    check(`2: ${label} saves ≥${floor}%`, pct >= floor, `${pct}%`);
  }

  // The two specific removals, named so a regression says which one broke.
  const table: any = slimForModel(productTable());
  check('2e: PRODUCT_TABLE keeps products (ids for chaining)', Array.isArray(table.products));
  check('2f: PRODUCT_TABLE drops the duplicate rows half', !('rows' in table), Object.keys(table));
  check('2g: PRODUCT_TABLE drops columns', !('columns' in table), Object.keys(table));

  const scan: any = slimForModel(lossScan());
  check('2h: LOSS_SCAN keeps summary (the conclusions)', typeof scan.summary === 'string');
  check('2i: LOSS_SCAN drops report', !('report' in scan), Object.keys(scan));

  check('2j: no imageUrl survives anywhere', !JSON.stringify(table).includes('firebasestorage'));

  // A PRODUCT_TABLE with no products must keep rows, or the model gets an empty card.
  const empty: any = slimForModel({ type: 'PRODUCT_TABLE', products: [], rows: [{ a: 1 }], columns: ['a'] });
  check('2k: empty PRODUCT_TABLE keeps rows', Array.isArray(empty.rows), Object.keys(empty));

  // A LOSS_SCAN that failed to produce a summary must keep its report.
  const noSummary: any = slimForModel({ type: 'LOSS_SCAN', report: { findings: [] } });
  check('2l: summary-less LOSS_SCAN keeps report', 'report' in noSummary, Object.keys(noSummary));
}

/* ── 3. Every tool carries the hook, and the rating tool is the only optional one ── */
{
  const fakeDb: any = { collection: () => ({ doc: () => ({ get: async () => ({}) }) }) };
  const build = (ratingEnabled: boolean) =>
    createZenTools({ db: fakeDb, businessId: 'b1', currency: 'NGN', ratingEnabled } as any);

  const on = build(true);
  const off = build(false);
  const onNames = Object.keys(on);
  const offNames = Object.keys(off);

  check(
    '3a: no tool is missing toModelOutput',
    onNames.every((n) => typeof (on as any)[n].toModelOutput === 'function'),
    onNames.filter((n) => typeof (on as any)[n].toModelOutput !== 'function'),
  );
  check(
    '3b: every tool kept its description',
    onNames.every((n) => typeof (on as any)[n].description === 'string'),
  );
  check(
    '3c: every tool kept its execute',
    onNames.every((n) => typeof (on as any)[n].execute === 'function'),
  );

  // The count is deliberately not hardcoded — TOOL_LINES is the catalogue and this
  // asserts the relationship instead, so adding a tool does not fail here spuriously.
  check('3d: rating off drops exactly one tool', onNames.length - offNames.length === 1, {
    on: onNames.length,
    off: offNames.length,
  });
  check('3e: the dropped tool is getBusinessRating', onNames.includes('getBusinessRating') && !offNames.includes('getBusinessRating'));
  check(
    '3f: nothing else differs',
    onNames.filter((n) => n !== 'getBusinessRating').join() === offNames.join(),
  );

  // The status line renders raw camelCase for a tool with no TOOL_LINES entry, and
  // ZEN_TOOL_COUNT on the admin board is derived from it. Read as text rather than
  // imported: zen-status.tsx is a client component and would pull React in here.
  const src = readFileSync('src/components/ai-insights/zen-status.tsx', 'utf8');
  const block = src.match(/TOOL_LINES[^=]*=\s*\{([\s\S]*?)\n\}/);
  check('3g: TOOL_LINES is parseable', block !== null);
  if (block) {
    const listed = new Set([...block[1].matchAll(/^\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/gm)].map((m) => m[1]));
    const missing = onNames.filter((n) => !listed.has(n));
    const stale = [...listed].filter((n) => !onNames.includes(n));
    check('3h: every tool has a TOOL_LINES entry', missing.length === 0, missing);
    check('3i: no stale TOOL_LINES entry', stale.length === 0, stale);
  }

  // The hook itself: strings relay as text, objects slim to json.
  const t: any = (on as any).queryProducts;
  check('3j: string output → text part', JSON.stringify(t.toModelOutput({ output: 'plain' })) === JSON.stringify({ type: 'text', value: 'plain' }));
  const hooked: any = t.toModelOutput({ output: { type: 'X', imageUrl: IMG, keep: 1, gone: null } });
  check('3k: object output → json part', hooked.type === 'json');
  check('3l: hook slims through slimForModel', JSON.stringify(hooked.value) === JSON.stringify({ type: 'X', keep: 1 }), hooked.value);
}

/* ── 4. History growth is bounded ──────────────────────────────────────────── */
/*
 * The twentieth question pays for the previous nineteen answers, so the saving here
 * has to *grow* with the conversation rather than hold at a constant percentage.
 */
{
  const bigResult = (n: number) => ({
    type: 'PRODUCT_LIST',
    title: `Products matching "batch ${n}"`,
    totalMatches: 34,
    shown: 12,
    currency: 'NGN',
    products: Array.from({ length: 12 }, (_, i) => ({ ...product(i, true), id: `p${n}-${i}` })),
  });
  const tinyResult = { type: 'LINK', title: 'Open Inventory', href: '/inventory', label: 'Inventory' };

  /** `turns` exchanges: user text, then an assistant tool call plus prose. */
  const convo = (turns: number) => {
    const out: any[] = [];
    for (let n = 0; n < turns; n++) {
      out.push({ id: `u${n}`, role: 'user', parts: [{ type: 'text', text: `Question ${n} about my stock levels` }] });
      out.push({
        id: `a${n}`,
        role: 'assistant',
        parts: [
          { type: 'tool-queryProducts', toolCallId: `c${n}`, state: 'output-available', input: { query: `batch ${n}` }, output: bigResult(n) },
          { type: 'text', text: `Here are the twelve products matching batch ${n}. Stock looks healthy.` },
        ],
      });
    }
    return out;
  };

  console.log('\n  whole-conversation input, tokens');
  console.log('  ' + 'turns'.padEnd(8) + 'before'.padStart(9) + 'after'.padStart(9) + 'saved'.padStart(8) + '   floor');
  for (const [turns, floor] of [[1, 55], [5, 55], [8, 55], [12, 60], [20, 70], [40, 75]] as Array<[number, number]>) {
    const h = convo(turns);
    const before = tok(h);
    const after = tok(slimHistory(h));
    const pct = Math.round(((before - after) / before) * 100);
    console.log(
      '  ' + String(turns).padEnd(8) + String(before).padStart(9) + String(after).padStart(9) + `${pct}%`.padStart(8) + `    ${floor}%`,
    );
    check(`4: ${turns} turns saves ≥${floor}%`, pct >= floor, `${pct}%`);
  }

  // Bounded, not merely smaller: doubling the conversation must not double the cost.
  const t20 = tok(slimHistory(convo(20)));
  const t40 = tok(slimHistory(convo(40)));
  check('4g: 40 turns costs well under 2× of 20', t40 < t20 * 1.7, { t20, t40 });

  /* Integrity — everything the model and the UI still need must survive verbatim. */
  const h = convo(12);
  const s = slimHistory(h);
  const parts = (ms: any[], kind: 'text' | 'tool') =>
    ms.flatMap((m: any) =>
      m.parts.filter((p: any) => (kind === 'text' ? p.type === 'text' : p.type.startsWith('tool-'))),
    );

  check('4h: message count preserved', s.length === h.length, { before: h.length, after: s.length });
  check('4i: roles, ids and order preserved', s.every((m: any, i: number) => m.role === h[i].role && m.id === h[i].id));
  check(
    '4j: every text part byte-identical',
    JSON.stringify(parts(s, 'text')) === JSON.stringify(parts(h, 'text')),
  );
  check(
    '4k: toolCallId, input and state preserved',
    parts(s, 'tool').every((p: any) => p.toolCallId && p.input && p.state === 'output-available'),
  );

  const outs = parts(s, 'tool').map((p: any) => p.output);
  check('4l: newest 8 results kept in full', outs.slice(-8).every((o: any) => Array.isArray(o.products) && o.products.length === 12));
  check('4m: older results digested', outs.slice(0, -8).every((o: any) => o.note && !o.products));
  check('4n: a digest still names the card', typeof outs[0].type === 'string' && typeof outs[0].title === 'string', outs[0]);
  check('4o: no imageUrl anywhere in history', !JSON.stringify(s).includes('firebasestorage'));

  // A small old result costs less than the digest that would replace it.
  const mixed = convo(9);
  mixed[1].parts[0].output = tinyResult;
  check(
    '4p: small old result left untouched',
    JSON.stringify(slimHistory(mixed)[1].parts[0].output) === JSON.stringify(tinyResult),
  );

  // Nothing to do means nothing allocated — the common case is a first turn.
  const textOnly = [{ id: 'u', role: 'user', parts: [{ type: 'text', text: 'hi' }] }];
  check('4q: a history with no tool results is returned as-is', slimHistory(textOnly) === textOnly);
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
