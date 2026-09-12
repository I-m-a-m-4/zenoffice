'use client';

/**
 * Anonymous funnel telemetry for people who open the app and never sign up.
 *
 * Why this exists at all: every other analytics surface in the codebase is
 * gated on a signed-in user. `UserActivityTracker` subscribes to
 * `onAuthStateChanged` and returns immediately when `user` is null;
 * `download_clicks` only sees the marketing site's download buttons; `api/track`
 * is an email open pixel. So a Store install that launched, looked at the login
 * form and quit left **no trace anywhere** — which is why "29 installs, 10
 * launches, 1 signup" could not be explained from our own data.
 *
 * Three rules this module keeps:
 *
 * - **No identity, ever.** The key is a random `installId` in localStorage. No
 *   email, no typed text, no uid. `signup_succeeded` deliberately carries
 *   nothing that ties the install to the account it created — the point is to
 *   count the funnel, not to follow a person, and this endpoint is
 *   unauthenticated so anything it stored would be attacker-suppliable.
 * - **One write per stage per install.** Firestore cost is a standing
 *   constraint (see CLAUDE.md), and the funnel only needs the first time each
 *   thing happened. `app_opened` is the exception: once per *session*, so we can
 *   tell a person who opened the app four times and never signed up from one who
 *   opened it once. Failures dedupe on stage+code, so a new error code is
 *   recorded but the same one looping is not.
 * - **Never block, never throw, never surface.** A telemetry failure must be
 *   invisible to a user who is already struggling to get in. Everything is
 *   fire-and-forget behind a try/catch, and an undelivered event goes into a
 *   small localStorage queue that the next launch flushes — a first launch on a
 *   bad connection is exactly the case worth keeping.
 */

import { AppConfig } from './config';
import { apiBase, isFirstLaunchEver, isMobileApp, isNativeApp } from './platform';

/**
 * The funnel, in order. `LAUNCH_STAGE_ORDER` below is the same list and is what
 * the admin panel uses to work out how far an install got, so a new stage has to
 * be added in the right position rather than appended.
 */
export type LaunchStage =
  | 'app_opened'
  | 'reached_welcome'
  | 'reached_login'
  | 'reached_signup'
  | 'signup_started'
  | 'signup_failed'
  | 'signup_succeeded'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'login_attempted'
  | 'login_failed'
  | 'login_succeeded';

/**
 * Progress order for "how far did this install get". Failure stages are absent
 * on purpose: a failure is not progress, and including `signup_failed` between
 * `signup_started` and `signup_succeeded` would report a stuck install as
 * further along than one still typing.
 */
export const LAUNCH_STAGE_ORDER: LaunchStage[] = [
  'app_opened',
  'reached_welcome',
  'reached_login',
  'reached_signup',
  'login_attempted',
  'signup_started',
  'signup_succeeded',
  'onboarding_started',
  'onboarding_completed',
];

const INSTALL_ID_KEY = 'zeneva_install_id';
const SENT_STAGES_KEY = 'zeneva_launch_sent';
const QUEUE_KEY = 'zeneva_launch_queue';
const SESSION_OPENED_KEY = 'zeneva_launch_session_open';

/** Undelivered events kept across launches. Small on purpose — this is a funnel,
 *  not a log, and an install that has generated 20 pending events has already
 *  told us what we needed to know. */
const MAX_QUEUE = 20;
/** Bound on the dedupe set so a long-lived install cannot grow it forever. */
const MAX_SENT = 60;
const MAX_DETAIL = 120;

export interface LaunchEventPayload {
  installId: string;
  stage: LaunchStage;
  /** Firebase error code, route, or other short machine-readable tag. */
  detail?: string;
  /** Stamped on the client so a queued event keeps the time it happened. */
  at: string;
  /** `app_opened` only: this is the install's very first launch. */
  first?: boolean;
  platform: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web';
  appVersion: string;
  locale: string;
  /** e.g. "1280x720" — a cramped window is a plausible reason a CTA was missed. */
  screen?: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode. Losing the dedupe set costs a duplicate write, not
    // correctness — the server merges on installId and stage.
  }
}

/**
 * Stable per-install id. Random, so it identifies the install and nothing else.
 *
 * A device where localStorage throws gets a fresh id every session, which shows
 * up as several one-event installs rather than one install with a history. That
 * is the honest failure: better than dropping the event, and better than any
 * fingerprint we could synthesise instead.
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('ZenevaTelemetry', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('ZenevaTelemetry', 4, 17);
    const result = canvas.toDataURL();
    let hash = 0;
    for (let i = 0; i < result.length; i++) {
      hash = (hash << 5) - hash + result.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  } catch {
    return '';
  }
}

export function getInstallId(): string {
  if (typeof window === 'undefined') return 'server';

  // 1. Try to read a previously stored or cached device ID
  try {
    const existing = window.localStorage.getItem(INSTALL_ID_KEY);
    if (existing && existing.startsWith('dev-')) return existing;
  } catch {
    /* fall through */
  }

  // 2. Generate a stable device fingerprint (cross-browser compatible on same hardware)
  const screenSpec = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const osSpec = detectPlatform();
  const canvasSpec = getCanvasFingerprint();
  const combined = `${osSpec}-${screenSpec}-${canvasSpec}`;

  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  const fingerprint = `dev-${Math.abs(hash).toString(16)}`;

  try {
    window.localStorage.setItem(INSTALL_ID_KEY, fingerprint);
  } catch {
    /* session-only or temporary */
  }

  return fingerprint;
}

