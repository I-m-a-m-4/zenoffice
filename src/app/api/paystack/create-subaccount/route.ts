import { NextResponse } from 'next/server';

/**
 * POST /api/paystack/create-subaccount — create (or recover) the Paystack
 * subaccount that storefront payouts settle into.
 *
 * This file was `route.ts.bak`, so `zeneva.space/api/paystack/create-subaccount`
 * answered the HTML 404 page and storefront payout setup could never complete.
 * It also carried a build-injected `export const dynamic = 'force-static'`,
 * meaningless on a POST handler, and a stray UTF-8 BOM on line 3. Neither may
 * come back.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/*
 * /storefront calls this through `apiBase()` — the absolute zeneva.space origin
 * inside the native shells. A JSON body triggers a preflight, so without an
 * OPTIONS answer the desktop and mobile apps cannot set up payouts at all.
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
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: corsHeaders });

  try {
    const { business_name, bank_code, account_number } = await request.json();

    if (!business_name || !bank_code || !account_number) {
      return fail('Business name, bank code, and account number are required', 400);
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxx')) {
      console.error('Paystack secret key is not configured.');
      return fail('Paystack secret key is not configured.', 500);
    }

    const response = await fetch('https://api.paystack.co/subaccount', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_name,
        bank_code,
        account_number,
        percentage_charge: 0, // Zeneva takes 0%
      }),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({} as any));

    if (!response.ok || !data.status) {
      console.error('Paystack subaccount creation error:', data);

      // Paystack answers 409 when a subaccount for these bank details already
      // exists. That is the normal outcome of a retry, not a failure, so the
      // existing subaccount is looked up and returned instead.
      //
      // `data.message` is optional-chained on purpose: a 409 with no message
      // body used to throw here, which turned a recoverable conflict into an
      // opaque 500.
      if (response.status === 409 && data.message?.includes('already exist')) {
        try {
          const listUrl = new URL('https://api.paystack.co/subaccount');
          listUrl.searchParams.append('bank_code', String(bank_code));
          listUrl.searchParams.append('account_number', String(account_number));

          const existingResponse = await fetch(listUrl.toString(), {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
            cache: 'no-store',
          });
          const existingData = await existingResponse.json().catch(() => ({} as any));

          if (existingData.status && existingData.data?.length > 0) {
            return NextResponse.json(
              { subaccount_code: existingData.data[0].subaccount_code },
              { status: 200, headers: corsHeaders }
            );
          }
        } catch (fetchError) {
          console.error('Error fetching existing subaccount:', fetchError);
          return fail(
            'A subaccount with these details exists, but we could not retrieve it. Please contact support.',
            500
          );
        }
      }

      return fail(data.message || 'Failed to create Paystack subaccount.', response.status);
    }

    return NextResponse.json(
      { subaccount_code: data.data.subaccount_code },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Internal server error creating subaccount:', error);
    return fail('An internal server error occurred.', 500);
  }
}
