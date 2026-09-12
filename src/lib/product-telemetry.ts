'use client';

/**
 * Product telemetry: feature counters, page dwell time, and route render timing.
 *
 * ## Why this costs nothing
 *
 * Nothing here writes to Firestore. Everything accumulates in a module-level
 * buffer that `UserActivityTracker` drains onto **the heartbeat write it was
 * already making** to `users/{uid}`. So the whole intelligence layer adds zero
 * documents, zero queries and zero extra writes — it widens one existing write
 * by a few fields.
 *
 * The admin side is free for the same reason: the Usage Analytics tab already
 * loads every `users` document, so aggregating these fields across the platform
 * needs no new read either.
 *
 * The trade-off is deliberate: these are **lifetime totals, not a time series**.
 * "Does anyone use change calculation?" and "which page is slowest?" are answered
 * perfectly by a running total, and the existing `journey`-based charts on the
 * same tab already provide the time dimension. Adding per-day buckets here would
 * mean a shared rollup document, which brings write contention and a rules change
 * for something no question currently needs.
 *
 * ## Field layout on `users/{uid}`
 *
 * ```
 * featureUsage: { [eventKey]: number }                  // lifetime count
 * pageDwell:    { [routeKey]: { ms: number, n: number } } // time on page
 * pagePerf:     { [routeKey]: { ms: number, n: number } } // route render time
 * ```
 *
 * All written as **nested maps with `increment()` sentinels**, never dotted field
 * paths — `setDoc` treats a dotted key as a literal field name containing a dot,
 * which is exactly the bug that left `pageViews` empty on every document since it
 * was introduced.
 */

import { increment } from 'firebase/firestore';

/* ------------------------------------------------------------------ *
 * The event registry
 * ------------------------------------------------------------------ */

export type FeatureCategory = 'pos' | 'inventory' | 'ai' | 'reports' | 'engagement';

/**
 * Which users even had the chance to use a feature.
 *
 * This is the denominator for adoption, and getting it right is the difference
 * between a real finding and a misleading one: "only 8% use change calculation"
 * is meaningless if most accounts have never rung up a sale at all. Measured
 * against people who actually sell, the same number is a genuine answer.
 */
export type Opportunity = 'all' | 'sellers';

export type FeatureEventDef = {
  key: string;
  label: string;
  category: FeatureCategory;
  /** The product question this counter exists to answer. Shown in the admin card. */
  question: string;
  /** Where it fires. A zero is only meaningful if you can check the call site. */
  where: string;
  opportunity: Opportunity;
  /**
   * True for the handful of events that are the product working as intended, so
   * the insight engine never suggests removing them for low adoption.
   */
  core?: boolean;
};

/**
 * Every tracked event.
 *
 * This registry — not the data — is what the admin board renders against, which
 * is the whole point: absence cannot be observed from documents alone. A feature
 * nobody has ever touched has no field on any user, so without a declared list it
 * would simply be invisible rather than showing up as the zero it is.
 *
 * For that to work the list must contain **only events something actually fires**.
 * A declared event with no call site reads as "nobody uses this feature" for ever,
 * which is precisely the false conclusion this board exists to prevent. Storefront
 * publish and low-stock-alert opens were dropped for that reason — neither has a
 * call site to instrument today. Add the event in the same change as its
 * `trackFeature()` call, never before.
 */
