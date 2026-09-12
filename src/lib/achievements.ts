/**
 * The achievement ladders behind /achievements.
 *
 * Pure, and it never reads the clock at all — stronger than the "`now` is an input"
 * rule `src/lib/forensics.ts` and `src/lib/business-rating.ts` are held to, and for
 * the same reason: "when did I cross ₦1 million" cannot be answered by a function
 * that consults the current time, and it cannot be tested either. Every date this
 * module returns came off a receipt.
 *
 * ── Nothing here invents a date ────────────────────────────────────────────────
 *
 * The page this replaces stamped product and customer milestones with
 * `new Date()` plus `milestone.value / 10` milliseconds, purely so the timeline
 * would sort. That put a fabricated "achieved on" date on a printable certificate.
 * `products.length >= 100` has no event behind it, so there is no date to show and
 * this module returns `earnedAt: null`.
 *
 * Sales crossings *do* have an event — the receipt that took the total over the
 * line — and {@link salesCrossingDates} finds it exactly, by walking the held
 * receipts forward from the revenue that pre-dates them:
 *
 *     base = lifetimeRevenue − (sum of held receipts)
 *
 * A threshold already passed before the window opened never satisfies
 * `before < value`, so it silently gets no date rather than being pinned to the
 * oldest receipt the cache happens to hold. That is the whole trick, and it means a
 * small shop (every receipt held, `base === 0`) gets an exact date for every rung
 * while a large one gets exact dates for its recent rungs and honest silence for the
 * rest.
 *
 * ── The sales figure is lifetime, not this year ────────────────────────────────
 *
 * The old page summed the receipts it held and filtered them to the current year.
 * The receipt listener is capped at 200 (`pos-context.tsx`), so for any busy shop
 * that "year total" was a fraction of the year — while the notification announcing
 * the same milestone (`src/lib/notification-rules.ts`) used lifetime revenue from
 * the `stats/overall` counter. A shop was told it had crossed ₦1 million and then
 * found no badge for it. One figure, one ladder: `lifetimeRevenue` is the authority
 * and the held receipts are used only to date a crossing, never to total.
 *
 * `revenueIsFloor` marks the case where the counter was missing and the capped
 * receipt sum had to stand in, so a caller never states a floor as a total.
 *
 * ── A null count is not zero ───────────────────────────────────────────────────
 *
 * `productCount: null` means the caller has no catalogue to hand; `0` asserts the
 * catalogue is empty. A null ladder reports `current: null`, is excluded from the
 * earned/total tally and can never be "0% of the way to 100 products" — the same
 * distinction `customers: null` carries in the rating scorer.
 */

import {
  CUSTOMER_MILESTONES,
  PRODUCT_MILESTONES,
  SALES_MILESTONES,
  type Milestone,
} from '@/lib/business-milestones';

export type AchievementKind = 'sales' | 'products' | 'customers';

/** A receipt reduced to the two fields a ladder needs. */
export interface AchievementReceipt {
  total: number;
  at: Date;
}

export interface AchievementInput {
  /**
   * Lifetime revenue from the `stats/overall` counter — the only total that is
   * authoritative on a device whose receipt cache is capped. Null falls back to the
   * held receipts and sets `revenueIsFloor`.
   */
  lifetimeRevenue: number | null;
  /** Held receipts, used to date crossings. Null or empty simply means no dates. */
  receipts: AchievementReceipt[] | null;
  /** Null when the caller has no catalogue to hand. Not the same as 0. */
  productCount: number | null;
  /** Null when the caller has no customer list to hand. Not the same as 0. */
  customerCount: number | null;
}

export interface Achievement {
  /** Stable across devices and reloads: no year, no date, no index. */
  id: string;
  kind: AchievementKind;
  /** The figure that earns this rung. */
  value: number;
  /** Verbatim from the shared table — naira, and deliberately not localised. */
  label: string;
  image: string;
  earned: boolean;
  /** The shop's figure on this ladder. Null when the caller supplied none. */
  current: number | null;
  /** 0..1 toward this rung, clamped. 1 when earned, 0 when `current` is null. */
  progress: number;
  /** How much more is needed. 0 when earned or unmeasured. */
  remaining: number;
  /**
   * When it was crossed, and only when a real event says so. Null for every
   * product and customer rung, and for a sales rung crossed before the held
   * receipts begin.
   */
  earnedAt: Date | null;
}

