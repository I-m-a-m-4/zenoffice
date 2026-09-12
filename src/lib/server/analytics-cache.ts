import { adminFirestore } from '@/firebase/admin';
import {
  BENCHMARK_COLLECTION,
  BENCHMARK_DOC_ID,
  BENCHMARK_MIN_COHORT,
  computeRatingBenchmark,
} from '@/lib/rating-benchmark';

/** The scan caps. Named because the benchmark has to report whether it hit one. */
const RECEIPT_SCAN_CAP = 50000;
const PRODUCT_SCAN_CAP = 50000;

/**
 * Calculates and caches platform-wide analytics in Firestore to optimize R/W operations.
 */
export async function getCachedPlatformAnalytics(forceRefresh = false) {
  if (!adminFirestore) {
    throw new Error("Firebase Admin not initialized. Check FIREBASE_PROJECT_ID, CLIENT_EMAIL, and PRIVATE_KEY.");
  }

  const cacheDocRef = adminFirestore.collection('admin_analytics').doc('overview');
  let cacheDoc: any = null;
  
  try {
    cacheDoc = await cacheDocRef.get();
  } catch (e) {
    console.error("Failed to fetch cache doc:", e);
  }

  const now = new Date();
  const CACHE_TTL_HOURS = 6;

  if (!forceRefresh && cacheDoc?.exists) {
    const data = cacheDoc.data();
    const lastUpdated = data?.lastUpdated?.toDate();
    
    if (lastUpdated && (now.getTime() - lastUpdated.getTime()) < CACHE_TTL_HOURS * 60 * 60 * 1000) {
      return { ...data, fromCache: true };
    }
  }

  try {
    // RE-CALCULATE EVERYTHING
    // Note: For very large datasets, use aggregation queries (count())
    const [usersSnap, businessSnap, receiptsSnap, productSnap] = await Promise.all([
      adminFirestore.collection('users').select('id').get(),
      adminFirestore.collection('businessInstances').get(),
      adminFirestore.collection('receipts').limit(RECEIPT_SCAN_CAP).get(),
      adminFirestore.collection('products').limit(PRODUCT_SCAN_CAP).get()
    ]);

    const users = usersSnap.docs;
    const businesses = businessSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const receipts = receiptsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const products = productSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    // Basic stats
    const totalGmv = receipts.reduce((sum: number, r: any) => sum + (r.total || 0), 0);
    const totalReceipts = receipts.length;
    
    // Platform stats
    const platformStatsDoc = await adminFirestore.collection('platform').doc('stats').get();
    const appInstalls = platformStatsDoc.exists ? platformStatsDoc.data()?.appInstalls || 0 : 0;

    const activatedBusinesses = businesses.filter((b: any) => {
        const hasProducts = products.some((p: any) => p.businessId === b.id);
        const hasReceipts = receipts.some((r: any) => r.businessId === b.id);
        return hasProducts && hasReceipts;
    }).length;

    // New Analytics Result Object
    const analyticsPayload = {
      platformGmv: totalGmv,
      totalReceipts,
      totalUsers: users.length,
      totalBusinesses: businesses.length,
      activatedBusinessesCount: activatedBusinesses,
      appInstalls,
      lastUpdated: now,
      fromCache: false
    };

    try {
      await cacheDocRef.set(analyticsPayload);
    } catch (e) {
      console.warn("Could not update analytics cache:", e);
    }

    // ── Peer benchmark for the business rating ────────────────────────────────
    // Free-riding on the scan above: the receipts and products are already in
    // memory, so this adds arithmetic and one document write, not reads. See
    // src/lib/rating-benchmark.ts for the cohort floors and what is published.
    //
    // Wrapped separately and never allowed to throw: this is a nice-to-have panel
    // row, and the admin overview and the public /api/platform-stats payload must
    // not fail because a median could not be worked out.
    try {
      const benchmark = computeRatingBenchmark({
        receipts,
        products,
        now,
        sampled: receipts.length >= RECEIPT_SCAN_CAP || products.length >= PRODUCT_SCAN_CAP,
      });
      if (benchmark) {
        // Plain nested object, and `set` with no dotted field paths — `set()` does
        // not parse dots as paths, which is how a previous rollup silently wrote a
        // field literally named "medians.overall" and read back nothing.
        await adminFirestore.collection(BENCHMARK_COLLECTION).doc(BENCHMARK_DOC_ID).set(benchmark);
      } else {
        // Too small a cohort to publish. The existing document is left standing
        // rather than cleared: blanking the panel for every shop because the scan
        // happened to catch a thin slice is the worse failure.
        console.warn(
          `Rating benchmark not published: fewer than ${BENCHMARK_MIN_COHORT} businesses qualified.`,
        );
      }
    } catch (e) {
      console.warn("Could not update rating benchmark:", e);
    }

    return analyticsPayload;

  } catch (error: any) {
    console.error("Heavy Analytics Calculation Error:", error);
    // If it fails, try to return the old cache as a fallback instead of 500
    if (cacheDoc?.exists) {
        return { ...cacheDoc.data(), fromCache: true, fallback: true };
    }
    throw error;
  }
}