export const FEATURE_EVENTS: FeatureEventDef[] = [
  // ── The POS loop ──
  {
    key: 'pos_sale_completed',
    label: 'Sale completed',
    category: 'pos',
    question: 'Is this account actually trading, or just set up?',
    where: 'sales/pos/review',
    opportunity: 'all',
    core: true,
  },
  {
    key: 'pos_amount_received_used',
    label: 'Amount received typed',
    category: 'pos',
    question: 'Do cashiers use change calculation, or just take the cash?',
    where: 'sales/pos/payment',
    opportunity: 'sellers',
  },
  {
    key: 'pos_change_shown',
    label: 'Change due displayed',
    category: 'pos',
    question: 'How often does the change figure actually get produced?',
    where: 'sales/pos/payment',
    opportunity: 'sellers',
  },
  {
    key: 'pos_barcode_scan',
    label: 'Barcode scanned',
    category: 'pos',
    question: 'Is anyone using a scanner, or is everything typed by hand?',
    where: 'POS product search',
    opportunity: 'sellers',
  },
  {
    key: 'pos_hold_sale',
    label: 'Sale held / parked',
    category: 'pos',
    question: 'Do merchants juggle several customers at once?',
    where: 'POS cart',
    opportunity: 'sellers',
  },
  {
    key: 'pos_discount_applied',
    label: 'Discount applied',
    category: 'pos',
    question: 'Is discounting a real workflow or a rare exception?',
    where: 'sales/pos/payment',
    opportunity: 'sellers',
  },
  {
    key: 'pos_tax_override',
    label: 'Tax overridden',
    category: 'pos',
    question: 'Is the default tax rate wrong for most shops?',
    where: 'sales/pos/payment',
    opportunity: 'sellers',
  },
  {
    key: 'pos_customer_attached',
    label: 'Customer attached to sale',
    category: 'pos',
    question: 'Is anyone building a customer list from sales?',
    where: 'POS customer picker',
    opportunity: 'sellers',
  },
  {
    key: 'pos_receipt_printed',
    label: 'Receipt printed',
    category: 'pos',
    question: 'Printer, email, or nothing — which do shops choose?',
    where: 'sales/pos/review',
    opportunity: 'sellers',
  },
  {
    key: 'pos_receipt_emailed',
    label: 'Receipt emailed',
    category: 'pos',
    question: 'Printer, email, or nothing — which do shops choose?',
    where: 'sales/pos/review',
    opportunity: 'sellers',
  },

  // ── The expensive features ──
  {
    key: 'ai_prompt_sent',
    label: 'Zen AI asked a question',
    category: 'ai',
    question: 'Does Zen AI earn the API bill it generates?',
    where: 'ai-insights',
    opportunity: 'all',
  },
  {
    key: 'ai_proposal_approved',
    label: 'Zen AI proposal approved',
    category: 'ai',
    question: 'Do people trust Zen AI enough to let it write?',
    where: 'ai-insights proposal card',
    opportunity: 'all',
  },
  {
    key: 'inventory_csv_import',
    label: 'Products imported from CSV',
    category: 'inventory',
    question: 'Is bulk import how stock gets in, or does everyone type it?',
    where: 'inventory import',
    opportunity: 'all',
  },
  {
    key: 'reports_exported',
    label: 'Data exported (report or inventory CSV)',
    category: 'reports',
    question: 'Do merchants take data out of Zeneva, or only read it on screen?',
    where: 'reports daily-sales table, inventory export',
    opportunity: 'all',
  },

  // ── The bell ──
  //
  // These three only mean something as a set. Opens alone cannot separate "reads
  // the alerts" from "clears the badge because the red dot is annoying", and those
  // two answers point at opposite decisions about whether notifications are worth
  // the interruption. So: did they open it, did they act on anything, or did they
  // just wipe it.
  {
    key: 'notif_bell_opened',
    label: 'Notification bell opened',
    category: 'engagement',
    question: 'Do people open the bell at all, or ignore it?',
    where: 'app top bar, bell dropdown open transition',
    opportunity: 'all',
  },
  {
    key: 'notif_tapped',
    label: 'Notification tapped through',
    category: 'engagement',
    question: 'Having opened the bell, do they act on anything in it?',
    where: 'app top bar, handleNotificationClick',
    opportunity: 'all',
  },
  {
    key: 'notif_bell_cleared',
    label: 'Notifications marked all read',
    category: 'engagement',
    question: 'Or do they just wipe the badge without reading anything?',
    where: 'app top bar, Mark all read',
    opportunity: 'all',
  },
];

export const FEATURE_EVENT_BY_KEY: Record<string, FeatureEventDef> = Object.fromEntries(
  FEATURE_EVENTS.map(e => [e.key, e]),
);

