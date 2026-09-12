/**
 * Throwaway harness for src/lib/reports-aggregates.ts. Run: npx tsx .tmp-agg-test.ts
 * Must be .ts, not .mts — no "type": "module" here, so src/** compiles to CJS and
 * a true-ESM importer fails named-import interop.
 */
import {
  aggregateItems,
  rankItems,
  aggregateCategories,
  foldTail,
  aggregateStaff,
  findMarginLeaks,
  summarisePeriod,
  periodDelta,
  previousWindow,
} from './src/lib/reports-aggregates';
import { isService } from './src/lib/product-kind';

let failures = 0;
function check(label: string, cond: boolean, extra?: any) {
  if (!cond) {
    failures++;
    console.log(`  FAIL  ${label}`, extra !== undefined ? JSON.stringify(extra) : '');
  } else {
    console.log(`  ok    ${label}`);
  }
}

const P = (o: any) => ({ businessId: 'b', sku: '', category: '', price: 0, stock: 0, name: '', ...o });
const R = (o: any) => ({ businessId: 'b', subtotal: 0, tax: 0, discount: 0, total: 0, paymentMethod: 'Cash', createdAt: new Date('2026-08-10'), items: [], ...o });

console.log('\n— isService: the union must catch every legacy shape —');
check('categoryType', isService(P({ categoryType: 'service' })));
check('category "services"', isService(P({ category: 'services' })));
check('category "Service" mixed case', isService(P({ category: 'Service' })));
check('legacy type', isService(P({ type: 'service' })));
check('plain product is not', !isService(P({ category: 'Drinks' })));
check('null-safe', !isService(null as any));

console.log('\n— two products sharing a name must stay separate —');
{
  const products = [P({ id: 'p1', name: 'Coke', category: 'Drinks' }), P({ id: 'p2', name: 'Coke', category: 'Snacks' })];
  const receipts = [
    R({ id: 'r1', total: 300, items: [{ productId: 'p1', name: 'Coke', quantity: 1, price: 100 }, { productId: 'p2', name: 'Coke', quantity: 2, price: 100 }] }),
  ];
  const { items } = aggregateItems(receipts as any, products as any);
  check('two rows, not one', items.length === 2, items.map(i => [i.key, i.units]));
}

console.log('\n— a renamed product must not split (keyed by id, not label) —');
{
  const products = [P({ id: 'p1', name: 'Coke Zero', category: 'Drinks' })];
  const receipts = [
    R({ id: 'r1', total: 100, items: [{ productId: 'p1', name: 'Coke', quantity: 1, price: 100 }] }),
    R({ id: 'r2', total: 100, items: [{ productId: 'p1', name: 'Coke Zero', quantity: 1, price: 100 }] }),
  ];
  const { items } = aggregateItems(receipts as any, products as any);
  check('one row', items.length === 1, items.map(i => i.key));
  check('units summed to 2', items[0]?.units === 2);
  check('orders counted as 2 distinct receipts', items[0]?.orders === 2);
  check('labelled with the current catalogue name', items[0]?.name === 'Coke Zero', items[0]?.name);
}

console.log('\n— unknown cost is unknown, never zero —');
{
  const products = [P({ id: 'p1', name: 'NoCost' }), P({ id: 'p2', name: 'HasCost', costPrice: 40 })];
  const receipts = [R({ id: 'r1', total: 200, items: [
    { productId: 'p1', name: 'NoCost', quantity: 1, price: 100 },
    { productId: 'p2', name: 'HasCost', quantity: 1, price: 100 },
  ] })];
  const { items } = aggregateItems(receipts as any, products as any);
  const noCost = items.find(i => i.key === 'p1')!;
  const hasCost = items.find(i => i.key === 'p2')!;
  check('profit null when cost unknown', noCost.profit === null, noCost.profit);
  check('marginPct null when cost unknown', noCost.marginPct === null);
  check('costKnown false', noCost.costKnown === false);
  check('costCoverage 0', noCost.costCoverage === 0);
  check('profit real when cost known', hasCost.profit === 60, hasCost.profit);
  check('margin 60%', Math.round(hasCost.marginPct!) === 60, hasCost.marginPct);

  const ranked = rankItems(items, 'profit');
  check('unknown-profit item sorts LAST under profit', ranked[ranked.length - 1].key === 'p1', ranked.map(i => i.key));
}

console.log('\n— line cost beats current product cost (history must not be rewritten) —');
{
  const products = [P({ id: 'p1', name: 'X', costPrice: 90 })]; // cost was raised later
  const receipts = [R({ id: 'r1', total: 100, items: [{ productId: 'p1', name: 'X', quantity: 1, price: 100, costPrice: 40 }] })];
  const { items } = aggregateItems(receipts as any, products as any);
  check('uses line costPrice 40, not product 90', items[0].profit === 60, items[0].profit);
}

