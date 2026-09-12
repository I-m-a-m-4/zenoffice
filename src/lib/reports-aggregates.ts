/**
 * Reports aggregation — the arithmetic behind the Reports page panels.
 *
 * Pure. No React, no Firestore, no clock: **`now` is an input**, the same rule
 * `src/lib/forensics.ts` and `src/lib/business-rating.ts` hold to. "Why did this
 * number change" has no answer if the function reads the clock, and it is what
 * makes these functions drivable from a throwaway `npx tsx` script.
 *
 * ## Two measures of revenue, and why they do not match
 *
 * This matters more than it looks, and getting it wrong is how a page starts
 * contradicting itself:
 *
 * - **Receipt revenue** is `Σ receipt.total`. It is net of the receipt-level
 *   discount and *includes* tax. The KPI cards and `staff` use this, because it
 *   is what actually came through the till.
 * - **Line revenue** is `Σ (item.price × item.quantity)`. It is gross of the
 *   receipt-level discount and *excludes* tax. Per-item and per-category figures
 *   have to use this, because `Receipt.discount` is a single receipt-level number
 *   with no way to attribute it to a line.
 *
 * So per-item revenue will not sum to the revenue KPI, and that is correct rather
 * than a bug. Every share (`revenueShare`) is therefore computed against the
 * **line-revenue total of the same scope**, so shares add to 100% within a panel
 * and are never mixed across the two measures.
 *
 * ## Receipts are not filtered by payment status
 *
 * Matching `src/lib/business-rating.ts` and the existing KPI cards on the page: a
 * void *deletes* the receipt, so anything still present was a sale. Filtering on
 * `status === 'paid'` here would make every panel disagree with the KPI row above
 * it.
 *
 * ## Unknown cost is unknown, never zero
 *
 * A shop that has not entered cost prices has an **unknown** margin, not a bad
 * one — the rule from `docs/business-rating.md`. So `profit` and `marginPct` are
 * `null` unless cost is known for essentially every unit sold, and
 * `costCoverage` reports how much of the volume was actually priced. Callers must
 * render `null` as an em-dash with a reason, never as `0`.
 *
 * Cost is read from the **receipt line first** (`item.costPrice`, captured at the
 * moment of sale) and only falls back to the product's *current* `costPrice`.
 * Preferring the line is what stops a later cost change from rewriting history.
 */

import { safeToDate } from '@/lib/utils';
import { isService as isServiceRow } from '@/lib/product-kind';
import type { Product, Receipt, UserProfile } from '@/types';

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** `safeToDate` returns the epoch for anything missing; treat that as "no date". */
function realDate(value: any): Date | null {
  const d = safeToDate(value);
  const t = d.getTime();
  return t > 0 ? d : null;
}

/** Cost is known for a unit only if some source actually carries a number. */
function unitCost(line: any, product: Product | undefined): number | null {
  const lineCost = line?.costPrice;
  if (lineCost !== undefined && lineCost !== null && Number.isFinite(Number(lineCost))) {
    return Number(lineCost);
  }
  const productCost = product?.costPrice;
  if (productCost !== undefined && productCost !== null && Number.isFinite(Number(productCost))) {
    return Number(productCost);
  }
  return null;
}

/** Essentially-all-units coverage. Below this, profit reads as unknown. */
const FULL_COVERAGE = 0.999;

function indexProducts(products: Product[] | null | undefined): Map<string, Product> {
  const byId = new Map<string, Product>();
  for (const p of products || []) {
    if (p?.id) byId.set(p.id, p);
  }
  return byId;
}

/**
 * Products keyed by name, for receipt lines whose `productId` no longer resolves.
 * Only used as a fallback — a name index cannot distinguish two products that
 * share a name, which is exactly the ambiguity the id keying exists to avoid.
 */
function indexProductsByName(products: Product[] | null | undefined): Map<string, Product> {
  const byName = new Map<string, Product>();
  for (const p of products || []) {
    const key = String(p?.name ?? '').trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, p);
  }
  return byName;
}

/* ------------------------------------------------------------------ *
 * Per-item
 * ------------------------------------------------------------------ */

