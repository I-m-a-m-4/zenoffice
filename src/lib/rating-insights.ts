/**
 * Insight of the day — the *why* behind the rating.
 *
 * The rating says a shop scores 61 and that ₦480,000 is on the table. It never
 * says why a shop like theirs leaves it there, and that is the part an owner
 * actually repeats to somebody else. This module supplies one insight a day:
 * a retail mechanism, the owner's own figure proving it applies to them, the
 * median shop's figure where there is one, and the move.
 *
 * ── The line this must not cross ───────────────────────────────────────────
 *
 * `src/lib/business-rating.ts` refuses to invent a number, and so does this. The
 * split is deliberate and worth stating because it is easy to blur:
 *
 * - **`principle` and `because` are claims about how retail works.** They are the
 *   same for every shop, written here in advance, and carry no figures.
 * - **`yours` is always the shop's own arithmetic**, taken from `RatingFacts` or
 *   an `Opportunity` that was summed from receipts.
 * - **`peer` is a real median** over real Zeneva shops, or it is absent.
 *
 * What must never appear is a statistic dressed as research — "83% of small
 * businesses fail because…". Nobody measured that here, so nothing may say it. A
 * principle asserts a mechanism the owner can check against their own number on
 * the same card; a fabricated percentage asks them to take it on faith. If a new
 * insight needs a number to be persuasive, that number has to come out of
 * `RatingFacts`.
 *
 * ── Why it changes daily, and why it is not random ─────────────────────────
 *
 * Candidates are ranked by severity and then by money at stake, and the day
 * chooses among the top `ROTATION` of them. So the insight is always one of the
 * shop's real problems, it is stable for a whole day (the same card at 9am and
 * 5pm — a card that reshuffles on every render is a slot machine, not advice),
 * and it moves often enough to be worth opening tomorrow.
 *
 * `now` is an input, as everywhere else in this feature: the day index is derived
 * from it, so a given shop on a given date always gets the same card and "why did
 * it change" has an answer.
 */

import type { BusinessRating, Opportunity, PillarKey, RatingFacts } from '@/lib/business-rating';
import type { RatingBenchmark } from '@/lib/rating-benchmark';

/** How many of the top-ranked insights the daily rotation draws from. */
const ROTATION = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type InsightSeverity = 'critical' | 'warning' | 'good';

export interface RatingInsight {
  id: string;
  /** Which meter this speaks to, for the accent. `cash` is money already leaving. */
  pillar: PillarKey | 'cash';
  severity: InsightSeverity;
  /** The retail mechanism. Carries no figures — the same sentence for every shop. */
  principle: string;
  /** Why that mechanism bites. One sentence, still no figures. */
  because: string;
  /** The shop's own number, which is what makes the principle land. */
  yours: { label: string; value: string };
  /**
   * The like-for-like comparison against the median shop, when a cohort exists.
   *
   * Carries **both** sides itself rather than pairing with `yours` above, because
   * those two are not the same quantity: `yours` is a business figure (a share of
   * sales, a margin, a count) and the only peer figure that exists is a pillar
   * score out of 100. Drawing "58%" beside "42/100" as two bars would compare a
   * share of sales against a score — the sort of number-shaped nonsense this
   * module's header exists to forbid. Both sides here are scores out of 100.
   */
  peer?: { label: string; mine: number; median: number; better: boolean };
  /** The next action, imperative. */
  move: string;
  href: string;
  /** Currency at stake. Absent when the insight is not about a sum of money. */
  money?: number;
  /** Rank tiebreaker — bigger sorts first within a severity. */
  weight: number;
}

const pct = (n: number) => `${Math.round(n)}%`;

/** Days since the epoch, in the viewer's own timezone. */
function dayNumber(now: Date): number {
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(local.getTime() / DAY_MS);
}

const SEVERITY_RANK: Record<InsightSeverity, number> = { critical: 0, warning: 1, good: 2 };

/**
 * Every insight the shop's figures currently support, best-first.
 *
 * Exported so the panel can say how many are waiting and the caller can test the
 * ranking without reaching through `insightOfTheDay`.
 */
