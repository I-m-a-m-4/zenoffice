import { Resend } from 'resend';
import { adminFirestore } from '@/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import { UNSUBSCRIBE_TOKEN } from '@/lib/email-templates';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://zeneva.space';

/**
 * Lazy-initialized Resend client to ensure environment variables are loaded.
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export interface EmailParams {
  to: string;
  name: string;
  subject: string;
  body: string; // HTML body
  businessId?: string;
  type?: string;
  from?: string;
  replyTo?: string;
  /**
   * Whether to wrap `body` in the transactional shell below.
   *
   * Defaults to **true**, because the existing callers (support replies from
   * `src/actions/notifications.ts`) pass an HTML *fragment* and depend on the
   * wrapper for all of their branding. Marketing campaigns pass a complete
   * document rendered by `src/lib/email-templates.ts` and set this to false.
   */
  wrap?: boolean;
  /** Behavioural segment this send targeted, for campaign reporting. */
  segment?: string;
}

/**
 * Thrown instead of sending when the recipient has unsubscribed from marketing.
 *
 * A distinct type rather than a generic Error so the route handler can answer
 * "skipped" instead of "failed" — a batch that reports an opt-out as a failure
 * makes the operator go looking for a bug that is not there.
 */
export class MarketingOptOutError extends Error {
  readonly optedOut = true;
  constructor(to: string) {
    super(`${to} has unsubscribed from marketing email.`);
    this.name = 'MarketingOptOutError';
  }
}

/**
 * Has this address opted out of marketing email?
 *
 * Checked here, server-side, and not only in the admin UI. The console builds
 * its recipient list once at the start of a campaign; if somebody unsubscribes
 * while that campaign is still running, the only thing standing between them and
 * another email is this query.
 */
async function hasOptedOutOfMarketing(to: string): Promise<boolean> {
  try {
    const snapshot = await adminFirestore
      .collection('users')
      .where('email', '==', to)
      .limit(5)
      .get();
    return snapshot.docs.some((doc: any) => doc.data()?.marketingOptOut === true);
  } catch (error) {
    // A failed lookup must not become a licence to mail. Treating an error as
    // "not opted out" is the one wrong answer here, so fail closed.
    console.error('Opt-out check failed, refusing to send:', (error as Error)?.message);
    return true;
  }
}

/**
 * Wraps a body **fragment** in the transactional Zeneva shell.
 *
 * Only used when `wrap` is not false. The tracking pixel is deliberately not
 * inserted here any more — see `injectTracking`, which has to work for wrapped
 * fragments and standalone campaign documents alike.
 */
function wrapInTemplate(body: string): string {
  const year = new Date().getFullYear();
  return `
    <div style="font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #f0f0f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background-color: #fcfcfc; padding: 25px; border-bottom: 1px solid #f5f5f5; text-align: center;">
        <img src="https://i.ibb.co/tMp65gRP/5c1014423d18.png" alt="Zeneva" width="60" height="60" style="width: 60px; height: 60px; object-fit: contain; display: inline-block; border: 0;" />
      </div>

      <div style="padding: 40px 30px; color: #1f2937; line-height: 1.7; font-size: 15px;">
        ${body}
      </div>

      <div style="margin: 0 30px; padding: 30px 0; border-top: 1px solid #f0f0f0; font-size: 13px; color: #6b7280;">
        <p style="margin-bottom: 15px;">Talk soon,<br/><strong>Zeneva Team</strong></p>
        <p style="margin: 0; font-size: 12px; line-height: 1.5;">
          <strong>Account Executive</strong><br/>
          Zeneva POS & Inventory<br/>
          <a href="https://zeneva.space" style="color: #f97316; text-decoration: none; font-weight: 600;">Launch your workspace →</a>
        </p>
      </div>

      <!-- ZENEVA Premium Branded Bar - Orange -->
      <div style="padding: 0 30px 40px;">
        <div style="height: 50px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 8px; display: table; width: 100%; border-collapse: separate;">
          <div style="display: table-cell; vertical-align: middle; text-align: center; color: white; font-weight: 900; letter-spacing: 3px; font-size: 14px; text-transform: capitalize;">
            Zeneva POS & Inventory
          </div>
        </div>
      </div>

      <div style="background-color: #fffaf0; border-top: 1px solid #ffedd5; padding: 40px 30px; text-align: center; font-size: 11px; color: #7c2d12;">
        <div style="font-weight: 800; letter-spacing: 0.2em; margin-bottom: 20px; color: #ea580c; font-size: 14px; text-transform: capitalize;">
          Zeneva POS & Inventory
        </div>
        &copy; ${year} Zeneva POS & Inventory. All rights reserved.<br/>
      </div>
    </div>
  `;
}

