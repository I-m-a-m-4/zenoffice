/**
 * The one place a Zeneva event becomes an operating-system notification.
 *
 * There used to be two near-identical implementations of this — this module and
 * `src/hooks/use-native-notifications.ts` — plus a raw `new Notification(...)` in
 * a report card, and *two* Firestore listeners bridging the same documents. One
 * support reply could therefore raise four separate popups, while an admin
 * broadcast raised none: the redundancy hid the fact that each path covered a
 * different subset of the sources. Everything now funnels through
 * {@link triggerNativeNotification}, which is the only caller of the platform
 * notification API.
 *
 * Three rules hold this together:
 *
 * 1. **Native shells only.** Notifications through the browser's `Notification`
 *    API were removed on purpose — they are unreliable across the PWA, the TWA and
 *    plain tabs, and the app's own bell plus a toast already cover the browser. In
 *    a browser this module is a no-op by design, not by accident.
 *
 * 2. **De-duplicated on the way out**, not at each call site. A caller cannot know
 *    what another listener already showed, so the window here is the guard. Both a
 *    caller-supplied `key` (prefer the Firestore document id) and a hash of the
 *    body are checked: the support-thread listener and the notification-document
 *    listener describe the same message with different titles, so the title cannot
 *    be part of the identity.
 *
 * 3. **Every notification carries where it goes.** `extra.url` rides along in the
 *    payload and {@link startActionListener} routes it when the notification is
 *    tapped. Sending `{title, body}` and nothing else — which is what this file did
 *    before — produces a notification that does nothing when touched.
 */

import { openExternal } from '@/lib/platform';
import { playNotificationSound } from '@/lib/sound';

export type NativeNotificationRequest = {
  /**
   * Stable identity for this notification. Use the Firestore document id where one
   * exists; two listeners reacting to the same document then collapse to one popup.
   */
  key: string;
  title: string;
  body: string;
  /** In-app route (`/notifications?n=abc`) or an `http(s)` URL for the OS to open. */
  url?: string;
};

/**
 * How long the same notification is suppressed for.
 *
 * Long enough to cover a listener re-attach and a React remount, short enough that
 * a genuinely repeated alert — a second low-stock warning after a restock — still
 * gets through.
 */
const DEDUPE_WINDOW_MS = 90_000;

/** Cap on the de-dupe map so a long session cannot grow it without bound. */
const DEDUPE_MAX_ENTRIES = 200;

/**
 * How long after a notification a regained-focus event still counts as its tap.
 *
 * See {@link startDesktopTapWatcher} for why this heuristic exists at all.
 */
const DESKTOP_TAP_WINDOW_MS = 25_000;

const PENDING_TAP_KEY = 'zeneva_pending_notification_tap';

/** Identity -> when it was last shown. Module scope, so it survives remounts. */
const recentlyShown = new Map<string, number>();

/**
 * In-app navigation, handed in by the listener component.
 *
 * This module cannot call `useRouter`, and `window.location.assign` inside the
 * Tauri webview costs a full reload of the app shell. The listener registers the
 * Next router instead; the assign below is only the fallback for a tap that
 * arrives before any component has mounted.
 */
let routerPush: ((path: string) => void) | null = null;

let actionListenerStarted = false;
let desktopTapWatcherStarted = false;

export function isTauriEnv(): boolean {
  return (
    typeof window !== 'undefined' &&
    (!!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__)
  );
}

/** Register the in-app navigator. Called once by `NativeNotificationListener`. */
export function setNativeNotificationRouter(push: (path: string) => void): void {
  routerPush = push;
}

/**
 * Send the viewer to wherever a notification pointed.
 *
 * Store listings and other off-app URLs go through `openExternal`, which prefers
 * the `ms-windows-store:` / Play deep link and falls back to the OS browser —
 * `window.open` is a no-op inside the webview, which is how the "get us on the
 * Microsoft Store" notification used to do nothing at all when tapped.
 */
async function navigateTo(url: string): Promise<void> {
  if (!url) return;
  try {
    if (/^https?:\/\//i.test(url)) {
      await openExternal(url);
      return;
    }
    if (routerPush) {
      routerPush(url);
      return;
    }
    if (typeof window !== 'undefined') window.location.assign(url);
  } catch (err) {
    console.warn('[notifications] Could not follow notification link:', err);
  }
}

/**
 * Subscribe to notification taps.
 *
 * `onAction` fires on Android and iOS when the notification body is tapped, which
 * is the case this was asked for. Desktop Tauri does not deliver a click callback
 * at all, so {@link startDesktopTapWatcher} covers that separately. Registered
 * lazily on first send rather than at import, because subscribing pulls in the
 * plugin and a browser build must not.
 */
