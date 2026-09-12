/**
 * Turns `app_launches` documents into the funnel the admin panel draws.
 *
 * Pure, and `now` is an input where it is needed at all — the same rule
 * `src/lib/forensics.ts` and `src/lib/business-rating.ts` follow, and for the same
 * reason: "why does it say 9 people dropped at the login screen" has to be
 * answerable by re-running a function over the same documents.
 *
 * Two honesty rules this module enforces rather than leaves to the UI:
 *
 * - **A stage nobody reached is 0, not absent.** The whole point of the panel is
 *   to show where the funnel stops, and a step that renders nothing looks like a
 *   step that was not measured.
 * - **`lostAt` counts installs whose furthest stage is *exactly* that step**, so
 *   the drop-off column sums to the number of installs that never signed up. A
 *   cumulative "reached" count cannot answer "what happened to those users"; this
 *   can.
 */

import { LAUNCH_STAGE_ORDER, type LaunchStage } from './launch-telemetry';

export interface LaunchEventRecord {
  stage: string;
  at: string;
  detail?: string | null;
}

export interface LaunchFailureRecord {
  stage: string;
  code: string;
  at: string;
}

/** One `app_launches` document, as the client SDK hands it over. */
export interface LaunchDoc {
  installId: string;
  platform?: string;
  appVersion?: string;
  locale?: string;
  country?: string;
  screen?: string;
  userAgent?: string;
  launches?: number;
  /** ISO string written by the client on its genuine first launch. */
  firstSeenAt?: string;
  /** Firestore Timestamp — server time, and the trustworthy one. */
  lastSeenAt?: { toDate?: () => Date; seconds?: number } | null;
  signedUp?: boolean;
  onboarded?: boolean;
  stages?: Record<string, string>;
  events?: LaunchEventRecord[];
  failures?: LaunchFailureRecord[];
}

/** A funnel step as drawn. `stages` is the set that satisfies it. */
interface StepDefinition {
  key: string;
  label: string;
  /** Plain-language answer to "what does this person having done this mean". */
  hint: string;
  /** Any one of these stages counts as having reached the step. */
  stages: LaunchStage[];
}

/**
 * The funnel, top to bottom.
 *
 * `saw_a_way_in` is one step rather than three because the three routes are
 * alternatives, not a sequence — a desktop first-launcher now lands on /welcome
 * and a returning one on /login, and counting those separately would show every
 * install dropping out of a step it was never sent to.
 */
const STEPS: StepDefinition[] = [
  {
    key: 'opened',
    label: 'Opened the app',
    hint: 'The install launched and rendered. Every row below is a subset of this.',
    stages: [],
  },
  {
    key: 'saw_a_way_in',
    label: 'Reached a sign-in screen',
    hint: 'Landed on the welcome carousel, the login form or the sign-up form.',
    stages: ['reached_welcome', 'reached_login', 'reached_signup'],
  },
  {
    key: 'reached_signup',
    label: 'Opened the sign-up form',
    hint: 'Chose to create an account rather than log in or quit.',
    stages: ['reached_signup'],
  },
  {
    key: 'signup_started',
    label: 'Submitted the sign-up form',
    hint: 'Pressed create-account or Google. Anyone lost here hit an error.',
    stages: ['signup_started'],
  },
  {
    key: 'signup_succeeded',
    label: 'Account created',
    hint: 'Firebase accepted the credentials and the account exists.',
    stages: ['signup_succeeded'],
  },
  {
    key: 'onboarding_completed',
    label: 'Finished setup',
    hint: 'Completed onboarding and reached the dashboard — a usable shop.',
    stages: ['onboarding_completed'],
  },
];

export interface FunnelStep {
  key: string;
  label: string;
  hint: string;
  /** Installs that reached this step. */
  reached: number;
  /** Installs whose furthest progress is exactly this step. */
  lostHere: number;
  /** Share of installs that reached this step, 0–100, rounded. */
  reachedPct: number;
  /** Share of the previous step that carried through, 0–100. Null on step one. */
  carryPct: number | null;
}

export interface CountedValue {
  value: string;
  count: number;
}

export interface LaunchFunnelSummary {
  /** Installs that reported anything at all. */
  installs: number;
  /** Installs that created an account. */
  signedUp: number;
  /** Installs that finished onboarding. */
  onboarded: number;
  /** signedUp / installs as a percentage, 0–100, one decimal. */
  conversionPct: number;
  /** Installs that opened the app more than once without signing up — they came
   *  back and still could not or would not start. */
  returnedWithoutSigningUp: number;
  /** Installs with at least one recorded failure. */
  installsWithFailures: number;
  steps: FunnelStep[];
  /** The step that loses the most installs. Null when there are no installs. */
  worstStep: FunnelStep | null;
  /** Failure codes, commonest first. */
  failureCodes: CountedValue[];
  /** Device language of installs that did NOT sign up, commonest first. The
   *  question the new Store listings raise, so it is asked of the lost group
   *  rather than of everybody. */
  lostLocales: CountedValue[];
  platforms: CountedValue[];
  countries: CountedValue[];
  appVersions: CountedValue[];
  /** Smallest window heights seen, as a plain string. A cramped window is a real
   *  reason a primary button goes unseen, and it is cheap to check. */
  screens: CountedValue[];
}