export type ItemStat = {
  /** Stable identity: the product id when it resolves, else `name:<normalised>`. */
  key: string;
  productId: string | null;
  /** Display name, with the variant suffix the old chart produced. */
  name: string;
  sku: string | null;
  category: string;
  isService: boolean;
  units: number;
  /** Line revenue — see the header note on the two revenue measures. */
  revenue: number;
  /** Share of the scope's line-revenue total, 0..1. */
  revenueShare: number;
  /** Null unless cost is known for essentially every unit. */
  cost: number | null;
  profit: number | null;
  marginPct: number | null;
  costKnown: boolean;
  /** Fraction of units that had a cost from any source, 0..1. */
  costCoverage: number;
  /** Distinct receipts this item appeared on. */
  orders: number;
  lastSoldAt: Date | null;
  /** Units sold at a manually overridden price. */
  overriddenUnits: number;
  /** Money given away by overrides: Σ (listPrice − price) × qty, when positive. */
  overrideGiveaway: number;
};

export type AggregateItemsResult = {
  items: ItemStat[];
  /** Line-revenue total across every item in scope — the share denominator. */
  lineRevenueTotal: number;
  /** Receipts examined. */
  receiptCount: number;
};

/**
 * Roll receipt lines up per item.
 *
 * **Keyed by `productId`, not by display name.** The chart this replaces keyed on
 * the label, which merged two different products that happened to share a name and
 * split one product that was renamed mid-period — so the "top seller" could be two
 * items added together, and a renamed item could vanish from its own chart.
 *
 * Products are indexed once instead of `products.find()` inside the line loop,
 * which was O(receipts × items × products) and the page's hot spot at the
 * 5,000-receipt ceiling.
 */
export function aggregateItems(
  receipts: Receipt[] | null | undefined,
  products: Product[] | null | undefined,
  opts: { kind?: 'product' | 'service' | 'all' } = {},
): AggregateItemsResult {
  const kind = opts.kind ?? 'all';
  const byId = indexProducts(products);
  const byName = indexProductsByName(products);

  type Acc = {
    stat: ItemStat;
    costedUnits: number;
    costSum: number;
    receiptIds: Set<string>;
  };
  const acc = new Map<string, Acc>();
  let lineRevenueTotal = 0;
  let receiptCount = 0;

  for (const r of receipts || []) {
    if (!r) continue;
    receiptCount += 1;
    const soldAt = realDate(r.createdAt);

    for (const line of r.items || []) {
      if (!line) continue;

      const pid = String(line.productId ?? '').trim();
      let product = pid ? byId.get(pid) : undefined;
      if (!product) {
        product = byName.get(String(line.name ?? '').trim().toLowerCase());
      }

      const service = isServiceRow(product ?? { category: null, categoryType: null, type: null });
      if (kind === 'product' && service) continue;
      if (kind === 'service' && !service) continue;

      // Identity: prefer the resolved product's own id. A line whose product is
      // gone falls back to its name, which is the best that remains.
      const key = product?.id
        ? product.id
        : pid
          ? pid
          : `name:${String(line.name ?? 'unknown').trim().toLowerCase()}`;

      // Label from the catalogue's *current* name when the product still resolves,
      // falling back to whatever the receipt recorded. Keying is by id, so a
      // renamed product is already one row — this makes that row carry the name
      // the owner will recognise rather than whichever spelling was on the oldest
      // line we happened to read first.
      let displayName = String(product?.name ?? line.name ?? 'Unknown item');
      if (product?.parentId) {
        const parent = byId.get(product.parentId);
        if (parent) displayName = `${parent.name} (${product.variantValue || product.name})`;
      }

      const qty = num(line.quantity);
      const revenue = num(line.price) * qty;
      lineRevenueTotal += revenue;

      let entry = acc.get(key);
      if (!entry) {
        entry = {
          stat: {
            key,
            productId: product?.id ?? (pid || null),
            name: displayName,
            sku: product?.sku ?? null,
            category: String(product?.category ?? '').trim() || 'Uncategorised',
            isService: service,
            units: 0,
            revenue: 0,
            revenueShare: 0,
            cost: null,
            profit: null,
            marginPct: null,
            costKnown: false,
            costCoverage: 0,
            orders: 0,
            lastSoldAt: null,
            overriddenUnits: 0,
            overrideGiveaway: 0,
          },
          costedUnits: 0,
          costSum: 0,
          receiptIds: new Set<string>(),
        };
        acc.set(key, entry);
      }

      entry.stat.units += qty;
      entry.stat.revenue += revenue;
      if (r.id) entry.receiptIds.add(r.id);
      if (soldAt && (!entry.stat.lastSoldAt || soldAt > entry.stat.lastSoldAt)) {
        entry.stat.lastSoldAt = soldAt;
      }

      const cost = unitCost(line, product);
      if (cost !== null) {
        entry.costedUnits += qty;
        entry.costSum += cost * qty;
      }

      if (line.priceOverridden) {
        entry.stat.overriddenUnits += qty;
        const list = num(line.listPrice);
        const paid = num(line.price);
        if (list > paid) entry.stat.overrideGiveaway += (list - paid) * qty;
      }
    }
  }

  const items: ItemStat[] = [];
  for (const entry of acc.values()) {
    const s = entry.stat;
    s.orders = entry.receiptIds.size;
    s.costCoverage = s.units > 0 ? entry.costedUnits / s.units : 0;
    s.costKnown = s.units > 0 && s.costCoverage >= FULL_COVERAGE;
    if (s.costKnown) {
      s.cost = entry.costSum;
      s.profit = s.revenue - entry.costSum;
      s.marginPct = s.revenue > 0 ? (s.profit / s.revenue) * 100 : null;
    }
    s.revenueShare = lineRevenueTotal > 0 ? s.revenue / lineRevenueTotal : 0;
    items.push(s);
  }

  return { items, lineRevenueTotal, receiptCount };
}

