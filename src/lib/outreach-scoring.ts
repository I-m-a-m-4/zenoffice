/**
 * Outreach scoring and segmentation.
 *
 * The Strategic Outreach tab used to sort businesses by `createdAt` and leave the
 * operator to guess who was worth an email. These are the pure functions behind the
 * replacement: they turn the business + user documents the admin page already loads
 * into a ranked, segmented list.
 *
 * Deliberately pure and dependency-free (no Firestore, no React, no network) so the
 * ranking can be unit-tested without emulators. The admin page supplies the data.
 *
 * Reuses `effectivePlan`/`isPaidPlanExpired` from '@/lib/plan' rather than reading
 * `business.plan` directly — a lapsed Pro must score as a free user, which is exactly
 * the distinction `effectivePlan` already encodes.
 */

import {
  effectivePlan,
  isPaidPlan,
  isPaidPlanExpired,
  PRODUCT_LIMITS,
  STAFF_LIMITS,
  type PlanId,
} from '@/lib/plan';
import { safeToDate } from '@/lib/utils';

/** Highest-value action to take for a business right now. */
export type OutreachSegment =
  | 'expired_paid'      // was paying, lapsed — the single best win-back
  | 'trial_ending'      // trial expires within TRIAL_WARN_DAYS
  | 'power_free'        // heavy free user near a plan cap — the upgrade ask
  | 'onboarding_stalled'// signed up, never really started
  | 'dormant'           // was active, has gone quiet
  | 'healthy_paid'      // paying and active; do not interrupt
  | 'active_free';      // using it, no upgrade signal yet

export type OutreachPriority = 'high' | 'medium' | 'low';

/** Shape the admin page already has in hand. Loose on purpose. */
export type OutreachBusinessLike = {
  id: string;
  businessName?: string | null;
  ownerEmail?: string | null;
  ownerName?: string | null;
  plan?: string | null;
  accessLevel?: string | null;
  status?: string | null;
  trialExpiresAt?: any;
  createdAt?: any;
  productCount?: number | null;
  receiptCount?: number | null;
  lastActivityAt?: any;
};

export type OutreachUserLike = {
  id: string;
  businessId?: string | null;
  email?: string | null;
  name?: string | null;
  lastSeen?: any;
  totalUsageSeconds?: number | null;
  pagesVisited?: number | null;
};

export type ScoredBusiness = {
  businessId: string;
  businessName: string;
  email: string | null;
  contactName: string | null;
  segment: OutreachSegment;
  priority: OutreachPriority;
  score: number;
  /** Human-readable drivers, highest-weight first. Rendered as chips in the UI. */
  reasons: string[];
  daysSinceSignup: number | null;
  daysSinceActive: number | null;
  daysUntilExpiry: number | null;
  plan: PlanId;
  productCount: number;
  receiptCount: number;
  /** False when there is no address to mail — the UI disables the send button. */
  contactable: boolean;
};

const DAY_MS = 86_400_000;

export const TRIAL_WARN_DAYS = 7;
export const DORMANT_DAYS = 21;
export const ONBOARDING_GRACE_DAYS = 3;
/** Fraction of the plan's product cap that counts as "power user". */
export const POWER_FREE_USAGE_RATIO = 0.6;

/**
 * Whole days between `value` and `now`; null when the timestamp is missing or junk.
 * Positive = in the past. Uses safeToDate, so Firestore Timestamps, Dates, ISO
 * strings and epoch numbers all work.
 */
export function daysAgo(value: any, now: number = Date.now()): number | null {
  if (value === null || value === undefined || value === '') return null;
  const date = safeToDate(value);
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.floor((now - date.getTime()) / DAY_MS);
}

/** Whole days until `value`; negative once past. Null when missing or junk. */
export function daysUntil(value: any, now: number = Date.now()): number | null {
  const past = daysAgo(value, now);
  return past === null ? null : -past;
}

/**
 * Most recent sign of life for a business: the latest `lastSeen` across its users,
 * falling back to the business's own `lastActivityAt`.
 *
 * Returns null when nothing is known — which is NOT the same as "inactive". A brand
 * new business with no telemetry must not be scored as dormant, so callers treat
 * null as unknown rather than as an infinitely old date.
 */
export function lastActivityFor(
  business: OutreachBusinessLike,
  users: OutreachUserLike[],
): Date | null {
  let latest: Date | null = null;

  for (const user of users) {
    const seen = safeToDate(user?.lastSeen);
    if (!seen || Number.isNaN(seen.getTime())) continue;
    if (!latest || seen.getTime() > latest.getTime()) latest = seen;
  }

  const own = safeToDate(business?.lastActivityAt);
  if (own && !Number.isNaN(own.getTime()) && (!latest || own.getTime() > latest.getTime())) {
    latest = own;
  }

  return latest;
}

