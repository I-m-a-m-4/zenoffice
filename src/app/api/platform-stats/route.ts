import { NextResponse } from 'next/server';
import { getCachedPlatformAnalytics } from '@/lib/server/analytics-cache';

// Public endpoint (the /about/our-mission page fetches it), deliberately
// unauthenticated. It is CDN-cached below rather than statically rendered, so
// the figures refresh without a redeploy.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Retrieve cached metrics (auto-refreshing every 6 hours)
    const analytics = await getCachedPlatformAnalytics();

    const totalBusinesses = analytics.totalBusinesses || 1;

    // Construct lightweight public response payload
    const payload = {
      totalSalesCount: analytics.totalReceipts || 2141,
      platformGmv: analytics.platformGmv || 92100000,
      overallArpu: Math.round(analytics.platformGmv / totalBusinesses) || 2090000
    };

    // Cache the response at the CDN/Edge level for 1 hour to save Firestore reads
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=1800, public',
      }
    });

  } catch (error: any) {
    console.error("Error serving platform stats:", error);
    // Return fallback values in case of failure so client page never breaks
    return NextResponse.json({
      totalSalesCount: 2141,
      platformGmv: 92100000,
      overallArpu: 2090000
    }, {
      headers: {
        'Cache-Control': 's-maxage=600, public', // Cache fallbacks for 10 minutes
      }
    });
  }
}
