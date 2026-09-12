/**
 * Peer-benchmark pipeline — **not wired up. Nothing in the app calls this.**
 *
 * Two things already do the scoring this module was written for. Inventory
 * condition is scored on the Inventory page's Health tab
 * (`src/app/(app)/inventory/page.tsx`, availability / completeness / accuracy),
 * and sales performance is scored by `src/lib/business-rating.ts`. Both work off
 * rows the client already holds. What neither does — and what this module is the
 * unfinished half of — is compare a shop against *other* shops.
 *
 * Before it does anything it needs, at minimum:
 *
 * - a scheduler to call `runNightlyAggregation` then `runPercentileComputation`
 *   (it reads *all* of `businessInstances`, so it cannot run from a client);
 * - the four `track*` helpers called from the POS write paths — nothing writes
 *   `sale_completed_events`, `stock_adjusted_events`, `product_snapshot_events`
 *   or `reorder_point_events` today, so `calculateInventoryHealthScore` below
 *   would currently see every product as dead stock with no reorder point;
 * - `firestore.rules` entries for those four collections plus
 *   `store_health_snapshots` and `benchmark_percentiles`, none of which exist.
 *
 * Until then it must not be read from the UI. The Reports tab used to fetch
 * `store_health_snapshots` on every mount and, finding it empty, fabricate 400
 * competitors to fill the gap. `runPercentileComputation` already has the right
 * instinct — it refuses to publish percentiles below a 30-store sample.
 */

