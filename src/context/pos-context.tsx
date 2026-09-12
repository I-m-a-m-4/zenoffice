'use client';

import { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Customer, Product, CartItem, BusinessInstance, Receipt, UserProfile, OnlineOrder, QueuedAction, BusinessStats, AuditLog, HeldSale } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { getAuth } from 'firebase/auth';
import { collection, doc, query, where, orderBy, limit, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, increment, getDoc, getDocFromServer, setDoc, getDocs, startAfter, getAggregateFromServer, count, sum, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { logAuditEvent } from '@/lib/audit';
import { secureStorage } from '@/lib/secure-storage';
import { idb } from '@/lib/idb';
import {   syncProductsToOffline, 
  syncProductToOffline,
  deleteMultipleProductsFromOffline,
  getCachedProductsResult,
  getCachedCustomers,
  getCachedCustomersResult,
  syncCustomersToOffline,
  syncReceiptsToOffline,
  getCachedReceipts,
  getCachedBusiness,
  syncBusinessToOffline,
  syncStatsToOffline,
  getCachedStats,
  getLastSyncMetadata, 
  setLastSyncMetadata,
  saveActionToOfflineQueue,
  getOfflineQueue,
  removeActionFromOfflineQueue,
  getMonthlyRevenue,
  clearAllTables,
  deleteReceiptFromOffline,
  syncProfileToOffline,
  getCachedProfile,
  syncUsersToOffline,
  getCachedUsers,
  syncAuditLogsToOffline,
  getCachedAuditLogs,
  offlineDbUsable
} from '@/lib/sqlite-sync';
import { isNativeApp, isMobileApp } from '@/lib/platform';
import { reportAnomaly } from '@/lib/error-logger';
import {
  classifyProductSyncFailure,
  describeRefusal,
  isServerRefusal,
  PRODUCT_SYNC_RETRY_POLICY,
  type ProductSyncErrorKind,
  type RefusalProbe,
} from '@/lib/product-catalog-state';
import {
  normalizeName,
  normalizePhone,
  normalizeCode,
  realEmail,
  type CustomerDuplicateMatch,
} from '@/lib/customer-health';

import { 
  POS_CART_KEY, 
  POS_CUSTOMER_KEY, 
  POS_TAX_RATE_KEY, 
  POS_DISCOUNT_KEY, 
  POS_PAYMENT_METHOD_KEY, 
  POS_AUTO_PRINT_KEY, 
  CURRENCY_SYMBOLS,
  USER_PROFILE_KEY,
  BUSINESS_INSTANCE_KEY,
  POS_HELD_SALES_KEY
} from '@/lib/constants';
import { safeToDate } from '@/lib/utils';
import { isSubscriptionActive as resolveSubscriptionActive } from '@/lib/plan';
import { trackFeature } from '@/lib/product-telemetry';
import { useBranch } from './branch-context';

/*
 * ── Whose data is in the local cache? ──────────────────────────────────────
 *
 * `pos_synced_products` and friends are **single, global keys** — they carry no
 * businessId, unlike the SQLite mirror which is keyed by one throughout. That is
 * fine for the ordinary case, where a device only ever holds one business, and
 * it is why a super-admin impersonating a tenant used to see the *previous*
 * business's products, customers and receipts: the state initialisers below read
 * those blobs synchronously at first render, long before anyone knows which
 * business is now in scope, and the backfills are deliberately gated on "the
 * cache is empty" to save Firestore reads — so a populated-but-wrong cache is
 * never corrected, it is trusted.
 *
 * Rather than rename the keys (which would orphan every existing install and
 * trigger a full re-sync for all of them), the owner is recorded alongside and
 * checked. Two rules:
 *
 *   - A marker that disagrees with the current business means the cache is
 *     someone else's: do not adopt it, and clear it.
 *   - **A missing marker means a legacy install**, not a mismatch. Those are
 *     adopted once and stamped, so nobody pays a re-sync for this change.
 */
const CACHE_OWNER_KEY = 'pos_cache_owner_business_id';

/** Global-key caches that are only ever valid for one business at a time. */
const OWNED_CACHE_KEYS = [
  'pos_synced_products',
  'pos_synced_customers',
  'pos_synced_receipts',
  'pos_synced_users',
  'pos_synced_audit_logs',
  'pos_offline_stats',
  BUSINESS_INSTANCE_KEY,
];

/**
 * Products fetched when a super-admin is impersonating rather than trading.
 *
 * A full catalogue sync exists so a shop can sell offline. An admin looking at
 * someone else's account is not going to sell anything, so paging through a
 * 12,000-product catalogue spends the owner's Firestore budget on nothing. A
 * slice is enough to see that inventory is present and healthy.
 *
 * Everything else — customers, receipts, users, audit log, stats, settings —
 * still syncs in full: those are what an admin is usually there to look at, they
 * are far smaller, and a truncated receipt history would make the reports and the
 * loss-prevention scan silently wrong.
 */
const IMPERSONATION_PRODUCT_CAP = 500;

/** Is this page load happening inside an impersonation session? */
function isImpersonationBoot(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!sessionStorage.getItem('zeneva_impersonated_user_id');
  } catch {
    return false;
  }
}

/**
 * Seed a state initialiser from the local cache, unless we are booting into an
 * impersonation session.
 *
 * While impersonating, the impersonated business's id is not knowable
 * synchronously — sessionStorage holds a *user* id — so there is nothing to
 * validate the blob against at this point. Seeding empty costs the admin a
 * moment of skeleton and is the only way to guarantee they are never shown
 * another tenant's figures. Outside impersonation this behaves exactly as before.
 */
function bootCache<T>(key: string): T | null {
  if (isImpersonationBoot()) return null;
  return secureStorage.getItem<T>(key);
}

/** Drop every global-key cache blob, on both storage backends. */
function purgeOwnedCaches() {
  for (const key of OWNED_CACHE_KEYS) {
    secureStorage.removeItem(key);
    idb.remove(key).catch(() => {});
  }
}

interface POSContextType {
  business: BusinessInstance | null;
  products: Product[] | null;
  receipts: Receipt[] | null;
  customers: Customer[] | null;
  onlineOrders: OnlineOrder[] | null;
  stats: BusinessStats | null;
  searchCustomers: (term: string) => Promise<Customer[]>;
  searchCustomersByField: (field: string, value: string) => Promise<Customer[]>;
  /**
   * Every customer in the business, before the active branch filters any out.
   *
   * The integrity check on the customers page needs this and cannot use
   * `customers`. Branch filtering drops a customer with no `branchId` from every
   * specific branch's view — which is precisely the defect the "no branch" check
   * reports, so running it on the filtered list finds nothing, every time. Two
   * duplicate records sitting in different branches are also still one duplicated
   * person, and merging them is still the right fix.
   *
   * `null` while the list is still coming, exactly as `customers` is.
   */
  allCustomersUnfiltered: Customer[] | null;
  /**
   * Ask the server whether this person is already on file, before creating them.
   *
   * The local array can be stale — there is no realtime listener on customers —
   * so a purely local check is exactly what let two tills each create their own
   * copy of the same walk-in. This asks Firestore.
   */
  findExistingCustomer: (candidate: {
    name?: string;
    phone?: string;
    email?: string;
    code?: string;
  }) => Promise<CustomerDuplicateMatch[]>;
  searchReceipts: (term: string) => Promise<Receipt[]>;
  fetchReceiptsInRange: (from: Date, to: Date, limitCount?: number) => Promise<Receipt[]>;
  searchProducts: (term: string) => Promise<Product[]>;
  searchProductsByField: (field: string, value: string) => Promise<Product[]>;
  findProductBySku: (sku: string) => Promise<Product | null>;
  fetchDetailedAnalytics: (from: Date, to: Date) => Promise<{ revenue: number, count: number, customers: number }>;
  fetchMonthlyAnalytics: (months: number) => Promise<{ month: string, revenue: number, count: number }[]>;
  fetchMoreReceipts: () => Promise<number>;
  fetchMoreCustomers: () => Promise<number>;
  fetchMoreProducts: () => Promise<number>;
  currentUserProfile: UserProfile | null;
  isLoading: boolean;
  isUserLoading: boolean;
  user: any;
  cart: CartItem[];
  addToCart: (product: Product, unitName?: string, multiplier?: number, priceOverride?: number, selectedSerialNumber?: string) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateCartItemPrice: (cartItemId: string, newPrice?: number, newCostPrice?: number) => void;
  clearCart: () => void;
  selectedCustomer: Customer | null;
  selectCustomer: (customer: Customer | null) => void;
  subtotal: number;
  tax: number;
  taxRate: number;
  discount: number;
  total: number;
  setTax: (taxRate: number) => void;
  setDiscount: (discountAmount: number) => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  amountReceived: number;
  setAmountReceived: (amount: number) => void;
  autoPrint: boolean;
  setAutoPrint: (autoPrint: boolean) => void;
  resetPOS: () => void;
  currencySymbol: string;
  currencyCode: string;
  triggerRefresh: () => void;
  isConfettiActive: boolean;
  triggerConfetti: () => void;
  setIsConfettiActive: (active: boolean) => void;
  queuedActions: QueuedAction[];
  isQueueProcessing: boolean;
  addToQueue: (action: Omit<QueuedAction, 'id' | 'timestamp' | 'status' | 'description'>, description: string) => string | null;
  mutateBusiness: (data?: any) => Promise<any> | void;
  isSyncing: boolean;
  isFullSyncingCustomers: boolean;
  isFullSyncingProducts: boolean;
  isFullSyncingReceipts: boolean;
  /**
   * True while the product catalogue is still arriving and there is nothing to
   * show yet. Surfaces that list products must hold their loading skeleton on
   * this — `products.length === 0` cannot tell an empty shop from a catalogue
   * that has not loaded, which is how the POS came to show "No products found"
   * to shops with a full catalogue.
   */
  isProductCatalogPending: boolean;
  /**
   * Why the catalogue is unavailable, when it is unavailable for a reason other
   * than the shop being empty. `'access'` — the server refused to release the
   * catalogue to this device; `'cache'` — the local mirror could not be read;
   * `'network'` — the sync could not reach the server and its retries are spent.
   *
   * There is deliberately no `'permission'` member any more. The rules gate the
   * product list on tenancy alone, so a refusal never establishes that this
   * account lacks a permission — and the app told people it did. See
   * `src/lib/product-catalog-state.ts`.
   */
  productSyncError: ProductSyncErrorKind | null;
  /**
   * True when there are no products *and* the emptiness cannot be trusted —
   * either a sync failure was recorded, or the device is offline with nothing
   * cached, where an empty shop and a catalogue that never arrived are
   * indistinguishable. Surfaces must show a reason and a Retry on this rather
   * than an empty-shop state; `productSyncError` says which reason.
   */
  isCatalogUnverified: boolean;
  /** Re-runs the full product sync from a failed state. */
  retryProductSync: () => void;
  processQueue: () => Promise<void>;
  clearFailedActions: () => void;
  optimisticProducts: Product[];
  updateQueuedAction: (id: string, updates: Partial<QueuedAction>) => void;
  addProductWithImage: (productData: any, imageFile: File | null) => Promise<void>;
  removeFromQueue: (id: string) => void;
  impersonatedUserId: string | null;
  impersonateUser: (userId: string) => void;
  stopImpersonation: () => void;
  isImpersonating: boolean;
  isSubscriptionActive: boolean;
  firestore: any;
  heldSales: HeldSale[];
  holdCurrentSale: (notes?: string) => void;
  resumeHeldSale: (heldSaleId: string) => void;
  deleteHeldSale: (heldSaleId: string) => void;
  voidReceipt: (receiptId: string) => Promise<void>;
  users: UserProfile[];
  auditLogs: AuditLog[];
  isOnline: boolean;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

/**
 * How many of the newest online orders the context's real-time listener holds.
 *
 * The consumers only ever look at a slice: the layout's new-order alert wants
 * the latest pending order, the dashboard sums the range it has selected, and
 * the online-orders page runs its own query for the table. Pulling the entire
 * subcollection on every attach re-billed the store's whole order history each
 * time the listener (re)connected; keeping the newest 200 keeps any realistically
 * open order visible while capping the read.
 */
const ONLINE_ORDERS_LISTENER_LIMIT = 200;

/*
 * A failed product sync leaves the POS with nothing to sell, and there is no
 * realtime listener to fill the gap, so it retries instead of waiting out the
 * 24-hour window. Bounded, because the usual cause of a *repeated* failure is
 * not something a fourth attempt fixes, and each attempt is billed reads.
 *
 * The ladder is per failure kind and lives in
 * `PRODUCT_SYNC_RETRY_POLICY` — a refusal gets a shorter one than a dropped
 * connection, for the reason given there.
 */

/*
 * How often connectivity is probed while the OS insists there is no network.
 *
 * `verifyConnectivity` no longer takes `navigator.onLine === false` as final in
 * the native shells (see the comment there), so the probes have to run even when
 * the OS says not to bother. This keeps that from costing a genuinely offline
 * phone three 8.5-second timeouts every 16 seconds all day.
 */
const OFFLINE_PROBE_INTERVAL_MS = 60_000;

/**
 * How often the delta sync re-runs while the app is in the foreground.
 *
 * Before this existed, the delta sync ran **once per online session**, 2 seconds
 * after mount, and nothing ever ran it again — there is no realtime listener on
 * products or customers (`customersQuery` is deliberately `null` to save reads)
 * and the full sync is gated to once per 24 hours. So a till that had been open
 * since morning had no mechanism at all to learn about a customer another till
 * created at 10am. Staff reported exactly that: a colleague adds a customer, the
 * second device cannot find them, so it creates its own copy, and the shop ends
 * up with two records for one person. The duplicate was the symptom; the missing
 * poll was the cause.
 *
 * The cost, stated plainly because the comment on `lastSyncedTimestampRef`
 * documents a loop that billed reads all day. Firestore charges a minimum of one
 * document read per query even when nothing matches, and a pass is three
 * queries, so an idle foreground device costs 3 reads per interval:
 *
 *   60s interval  →  180 reads/hour  →  ~1,800 over a 10-hour trading day
 *
 * Three tills is ~5,400 reads/day against a 50,000/day free allowance — about
 * 11% — and that is the whole bill when nothing changes. It buys a shop that
 * stops inventing duplicate customers, which is worth more than the reads.
 *
 * Two things keep it honest. It is skipped entirely when the document is hidden,
 * so a backgrounded tab or a phone in a pocket costs nothing; and every trigger
 * goes through `DELTA_MIN_GAP_MS`, so the burst of visibility/focus/online
 * events that a single alt-tab produces cannot turn into three passes.
 */
const DELTA_POLL_MS = 60_000;

/**
 * Floor between two delta syncs, whatever asked for one.
 *
 * Alt-tabbing back to the app fires `visibilitychange` and `focus` together, and
 * reconnecting fires `online` alongside both. Without a floor that is three
 * passes — nine queries — for one user action.
 */
const DELTA_MIN_GAP_MS = 20_000;

/**
 * How far the delta window is rewound past the last successful sync.
 *
 * Guards against clock skew between this device and Firestore's servers — see
 * the long comment at the `lastCheck` computation in `refreshData`. Two minutes
 * is generous for the drift a consumer device actually shows while staying small
 * enough that the re-read is a handful of documents, not a page.
 */
const DELTA_OVERLAP_MS = 120_000;

/*
 * ── What to say when the server refuses a queued write ─────────────────────
 *
 * The old copy printed the raw Firestore message — "Server rejected: ... Reason:
 * Missing or insufficient permissions." — which tells a shopkeeper nothing about
 * what state their shop is now in. That matters most for a delete: the product is
 * still there, and the previous behaviour had already removed it from the screen,
 * so the toast was the only clue and it did not say so.
 *
 * These say what did *not* happen, in the shop's terms. English to match the
 * other hardcoded toasts in this file; the error code is appended by the caller
 * so a support conversation has something to grep for.
 */
function rejectionTitle(actionType: string): string {
  switch (actionType) {
    case 'delete-product': return 'Product not deleted';
    case 'add-product': return 'Product not saved';
    case 'update-product':
    case 'bulk-update-products': return 'Changes not saved';
    case 'add-customer': return 'Customer not saved';
    case 'update-customer': return 'Customer not updated';
    case 'delete-customer': return 'Customer not deleted';
    case 'delete-receipt': return 'Sale not voided';
    default: return 'Action not completed';
  }
}

function rejectionBody(actionType: string): string {
  switch (actionType) {
    case 'delete-product': return 'The server would not accept this deletion, so the product is still in your inventory.';
    case 'add-product': return 'The server would not accept this product, so it has not been added.';
    case 'update-product':
    case 'bulk-update-products': return 'The server would not accept these changes, so the product is unchanged.';
    case 'add-customer': return 'The server would not accept this customer, so they have not been added.';
    case 'update-customer': return 'The server would not accept these changes, so the customer is unchanged.';
    case 'delete-customer': return 'The server would not accept this deletion, so the customer is still on file.';
    case 'delete-receipt': return 'The server would not accept this void, so the sale still stands.';
    default: return 'The server would not accept this action, so nothing was changed.';
  }
}

export function POSProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [refreshKey, setRefreshKey] = useState(0);
  const { activeBranchId } = useBranch();

  // --- States ---
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(() => (typeof window !== 'undefined' ? sessionStorage.getItem('zeneva_impersonated_user_id') : null));
  const isImpersonating = !!impersonatedUserId;
  const effectiveUserId = impersonatedUserId || user?.uid;

  const [isMounted, setIsMounted] = useState(false);
  const [isConfettiActive, setIsConfettiActive] = useState(false);
  const hasShownSyncToast = useRef(false);
  const hasHydratedRef = useRef(false);
  /**
   * True once the local cache reads have settled, whatever they returned.
   *
   * hasHydratedRef flips synchronously at the top of the hydration effect, so it
   * says "hydration started", not "finished". Anything that has to distinguish a
   * genuinely empty cache from one that simply has not loaded yet - the receipt
   * backfill below - needs this instead.
   */
  const [isCacheHydrated, setIsCacheHydrated] = useState(false);
  /** refreshKey value the receipt backfill last ran for; -1 means never. */
  const lastReceiptBackfillKeyRef = useRef(-1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFullSyncingCustomers, setIsFullSyncingCustomers] = useState(false);
  const [isFullSyncingProducts, setIsFullSyncingProducts] = useState(false);
  const [isFullSyncingReceipts, setIsFullSyncingReceipts] = useState(false);
  const [hasFullSyncedProducts, setHasFullSyncedProducts] = useState(false);
  const [hasFullSyncedReceipts, setHasFullSyncedReceipts] = useState(false);
  const [hasFullSyncedCustomers, setHasFullSyncedCustomers] = useState(false);
  /**
   * Why the catalogue is empty, when it is empty for a reason other than the
   * shop having no products.
   *
   * There is no realtime products listener (see `productsQuery` below), so the
   * catalogue exists only if `fetchFullProducts` succeeded or the local mirror
   * held it. When neither is true the POS must say so and offer a retry — the
   * screen it used to show was "No products found", which reads as an empty shop
   * and sent owners looking for a category filter that was never set.
   */
  const [productSyncError, setProductSyncError] = useState<ProductSyncErrorKind | null>(null);
  /**
   * The server has been asked for this business's catalogue and answered "none".
   *
   * This is the only thing that can turn "there are no products" from a guess
   * into a fact, and without it every later doubt — going offline, a failed
   * retry — reopened the question and put "Couldn't load your products" in front
   * of a shop that genuinely has none. A brand-new shop is the common case in
   * this app, so that mattered more than the edge it was protecting.
   *
   * Session-scoped and never persisted, on purpose. A stamp for this would be one
   * more claim that outlives what it certifies (see `full_products_sync`), and
   * "we asked the server this session and it said zero" is a claim that cannot
   * rot. It is cleared when `businessId` changes so an impersonation peek or a
   * tenant switch cannot carry it across.
   */
  const [catalogConfirmedEmpty, setCatalogConfirmedEmpty] = useState(false);
  /**
   * True between a failed sync and its scheduled retry. It is state, not a ref,
   * because the POS holds its loading skeleton on it — a retry that is about to
   * happen is still "loading", and the whole point of this is that the grid must
   * not fall through to an empty state while the catalogue is still coming.
   */
  const [isProductRetryScheduled, setIsProductRetryScheduled] = useState(false);
  /** Counts consecutive failed full-product syncs; drives the bounded retry. */
  const productSyncAttemptsRef = useRef(0);
  const productRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Holds the latest `fetchFullProducts` so the retry can re-enter it. */
  const fetchFullProductsRef = useRef<((options?: { force?: boolean }) => Promise<void>) | null>(null);
  /** Set once per session when a forced re-sync has already been spent on a stamp/store disagreement. */
  const forcedProductResyncRef = useRef(false);
  /**
   * The synced catalogue as of the last render, for code that must read it
   * synchronously rather than through a state updater.
   *
   * `fetchFullProducts`'s deletion reconciliation needs the local id set at the
   * moment it computes the purge, and it cannot get that from inside a
   * `setSyncedProducts` updater: an updater runs during the render phase, not at
   * call time, so anything it collects is still empty on the next line. It also
   * cannot close over `syncedProducts` directly — that callback deliberately does
   * not list it as a dependency, so the value would be from whenever the callback
   * was last built.
   */
  const syncedProductsRef = useRef<Product[]>([]);
  /**
   * One server-side profile read per session is enough to diagnose a refusal, and
   * the retry ladder would otherwise pay for it on every attempt.
   */
  const refusalProbedRef = useRef(false);
  const [extraStats, setExtraStats] = useState({ totalProducts: 0, totalStockValue: 0, lowStockCount: 0 });

  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>(() => secureStorage.getItem<QueuedAction[]>('pos_queued_actions') || []);
  const queuedActionsRef = useRef<QueuedAction[]>(queuedActions);
  /**
   * Queue-durability bookkeeping. See the two `pos_queued_actions` effects below.
   *
   * `queueMirrorReadRef` latches the one-shot fallback read; `queueMirrorChecked`
   * is what gates the persistence effect from touching the fallback key before
   * that read has happened; `queueFallbackActiveRef` remembers that a fallback
   * copy is currently on disk, so it is removed exactly once — when localStorage
   * starts accepting the queue again — rather than on every queue change.
   */
  const queueMirrorReadRef = useRef(false);
  const queueFallbackActiveRef = useRef(false);
  const [queueMirrorChecked, setQueueMirrorChecked] = useState(false);
  const [isQueueProcessing, setIsQueueProcessing] = useState(false);
  const [syncedProducts, setSyncedProducts] = useState<Product[]>(() => bootCache<Product[]>('pos_synced_products') || []);
  const [syncedCustomers, setSyncedCustomers] = useState<Customer[]>(() => bootCache<Customer[]>('pos_synced_customers') || []);
  const [syncedReceipts, setSyncedReceipts] = useState<Receipt[]>(() => bootCache<Receipt[]>('pos_synced_receipts') || []);
  const [syncedUsers, setSyncedUsers] = useState<UserProfile[]>(() => bootCache<UserProfile[]>('pos_synced_users') || []);
  const [syncedAuditLogs, setSyncedAuditLogs] = useState<AuditLog[]>(() => bootCache<AuditLog[]>('pos_synced_audit_logs') || []);
  const [offlineProfile, setOfflineProfile] = useState<UserProfile | null>(() => secureStorage.getItem<UserProfile>(USER_PROFILE_KEY));
  const [offlineBusiness, setOfflineBusiness] = useState<BusinessInstance | null>(() => bootCache<BusinessInstance>(BUSINESS_INSTANCE_KEY));
  const [offlineStats, setOfflineStats] = useState<BusinessStats | null>(() => bootCache<BusinessStats>('pos_offline_stats'));
  const [lastSyncedTimestamp, setLastSyncedTimestamp] = useState<number>(() => {
    const stored = secureStorage.getItem<number>('pos_last_synced_timestamp');
    // If no previous sync, default to 24 hours ago to catch recent changes on first load
    return stored || (Date.now() - 24 * 60 * 60 * 1000);
  });

