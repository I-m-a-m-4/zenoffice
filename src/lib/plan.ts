import { safeToDate } from '@/lib/utils';

/**
 * Plan entitlements — the single source of truth.
 *
 * There is no free trial. Starter is free forever; the only thing a date can
 * ever mean is "what a paying customer paid through".
 *
 * `trialExpiresAt` keeps its historical name because it is written by the
 * billing flow and read by the admin panel, but it is now purely a paid-period
 * deadline. What it means depends entirely on `plan`:
 *
 * - `starter` (the free plan) — never expires, so any date here is ignored.
 *   Older accounts still carry a leftover trial date from when signup wrote
 *   one; ignoring it is what keeps those users from being locked out. A free
 *   user keeps the base app (POS, inventory, customers, reports) forever,
 *   capped at 50 products.
 * - `pro` / `business` — the date is what the customer paid through. Once it
 *   passes they stop being a paying customer, so they fall back to `starter`:
 *   still fully able to run their shop, just without the paid features.
 * - `lifetime` access level — never expires, always Business.
 *
 * Nobody is locked out of the app for an expired date. Expiry downgrades; it
 * does not revoke.
 */

export type PlanId = 'starter' | 'pro' | 'business';

/** Maximum products per plan. Unlimited products for all plans. */
export const PRODUCT_LIMITS: Record<PlanId, number> = {
  starter: Infinity,
  pro: Infinity,
  business: Infinity,
};

/** Maximum staff accounts per plan. */
export const STAFF_LIMITS: Record<PlanId, number> = {
  starter: 1,
  pro: 5,
  business: 1000000,
};

/**
 * Monthly Zen AI **credit** allowance per plan.
 *
 * Credits, not messages. A turn costs one credit or twenty depending on the work it
 * does — see `src/lib/server/ai-credits.ts` for the token→credit derivation. Every
 * surface that renders these numbers must say "credits", because a shop promised 400
 * messages and cut off after 90 heavy ones has been lied to.
 *
 * ## Why these are small
 *
 * A credit costs the platform about **$0.006** of Gemini: `TOKENS_PER_CREDIT` is 20,000
 * weighted tokens, and the weighting exists so that figure holds however the tokens
 * split — 20,000 input at $0.30/1M is $0.0060, and the 2,500 output tokens that weigh
 * the same at $2.50/1M is $0.00625. The allowance is given away, so it is pure cost with
 * no revenue against it, and it has to be costed against the plan price rather than
 * waved through:
 *
 * | Plan     | Credits | Gemini cost | Plan price   | AI as % of revenue |
 * |----------|---------|-------------|--------------|--------------------|
 * | starter  | 3       | $0.018      | free         | pure cost          |
 * | pro      | 150     | $0.90       | ₦10,000 ≈ $6.67 | 13%             |
 * | business | 600     | $3.60       | ₦30,000 ≈ $20   | 18%             |
 *
 * These fell from 15/400/1,500, where Pro was 36% of revenue and Business 45% — before
 * Firestore, hosting or support. That is not a margin, and the shops that used the full
 * allowance were the ones costing the most while paying the same.
 *
 * `TOKENS_PER_CREDIT` was deliberately **not** touched to achieve this. Lowering it would
 * have made every credit buy less work, including credits already sitting on an account
 * as a grant — the number a shop was told it had would quietly be worth less than when
 * it was given. The allowance is a gift and can be resized; a balance already handed
 * over is a promise and cannot.
 *
 * **This allowance is the only way to get credits.** Overflow used to be sold as one-off
 * packs through `aiBonusCredits`; that product is scrapped, so a shop that needs more AI
 * moves up a tier. Which means these numbers *are* the AI product — an allowance too
 * small to work with cannot be topped up any more, it can only be upgraded past.
 * `aiBonusCredits` survives as the super-admin grant on `/admin-imamshaffy/ai-usage`.
 *
 * **Starter is 3, and that is intentional.** It is enough to watch Zen answer a question
 * or read one photograph — enough to want it — and nowhere near enough to run a shop on.
 * A free plan that cannot try Zen at all cannot sell Zen; a free plan that can run a
 * business on it will never sell anything.
 *
 * Changing any of these means changing the four places they are hand-typed: `plans.proF5`
 * and `plans.bizF3` across all eleven catalogs in `src/lib/i18n/messages/`,
 * `use-cases/page.tsx`, and `help-center/page.tsx`. A stale marketing number is a promise
 * the product then breaks.
 */
export const AI_MONTHLY_LIMITS: Record<PlanId, number> = {
  starter: 3,
  pro: 150,
  business: 600,
};

/**
 * List price per month. Must match `components/settings/subscription-section.tsx`
 * and the marketing pages — this is the same number, not an approximation of it.
 *
 * Lives here because MRR is computed from the plan a business is on rather than
 * from what it last paid: an annual subscriber pays twelve months at once, and
 * counting the cheque as one month's revenue understates the run rate as badly
 * as counting it as twelve overstates it.
 */
