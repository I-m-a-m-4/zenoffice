/**
 * Peer benchmark — the shared vocabulary between the writer and the readers.
 *
 * Imported by BOTH `src/lib/server/analytics-cache.ts` (server, computes and writes
 * the document) and `src/hooks/use-rating-benchmark.ts` (client, reads it). So it
 * must stay free of `firebase-admin` and of anything Node-only, exactly like
 * `src/lib/ai-analytics.ts` — the moment this module pulls in the Admin SDK the
 * Reports panel stops building.
 *
 * ── Why there is peer data here at all ─────────────────────────────────────
 *
 * `src/lib/business-rating.ts` refuses invented competitors: the tab it replaced
 * showed 400 fabricated shops and percentiles computed as `score * 0.8`. This is
 * the opposite of that — real medians over real businesses, or nothing at all.
 *
 * The cost of "real" is normally a platform-wide scan. That scan already exists and
 * already runs: `getCachedPlatformAnalytics` reads every receipt and product on the
 * platform (50k cap each) every six hours to fill the admin overview. The documents
 * are already in memory when this is called, so the benchmark costs **no additional
 * Firestore reads** — it is arithmetic over rows already paid for.
 *
 * ── What keeps it from leaking a tenant ────────────────────────────────────
 *
 * The published document holds medians and a cohort size. No businessId, no
 * per-business figure, nothing rankable. On top of that:
 *
 * - `BENCHMARK_MIN_SALES` keeps a business out of the cohort until it has actually
 *   traded. Without it the median is set by abandoned trials and every real shop is
 *   told it is above average.
 * - `BENCHMARK_MIN_COHORT` suppresses the whole document, and each pillar
 *   separately, below five contributors. A median over three shops is close enough
 *   to naming one, and the per-pillar floor matters more than the overall one:
 *   margin is only measurable where cost prices exist, so it can have a much
 *   smaller cohort than the score does.
 *
 * ── Two honest limits, surfaced in the UI rather than hidden ────────────────
 *
 * The 50k caps are unordered slices, not a sample designed to be representative;
 * and the recompute is opportunistic (whenever something hits the six-hourly cache),
 * so the figures are as of `updatedAt` and not live. Both are why the panel labels
 * the comparison with its date instead of implying it is current.
 */

import { computeBusinessRating, RATING_WINDOW_DAYS, type PillarKey } from '@/lib/business-rating';
import type { Product, Receipt } from '@/types';

/** Single document, readable by any signed-in user under the existing
 *  `platform_stats/{docId}` rule; written only by the Admin SDK, which bypasses
 *  rules. Deliberately not a subcollection: the AI rollups under
 *  `platform_stats/ai_usage_global/daily` had to be locked down separately because
 *  they name tenants, and there is nothing here that needs that treatment. */
export const BENCHMARK_COLLECTION = 'platform_stats';
export const BENCHMARK_DOC_ID = 'rating_benchmark';

/** A business must have traded this much inside the window to join the cohort. */
export const BENCHMARK_MIN_SALES = 20;

/** Fewer contributors than this and the figure is suppressed rather than published. */
export const BENCHMARK_MIN_COHORT = 5;

export type BenchmarkMedians = {
  overall: number | null;
} & { [K in PillarKey]: number | null };

export interface RatingBenchmark {
  /** ISO date string. Written as a string, not a Timestamp, so the client needs no conversion. */
  updatedAt: string;
  /** Businesses that qualified for the overall median. */
  cohort: number;
  /** How many contributed to each pillar — a pillar can have far fewer than `cohort`. */
  contributors: Record<string, number>;
  /** Days of trading each business was scored over. */
  windowDays: number;
  /** Minimum sales required to join the cohort, so the reader can state the basis. */
  minSales: number;
  /** True when a 50k scan cap may have cut the platform's rows short. */
  sampled: boolean;
  medians: BenchmarkMedians;
}

/** Middle value, averaging the two middles on an even count. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const PILLAR_KEYS: PillarKey[] = ['margin', 'basket', 'repeat', 'momentum'];

/**
 * Medians of the rating and its four pillars across every qualifying business.
 *
 * Returns `null` when the cohort is too small to publish — the caller should leave
 * whatever document is already there alone rather than writing an empty one, so a
 * quiet day on the platform does not blank the panel for everybody.
 *
 * `customers: null` throughout: the platform scan does not read the customers
 * collection, and the customer list only feeds a count that carries no money. Every
 * pillar score is computed from receipts and products alone, so the medians are
 * unaffected by leaving it out.
 */
export function computeRatingBenchmark(input: {
  receipts: { businessId?: string }[];
  products: { businessId?: string }[];
  now: Date;
  /** True when either scan hit its document cap. */
  sampled: boolean;
}): RatingBenchmark | null {
  const receiptsByBusiness = new Map<string, Receipt[]>();
  for (const r of input.receipts) {
    const id = r.businessId;
    if (!id) continue;
    const list = receiptsByBusiness.get(id);
    if (list) list.push(r as Receipt);
    else receiptsByBusiness.set(id, [r as Receipt]);
  }

  const productsByBusiness = new Map<string, Product[]>();
  for (const p of input.products) {
    const id = p.businessId;
    if (!id) continue;
    const list = productsByBusiness.get(id);
    if (list) list.push(p as Product);
    else productsByBusiness.set(id, [p as Product]);
  }

  const overall: number[] = [];
  const perPillar: Record<PillarKey, number[]> = { margin: [], basket: [], repeat: [], momentum: [] };

  for (const [businessId, receipts] of receiptsByBusiness) {
    const rating = computeBusinessRating({
      products: productsByBusiness.get(businessId) ?? [],
      receipts,
      customers: null,
      now: input.now,
    });
    // Not "has a score" but "has traded": a shop with four sales produces a real
    // score that says nothing about how a working shop performs.
    if (rating.score === null || rating.facts.sales < BENCHMARK_MIN_SALES) continue;

    overall.push(rating.score);
    for (const pillar of rating.pillars) {
      if (pillar.measured) perPillar[pillar.key].push(pillar.score);
    }
  }

  if (overall.length < BENCHMARK_MIN_COHORT) return null;

  const round = (n: number | null) => (n === null ? null : Math.round(n));
  /** A pillar is published only if enough businesses stood behind it. */
  const guarded = (values: number[]) => (values.length >= BENCHMARK_MIN_COHORT ? round(median(values)) : null);

  return {
    updatedAt: input.now.toISOString(),
    cohort: overall.length,
    contributors: Object.fromEntries(PILLAR_KEYS.map((k) => [k, perPillar[k].length])),
    windowDays: RATING_WINDOW_DAYS,
    minSales: BENCHMARK_MIN_SALES,
    sampled: input.sampled,
    medians: {
      overall: round(median(overall)),
      margin: guarded(perPillar.margin),
      basket: guarded(perPillar.basket),
      repeat: guarded(perPillar.repeat),
      momentum: guarded(perPillar.momentum),
    },
  };
}
