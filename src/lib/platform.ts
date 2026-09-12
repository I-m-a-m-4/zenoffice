'use client';

/**
 * Platform detection for the Tauri shells.
 *
 * The codebase already checks `window.__TAURI_INTERNALS__` inline in a number
 * of components; these helpers exist so the *routing* decisions that differ
 * between desktop and mobile live in exactly one place.
 */

/** Running inside a Tauri shell (desktop or mobile) rather than a browser. */
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

/**
 * Origin to prefix an `/api/...` fetch with.
 *
 * Native builds are a static export with no local server, so a relative fetch
 * resolves against `tauri://localhost` and 404s — they must call the hosted
 * deployment by absolute URL. The web app must NOT: hardcoding
 * `https://zeneva.space` there sends every local `npm run dev` request to
 * production, so a route you just added locally still 404s and a checkout you
 * are trying to test bills against the live site. Same-origin on web is what
 * makes local testing possible at all.
 *
 * The `|| 'https://zeneva.space'` fallback matters because `.env` is gitignored:
 * if `NEXT_PUBLIC_BASE_URL` is missing from the workflow-level `env:` block it
 * inlines as `undefined` in the nested Tauri rebuild (see CLAUDE.md) and every
 * call would hit `undefined/api/...`.
 */
export function apiBase(): string {
  if (!isNativeApp()) return '';
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://zeneva.space';
  return base.replace(/\/+$/, '');
}

