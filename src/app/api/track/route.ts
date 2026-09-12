import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// Open-tracking pixel: must run per request and must never be cached.
export const dynamic = 'force-dynamic';

const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tid = searchParams.get('tid');

  if (tid) {
    try {
      const logRef = adminFirestore.collection('follow_up_logs').doc(tid);

      // Atomic increment rather than read-then-write: two mail clients fetching
      // the pixel at once would otherwise both read the same count and write the
      // same value, losing an open. This also drops a round trip.
      await logRef.update({
        openedAt: new Date(),
        openCount: FieldValue.increment(1),
        lastIp: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        status: 'opened'
      });
    } catch (error) {
      // A missing doc throws here (update, unlike set, requires existence). That
      // is expected for a stale or forged tid, so it stays a warning: the pixel
      // must still return an image or the recipient sees a broken-image icon.
      console.warn('Tracking update skipped:', (error as Error)?.message);
    }
  }

  return new NextResponse(TRANSPARENT_PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
