/**
 * AI credits — the one place that prices AI work and moves a balance.
 *
 * Everything that bills Gemini on the platform key goes through here: the chat
 * route and the `src/ai/flows/*` server actions alike. If a new Gemini call site
 * appears and does not call `reserveCredits`, it is free, and free is what this
 * module exists to stop.
 *
 * ## Why a turn was never a unit of cost
 *
 * The old accounting charged exactly 1 per chat turn while
 * `stopWhen: stepCountIs(24)` let a single turn make twenty-four model
 * round-trips — and a `runLossPreventionScan` turn drives a 119 KB forensics
 * engine across the shop's whole audit log. So one "credit" bought anywhere
 * between one cheap answer and a hundred times that, and the heaviest users were
 * the ones paying least per unit of work. Multimodal features (AI product upload,
 * bulk cost-price updates) make that gap wider still.
 *
 * Credits are therefore derived from **tokens**, which is the thing Google
 * actually charges for. That also means a new tool or a new flow is priced
 * correctly on the day it ships, with no per-tool table for anyone to forget to
 * update.
 *
 * ## `aiUsageCount` now counts credits, not messages
 *
 * The field name is historic and stays — renaming it means migrating every live
 * document, the rules entry and the admin board for no user-visible gain, the same
 * reasoning that keeps `trialExpiresAt` its historical name in `plan.ts`. But its
 * **meaning has changed**, and so has `AI_MONTHLY_LIMITS`: the allowance is now a
 * monthly credit allowance. Anything that renders it must say "credits", never
 * "messages" — a shop told it has 400 messages and cut off after 90 heavy ones has
 * been lied to. `aiBonusCredits` is likewise historic; "bonus" is now simply
 * "extra credits", and since credit packs were scrapped the only thing that adds to
 * it is the super-admin grant on `/admin-imamshaffy/ai-usage`. The field stays and
 * is still spent after the allowance — a shop holding a grant must not be refused a
 * turn it can pay for.
 *
 * ## Reserve, then settle
 *
 * The old check read the cap before streaming and wrote the increment in
 * `onFinish` — not a transaction, so two concurrent turns could both pass a check
 * with one credit left. Tolerable when credits were free; not once they are money.
 *
 * So: reserve inside a transaction before the model is called, settle the true cost
 * once the tokens are known, release if it failed. A failed turn is still not
 * billed, exactly as before.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/firebase/admin';
import { aiMonthlyLimit, effectivePlan, type PlanId } from '@/lib/plan';

// ─────────────────────────────────────────────────────────────────────────────
// Pricing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Weighted tokens that cost one credit.
 *
 * Set so an ordinary chat turn costs exactly 1. "Ordinary" is a system prompt plus
 * 44 tool schemas plus a short history and a short answer — around 12k in and a few
 * hundred out, which is roughly 15k weighted. The headroom to 20k is deliberate: it
 * keeps a normal question at one credit even when the history is long, so the
 * common case stays predictable and only genuinely heavy work costs more.
 *
 * **Calibrate this against the board, not against this comment.** The Cost ceiling
 * column on `/admin-imamshaffy/ai-usage` reports real per-tenant tokens, and it only
 * started collecting them in August 2026 — so this figure is a considered estimate
 * until a few weeks of that data exist. Revisit it there before repricing the packs.
 */
export const TOKENS_PER_CREDIT = 20_000;

/**
 * How many input tokens one output token is worth.
 *
 * Gemini 2.5 Flash bills output at $2.50/1M against input at $0.30/1M — a ratio of
 * about 8.3. Rounded **down** to 8 so the weighting can never charge more than the
 * underlying cost ratio justifies.
 *
 * Deliberately a literal rather than derived from `ZEN_MODEL` in
 * `src/lib/ai-cost.ts`. Deriving it would silently reprice every balance already
 * sold the day Google changes a rate: a shop that bought 1,000 credits would find
 * them buying less than when they paid. Repricing has to be a decision, so it is an
 * edit here — and when `ZEN_MODEL` changes, check this in the same commit.
 */
export const OUTPUT_TOKEN_WEIGHT = 8;