export function candidateInsights(
  rating: BusinessRating,
  benchmark: RatingBenchmark | null,
): RatingInsight[] {
  const f: RatingFacts = rating.facts;
  const out: RatingInsight[] = [];
  if (!rating.ready) return out;

  const opportunity = (id: string): Opportunity | undefined =>
    rating.opportunities.find((o) => o.id === id);
  const medianOf = (key: PillarKey): number | null => benchmark?.medians?.[key] ?? null;
  const scoreOf = (key: PillarKey) => rating.pillars.find((p) => p.key === key);

  /** Peer clause for a pillar, present only when there is a cohort behind it. */
  const peerFor = (key: PillarKey): RatingInsight['peer'] => {
    const median = medianOf(key);
    const mine = scoreOf(key);
    if (median === null || !mine?.measured) return undefined;
    return { label: `${mine.label} score`, mine: mine.score, median, better: mine.score >= median };
  };

  const singleShare = f.sales > 0 ? f.singleItemSales / f.sales : 0;
  const attachRate = f.sales > 0 ? f.namedSales / f.sales : 0;

  // ── Basket ────────────────────────────────────────────────────────────────
  if (singleShare >= 0.35 && f.singleItemSales > 0) {
    const basket = opportunity('basket');
    out.push({
      id: 'basket-one-item',
      pillar: 'basket',
      severity: singleShare >= 0.6 ? 'critical' : 'warning',
      principle: 'Small shops rarely run out of customers. They run out of second items.',
      because:
        'Winning a new buyer costs money and time. Selling one more thing to the person already at your counter costs a sentence.',
      yours: { label: 'Sales that are a single item', value: pct(singleShare * 100) },
      peer: peerFor('basket'),
      move: `Offer one add-on on your next ${Math.min(10, f.singleItemSales)} sales`,
      href: '/sales/pos',
      money: basket?.money,
      weight: basket?.money ?? f.singleItemSales,
    });
  }

  // ── Margin: unknowable before it is thin ──────────────────────────────────
  if (f.revenue > 0 && f.costCoverage < 0.9) {
    const blind = opportunity('no-cost-price');
    out.push({
      id: 'margin-blind',
      pillar: 'margin',
      severity: f.costCoverage < 0.5 ? 'critical' : 'warning',
      principle: 'You cannot price what you have never costed.',
      because:
        'Without a cost price every markup is a guess, and guesses drift downward — nobody ever accidentally charges too much.',
      yours: { label: 'Sales with no cost behind them', value: pct((1 - f.costCoverage) * 100) },
      move: 'Add cost price to your best sellers first',
      href: '/inventory',
      money: blind?.money,
      weight: (blind?.money ?? 0) + 1_000_000, // outranks thin-margin advice: this blocks measuring it
    });
  } else if (f.marginPct > 0 && f.marginPct < 25) {
    out.push({
      id: 'margin-thin',
      pillar: 'margin',
      severity: f.marginPct < 15 ? 'critical' : 'warning',
      principle: 'Most small shops compete on price because it is the only lever they were shown.',
      because:
        'Margin multiplies everything else you do. Volume has to work far harder than a price rise to add the same profit.',
      yours: { label: 'Your gross margin', value: pct(f.marginPct) },
      peer: peerFor('margin'),
      move: 'Lift the price of your thinnest earners',
      href: '/inventory',
      weight: f.revenue * ((25 - f.marginPct) / 100),
    });
  }

  // ── Repeat ────────────────────────────────────────────────────────────────
  if (f.sales > 0 && attachRate < 0.6) {
    out.push({
      id: 'repeat-anonymous',
      pillar: 'repeat',
      severity: attachRate < 0.3 ? 'critical' : 'warning',
      principle: 'A sale with no name on it can never be sold to twice.',
      because:
        'Repeat buyers are the cheapest growth there is — but you can only reach the ones you wrote down.',
      yours: { label: 'Sales with a customer attached', value: pct(attachRate * 100) },
      peer: peerFor('repeat'),
      move: 'Ask for a name and number at the till',
      href: '/sales/pos',
      weight: f.revenue * (1 - attachRate) * 0.1,
    });
  }

  if (f.lapsedBuyers > 0) {
    const lapsed = opportunity('lapsed');
    out.push({
      id: 'repeat-lapsed',
      pillar: 'repeat',
      severity: 'warning',
      principle: 'The cheapest customer you will ever get is one who has already bought from you.',
      because:
        'They know the shop, they know the prices and they need no convincing. Most of them did not leave — they were simply never contacted again.',
      yours: {
        label: 'Buyers who have gone quiet',
        value: `${f.lapsedBuyers}`,
      },
      move: `Message the ${f.lapsedBuyers} who stopped coming`,
      href: '/customers',
      money: lapsed?.money,
      weight: lapsed?.money ?? f.lapsedBuyers,
    });
  }

  // ── Cash already walking out ──────────────────────────────────────────────
  const belowCost = opportunity('below-cost');
  if (belowCost) {
    out.push({
      id: 'cash-below-cost',
      pillar: 'cash',
      severity: 'critical',
      principle: 'The quickest way to lose money is to sell more of something that loses money.',
      because:
        'A line priced under its cost gets worse with every sale, and it usually looks like a best seller on the way down.',
      yours: { label: 'Lost on lines priced under cost', value: belowCost.label },
      move: 'Reprice these before you restock them',
      href: '/inventory',
      money: belowCost.money,
      weight: belowCost.money * 3, // already gone, and still going
    });
  }

  const overrides = opportunity('overrides');
  if (overrides) {
    out.push({
      id: 'cash-overrides',
      pillar: 'cash',
      severity: 'warning',
      principle: 'A till that lets anyone type a price will be typed down, never up.',
      because:
        'Each override is small enough to feel like good service and invisible enough to never be counted.',
      yours: { label: 'Typed under the shelf price', value: overrides.detail },
      move: 'Review who can override a price',
      href: '/audit-log',
      money: overrides.money,
      weight: overrides.money * 2,
    });
  }

  const discounts = opportunity('discounts');
  if (discounts) {
    out.push({
      id: 'cash-discounts',
      pillar: 'cash',
      severity: 'warning',
      principle: 'Discounts feel like marketing. They are margin, handed over at the counter.',
      because:
        'A discount is the only promotion that costs you the full amount and buys you nothing you can measure afterwards.',
      yours: { label: 'Revenue given away', value: discounts.detail },
      move: 'Set one discount ceiling and hold it',
      href: '/receipts',
      money: discounts.money,
      weight: discounts.money,
    });
  }

  const stockout = opportunity('stockout-margin');
  if (stockout) {
    out.push({
      id: 'cash-stockout',
      pillar: 'cash',
      severity: 'critical',
      principle: 'An empty shelf on your best earner charges you rent every day it stays empty.',
      because:
        'The demand does not wait for your delivery. It walks to whoever has it in stock, and it often stays there.',
      yours: { label: 'Your best earners out of stock', value: stockout.label },
      move: 'Restock these first, before anything else',
      href: '/inventory?sortBy=stock-asc',
      money: stockout.money,
      weight: stockout.money * 2,
    });
  }

  // ── Momentum ──────────────────────────────────────────────────────────────
  if (f.priorRevenue > 0 && f.growthPct < -5) {
    out.push({
      id: 'momentum-falling',
      pillar: 'momentum',
      severity: f.growthPct < -20 ? 'critical' : 'warning',
      principle: 'Takings fall long before anyone notices, because the till still rings every day.',
      because:
        'A slow decline never produces a bad day — only a run of slightly worse ones, which nobody remembers.',
      yours: {
        label: `Against the previous ${Math.round(f.coveredDays / 2)} days`,
        value: `${Math.round(f.growthPct)}%`,
      },
      peer: peerFor('momentum'),
      move: 'Check what your top sellers did differently',
      href: '/reports?tab=analytics',
      weight: f.recentRevenue * (Math.abs(f.growthPct) / 100),
    });
  }

  if (f.coveredDays >= 14 && f.activeDays / f.coveredDays < 0.5) {
    out.push({
      id: 'momentum-gaps',
      pillar: 'momentum',
      severity: 'warning',
      principle: 'A day with no sale recorded is a day you cannot learn anything from.',
      because:
        'Whether the shop was shut or the sale simply went in the wrong book, the result is the same: the pattern you would price against has a hole in it.',
      yours: {
        label: 'Days with a recorded sale',
        value: `${f.activeDays} of ${f.coveredDays}`,
      },
      move: 'Record every sale on the day it happens',
      href: '/sales/pos',
      weight: f.revenue * 0.05,
    });
  }

  // ── Ahead of the median ───────────────────────────────────────────────────
  // Praise is only earned against something. Without a cohort there is nothing to
  // be ahead of, so this insight simply does not exist — which is the same rule
  // the rest of the feature follows about invented comparisons.
  if (benchmark) {
    for (const pillar of rating.pillars) {
      const median = medianOf(pillar.key);
      if (median === null || !pillar.measured) continue;
      if (pillar.score >= median + 10) {
        out.push({
          id: `ahead-${pillar.key}`,
          pillar: pillar.key,
          severity: 'good',
          principle: 'The advantage you cannot name is the one you stop defending.',
          because:
            'Whatever you are already doing better than the shop next door is the cheapest thing you own. It is also the easiest to quietly let slip.',
          // The headline figure is the gap itself, not the score: the score is
          // already the left-hand bar of the pair below it, and a card that says
          // "68/100" twice is one number pretending to be two.
          yours: { label: `Points ahead on ${pillar.label.toLowerCase()}`, value: `+${pillar.score - median}` },
          peer: { label: `${pillar.label} score`, mine: pillar.score, median, better: true },
          move: `Keep doing what holds your ${pillar.label.toLowerCase()} up`,
          href: '/reports?tab=business-rating',
          weight: pillar.score - median,
        });
      }
    }
  }

  return out.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    return bySeverity !== 0 ? bySeverity : b.weight - a.weight;
  });
}