/** Index users by businessId so scoring stays O(n) rather than O(n·m). */
export function groupUsersByBusiness(
  users: OutreachUserLike[] | null | undefined,
): Map<string, OutreachUserLike[]> {
  const byBusiness = new Map<string, OutreachUserLike[]>();
  for (const user of users || []) {
    const key = user?.businessId;
    if (!key) continue;
    const existing = byBusiness.get(key);
    if (existing) existing.push(user);
    else byBusiness.set(key, [user]);
  }
  return byBusiness;
}

/** Pick the account owner to address: the one seen most recently, else the first. */
function primaryContact(users: OutreachUserLike[]): OutreachUserLike | null {
  if (!users.length) return null;
  let best = users[0];
  let bestSeen = safeToDate(best?.lastSeen)?.getTime() ?? -Infinity;
  for (const user of users.slice(1)) {
    const seen = safeToDate(user?.lastSeen)?.getTime() ?? -Infinity;
    if (seen > bestSeen) {
      best = user;
      bestSeen = seen;
    }
  }
  return best;
}

/**
 * Classify a business and score how urgently it deserves an email (0-100).
 *
 * Segment order matters: the first matching branch wins, so the branches are
 * arranged most-actionable first. A lapsed payer who is also dormant should be
 * chased as a lapsed payer, because that is the email that recovers revenue.
 */
export function scoreBusiness(
  business: OutreachBusinessLike,
  users: OutreachUserLike[],
  now: number = Date.now(),
): ScoredBusiness {
  const plan = effectivePlan(business);
  const paid = isPaidPlan(business);
  const expired = isPaidPlanExpired(business);

  const productCount = Math.max(0, business.productCount ?? 0);
  const receiptCount = Math.max(0, business.receiptCount ?? 0);

  const daysSinceSignup = daysAgo(business.createdAt, now);
  const activity = lastActivityFor(business, users);
  const daysSinceActive = activity ? Math.floor((now - activity.getTime()) / DAY_MS) : null;
  // Only meaningful on a purchased plan: on starter, `trialExpiresAt` is legacy data
  // that means nothing (see the note at the top of '@/lib/plan').
  const daysUntilExpiry = paid ? daysUntil(business.trialExpiresAt, now) : null;

  const contact = primaryContact(users);
  const email = business.ownerEmail || contact?.email || null;

  const reasons: string[] = [];
  let segment: OutreachSegment;
  let score: number;

  // Unknown activity must not read as "inactive" — a business with no telemetry is
  // simply unmeasured, and treating that as dormant would spam every new signup.
  const quiet = daysSinceActive !== null && daysSinceActive >= DORMANT_DAYS;
  const neverTraded = receiptCount === 0;
  const settledIn = daysSinceSignup !== null && daysSinceSignup >= ONBOARDING_GRACE_DAYS;

  if (expired) {
    segment = 'expired_paid';
    score = 95;
    reasons.push('Paid plan lapsed');
    if (receiptCount > 0) reasons.push(`${receiptCount} sales recorded before lapsing`);
    if (quiet) reasons.push(`No activity for ${daysSinceActive} days`);
  } else if (paid && daysUntilExpiry !== null && daysUntilExpiry <= TRIAL_WARN_DAYS && daysUntilExpiry >= 0) {
    segment = 'trial_ending';
    score = 88;
    reasons.push(
      daysUntilExpiry === 0 ? 'Plan expires today' : `Plan expires in ${daysUntilExpiry} days`,
    );
    if (quiet) reasons.push('Not active recently — renewal at risk');
  } else if (!paid && isNearCap(productCount, users.length, plan)) {
    segment = 'power_free';
    score = 80;
    reasons.push(capReason(productCount, users.length, plan));
    if (receiptCount > 0) reasons.push(`${receiptCount} sales on the free plan`);
  } else if (neverTraded && settledIn) {
    segment = 'onboarding_stalled';
    // A signup that added products then stopped is closer to converting than one
    // that never got past the empty state, so it is worth more attention.
    score = productCount > 0 ? 70 : 55;
    reasons.push(
      productCount > 0
        ? `${productCount} products added but no sales yet`
        : 'No products or sales yet',
    );
    if (daysSinceSignup !== null) reasons.push(`Signed up ${daysSinceSignup} days ago`);
  } else if (quiet) {
    segment = 'dormant';
    score = paid ? 75 : 45;
    reasons.push(`No activity for ${daysSinceActive} days`);
    if (paid) reasons.push('Currently paying — churn risk');
  } else if (paid) {
    segment = 'healthy_paid';
    score = 12;
    reasons.push('Paying and active');
  } else {
    segment = 'active_free';
    score = 25;
    reasons.push('Active on the free plan');
    if (receiptCount > 0) reasons.push(`${receiptCount} sales recorded`);
  }

  if (!email) {
    // Unreachable accounts sink: they cannot be actioned, so they must not occupy
    // the top of a queue whose entire purpose is "who do I email next".
    score = Math.min(score, 10);
    reasons.push('No email address on file');
  }

  return {
    businessId: business.id,
    businessName: business.businessName || 'Unnamed business',
    email,
    contactName: business.ownerName || contact?.name || null,
    segment,
    priority: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    score,
    reasons,
    daysSinceSignup,
    daysSinceActive,
    daysUntilExpiry,
    plan,
    productCount,
    receiptCount,
    contactable: !!email,
  };
}

