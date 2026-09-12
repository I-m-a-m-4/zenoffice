import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/firebase/admin';

/**
 * Marketing opt-out, reached from the footer of a campaign email.
 *
 * Must run per request and must never be cached — a cached response would show
 * one recipient's confirmation page to the next person who clicks.
 */
export const dynamic = 'force-dynamic';

/**
 * No authentication, by design.
 *
 * The `tid` is the `follow_up_logs` document id, which is a v4 uuid minted per
 * send. It is unguessable and it is only ever known to the person holding that
 * email, so possession of the link *is* the authorisation. Requiring a login
 * instead would mean the one action a recipient is legally entitled to take is
 * the one action gated behind a password they may not have.
 *
 * `GET` deliberately only *offers* to unsubscribe; `POST` performs it. Link
 * scanners and some corporate mail gateways fetch every URL in a message before
 * delivering it, and a GET that mutated would silently unsubscribe people who
 * never clicked anything. `POST` also satisfies RFC 8058, which is what lets
 * Gmail show its own one-click unsubscribe control for these sends.
 *
 * Followed from a browser at zeneva.space rather than fetched cross-origin, so
 * unlike the routes under `api/admin` this one needs no OPTIONS handler or CORS
 * headers.
 */

const ORANGE = '#ea580c';

function page(title: string, bodyHtml: string, status = 200): NextResponse {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title} · Zeneva</title>
</head>
<body style="margin:0;padding:0;background:#f4f2ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:56px 20px;">
    <div style="background:#fff;border:1px solid #ececec;border-radius:16px;padding:36px 32px;text-align:center;">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.6px;color:${ORANGE};margin-bottom:26px;">zeneva</div>
      ${bodyHtml}
    </div>
    <p style="text-align:center;font-size:12px;color:#9a3412;margin-top:20px;">
      &copy; ${new Date().getFullYear()} Zeneva POS &amp; Inventory
    </p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

const HEADING = 'margin:0 0 12px;font-size:20px;font-weight:800;color:#18181b;';
const TEXT = 'margin:0 0 8px;font-size:15px;line-height:1.65;color:#3f3f46;';

/** Show the confirmation button. Never mutates — see the note above. */
export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('tid') || '';

  if (!tid) {
    return page(
      'Link not recognised',
      `<p style="${HEADING}">This link is not valid</p>
       <p style="${TEXT}">It may have been broken across two lines by your email app. Try clicking it again from the original message, or just reply to the email and ask us to unsubscribe you.</p>`,
      400,
    );
  }

  return page(
    'Unsubscribe',
    `<p style="${HEADING}">Stop receiving these emails?</p>
     <p style="${TEXT}">You will still get essential account and receipt emails &mdash; this only turns off the occasional note from us about using Zeneva.</p>
     <form method="POST" action="/api/unsubscribe?tid=${encodeURIComponent(tid)}" style="margin-top:26px;">
       <button type="submit" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#fff;background:${ORANGE};border:0;border-radius:10px;cursor:pointer;">
         Yes, unsubscribe me
       </button>
     </form>
     <p style="margin:22px 0 0;font-size:13px;color:#71717a;">Clicked this by mistake? Just close this tab &mdash; nothing has changed yet.</p>`,
  );
}

/** Perform the opt-out. Idempotent: clicking twice is a success, not an error. */
export async function POST(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('tid') || '';

  const done = page(
    'Unsubscribed',
    `<p style="${HEADING}">You are unsubscribed</p>
     <p style="${TEXT}">We will not send you any more emails about using Zeneva. Essential account emails &mdash; receipts, password resets, security notices &mdash; still come through.</p>
     <p style="margin:22px 0 0;font-size:13px;color:#71717a;">Changed your mind? Reply to any earlier email and we will turn them back on.</p>`,
  );

  if (!tid) return done;

  try {
    const logRef = adminFirestore.collection('follow_up_logs').doc(tid);
    const logSnap = await logRef.get();

    // A stale or forged id gets the same confirmation page as a real one. Telling
    // the caller which ids exist would turn this into a way to test whether an
    // address is on the platform.
    if (!logSnap.exists) return done;

    const sentTo = String(logSnap.data()?.sentTo || '').trim();
    if (!sentTo) return done;

    // Flag every account on that address. One person may hold both an owner and a
    // staff account, and they unsubscribed the address, not one row of a table.
    const users = await adminFirestore
      .collection('users')
      .where('email', '==', sentTo)
      .limit(20)
      .get();

    const batch = adminFirestore.batch();
    const now = new Date();

    for (const doc of users.docs) {
      batch.set(
        doc.ref,
        { marketingOptOut: true, marketingOptOutAt: now },
        { merge: true },
      );
    }

    // Recorded on the log too, so the campaign report can show which email drove
    // the opt-out rather than only that one happened.
    batch.set(logRef, { unsubscribed: true, unsubscribedAt: now }, { merge: true });

    await batch.commit();
  } catch (error) {
    // The recipient asked to be left alone; showing them a stack trace helps
    // nobody. Log it for us and confirm to them, then fix it from the logs.
    console.error('Unsubscribe failed:', (error as Error)?.message);
  }

  return done;
}
