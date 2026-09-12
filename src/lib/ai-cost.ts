/**
 * What a Zen AI turn costs, and the reference figures the admin board compares
 * against.
 *
 * Kept out of `ai-analytics.ts` on purpose: that module is imported by the chat
 * route on every turn, and nothing here is needed to *record* a turn — only to
 * read one back. This is a pricing sheet, not part of the hot path.
 *
 * ## These are list prices, and the board's total is not the invoice
 *
 * The rates below are Google's published per-token prices for the model the
 * route actually calls. This header used to claim real spend "differs, and
 * always downward", on the reasoning that context caching discounts the long
 * system prefix Zen AI resends every turn. **That was checked against a real
 * invoice on 20 August 2026 and it is wrong.** Both halves of it:
 *
 *   - **Caching did not discount anything.** Implicit caching is free but needs
 *     traffic dense enough to keep a prefix warm; at ~2 turns a day the cache is
 *     cold every time, so actual spend landed on the ceiling rather than under
 *     it. Explicit caching is worse than useless at this volume — storage runs
 *     about $1.00 per 1M tokens per hour, so holding an ~8k-token prefix for a
 *     day costs roughly $0.19, against a whole-month bill of $0.13. Do not
 *     reach for it until traffic is orders of magnitude higher.
 *   - **The invoice came in 6% *above* the board's ceiling** (~$0.13 billed
 *     against ~$0.123 recorded) — because the ceiling is a ceiling for *what
 *     the board measures*, which is chat turns, while the invoice covers the
 *     whole API key. The five Genkit flows in `src/ai/flows/*` bill that same
 *     key and were not recording tokens at the time. They are metered now, so
 *     the gap should close; if it reopens, look for a Gemini call site that
 *     does not go through `src/lib/server/ai-credits.ts`.
 *
 * So the figures here are a **ceiling on the chat route**, not on the account.
 * The board labels them that way rather than as an actual charge, because a
 * number that says "$4.10" next to an invoice reading $1.60 destroys trust in
 * the whole page — and so does one that reads low.
 *
 * ## Where the money actually goes
 *
 * From that same reconciliation: **input was 98% of the tokens and 85% of the
 * cost.** A turn averaged ~12,400 tokens in against ~260 out, and about 8,100
 * of the input was fixed overhead resent on every single turn — tool schemas
 * (~4,500) plus the system prompt (~3,600). Output is priced 8× higher per
 * token and still barely registers.
 *
 * The consequence for anyone trying to cut this bill: **shortening replies
 * saves nothing.** What works is sending less in — which is what
 * `slimForModel` and `slimHistory` in `src/app/api/chat/tools.ts` do, and why
 * `createZenTools` drops `getBusinessRating` for shops that never opted in.
 *
 * When the model in `src/app/api/chat/route.ts` changes, change `ZEN_MODEL`
 * here in the same commit — a stale rate is worse than no rate. Note the two
 * cheap flows deliberately override it to `gemini-2.5-flash-lite`, so this
 * constant is the chat route's model, not the app's only one.
 */

/** The model `src/app/api/chat/route.ts` passes to `streamText`. */
export const ZEN_MODEL = {
  id: 'gemini-3.6-flash',
  label: 'Gemini 3.6 Flash',
  vendor: 'Google',
  /** USD per 1M tokens, list price, text in / text out. */
  inputPerMillion: 0.3,
  outputPerMillion: 2.5,
  /** Total context the model accepts, in tokens. */
  contextWindow: 1_000_000,
  /**
   * Published rates change without notice. The board shows this date so a
   * figure that drifted is visibly stale rather than quietly wrong.
   */
  ratesCheckedOn: '2026-08-11',
  pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
} as const;

/** Ceiling cost in USD for a given split of input and output tokens. */
export function estimateCostUsd(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn / 1_000_000) * ZEN_MODEL.inputPerMillion +
    (tokensOut / 1_000_000) * ZEN_MODEL.outputPerMillion
  );
}

/**
 * Money at the scale this board deals in.
 *
 * Sub-cent totals are the normal case for a single tenant on a quiet day, and
 * rounding those to "$0.00" reads as "free" when the honest answer is "too
 * small to bill". Extra precision only appears where it carries information.
 */
export function formatUsd(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return `<$0.01`;
  if (value < 1) return `$${value.toFixed(3)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  return `$${Math.round(value).toLocaleString()}`;
}

/** Compact token counts: 1_250_000 → "1.25M", 165_000 → "165.0k". */
export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

/**
 * Percentage change against a previous period.
 *
 * Returns `null` when the previous period is zero rather than the infinity a
 * naive divide produces. There is no honest percentage for "0 → 9": it is new
 * activity, and the board says that in words instead of drawing "+900%".
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Direction of travel, in terms of whether it is *good*.
 *
 * Rising turns are healthy; rising errors are not. The caller says which kind
 * of metric it is holding, because the number itself cannot know.
 */
export function deltaTone(
  change: number | null,
  higherIsBetter: boolean,
): 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'flat' {
  if (change === null || Math.abs(change) < 0.5) return 'flat';
  const rising = change > 0;
  if (rising) return higherIsBetter ? 'up-good' : 'up-bad';
  return higherIsBetter ? 'down-bad' : 'down-good';
}