export interface AchievementLadder {
  kind: AchievementKind;
  title: string;
  /** Plural noun for the figure, e.g. "in sales", "products", "customers". */
  unit: string;
  /** True when the figure is money and should be formatted as such. */
  isMoney: boolean;
  /** Null when unmeasured — never coerced to 0. */
  current: number | null;
  rungs: Achievement[];
  earnedCount: number;
  /** The next rung up, or null when the ladder is topped out or unmeasured. */
  next: Achievement | null;
}

export interface AchievementSet {
  ladders: AchievementLadder[];
  /** Earned rungs across measured ladders only. */
  earnedCount: number;
  /** Rungs on measured ladders only, so the ratio never counts what it can't see. */
  totalCount: number;
  /** The unearned rung closest to being earned, across every measured ladder. */
  focus: Achievement | null;
  /** Earned rungs that carry a real date, newest first. */
  dated: Achievement[];
  /** True when `lifetimeRevenue` was missing and the capped receipt sum stood in. */
  revenueIsFloor: boolean;
}

const TABLES: { kind: AchievementKind; title: string; unit: string; isMoney: boolean; table: Milestone[] }[] = [
  { kind: 'sales', title: 'Sales', unit: 'in sales', isMoney: true, table: SALES_MILESTONES },
  { kind: 'products', title: 'Catalogue', unit: 'products', isMoney: false, table: PRODUCT_MILESTONES },
  { kind: 'customers', title: 'Customers', unit: 'customers', isMoney: false, table: CUSTOMER_MILESTONES },
];

export function achievementId(kind: AchievementKind, value: number): string {
  return `${kind}-${value}`;
}

/**
 * The receipt that took the running total over each sales threshold.
 *
 * Exported for the harness. See the module header for why `base` is what makes this
 * honest rather than a guess.
 */
export function salesCrossingDates(
  lifetimeRevenue: number,
  receipts: AchievementReceipt[],
): Map<number, Date> {
  const out = new Map<number, Date>();
  if (!receipts.length) return out;

  const ordered = [...receipts].sort((a, b) => a.at.getTime() - b.at.getTime());
  const held = ordered.reduce((sum, r) => sum + r.total, 0);

  // Clamped at zero: the lifetime counter can lag a sale that is already in the
  // cache, and a negative base would date a crossing to a receipt that did not
  // cross it — it would move every date one rung too early.
  let running = Math.max(0, lifetimeRevenue - held);

  for (const receipt of ordered) {
    const before = running;
    running += receipt.total;
    for (const milestone of SALES_MILESTONES) {
      if (before < milestone.value && running >= milestone.value) {
        out.set(milestone.value, receipt.at);
      }
    }
  }
  return out;
}

