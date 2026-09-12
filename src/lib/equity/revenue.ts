'use client';

/**
 * Zeneva's own trading figures, for the Valuation tab.
 *
 * The cap table engine is pure and takes revenue as an input; this is the piece
 * that goes and gets it. Kept out of `engine.ts` deliberately — it touches
 * Firestore and React, and the arithmetic in the engine is worth being able to
 * reason about without either.
 *
 * The definitions themselves — which collection is Zeneva's revenue, how a
 * dollar payment converts, which accounts are the company's own, and why MRR is
 * read off live plans rather than recent payments — live in
 * `src/lib/platform-revenue.ts`, shared with the admin dashboard so the two
 * cannot quote different revenue. Read that first. What is left here is the
 * Firestore read, the trailing-twelve-month window, and the cap-table-specific
 * pieces (capital raised from closed rounds).
 */

import * as React from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import {
  INTERNAL_ACCOUNT_EMAILS,
  billingCurrencyByBusiness,
  subscriptionRunRate,
  toNgn,
  type SubscriberLike,
} from '@/lib/platform-revenue';
import type { EquityRecord, RevenueInputs } from './types';
import { isKind } from './types';
import { toDate } from './engine';

export interface PurchaseLike {
  amount?: number;
  currency?: string;
  plan?: string;
  businessId?: string;
  timestamp?: any;
  /**
   * `'credits'` for a one-off Zen AI top-up; missing or `'subscription'` otherwise.
   *
   * Deliberately **not** filtered out of the lifetime and trailing-twelve-month
   * figures below: a pack sale is money Zeneva received, and those are revenue
   * totals rather than rates. The one place it would do damage — MRR — never
   * touches this list, because `subscriptionRunRate` reads live plans instead, and
   * `billingCurrencyByBusiness` already skips packs itself.
   */
  kind?: string | null;
}

/**
 * Same shape the run-rate helper takes, aliased so this module's own signatures
 * read in its own terms.
 */
export type BusinessLike = SubscriberLike;

export interface RevenueSnapshot extends RevenueInputs {
  /** Purchase documents counted. Shown so a zero can be told from a failed read. */
  purchaseCount: number;
  /** True when at least one purchase was in USD and got converted at a fixed rate. */
  usdConverted: boolean;
  /** Businesses on a paid plan that has not lapsed — the MRR base. */
  activeSubscriptions: number;
  /**
   * Businesses that have paid at any point, including ones that have since
   * lapsed. Bigger than `payingCustomers` and a different question: this is reach,
   * that is the run rate's base.
   */
  everPaidCustomers: number;
  /** Lifetime-access businesses: real customers, but contributing no MRR. */
  lifetimeAccounts: number;
  /** Payments from the company's own accounts, left out of every figure above. */
  internalRevenueExcluded: number;
  internalPurchasesExcluded: number;
}

/**
 * Fold purchases, businesses and closed rounds into the figures the valuation
 * needs. Pure — every input is passed in, including `asOf`.
 */
export function computeRevenueSnapshot({
  purchases,
  businesses,
  records,
  internalOwnerIds,
  asOf,
}: {
  purchases: PurchaseLike[];
  businesses: BusinessLike[];
  records: EquityRecord[];
  /** Auth uids of the company's own accounts — see INTERNAL_ACCOUNT_EMAILS. */
  internalOwnerIds: Set<string>;
  asOf: Date;
}): RevenueSnapshot {
  const businessById = new Map(businesses.map((b) => [b.id, b]));
  const isInternal = (businessId: string | undefined) => {
    const ownerId = businessId ? businessById.get(businessId)?.ownerId : null;
    return Boolean(ownerId && internalOwnerIds.has(ownerId));
  };

  let lifetimeRevenue = 0;
  let trailingTwelveMonthRevenue = 0;
  let internalRevenueExcluded = 0;
  let internalPurchasesExcluded = 0;
  let counted = 0;
  let usdConverted = false;

  const twelveMonthsAgo = new Date(asOf);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  for (const p of purchases) {
    const ngn = toNgn(p.amount ?? 0, p.currency);
    if (ngn <= 0) continue;

    if (isInternal(p.businessId)) {
      internalRevenueExcluded += ngn;
      internalPurchasesExcluded += 1;
      continue;
    }

    if ((p.currency ?? 'NGN').toUpperCase() === 'USD') usdConverted = true;

    lifetimeRevenue += ngn;
    counted += 1;

    // An undated purchase counts toward lifetime but not toward the trailing
    // window — guessing a date either way would move a valuation input.
    const at = toDate(p.timestamp);
    if (at && at >= twelveMonthsAgo && at <= asOf) trailingTwelveMonthRevenue += ngn;
  }

  // MRR from who is subscribed right now, at list price — the same helper the
  // MRR from who is subscribed right now, based on verified purchases.
  const { mrr, activeSubscriptions, lifetimeAccounts } = subscriptionRunRate({
    businesses,
    internalOwners: internalOwnerIds,
    billingCurrencies: billingCurrencyByBusiness(purchases),
    purchases,
  });

  // Only closed rounds. A planned round is a hope, and adding its cash to the
  // valuation would price money that has not arrived.
  const capitalRaised = records
    .filter(isKind('round'))
    .filter((r) => r.status === 'closed')
    .reduce((sum, r) => sum + Math.max(0, Number(r.amountRaised) || 0), 0);

  const payingCustomers = new Set(
    purchases
      .filter((p) => !isInternal(p.businessId))
      .map((p) => p.businessId)
      .filter((id): id is string => Boolean(id)),
  ).size;

  return {
    lifetimeRevenue,
    trailingTwelveMonthRevenue,
    mrr,
    // Deliberately the *active* count, not the historical one. This feeds the
    // concentration warning in `revenueValuation`, which says the run rate rests
    // on N customers — and a business that stopped paying two years ago is not
    // holding up the run rate.
    payingCustomers: activeSubscriptions,
    capitalRaised,
    asOf,
    purchaseCount: counted,
    usdConverted,
    activeSubscriptions,
    everPaidCustomers: payingCustomers,
    lifetimeAccounts,
    internalRevenueExcluded,
    internalPurchasesExcluded,
  };
}