/** What a turn is charged up front, before its real cost is known. */
export const RESERVATION_CREDITS = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Burst limiting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Credits are a monthly budget. They are not a rate, and the difference is the hole.
 *
 * A Pro shop can spend its entire month's allowance in ninety seconds — nothing in the
 * balance check cares how fast it is drawn down. That matters in three ways, only one of
 * which is malice:
 *
 * - **A loop.** A retry that fires on failure, a component that calls on every render, a
 *   script someone wrote. The balance is gone before anyone looks at a screen.
 * - **A stolen token.** An ID token lifted from a browser is good for an hour, and an
 *   hour is long enough to drain the balance and run up the platform's Gemini bill.
 * - **Concurrency.** Ten simultaneous heavy calls all reserve one credit, then each
 *   settles at twenty — the reservation is atomic but the *aggregate* is not bounded.
 *
 * So the window below is a burst ceiling, checked **inside the reservation transaction**
 * that was already reading and writing this document. It therefore costs no extra
 * Firestore read and no extra write, which is what makes it affordable to apply to every
 * single call — a rate limiter that costs a read per request is one you end up disabling.
 *
 * A minute rather than an hour on purpose: a minute is short enough that a human who
 * trips it can simply carry on, and long enough that no loop gets through. Sustained
 * abuse is caught by the monthly allowance, which is the right tool for that.
 */
export const BURST_WINDOW_MS = 60_000;

/**
 * Calls allowed per business per window.
 *
 * Twelve. A person asking Zen AI questions manages three or four a minute; someone
 * importing photograph after photograph might reach eight. Twelve leaves headroom for
 * the fastest legitimate use and still stops a loop dead.
 */
export const BURST_LIMIT = 12;

/**
 * Timestamps kept on the business document.
 *
 * `aiCallTimestamps` is a **new top-level field, and it must be in
 * `entitlementFieldsLocked()` in `firestore.rules`.** `fieldsUnchanged()` is a deny-list,
 * not an allow-list, so a field absent from that array is one a client may write to its
 * own business document — and a client that can clear this array can switch its own rate
 * limit off. That is the same reasoning that put `aiUsageCount` there.
 */
const BURST_FIELD = 'aiCallTimestamps';

/** Recent call times, cleaned of anything stale or malformed. */
function recentCalls(data: any, nowMs: number): number[] {
  const raw = Array.isArray(data?.[BURST_FIELD]) ? data[BURST_FIELD] : [];
  return raw
    .map((value: unknown) => Number(value))
    // A timestamp in the future is either clock skew or a tampered document. Dropped
    // rather than trusted, because keeping it would hold the limiter shut.
    .filter((t: number) => Number.isFinite(t) && t <= nowMs && nowMs - t < BURST_WINDOW_MS)
    .sort((a: number, b: number) => a - b);
}

/**
 * Fixed credit weights for the Gemini calls whose token usage is not observable.
 *
 * The Genkit flows in `src/ai/flows/*` do not surface a usage object, so they are
 * priced by hand — the one place a table is unavoidable. Every one of them was
 * **completely unmetered** before this, which is where most of the cost leak was:
 * `visualCount` bills a multimodal call on the platform key for a caller-supplied
 * photo of arbitrary size.
 *
 * An image is worth far more than a text turn, so `visualCount` is weighted
 * accordingly. These are floors, not measurements — if a flow is ever moved onto the
 * AI SDK and reports usage, delete its entry and settle on real tokens instead.
 */
export const FLOW_CREDITS = {
  /** Multimodal: an image plus a product list. The pattern AI product upload follows. */
  visualCount: 8,
  productTroubleshoot: 2,
  businessAnalysis: 4,
  getCustomerInsights: 3,
  zenevaSupportChat: 1,
} as const;

export type FlowName = keyof typeof FLOW_CREDITS;

/** Tokens expressed in input-equivalents, so output is priced at what it costs. */
export function weightedTokens(tokensIn: number, tokensOut: number): number {
  const inTok = Number.isFinite(tokensIn) && tokensIn > 0 ? tokensIn : 0;
  const outTok = Number.isFinite(tokensOut) && tokensOut > 0 ? tokensOut : 0;
  return inTok + outTok * OUTPUT_TOKEN_WEIGHT;
}

