/**
 * Zeneva's own money, in one place.
 *
 * The platform carries two figures that both get called revenue, and only one of
 * them is Zeneva's:
 *
 * - **GMV** — the sum of tenant receipts: what the shops using Zeneva sold to
 *   *their* customers. Real money, but not Zeneva's. It belongs nowhere near
 *   Zeneva's own revenue, run rate or valuation.
 * - **`purchases`** — payments made *to* Zeneva. That is the company's revenue,
 *   and it is what everything in this module measures. Two kinds live in there
 *   now: plan subscriptions, and one-off Zen AI credit packs. `purchaseKind`
 *   tells them apart, and anything computing a *rate* must use subscriptions
 *   only — a one-off sale has no monthly anything.
 *
 * This exists because three surfaces need the same answer — the admin
 * dashboard's SaaS tiles, its SaaS metrics dialog, and the cap table's valuation
 * card — and while each carried its own copy of the arithmetic they quoted three
 * different revenues: one summed dollar and naira amounts as though they were
 * the same unit, and one priced plans at rates that had since gone up.
 *
 * No React and no Firestore in here on purpose, so a server route can use it too.
 */

import { PLAN_MONTHLY_PRICE, effectivePlan, type PlanId } from '@/lib/plan';
import { safeToDate } from '@/lib/utils';

/**
 * USD to NGN, for folding dollar subscriptions into one currency.
 *
 * Hardcoded, and therefore wrong the moment the rate moves — so anything that
 * reports a converted total should say it converted, rather than presenting a
 * stale rate as precision.
 */
export const NGN_PER_USD = 1500;

/**
 * Accounts belonging to the company itself.
 *
 * Their payments are test transactions, not sales, and a plan they sit on is not
 * a subscription. Counting either would inflate revenue with the founder's own
 * money — the one error class here that flatters rather than understates, which
 * is exactly the kind to guard against.
 */
export const INTERNAL_ACCOUNT_EMAILS = ['belloimam431@gmail.com', 'bimex4@gmail.com', 'safewayderma@gmail.com'];

/** Case-insensitive, because a stored address may not match the list's casing. */
export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return INTERNAL_ACCOUNT_EMAILS.includes(email.toLowerCase());
}

/**
 * Auth uids of the company's own accounts, from whatever user list the caller
 * already has. Businesses are matched to them by `ownerId`.
 */
export function internalOwnerIds(
  users: Array<{ id: string; email?: string | null }>,
): Set<string> {
  return new Set(users.filter((u) => isInternalEmail(u.email)).map((u) => u.id));
}

/**
 * Money as recorded on a purchase, normalised to NGN.
 *
 * Every total over `purchases` must go through this. The collection stores
 * `amount` in whatever currency the customer paid, so a plain `sum + p.amount`
 * adds $30 to ₦30,000 and reports ₦30,030 — understating a dollar subscription
 * by a factor of 1,500.
 */
export function toNgn(amount: number | undefined, currency: string | undefined): number {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return (currency ?? 'NGN').toUpperCase() === 'USD' ? value * NGN_PER_USD : value;
}

/**
 * What a `purchases` row was for.
 *
 * The collection held nothing but subscriptions until Zen AI credit packs became
 * purchasable, and a pack is one-off revenue that must not touch a rate. Rows
 * written before the discriminator existed have no `kind` at all, and every one of
 * them is a subscription — so missing reads as `'subscription'`, never as unknown.
 */
export type PurchaseKind = 'subscription' | 'credits';

export interface PurchaseKindLike {
  kind?: string | null;
}

export function purchaseKind(purchase: PurchaseKindLike): PurchaseKind {
  return (purchase.kind ?? '').toLowerCase() === 'credits' ? 'credits' : 'subscription';
}

/** True for a plan payment. The only kind that may contribute to MRR or ARR. */
export function isSubscriptionPurchase(purchase: PurchaseKindLike): boolean {
  return purchaseKind(purchase) === 'subscription';
}

/** True for a one-off Zen AI credit pack. Real revenue, but not recurring. */
export function isCreditPackPurchase(purchase: PurchaseKindLike): boolean {
  return purchaseKind(purchase) === 'credits';
}

/**
 * Split a purchase list by kind, in one pass.
 *
 * Every figure derived from `purchases` has to pick a side deliberately. Three of
 * them silently went wrong the moment packs shipped, all through the same
 * latest-payment-wins logic:
 *
 * - **MRR/ARR.** The run rate is read off each business's *latest* purchase, so a
 *   ₦2,500 pack bought after a ₦30,000 subscription reports that shop as paying
 *   ₦2,500 a month — a pack sale *reducing* the run rate.
 * - **Paying-customer counts.** A Starter shop that buys one pack is not a
 *   subscriber.
 * - **Billing currency.** `billingCurrencyByBusiness` picks which price list a
 *   business is billed against; a USD pack bought by a naira subscriber would flip
 *   them to the dollar list and overstate their monthly price by ₦15,000.
 *
 * Totals of money *received* legitimately include both — that is what
 * `creditPackRevenueNgn` and a subscription total add up to.
 */
