'use client';

import { useEffect } from 'react';

/**
 * Recovers from the Firestore SDK's fatal internal assertion.
 *
 *   FIRESTORE (11.x) INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9|b815)
 *
 * This is an upstream firebase-js-sdk bug (still open against 12.x) triggered
 * by a listener teardown race: a target is detached while its Listen stream
 * still has in-flight changes. See firebase/firebase-js-sdk#9267 and #8856.
 *
 * The damage is not the thrown error itself - it is that the SDK's async queue
 * *panics permanently*. Every subsequent enqueue rethrows, so the app keeps
 * rendering but no query ever resolves again. That is what users see as a blank
 * screen after tapping Refresh: the page is alive, Firestore is dead.
 *
 * A poisoned queue cannot be restarted in place; only a new Firestore instance
 * clears it, which means a full page load. So this listener reloads once, and
 * refuses to do it again in the same session so a reproducible crash degrades
 * into a visible error rather than a reload loop.
 */

const RELOAD_FLAG = 'zeneva_firestore_recovered_at';
const MIN_INTERVAL_MS = 60_000;

function isFirestoreAssertion(value: unknown): boolean {
  const text =
    value instanceof Error ? `${value.name}: ${value.message}` : String(value ?? '');
  return (
    text.includes('INTERNAL ASSERTION FAILED') &&
    text.toUpperCase().includes('FIRESTORE')
  );
}

export function FirestoreRecovery() {
  useEffect(() => {
    const recover = (source: string) => {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
      } catch {
        // sessionStorage unavailable (private mode) - treat as never reloaded.
      }

      const now = Date.now();
      if (last && now - last < MIN_INTERVAL_MS) {
        console.error(
          `Firestore assertion recurred within ${MIN_INTERVAL_MS / 1000}s of a recovery reload (${source}). ` +
            'Not reloading again - this would loop.'
        );
        return;
      }

      try {
        sessionStorage.setItem(RELOAD_FLAG, String(now));
      } catch {
        // Without storage we cannot rate-limit, so do not reload at all rather
        // than risk an endless loop.
        console.error('Firestore assertion detected but sessionStorage is unavailable; skipping reload.');
        return;
      }

      console.warn(
        `Firestore async queue panicked (${source}). Reloading once to rebuild the client.`
      );
      window.location.reload();
    };

    const handleError = (event: ErrorEvent) => {
      if (!isFirestoreAssertion(event.error ?? event.message)) return;
      // Stop it reaching the generic handlers that would surface a crash UI.
      event.preventDefault();
      recover('window.error');
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (!isFirestoreAssertion(event.reason)) return;
      event.preventDefault();
      recover('unhandledrejection');
    };

    // Capture phase so this runs before the app's own logging handlers.
    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleRejection, true);

    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleRejection, true);
    };
  }, []);

  return null;
}
