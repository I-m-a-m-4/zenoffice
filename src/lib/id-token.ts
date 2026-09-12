'use client';

import { getAuth } from 'firebase/auth';

/**
 * Current user's Firebase ID token, for passing to a guarded Server Action.
 *
 * Server Actions are public endpoints — their action id ships in the client
 * bundle — so every destructive one in `src/actions/` verifies an ID token
 * server-side via `requireSuperAdmin` / `requireUser`. This is the client half
 * of that contract.
 *
 * Not cached: Firebase rotates the token roughly hourly and `getIdToken()`
 * already returns the cached one until it is close to expiry.
 */
export async function idToken(): Promise<string | undefined> {
  return getAuth().currentUser?.getIdToken();
}