/** Free-plan account pressing against its product or staff cap. */
function isNearCap(productCount: number, staffCount: number, plan: PlanId): boolean {
  const products = PRODUCT_LIMITS[plan];
  const staff = STAFF_LIMITS[plan];
  const productPressure = Number.isFinite(products) && productCount >= products * POWER_FREE_USAGE_RATIO;
  const staffPressure = Number.isFinite(staff) && staffCount >= staff;
  return productPressure || staffPressure;
}

function capReason(productCount: number, staffCount: number, plan: PlanId): string {
  const products = PRODUCT_LIMITS[plan];
  if (Number.isFinite(products) && productCount >= products * POWER_FREE_USAGE_RATIO) {
    return `Using ${productCount} of ${products} products`;
  }
  return `${staffCount} staff on a ${STAFF_LIMITS[plan]}-seat plan`;
}

/**
 * Score every business and return them ranked, highest first.
 *
 * Ties break on recency of activity so that, between two equally-scored accounts,
 * the one that was in the app yesterday is contacted before one last seen in March.
 */
export function rankBusinesses(
  businesses: OutreachBusinessLike[] | null | undefined,
  users: OutreachUserLike[] | null | undefined,
  now: number = Date.now(),
): ScoredBusiness[] {
  const byBusiness = groupUsersByBusiness(users);

  return (businesses || [])
    .filter(b => b && b.id && b.status !== 'deleted')
    .map(b => scoreBusiness(b, byBusiness.get(b.id) || [], now))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aSeen = a.daysSinceActive ?? Number.MAX_SAFE_INTEGER;
      const bSeen = b.daysSinceActive ?? Number.MAX_SAFE_INTEGER;
      return aSeen - bSeen;
    });
}

/** Counts per segment, for the filter rail. Every segment key is always present. */
export function segmentCounts(scored: ScoredBusiness[]): Record<OutreachSegment, number> {
  const counts: Record<OutreachSegment, number> = {
    expired_paid: 0,
    trial_ending: 0,
    power_free: 0,
    onboarding_stalled: 0,
    dormant: 0,
    healthy_paid: 0,
    active_free: 0,
  };
  for (const row of scored) counts[row.segment] += 1;
  return counts;
}

/** Display metadata for each segment. Single source of truth for the UI. */
export const SEGMENT_META: Record<
  OutreachSegment,
  { label: string; blurb: string; tone: 'danger' | 'warn' | 'info' | 'good' }
> = {
  expired_paid: {
    label: 'Lapsed customers',
    blurb: 'Were paying, subscription has expired. Best win-back odds.',
    tone: 'danger',
  },
  trial_ending: {
    label: 'Expiring soon',
    blurb: `Plan runs out within ${TRIAL_WARN_DAYS} days.`,
    tone: 'warn',
  },
  power_free: {
    label: 'Ready to upgrade',
    blurb: 'Free accounts pressing against their plan limits.',
    tone: 'info',
  },
  onboarding_stalled: {
    label: 'Stalled setup',
    blurb: 'Signed up but never recorded a sale.',
    tone: 'warn',
  },
  dormant: {
    label: 'Gone quiet',
    blurb: `No activity in ${DORMANT_DAYS}+ days.`,
    tone: 'danger',
  },
  healthy_paid: {
    label: 'Healthy customers',
    blurb: 'Paying and active. No action needed.',
    tone: 'good',
  },
  active_free: {
    label: 'Active free users',
    blurb: 'Using the free plan, no upgrade signal yet.',
    tone: 'info',
  },
};
