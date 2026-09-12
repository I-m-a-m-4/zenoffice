import { NextResponse } from 'next/server';
import { sendEmail, MarketingOptOutError } from '@/lib/server/resend';
import { requireSuperAdmin, corsHeaders } from '../_guard';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/admin/send-follow-up
 *
 * Sends one outreach email from the platform's address.
 *
 * The authorization here used to be an `if` with an empty body — it verified the
 * token's signature, computed a condition, and then did nothing with it. Any
 * signed-in Zeneva user could therefore send arbitrary HTML from `zeneva.space`
 * to any address. It is now a real super-admin gate.
 */
export async function POST(req: Request) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.res;

  try {
    const body = await req.json();
    const {
      to,
      name,
      subject,
      html,
      businessId,
      type,
      from,
      replyTo,
      // Campaign sends pass a complete document rendered by
      // `src/lib/email-templates.ts`, so the transactional wrapper must be off.
      wrap,
      segment,
      behaviorContext,
    } = body ?? {};

    if (!to || !subject || !html) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400, headers: corsHeaders },
      );
    }

    const trackId = await sendEmail({
      to,
      name,
      subject,
      body: html,
      businessId,
      type,
      from,
      replyTo,
      wrap,
      segment,
      behaviorContext,
    });

    return NextResponse.json({
      success: true,
      trackId,
      message: 'Follow-up email sent successfully.'
    }, { headers: corsHeaders });

  } catch (error: any) {
    // An unsubscribed recipient is a correct outcome, not a fault: answer 200 with
    // `skipped` so a batch run reports it as skipped rather than sending the
    // operator hunting for a delivery failure.
    if (error instanceof MarketingOptOutError) {
      return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'opted_out',
        message: error.message,
      }, { headers: corsHeaders });
    }

    console.error('Send Follow-Up Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Internal Server Error'
    }, { status: 500, headers: corsHeaders });
  }
}
