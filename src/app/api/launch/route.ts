/**
 * POST /api/launch — anonymous first-run funnel telemetry.
 *
 * ## Why this endpoint exists
 *
 * The Microsoft Store reported 29 installs, 10 first-time launches and 1 signup,
 * and nothing in this codebase could say what the other 9 people saw. Every
 * analytics path we had was gated on a signed-in user:
 * `components/UserActivityTracker.tsx` subscribes to `onAuthStateChanged` and
 * returns on a null user, `download_clicks` only covers the marketing site's
 * download buttons, and `api/track` is an email-open pixel. Somebody who opened
 * the app, read the login form and quit was invisible.
 *
 * ## Unauthenticated, and what that constrains
 *
 * It has to be: the whole population it measures has no account. `error_logs`
 * (`firestore.rules:222`, `allow create: if true`) is the existing precedent for
 * an unauthenticated write, and `download_clicks` is the precedent for
 * cookie/id-keyed anonymous funnel data. Consequences, all deliberate:
 *
 * - **Nothing identifying is accepted.** No uid, no email, no typed input. The
 *   body's only free-text field is `detail`, which is truncated and only ever
 *   holds a Firebase error code or a short tag. A hostile caller must not be able
 *   to plant a customer's email in the platform-owner's admin panel.
 * - **A caller can only affect its own document.** The doc id is the caller's own
 *   `installId`, so the worst available abuse is inflating one record — not
 *   corrupting the funnel for real installs, and not reading anything back.
 *   `app_launches` has no `firestore.rules` entry, so the super-admin catch-all
 *   at `firestore.rules:11-19` is the only read path.
 * - **One write, no read.** Firestore cost is a standing constraint. The handler
 *   is a single `set(..., {merge: true})`; "how far did this install get" is
 *   derived in the admin panel from the `stages` map rather than maintained here,
 *   which would have needed a read per event.
 *
 * ## Two shapes worth not breaking
 *
 * `stages` is written as a **nested map**, never a dotted `stages.<name>` key:
 * `set()` does not parse dots as field paths, so the dotted form creates a
 * top-level field with a literal dot in its name. That exact bug cost this
 * codebase the whole per-route `pageViews` history once
 * (`components/UserActivityTracker.tsx`) and the AI usage rollup another time.
 *
 * `app_opened` deliberately does **not** land in `stages` or `events`. It is sent
 * once per session rather than once per install, so writing it into either would
 * overwrite the first-launch timestamp on every relaunch and grow `events`
 * without bound. Repeat launches are counted in `launches`, and the document
 * existing at all is itself the proof that the app was opened.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/firebase/admin';

/** Meaningless on a POST handler and injected into a batch of these files once —
 *  see the API routes section of CLAUDE.md. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Native builds are a static export and call this by absolute URL from a
 * `tauri://` origin, which is cross-origin; a JSON body triggers a preflight, so
 * without `OPTIONS` the desktop and mobile shells could not report at all — and
 * the desktop shell is the entire reason this exists.
 *
 * `Allow-Credentials` is absent: there is no ambient cookie here and nothing to
 * read back, so there is nothing for a hostile page to gain by calling it.
 */
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/** Must match `LaunchStage` in `src/lib/launch-telemetry.ts`. Anything else is
 *  rejected rather than stored — an allow-list is what keeps an unauthenticated
 *  endpoint from becoming arbitrary key-value storage. */
const STAGES = new Set([
  'app_opened',
  'reached_welcome',
  'reached_login',
  'reached_signup',
  'signup_started',
  'signup_failed',
  'signup_succeeded',
  'onboarding_started',
  'onboarding_completed',
  'login_attempted',
  'login_failed',
  'login_succeeded',
]);

const PLATFORMS = new Set(['windows', 'macos', 'linux', 'android', 'ios', 'web']);

const MAX_DETAIL = 120;
const MAX_UA = 400;

const INSTALL_ID_PATTERN = new RegExp('^[0-9a-zA-Z-]{8,64}$');
const SCREEN_PATTERN = new RegExp('^[0-9]{2,5}x[0-9]{2,5}$');

