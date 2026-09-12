import { NextResponse } from 'next/server';

/**
 * POST /api/paystack/verify-customer — submit a BVN to Paystack's customer
 * identification API, which Terminal activation depends on.
 *
 * This file was `route.ts.bak`, so `zeneva.space/api/paystack/verify-customer`
 * answered the HTML 404 page. The client called `response.json()` on that HTML
 * and the owner saw `SyntaxError: Unexpected token '<'` rather than anything
 * about verification. It also carried a build-injected
 * `export const dynamic = 'force-static'` and a stray UTF-8 BOM on line 3.
 * Neither may come back.
 *
 * Note on logging: the BVN itself is never logged. Paystack's response is logged
 * on failure because it carries the reason, but the submitted identity value
 * stays out of the log deliberately.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: corsHeaders });

  try {
    const { bvn, email, customerCode } = await req.json();

    if (!bvn || String(bvn).length !== 11) {
      return fail('Valid 11-digit BVN is required.', 400);
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey || paystackSecretKey.includes('xxx')) {
      console.error('PAYSTACK_SECRET_KEY is missing');
      return fail('Payment gateway configuration error.', 500);
    }

    // Either a Paystack customer code or an email identifies the customer.
    const identifier = customerCode || email;
    if (!identifier) {
      return fail(
        'Customer identifier (email or code) is missing. Have you activated your terminal yet?',
        400
      );
    }

    // The identifier goes into the URL path, so it is encoded rather than
    // trusted — an email address contains characters that need it.
    const verifyResponse = await fetch(
      `https://api.paystack.co/customer/${encodeURIComponent(String(identifier))}/identification`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          country: 'NG',
          type: 'bvn',
          value: bvn,
          bvn: bvn,
        }),
        cache: 'no-store',
      }
    );

    const verifyData = await verifyResponse.json().catch(() => ({} as any));

    if (!verifyResponse.ok || !verifyData.status) {
      console.error('Paystack customer verification failed:', verifyData);
      return fail(
        verifyData.message || 'Failed to verify BVN with Paystack.',
        verifyResponse.status || 400
      );
    }

    return NextResponse.json(
      { status: 'success', message: 'Customer verified successfully.' },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Internal server error in verify-customer:', error);
    return fail('An internal server error occurred.', 500);
  }
}
