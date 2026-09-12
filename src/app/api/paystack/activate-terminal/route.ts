import { NextResponse } from 'next/server';

/**
 * POST /api/paystack/activate-terminal — the three-step Terminal activation:
 * create (or recover) a Paystack subaccount, create (or recover) a store
 * customer, then provision a dedicated virtual account against both.
 *
 * This file was `route.ts.bak`, so `zeneva.space/api/paystack/activate-terminal`
 * answered the HTML 404 page and Terminal activation could not complete at all.
 * The client called `response.json()` on that HTML, so the failure surfaced as
 * `SyntaxError: Unexpected token '<'` rather than anything about Paystack.
 *
 * It also carried a build-injected `export const dynamic = 'force-static'`,
 * which is meaningless on a POST handler, and a stray UTF-8 BOM ahead of the
 * import. Neither may come back.
 *
 * The three steps are deliberately not a transaction: each is idempotent on
 * retry (409/400 "already exists" is treated as success and the existing record
 * is fetched), because a partial activation must be resumable rather than
 * leaving an orphaned subaccount behind.
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

export async function POST(request: Request) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: corsHeaders });

  try {
    const { businessId, businessName, email, phone, bankCode, accountNumber } =
      await request.json();

    if (!businessId || !businessName || !bankCode || !accountNumber) {
      return fail(
        'All parameters (businessId, businessName, bankCode, accountNumber) are required.',
        400
      );
    }

    if (!phone) {
      return fail(
        'Phone number is required. Please add a business phone number in your profile settings before activating the terminal.',
        400
      );
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes('xxx')) {
      return fail(
        'Paystack Secret Key is not configured in environment variables (.env).',
        500
      );
    }

    const authHeader = `Bearer ${PAYSTACK_SECRET_KEY}`;

    // 1. Create or retrieve the Paystack subaccount
    let subaccountCode = '';
    try {
      const subaccountResponse = await fetch('https://api.paystack.co/subaccount', {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName,
          bank_code: bankCode,
          account_number: accountNumber,
          percentage_charge: 0,
        }),
        cache: 'no-store',
      });

      const subaccountData = await subaccountResponse.json().catch(() => ({} as any));

      if (
        subaccountResponse.status === 409 ||
        subaccountData.message?.includes('already exist')
      ) {
        // Retrieve the existing subaccount. Both values are encoded — they reach
        // us from a form and are interpolated into the query string.
        const listQuery = new URLSearchParams({
          bank_code: String(bankCode),
          account_number: String(accountNumber),
        });
        const listResponse = await fetch(
          `https://api.paystack.co/subaccount?${listQuery}`,
          { headers: { Authorization: authHeader }, cache: 'no-store' }
        );
        const listData = await listResponse.json().catch(() => ({} as any));

        if (listData.status && listData.data?.length > 0) {
          subaccountCode = listData.data[0].subaccount_code;
        } else {
          return fail(
            'A subaccount with these bank details already exists but could not be retrieved.',
            409
          );
        }
      } else if (!subaccountResponse.ok || !subaccountData.status) {
        return fail(
          subaccountData.message || 'Failed to create Paystack subaccount.',
          subaccountResponse.status
        );
      } else {
        subaccountCode = subaccountData.data.subaccount_code;
      }
    } catch (err: any) {
      console.error('Subaccount step failed:', err);
      return fail(`Subaccount creation failed: ${err.message}`, 500);
    }

    // 2. Create the store customer the dedicated account is mapped to
    let customerCode = '';
    const storeEmail = email || `terminal-${String(businessId).substring(0, 8)}@zeneva.space`;
    try {
      const customerResponse = await fetch('https://api.paystack.co/customer', {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: storeEmail,
          first_name: businessName,
          last_name: 'Terminal Store',
          phone: phone,
        }),
        cache: 'no-store',
      });

      const customerData = await customerResponse.json().catch(() => ({} as any));

      // An existing customer is the normal outcome of a retry, not a failure.
      if (customerResponse.status === 400 && customerData.message?.includes('exists')) {
        const fetchCustResponse = await fetch(
          `https://api.paystack.co/customer/${encodeURIComponent(String(storeEmail))}`,
          { headers: { Authorization: authHeader }, cache: 'no-store' }
        );
        const fetchCustData = await fetchCustResponse.json().catch(() => ({} as any));

        if (fetchCustData.status) {
          customerCode = fetchCustData.data.customer_code;

          // A dedicated account requires a phone number on the customer, so an
          // older record created without one is topped up here before step 3.
          await fetch(
            `https://api.paystack.co/customer/${encodeURIComponent(String(customerCode))}`,
            {
              method: 'PUT',
              headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                first_name: businessName,
                last_name: 'Terminal Store',
                phone: phone,
              }),
              cache: 'no-store',
            }
          );
        }
      } else if (!customerResponse.ok || !customerData.status) {
        return fail(
          customerData.message || 'Failed to create Paystack customer.',
          customerResponse.status
        );
      } else {
        customerCode = customerData.data.customer_code;
      }
    } catch (err: any) {
      console.error('Customer step failed:', err);
      return fail(`Customer creation failed: ${err.message}`, 500);
    }

    // 3. Provision the dedicated virtual account
    try {
      const dvaResponse = await fetch('https://api.paystack.co/dedicated_account', {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: customerCode,
          preferred_bank: 'wema-bank',
          subaccount: subaccountCode,
          first_name: businessName,
          last_name: 'Terminal Store',
          phone: phone,
        }),
        cache: 'no-store',
      });

      const dvaData = await dvaResponse.json().catch(() => ({} as any));

      if (!dvaResponse.ok || !dvaData.status) {
        console.error('Paystack DVA generation failed:', dvaData);
        return fail(
          dvaData.message ||
            'Paystack rejected virtual account generation. Ensure your Paystack merchant compliance documents are fully approved for Live DVA access.',
          dvaResponse.status || 400
        );
      }

      const assignedAccount = dvaData.data.dedicated_account || dvaData.data;

      return NextResponse.json(
        {
          status: 'success',
          bankName: assignedAccount.bank?.name || 'Wema Bank',
          accountNumber: assignedAccount.account_number,
          accountName: assignedAccount.account_name,
          subaccountCode: subaccountCode,
        },
        { status: 200, headers: corsHeaders }
      );
    } catch (err: any) {
      console.error('DVA step failed:', err);
      return fail(`Virtual account allocation failed: ${err.message}`, 500);
    }
  } catch (error: any) {
    console.error('Internal server error in activate-terminal:', error);
    return fail('An internal server error occurred.', 500);
  }
}
