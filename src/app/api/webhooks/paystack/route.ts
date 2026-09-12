import { NextResponse } from 'next/server';
import { adminFirestore } from '@/firebase/admin';
import crypto from 'crypto';
import { notifyAdminsOfSubscription } from '@/lib/server/notifications';

// Webhooks must never be statically rendered — this handler verifies an HMAC over
// the raw request body and writes to Firestore.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxx')) {
      console.error('Paystack Secret Key is not configured.');
      return new NextResponse('Webhook configuration error', { status: 500 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    if (!signature) {
      console.error('Missing x-paystack-signature header.');
      return new NextResponse('Missing signature', { status: 400 });
    }

    // Secure Signature Verification (HMAC SHA512)
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    // Constant-time compare, matching the Dodo handler. A plain `!==` returns as
    // soon as it hits a differing byte, which leaks the correct prefix to an
    // attacker who can time enough requests. timingSafeEqual throws on a length
    // mismatch, so the length is checked first.
    const hashBuffer = Buffer.from(hash, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (
      hashBuffer.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(hashBuffer, signatureBuffer)
    ) {
      console.error('Signature verification failed. Potential spoofing attempt.');
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data;

    console.log(`Paystack Webhook Received & Verified: ${event}`);

    if (event === 'charge.success') {
      const subaccountCode = data.subaccount?.subaccount_code;
      const amountInNaira = data.amount / 100;
      const reference = data.reference || '';
      const customerEmail = data.customer?.email || '';

      // Check if this is a Zeneva platform subscription payment
      const metadata = data.metadata || {};
      const customFields = Array.isArray(metadata.custom_fields) ? metadata.custom_fields : [];
      const businessIdFromMeta = metadata.business_id || customFields.find((f: any) => f.variable_name === 'business_id')?.value;
      const planFromMeta = metadata.plan || customFields.find((f: any) => f.variable_name === 'plan')?.value;
      const isSubscriptionPayment = reference.startsWith('z-') || !!businessIdFromMeta || !!planFromMeta || (!subaccountCode && amountInNaira >= 5000);

      if (isSubscriptionPayment) {
        console.log(`[paystack-webhook] Processing platform subscription payment for ref: ${reference}`);
        
        let targetBusinessId = businessIdFromMeta || '';
        let targetPlan = (planFromMeta || '').toLowerCase();

        // If businessId not in metadata, extract from reference z-{bizPrefix}-{timestamp}
        if (!targetBusinessId && reference.startsWith('z-')) {
          const parts = reference.split('-');
          if (parts.length >= 2) {
            const bizPrefix = parts[1];
            const bizSnap = await adminFirestore.collection('businessInstances').get();
            const match = bizSnap.docs.find(d => d.id.substring(0, 6) === bizPrefix || d.id.startsWith(bizPrefix));
            if (match) targetBusinessId = match.id;
          }
        }

        // If businessId still not found, check by customer email
        if (!targetBusinessId && customerEmail) {
          const userSnap = await adminFirestore.collection('users').where('email', '==', customerEmail).limit(1).get();
          if (!userSnap.empty) {
            targetBusinessId = userSnap.docs[0].data()?.businessId || '';
          }
        }

        // If targetPlan not provided, deduce plan from amount paid
        if (!targetPlan) {
          if (amountInNaira >= 25000) {
            targetPlan = 'business';
          } else {
            targetPlan = 'pro';
          }
        }

        if (targetBusinessId) {
          // Check if already processed
          const existingPurchase = await adminFirestore.collection('purchases').where('reference', '==', reference).limit(1).get();
          if (existingPurchase.empty) {
            const businessRef = adminFirestore.collection('businessInstances').doc(targetBusinessId);
            const businessSnap = await businessRef.get();
            if (businessSnap.exists) {
              const currentExpiry = businessSnap.data()?.trialExpiresAt?.toDate ? businessSnap.data()?.trialExpiresAt.toDate() : null;
              const startDate = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
              
              let months = 1;
              if (amountInNaira >= 80000) months = 12;
              else if (amountInNaira >= 45000) months = 6;
              else if (amountInNaira >= 24000 && targetPlan === 'pro') months = 3;
              else if (amountInNaira >= 70000 && targetPlan === 'business') months = 3;

              const expiresAt = new Date(startDate);
              expiresAt.setMonth(expiresAt.getMonth() + months);

              const batch = adminFirestore.batch();
              batch.update(businessRef, {
                plan: targetPlan,
                trialExpiresAt: expiresAt,
                accessLevel: null,
                updatedAt: new Date()
              });
              batch.set(adminFirestore.collection('purchases').doc(), {
                businessId: targetBusinessId,
                plan: targetPlan,
                amount: amountInNaira,
                currency: data.currency || 'NGN',
                reference,
                timestamp: new Date(),
                verifiedServerSide: true,
                source: 'paystack-webhook'
              });
              batch.set(businessRef.collection('subscription_history').doc(), {
                action: `Subscribed to ${targetPlan} plan via Paystack Webhook`,
                amount: amountInNaira,
                currency: data.currency || 'NGN',
                timestamp: new Date()
              });
              await batch.commit();
              console.log(`[paystack-webhook] Successfully upgraded business ${targetBusinessId} to ${targetPlan} plan until ${expiresAt.toISOString()}`);
              
              notifyAdminsOfSubscription({
                businessName: businessSnap.data()?.name || 'A Zeneva Store',
                planId: targetPlan,
                amount: amountInNaira,
                currency: data.currency || 'NGN'
              }).catch(err => {
                console.error('[paystack-webhook] Failed to send admin subscription notification:', err);
              });
            }
          }
        }
        return new NextResponse('Subscription webhook processed', { status: 200 });
      }

      // 1. Locate Business Instance by Subaccount Code (For Storefront / POS Checkout)
      let businessDoc: any = null;
      let businessId = '';

      if (subaccountCode) {
        const businessQuery = await adminFirestore
          .collection('businessInstances')
          .where('settings.paystackSubaccountCode', '==', subaccountCode)
          .limit(1)
          .get();

        if (!businessQuery.empty) {
          businessDoc = businessQuery.docs[0];
          businessId = businessDoc.id;
        }
      }

      // Fallback matching using store customer email if subaccount query failed
      if (!businessId && customerEmail.startsWith('terminal-')) {
        const extractedPrefix = customerEmail.replace('terminal-', '').split('@')[0];
        // Query businesses starting with that ID prefix
        const businessQuery = await adminFirestore
          .collection('businessInstances')
          .get();

        const matchingDoc = businessQuery.docs.find(doc => doc.id.substring(0, 8) === extractedPrefix);
        if (matchingDoc) {
          businessDoc = matchingDoc;
          businessId = matchingDoc.id;
        }
      }

      if (!businessId) {
        console.error(`Could not locate business for subaccount ${subaccountCode} or email ${customerEmail}`);
        return new NextResponse('Business not found', { status: 404 });
      }

      const businessData = businessDoc.data();
      const businessName = businessData.name || 'Your Store';

      console.log(`Processing payout for business: ${businessName} (${businessId})`);

      // 2. Locate Active Cashier / Employees for this Business
      const employeesSnapshot = await adminFirestore
        .collection('users')
        .where('businessId', '==', businessId)
        .where('role', 'in', ['owner', 'admin', 'manager', 'operator', 'cashier'])
        .get();

      // 3. Dispatch Live Notifications to Employee Feeds
      if (!employeesSnapshot.empty) {
        const notificationPromises = employeesSnapshot.docs.map((doc: any) => {
          return adminFirestore
            .collection('users')
            .doc(doc.id)
            .collection('notifications')
            .add({
              title: 'Payment Received ₦' + amountInNaira.toLocaleString(),
              body: `₦${amountInNaira.toLocaleString()} successfully received via Bank Transfer.`,
              createdAt: new Date(),
              read: false,
              type: 'payment',
              amount: amountInNaira,
              reference: reference,
              bankName: data.authorization?.bank || 'Wema Bank',
              accountNumber: data.authorization?.account_number || 'N/A'
            });
        });
        await Promise.all(notificationPromises);
      }

      // 4. POS Automated Checkout Reconciliation
      // Find a pending receipt for this business with same payment total to auto-mark as paid
      const receiptsQuery = await adminFirestore
        .collection('receipts')
        .where('businessId', '==', businessId)
        .where('paymentMethod', '==', 'Bank Transfer')
        .where('status', '==', 'pending')
        .where('total', '==', amountInNaira)
        .limit(1)
        .get();

      if (!receiptsQuery.empty) {
        const receiptDoc = receiptsQuery.docs[0];
        await adminFirestore.collection('receipts').doc(receiptDoc.id).update({
          status: 'paid',
          updatedAt: new Date(),
          paymentReference: reference
        });
        console.log(`Successfully reconciled receipt #${receiptDoc.data().receiptNumber} to Paid`);
      }
    }

    return new NextResponse('Webhook processed successfully', { status: 200 });

  } catch (error: any) {
    console.error('Webhook processing failure:', error);
    return new NextResponse(`Internal webhook error: ${error.message}`, { status: 500 });
  }
}