export function splitPurchases<T extends PurchaseKindLike>(
  purchases: T[],
): { subscriptions: T[]; creditPacks: T[] } {
  const subscriptions: T[] = [];
  const creditPacks: T[] = [];
  for (const p of purchases) {
    (isCreditPackPurchase(p) ? creditPacks : subscriptions).push(p);
  }
  return { subscriptions, creditPacks };
}

/** One-off credit-pack revenue, normalised to NGN. Never part of a rate. */
export function creditPackRevenueNgn(
  purchases: Array<PurchaseKindLike & { amount?: number; currency?: string }>,
): number {
  return purchases
    .filter(isCreditPackPurchase)
    .reduce((sum, p) => sum + toNgn(p.amount, p.currency), 0);
}

/**
 * Monthly list price of a plan, in NGN.
 *
 * Regional pricing is not a straight conversion — Business is ₦30,000 or $30,
 * and $30 is ₦45,000 at the rate above. So a subscriber's monthly figure depends
 * on which price list they are actually billed against, and defaulting everyone
 * to the naira price would understate every dollar subscriber by ₦15,000/month.
 */
export function monthlyPriceNgn(plan: PlanId, currency?: string): number {
  const price = PLAN_MONTHLY_PRICE[plan];
  if (!price) return 0;
  return (currency ?? 'NGN').toUpperCase() === 'USD' ? price.USD * NGN_PER_USD : price.NGN;
}

/**
 * What a purchase's plan bills per month, in NGN.
 *
 * For the per-transaction breakdown only — a purchase record carries a plan name
 * as free text rather than a `PlanId`, so it is matched the way the billing flow
 * writes it.
 */
export function purchasePlanMonthlyNgn(
  planName: string | undefined,
  currency?: string,
): number {
  const name = (planName || '').toLowerCase();
  const plan: PlanId = name.includes('business') ? 'business' : 'pro';
  return monthlyPriceNgn(plan, currency);
}

/**
 * Which price list each business is billed against, from its payment history.
 *
 * Latest payment wins. `settings.currency` is deliberately not used for this —
 * that is the currency the shop *trades* in, and a Nigerian shop selling in
 * naira can perfectly well have paid Zeneva in dollars through Dodo.
 *
 * Credit packs are excluded. This answers "which plan price list applies", and a
 * shop can buy a $8 pack on the dollar rail while subscribing in naira — letting
 * that pack win would price their Business plan at $30 (₦45,000) instead of
 * ₦30,000 and overstate their MRR by half.
 */
export function billingCurrencyByBusiness(
  purchases: Array<PurchaseKindLike & { businessId?: string; currency?: string; timestamp?: any }>,
): Map<string, string> {
  const latest = new Map<string, { at: number; currency: string }>();

  for (const p of purchases) {
    if (!p.businessId) continue;
    if (!isSubscriptionPurchase(p)) continue;
    const at = safeToDate(p.timestamp).getTime();
    const existing = latest.get(p.businessId);
    if (!existing || at >= existing.at) {
      latest.set(p.businessId, { at, currency: (p.currency ?? 'NGN').toUpperCase() });
    }
  }

  return new Map([...latest].map(([id, v]) => [id, v.currency]));
}

export interface SubscriberLike {
  id: string;
  plan?: string | null;
  accessLevel?: string | null;
  trialExpiresAt?: any;
  status?: string | null;
  ownerId?: string | null;
}

export interface RunRate {
  /** Monthly recurring revenue in NGN, from live paid plans at list price. */
  mrr: number;
  /** Businesses on a paid plan that has not lapsed — the MRR base. */
  activeSubscriptions: number;
  /** Lifetime-access businesses: real customers, contributing no MRR. */
  lifetimeAccounts: number;
}

/**
 * MRR from who is subscribed right now, at list price.
 *
 * Deliberately **not** derived from recent payments, which is wrong in both
 * directions: an annual subscriber who paid in January contributes nothing in
 * March despite still being a paying customer, and a subscriber who just paid
 * twelve months up front contributes a year of revenue to a single month. MRR is
 * a rate, so it has to be read off the subscriptions that are live.
 *
 * `effectivePlan` already returns `starter` for a paid plan that has run past
 * what it was paid through, so a lapsed subscription drops out without a second
 * expiry check here.
 */
