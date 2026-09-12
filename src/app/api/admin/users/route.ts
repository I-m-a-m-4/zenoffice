import { NextResponse } from 'next/server';
import { adminFirestore } from '@/firebase/admin';
import { requireSuperAdmin, corsHeaders } from '../_guard';

// Uncached on purpose — see the note on the handler. The build-injected
// `dynamic = 'force-static'` this file used to carry would have defeated that.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/admin/users
 *
 * Returns the users collection fresh from Firestore (no Redis cache), so the
 * admin User Management page always shows accurate real-time `lastSeen`
 * presence data.
 *
 * Super-admin only: this is every account on the platform, with emails.
 */
export async function GET(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    try {
        const snapshot = await adminFirestore
            .collection('users')
            .orderBy('name')
            .get();

        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // No-cache headers so the browser also doesn't cache this
        return NextResponse.json(users, {
            headers: {
                ...corsHeaders,
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500, headers: corsHeaders },
        );
    }
}