/**
 * Credits for a given token split. Never zero: any answer at all costs one.
 *
 * A zero charge would make an empty or errored-but-completed response free, and
 * "free" is a hole somebody eventually finds. Rounded up for the same reason.
 */
export function creditsForTokens(tokensIn: number, tokensOut: number): number {
  return Math.max(1, Math.ceil(weightedTokens(tokensIn, tokensOut) / TOKENS_PER_CREDIT));
}

// ─────────────────────────────────────────────────────────────────────────────
// Balances
// ─────────────────────────────────────────────────────────────────────────────

/** `YYYY-MM`, matching what `aiUsageCurrentDate` stores. Never `YYYY-MM-DD`. */
export function creditMonth(now: Date = new Date()): string {
  return now.toISOString().substring(0, 7);
}

/** What a business has left, and where it is. */
export type CreditQuote = {
  /** The plan whose entitlements actually apply — a lapsed Pro reads as `starter`. */
  plan: PlanId;
  /** Monthly credit allowance for the plan actually in force. */
  monthlyLimit: number;
  month: string;
  allowanceUsed: number;
  allowanceRemaining: number;
  /** Admin-granted, non-expiring. The historic `aiBonusCredits`. */
  balance: number;
  /** `allowanceRemaining + balance`. What a caller should show as "credits left". */
  remaining: number;
};

/**
 * A charge already taken, and how it was split.
 *
 * Carries both buckets because a single turn can straddle them: the last credit of
 * the allowance plus the first of the purchased balance. Settling has to be able to
 * refund to the bucket the money came out of.
 */
export type Reservation = {
  businessId: string;
  month: string;
  credits: number;
  fromAllowance: number;
  fromBalance: number;
};

export type ReserveResult =
  | {
      ok: true;
      reservation: Reservation;
      quote: CreditQuote;
      /**
       * The business document as it stood when the charge was taken.
       *
       * Returned so a caller that needs other fields off it — the chat route wants
       * `settings.currency` and `settings.ratingEnabled` — does not read the same
       * document twice. Firestore cost is a standing constraint here, and the
       * transaction has the data in hand either way.
       *
       * Pre-debit, deliberately: `quote` describes the position the decision was
       * made against. Anything wanting the balance after this charge should take
       * `quote.remaining - reservation.credits`.
       */
      business: Record<string, any> | undefined;
    }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'exhausted'; quote: CreditQuote }
  /**
   * Too many calls in the last `BURST_WINDOW_MS`.
   *
   * Distinct from `exhausted` because the remedy is completely different and the
   * caller must not conflate them: this one clears by itself in seconds and the shop
   * still has credits, whereas `exhausted` clears at the start of next month or by
   * upgrading. Telling a shop with 300 credits left that its allowance is spent
   * would be a lie.
   */
  | { ok: false; reason: 'rate_limited'; retryAfterMs: number; quote: CreditQuote };

function quoteFrom(data: any, month: string): CreditQuote {
  const monthlyLimit = aiMonthlyLimit(data ?? {});
  const allowanceUsed = data?.aiUsageCurrentDate === month ? Number(data?.aiUsageCount) || 0 : 0;
  const allowanceRemaining = Math.max(0, monthlyLimit - allowanceUsed);
  const balance = Math.max(0, Number(data?.aiBonusCredits) || 0);
  return {
    plan: effectivePlan(data ?? {}),
    monthlyLimit,
    month,
    allowanceUsed,
    allowanceRemaining,
    balance,
    remaining: allowanceRemaining + balance,
  };
}

/**
 * Read a business's credit position without moving anything.
 *
 * For surfaces that display a balance. Callers about to spend must use
 * `reserveCredits` instead — a read here and a write later is the race this module
 * was written to close.
 */
export async function getCreditQuote(
  db: Firestore,
  businessId: string,
  now: Date = new Date(),
): Promise<CreditQuote | null> {
  const snap = await db.collection('businessInstances').doc(businessId).get();
  if (!snap.exists) return null;
  return quoteFrom(snap.data(), creditMonth(now));
}

