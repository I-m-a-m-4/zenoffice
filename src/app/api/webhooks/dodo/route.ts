import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminFirestore } from '@/firebase/admin';
import { notifyAdminsOfSubscription } from '@/lib/server/notifications';

/**
 * POST /api/webhooks/dodo — Dodo Payments Standard Webhooks receiver.
 *
 * This is the only thing that grants anything after a USD payment: the client
 * never writes `plan`/`trialExpiresAt` (they are rule-locked to the platform
 * owner), so if this endpoint is not reachable the customer is charged and gets
 * nothing.
 *
 * It sat as `route.ts.bak` alongside the checkout route, which meant Next.js
 * never registered it and Dodo's deliveries hit the HTML 404 page. Restoring
 * checkout without restoring this would take money and grant nothing.
 *
 * The build-injected `dynamic = 'force-static'` it used to carry is invalid on
 * a POST handler and must not come back.
 *
 * ## One kind of purchase now, not two
 *
 * There used to be a second branch here granting one-off Zen AI credit packs,
 * told apart by `metadata.kind === 'credits'`. Credits are an allowance of the
 * plan and are no longer sold, so nothing creates such a session any more and the
 * branch is gone. `metadata.kind` is still read as documentation of intent, and a
 * delivery that names anything other than a subscription is refused rather than
 * quietly treated as one — a payment this endpoint does not understand must not
 * be turned into a plan upgrade.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// This is the secret you get from the Dodo Dashboard -> Developers -> Webhooks
const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headers = req.headers;

    const webhookId = headers.get('webhook-id');
    const webhookSignature = headers.get('webhook-signature');
    const webhookTimestamp = headers.get('webhook-timestamp');

    if (!webhookId || !webhookSignature || !webhookTimestamp) {
      return new NextResponse('Missing required webhook headers', { status: 400 });
    }

    if (!DODO_WEBHOOK_SECRET) {
      console.error('DODO_WEBHOOK_SECRET is not configured in .env.local');
      // We return 200 during initial setup so Dodo can verify the URL, 
      // but you MUST add the secret for actual security.
      return NextResponse.json({ received: true, warning: 'No secret configured' });
    }

    // Standard Webhooks Verification logic
    // The signature is an HMAC SHA256 of: webhook-id + '.' + webhook-timestamp + '.' + body
    const signedContent = `${webhookId}.${webhookTimestamp}.${body}`;
    
    // 1. Replay Attack Protection: Check if timestamp is within 5 minutes (300 seconds)
    const toleranceSeconds = 300; // 5 minutes
    const timestampSeconds = parseInt(webhookTimestamp, 10);
    const currentSeconds = Math.floor(Date.now() / 1000);
    
    if (Math.abs(currentSeconds - timestampSeconds) > toleranceSeconds) {
        console.error('Webhook rejected: Timestamp drift exceeds tolerance window.');
        return new NextResponse('Request expired', { status: 401 });
    }

    // 2. Cryptographic Validation
    // Webhook secrets from Standard Webhooks need to be decoded from base64.
    const secret = DODO_WEBHOOK_SECRET.replace('whsec_', '');
    const secretBuffer = Buffer.from(secret, 'base64');
    
    const hmac = crypto.createHmac('sha256', secretBuffer);
    hmac.update(signedContent);
    const expectedSignature = hmac.digest('base64');

    /*
     * Standard Webhooks sends one or more signatures separated by a space:
     * "v1,SIGNATURE1 v1,SIGNATURE2" (both are present during a secret
     * rotation), so any one of them matching is a pass.
     *
     * Compared with `timingSafeEqual` rather than `===`. String equality
     * returns as soon as two bytes differ, so the time it takes to reject a
     * forgery reveals how much of the prefix was right — enough to recover a
     * valid signature byte by byte, which on this endpoint would let a
     * stranger grant themselves any plan.
     */
    const expectedBuffer = Buffer.from(expectedSignature);
    const isValid = webhookSignature.split(' ').some(sig => {
      const [version, signature] = sig.split(',');
      if (version !== 'v1' || !signature) return false;
      const candidate = Buffer.from(signature);
      // Lengths must match before comparing; timingSafeEqual throws otherwise.
      if (candidate.length !== expectedBuffer.length) return false;
      return crypto.timingSafeEqual(candidate, expectedBuffer);
    });

    if (!isValid) {
      console.error('Invalid Dodo Webhook signature');
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);
    console.log('[dodo-webhook] Verified:', event.type);

    // --- Handle different event types ---
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.active':
      case 'subscription.updated':
        console.log(`Processing ${event.type} for business:`, event.data?.business_id);
        // TODO: Update business subscription status in Firestore
        // const { business_id, status, plan_id } = event.data;
        break;
        
      case 'payment.succeeded': {
        const pData = event.data;
        console.log('Processing Payment Success:', pData?.payment_id, 'Amount:', pData?.total_amount);
        
        const metadata = pData?.metadata || {};
        const { businessId, planId, cycleMonths } = metadata;

        if (!adminFirestore) {
          console.error('Firestore admin failed to initialize, cannot process payment event.');
          break;
        }

        /*
         * A credit-pack delivery is refused, not reinterpreted.
         *
         * The branch that granted these is gone with the product. No session in
         * Dodo can produce one — the pack products were never configured there —
         * but if something does arrive, the only safe answer is to grant nothing
         * and say so in the log. Falling through would reach the plan gate below,
         * which would either skip it silently (a pack carries no `planId`) or, far
         * worse, upgrade the shop's plan off the back of a $2.50 payment.
         */
        if (metadata.kind === 'credits' || metadata.packId) {
          console.error(
            '[dodo-webhook] Refusing a credit-pack payment: credit packs are no longer sold. ' +
              `businessId=${businessId ?? 'none'} payment=${pData?.payment_id ?? 'none'}. ` +
              'Grant the credits manually on /admin-imamshaffy/ai-usage if this charge was real.',
          );
          break;
        }

        if (businessId && planId) {
          try {
            /*
             * Idempotency. The expiry math below is additive — it extends from
             * the current expiry — so applying one `payment.succeeded` twice
             * grants twice the months. Nothing here deduped, and this is not a
             * hypothetical: the catch below rethrows to force Dodo's
             * retry-on-500, so a Firestore blip *after* a partial commit made
             * the platform re-grant on the retry. A replayed capture inside the
             * 300s tolerance window did the same deliberately.
             *
             * Two layers, because the cheap check alone races:
             *   1. Read the marker first and return 200 early — this is what
             *      makes a retry cheap and stops the retry loop.
             *   2. `batch.create()` the same marker inside the grant batch.
             *      create() fails if the document already exists, and it is in
             *      the same atomic commit as the plan update, so two concurrent
             *      deliveries cannot both grant. The loser throws, returns 500,
             *      and converges on the early return when Dodo retries.
             */
            const processedRef = adminFirestore.collection('processed_webhooks').doc(webhookId);
            const alreadyProcessed = await processedRef.get();
            if (alreadyProcessed.exists) {
              console.log(`[dodo-webhook] Duplicate delivery ignored: ${webhookId}`);
              return NextResponse.json({ success: true, duplicate: true });
            }

            const businessRef = adminFirestore.collection('businessInstances').doc(businessId);
            const businessDoc = await businessRef.get();

            if (businessDoc.exists) {
              const bData = businessDoc.data() || {};
              
              // Calculate proper expiration math identical to Paystack client integration
              let currentExpiry = new Date();
              if (bData.trialExpiresAt) {
                  const ts = bData.trialExpiresAt;
                  currentExpiry = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
              }
              
              const startDate = currentExpiry > new Date() ? currentExpiry : new Date();
              const monthsToAdd = parseInt(cycleMonths) || 1;
              
              const newExpiryDate = new Date(startDate);
              newExpiryDate.setMonth(newExpiryDate.getMonth() + monthsToAdd);

              // Extract currency & amount robustly from Dodo payload and metadata
              let currency = (metadata.currency || pData.currency || pData.settlement_currency || 'NGN').toUpperCase();
              let rawAmount = pData.total_amount ?? pData.amount ?? pData.settlement_amount ?? pData.price ?? 0;
              let calculatedAmount = rawAmount > 1000 ? rawAmount / 100 : rawAmount;

              // Fallback pricing if amount is missing or zero
              if (calculatedAmount <= 0) {
                if (currency === 'USD') {
                  calculatedAmount = planId === 'business' ? 30 * monthsToAdd : 10 * monthsToAdd;
                } else {
                  currency = 'NGN';
                  calculatedAmount = planId === 'business' ? 30000 * monthsToAdd : 10000 * monthsToAdd;
                }
              }

              const batch = adminFirestore.batch();
              
              // 1. Upgrade the business instance
              batch.update(businessRef, {
                  plan: planId,
                  trialExpiresAt: newExpiryDate,
                  accessLevel: null, // Revoke override access levels if explicitly paying
                  updatedAt: new Date()
              });
              
              // 2. Record core purchase audit record
              const purchasesRef = adminFirestore.collection('purchases').doc();
              batch.set(purchasesRef, {
                  businessId: businessId,
                  plan: planId,
                  amount: calculatedAmount,
                  currency: currency,
                  timestamp: new Date(),
                  reference: pData.payment_id || 'dodo_' + Date.now(),
                  gateway: 'dodopayments'
              });

              // 3. Log sub-history entry within the business
              const historyRef = businessRef.collection('subscription_history').doc();
              batch.set(historyRef, {
                  action: `Subscribed via Dodo for ${monthsToAdd} month(s)`,
                  amount: calculatedAmount,
                  currency: currency,
                  timestamp: new Date(),
                  dodo_payment_id: pData.payment_id || null
              });

              // 4. Idempotency marker, committed atomically with the grant.
              batch.create(processedRef, {
                  type: event.type,
                  businessId: businessId,
                  planId: planId,
                  paymentId: pData.payment_id || null,
                  processedAt: new Date()
              });

              await batch.commit();
              console.log(`[dodo-webhook] Applied plan update to business: ${businessId} (${planId}, ${currency} ${calculatedAmount})`);
              
              // Notify platform admins/owners about the new subscription
              notifyAdminsOfSubscription({
                businessName: bData.name || 'Another Business',
                planId: planId,
                amount: calculatedAmount,
                currency: currency
              }).catch(err => {
                console.error('[dodo-webhook] Failed to send admin subscription notification:', err);
              });
            } else {
              console.error(`Business record NOT FOUND in Firestore: ${businessId}`);
            }
          } catch (dbError: any) {
            console.error("Failed to update Firestore in Dodo Webhook:", dbError.message);
            // We throw to signal 500 to Dodo, forcing exponential retry until Firestore recovers.
            throw dbError; 
          }
        } else {
          console.warn('Warning: Received payment.succeeded without valid metadata (businessId/planId). Skipping automation.');
        }
        break;
      }
        
      case 'subscription.cancelled':
        console.log('Subscription Cancelled:', event.data?.business_id);
        // TODO: Handle cancellation
        break;

      default:
        console.log('Unhandled event type:', event.type);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Dodo Webhook Processing Error:', err.message);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}


