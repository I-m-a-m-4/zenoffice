import { NextResponse } from 'next/server';

/**
 * GET /api/paystack/banks — the NGN bank list, for the storefront payout form.
 *
 * This file was `route.ts.bak`, so `zeneva.space/api/paystack/banks` answered
 * the HTML 404 page and the bank dropdown on /storefront was permanently empty.
 * It also carried a build-injected `export const dynamic = 'force-static'` and a
 * stray UTF-8 BOM on line 3 — both artefacts of the old static-export
 * experiment, and neither may come back. If the bank list goes empty again,
 * check the filename before debugging the client.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/*
 * /storefront calls this through `apiBase()`, which resolves to the absolute
 * https://zeneva.space origin inside the desktop and mobile shells. Those run
 * from a `tauri://`/`file://` origin, so without these headers the native apps
 * cannot read the response even when the request itself succeeds.
 */
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxx')) {
    console.error('Paystack secret key is not configured.');
    return NextResponse.json(
      { message: 'Paystack secret key is not configured.' },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const response = await fetch('https://api.paystack.co/bank?currency=NGN', {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Paystack API error fetching banks:', errorData);
      return NextResponse.json(
        { message: 'Failed to fetch banks from Paystack' },
        { status: response.status, headers: corsHeaders }
      );
    }

    const data = await response.json();
    // The client expects the array itself, not Paystack's { status, data } envelope.
    return NextResponse.json(data.data, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching banks:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
