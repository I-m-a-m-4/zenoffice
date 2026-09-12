/**
 * Product insight engine.
 *
 * Turns the telemetry counters on `users` documents into findings worth acting on:
 * which features nobody uses, which pages are slow, where people stall, and — the
 * one that actually changes a roadmap — which features correlate with an account
 * sticking around.
 *
 * Pure and dependency-free. Every input is a `users` document the admin dashboard
 * has already loaded, so the whole board costs no reads of its own.
 *
 * ## Two rules this file follows
 *
 * **An honest denominator.** "8% use change calculation" is a meaningless number if
 * most accounts have never rung up a sale. Adoption is always measured against the
 * users who had the opportunity — `sellers` for POS features — and the cohort size
 * is reported alongside every rate so a finding drawn from four people is visibly
 * a finding drawn from four people.
 *
 * **Correlation is labelled as correlation.** `stickinessSignals` is the sharpest
 * tool here and the easiest to misread. Users of a feature having triple the hours
 * of non-users does not mean the feature caused it — heavy users try more things.
 * The finding is worth surfacing because it says *where to run an experiment*, not
 * what to conclude, and the copy says so.
 */

import {
  FEATURE_EVENTS,
  type FeatureEventDef,
  type Opportunity,
} from '@/lib/product-telemetry';
import { familyOfRouteKey, pathOfRouteKey } from '@/lib/behavior-segments';

/** Loose shape: whatever the admin dashboard already holds for a user. */
export type InsightUserLike = {
  id: string;
  name?: string | null;
  email?: string | null;
  businessId?: string | null;
  status?: string | null;
  lastSeen?: any;
  totalUsageSeconds?: number | null;
  pagesVisited?: number | null;
  pageViews?: Record<string, number> | null;
  featureUsage?: Record<string, number> | null;
  pageDwell?: Record<string, { ms: number; n: number }> | null;
  pagePerf?: Record<string, { ms: number; n: number }> | null;
};

/* ------------------------------------------------------------------ *
 * Thresholds
 * ------------------------------------------------------------------ */

/** Below this, someone has not used the app enough to count in any denominator. */
export const ENGAGED_SECONDS = 10 * 60;
/** Route transitions slower than this are worth a developer's attention. */
export const SLOW_ROUTE_MS = 1200;
/** And past this they are a bug, not a slow page. */
export const VERY_SLOW_ROUTE_MS = 2500;
/** Adoption at or under this, among users who had the chance, is "barely used". */
export const LOW_ADOPTION = 0.2;
/**
 * No finding is reported from fewer than this many users.
 *
 * A 0-of-2 adoption rate is noise, and dressing it up as an insight is how a board
 * like this starts costing more in bad decisions than it saves.
 */
export const MIN_COHORT = 5;

/* ------------------------------------------------------------------ *
 * Aggregates
 * ------------------------------------------------------------------ */

export type FeatureAdoption = {
  event: FeatureEventDef;
  /** Users who fired it at least once. */
  users: number;
  /** Users who could have. */
  opportunity: number;
  /** users / opportunity, or 0 when there is no cohort. */
  rate: number;
  /** Total fires across the platform. */
  total: number;
  /** Mean fires per adopting user — separates "tried once" from "lives on it". */
  perAdopter: number;
  /** Ids of the users who have never used it, for email targeting. */
  nonAdopterIds: string[];
};

export type RouteStat = {
  routeKey: string;
  path: string;
  family: string | null;
  views: number;
  /** Mean on-screen time, seconds. */
  avgDwellSeconds: number;
  /** Mean client-side route transition time, ms. Null when never sampled. */
  avgLoadMs: number | null;
  loadSamples: number;
};

export type PlatformTelemetry = {
  /** Users with enough use to be counted. */
  engaged: InsightUserLike[];
  /** Users who have completed at least one sale. */
  sellers: InsightUserLike[];
  adoption: FeatureAdoption[];
  routes: RouteStat[];
  /** True when no telemetry has landed yet — the board says so rather than lying. */
  empty: boolean;
};

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function usedFeature(user: InsightUserLike, key: string): boolean {
  return num(user.featureUsage?.[key]) > 0;
}

function cohortFor(
  opportunity: Opportunity,
  engaged: InsightUserLike[],
  sellers: InsightUserLike[],
): InsightUserLike[] {
  return opportunity === 'sellers' ? sellers : engaged;
}

