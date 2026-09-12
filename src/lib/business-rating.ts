/**
 * The business rating — the number in the top bar and behind the Reports tab.
 *
 * ── What this measures, and what it deliberately does not ──────────────────
 *
 * **This is the money view.** Inventory condition — stockouts, missing photos,
 * reorder points — already has its own score on the Inventory page's Health tab
 * (`src/app/(app)/inventory/page.tsx`). Scoring it twice would tell a shop that
 * tidying product records is how it grows, which is false. So this rating scores
 * only the four things that multiply revenue:
 *
 *     revenue = buyers × how often they return × basket size × margin
 *
 * Each pillar is one of those terms. A shop can be perfectly stocked and still
 * score badly here, and that is the point: the Inventory tab says whether the
 * shelf is in order, this says whether the shop is making money.
 *
 * ── Three rules ────────────────────────────────────────────────────────────
 *
 * 1. **It has to move.** The old rating came from
 *    `business.settings.businessAnalysis.businessHealth.score`, written only when
 *    somebody ran an AI report, so it sat frozen for weeks while the shop changed
 *    underneath it. This is arithmetic over rows the caller already holds, so it
 *    responds to the next sale.
 *
 * 2. **No model, no network, no clock of its own** — `now` is an input, as in
 *    `src/lib/forensics.ts`. "Why did I drop four points" must have an answer.
 *
 * 3. **Every figure is a count of real rows.** The tab this feeds used to show 400
 *    fabricated competitors and percentiles computed as `score * 0.8`. Where a
 *    pillar cannot be measured it says so (`measured: false`) and drops out of the
 *    weighting instead of scoring zero — a shop with no sales yet has an unknown
 *    margin, not a bad one.
 *
 *    There *is* peer data now, and it obeys the same rule: real medians over real
 *    shops, computed by `src/lib/rating-benchmark.ts` from the platform scan and
 *    suppressed entirely below a five-business cohort. This module knows nothing
 *    about it — the comparison is drawn alongside the score, never folded into it,
 *    so a shop's rating never moves because somebody else's did.
 *
 * ── Where the money figures come from ──────────────────────────────────────
 *
 * Cost of goods uses `item.costPrice`, which the POS captures at the moment of
 * sale (`src/app/(app)/sales/pos/review/page.tsx`), falling back to the product's
 * current cost only when an older receipt has none. This can differ by a little
 * from the Profit & Loss tab, which re-prices all history at *today's* cost —
 * that tab is answering an accounting question, this one is answering "what did
 * that sale actually earn".
 *
 * Two `Opportunity` figures are conditional and say so in `detail` (adding an item
 * to single-item baskets; lifting below-average margins to the shop's own
 * average). The rest are money that has already been given away or left behind,
 * summed from receipts. Nothing here is a projection dressed as a fact.
 *
 * ── Why win-back counts only buyers we watched buy ─────────────────────────
 *
 * A customer who has gone quiet is worth what *they* used to spend, so the
 * win-back figure sums each lapsed buyer's own average basket and never the
 * shop-wide average. That keeps it to a scale a shop could actually recover.
 *
 * Customers on file who never appear on a receipt in the window are a different
 * thing and are deliberately **not** given a money figure. The receipt listener
 * holds 200 sales while customers sync in full, so on a busy shop that group is
 * mostly people whose receipt fell off the end of the window — pricing 2,900 of
 * them at an average basket produced a headline in the millions that measured the
 * listener cap rather than the shop. The count still matters, so it is surfaced
 * where it can be acted on (the `repeat` pillar's `fix`) and only when
 * `facts.truncated` is false, which is the only time it means what it says.
 */

import type { Customer, Product, Receipt } from '@/types';
import { safeToDate } from '@/lib/utils';

/**
 * Sales window. 60 days so that momentum can compare two clean 30-day halves.
 *
 * The receipt listener holds the 200 most recent sales, so a busy shop's window
 * is shorter than this in practice; `coveredDays` reports what was actually
 * available rather than pretending to 60.
 */
export const RATING_WINDOW_DAYS = 60;

/** A customer counts as lapsed after this long without buying. */
const DORMANT_AFTER_DAYS = 30;