/**
 * Take payment up front, atomically.
 *
 * Spends the monthly allowance before the purchased balance — an allowance that
 * expires at month end should always be used first, or a shop burns credits it paid
 * for while free ones go to waste.
 *
 * A caller with *any* credit left is allowed through even when the work will cost
 * more than that. The alternative is refusing a turn on an estimate the owner cannot
 * see, and the wall then lands on the next turn, where the balance is honestly zero.
 */
export async function reserveCredits(
  db: Firestore,
  businessId: string,
  opts: { credits?: number; now?: Date } = {},
): Promise<ReserveResult> {
  const credits = Math.max(1, Math.ceil(opts.credits ?? RESERVATION_CREDITS));
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const month = creditMonth(now);
  const ref = db.collection('businessInstances').doc(businessId);

  return db.runTransaction(async (tx: Transaction): Promise<ReserveResult> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: 'not_found' };

    const data = snap.data();
    const quote = quoteFrom(data, month);

    /*
     * Burst check before the balance check.
     *
     * Order matters: a runaway loop on a shop with an empty balance should be told it is
     * going too fast, not told its allowance is gone when it will be back in ninety
     * seconds. And a caller hammering an exhausted account is the case most likely to be
     * a script.
     */
    const recent = recentCalls(data, nowMs);
    if (recent.length >= BURST_LIMIT) {
      return {
        ok: false,
        reason: 'rate_limited',
        // How long until the oldest call in the window falls out of it, which is the
        // soonest this can succeed. +1s so a client retrying exactly on the boundary
        // does not immediately trip it again.
        retryAfterMs: Math.max(1000, BURST_WINDOW_MS - (nowMs - recent[0]) + 1000),
        quote,
      };
    }

    if (quote.remaining <= 0) return { ok: false, reason: 'exhausted', quote };

    const fromAllowance = Math.min(credits, quote.allowanceRemaining);
    const fromBalance = credits - fromAllowance;

    const updates: Record<string, any> = {
      // Trimmed to the window rather than appended to forever: this field is written on
      // every call, and an unbounded array on a hot document is a document that
      // eventually exceeds the 1MiB limit and starts failing every write against it.
      [BURST_FIELD]: [...recent, nowMs].slice(-BURST_LIMIT),
    };
    if (fromAllowance > 0) {
      // A month that has rolled over is a reset, not an increment — otherwise
      // October's first turn inherits September's total.
      if (data?.aiUsageCurrentDate !== month) {
        updates.aiUsageCurrentDate = month;
        updates.aiUsageCount = fromAllowance;
      } else {
        updates.aiUsageCount = FieldValue.increment(fromAllowance);
      }
    } else if (data?.aiUsageCurrentDate !== month) {
      // Stamp the month even when the whole charge came from the balance, so the
      // next turn's allowance reads as fresh rather than as last month's total.
      updates.aiUsageCurrentDate = month;
      updates.aiUsageCount = 0;
    }
    if (fromBalance > 0) {
      updates.aiBonusCredits = FieldValue.increment(-fromBalance);
    }
    if (Object.keys(updates).length) tx.update(ref, updates);

    return {
      ok: true,
      reservation: { businessId, month, credits, fromAllowance, fromBalance },
      quote,
      business: data,
    };
  });
}

export type SettleResult = {
  /** What the work actually cost. */
  charged: number;
  /** Credits taken beyond the reservation, or negative for a refund. */
  delta: number;
  /**
   * Credits owed that no bucket could cover.
   *
   * A turn already answered cannot be un-answered, so an overrun past a zero
   * balance is written off rather than pushing the balance negative — a negative
   * number on a screen is confusing, and the shop is correctly blocked on its next
   * turn anyway. Non-zero here is the platform eating the difference, which is why
   * the caller records it.
   */
  unbilled: number;
};

