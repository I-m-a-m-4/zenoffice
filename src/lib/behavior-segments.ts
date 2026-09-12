/**
 * Behavioural segmentation for email marketing.
 *
 * `outreach-scoring.ts` already segments accounts by their **commercial** state —
 * lapsed payer, trial ending, pressing against a plan cap. That is the axis the
 * dashboard's Follow-Up Center works on, and it is deliberately left alone.
 *
 * This module segments on the other axis: what people actually *do* in the app.
 * Everything it reads is already on the user document, written by
 * `UserActivityTracker` (`pageViews`, `pagesVisited`, `lastPage`, `lastSeen`) and
 * `useSessionTracker` (`totalUsageSeconds`). So a full behavioural picture of
 * every user on the platform costs exactly the `users` read the admin page was
 * doing anyway — no per-user subcollection fan-out, no extra queries.
 *
 * Pure and dependency-light on purpose (no Firestore, no React, no network) so
 * the classification can be reasoned about and unit-tested directly.
 *
 * ## Why receipt counts are not used here
 *
 * The obvious definition of "stalled onboarding" is "signed up, never made a
 * sale" — but `receiptCount` is **not a field on the business document**. The
 * admin dashboard derives it by loading the entire `receipts` collection and
 * grouping in memory (`admin-imamshaffy/page.tsx`, where `receiptCount` is
 * computed at the point it builds `scoredLeads`). Reading `business.receiptCount`
 * here would therefore be `undefined` for every business, and `?? 0` would
 * quietly classify the whole platform as stalled.
 *
 * The behavioural equivalent is both free and more precise: someone who has been
 * signed up for days, has clicked around, and has *never opened the selling
 * screens* has stalled — regardless of what the receipts collection says.
 */

import { effectivePlan, type PlanId } from '@/lib/plan';
import { daysAgo } from '@/lib/outreach-scoring';

/* ------------------------------------------------------------------ *
 * Feature families
 * ------------------------------------------------------------------ */

export type FeatureFamily =
  | 'selling'
  | 'inventory'
  | 'customers'
  | 'reports'
  | 'receipts'
  | 'ai'
  | 'store'
  | 'support';

/**
 * First path segment of a route key -> the product area it belongs to.
 *
 * `routeKey()` in UserActivityTracker joins path segments with `_` and collapses
 * dynamic ids to `:id`, so `/sales/pos/payment` arrives as `sales_pos_payment`
 * and `/customers/abc123` as `customers_:id`. Matching on the first segment is
 * therefore enough, and is stable against new sub-pages being added.
 *
 * Routes absent from this map are **ambient** and score toward no family:
 * `dashboard`, `settings`, `users`, `billing`, `onboarding`, `notifications`,
 * `achievements`, `audit-log`, `terminal-alerts`. `dashboard` matters most —
 * it is the post-login landing route, so every user on the platform has a large
 * count there. Counting it would make literally everyone come out as
 * "reports-driven" and the segmentation would carry no information at all.
 */
const FAMILY_BY_ROOT: Record<string, FeatureFamily> = {
  sales: 'selling',
  inventory: 'inventory',
  'product-items': 'inventory',
  customers: 'customers',
  reports: 'reports',
  receipts: 'receipts',
  invoices: 'receipts',
  'ai-insights': 'ai',
  storefront: 'store',
  'online-orders': 'store',
  support: 'support',
};

export const FAMILY_META: Record<
  FeatureFamily,
  {
    /** Used in UI chips. */
    label: string;
    /** Second person, drops into a sentence: "you spend most of your time {inSentence}". */
    inSentence: string;
    /** The pitch when this family is the one they have *never* opened. */
    pitch: string;
    /** Deep link for a template CTA. */
    href: string;
  }