// ---------------------------------------------------------------------------
// The read.
// ---------------------------------------------------------------------------

interface RawBooks {
  purchases: PurchaseLike[];
  businesses: BusinessLike[];
  internalOwnerIds: Set<string>;
}

/**
 * Module-scoped, so switching tabs and coming back does not pay for the read
 * again. Radix unmounts an inactive `TabsContent`, so without this every visit
 * to the Valuation tab would re-query both collections. Lives for the lifetime
 * of the page; `refresh()` clears it.
 */
let cachedBooks: RawBooks | null = null;
let inflight: Promise<RawBooks> | null = null;

async function readBooks(firestore: Firestore, selfUid: string): Promise<RawBooks> {
  const [purchasesSnap, businessesSnap, internalUsersSnap] = await Promise.all([
    getDocs(query(collection(firestore, 'purchases'))),
    getDocs(query(collection(firestore, 'businessInstances'))),
    // Two documents, not the whole user list: equality on one field is
    // auto-indexed, so this needs no composite index and costs almost nothing.
    // Tolerated failing — `selfUid` below covers the account actually signed in,
    // and the UI reports what was excluded rather than claiming completeness.
    getDocs(
      query(collection(firestore, 'users'), where('email', 'in', INTERNAL_ACCOUNT_EMAILS)),
    ).catch(() => null),
  ]);

  // Whoever is reading this page is the platform owner, so their own business is
  // internal by definition — free, and it covers a stored email whose casing does
  // not match the list above.
  const internalOwnerIds = new Set<string>([selfUid]);
  internalUsersSnap?.docs.forEach((d) => internalOwnerIds.add(d.id));

  return {
    purchases: purchasesSnap.docs.map((d) => d.data() as PurchaseLike),
    businesses: businessesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as BusinessLike),
    internalOwnerIds,
  };
}

/**
 * Read the collections the snapshot needs.
 *
 * `enabled` gates the whole thing so opening the cap table costs nothing — the
 * fetch only happens once the Valuation tab is actually opened, and the result
 * is cached for the rest of the page's life. The owner pays this bill.
 */
export function useRevenueSnapshot(
  enabled: boolean,
  records: EquityRecord[],
): {
  snapshot: RevenueSnapshot | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const firestore = useFirestore();
  const { user } = useUser();
  const selfUid = user?.uid ?? null;

  const [books, setBooks] = React.useState<RawBooks | null>(cachedBooks);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    // Waits for the uid rather than fetching without it. The owner's own business
    // is excluded by uid, and the result is cached — so a read that started
    // before auth resolved would latch a snapshot that counts the founder's own
    // test business as a paying customer, and nothing would ever correct it.
    if (!enabled || !firestore || !selfUid) return;
    if (cachedBooks) {
      setBooks(cachedBooks);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    // Shared across mounts, so two components asking at once make one round trip.
    inflight = inflight ?? readBooks(firestore as Firestore, selfUid);

    void inflight
      .then((result) => {
        cachedBooks = result;
        if (!cancelled) {
          setBooks(result);
          setError(null);
        }
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || 'Could not read the revenue figures.');
      })
      .finally(() => {
        inflight = null;
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, firestore, selfUid, attempt]);

  const refresh = React.useCallback(() => {
    cachedBooks = null;
    inflight = null;
    setBooks(null);
    setAttempt((n) => n + 1);
  }, []);

  const snapshot = React.useMemo(() => {
    if (!books) return null;
    return computeRevenueSnapshot({
      purchases: books.purchases,
      businesses: books.businesses,
      records,
      internalOwnerIds: books.internalOwnerIds,
      asOf: new Date(),
    });
  }, [books, records]);

  return { snapshot, isLoading, error, refresh };
}