console.log('\n— revenueShare sums to 1 —');
{
  const products = [P({ id: 'p1', name: 'A' }), P({ id: 'p2', name: 'B' }), P({ id: 'p3', name: 'C' })];
  const receipts = [R({ id: 'r1', total: 600, items: [
    { productId: 'p1', name: 'A', quantity: 1, price: 100 },
    { productId: 'p2', name: 'B', quantity: 1, price: 200 },
    { productId: 'p3', name: 'C', quantity: 1, price: 300 },
  ] })];
  const { items, lineRevenueTotal } = aggregateItems(receipts as any, products as any);
  const sum = items.reduce((s, i) => s + i.revenueShare, 0);
  check('shares sum to 1', Math.abs(sum - 1) < 1e-9, sum);
  check('lineRevenueTotal 600', lineRevenueTotal === 600);
}

console.log('\n— service split uses the widened predicate —');
{
  const products = [
    P({ id: 'p1', name: 'Shampoo', category: 'Retail' }),
    P({ id: 'p2', name: 'Haircut', category: 'services' }), // legacy shape, no categoryType
    P({ id: 'p3', name: 'Massage', categoryType: 'service' }),
  ];
  const receipts = [R({ id: 'r1', total: 300, items: [
    { productId: 'p1', name: 'Shampoo', quantity: 1, price: 100 },
    { productId: 'p2', name: 'Haircut', quantity: 1, price: 100 },
    { productId: 'p3', name: 'Massage', quantity: 1, price: 100 },
  ] })];
  const prod = aggregateItems(receipts as any, products as any, { kind: 'product' });
  const svc = aggregateItems(receipts as any, products as any, { kind: 'service' });
  check('1 product', prod.items.length === 1, prod.items.map(i => i.name));
  check('2 services incl. legacy category shape', svc.items.length === 2, svc.items.map(i => i.name));
}

console.log('\n— variant labelling —');
{
  const products = [
    P({ id: 'parent', name: 'T-Shirt' }),
    P({ id: 'v1', name: 'Large', parentId: 'parent', variantValue: 'Large' }),
  ];
  const receipts = [R({ id: 'r1', total: 100, items: [{ productId: 'v1', name: 'Large', quantity: 1, price: 100 }] })];
  const { items } = aggregateItems(receipts as any, products as any);
  check('reads "T-Shirt (Large)"', items[0].name === 'T-Shirt (Large)', items[0].name);
}

console.log('\n— staff: revenue must reconcile, with an Unattributed bucket —');
{
  const users = [{ id: 'u1', name: 'Ada', role: 'manager' } as any];
  const receipts = [
    R({ id: 'r1', total: 1000, createdBy: 'u1', discount: 100, items: [{ productId: 'p1', name: 'A', quantity: 2, price: 500 }] }),
    R({ id: 'r2', total: 500, createdBy: 'u1', items: [{ productId: 'p1', name: 'A', quantity: 1, price: 500, priceOverridden: true, listPrice: 600 }] }),
    R({ id: 'r3', total: 250, items: [{ productId: 'p1', name: 'A', quantity: 1, price: 250 }] }), // no createdBy
    R({ id: 'r4', total: 90, createdBy: 'gone', items: [] }),
  ];
  const staff = aggregateStaff(receipts as any, users);
  const total = staff.reduce((s, r) => s + r.revenue, 0);
  check('total reconciles to 1840', total === 1840, total);
  const unattr = staff.find(s => s.userId === null);
  check('Unattributed row exists', !!unattr && unattr.name === 'Unattributed');
  check('removed member labelled', !!staff.find(s => s.name === 'Removed member'));
  const ada = staff.find(s => s.userId === 'u1')!;
  check('Ada 2 sales', ada.sales === 2);
  check('Ada avg basket 750', ada.avgBasket === 750, ada.avgBasket);
  check('Ada discount rate 0.5', ada.discountRate === 0.5, ada.discountRate);
  check('Ada 1 overridden line', ada.overriddenLines === 1);
}

console.log('\n— margin leaks —');
{
  const products = [
    P({ id: 'p1', name: 'LossLeader', costPrice: 120 }),
    P({ id: 'p2', name: 'Fine', costPrice: 10 }),
    P({ id: 'p3', name: 'Unpriced' }),
  ];
  const receipts = [R({ id: 'r1', total: 300, discount: 50, items: [
    { productId: 'p1', name: 'LossLeader', quantity: 1, price: 100 },
    { productId: 'p2', name: 'Fine', quantity: 1, price: 100, priceOverridden: true, listPrice: 150 },
    { productId: 'p3', name: 'Unpriced', quantity: 1, price: 100 },
  ] })];
  const { items } = aggregateItems(receipts as any, products as any);
  const leaks = findMarginLeaks(items, receipts as any);
  check('one below-cost row', leaks.belowCost.length === 1 && leaks.belowCost[0].name === 'LossLeader');
  check('loss is 20', leaks.belowCost[0].loss === 20, leaks.belowCost[0].loss);
  check('uncosted item excluded, counted', leaks.uncostedItems === 1);
  check('override giveaway 50', leaks.totalOverrideGiveaway === 50, leaks.totalOverrideGiveaway);
  check('receipt discount reported once', leaks.discountTotal === 50 && leaks.discountedSales === 1);
}