> = {
  selling: {
    // Reads correctly in every place it is interpolated: "Mostly Point of sale",
    // "Has never opened Point of sale", "Open Point of sale".
    label: 'Point of sale',
    inSentence: 'on the point of sale',
    pitch: 'ring up a sale in a couple of taps, online or offline',
    href: '/sales/pos',
  },
  inventory: {
    label: 'Inventory',
    inSentence: 'in your inventory',
    pitch: 'see exactly what is running low before it costs you a sale',
    href: '/inventory',
  },
  customers: {
    label: 'Customers',
    inSentence: 'with your customer records',
    pitch: 'see who your best customers are and what they keep buying',
    href: '/customers',
  },
  reports: {
    label: 'Reports',
    inSentence: 'in your reports',
    pitch: 'see your real profit per product, not just your takings',
    href: '/reports',
  },
  receipts: {
    label: 'Receipts',
    inSentence: 'in receipts and invoices',
    pitch: 'send a professional invoice without leaving Zeneva',
    href: '/receipts',
  },
  ai: {
    label: 'Zen AI',
    inSentence: 'with Zen AI',
    pitch: 'just ask Zen AI what sold best last month and get a straight answer',
    href: '/ai-insights',
  },
  store: {
    label: 'Online store',
    inSentence: 'on your online store',
    pitch: 'put your inventory online and take orders without building a website',
    href: '/storefront',
  },
  support: {
    label: 'Support',
    inSentence: 'in support',
    pitch: 'reach a human whenever something looks wrong',
    href: '/support',
  },
};

/**
 * The families worth cross-selling into, best pitch first.
 *
 * `selling` leads because it is the single most valuable thing an account can
 * start doing, and — contrary to the original assumption here that everyone finds
 * the POS unaided — plenty of deep users never open it. For them the right email
 * is "you clearly know your way around inventory, now try ringing up a sale",
 * which is precisely what `feature_focused` sends. `receipts` and `support` stay
 * out: one follows automatically from selling, and the other is not a feature to
 * upsell.
 */
export const HIGH_VALUE_FAMILIES: FeatureFamily[] = [
  'selling',
  'ai',
  'reports',
  'customers',
  'store',
];

/** Family a stored route key belongs to, or null when the route is ambient. */
export function familyOfRouteKey(key: string): FeatureFamily | null {
  const root = key.split('_')[0];
  return FAMILY_BY_ROOT[root] ?? null;
}

/**
 * Render a stored route key back as a readable path.
 *
 * Keys are underscore-joined, so this is the inverse of `routeKey()`. Mirrors
 * what `usage-insights.tsx` does for its per-user page mix, including the
 * `root` -> `/` special case.
 */
export function pathOfRouteKey(key: string): string {
  return key === 'root' ? '/' : '/' + key.split('_').join('/');
}

/* ------------------------------------------------------------------ *
 * Segments
 * ------------------------------------------------------------------ */

export type BehaviorSegment =
  | 'never_activated'
  | 'onboarding_stalled'
  | 'invested_then_left'
  | 'champion'
  | 'feature_focused'
  | 'casual_active'
  | 'slipping'
  | 'dormant';

export type SegmentTone = 'danger' | 'warn' | 'info' | 'good' | 'neutral';

export const BEHAVIOR_SEGMENT_META: Record<
  BehaviorSegment,
  { label: string; blurb: string; tone: SegmentTone }
> = {
  never_activated: {
    label: 'Never got started',
    blurb: 'Signed up but has barely opened the app. Offer to set it up for them.',
    tone: 'danger',
  },
  onboarding_stalled: {
    label: 'Stalled setup',
    blurb:
      'Settled in for days, still shallow, and has never opened the point of sale. Deep users who skip the POS are cross-sold instead, not put here.',
    tone: 'warn',
  },
  invested_then_left: {
    label: 'Invested, then left',
    blurb:
      'Put in real time and real setup work — products, stock, quality minutes — and then stopped coming back. The best win-back on the platform: they already proved they wanted it.',
    tone: 'danger',
  },
  champion: {
    label: 'Champions',
    blurb: 'Deep, recent, broad use. Ask them for feedback, not for money.',
    tone: 'good',
  },
  feature_focused: {
    label: 'Single-feature users',
    blurb: 'Active, but living in one area. The cross-sell.',
    tone: 'info',
  },
  casual_active: {
    label: 'Casual users',
    blurb: 'In the app recently but not deeply. Worth a nudge.',
    tone: 'info',
  },
  slipping: {
    label: 'Slipping away',
    blurb: 'Used it properly, then went quiet in the last month.',
    tone: 'warn',
  },
  dormant: {
    label: 'Dormant',
    blurb: 'No sign of life in over a month.',
    tone: 'neutral',
  },
};

/** Order the filter rail and the queue render in — most actionable first. */
export const BEHAVIOR_SEGMENT_ORDER: BehaviorSegment[] = [
  'invested_then_left',
  'onboarding_stalled',
  'slipping',
  'feature_focused',
  'never_activated',
  'casual_active',
  'champion',
  'dormant',
];

/* ------------------------------------------------------------------ *
 * Thresholds — coarse on purpose. These pick an email, not a price.
 * ------------------------------------------------------------------ */

