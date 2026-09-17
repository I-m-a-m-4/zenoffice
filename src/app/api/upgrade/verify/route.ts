import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transaction_id, userId } = body;

    if (!transaction_id || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing transaction_id or userId' },
        { status: 400 }
      );
    }

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      console.error('FLUTTERWAVE_SECRET_KEY is not set.');
      return NextResponse.json(
        { success: false, error: 'Payment gateway not configured.' },
        { status: 500 }
      );
    }

    // Verify payment with Flutterwave
    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const verifyData = await verifyResponse.json();

    if (
      verifyData.status !== 'success' ||
      verifyData.data?.status !== 'successful'
    ) {
      console.warn('Flutterwave verification failed:', verifyData);
      return NextResponse.json(
        { success: false, error: 'Payment verification failed. Please contact support.' },
        { status: 402 }
      );
    }

    if (!adminFirestore) {
      return NextResponse.json(
        { success: false, error: 'Database not available.' },
        { status: 500 }
      );
    }

    // Look up user to find their businessId
    const userDoc = await adminFirestore.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found.' },
        { status: 404 }
      );
    }

    const businessId = userDoc.data()?.businessId;
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'User business not found.' },
        { status: 404 }
      );
    }

    // Upgrade the business plan to 'pro' in Firestore
    const businessRef = adminFirestore.collection('businessInstances').doc(businessId);
    await businessRef.update({
      plan: 'pro',
      upgradedAt: new Date().toISOString(),
      lastPaymentTransactionId: transaction_id,
      lastPaymentAmount: verifyData.data?.amount,
      lastPaymentCurrency: verifyData.data?.currency,
    });

    console.log(`Business ${businessId} (User ${userId}) upgraded to Pro. Transaction: ${transaction_id}`);
    return NextResponse.json({ success: true, plan: 'pro' });
  } catch (error: any) {
    console.error('Upgrade verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
