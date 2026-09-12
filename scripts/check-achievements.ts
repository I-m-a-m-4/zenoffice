/**
 * Checks for src/lib/achievements.ts — `npm run test:achievements` (48 checks).
 *
 * Kept rather than thrown away because every line the module produces ends up on a
 * certificate an owner downloads and posts: a wrong crossing date or a rung earned
 * off the capped receipt sum is a claim about their business that they will notice
 * before we do.
 *
 * Must be `.ts`, never `.mts`: there is no `"type": "module"` in this repo, so
 * `src/**` compiles to CJS and a true-ESM importer fails named-import interop.
 */

import {
  achievementId,
  allEarnedIds,
  computeAchievements,
  newlyUnlocked,
  salesCrossingDates,
  type AchievementReceipt,
} from '../src/lib/achievements';
import { SALES_MILESTONES } from '../src/lib/business-milestones';

let pass = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
  } else {
    failures.push(`${name}${detail === undefined ? '' : ` — got ${JSON.stringify(detail)}`}`);
  }
}

const day = (n: number) => new Date(2026, 0, n, 12, 0, 0);
const r = (total: number, n: number): AchievementReceipt => ({ total, at: day(n) });

/* ── 1. salesCrossingDates: base = lifetime − held ─────────────────────────── */
{
  // Lifetime ₦1.2m, held receipts total ₦300k → base ₦900k. Only the ₦1m rung is
  // crossed inside the window; ₦100k and ₦500k pre-date it and must get no date.
  const receipts = [r(60_000, 1), r(150_000, 2), r(90_000, 3)];
  const dates = salesCrossingDates(1_200_000, receipts);
  check('1a: ₦1m dated', dates.has(1_000_000));
  // base 900k + 60k = 960k on day 1 (no crossing), + 150k = 1.11m on day 2.
  check('1b: ₦1m dated to the crossing receipt (day 2)', dates.get(1_000_000)?.getDate() === 2, dates.get(1_000_000)?.toISOString());
  check('1c: ₦100k undated (pre-dates the window)', !dates.has(100_000));
  check('1d: ₦500k undated (pre-dates the window)', !dates.has(500_000));
  check('1e: ₦5m undated (not reached)', !dates.has(5_000_000));
}

/* ── 2. Small shop: every receipt held, base 0, every rung dated ───────────── */
{
  const receipts = [r(120_000, 1), r(400_000, 5), r(500_000, 9)];
  const dates = salesCrossingDates(1_020_000, receipts);
  check('2a: ₦100k dated to day 1', dates.get(100_000)?.getDate() === 1);
  check('2b: ₦500k dated to day 5', dates.get(500_000)?.getDate() === 5);
  check('2c: ₦1m dated to day 9', dates.get(1_000_000)?.getDate() === 9);
}

/* ── 3. Negative base is clamped, not allowed to shift dates early ─────────── */
{
  // Counter lags: it reports ₦100k while the cache already holds ₦600k.
  const receipts = [r(300_000, 1), r(300_000, 2)];
  const dates = salesCrossingDates(100_000, receipts);
  check('3a: base clamped to 0 — ₦100k dated to day 1', dates.get(100_000)?.getDate() === 1);
  check('3b: ₦500k dated to day 2, not day 1', dates.get(500_000)?.getDate() === 2, dates.get(500_000)?.getDate());
}

/* ── 4. Epoch receipts are dropped, never dated to 1970 ────────────────────── */
{
  const set = computeAchievements({
    lifetimeRevenue: 600_000,
    receipts: [{ total: 600_000, at: new Date(0) }],
    productCount: null,
    customerCount: null,
  });
  const dated = set.dated;
  check('4a: no rung dated from an epoch receipt', dated.length === 0, dated.map((d) => d.id));
  check('4b: ₦500k still earned from the lifetime figure', set.ladders[0].earnedCount === 2, set.ladders[0].earnedCount);
}

/* ── 5. Lifetime figure is the authority, held receipts never total ────────── */
{
  const set = computeAchievements({
    lifetimeRevenue: 30_000_000,
    receipts: [r(50_000, 1)],
    productCount: null,
    customerCount: null,
  });
  const sales = set.ladders.find((l) => l.kind === 'sales')!;
  check('5a: current is the lifetime figure', sales.current === 30_000_000, sales.current);
  check('5b: six sales rungs earned at ₦30m', sales.earnedCount === 6, sales.earnedCount);
  check('5c: next rung is ₦50m', sales.next?.value === 50_000_000, sales.next?.value);
  check('5d: revenueIsFloor false when the counter is present', set.revenueIsFloor === false);
}

/* ── 6. Null counter → floor, flagged ─────────────────────────────────────── */
{
  const set = computeAchievements({
    lifetimeRevenue: null,
    receipts: [r(200_000, 1), r(400_000, 2)],
    productCount: null,
    customerCount: null,
  });
  check('6a: revenueIsFloor true', set.revenueIsFloor === true);
  check('6b: falls back to the receipt sum', set.ladders[0].current === 600_000, set.ladders[0].current);
}