import {
  collection, 
  addDoc, 
  setDoc,
  getDocs, 
  query, 
  where, 
  doc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// ==========================================
// 1. Data Types & Event Tracking Interfaces
// ==========================================

export interface SaleCompletedEvent {
  storeId: string;
  productId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  timestamp: Date;
  category: string;
}

export interface StockAdjustedEvent {
  storeId: string;
  productId: string;
  delta: number;
  reason: 'sale' | 'restock' | 'manual_correction' | 'return';
  timestamp: Date;
}

export interface ProductSnapshotEvent {
  storeId: string;
  productId: string;
  imageUrl?: string;
  category?: string;
  sku?: string;
  description?: string;
  price?: number;
  timestamp: Date;
}

export interface ReorderPointSetEvent {
  storeId: string;
  productId: string;
  value: number;
  source: 'manual' | 'auto-suggested';
  timestamp: Date;
}

export interface StoreSegmentation {
  businessCategory: string; // grocery, boutique, electronics, pharmacy, etc.
  storeSizeTier: 'small' | 'medium' | 'large'; // by SKU count or revenue band
  country: string;
}

// Event Tracking Helpers (POS/Inventory source triggers)
export async function trackSaleCompleted(firestore: any, event: SaleCompletedEvent) {
  try {
    await addDoc(collection(firestore, 'sale_completed_events'), {
      ...event,
      timestamp: Timestamp.fromDate(event.timestamp)
    });
  } catch (err) {
    console.error('Error tracking sale_completed event:', err);
  }
}

export async function trackStockAdjusted(firestore: any, event: StockAdjustedEvent) {
  try {
    await addDoc(collection(firestore, 'stock_adjusted_events'), {
      ...event,
      timestamp: Timestamp.fromDate(event.timestamp)
    });
  } catch (err) {
    console.error('Error tracking stock_adjusted event:', err);
  }
}

export async function trackProductSnapshot(firestore: any, event: ProductSnapshotEvent) {
  try {
    await addDoc(collection(firestore, 'product_snapshot_events'), {
      ...event,
      timestamp: Timestamp.fromDate(event.timestamp)
    });
  } catch (err) {
    console.error('Error tracking product_snapshot event:', err);
  }
}

export async function trackReorderPointSet(firestore: any, event: ReorderPointSetEvent) {
  try {
    await addDoc(collection(firestore, 'reorder_point_events'), {
      ...event,
      timestamp: Timestamp.fromDate(event.timestamp)
    });
  } catch (err) {
    console.error('Error tracking reorder_point event:', err);
  }
}

// ==========================================
// 2. Score Calculation Engine
// ==========================================

export interface HealthPillarScores {
  availabilityScore: number;
  efficiencyScore: number;
  dataQualityScore: number;
  integrityScore: number;
  overallScore: number;
}

export function calculateInventoryHealthScore(
  products: any[],
  salesEvents: SaleCompletedEvent[],
  adjustments: StockAdjustedEvent[],
  reorderEvents: ReorderPointSetEvent[]
): HealthPillarScores {
  const totalProducts = products.length;
  if (totalProducts === 0) {
    return {
      availabilityScore: 100,
      efficiencyScore: 100,
      dataQualityScore: 100,
      integrityScore: 100,
      overallScore: 100
    };
  }

  // 1. Availability Score (35%)
  // - What % of active products have reorder points set
  // - Penalty for active products currently out-of-stock (stock <= 0)
  const productsWithReorder = new Set(reorderEvents.map(e => e.productId));
  const productsWithReorderCount = products.filter(p => productsWithReorder.has(p.id)).length;
  const reorderRatio = productsWithReorderCount / totalProducts;

  const outOfStockProducts = products.filter(p => (p.stock || 0) <= 0).length;
  const outOfStockRatio = outOfStockProducts / totalProducts;
  
  const availabilityScore = Math.max(0, Math.round((reorderRatio * 60 + (1 - outOfStockRatio) * 40)));

  // 2. Efficiency Score (25%)
  // - Dead stock ratio (% of products with 0 sales in 90 days)
  // - Inventory turnover score (sales velocity relative to stock on hand)
  const productsSold = new Set(salesEvents.map(e => e.productId));
  const deadStockCount = products.filter(p => !productsSold.has(p.id)).length;
  const deadStockRatio = deadStockCount / totalProducts;

  const totalQuantitySold = salesEvents.reduce((sum, e) => sum + e.quantity, 0);
  const totalStockOnHand = products.reduce((sum, p) => sum + Math.max(0, p.stock || 0), 0);
  const turnoverRatio = totalStockOnHand > 0 ? Math.min(1, totalQuantitySold / totalStockOnHand) : 0;

  const efficiencyScore = Math.max(0, Math.round(((1 - deadStockRatio) * 70 + turnoverRatio * 30)));

  // 3. Data Quality Score (25%)
  // - Check completeness of key product listing properties: imageUrl, category, SKU, description, price
  let totalDataFields = 0;
  let filledDataFields = 0;

  products.forEach(p => {
    totalDataFields += 5;
    if (p.imageUrl && p.imageUrl.trim() !== '') filledDataFields++;
    if (p.category && p.category.trim() !== '') filledDataFields++;
    if (p.sku && p.sku.trim() !== '') filledDataFields++;
    if (p.description && p.description.trim() !== '') filledDataFields++;
    if (p.price && p.price > 0) filledDataFields++;
  });

  const dataQualityScore = Math.round((filledDataFields / totalDataFields) * 100);

  // 4. Integrity Score (15%)
  // - Ratio of manual corrections vs. overall adjustments (restock, sale, return)
  // - High frequency of manual adjustments indicates log integrity failure
  const totalAdjustments = adjustments.length;
  const manualCorrections = adjustments.filter(a => a.reason === 'manual_correction').length;
  const discrepancyRate = totalAdjustments > 0 ? manualCorrections / totalAdjustments : 0;
  const integrityScore = Math.max(0, Math.round((1 - discrepancyRate) * 100));

  // Overall Score based on weights (Availability: 35%, Efficiency: 25%, Data Quality: 25%, Integrity: 15%)
  const overallScore = Math.round(
    availabilityScore * 0.35 +
    efficiencyScore * 0.25 +
    dataQualityScore * 0.25 +
    integrityScore * 0.15
  );

  return {
    availabilityScore,
    efficiencyScore,
    dataQualityScore,
    integrityScore,
    overallScore
  };
}

// ==========================================
// 3. Nightly Snapshot Aggregation Job
// ==========================================

export async function runNightlyAggregation(firestore: any, targetDateString: string) {
  try {
    // 1. Fetch all store/business documents
    const businessesSnap = await getDocs(collection(firestore, 'businessInstances'));
    const targetDate = new Date(targetDateString);

    for (const docObj of businessesSnap.docs) {
      const storeId = docObj.id;
      const businessData = docObj.data();

      // Extract segmentation fields (with default fallback values)
      const businessCategory = businessData.category || 'general_retail';
      const storeSizeTier = (businessData.skuCount || 0) > 500 ? 'large' : (businessData.skuCount || 0) > 100 ? 'medium' : 'small';
      const country = businessData.country || 'Nigeria';

      // 2. Fetch trailing 90 days events for this store
      const cutoffDate = new Date(targetDate.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Fetch Sales completed
      const salesQuery = query(
        collection(firestore, 'sale_completed_events'),
        where('storeId', '==', storeId),
        where('timestamp', '>=', Timestamp.fromDate(cutoffDate))
      );
      const salesSnap = await getDocs(salesQuery);
      const salesEvents = salesSnap.docs.map(d => {
        const data = d.data();
        return { ...data, timestamp: data.timestamp?.toDate() || new Date(data.timestamp) } as SaleCompletedEvent;
      });

      // Fetch Stock adjusted
      const adjQuery = query(
        collection(firestore, 'stock_adjusted_events'),
        where('storeId', '==', storeId),
        where('timestamp', '>=', Timestamp.fromDate(cutoffDate))
      );
      const adjSnap = await getDocs(adjQuery);
      const adjustments = adjSnap.docs.map(d => {
        const data = d.data();
        return { ...data, timestamp: data.timestamp?.toDate() || new Date(data.timestamp) } as StockAdjustedEvent;
      });

      // Fetch Reorder point events
      const reorderQuery = query(
        collection(firestore, 'reorder_point_events'),
        where('storeId', '==', storeId)
      );
      const reorderSnap = await getDocs(reorderQuery);
      const reorderEvents = reorderSnap.docs.map(d => {
        const data = d.data();
        return { ...data, timestamp: data.timestamp?.toDate() || new Date(data.timestamp) } as ReorderPointSetEvent;
      });

      // Fetch current active Products
      const productsQuery = query(
        collection(firestore, 'products'),
        where('businessId', '==', storeId)
      );
      const productsSnap = await getDocs(productsQuery);
      const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 3. Compute health scores
      const scores = calculateInventoryHealthScore(products, salesEvents, adjustments, reorderEvents);

      // 4. Log snapshot row
      const snapshotRef = doc(firestore, 'store_health_snapshots', `${storeId}_${targetDateString}`);
      await setDoc(snapshotRef, {
        storeId,
        date: targetDateString,
        ...scores,
        businessCategory,
        storeSizeTier,
        country,
        createdAt: serverTimestamp()
      });
    }

    console.log(`Successfully completed nightly aggregation for date: ${targetDateString}`);
  } catch (err) {
    console.error('Error running nightly aggregation job:', err);
    throw err;
  }
}

// ==========================================
// 4. Percentile Benchmarking Job
// ==========================================

export async function runPercentileComputation(firestore: any, targetDateString: string) {
  try {
    // 1. Fetch all store health snapshots computed on targetDateString
    const snapshotsQuery = query(
      collection(firestore, 'store_health_snapshots'),
      where('date', '==', targetDateString)
    );
    const snapshotsSnap = await getDocs(snapshotsQuery);
    const snapshots = snapshotsSnap.docs.map(d => d.data());

    // 2. Group snapshots by (businessCategory, storeSizeTier)
    const groupsMap = new Map<string, any[]>();
    snapshots.forEach(snap => {
      const key = `${snap.businessCategory}_${snap.storeSizeTier}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(snap);
    });

    // Helper to calculate percentiles (p50, p90)
    const getPercentileValue = (sortedArray: number[], percentile: number) => {
      if (sortedArray.length === 0) return 0;
      const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
      return sortedArray[Math.max(0, index)];
    };

    // 3. Process each group
    for (const [key, list] of Array.from(groupsMap.entries())) {
      const sampleSize = list.length;
      const [category, sizeTier] = key.split('_');

      // Guard: do not publish peer percentile comparison if peer count is below threshold of 30
      const benchmarkData = {
        segmentKey: key,
        businessCategory: category,
        storeSizeTier: sizeTier,
        date: targetDateString,
        sampleSize,
        createdAt: serverTimestamp(),
        pillars: {} as any
      };

      if (sampleSize >= 30) {
        const pillars = ['availabilityScore', 'efficiencyScore', 'dataQualityScore', 'integrityScore', 'overallScore'];
        
        pillars.forEach(pillar => {
          const values = list.map(item => item[pillar] || 0).sort((a, b) => a - b);
          benchmarkData.pillars[pillar] = {
            p50: getPercentileValue(values, 50),
            p90: getPercentileValue(values, 90)
          };
        });
      }

      // Write to benchmark_percentiles snapshot store
      const benchmarkRef = doc(firestore, 'benchmark_percentiles', `${key}_${targetDateString}`);
      await setDoc(benchmarkRef, benchmarkData);
    }

    console.log(`Successfully completed percentile computation for date: ${targetDateString}`);
  } catch (err) {
    console.error('Error running percentile computation job:', err);
    throw err;
  }
}