/**
 * The card for a shop that has nothing wrong with it.
 *
 * A shop scoring in the nineties with no cohort to be praised against produced no
 * insight at all, so the card simply disappeared — and it disappeared for precisely
 * the owners most likely to keep the daily habit. This is the honest thing left to
 * say to them: of the four terms that multiply into revenue, one is furthest from
 * its ceiling, and that is where the next points are.
 *
 * Still no invented figures — the pillar's own score and its own headroom, both
 * already computed. Only reached when nothing else qualified, so it never competes
 * with a real problem.
 */
function ceilingInsight(rating: BusinessRating): RatingInsight | null {
  const measured = rating.pillars.filter((p) => p.measured);
  if (measured.length === 0) return null;
  const weakest = measured.reduce((lowest, p) => (p.score < lowest.score ? p : lowest), measured[0]);
  if (weakest.score >= 100) return null;
  return {
    id: `ceiling-${weakest.key}`,
    pillar: weakest.key,
    severity: 'good',
    principle: 'Revenue is four numbers multiplied together, so the smallest one sets the ceiling.',
    because:
      'Improving what is already strong adds a little. Lifting whichever term is furthest behind multiplies through everything else you sell.',
    yours: { label: `Your weakest term: ${weakest.label.toLowerCase()}`, value: `${weakest.score}/100` },
    move: weakest.fix.label,
    href: weakest.fix.href,
    weight: weakest.headroom,
  };
}

/**
 * The one insight for this day.
 *
 * Returns null when the shop has nothing to say yet — the caller renders nothing
 * rather than a card with a hole in it.
 */
export function insightOfTheDay(
  rating: BusinessRating,
  benchmark: RatingBenchmark | null,
  now: Date,
): { insight: RatingInsight | null; total: number } {
  const candidates = candidateInsights(rating, benchmark);
  if (candidates.length === 0) {
    // Nothing is wrong and there is nobody to be praised against. Point at the
    // ceiling instead of leaving a hole where the card was.
    const ceiling = rating.ready ? ceilingInsight(rating) : null;
    return ceiling ? { insight: ceiling, total: 1 } : { insight: null, total: 0 };
  }
  const pool = Math.min(ROTATION, candidates.length);
  // Positive modulo: dayNumber is always positive for any real date, but a
  // negative index here would silently return undefined and blank the card.
  const index = ((dayNumber(now) % pool) + pool) % pool;
  return { insight: candidates[index], total: candidates.length };
}