export type RankBy = 'units' | 'revenue' | 'profit';

/**
 * Rank items by a measure.
 *
 * Ranking by units — all the old chart could do — puts 50 units of a loss leader
 * above 5 units of the shop's best-margin line, which is the opposite of useful.
 *
 * Items whose profit is unknown sort **last** under `profit` rather than being
 * treated as zero, so a missing cost price never reads as "makes no money".
 */
export function rankItems(items: ItemStat[], by: RankBy): ItemStat[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (by === 'profit') {
      const ap = a.profit;
      const bp = b.profit;
      if (ap === null && bp === null) return b.revenue - a.revenue;
      if (ap === null) return 1;
      if (bp === null) return -1;
      return bp - ap;
    }
    if (by === 'revenue') return b.revenue - a.revenue;
    return b.units - a.units;
  });
  return sorted;
}

/* ------------------------------------------------------------------ *
 * Per-category
 * ------------------------------------------------------------------ */

export type CategoryStat = {
  category: string;
  units: number;
  revenue: number;
  revenueShare: number;
  cost: number | null;
  profit: number | null;
  marginPct: number | null;
  costKnown: boolean;
  costCoverage: number;
  /** Distinct items sold in this category. */
  items: number;
};

/**
 * Category money. Nothing else on the Reports page does this — ABC analysis is
 * per-product, and the pie chart on the dashboard counts stock, not revenue.
 *
 * Built from `aggregateItems` output so the two panels can never disagree.
 */