/** Running inside the Android or iOS build specifically - not desktop, not web. */
export function isMobileApp(): boolean {
  if (!isNativeApp()) return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Set the first time this install renders anything. See isFirstLaunchEver. */
const FIRST_LAUNCH_KEY = 'zeneva_first_launch_at';

/**
 * Memoised so every caller in a session gets the same answer regardless of who
 * reads first. `markLaunched()` primes this before it writes, which is what
 * makes the flag safe to read *after* it has been set — see the note there.
 */
let firstLaunchCache: boolean | null = null;

/**
 * True when this device has never opened the app before.
 *
 * Deliberately a pure read: the marking is `markLaunched()`, called once from
 * the launch-telemetry component. `claimFirstSession` in
 * `components/UserActivityTracker.tsx` fuses the two and is documented as
 * unsafe to call twice for exactly that reason — here the routing decision and
 * the telemetry both need the answer, on the same tick, in an order React does
 * not promise.
 *
 * Storage being unavailable reports `true`. A returning user then sees the
 * welcome carousel with a "Sign in" button on it, which is recoverable; the
 * other way round hides the signup route from the person who needs it.
 */
export function isFirstLaunchEver(): boolean {
  // Not memoised during a server render: the answer there is meaningless and
  // caching it would only matter if module state leaked, which it does not.
  if (typeof window === 'undefined') return true;
  if (firstLaunchCache !== null) return firstLaunchCache;
  try {
    firstLaunchCache = window.localStorage.getItem(FIRST_LAUNCH_KEY) === null;
  } catch {
    firstLaunchCache = true;
  }
  return firstLaunchCache;
}

/**
 * Records that this install has now been opened.
 *
 * Reads through `isFirstLaunchEver()` first so the memo holds the pre-write
 * answer. Without that, whichever of the root-page redirect and the telemetry
 * effect happened to run second would see `false` on a genuine first launch and
 * send a brand new user to the login form.
 */
export function markLaunched(): void {
  isFirstLaunchEver();
  try {
    window.localStorage.setItem(FIRST_LAUNCH_KEY, new Date().toISOString());
  } catch {
    // Private mode or quota. The in-memory memo still holds for this session.
  }
}

/**
 * Where a signed-out visitor should land.
 *
 * Mobile opens on the /welcome carousel, which has its own route through to
 * /login and /signup.
 *
 * The desktop shell used to go straight to /login on every launch, including
 * the very first one. That is the wrong screen for a store install: a Microsoft
 * Store or Play install is, by definition, someone who has never had an
 * account, and /login leads with "Enter your email below to login to your
 * account" and carries signup as a ghost button in the corner. So a *first*
 * desktop launch gets the same carousel mobile does, where "Create account" is
 * the primary button; every launch after that goes to /login as before.
 *
 * Web is untouched — a browser visitor arrives through the marketing site,
 * which has already done this job.
 *
 * Signing out of the app also routes through here (`(app)/layout.tsx`), and by
 * then the install is marked, so it lands on /login rather than the carousel.
 */
export function signedOutLandingRoute(): string {
  if (isMobileApp()) return '/welcome';
  if (isFirstLaunchEver()) return '/signup';
  return '/login';
}

/** Where this install gets its updates from. */
export type UpdateChannel = 'play' | 'microsoft' | 'tauri' | 'web';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.zeneva.app';
const MS_STORE_URL =
  'https://apps.microsoft.com/detail/9nvn0f8njwmj';
/** Deep link that opens the Store app directly rather than the browser. */
const MS_STORE_PROTOCOL = 'ms-windows-store://pdp/?ProductId=9nvn0f8njwmj';

export function updateChannel(): UpdateChannel {
  if (!isNativeApp()) return 'web';
  if (isMobileApp()) return 'play';
  // Desktop. The MSI/EXE builds carry the Tauri updater and patch themselves,
  // so only the Store build needs to send the user somewhere. We cannot detect
  // the Store package from the webview, so treat Windows as Store-managed and
  // let TauriUpdater handle the sideloaded case - it shows its own banner and
  // this one stays hidden while an update is downloading.
  return navigator.userAgent.includes('Windows') ? 'microsoft' : 'tauri';
}

/** Store listing for this install, or null when there is nowhere to send them. */
export function storeUrl(channel: UpdateChannel = updateChannel()): string | null {
  switch (channel) {
    case 'play':
      return PLAY_STORE_URL;
    case 'microsoft':
      return MS_STORE_URL;
    default:
      return null;
  }
}

/** Human label for the update destination, e.g. "Google Play". */
export function storeName(channel: UpdateChannel = updateChannel()): string {
  switch (channel) {
    case 'play':
      return 'Google Play';
    case 'microsoft':
      return 'Microsoft Store';
    default:
      return 'Zeneva';
  }
}

/**
 * Opens the store listing. On Windows the ms-windows-store: protocol opens the
 * Store app directly; the https URL is the fallback when that is unavailable.
 */
export function openStore(channel: UpdateChannel = updateChannel()): void {
  if (channel === 'microsoft') {
    try {
      window.location.href = MS_STORE_PROTOCOL;
      return;
    } catch {
      // fall through to the browser URL
    }
  }
  const url = storeUrl(channel);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

/** Deep link that opens the Play Store app directly rather than the browser. */
const PLAY_STORE_PROTOCOL = 'market://details?id=com.zeneva.app';

/**
 * The native-app deep link for one of our store listings, or null for any other
 * URL. Matching on the https listing means callers only have to carry one URL.
 */
function storeProtocol(url: string): string | null {
  if (/apps\.microsoft\.com/i.test(url)) return MS_STORE_PROTOCOL;
  if (/play\.google\.com/i.test(url)) return PLAY_STORE_PROTOCOL;
  return null;
}

/**
 * Opens a URL outside the app.
 *
 * `window.open` is a no-op in the Tauri webview, so anything that has to leave
 * the app — a store listing, a help article — goes through the shell plugin
 * when we are running natively. Store URLs try their deep link first so the
 * Store/Play app opens instead of a browser tab; `shell:default` only scopes
 * http(s), so the non-http attempt rejects harmlessly and we fall back to the
 * web listing rather than navigating the shell somewhere it cannot return from.
 */
export async function openExternal(url: string): Promise<void> {
  if (!url) return;

  if (isNativeApp()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const deepLink = storeProtocol(url);
      if (deepLink) {
        try {
          await invoke('plugin:shell|open', { path: deepLink });
          return;
        } catch {
          // scope rejects non-http schemes - use the web listing below
        }
      }
      await invoke('plugin:shell|open', { path: url });
      return;
    } catch {
      // plugin unavailable - let the webview try
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Deep link that opens the Store's *review* prompt rather than the listing.
 * There is no Play equivalent — `market://details` is as close as it gets, and
 * the in-app review API is not reachable from the webview.
 */
const MS_STORE_REVIEW_PROTOCOL =
  'ms-windows-store://review/?ProductId=9nvn0f8njwmj';

/** Which store this install is rated on. */
export type ReviewStore = 'play' | 'microsoft';

/**
 * Opens the rating prompt for one of our store listings.
 *
 * Separate from `openExternal` only because `storeProtocol` maps a Microsoft
 * listing to the *product page* deep link, and a Rate button wants the review
 * one. Everything else is the same, and the important half is the same: a bare
 * `window.open` is a no-op in the Tauri webview and an `href` to a non-http
 * scheme is dropped by the CSP, which is why the Settings "Rate Zeneva" button
 * did nothing at all on desktop and Android. Anything leaving the app has to go
 * through `plugin:shell|open`.
 *
 * `shell:default` scopes http(s) only, so the deep-link attempt is expected to
 * reject on some installs — the https listing is the fallback, not an error path.
 */
export async function openStoreReview(store: ReviewStore): Promise<void> {
  const deepLink =
    store === 'microsoft' ? MS_STORE_REVIEW_PROTOCOL : PLAY_STORE_PROTOCOL;
  const listing = store === 'microsoft' ? MS_STORE_URL : PLAY_STORE_URL;

  if (isNativeApp()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('plugin:shell|open', { path: deepLink });
        return;
      } catch {
        // scope rejects non-http schemes - use the web listing below
      }
      await invoke('plugin:shell|open', { path: listing });
      return;
    } catch {
      // plugin unavailable - let the webview try
    }
  }

  window.open(listing, '_blank', 'noopener,noreferrer');
}

/**
 * Semver compare limited to the numeric major.minor.patch prefix.
 * Returns true when `latest` is strictly newer than `current`.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) =>
    String(v ?? '')
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length, 3); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}