/**
 * Charge the true cost and correct the reservation.
 *
 * Pass the turn's tokens to settle on real usage. Omit them — for a flow whose
 * usage is not observable — and the reservation stands as the final charge.
 *
 * `floor` raises the measured charge to a minimum. It exists for the importer,
 * whose per-operation floors live in `src/lib/import/pricing.ts` and are a product
 * decision rather than a measurement: a shelf photograph is only ~1,500 image
 * tokens but is the highest-value and highest-retry operation in the product, and
 * an individually-free retry loop has no brake on it. Omitted everywhere else, so
 * the chat route stays purely metered.
 *
 * Writes nothing when the estimate was exact, which is the common case for a
 * one-credit turn. A no-op transaction is still a billed write.
 */
export async function settleCredits(
  db: Firestore,
  reservation: Reservation,
  tokensIn?: number | null,
  tokensOut?: number | null,
  floor = 0,
): Promise<SettleResult> {
  const measured =
    tokensIn == null && tokensOut == null
      ? reservation.credits
      : creditsForTokens(tokensIn ?? 0, tokensOut ?? 0);
  const charged = Math.max(measured, Math.ceil(floor) || 0);
  const delta = charged - reservation.credits;
  if (delta === 0) return { charged, delta: 0, unbilled: 0 };

  const ref = db.collection('businessInstances').doc(reservation.businessId);

  return db.runTransaction(async (tx: Transaction): Promise<SettleResult> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { charged, delta, unbilled: delta > 0 ? delta : 0 };

    const data = snap.data();
    const updates: Record<string, any> = {};
    let unbilled = 0;

    if (delta > 0) {
      // Allowance first again, then the balance, then written off.
      const quote = quoteFrom(data, reservation.month);
      const extraFromAllowance = Math.min(delta, quote.allowanceRemaining);
      const wantFromBalance = delta - extraFromAllowance;
      const extraFromBalance = Math.min(wantFromBalance, quote.balance);
      unbilled = wantFromBalance - extraFromBalance;

      if (extraFromAllowance > 0) {
        updates.aiUsageCount = FieldValue.increment(extraFromAllowance);
        if (data?.aiUsageCurrentDate !== reservation.month) {
          updates.aiUsageCurrentDate = reservation.month;
        }
      }
      if (extraFromBalance > 0) {
        updates.aiBonusCredits = FieldValue.increment(-extraFromBalance);
      }
    } else {
      // Refund, to the bucket it came from. The purchased balance is refunded
      // first: it does not expire, so a credit returned there is worth more to the
      // shop than one returned to an allowance that resets in days.
      let refund = -delta;
      const toBalance = Math.min(refund, reservation.fromBalance);
      refund -= toBalance;
      const toAllowance = Math.min(refund, reservation.fromAllowance);

      if (toBalance > 0) updates.aiBonusCredits = FieldValue.increment(toBalance);
      // Only unwind the allowance inside the month it was charged in. Past a month
      // boundary `aiUsageCount` is a different month's total and decrementing it
      // would hand out a credit against the new allowance.
      if (toAllowance > 0 && data?.aiUsageCurrentDate === reservation.month) {
        updates.aiUsageCount = FieldValue.increment(-toAllowance);
      }
    }

    if (Object.keys(updates).length) tx.update(ref, updates);
    return { charged, delta, unbilled };
  });
}

/**
 * Give a reservation back in full — the turn failed and must not be billed.
 *
 * Same guarantee the old code had by accident, since it only incremented in
 * `onFinish`. Now that payment is taken up front it has to be given back
 * deliberately.
 */
export async function releaseCredits(db: Firestore, reservation: Reservation): Promise<void> {
  const ref = db.collection('businessInstances').doc(reservation.businessId);
  await db
    .runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const updates: Record<string, any> = {};
      if (reservation.fromBalance > 0) {
        updates.aiBonusCredits = FieldValue.increment(reservation.fromBalance);
      }
      if (
        reservation.fromAllowance > 0 &&
        snap.data()?.aiUsageCurrentDate === reservation.month
      ) {
        updates.aiUsageCount = FieldValue.increment(-reservation.fromAllowance);
      }
      if (Object.keys(updates).length) tx.update(ref, updates);
    })
    .catch((err) => {
      // A failed release must not replace the caller's original error with this
      // one. It costs the shop a credit on a turn that did not work, which is
      // wrong but recoverable; losing the real failure is not.
      console.error('Failed to release AI credit reservation', err);
    });
}