export function aggregateCategories(itemStats: ItemStat[]): CategoryStat[] {
  type Acc = CategoryStat & { costedUnits: number; costSum: number };
  const acc = new Map<string, Acc>();
  let total = 0;

  for (const s of itemStats) {
    total += s.revenue;
    const key = s.category || 'Uncategorised';
    let entry = acc.get(key);
    if (!entry) {
      entry = {
        category: key,
        units: 0,
        revenue: 0,
        revenueShare: 0,
        cost: null,
        profit: null,
        marginPct: null,
        costKnown: false,
        costCoverage: 0,
        items: 0,
        costedUnits: 0,
        costSum: 0,
      };
      acc.set(key, entry);
    }
    entry.units += s.units;
    entry.revenue += s.revenue;
    entry.items += 1;
    // Only fully-costed items contribute cost, so coverage stays interpretable.
    entry.costedUnits += s.costKnown ? s.units : 0;
    entry.costSum += s.costKnown ? (s.cost ?? 0) : 0;
  }

  const out: CategoryStat[] = [];
  for (const entry of acc.values()) {
    entry.costCoverage = entry.units > 0 ? entry.costedUnits / entry.units : 0;
    entry.costKnown = entry.units > 0 && entry.costCoverage >= FULL_COVERAGE;
    if (entry.costKnown) {
      entry.cost = entry.costSum;
      entry.profit = entry.revenue - entry.costSum;
      entry.marginPct = entry.revenue > 0 ? (entry.profit / entry.revenue) * 100 : null;
    }
    entry.revenueShare = total > 0 ? entry.revenue / total : 0;
    const { costedUnits, costSum, ...rest } = entry;
    out.push(rest);
  }

  out.sort((a, b) => b.revenue - a.revenue);
  return out;
}

/**
 * Fold everything past `keep` into a single "Other" row.
 *
 * A categorical chart cannot carry an unbounded number of series — past a handful
 * the colours stop being distinguishable and the legend stops being readable. So
 * the tail collapses into one honest bucket rather than being silently dropped.
 */
/**
 * Folds everything past `keep` into one row.
 *
 * `otherLabel` is passed in rather than built here: this module is pure and has no `t`,
 * and the folded row is drawn on the chart axis, so a hardcoded "Other" was the one
 * English word left on a translated panel. The caller knows the tail count before
 * calling (`rows.length - keep`), so it can format the whole label itself.
 */
export function foldTail(
  rows: CategoryStat[],
  keep: number,
  otherLabel?: string,
): CategoryStat[] {
  if (rows.length <= keep) return rows;
  const head = rows.slice(0, keep);
  const tail = rows.slice(keep);
  const other: CategoryStat = {
    category: otherLabel ?? `Other (${tail.length})`,
    units: tail.reduce((s, r) => s + r.units, 0),
    revenue: tail.reduce((s, r) => s + r.revenue, 0),
    revenueShare: tail.reduce((s, r) => s + r.revenueShare, 0),
    // Deliberately unknown: summing a mix of costed and uncosted categories would
    // invent a margin for the ones that never had one.
    cost: null,
    profit: null,
    marginPct: null,
    costKnown: false,
    costCoverage: 0,
    items: tail.reduce((s, r) => s + r.items, 0),
  };
  return [...head, other];
}

/* ------------------------------------------------------------------ *
 * Per-staff
 * ------------------------------------------------------------------ */

export type StaffStat = {
  /** `null` for receipts with no `createdBy` — see the note below. */
  userId: string | null;
  name: string;
  role: string | null;
  sales: number;
  /** Receipt revenue (`Σ receipt.total`), so it reconciles with the KPI row. */
  revenue: number;
  units: number;
  avgBasket: number;
  itemsPerSale: number;
  /** Receipt-level discount given, summed. */
  discountTotal: number;
  discountedSales: number;
  /** Share of this person's sales that carried a discount, 0..1. */
  discountRate: number;
  /** Lines sold at a manually typed price. */
  overriddenLines: number;
  lastSaleAt: Date | null;
};

/**
 * Per-person till activity.
 *
 * **This is a performance panel, not an accusation.** `src/lib/forensics.ts` owns
 * "these numbers look like theft" — it compares a person against the median of
 * their colleagues with the subject excluded, it is deliberately not AI, and it
 * runs only when the owner explicitly asks for it. See `docs/loss-prevention.md`.
 * Nothing here flags, scores or ranks anyone as suspicious; a high discount rate
 * on this panel means "ask about it", and the audit log is where you go next.
 *
 * `Receipt.createdBy` is optional, so sales that predate it (or arrived without
 * it) land in a single **Unattributed** row rather than being dropped. Dropping
 * them would make the per-person revenue silently fail to sum to the shop's.
 */