/* ── 7. A null count is not zero ──────────────────────────────────────────── */
{
  const set = computeAchievements({
    lifetimeRevenue: 1_000_000,
    receipts: null,
    productCount: null,
    customerCount: 60,
  });
  const products = set.ladders.find((l) => l.kind === 'products')!;
  const customers = set.ladders.find((l) => l.kind === 'customers')!;
  check('7a: null product count reports current null', products.current === null);
  check('7b: no product rung earned', products.earnedCount === 0);
  check('7c: no product rung claims progress', products.rungs.every((x) => x.progress === 0));
  check('7d: null ladder has no next rung', products.next === null);
  check('7e: null ladder is excluded from the tally', set.totalCount === SALES_MILESTONES.length + customers.rungs.length, set.totalCount);
  check('7f: focus never comes from a null ladder', set.focus?.kind !== 'products', set.focus?.id);
  check('7g: zero is measured, unlike null', computeAchievements({ lifetimeRevenue: 0, receipts: null, productCount: 0, customerCount: 0 }).ladders.every((l) => l.current === 0));
}

/* ── 8. focus is the nearest rung, not the biggest prize ──────────────────── */
{
  const set = computeAchievements({
    lifetimeRevenue: 5_000_000, // 50% to ₦10m
    receipts: null,
    productCount: 10, // 10% to 100
    customerCount: 48, // 96% to 50
  });
  check('8a: focus is the 50-customer rung', set.focus?.id === achievementId('customers', 50), set.focus?.id);
  check('8b: focus carries its real gap', set.focus?.remaining === 2, set.focus?.remaining);
  check('8c: earned rungs report remaining 0', set.ladders[0].rungs[0].remaining === 0);
}

/* ── 9. newlyUnlocked: top rung per ladder, whole batch retired ───────────── */
{
  const set = computeAchievements({
    lifetimeRevenue: 1_000_000,
    receipts: [r(1_000_000, 4)],
    productCount: 120,
    customerCount: 5,
  });
  const unlocks = newlyUnlocked(set, []);
  check('9a: one unlock per earned ladder', unlocks.length === 2, unlocks.map((u) => u.achievement.id));
  check('9b: sales first', unlocks[0].achievement.kind === 'sales');
  check('9c: the top sales rung, not the lowest', unlocks[0].achievement.value === 1_000_000, unlocks[0].achievement.value);
  check('9d: the quieter rungs come with it', unlocks[0].ids.length === 3, unlocks[0].ids);
  check('9e: alsoCrossed is ids.length - 1', unlocks[0].alsoCrossed === 2, unlocks[0].alsoCrossed);
  check('9f: next is the rung above', unlocks[0].next?.value === 5_000_000, unlocks[0].next?.value);
  check('9g: the crossing date rides along', unlocks[0].achievement.earnedAt?.getDate() === 4);

  // Retiring the batch silences the ladder — no ₦500k card after the ₦1m one.
  const after = newlyUnlocked(set, unlocks.flatMap((u) => u.ids));
  check('9h: nothing left after acknowledging', after.length === 0, after.map((u) => u.achievement.id));

  // Retiring only the top rung is the bug the batch exists to prevent.
  const topOnly = newlyUnlocked(set, [unlocks[0].achievement.id]);
  check('9i: top-only retirement would re-announce ₦500k', topOnly[0]?.achievement.value === 500_000, topOnly[0]?.achievement.value);
}

/* ── 10. Topped-out ladder has no next ────────────────────────────────────── */
{
  const set = computeAchievements({ lifetimeRevenue: 200_000_000, receipts: null, productCount: 2_000, customerCount: 900 });
  const sales = set.ladders.find((l) => l.kind === 'sales')!;
  check('10a: no next rung at the top', sales.next === null);
  check('10b: unlock reports no next either', newlyUnlocked(set, [])[0].next === null);
  check('10c: focus null when every ladder is topped out', set.focus === null, set.focus?.id);
  check('10d: earnedCount equals totalCount', set.earnedCount === set.totalCount, [set.earnedCount, set.totalCount]);
}

/* ── 11. allEarnedIds seeds exactly what is earned ────────────────────────── */
{
  const set = computeAchievements({ lifetimeRevenue: 600_000, receipts: null, productCount: null, customerCount: 55 });
  const ids = allEarnedIds(set);
  check('11a: two sales + one customer rung', ids.length === 3, ids);
  check('11b: ids are stable and kind-prefixed', ids.includes('sales-500000') && ids.includes('customers-50'), ids);
  check('11c: seeding silences every card', newlyUnlocked(set, ids).length === 0);
}

/* ── 12. dated is newest first and only holds real dates ─────────────────── */
{
  const set = computeAchievements({
    lifetimeRevenue: 1_100_000,
    receipts: [r(150_000, 1), r(450_000, 6), r(500_000, 11)],
    productCount: 500,
    customerCount: 500,
  });
  check('12a: three dated rungs', set.dated.length === 3, set.dated.map((d) => d.id));
  check('12b: newest first', set.dated[0].value === 1_000_000, set.dated[0].value);
  check('12c: no product or customer rung is dated', set.dated.every((d) => d.kind === 'sales'));
  check('12d: count rungs carry a figure instead', set.ladders[1].rungs[0].earnedAt === null && set.ladders[1].rungs[0].current === 500);
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