/**
 * Trims, drops control characters, and truncates.
 *
 * Written as a code-point loop rather than a regex character class on purpose: an
 * escape sequence inside a class is a standing hazard in this repo, where an
 * escape can decode to a literal control byte in the source and silently change
 * which range is stripped. The two patterns above avoid backslash escapes for the
 * same reason.
 */
function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let out = '';
  for (const ch of trimmed) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) out += ch;
  }
  return out.slice(0, max) || null;
}

/**
 * Accepts the client's own timestamp, because a queued event from a previous
 * launch is *supposed* to arrive late and keep the time it happened. Bounded so a
 * broken or hostile clock cannot file an event in 2049 and sit at the top of
 * every admin sort. `lastSeenAt` on the document is server time and is the
 * trustworthy anchor.
 */
function clientTime(value: unknown): string {
  const now = Date.now();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (
      Number.isFinite(parsed) &&
      parsed > now - 30 * 24 * 60 * 60 * 1000 &&
      parsed < now + 24 * 60 * 60 * 1000
    ) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date(now).toISOString();
}

export async function POST(request: NextRequest) {
  // A telemetry failure must never look like a broken app to the caller, so no
  // rejection below carries anything actionable — the client does not retry on a
  // 4xx, and it has nothing to show a user anyway.
  try {
    if (!adminFirestore) {
      return NextResponse.json({ ok: false }, { headers: corsHeaders });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false }, { status: 400, headers: corsHeaders });
    }

    const installId = clean(body.installId, 64);
    const stage = typeof body.stage === 'string' ? body.stage : '';

    // The id is the document path, so it is validated tightly rather than
    // sanitised — a slash would silently write into a subcollection.
    if (!installId || !INSTALL_ID_PATTERN.test(installId) || !STAGES.has(stage)) {
      return NextResponse.json({ ok: false }, { status: 400, headers: corsHeaders });
    }

    const at = clientTime(body.at);
    const detail = clean(body.detail, MAX_DETAIL);
    const platform =
      typeof body.platform === 'string' && PLATFORMS.has(body.platform)
        ? body.platform
        : 'unknown';

    const update: Record<string, any> = {
      installId,
      platform,
      lastSeenAt: FieldValue.serverTimestamp(),
      appVersion: clean(body.appVersion, 24) ?? 'unknown',
      locale: clean(body.locale, 16) ?? 'unknown',
      userAgent: clean(request.headers.get('user-agent'), MAX_UA) ?? 'unknown',
      // Whichever edge set one. Absent locally, which reads as 'unknown' rather
      // than a wrong guess.
      country:
        clean(request.headers.get('x-vercel-ip-country'), 8) ??
        clean(request.headers.get('cf-ipcountry'), 8) ??
        'unknown',
    };

    const screen = clean(body.screen, 16);
    if (screen && SCREEN_PATTERN.test(screen)) update.screen = screen;

    if (stage === 'app_opened') {
      update.launches = FieldValue.increment(1);
      // Only the install's genuine first launch claims this, so a relaunch does
      // not move the date the funnel started.
      if (body.first === true) update.firstSeenAt = at;
    } else {
      // Deep-merged, so this adds one key to the map and leaves the rest alone.
      // NOT a dotted path — see the header note.
      update.stages = { [stage]: at };
      update.events = FieldValue.arrayUnion({ stage, at, detail: detail ?? null });
    }

    if (stage === 'signup_succeeded') update.signedUp = true;
    if (stage === 'onboarding_completed') update.onboarded = true;
    if (stage === 'signup_failed' || stage === 'login_failed') {
      update.failures = FieldValue.arrayUnion({
        stage,
        code: detail ?? 'unknown',
        at,
      });
    }

    await adminFirestore
      .collection('app_launches')
      .doc(installId)
      .set(update, { merge: true });

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (err) {
    console.error('[api/launch] failed to record launch stage:', err);
    return NextResponse.json({ ok: false }, { status: 500, headers: corsHeaders });
  }
}
