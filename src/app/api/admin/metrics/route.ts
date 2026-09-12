import { NextResponse } from 'next/server';
import { adminFirestore } from '@/firebase/admin';
import { requireSuperAdmin, corsHeaders } from '../_guard';

// Real-time by design: the admin dashboard must never show a cached snapshot of
// platform state. This file previously carried a build-injected
// `dynamic = 'force-static'`, which would have frozen every figure below at
// build time.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/admin/metrics
 *
 * Every user, business, product, receipt, purchase and checkout attempt on the
 * platform. Super-admin only — this used to answer an anonymous GET.
 */
export async function GET(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    try {
        const db = adminFirestore;

        // Fetch all collections in parallel directly from Firestore (real-time)
        const [
            usersSnap,
            businessesSnap,
            productsSnap,
            receiptsSnap,
            purchasesSnap,
            downloadClicksSnap,
            applicationsSnap,
            grantsSnap,
            checkoutAttemptsSnap,
            branchesSnap
        ] = await Promise.all([
            db.collection('users').orderBy('name').get(),
            db.collection('businessInstances').get(),
            db.collection('products').get(),
            db.collection('receipts').get(),
            db.collection('purchases').get(),
            db.collection('download_clicks').get(),
            db.collection('job_applications').get(),
            db.collection('grants').get(),
            db.collection('checkout_attempts').orderBy('timestamp', 'desc').get(),
            db.collectionGroup('branches').get()
        ]);

        const users = usersSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const businesses = businessesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const products = productsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const applications = applicationsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const grants = grantsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const receipts = receiptsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const purchases = purchasesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const downloadClicks = downloadClicksSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const checkoutAttempts = checkoutAttemptsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const branches = branchesSnap.docs.map((doc: any) => ({ id: doc.id, businessId: doc.ref.parent.parent?.id, ...doc.data() }));

        const payload = {
            users,
            businesses,
            products,
            applications,
            grants,
            receipts,
            purchases,
            downloadClicks,
            checkoutAttempts,
            branches
        };

        return NextResponse.json(payload, { headers: corsHeaders });

    } catch (error) {
        console.error('Error fetching admin data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch admin data' },
            { status: 500, headers: corsHeaders },
        );
    }
}
