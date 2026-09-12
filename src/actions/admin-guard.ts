'use server';

import { adminAuth } from '@/firebase/admin';

/**
 * Server-side super-admin check for Server Actions.
 *
 * A `'use server'` export is a public HTTP endpoint. Next.js gives it an
 * obfuscated action id, but that id ships in the client bundle, so "nobody
 * knows the URL" is not access control — anyone who opens the JS can replay the
 * POST with any arguments they like. Every destructive action must therefore
 * prove who the caller is on the server, from a token, before it does anything.
 *
 * The client passes `await getAuth().currentUser.getIdToken()`. We verify the
 * signature with the Admin SDK (which is what makes it unforgeable) and then
 * match it against the platform owner.
 */

const SUPER_ADMIN_UID = 'jzQgCHzaObeUbeYklTLtQQh03G53';
const SUPER_ADMIN_EMAIL = 'belloimam431@gmail.com';

export type AdminIdentity = { uid: string; email: string | undefined };

/**
 * Verify an ID token belongs to the platform owner.
 *
 * Throws on any failure. Callers should let it propagate: a Server Action that
 * throws returns an error to the client without running its body.
 */
export async function requireSuperAdmin(idToken: string | undefined): Promise<AdminIdentity> {
  if (!adminAuth) {
    throw new Error('Server not configured for administrative actions.');
  }
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Not authorized.');
  }

  let decoded;
  try {
    // checkRevoked: true so a revoked session cannot keep issuing admin calls
    // for the remainder of the token's hour-long life.
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch {
    throw new Error('Not authorized.');
  }

  const isOwner = decoded.uid === SUPER_ADMIN_UID || decoded.email === SUPER_ADMIN_EMAIL;
  if (!isOwner) {
    // Deliberately identical message to the failures above — a caller learns
    // only that they may not do this, not which check they tripped.
    throw new Error('Not authorized.');
  }

  return { uid: decoded.uid, email: decoded.email };
}

/**
 * Verify an ID token belongs to *some* signed-in user, and return their uid.
 * For actions that are per-user rather than platform-wide.
 */
export async function requireUser(idToken: string | undefined): Promise<string> {
  if (!adminAuth) {
    throw new Error('Server not configured.');
  }
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Not authorized.');
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    return decoded.uid;
  } catch {
    throw new Error('Not authorized.');
  }
}
