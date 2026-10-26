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

        // Fetch collections directly with resilience
        const [
            usersRes,
            businessesRes,
            productsRes,
            receiptsRes,
            purchasesRes,
            downloadClicksRes,
            applicationsRes,
            grantsRes,
            checkoutAttemptsRes,
            branchesRes,
            appLaunchesRes
        ] = await Promise.allSettled([
            db.collection('users').get(),
            db.collection('businessInstances').get(),
            db.collection('products').get(),
            db.collection('receipts').get(),
            db.collection('purchases').get(),
            db.collection('download_clicks').get(),
            db.collection('job_applications').get(),
            db.collection('grants').get(),
            db.collection('checkout_attempts').orderBy('timestamp', 'desc').limit(250).get(),
            db.collectionGroup('branches').get(),
            db.collection('app_launches').orderBy('lastSeenAt', 'desc').limit(1000).get()
        ]);

        const users = usersRes.status === 'fulfilled' ? usersRes.value.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) : [];
        const businesses = businessesRes.status === 'fulfilled' ? businessesRes.value.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) : [];
        const products = productsRes.status === 'fulfilled' ? productsRes.value.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) : [];
        const receipts = receiptsRes.status === 'fulfilled' ? receiptsRes.value.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) : [];
        const purchases = purchasesRes.status === 'fulfilled' ? purchasesRes.value.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) : [];
        const downloadClicks = downloadClicksRes.status === 'fulfilled' ? downloadClicksRes.value.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) : [];
        const applications = applicationsRes.status === 'fulfilled' ? applicationsRes.value.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) : [];
        const grants = grantsRes.status === 'fulfilled' ? grantsRes.value.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) : [];
        const checkoutAttempts = checkoutAttemptsRes.status === 'fulfilled' ? checkoutAttemptsRes.value.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) : [];
        const branches = branchesRes.status === 'fulfilled' ? branchesRes.value.docs.map((doc: any) => ({ id: doc.id, businessId: doc.ref.parent.parent?.id, ...doc.data() })) : [];
        const appLaunches = appLaunchesRes.status === 'fulfilled' ? appLaunchesRes.value.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) : [];

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
            branches,
            appLaunches,
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