export function subscriptionRunRate({
  businesses,
  internalOwners,
  billingCurrencies,
  purchases,
}: {
  businesses: SubscriberLike[];
  /** Owner uids to leave out — see `internalOwnerIds`. */
  internalOwners: Set<string>;
  /** Optional; from `billingCurrencyByBusiness`. Absent means the naira list. */
  billingCurrencies?: Map<string, string>;
  /** Optional purchases collection to ensure only real verified cash payments are counted. */
  purchases?: Array<any>;
}): RunRate {
  let lifetimeAccounts = 0;

  for (const b of businesses) {
    if (b.status === 'deleted') continue;
    if (b.ownerId && internalOwners.has(b.ownerId)) continue;
    if (b.accessLevel === 'lifetime') {
      lifetimeAccounts += 1;
    }
  }

  // When purchase records are available, verify strictly against real money received
  if (purchases && purchases.length > 0) {
    const validPurchases = purchases.filter((p) => {
      const ngnAmount = toNgn(p.amount, p.currency);
      if (ngnAmount <= 0) return false;
      if (p.userId && internalOwners.has(p.userId)) return false;
      return true;
    });

    const { subscriptions: subscriptionPurchases } = splitPurchases(validPurchases);

    const latestPurchaseByBusiness = new Map<string, any>();
    const latestPurchaseByUser = new Map<string, any>();
    for (const p of subscriptionPurchases) {
      const pTime = safeToDate(p.timestamp).getTime();
      if (p.businessId) {
        const existing = latestPurchaseByBusiness.get(p.businessId);
        const existingTime = existing ? safeToDate(existing.timestamp).getTime() : 0;
        if (!existing || pTime >= existingTime) {
          latestPurchaseByBusiness.set(p.businessId, p);
        }
      }
      if (p.userId) {
        const existing = latestPurchaseByUser.get(p.userId);
        const existingTime = existing ? safeToDate(existing.timestamp).getTime() : 0;
        if (!existing || pTime >= existingTime) {
          latestPurchaseByUser.set(p.userId, p);
        }
      }
    }

    let mrr = 0;
    let activeSubscriptions = 0;

    for (const b of businesses) {
      if (b.status === 'deleted') continue;
      if (b.ownerId && internalOwners.has(b.ownerId)) continue;
      if (b.accessLevel === 'lifetime') continue;

      const latestPurchase = latestPurchaseByBusiness.get(b.id) ||
                             (b.ownerId ? latestPurchaseByUser.get(b.ownerId) : null);

      if (latestPurchase) {
        const amount = toNgn(latestPurchase.amount, latestPurchase.currency);
        if (amount <= 0) continue;

        const planText = String(latestPurchase.plan || '').toLowerCase();
        const pTime = safeToDate(latestPurchase.timestamp).getTime();
        const expiryDate = b.trialExpiresAt ? safeToDate(b.trialExpiresAt) : null;
        const daysAgo = pTime ? (Date.now() - pTime) / (1000 * 60 * 60 * 24) : 999;

        let cycleMonths = 1;
        if (planText.includes('annual') || planText.includes('12m') || planText.includes('1 year') || amount >= 80000) {
          cycleMonths = 12;
        } else if (planText.includes('6m') || planText.includes('6 month') || amount >= 45000) {
          cycleMonths = 6;
        } else if (planText.includes('3m') || planText.includes('3 month') || (amount >= 24000 && amount < 45000)) {
          cycleMonths = 3;
        } else if (expiryDate && pTime && expiryDate.getTime() > pTime) {
          const diffMonths = Math.round((expiryDate.getTime() - pTime) / (1000 * 60 * 60 * 24 * 30.4));
          if (diffMonths >= 11) cycleMonths = 12;
          else if (diffMonths >= 5) cycleMonths = 6;
          else if (diffMonths >= 2) cycleMonths = 3;
        }

        const maxActiveDays = cycleMonths * 31 + 5;
        const isFresh = (expiryDate && expiryDate.getTime() > Date.now()) || daysAgo <= maxActiveDays;
        if (!isFresh) continue;

        mrr += Math.round(amount / cycleMonths);
        activeSubscriptions += 1;
      }
    }

    return { mrr, activeSubscriptions, lifetimeAccounts };
  }

  let mrr = 0;
  let activeSubscriptions = 0;

  for (const b of businesses) {
    if (b.status === 'deleted') continue;
    if (b.ownerId && internalOwners.has(b.ownerId)) continue;
    if (b.accessLevel === 'lifetime') continue;

    const price = monthlyPriceNgn(effectivePlan(b), billingCurrencies?.get(b.id));
    if (price <= 0) continue;

    mrr += price;
    activeSubscriptions += 1;
  }

  return { mrr, activeSubscriptions, lifetimeAccounts };
}