/** Roll every user document into the platform-wide picture. */
export function aggregateTelemetry(users: InsightUserLike[] | null | undefined): PlatformTelemetry {
  const live = (users ?? []).filter(
    u => u && u.id && u.status !== 'deleted' && u.status !== 'suspended',
  );
  const engaged = live.filter(u => num(u.totalUsageSeconds) >= ENGAGED_SECONDS);
  const sellers = live.filter(u => usedFeature(u, 'pos_sale_completed'));

  const adoption: FeatureAdoption[] = FEATURE_EVENTS.map(event => {
    const cohort = cohortFor(event.opportunity, engaged, sellers);
    const adopters = cohort.filter(u => usedFeature(u, event.key));
    const total = cohort.reduce((sum, u) => sum + num(u.featureUsage?.[event.key]), 0);
    return {
      event,
      users: adopters.length,
      opportunity: cohort.length,
      rate: cohort.length > 0 ? adopters.length / cohort.length : 0,
      total,
      perAdopter: adopters.length > 0 ? total / adopters.length : 0,
      nonAdopterIds: cohort.filter(u => !usedFeature(u, event.key)).map(u => u.id),
    };
  }).sort((a, b) => b.rate - a.rate);

  // ── Per-route dwell, traffic and render time ──
  const views = new Map<string, number>();
  const dwell = new Map<string, { ms: number; n: number }>();
  const perf = new Map<string, { ms: number; n: number }>();

  for (const user of live) {
    for (const [key, count] of Object.entries(user.pageViews ?? {})) {
      const c = num(count);
      if (c) views.set(key, (views.get(key) ?? 0) + c);
    }
    for (const [key, v] of Object.entries(user.pageDwell ?? {})) {
      const ms = num(v?.ms);
      const n = num(v?.n);
      if (!n) continue;
      const acc = dwell.get(key) ?? { ms: 0, n: 0 };
      dwell.set(key, { ms: acc.ms + ms, n: acc.n + n });
    }
    for (const [key, v] of Object.entries(user.pagePerf ?? {})) {
      const ms = num(v?.ms);
      const n = num(v?.n);
      if (!n) continue;
      const acc = perf.get(key) ?? { ms: 0, n: 0 };
      perf.set(key, { ms: acc.ms + ms, n: acc.n + n });
    }
  }

  const routeKeys = new Set<string>([...views.keys(), ...dwell.keys(), ...perf.keys()]);
  const routes: RouteStat[] = [...routeKeys]
    .map(routeKey => {
      const d = dwell.get(routeKey);
      const p = perf.get(routeKey);
      return {
        routeKey,
        path: pathOfRouteKey(routeKey),
        family: familyOfRouteKey(routeKey),
        views: views.get(routeKey) ?? d?.n ?? 0,
        avgDwellSeconds: d && d.n > 0 ? d.ms / d.n / 1000 : 0,
        avgLoadMs: p && p.n > 0 ? p.ms / p.n : null,
        loadSamples: p?.n ?? 0,
      };
    })
    .sort((a, b) => b.views - a.views);

  return {
    engaged,
    sellers,
    adoption,
    routes,
    empty: routes.length === 0 && adoption.every(a => a.total === 0),
  };
}

/* ------------------------------------------------------------------ *
 * Insights
 * ------------------------------------------------------------------ */

export type InsightSeverity = 'critical' | 'warn' | 'info' | 'good';