export const PLAN_MONTHLY_PRICE: Record<PlanId, { NGN: number; USD: number }> = {
  starter: { NGN: 0, USD: 0 },
  pro: { NGN: 10_000, USD: 10 },
  business: { NGN: 30_000, USD: 30 },
};

/** Only these plans are ever bought, so only these can lapse. */
const PAID_PLANS: PlanId[] = ['pro', 'business'];

type BusinessLike = {
  plan?: string | null;
  accessLevel?: string | null;
  status?: string | null;
  trialExpiresAt?: any;
  createdAt?: any;
} | null | undefined;

/** True when the business bought Pro or Business (regardless of expiry). */
export function isPaidPlan(business: BusinessLike): boolean {
  return PAID_PLANS.includes((business?.plan || '') as PlanId);
}

/**
 * True when a *purchased* plan has run past the date it was paid through.
 * Always false for free users — the free plan has nothing to expire — and
 * always false for lifetime access.
 */
export function isPaidPlanExpired(business: BusinessLike): boolean {
  if (!business) return false;
  if (business.accessLevel === 'lifetime') return false;
  if (!isPaidPlan(business)) return false;
  if (!business.trialExpiresAt) return false;

  const expiry = safeToDate(business.trialExpiresAt);
  if (!expiry || Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() <= Date.now();
}

/**
 * Number of days remaining in the 30-day trial for Starter users.
 * Paid plans or lifetime access return 0.
 */
export function getTrialDaysRemaining(business: BusinessLike): number {
  if (!business) return 0;
  if (business.accessLevel === 'lifetime') return 0;
  if (isPaidPlan(business)) return 0;
  if (business.plan && business.plan !== 'starter') return 0;

  const created = safeToDate(business.createdAt);
  if (!created || Number.isNaN(created.getTime()) || created.getTime() === 0) return 0;

  const now = new Date();
  const diffTime = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const remaining = 30 - diffDays;
  return Math.max(0, remaining);
}

/**
 * True when a Starter plan is older than 30 days.
 */
export function isTrialExpired(business: BusinessLike): boolean {
  if (!business) return false;
  if (business.accessLevel === 'lifetime') return false;
  if (isPaidPlan(business)) return false;
  if (business.plan && business.plan !== 'starter') return false;

  const created = safeToDate(business.createdAt);
  // If we have no createdAt, we assume it's an old account and the trial is expired.
  if (!created || Number.isNaN(created.getTime()) || created.getTime() === 0) return true;

  const now = new Date();
  const diffTime = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 30;
}

/**
 * Core features (Checkout, Adding Products, etc) are available for all active businesses.
 * Lapsed paid plans downgrade to Starter rather than blocking POS sales.
 */
export function isCoreFeatureBlocked(business: BusinessLike): boolean {
  if (!business) return false;
  if (business.status === 'deleted' || business.status === 'blocked') return true;
  if (business.accessLevel === 'lifetime') return false;
  // Paid plans or free starter plans are allowed to run core POS operations
  return false;
}

/**
 * The plan whose entitlements actually apply right now.
 *
 * Gate every paid feature on this rather than on `business.plan`, so a lapsed
 * subscription cleanly stops unlocking what it used to unlock.
 */
export function effectivePlan(business: BusinessLike): PlanId {
  if (!business) return 'starter';
  if (business.accessLevel === 'lifetime') return 'business';
  if (isPaidPlanExpired(business)) return 'starter';

  const plan = business.plan;
  if (plan === 'pro' || plan === 'business') return plan;
  return 'starter';
}

/** Product cap in force right now. */
export function productLimit(business: BusinessLike): number {
  return PRODUCT_LIMITS[effectivePlan(business)];
}

/** Staff-account cap in force right now. */
export function staffLimit(business: BusinessLike): number {
  return STAFF_LIMITS[effectivePlan(business)];
}

/** Monthly Zen AI allowance in force right now. */
export function aiMonthlyLimit(business: BusinessLike): number {
  return AI_MONTHLY_LIMITS[effectivePlan(business)];
}

/** Pro-tier features: also available to Business and lifetime. */
export function hasProFeatures(business: BusinessLike): boolean {
  const plan = effectivePlan(business);
  return plan === 'pro' || plan === 'business';
}

/** Business-tier only features. */
export function hasBusinessFeatures(business: BusinessLike): boolean {
  return effectivePlan(business) === 'business';
}

/**
 * Whether the base app is usable.
 *
 * An expired date is deliberately *not* part of this. The free plan never
 * expires, and a lapsed paid plan downgrades to it, so no date locks anyone
 * out. Only a business that has actually been removed is shut off.
 */
export function isSubscriptionActive(business: BusinessLike): boolean {
  if (!business) return true;
  return business.status !== 'deleted';
}

/**
 * True when a paying customer has just lapsed and should be nudged to renew.
 * Drives upsell copy only — never access.
 */
export function shouldPromptRenewal(business: BusinessLike): boolean {
  return isPaidPlanExpired(business);
}
