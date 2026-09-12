/**
 * Customer segments — who to talk to, and why.
 *
 * Pure, and **`now` is an input**, the house rule from `src/lib/forensics.ts` and
 * `src/lib/business-rating.ts`. A segment that changes because the clock moved has
 * to be explainable, and it cannot be if the function reads the clock itself.
 *
 * ## The honesty problem this module has to survive
 *
 * Customers sync in **full** (`fetchFullCustomers` paginates until exhausted), but
 * receipts do not: the listener holds the most recent **200**. So any segment
 * defined by the *absence* of a receipt is mostly measuring the receipt cap, not
 * the customer.
 *
 * `docs/business-rating.md` records what happens when that is ignored — valuing
 * every customer with no recent receipt at the shop's average basket produced
 * *"Win back 2,900 quiet buyers · ₦14.5M"*, a headline that measured the listener
 * limit and made an owner distrust the whole page.
 *
 * The same split is applied here:
 *
 * - **Observed segments** (`vip`, `loyal`, `new`, `at-risk`, `owing`) all require a
 *   receipt we actually hold. They are safe to count and safe to price.
 * - **`lapsed`** requires an observed receipt too — bought inside the window,
 *   nothing in the last 30 days — so each of these people has a real basket
 *   history of their own.
 * - **`never-seen`** is the dangerous one: on file, no receipt in what we hold.
 *   It is **counted, never priced**, and `SegmentSummary.reliable` is `false`
 *   whenever the receipt set looks truncated, so callers can caption it instead of
 *   asserting it.
 *
 * Money, where quoted, uses **each buyer's own average basket**, never the
 * shop-wide average. A quiet ₦2,000 buyer is worth ₦2,000.
 */

import { safeToDate } from '@/lib/utils';
import type { Customer, Receipt } from '@/types';

/** Matches the rating's window so the two features cannot disagree. */
export const SEGMENT_WINDOW_DAYS = 60;
/** Matches `DORMANT_AFTER_DAYS` in business-rating.ts. */
export const AT_RISK_AFTER_DAYS = 30;
/** Beyond this, "at risk" has become "lapsed". */
export const LAPSED_AFTER_DAYS = 60;
/** Orders that make someone a repeat customer rather than a one-off. */
export const LOYAL_MIN_ORDERS = 3;
/** Orders that mark the top tier. Spend alone is a single lucky sale. */
export const VIP_MIN_ORDERS = 5;
/** A buyer whose first observed purchase is this recent is still "new". */
export const NEW_WITHIN_DAYS = 30;
/** The receipt listener's own cap. At or above it, absence proves nothing. */
const LISTENER_CAP = 200;

export type SegmentKey =
  | 'vip'
  | 'loyal'
  | 'new'
  | 'at-risk'
  | 'lapsed'
  | 'owing'
  | 'never-seen';

export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  vip: 'VIP',
  loyal: 'Loyal',
  new: 'New',
  'at-risk': 'At risk',
  lapsed: 'Lapsed',
  owing: 'Owing',
  'never-seen': 'No purchases on record',
};

/**
 * The i18n key for a segment's badge label, so a translated surface does not
 * need its own copy of the mapping.
 *
 * `SEGMENT_LABELS` stays because this module is pure — it must not reach for
 * `useI18n` — and because it is still the fallback anywhere that has no `t`.
 * A per-page copy of this map is the drift trap: two surfaces render the same
 * badge, and the second one to be translated silently keeps the first one's
 * stale key names. Note the hyphenated keys cannot be derived by casing alone
 * (`at-risk` → `segmentAtRisk`), which is why this is a table and not a regex.
 */
const SEGMENT_LABEL_KEYS: Record<SegmentKey, string> = {
  vip: 'customers.segmentVip',
  loyal: 'customers.segmentLoyal',
  new: 'customers.segmentNew',
  'at-risk': 'customers.segmentAtRisk',
  lapsed: 'customers.segmentLapsed',
  owing: 'customers.segmentOwing',
  'never-seen': 'customers.segmentNeverSeen',
};