export type Insight = {
  id: string;
  severity: InsightSeverity;
  /** Short headline. */
  title: string;
  /** What the data says. States the numbers, including the denominator. */
  finding: string;
  /** What to do about it. */
  recommendation: string;
  /**
   * Users this finding is about, when there is a sensible cohort to email.
   * Handed to the campaign console via the `cohort` query param.
   */
  cohortIds?: string[];
  /** Suggested behavioural template when this cohort is mailed. */
  cohortLabel?: string;
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Derive every finding.
 *
 * Ordered by severity then by how much of the platform each one touches, because
 * a board that lists twenty equal-weight observations gets read once and ignored.
 */
export function deriveInsights(telemetry: PlatformTelemetry): Insight[] {
  const insights: Insight[] = [];
  const { engaged, sellers, adoption, routes } = telemetry;

  /* ── 1. Features nobody uses ──────────────────────────────────── */
  for (const a of adoption) {
    if (a.event.core || a.opportunity < MIN_COHORT) continue;

    if (a.users === 0) {
      insights.push({
        id: `dead-${a.event.key}`,
        severity: 'critical',
        title: `Nobody uses ${a.event.label}`,
        finding: `Zero of ${plural(a.opportunity, 'eligible user')} has ever used it. ${a.event.question}`,
        recommendation:
          `Either it is undiscoverable or it is not wanted. Before writing more of it, `
          + `check the call site in ${a.event.where} still fires, then decide: move it `
          + `somewhere people will find it, or take it out and reclaim the maintenance.`,
      });
    } else if (a.rate <= LOW_ADOPTION) {
      insights.push({
        id: `low-${a.event.key}`,
        severity: 'warn',
        title: `${a.event.label} is barely used`,
        finding:
          `${plural(a.users, 'user')} of ${a.opportunity} (${pct(a.rate)}) have used it, `
          + `averaging ${a.perAdopter.toFixed(1)} times each. ${a.event.question}`,
        recommendation:
          a.perAdopter >= 3
            ? `The few who found it keep coming back — that is a discoverability problem, `
              + `not a value problem. Surface it where the work already happens.`
            : `Low reach and low repeat: people try it once and do not return. Worth `
              + `watching one merchant attempt it before investing further.`,
        cohortIds: a.nonAdopterIds,
        cohortLabel: `Never used ${a.event.label}`,
      });
    }
  }

  /* ── 2. Slow pages, weighted by how much traffic they carry ───── */
  const timed = routes.filter(r => r.avgLoadMs !== null && r.loadSamples >= MIN_COHORT);
  const slow = timed
    .filter(r => (r.avgLoadMs as number) >= SLOW_ROUTE_MS)
    .sort((a, b) => (b.avgLoadMs as number) * b.views - (a.avgLoadMs as number) * a.views);

  for (const route of slow.slice(0, 4)) {
    const ms = Math.round(route.avgLoadMs as number);
    const rank = routes.findIndex(r => r.routeKey === route.routeKey) + 1;
    insights.push({
      id: `slow-${route.routeKey}`,
      severity: ms >= VERY_SLOW_ROUTE_MS ? 'critical' : 'warn',
      title: `${route.path} takes ${(ms / 1000).toFixed(1)}s to open`,
      finding:
        `Mean ${ms}ms across ${plural(route.loadSamples, 'measured open')}, and it is the `
        + `${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} most `
        + `visited page with ${route.views.toLocaleString()} views. Timed from navigation `
        + `to the page being painted, client-side only.`,
      recommendation:
        `High traffic times high latency makes this the best performance work available. `
        + `Look for a blocking Firestore read on mount that could be deferred, or a list `
        + `rendering every row at once.`,
    });
  }

  /* ── 3. Where people spend disproportionate time ──────────────── */
  const withDwell = routes.filter(r => r.avgDwellSeconds > 0 && r.views >= MIN_COHORT);
  if (withDwell.length >= 3) {
    const meanDwell =
      withDwell.reduce((s, r) => s + r.avgDwellSeconds, 0) / withDwell.length;
    const sticky = [...withDwell]
      .filter(r => r.avgDwellSeconds > meanDwell * 2)
      .sort((a, b) => b.avgDwellSeconds - a.avgDwellSeconds);

    for (const route of sticky.slice(0, 2)) {
      insights.push({
        id: `dwell-${route.routeKey}`,
        severity: 'info',
        title: `${route.path} holds people ${(route.avgDwellSeconds / meanDwell).toFixed(1)}× longer than average`,
        finding:
          `Mean ${Math.round(route.avgDwellSeconds)}s on screen against a ${Math.round(meanDwell)}s `
          + `average across ${withDwell.length} pages, over ${route.views.toLocaleString()} views.`,
        recommendation:
          `Long dwell is either deep engagement or a struggle, and this number cannot tell `
          + `you which. If it is a form or a setup step, treat it as friction and watch `
          + `someone use it; if it is a report, it is working.`,
      });
    }
  }

  /* ── 4. Reached the till but never sold ──────────────────────── */
  const posViewers = engaged.filter(u =>
    Object.keys(u.pageViews ?? {}).some(k => familyOfRouteKey(k) === 'selling'),
  );
  const stalledAtTill = posViewers.filter(u => !usedFeature(u, 'pos_sale_completed'));
  if (posViewers.length >= MIN_COHORT && stalledAtTill.length > 0) {
    insights.push({
      id: 'reached-till-never-sold',
      severity: 'critical',
      title: `${plural(stalledAtTill.length, 'account')} opened the till but never completed a sale`,
      finding:
        `${stalledAtTill.length} of ${plural(posViewers.length, 'account')} that reached the `
        + `selling screens have no completed sale. They found the feature and stopped inside it.`,
      recommendation:
        `This is the highest-value funnel leak on the platform — the intent was there. `
        + `Email them and ask what stopped them, and check whether the blocker is a missing `
        + `product, a payment method, or a printer that would not connect.`,
      cohortIds: stalledAtTill.map(u => u.id),
      cohortLabel: 'Opened the till, never sold',
    });
  }

  /* ── 5. Which features go with accounts that stick ───────────── */
  for (const signal of stickinessSignals(telemetry)) insights.push(signal);

  /* ── 6. Cash handling: is change calculation real? ───────────── */
  const changeUse = adoption.find(a => a.event.key === 'pos_amount_received_used');
  if (changeUse && changeUse.opportunity >= MIN_COHORT && changeUse.users > 0) {
    const salesTotal =
      adoption.find(a => a.event.key === 'pos_sale_completed')?.total ?? 0;
    if (salesTotal > 0) {
      const share = changeUse.total / salesTotal;
      insights.push({
        id: 'change-calc-share',
        severity: share < 0.15 ? 'warn' : 'good',
        title:
          share < 0.15
            ? `Change calculation is used on only ${pct(share)} of sales`
            : `Change calculation is used on ${pct(share)} of sales`,
        finding:
          `${changeUse.total.toLocaleString()} uses across ${salesTotal.toLocaleString()} `
          + `completed sales, by ${plural(changeUse.users, 'merchant')} of ${changeUse.opportunity}. `
          + `Cash-only — the field is not shown for card or transfer.`,
        recommendation:
          share < 0.15
            ? `Either most sales are not cash, or cashiers do the arithmetic in their head `
              + `faster than they can type it. Check the payment-method split before `
              + `spending anything more on this field.`
            : `This is load-bearing. Keep it on the fast path and do not bury it behind a `
              + `tap in any redesign.`,
      });
    }
  }

  const order: Record<InsightSeverity, number> = { critical: 0, warn: 1, info: 2, good: 3 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Features whose users are dramatically heavier users of Zeneva overall.
 *
 * The most useful output here and the easiest to over-read, so it is deliberately
 * conservative: both groups must clear `MIN_COHORT`, and the gap must be at least
 * 2×. Even then it is a pointer to an experiment, never a causal claim — heavy
 * users try more features, so some of this arrow points backwards.
 */
export function stickinessSignals(telemetry: PlatformTelemetry): Insight[] {
  const { engaged, sellers, adoption } = telemetry;
  const out: Insight[] = [];

  for (const a of adoption) {
    if (a.event.core) continue;
    const cohort = a.event.opportunity === 'sellers' ? sellers : engaged;
    const users = cohort.filter(u => num(u.featureUsage?.[a.event.key]) > 0);
    const others = cohort.filter(u => num(u.featureUsage?.[a.event.key]) === 0);
    if (users.length < MIN_COHORT || others.length < MIN_COHORT) continue;

    const meanHours = (list: InsightUserLike[]) =>
      list.reduce((s, u) => s + num(u.totalUsageSeconds), 0) / list.length / 3600;
    const withFeature = meanHours(users);
    const withoutFeature = meanHours(others);
    if (withoutFeature <= 0 || withFeature / withoutFeature < 2) continue;

    out.push({
      id: `sticky-${a.event.key}`,
      severity: 'good',
      title: `${a.event.label} goes with ${(withFeature / withoutFeature).toFixed(1)}× more app time`,
      finding:
        `${plural(users.length, 'user')} of it average ${withFeature.toFixed(1)}h in Zeneva, `
        + `against ${withoutFeature.toFixed(1)}h for the ${others.length} who have never used it. `
        + `This is a correlation, not a cause — heavy users try more things.`,
      recommendation:
        `Worth one experiment: put this feature in front of the ${others.length} who have `
        + `not tried it and see whether their usage moves. If it does, it belongs in `
        + `onboarding. If it does not, the arrow was pointing the other way.`,
      cohortIds: others.map(u => u.id),
      cohortLabel: `Never used ${a.event.label}`,
    });
  }

  return out.sort((a, b) => (b.cohortIds?.length ?? 0) - (a.cohortIds?.length ?? 0));
}
