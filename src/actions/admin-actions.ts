
'use server';

import { adminAuth } from '@/firebase/admin';
import { requireSuperAdmin } from './admin-guard';

/**
 * Delete Firebase Auth accounts for a terminated business.
 *
 * Called by Cyber Shield's entity termination. This is about as destructive as a
 * call gets, and until now it took a bare array of uids with no proof of who was
 * asking — a `'use server'` export is a public endpoint, so that let anyone who
 * read the client bundle delete arbitrary accounts, including the owner's.
 *
 * `idToken` is now required and verified against the platform owner first.
 */
export async function deleteBusinessUsersAuth(uids: string[], idToken?: string) {
    await requireSuperAdmin(idToken);

    if (!adminAuth) {
        throw new Error("Firebase Admin not initialized. Cannot delete auth accounts.");
    }

    if (!Array.isArray(uids)) {
        throw new Error("Expected a list of user ids.");
    }

    const results = {
        success: [] as string[],
        failed: [] as string[]
    };

    for (const uid of uids) {
        if (typeof uid !== 'string' || !uid) {
            results.failed.push(String(uid));
            continue;
        }
        try {
            await adminAuth.deleteUser(uid);
            results.success.push(uid);
        } catch (error: any) {
            console.error(`Failed to delete auth user ${uid}:`, error.message);
            // We don't throw here to allow other deletions to continue
            // If the user doesn't exist in Auth but exists in Firestore, it's fine
            results.failed.push(uid);
        }
    }

    return results;
}

/**
 * Revoke every refresh token for a user, killing all their live sessions.
 *
 * Suspending a user in Firestore stops new writes at the rules layer, but their
 * existing ID token stays valid for up to an hour. This is what makes a hard
 * kill immediate: paired with the `checkRevoked` verification in the chat route
 * and `requireSuperAdmin`, a revoked account loses server access at once.
 */
export async function revokeUserSessions(uid: string, idToken?: string) {
    await requireSuperAdmin(idToken);

    if (!adminAuth) {
        throw new Error("Firebase Admin not initialized.");
    }
    if (typeof uid !== 'string' || !uid) {
        throw new Error("A user id is required.");
    }

    await adminAuth.revokeRefreshTokens(uid);
    return { revoked: true, uid };
}

/**
 * Manually set or repair a business subscription plan from Super Admin.
 */
export async function manuallySetBusinessPlan(params: {
    idToken?: string;
    businessId?: string;
    userEmail?: string;
    plan: 'starter' | 'pro' | 'business' | 'lifetime';
    monthsToAdd?: number;
}) {
    const { idToken, businessId: rawBizId, userEmail, plan, monthsToAdd = 1 } = params;
    await requireSuperAdmin(idToken);

    const { adminFirestore } = await import('@/firebase/admin');

    if (!adminFirestore) {
        throw new Error("Firebase Admin not initialized.");
    }

    let targetBusinessId = rawBizId;

    if (!targetBusinessId && userEmail) {
        const userSnap = await adminFirestore.collection('users').where('email', '==', userEmail).limit(1).get();
        if (!userSnap.empty) {
            targetBusinessId = userSnap.docs[0].data()?.businessId;
        }
    }

    if (!targetBusinessId) {
        throw new Error("Could not locate business for the given ID or Email.");
    }

    const businessRef = adminFirestore.collection('businessInstances').doc(targetBusinessId);
    const businessSnap = await businessRef.get();
    if (!businessSnap.exists) {
        throw new Error("Business record not found.");
    }

    const currentExpiry = businessSnap.data()?.trialExpiresAt?.toDate ? businessSnap.data()?.trialExpiresAt.toDate() : null;
    const startDate = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(startDate);
    newExpiry.setMonth(newExpiry.getMonth() + monthsToAdd);

    await businessRef.update({
        plan: plan,
        trialExpiresAt: plan === 'lifetime' ? new Date('2099-12-31') : newExpiry,
        accessLevel: null,
        updatedAt: new Date()
    });

    return {
        success: true,
        businessId: targetBusinessId,
        plan,
        expiresAt: (plan === 'lifetime' ? new Date('2099-12-31') : newExpiry).toISOString()
    };
}