  /**
   * Delta-sync bookkeeping, held in refs rather than read out of state.
   *
   * `refreshData` used to list `lastSyncedTimestamp` in its dependency array
   * while also calling `setLastSyncedTimestamp` on every successful pass. That
   * handed the callback a fresh identity after each sync — and the "Initial
   * Delta Sync" effect further down lists `refreshData` as a dependency, so it
   * tore down, re-armed its 2s timer and synced again. Forever, for as long as
   * the app stayed open.
   *
   * The old `isSyncing` guard could not stop it, because the silent path skips
   * `setIsSyncing` entirely (both calls are behind `if (!silent)`), so the flag
   * never became true on the path that was looping. `syncInFlightRef` is set on
   * both paths and is what actually prevents overlapping runs.
   *
   * This mattered financially: Firestore bills a minimum of one document read
   * per query even when the query matches nothing, so three delta queries every
   * ~2.5s charged reads all day on a session that was doing nothing at all.
   */
  const lastSyncedTimestampRef = useRef(lastSyncedTimestamp);
  const syncInFlightRef = useRef(false);

  /*
   * When a delta sync was last *attempted*, as opposed to last succeeded.
   *
   * `lastSyncedTimestampRef` above only advances on success — it is the delta
   * window boundary, and moving it after a failed pass would skip whatever
   * changed while the pass was failing. So it cannot double as the throttle for
   * the foreground poll: a failing sync would leave the ref stale and every
   * trigger would be let through, hammering a Firestore that is already
   * refusing. This one advances on every attempt.
   */
  const lastDeltaAttemptRef = useRef(0);