/** Gross margin treated as full marks. Above this, retail is doing very well. */
const MARGIN_TARGET_PCT = 40;

export type PillarKey = 'margin' | 'basket' | 'repeat' | 'momentum';

export interface RatingPillar {
  key: PillarKey;
  label: string;
  /** 0-100. Meaningless when `measured` is false. */
  score: number;
  /** Share of the overall score, before renormalisation. */
  weight: number;
  /** False when the underlying rows do not exist yet — excluded from the total. */
  measured: boolean;
  /** Six words at most, always built from a real figure. */
  hint: string;
  /**
   * Points the overall score would gain if this pillar reached 100, against the
   * weights as actually renormalised over the measured pillars. Zero when
   * unmeasured, because an unmeasured pillar is not in the total to move.
   *
   * Points are right here and wrong on an `Opportunity`: a pillar meter *is* the
   * score, so "+6 pts" is the literal arithmetic, whereas money left on the table
   * is money and saying it in points would hide the size of the prize.
   */
  headroom: number;
  /**
   * The single action that moves this pillar, chosen from the figures rather than
   * from a table of advice. Present even when `measured` is false — that is when
   * it matters most, since the fix is usually what makes the pillar measurable.
   */
  fix: { label: string; href: string };
}

export interface Opportunity {
  id: string;
  /** Imperative, and carries the count so the owner knows the size of the job. */
  label: string;
  /** The arithmetic behind `money`, including any condition. Ten words at most. */
  detail: string;
  /** Currency, not points. `gain` = on the table; `blind` = revenue not measurable. */
  money: number;
  kind: 'gain' | 'blind';
  href: string;
}

export interface RatingTier {
  /** 1-based, for "Level 3" style display. */
  index: number;
  name: string;
  floor: number;
  next: { name: string; floor: number } | null;
}

/** The figures behind the score, so the UI never recomputes anything. */
export interface RatingFacts {
  sales: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  /** Share of revenue whose cost is known. Below ~0.6 the margin is a guess. */
  costCoverage: number;
  itemsSold: number;
  itemsPerSale: number;
  singleItemSales: number;
  avgItemPrice: number;
  avgOrderValue: number;
  namedSales: number;
  buyers: number;
  repeatBuyers: number;
  /**
   * Buyers seen inside the window whose last sale is older than
   * `DORMANT_AFTER_DAYS`. Observed rows, so each one has a basket history.
   */
  lapsedBuyers: number;
  /** Sum of each lapsed buyer's own average basket — the win-back figure. */
  lapsedBasketValue: number;
  /**
   * Customers on file with no receipt in the window. Only meaningful when
   * `truncated` is false; see the header note on why this carries no money.
   */
  neverSeenCustomers: number;
  /** False when the caller had no customer list, so `neverSeenCustomers` is unknown rather than zero. */
  customersKnown: boolean;
  recentRevenue: number;
  priorRevenue: number;
  growthPct: number;
  activeDays: number;
  /** Days of history actually available, capped at RATING_WINDOW_DAYS. */
  coveredDays: number;
  /** True when the 200-receipt listener cap, not the window, ended the history. */
  truncated: boolean;
}

export interface BusinessRating {
  /** False when there is nothing to score at all — show a dash, never an F. */
  ready: boolean;
  score: number | null;
  grade: string;
  tier: RatingTier;
  pillars: RatingPillar[];
  opportunities: Opportunity[];
  facts: RatingFacts;
}

export interface RatingInput {
  products: Product[] | null;
  receipts: Receipt[] | null;
  /**
   * `null` means *the caller does not have the customer list*, which is not the
   * same as an empty one: an empty list says nobody is on file, `null` says we
   * cannot tell. Only `neverSeenCustomers` depends on it, and it reports
   * `customersKnown: false` rather than a confident zero. The server-side Zen
   * tool passes `null` on purpose — fetching thousands of customer documents to
   * fill in one line of a chat answer is not worth the reads.
   */
  customers: Customer[] | null;
  now: Date;
}

/**
 * The ladder. Exported because the badge grid on `/achievements` draws every rung,
 * earned or not — a ladder with the unearned rungs hidden gives the owner nothing
 * to climb towards.
 */
