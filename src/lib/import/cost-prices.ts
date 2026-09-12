/**
 * Getting cost prices onto products that have none.
 *
 * The problem, stated honestly: a shop signs up with 1,200 products and knows the
 * selling price of all of them and the cost price of none. Until cost prices exist,
 * every margin figure, the rating's margin pillar, the dead-stock capital number and
 * "which lines actually make money" are all unanswerable. It is the single biggest
 * hole in a new shop's data, and the reason it stays a hole is that nobody is going to
 * type 1,200 numbers.
 *
 * ## Three ways in, ordered by how little work they are
 *
 * The mistake would be to build one "enter cost prices" screen. The right answer is to
 * make the task **finite**, because 1,200 is not a task, it is a reason to give up.
 *
 * 1. **A margin sweep — zero typing.** "I sell drinks at about 25% margin" fills every
 *    drink's cost from its selling price. One sentence covers hundreds of products.
 *    Every value it writes is flagged `costPriceEstimated`, because it is a guess.
 * 2. **The products that actually matter — a short queue.** Cost prices are only
 *    interesting in proportion to how much a product sells. Twenty products usually
 *    carry most of a shop's margin, so `fillQueue` ranks the gaps by revenue at stake
 *    and the owner types twenty real numbers instead of twelve hundred guesses.
 * 3. **A list they already have — paste, photograph or dictate it.** Suppliers send
 *    price lists on WhatsApp and owners keep costs in a notebook. `parseCostList`
 *    reads "Coke 50cl - 380" and matches it to the catalogue.
 *
 * And the real long-term answer, which is why none of the above needs to be perfect:
 * **cost prices arrive from waybills.** The invoice importer already writes them. These
 * three are a bootstrap, and an estimate written today is expected to be overwritten by
 * the first real delivery.
 *
 * ## Why `costPriceEstimated` exists
 *
 * Without it, a cost derived from a guessed margin is indistinguishable from one read
 * off a supplier's invoice. Every margin report would then present arithmetic performed
 * on an assumption as fact, and the shop would make pricing decisions on it. The flag
 * is what lets a screen say "estimated" and what lets a real cost overwrite a guess
 * without ceremony while never letting a guess overwrite a real cost.
 */

import type { Product } from '@/types';
import { parseMoney, normalizeName } from './normalize';
import { parseTabular } from './tabular';
import { buildProductIndex, matchDraft, type ProductIndex } from './match';
import type { DraftProduct, MatchCandidate, MatchVerdict } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Reading a list
// ─────────────────────────────────────────────────────────────────────────────

/** One "product → cost" pair as it arrived. */
export type CostLine = {
  key: string;
  /** The line exactly as written, so a bad parse is explainable without the source. */
  raw: string;
  name: string;
  cost: number | null;
};

export type CostListResult = {
  lines: CostLine[];
  /** Lines that held no usable number, kept so nothing is silently dropped. */
  unreadable: string[];
};

/**
 * Read a pasted, photographed or dictated cost list.
 *
 * Goes through `parseTabular`, so every shape the importer already understands works
 * here for free: a tab-delimited paste out of Excel, a WhatsApp list of
 * `Coke 50cl - 380`, a bare `Coke 380`. What it does **not** do is go through
 * `mapColumns`, and that is the important difference — in this context the number is a
 * *cost*, and a column headed "Price" must not be read as a selling price. So the
 * first text-like column is the name and the first number-like column is the cost, by
 * position, with no header interpretation at all.
 */