/** Compile-time-ish safety: only declared keys can be tracked. */
export type FeatureEventKey = (typeof FEATURE_EVENTS)[number]['key'];

/* ------------------------------------------------------------------ *
 * The buffer
 * ------------------------------------------------------------------ */

const featureCounts = new Map<string, number>();
const dwellByRoute = new Map<string, { ms: number; n: number }>();
const perfByRoute = new Map<string, { ms: number; n: number }>();

/**
 * Record one use of a tracked feature.
 *
 * Fire-and-forget and safe to call from anywhere, including render paths and
 * event handlers on an offline client — it only touches an in-memory Map.
 *
 * An unregistered key is dropped rather than stored. Silently accumulating typo'd
 * keys would put fields on every user document that no admin view can interpret,
 * and the registry is what makes a zero readable.
 */
export function trackFeature(key: FeatureEventKey | string, times = 1): void {
  if (!FEATURE_EVENT_BY_KEY[key]) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[telemetry] ignoring unregistered event "${key}" — add it to FEATURE_EVENTS.`);
    }
    return;
  }
  if (!Number.isFinite(times) || times <= 0) return;
  featureCounts.set(key, (featureCounts.get(key) ?? 0) + times);
}

/**
 * Time spent on a route, in ms.
 *
 * Anything over an hour is discarded: a tab left open overnight is not attention,
 * and a handful of those would dominate the average and make the dwell figures
 * useless. The visibility-aware caller already stops the clock on tab-hide, so
 * this is the backstop for sleep/resume.
 */
const MAX_DWELL_MS = 60 * 60 * 1000;

export function recordDwell(routeKey: string, ms: number): void {
  if (!routeKey || !Number.isFinite(ms) || ms < 250 || ms > MAX_DWELL_MS) return;
  const current = dwellByRoute.get(routeKey) ?? { ms: 0, n: 0 };
  current.ms += Math.round(ms);
  current.n += 1;
  dwellByRoute.set(routeKey, current);
}

/**
 * How long a route took to become visible, in ms.
 *
 * Capped at 60s and floored at 1ms — a transition measured as longer than a
 * minute is a suspended tab being resumed, not a slow page, and letting those in
 * would point the "slowest page" finding at whichever page people leave open.
 */
export function recordRoutePerf(routeKey: string, ms: number): void {
  if (!routeKey || !Number.isFinite(ms) || ms < 1 || ms > 60_000) return;
  const current = perfByRoute.get(routeKey) ?? { ms: 0, n: 0 };
  current.ms += Math.round(ms);
  current.n += 1;
  perfByRoute.set(routeKey, current);
}

/** True when there is anything worth writing. Lets the caller skip the fields. */
export function hasPendingTelemetry(): boolean {
  return featureCounts.size > 0 || dwellByRoute.size > 0 || perfByRoute.size > 0;
}

/**
 * Drain the buffer into Firestore update fields, clearing it.
 *
 * Returns **nested maps holding `increment()` sentinels**, not dotted paths, so it
 * is safe to spread into the `set(..., { merge: true })` the heartbeat already
 * performs. `merge` combines nested maps key by key, so two devices flushing at
 * once both land.
 */
export function drainTelemetry(): Record<string, any> {
  const fields: Record<string, any> = {};

  if (featureCounts.size > 0) {
    const featureUsage: Record<string, any> = {};
    featureCounts.forEach((count, key) => { featureUsage[key] = increment(count); });
    fields.featureUsage = featureUsage;
    featureCounts.clear();
  }

  if (dwellByRoute.size > 0) {
    const pageDwell: Record<string, any> = {};
    dwellByRoute.forEach((v, key) => {
      pageDwell[key] = { ms: increment(v.ms), n: increment(v.n) };
    });
    fields.pageDwell = pageDwell;
    dwellByRoute.clear();
  }

  if (perfByRoute.size > 0) {
    const pagePerf: Record<string, any> = {};
    perfByRoute.forEach((v, key) => {
      pagePerf[key] = { ms: increment(v.ms), n: increment(v.n) };
    });
    fields.pagePerf = pagePerf;
    perfByRoute.clear();
  }

  return fields;
}