/**
 * Add the open-tracking pixel and resolve the unsubscribe placeholder.
 *
 * Both need the `trackId`, which only exists once a send is under way, and both
 * have to apply whether the HTML is a wrapped fragment or a complete campaign
 * document. Kept out of `wrapInTemplate` for exactly that reason.
 *
 * The pixel goes immediately before `</body>` when there is one, so it lands
 * inside the document rather than trailing after it — mail clients that sanitise
 * stray post-`</body>` nodes would otherwise drop it and every open would be
 * invisible.
 */
function injectTracking(html: string, trackId: string): string {
  const pixel = `<img src="${BASE_URL}/api/track?tid=${trackId}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
  const unsubscribeUrl = `${BASE_URL}/api/unsubscribe?tid=${trackId}`;

  const withUnsubscribe = html.split(UNSUBSCRIBE_TOKEN).join(unsubscribeUrl);

  const closingBody = withUnsubscribe.lastIndexOf('</body>');
  if (closingBody !== -1) {
    return (
      withUnsubscribe.slice(0, closingBody) + pixel + withUnsubscribe.slice(closingBody)
    );
  }
  return withUnsubscribe + pixel;
}

/**
 * Sends an email via Resend with a 1x1 open-tracking pixel and Zeneva branding.
 *
 * Returns the tracking id, which is also the `follow_up_logs` document id and the
 * capability in the unsubscribe link.
 */
export async function sendEmail(params: EmailParams & { behaviorContext?: any }): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured in environment variables.');
  }

  // Before the log document is created, so a refused send leaves no row to skew
  // the campaign's open rate.
  if (params.type === 'marketing' && (await hasOptedOutOfMarketing(params.to))) {
    throw new MarketingOptOutError(params.to);
  }

  const trackId = uuidv4();

  // 1. Brand it (fragments only) and stamp in the tracking pixel + unsubscribe URL
  const shell = params.wrap === false ? params.body : wrapInTemplate(params.body);
  const htmlWithBranding = injectTracking(shell, trackId);

  // 2. Create Log document in Firestore with Behavioral Intelligence
  await adminFirestore.collection('follow_up_logs').doc(trackId).set({
    sentTo: params.to,
    recipientName: params.name,
    subject: params.subject,
    sentAt: new Date(),
    status: 'pending',
    businessId: params.businessId || 'unknown',
    type: params.type || 'follow-up',
    // Field name matters: the admin audit table reads `behaviorContext`. This was
    // written as `behavior`, so the "Intel" chip never rendered for any send.
    behaviorContext: params.behaviorContext ?? null,
    segment: params.segment ?? null,
    html: htmlWithBranding,
    openCount: 0
  });

  try {
    // 3. Send Email via Resend
    const resend = getResendClient();
    if (!resend) {
      throw new Error('Resend client not initialized. Check RESEND_API_KEY environment variable.');
    }

    const fromAddress = params.from || 'Zeneva <hello@zeneva.space>';

    // RFC 8058 one-click unsubscribe. Gmail and Outlook render their own
    // unsubscribe control from these two headers and rank senders who supply them
    // more kindly — which matters a great deal for a domain that has not sent
    // bulk mail before. Marketing only: a support reply is not a subscription,
    // and offering to unsubscribe from one is confusing.
    const listHeaders =
      params.type === 'marketing'
        ? {
            'List-Unsubscribe': `<${BASE_URL}/api/unsubscribe?tid=${trackId}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [params.to],
      replyTo: params.replyTo || 'hello@zeneva.space',
      subject: params.subject,
      html: htmlWithBranding,
      ...(listHeaders ? { headers: listHeaders } : {}),
    });

    if (error) {
      throw error;
    }

    console.log('Email sent successfully via Resend:', data?.id);

    // Update log on success
    await adminFirestore.collection('follow_up_logs').doc(trackId).update({
      status: 'sent'
    });

    return trackId;

  } catch (error: any) {
    console.error(`Failed sending Resend email to ${params.to}:`, error.message);

    // Update log to failed
    await adminFirestore.collection('follow_up_logs').doc(trackId).update({
      status: 'failed',
      error: error.message
    });

    throw error;
  }
}