async function startActionListener(): Promise<void> {
  if (actionListenerStarted || !isTauriEnv()) return;
  actionListenerStarted = true;
  try {
    const { onAction } = await import('@tauri-apps/plugin-notification');
    await onAction((notification: any) => {
      const url = notification?.extra?.url;
      if (typeof url === 'string' && url) void navigateTo(url);
    });
  } catch (err) {
    // A shell without the listener permission must still be able to *show*
    // notifications; only the tap-through is lost. Reset the flag so a later
    // send can retry rather than leaving it permanently disabled.
    console.warn('[notifications] Tap listener unavailable:', err);
    actionListenerStarted = false;
  }
}

/**
 * Best-effort tap handling for desktop, where no click callback exists.
 *
 * Clicking a Windows toast activates the app window. So: when a notification is
 * raised while the window is hidden, remember where it pointed; if the window
 * becomes visible within {@link DESKTOP_TAP_WINDOW_MS}, treat that as the tap.
 *
 * This is a heuristic and is deliberately narrow — it only arms while the window
 * was *hidden*, so alt-tabbing back to an app you were already looking at cannot
 * trigger it. The worst case is one unexpected navigation to a page describing a
 * notification the person just received, which is also where tapping would land.
 */
function startDesktopTapWatcher(): void {
  if (desktopTapWatcherStarted || typeof document === 'undefined') return;
  desktopTapWatcherStarted = true;

  const flush = () => {
    if (document.visibilityState !== 'visible') return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(PENDING_TAP_KEY);
      sessionStorage.removeItem(PENDING_TAP_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const pending = JSON.parse(raw) as { url?: string; at?: number };
      if (!pending?.url || !pending.at) return;
      if (Date.now() - pending.at > DESKTOP_TAP_WINDOW_MS) return;
      void navigateTo(pending.url);
    } catch {
      // Malformed entry — already cleared above.
    }
  };

  document.addEventListener('visibilitychange', flush);
  window.addEventListener('focus', flush);
}

/** Cheap, stable hash of the message body, used as a second de-dupe identity. */
function bodyFingerprint(body: string): string {
  const normalised = (body || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 200);
  let hash = 0;
  for (let i = 0; i < normalised.length; i++) {
    hash = (hash * 31 + normalised.charCodeAt(i)) | 0;
  }
  return `body:${hash}`;
}

/**
 * True when this notification has not been shown inside the window.
 *
 * Records both identities on the way through, so a later call matching either one
 * is suppressed.
 */
function claimIdentity(request: NativeNotificationRequest): boolean {
  const now = Date.now();

  if (recentlyShown.size > DEDUPE_MAX_ENTRIES) {
    for (const [id, at] of recentlyShown) {
      if (now - at > DEDUPE_WINDOW_MS) recentlyShown.delete(id);
    }
  }

  const identities = [
    request.key ? `key:${request.key}` : '',
    bodyFingerprint(request.body),
  ].filter(Boolean);

  for (const id of identities) {
    const shownAt = recentlyShown.get(id);
    if (shownAt !== undefined && now - shownAt < DEDUPE_WINDOW_MS) return false;
  }

  identities.forEach((id) => recentlyShown.set(id, now));
  return true;
}

/** Ask for native notification permission. Safe to call repeatedly. */
export async function initNativeNotificationPermissions(): Promise<boolean> {
  if (!isTauriEnv()) return false;
  try {
    const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === 'granted';
  } catch (err) {
    console.warn('[notifications] Permission check failed:', err);
    return false;
  }
}

/**
 * Raise one operating-system notification.
 *
 * No-op outside a Tauri shell, and no-op for an identity already shown inside
 * {@link DEDUPE_WINDOW_MS}. Never throws — a failed notification must not take
 * down the listener that asked for it.
 */
export async function triggerNativeNotification(request: NativeNotificationRequest): Promise<void> {
  try {
    if (!request?.title || !isTauriEnv()) return;
    if (!claimIdentity(request)) return;

    const granted = await initNativeNotificationPermissions();
    if (!granted) return;

    const { sendNotification } = await import('@tauri-apps/plugin-notification');

    void startActionListener();
    startDesktopTapWatcher();

    // Armed only while the window is hidden — see startDesktopTapWatcher.
    if (request.url && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      try {
        sessionStorage.setItem(PENDING_TAP_KEY, JSON.stringify({ url: request.url, at: Date.now() }));
      } catch {
        // Storage full or blocked: desktop tap-through is lost, the popup is not.
      }
    }

    playNotificationSound();

    sendNotification({
      title: request.title,
      body: request.body || '',
      largeBody: request.body || '',
      // Read back by the onAction handler above. Without it a tap has nowhere to go.
      extra: request.url ? { url: request.url } : {},
    });
  } catch (err) {
    console.warn('[notifications] Failed to raise native notification:', err);
  }
}
