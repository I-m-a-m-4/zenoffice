import { adminFirestore } from '@/firebase/admin';

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
    const [usersSnap, businessSnap] = await Promise.all([
      adminFirestore.collection('users').select('id').get(),
      adminFirestore.collection('businessInstances').get()
    ]);

    const users = usersSnap.docs;
    const businesses = businessSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    // Platform stats
    const platformStatsDoc = await adminFirestore.collection('platform').doc('stats').get();
    const appInstalls = platformStatsDoc.exists ? platformStatsDoc.data()?.appInstalls || 0 : 0;

    const activatedBusinesses = businesses.length;

    // New Analytics Result Object
    const analyticsPayload = {
      platformGmv: 0,
      totalReceipts: 0,
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
