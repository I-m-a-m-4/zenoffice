'use server';

import { adminFirestore } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireUser } from './admin-guard';

/**
 * Server-authoritative subscription upgrade.
 *
 * The client used to do all of this itself: call Paystack's verify endpoint,
 * compare the amount against a price it also chose, then write `plan`,
 * `accessLevel` and `trialExpiresAt` straight into Firestore. Every one of those
 * steps ran on a machine the customer controls, so the whole ladder could be
 * skipped with one console command — and a repackaged app could simply pay the
 * Pro price and write `plan: 'business'`.
 *
 * Now `firestore.rules` refuses client writes to those fields, and this action
 * is the only path that sets them. It re-verifies the reference against Paystack
 * with the secret key, and prices the plan **here** from constants the client
 * cannot influence.
 */

/** Server-side price table. The client's numbers are display only. */
const PRICES: Record<string, { ngn: number; usd: number }> = {
  pro: { ngn: 10000, usd: 10 },
  business: { ngn: 30000, usd: 30 },
};

/** Cycle length and discount, mirroring `billingCycles` in the UI. */
const CYCLES: Record<string, { months: number; discount: number }> = {
  '1m': { months: 1, discount: 0 },
  '3m': { months: 3, discount: 5 },
  '6m': { months: 6, discount: 10 },
  '12m': { months: 12, discount: 15 },
};

export type UpgradeResult = { ok: true; plan: string; expiresAt: string } | { ok: false; error: string };

export async function activateSubscription(params: {
  idToken?: string;
  reference: string;
  planId: string;
  cycleId: string;
  currency: 'NGN' | 'USD';
}): Promise<UpgradeResult> {
  const { idToken, reference, planId, cycleId, currency } = params;

  let uid: string;
  try {
    uid = await requireUser(idToken);
  } catch (err: any) {
    return { ok: false, error: err.message };
  }

  if (!adminFirestore) return { ok: false, error: 'Server not configured.' };
  if (typeof reference !== 'string' || !reference) return { ok: false, error: 'Missing payment reference.' };

  const price = PRICES[planId];
  const cycle = CYCLES[cycleId];
  if (!price || !cycle) return { ok: false, error: 'Unknown plan or billing cycle.' };
  if (currency !== 'NGN' && currency !== 'USD') return { ok: false, error: 'Unsupported currency.' };

  // The caller's business comes from their own user document, never the request.
  const userSnap = await adminFirestore.collection('users').doc(uid).get();
  const businessId = userSnap.data()?.businessId;
  if (!businessId) return { ok: false, error: 'No business linked to this account.' };

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || secret.includes('xxx')) {
    return { ok: false, error: 'Payment verification is not configured on the server.' };
  }

  // A reference may be redeemed once. Checking before verifying keeps a replayed
  // reference from extending a subscription repeatedly.
  const existing = await adminFirestore
    .collection('purchases')
    .where('reference', '==', reference)
    .limit(1)
    .get();
  if (!existing.empty) {
    return { ok: false, error: 'This payment has already been applied.' };
  }

  let payload: any;
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    payload = await res.json();
    if (!res.ok || !payload?.status || payload?.data?.status !== 'success') {
      return { ok: false, error: payload?.data?.gateway_response || 'Payment could not be verified.' };
    }
  } catch {
    return { ok: false, error: 'Could not reach the payment provider.' };
  }

  // Price the plan server-side and compare against what Paystack says was paid.
  const base = (currency === 'USD' ? price.usd : price.ngn) * cycle.months;
  const expected = Math.round(base * (1 - cycle.discount / 100) * 100); // kobo/cents

  if (payload.data.currency !== currency) {
    return { ok: false, error: 'Transaction currency does not match the selected plan.' };
  }
  // Tolerate a 1-unit rounding difference, nothing more.
  if (Math.abs(payload.data.amount - expected) > 100) {
    return { ok: false, error: 'Paid amount does not match the plan price. Contact support.' };
  }

  const businessRef = adminFirestore.collection('businessInstances').doc(businessId);
  const businessSnap = await businessRef.get();
  if (!businessSnap.exists) return { ok: false, error: 'Business not found.' };

  // Renewals extend from the existing expiry; new purchases start now.
  const current = businessSnap.data()?.trialExpiresAt;
  const currentDate = current?.toDate ? current.toDate() : null;
  const start = currentDate && currentDate > new Date() ? currentDate : new Date();
  const expiresAt = new Date(start);
  expiresAt.setMonth(expiresAt.getMonth() + cycle.months);

  const batch = adminFirestore.batch();
  batch.update(businessRef, {
    plan: planId,
    trialExpiresAt: expiresAt,
    accessLevel: null,
  });
  batch.set(adminFirestore.collection('purchases').doc(), {
    userId: uid,
    businessId,
    plan: planId,
    amount: payload.data.amount / 100,
    currency,
    reference,
    timestamp: FieldValue.serverTimestamp(),
    verifiedServerSide: true,
  });
  batch.set(businessRef.collection('subscription_history').doc(), {
    action: `Subscribed to ${planId} plan for ${cycle.months} month(s)`,
    amount: payload.data.amount / 100,
    currency,
    timestamp: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return { ok: true, plan: planId, expiresAt: expiresAt.toISOString() };
}