export function aggregateStaff(
  receipts: Receipt[] | null | undefined,
  users: UserProfile[] | null | undefined,
): StaffStat[] {
  const userById = new Map<string, UserProfile>();
  for (const u of users || []) {
    if (u?.id) userById.set(u.id, u);
  }

  type Acc = StaffStat & { _key: string };
  const acc = new Map<string, Acc>();

  for (const r of receipts || []) {
    if (!r) continue;
    const uid = String(r.createdBy ?? '').trim();
    const key = uid || '__unattributed__';

    let entry = acc.get(key);
    if (!entry) {
      const user = uid ? userById.get(uid) : undefined;
      entry = {
        _key: key,
        userId: uid || null,
        name: user?.name || (uid ? 'Removed member' : 'Unattributed'),
        role: user?.role ?? null,
        sales: 0,
        revenue: 0,
        units: 0,
        avgBasket: 0,
        itemsPerSale: 0,
        discountTotal: 0,
        discountedSales: 0,
        discountRate: 0,
        overriddenLines: 0,
        lastSaleAt: null,
      };
      acc.set(key, entry);
    }

    entry.sales += 1;
    entry.revenue += num(r.total);
    const discount = num(r.discount);
    if (discount > 0) {
      entry.discountTotal += discount;
      entry.discountedSales += 1;
    }
    for (const line of r.items || []) {
      entry.units += num(line?.quantity);
      if (line?.priceOverridden) entry.overriddenLines += 1;
    }
    const at = realDate(r.createdAt);
    if (at && (!entry.lastSaleAt || at > entry.lastSaleAt)) entry.lastSaleAt = at;
  }

  const out: StaffStat[] = [];
  for (const entry of acc.values()) {
    entry.avgBasket = entry.sales > 0 ? entry.revenue / entry.sales : 0;
    entry.itemsPerSale = entry.sales > 0 ? entry.units / entry.sales : 0;
    entry.discountRate = entry.sales > 0 ? entry.discountedSales / entry.sales : 0;
    const { _key, ...rest } = entry;
    out.push(rest);
  }

  out.sort((a, b) => b.revenue - a.revenue);
  return out;
}

/* ------------------------------------------------------------------ *
 * Margin leaks
 * ------------------------------------------------------------------ */

export type BelowCostRow = {
  key: string;
  name: string;
  sku: string | null;
  units: number;
  revenue: number;
  cost: number;
  /** Positive number: how much was lost on this item over the period. */
  loss: number;
  marginPct: number;
};

export type OverrideRow = {
  key: string;
  name: string;
  sku: string | null;
  overriddenUnits: number;
  giveaway: number;
};

export type MarginLeaks = {
  /** Items whose sales did not cover their own cost. Only fully-costed items. */
  belowCost: BelowCostRow[];
  totalBelowCostLoss: number;
  /** Money handed back through manually typed prices, per item. */
  overrides: OverrideRow[];
  totalOverrideGiveaway: number;
  /**
   * Receipt-level discount over the period.
   *
   * Reported as one figure and **never attributed to a product**: `Receipt.discount`
   * is a single number on the sale with no per-line breakdown, so splitting it
   * across the basket would be an invention.
   */
  discountTotal: number;
  discountedSales: number;
  /** Items excluded from `belowCost` because their cost is unknown. */
  uncostedItems: number;
};

export function findMarginLeaks(
  itemStats: ItemStat[],
  receipts: Receipt[] | null | undefined,
): MarginLeaks {
  const belowCost: BelowCostRow[] = [];
  const overrides: OverrideRow[] = [];
  let uncostedItems = 0;

  for (const s of itemStats) {
    if (!s.costKnown || s.cost === null) {
      uncostedItems += 1;
    } else if (s.revenue < s.cost) {
      belowCost.push({
        key: s.key,
        name: s.name,
        sku: s.sku,
        units: s.units,
        revenue: s.revenue,
        cost: s.cost,
        loss: s.cost - s.revenue,
        marginPct: s.marginPct ?? 0,
      });
    }

    if (s.overrideGiveaway > 0) {
      overrides.push({
        key: s.key,
        name: s.name,
        sku: s.sku,
        overriddenUnits: s.overriddenUnits,
        giveaway: s.overrideGiveaway,
      });
    }
  }

  belowCost.sort((a, b) => b.loss - a.loss);
  overrides.sort((a, b) => b.giveaway - a.giveaway);

  let discountTotal = 0;
  let discountedSales = 0;
  for (const r of receipts || []) {
    const d = num(r?.discount);
    if (d > 0) {
      discountTotal += d;
      discountedSales += 1;
    }
  }

  return {
    belowCost,
    totalBelowCostLoss: belowCost.reduce((s, r) => s + r.loss, 0),
    overrides,
    totalOverrideGiveaway: overrides.reduce((s, r) => s + r.giveaway, 0),
    discountTotal,
    discountedSales,
    uncostedItems,
  };
}

