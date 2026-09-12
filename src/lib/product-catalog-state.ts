/**
 * Why the product catalogue is unavailable, and the one rule about saying so:
 * **never tell a user they lack a permission the app cannot prove they lack.**
 *
 * This module exists because the POS used to break that rule in the most visible
 * way possible. `fetchFullProducts` mapped any Firestore refusal onto a single
 * user-facing claim — "This account isn't allowed to view the product list. Ask
 * the business owner to grant inventory access." — and then withheld the Retry
 * button on the grounds that only the owner could fix it. Three things were
 * wrong with that, and all three reached paying shops:
 *
 * 1. **The claim is not true of anybody.** `firestore.rules` gates `products`
 *    `list` on tenancy alone (`resource.data.businessId ==
 *    getCurrentUserBusinessId() || resource.data.createdBy == request.auth.uid`)
 *    — there is no `manage_inventory`, no `view_inventory`, no role test in it at
 *    all. So no role can be refused the product list for lacking a permission,
 *    and a refusal never means what the message said. It was shown to *owners*,
 *    who were told to go and ask themselves for access.
 *
 * 2. **A refusal is usually transient, and it was treated as terminal.** The
 *    dominant cause is the signed-in account's `users/{uid}` document not being
 *    readable *on the server* at the moment of the query — a sign-up whose
 *    profile write is still in flight (the client's own snapshot resolves from
 *    latency-compensated local state, so the app happily queries a second before
 *    the server can answer for it), or one whose create was refused by the
 *    `users` create rule. Rules evaluate `getUserData()` for the query whatever
 *    the result set holds, so this lands on brand-new shops — exactly the ones
 *    with no products yet — and once landed it stuck: no retry was scheduled, no
 *    Retry button was offered, and `checkFullSyncStatus` only re-runs when its
 *    dependencies change. A reload was the only way out.
 *
 * 3. **The detection was a substring test on the error text**
 *    (`message.includes('permission')`), which classifies any error that merely
 *    mentions a permission of any kind — an OS notification prompt, a Tauri
 *    capability, a plugin's own wording — as "your account may not list
 *    products". Codes are the thing that carries meaning; the text is not.
 *
 * So the vocabulary here drops `'permission'` entirely. A refusal is `'access'`:
 * the server would not release the catalogue to this device and we could not
 * verify why. That is honest, it is the same sentence for an owner and a
 * cashier, and it is always paired with a Retry — a retry never lies, and in the
 * dominant case it is what fixes it. The *precise* cause is not guessed at in
 * the UI; it is measured once and written to `error_logs` for the platform owner
 * (`describeRefusal` below), which is where a diagnosis the user cannot act on
 * belongs.
 *
 * Pure and clock-free, like `src/lib/forensics.ts` and
 * `src/lib/business-rating.ts` — `npm run test:catalog-state` covers it.
 */

/**
 * Why there is nothing to show, when the reason is not "the shop is empty".
 *
 * - `'network'` — the sync could not reach the server, and its retries are spent.
 * - `'cache'`   — the local mirror could not be read (see `getCachedProductsResult`).
 * - `'access'`  — the server refused to release the catalogue to this device.
 *
 * There is deliberately no `'permission'` member. See the file comment.
 */
export type ProductSyncErrorKind = 'network' | 'cache' | 'access';

export const PRODUCT_SYNC_ERROR_KINDS = ['network', 'cache', 'access'] as const;

/**
 * Firestore codes that mean "the server refused this request outright" rather
 * than "the server could not be reached". `unauthenticated` sits here with
 * `permission-denied` because it has the same shape from the outside: the
 * request arrived and was turned away, and one more attempt after a token
 * refresh is the right response to both.
 */
const REFUSAL_CODES = new Set(['permission-denied', 'unauthenticated']);

/**
 * Last resort for an error that lost its `code` on the way here (wrapped by a
 * transport, re-thrown as a plain `Error`). Matched against Firestore's own
 * wording — "Missing or insufficient permissions." — and against a stringified
 * code, and nothing looser than that.
 *
 * Note what it must *not* match, because the test it replaces did:
 * `"...possibly because the user denied permission"` (a browser
 * `NotAllowedError`) and `"...not allowed. Permissions associated with this
 * command: sql:allow-load"` (a Tauri capability refusal). Neither says anything
 * about this account's claim on this shop's products.
 */
const REFUSAL_MESSAGE = /insufficient permissions|permission[-_]denied|unauthenticated/i;

/** Strips a namespace, so `firestore/permission-denied` reads as the bare code. */
function normaliseCode(raw: unknown): string {
  const parts = String(raw ?? '').toLowerCase().split('/');
  return parts[parts.length - 1] ?? '';
}

/** True when the server answered and turned the request away. */
export function isServerRefusal(error: unknown): boolean {
  if (!error) return false;
  const code = normaliseCode((error as any)?.code);
  if (REFUSAL_CODES.has(code)) return true;
  const message = (error as any)?.message;
  return typeof message === 'string' && REFUSAL_MESSAGE.test(message);
}

/**
 * The kind to record for a failed product sync. Only two are reachable from a
 * fetch — `'cache'` is set by the local-mirror read, not by this path.
 */
export function classifyProductSyncFailure(error: unknown): 'network' | 'access' {
  return isServerRefusal(error) ? 'access' : 'network';
}