/** Below both of these, the account has not meaningfully been used at all. */
export const ACTIVATION_SECONDS = 5 * 60;
export const ACTIVATION_VIEWS = 5;
/** "Recently" — matches the 7-day window `user-segments.ts` already uses. */
export const ACTIVE_WINDOW_DAYS = 7;
/** Past this, they are not slipping any more, they are gone. */
export const DORMANT_DAYS = 30;
/** Champions need real hours, not just a recent visit. */
export const CHAMPION_SECONDS = 5 * 3600;
export const CHAMPION_FAMILIES = 3;
/** Share of feature page views in one family that counts as "lives there". */
export const FOCUS_SHARE = 0.55;
/** Grace period before an unfinished setup is worth chasing. */
export const SETUP_GRACE_DAYS = 3;
/**
 * Upper bound on time-in-app for "stalled setup".
 *
 * Someone past this has plainly found their way around, so whatever they are
 * doing is not a stalled setup — even if they have never touched the POS. Without
 * this bound, heavy inventory-and-reports users were swept into the segment and
 * would have been told they had not got started.
 */
export const STALLED_MAX_SECONDS = 2 * 3600;

/**
 * "Quality time" — enough use that the account was genuinely being evaluated,
 * not just opened once.
 */
export const QUALITY_SECONDS = 20 * 60;
/**
 * The win-back window for `invested_then_left`.
 *
 * Opens at 4 days rather than 8 on purpose. Someone who put in real setup work and
 * then went quiet for the best part of a week is already drifting, and the email
 * that asks why lands far better then than three weeks later when they have found
 * another way of working. Anyone seen inside 3 days is left alone — they have not
 * left, they are just not in the app today.
 */
export const LEFT_MIN_DAYS = 4;
export const LEFT_MAX_DAYS = 45;

/* ------------------------------------------------------------------ *
 * Inputs — loose shapes, matching what the admin page already holds
 * ------------------------------------------------------------------ */

export type BehaviorUserLike = {
  id: string;
  businessId?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  createdAt?: any;
  lastSeen?: any;
  totalUsageSeconds?: number | null;
  pagesVisited?: number | null;
  pageViews?: Record<string, number> | null;
  /**
   * Product-telemetry counters (see src/lib/product-telemetry.ts). Optional
   * everywhere: they only exist for users on a build that ships the collector, so
   * every read of them here treats absence as "not known", never as zero-with-
   * confidence.
   */
  featureUsage?: Record<string, number> | null;
  lastPage?: string | null;
  deviceType?: string | null;
  country?: string | null;
  language?: string | null;
  marketingOptOut?: boolean | null;
};

export type BehaviorBusinessLike = {
  id: string;
  name?: string | null;
  businessName?: string | null;
  plan?: string | null;
  accessLevel?: string | null;
  trialExpiresAt?: any;
  status?: string | null;
};

export type FamilyUsage = {
  family: FeatureFamily;
  views: number;
  /** Share of this user's *feature* page views (ambient routes excluded). */
  share: number;
};

export type PageUsage = {
  path: string;
  views: number;
  /** Share of this user's single busiest page, for a bar width. */
  share: number;
};

/** Everything the audience table renders and the templates interpolate. */
export type BehaviorProfile = {
  userId: string;
  businessId: string | null;
  name: string | null;
  firstName: string;
  email: string | null;
  businessName: string;
  plan: PlanId;

  segment: BehaviorSegment;
  /** 0-100. Ranks *within* the whole book so the queue has a sane default sort. */
  priority: number;
  reasons: string[];

  usageSeconds: number;
  pageViews: number;
  /** Page views that landed on a real feature (ambient routes excluded). */
  featureViews: number;
  topPages: PageUsage[];
  familyMix: FamilyUsage[];
  topFeature: FeatureFamily | null;
  topFeatureShare: number;
  familiesTouched: number;
  /** High-value families with zero views. First entry is the one to pitch. */
  unusedHighValue: FeatureFamily[];

  daysSinceSeen: number | null;
  daysSinceSignup: number | null;
  /**
   * The raw `lastSeen` value, passed straight through.
   *
   * `daysSinceSeen` is the whole-days figure the segmentation runs on, which is
   * too coarse for the online indicator — `UserPresence` calls somebody online
   * when they were seen in the last five minutes, and that distinction is gone by
   * the time it has been rounded to a day.
   */
  lastSeen: any;
  lastPage: string | null;
  deviceType: string | null;
  country: string | null;

  optedOut: boolean;
  /** False when there is no address, or they have opted out. */
  contactable: boolean;
};

