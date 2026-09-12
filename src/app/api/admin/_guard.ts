import { NextResponse } from 'next/server';
import { requireSuperAdmin as verifySuperAdminToken, type AdminIdentity } from '@/actions/admin-guard';

/**
 * Super-admin gate for admin **route handlers**.
 *
 * The token verification itself lives in `@/actions/admin-guard` and is shared
 * with the Server Actions — the owner UID/email must not be duplicated, or the
 * two paths can drift and one of them silently stops being a check.
 *
 * The difference is only in the failure mode: a Server Action reports an error
 * by throwing, while a route handler has to return a response. So this wrapper
 * catches and converts, and callers branch on `ok` instead of using try/catch:
 *
 * ```ts
 * const auth = await requireSuperAdmin(req);
 * if (!auth.ok) return auth.res;
 * ```
 *
 * Files under `src/app/api/**` are only treated as routes when named
 * `route.ts`, so a leading-underscore helper here is safe and is not routable.
 */

/**
 * Sent on every response, including the failures.
 *
 * The desktop and mobile shells call these endpoints from a `tauri://` origin,
 * which is cross-origin, so the preflight has to be answered or the admin panel
 * cannot reach its own API. `Allow-Credentials` is deliberately absent: these
 * routes authenticate from an explicit `Authorization` header, never an ambient
 * cookie, so a hostile page cannot make an authenticated call on a user's
 * behalf just by being open in the same browser.
 */
export const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

type GuardResult =
    | { ok: true; identity: AdminIdentity }
    | { ok: false; res: NextResponse };

/** Pull a bearer token out of `Authorization`, tolerating case and extra spaces. */
function bearerFrom(req: Request): string | undefined {
    const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!header) return undefined;
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match?.[1]?.trim() || undefined;
}

/**
 * Require that the caller is the platform owner.
 *
 * Returns a discriminated result rather than throwing so the handler stays a
 * straight line. All failures answer 401 with one message: a caller learns that
 * they may not do this, not which check they tripped.
 */
export async function requireSuperAdmin(req: Request): Promise<GuardResult> {
    const token = bearerFrom(req);

    try {
        const identity = await verifySuperAdminToken(token);
        return { ok: true, identity };
    } catch {
        return {
            ok: false,
            res: NextResponse.json(
                { error: 'Not authorized.' },
                { status: 401, headers: corsHeaders },
            ),
        };
    }
}