/**
 * Charge a fixed price around a call, and refund it if the call fails.
 *
 * The `src/ai/flows/*` server actions all have this shape: one Gemini call, either
 * it returns or it throws. There is no settle step because there is nothing to
 * settle against — Genkit does not report usage, which is exactly why those flows
 * are priced from `FLOW_CREDITS` instead of from tokens. The reservation *is* the
 * charge. A flow that ever starts reporting real usage should reserve and settle
 * directly rather than come through here.
 *
 * Throws `AiCreditsExhaustedError` rather than returning a result union, because
 * every one of those flows already throws for its own failures and a caller that
 * has to branch on two different error shapes will get one of them wrong.
 */
export async function withCredits<T>(
  db: Firestore,
  businessId: string,
  credits: number,
  fn: () => Promise<T>,
): Promise<T> {
  const reserved = await reserveCredits(db, businessId, { credits });
  if (!reserved.ok) {
    if (reserved.reason === 'not_found') throw new Error('Business not found.');
    if (reserved.reason === 'rate_limited') throw new AiRateLimitedError(reserved.retryAfterMs);
    throw new AiCreditsExhaustedError(reserved.quote);
  }
  try {
    return await fn();
  } catch (err) {
    /*
     * The reservation comes back; the burst timestamp deliberately does not.
     *
     * A failed call still reached the provider and still cost the platform money, and a
     * loop of *failing* calls is the single case the limiter most needs to stop. Refunding
     * the rate-limit slot on error would make an error loop the one thing that can run
     * without a brake.
     */
    await releaseCredits(db, reserved.reservation);
    throw err;
  }
}

/** Thrown when a business is calling faster than `BURST_LIMIT` allows. */
export class AiRateLimitedError extends Error {
  readonly code = 'rate_limited' as const;
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    const seconds = Math.ceil(retryAfterMs / 1000);
    super(`Too many AI requests at once. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`);
    this.name = 'AiRateLimitedError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** Thrown by `withCredits` when there is nothing left to spend. */
export class AiCreditsExhaustedError extends Error {
  /** Machine-readable, so a client can render an Upgrade button instead of prose. */
  readonly code = 'credits_exhausted' as const;
  readonly quote: CreditQuote;

  constructor(quote: CreditQuote) {
    super(
      `Out of AI credits. The ${quote.plan} plan includes ${quote.monthlyLimit.toLocaleString()} credits a month, and it is spent. It resets at the start of next month.`,
    );
    this.name = 'AiCreditsExhaustedError';
    this.quote = quote;
  }
}

/**
 * Meter a Genkit flow, given the uid its `requireUser` call just returned.
 *
 * The whole of `src/ai/flows/*` is `'use server'`, which means every one of them is
 * a public HTTP endpoint whose action id ships in the client bundle — and until this
 * existed, every one of them billed Gemini on the platform key while reading no
 * quota field whatsoever. That was the larger half of the cost problem; the chat
 * route at least counted its turns.
 *
 * The business comes from the **caller's own user document**, never from the
 * request, the same way `activateSubscription` resolves it. A businessId passed in
 * by the caller is a request to bill somebody else.
 *
 * Priced from `FLOW_CREDITS` rather than measured, because Genkit reports no usage —
 * see that table. Keep the reserve inside the flow's own auth boundary: charging
 * before `requireUser` would let an unauthenticated replay drain a stranger's
 * balance.
 */
export async function withUserCredits<T>(
  uid: string,
  flow: FlowName,
  fn: () => Promise<T>,
): Promise<T> {
  const db = adminFirestore;
  if (!db) throw new Error('Server not configured.');

  const userSnap = await db.collection('users').doc(uid).get();
  const businessId: string | undefined = userSnap.data()?.businessId;
  if (!businessId) throw new Error('No business is linked to this account.');

  return withCredits(db, businessId, FLOW_CREDITS[flow], fn);
}