export function segmentLabelKey(key: SegmentKey): string {
  return SEGMENT_LABEL_KEYS[key];
}

export const SEGMENT_HINTS: Record<SegmentKey, string> = {
  vip: `${VIP_MIN_ORDERS}+ purchases and in your top spenders — the people worth keeping happy.`,
  loyal: `${LOYAL_MIN_ORDERS}+ purchases and still active.`,
  new: `First purchase in the last ${NEW_WITHIN_DAYS} days.`,
  'at-risk': `Bought before, but nothing in ${AT_RISK_AFTER_DAYS} days. Still warm.`,
  lapsed: `Nothing in ${LAPSED_AFTER_DAYS} days. Worth a reason to come back.`,
  owing: 'Has an unpaid or pending sale on record.',
  'never-seen': 'On file with no purchase in the sales history held on this device.',
};

export type CustomerMetrics = {
  customerId: string;
  orders: number;
  /** Spend across the receipts we hold, not lifetime `totalSpent`. */
  observedSpend: number;
  /** This buyer's own average basket. Zero when they have no observed orders. */
  ownBasket: number;
  firstSeen: Date | null;
  lastSeen: Date | null;
  daysSinceLastPurchase: number | null;
  /** Unpaid + pending receipt value we can see. A floor, never a total. */
  outstanding: number;
  segments: SegmentKey[];
  /** The one segment to show as a badge — most actionable wins. */
  primarySegment: SegmentKey | null;
};

export type SegmentSummary = {
  counts: Record<SegmentKey, number>;
  /**
   * Recoverable value for `at-risk` + `lapsed` only, each buyer at their own
   * basket. `never-seen` contributes nothing — see the header.
   */
  winBackValue: number;
  /**
   * False when the receipt set is at the listener cap and does not cover the
   * window, so "no purchases on record" cannot be trusted as "never bought".
   */
  reliable: boolean;
  /** Days of sales history the receipt set actually covers. */
  coveredDays: number;
  receiptCount: number;
};

export type SegmentResult = {
  byCustomerId: Map<string, CustomerMetrics>;
  summary: SegmentSummary;
};

const DAY_MS = 86_400_000;

function realDate(value: any): Date | null {
  const d = safeToDate(value);
  return d.getTime() > 0 ? d : null;
}

/**
 * Priority for the single badge shown on a row.
 *
 * Ordered by what the shop should do about it, not by how flattering it is. "Owing"
 * outranks "VIP" because money owed is the thing with a deadline; a VIP who owes
 * you money is, today, someone who owes you money.
 */
const BADGE_PRIORITY: SegmentKey[] = [
  'owing',
  'lapsed',
  'at-risk',
  'vip',
  'loyal',
  'new',
  'never-seen',
];

