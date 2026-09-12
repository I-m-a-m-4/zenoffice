'use client';

/**
 * Retry wrapper for one-shot Firestore reads (`getDoc` / `getDocs`).
 *
 * `getDoc` does not wait for a connection. If the snapshot comes back from
 * cache and the document is not in it, the SDK rejects immediately with
 *
 *   FirebaseError: Failed to get document because the client is offline.
 *
 * At a cold start that is a race rather than a real outage - the machine is
 * online, the Listen stream simply has not finished its handshake yet. Because
 * most of our loaders fire once from an effect and never run again, a single
 * unlucky read used to leave a screen empty for the rest of the session.
 * A couple of backed-off retries close that window.
 *
 * Real failures (permission-denied, unauthenticated, not-found, bad queries)
 * are rethrown on the first attempt - retrying those only delays the error.
 */

/** gRPC status codes worth a second attempt. */
const RETRYABLE_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'resource-exhausted',
  'internal',
  'unknown',
]);

const RETRYABLE_MESSAGES =
  /client is offline|backend didn'?t respond|transport errored|network error|failed to get document because/i;

/**
 * True when the failure looks like "we could not reach Firestore", as opposed
 * to "Firestore answered and said no".
 */
export function isOfflineError(err: unknown): boolean {
  if (!err) return false;

  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && RETRYABLE_CODES.has(code.replace(/^firestore\//, ''))) {
    return true;
  }

  const message = String((err as { message?: unknown })?.message ?? err);
  return RETRYABLE_MESSAGES.test(message);
}

export interface FirestoreRetryOptions {
  /** Total tries, including the first. Default 4 (~4.2s of waiting). */
  attempts?: number;
  /** Delay before the 2nd try; doubles each time. Default 600ms. */
  baseDelayMs?: number;
  /** Shown in the retry warning so a noisy loader can be identified. */
  label?: string;
}

export async function withFirestoreRetry<T>(
  operation: () => Promise<T>,
  options: FirestoreRetryOptions = {},
): Promise<T> {
  const { attempts = 4, baseDelayMs = 600, label = 'Firestore read' } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !isOfflineError(err)) throw err;

      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `${label}: Firestore not connected yet (attempt ${attempt}/${attempts}), retrying in ${delay}ms.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Error callback for `onSnapshot`.
 *
 * A listener started without one logs "Uncaught Error in snapshot listener" and,
 * for a permanent failure like a missing composite index, the SDK re-subscribes
 * on a ~5s backoff *forever* - a console full of identical stack traces and a
 * steady trickle of billed reads that never succeed.
 *
 * Terminal errors cannot be fixed by trying again, so detach on the first one.
 * Transient errors are left to the SDK, which retries them correctly.
 *
 * Usage:
 *   const unsubscribe = onSnapshot(q, onNext, terminalListenerErrorHandler(
 *     'support threads', () => unsubscribe(),
 *   ));
 */
const TERMINAL_LISTEN_CODES = new Set([
  'failed-precondition', // almost always a missing composite index
  'permission-denied',
  'unauthenticated',
  'invalid-argument',
  'not-found',
  'unimplemented',
]);

export function terminalListenerErrorHandler(
  label: string,
  detach: () => void,
): (err: unknown) => void {
  return (err: unknown) => {
    const code = String((err as { code?: unknown })?.code ?? '');
    const message = String((err as { message?: unknown })?.message ?? err);

    if (!TERMINAL_LISTEN_CODES.has(code)) {
      // Transient - the SDK's own backoff will recover this one.
      console.warn(`${label}: snapshot listener error (will retry).`, err);
      return;
    }

    console.error(
      `${label}: snapshot listener stopped - ${code || 'terminal error'}. ` +
        'Retrying cannot fix this, so the listener has been detached.\n' +
        message,
    );
    try {
      detach();
    } catch {
      // Already torn down.
    }
  };
}