/** Normalises a locale to its base language, so `pt-BR` and `pt-PT` group. */
export function baseLanguage(locale: string | undefined): string {
  if (!locale) return 'unknown';
  const base = String(locale).trim().toLowerCase().split(/[-_]/)[0];
  return base || 'unknown';
}

/**
 * How far this install got.
 *
 * Walks the order backwards and returns the last stage present, so an install
 * that reached signup and then failed still reports `signup_started` rather than
 * being pulled back by the failure. Falls back to `app_opened`: the document
 * existing is itself proof the app was opened, and `app_opened` is deliberately
 * never written into `stages` (it is per-session, so it would overwrite the
 * first-launch time on every relaunch).
 */
export function furthestStage(doc: LaunchDoc): LaunchStage {
  const stages = doc.stages || {};
  for (let i = LAUNCH_STAGE_ORDER.length - 1; i >= 0; i--) {
    const stage = LAUNCH_STAGE_ORDER[i];
    if (stages[stage]) return stage;
  }
  return 'app_opened';
}

/** Which drawn step an install's furthest stage belongs to. */
function stepIndexFor(doc: LaunchDoc): number {
  const stages = doc.stages || {};
  let furthest = 0;
  for (let i = 1; i < STEPS.length; i++) {
    if (STEPS[i].stages.some((s) => stages[s])) furthest = i;
  }
  return furthest;
}

function tally(values: Array<string | undefined>, limit = 12): CountedValue[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = raw && String(raw).trim() ? String(raw).trim() : 'unknown';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    // Count desc, then value asc so the order is stable across renders rather
    // than depending on Map insertion for ties.
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

export function summariseLaunches(docs: LaunchDoc[]): LaunchFunnelSummary {
  const installs = docs.length;

  const reached = STEPS.map(() => 0);
  const lost = STEPS.map(() => 0);

  for (const doc of docs) {
    const index = stepIndexFor(doc);
    lost[index] += 1;
    // Cumulative: reaching step N means having reached every step before it. The
    // steps are alternatives-collapsed, so this is true by construction and is
    // what keeps the funnel monotonic even when a route is skipped.
    for (let i = 0; i <= index; i++) reached[i] += 1;
  }

  const steps: FunnelStep[] = STEPS.map((step, i) => ({
    key: step.key,
    label: step.label,
    hint: step.hint,
    reached: reached[i],
    lostHere: lost[i],
    reachedPct: installs ? Math.round((reached[i] / installs) * 100) : 0,
    carryPct:
      i === 0 ? null : reached[i - 1] ? Math.round((reached[i] / reached[i - 1]) * 100) : 0,
  }));

  // The last step cannot "lose" anyone — finishing setup is the goal — so it is
  // excluded from the worst-step search rather than winning it by default.
  const candidates = steps.slice(0, -1);
  const worstStep =
    candidates.reduce<FunnelStep | null>(
      (worst, step) => (!worst || step.lostHere > worst.lostHere ? step : worst),
      null,
    ) ?? null;

  const lostDocs = docs.filter((d) => !d.signedUp);

  const failureCodes = tally(
    docs.flatMap((d) => (d.failures || []).map((f) => f.code || 'unknown')),
    16,
  );

  return {
    installs,
    signedUp: docs.filter((d) => d.signedUp).length,
    onboarded: docs.filter((d) => d.onboarded).length,
    conversionPct: installs
      ? Math.round((docs.filter((d) => d.signedUp).length / installs) * 1000) / 10
      : 0,
    returnedWithoutSigningUp: docs.filter((d) => !d.signedUp && (d.launches || 1) > 1)
      .length,
    installsWithFailures: docs.filter((d) => (d.failures || []).length > 0).length,
    steps,
    worstStep: worstStep && worstStep.lostHere > 0 ? worstStep : null,
    failureCodes,
    lostLocales: tally(lostDocs.map((d) => baseLanguage(d.locale))),
    platforms: tally(docs.map((d) => d.platform)),
    countries: tally(docs.map((d) => d.country)),
    appVersions: tally(docs.map((d) => d.appVersion)),
    screens: tally(docs.map((d) => d.screen), 8),
  };
}

/** Server time if there is one, else the client's first-launch claim, else null. */
export function launchDate(doc: LaunchDoc): Date | null {
  const stamp = doc.lastSeenAt;
  if (stamp && typeof stamp.toDate === 'function') return stamp.toDate();
  if (stamp && typeof stamp.seconds === 'number') return new Date(stamp.seconds * 1000);
  if (doc.firstSeenAt) {
    const parsed = Date.parse(doc.firstSeenAt);
    if (Number.isFinite(parsed)) return new Date(parsed);
  }
  return null;
}

/** Human label for a stage, for the per-install table. */
export const STAGE_LABELS: Record<string, string> = {
  app_opened: 'Opened the app only',
  reached_welcome: 'Saw the welcome carousel',
  reached_login: 'Saw the login form',
  reached_signup: 'Saw the sign-up form',
  login_attempted: 'Tried to log in',
  signup_started: 'Submitted sign-up',
  signup_succeeded: 'Created an account',
  onboarding_started: 'Started setup',
  onboarding_completed: 'Finished setup',
  signup_failed: 'Sign-up failed',
  login_failed: 'Login failed',
  login_succeeded: 'Logged in',
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] || stage;
}