function detectPlatform(): LaunchEventPayload['platform'] {
  if (!isNativeApp()) return 'web';
  const ua = navigator.userAgent;
  if (isMobileApp()) return /android/i.test(ua) ? 'android' : 'ios';
  if (/mac/i.test(ua)) return 'macos';
  if (/windows/i.test(ua)) return 'windows';
  return 'linux';
}

/**
 * The key a stage dedupes on. Failures include their code so a *different*
 * failure is still recorded — that is the field most likely to explain a lost
 * install, and collapsing all failures into one key would hide the second cause.
 */
function dedupeKey(stage: LaunchStage, detail?: string): string {
  return stage.endsWith('_failed') && detail ? `${stage}:${detail}` : stage;
}

async function deliver(payload: LaunchEventPayload): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Survives the page being torn down, which matters because several of
      // these fire immediately before a navigation.
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function enqueue(payload: LaunchEventPayload): void {
  const queue = readJson<LaunchEventPayload[]>(QUEUE_KEY, []);
  queue.push(payload);
  writeJson(QUEUE_KEY, queue.slice(-MAX_QUEUE));
}

/**
 * Records one funnel stage.
 *
 * Returns nothing and never rejects — callers are in the middle of an auth flow
 * and must not learn that this failed. `void trackLaunchStage(...)` at the call
 * site is deliberate.
 */
export async function trackLaunchStage(
  stage: LaunchStage,
  detail?: string,
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const key = dedupeKey(stage, detail);

    if (stage === 'app_opened') {
      // Once per session rather than once per install, so repeat launches are
      // countable. sessionStorage is the right scope: a reload inside one
      // session is not a new launch, a relaunch is.
      try {
        if (window.sessionStorage.getItem(SESSION_OPENED_KEY)) return;
        window.sessionStorage.setItem(SESSION_OPENED_KEY, '1');
      } catch {
        // No sessionStorage: fall through and send. An over-count of launches is
        // less misleading than silently dropping the only event that proves the
        // app was opened.
      }
    } else {
      const sent = readJson<string[]>(SENT_STAGES_KEY, []);
      if (sent.includes(key)) return;
      sent.push(key);
      writeJson(SENT_STAGES_KEY, sent.slice(-MAX_SENT));
    }

    const payload: LaunchEventPayload = {
      installId: getInstallId(),
      stage,
      at: new Date().toISOString(),
      platform: detectPlatform(),
      appVersion: AppConfig.version || 'unknown',
      locale:
        (typeof navigator !== 'undefined' && navigator.language) || 'unknown',
    };

    if (detail) payload.detail = String(detail).slice(0, MAX_DETAIL);
    if (stage === 'app_opened') payload.first = isFirstLaunchEver();
    try {
      payload.screen = `${window.screen.width}x${window.screen.height}`;
    } catch {
      /* optional */
    }

    const ok = await deliver(payload);
    if (!ok) enqueue(payload);
  } catch {
    // Telemetry must never be the reason a sign-up screen breaks.
  }
}

/**
 * Sends anything a previous session could not deliver. Called once from the
 * launch component, after `app_opened`, so a first launch on a dead connection
 * still reports itself the next time the app opens.
 */
export async function flushLaunchQueue(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const queue = readJson<LaunchEventPayload[]>(QUEUE_KEY, []);
    if (!queue.length) return;

    // Clear first. A retry storm that keeps failing would otherwise re-queue on
    // every launch forever, and these events are already historical.
    writeJson(QUEUE_KEY, []);

    const failed: LaunchEventPayload[] = [];
    for (const event of queue) {
      const ok = await deliver(event);
      if (!ok) {
        failed.push(event);
        // One dead request means the network is down; stop trying this session.
        break;
      }
    }
    if (failed.length) writeJson(QUEUE_KEY, failed);
  } catch {
    /* never surfaced */
  }
}

/** Route → stage, for the pathname watcher in `<LaunchTelemetry />`. */
export function stageForPath(pathname: string | null): LaunchStage | null {
  if (!pathname) return null;
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path.endsWith('/welcome')) return 'reached_welcome';
  if (path.endsWith('/login')) return 'reached_login';
  if (path.endsWith('/signup')) return 'reached_signup';
  if (path.endsWith('/onboarding')) return 'onboarding_started';
  return null;
}