  /*
   * The live `refreshData` and `isRealOnline`, reachable from an effect that
   * must not list them as dependencies — see the loop described above. The
   * foreground poll re-arms a `setInterval`, so a changing dependency there
   * costs a torn-down interval per render rather than one extra query.
   */
  const refreshDataRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);
  const isRealOnlineRef = useRef(true);

  // 🌐 INTELLIGENT CONNECTIVITY ENGINE
  // navigator.onLine can give false positives (e.g. connected to a WiFi hotspot with no cellular data)
  // We solve this by performing a direct lightweight WAN ping in the background to guarantee REAL internet!
  const [isRealOnline, setIsRealOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') return navigator.onLine;
    return true;
  });

  const consecutiveFailuresRef = useRef<number>(0);
  /** When the probes last ran while the OS claimed there was no network. */
  const lastOfflineProbeRef = useRef<number>(0);

  /**
   * Resolves whether there is really a network.
   *
   * `options.force` is for an explicit user action ("Try again"): it bypasses both
   * the web-only OS veto and the slow-cadence throttle below, because somebody
   * pressing a retry button is asking for a probe *now* and would otherwise be
   * handed a cached "no" — which is the dead button this was meant to fix.
   */
  const verifyConnectivity = useCallback(async (options?: { force?: boolean }) => {
    if (typeof window === 'undefined') return;

    /*
     * 1. The OS connectivity flag is a hint here, not a verdict.
     *
     * This used to force `consecutiveFailuresRef` to the ceiling, declare the app
     * offline and return *before running any of the probes below*. In a browser
     * that is correct and saves three pointless requests. In the Tauri shells it
     * is the bug that emptied paying users' tills: WebView2 and Android WebView
     * derive this flag from OS connectivity state and report `false` on a machine
     * whose Firestore listeners are streaming happily — business doc loaded,
     * notifications arriving, top bar saying OFFLINE. And because the probes were
     * skipped there was nothing left that could ever flip it back, so it was a
     * permanent pin rather than a transient state: `fetchFullProducts` declines
     * to run (it requires `isRealOnline`), the SQLite mirror stays empty, and
     * every surface that lists products reports an empty shop.
     *
     * So a native shell distrusts the flag and lets the three-endpoint race below
     * decide. On the web it keeps its authority — the value is reliable there.
     */
    const osSaysOffline = !navigator.onLine;
    if (osSaysOffline && !isNativeApp() && !options?.force) {
      consecutiveFailuresRef.current = 2; // Force threshold ceiling
      setIsRealOnline(false);
      return false;
    }

    /*
     * Cost control for what the veto used to cover for free: probe on a slower
     * cadence while the OS claims there is no network, rather than not at all.
     */
    if (osSaysOffline && !options?.force) {
      if (Date.now() - lastOfflineProbeRef.current < OFFLINE_PROBE_INTERVAL_MS) return false;
      lastOfflineProbeRef.current = Date.now();
    }

    // Channel 1: Micro-fetch sensor (Routed through whitelisted CSP endpoint)
    const checkFetch = async (): Promise<boolean> => {
      try {
        const controller = new AbortController();
        // INCREASE TIMEOUT WINDOW TO 8.5 SECONDS TO ACCOMMODATE WEAK/SLUGGISH CELLULAR LINKS
        const id = setTimeout(() => controller.abort(), 8500);
        await fetch("https://fonts.googleapis.com/css2?family=Inter", {
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        });

        clearTimeout(id);
        return true;
      } catch {
        return false;
      }
    };

    // Channel 2 & 3: Browser-native Image Beaconing (bypasses ALL CORS/CORB/CSP limitations)
    const checkImage = (url: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => {
          img.onload = null;
          img.onerror = null;
          img.src = "";
          resolve(false);
        }, 8500); // Expanded timeout to 8.5s
        
        img.onload = () => {
          clearTimeout(timer);
          resolve(true);
        };
        img.onerror = () => {
          clearTimeout(timer);
          resolve(false);
        };
        // Force bypass local cache with timestamp query
        img.src = `${url}?cacheBust=${Date.now()}`;
      });
    };

    // Define multiple disparate endpoints to bypass any regional or provider blocks
    const tasks = [
      checkFetch(),
      checkImage("https://www.google.com/favicon.ico"),
      checkImage("https://www.cloudflare.com/favicon.ico")
    ];

    // Custom Race: Resolve to TRUE immediately on the FIRST successful probe.
    let finishedCount = 0;
    const hasConnection = await new Promise<boolean>((resolve) => {
      let resolved = false;
      tasks.forEach(task => {
        task.then(isSuccessful => {
          if (resolved) return;
          if (isSuccessful) {
            resolved = true;
            resolve(true);
          } else {
            finishedCount++;
            if (finishedCount === tasks.length) {
              resolved = true;
              resolve(false);
            }
          }
        });
      });
    });

    if (hasConnection) {
      /*
       * The OS said there was no network and the network disagreed. Worth exactly
       * one document: this is the condition that stopped the shells syncing, it
       * throws nothing so no crash log would ever carry it, and `reportAnomaly`
       * already throttles to one per code per device per day. `userId` and
       * `businessId` are deliberately omitted so this callback can keep empty
       * deps — re-creating it would tear down and re-arm the probe interval.
       */
      if (osSaysOffline) {
        reportAnomaly(
          'false_offline_signal',
          'navigator.onLine reported no network but a live WAN probe succeeded, so connectivity was resolved from the probes instead. The OS flag is unreliable in this shell; obeying it would have blocked the product sync and shown the shop an empty catalogue.',
          { details: { platform: isNativeApp() ? 'native' : 'web', userAgent: navigator.userAgent } }
        );
      }
      // SUCCESS: Instantly restore connection and reset fails!
      consecutiveFailuresRef.current = 0;
      setIsRealOnline(true);
    } else {
      // PROBE FAILURE: Log it, but BUFFER the decision!
      consecutiveFailuresRef.current += 1;

      /*
       * Two signals agreeing needs no buffering.
       *
       * The 2-strike buffer exists for the *opposite* case — the OS reports a
       * network but a probe failed — which is where flicker on weak or
       * high-latency links comes from. When the OS and all three probes agree
       * there is nothing there, waiting for a second run just delays the truth:
       * because the probes now run on the slow cadence while the OS says offline,
       * buffering here would have left up to a minute between a real disconnect
       * and the app noticing. This cannot re-create the old pin — a single
       * successful probe still flips straight back to online above.
       */
      if (osSaysOffline || consecutiveFailuresRef.current >= 2) {
        setIsRealOnline(false);
      }
    }
    
    return hasConnection;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleOnlineEvent = () => {
      // Wait 500ms to allow interface initialization, then execute WAN ping
      setTimeout(verifyConnectivity, 500);
    };
    const handleOfflineEvent = () => {
      /*
       * Same distrust as in `verifyConnectivity`: in a native shell this event is
       * raised from the same unreliable OS signal, so re-verify instead of taking
       * its word. Setting the flag directly here would re-pin the app offline the
       * moment the probes had cleared it, which is the loop that made the bug
       * survive every relaunch.
       */
      if (isNativeApp()) {
        verifyConnectivity();
        return;
      }
      setIsRealOnline(false);
    };

    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);
    
    // Periodic background check every 16 seconds to balance cellular data usage and responsiveness
    const interval = setInterval(verifyConnectivity, 16000);
    
    // Perform verification on component load
    verifyConnectivity();

    return () => {
      window.removeEventListener('online', handleOnlineEvent);
      window.removeEventListener('offline', handleOfflineEvent);
      clearInterval(interval);
    };
  }, [verifyConnectivity]);

  // --- POS Local States ---
  const [cart, setCart] = useState<CartItem[]>(() => secureStorage.getItem<CartItem[]>(POS_CART_KEY) || []);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() => secureStorage.getItem<Customer>(POS_CUSTOMER_KEY));
  const [taxRate, setTaxRate] = useState<number>(() => secureStorage.getItem<number>(POS_TAX_RATE_KEY) || 0);
  const [discount, setDiscount] = useState<number>(() => secureStorage.getItem<number>(POS_DISCOUNT_KEY) || 0);
  const [paymentMethod, setPaymentMethod] = useState<string>(() => secureStorage.getItem<string>(POS_PAYMENT_METHOD_KEY) || 'Cash');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [autoPrint, setAutoPrint] = useState<boolean>(() => {
    const s = secureStorage.getItem<boolean>(POS_AUTO_PRINT_KEY);
    return s === null ? true : s;
  });
  const [heldSales, setHeldSales] = useState<HeldSale[]>(() => secureStorage.getItem<HeldSale[]>(POS_HELD_SALES_KEY) || []);
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  const [isSubscriptionActiveFromRust, setIsSubscriptionActiveFromRust] = useState(true);

  // --- Firebase Queries ---
  const userDocRef = useMemoFirebase(() => (user && effectiveUserId && (!isUserLoading || isImpersonating) ? doc(firestore, 'users', effectiveUserId) : null), [user, effectiveUserId, isUserLoading, isImpersonating, firestore, refreshKey]);
  const { data: currentUserProfile } = useDoc<UserProfile>(userDocRef);
  const isProfileReady = !!(user && currentUserProfile && (currentUserProfile.id === user.uid || currentUserProfile.id === impersonatedUserId));
  /*
   * The offline profile is only a valid fallback for the person who actually
   * signed in.
   *
   * `offlineProfile` is the cached profile of the *logged-in* account, so while
   * impersonating it names the admin's own business. Letting it supply the
   * businessId meant that reloading the page mid-impersonation resolved to the
   * admin's business for the first few hundred milliseconds — long enough for the
   * hydration effect to latch (`hasHydratedRef` never unsets on its own) and load
   * the admin's own products, which then stayed on screen after the impersonated
   * profile arrived. Holding at null instead makes hydration wait: the effect
   * returns early on a null businessId *before* setting that ref, so it re-runs
   * once the impersonated profile lands.
   */
  const businessId = isProfileReady
    ? currentUserProfile.businessId
    : (isImpersonating ? null : (offlineProfile?.businessId || null));

  const businessDocRef = useMemoFirebase(() => (user && businessId ? doc(firestore, 'businessInstances', businessId) : null), [user, businessId, firestore]);
  const { data: initialBusiness, isLoading: isLoadingBusiness, mutate: mutateBusiness } = useDoc<BusinessInstance>(businessDocRef);

  // Sync to local storage for fast subsequent loads
  /**
   * On desktop, SQLite is the durable store - so the bulk collections do not go
   * to localStorage at all.
   *
   * Writing them there was what broke offline launch for larger businesses: the
   * encrypted product/customer/receipt blobs exhausted the ~5MB origin quota,
   * secureStorage swallows the resulting QuotaExceededError, and the small
   * profile write that carries businessId failed silently. Without businessId
   * nothing can address the SQLite cache, so a fully-populated database looked
   * empty until a reconnect refetched the profile.
   *
   * Mobile is also Tauri and hydrates from the same SQLite tables, but it keeps
   * writing localStorage too: that is the path the user confirmed still loads
   * offline, and its datasets are the ones that fit today.
   */
  const isDesktopApp = isNativeApp() && !isMobileApp();

  /**
   * Whether the local SQLite store has proven itself usable this session.
   *
   * `null` until hydration has actually tried it, and **`null` deliberately
   * behaves like `false`** at the write sites below: a store that has not yet
   * answered is not a store you may rely on, and the cost of being wrong is
   * asymmetric — a redundant IndexedDB write costs nothing, whereas skipping it
   * against a dead SQLite leaves the catalogue with nowhere to live at all.
   *
   * That is not hypothetical. The desktop shell had *three* stores and every one
   * of them was off: SQLite because the Rust crate was built with no database
   * driver (see `src-tauri/Cargo.toml`), localStorage because the write is gated
   * on `!isDesktopApp`, and IndexedDB because it was gated on `!isNativeApp()`.
   * So a desktop till relaunched offline had an empty catalogue, and the only
   * reason it ever worked was that the localStorage write used to be
   * unconditional. Gating the mirror on a *proven* store rather than on the
   * platform is what stops one silent failure emptying a till again.
   */
  const [sqliteOk, setSqliteOk] = useState<boolean | null>(() => offlineDbUsable());

  useEffect(() => {
    if (currentUserProfile) {
      secureStorage.setItem(USER_PROFILE_KEY, currentUserProfile);
      if (isNativeApp()) syncProfileToOffline(currentUserProfile);
    }
  }, [currentUserProfile]);

  // Restores businessId offline. The main hydration effect below returns early
  // on a null businessId *before* setting hasHydratedRef, so it re-runs on its
  // own once this lands.
  useEffect(() => {
    if (!isNativeApp() || !user?.uid || offlineProfile?.id === user.uid) return;
    getCachedProfile(user.uid).then(p => {
      if (p) setOfflineProfile(p);
    });
  }, [user?.uid, offlineProfile?.id]);

  useEffect(() => {
    const stored = secureStorage.setItem('pos_queued_actions', queuedActions);
    queuedActionsRef.current = queuedActions;

    /*
     * A fallback copy of the queue, kept only while localStorage is refusing it.
     *
     * `secureStorage.setItem` swallowed `QuotaExceededError` until it was made to
     * report, and on web the multi-megabyte `pos_synced_*` blobs share the same
     * ~5MB budget. The five bulk collections all have an `idb` sibling and survive
     * that; the queue had none, so a shop over quota queued a delete, reloaded, and
     * the delete was simply gone — the product back on the shelf, nothing to show
     * why. Desktop has its own SQLite copy via `saveActionToOfflineQueue`; this is
     * what covers web and the PWA.
     *
     * Written *only* on a failed localStorage write, and removed as soon as one
     * succeeds. That is what makes recovery unambiguous: if the key exists at all,
     * it is a queue localStorage could not hold, so it is the authoritative copy
     * and can be adopted outright. A mirror maintained unconditionally would be
     * indistinguishable from a stale one, and adopting that replays committed work
     * — a double-counted sale.
     *
     * Both branches wait for `queueMirrorChecked`. This effect runs on mount, long
     * before the recovery read below resolves, so an ungated `remove` would delete
     * the very copy it is there to recover. `queueMirrorChecked` is a *dependency*
     * rather than a ref for exactly that reason: when the read finishes, this
     * effect re-runs against the same queue and retries the write, so a failure
     * that happened during the mount window still gets a fallback copy. Dropping
     * it from the deps reopens that hole silently.
     */
    if (!queueMirrorChecked) return;
    if (!stored) {
      queueFallbackActiveRef.current = true;
      idb.set('pos_queued_actions', queuedActions).catch(() => {});
    } else if (queueFallbackActiveRef.current) {
      queueFallbackActiveRef.current = false;
      idb.remove('pos_queued_actions').catch(() => {});
    }
  }, [queuedActions, queueMirrorChecked]);

  /**
   * Adopts pending writes that only ever reached the IndexedDB fallback.
   *
   * Runs once, as early as possible, and deliberately does not wait for
   * `businessId` — the effect above must not touch the fallback key until this has
   * read it. The key's mere existence means a localStorage write failed while
   * holding these actions, so everything in it is work that was never persisted
   * anywhere else; union by id and let the queue commit it.
   */
  useEffect(() => {
    if (queueMirrorReadRef.current) return;
    queueMirrorReadRef.current = true;

    let cancelled = false;
    idb.get<QueuedAction[]>('pos_queued_actions')
      .then(mirrored => {
        if (cancelled || !mirrored || mirrored.length === 0) return;

        /*
         * Set whether or not anything is adopted, so the stale key is cleaned up
         * the moment localStorage accepts the queue again. Without this, a
         * fallback whose contents are already in state would sit on disk
         * indefinitely.
         */
        queueFallbackActiveRef.current = true;

        const have = new Set(queuedActionsRef.current.map(a => a.id));
        const recovered = mirrored.filter(a => !have.has(a.id));
        if (recovered.length === 0) return;

        setQueuedActions(prev => {
          const seen = new Set(prev.map(a => a.id));
          return [...prev, ...recovered.filter(a => !seen.has(a.id))];
        });

        /*
         * No `userId`/`businessId` in the context: this runs before auth has
         * resolved, by design. The actions carry their own tenant, which is the
         * more accurate answer anyway.
         */
        reportAnomaly(
          'queue_recovered_from_fallback',
          `${recovered.length} pending write(s) were missing from the localStorage queue and recovered from the IndexedDB fallback — the localStorage write had failed, most likely on quota. Without the fallback these writes would have been lost silently.`,
          {
            details: {
              recovered: recovered.length,
              types: recovered.map(a => a.type),
              businessIds: Array.from(new Set(recovered.map(a => a.payload?.businessId).filter(Boolean))),
            },
          }
        );
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setQueueMirrorChecked(true); });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isDesktopApp) secureStorage.setItem('pos_synced_products', syncedProducts);
    if (!isNativeApp() || !sqliteOk) idb.set('pos_synced_products', syncedProducts);
  }, [syncedProducts, isDesktopApp, sqliteOk]);

  useEffect(() => {
    if (!isDesktopApp) secureStorage.setItem('pos_synced_customers', syncedCustomers);
    if (!isNativeApp() || !sqliteOk) idb.set('pos_synced_customers', syncedCustomers);
  }, [syncedCustomers, isDesktopApp, sqliteOk]);

  useEffect(() => {
    if (!isDesktopApp) secureStorage.setItem('pos_synced_receipts', syncedReceipts);
    if (!isNativeApp() || !sqliteOk) idb.set('pos_synced_receipts', syncedReceipts);
  }, [syncedReceipts, isDesktopApp, sqliteOk]);

  useEffect(() => {
    if (!isDesktopApp) secureStorage.setItem('pos_synced_users', syncedUsers);
  }, [syncedUsers, isDesktopApp]);

  useEffect(() => {
    if (!isDesktopApp) secureStorage.setItem('pos_synced_audit_logs', syncedAuditLogs);
  }, [syncedAuditLogs, isDesktopApp]);

  useEffect(() => {
    if (initialBusiness) secureStorage.setItem(BUSINESS_INSTANCE_KEY, initialBusiness);
  }, [initialBusiness]);

  const canFetchSubData = !!businessId && !!initialBusiness && initialBusiness.status !== 'deleted' && !!user && isProfileReady;

  // Optimized: Disabled real-time listener for large collection to cut Firestore read costs. 
  // System relies on fast local SQLite cache (syncedProducts) and periodic background/delta syncs.
  const productsQuery = useMemoFirebase(() => null, []);
  const { data: initialProducts, isLoading: isLoadingProducts, mutate: mutateProducts } = useCollection<Product>(productsQuery);

  const statsDocRef = useMemoFirebase(() => (canFetchSubData ? doc(firestore, 'businessInstances', businessId, 'stats', 'overall') : null), [canFetchSubData, businessId, firestore]);
  const { data: initialStats } = useDoc<BusinessStats>(statsDocRef);

  useEffect(() => {
    if (initialStats) secureStorage.setItem('pos_offline_stats', initialStats);
  }, [initialStats]);

  // Background Stats Reconciliation
  useEffect(() => {
    if (!canFetchSubData || !firestore || !businessId || !initialStats) return;
    
    const reconcileStats = async () => {
      try {
        if (!getAuth().currentUser) return;
        const customersCount = await getAggregateFromServer(query(collection(firestore, "customers"), where("businessId", "==", businessId)), { total: count() });
        if (!getAuth().currentUser) return;
        const productsCount = await getAggregateFromServer(query(collection(firestore, "products"), where("businessId", "==", businessId)), { total: count() });
        if (!getAuth().currentUser) return;
        
        const realTotalCustomers = customersCount.data().total;
        const realTotalProducts = productsCount.data().total;

        if (realTotalCustomers !== initialStats.totalCustomers || realTotalProducts !== initialStats.totalProducts) {
          await setDoc(statsDocRef!, { 
            totalCustomers: realTotalCustomers,
            totalProducts: realTotalProducts 
          }, { merge: true });
        }
      } catch (e) {
        // Only log error if the user is actually still logged in (to suppress normal abort/logout permission errors)
        if (getAuth().currentUser) {
          console.error("Failed to reconcile stats:", e);
        }
      }
    };

    // Run reconciliation 5 seconds after load to avoid initial contention
    const timer = setTimeout(reconcileStats, 5000);
    return () => clearTimeout(timer);
  }, [canFetchSubData, businessId, !!initialStats]);

  // Optimized: Disabled real-time listener to avoid quadratic listener scaling cost.
  const receiptsQuery = useMemoFirebase(() => null, []);
  const { data: initialReceipts, isLoading: isLoadingReceipts, mutate: mutateReceipts } = useCollection<Receipt>(receiptsQuery);

  // Optimized: Disabled real-time listener for customers to minimize daily reads.
  const customersQuery = useMemoFirebase(() => null, []);
  const { data: initialCustomers, isLoading: isLoadingCustomers, mutate: mutateCustomers } = useCollection<Customer>(customersQuery);


  // Online orders are the last remaining real-time listener on this context —
  // its three siblings above are all disabled. Bounded to the newest
  // ONLINE_ORDERS_LISTENER_LIMIT instead of the whole subcollection: the layout's
  // alert effect only needs the latest pending order, the dashboard only counts
  // orders inside the selected date range, and the online-orders page runs its
  // own (also bounded) query for the full table. A status filter cannot be
  // added here — it would need a composite index and would miss orders whose
  // status the snapshot page is about to flip.
  const onlineOrdersQuery = useMemoFirebase(() => (canFetchSubData ? query(collection(firestore, 'businessInstances', businessId, 'onlineOrders'), orderBy('createdAt', 'desc'), limit(ONLINE_ORDERS_LISTENER_LIMIT)) : null), [canFetchSubData, businessId, firestore]);
  const { data: initialOnlineOrders } = useCollection<OnlineOrder>(onlineOrdersQuery);

  /**
   * True while the catalogue is still on its way and there is nothing to show.
   *
   * This is the single answer to "skeleton, or empty state?" — every surface that
   * lists products should hold its skeleton on this rather than inferring it from
   * `products.length === 0`, which cannot tell an empty shop from a catalogue
   * that has not arrived. It stays true across the local-mirror hydration, the
   * full sync, and the gap before a scheduled retry, and goes false only when
   * something terminal has happened: a completed sync, a recorded failure, or
   * going offline (where whatever is cached is all there will be).
   */
  const isProductCatalogPending = useMemo(() => {
    if (!businessId) return false;
    if (syncedProducts.length > 0) return false;
    if (initialProducts && initialProducts.length > 0) return false;
    /*
     * The server already answered "no products" for this business this session, so
     * there is nothing still coming. Sitting above the sync checks keeps the
     * empty-shop state steady through the next daily re-sync instead of flashing
     * a skeleton over a shop we know is empty.
     */
    if (catalogConfirmedEmpty) return false;
    /*
     * The local mirror has not been read yet, so nothing can be concluded about
     * the catalogue either way. This has to sit *above* the offline check: with
     * the two the other way round, every offline launch resolved to "terminal"
     * before hydration had returned a single row, so `allProducts` handed out
     * `[]` instead of `null` and the whole hydration window became an empty-shop
     * claim. Offline with an unread mirror is "still coming", not "there are
     * none".
     */
    if (!isCacheHydrated) return true;
    // Offline with a hydrated mirror: whatever is cached is all there will be.
    if (!isRealOnline) return false;
    if (isFullSyncingProducts || isProductRetryScheduled) return true;
    if (productSyncError) return false; // terminal — the page shows the reason and a retry
    return !hasFullSyncedProducts;
  }, [
    businessId, isRealOnline, syncedProducts, initialProducts, isCacheHydrated, catalogConfirmedEmpty,
    isFullSyncingProducts, isProductRetryScheduled, productSyncError, hasFullSyncedProducts,
  ]);

  /**
   * True when there is nothing to show and we cannot honestly say the shop has
   * nothing.
   *
   * `products.length === 0` carries two completely different meanings, and
   * conflating them is what put "Empty Inventory" in front of a shop with a full
   * catalogue. `isProductCatalogPending` answers "still coming?"; this answers
   * the other half — hydration has finished, nothing came back, and there is a
   * reason to doubt that this is the truth.
   *
   * Being offline is such a reason. An offline device cannot tell a shop with no
   * products from a catalogue that never reached this machine, and the two ways
   * of being wrong do not cost the same: telling a stocked shop it is empty sends
   * the owner to Add Product while their till cannot sell, whereas telling a
   * genuinely empty shop we could not load it costs one puzzled look at a Retry
   * button. So where it cannot be known, do not assert empty.
   *
   * `hasFullSyncedProducts` deliberately does not appear here as an "it really is
   * empty" witness: the effect that sets it from the `full_products_sync` stamp
   * is itself gated on `isRealOnline`, so it is always false offline — and per
   * CLAUDE.md that stamp can outlive the rows it certifies anyway.
   *
   * `catalogConfirmedEmpty` *is* such a witness, and it is the only one. It means
   * the server was asked for this business's products in this session and
   * answered with none, which settles the question for good: no later doubt can
   * unsettle a fact. Without it, a shop that genuinely has no products was told
   * "Couldn't load your products" the moment it went offline or a retry failed —
   * and a shop with no products yet is the commonest shop in this app.
   */
  const isCatalogUnverified = useMemo(() => {
    if (!businessId || !isCacheHydrated) return false;
    if (syncedProducts.length > 0) return false;
    if (initialProducts && initialProducts.length > 0) return false;
    if (catalogConfirmedEmpty) return false;
    if (productSyncError) return true;
    return !isRealOnline;
  }, [businessId, isCacheHydrated, syncedProducts, initialProducts, catalogConfirmedEmpty, productSyncError, isRealOnline]);

  /*
   * A confirmed-empty catalogue is a statement about one business, so it cannot
   * survive a switch to another. `businessId` moves on impersonation, on stopping
   * it, and on a profile that resolves late — all three would otherwise let one
   * shop's emptiness vouch for another's.
   */
  useEffect(() => {
    setCatalogConfirmedEmpty(false);
    refusalProbedRef.current = false;
  }, [businessId]);

  const allProducts = useMemo(() => {
    if (initialProducts === null && syncedProducts.length === 0 && isProductCatalogPending) return null;
    /*
     * Merged through a Map keyed by id, because the previous version snapshotted
     * `existingIds` from `initialProducts` *before* the loop and never updated it
     * inside. `initialProducts` is always empty — that listener is disabled — so
     * the set was empty, every `syncedProducts` row took the "not seen yet"
     * branch, and a cache holding the same id twice rendered two table rows.
     */
    const byId = new Map<string, Product>();
    (initialProducts || []).forEach(p => byId.set(p.id, p));
    syncedProducts.forEach(p => byId.set(p.id, { ...(byId.get(p.id) || {}), ...p }));
    let merged = Array.from(byId.values());
    const deletedIds = new Set(queuedActions.filter(a => a.type === 'delete-product').flatMap(a => a.payload.productIds));
    if (deletedIds.size > 0) merged = merged.filter(p => !deletedIds.has(p.id));
    queuedActions.forEach(action => {
      if (action.type === 'update-product') { const idx = merged.findIndex(p => p.id === action.payload.productId); if (idx !== -1) merged[idx] = { ...merged[idx], ...action.payload.values }; }
      else if (action.type === 'bulk-update-products') { action.payload.productIds.forEach((id: string) => { const idx = merged.findIndex(p => p.id === id); if (idx !== -1) merged[idx] = { ...merged[idx], ...action.payload.values }; }); }
      else if (action.type === 'add-product') { if (!merged.find(p => p.id === action.payload.id)) merged.push({ ...action.payload, isOptimistic: true }); }
      else if (action.type === 'complete-sale') {
        const items = action.payload.receiptData?.items || action.payload.items;
        if (Array.isArray(items)) items.forEach((item: any) => { const idx = merged.findIndex(p => p.id === item.productId); if (idx !== -1) merged[idx] = { ...merged[idx], stock: (merged[idx].stock || 0) - item.quantity }; });
      }
    });
    /*
     * Newest first — through `safeToDate`, which is the only thing here that
     * reads all four shapes `createdAt` arrives in.
     *
     * The old expression was `createdAt?.toMillis?.() || createdAt?.seconds || 0`.
     * A product this device just created carries `createdAt: Date.now()` — a plain
     * number, since the `serverTimestamp()` only exists on the server copy — and a
     * number has neither `toMillis` nor `seconds`, so it scored 0 and sorted as the
     * oldest thing in the shop. Adding a product sent it to the bottom of a
     * "newest first" list, which is what "I added it and can't see it" looks like
     * on a shop with a few hundred products.
     */
    return merged.sort((a, b) => safeToDate(b.createdAt).getTime() - safeToDate(a.createdAt).getTime());
  }, [initialProducts, syncedProducts, queuedActions, isRealOnline, businessId, isProductCatalogPending]);

  const products = useMemo(() => {
    if (!allProducts) return null;
    if (!activeBranchId || activeBranchId === 'all') return allProducts;
    return allProducts.filter(p => {
      if (activeBranchId === businessId) {
        return !p.branchId || p.branchId === businessId || p.branchId === 'all';
      }
      return p.branchId === activeBranchId;
    });
  }, [allProducts, activeBranchId, businessId]);

  const profile = useMemo(() => {
    if (currentUserProfile) return currentUserProfile;
    if (offlineProfile && user && offlineProfile.id === user.uid) return offlineProfile;
    return null;
  }, [currentUserProfile, offlineProfile, user?.uid]);

  const business = useMemo(() => {
    // If we successfully fetched the business document while online but it doesn't exist, it was definitively deleted.
    if (!isLoadingBusiness && initialBusiness === null && isRealOnline && !!businessId) {
      return { ...(offlineBusiness || {}), status: 'deleted' } as BusinessInstance;
    }

    const base = initialBusiness || offlineBusiness;
    if (!base) return null;
    const settingsUpdates = queuedActions.filter(a => a.type === 'update-settings');
    if (settingsUpdates.length === 0) return base;
    let result = { ...base };
    settingsUpdates.forEach(action => {
      Object.keys(action.payload).forEach(key => {
        if (key.includes('.')) {
          const parts = key.split('.'); let curr: any = result;
          for (let i = 0; i < parts.length - 1; i++) { curr[parts[i]] = { ...curr[parts[i]] }; curr = curr[parts[i]]; }
          curr[parts[parts.length - 1]] = action.payload[key];
        } else (result as any)[key] = action.payload[key];
      });
    });
    return result;
  }, [initialBusiness, offlineBusiness, queuedActions]);

  const allReceipts = useMemo(() => {
    const queuedSales = queuedActions.filter(a => a.type === 'complete-sale');
    if (initialReceipts === null && syncedReceipts.length === 0 && queuedSales.length === 0 && !hasFullSyncedReceipts && isRealOnline && !!businessId) return null;
    
    let merged = [...(initialReceipts || [])];
    const existingIds = new Set(merged.map(r => r.id));
    syncedReceipts.forEach(r => { 
      if (!existingIds.has(r.id)) {
        merged.push(r); 
        existingIds.add(r.id);
      }
    });
    queuedSales.forEach(action => {
      const receipt = action.payload.receiptData;
      if (receipt && !existingIds.has(receipt.id)) {
        merged.push({ 
          ...receipt, 
          isOptimistic: true, 
          createdAt: receipt.createdAt || new Date(action.timestamp) 
        });
        existingIds.add(receipt.id);
      }
    });
    
    // Filter out voided receipts currently in the sync queue
    const voidedIds = new Set(queuedActions.filter(a => a.type === 'delete-receipt').map(a => a.payload.receiptId));
    if (voidedIds.size > 0) {
      merged = merged.filter(r => !voidedIds.has(r.id));
    }
    
    // Client-side sort by createdAt desc
    return merged.sort((a, b) => {
      const getMillis = (dateVal: any) => {
        const date = safeToDate(dateVal);
        return date.getTime();
      };
      return getMillis(b.createdAt) - getMillis(a.createdAt);
    });
  }, [initialReceipts, syncedReceipts, queuedActions, isRealOnline, businessId, hasFullSyncedReceipts]);

  const receipts = useMemo(() => {
    if (!allReceipts) return null;
    if (!activeBranchId || activeBranchId === 'all') return allReceipts;
    return allReceipts.filter(r => {
      if (activeBranchId === businessId) {
        return !r.branchId || r.branchId === businessId || r.branchId === 'all';
      }
      return r.branchId === activeBranchId;
    });
  }, [allReceipts, activeBranchId, businessId]);

  const allCustomers = useMemo(() => {
    let merged = [...(initialCustomers || [])];
    const existingIds = new Set(merged.map(c => c.id));
    syncedCustomers.forEach(c => { 
      if (!existingIds.has(c.id)) {
        merged.push(c); 
      } else { 
        // Only overwrite if the local data is actually newer (using updatedAt)
        const idx = merged.findIndex(m => m.id === c.id); 
        if (idx !== -1) {
          const serverDate = safeToDate(merged[idx].updatedAt).getTime();
          const localDate = safeToDate(c.updatedAt).getTime();
          if (localDate > serverDate) {
            merged[idx] = { ...merged[idx], ...c };
          }
        }
      } 
    });
    const deletedIds = new Set(queuedActions.filter(a => a.type === 'delete-customer').map(a => a.payload.id));
    merged = merged.filter(c => !deletedIds.has(c.id));
    queuedActions.forEach(action => {
      if (action.type === 'update-customer') { 
        const idx = merged.findIndex(c => c.id === action.payload.id); 
        if (idx !== -1) merged[idx] = { ...merged[idx], ...action.payload.values }; 
      }
      else if (action.type === 'add-customer') { 
        if (!merged.find(c => c.id === action.payload.id)) merged.push({ ...action.payload, isOptimistic: true }); 
      }
      else if (action.type === 'complete-sale') {
        const { selectedCustomer, secureTotal } = action.payload;
        if (selectedCustomer?.id) {
          const idx = merged.findIndex(c => c.id === selectedCustomer.id);
          if (idx !== -1) {
            const current = merged[idx];
            merged[idx] = {
              ...current,
              totalSpent: (Number(current.totalSpent) || 0) + secureTotal,
              loyaltyPoints: (current.loyaltyPoints || 0) + (action.payload.pointsEarned || 0),
              lastPurchaseDate: action.timestamp
            };
          }
        }
      }
    });
    return merged.sort((a, b) => (Number(b.totalSpent) || 0) - (Number(a.totalSpent) || 0));
  }, [initialCustomers, syncedCustomers, queuedActions]);

  const customers = useMemo(() => {
    if (!allCustomers) return null;
    if (!activeBranchId || activeBranchId === 'all') return allCustomers;
    return allCustomers.filter(c => {
      if (activeBranchId === businessId) {
        return !c.branchId || c.branchId === businessId || c.branchId === 'all';
      }
      return c.branchId === activeBranchId;
    });
  }, [allCustomers, activeBranchId, businessId]);

  const onlineOrders = useMemo(() => {
    if (!initialOnlineOrders) return [];
    if (!activeBranchId || activeBranchId === 'all') return initialOnlineOrders;
    return initialOnlineOrders.filter(o => {
      if (activeBranchId === businessId) {
        return !o.branchId || o.branchId === businessId || o.branchId === 'all';
      }
      return o.branchId === activeBranchId;
    });
  }, [initialOnlineOrders, activeBranchId, businessId]);

  const users = useMemo(() => {
    if (syncedUsers.length > 0) return syncedUsers;
    return [];
  }, [syncedUsers]);

  const auditLogs = useMemo(() => {
    if (syncedAuditLogs.length > 0) return syncedAuditLogs;
    return [];
  }, [syncedAuditLogs]);

  const stats = useMemo(() => {
    const baseStats = initialStats || offlineStats;
    if (!baseStats) return null;

    const queuedSales = queuedActions.filter(a => a.type === 'complete-sale' && a.status === 'pending');
    if (queuedSales.length === 0) return baseStats;

    // Optimistically apply pending offline sales to display metrics
    let pendingRevenue = 0;
    let pendingUnits = 0;
    
    queuedSales.forEach(sale => {
      const data = sale.payload.receiptData || sale.payload;
      pendingRevenue += Number(data.total) || 0;
      const items = data.items || [];
      items.forEach((i: any) => pendingUnits += (Number(i.quantity) || 0));
    });

    return {
      ...baseStats,
      totalRevenue: (baseStats.totalRevenue || 0) + pendingRevenue,
      totalSales: (baseStats.totalSales || 0) + queuedSales.length,
      totalUnitsSold: (baseStats.totalUnitsSold || 0) + pendingUnits,
    };
  }, [initialStats, offlineStats, queuedActions]);

  // --- Functions ---
  const refreshData = useCallback(async (silent = false) => {
    const isOnline = isRealOnline;
    if (!user || !businessId || !firestore || !isOnline) return;
    // Guards on the ref, not on `isSyncing`: the silent path never sets that
    // state, so it was unprotected against overlapping runs.
    if (syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    lastDeltaAttemptRef.current = Date.now();
    if (!silent) setIsSyncing(true);
    try {
      // Delta Sync: Only fetch documents updated since our last check
      // This turns 10,000 reads into 1-10 reads.
      /*
       * Rewound by a small overlap, deliberately.
       *
       * `updatedAt` is a `serverTimestamp()`, resolved by Firestore when the
       * write lands; `lastSyncedTimestampRef` is stamped from `Date.now()` on
       * this device. The two clocks are not the same clock. If the device runs
       * even slightly ahead of the server, a write that happened moments before
       * this pass gets a server timestamp *below* our boundary and is skipped —
       * and because the boundary then advances past it, it is skipped by every
       * later pass too. The record is invisible until the 24-hour full sync.
       *
       * That is the failure the duplicate-customer reports describe, and an
       * overlap is the cheap fix: re-reading a handful of documents that were
       * already merged costs a few reads, while missing one costs the shop a
       * duplicated customer. Merging is idempotent — every branch below matches
       * on id and replaces in place — so a re-read is harmless by construction.
       */
      const lastCheck = new Date(Math.max(0, lastSyncedTimestampRef.current - DELTA_OVERLAP_MS));
      
      const pQuery = query(collection(firestore, "products"), where("businessId", "==", businessId), where("updatedAt", ">", lastCheck), limit(500));
      const cQuery = query(collection(firestore, "customers"), where("businessId", "==", businessId), where("updatedAt", ">", lastCheck), limit(500));
      const rQuery = query(collection(firestore, "receipts"), where("businessId", "==", businessId), where("createdAt", ">", lastCheck), limit(100));
      
      /*
       * `allSettled`, not `all`.
       *
       * These three are independent questions, and under `Promise.all` one
       * rejection threw away the two answers that had come back fine. A cashier
       * without `view_customers` is refused on the customer query as a matter of
       * design — so on that device the products and receipts deltas never applied
       * either, and nothing another till did ever arrived. Each collection now
       * stands or falls alone.
       */
      const [pRes, cRes, rRes] = await Promise.allSettled([getDocs(pQuery), getDocs(cQuery), getDocs(rQuery)]);

      const failures: Array<{ name: string; reason: any }> = [];
      if (pRes.status === 'rejected') failures.push({ name: 'products', reason: pRes.reason });
      if (cRes.status === 'rejected') failures.push({ name: 'customers', reason: cRes.reason });
      if (rRes.status === 'rejected') failures.push({ name: 'receipts', reason: rRes.reason });

      /*
       * A refusal is not a fault, and must not hold the delta window hostage.
       *
       * The rules legitimately refuse `customers` to a role without
       * `view_customers`, and that is a *stable* condition — re-reading the same
       * span tomorrow will be refused too. If a refusal blocked the window from
       * advancing, that device would re-query an ever-widening span forever and
       * bill the shop for it. So refusals are tolerated (the window moves, that
       * collection simply stays as it is) while a real failure holds the window
       * where it is so the next pass retries the same span.
       */
      const hardFailures = failures.filter(f => !isServerRefusal(f.reason));

      const newProducts = pRes.status === 'fulfilled' ? pRes.value.docs.map(d => ({ ...d.data(), id: d.id } as Product)) : [];
      const newCustomers = cRes.status === 'fulfilled' ? cRes.value.docs.map(d => ({ ...d.data(), id: d.id } as Customer)) : [];
      const newReceipts = rRes.status === 'fulfilled' ? rRes.value.docs.map(d => ({ ...d.data(), id: d.id } as Receipt)) : [];

      // Anti-Ghosting Guard: Prevent network delta-sync from re-injecting items currently pending deletion
      const deletedProductIds = new Set(queuedActionsRef.current.filter(a => a.type === 'delete-product').flatMap(a => a.payload.productIds));
      const deletedCustomerIds = new Set(queuedActionsRef.current.filter(a => a.type === 'delete-customer').map(a => a.payload.id));
      const voidedReceiptIds = new Set(queuedActionsRef.current.filter(a => a.type === 'delete-receipt').map(a => a.payload.receiptId));

      const filteredProducts = newProducts.filter(p => !deletedProductIds.has(p.id));
      const filteredCustomers = newCustomers.filter(c => !deletedCustomerIds.has(c.id));
      const filteredReceipts = newReceipts.filter(r => !voidedReceiptIds.has(r.id));

      if (filteredProducts.length > 0) {
        setSyncedProducts(prev => {
          const merged = [...prev];
          filteredProducts.forEach(np => {
            const idx = merged.findIndex(p => p.id === np.id);
            if (idx !== -1) merged[idx] = np;
            else merged.push(np);
          });
          return merged;
        });
      }

      if (filteredCustomers.length > 0) {
        setSyncedCustomers(prev => {
          const merged = [...prev];
          filteredCustomers.forEach(nc => {
            const idx = merged.findIndex(c => c.id === nc.id);
            if (idx !== -1) merged[idx] = nc;
            else merged.push(nc);
          });
          return merged;
        });
      }
      if (filteredReceipts.length > 0) {
        setSyncedReceipts(prev => {
          const merged = [...prev];
          filteredReceipts.forEach(nr => {
            const idx = merged.findIndex(r => r.id === nr.id);
            if (idx !== -1) merged[idx] = nr;
            else merged.push(nr);
          });
          return merged;
        });
      }
      if (hardFailures.length === 0) {
        const now = Date.now();
        // Ref first so the next call reads the new window even within this tick;
        // the state copy is kept for anything rendering the last-sync time.
        lastSyncedTimestampRef.current = now;
        setLastSyncedTimestamp(now);
        secureStorage.setItem('pos_last_synced_timestamp', now);
      } else {
        /*
         * The delta poll is the *only* thing that carries another user's write to
         * this device — all three realtime listeners on this context are disabled
         * — and every automatic caller passes `silent: true`, which used to route
         * a failure into total silence: no log, no toast, nothing logged for the
         * owner. A shop whose delta had been failing for weeks simply never saw
         * each other's products, stock or customers, and there was no way to find
         * that out. Report it once per collection per day and leave the window
         * where it is so the next pass retries the same span.
         */
        hardFailures.forEach(({ name, reason }) => {
          reportAnomaly(
            `delta_sync_failed_${name}`,
            `The ${name} delta sync failed with code "${reason?.code || 'unknown'}": ${reason?.message || 'no message'}. Until it succeeds, this device will not see ${name} changes made by other users.`,
            { userId: user?.uid, businessId, details: { collection: name, errorCode: reason?.code || 'unknown' } }
          );
        });
        if (!silent) console.error('Delta Sync partially failed:', hardFailures.map(f => f.name).join(', '));
      }
      if ((newProducts.length > 0 || newCustomers.length > 0 || newReceipts.length > 0) && !hasShownSyncToast.current && !silent) {
        toast({ title: "Operational Sync Complete", description: `Successfully synchronized inventory, customer, and recent sales data.` });
        hasShownSyncToast.current = true;
      }
    } catch (error: any) {
      if (isServerRefusal(error)) return;
      if (!silent) console.error("Delta Sync Failed:", error);
    } finally {
      syncInFlightRef.current = false;
      if (!silent) setIsSyncing(false);
    }
  }, [businessId, firestore, toast, isRealOnline, user]);

  const fetchInitialReceipts = useCallback(async () => {
    if (!user || !businessId || !firestore || !isRealOnline) return;
    try {
      const q = query(collection(firestore, "receipts"), where("businessId", "==", businessId), orderBy("createdAt", "desc"), limit(200));
      const snap = await getDocs(q);
      const fetchedRecs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Receipt));
      
      // 1. Anti-Ghosting Guard: Prevent re-injecting receipts that this CLIENT has queued for deletion
      const voidedReceiptIds = new Set(queuedActionsRef.current.filter(a => a.type === 'delete-receipt').map(a => a.payload.receiptId));
      const filteredRecs = fetchedRecs.filter(r => !voidedReceiptIds.has(r.id));
      
      // 2. Server Deletion Reconciliation: Detect and purge items deleted from Firestore by OTHER clients
      const serverIds = new Set(fetchedRecs.map(r => r.id));
      const purgedLocalIds: string[] = [];

      setSyncedReceipts(prev => {
        if (fetchedRecs.length === 0) return prev;
        
        // Extract the timestamp of the oldest server document in our top 200 retrieval window
        const oldestFetchedDate = safeToDate(fetchedRecs[fetchedRecs.length - 1].createdAt).getTime();
        
        const prunedPrev = prev.filter(localR => {
          // If it exists in the fetched payload, keep it (it will be updated below)
          if (serverIds.has(localR.id)) return true;
          
          // If the local client is actively pending a write/complete-sale for this receipt, DO NOT delete it
          const pendingSale = queuedActionsRef.current.some(a => a.type === 'complete-sale' && (a.payload.receiptData?.id === localR.id || a.payload.id === localR.id));
          if (pendingSale) return true;
          
          const localTime = safeToDate(localR.createdAt).getTime();
          
          // If the receipt timestamp is newer than the oldest retrieved document BUT the document is MISSING
          // from the server payload, it must have been deleted from Firestore by another client!
          if (localTime >= oldestFetchedDate) {
            purgedLocalIds.push(localR.id);
            return false; // Prune it from the array!
          }
          
          // Keep older historical records that are beyond the 200-item retrieval window limit
          return true;
        });

        const merged = [...prunedPrev];
        filteredRecs.forEach(nr => {
          const idx = merged.findIndex(r => r.id === nr.id);
          if (idx !== -1) {
            merged[idx] = nr;
          } else {
            merged.push(nr);
          }
        });
        
        return merged
          .sort((a, b) => safeToDate(b.createdAt).getTime() - safeToDate(a.createdAt).getTime());
      });
      
      // 3. Sync changes and propagate deletions down to offline SQLite storage if in Tauri desktop environment
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        await syncReceiptsToOffline(businessId, fetchedRecs);
        
        for (const idToPurge of purgedLocalIds) {
          await deleteReceiptFromOffline(idToPurge);
        }
      }
    } catch (error: any) {
      if (isServerRefusal(error)) return;
      console.error("Failed to fetch initial receipts:", error);
    }
  }, [businessId, firestore, user, isRealOnline]);

  /**
   * Backfill historical receipts, but only when the local cache is genuinely empty.
   *
   * The comment always said "once on startup if the local array is empty" - the
   * emptiness check was just never there, so every launch spent 200 reads
   * re-fetching receipts SQLite already held. refreshData's delta sync picks up
   * anything new and the daily full sync keeps history complete, so this is only
   * needed for a first login or a cleared cache. An explicit refresh
   * (refreshKey > 0) still forces it.
   */
  useEffect(() => {
    if (!user || !businessId || !firestore || !isRealOnline) return;
    if (!isCacheHydrated) return;
    // At most one backfill per refreshKey: the fetch itself changes
    // syncedReceipts.length, which re-runs this effect.
    if (lastReceiptBackfillKeyRef.current === refreshKey) return;
    if (syncedReceipts.length > 0 && refreshKey === 0) return;
    lastReceiptBackfillKeyRef.current = refreshKey;
    fetchInitialReceipts();
  }, [businessId, firestore, fetchInitialReceipts, refreshKey, user, isRealOnline, isCacheHydrated, syncedReceipts.length]);

  const fetchInitialUsers = useCallback(async () => {
    const isOnline = isRealOnline;
    if (!user || !businessId || !firestore || !isOnline) return;
    try {
      const snap = await getDocs(query(collection(firestore, "users"), where("businessId", "==", businessId)));
      const fetched = snap.docs.map(d => ({ ...d.data(), id: d.id } as UserProfile));
      if (fetched.length > 0) {
        setSyncedUsers(fetched);
      }
    } catch (e: any) { 
      if (isServerRefusal(e)) return;
      console.error("Fetch initial users failed:", e); 
    }
  }, [businessId, firestore, user, isRealOnline]);

  const fetchInitialAuditLogs = useCallback(async () => {
    const isOnline = isRealOnline;
    if (!user || !businessId || !firestore || !isOnline) return;
    try {
      const snap = await getDocs(query(collection(firestore, 'businessInstances', businessId, 'auditLogs'), orderBy('createdAt', 'desc'), limit(50)));
      const fetched = snap.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
      if (fetched.length > 0) {
        setSyncedAuditLogs(fetched.sort((a, b) => safeToDate(b.createdAt).getTime() - safeToDate(a.createdAt).getTime()));
      }
    } catch (e: any) { 
      if (isServerRefusal(e)) return;
      console.error("Fetch initial audit logs failed:", e); 
    }
  }, [businessId, firestore, user, isRealOnline]);

  useEffect(() => {
    const isOnline = isRealOnline;
    if (user && businessId && firestore && isOnline) {
      fetchInitialUsers();
      fetchInitialAuditLogs();
    }
  }, [businessId, firestore, fetchInitialUsers, fetchInitialAuditLogs, refreshKey, user, isRealOnline]);

  const fetchFullCustomers = useCallback(async () => {
    const isOnline = isRealOnline;
    if (!user || !businessId || !firestore || isFullSyncingCustomers || !isOnline) return;
    
    setIsFullSyncingCustomers(true);
    let allFetched: Customer[] = [];
    let lastDoc: any = null;
    let hasMore = true;
    const BATCH_SIZE = 5000;
    /*
     * Whether every page reached SQLite. `syncCustomersToOffline` returns
     * `boolean` now; before it did not, and the stamp below was written over
     * failed writes — see that function's comment for what that cost.
     */
    let persisted = true;

    try {
      while (hasMore) {
        /*
         * No `orderBy`, so Firestore orders by `__name__` ascending and
         * `startAfter(lastDoc)` walks document ids. That is deliberate: it needs
         * no composite index, and unlike a sort on `name` or `createdAt` it
         * cannot skip or repeat a row when a customer is edited mid-walk.
         */
        let q = query(
          collection(firestore, "customers"),
          where("businessId", "==", businessId),
          limit(BATCH_SIZE)
        );

        if (lastDoc) q = query(q, startAfter(lastDoc));

        const snap = await getDocs(q);
        if (snap.empty) {
          hasMore = false;
        } else {
          const batch = snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer));
          allFetched = [...allFetched, ...batch];

          // Persist each page as it lands, the way fetchFullReceipts does. State
          // alone is not durable, and the full_customers_sync stamp below would
          // otherwise certify a sync that never reached disk - the 24h gate then
          // suppresses the re-sync that would have fixed it.
          if (!(await syncCustomersToOffline(businessId, batch))) persisted = false;

          setSyncedCustomers(prev => {
            const merged = [...prev];
            batch.forEach(nc => {
              const idx = merged.findIndex(c => c.id === nc.id);
              if (idx !== -1) merged[idx] = nc;
              else merged.push(nc);
            });
            return merged;
          });

          lastDoc = snap.docs[snap.docs.length - 1];
          if (snap.docs.length < BATCH_SIZE) hasMore = false;
        }
      }

      /*
       * Stamp only what actually happened — and only here, on the success path.
       *
       * This assignment and `setHasFullSyncedCustomers(true)` both used to sit in
       * the `finally` below, so a throw anywhere in the walk still recorded a
       * successful full sync. Two separate harms from that, and products already
       * had both fixed:
       *
       *  - The durable stamp suppressed the retry for 24 hours, so a shop that
       *    lost its connection halfway through a sync kept a partial customer
       *    book for a day. That is one shape of "I have 4,000 customers and only
       *    see 1,000".
       *  - The in-memory flag is what the customers page reads to decide the list
       *    is settled, so flipping it after a failure turns the skeleton into an
       *    empty state — the `null` vs `[]` collapse that put "No products found"
       *    on a POS whose catalogue had merely failed to load.
       */
      if (persisted) {
        setLastSyncMetadata(businessId, 'full_customers_sync', Date.now());
      } else {
        reportAnomaly(
          'customer_cache_write_failed',
          'Customers were fetched but could not be written to the offline store; withholding the sync stamp so the next launch retries.',
          { businessId, details: { fetched: allFetched.length } },
        );
      }
      setHasFullSyncedCustomers(true);

      // Only show the toast if it's been more than 24 hours since the last success
      // to avoid annoying the user on every app start.
      const lastToast = Number(localStorage.getItem('last_sync_toast_time') || 0);
      if (Date.now() - lastToast > 24 * 60 * 60 * 1000) {
        toast({ title: "Full Sync Successful", description: `Synchronized ${allFetched.length} customers for offline access.` });
        localStorage.setItem('last_sync_toast_time', Date.now().toString());
      }
    } catch (error: any) {
      if (isServerRefusal(error)) {
        /*
         * A cashier without `view_customers` is refused by the rules, and that is
         * the correct outcome, not a fault. Settle the flag so the page stops
         * waiting; the list stays at whatever this role is allowed to see.
         */
        setHasFullSyncedCustomers(true);
        return;
      }
      console.warn("Full Customer Sync Failed:", error);
      reportAnomaly('customer_sync_failed', `Full customer sync failed: ${error?.message || error}`, {
        businessId,
        details: { fetched: allFetched.length },
      });
      /*
       * Deliberately no `setHasFullSyncedCustomers(true)` and no stamp here. The
       * fetch failed, so the next `checkFullSyncStatus` pass must try again — and
       * anything reading the flag must keep showing a pending state rather than
       * an empty book.
       */
    } finally {
      setIsFullSyncingCustomers(false);
    }
  }, [businessId, firestore, isFullSyncingCustomers, toast, user, isRealOnline]);

  const fetchFullProducts = useCallback(async (options?: { force?: boolean }) => {
    if (!user || !businessId || !firestore || isFullSyncingProducts) return;
    /*
     * `force` exists for the manual retry, which has just re-verified
     * connectivity itself. `isRealOnline` read here is still the stale
     * pre-verification value — `setIsRealOnline` does not apply synchronously and
     * this callback is captured per render — so without the bypass "Try again"
     * would be a dead button on exactly the shells that need it.
     */
    if (!isRealOnline && !options?.force) return;

    setIsFullSyncingProducts(true);
    let allFetched: Product[] = [];
    let lastDoc: any = null;
    let hasMore = true;
    /**
     * Every page must reach the local mirror before the run may claim the
     * catalogue is persisted. `syncProductsToOffline` used to swallow its write
     * error, so a run that wrote nothing to disk still stamped
     * `full_products_sync` — and the stamp is what suppresses the next 24 hours
     * of syncing.
     */
    let persisted = true;
    /**
     * When this run started asking. Pagination walks `orderBy('name')` with
     * `startAfter`, so a product created while the walk is in progress can land
     * at a name behind the cursor and never appear in `allFetched` — present on
     * the server, absent from the answer. Anything touched locally at or after
     * this instant is therefore exempt from the deletion reconciliation below.
     */
    const runStartedAt = Date.now();
    const BATCH_SIZE = 2000; // Smaller batch for products due to potential image data/complexity
    const cap = isImpersonating ? IMPERSONATION_PRODUCT_CAP : Infinity;

    try {
      while (hasMore) {
        let q = query(
          collection(firestore, "products"),
          where("businessId", "==", businessId),
          orderBy("name", "asc"),
          limit(Math.min(BATCH_SIZE, cap - allFetched.length))
        );

        if (lastDoc) q = query(q, startAfter(lastDoc));

        const snap = await getDocs(q);
        if (snap.empty) {
          hasMore = false;
        } else {
          const batch = snap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
          allFetched = [...allFetched, ...batch];

          // Same reason as the customer loop: persist the page before the
          // full_products_sync stamp can claim it was persisted.
          if (!(await syncProductsToOffline(businessId, batch))) persisted = false;

          setSyncedProducts(prev => {
            const merged = [...prev];
            batch.forEach(np => {
              const idx = merged.findIndex(p => p.id === np.id);
              if (idx !== -1) merged[idx] = np;
              else merged.push(np);
            });
            return merged;
          });

          lastDoc = snap.docs[snap.docs.length - 1];
          if (snap.docs.length < BATCH_SIZE) hasMore = false;
          if (allFetched.length >= cap) hasMore = false;
        }
      }

      /*
       * Products the server no longer has must leave this device.
       *
       * Every merge in this file is an upsert — this loop, the delta sync, and
       * `syncProductsToOffline`'s `upsertRows` — and the delta query can only
       * ever return documents that still exist. So nothing, anywhere, removed a
       * product that another till had deleted: it stayed in this device's cache
       * and mirror indefinitely, and this device's own full sync would not drop
       * it either. That is the other half of "I deleted it and it came back" —
       * the delete worked, it just never travelled.
       *
       * `fetchInitialReceipts` has done exactly this for receipts all along;
       * products never got the equivalent. This is the simpler case: a complete
       * uncapped run holds the authoritative id set, where the receipt version
       * has to reason about its 200-document window.
       *
       * Reaching this line is itself the proof that the run was complete: it sits
       * inside the `try`, directly after the loop, so a throw anywhere in
       * pagination skips it entirely. That matters more than anything else here —
       * pruning against a partial `allFetched` would wipe most of the catalogue
       * off the device, which is far worse than the bug being fixed. Never move
       * this below a `catch` boundary or into the `finally`.
       *
       * Three exemptions, all load-bearing:
       *  - a capped impersonation peek is 500 of 12,000 products, not a catalogue;
       *  - a product with a queued create or update is *meant* not to be on the
       *    server yet, exactly as the receipt version spares a pending sale;
       *  - anything written locally since `runStartedAt`, for the pagination race
       *    described where that constant is declared.
       */
      if (!isImpersonating) {
        const serverIds = new Set(allFetched.map(p => p.id));
        const inFlightIds = new Set<string>(
          queuedActionsRef.current.flatMap(a => {
            if (a.type === 'add-product') return [a.payload?.id].filter(Boolean) as string[];
            if (a.type === 'update-product') return [a.payload?.productId].filter(Boolean) as string[];
            if (a.type === 'bulk-update-products' || a.type === 'delete-product') return (a.payload?.productIds || []) as string[];
            return [];
          })
        );

        /*
         * The list is computed from the ref, not inside the `setSyncedProducts`
         * updater. An updater runs during React's render phase, not at call time,
         * so collecting ids into an array from inside one leaves that array empty
         * on the very next line — the mirror purge below would never have run.
         * Keeping the updater pure also keeps it safe to invoke twice, which
         * StrictMode does.
         */
        const purgedIds = syncedProductsRef.current
          .filter(local => {
            if (serverIds.has(local.id)) return false;
            if (inFlightIds.has(local.id)) return false;
            const touched = Math.max(
              safeToDate(local.updatedAt).getTime(),
              safeToDate(local.createdAt).getTime(),
            );
            return touched < runStartedAt;
          })
          .map(local => local.id);

        if (purgedIds.length > 0) {
          const drop = new Set(purgedIds);
          setSyncedProducts(prev => prev.filter(p => !drop.has(p.id)));
          if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
            await deleteMultipleProductsFromOffline(purgedIds);
          }
        }
      }

      // The catalogue is in memory, so this session can sell either way.
      productSyncAttemptsRef.current = 0;
      setProductSyncError(null);
      setIsProductRetryScheduled(false);
      setHasFullSyncedProducts(true);

      /*
       * The server answered, so "this shop has no products" stops being a guess.
       *
       * This is the fix for the complaint that started this: a shop that has
       * genuinely added nothing yet was shown "Couldn't load your products" the
       * moment anything cast doubt on the emptiness — going offline, a retry that
       * failed — because nothing anywhere recorded that we had *asked* and been
       * told zero. Recorded only on a run that was not capped: an impersonation
       * peek that returns nothing proves nothing about the real catalogue.
       */
      if (!isImpersonating) setCatalogConfirmedEmpty(allFetched.length === 0);

      /*
       * A capped run must not claim the catalogue is complete.
       *
       * `full_products_sync` is what tells this device it may skip the daily
       * product sync, and it is keyed by business — not by who fetched it. Writing
       * it after an impersonation slice would leave the *real* owner skipping
       * their own full sync on this device and trying to sell from 500 of their
       * 12,000 products. So the stamp, the toast and the completion flag are all
       * withheld, and the owner's next login syncs as though this never ran.
       */
      if (isImpersonating) {
        setLastSyncMetadata(businessId, 'impersonation_products_peek', Date.now());
        return;
      }

      if (!persisted) {
        /*
         * Same rule as impersonation, different reason: the stamp is a claim
         * about *disk*, and the disk write failed. Withhold it so the next
         * launch re-fetches instead of hydrating an empty mirror and believing
         * it is up to date.
         */
        reportAnomaly(
          'product_cache_write_failed',
          `Fetched ${allFetched.length} products but the local SQLite mirror rejected the write. full_products_sync withheld so the next launch re-syncs.`,
          { userId: user.uid, businessId, details: { fetched: allFetched.length } }
        );
      } else {
        setLastSyncMetadata(businessId, 'full_products_sync', Date.now());
      }

      const lastToast = Number(localStorage.getItem('last_product_sync_toast_time') || 0);
      if (Date.now() - lastToast > 24 * 60 * 60 * 1000) {
        toast({ title: "Product Catalog Synced", description: `Synchronized ${allFetched.length} products for offline access.` });
        localStorage.setItem('last_product_sync_toast_time', Date.now().toString());
      }
    } catch (error: any) {
      /*
       * This block used to end in a `finally` that ran
       * `setHasFullSyncedProducts(true)` unconditionally. That flag is what makes
       * `allProducts` return `[]` instead of `null`, so any failure here — a
       * dropped connection mid-pagination, a request aborted by navigation —
       * turned the loading skeleton into "No products found" for the rest of the
       * session on a shop with a full catalogue. It is now set only on the
       * success path above.
       */
      console.warn("Full Product Sync Failed:", error);

      /*
       * A refusal is retried, and it is never reported as a missing permission.
       *
       * It used to be the opposite of both. `permission-denied` returned here
       * immediately with `productSyncError: 'permission'`, which rendered "This
       * account isn't allowed to view the product list. Ask the business owner to
       * grant inventory access." with no Retry button — a dead end, shown to
       * owners, saying something `firestore.rules` cannot make true: the
       * `products` `list` rule tests tenancy only and has no permission or role
       * term in it at all. Meanwhile the cause it *does* usually indicate — the
       * signed-in account's `users/{uid}` document not being readable on the
       * server yet, which is a brand-new shop's normal first few hundred
       * milliseconds — is precisely the sort of thing one more attempt clears.
       *
       * So a refusal joins the same bounded ladder as a dropped connection, on a
       * shorter fuse (see `PRODUCT_SYNC_RETRY_POLICY`), and settles as `'access'`:
       * the server would not release the catalogue and we did not establish why.
       * The why is measured once, below, and sent to the platform owner.
       */
      const kind = classifyProductSyncFailure(error);
      const { maxRetries, baseDelayMs } = PRODUCT_SYNC_RETRY_POLICY[kind];

      setProductSyncError(kind);
      productSyncAttemptsRef.current += 1;

      if (productSyncAttemptsRef.current <= maxRetries) {
        // Back off and try again — the common cause is a connection that dropped
        // mid-pagination, which the next attempt clears. Without this the shop
        // waited for the 24-hour window even though nothing was cached.
        const delay = baseDelayMs * productSyncAttemptsRef.current;
        if (productRetryTimerRef.current) clearTimeout(productRetryTimerRef.current);
        setIsProductRetryScheduled(true);
        productRetryTimerRef.current = setTimeout(() => {
          productRetryTimerRef.current = null;
          setIsProductRetryScheduled(false);
          fetchFullProductsRef.current?.();
        }, delay);
      } else {
        setIsProductRetryScheduled(false);
        const attempts = productSyncAttemptsRef.current;

        if (kind === 'access') {
          /*
           * One server read turns "refused, cause unknown" into a named cause in
           * `error_logs`. `getDocFromServer` and not `getDoc` on purpose: the whole
           * question is whether the *server* can see this profile, and the cached
           * read the app is already running on answers yes either way.
           *
           * Latched to once per business per session, and the *whole* report is
           * inside the latch. Skipping only the read and reporting anyway would
           * file every repeat as `probe-failed` — a cause that means "the follow-up
           * read failed", which would not have been true. A diagnosis nobody
           * measured is the thing this change exists to stop shipping.
           */
          if (!refusalProbedRef.current) {
            refusalProbedRef.current = true;

            void (async () => {
              let probe: RefusalProbe = { reachedServer: false, profileExists: false, profileBusinessId: null };
              try {
                const snap = await getDocFromServer(doc(firestore, 'users', user.uid));
                probe = {
                  reachedServer: true,
                  profileExists: snap.exists(),
                  profileBusinessId: snap.exists() ? ((snap.data() as any)?.businessId ?? null) : null,
                };
              } catch {
                // Left as reachedServer: false — `describeRefusal` reports that.
              }

              const { cause, message } = describeRefusal(probe, {
                queriedBusinessId: businessId,
                authUid: user.uid,
                isImpersonating,
                code: error?.code || null,
                attempts,
              });

              reportAnomaly('product_sync_permission_denied', message, {
                userId: user.uid,
                businessId,
                details: {
                  cause,
                  code: error?.code || null,
                  attempts,
                  serverProfileExists: probe.profileExists,
                  serverBusinessId: probe.profileBusinessId,
                  probeReachedServer: probe.reachedServer,
                  isImpersonating,
                },
              });
            })();
          }
        } else {
          reportAnomaly(
            'product_sync_failed',
            `Product sync failed ${attempts} times in a row: ${error?.message || String(error)}. The POS has no catalogue on this device.`,
            { userId: user.uid, businessId, details: { code: error?.code || null, attempts } }
          );
        }
      }
    } finally {
      setIsFullSyncingProducts(false);
    }
  }, [businessId, firestore, isFullSyncingProducts, toast, user, isRealOnline, isImpersonating]);

  /**
   * Lets the bounded retry above re-enter the latest `fetchFullProducts` without
   * putting the callback in its own dependency list.
   */
  useEffect(() => {
    fetchFullProductsRef.current = fetchFullProducts;
  }, [fetchFullProducts]);

  useEffect(() => () => {
    if (productRetryTimerRef.current) clearTimeout(productRetryTimerRef.current);
  }, []);

  /** Manual retry for the POS's "couldn't load your products" state. */
  const retryProductSync = useCallback(async () => {
    productSyncAttemptsRef.current = 0;
    setProductSyncError(null);
    setIsProductRetryScheduled(false);
    if (productRetryTimerRef.current) {
      clearTimeout(productRetryTimerRef.current);
      productRetryTimerRef.current = null;
    }

    /*
     * Re-verify before re-fetching. Pressing "Try again" is the user asserting the
     * connection is back, and the shells can be pinned offline by a bad OS flag
     * (see `verifyConnectivity`) — while `fetchFullProducts` refuses to run at all
     * without `isRealOnline`. So a retry that skipped this would silently do
     * nothing on the one platform where the button matters.
     */
    const online = await verifyConnectivity({ force: true });
    if (online === false) {
      // Genuinely unreachable. Put the reason back rather than leaving the
      // surface to fall through to an empty-shop state on a cleared error.
      setProductSyncError('network');
      return;
    }
    fetchFullProductsRef.current?.({ force: true });
  }, [verifyConnectivity]);

  const fetchFullReceipts = useCallback(async () => {
    const isOnline = isRealOnline;
    if (!user || !businessId || !firestore || isFullSyncingReceipts || !isOnline) return;
    
    setIsFullSyncingReceipts(true);
    let allFetched: Receipt[] = [];
    let lastDoc: any = null;
    let hasMore = true;
    const BATCH_SIZE = 2500; 

    try {
      while (hasMore) {
        let q = query(
          collection(firestore, "receipts"),
          where("businessId", "==", businessId),
          orderBy("createdAt", "desc"),
          limit(BATCH_SIZE)
        );
        
        if (lastDoc) q = query(q, startAfter(lastDoc));
        
        const snap = await getDocs(q);
        if (snap.empty) {
          hasMore = false;
        } else {
          const batch = snap.docs.map(d => ({ ...d.data(), id: d.id } as Receipt));
          allFetched = [...allFetched, ...batch];
          
          setSyncedReceipts(prev => {
            const merged = [...prev];
            batch.forEach(nr => {
              const idx = merged.findIndex(r => r.id === nr.id);
              if (idx !== -1) merged[idx] = nr;
              else merged.push(nr);
            });
            return merged.sort((a, b) => safeToDate(b.createdAt).getTime() - safeToDate(a.createdAt).getTime());
          });

          if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
             await syncReceiptsToOffline(businessId, batch);
          } else {
             const cumulative = await idb.get<Receipt[]>('pos_synced_receipts') || [];
             const mergedIndexed = [...cumulative];
             batch.forEach(nr => {
                const idx = mergedIndexed.findIndex(r => r.id === nr.id);
                if (idx !== -1) mergedIndexed[idx] = nr;
                else mergedIndexed.push(nr);
             });
             await idb.set('pos_synced_receipts', mergedIndexed);
          }

          lastDoc = snap.docs[snap.docs.length - 1];
          if (snap.docs.length < BATCH_SIZE) hasMore = false;
        }
      }
      
      setLastSyncMetadata(businessId, 'full_receipts_sync', Date.now());
      setHasFullSyncedReceipts(true);
      
      const lastToast = Number(localStorage.getItem('last_receipt_sync_toast_time') || 0);
      if (Date.now() - lastToast > 24 * 60 * 60 * 1000) {
        toast({ title: "Sales History Synced", description: `Synchronized ${allFetched.length} receipts and invoices for full offline access.` });
        localStorage.setItem('last_receipt_sync_toast_time', Date.now().toString());
      }
    } catch (error: any) {
      if (isServerRefusal(error)) {
        setHasFullSyncedReceipts(true);
        return;
      }
      console.warn("Full Receipt Sync Failed:", error);
    } finally {
      setIsFullSyncingReceipts(false);
      setHasFullSyncedReceipts(true);
    }
  }, [businessId, firestore, isFullSyncingReceipts, toast, user, isRealOnline]);

  const triggerRefresh = useCallback(() => {
    refreshData();
    setRefreshKey(prev => prev + 1); // Keep for legacy triggers
  }, [refreshData]);

  const triggerConfetti = useCallback(() => setIsConfettiActive(true), []);

  const calculateLoyaltyPoints = useCallback(async (amount: number) => {
    if (!business?.settings?.loyaltyProgramEnabled) return 0;
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try { const { invoke } = await import('@tauri-apps/api/core'); return await invoke<number>('calculate_secure_loyalty', { amount }); } catch { }
    }
    return Math.floor(amount * (business?.settings?.pointsPerUnit || 0));
  }, [business]);

  const processQueue = useCallback(async () => {
    const effectiveProfile = currentUserProfile || offlineProfile;
    if (isQueueProcessing || !isRealOnline || !firestore || !businessId || !effectiveProfile) return;
    const pending = queuedActions.filter(a => a.status === 'pending');
    if (pending.length === 0) return;
    setIsQueueProcessing(true);
    
    try {
      // PERFORMANCE & COST OPTIMIZATION:
      // Efficiently gather sequential 'complete-sale' triggers into unified Firestore batches.
      // This guarantees transactional consistency while collapsing high-traffic writes.
      const operationalSequence: any[][] = [];
      let activeSalesAccum: any[] = [];

      for (const action of pending) {
        if (action.type === 'complete-sale') {
          activeSalesAccum.push(action);
          if (activeSalesAccum.length >= 10) { // Groups up to 10 sales into ONE network payload
            operationalSequence.push(activeSalesAccum);
            activeSalesAccum = [];
          }
        } else {
          // Flush cumulative sale block before interrupting with different operations
          if (activeSalesAccum.length > 0) {
            operationalSequence.push(activeSalesAccum);
            activeSalesAccum = [];
          }
          operationalSequence.push([action]); // Individual execution path for administrative security
        }
      }
      if (activeSalesAccum.length > 0) operationalSequence.push(activeSalesAccum);

      const successfullyCommitIds: string[] = [];

      // Execute each defined operation sequence loop
      for (const chunk of operationalSequence) {
        const batch = writeBatch(firestore);

        // ----------------------------------------------------------------
        // MODE A: The Sale Aggregation Pipeline
        // ----------------------------------------------------------------
        if (chunk.length > 1 || (chunk.length === 1 && chunk[0].type === 'complete-sale')) {
          
          /*
           * Units sold per product across this chunk, written as
           * `increment(-units)`.
           *
           * This used to be a map of *absolute* post-sale stock figures that the
           * selling device computed from its own cached stock, written straight to
           * Firestore. Two tills selling the same item therefore both wrote a
           * number derived from a stale read and the later commit erased the
           * earlier one outright — the shop's stock silently drifted up by
           * whatever the other till had sold. That is the "stock doesn't update
           * across users" report, and only a relative write fixes it: an increment
           * composes with whatever else landed in between.
           *
           * A sale queued by a build that predates `quantitySold` has no relative
           * figure to use, so those fall back to the absolute write via
           * `legacyAbsoluteStocks` rather than guessing a delta — a wrong guess
           * here corrupts a stock count permanently.
           */
          const combinedSold = new Map<string, number>();
          const legacyAbsoluteStocks = new Map<string, number>();
          const consolidatedCust = new Map<string, { totalSpent: number, loyaltyPoints?: number, lastPurchaseAt?: Timestamp }>();
          let aggregateSales = 0;
          let aggregateRev = 0;
          let aggregateUnits = 0;

          try {
            chunk.forEach(action => {
              // Write Discrete Receipt Record
              const rRef = doc(firestore, 'receipts', action.payload.receiptData.id);
              
              // Preserve the date the sale actually belongs to.
              //
              // Two cases must beat the server clock, which is only correct for a
              // sale recorded and synced in the same moment:
              //   1. The admin backdated it (isBackdated).
              //   2. It sat in the offline queue - a sale rung up on Monday and
              //      synced on Wednesday is a Monday sale, not a Wednesday one.
              // Case 2 also covers actions queued by an older build that predates
              // the isBackdated flag, which would otherwise be stamped with the
              // sync time and appear to "lose" the date the cashier chose.
              const rawCreatedAt = action.payload.receiptData.createdAt;
              const clientDate = rawCreatedAt ? safeToDate(rawCreatedAt) : null;
              // safeToDate returns epoch 0 for anything unparseable - never trust that.
              const hasClientDate = !!clientDate && clientDate.getTime() > 0;
              const isOlderThanSync = hasClientDate && (Date.now() - clientDate!.getTime()) > 120_000;
              const dateVal = hasClientDate && (action.payload.receiptData.isBackdated || isOlderThanSync)
                ? Timestamp.fromDate(clientDate!)
                : serverTimestamp();

              batch.set(rRef, {
                ...action.payload.receiptData, 
                businessId: businessId, 
                createdAt: dateVal 
              });

              // Cascade product stock movements. Units are *summed*, because two
              // sales of the same product in one chunk must both come off the shelf
              // — a map of absolute figures collapsed them to the last one.
              action.payload.productUpdates.forEach((u: any) => {
                const units = Number(u.quantitySold);
                if (Number.isFinite(units) && units > 0) {
                  combinedSold.set(u.id, (combinedSold.get(u.id) || 0) + units);
                } else {
                  legacyAbsoluteStocks.set(u.id, u.newStock);
                }
              });

              // Cumulate operational metrics
              aggregateSales += 1;
              aggregateRev += (action.payload.receiptData.total || 0);
              aggregateUnits += (action.payload.receiptData.items?.reduce((a: number, item: any) => a + (item.quantity || 0), 0) || 0);

              // Aggregate Customer Ledger Deltas
              const cu = action.payload.customerUpdate;
              if (cu && cu.id) {
                const existing = consolidatedCust.get(cu.id) || { totalSpent: 0 };
                // `dateVal` is either a real Timestamp (a backdated sale, or one that
                // sat in the offline queue) or a serverTimestamp sentinel, which
                // cannot be read or compared client-side. Only the former can be
                // ordered here; the sentinel case is left undefined and resolved at
                // flush time. Taking the max matters because several sales to the
                // same customer consolidate into one write.
                const saleAt = dateVal instanceof Timestamp ? dateVal : undefined;
                consolidatedCust.set(cu.id, {
                  totalSpent: existing.totalSpent + (cu.totalSpent || 0),
                  loyaltyPoints: cu.loyaltyPoints !== undefined ? cu.loyaltyPoints : existing.loyaltyPoints,
                  lastPurchaseAt:
                    saleAt && (!existing.lastPurchaseAt || saleAt.toMillis() > existing.lastPurchaseAt.toMillis())
                      ? saleAt
                      : existing.lastPurchaseAt,
                });
              }
            });

            // Step B: Flush all cumulative values from the local aggregation buffer into Firestore batch commands.
            //
            // Relative for anything that told us how many units moved, so a
            // concurrent till's sale is added to rather than overwritten. The
            // legacy map is only ever populated by actions queued before
            // `quantitySold` existed, and a product cannot be in both.
            combinedSold.forEach((units, pId) => {
              batch.update(doc(firestore, 'products', pId), { stock: increment(-units), updatedAt: serverTimestamp() });
            });

            legacyAbsoluteStocks.forEach((stockVal, pId) => {
              batch.update(doc(firestore, 'products', pId), { stock: stockVal, updatedAt: serverTimestamp() });
            });

            consolidatedCust.forEach((data, cId) => {
              const updatesObj: any = { updatedAt: serverTimestamp() };
              if (data.totalSpent > 0) updatesObj.totalSpent = increment(data.totalSpent);
              if (data.loyaltyPoints !== undefined) updatesObj.loyaltyPoints = data.loyaltyPoints;
              /**
               * `lastPurchaseDate` was declared on `Customer` and read in four places
               * but **never written to Firestore** — the only assignment was inside the
               * `allCustomers` optimistic memo, which lives in memory and evaporates on
               * reload. So Zen AI's `getAtRiskCustomers` filtered on a field that was
               * always undefined and returned zero rows every time, and any "days
               * since last purchase" feature was dead on arrival.
               *
               * Taken from the receipt's own date rather than the clock, so a backdated
               * or long-queued offline sale records when it actually happened.
               */
              updatesObj.lastPurchaseDate = data.lastPurchaseAt ?? serverTimestamp();
              batch.update(doc(firestore, 'customers', cId), updatesObj);
            });

            // Ship the final, lightweight consolidated payload!
            await batch.commit();

            // ----------------------------------------------------------------
            // Secondary Non-Critical Operations (Stats & Notifications)
            // We run these separately so a permission error for a vendor operator
            // doesn't cause the entire sale batch to fail and get stuck in the queue.
            // ----------------------------------------------------------------
            try {
              const secondaryBatch = writeBatch(firestore);
              let hasSecondaryWrites = false;

              if (aggregateSales > 0 || aggregateRev > 0 || aggregateUnits > 0) {
                secondaryBatch.set(doc(firestore, 'businessInstances', businessId, 'stats', 'overall'), {
                  totalSales: increment(aggregateSales),
                  totalRevenue: increment(aggregateRev),
                  totalUnitsSold: increment(aggregateUnits)
                }, { merge: true });
                hasSecondaryWrites = true;
              }

              // Automatic Draft Purchase Order Generation for low stock items
              const productsBelowThreshold = new Map<string, { product: Product, orderQty: number }>();

              chunk.forEach(action => {
                action.payload.productUpdates.forEach((u: any) => {
                   const units = Number(u.quantitySold);
                   const pId = u.id;
                   const product = syncedProductsRef.current.find((p: Product) => p.id === pId); 
                   if (product && typeof product.lowStockThreshold === 'number' && product.lowStockThreshold > 0 && typeof product.stock === 'number') {
                       const currentStock = product.stock;
                       const newStock = currentStock - units;
                       if (newStock <= product.lowStockThreshold && currentStock > product.lowStockThreshold) {
                           const suggestedQty = Math.max(1, (product.lowStockThreshold * 2) - newStock);
                           productsBelowThreshold.set(product.id, { product, orderQty: suggestedQty });
                       }
                   }
                });
              });

              if (productsBelowThreshold.size > 0) {
                 const reorderItems = Array.from(productsBelowThreshold.values()).map(({ product, orderQty }) => {
                    return {
                        productId: product.id,
                        name: product.name,
                        sku: product.sku || 'N/A',
                        currentStock: product.stock - (chunk.find(a => a.payload.productUpdates.find((u: any) => u.id === product.id))?.payload.productUpdates.find((u: any) => u.id === product.id)?.quantitySold || 0),
                        reorderPoint: product.lowStockThreshold,
                        costPrice: product.costPrice || product.price || 0,
                        orderQty: orderQty
                    };
                 });
                 const totalCost = reorderItems.reduce((sum, item) => sum + (item.costPrice * item.orderQty), 0);
                 
                 const poRef = doc(collection(firestore, 'businessInstances', businessId, 'purchaseOrders'));
                 secondaryBatch.set(poRef, {
                    supplierName: 'General Supplier',
                    supplierPhone: '',
                    supplierEmail: '',
                    items: reorderItems,
                    totalCost,
                    status: 'draft',
                    notes: 'Automatic draft PO for low stock items generated from POS sale.',
                    createdBy: 'System (Auto)',
                    createdAt: serverTimestamp()
                 });
                 hasSecondaryWrites = true;
              }

              // Low-stock alerting used to happen here, with `doc(collection(...))` —
              // a fresh random id per sale, so the same product raised a brand-new
              // notification every time anyone sold one of it, and only ever to
              // whoever was at the till. It now lives in src/lib/notification-rules.ts
              // behind a deterministic per-product-per-day id, evaluated against the
              // stock the context already holds, so a repeat is an idempotent
              // overwrite and the owner is covered too.

              if (hasSecondaryWrites) await secondaryBatch.commit();
            } catch (secondaryError) {
              console.warn("POS Queue :: Non-critical stats/notification update failed (likely RBAC). Sale was safely recorded.", secondaryError);
            }

            // Mark chunk as successfully processed
            chunk.forEach(c => successfullyCommitIds.push(c.id));

            // 🚀 OPTIMIZATION FIX: Re-inject transaction records into the local edge cache
            // since real-time Firestore listeners have been severed to eliminate cost overruns.
            const finalizedReceipts = chunk.map(c => {
              const rd = c.payload.receiptData;
              return {
                 ...rd,
                 createdAt: safeToDate(rd.createdAt) || new Date() // Formally coerce timestamps into healthy JS Dates
              };
            });

            // 1. Instant UI population for the Receipts Page
            setSyncedReceipts(prev => {
              const deduped = [...prev];
              finalizedReceipts.forEach(r => {
                const exists = deduped.some(d => d.id === r.id);
                if (!exists) deduped.unshift(r); // Adds new records to top
              });
              return deduped;
            });

            // 2. Fast-track locally synchronized stock reductions to avoid edge-desync
            //
            // Relative here too, and for a second reason beyond matching the write:
            // Relative here too, and for a second reason beyond matching the write:
            // several sales of one product in a chunk are summed, where a map of
            // absolute figures kept only the last and under-counted the units that
            // actually left the shelf.
            if (combinedSold.size > 0 || legacyAbsoluteStocks.size > 0) {
              setSyncedProducts(prev => {
                 const fresh = [...prev];
                 combinedSold.forEach((units, productId) => {
                   const idx = fresh.findIndex(p => p.id === productId);
                   if (idx !== -1) fresh[idx] = { ...fresh[idx], stock: (Number(fresh[idx].stock) || 0) - units };
                 });
                 legacyAbsoluteStocks.forEach((stockVal, productId) => {
                   const idx = fresh.findIndex(p => p.id === productId);
                   if (idx !== -1) fresh[idx] = { ...fresh[idx], stock: stockVal };
                 });
                 return fresh;
              });
            }

            // 3. Cascade customer total-spend velocity changes directly to local state
            if (consolidatedCust.size > 0) {
              setSyncedCustomers(prev => {
                 const fresh = [...prev];
                 consolidatedCust.forEach((cData, cId) => {
                   const idx = fresh.findIndex(c => c.id === cId);
                   if (idx !== -1) {
                     fresh[idx] = {
                       ...fresh[idx],
                       totalSpent: (Number(fresh[idx].totalSpent) || 0) + cData.totalSpent,
                       loyaltyPoints: cData.loyaltyPoints !== undefined ? cData.loyaltyPoints : fresh[idx].loyaltyPoints
                     };
                   }
                 });
                 return fresh;
              });
            }

          } catch (execError: any) {
            console.error("❌ POS Queue Engine :: Batch write execution failed.", execError);
            
            // Detect non-retryable permanent errors (e.g. Permission Denied, Resource Exhausted, Failed Precondition)
            const errCode = execError?.code || '';
            const isPermanentError = ['permission-denied', 'not-found', 'already-exists', 'invalid-argument', 'failed-precondition'].includes(errCode);
            
            if (isPermanentError) {
              console.warn("⚠️ Permanent Firestore rejection on aggregate batch. Discarding chunk to unblock queue.");
              chunk.forEach(action => successfullyCommitIds.push(action.id)); // Discard to unblock queue

              /*
               * A discarded sale chunk is money the shop rang up and Firestore
               * never took. Nothing recorded that before this, so the same
               * silence that hid refused product writes hid lost sales too.
               */
              reportAnomaly(
                'queued_write_rejected_complete-sale',
                `Firestore refused a batch of ${chunk.length} queued sale(s) with code "${execError?.code || 'unknown'}": ${execError?.message || 'no message'}. The batch was discarded, so those sales are lost.`,
                {
                  userId: effectiveProfile?.id || user?.uid,
                  businessId,
                  details: {
                    actionType: 'complete-sale',
                    errorCode: execError?.code || 'unknown',
                    role: effectiveProfile?.role ?? null,
                    saleCount: chunk.length,
                    receiptIds: chunk.map((c: any) => c.payload?.receiptData?.id ?? null),
                  },
                }
              );

              toast({
                title: "Sync Rejection",
                description: `The server rejected a batch of actions: ${execError.message || 'Permission Denied'}.`,
                variant: "destructive"
              });
              continue; // Skip breaking, continue processing remainder
            }
            
            break; // Stop further processing on this tick for temporary network/server blips to preserve safe retry
          }
        }
        
        // ----------------------------------------------------------------
        // MODE B: Single Secure Command (Inherits 100% of original logic)
        // ----------------------------------------------------------------
        else if (chunk.length === 1) {
          const action = chunk[0];
          try {
            /*
             * Nothing local happens until the server has agreed.
             *
             * Every case below used to mutate `syncedProducts` and the SQLite
             * mirror *inside* the switch, before `batch.commit()` had been
             * awaited — and the catch below treats a permanent rejection as a
             * success, discarding the action. So a delete the rules refused
             * still emptied both local stores, the product vanished from every
             * surface, and the only thing that ever contradicted that was the
             * 24-hour full sync putting it back. That is the "I delete it and it
             * comes back" report, and the ordering is the whole of it.
             *
             * It also fixes a quieter one: `add-product` appended
             * unconditionally, so a temporary failure (which leaves the action
             * pending and retried) appended the same row again on every attempt.
             * A post-commit effect runs exactly once.
             */
            let applyLocal: (() => void | Promise<void>) | null = null;

            switch (action.type) {
              case 'add-customer': {
                const cRef = doc(firestore, 'customers', action.payload.id);
                batch.set(cRef, { ...action.payload, lowercaseName: action.payload.name?.toLowerCase() || '', lowercaseEmail: action.payload.email?.toLowerCase() || '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
                batch.set(doc(firestore, 'businessInstances', businessId, 'stats', 'overall'), { totalCustomers: increment(1) }, { merge: true });
                /*
                 * This was the only create case that seeded nothing locally.
                 * Once the action left the queue the customer was gone from the
                 * creating device until a delta pass fetched them back, and they
                 * reached the SQLite mirror only via the continuity effect after
                 * that — so a staff member who added someone at the till could
                 * not find them, and nor could anyone else until the next poll.
                 * `add-product` has always seeded; customers now match it.
                 */
                applyLocal = () => {
                  setSyncedCustomers(prev => (
                    prev.some(c => c.id === action.payload.id)
                      ? prev.map(c => (c.id === action.payload.id ? { ...c, ...action.payload } : c))
                      : [...prev, action.payload]
                  ));
                };
                break;
              }
              case 'update-customer': {
                const updateVals = { ...action.payload.values, updatedAt: serverTimestamp() };
                if (updateVals.name) updateVals.lowercaseName = updateVals.name.toLowerCase();
                if ('email' in updateVals) updateVals.lowercaseEmail = updateVals.email?.toLowerCase() || '';
                batch.update(doc(firestore, 'customers', action.payload.id), updateVals);
                applyLocal = () => {
                  setSyncedCustomers(prev => prev.map(c => c.id === action.payload.id ? { ...c, ...action.payload.values } : c));
                };
                break;
              }
              case 'delete-customer':
                batch.delete(doc(firestore, 'customers', action.payload.id));
                batch.set(doc(firestore, 'businessInstances', businessId, 'stats', 'overall'), { totalCustomers: increment(-1) }, { merge: true });
                applyLocal = () => {
                  setSyncedCustomers(prev => prev.filter(c => c.id !== action.payload.id));
                };
                break;
              case 'add-product':
                batch.set(doc(firestore, 'products', action.payload.id), { ...action.payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
                batch.set(doc(firestore, 'businessInstances', businessId, 'stats', 'overall'), { totalProducts: increment(1) }, { merge: true });
                applyLocal = () => {
                  setSyncedProducts(prev => (
                    prev.some(p => p.id === action.payload.id)
                      ? prev.map(p => (p.id === action.payload.id ? { ...p, ...action.payload } : p))
                      : [...prev, action.payload]
                  ));
                  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) syncProductToOffline(businessId, action.payload);
                };
                break;
              case 'delete-product':
                action.payload.productIds.forEach((id: string) => batch.delete(doc(firestore, 'products', id)));
                batch.set(doc(firestore, 'businessInstances', businessId, 'stats', 'overall'), { totalProducts: increment(-action.payload.productIds.length) }, { merge: true });
                applyLocal = async () => {
                  setSyncedProducts(prev => prev.filter(p => !action.payload.productIds.includes(p.id)));
                  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
                    /*
                     * Awaited and checked. On desktop this mirror is the only
                     * durable product store, so a swallowed DELETE hydrates the
                     * product back onto the shelf at the next launch — the same
                     * resurrection, by a different route. The deletion
                     * reconciliation in `fetchFullProducts` repairs it on the next
                     * complete sync (the server set no longer holds the id), but
                     * the owner should hear that disk refused a write either way.
                     */
                    const purged = await deleteMultipleProductsFromOffline(action.payload.productIds);
                    if (!purged) {
                      reportAnomaly(
                        'product_cache_delete_failed',
                        `Deleted ${action.payload.productIds.length} product(s) from Firestore but the local SQLite mirror refused the DELETE. They will reappear on this device until the next full sync reconciles it.`,
                        { userId: user?.uid, businessId, details: { productIds: action.payload.productIds } }
                      );
                    }
                  }
                };
                break;
              case 'update-product':
                batch.update(doc(firestore, 'products', action.payload.productId), { ...action.payload.values, updatedAt: serverTimestamp() });
                applyLocal = () => {
                  setSyncedProducts(prev => prev.map(p => p.id === action.payload.productId ? { ...p, ...action.payload.values } : p));
                  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
                    // Through the ref, not the captured `syncedProducts`: the mirror
                    // write merges the queued values onto the row it finds, so a
                    // stale row would write stale sibling fields back to disk.
                    const current = syncedProductsRef.current.find(p => p.id === action.payload.productId);
                    if (current) syncProductToOffline(businessId, { ...current, ...action.payload.values });
                  }
                };
                break;
              case 'bulk-update-products':
                action.payload.productIds.forEach((id: string) => {
                  batch.update(doc(firestore, 'products', id), { ...action.payload.values, updatedAt: serverTimestamp() });
                });
                applyLocal = () => {
                  setSyncedProducts(prev => prev.map(p => action.payload.productIds.includes(p.id) ? { ...p, ...action.payload.values } : p));
                  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
                    action.payload.productIds.forEach((id: string) => {
                      // Through the ref, for the same reason as `update-product`.
                      const current = syncedProductsRef.current.find(p => p.id === id);
                      if (current) syncProductToOffline(businessId, { ...current, ...action.payload.values });
                    });
                  }
                };
                break;
              case 'add-audit-log': {
                const auditLogRef = collection(firestore, 'businessInstances', businessId, 'auditLogs');
                batch.set(doc(auditLogRef), { ...action.payload, createdAt: serverTimestamp() });
                break;
              }
              case 'delete-receipt': {
                batch.delete(doc(firestore, 'receipts', action.payload.receiptId));
                break;
              }
            }

            await batch.commit();
            successfullyCommitIds.push(action.id);
            await applyLocal?.();

          } catch (singularErr: any) {
            console.error(`❌ Standalone sync step failed [${action.type}]:`, singularErr);

            // Detect non-retryable permanent errors (e.g. Permission Denied, Not Found, Failed Precondition)
            const errCode = singularErr?.code || '';
            const isPermanentError = ['permission-denied', 'not-found', 'already-exists', 'invalid-argument', 'failed-precondition'].includes(errCode);

            if (isPermanentError) {
              console.warn(`⚠️ Permanent Firestore rejection for ${action.type} [ID: ${action.id}]. Discarding to unblock queue.`);
              successfullyCommitIds.push(action.id); // Remove from state queue to unblock remaining actions

              /*
               * Tell the platform owner. A refused write used to leave nothing
               * behind but a toast the user dismissed, which is why this has
               * been reported three times and diagnosed none: `error_logs` is
               * the channel that reaches the owner, and an anomaly is exactly
               * this — a condition, not an exception. Keyed by action type so a
               * refused delete and a refused create are separately visible;
               * throttled per code per device per day by `reportAnomaly`.
               */
              reportAnomaly(
                `queued_write_rejected_${action.type}`,
                `Firestore refused a queued ${action.type} with code "${errCode || 'unknown'}": ${singularErr?.message || 'no message'}. The action was discarded, so this write is lost.`,
                {
                  userId: effectiveProfile?.id || user?.uid,
                  businessId,
                  details: {
                    actionType: action.type,
                    errorCode: errCode || 'unknown',
                    role: effectiveProfile?.role ?? null,
                    manageInventory: effectiveProfile?.permissions?.manage_inventory ?? null,
                    entityIds: action.payload?.productIds ?? action.payload?.productId ?? action.payload?.id ?? null,
                  },
                }
              );

              toast({
                title: rejectionTitle(action.type),
                description: `${rejectionBody(action.type)} (${errCode || 'rejected by server'})`,
                variant: "destructive"
              });
              continue; // Resume execution of the remaining queue
            }

            break; // Preserve synchronous safety for temporary network errors
          }
        }
      }

      // State Resolution Phase
      setQueuedActions(prev => {
        const successes = new Set(successfullyCommitIds);
        const failCount = pending.length - successfullyCommitIds.length;

        if (failCount > 0) {
           // We simply notify internal log and naturally leave unresolved items in React state queue to auto-trigger retry 
           console.warn(`Queue resolved with ${failCount} items remaining due to retry conditions.`);
        }

        if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
          successfullyCommitIds.forEach(id => removeActionFromOfflineQueue(id));
        }

        // Retain non-committed items for safe transparent retries
        return prev.filter(a => !successes.has(a.id));
      });

    } finally {
      setIsQueueProcessing(false);
    }
  }, [isQueueProcessing, queuedActions, firestore, businessId, currentUserProfile, offlineProfile, products, syncedProducts, toast, isRealOnline]);


  const addToQueue = useCallback((action: any, description: string) => {
    // Writes are never blocked by an expired date. The free plan does not
    // expire, and a lapsed paid plan downgrades to it rather than locking the
    // shop out mid-sale. Paid features are gated individually via effectivePlan.
    if (!resolveSubscriptionActive(business)) { toast({ variant: 'destructive', title: 'Action Blocked', description: 'This business is no longer active.' }); return null; }
    
    // --- RBAC Permission Check ---
    const effectiveProfile = currentUserProfile || offlineProfile;
    const permissions = effectiveProfile?.permissions || {};
    const userRole = effectiveProfile?.role;
    const isSuperAdmin = effectiveProfile?.email === 'belloimam431@gmail.com';
    
    // Debug Log to catch the culprit
    if (action.type === 'complete-sale' || action.type === 'add-product' || action.type === 'update-product' || action.type === 'delete-product') {
      console.log(`[POS RBAC] Checking action: ${action.type}`, {
        userRole,
        permissions,
        isSuperAdmin,
        isProfileReady
      });
    }

    if (!isSuperAdmin && isProfileReady) {
      // 1. Record Sales check
      if (action.type === 'complete-sale' && permissions.record_sales === false) {
        console.warn(`[POS RBAC] Blocked ${action.type} due to record_sales: false`);
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to record sales.' });
        return null;
      }
      
      // 2. Manage Inventory check
      const inventoryActions = ['add-product', 'update-product', 'delete-product', 'bulk-update-products'];
      if (inventoryActions.includes(action.type) && permissions.manage_inventory === false) {
        console.warn(`[POS RBAC] Blocked ${action.type} due to manage_inventory: false`);
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to manage inventory.' });
        return null;
      }

      // 3. Customer Management check
      const customerActions = ['add-customer', 'update-customer', 'delete-customer'];
      if (customerActions.includes(action.type) && permissions.view_customers === false) {
        console.warn(`[POS RBAC] Blocked ${action.type} due to view_customers: false`);
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to manage customers.' });
        return null;
      }
    }
    // --- End RBAC Check ---

    // Automatically inject activeBranchId if a specific branch is selected
    const updatedPayload = { ...action.payload };
    if (activeBranchId && activeBranchId !== 'all') {
      if (action.type === 'complete-sale') {
        if (updatedPayload.receiptData && !updatedPayload.receiptData.branchId) {
          updatedPayload.receiptData = {
            ...updatedPayload.receiptData,
            branchId: activeBranchId
          };
        }
      } else if (action.type === 'add-product') {
        if (!updatedPayload.branchId) {
          updatedPayload.branchId = activeBranchId;
        }
      } else if (action.type === 'add-customer') {
        if (!updatedPayload.branchId) {
          updatedPayload.branchId = activeBranchId;
        }
      }
    }
    const actionWithBranch = { ...action, payload: updatedPayload };

    const id = uuidv4();
    const newAction: QueuedAction = { ...actionWithBranch, description, id, timestamp: Date.now(), status: 'pending' };
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ && businessId) saveActionToOfflineQueue(newAction).catch(console.error);
    
    setQueuedActions(prev => [...prev, newAction]);
    
    // Proactive Sync: If online, trigger processQueue in the next tick
    if (isRealOnline) {
        setTimeout(() => processQueue(), 100);
    }
    
    return id;
  }, [businessId, business, toast, processQueue, currentUserProfile, isRealOnline, activeBranchId]);

  const addProductWithImage = useCallback(async (productData: any, imageFile: File | null) => {
    let imageUrl = productData.imageUrl || '';
    
    if (imageFile && typeof navigator !== 'undefined' && navigator.onLine) {
      const formData = new FormData();
      formData.append('file', imageFile);
      try {
        const response = await fetch(`/api/upload`, { method: 'POST', body: formData });
        const result = await response.json();
        if (response.ok && result.url) {
          imageUrl = result.url;
        } else {
          console.error("ImageKit upload failed:", result.error);
        }
      } catch (error) {
        console.error("Failed to upload image to ImageKit:", error);
      }
    }
    
    const description = `Added product: ${productData.name}`;
    
    addToQueue({
      type: 'add-product',
      payload: { 
        ...productData,
        imageUrl,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    }, description);

    toast({
      title: "Product Saved",
      description: `${productData.name} has been added and will sync when online.`,
    });
  }, [addToQueue, toast]);

  const resetPOS = useCallback(async () => {
    setCart([]); setSelectedCustomer(null); setDiscount(0); setTaxRate(0); setPaymentMethod('Cash');
    secureStorage.removeItem(POS_CART_KEY); 
    secureStorage.removeItem(POS_CUSTOMER_KEY);
  }, []);

  const nuclearReset = useCallback(async () => {
    await resetPOS();
    setQueuedActions([]);
    // The IndexedDB queue fallback goes with `idb.clear()` below; clear the latch
    // too, or the next successful localStorage write would try to remove a key
    // that is already gone.
    queueFallbackActiveRef.current = false;
    setSyncedProducts([]); 
    setSyncedCustomers([]); 
    setSyncedReceipts([]);
    setSyncedUsers([]);
    setSyncedAuditLogs([]);
    setOfflineProfile(null);
    setOfflineBusiness(null);
    setOfflineStats(null);
    idb.clear();
    
    // Clear all secure storage keys to avoid bleeding data between logins
    secureStorage.removeItem('pos_synced_products');
    secureStorage.removeItem('pos_synced_customers');
    secureStorage.removeItem('pos_synced_receipts');
    secureStorage.removeItem('pos_synced_users');
    secureStorage.removeItem('pos_synced_audit_logs');
    secureStorage.removeItem(USER_PROFILE_KEY);
    secureStorage.removeItem(BUSINESS_INSTANCE_KEY);
    secureStorage.removeItem('pos_offline_stats');
    secureStorage.removeItem('pos_last_synced_timestamp');
    // The owner marker is deliberately *left standing*.
    //
    // `idb.clear()` above is async and nobody awaits this function, so the
    // hydration effect can read IndexedDB before the clear lands. Keeping the
    // outgoing business stamped means the next hydration sees a marker that
    // disagrees with the new business and refuses the cache outright, instead of
    // racing an unfinished wipe. A stale marker over an emptied cache is
    // harmless: empty is exactly what makes the backfills run.
    
    // Clear all sync metadata from localStorage to trigger a fresh full sync on next login
    if (typeof window !== 'undefined') {
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('zeneva_sync_metadata_')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.error("Failed to clear sync metadata from localStorage:", e);
      }
    }
    
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) clearAllTables();
  }, [resetPOS]);

  const searchCustomers = useCallback(async (term: string) => {
    if (!term.trim()) return [];
    const lower = term.toLowerCase().trim();
    const isOnline = isRealOnline;
    
    let local: Customer[] = [];
    if (customers && customers.length > 0) {
      local = customers.filter(c => c.name?.toLowerCase().includes(lower) || c.email?.toLowerCase().includes(lower) || c.phone?.includes(term) || c.code?.toLowerCase().includes(lower));
    }
    
    if (!user || !businessId || !firestore || !isOnline) return local.slice(0, 20);
    try {
      const q = (field: string) => query(collection(firestore, 'customers'), where('businessId', '==', businessId), where(field, '>=', lower), where(field, '<=', lower + '\uf8ff'), limit(20));
      const [nameSnap, emailSnap] = await Promise.all([getDocs(q('lowercaseName')), getDocs(q('lowercaseEmail'))]);
      const combined = [...local, ...nameSnap.docs.map(d => ({ ...d.data() as any, id: d.id } as Customer)), ...emailSnap.docs.map(d => ({ ...d.data() as any, id: d.id } as Customer))];
      return Array.from(new Map(combined.map(item => [item.id, item])).values()).slice(0, 20);
    } catch { return local.slice(0, 20); }
  }, [businessId, firestore, customers, isFullSyncingCustomers, user, isRealOnline]);

  const searchCustomersByField = useCallback(async (field: string, value: string) => {
    if (!value) return [];
    const isOnline = isRealOnline;
    
    if (customers && customers.length > 0) {
      const local = customers.filter(c => (c as any)[field] === value);
      if (local.length > 0 || !isOnline) return local;
    }
    
    if (!user || !businessId || !firestore || !isOnline) return [];
    try {
      const q = query(collection(firestore, 'customers'), where('businessId', '==', businessId), where(field, '==', value), limit(50));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer));
    } catch { return []; }
  }, [businessId, firestore, customers, isRealOnline]);

  /**
   * Is this person already on file? Asked of the server, before a create.
   *
   * This is the direct fix for the duplicate-customer reports. Staff at a second
   * till could not find a customer a colleague had just added — there is no
   * realtime listener on `customers`, and until the foreground poll existed the
   * delta sync ran once per session — so they typed the person in again. The
   * `add-customer` path now asks Firestore first and shows what it finds.
   *
   * Three equality queries, run in parallel: code, phone, then name. Equality
   * filters on separate fields are served by merging single-field indexes, so
   * **none of these needs a composite index** — the same reason
   * `searchCustomersByField` above works. Cost is a floor of three reads per
   * customer creation, which is the cheapest thing in this file and buys the one
   * check that actually prevents the duplicate.
   *
   * Ordered by how much the match proves, because the caller shows the strongest
   * first and the wording has to match the evidence:
   *
   *  - `code`  — the shop's own identifier. A collision is a certainty, never a
   *              question, in the same way a barcode match is in the importer.
   *  - `phone` — near-certain in practice. Normalised through the health module
   *              so `08031234567` and `+2348031234567` are one number; the
   *              *query* has to use the raw string, so both forms are tried.
   *  - `email` — certain when it is a real address. Placeholder
   *              `@zeneva-import.local` addresses are skipped: they identify
   *              nobody, and matching on one would offer to merge two unrelated
   *              people who both came in through the old CSV importer.
   *  - `name`  — a question, not an answer. Two people really are called Musa
   *              Ibrahim, so this is surfaced as "is this the same person?" and
   *              never blocks the create.
   *
   * Failure is silent and returns `[]` on purpose. This runs in front of a create
   * the user has already asked for; if the lookup cannot run — offline, refused,
   * timed out — the right outcome is to let them save, not to hold their customer
   * hostage to a duplicate check. A visible duplicate can be merged later; a
   * cashier who cannot record a customer is stuck at the till.
   */
  const findExistingCustomer = useCallback(async (candidate: {
    name?: string;
    phone?: string;
    email?: string;
    code?: string;
  }): Promise<CustomerDuplicateMatch[]> => {
    if (!user || !businessId || !firestore || !isRealOnline) return [];

    const code = normalizeCode(candidate.code);
    const phoneKey = normalizePhone(candidate.phone);
    const nameKey = normalizeName(candidate.name);
    const email = realEmail({ email: candidate.email || '' })?.toLowerCase() || '';

    if (!code && !phoneKey && !nameKey && !email) return [];

    const byId = new Map<string, CustomerDuplicateMatch>();
    /*
     * Strongest evidence wins when the same document matches twice. Recording a
     * phone hit as a name hit because the name query happened to run last would
     * downgrade a near-certain duplicate into a question.
     */
    const rank: Record<CustomerDuplicateMatch['on'], number> = { code: 4, phone: 3, email: 2, name: 1 };
    const record = (docs: Customer[], on: CustomerDuplicateMatch['on']) => {
      for (const c of docs) {
        const existing = byId.get(c.id);
        if (!existing || rank[on] > rank[existing.on]) byId.set(c.id, { customer: c, on });
      }
    };

    const runEquality = async (field: string, value: string): Promise<Customer[]> => {
      try {
        const snap = await getDocs(query(
          collection(firestore, 'customers'),
          where('businessId', '==', businessId),
          where(field, '==', value),
          limit(10),
        ));
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer));
      } catch {
        return [];
      }
    };

    try {
      /*
       * The raw phone as typed *and* the normalised key, because `phone` is stored
       * exactly as somebody typed it — there is no `normalizedPhone` field to
       * query. Two shapes catch the overwhelming majority: what this user typed,
       * and the bare national number another user probably typed.
       */
      const phoneValues = Array.from(new Set([
        candidate.phone?.trim(),
        phoneKey,
        phoneKey ? `0${phoneKey}` : '',
        phoneKey ? `+234${phoneKey}` : '',
      ].filter((v): v is string => !!v)));

      const [codeHits, emailHits, nameHits, ...phoneHitSets] = await Promise.all([
        code ? runEquality('code', candidate.code!.trim()) : Promise.resolve([]),
        email ? runEquality('lowercaseEmail', email) : Promise.resolve([]),
        nameKey ? runEquality('lowercaseName', (candidate.name || '').toLowerCase().trim()) : Promise.resolve([]),
        ...phoneValues.map(v => runEquality('phone', v)),
      ]);

      record(nameHits, 'name');
      record(emailHits, 'email');
      phoneHitSets.forEach(hits => record(hits, 'phone'));
      record(codeHits, 'code');

      /*
       * The name query is an exact match on `lowercaseName`, which misses the
       * reordered and punctuated variants the health module normalises away
       * ("Imam Bello" against "Bello Imam"). Re-check every hit through
       * `normalizeName` so a name reported as a match really is one under the
       * same rule the Health tab uses — one definition of "same name", not two.
       */
      const matches = Array.from(byId.values()).filter(m => {
        if (m.on !== 'name') return true;
        return normalizeName(m.customer.name) === nameKey;
      });

      return matches.sort((a, b) => rank[b.on] - rank[a.on]);
    } catch {
      return [];
    }
  }, [businessId, firestore, user, isRealOnline]);

  const searchProducts = useCallback(async (term: string) => {
    if (!term.trim()) return [];
    const lower = term.toLowerCase().trim();
    const isOnline = isRealOnline;

    if (products && products.length > 0) {
      const local = products.filter(p => p.name.toLowerCase().includes(lower) || p.sku?.toLowerCase().includes(lower));
      if (local.length >= 10 || !isOnline) return local.slice(0, 30);
    }
    
    if (!user || !businessId || !firestore || !isOnline) return [];
    try {
      const q = query(collection(firestore, 'products'), where('businessId', '==', businessId), where('lowercaseName', '>=', lower), where('lowercaseName', '<=', lower + '\uf8ff'), limit(30));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
    } catch { return []; }
  }, [businessId, firestore, products, isSyncing, isRealOnline]);

  const searchProductsByField = useCallback(async (field: string, value: string) => {
    if (!value) return [];
    const isOnline = isRealOnline;
    
    if (products && products.length > 0) {
      const local = products.filter(p => (p as any)[field] === value);
      if (local.length > 0 || !isOnline) return local;
    }
    
    if (!user || !businessId || !firestore || !isOnline) return [];
    try {
      const q = query(collection(firestore, 'products'), where('businessId', '==', businessId), where(field, '==', value), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
    } catch { return []; }
  }, [businessId, firestore, products, isRealOnline]);

  const findProductBySku = useCallback(async (sku: string) => {
    if (!sku) return null;
    const isOnline = isRealOnline;
    
    if (products && products.length > 0) {
      const local = products.find(p => p.sku === sku);
      if (local) return local;
    }
    
    if (!user || !businessId || !firestore || !isOnline) return null;
    try {
      const q = query(collection(firestore, 'products'), where('businessId', '==', businessId), where('sku', '==', sku), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { ...snap.docs[0].data(), id: snap.docs[0].id } as Product;
    } catch { return null; }
  }, [businessId, firestore, products, isRealOnline]);

  const fetchDetailedAnalytics = useCallback(async (from: Date, to: Date) => {
    if (!getAuth().currentUser || !businessId || !firestore) return { revenue: 0, count: 0, customers: 0 };
    
    let result = { revenue: 0, count: 0, customers: 0 };
    let uniqueCustomerIds = new Set<string>();

    // For a specific sub-branch, compute from already branch-filtered receipts state
    const isSubBranch = activeBranchId && activeBranchId !== 'all' && activeBranchId !== businessId;
    if (isSubBranch) {
      const fromTime = from.getTime();
      const toTime = to.getTime();
      const targetReceipts = (receipts || []).filter(r => {
        const rt = safeToDate(r.createdAt).getTime();
        return rt >= fromTime && rt <= toTime;
      });
      result.revenue = targetReceipts.reduce((acc, r) => acc + r.total, 0);
      result.count = targetReceipts.length;
      targetReceipts.forEach(r => { if (r.customer?.id) uniqueCustomerIds.add(r.customer.id); });
      result.customers = uniqueCustomerIds.size;
      return result;
    }

    const isOnline = isRealOnline;
    if (isOnline) {
      try {
        const q = query(
          collection(firestore, "receipts"),
          where("businessId", "==", businessId),
          where("createdAt", ">=", safeToDate(from)),
          where("createdAt", "<=", safeToDate(to))
        );
        
        // 100% Accurate Aggregation for Big Numbers
        const aggregateSnap = await getAggregateFromServer(q, {
          totalRevenue: sum('total'),
          totalOrders: count()
        });
        
        result.revenue = aggregateSnap.data().totalRevenue || 0;
        result.count = aggregateSnap.data().totalOrders || 0;
        
        // For unique customers, we cap this at 5,000 due to Firestore structured query limits
        const docSnap = await getDocs(query(q, limit(5000)));
        docSnap.docs.forEach(d => {
          const cId = d.data().customer?.id;
          if (cId) uniqueCustomerIds.add(cId);
        });
        result.customers = uniqueCustomerIds.size;
      } catch (err) {
        console.error("fetchDetailedAnalytics online failed:", err);
      }
    }

    // Fallback 1: SQLite (Tauri)
    if (result.count === 0) {
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
      if (isTauri) {
        try {
          const cached = await getCachedReceipts(businessId, 10000);
          if (cached && cached.length > 0) {
            const fromTime = from.getTime();
            const toTime = to.getTime();
            const filtered = cached.filter(r => {
              const rt = safeToDate(r.createdAt).getTime();
              return rt >= fromTime && rt <= toTime;
            });
            result.revenue = filtered.reduce((acc, r) => acc + r.total, 0);
            result.count = filtered.length;
            uniqueCustomerIds.clear();
            filtered.forEach(r => { if (r.customer?.id) uniqueCustomerIds.add(r.customer.id); });
            result.customers = uniqueCustomerIds.size;
          }
        } catch (err) {
          console.error("fetchDetailedAnalytics SQLite fallback failed:", err);
        }
      }
    }

    // Fallback 2: State / SecureStorage receipts (Web/PWA)
    if (result.count === 0) {
      const targetReceipts = syncedReceipts.length > 0 ? syncedReceipts : (receipts || []);
      if (targetReceipts && targetReceipts.length > 0) {
        const fromTime = from.getTime();
        const toTime = to.getTime();
        const filtered = targetReceipts.filter(r => {
          const rt = safeToDate(r.createdAt).getTime();
          return rt >= fromTime && rt <= toTime;
        });
        result.revenue = filtered.reduce((acc, r) => acc + r.total, 0);
        result.count = filtered.length;
        uniqueCustomerIds.clear();
        filtered.forEach(r => { if (r.customer?.id) uniqueCustomerIds.add(r.customer.id); });
        result.customers = uniqueCustomerIds.size;
      }
    }

    // 🚨 Inject ALL Pending Offline Sales into metrics to guarantee immediate 100% consistent accuracy!
    const fromTime = from.getTime();
    const toTime = to.getTime();
    
    queuedActions.filter(a => a.type === 'complete-sale' && a.status === 'pending').forEach(action => {
      const receipt = action.payload.receiptData;
      if (receipt) {
        const rDate = safeToDate(receipt.createdAt || new Date(action.timestamp));
        const rTime = rDate.getTime();
        if (rTime >= fromTime && rTime <= toTime) {
          result.revenue += (receipt.total || 0);
          result.count += 1;
          if (receipt.customer?.id) {
            uniqueCustomerIds.add(receipt.customer.id);
          }
        }
      }
    });
    
    result.customers = uniqueCustomerIds.size;

    return result;
  }, [businessId, firestore, syncedReceipts, receipts, user, queuedActions, isRealOnline, activeBranchId]);

  const addToCart = useCallback((product: Product, unitName?: string, multiplier?: number, priceOverride?: number, selectedSerialNumber?: string) => {
    const cartItemId = selectedSerialNumber ? `${product.id}-${selectedSerialNumber}` : (unitName ? `${product.id}-${unitName}` : product.id);
    const isService = product.categoryType === 'service';
    const existingItem = cart.find(item => (item.selectedSerialNumber ? `${item.product.id}-${item.selectedSerialNumber}` : (item.unit ? `${item.product.id}-${item.unit}` : item.product.id)) === cartItemId);
    const newQuantity = (existingItem?.quantity || 0) + 1;
    const totalQuantityInBaseUnit = newQuantity * (multiplier || 1);

    if (!isService && totalQuantityInBaseUnit > (product.stock || 0)) {
        toast({ title: existingItem ? 'Backorder recorded' : 'Backorder started', description: `${product.name} is out of stock. Recording as debt.`, variant: 'backorder' as any });
    }

    setCart(prev => {
      const exists = prev.find(item => (item.selectedSerialNumber ? `${item.product.id}-${item.selectedSerialNumber}` : (item.unit ? `${item.product.id}-${item.unit}` : item.product.id)) === cartItemId);
      if (exists) return prev.map(item => (item.selectedSerialNumber ? `${item.product.id}-${item.selectedSerialNumber}` : (item.unit ? `${item.product.id}-${item.unit}` : item.product.id)) === cartItemId ? { ...item, quantity: item.quantity + 1 } : item);
      const finalProduct = priceOverride ? { ...product, price: priceOverride } : product;
      return [...prev, { 
        product: finalProduct, 
        quantity: 1, 
        unit: unitName, 
        multiplier,
        isPriceOverride: !!priceOverride,
        originalPrice: product.price,
        selectedSerialNumber
      }];
    });
  }, [toast, cart]);

  const removeFromCart = useCallback((cartItemId: string) => setCart(prev => prev.filter(item => (item.unit ? `${item.product.id}-${item.unit}` : item.product.id) !== cartItemId)), []);

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    if (quantity <= 0) { removeFromCart(cartItemId); return; }
    
    // Stock Check for Backorder Notification
    const item = cart.find(i => (i.unit ? `${i.product.id}-${i.unit}` : i.product.id) === cartItemId);
    if (item && item.product.categoryType !== 'service') {
        const multiplier = item.multiplier || 1;
        if (quantity * multiplier > (item.product.stock || 0)) {
            toast({
                title: 'Entering Backorder',
                description: `You are requesting more than the ${item.product.stock || 0} units available. This will be recorded as debt.`,
                variant: 'backorder' as any
            });
        }
    }

    setCart(prev => prev.map(item => (item.unit ? `${item.product.id}-${item.unit}` : item.product.id) === cartItemId ? { ...item, quantity } : item));
  }, [removeFromCart, cart, toast]);

  const updateCartItemPrice = useCallback((cartItemId: string, newPrice?: number, newCostPrice?: number) => {
    setCart(prev => prev.map(item => {
      if ((item.unit ? `${item.product.id}-${item.unit}` : item.product.id) === cartItemId) {
        return {
          ...item,
          isPriceOverride: newPrice !== undefined ? true : item.isPriceOverride,
          product: newPrice !== undefined ? { ...item.product, price: newPrice } : item.product,
          costPriceOverride: newCostPrice,
        };
      }
      return item;
    }));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  // --- Effects ---
  useEffect(() => { setIsMounted(true); }, []);
  useEffect(() => { secureStorage.setItem(POS_CART_KEY, cart); }, [cart]);
  useEffect(() => { secureStorage.setItem(POS_CUSTOMER_KEY, selectedCustomer); }, [selectedCustomer]);
  useEffect(() => { secureStorage.setItem(POS_TAX_RATE_KEY, taxRate); }, [taxRate]);
  useEffect(() => { secureStorage.setItem(POS_DISCOUNT_KEY, discount); }, [discount]);
  useEffect(() => { secureStorage.setItem(POS_PAYMENT_METHOD_KEY, paymentMethod); }, [paymentMethod]);
  useEffect(() => { secureStorage.setItem(POS_AUTO_PRINT_KEY, autoPrint); }, [autoPrint]);
  // The five bulk collections used to be written here as well as in the guarded
  // effects near the top of the provider. This copy was unguarded, so on desktop
  // it put the multi-megabyte blobs straight back into localStorage and undid
  // both the quota fix and the reclaim below. SQLite is the durable store there.
  useEffect(() => { secureStorage.setItem(POS_HELD_SALES_KEY, heldSales); }, [heldSales]);
  // `pos_queued_actions` used to be written here a second time as well. It is
  // persisted by the guarded effect near the top of the provider, which also
  // mirrors it to IndexedDB; a bare duplicate here only re-ran the localStorage
  // write without the mirror.

  // Background online-to-offline syncing effects for instant offline availability on all pages
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setSyncedProducts(prev => {
        const merged = [...prev];
        const existingIds = new Set(merged.map(p => p.id));
        initialProducts.forEach(p => {
          const idx = merged.findIndex(m => m.id === p.id);
          if (idx !== -1) merged[idx] = p;
          else merged.push(p);
        });
        return merged;
      });
    }
  }, [initialProducts]);

  useEffect(() => {
    if (initialCustomers && initialCustomers.length > 0) {
      setSyncedCustomers(prev => {
        const merged = [...prev];
        const existingIds = new Set(merged.map(c => c.id));
        initialCustomers.forEach(c => {
          const idx = merged.findIndex(m => m.id === c.id);
          if (idx !== -1) merged[idx] = c;
          else merged.push(c);
        });
        return merged;
      });
    }
  }, [initialCustomers]);

  useEffect(() => {
    if (initialReceipts && initialReceipts.length > 0) {
      setSyncedReceipts(prev => {
        const merged = [...prev];
        const existingIds = new Set(merged.map(r => r.id));
        initialReceipts.forEach(r => {
          const idx = merged.findIndex(m => m.id === r.id);
          if (idx !== -1) merged[idx] = r;
          else merged.push(r);
        });
        return merged;
      });
    }
  }, [initialReceipts]);

  useEffect(() => {
    if (initialStats) {
      setOfflineStats(initialStats);
      secureStorage.setItem('pos_offline_stats', initialStats);
    }
  }, [initialStats]);
  
  useEffect(() => {
    if (!isMounted || !businessId || hasHydratedRef.current) return;
    hasHydratedRef.current = true;

    /*
     * Before reading a single row: does the global-key cache belong to *this*
     * business?
     *
     * This is the first point in the lifecycle where the question can be asked —
     * `businessId` is derived from the (possibly impersonated) profile, which is
     * not available to the state initialisers above. A blob left behind by
     * another business must be dropped rather than trusted, because the backfills
     * below skip whenever the cache looks populated.
     *
     * If the marker is missing entirely, we must also purge to prevent
     * leaking cross-tenant data. 
     */
    const cacheOwner = secureStorage.getItem<string>(CACHE_OWNER_KEY);
    const cacheWasForeign = !cacheOwner || cacheOwner !== businessId;
    if (cacheWasForeign) {
      purgeOwnedCaches();
      // The initialisers may already have seeded another business's rows into
      // memory. Clearing storage alone would leave them on screen.
      setSyncedProducts([]);
      setSyncedCustomers([]);
      setSyncedReceipts([]);
      setSyncedUsers([]);
      setSyncedAuditLogs([]);
      setOfflineBusiness(null);
      setOfflineStats(null);
    }
    secureStorage.setItem(CACHE_OWNER_KEY, businessId);

    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
    if (isTauri) {
      // 1. Load Queue
      getOfflineQueue().then(queue => {
        if (queue.length > 0) {
          setQueuedActions(prev => [...prev, ...queue.filter(a => !prev.find(p => p.id === a.id))]);
          if (isRealOnline) processQueue();
        }
      });
      
       // 2. Hydrate POS from SQLite for instant start.
       //
       // Each read also reclaims the localStorage blob it supersedes, but only
       // once SQLite has actually returned rows for this business - so there is
       // never a moment where the data lives in neither store. This frees the
       // quota on installs upgrading from the build that wrote both.
      const reclaim = (key: string, hasRows: boolean) => {
        if (isDesktopApp && hasRows) secureStorage.removeItem(key);
      };

      Promise.all([
        getCachedProductsResult(businessId).then(({ ok, rows }) => {
          if (rows.length > 0) setSyncedProducts(rows);
          /*
           * `ok: false` means the store itself could not be read, which is not
           * the same as an empty shop. It matters because on desktop this table
           * is the *only* place products live — the localStorage blob is
           * reclaimed just below and never rewritten — while the sync stamp
           * still falls back to localStorage. Recording the failure is what lets
           * `checkFullSyncStatus` distrust a stamp it would otherwise obey, and
           * what stops the POS reporting an empty catalogue as an empty shop.
           */
          if (!ok) {
            setProductSyncError('cache');
            reportAnomaly(
              'product_cache_unreadable',
              'The local SQLite product mirror could not be read. On desktop it is the only product store, so the POS starts with an empty catalogue until a re-sync lands.',
              { userId: user?.uid, businessId }
            );
          }
          reclaim('pos_synced_products', rows.length > 0);
        }),
        getCachedCustomersResult(businessId).then(({ ok, rows }) => {
          if (rows.length > 0) setSyncedCustomers(rows);
          /*
           * Same reasoning as products just above: on desktop this table is the
           * only place the customer book lives once `reclaim` has dropped the
           * localStorage blob, so an unreadable store has to be distinguishable
           * from an empty one. `reclaim` is deliberately skipped on failure —
           * throwing away the blob because SQLite happened to be locked is how a
           * shop loses its customers outright rather than for one session.
           */
          if (!ok) {
            customerCacheUnreadableRef.current = true;
            reportAnomaly(
              'customer_cache_unreadable',
              'The local SQLite customer mirror could not be read. Staff will not find existing customers at the till and may create duplicates until a re-sync lands.',
              { userId: user?.uid, businessId }
            );
          } else {
            reclaim('pos_synced_customers', rows.length > 0);
          }
        }),
        getCachedReceipts(businessId, 10000).then(r => {
          if (r.length > 0) setSyncedReceipts(r);
          reclaim('pos_synced_receipts', r.length > 0);
        }),
        getCachedUsers(businessId).then(u => {
          if (u.length > 0) setSyncedUsers(u);
          reclaim('pos_synced_users', u.length > 0);
        }),
        getCachedAuditLogs(businessId).then(l => {
          if (l.length > 0) {
            setSyncedAuditLogs(
              l.sort((a: AuditLog, b: AuditLog) => safeToDate(b.createdAt).getTime() - safeToDate(a.createdAt).getTime())
            );
          }
          reclaim('pos_synced_audit_logs', l.length > 0);
        }),
        getCachedBusiness(businessId).then(b => { if (b) setOfflineBusiness(b); }),
        getCachedStats(businessId).then(s => { if (s) setOfflineStats(s); }),
      ])
        .then(async () => {
          /*
           * SQLite could not be opened at all, so none of the reads above
           * hydrated anything — fall back to the IndexedDB mirror.
           *
           * This is the branch that was missing, and its absence is why a desktop
           * till came up with an empty catalogue: the shell had no working store
           * of any kind (SQLite built with no driver, localStorage gated on
           * `!isDesktopApp`, IndexedDB gated on `!isNativeApp()`), so relaunching
           * offline showed "couldn't load your products" with no way back short of
           * a reconnect. IndexedDB is the right fallback rather than localStorage:
           * it has no 5MB cliff to fall off with a 12,000-product catalogue.
           *
           * `cacheWasForeign` gates it for the same reason it gates the web branch
           * — these keys carry no businessId, and `purgeOwnedCaches` is async for
           * IndexedDB so a foreign blob may still be sitting there.
           *
           * Each setter keeps whatever is already in state: a partially readable
           * SQLite store is still better evidence than a mirror of unknown age.
           */
          if (offlineDbUsable() === false && !cacheWasForeign) {
            const [p, c, r] = await Promise.all([
              idb.get<Product[]>('pos_synced_products').catch(() => null),
              idb.get<Customer[]>('pos_synced_customers').catch(() => null),
              idb.get<Receipt[]>('pos_synced_receipts').catch(() => null),
            ]);
            if (p && p.length > 0) setSyncedProducts(prev => (prev.length > 0 ? prev : p));
            if (c && c.length > 0) setSyncedCustomers(prev => (prev.length > 0 ? prev : c));
            if (r && r.length > 0) setSyncedReceipts(prev => (prev.length > 0 ? prev : r));
          }
        })
        .finally(() => {
          // Now that the store has actually been tried, the write effects can
          // stop mirroring to IndexedDB — or keep doing so, permanently, if
          // SQLite turned out to be unavailable on this install.
          setSqliteOk(offlineDbUsable());
          setIsCacheHydrated(true);
        });
    } else {
      // 2. Hydrate POS from IndexedDB for instant startup on Web/PWA (Evades 5MB LocalStorage Cap)
      //
      // These keys carry no businessId, so a foreign cache must not be read at
      // all — `purgeOwnedCaches` above is async for IndexedDB and would still be
      // in flight here. Skipping leaves the state empty, which is what makes the
      // backfills below run for the business actually in scope.
      if (cacheWasForeign) {
        setIsCacheHydrated(true);
      } else {
        Promise.all([
          idb.get<Product[]>('pos_synced_products').then(p => { if (p && p.length > 0) setSyncedProducts(p); }),
          idb.get<Customer[]>('pos_synced_customers').then(c => { if (c && c.length > 0) setSyncedCustomers(c); }),
          idb.get<Receipt[]>('pos_synced_receipts').then(r => { if (r && r.length > 0) setSyncedReceipts(r); }),
        ]).finally(() => setIsCacheHydrated(true));
      }
    }
  }, [isMounted, businessId, processQueue, isRealOnline, isDesktopApp]);


  useEffect(() => {
    if (isUserLoading) return;
    if (!user) { 
      if (lastUserId) nuclearReset(); 
      setLastUserId(null); 
      setImpersonatedUserId(null);
      if (typeof window !== 'undefined') sessionStorage.removeItem('zeneva_impersonated_user_id');
      return; 
    }
    if (effectiveUserId !== lastUserId) { 
      if (lastUserId) {
        // A different user has logged in — wipe ALL cached data from the previous business
        // to prevent data bleeding between accounts
        nuclearReset();
        hasHydratedRef.current = false; // Allow the new user's data to be hydrated
        setIsCacheHydrated(false);
        lastReceiptBackfillKeyRef.current = -1;
      }
      setLastUserId(effectiveUserId || null); 
    }
    
    // Safety check: only allow impersonation if current user is super admin
    const isSuperAdmin = user?.email === 'belloimam431@gmail.com';
    if (impersonatedUserId && !isSuperAdmin) {
      setImpersonatedUserId(null);
      if (typeof window !== 'undefined') sessionStorage.removeItem('zeneva_impersonated_user_id');
    }
  }, [user, isUserLoading, effectiveUserId, lastUserId, resetPOS, nuclearReset]);

  useEffect(() => {
    const handleOnline = () => processQueue();
    window.addEventListener('online', handleOnline);
    
    // Auto-trigger processQueue when actions are added if online
    if (isRealOnline && queuedActions.some(a => a.status === 'pending') && !isQueueProcessing) {
      processQueue();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [processQueue, queuedActions, isQueueProcessing, isRealOnline]);
  
  // SQLite Continuity Sync
  //
  // These are the *unfiltered* memos on purpose. The branch-filtered `products` /
  // `customers` / `receipts` are what the UI renders, but persisting those means a
  // multi-branch business only ever caches whichever branch happened to be active,
  // and relaunching offline on another branch shows nothing.
  useEffect(() => {
    if (!isNativeApp() || !businessId) return;
    if (allProducts && allProducts.length > 0) syncProductsToOffline(businessId, allProducts);
    if (allCustomers && allCustomers.length > 0) syncCustomersToOffline(businessId, allCustomers);
    if (allReceipts && allReceipts.length > 0) syncReceiptsToOffline(businessId, allReceipts);
    if (users && users.length > 0) syncUsersToOffline(businessId, users);
    if (auditLogs && auditLogs.length > 0) syncAuditLogsToOffline(businessId, auditLogs);
    if (business) syncBusinessToOffline(business);
    if (stats) syncStatsToOffline(businessId, stats);
  }, [businessId, allProducts, allCustomers, allReceipts, users, auditLogs, business, stats]);

  /*
   * The sync-status check below must know how many products are actually in hand
   * without re-arming on every product mutation — it also kicks off the customer
   * and receipt syncs, so putting `syncedProducts` in its dependency list would
   * re-run all three whenever a sale decremented one stock figure.
   */
  const syncedProductCountRef = useRef(0);
  const expectedProductCountRef = useRef(0);
  useEffect(() => {
    syncedProductCountRef.current = syncedProducts.length;
    syncedProductsRef.current = syncedProducts;
    // `stats.totalProducts` is maintained by the reconciliation effect above and
    // is the only independent evidence of what the catalogue *should* hold.
    const known = Number((stats as any)?.totalProducts ?? 0);
    if (Number.isFinite(known) && known > 0) expectedProductCountRef.current = known;
  }, [syncedProducts, stats]);

  /*
   * The same three facts for customers, and for the same reason: the sync-status
   * check needs the current count without re-arming every time a sale bumps one
   * customer's `totalSpent`.
   *
   * `expectedCustomerCountRef` comes from the `getAggregateFromServer` count that
   * maintains `stats.totalCustomers` — a server-side `count()` over the whole
   * collection, so it is independent evidence of how big the book really is and
   * the only way to notice that a *partial* sync is standing behind a full-sync
   * stamp. A shop with 4,000 customers on file and 1,000 in hand looks perfectly
   * healthy to a check that only asks "is the cache empty".
   */
  const syncedCustomerCountRef = useRef(0);
  const expectedCustomerCountRef = useRef(0);
  const customerCacheUnreadableRef = useRef(false);
  const forcedCustomerResyncRef = useRef(false);
  useEffect(() => {
    syncedCustomerCountRef.current = syncedCustomers.length;
    const known = Number((stats as any)?.totalCustomers ?? 0);
    if (Number.isFinite(known) && known > 0) expectedCustomerCountRef.current = known;
  }, [syncedCustomers, stats]);

  useEffect(() => {
    if (!isMounted || !businessId || !firestore || isFullSyncingCustomers || !isRealOnline || !user || !canFetchSubData) return;

    const checkFullSyncStatus = async () => {
      const [lastCustSync, lastProdSync, lastReceiptSync, lastProdPeek] = await Promise.all([
        getLastSyncMetadata(businessId, 'full_customers_sync'),
        getLastSyncMetadata(businessId, 'full_products_sync'),
        getLastSyncMetadata(businessId, 'full_receipts_sync'),
        getLastSyncMetadata(businessId, 'impersonation_products_peek')
      ]);

      if (lastProdSync > 0) setHasFullSyncedProducts(true);
      if (lastReceiptSync > 0) setHasFullSyncedReceipts(true);
      if (lastCustSync > 0) setHasFullSyncedCustomers(true);

      const now = Date.now();
      const dayInterval = 24 * 60 * 60 * 1000; // Changed from 1 hour to 24 hours to save reads

      if (now - lastCustSync > dayInterval && !isFullSyncingCustomers) {
        fetchFullCustomers();
      } else if (!isFullSyncingCustomers && !forcedCustomerResyncRef.current && isCacheHydrated) {
        /*
         * The customer-book equivalent of `cacheContradictsStamp` below, which
         * exists for products and had no counterpart here.
         *
         * A `full_customers_sync` stamp is a claim about what the store holds, and
         * the stamp outlives what it certifies: it is written to localStorage
         * (with a SQLite copy), while on desktop the customers themselves live in
         * SQLite alone once the localStorage blob has been reclaimed. So a locked,
         * deleted or half-written database leaves a fresh timestamp standing over
         * a table that is empty or short, the 24-hour gate above skips the
         * re-fetch, and staff spend the day unable to find customers who are
         * plainly in Firestore — then create duplicates for them.
         *
         * Two contradictions are worth one re-sync, and neither can be detected
         * by asking "is the cache empty":
         *
         *  - the store could not be read at all (`ok: false` at hydration), or
         *  - it was read and holds materially fewer customers than the server-side
         *    count says exist.
         *
         * `SHORTFALL_TOLERANCE` keeps the second from firing on ordinary drift:
         * `stats.totalCustomers` is an aggregate recounted periodically and
         * adjusted by increments, so it runs a few ahead or behind the synced
         * array all the time. Only a real shortfall — a tenth of the book missing
         * — is evidence of a broken sync rather than of a recent write.
         *
         * Latched to once per session by `forcedCustomerResyncRef`: the re-sync
         * cannot fix a genuinely unwritable database, and without the latch it
         * would re-run on every pass forever, paying for the whole book each time.
         */
        const expected = expectedCustomerCountRef.current;
        const inHand = syncedCustomerCountRef.current;
        const SHORTFALL_TOLERANCE = 0.9;

        const unreadable = customerCacheUnreadableRef.current;
        const short = lastCustSync > 0 && expected > 0 && inHand < Math.floor(expected * SHORTFALL_TOLERANCE);

        if (unreadable || short) {
          forcedCustomerResyncRef.current = true;
          reportAnomaly(
            unreadable ? 'customer_cache_lost' : 'customer_cache_short',
            unreadable
              ? 'A full-customer-sync stamp is standing over a customer store that could not be read; forcing one re-sync this session.'
              : `A full-customer-sync stamp is standing over ${inHand} customers where the server count says ${expected}; forcing one re-sync this session.`,
            { userId: user?.uid, businessId, details: { inHand, expected } },
          );
          fetchFullCustomers();
        }
      }

      /*
       * A stamp that describes rows the store no longer has.
       *
       * `setLastSyncMetadata` writes both localStorage and SQLite and
       * `getLastSyncMetadata` falls back to localStorage, but the products
       * themselves live in SQLite alone on desktop — the localStorage blob is
       * reclaimed after the first successful hydration and `syncedProducts` is
       * never written back to it. So a locked, deleted or recreated database
       * leaves a fresh timestamp standing over an empty table, and every branch
       * below reads that timestamp as proof the catalogue is present: the flag
       * above stops the skeleton, and the 24-hour test skips the re-fetch. The
       * shop then shows "No products found" for a day, across relaunches, with
       * nothing logged and nothing retried.
       *
       * The stamp is a claim about the store, so verify it against the store.
       * Re-fetching an empty catalogue costs a single read, which is the right
       * price for making this self-heal.
       */
      const cacheContradictsStamp =
        lastProdSync > 0 &&
        isCacheHydrated &&
        syncedProductCountRef.current === 0 &&
        !isImpersonating &&
        !forcedProductResyncRef.current;

      if (cacheContradictsStamp) {
        forcedProductResyncRef.current = true;

        // Only tell the admin when something independently says there *are*
        // products; a brand-new shop with an empty catalogue is not an anomaly.
        if (expectedProductCountRef.current > 0) {
          reportAnomaly(
            'product_cache_lost',
            `full_products_sync is stamped ${Math.round((now - lastProdSync) / 60000)} minutes old but the local product store is empty while the business is expected to hold ${expectedProductCountRef.current} products. Forcing a re-sync.`,
            {
              userId: user.uid,
              businessId,
              details: {
                stampAgeMs: now - lastProdSync,
                expected: expectedProductCountRef.current,
                platform: (window as any).__TAURI_INTERNALS__ ? 'native' : 'web',
              },
            }
          );
        }

        if (!isFullSyncingProducts) fetchFullProducts();
      } else if (now - lastProdSync > dayInterval && !isFullSyncingProducts) {
        fetchFullProducts();
      } else if (lastProdSync <= 0) {
        /*
         * While impersonating, a capped run deliberately never writes
         * `full_products_sync` (see fetchFullProducts), so `lastProdSync` stays 0
         * and this branch would re-fetch the 500-product slice on every reload.
         * The peek stamp is the throttle: it is a different key, so it satisfies
         * nothing for the real owner and cannot make them skip their own sync.
         */
        if (isImpersonating && now - lastProdPeek < dayInterval) {
          // Already peeked at this catalogue today — the cache still has it.
        } else {
          fetchFullProducts();
        }
      }

      if (now - lastReceiptSync > dayInterval && !isFullSyncingReceipts) {
        fetchFullReceipts();
      } else if (lastReceiptSync <= 0) {
        fetchFullReceipts();
      }
    };

    checkFullSyncStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, businessId, firestore, isRealOnline, user, isCacheHydrated, canFetchSubData]);
  
  // Initial Delta Sync (Silent Catch-up on mount)
  // Runs once on becoming online. The "no-op → reconnect → effect re-fires"
  // dance is all this needs: a per-mount latch would break the legitimate
  // retry after a lost connection, while keeping `refreshData` out of the deps
  // stops the setLastSyncedTimestamp → new identity → re-arm cycle that used to
  // re-query every ~2.5s for the lifetime of the session.
  //
  // This used to be the *only* thing that ever ran a delta sync. The foreground
  // poll below is what keeps a long-open till current; see `DELTA_POLL_MS`.
  useEffect(() => {
    if (!businessId || !isRealOnline || !firestore || !canFetchSubData) return;

    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) refreshData(true); // Run silently to avoid flickering or showing messages
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, isRealOnline, firestore]);

  /*
   * Keep the two refs the foreground poll reads current.
   *
   * The poll cannot list `refreshData` or `isRealOnline` in its own dependencies
   * without tearing down and re-arming its interval on every sync — which is the
   * shape of the bug the `lastSyncedTimestampRef` comment describes, and it
   * billed reads all day. So it reads both through refs, and this effect is what
   * keeps them pointing at the latest values.
   */
  useEffect(() => {
    refreshDataRef.current = refreshData;
  }, [refreshData]);

  useEffect(() => {
    isRealOnlineRef.current = isRealOnline;
  }, [isRealOnline]);

  /**
   * Foreground delta poll — what makes one till see what another till just did.
   *
   * Four triggers, all funnelled through one throttled entry point:
   *
   *  - `visibilitychange` to visible — the shop switched back to Zeneva, which is
   *    the moment they are about to look something up. The single most valuable
   *    trigger of the four and the cheapest, because it costs nothing while the
   *    app is not being used.
   *  - `focus` — the window regained focus without the document ever having been
   *    hidden (a second window, an OS-level app switch on the desktop shell).
   *  - `online` — the browser thinks connectivity is back. `verifyConnectivity`
   *    may still disagree, and `refreshData` re-checks, so this is a prompt, not
   *    an assertion.
   *  - the interval — for the case the reports were actually about: a till that
   *    is open, visible and in use all day, never backgrounded, never refocused.
   *    Nothing else here would ever fire on that device.
   *
   * Hidden documents are skipped rather than throttled, so a backgrounded tab or
   * a pocketed phone costs zero reads no matter how long it sits there. See
   * `DELTA_POLL_MS` for the read arithmetic and why it is worth paying.
   */
  useEffect(() => {
    if (!businessId || !firestore || !user) return;
    if (typeof window === 'undefined') return;

    const maybeSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!isRealOnlineRef.current) return;
      if (Date.now() - lastDeltaAttemptRef.current < DELTA_MIN_GAP_MS) return;
      // `refreshData` stamps `lastDeltaAttemptRef` itself, and also refuses to
      // overlap via `syncInFlightRef` — this is the throttle, not the guard.
      refreshDataRef.current?.(true);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') maybeSync();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', maybeSync);
    window.addEventListener('online', maybeSync);
    const interval = setInterval(maybeSync, DELTA_POLL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', maybeSync);
      window.removeEventListener('online', maybeSync);
      clearInterval(interval);
    };
  }, [businessId, firestore, user]);


  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0), [cart]);
  const tax = useMemo(() => subtotal * (taxRate / 100), [subtotal, taxRate]);
  const total = useMemo(() => subtotal + tax - discount, [subtotal, tax, discount]);

  // branch-context listens for this and otherwise only catches up via a 1.5s poll,
  // which shows stale branch data for a beat after entering or leaving impersonation.
  const notifyImpersonationChange = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('zeneva_impersonation_change'));
  }, []);

  const impersonateUser = useCallback((userId: string) => {
    setImpersonatedUserId(userId);
    sessionStorage.setItem('zeneva_impersonated_user_id', userId);
    notifyImpersonationChange();
    toast({ title: 'Impersonating User', description: 'Redirecting to their view...' });
    triggerRefresh();
  }, [toast, triggerRefresh, notifyImpersonationChange]);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUserId(null);
    sessionStorage.removeItem('zeneva_impersonated_user_id');
    notifyImpersonationChange();
    toast({ title: 'Impersonation Ended', description: 'Returning to your administrator view.' });
    nuclearReset();
    triggerRefresh();
  }, [toast, nuclearReset, triggerRefresh, notifyImpersonationChange]);

  const holdCurrentSale = useCallback((notes?: string) => {
    if (cart.length === 0) return;

    // Tracked in the context rather than at the two call sites, so a third button
    // added later is counted without anyone remembering to instrument it.
    trackFeature('pos_hold_sale');

    const newHeldSale: HeldSale = {
      id: uuidv4(),
      items: [...cart],
      customer: selectedCustomer,
      timestamp: Date.now(),
      total: total,
      notes
    };
    
    setHeldSales(prev => {
      const updated = [newHeldSale, ...prev];
      secureStorage.setItem(POS_HELD_SALES_KEY, updated);
      return updated;
    });
    
    resetPOS();
    toast({
      title: "Sale Parked",
      description: "You can resume this sale later from the 'Parked Sales' list.",
    });
  }, [cart, selectedCustomer, total, resetPOS, toast]);

  const resumeHeldSale = useCallback((heldSaleId: string) => {
    const saleToResume = heldSales.find(s => s.id === heldSaleId);
    if (!saleToResume) return;
    
    // Clear current POS state then set to resumed sale
    setCart(saleToResume.items);
    setSelectedCustomer(saleToResume.customer || null);
    
    // Remove from held sales
    const updatedHeldSales = heldSales.filter(s => s.id !== heldSaleId);
    setHeldSales(updatedHeldSales);
    secureStorage.setItem(POS_HELD_SALES_KEY, updatedHeldSales);
  }, [heldSales]);

  const deleteHeldSale = useCallback((heldSaleId: string) => {
    const updated = heldSales.filter(s => s.id !== heldSaleId);
    setHeldSales(updated);
    secureStorage.setItem(POS_HELD_SALES_KEY, updated);
  }, [heldSales]);

  const voidReceipt = useCallback(async (receiptId: string) => {
    // 1. Optimistic local state updates
    setSyncedReceipts(prev => prev.filter(r => r.id !== receiptId));
    // Desktop has no receipts blob in localStorage - step 2 below is its removal
    // path - so skip it rather than recreating the key we just reclaimed.
    if (!isDesktopApp) {
      try {
        const currentSynced = secureStorage.getItem<any[]>('pos_synced_receipts') || [];
        const updatedSynced = currentSynced.filter(r => r.id !== receiptId);
        secureStorage.setItem('pos_synced_receipts', updatedSynced);
      } catch (err) {
        console.error("Failed to update secureStorage for voided receipt:", err);
      }
    }

    // 2. Local SQLite removal
    try {
      await deleteReceiptFromOffline(receiptId);
    } catch (err) {
      console.error("Failed to delete receipt from SQLite:", err);
    }

    // 3. Dispatch global delete command to Firestore sync engine
    addToQueue({
      type: 'delete-receipt',
      payload: { receiptId }
    }, `Voided receipt ${receiptId}`);

    toast({
      title: "Receipt Voided",
      description: "The sale has been voided and will be removed globally.",
    });
  }, [addToQueue, toast, isDesktopApp]);



  const fetchReceiptsInRange = useCallback(async (from: Date, to: Date, limitCount: number = 5000) => {
    if (!getAuth().currentUser || !businessId || !firestore) return [];
    
    let results: Receipt[] = [];
    
    const isOnline = isRealOnline;
    if (isOnline) {
      try {
        const q = query(
          collection(firestore, 'receipts'),
          where('businessId', '==', businessId),
          where('createdAt', '>=', safeToDate(from)),
          where('createdAt', '<=', safeToDate(to)),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );
        
        const snap = await getDocs(q);
        results = snap.docs.map(d => ({ ...d.data(), id: d.id } as Receipt));
        
        // Sync these to offline for future use
        if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
          syncReceiptsToOffline(businessId, results);
        }
      } catch (err) {
        console.error("Fetch Receipts In Range online failed:", err);
      }
    }

    // Fallback 1: SQLite (Tauri)
    if (results.length === 0) {
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
      if (isTauri) {
        try {
          const cached = await getCachedReceipts(businessId, limitCount);
          if (cached && cached.length > 0) {
            const fromTime = from.getTime();
            const toTime = to.getTime();
            results = cached.filter(r => {
              const rt = safeToDate(r.createdAt).getTime();
              return rt >= fromTime && rt <= toTime;
            });
          }
        } catch (err) {
          console.error("Fetch Receipts In Range SQLite fallback failed:", err);
        }
      }
    }

    // Fallback 2: State / SecureStorage receipts (Web/PWA)
    if (results.length === 0) {
      const targetReceipts = syncedReceipts.length > 0 ? syncedReceipts : (receipts || []);
      if (targetReceipts && targetReceipts.length > 0) {
        const fromTime = from.getTime();
        const toTime = to.getTime();
        results = targetReceipts.filter(r => {
          const rt = safeToDate(r.createdAt).getTime();
          return rt >= fromTime && rt <= toTime;
        });
      }
    }

    // 🚨 Inject ALL Pending Offline Receipts into the results for realtime calculations!
    const fromTime = from.getTime();
    const toTime = to.getTime();
    const existingIds = new Set(results.map(r => r.id));

    queuedActions.filter(a => a.type === 'complete-sale' && a.status === 'pending').forEach(action => {
      const receipt = action.payload.receiptData;
      if (receipt && !existingIds.has(receipt.id)) {
        const rDate = safeToDate(receipt.createdAt || new Date(action.timestamp));
        const rTime = rDate.getTime();
        if (rTime >= fromTime && rTime <= toTime) {
          results.push({ ...receipt, isOptimistic: true, createdAt: rDate });
          existingIds.add(receipt.id);
        }
      }
    });

    // Sort final outputs descendingly by Date
    results = results.sort((a, b) => safeToDate(b.createdAt).getTime() - safeToDate(a.createdAt).getTime());

    // Branch-filter: apply the same logic as the `receipts` useMemo
    if (activeBranchId && activeBranchId !== 'all') {
      results = results.filter(r => {
        if (activeBranchId === businessId) {
          return !r.branchId || r.branchId === businessId || r.branchId === 'all';
        }
        return r.branchId === activeBranchId;
      });
    }

    return results;
  }, [businessId, firestore, syncedReceipts, receipts, queuedActions, isRealOnline, activeBranchId]);

  const currencyCode = business?.settings?.currency || 'NGN';

  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || '₦';

  const fetchMonthlyAnalytics = useCallback(async (monthCount: number = 12) => {
    if (!getAuth().currentUser || !businessId || !firestore) return [];
    
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
    const isOnline = isRealOnline;
    let results: { month: string, revenue: number, count: number }[] = [];

    // For a specific sub-branch, skip Firestore aggregates (they can't filter by branchId)
    // and compute directly from the already branch-filtered receipts state.
    const isSubBranch = activeBranchId && activeBranchId !== 'all' && activeBranchId !== businessId;
    if (isSubBranch) {
      const targetReceipts = receipts || [];
      if (targetReceipts.length > 0) {
        const monthly: Record<string, { revenue: number, count: number }> = {};
        targetReceipts.forEach(r => {
          const date = safeToDate(r.createdAt);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!monthly[key]) monthly[key] = { revenue: 0, count: 0 };
          monthly[key].revenue += (r.total || 0);
          monthly[key].count += 1;
        });
        results = Object.entries(monthly).map(([month, data]) => ({ month, revenue: data.revenue, count: data.count }));
      }
      return results.sort((a,b) => b.month.localeCompare(a.month)).slice(0, monthCount);
    }

    // 1. If Online, fetch precise aggregates from Firestore (primary branch / all)
    if (isOnline) {
      try {
        const now = new Date();
        const currentYear = now.getFullYear();

        const monthPromises = [];
        for (let i = 0; i <= now.getMonth(); i++) {
          const startDate = new Date(currentYear, i, 1);
          const endDate = new Date(currentYear, i + 1, 0, 23, 59, 59, 999);
          
          const q = query(
            collection(firestore, "receipts"),
            where("businessId", "==", businessId),
            where("createdAt", ">=", startDate),
            where("createdAt", "<=", endDate)
          );
          
          monthPromises.push(getAggregateFromServer(q, {
            revenue: sum('total'),
            count: count()
          }).then(snap => ({
            month: `${currentYear}-${String(i + 1).padStart(2, '0')}`,
            revenue: snap.data().revenue || 0,
            count: snap.data().count || 0
          })));
        }

        results = await Promise.all(monthPromises);
      } catch (err) {
        console.error("Firestore Aggregate Fetch Failed:", err);
      }
    }

    // 2. Fallback to SQLite (Last 12 months among synced receipts)
    if (results.length === 0 && isTauri) {
      try {
        const res = await getMonthlyRevenue(businessId, monthCount);
        if (res && res.length > 0) {
          results = res.map(m => ({ ...m, count: 0 }));
        }
      } catch (err) {
        console.error("SQLite Monthly Fetch Failed:", err);
      }
    }

    // 3. Fallback to synced receipts (volatile or cached)
    if (results.length === 0) {
      const targetReceipts = syncedReceipts.length > 0 ? syncedReceipts : (receipts || []);
      if (targetReceipts && targetReceipts.length > 0) {
        const monthly: Record<string, { revenue: number, count: number }> = {};
        targetReceipts.forEach(r => {
          const date = safeToDate(r.createdAt);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!monthly[key]) monthly[key] = { revenue: 0, count: 0 };
          monthly[key].revenue += (r.total || 0);
          monthly[key].count += 1;
        });
        results = Object.entries(monthly).map(([month, data]) => ({ month, revenue: data.revenue, count: data.count }));
      }
    }

    // 🚨 Inject ALL Pending Offline Revenue into corresponding month aggregates!
    queuedActions.filter(a => a.type === 'complete-sale' && a.status === 'pending').forEach(action => {
      const receipt = action.payload.receiptData;
      if (receipt) {
        const rDate = safeToDate(receipt.createdAt || new Date(action.timestamp));
        const key = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`;
        
        const existing = results.find(m => m.month === key);
        if (existing) {
          existing.revenue += (receipt.total || 0);
          existing.count += 1;
        } else {
          results.push({ month: key, revenue: receipt.total || 0, count: 1 });
        }
      }
    });

    return results.sort((a,b) => b.month.localeCompare(a.month)).slice(0, monthCount);
  }, [businessId, firestore, syncedReceipts, receipts, queuedActions, isRealOnline, activeBranchId]);


  const value: POSContextType = useMemo(() => ({
    business, products, receipts, customers, onlineOrders, currentUserProfile: profile, 
    isLoading: (isUserLoading && !offlineProfile) ||
               (!!user && !businessId) ||
               (isLoadingBusiness && !business) || 
               ((() => {
                 const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
                 /*
                  * The product terms all route through `isProductCatalogPending`
                  * now. They used to test `!hasFullSyncedProducts` directly, which
                  * was only safe because `fetchFullProducts` set that flag in a
                  * `finally` — including after a throw. With the flag set on
                  * success alone, a failed sync would leave this stuck true and
                  * hang the whole shell, so the terminal cases live in one place
                  * that is guaranteed to resolve.
                  */
                 if (isTauri) {
                   return isProductCatalogPending;
                 }
                 return isProductCatalogPending ||
                        ((!customers || customers.length === 0) && !hasFullSyncedCustomers && isRealOnline) ||
                        ((!receipts || receipts.length === 0) && !hasFullSyncedReceipts && isRealOnline) ||
                        (isFullSyncingCustomers && (!customers || customers.length === 0) && isRealOnline && !hasFullSyncedCustomers);
               })()) ||
               !isMounted, 
    isUserLoading: isUserLoading || (!!user && !profile), 
    user, firestore,
    isProfileReady,
    cart, addToCart, removeFromCart, updateQuantity, updateCartItemPrice, clearCart,
    selectedCustomer, selectCustomer: setSelectedCustomer,
    subtotal, tax, taxRate, discount, total, setTax: setTaxRate, setDiscount,
      paymentMethod,
      setPaymentMethod,
      amountReceived,
      setAmountReceived,
      autoPrint,
      setAutoPrint,
      resetPOS, currencySymbol, currencyCode, triggerRefresh,
    isConfettiActive, triggerConfetti, setIsConfettiActive,
    queuedActions, isQueueProcessing, addToQueue, processQueue, clearFailedActions: () => {}, updateQueuedAction: () => {}, addProductWithImage, removeFromQueue: () => {},
    mutateBusiness, isSyncing, isFullSyncingCustomers, isFullSyncingProducts, isFullSyncingReceipts, optimisticProducts: [],
    isProductCatalogPending, productSyncError, isCatalogUnverified, retryProductSync,

    impersonatedUserId, impersonateUser, stopImpersonation, isImpersonating,
    searchCustomers, searchCustomersByField, findExistingCustomer, allCustomersUnfiltered: allCustomers, searchReceipts: async () => [],
    fetchReceiptsInRange, searchProducts, searchProductsByField, findProductBySku,
    fetchDetailedAnalytics, 
    fetchMonthlyAnalytics,
    fetchMoreReceipts: async () => 0, fetchMoreCustomers: async () => 0, fetchMoreProducts: async () => 0,

    heldSales, holdCurrentSale, resumeHeldSale, deleteHeldSale, voidReceipt,
    users, auditLogs,
    isOnline: isRealOnline,

    stats, 
    isSubscriptionActive: resolveSubscriptionActive(business)
  }), [business, products, receipts, customers, onlineOrders, currentUserProfile, isUserLoading, user, firestore, cart, selectedCustomer, taxRate, discount, paymentMethod, amountReceived, autoPrint, isConfettiActive, triggerRefresh, triggerConfetti, queuedActions, isQueueProcessing, addToQueue, processQueue, mutateBusiness, isSyncing, isFullSyncingCustomers, isFullSyncingProducts, isFullSyncingReceipts, isProductCatalogPending, productSyncError, isCatalogUnverified, retryProductSync, impersonatedUserId, isImpersonating, stats, currencySymbol, currencyCode, subtotal, tax, total, impersonateUser, stopImpersonation, searchCustomers, searchProducts, fetchDetailedAnalytics, fetchMonthlyAnalytics, isProfileReady, isLoadingBusiness, isLoadingProducts, isLoadingCustomers, isMounted, heldSales, voidReceipt, users, auditLogs, isRealOnline]);

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

export const usePOS = () => {
  const context = useContext(POSContext);
  if (context === undefined) throw new Error('usePOS must be used within a POSProvider');
  return context;
};

export const useBusiness = () => {
  const context = useContext(POSContext);
  if (context === undefined) throw new Error('useBusiness must be used within a POSProvider');
  return context.business;
};