/* ------------------------------------------------------------------ *
 * Period comparison
 * ------------------------------------------------------------------ */

export type PeriodSummary = {
  revenue: number;
  sales: number;
  units: number;
  avgBasket: number;
  /** Null when no receipt in the period carried a cost. */
  profit: number | null;
  marginPct: number | null;
  /** Distinct identified buyers. Anonymous sales are not counted. */
  buyers: number;
  receiptCount: number;
};

/** Roll a set of receipts into the figures the KPI row compares. */
export function summarisePeriod(
  receipts: Receipt[] | null | undefined,
  products: Product[] | null | undefined,
): PeriodSummary {
  const list = receipts || [];
  const byId = indexProducts(products);

  let revenue = 0;
  let units = 0;
  let costSum = 0;
  let costedRevenue = 0;
  let anyCost = false;
  const buyers = new Set<string>();

  for (const r of list) {
    if (!r) continue;
    revenue += num(r.total);
    if (r.customer?.id) buyers.add(r.customer.id);
    for (const line of r.items || []) {
      const qty = num(line?.quantity);
      units += qty;
      const cost = unitCost(line, line?.productId ? byId.get(String(line.productId)) : undefined);
      if (cost !== null) {
        anyCost = true;
        costSum += cost * qty;
        costedRevenue += num(line?.price) * qty;
      }
    }
  }

  const sales = list.length;
  const profit = anyCost ? costedRevenue - costSum : null;

  return {
    revenue,
    sales,
    units,
    avgBasket: sales > 0 ? revenue / sales : 0,
    profit,
    marginPct: profit !== null && costedRevenue > 0 ? (profit / costedRevenue) * 100 : null,
    buyers: buyers.size,
    receiptCount: sales,
  };
}

export type Direction = 'up' | 'down' | 'flat' | 'new' | 'unknown';

export type KpiDelta = {
  current: number;
  previous: number | null;
  /** Null when a percentage would be meaningless — see below. */
  deltaPct: number | null;
  absolute: number | null;
  direction: Direction;
};

/**
 * Compare one figure against the equivalent previous period.
 *
 * Two cases that must not produce a number:
 *
 * - **No previous period** (`null`) → `unknown`. There is nothing to compare to,
 *   which is different from no change.
 * - **Previous was zero and current is not** → `new`, with `deltaPct: null`. The
 *   percentage change from zero is undefined; rendering it as `+∞%` or `+100%`
 *   is a fabrication either way.
 */
export function periodDelta(current: number, previous: number | null): KpiDelta {
  if (previous === null || previous === undefined || !Number.isFinite(previous)) {
    return { current, previous: null, deltaPct: null, absolute: null, direction: 'unknown' };
  }
  const absolute = current - previous;
  if (previous === 0) {
    return {
      current,
      previous,
      deltaPct: null,
      absolute,
      direction: current > 0 ? 'new' : 'flat',
    };
  }
  const deltaPct = (absolute / Math.abs(previous)) * 100;
  let direction: Direction = 'flat';
  // Sub-0.5% moves read as flat rather than as noise dressed up as a trend.
  if (deltaPct > 0.5) direction = 'up';
  else if (deltaPct < -0.5) direction = 'down';
  return { current, previous, deltaPct, absolute, direction };
}

/**
 * The previous window of the same length, immediately before `from`.
 *
 * Length is inclusive of both ends, so "1–31 Aug" compares against "1–31 Jul"
 * rather than a window one day short.
 */
export function previousWindow(from: Date, to: Date): { from: Date; to: Date } {
  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { from: prevFrom, to: prevTo };
}
