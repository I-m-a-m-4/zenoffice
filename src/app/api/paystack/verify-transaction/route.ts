import { NextResponse } from 'next/server';
import { adminFirestore } from '@/firebase/admin';
import { sendNotificationToUser } from '@/lib/server/notifications';

/**
 * Storefront Paystack verification.
 *
 * This route existed only as `route.ts.bak`, so `/api/paystack/verify-transaction`
 * answered the HTML 404 page. `checkout-dialog.tsx` calls it after Paystack
 * charges the card, then does `response.json()` on `<!DOCTYPE html>`, throws,
 * and lands in its catch — which means the shopper was charged and
 * `createOrderInFirestore` never ran. Restoring the file is what fixes that.
 *
 * `force-dynamic`, not `force-static`: the original carried a
 * `force-static` line injected by the old static-export experiment, which is
 * meaningless on a POST handler.
 *
 * Deliberately unauthenticated — storefront shoppers are anonymous. What
 * replaces auth is that `expectedAmount` is now REQUIRED and the comparison is
 * unconditional. Previously it read `if (expectedAmount && ...)`, so simply
 * omitting the field skipped the integrity check entirely and any successful
 * charge of any size verified as correct.
 *
 * CORS/OPTIONS for the native shells is handled globally by src/middleware.ts.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { reference, expectedAmount, businessId, currency } = await request.json();

    if (!reference || typeof reference !== 'string') {
      return NextResponse.json({ error: 'Transaction reference is required' }, { status: 400 });
    }

    // Required, not optional. A missing amount used to mean "skip the check".
    if (typeof expectedAmount !== 'number' || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return NextResponse.json(
        { status: 'failed', message: 'A valid expected amount is required.' },
        { status: 400 }
      );
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxx')) {
      console.error('Paystack secret key is not configured in .env file.');
      return NextResponse.json({ error: 'Server payment configuration error.' }, { status: 500 });
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Paystack API verification error:', errorData);
      return NextResponse.json(
        { status: 'error', message: 'Failed to verify transaction with Paystack.' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.status && data.data?.status === 'success') {
      if (data.data.amount !== expectedAmount) {
        console.error(
          `Payment amount mismatch. Expected: ${expectedAmount}, Actual: ${data.data.amount}`
        );
        return NextResponse.json(
          { status: 'failed', message: 'Payment amount mismatch. Please contact support.' },
          { status: 400 }
        );
      }

      // Paystack settles in the currency it charged in; a matching number of
      // minor units in a different currency is not the same payment.
      if (currency && data.data.currency !== currency) {
        console.error(
          `Payment currency mismatch. Expected: ${currency}, Actual: ${data.data.currency}`
        );
        return NextResponse.json(
          { status: 'failed', message: 'Payment currency mismatch. Please contact support.' },
          { status: 400 }
        );
      }

      // Merchant notification is best-effort: a failure here must not turn a
      // genuinely paid transaction into a client-side error.
      if (businessId) {
        try {
          const employeesSnapshot = await adminFirestore
            .collection('users')
            .where('businessId', '==', businessId)
            .where('role', 'in', ['owner', 'admin', 'manager'])
            .get();

          if (!employeesSnapshot.empty) {
            const notificationPromises = employeesSnapshot.docs.map((doc: any) =>
              sendNotificationToUser(doc.id, {
                title: 'New online order',
                body: `Received payment of ${data.data.currency} ${(
                  data.data.amount / 100
                ).toLocaleString()}`,
                url: '/dashboard/online-orders',
              })
            );
            await Promise.all(notificationPromises);
          }
        } catch (notifyError) {
          console.error('Failed to send notification:', notifyError);
        }
      }

      // Only the minimal, safe-to-use fields go back to the client.
      return NextResponse.json(
        {
          status: 'success',
          message: 'Transaction verified successfully.',
          data: {
            amount: data.data.amount,
            currency: data.data.currency,
            status: data.data.status,
            reference: data.data.reference,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { status: 'failed', message: data.data?.gateway_response || 'Transaction not successful' },
      { status: 402 }
    );
  } catch (error) {
    console.error('Internal server error during payment verification:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred during verification.' },
      { status: 500 }
    );
  }
}