console.log('\n— categories —');
{
  const products = [
    P({ id: 'p1', name: 'A', category: 'Drinks', costPrice: 50 }),
    P({ id: 'p2', name: 'B', category: 'Drinks', costPrice: 50 }),
    P({ id: 'p3', name: 'C', category: '' }),
  ];
  const receipts = [R({ id: 'r1', total: 300, items: [
    { productId: 'p1', name: 'A', quantity: 1, price: 100 },
    { productId: 'p2', name: 'B', quantity: 1, price: 100 },
    { productId: 'p3', name: 'C', quantity: 1, price: 100 },
  ] })];
  const { items } = aggregateItems(receipts as any, products as any);
  const cats = aggregateCategories(items);
  check('two categories', cats.length === 2, cats.map(c => c.category));
  const drinks = cats.find(c => c.category === 'Drinks')!;
  check('Drinks revenue 200', drinks.revenue === 200);
  check('Drinks profit 100', drinks.profit === 100, drinks.profit);
  check('blank category becomes Uncategorised', !!cats.find(c => c.category === 'Uncategorised'));
  const folded = foldTail(cats, 1);
  check('foldTail makes an Other row', folded.length === 2 && folded[1].category.startsWith('Other'), folded.map(c => c.category));
  check('folded Other claims no margin', folded[1].profit === null);
}

console.log('\n— period delta: no invented percentages —');
{
  check('null previous → unknown', periodDelta(100, null).direction === 'unknown');
  check('null previous → no pct', periodDelta(100, null).deltaPct === null);
  const fromZero = periodDelta(100, 0);
  check('zero previous → new', fromZero.direction === 'new');
  check('zero previous → pct null (not Infinity)', fromZero.deltaPct === null, fromZero.deltaPct);
  const up = periodDelta(150, 100);
  check('+50%', Math.round(up.deltaPct!) === 50 && up.direction === 'up');
  const down = periodDelta(50, 100);
  check('-50%', Math.round(down.deltaPct!) === -50 && down.direction === 'down');
  check('tiny move reads flat', periodDelta(100.2, 100).direction === 'flat');
  check('0 to 0 is flat, not new', periodDelta(0, 0).direction === 'flat');
}

console.log('\n— previousWindow —');
{
  const { from, to } = previousWindow(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-31T00:00:00Z'));
  check('prev ends just before from', to.getTime() === new Date('2026-08-01T00:00:00Z').getTime() - 1);
  check('prev spans the same length', to.getTime() - from.getTime() === new Date('2026-08-31T00:00:00Z').getTime() - new Date('2026-08-01T00:00:00Z').getTime(), { from: from.toISOString(), to: to.toISOString() });
}

console.log('\n— summarisePeriod —');
{
  const products = [P({ id: 'p1', name: 'A', costPrice: 40 })];
  const receipts = [
    R({ id: 'r1', total: 100, customer: { id: 'c1', name: 'X', email: '' }, items: [{ productId: 'p1', name: 'A', quantity: 1, price: 100 }] }),
    R({ id: 'r2', total: 100, customer: { id: 'c1', name: 'X', email: '' }, items: [{ productId: 'p1', name: 'A', quantity: 1, price: 100 }] }),
    R({ id: 'r3', total: 100, items: [{ productId: 'p1', name: 'A', quantity: 1, price: 100 }] }),
  ];
  const s = summarisePeriod(receipts as any, products as any);
  check('revenue 300', s.revenue === 300);
  check('sales 3', s.sales === 3);
  check('distinct buyers 1 (anonymous not counted)', s.buyers === 1, s.buyers);
  check('profit 180', s.profit === 180, s.profit);
  const none = summarisePeriod([R({ id: 'r', total: 10, items: [{ productId: 'zz', name: 'z', quantity: 1, price: 10 }] })] as any, [] as any);
  check('no cost anywhere → profit null', none.profit === null, none.profit);
}

console.log('\n— empty and malformed input must not throw —');
{
  const e = aggregateItems([], []);
  check('empty items', e.items.length === 0 && e.lineRevenueTotal === 0);
  check('null receipts', aggregateItems(null as any, null as any).items.length === 0);
  const junk = aggregateItems([R({ id: 'r1', total: NaN, items: [{ productId: '', name: '', quantity: 'x' as any, price: undefined as any }] })] as any, []);
  check('junk line does not NaN the revenue', junk.lineRevenueTotal === 0, junk.lineRevenueTotal);
  check('staff on empty', aggregateStaff([], []).length === 0);
}

console.log(failures === 0 ? '\nALL PASS\n' : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
