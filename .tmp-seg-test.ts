/**
 * Throwaway harness for src/lib/customer-segments.ts. Run: npx tsx .tmp-seg-test.ts
 * .ts not .mts — see CLAUDE.md.
 */
import {
  computeCustomerSegments,
  AT_RISK_AFTER_DAYS,
  LAPSED_AFTER_DAYS,
  VIP_MIN_ORDERS,
} from './src/lib/customer-segments';

let failures = 0;
function check(label: string, cond: boolean, extra?: any) {
  if (!cond) {
    failures++;
    console.log(`  FAIL  ${label}`, extra !== undefined ? JSON.stringify(extra) : '');
  } else {
    console.log(`  ok    ${label}`);
  }
}

const NOW = new Date('2026-08-18T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const C = (id: string, o: any = {}) => ({ id, businessId: 'b', name: `C-${id}`, email: `${id}@x.com`, ...o });
const R = (o: any) => ({ businessId: 'b', subtotal: 0, tax: 0, discount: 0, total: 0, paymentMethod: 'Cash', items: [], ...o });
const sale = (id: string, cid: string, total: number, when: Date, status?: string) =>
  R({ id, total, createdAt: when, status, customer: { id: cid, name: cid, email: '' } });

console.log('\n— pure: same input, same output, and now is an input —');
{
  const customers = [C('a')];
  const receipts = [sale('r1', 'a', 100, daysAgo(1))];
  const one = computeCustomerSegments({ customers, receipts, now: NOW });
  const two = computeCustomerSegments({ customers, receipts, now: NOW });
  check('deterministic', JSON.stringify([...one.byCustomerId]) === JSON.stringify([...two.byCustomerId]));
  const later = computeCustomerSegments({ customers, receipts, now: new Date(NOW.getTime() + 40 * 86_400_000) });
  check('moving `now` alone flips to at-risk', later.byCustomerId.get('a')!.segments.includes('at-risk'), later.byCustomerId.get('a')!.segments);
}

console.log('\n— recency boundaries —');
{
  const customers = [C('fresh'), C('risky'), C('gone')];
  const receipts = [
    sale('r1', 'fresh', 100, daysAgo(2)),
    sale('r2', 'risky', 100, daysAgo(AT_RISK_AFTER_DAYS + 1)),
    sale('r3', 'gone', 100, daysAgo(LAPSED_AFTER_DAYS + 5)),
  ];
  const { byCustomerId } = computeCustomerSegments({ customers, receipts, now: NOW });
  check('fresh is neither at-risk nor lapsed', !byCustomerId.get('fresh')!.segments.some(s => s === 'at-risk' || s === 'lapsed'));
  check('risky is at-risk', byCustomerId.get('risky')!.segments.includes('at-risk'));
  check('risky is NOT also lapsed', !byCustomerId.get('risky')!.segments.includes('lapsed'));
  check('gone is lapsed', byCustomerId.get('gone')!.segments.includes('lapsed'));
  check('gone is NOT also at-risk (mutually exclusive)', !byCustomerId.get('gone')!.segments.includes('at-risk'));
  check('daysSince computed', byCustomerId.get('risky')!.daysSinceLastPurchase === AT_RISK_AFTER_DAYS + 1, byCustomerId.get('risky')!.daysSinceLastPurchase);
}

console.log('\n— never-seen is counted, never priced —');
{
  const customers = [C('buyer'), C('ghost1'), C('ghost2')];
  const receipts = [sale('r1', 'buyer', 5000, daysAgo(LAPSED_AFTER_DAYS + 1))];
  const res = computeCustomerSegments({ customers, receipts, now: NOW });
  check('two never-seen counted', res.summary.counts['never-seen'] === 2, res.summary.counts);
  check('ghost has no money', res.byCustomerId.get('ghost1')!.ownBasket === 0);
  // Only the lapsed observed buyer contributes; the two ghosts must not.
  check('winBackValue is the lapsed buyer only (5000)', res.summary.winBackValue === 5000, res.summary.winBackValue);
}

console.log('\n— each buyer at their OWN basket, never the shop average —');
{
  const customers = [C('small'), C('big')];
  const receipts = [
    sale('r1', 'small', 2000, daysAgo(LAPSED_AFTER_DAYS + 1)),
    sale('r2', 'big', 100000, daysAgo(LAPSED_AFTER_DAYS + 1)),
    sale('r3', 'big', 100000, daysAgo(LAPSED_AFTER_DAYS + 2)),
  ];
  const res = computeCustomerSegments({ customers, receipts, now: NOW });
  check('small buyer worth 2000, not the 67k shop average', res.byCustomerId.get('small')!.ownBasket === 2000, res.byCustomerId.get('small')!.ownBasket);
  check('big buyer worth their own 100000', res.byCustomerId.get('big')!.ownBasket === 100000);
  check('winBack = 2000 + 100000', res.summary.winBackValue === 102000, res.summary.winBackValue);
}

console.log('\n— the listener-cap trap: absence must not read as fact —');
{
  // 200 receipts (the cap) all inside 3 days: cannot conclude anyone lapsed.
  const customers = Array.from({ length: 500 }, (_, i) => C(`c${i}`));
  const receipts = Array.from({ length: 200 }, (_, i) => sale(`r${i}`, `c${i % 50}`, 100, daysAgo(i % 3)));
  const res = computeCustomerSegments({ customers, receipts, now: NOW });
  check('reliable is false at the cap with a short window', res.summary.reliable === false, { covered: res.summary.coveredDays, n: res.summary.receiptCount });
  check('no four-figure winBack invented', res.summary.winBackValue === 0, res.summary.winBackValue);
  check('never-seen still counted (450)', res.summary.counts['never-seen'] === 450, res.summary.counts['never-seen']);
}
{
  // Few receipts spread over a long window: absence is meaningful.
  const customers = [C('a')];
  const receipts = [sale('r1', 'a', 100, daysAgo(70)), sale('r2', 'a', 100, daysAgo(1))];
  const res = computeCustomerSegments({ customers, receipts, now: NOW });
  check('reliable is true below the cap', res.summary.reliable === true);
}

console.log('\n— owing —');
{
  const customers = [C('debtor'), C('clean')];
  const receipts = [
    sale('r1', 'debtor', 5000, daysAgo(3), 'unpaid'),
    sale('r2', 'debtor', 1000, daysAgo(2), 'pending'),
    sale('r3', 'debtor', 2000, daysAgo(1), 'paid'),
    sale('r4', 'clean', 9000, daysAgo(1), 'paid'),
  ];
  const res = computeCustomerSegments({ customers, receipts, now: NOW });
  const d = res.byCustomerId.get('debtor')!;
  check('unpaid + pending counted, paid excluded', d.outstanding === 6000, d.outstanding);
  check('debtor is owing', d.segments.includes('owing'));
  check('owing outranks everything for the badge', d.primarySegment === 'owing', d.primarySegment);
  check('clean customer not owing', res.byCustomerId.get('clean')!.outstanding === 0);
  check('legacy receipt with no status reads as paid', computeCustomerSegments({
    customers: [C('x')], receipts: [sale('r', 'x', 100, daysAgo(1))], now: NOW,
  }).byCustomerId.get('x')!.outstanding === 0);
}

console.log('\n— VIP floor is relative, not a hardcoded money threshold —');
{
  // Everyone has VIP_MIN_ORDERS+ orders; only the top spenders clear the floor.
  const customers = Array.from({ length: 10 }, (_, i) => C(`c${i}`));
  const receipts: any[] = [];
  customers.forEach((c, i) => {
    for (let k = 0; k < VIP_MIN_ORDERS; k++) {
      receipts.push(sale(`r${i}-${k}`, c.id, (i + 1) * 100, daysAgo(1)));
    }
  });
  const res = computeCustomerSegments({ customers, receipts, now: NOW });
  const vips = customers.filter(c => res.byCustomerId.get(c.id)!.segments.includes('vip'));
  check('some but not all are VIP', vips.length > 0 && vips.length < customers.length, vips.map(v => v.id));
  check('the top spender is VIP', res.byCustomerId.get('c9')!.segments.includes('vip'));
  check('the bottom spender is not', !res.byCustomerId.get('c0')!.segments.includes('vip'));
  // A tiny-currency shop must still produce VIPs — the old `> 100000` never would.
  const tiny = customers.map(c => c);
  const tinyReceipts = receipts.map(r => ({ ...r, total: r.total / 1000 }));
  const tinyRes = computeCustomerSegments({ customers: tiny, receipts: tinyReceipts, now: NOW });
  check('VIP still exists when all sums are tiny', tiny.some(c => tinyRes.byCustomerId.get(c.id)!.segments.includes('vip')));
}

console.log('\n— loyal vs vip are exclusive; new —');
{
  const customers = [C('loyal'), C('newbie')];
  const receipts = [
    sale('r1', 'loyal', 10, daysAgo(5)),
    sale('r2', 'loyal', 10, daysAgo(4)),
    sale('r3', 'loyal', 10, daysAgo(3)),
    sale('r4', 'newbie', 10, daysAgo(2)),
  ];
  const res = computeCustomerSegments({ customers, receipts, now: NOW });
  const l = res.byCustomerId.get('loyal')!;
  check('3 orders => loyal', l.segments.includes('loyal'), l.segments);
  check('not both loyal and vip', !(l.segments.includes('loyal') && l.segments.includes('vip')));
  check('first purchase 2 days ago => new', res.byCustomerId.get('newbie')!.segments.includes('new'), res.byCustomerId.get('newbie')!.segments);
}

console.log('\n— anonymous sales are revenue but not customers —');
{
  const customers = [C('a')];
  const receipts = [R({ id: 'r1', total: 500, createdAt: daysAgo(1) })]; // no customer
  const res = computeCustomerSegments({ customers, receipts, now: NOW });
  check('anonymous sale does not create a segment row', res.byCustomerId.size === 1);
  check('a has no orders', res.byCustomerId.get('a')!.orders === 0);
}

console.log('\n— empty / malformed —');
{
  check('null everything', computeCustomerSegments({ customers: null, receipts: null, now: NOW }).byCustomerId.size === 0);
  check('empty is reliable (not at the cap)', computeCustomerSegments({ customers: [], receipts: [], now: NOW }).summary.reliable === true);
  const junk = computeCustomerSegments({
    customers: [C('a'), { id: '', businessId: 'b', name: '', email: '' } as any],
    receipts: [R({ id: 'r', total: 'abc' as any, createdAt: null, customer: { id: 'a', name: '', email: '' } })],
    now: NOW,
  });
  check('customer with no id skipped', junk.byCustomerId.size === 1);
  check('unparseable total does not NaN', junk.byCustomerId.get('a')!.observedSpend === 0, junk.byCustomerId.get('a')!.observedSpend);
  check('null date gives null daysSince', junk.byCustomerId.get('a')!.daysSinceLastPurchase === null);
}

console.log(failures === 0 ? '\nALL PASS\n' : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