export function computeAchievements(input: AchievementInput): AchievementSet {
  const receipts = (input.receipts || []).filter(
    (r) => Number.isFinite(r.total) && r.at instanceof Date && r.at.getTime() > 0,
  );

  // `safeToDate` returns the epoch for a missing timestamp, which is why the filter
  // above drops `getTime() === 0` — a receipt with no date would otherwise pin a
  // crossing to 1970 and sort to the bottom of every list forever.
  const receiptSum = receipts.reduce((sum, r) => sum + r.total, 0);
  const revenueIsFloor = input.lifetimeRevenue === null;
  const revenue = revenueIsFloor ? receiptSum : Math.max(0, input.lifetimeRevenue as number);

  const dates = salesCrossingDates(revenue, receipts);

  const figures: Record<AchievementKind, number | null> = {
    sales: revenue,
    products: input.productCount,
    customers: input.customerCount,
  };

  const ladders: AchievementLadder[] = TABLES.map(({ kind, title, unit, isMoney, table }) => {
    const current = figures[kind];
    const rungs: Achievement[] = table
      .slice()
      .sort((a, b) => a.value - b.value)
      .map((milestone) => {
        const earned = current !== null && current >= milestone.value;
        return {
          id: achievementId(kind, milestone.value),
          kind,
          value: milestone.value,
          label: milestone.label,
          image: milestone.image,
          earned,
          current,
          progress: current === null ? 0 : Math.min(1, Math.max(0, current / milestone.value)),
          remaining: current === null || earned ? 0 : milestone.value - current,
          earnedAt: earned && kind === 'sales' ? dates.get(milestone.value) ?? null : null,
        };
      });

    return {
      kind,
      title,
      unit,
      isMoney,
      current,
      rungs,
      earnedCount: rungs.filter((r) => r.earned).length,
      next: current === null ? null : rungs.find((r) => !r.earned) ?? null,
    };
  });

  const measured = ladders.filter((l) => l.current !== null);

  // The nearest rung, not the biggest prize: an owner two customers short of a badge
  // is far more likely to act on that than on a ₦95m gap to the next sales rung.
  const focus = measured
    .map((l) => l.next)
    .filter((r): r is Achievement => r !== null)
    .sort((a, b) => b.progress - a.progress)[0] ?? null;

  const dated = ladders
    .flatMap((l) => l.rungs)
    .filter((r) => r.earned && r.earnedAt !== null)
    .sort((a, b) => (b.earnedAt as Date).getTime() - (a.earnedAt as Date).getTime());

  return {
    ladders,
    earnedCount: measured.reduce((sum, l) => sum + l.earnedCount, 0),
    totalCount: measured.reduce((sum, l) => sum + l.rungs.length, 0),
    focus,
    dated,
    revenueIsFloor,
  };
}

/**
 * A milestone worth interrupting someone for.
 *
 * One per ladder, and always the highest newly-earned rung on it — the reasoning in
 * {@link import('@/lib/business-milestones').highestMilestoneReached} applies just as
 * hard to a modal as to a notification: a shop that jumps from nothing to ₦1m in one
 * busy day should be congratulated on ₦1m, not walked through ₦100k, ₦500k and ₦1m
 * in three cards.
 *
 * `ids` carries the whole batch, not just the rung being shown, and the caller must
 * retire all of them together. Retiring only the top one leaves ₦500k unseen, and
 * the next load would then celebrate it — announcing a smaller milestone *after* a
 * bigger one, which reads as a bug.
 */
export interface AchievementUnlock {
  /** The rung to celebrate. */
  achievement: Achievement;
  /** Every newly-earned id on this ladder, including the one above. */
  ids: string[];
  /** How many quieter rungs came with it. `ids.length - 1`. */
  alsoCrossed: number;
  /** The rung after this one, for the "what's next" line. Null when topped out. */
  next: Achievement | null;
}

export function newlyUnlocked(
  set: AchievementSet,
  seen: Iterable<string>,
): AchievementUnlock[] {
  const seenSet = seen instanceof Set ? seen : new Set(seen);
  const out: AchievementUnlock[] = [];

  for (const ladder of set.ladders) {
    const fresh = ladder.rungs.filter((r) => r.earned && !seenSet.has(r.id));
    if (fresh.length === 0) continue;
    const top = fresh.reduce((best, r) => (r.value > best.value ? r : best), fresh[0]);
    out.push({
      achievement: top,
      ids: fresh.map((r) => r.id),
      alsoCrossed: fresh.length - 1,
      next: ladder.rungs.find((r) => r.value > top.value) ?? null,
    });
  }

  // Biggest ladder first when several land at once, so the ₦1m card is the one seen
  // before attention runs out.
  const order: AchievementKind[] = ['sales', 'customers', 'products'];
  return out.sort((a, b) => order.indexOf(a.achievement.kind) - order.indexOf(b.achievement.kind));
}

/** Every earned id, for the silent first-run seed. See `use-achievements.ts`. */
export function allEarnedIds(set: AchievementSet): string[] {
  return set.ladders.flatMap((l) => l.rungs.filter((r) => r.earned).map((r) => r.id));
}
