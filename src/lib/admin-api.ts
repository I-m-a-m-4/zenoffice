'use client';

/**
 * Client helper for calling the super-admin HTTPS endpoints.
 *
 * The admin panel ships inside the Tauri bundle, which is a static export with no
 * local server — a relative `/api/...` fetch there resolves against
 * `tauri://localhost` and 404s. So native builds must call the hosted deployment
 * by absolute URL while web stays same-origin.
 *
 * `src/middleware.ts` already sets CORS on every `/api/*` route for exactly this
 * reason, and `tauri.conf.json`'s CSP already allows `connect-src https:`.
 */

import { getAuth } from 'firebase/auth';
import { apiBase } from '@/lib/platform';

/** Default timeout. Long enough for a cold serverless start on weak cellular. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Origin to prefix admin API calls with.
 *
 * Kept as a named export for existing callers; the logic now lives in
 * `apiBase()` so the admin panel and the payment flows cannot drift apart.
 */
export function adminApiBase(): string {
  return apiBase();
}

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

type AdminApiOptions = {
  /** JSON body. Omit for a GET. */
  body?: unknown;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  timeoutMs?: number;
};

/**
 * Call an admin endpoint with the caller's Firebase ID token attached.
 *
 * The endpoints verify that token server-side and reject anyone who is not the
 * super-admin, so the token is the whole authorisation story — never skip it.
 */
export async function adminApiFetch<T = any>(
  path: string,
  { body, method, timeoutMs = DEFAULT_TIMEOUT_MS }: AdminApiOptions = {},
): Promise<T> {
  // Fail fast rather than hanging for the full timeout. These endpoints are
  // network-only; the rest of the admin panel reads Firestore and works offline.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new AdminApiError('This action needs an internet connection.', 0);
  }

  const user = getAuth().currentUser;
  if (!user) {
    throw new AdminApiError('You are not signed in. Reload and try again.', 401);
  }
  const token = await user.getIdToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${adminApiBase()}${path}`, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new AdminApiError('The request timed out. Check your connection.', 0);
    }
    throw new AdminApiError(err?.message || 'Could not reach the server.', 0);
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // The guard answers 401 with a deliberately vague "Not authorized." for every
    // failure mode (no token, bad token, wrong account). Pass the server's message
    // through when there is one, and otherwise say something an admin can act on.
    const fallback =
      response.status === 401
        ? 'Not available for this account.'
        : `Request failed (${response.status}).`;
    throw new AdminApiError(payload?.error || payload?.message || fallback, response.status);
  }

  return payload as T;
}