export const TIERS: { name: string; floor: number }[] = [
  { name: 'Starter', floor: 0 },
  { name: 'Seller', floor: 50 },
  { name: 'Grower', floor: 60 },
  { name: 'Scaler', floor: 70 },
  { name: 'Leader', floor: 80 },
  { name: 'Elite', floor: 90 },
];

const WEIGHTS: Record<PillarKey, number> = {
  margin: 0.3,
  basket: 0.25,
  repeat: 0.25,
  momentum: 0.2,
};

const LABELS: Record<PillarKey, string> = {
  margin: 'Margin',
  basket: 'Basket',
  repeat: 'Repeat',
  momentum: 'Momentum',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function gradeFor(score: number | null): string {
  if (score === null) return '--';
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export function tierFor(score: number | null): RatingTier {
  const value = score ?? 0;
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (value >= TIERS[i].floor) index = i;
  }
  const next = index + 1 < TIERS.length ? TIERS[index + 1] : null;
  return {
    index: index + 1,
    name: TIERS[index].name,
    floor: TIERS[index].floor,
    next: next ? { name: next.name, floor: next.floor } : null,
  };
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const num = (v: unknown) => Number(v) || 0;

/** A voided sale is deleted outright, so anything present counts as a sale. */
function inWindow(receipts: Receipt[], from: number): Receipt[] {
  return receipts.filter((r) => safeToDate(r.createdAt).getTime() >= from);
}

/**
 * Unit cost as it was at the till, falling back to the product's cost today for
 * receipts written before the POS captured it.
 */
function unitCost(item: Receipt['items'][number], byId: Map<string, Product>, byName: Map<string, Product>): number {
  if (num(item.costPrice) > 0) return num(item.costPrice);
  const product = byId.get(item.productId) ?? byName.get(item.name);
  return num(product?.costPrice);
}

function countFacts(input: {
  products: Product[];
  receipts: Receipt[];
  customers: Customer[] | null;
  now: Date;
}): RatingFacts {
  const { products, customers, now } = input;
  const windowStart = now.getTime() - RATING_WINDOW_DAYS * DAY_MS;
  const sales = inWindow(input.receipts, windowStart);

  const byId = new Map(products.map((p) => [p.id, p]));
  const byName = new Map(products.map((p) => [p.name, p]));

  let revenue = 0;
  let cogs = 0;
  let revenueWithCost = 0;
  let itemsSold = 0;
  let singleItemSales = 0;
  let namedSales = 0;
  const activeDayKeys = new Set<string>();
  const orderCount = new Map<string, number>();
  const spendById = new Map<string, number>();
  const lastSeen = new Map<string, number>();

  let oldest = Number.POSITIVE_INFINITY;

  for (const r of sales) {
    const at = safeToDate(r.createdAt).getTime();
    if (at < oldest) oldest = at;
    activeDayKeys.add(new Date(at).toDateString());

    const items = r.items ?? [];
    if (items.length === 1) singleItemSales++;

    for (const item of items) {
      const qty = num(item.quantity);
      const line = num(item.price) * qty;
      revenue += line;
      itemsSold += qty;
      const cost = unitCost(item, byId, byName);
      if (cost > 0) {
        cogs += cost * qty;
        revenueWithCost += line;
      }
    }

    const id = r.customer?.id;
    if (id) {
      namedSales++;
      orderCount.set(id, (orderCount.get(id) ?? 0) + 1);
      spendById.set(id, (spendById.get(id) ?? 0) + num(r.total));
      lastSeen.set(id, Math.max(lastSeen.get(id) ?? 0, at));
    }
  }

  const spanMs = Number.isFinite(oldest) ? now.getTime() - oldest : 0;
  const coveredDays = Math.max(1, Math.min(RATING_WINDOW_DAYS, Math.ceil(spanMs / DAY_MS)));
  // At the listener cap the history ended because we ran out of documents, not
  // because the window did. Said once in the UI rather than silently narrowing.
  const truncated = input.receipts.length >= 200 && coveredDays < RATING_WINDOW_DAYS;

  const halfMs = (spanMs || DAY_MS) / 2;
  const midpoint = now.getTime() - halfMs;
  let recentRevenue = 0;
  let priorRevenue = 0;
  for (const r of sales) {
    const at = safeToDate(r.createdAt).getTime();
    const value = (r.items ?? []).reduce((sum, i) => sum + num(i.price) * num(i.quantity), 0);
    if (at >= midpoint) recentRevenue += value;
    else priorRevenue += value;
  }

  const dormantCutoff = now.getTime() - DORMANT_AFTER_DAYS * DAY_MS;
  const buyers = orderCount.size;
  let repeatBuyers = 0;
  let lapsedBuyers = 0;
  let lapsedBasketValue = 0;
  for (const [id, count] of orderCount) {
    if (count > 1) repeatBuyers++;
    if ((lastSeen.get(id) ?? 0) < dormantCutoff) {
      lapsedBuyers++;
      // Their own average basket, not the shop's. A quiet ₦2,000 buyer is worth
      // ₦2,000, and averaging them with the shop's best customer is how a
      // win-back list starts quoting money nobody was ever going to spend.
      lapsedBasketValue += (spendById.get(id) ?? 0) / count;
    }
  }
  // Counted, never priced. See the header note: on a busy shop most of this group
  // are buyers whose receipt fell off the 200-sale listener, not lapsed customers.
  let neverSeenCustomers = 0;
  if (customers) {
    for (const c of customers) {
      if (!orderCount.has(c.id)) neverSeenCustomers++;
    }
  }

  const grossProfit = revenue - cogs;

  return {
    sales: sales.length,
    revenue,
    cogs,
    grossProfit,
    marginPct: revenueWithCost > 0 ? ((revenueWithCost - cogs) / revenueWithCost) * 100 : 0,
    costCoverage: revenue > 0 ? revenueWithCost / revenue : 0,
    itemsSold,
    itemsPerSale: sales.length > 0 ? itemsSold / sales.length : 0,
    singleItemSales,
    avgItemPrice: itemsSold > 0 ? revenue / itemsSold : 0,
    avgOrderValue: sales.length > 0 ? revenue / sales.length : 0,
    namedSales,
    buyers,
    repeatBuyers,
    lapsedBuyers,
    lapsedBasketValue,
    neverSeenCustomers,
    customersKnown: customers !== null,
    recentRevenue,
    priorRevenue,
    growthPct: priorRevenue > 0 ? ((recentRevenue - priorRevenue) / priorRevenue) * 100 : 0,
    activeDays: activeDayKeys.size,
    coveredDays,
    truncated,
  };
}

/**
 * The four meters, each with the one action that moves it.
 *
 * `fix` is derived from the figures, never chosen from a list of retail advice —
 * the tab this replaces printed "Reorder points are set correctly" under whatever
 * number happened to be on screen, and that is the failure mode to stay clear of.
 * A pillar that cannot be measured still gets a fix, because the fix is usually
 * the thing that would make it measurable.
 */
function pillarsFrom(f: RatingFacts): RatingPillar[] {
  // Margin — the multiplier on every other pillar. Only trustworthy when most of
  // the revenue has a cost behind it.
  const marginScore = clamp((f.marginPct / MARGIN_TARGET_PCT) * 100);

  // Basket — the cheapest lever in retail, and the one nobody pulls. A shop
  // where every sale is one item scores near zero however good its margin is.
  const singleShare = f.sales > 0 ? f.singleItemSales / f.sales : 1;
  const basketScore = clamp((1 - singleShare) * 60 + Math.min(1, f.itemsPerSale / 4) * 40);

  // Repeat — a sale with no name on it cannot be brought back.
  const attachRate = f.sales > 0 ? f.namedSales / f.sales : 0;
  const repeatShare = f.buyers > 0 ? f.repeatBuyers / f.buyers : 0;
  const repeatScore = clamp(attachRate * 50 + repeatShare * 50);

  // Momentum — this half of the window against the last, plus how many days the
  // shop actually rang a sale. Flat trade sits at 50, not at zero.
  const growthScore = clamp(50 + f.growthPct);
  const consistency = clamp((f.activeDays / f.coveredDays) * 100);
  const momentumScore = clamp(growthScore * 0.7 + consistency * 0.3);

  const pct = (n: number) => `${Math.round(n)}%`;

  /**
   * The never-seen count is only quoted when the window is a real 60 days. At the
   * listener cap it counts buyers whose receipt fell off the end, so it would name
   * a number the shop can see is wrong — and one wrong number discredits the page.
   */
  const canQuoteNeverSeen = f.customersKnown && !f.truncated && f.neverSeenCustomers > 0;

  const base: Omit<RatingPillar, 'headroom'>[] = [
    {
      key: 'margin',
      label: LABELS.margin,
      score: marginScore,
      weight: WEIGHTS.margin,
      measured: f.revenue > 0 && f.costCoverage >= 0.5,
      hint:
        f.revenue === 0
          ? 'No sales yet'
          : f.costCoverage < 0.5
            ? `Cost price missing on ${pct((1 - f.costCoverage) * 100)}`
            : `${pct(f.marginPct)} gross margin`,
      fix:
        f.revenue === 0
          ? { label: 'Record your first sale', href: '/sales/pos' }
          : f.costCoverage < 0.9
            ? { label: 'Add cost price to what you sell', href: '/inventory' }
            : { label: 'Raise prices on your thinnest earners', href: '/inventory' },
    },
    {
      key: 'basket',
      label: LABELS.basket,
      score: basketScore,
      weight: WEIGHTS.basket,
      measured: f.sales > 0,
      hint:
        f.sales === 0
          ? 'No sales yet'
          : singleShare >= 0.5
            ? `${pct(singleShare * 100)} are one item`
            : `${f.itemsPerSale.toFixed(1)} items per sale`,
      fix:
        f.sales === 0
          ? { label: 'Record your first sale', href: '/sales/pos' }
          : singleShare >= 0.5
            ? { label: `Offer a second item on ${f.singleItemSales} one-item sales`, href: '/sales/pos' }
            : { label: 'Put your best pairs next to each other', href: '/inventory' },
    },
    {
      key: 'repeat',
      label: LABELS.repeat,
      score: repeatScore,
      weight: WEIGHTS.repeat,
      measured: f.sales > 0,
      hint:
        f.sales === 0
          ? 'No sales yet'
          : attachRate < 0.5
            ? `${pct(attachRate * 100)} of sales have a name`
            : `${f.repeatBuyers} buyers came back`,
      fix:
        f.sales === 0
          ? { label: 'Record your first sale', href: '/sales/pos' }
          : attachRate < 0.5
            ? { label: 'Attach a customer to every sale', href: '/sales/pos' }
            : f.lapsedBuyers > 0
              ? { label: `Call the ${f.lapsedBuyers} who stopped coming`, href: '/customers' }
              : canQuoteNeverSeen
                ? { label: `${f.neverSeenCustomers} on file have not bought in ${f.coveredDays}d`, href: '/customers' }
                : { label: 'Keep taking names at the till', href: '/sales/pos' },
    },
    {
      key: 'momentum',
      label: LABELS.momentum,
      score: momentumScore,
      weight: WEIGHTS.momentum,
      measured: f.priorRevenue > 0,
      hint:
        f.priorRevenue === 0
          ? 'Not enough history'
          : `${f.growthPct >= 0 ? '+' : ''}${Math.round(f.growthPct)}% vs previous ${Math.round(f.coveredDays / 2)}d`,
      fix:
        f.priorRevenue === 0
          ? { label: 'Keep selling — this needs two weeks of history', href: '/sales/pos' }
          : f.growthPct < 0
            ? { label: 'Restock your best earners', href: '/inventory?sortBy=stock-asc' }
            : consistency < 60
              ? { label: `Sales recorded on ${f.activeDays} of ${f.coveredDays} days`, href: '/sales/pos' }
              : { label: 'Hold the pace', href: '/reports?tab=analytics' },
    },
  ];

  // Headroom is measured against the weights as they will actually be applied —
  // renormalised over the measured pillars — so the four figures sum to exactly
  // the points between the current score and 100 and cannot over-promise.
  const liveWeight = base.reduce((sum, p) => sum + (p.measured ? p.weight : 0), 0);
  return base.map((p) => ({
    ...p,
    headroom: p.measured && liveWeight > 0 ? ((100 - p.score) * p.weight) / liveWeight : 0,
  }));
}

/**
 * Weighted average over the pillars that could be measured, with the weights
 * renormalised across them. A shop trading for a week is scored on basket and
 * repeat alone rather than being given a zero for momentum it cannot have.
 */
function overallFrom(pillars: RatingPillar[]): number | null {
  const measured = pillars.filter((p) => p.measured);
  if (measured.length === 0) return null;
  const weight = measured.reduce((sum, p) => sum + p.weight, 0);
  if (weight <= 0) return null;
  return Math.round(clamp(measured.reduce((sum, p) => sum + p.score * p.weight, 0) / weight));
}

/**
 * Where the money is, in currency.
 *
 * Ranked by size, largest first, because the point of the panel is to answer
 * "what is the biggest thing I am leaving on the table" in one glance. Points
 * are deliberately not used here: a shop does not care that collecting its
 * lapsed buyers is worth six points, it cares that it is worth ₦480,000.
 */
function findOpportunities(
  products: Product[],
  receipts: Receipt[],
  f: RatingFacts,
  now: Date,
): Opportunity[] {
  const out: Opportunity[] = [];
  const windowStart = now.getTime() - RATING_WINDOW_DAYS * DAY_MS;
  const sales = inWindow(receipts, windowStart);
  const byId = new Map(products.map((p) => [p.id, p]));
  const byName = new Map(products.map((p) => [p.name, p]));
  const days = f.coveredDays;

  // 1. Items sold at or below what they cost. Money already gone.
  let belowCostLoss = 0;
  const belowCostIds = new Set<string>();
  // 2. Cashier price overrides below the shelf price. Money already gone.
  let overrideLoss = 0;
  // 3. Discounts. Money already given away.
  let discountTotal = 0;
  // Per-product volume and margin, for the stockout and underpricing checks.
  const sold = new Map<string, { qty: number; revenue: number; margin: number }>();

  for (const r of sales) {
    discountTotal += num(r.discount);
    for (const item of r.items ?? []) {
      const qty = num(item.quantity);
      const price = num(item.price);
      const cost = unitCost(item, byId, byName);

      if (cost > 0 && price <= cost) {
        belowCostLoss += (cost - price) * qty;
        belowCostIds.add(item.productId);
      }
      if (item.priceOverridden && num(item.listPrice) > price) {
        overrideLoss += (num(item.listPrice) - price) * qty;
      }

      const entry = sold.get(item.productId) ?? { qty: 0, revenue: 0, margin: 0 };
      entry.qty += qty;
      entry.revenue += price * qty;
      if (cost > 0) entry.margin += (price - cost) * qty;
      sold.set(item.productId, entry);
    }
  }

  if (belowCostLoss > 0) {
    out.push({
      id: 'below-cost',
      label: `${belowCostIds.size} ${belowCostIds.size === 1 ? 'item sells' : 'items sell'} below cost`,
      detail: `lost over the last ${days} days`,
      money: belowCostLoss,
      kind: 'gain',
      href: '/inventory',
    });
  }

  if (overrideLoss > 0) {
    out.push({
      id: 'overrides',
      label: 'Stop till price overrides',
      detail: `typed under the shelf price in ${days} days`,
      money: overrideLoss,
      kind: 'gain',
      href: '/audit-log',
    });
  }

  if (discountTotal > 0 && f.revenue > 0) {
    out.push({
      id: 'discounts',
      label: 'Tighten discounting',
      detail: `${Math.round((discountTotal / f.revenue) * 100)}% of revenue given away`,
      money: discountTotal,
      kind: 'gain',
      href: '/receipts',
    });
  }

  // 4. Single-item baskets. Conditional, and the condition is in `detail`.
  if (f.singleItemSales > 0 && f.avgItemPrice > 0) {
    out.push({
      id: 'basket',
      label: `Add one item to ${f.singleItemSales} single-item sales`,
      detail: `if each took one more at your average price`,
      money: f.singleItemSales * f.avgItemPrice,
      kind: 'gain',
      href: '/sales',
    });
  }

  // 5. Buyers who have gone quiet, each valued at their own average basket.
  //    Customers on file who never appear in the window are deliberately absent —
  //    see the header note; they are surfaced as a count on the `repeat` pillar.
  if (f.lapsedBuyers > 0 && f.lapsedBasketValue > 0) {
    out.push({
      id: 'lapsed',
      label: `Win back ${f.lapsedBuyers} lapsed ${f.lapsedBuyers === 1 ? 'buyer' : 'buyers'}`,
      detail: `one visit each at what they used to spend`,
      money: f.lapsedBasketValue,
      kind: 'gain',
      href: '/customers',
    });
  }

  // 6. Best-margin sellers that are out of stock: margin lost per day, not once.
  const stockedOut = Array.from(sold.entries())
    .map(([id, s]) => ({ product: byId.get(id), s }))
    .filter((x) => x.product && x.product.categoryType !== 'service' && num(x.product.stock) <= 0 && x.s.margin > 0)
    .sort((a, b) => b.s.margin - a.s.margin)
    .slice(0, 5);
  if (stockedOut.length > 0) {
    const perMonth = stockedOut.reduce((sum, x) => sum + (x.s.margin / days) * 30, 0);
    if (perMonth > 0) {
      out.push({
        id: 'stockout-margin',
        label: `${stockedOut.length} of your best earners are out of stock`,
        detail: 'margin per month while they stay out',
        money: perMonth,
        kind: 'gain',
        href: '/inventory?sortBy=stock-asc',
      });
    }
  }

  // 7. Volume sellers priced below the shop's own average margin. Conditional.
  if (f.marginPct > 0 && f.costCoverage >= 0.5) {
    let underpricedGain = 0;
    let underpricedCount = 0;
    for (const [id, s] of sold) {
      if (s.revenue <= 0 || s.margin <= 0) continue;
      const itemMarginPct = (s.margin / s.revenue) * 100;
      if (itemMarginPct < f.marginPct * 0.6) {
        underpricedGain += s.revenue * ((f.marginPct - itemMarginPct) / 100);
        underpricedCount++;
      }
      void id;
    }
    if (underpricedCount > 0 && underpricedGain > 0) {
      out.push({
        id: 'underpriced',
        label: `${underpricedCount} sellers earn under half your average margin`,
        detail: `if they matched your ${Math.round(f.marginPct)}% margin`,
        money: underpricedGain,
        kind: 'gain',
        href: '/inventory',
      });
    }
  }

  // 8. The blocker. Not an opportunity — revenue whose profit is unknowable.
  if (f.revenue > 0 && f.costCoverage < 0.9) {
    out.push({
      id: 'no-cost-price',
      label: 'Add cost price to what you sell',
      detail: 'of sales whose profit cannot be measured',
      money: f.revenue * (1 - f.costCoverage),
      kind: 'blind',
      href: '/inventory',
    });
  }

  const gains = out.filter((o) => o.kind === 'gain').sort((a, b) => b.money - a.money);
  const blind = out.filter((o) => o.kind === 'blind');
  // The blocker rides along rather than competing: without a cost price the
  // margin pillar is unmeasured and half these figures cannot be computed at all.
  return [...gains.slice(0, blind.length > 0 ? 2 : 3), ...blind];
}

export function computeBusinessRating(input: RatingInput): BusinessRating {
  const products = input.products ?? [];
  const receipts = input.receipts ?? [];
  // Not coerced to `[]`: null means "no customer list", which must not read as
  // "nobody on file". See RatingInput.customers.
  const customers = input.customers;
  const now = input.now;

  const facts = countFacts({ products, receipts, customers, now });
  const pillars = pillarsFrom(facts);
  const score = overallFrom(pillars);

  return {
    ready: score !== null,
    score,
    grade: gradeFor(score),
    tier: tierFor(score),
    pillars: pillars.map((p) => ({
      ...p,
      score: Math.round(clamp(p.score)),
      headroom: Math.round(p.headroom),
    })),
    opportunities: score !== null ? findOpportunities(products, receipts, facts, now) : [],
    facts,
  };
}