export function parseCostList(text: string): CostListResult {
  const parsed = parseTabular(text);
  if (!parsed) return { lines: [], unreadable: [] };

  const { table } = parsed;
  const width = Math.max(table.headers.length, ...table.rows.map((r) => r.length), 0);

  // Which column holds the name, and which holds the number. Decided from the values
  // across the whole list rather than per row, so one odd line cannot flip the layout.
  let nameColumn = 0;
  let costColumn = -1;
  let bestNameScore = -1;
  let bestCostScore = -1;

  for (let column = 0; column < width; column++) {
    const values = table.rows
      .map((row) => String(row[column] ?? '').trim())
      .filter((value) => value.length > 0);
    if (values.length === 0) continue;

    const numeric = values.filter((value) => {
      const digits = value.replace(/[^0-9]/g, '').length;
      return digits / value.length >= 0.5 && parseMoney(value) != null;
    }).length / values.length;
    const alpha = values.filter((value) => /[a-z]{2}/i.test(value)).length / values.length;

    if (alpha > bestNameScore && numeric < 0.5) {
      bestNameScore = alpha;
      nameColumn = column;
    }
    if (numeric > bestCostScore && numeric >= 0.6) {
      bestCostScore = numeric;
      costColumn = column;
    }
  }

  const lines: CostLine[] = [];
  const unreadable: string[] = [];

  table.rows.forEach((row, index) => {
    const raw = row.filter(Boolean).join(' ').trim();
    if (!raw) return;

    const name = String(row[nameColumn] ?? '').trim();
    if (!name || !/[a-z]/i.test(name)) {
      unreadable.push(raw);
      return;
    }

    const cost = costColumn >= 0 ? parseMoney(row[costColumn]) : null;
    if (cost == null) {
      // A name with no number is not an error worth stopping for — the owner may
      // have meant to fill it in — but it cannot be applied either.
      unreadable.push(raw);
      return;
    }

    lines.push({ key: `c-${index}`, raw, name, cost });
  });

  return { lines, unreadable };
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching a list to the catalogue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What will happen to one line of the list.
 *
 * `skip` is the default for anything unmatched, and it is the whole safety story:
 * setting a cost price on the wrong product silently corrupts that product's margin
 * for as long as nobody notices, and nothing on any screen would look broken.
 */
export type CostDecision =
  | { action: 'set'; productId: string }
  | { action: 'skip' };

export type CostRow = {
  line: CostLine;
  verdict: MatchVerdict;
  decision: CostDecision;
  decidedByUser: boolean;
  /** The product's current cost, for the before→after column. */
  currentCost?: number;
  /** Whether the current cost is itself only an estimate. */
  currentIsEstimate?: boolean;
  /** Selling price, so an impossible cost can be flagged before it is written. */
  currentPrice?: number;
};

/**
 * A line of a cost list, shaped as a draft so it can reuse the importer's matcher.
 *
 * Deliberately reusing `matchDraft` rather than writing a second name matcher: SKU
 * equality, normalised-name equality, and the size-aware token overlap that makes
 * `Coke 50cl` match `Coca-Cola Original 500ml` are all already there and already
 * tested. A parallel implementation would drift, and the failure mode of drift here is
 * a cost price on the wrong product.
 */
function asDraft(line: CostLine): DraftProduct {
  return {
    key: line.key,
    name: line.name,
    raw: {},
    issues: [],
    source: 'paste',
  };
}

/**
 * Match every line against the catalogue.
 *
 * A certain match becomes `set`; anything less becomes `skip` and a question. Lines
 * are processed in order and a matched product is claimed, so a list naming the same
 * product twice cannot quietly apply the second figure over the first.
 *
 * `previous` preserves decisions a human already made, the same contract `stageRows`
 * has.
 */
export function matchCostLines(
  lines: CostLine[],
  products: Product[],
  previous: CostRow[] = [],
): CostRow[] {
  const index = buildProductIndex(products);
  const byId = new Map(products.map((p) => [p.id, p]));
  const claimed = new Set<string>();
  const held = new Map(previous.map((row) => [row.line.key, row]));

  return lines.map((line) => {
    const verdict = matchDraft(asDraft(line), index, claimed);
    if (verdict.kind === 'certain') claimed.add(verdict.match.productId);

    const prior = held.get(line.key);
    const decision: CostDecision = prior?.decidedByUser
      ? prior.decision
      : verdict.kind === 'certain'
        ? { action: 'set', productId: verdict.match.productId }
        : { action: 'skip' };

    const target = decision.action === 'set' ? byId.get(decision.productId) : undefined;

    return {
      line,
      verdict,
      decision,
      decidedByUser: !!prior?.decidedByUser,
      currentCost: typeof target?.costPrice === 'number' ? target.costPrice : undefined,
      currentIsEstimate: !!(target as any)?.costPriceEstimated,
      currentPrice: typeof target?.price === 'number' ? target.price : undefined,
    };
  });
}

/** Rows holding an unanswered question. Drives the review screen's count. */
export function unresolvedCostRows(rows: CostRow[]): CostRow[] {
  return rows.filter((row) => row.verdict.kind === 'possible' && !row.decidedByUser);
}

/**
 * Lines worth spending a credit to resolve, and their candidates.
 *
 * Same shape the importer's AI matcher takes, so one route action serves both.
 */
export function costMatchQueue(rows: CostRow[], cap = 60) {
  return unresolvedCostRows(rows)
    .slice(0, cap)
    .map((row) => ({
      key: row.line.key,
      name: row.line.name,
      candidates: row.verdict.kind === 'possible' ? row.verdict.candidates : ([] as MatchCandidate[]),
    }));
}

/** Fold AI verdicts back in. Only ids the local index already offered are honoured. */
export function applyAiCostMatches(
  rows: CostRow[],
  verdicts: { key: string; productId: string | null }[],
  products: Product[],
): CostRow[] {
  const byKey = new Map(verdicts.map((v) => [v.key, v]));
  const byId = new Map(products.map((p) => [p.id, p]));

  return rows.map((row) => {
    if (row.decidedByUser) return row;
    const verdict = byKey.get(row.line.key);
    if (!verdict || row.verdict.kind !== 'possible') return row;
    if (verdict.productId === null) return row;

    const chosen = row.verdict.candidates.find((c) => c.productId === verdict.productId);
    if (!chosen) return row;

    const target = byId.get(chosen.productId);
    return {
      ...row,
      decision: { action: 'set', productId: chosen.productId },
      currentCost: typeof target?.costPrice === 'number' ? target.costPrice : undefined,
      currentIsEstimate: !!(target as any)?.costPriceEstimated,
      currentPrice: typeof target?.price === 'number' ? target.price : undefined,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// What a cost list will write
// ─────────────────────────────────────────────────────────────────────────────

export type CostWrite = {
  productId: string;
  productName: string;
  before?: number;
  after: number;
  /** True when the write is replacing a real figure rather than filling a gap. */
  replacesKnown: boolean;
  /** Set when the new cost is at or above the selling price. */
  warning?: string;
};

/**
 * Turn matched rows into the writes they imply.
 *
 * Two checks worth having here rather than in the UI, because both are about the
 * shop's money and neither should depend on which screen is calling:
 *
 * - **A cost at or above the selling price is flagged, not blocked.** Clearance stock
 *   genuinely sells below cost, but far more often it means the list's numbers are
 *   selling prices, not costs — and applying those makes every margin zero.
 * - **A write that changes nothing is dropped.** Re-running a list should cost no
 *   Firestore writes at all.
 */
export function buildCostWrites(rows: CostRow[], products: Product[]): CostWrite[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const writes: CostWrite[] = [];

  for (const row of rows) {
    if (row.decision.action !== 'set') continue;
    const product = byId.get(row.decision.productId);
    if (!product) continue;

    const after = row.line.cost;
    if (after == null || after < 0) continue;

    const before = typeof product.costPrice === 'number' ? product.costPrice : undefined;
    if (before != null && Math.abs(before - after) < 0.005) continue;

    const price = Number(product.price) || 0;
    const warning =
      price > 0 && after >= price
        ? `Cost ${after.toLocaleString()} is not below the selling price ${price.toLocaleString()} — check these are cost prices.`
        : undefined;

    writes.push({
      productId: product.id,
      productName: product.name,
      before,
      after,
      // An estimate is a gap as far as this is concerned: overwriting a guess with a
      // real number needs no warning, which is the point of tracking the flag.
      replacesKnown: before != null && before > 0 && !(product as any).costPriceEstimated,
      warning,
    });
  }

  return writes;
}

// ─────────────────────────────────────────────────────────────────────────────
// The queue: which gaps actually matter
// ─────────────────────────────────────────────────────────────────────────────

export type CostGap = {
  product: Product;
  /** Money that has moved through this product, and so is being mis-reported. */
  revenueAtStake: number;
  /** Units sold in the window, for the "why this one" line. */
  unitsSold: number;
  /** True when a cost exists but is only an estimate. */
  estimated: boolean;
};

/**
 * Products whose missing cost price is costing the owner the most understanding.
 *
 * Ranked by revenue at stake rather than by stock value or alphabetically, because the
 * question a cost price answers is "did I make money on this", and that only matters in
 * proportion to how much of it sold. A ₦200 sweet that sells 400 times a month matters
 * more than a ₦90,000 generator sitting in the corner.
 *
 * `soldUnits` is supplied by the caller from receipts it already holds — this function
 * stays pure and reads no data, so "why is this product top of my list" is answerable
 * without a network call.
 *
 * Products with no sales at all are included but rank last: their cost is still worth
 * knowing (it is the capital tied up in dead stock) and they are precisely the ones a
 * margin sweep should cover instead of being typed by hand.
 */
export function fillQueue(
  products: Product[],
  soldUnits: Map<string, number>,
  opts: { includeEstimates?: boolean; limit?: number } = {},
): CostGap[] {
  const { includeEstimates = true, limit = 50 } = opts;

  const gaps: CostGap[] = [];
  for (const product of products) {
    if (!product?.id) continue;
    const cost = Number(product.costPrice) || 0;
    const estimated = !!(product as any).costPriceEstimated;

    const missing = cost <= 0;
    if (!missing && !(includeEstimates && estimated)) continue;

    const units = soldUnits.get(product.id) ?? 0;
    const price = Number(product.price) || 0;
    gaps.push({
      product,
      unitsSold: units,
      revenueAtStake: units * price,
      estimated: !missing && estimated,
    });
  }

  return gaps
    .sort((a, b) => {
      if (b.revenueAtStake !== a.revenueAtStake) return b.revenueAtStake - a.revenueAtStake;
      // Tie-break on stock value, so a never-sold product with real capital in it
      // outranks a never-sold product with one unit.
      const stockValue = (gap: CostGap) =>
        (Number(gap.product.stock) || 0) * (Number(gap.product.price) || 0);
      return stockValue(b) - stockValue(a);
    })
    .slice(0, limit);
}

/**
 * How much of the shop's takings is unexplained by missing cost prices.
 *
 * The number that makes the task feel finite and worth starting: "83% of your sales
 * have no cost price behind them" is a reason to spend five minutes;
 * "412 products need attention" is a reason to close the tab.
 */
export function coverage(
  products: Product[],
  soldUnits: Map<string, number>,
): { known: number; estimated: number; missing: number; percentKnown: number } {
  let known = 0;
  let estimated = 0;
  let missing = 0;

  for (const product of products) {
    if (!product?.id) continue;
    const revenue = (soldUnits.get(product.id) ?? 0) * (Number(product.price) || 0);
    if (revenue <= 0) continue;

    const cost = Number(product.costPrice) || 0;
    if (cost <= 0) missing += revenue;
    else if ((product as any).costPriceEstimated) estimated += revenue;
    else known += revenue;
  }

  const total = known + estimated + missing;
  return {
    known,
    estimated,
    missing,
    percentKnown: total > 0 ? Math.round((known / total) * 100) : 0,
  };
}

/**
 * Units sold per product, from whatever receipts the caller holds.
 *
 * Lives here so both the queue and the coverage figure derive from one definition, and
 * takes receipts as a plain array so it stays pure. **The window is whatever the caller
 * passed in** — the POS receipt listener holds a capped 200, so a caller that hands it
 * those is measuring recent activity and not lifetime sales. Same capped-window trap
 * the rating's dormant buyers and the overdue-credit figure both carry, and the reason
 * no screen should call this figure a total.
 */
export function unitsSoldFrom(receipts: any[]): Map<string, number> {
  const sold = new Map<string, number>();
  for (const receipt of receipts ?? []) {
    if (receipt?.status === 'voided' || receipt?.status === 'refunded') continue;
    for (const item of receipt?.items ?? []) {
      const id = item?.productId ?? item?.product?.id;
      if (!id) continue;
      const quantity = Number(item?.quantity) || 0;
      sold.set(id, (sold.get(id) ?? 0) + quantity);
    }
  }
  return sold;
}

// ─────────────────────────────────────────────────────────────────────────────
// Name lookup, for Zen AI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve one name to a product, for a caller that needs a single answer.
 *
 * Used by the Zen AI tool, which is handed names by a model and must not guess. Returns
 * the verdict rather than a product so the caller has to deal with ambiguity explicitly
 * — a helper that returned "best guess or null" is exactly how a model's loose paraphrase
 * of a product name ends up writing to the wrong row.
 */
export function resolveOne(
  name: string,
  index: ProductIndex,
  claimed: Set<string> = new Set(),
): MatchVerdict {
  return matchDraft(
    { key: normalizeName(name) || name, name, raw: {}, issues: [], source: 'text' },
    index,
    claimed,
  );
}
