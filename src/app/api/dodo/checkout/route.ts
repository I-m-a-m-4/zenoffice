import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/dodo/checkout — create a Dodo Payments checkout session (USD).
 *
 * This file was `route.ts.bak` for several releases, which meant Next.js never
 * registered it and `zeneva.space/api/dodo/checkout` answered the HTML 404
 * page. The client called `response.json()` on that HTML and the owner saw
 * `SyntaxError: Unexpected token '<'` instead of anything about billing. If
 * USD checkout ever 404s again, check the filename first.
 *
 * It also carried a build-injected `export const dynamic = 'force-static'`,
 * which is meaningless on a POST handler and cannot be restored — a checkout
 * session must be minted per request.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/*
 * The desktop and mobile shells run from a `tauri://`/`file://` origin and call
 * this hosted endpoint cross-origin. A JSON body triggers a preflight, so
 * without an OPTIONS answer the native apps cannot check out at all — the same
 * reason the admin routes carry these headers.
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

const DODO_API_KEY = process.env.DODO_SECRET_KEY;
const DODO_MODE = process.env.NEXT_PUBLIC_DODO_MODE === 'live' ? 'live' : 'test';
const DODO_API_URL = `https://${DODO_MODE}.dodopayments.com/checkouts`;

// Product IDs from Dodo Dashboard mapped by planId and cycleMonths
const DODO_PRODUCT_IDS: Record<string, Record<string, string>> = {
  'pro': {
    '1': process.env.DODO_PRO_PRODUCT_ID || 'pdt_0Ne8DxFd4qtNIJdum6kaB',
    '3': process.env.DODO_PRO_3M_PRODUCT_ID || 'pdt_0NkpBsjzk7VlSGUeFz7Dl',
    '6': process.env.DODO_PRO_6M_PRODUCT_ID || 'pdt_0NkpBzjP613uXSgyPeP6C',
    '12': process.env.DODO_PRO_1Y_PRODUCT_ID || 'pdt_0NkpC3pkoA6FLfvUDr9Yq',
  },
  'business': {
    '1': process.env.DODO_BUSINESS_PRODUCT_ID || 'pdt_0Ne8FzxfnfO0Q55dQ2QuK',
    '3': process.env.DODO_BUSINESS_3M_PRODUCT_ID || 'pdt_0NkpBVh9ldI3byXk8hTQW',
    '6': process.env.DODO_BUSINESS_6M_PRODUCT_ID || 'pdt_0NkpBe3yuk1XV4RsVtPfb',
    '12': process.env.DODO_BUSINESS_1Y_PRODUCT_ID || 'pdt_0NkpBlN8u6xuhe4pDa8BY',
  }
};

/**
 * Subscriptions only — this endpoint sells plans and nothing else.
 *
 * It used to carry a second branch for one-off Zen AI credit packs, keyed on a
 * `packId` in the body and a `DODO_CREDITS_*_PRODUCT_ID` per pack. Credits are now
 * an allowance of the plan and are not sold separately, so that branch and its
 * three env vars are gone. Nothing sends `packId` any more; a body carrying one
 * falls through to the missing-plan refusal below, which is the correct answer.
 */
export async function POST(req: NextRequest) {
  // Every exit below carries `corsHeaders`. A response the browser rejects for
  // a missing CORS header reaches the client as an opaque network failure, so
  // an error without them reads as "could not connect" and hides the reason.
  const fail = (error: string, status: number, extra?: Record<string, unknown>) =>
    NextResponse.json({ error, ...extra }, { status, headers: corsHeaders });

  try {
    const { planId, email, businessId, cycleMonths } = await req.json();
    console.log('Dodo Checkout Request:', { planId, email, businessId, cycleMonths });

    if (!DODO_API_KEY) {
      console.error('Dodo API key is missing from environment variables');
      return fail('Payment gateway is not configured. Please contact support.', 500);
    }

    if (!email || !businessId) {
      return fail('Missing email or business.', 400);
    }

    if (!planId) {
      return fail('Missing plan, email or business.', 400);
    }

    const cycleKey = cycleMonths ? cycleMonths.toString() : '1';
    const planProducts = DODO_PRODUCT_IDS[planId];

    if (!planProducts) {
      console.error('Dodo Product mapping not found for plan:', planId);
      return fail('Invalid plan ID', 400);
    }

    const productId = planProducts[cycleKey];
    console.log(`Target Product ID for plan ${planId} (${cycleKey} months):`, productId);

    if (!productId || productId.includes('placeholder')) {
      console.error(`Dodo Product ID not configured for plan: ${planId}, cycle: ${cycleKey}`);
      return fail(`This plan is not available for a ${cycleKey}-month cycle yet.`, 400);
    }

    const metadata: Record<string, string> = {
      businessId: businessId,
      planId: planId,
      cycleMonths: cycleKey,
      /*
       * Explicit, though the webhook also accepts a missing `kind` as a
       * subscription — checkouts created before this existed are still in flight.
       * It is the only value this endpoint produces now that credit packs are
       * gone, but the webhook still branches on it, so keep sending it.
       */
      kind: 'subscription',
    };

    const body = {
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
        },
      ],
      customer: {
        email: email,
      },
      metadata,
      billing_currency: 'USD',
    };

    // Create Checkout Session
    const response = await fetch(DODO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    /*
     * Dodo answers HTML on an auth failure or an outage, so parsing
     * unconditionally would throw the exact `Unexpected token '<'` this
     * endpoint already inflicted on the client once. Read text, then parse.
     */
    const raw = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error('Dodo API returned non-JSON:', response.status, raw.slice(0, 500));
      return fail('The payment provider returned an unexpected response. Please try again.', 502);
    }

    if (!response.ok) {
      console.error('Dodo API Error Response:', data);
      return fail(data?.message || 'Failed to create Dodo checkout session', response.status);
    }

    if (!data?.checkout_url) {
      console.error('Dodo API succeeded but returned no checkout_url:', data);
      return fail('The payment provider did not return a checkout link.', 502);
    }

    return NextResponse.json({ checkout_url: data.checkout_url }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Internal Dodo Checkout Error:', error);
    return fail('Internal Server Error', 500, { message: error?.message });
  }
}


