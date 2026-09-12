export const dynamic = 'force-static'; // [TAURI_INJECTED]
// [TAURI_HIDDEN] export const dynamic = 'force-static';
﻿
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { reference } = await request.json();

    if (!reference) {
      return NextResponse.json({ error: 'Transaction reference is required' }, { status: 400 });
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxx')) {
      console.error("Paystack secret key is not configured in .env file.");
      return NextResponse.json({ error: 'Server payment configuration error.' }, { status: 500 });
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Paystack API verification error:', errorData);
      return NextResponse.json({ status: 'error', message: 'Failed to verify transaction with Paystack.' }, { status: response.status });
    }

    const data = await response.json();

    // Check if the API call was successful and the transaction status from Paystack is 'success'
    if (data.status && data.data.status === 'success') {
      // We only return the necessary, safe-to-use data to the client.
      // Trigger Notification to Merchant
      // TODO: Implement user lookup based on payment metadata to send notification
      // await sendNotificationToUser(merchantUserId, { title: 'New Order!', body: `Amount: ${data.data.currency} ${data.data.amount / 100}` });

      return NextResponse.json({
        status: 'success',
        message: 'Transaction verified successfully.',
        data: {
          amount: data.data.amount,
          currency: data.data.currency,
          status: data.data.status,
          reference: data.data.reference,
        }
      }, { status: 200 });
    } else {
      return NextResponse.json({ status: 'failed', message: data.data.gateway_response || 'Transaction not successful' }, { status: 402 });
    }
  } catch (error) {
    console.error('Internal server error during payment verification:', error);
    return NextResponse.json({ error: 'An internal server error occurred during verification.' }, { status: 500 });
  }
}