/**
 * How hard to try before settling on a reason.
 *
 * A refusal gets a shorter ladder than a dropped connection on purpose. The race
 * it is usually losing — a profile write that has not reached the server yet —
 * resolves in well under a second, so two quick attempts catch it; and if the
 * refusal is real, a cashier should not watch a skeleton for half a minute to
 * find that out. A network failure keeps the longer ladder, because a connection
 * that dropped mid-pagination genuinely can take that long to come back.
 */
export const PRODUCT_SYNC_RETRY_POLICY: Record<'network' | 'access', { maxRetries: number; baseDelayMs: number }> = {
  network: { maxRetries: 3, baseDelayMs: 4000 },
  access: { maxRetries: 2, baseDelayMs: 2500 },
};

/**
 * The i18n key each reason renders. Held here rather than inline in a ternary at
 * two call sites, which is how the POS and the Inventory page came to draw the
 * same state twice and could have drifted apart at any time.
 */
export const CATALOG_UNAVAILABLE_MESSAGE_KEY: Record<ProductSyncErrorKind, string> = {
  network: 'pos.catalogUnavailableNetwork',
  cache: 'pos.catalogUnavailableCache',
  access: 'pos.catalogUnavailableAccess',
};

/**
 * A reason we could not determine reads as a connection problem, because that is
 * the likeliest thing to have happened to a surface that has no recorded reason
 * and nothing cached — being offline is how `isCatalogUnverified` goes true
 * without any error at all.
 */
export function catalogUnavailableMessageKey(kind: ProductSyncErrorKind | null): string {
  return kind ? CATALOG_UNAVAILABLE_MESSAGE_KEY[kind] : CATALOG_UNAVAILABLE_MESSAGE_KEY.network;
}

// --- the platform-owner side of a refusal ----------------------------------

/**
 * What one server-side read of `users/{auth.uid}` established. `reachedServer`
 * false means the probe itself failed, which is information too — it is what a
 * connection that died between the refusal and the probe looks like.
 */
export interface RefusalProbe {
  reachedServer: boolean;
  profileExists: boolean;
  profileBusinessId: string | null;
}

export type RefusalCause =
  /** The signed-in account has no user document on the server. */
  | 'no-server-profile'
  /** It has one, and it names a different tenant than the app is loading. */
  | 'tenant-mismatch'
  /** An admin viewing a tenant they are not privileged to read. */
  | 'impersonation'
  /** The probe could not run, so nothing was established. */
  | 'probe-failed'
  /** Profile present and attached to this shop — so tenancy is not the fault. */
  | 'unattributed';

export interface RefusalContext {
  /** The businessId the products query filtered on. */
  queriedBusinessId: string | null;
  /** `request.auth.uid` — whose document the rules actually read. */
  authUid: string | null;
  isImpersonating: boolean;
  /** Firestore's code for the refusal, when it carried one. */
  code: string | null;
  attempts: number;
}

/**
 * Turns a refusal into a sentence a developer can act on, for `error_logs`.
 *
 * This is the only place the specific cause is ever named. The user does not see
 * it: three of these four causes are not something they can do anything about,
 * and the fourth ("your profile has not landed yet") is indistinguishable to
 * them from "try again". Guessing at it on screen is what produced the message
 * this module exists to delete.
 */
export function describeRefusal(probe: RefusalProbe, ctx: RefusalContext): { cause: RefusalCause; message: string } {
  const suffix = `Refused with ${ctx.code || 'no code'} after ${ctx.attempts} attempt${ctx.attempts === 1 ? '' : 's'}.`;

  if (ctx.isImpersonating) {
    return {
      cause: 'impersonation',
      message:
        `Product list refused while impersonating business ${ctx.queriedBusinessId || 'unknown'}. ` +
        `The signed-in account is not covered by isSuperAdmin() in firestore.rules, so every tenant read is denied. ${suffix}`,
    };
  }

  if (!probe.reachedServer) {
    return {
      cause: 'probe-failed',
      message:
        `Product list refused and the follow-up server read of users/${ctx.authUid || 'unknown'} also failed, ` +
        `so the cause could not be established — most likely the connection died between the two. ${suffix}`,
    };
  }

  if (!probe.profileExists) {
    return {
      cause: 'no-server-profile',
      message:
        `Product list refused because users/${ctx.authUid || 'unknown'} does not exist on the server. ` +
        `The app is running on a latency-compensated local copy of that profile, so every rules ` +
        `getUserData() call fails and no tenant collection can be read. Either the sign-up's profile ` +
        `write never committed, or the users create rule refused it. ${suffix}`,
    };
  }

  if (probe.profileBusinessId !== ctx.queriedBusinessId) {
    return {
      cause: 'tenant-mismatch',
      message:
        `Product list refused because the server copy of users/${ctx.authUid || 'unknown'} is attached to ` +
        `business ${probe.profileBusinessId || 'none'} while the app is loading ${ctx.queriedBusinessId || 'none'}. ${suffix}`,
    };
  }

  return {
    cause: 'unattributed',
    message:
      `Product list refused even though the server copy of users/${ctx.authUid || 'unknown'} is attached to ` +
      `${ctx.queriedBusinessId || 'none'}, the business being loaded — so this is not a tenancy mismatch. ` +
      `Check that firestore.rules is deployed and that the products list rule still matches the query ` +
      `(businessId == , orderBy name). ${suffix}`,
  };
}
