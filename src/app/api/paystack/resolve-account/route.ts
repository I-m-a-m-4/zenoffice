import { NextResponse } from 'next/server';

/**
 * POST /api/paystack/resolve-account — confirm an NGN account number resolves
 * to a real account name before it is saved as a payout destination.
 *
 * This file was `route.ts.bak`, so `zeneva.space/api/paystack/resolve-account`
 * answered the HTML 404 page. The client called `response.json()` on that HTML
 * and the owner saw `SyntaxError: Unexpected token '<'` instead of anything
 * about the account. Called from both /settings and /storefront.
 *
 * It also carried a build-injected `export const dynamic = 'force-static'`,
 * which is meaningless on a POST handler, and a stray UTF-8 BOM on line 3.
 * Neither may come back.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/*
 * Both callers use `apiBase()`, which is the absolute https://zeneva.space
 * origin inside the native shells. A JSON body triggers a preflight, so without
 * an OPTIONS answer the desktop and mobile apps cannot resolve an account at all.
 */
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  // Every exit carries `corsHeaders`. A response the browser rejects for a
  // missing CORS header reaches the client as an opaque network failure, so an
  // error without them reads as "could not connect" and hides the reason.
  const fail = (message: string, status: number) =>
    NextResponse.json({ status: false, message }, { status, headers: corsHeaders });

  try {
    const { account_number, bank_code } = await request.json();

    if (!account_number || !bank_code) {
      return fail('Account number and bank code are required', 400);
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxx')) {
      console.error('Paystack secret key is not configured in .env file.');
      return fail('Server payment configuration error. Paystack key is missing.', 500);
    }

    // Both values are interpolated into the query string, so they are encoded
    // rather than trusted — they arrive from a form field.
    const query = new URLSearchParams({
      account_number: String(account_number),
      bank_code: String(bank_code),
    });

    const response = await fetch(`https://api.paystack.co/bank/resolve?${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.status) {
      console.error('Paystack API resolution error:', data);
      return fail(data.message || 'Failed to resolve account with Paystack.', response.status);
    }

    return NextResponse.json(data, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Internal server error during account resolution:', error);
    return fail('An internal server error occurred.', 500);
  }
}