/* ------------------------------------------------------------------ *
 * Derivation
 * ------------------------------------------------------------------ */

/**
 * Usage as email prose: "just over 6 hours", "about 40 minutes".
 *
 * Deliberately *not* `formatDuration` from `user-detail/user-primitives.tsx`.
 * That one renders "6h 20m", which is right for a dense admin table and wrong
 * in the middle of a sentence written to a customer. Both exist on purpose.
 */
export function humanUsage(seconds: number): string {
  if (!seconds || seconds < 60) return 'a few minutes';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} minutes`;
  const hours = seconds / 3600;
  if (hours < 1.5) return 'about an hour';
  // Nearest half hour up to 10h ("about 6.5 hours"), then whole hours — "about
  // 47.5 hours" reads like a meter reading rather than something a person wrote.
  if (hours < 10) return `about ${Math.round(hours * 2) / 2} hours`;
  return `over ${Math.floor(hours)} hours`;
}

/** First name for a greeting, or a safe fallback. Never returns empty. */
export function firstNameOf(name?: string | null): string {
  const first = (name || '').trim().split(/\s+/)[0];
  return first || 'there';
}

function buildFamilyMix(pageViews: Record<string, number>): {
  mix: FamilyUsage[];
  featureViews: number;
} {
  const totals = new Map<FeatureFamily, number>();
  let featureViews = 0;

  for (const [key, rawCount] of Object.entries(pageViews)) {
    const count = typeof rawCount === 'number' && rawCount > 0 ? rawCount : 0;
    if (!count) continue;
    const family = familyOfRouteKey(key);
    if (!family) continue; // ambient route — see FAMILY_BY_ROOT
    totals.set(family, (totals.get(family) ?? 0) + count);
    featureViews += count;
  }

  const mix = [...totals.entries()]
    .map(([family, views]) => ({
      family,
      views,
      share: featureViews > 0 ? views / featureViews : 0,
    }))
    .sort((a, b) => b.views - a.views);

  return { mix, featureViews };
}

function buildTopPages(pageViews: Record<string, number>, take = 3): PageUsage[] {
  const entries = Object.entries(pageViews)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, take);
  if (!entries.length) return [];
  const max = entries[0][1] || 1;
  return entries.map(([key, views]) => ({
    path: pathOfRouteKey(key),
    views,
    share: views / max,
  }));
}

/**
 * Classify one user.
 *
 * Branch order is load-bearing: the first match wins, so the sequence encodes
 * which description of a person is the truest one.
 *
 * `champion` and `feature_focused` are tested **before** `onboarding_stalled`,
 * and stalled additionally requires shallow use. Both guards exist because the
 * first version got this wrong: it treated "has never opened the point of sale"
 * as sufficient, so a genuine power user — twenty hours across inventory,
 * reports and customers, simply not using Zeneva to ring up sales — was labelled
 * a stalled setup and would have been emailed "you are one step from your first
 * sale". Never opening the POS is not evidence of being stuck; it is evidence of
 * using the product differently, and for that person the right email is the
 * cross-sell that `feature_focused` sends.
 *
 * So stalled now means what it says: settled in, still around, shallow, and not
 * selling. Depth is what separates the two, not the absence of one feature.
 */
export function profileUser(
  user: BehaviorUserLike,
  business: BehaviorBusinessLike | undefined,
  now: number = Date.now(),
): BehaviorProfile {
  const pageViews = user.pageViews && typeof user.pageViews === 'object' ? user.pageViews : {};
  const { mix, featureViews } = buildFamilyMix(pageViews);
  const topPages = buildTopPages(pageViews);

  const usageSeconds = Math.max(0, user.totalUsageSeconds ?? 0);
  // Prefer the counter, but fall back to summing the map: `pagesVisited` only
  // started being written in a later version, so older accounts have the
  // per-route map without the total.
  const countedViews = Object.values(pageViews).reduce<number>(
    (sum, v) => sum + (typeof v === 'number' && v > 0 ? v : 0),
    0,
  );
  const totalViews = Math.max(user.pagesVisited ?? 0, countedViews);

  const daysSinceSeen = daysAgo(user.lastSeen, now);
  const daysSinceSignup = daysAgo(user.createdAt, now);

  const topFeature = mix[0]?.family ?? null;
  const topFeatureShare = mix[0]?.share ?? 0;
  const familiesTouched = mix.length;
  const touched = new Set(mix.map(m => m.family));
  const unusedHighValue = HIGH_VALUE_FAMILIES.filter(f => !touched.has(f));

  const sellingViews = mix.find(m => m.family === 'selling')?.views ?? 0;
  const inventoryViews = mix.find(m => m.family === 'inventory')?.views ?? 0;

  /**
   * Did this account actually put work in?
   *
   * Setup effort is the thing that separates a win-back worth sending from a cold
   * signup: someone who loaded stock and spent real minutes has already decided
   * they want this, so the only question is what stopped them. Any one of three
   * signals counts — time in the inventory screens, a bulk import, or a completed
   * sale. Deliberately not `business.productCount`, which is not a stored field
   * (the dashboard derives it from a full collection scan) and would read as 0 for
   * everyone here.
   */
  const feature = (key: string) => {
    const v = user.featureUsage?.[key];
    return typeof v === 'number' && v > 0 ? v : 0;
  };
  const invested =
    inventoryViews > 0 || feature('inventory_csv_import') > 0 || feature('pos_sale_completed') > 0;

  // Unknown recency is not the same as inactive: an account with no telemetry is
  // unmeasured, and treating it as dormant would mail every fresh signup a
  // win-back. `daysSinceSeen === null` only ever routes to never_activated.
  const seenRecently = daysSinceSeen !== null && daysSinceSeen <= ACTIVE_WINDOW_DAYS;
  const seenThisMonth = daysSinceSeen !== null && daysSinceSeen <= DORMANT_DAYS;
  const barelyUsed = usageSeconds < ACTIVATION_SECONDS && totalViews < ACTIVATION_VIEWS;
  const settledIn = daysSinceSignup !== null && daysSinceSignup >= SETUP_GRACE_DAYS;

  const reasons: string[] = [];
  let segment: BehaviorSegment;
  let priority: number;

  if (daysSinceSeen === null || barelyUsed) {
    segment = 'never_activated';
    priority = 82;
    reasons.push(
      daysSinceSeen === null
        ? 'Never signed in'
        : `Only ${humanUsage(usageSeconds)} in the app`,
    );
    if (daysSinceSignup !== null) reasons.push(`Signed up ${daysSinceSignup} days ago`);
  } else if (
    daysSinceSeen !== null
    && daysSinceSeen >= LEFT_MIN_DAYS
    && daysSinceSeen <= LEFT_MAX_DAYS
    && usageSeconds >= QUALITY_SECONDS
    && invested
  ) {
    /*
     * Tested above champion and feature_focused on purpose.
     *
     * Those two both require having been seen inside 7 days, so a heavy user who
     * has not appeared for five days would otherwise still be called a champion —
     * and champion is the one description whose correct action is to send nothing.
     * Somebody who put this much work in and then stopped is the most valuable
     * message on the platform; calling them healthy loses it silently.
     */
    segment = 'invested_then_left';
    priority = 96;
    reasons.push(`Put in ${humanUsage(usageSeconds)}, then stopped`);
    reasons.push(`Last seen ${daysSinceSeen} days ago`);
    if (inventoryViews > 0) reasons.push('Had loaded stock into inventory');
    if (feature('pos_sale_completed') > 0) {
      reasons.push(`${feature('pos_sale_completed')} sales before going quiet`);
    }
    if (topFeature) reasons.push(`Was mostly ${FAMILY_META[topFeature].inSentence}`);
  } else if (seenRecently && usageSeconds >= CHAMPION_SECONDS && familiesTouched >= CHAMPION_FAMILIES) {
    segment = 'champion';
    priority = 40; // low: the correct action is to ask, not to sell
    reasons.push(`${humanUsage(usageSeconds)} in the app`);
    reasons.push(`Uses ${familiesTouched} different areas`);
  } else if (seenRecently && topFeature && topFeatureShare >= FOCUS_SHARE && featureViews >= ACTIVATION_VIEWS) {
    segment = 'feature_focused';
    priority = 75;
    reasons.push(
      `${Math.round(topFeatureShare * 100)}% of their time ${FAMILY_META[topFeature].inSentence}`,
    );
    if (unusedHighValue.length) {
      reasons.push(`Has never opened ${FAMILY_META[unusedHighValue[0]].label}`);
    }
  } else if (seenThisMonth && settledIn && sellingViews === 0 && usageSeconds < STALLED_MAX_SECONDS) {
    segment = 'onboarding_stalled';
    priority = 90;
    reasons.push('Has never opened the point of sale');
    reasons.push(`${totalViews.toLocaleString()} page views, ${humanUsage(usageSeconds)}`);
    if (topFeature) reasons.push(`Spends their time ${FAMILY_META[topFeature].inSentence}`);
  } else if (seenRecently) {
    segment = 'casual_active';
    priority = 55;
    reasons.push(`Active, ${humanUsage(usageSeconds)} total`);
    if (unusedHighValue.length) {
      reasons.push(`Yet to try ${FAMILY_META[unusedHighValue[0]].label}`);
    }
  } else if (seenThisMonth) {
    segment = 'slipping';
    priority = 85;
    reasons.push(`Last seen ${daysSinceSeen} days ago`);
    reasons.push(`Had put in ${humanUsage(usageSeconds)}`);
  } else {
    segment = 'dormant';
    priority = 30;
    reasons.push(`No activity for ${daysSinceSeen} days`);
  }

  const email = (user.email || '').trim() || null;
  const optedOut = user.marketingOptOut === true;

  if (!email) {
    // Unreachable rows must not sit at the top of a queue whose only purpose is
    // "who do I email next".
    priority = Math.min(priority, 10);
    reasons.push('No email address on file');
  } else if (optedOut) {
    priority = Math.min(priority, 5);
    reasons.push('Unsubscribed from marketing email');
  }

  return {
    userId: user.id,
    businessId: user.businessId ?? null,
    name: user.name ?? null,
    firstName: firstNameOf(user.name),
    email,
    businessName: business?.name || business?.businessName || 'your business',
    // `BusinessLike` accepts null/undefined and answers 'starter', so an
    // unresolvable business is handled by plan.ts rather than guessed at here.
    plan: effectivePlan(business),

    segment,
    priority,
    reasons,

    usageSeconds,
    pageViews: totalViews,
    featureViews,
    topPages,
    familyMix: mix,
    topFeature,
    topFeatureShare,
    familiesTouched,
    unusedHighValue,

    daysSinceSeen,
    daysSinceSignup,
    lastSeen: user.lastSeen ?? null,
    lastPage: user.lastPage ?? null,
    deviceType: user.deviceType ?? null,
    country: user.country ?? null,

    optedOut,
    contactable: !!email && !optedOut,
  };
}

/**
 * Profile every user and return them ranked.
 *
 * Deleted and suspended accounts are dropped — mailing a suspended account is
 * never the right move. Ties break on recency, so between two equally urgent
 * rows the one who was in the app yesterday gets contacted first.
 */
export function profileAudience(
  users: BehaviorUserLike[] | null | undefined,
  businesses: BehaviorBusinessLike[] | null | undefined,
  now: number = Date.now(),
): BehaviorProfile[] {
  const byId = new Map<string, BehaviorBusinessLike>();
  for (const b of businesses ?? []) {
    if (b?.id) byId.set(b.id, b);
  }

  return (users ?? [])
    .filter(u => u && u.id && u.status !== 'deleted' && u.status !== 'suspended')
    .map(u => profileUser(u, u.businessId ? byId.get(u.businessId) : undefined, now))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aSeen = a.daysSinceSeen ?? Number.MAX_SAFE_INTEGER;
      const bSeen = b.daysSinceSeen ?? Number.MAX_SAFE_INTEGER;
      return aSeen - bSeen;
    });
}

/** Counts per segment for the filter rail. Every key is always present. */
export function behaviorSegmentCounts(
  profiles: BehaviorProfile[],
): Record<BehaviorSegment, number> {
  const counts = {
    never_activated: 0,
    onboarding_stalled: 0,
    invested_then_left: 0,
    champion: 0,
    feature_focused: 0,
    casual_active: 0,
    slipping: 0,
    dormant: 0,
  } as Record<BehaviorSegment, number>;
  for (const p of profiles) counts[p.segment] += 1;
  return counts;
}

/** Platform-wide page mix, for the "where everyone spends their time" panel. */
export function aggregateFamilyMix(profiles: BehaviorProfile[]): FamilyUsage[] {
  const totals = new Map<FeatureFamily, number>();
  let total = 0;
  for (const p of profiles) {
    for (const f of p.familyMix) {
      totals.set(f.family, (totals.get(f.family) ?? 0) + f.views);
      total += f.views;
    }
  }
  return [...totals.entries()]
    .map(([family, views]) => ({ family, views, share: total > 0 ? views / total : 0 }))
    .sort((a, b) => b.views - a.views);
}