export function computeCustomerSegments(input: {
  customers: Customer[] | null | undefined;
  receipts: Receipt[] | null | undefined;
  now: Date;
}): SegmentResult {
  const { customers, receipts, now } = input;
  const nowMs = now.getTime();
  const windowStart = nowMs - SEGMENT_WINDOW_DAYS * DAY_MS;

  type Acc = {
    orders: number;
    spend: number;
    first: Date | null;
    last: Date | null;
    outstanding: number;
  };
  const acc = new Map<string, Acc>();

  let oldest = Infinity;
  let newest = -Infinity;
  const list = receipts || [];

  for (const r of list) {
    if (!r) continue;
    const at = realDate(r.createdAt);
    if (at) {
      const t = at.getTime();
      if (t < oldest) oldest = t;
      if (t > newest) newest = t;
    }

    const cid = r.customer?.id;
    if (!cid) continue; // anonymous sale: real revenue, but nobody to segment

    let entry = acc.get(cid);
    if (!entry) {
      entry = { orders: 0, spend: 0, first: null, last: null, outstanding: 0 };
      acc.set(cid, entry);
    }
    entry.orders += 1;
    entry.spend += Number(r.total) || 0;
    if (at) {
      if (!entry.first || at < entry.first) entry.first = at;
      if (!entry.last || at > entry.last) entry.last = at;
    }
    const status = r.status ?? 'paid';
    const isUnpaid = r.paymentMethod === 'Invoice' && status === 'unpaid';
    const isPending = r.paymentMethod === 'Invoice' && status === 'pending';
    if (isUnpaid || isPending) {
      entry.outstanding += Number(r.total) || 0;
    }
  }

  const coveredDays =
    Number.isFinite(oldest) && Number.isFinite(newest)
      ? Math.max(0, Math.round((newest - oldest) / DAY_MS))
      : 0;
  // At the cap and not covering the window: absence of a receipt proves nothing.
  const reliable = !(list.length >= LISTENER_CAP && coveredDays < SEGMENT_WINDOW_DAYS);

  // The VIP spend floor is the shop's own top decile of observed spend, not a
  // hardcoded figure — ₦100,000 means something different in every shop, and the
  // detail page's old `totalSpent > 100000 ? 'VIP'` was exactly that mistake.
  const spends = [...acc.values()].map(a => a.spend).sort((a, b) => b - a);
  const vipSpendFloor = spends.length > 0 ? spends[Math.floor(spends.length * 0.1)] ?? spends[0] : 0;

  const counts: Record<SegmentKey, number> = {
    vip: 0,
    loyal: 0,
    new: 0,
    'at-risk': 0,
    lapsed: 0,
    owing: 0,
    'never-seen': 0,
  };
  let winBackValue = 0;

  const byCustomerId = new Map<string, CustomerMetrics>();

  for (const c of customers || []) {
    if (!c?.id) continue;
    const a = acc.get(c.id);
    const orders = a?.orders ?? 0;
    const observedSpend = a?.spend ?? 0;
    const ownBasket = orders > 0 ? observedSpend / orders : 0;
    const lastSeen = a?.last ?? null;
    const firstSeen = a?.first ?? null;
    const outstanding = a?.outstanding ?? 0;

    const daysSince =
      lastSeen !== null ? Math.max(0, Math.floor((nowMs - lastSeen.getTime()) / DAY_MS)) : null;

    const segments: SegmentKey[] = [];

    if (outstanding > 0) segments.push('owing');

    if (orders === 0) {
      segments.push('never-seen');
    } else {
      if (daysSince !== null && daysSince >= LAPSED_AFTER_DAYS) {
        segments.push('lapsed');
      } else if (daysSince !== null && daysSince >= AT_RISK_AFTER_DAYS) {
        segments.push('at-risk');
      }

      if (orders >= VIP_MIN_ORDERS && observedSpend >= vipSpendFloor) {
        segments.push('vip');
      } else if (orders >= LOYAL_MIN_ORDERS) {
        segments.push('loyal');
      }

      // "New" is about the relationship, so it keys on the first purchase we can
      // see, and only when the window actually reaches back far enough to be sure
      // this is their first rather than the oldest one we happen to hold.
      if (
        firstSeen !== null &&
        firstSeen.getTime() >= windowStart &&
        nowMs - firstSeen.getTime() <= NEW_WITHIN_DAYS * DAY_MS &&
        (reliable || firstSeen.getTime() > oldest)
      ) {
        segments.push('new');
      }
    }

    for (const s of segments) counts[s] += 1;

    // Only observed buyers get a money figure, at their own basket.
    if (segments.includes('lapsed') || segments.includes('at-risk')) {
      winBackValue += ownBasket;
    }

    const primarySegment = BADGE_PRIORITY.find(k => segments.includes(k)) ?? null;

    byCustomerId.set(c.id, {
      customerId: c.id,
      orders,
      observedSpend,
      ownBasket,
      firstSeen,
      lastSeen,
      daysSinceLastPurchase: daysSince,
      outstanding,
      segments,
      primarySegment,
    });
  }

  return {
    byCustomerId,
    summary: {
      counts,
      winBackValue,
      reliable,
      coveredDays,
      receiptCount: list.length,
    },
  };
}

/** Segments worth offering as filters, in the order they should appear. */
export const FILTERABLE_SEGMENTS: SegmentKey[] = [
  'vip',
  'loyal',
  'new',
  'at-risk',
  'lapsed',
  'owing',
  'never-seen',
];
