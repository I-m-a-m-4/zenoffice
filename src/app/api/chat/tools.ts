import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { runForensicScan, summariseReport } from '@/lib/forensics';

// Deterministic product matching and bulk arithmetic, shared with the importer. The
// model supplies names and percentages; these decide which product and what number, so
// a paraphrase can never resolve to the wrong row and no value is model-authored.
import { buildProductIndex } from '@/lib/import/match';
import { resolveOne } from '@/lib/import/cost-prices';
import { describeBulkOp, previewBulkOp } from '@/lib/import/bulk-ops';

/**
 * Zen AI's toolkit.
 *
 * Split out of `route.ts` because it outgrew it — the route now only handles
 * auth, quotas and streaming.
 *
 * ── Two rules every tool here follows ──────────────────────────────────────
 *
 * 1. NEVER add a `.where()` that needs a composite index we do not ship in
 *    `firestore.indexes.json`. The receipts indexes cover
 *    `businessId + createdAt` (and `+ total`, `+ customer.id`) and nothing
 *    else. In particular there is NO `businessId + status + createdAt` index,
 *    so `status` is always filtered in memory. Adding it to the query makes
 *    the tool throw "The query requires an index" at runtime — which is what
 *    silently broke getSalesMetrics and getTopSellingProducts.
 *
 * 2. Every tool returns a plain object and never throws. Errors come back as
 *    `{ error }` so the model can explain them instead of killing the stream.
 *
 * Outputs carry a `type` discriminator the client switches on to render
 * generative UI (see `src/components/ai-insights/tool-renderer.tsx`):
 *   PROPOSAL       — write approval card
 *   PRODUCT_LIST   — POS-style product cards
 *   PRODUCT_PICKER — "did you mean…" disambiguation
 *   METRICS        — stat tiles
 *   TABLE          — ranked rows
 * Anything without a `type` is summarised by the model as prose.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86400000;

/** Firestore Timestamp | Date | ISO string | millis → millis (0 if unusable). */
function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  // A Timestamp that has been through JSON — the Admin SDK's own serialised
  // shape. Without this it falls through to 0 and the receipt reads as undated.
  if (typeof value?._seconds === 'number') return value._seconds * 1000;
  return 0;
}

/**
 * Daily revenue buckets over a window, and an honest account of what did not fit.
 *
 * Every day-by-day tool needs this, and each used to inline it — which is how
 * two of them ended up *silently discarding* receipts. The old shape was
 * `if (buckets.has(key))`, so a receipt whose `createdAt` was unreadable (key
 * `1970-01-01`) or dated ahead of today simply vanished, and the tool then
 * reported the sum of the surviving buckets as the period's revenue. That is how
 * one tool could answer "millions in the last 7 days" while another answered
 * "₦22,090 across the last 90" from the same collection: the first bounded its
 * window explicitly, the second dropped whatever the buckets could not place and
 * never said so.
 *
 * A total that quietly excludes rows is worse than a total that admits a gap, so
 * the misses come back as counts for the caller to surface.
 */
function bucketByDay(
  receipts: any[],
  days: number,
): {
  /** Day key → revenue, oldest first. One entry per day in the window, zeros included. */
  daily: Map<string, number>;
  /** Receipts placed in a bucket. */
  counted: number;
  /** Receipts whose `createdAt` could not be read at all. */
  undated: number;
  /** Receipts dated after today — a wrong device clock or a bad backdate. */
  future: number;
  /** Receipts older than the window. Expected on a cache hit; not an error. */
  older: number;
  /**
   * Revenue of the receipts that are genuinely broken — undated or future-dated.
   * Deliberately excludes `older`, which is why this is not simply "everything
   * that missed a bucket": a receipt from before the window did not fail to be
   * placed, it was never in scope. `receiptsSince()` normally filters those out,
   * but a cache hit can hand over the whole book, and folding them in here would
   * make the note below announce most of the shop's lifetime takings as a data
   * problem. Zero means the day-by-day figures are whole.
   */
  brokenRevenue: number;
} {
  const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const now = Date.now();

  const daily = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) daily.set(dayKey(now - i * DAY_MS), 0);

  const todayKey = dayKey(now);
  const oldestKey = dayKey(now - (days - 1) * DAY_MS);

  let counted = 0, undated = 0, future = 0, older = 0, brokenRevenue = 0;

  for (const r of receipts) {
    const amount = r.total ?? 0;
    const ms = toMillis(r.createdAt);

    if (!ms) { undated++; brokenRevenue += amount; continue; }

    const key = dayKey(ms);
    if (key > todayKey) { future++; brokenRevenue += amount; continue; }
    if (key < oldestKey) { older++; continue; }

    daily.set(key, round2((daily.get(key) ?? 0) + amount));
    counted++;
  }

  return { daily, counted, undated, future, older, brokenRevenue: round2(brokenRevenue) };
}

/**
 * The sentence a tool adds when bucketing could not place everything. Null when
 * nothing was dropped, so a clean read carries no noise.
 */
function unplacedNote(b: ReturnType<typeof bucketByDay>, currency: string): string | null {
  const parts: string[] = [];
  if (b.undated) parts.push(`${b.undated} with no readable date`);
  if (b.future) parts.push(`${b.future} dated in the future (check the device clock)`);
  if (!parts.length) return null;
  return `${parts.join(' and ')} — ${currency}${b.brokenRevenue.toLocaleString()} of takings — could not be placed on a day and is excluded from the figures above. The day-by-day totals are therefore lower than this shop's true revenue.`;
}


const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Only 'paid' receipts count as revenue. Legacy docs have no status — treat
 *  those as paid, which is how the rest of the app reads them. */
const isPaid = (r: any) => (r.status ?? 'paid') === 'paid';

/**
 * A service has no stock to run out of.
 *
 * Services live in the same `products` collection and carry `stock: 0` because
 * the field is shared, not because there is none left. Every stock alert has to
 * skip them, or Zen AI tells an owner to restock a haircut and buries the items
 * that genuinely did run out. Mirrors `isService` on the inventory page.
 */
const isServiceItem = (p: any) =>
  p?.categoryType === 'service' ||
  String(p?.category ?? '').toLowerCase() === 'service' ||
  String(p?.category ?? '').toLowerCase() === 'services';

const PERIOD_DAYS: Record<string, number> = {
  today: 1, yesterday: 1, last7days: 7, last30days: 30, last90days: 90, thisMonth: 31, lastMonth: 31,
};

/** Resolve a named period to an absolute [start, end) window. */
function periodRange(period: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case 'today':
      return { start: midnight, end: new Date(midnight.getTime() + DAY_MS), label: 'Today' };
    case 'yesterday':
      return { start: new Date(midnight.getTime() - DAY_MS), end: midnight, label: 'Yesterday' };
    case 'last7days':
      return { start: new Date(now.getTime() - 7 * DAY_MS), end: now, label: 'Last 7 days' };
    case 'last30days':
      return { start: new Date(now.getTime() - 30 * DAY_MS), end: now, label: 'Last 30 days' };
    case 'last90days':
      return { start: new Date(now.getTime() - 90 * DAY_MS), end: now, label: 'Last 90 days' };
    case 'thisMonth':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, label: 'This month' };
    case 'lastMonth':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 1),
        label: 'Last month',
      };
    default:
      return { start: midnight, end: new Date(midnight.getTime() + DAY_MS), label: 'Today' };
  }
}

/**
 * Similarity of a query to a product name, 0..1.
 *
 * Deliberately simple (no dependency): exact > prefix > substring > shared
 * word > character bigram overlap. Good enough to catch typos and short forms
 * ("cetaphil" → "Cetaphil Moisturizing Cream 250g") which is all the
 * disambiguation picker needs.
 */
/**
 * Least-squares fit over an evenly-spaced series.
 *
 * Deliberately plain: a straight line through daily takings is honest about
 * being a run-rate, where a fancier model would imply a precision this data
 * does not have. `r2` is reported so callers can label their own confidence
 * rather than presenting every projection as equally sound.
 */
function linearFit(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r2: 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (values[i] - (intercept + slope * i)) ** 2;
    ssTot += (values[i] - meanY) ** 2;
  }
  // A flat series has no variance to explain; calling that a perfect fit would
  // be misleading, so report no confidence instead of dividing by zero.
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

/**
 * How far a projection can be trusted. Past a few months a POS history is a
 * run-rate and nothing more, so the label has to say so — the model quotes
 * this rather than inventing its own hedge.
 */
function horizonConfidence(days: number, r2: number, daysWithSales: number): { level: string; caveat: string } {
  if (days <= 30 && r2 >= 0.5 && daysWithSales >= 14) {
    return { level: 'reasonable', caveat: 'Short-horizon projection from a clear trend. Still an estimate, not a promise.' };
  }
  if (days <= 90) {
    return { level: 'rough', caveat: 'A quarter out is a rough run-rate. It assumes trading conditions hold.' };
  }
  if (days <= 365) {
    return { level: 'speculative', caveat: 'A year out from till data is speculative. It ignores seasonality, price changes, competition and anything you plan to do differently.' };
  }
  return {
    level: 'illustrative only',
    caveat:
      'Beyond a year this is arithmetic, not a forecast — it just repeats your current run-rate. Real multi-year outcomes depend on decisions and conditions no sales history can see. Treat it as a "if nothing at all changes" figure.',
  };
}

function similarity(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  const t = (target ?? '').trim().toLowerCase();
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (t.startsWith(q)) return 0.95;
  if (t.includes(q)) return 0.85;

  const qWords = q.split(/\s+/).filter(Boolean);
  const tWords = t.split(/\s+/).filter(Boolean);
  const shared = qWords.filter((w) => tWords.some((tw) => tw.startsWith(w) || w.startsWith(tw)));
  if (shared.length) return 0.5 + 0.3 * (shared.length / Math.max(qWords.length, 1));

  const bigrams = (s: string) => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const a = bigrams(q);
  const b = bigrams(t);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((g) => { if (b.has(g)) overlap++; });
  return (2 * overlap) / (a.size + b.size);
}

/** Trim a product doc to what the UI card and the model actually need. */
function slimProduct(p: any) {
  return {
    id: p.id,
    name: p.name ?? 'Unnamed',
    sku: p.sku ?? null,
    category: p.category ?? null,
    categoryType: p.categoryType ?? 'product',
    price: p.price ?? 0,
    costPrice: p.costPrice ?? null,
    stock: p.stock ?? 0,
    lowStockThreshold: p.lowStockThreshold ?? 5,
    imageUrl: p.imageUrl ?? null,
    baseUnit: p.baseUnit ?? null,
    expiryDate: p.expiryDate ? new Date(toMillis(p.expiryDate)).toISOString() : null,
  };
}

type Stat = { label: string; value: any; format?: 'currency' | 'percent' | 'number' | 'text' };

/**
 * Build the card half of a `PRODUCT_TABLE` result.
 *
 * Five tools answer questions that are *about products* — reorder list, margins,
 * best and worst sellers, stockout forecast — but used to return only `columns`
 * and `rows`, so the chat rendered a spreadsheet where the owner expected the
 * product cards they see everywhere else in the app. These results now carry
 * both shapes: `products` for the card view, `columns`/`rows` untouched for the
 * table view, and the reader picks. Keeping the table payload byte-identical is
 * deliberate — the toggle can always fall back to the view that already worked.
 *
 * `stats` is the tool-specific half of each card: whatever figures made the row
 * worth showing. It is a generic label/value/format list so ProductCard renders
 * it without knowing which tool produced it.
 *
 * `p` may be undefined: a top seller can be deleted from the catalogue while its
 * receipts survive, and the name on the receipt is then all that is left. Those
 * are marked `deleted` so the card can say so instead of showing a real product
 * priced at zero with no stock.
 */
function productCards(entries: Array<{ p?: any; name?: string; stats: Stat[] }>) {
  return entries.map(({ p, name, stats }) =>
    p
      ? { ...slimProduct(p), stats }
      : {
          id: `deleted:${name ?? 'unknown'}`,
          name: name ?? 'Unnamed',
          sku: null, category: null, categoryType: 'product',
          price: null, costPrice: null, stock: null, lowStockThreshold: 5,
          imageUrl: null, baseUnit: null, expiryDate: null,
          deleted: true, stats,
        },
  );
}

type Ctx = {
  db: Firestore;
  businessId: string;
  currency: string;
  /**
   * Whether the shop has opted in to the business rating
   * (`settings.ratingEnabled`). False means `getBusinessRating` refuses rather
   * than scores — see the note on that tool.
   */
  ratingEnabled: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Every route `linkToPage` may point at, kept in sync with the actual
 * `src/app/(app)/**\/page.tsx` tree by hand. Missing a real page here is what
 * turned "open bulk import" into two identical red error cards instead of one
 * useful link — keep this list honest when a route is added or removed.
 *
 * `/onboarding` is the one real page deliberately left out: it is the pre-setup
 * flow, not somewhere to send an owner who is already trading.
 */
const APP_ROUTES = new Set([
  '/dashboard', '/reports', '/inventory', '/inventory/add', '/inventory/debts',
  '/inventory/details', '/inventory/troubleshoot', '/customers', '/customers/details',
  '/receipts', '/invoices', '/audit-log', '/settings', '/settings/branches',
  '/users', '/online-orders', '/product-items', '/achievements', '/billing',
  '/notifications', '/terminal-alerts', '/support', '/storefront',
  '/sales/pos/select-products', '/sales/pos/customer', '/sales/pos/payment', '/sales/pos/review',
  '/ai-insights', '/ai-insights/use-cases',
]);

/** One-line context shown under the link card, keyed by the same paths. */
const ROUTE_HINTS: Record<string, string> = {
  '/inventory': 'Bulk import, add products, adjust stock — the Import button is at the top of this page.',
  '/inventory/add': 'Add one product with full detail.',
  '/inventory/debts': 'Unpaid supplier balances.',
  '/inventory/troubleshoot': 'Data health checks for inventory records.',
  '/reports': 'Sales, inventory and customer reports.',
  '/receipts': 'Every past sale.',
  '/invoices': 'Outstanding and paid invoices.',
  '/customers': 'Customer directory and loyalty.',
  '/settings/branches': 'Manage branches and locations.',
  '/audit-log': 'Every change made to your data, by whom and when.',
  '/sales/pos/select-products': 'Start a new sale.',
};

/**
 * Walkthroughs for things the app does through a dialog or a multi-step page,
 * where there is no single route to link to. Written from the actual UI — the
 * CSV header list below is `HEADER_MAPPINGS` in
 * `src/components/inventory/import-dialog.tsx`, so update both together.
 *
 * The model picks a topic; it never writes the steps itself. An invented
 * walkthrough for a screen that does not look like that is worse than no
 * answer, because the owner goes looking for a button that isn't there.
 */
const WORKFLOWS: Record<string, { title: string; intro: string; steps: string[]; href?: string; hrefLabel?: string; tips?: string[] }> = {
  bulkImport: {
    title: 'Bulk import products from a spreadsheet',
    intro: 'Import lives on the Inventory page as a dialog, not a page of its own.',
    steps: [
      'Open Inventory and tap the Import button at the top of the page.',
      'Save your spreadsheet as CSV — up to 10MB. Excel files must be exported to CSV first.',
      'Make sure it has at least a Name column and a Price column. Without both, the import is refused.',
      'Upload the file. Every row is previewed with what was matched before anything is saved.',
      'Check the preview, then confirm to import.',
    ],
    tips: [
      'Column names are matched loosely, so a WooCommerce or Shopify export usually works as-is: Regular Price, Qty, Image Src and Product Name are all understood.',
      'Optional columns worth including: SKU, Category, Cost Price, Stock, Description and Image URL. Cost Price is what makes margin reporting work later.',
      'Products already in your inventory are matched rather than duplicated.',
    ],
    href: '/inventory',
    hrefLabel: 'Open Inventory',
  },
  recordSale: {
    title: 'Record a sale on the POS',
    intro: 'Four steps, and you can leave at any point without losing the basket.',
    steps: [
      'Open the POS and pick your products — scan a barcode or search by name.',
      'Attach a customer, or continue as a walk-in.',
      'Take payment: cash, transfer, card, or split across several methods.',
      'Review and confirm. Stock comes down and the receipt is issued at that point, not before.',
    ],
    tips: [
      'A sale can be held and resumed later if a customer steps away.',
      'Selling offline is fine — it queues and syncs when you reconnect.',
    ],
    href: '/sales/pos/select-products',
    hrefLabel: 'Start a sale',
  },
  addProduct: {
    title: 'Add a single product',
    intro: 'For one item at a time. Use bulk import for a whole catalogue.',
    steps: [
      'Open Inventory and tap Add Product.',
      'Fill in the name and selling price — everything else is optional.',
      'Set the cost price if you know it, so margin and profit figures work.',
      'Set a low stock threshold so you get warned before you run out.',
      'Save.',
    ],
    href: '/inventory/add',
    hrefLabel: 'Add a product',
  },
  lowStockThreshold: {
    title: 'Set up low stock warnings',
    intro: 'Each product carries its own threshold, so fast movers can warn earlier.',
    steps: [
      'Open Inventory and pick the product.',
      'Set its low stock threshold to the count where you want to be warned.',
      'Save. It appears in low-stock alerts as soon as it drops to that number.',
    ],
    tips: ['Ask me "what should I restock?" and I can suggest thresholds from how fast each item actually sells.'],
    href: '/inventory',
    hrefLabel: 'Open Inventory',
  },
  addBranch: {
    title: 'Add a branch',
    intro: 'Each branch keeps its own stock counts and its own sales figures.',
    steps: [
      'Open Settings, then Branches.',
      'Add the branch with its name and location.',
      'Assign staff to it from the Users page.',
      'Switch branches from the selector in the header.',
    ],
    href: '/settings/branches',
    hrefLabel: 'Manage branches',
  },
  refund: {
    title: 'Refund or return a sale',
    intro: 'Refunds start from the original receipt, so stock goes back correctly.',
    steps: [
      'Open Receipts and find the sale.',
      'Open it and choose the refund or return option.',
      'Pick which items are coming back and how much is being refunded.',
      'Confirm. Stock is returned and the refund is written to the audit log.',
    ],
    href: '/receipts',
    hrefLabel: 'Open Receipts',
  },
  addStaff: {
    title: 'Add a staff member',
    intro: 'Staff get their own login, and their role decides what they can reach.',
    steps: [
      'Open the Users page and invite the staff member.',
      'Choose their role — this controls what they can see and change.',
      'Assign them to a branch if you run more than one.',
      'They set their own password on first sign-in.',
    ],
    tips: ['Every action a staff member takes is recorded in the audit log against their name.'],
    href: '/users',
    hrefLabel: 'Open Users',
  },
  invoice: {
    title: 'Send an invoice',
    intro: 'For customers paying later rather than at the counter.',
    steps: [
      'Open Invoices and create a new one.',
      'Pick the customer and add the items.',
      'Set the due date.',
      'Save and send it. It shows as outstanding until you mark it paid.',
    ],
    tips: ['Ask me "who owes me money?" for everything outstanding, oldest first.'],
    href: '/invoices',
    hrefLabel: 'Open Invoices',
  },
  stocktake: {
    title: 'Do a stock count',
    intro: 'Bringing the system in line with what is physically on the shelf.',
    steps: [
      'Count what you actually have, category by category.',
      'Ask me for the current count of anything as you go.',
      'Where they differ, tell me the real number and I will draw up an adjustment for you to approve.',
      'Approving it corrects the count and records why in the audit log.',
    ],
    tips: ['I never change stock myself — you approve every adjustment, and it is re-checked against live data at that moment.'],
    href: '/inventory',
    hrefLabel: 'Open Inventory',
  },
  loyalty: {
    title: 'Run customer loyalty',
    intro: 'Points accrue on sales and can be redeemed against future ones.',
    steps: [
      'Turn loyalty on in Settings and set what a point is worth.',
      'Attach a customer to sales at the POS so their points accrue.',
      'Points build automatically as they spend.',
      'Redeem them at payment time on a later sale.',
    ],
    href: '/customers',
    hrefLabel: 'Open Customers',
  },
};

function buildZenTools({ db, businessId, currency, ratingEnabled }: Ctx) {
  // Per-request caches. A single turn can call six tools that all need the
  // same receipts; without this that is six identical Firestore reads.
  let productCache: any[] | null = null;
  const receiptCache = new Map<number, any[]>();

  async function allProducts(): Promise<any[]> {
    if (productCache) return productCache;
    const snap = await db.collection('products').where('businessId', '==', businessId).get();
    productCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return productCache;
  }

  /** Receipts created within the last `days`. Widest window wins the cache. */
  async function receiptsSince(days: number): Promise<any[]> {
    const cached = [...receiptCache.entries()].find(([d]) => d >= days);
    if (cached) {
      const cutoff = Date.now() - days * DAY_MS;
      return cached[1].filter((r) => toMillis(r.createdAt) >= cutoff);
    }
    const start = new Date(Date.now() - days * DAY_MS);
    const snap = await db
      .collection('receipts')
      .where('businessId', '==', businessId)
      .where('createdAt', '>=', Timestamp.fromDate(start))
      .get();
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    receiptCache.set(days, rows);
    return rows;
  }

  /** Paid receipts inside an absolute window. */
  async function paidBetween(start: Date, end: Date): Promise<any[]> {
    const days = Math.max(1, Math.ceil((Date.now() - start.getTime()) / DAY_MS));
    const rows = await receiptsSince(days);
    const s = start.getTime();
    const e = end.getTime();
    return rows.filter((r) => {
      const t = toMillis(r.createdAt);
      return t >= s && t < e && isPaid(r);
    });
  }

  /** Units sold per productId over `days`, for velocity maths. */
  async function unitsSold(days: number): Promise<Map<string, number>> {
    const rows = (await receiptsSince(days)).filter(isPaid);
    const sold = new Map<string, number>();
    for (const r of rows) {
      for (const item of r.items ?? []) {
        if (!item?.productId) continue;
        sold.set(item.productId, (sold.get(item.productId) ?? 0) + (item.quantity ?? 0));
      }
    }
    return sold;
  }

  const money = (label: string, value: number, hint?: string) => ({
    label, value: round2(value), format: 'currency' as const, currency, hint,
  });
  const count = (label: string, value: number, hint?: string) => ({
    label, value, format: 'number' as const, hint,
  });
  const percent = (label: string, value: number, hint?: string) => ({
    label, value: round2(value), format: 'percent' as const, hint,
  });

  const fail = (what: string, e: any) => ({ error: `${what}: ${e?.message ?? 'unknown error'}` });

  return {
    // ═══════════════════════════════════════════════════════════════════════
    // INVENTORY — read
    // ═══════════════════════════════════════════════════════════════════════

    queryExpenses: tool({
      description: 'Retrieve operating expenses logged by the business. Use this to read the expenses data.',
      inputSchema: z.object({
        limit: z.number().min(1).max(200).default(50).describe('Max results to fetch.'),
      }),
      execute: async ({ limit }) => {
        try {
          const snap = await db.collection('expenses')
            .where('businessId', '==', businessId)
            .limit(limit)
            .get();
          const expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          return { type: 'EXPENSES_LIST', total: expenses.length, expenses };
        } catch (e: any) { return fail('Failed to query expenses', e); }
      }
    }),

    queryPurchases: tool({
      description: 'Retrieve supplier purchase orders logged by the business. Use this to read the purchases data.',
      inputSchema: z.object({
        limit: z.number().min(1).max(200).default(50).describe('Max results to fetch.'),
      }),
      execute: async ({ limit }) => {
        try {
          const snap = await db.collection('supplier_purchases')
            .where('businessId', '==', businessId)
            .limit(limit)
            .get();
          const purchases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          return { type: 'PURCHASES_LIST', total: purchases.length, purchases };
        } catch (e: any) { return fail('Failed to query purchases', e); }
      }
    }),

    queryProducts: tool({
      description:
        'Search and retrieve products from inventory (stock levels, prices, categories). Returns product cards. READ-ONLY. If the user named a product loosely or you are unsure which item they mean, use findSimilarProducts instead.',
      inputSchema: z.object({
        searchTerm: z.string().optional().describe('Product name or SKU keyword.'),
        category: z.string().optional().describe('Filter by exact category.'),
        lowStockOnly: z.boolean().optional().describe('Only items at or below their low stock threshold.'),
        limit: z.number().min(1).max(50).default(12).describe('Max results.'),
      }),
      execute: async ({ searchTerm, category, lowStockOnly, limit }) => {
        try {
          let products = await allProducts();
          if (category) {
            const c = category.toLowerCase();
            products = products.filter((p) => (p.category ?? '').toLowerCase() === c);
          }
          if (searchTerm) {
            const q = searchTerm.toLowerCase();
            products = products
              .map((p) => ({ p, score: Math.max(similarity(q, p.name), (p.sku ?? '').toLowerCase() === q ? 1 : 0) }))
              .filter((x) => x.score > 0.34)
              .sort((a, b) => b.score - a.score)
              .map((x) => x.p);
          }
          if (lowStockOnly) {
            products = products.filter((p) => !isServiceItem(p) && (p.stock ?? 0) <= (p.lowStockThreshold ?? 5));
          }
          const total = products.length;
          return {
            type: 'PRODUCT_LIST',
            title: searchTerm ? `Results for "${searchTerm}"` : lowStockOnly ? 'Low stock items' : 'Inventory',
            totalMatches: total,
            shown: Math.min(total, limit ?? 12),
            currency,
            products: products.slice(0, limit ?? 12).map(slimProduct),
          };
        } catch (e: any) { return fail('Failed to query products', e); }
      },
    }),

    findSimilarProducts: tool({
      description:
        'Resolve an ambiguous product name to a specific item. Use this FIRST whenever the user names a product and you are not certain which one they mean — it returns a picker the user can click. If exactly one confident match exists it resolves automatically.',
      inputSchema: z.object({
        name: z.string().describe('The product name the user typed, verbatim.'),
        limit: z.number().min(2).max(8).default(5).describe('Max candidates to offer.'),
      }),
      execute: async ({ name, limit }) => {
        try {
          const products = await allProducts();
          const scored = products
            .map((p) => ({ product: p, score: similarity(name, p.name) }))
            .filter((x) => x.score > 0.3)
            .sort((a, b) => b.score - a.score);

          if (scored.length === 0) {
            return { type: 'PRODUCT_PICKER', query: name, resolved: false, candidates: [], note: `No product resembling "${name}" exists in this inventory.` };
          }
          const [best, next] = scored;

          /*
           * An exact name match is an answer, not a candidate. This used to be
           * folded into the gap rule below, which made the picker inescapable:
           * `similarity` scores an exact hit 1.0 and a prefix-sharing sibling
           * 0.8 (0.5 + 0.3 for the shared word), so "Semoliva" against
           * "Semoliva"/"Semo" left a gap of exactly 0.2 — and the rule demanded
           * strictly more than 0.2. Every tap on the picker re-sent the name and
           * drew the same picker again, forever.
           *
           * Only shortcut when one product owns the name. Two items genuinely
           * called the same thing still have to be disambiguated by the user.
           */
          const exact = scored.filter((x) => x.score === 1);
          if (exact.length === 1) {
            return { type: 'PRODUCT_LIST', title: `Matched "${name}"`, resolved: true, totalMatches: 1, shown: 1, currency, products: [slimProduct(exact[0].product)] };
          }

          // Otherwise: near-certain, and clearly ahead of the runner-up.
          if (best.score >= 0.95 && (!next || best.score - next.score >= 0.2)) {
            return { type: 'PRODUCT_LIST', title: `Matched "${name}"`, resolved: true, totalMatches: 1, shown: 1, currency, products: [slimProduct(best.product)] };
          }
          return {
            type: 'PRODUCT_PICKER',
            query: name,
            resolved: false,
            currency,
            note: 'Ask the user which one they meant before acting.',
            candidates: scored.slice(0, limit ?? 5).map((x) => ({ ...slimProduct(x.product), confidence: round2(x.score) })),
          };
        } catch (e: any) { return fail('Failed to search products', e); }
      },
    }),

    getProductDetails: tool({
      description: 'Full detail for one product by its document ID, including sales velocity and days of stock cover.',
      inputSchema: z.object({ productId: z.string().describe('Firestore document ID of the product.') }),
      execute: async ({ productId }) => {
        try {
          const doc = await db.collection('products').doc(productId).get();
          if (!doc.exists) return { error: 'Product not found.' };
          const data: any = { id: doc.id, ...doc.data() };
          if (data.businessId !== businessId) return { error: 'Product not found.' };

          const sold30 = (await unitsSold(30)).get(productId) ?? 0;
          const perDay = sold30 / 30;
          const stock = data.stock ?? 0;
          return {
            // PRODUCT_DETAIL renders one product large, with its photo — the
            // grid tile is right for scanning a list and too small when the
            // owner asked about this one item.
            type: 'PRODUCT_DETAIL',
            title: data.name,
            currency,
            product: slimProduct(data),
            velocity: {
              unitsSoldLast30Days: sold30,
              unitsPerDay: round2(perDay),
              daysOfCover: perDay > 0 ? Math.floor(stock / perDay) : null,
              margin: data.costPrice ? round2(((data.price - data.costPrice) / data.price) * 100) : null,
            },
          };
        } catch (e: any) { return fail('Failed to load product', e); }
      },
    }),

    showProductImage: tool({
      description:
        "Show a product's photo, by name. Use this when the user asks to see, view or look at a product, or asks what it looks like. Returns the picture at full size with its price and stock. If the name is ambiguous this returns a picker instead — do not guess.",
      inputSchema: z.object({
        name: z.string().describe('The product name the user typed, verbatim.'),
      }),
      execute: async ({ name }) => {
        try {
          const products = await allProducts();
          const scored = products
            .map((p) => ({ product: p, score: similarity(name, p.name) }))
            .filter((x) => x.score > 0.3)
            .sort((a, b) => b.score - a.score);

          if (scored.length === 0) {
            return { error: `No product resembling "${name}" exists in this inventory.` };
          }

          // Same confidence rule as findSimilarProducts: one clear winner or
          // hand it back to the user. Showing the wrong bottle is worse than
          // asking, and the picker is one tap.
          const [best, next] = scored;
          const confident = best.score >= 0.95 && (!next || best.score - next.score > 0.2);
          if (!confident) {
            return {
              type: 'PRODUCT_PICKER',
              query: name,
              resolved: false,
              currency,
              note: 'Ask the user which one they meant before showing a photo.',
              candidates: scored.slice(0, 5).map((x) => ({ ...slimProduct(x.product), confidence: round2(x.score) })),
            };
          }

          const data = best.product;
          const sold30 = (await unitsSold(30)).get(data.id) ?? 0;
          const perDay = sold30 / 30;
          return {
            type: 'PRODUCT_DETAIL',
            title: data.name,
            currency,
            product: slimProduct(data),
            // Tell the model rather than the user — the card already says
            // "No photo on this product", so a prose repeat is noise. This
            // exists so the model can offer to add one.
            hasImage: Boolean(data.imageUrl),
            velocity: {
              unitsSoldLast30Days: sold30,
              unitsPerDay: round2(perDay),
              daysOfCover: perDay > 0 ? Math.floor((data.stock ?? 0) / perDay) : null,
              margin: data.costPrice ? round2(((data.price - data.costPrice) / data.price) * 100) : null,
            },
          };
        } catch (e: any) { return fail('Failed to load product image', e); }
      },
    }),

    getLowStockAlerts: tool({
      description: 'List every item at or below its low stock threshold, most urgent first.',
      inputSchema: z.object({ limit: z.number().min(1).max(60).default(25).describe('Max items to return.') }),
      execute: async ({ limit }) => {
        try {
          const items = (await allProducts())
            .filter((p) => !isServiceItem(p) && (p.stock ?? 0) <= (p.lowStockThreshold ?? 5))
            .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
          return {
            type: 'PRODUCT_LIST',
            title: 'Low stock',
            totalMatches: items.length,
            shown: Math.min(items.length, limit ?? 25),
            currency,
            products: items.slice(0, limit ?? 25).map(slimProduct),
          };
        } catch (e: any) { return fail('Failed to fetch low stock data', e); }
      },
    }),

    getInventoryValuation: tool({
      description: 'Total value of inventory on hand, at cost and at retail, with potential profit locked in stock.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const products = await allProducts();
          let atCost = 0, atRetail = 0, units = 0, missingCost = 0;
          for (const p of products) {
            const stock = Math.max(0, p.stock ?? 0);
            units += stock;
            atRetail += stock * (p.price ?? 0);
            if (p.costPrice != null) atCost += stock * p.costPrice; else missingCost++;
          }
          return {
            type: 'METRICS',
            title: 'Inventory valuation',
            tiles: [
              money('Retail value', atRetail),
              money('Cost value', atCost),
              money('Potential profit', atRetail - atCost),
              count('Units on hand', units),
              count('SKUs', products.length),
            ],
            caveat: missingCost > 0 ? `${missingCost} product(s) have no cost price, so cost value is understated.` : null,
          };
        } catch (e: any) { return fail('Failed to value inventory', e); }
      },
    }),

    getDeadStock: tool({
      description: 'Products that have not sold at all in a given number of days, with the capital tied up in them.',
      inputSchema: z.object({
        days: z.number().min(7).max(365).default(60).describe('Days with zero sales to qualify as dead.'),
        limit: z.number().min(1).max(40).default(15),
      }),
      execute: async ({ days, limit }) => {
        try {
          const sold = await unitsSold(days);
          const dead = (await allProducts())
            .filter((p) => (p.stock ?? 0) > 0 && !sold.has(p.id))
            .map((p) => ({ ...slimProduct(p), capitalTiedUp: round2((p.stock ?? 0) * (p.costPrice ?? p.price ?? 0)) }))
            .sort((a, b) => b.capitalTiedUp - a.capitalTiedUp);
          return {
            type: 'PRODUCT_LIST',
            title: `No sales in ${days} days`,
            totalMatches: dead.length,
            shown: Math.min(dead.length, limit ?? 15),
            currency,
            totalCapitalTiedUp: round2(dead.reduce((s, d) => s + d.capitalTiedUp, 0)),
            products: dead.slice(0, limit ?? 15),
          };
        } catch (e: any) { return fail('Failed to find dead stock', e); }
      },
    }),

    getExpiringProducts: tool({
      description: 'Products whose expiry date falls within the next N days, or already expired.',
      inputSchema: z.object({ withinDays: z.number().min(1).max(365).default(30) }),
      execute: async ({ withinDays }) => {
        try {
          const now = Date.now();
          const horizon = now + withinDays * DAY_MS;
          const rows = (await allProducts())
            .filter((p) => p.expiryDate && toMillis(p.expiryDate) > 0)
            .map((p) => ({ p, at: toMillis(p.expiryDate) }))
            .filter((x) => x.at <= horizon)
            .sort((a, b) => a.at - b.at)
            .map((x) => ({
              ...slimProduct(x.p),
              daysRemaining: Math.ceil((x.at - now) / DAY_MS),
              expired: x.at < now,
              valueAtRisk: round2((x.p.stock ?? 0) * (x.p.costPrice ?? x.p.price ?? 0)),
            }));
          return {
            type: 'PRODUCT_LIST',
            title: `Expiring within ${withinDays} days`,
            totalMatches: rows.length, shown: rows.length, currency,
            expiredCount: rows.filter((r) => r.expired).length,
            totalValueAtRisk: round2(rows.reduce((s, r) => s + r.valueAtRisk, 0)),
            products: rows.slice(0, 25),
          };
        } catch (e: any) { return fail('Failed to check expiry dates', e); }
      },
    }),

    getCategoryBreakdown: tool({
      description: 'Inventory split by category — SKU count, units, retail value and share of total.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const products = await allProducts();
          const byCat = new Map<string, { skus: number; units: number; value: number }>();
          for (const p of products) {
            const key = p.category || 'Uncategorised';
            const row = byCat.get(key) ?? { skus: 0, units: 0, value: 0 };
            row.skus++;
            row.units += Math.max(0, p.stock ?? 0);
            row.value += Math.max(0, p.stock ?? 0) * (p.price ?? 0);
            byCat.set(key, row);
          }
          const total = [...byCat.values()].reduce((s, r) => s + r.value, 0);
          const catRows = [...byCat.entries()]
            .sort((a, b) => b[1].value - a[1].value)
            .map(([name, r]) => ({
              label: name,
              SKUs: r.skus, Units: r.units,
              value: round2(r.value),
              Share: total > 0 ? `${round2((r.value / total) * 100)}%` : '0%',
            }));
          return {
            type: 'CHART', chartKind: 'pie',
            title: 'Inventory value by category',
            xKey: 'label',
            series: [{ key: 'value', label: 'Retail value', format: 'currency' }],
            highlights: [
              { label: 'Total value', value: round2(total), format: 'currency' },
              { label: 'Categories', value: catRows.length, format: 'number' },
            ],
            currency,
            rows: catRows,
          };
        } catch (e: any) { return fail('Failed to break down categories', e); }
      },
    }),

    getStockCoverage: tool({
      description:
        'Days of stock remaining per product based on recent sales velocity. Flags items about to run out. Use for "what will I run out of" questions.',
      inputSchema: z.object({
        withinDays: z.number().min(1).max(90).default(14).describe('Flag items projected to run out inside this many days.'),
        limit: z.number().min(1).max(40).default(15),
      }),
      execute: async ({ withinDays, limit }) => {
        try {
          const sold = await unitsSold(30);
          const rows = (await allProducts())
            .map((p) => {
              const perDay = (sold.get(p.id) ?? 0) / 30;
              const stock = p.stock ?? 0;
              return { p, perDay, days: perDay > 0 ? stock / perDay : Infinity };
            })
            .filter((x) => x.perDay > 0 && x.days <= withinDays)
            .sort((a, b) => a.days - b.days);
          return {
            type: 'PRODUCT_LIST',
            title: `Running out within ${withinDays} days`,
            totalMatches: rows.length,
            shown: Math.min(rows.length, limit ?? 15),
            currency,
            products: rows.slice(0, limit ?? 15).map((x) => ({
              ...slimProduct(x.p),
              unitsPerDay: round2(x.perDay),
              daysOfCover: Math.floor(x.days),
            })),
          };
        } catch (e: any) { return fail('Failed to compute stock coverage', e); }
      },
    }),

    getReorderSuggestions: tool({
      description: 'Suggest what to reorder and how many units, to hold a target number of days of cover.',
      inputSchema: z.object({
        targetDaysOfCover: z.number().min(7).max(180).default(30),
        limit: z.number().min(1).max(40).default(15),
      }),
      execute: async ({ targetDaysOfCover, limit }) => {
        try {
          const sold = await unitsSold(30);
          const rows = (await allProducts())
            .map((p) => {
              const perDay = (sold.get(p.id) ?? 0) / 30;
              const target = Math.ceil(perDay * targetDaysOfCover);
              const gap = target - (p.stock ?? 0);
              return { p, perDay, target, gap, cost: gap * (p.costPrice ?? p.price ?? 0) };
            })
            .filter((x) => x.perDay > 0 && x.gap > 0)
            .sort((a, b) => b.cost - a.cost);
          return {
            type: 'PRODUCT_TABLE',
            title: `Reorder to ${targetDaysOfCover} days of cover`,
            currency,
            estimatedTotalCost: round2(rows.reduce((s, r) => s + r.cost, 0)),
            products: productCards(rows.slice(0, limit ?? 15).map((x) => ({
              p: x.p,
              stats: [
                { label: 'Sells/day', value: round2(x.perDay), format: 'number' },
                { label: 'Order', value: x.gap, format: 'number' },
                { label: 'Est. cost', value: round2(x.cost), format: 'currency' },
              ],
            }))),
            columns: ['Product', 'In stock', 'Sells/day', 'Order', 'Est. cost'],
            rows: rows.slice(0, limit ?? 15).map((x) => ({
              Product: x.p.name, 'In stock': x.p.stock ?? 0,
              'Sells/day': round2(x.perDay), Order: x.gap, 'Est. cost': round2(x.cost),
            })),
          };
        } catch (e: any) { return fail('Failed to build reorder list', e); }
      },
    }),

    getMarginAnalysis: tool({
      description: 'Profit margin per product. Flags items sold at or below cost. Use for pricing questions.',
      inputSchema: z.object({
        sort: z.enum(['lowest', 'highest']).default('lowest').describe('Show thinnest or fattest margins first.'),
        limit: z.number().min(1).max(40).default(15),
      }),
      execute: async ({ sort, limit }) => {
        try {
          const rows = (await allProducts())
            .filter((p) => p.costPrice != null && (p.price ?? 0) > 0)
            .map((p) => ({
              // Kept so the card view can show the real product; the table
              // rows below still read only the derived figures.
              p,
              name: p.name,
              price: p.price, cost: p.costPrice,
              marginPct: round2(((p.price - p.costPrice) / p.price) * 100),
              profitPerUnit: round2(p.price - p.costPrice),
            }))
            .sort((a, b) => (sort === 'lowest' ? a.marginPct - b.marginPct : b.marginPct - a.marginPct));
          const losses = rows.filter((r) => r.marginPct <= 0);
          return {
            type: 'PRODUCT_TABLE',
            title: sort === 'lowest' ? 'Thinnest margins' : 'Best margins',
            currency,
            sellingAtALoss: losses.length,
            products: productCards(rows.slice(0, limit ?? 15).map((r) => ({
              p: r.p,
              stats: [
                { label: 'Cost', value: r.cost, format: 'currency' },
                { label: 'Margin', value: r.marginPct, format: 'percent' },
                { label: 'Profit/unit', value: r.profitPerUnit, format: 'currency' },
              ],
            }))),
            columns: ['Product', 'Cost', 'Price', 'Margin', 'Profit/unit'],
            rows: rows.slice(0, limit ?? 15).map((r) => ({
              Product: r.name, Cost: r.cost, Price: r.price,
              // A number, not `${n}%` — the table adds the sign for percent
              // columns, and only a real number gets the negative-value
              // highlight that makes a below-cost item visible at a glance.
              Margin: r.marginPct, 'Profit/unit': r.profitPerUnit,
            })),
          };
        } catch (e: any) { return fail('Failed to analyse margins', e); }
      },
    }),

    getDataHealthCheck: tool({
      description:
        'Audit inventory data quality: negative stock, missing cost price, missing SKU, missing image, zero price. Use when the owner asks what is wrong with their data or why numbers look off.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const products = await allProducts();
          const negative = products.filter((p) => (p.stock ?? 0) < 0);
          const issues = {
            negativeStock: negative.length,
            missingCostPrice: products.filter((p) => p.costPrice == null).length,
            missingSku: products.filter((p) => !p.sku).length,
            missingImage: products.filter((p) => !p.imageUrl).length,
            zeroPrice: products.filter((p) => !(p.price > 0)).length,
          };
          return {
            type: 'METRICS',
            title: 'Inventory data health',
            tiles: [
              count('Negative stock', issues.negativeStock, 'Stock below zero means sales were recorded without stock in'),
              count('No cost price', issues.missingCostPrice, 'Profit cannot be computed for these'),
              count('No SKU', issues.missingSku),
              count('No image', issues.missingImage),
              count('No price', issues.zeroPrice),
            ],
            worstNegative: negative
              .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
              .slice(0, 8)
              .map((p) => ({ name: p.name, stock: p.stock })),
            totalProducts: products.length,
          };
        } catch (e: any) { return fail('Failed to check data health', e); }
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // SALES
    // ═══════════════════════════════════════════════════════════════════════

    getSalesMetrics: tool({
      description: 'Revenue, profit, transaction count and average order value for a period.',
      inputSchema: z.object({
        period: z.enum(['today', 'yesterday', 'last7days', 'last30days', 'last90days', 'thisMonth', 'lastMonth']),
      }),
      execute: async ({ period }) => {
        try {
          const { start, end, label } = periodRange(period);
          const receipts = await paidBetween(start, end);
          const revenue = receipts.reduce((s, r) => s + (r.total ?? 0), 0);
          const profit = receipts.reduce((s, r) => s + (r.profit ?? 0), 0);
          const byMethod: Record<string, number> = {};
          for (const r of receipts) {
            const m = r.paymentMethod ?? 'Unknown';
            byMethod[m] = round2((byMethod[m] ?? 0) + (r.total ?? 0));
          }
          return {
            type: 'METRICS',
            title: `Sales — ${label}`,
            tiles: [
              money('Revenue', revenue),
              money('Profit', profit),
              count('Transactions', receipts.length),
              money('Avg order', receipts.length ? revenue / receipts.length : 0),
              percent('Margin', revenue > 0 ? (profit / revenue) * 100 : 0),
            ],
            byPaymentMethod: byMethod,
          };
        } catch (e: any) { return fail('Failed to get sales metrics', e); }
      },
    }),

    /**
     * The owner's daily close-out. Draws the whole day as a report card, then
     * suggests where the numbers live in the app. The model should call this in
     * addition to (not instead of) getSalesMetrics when the user says "today".
     */
    getDailyReport: tool({
      description:
        "A day's trading drawn as a report card — takings, transactions, method split, top items, debt owed. Use when the user asks 'how did we do today', 'daily report', or 'end of day'.",
      inputSchema: z.object({
        date: z.string().optional().describe('YYYY-MM-DD. Defaults to today.'),
      }),
      execute: async ({ date }) => {
        try {
          const day = date || new Date().toISOString().slice(0, 10);
          const start = new Date(`${day}T00:00:00`);
          const end = new Date(start.getTime() + DAY_MS);
          const receipts = (await receiptsSince(90)).filter((r) => {
            const t = toMillis(r.createdAt);
            return t >= start.getTime() && t < end.getTime();
          });

          const revenue = round2(receipts.reduce((s, r) => s + (r.total ?? 0), 0));
          const profit = round2(receipts.reduce((s, r) => s + (r.profit ?? 0), 0));
          const transactions = receipts.length;
          const units = receipts.reduce(
            (s, r) => s + (r.items ?? []).reduce((a: number, i: any) => a + (i.quantity ?? 0), 0), 0,
          );
          const byMethod: Record<string, number> = {};
          const byProduct = new Map<string, { name: string; units: number; revenue: number }>();
          for (const r of receipts) {
            const m = r.paymentMethod ?? 'Unknown';
            byMethod[m] = round2((byMethod[m] ?? 0) + (r.total ?? 0));
            for (const item of r.items ?? []) {
              if (!item?.productId) continue;
              const row = byProduct.get(item.productId) ?? { name: item.name ?? 'Unknown', units: 0, revenue: 0 };
              row.units += item.quantity ?? 0;
              row.revenue = round2(row.revenue + ((item.price ?? 0) * (item.quantity ?? 0)));
              byProduct.set(item.productId, row);
            }
          }
          const topItems = [...byProduct.values()].sort((a, b) => b.units - a.units).slice(0, 3);
          const debt = round2(receipts.filter((r) => r.paymentMethod === 'Invoice' && (r.status === 'unpaid' || r.status === 'pending')).reduce((s, r) => s + (r.total ?? 0), 0));

          const methodRows = Object.entries(byMethod)
            .sort((a, b) => b[1] - a[1])
            .map(([method, amount]) => ({
              Method: method,
              'Taken': amount,
              Share: revenue > 0 ? `${round2((amount / revenue) * 100)}%` : '0%',
            }));

          return {
            type: 'CHART', chartKind: 'bar',
            title: `Daily report — ${day}`,
            subtitle: `${transactions} transaction${transactions === 1 ? '' : 's'}, ${units} units`,
            xKey: 'Method',
            series: [{ key: 'Taken', label: 'Taken', format: 'currency', color: '#ea580c' }],
            highlights: [
              { label: 'Takings', value: revenue, format: 'currency' },
              { label: 'Profit', value: profit, format: 'currency' },
              { label: 'Transactions', value: transactions, format: 'number' },
              { label: 'Debt owed', value: debt, format: 'currency' },
            ],
            note: topItems.length
              ? `Top sellers: ${topItems.map((t) => `${t.name} (${t.units})`).join(', ')}.`
              : undefined,
            currency,
            rows: methodRows,
            // The model narrates the report; the card shows the split.
            links: [
              { label: 'Full sales report', href: '/reports', kind: 'page' },
              { label: 'Today in the ledger', href: '/receipts', kind: 'page' },
            ],
          };
        } catch (e: any) { return fail('Failed to build daily report', e); }
      },
    }),

    /**
     * The rating the owner already sees in the top bar and on Reports → Business
     * Rating, answered in chat.
     *
     * Calls the same pure scorer as those two surfaces
     * (`src/lib/business-rating.ts`) over the same 60-day window, so Zen cannot
     * quote a different number from the one on the page — one rating with three
     * mouths is the whole reason that module is pure and takes `now` as an input.
     *
     * Two deliberate differences from the client, and both make this reading the
     * better one rather than an approximation:
     *
     * - `receiptsSince` is a real 60-day query, so there is no 200-receipt listener
     *   cap here and `facts.truncated` comes back false.
     * - `customers: null` — the customer list is not fetched. It feeds only the
     *   count of people on file who have not bought, and thousands of document
     *   reads to fill in one clause of a chat answer is not a trade worth making.
     *   `null` records that it was skipped instead of letting it read as zero.
     *
     * Receipts are deliberately NOT filtered through `isPaid`, matching the client:
     * the rating counts every surviving receipt because a void deletes the document
     * outright, so anything still present was a sale.
     *
     * ── Opted out ─────────────────────────────────────────────────────────────
     *
     * The rating is opt-in, and this tool refuses when it is off rather than being
     * removed from the tool set: a model that has been told not to raise the subject
     * can still call the tool it was told about, and a refusal is a cheap, unambiguous
     * answer where a missing tool is an SDK error. It returns **no score of any kind**
     * — not the pillars, not the tier, not a "would have been" figure — because the
     * one thing an owner who declined must not get is their number anyway.
     *
     * The refusal does no reads at all, so an ignored instruction costs a step and
     * nothing else.
     */
    getBusinessRating: tool({
      description:
        "The shop's business rating out of 100 — the same score shown in the top bar and on Reports → Business Rating. Returns the four pillars that multiply revenue (margin, basket, repeat, momentum), how many points each one has available, the action that moves each, and the largest money opportunities. Use when the user asks how their business is doing overall, what their rating or score is, how to improve it, what to work on next, or where they are leaving money on the table. For a single period's takings use getSalesMetrics instead.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!ratingEnabled) {
          // Untagged on purpose: `ToolResult`'s default branch renders nothing and
          // leaves the model to say it in prose, which is what `reportUnanswered`
          // does too. A card here would be a rating card, which is the one thing
          // this branch exists to avoid drawing.
          return {
            unavailable: true,
            fallbackText:
              'Business rating is switched off for this shop, so there is no score, grade or pillar breakdown to report. It can be turned on in Settings → General.',
          };
        }
        try {
          const [products, receipts] = await Promise.all([
            allProducts(),
            receiptsSince(RATING_WINDOW_DAYS),
          ]);

          const rating = computeBusinessRating({
            products: products as any,
            receipts: receipts as any,
            customers: null,
            now: new Date(),
          });
          const f = rating.facts;

          if (rating.score === null) {
            return {
              type: 'METRICS',
              title: 'Business rating',
              tiles: [count('Rating', 0, 'Not rated yet')],
              caveat:
                'There are no sales in the last 60 days to score. The rating appears once the shop records its first sale.',
              currency,
            };
          }

          const gains = rating.opportunities.filter((o) => o.kind === 'gain');
          const onTheTable = round2(gains.reduce((s, o) => s + o.money, 0));

          // Unmeasured pillars are named rather than passed off as zero — a shop
          // with no cost prices has an unknown margin, not a bad one, and the model
          // must not narrate it as bad.
          const unmeasured = rating.pillars.filter((p) => !p.measured);

          return {
            type: 'METRICS',
            title: `Business rating — ${rating.tier.name} (level ${rating.tier.index})`,
            tiles: [
              count('Rating', rating.score, `Grade ${rating.grade} · ${rating.tier.name}`),
              ...rating.pillars.map((p) =>
                count(
                  p.label,
                  p.measured ? p.score : 0,
                  p.measured ? `${p.hint}${p.headroom >= 1 ? ` · +${p.headroom} available` : ''}` : p.hint,
                ),
              ),
              money('On the table', onTheTable, `${gains.length} opportunit${gains.length === 1 ? 'y' : 'ies'}`),
            ],
            flags: unmeasured.map((p) => `${p.label} cannot be scored yet — ${p.hint.toLowerCase()}.`),
            caveat: `Scored on ${f.sales} sales over the last ${f.coveredDays} days.${
              rating.tier.next ? ` ${rating.tier.next.floor - rating.score} points to ${rating.tier.next.name}.` : ''
            }`,
            currency,

            // Narration material. Not rendered by MetricTiles — the model reads
            // these to say what to actually do about the number.
            grade: rating.grade,
            tier: rating.tier,
            pillars: rating.pillars.map((p) => ({
              name: p.label,
              score: p.measured ? p.score : null,
              detail: p.hint,
              pointsAvailable: p.headroom,
              nextAction: p.fix.label,
              where: p.fix.href,
            })),
            opportunities: rating.opportunities.map((o) => ({
              what: o.label,
              basis: o.detail,
              worth: round2(o.money),
              measurable: o.kind === 'gain',
              where: o.href,
            })),
            note:
              'The customer list was not read for this answer, so any count of customers who have stopped buying is omitted rather than reported as zero.',
          };
        } catch (e: any) { return fail('Failed to compute the business rating', e); }
      },
    }),

    /**
     * Deep-link the owner into the app instead of narrating a page that exists.
     * The model should offer this after an answer ("open Inventory", "show me
     * the reports page").
     */
    explainHowTo: tool({
      description:
        "Step-by-step walkthrough for a task in the app. Use whenever the user asks how to DO something — 'how do I bulk import', 'teach me to record a sale', 'how do refunds work', 'how do I add staff'. Returns a numbered card with a link to the right page. Always prefer this over describing steps yourself.",
      inputSchema: z.object({
        topic: z
          .enum([
            'bulkImport', 'recordSale', 'addProduct', 'lowStockThreshold', 'addBranch',
            'refund', 'addStaff', 'invoice', 'stocktake', 'loyalty',
          ])
          .describe('Which walkthrough to show.'),
      }),
      execute: async ({ topic }) => {
        const w = WORKFLOWS[topic];
        if (!w) {
          return { error: `I don't have a walkthrough for "${topic}" yet.` };
        }
        return {
          type: 'WALKTHROUGH',
          title: w.title,
          intro: w.intro,
          steps: w.steps,
          tips: w.tips ?? [],
          href: w.href ?? null,
          hrefLabel: w.hrefLabel ?? 'Open',
        };
      },
    }),

    linkToPage: tool({
      description:
        "Offer a tap-through link to a page in the Zeneva app. Use when the user asks to open, go to, or see a page — e.g. 'open inventory', 'show me the reports', 'take me to the POS'. Returns a LINK card. Covers sub-pages too: adding a product, branches, debts, the POS steps.",
      inputSchema: z.object({
        href: z.string().describe('Absolute app path, starting with a forward slash.'),
        label: z.string().describe('What the link says, e.g. "Open Inventory".'),
        detail: z.string().optional().describe('One short line on what is on that page.'),
      }),
      execute: async ({ href, label, detail }) => {
        // Only ever link inside the app — never to external sites.
        if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
          return { error: 'Links must point inside the app.' };
        }

        // Strip query/hash before matching so `/inventory?x=1` still resolves.
        const path = href.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

        if (!APP_ROUTES.has(path)) {
          /*
           * A near-miss is the common case: the model reaches for a page that
           * sounds right but does not exist (`/inventory/import` — bulk import
           * is a dialog on the Inventory page, not a route). Returning an error
           * painted a red card in the chat and taught the user nothing, so walk
           * up the path to the nearest real ancestor and link that instead.
           */
          const segments = path.split('/').filter(Boolean);
          for (let i = segments.length - 1; i > 0; i--) {
            const parent = '/' + segments.slice(0, i).join('/');
            if (APP_ROUTES.has(parent)) {
              return {
                type: 'LINK',
                href: parent,
                label: label ?? `Open ${parent.slice(1)}`,
                detail: detail ?? ROUTE_HINTS[parent],
                redirectedFrom: path,
                note: `${path} isn't a page of its own — this is where it lives.`,
              };
            }
          }
          return {
            error: `There's no ${path} page. Try Inventory, Reports, Receipts, Customers, Invoices, Dashboard, POS, Settings or Users.`,
          };
        }

        return {
          type: 'LINK',
          label: label ?? 'Open',
          detail: detail ?? ROUTE_HINTS[path],
          href: path,
        };
      },
    }),

    getSalesTrend: tool({
      description: 'Day-by-day revenue and transaction counts over a period. Use to describe trends and spot spikes or dips.',
      inputSchema: z.object({ days: z.number().min(2).max(90).default(14) }),
      execute: async ({ days }) => {
        try {
          const receipts = (await receiptsSince(days)).filter(isPaid);
          const bucketed = bucketByDay(receipts, days);
          const buckets = new Map<string, { revenue: number; transactions: number }>();
          for (const [date, revenue] of bucketed.daily) buckets.set(date, { revenue, transactions: 0 });
          for (const r of receipts) {
            const b = buckets.get(new Date(toMillis(r.createdAt)).toISOString().slice(0, 10));
            if (b) b.transactions++;
          }
          const series = [...buckets.entries()].map(([date, v]) => ({
            date,
            // Short axis label — the ISO date is too wide for the chat column.
            label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
            ...v,
          }));
          const revenues = series.map((s) => s.revenue);
          const best = series[revenues.indexOf(Math.max(...revenues))];
          const total = round2(revenues.reduce((s, v) => s + v, 0));
          const unplaced = unplacedNote(bucketed, currency);
          return {
            type: 'CHART', chartKind: 'line',
            title: `Daily sales — last ${days} days`,
            xKey: 'label',
            series: [{ key: 'revenue', label: 'Revenue', format: 'currency', color: '#ea580c' }],
            highlights: [
              { label: 'Total', value: total, format: 'currency' },
              { label: 'Daily average', value: round2(total / days), format: 'currency' },
              { label: 'Best day', value: best?.revenue ?? 0, format: 'currency' },
              { label: 'Transactions', value: series.reduce((s, v) => s + v.transactions, 0), format: 'number' },
            ],
            note: best ? `Best day was ${best.date}.` : undefined,
            // Surfaced rather than swallowed: if this is set, the chart above is
            // incomplete and the model must say so instead of quoting the total.
            dataGap: unplaced ?? undefined,
            caveat: unplaced ?? undefined,
            currency,
            bestDay: best ? { date: best.date, revenue: best.revenue } : null,
            total,
            rows: series,
          };
        } catch (e: any) { return fail('Failed to build sales trend', e); }
      },
    }),

    comparePeriods: tool({
      description: 'Compare a period against the one immediately before it — revenue, profit and transaction growth.',
      inputSchema: z.object({ period: z.enum(['today', 'last7days', 'last30days', 'thisMonth']) }),
      execute: async ({ period }) => {
        try {
          const { start, end, label } = periodRange(period);
          const span = end.getTime() - start.getTime();
          const prevStart = new Date(start.getTime() - span);
          const [current, previous] = await Promise.all([
            paidBetween(start, end),
            paidBetween(prevStart, start),
          ]);
          const sum = (rows: any[], key: string) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);
          const growth = (a: number, b: number) => (b > 0 ? round2(((a - b) / b) * 100) : a > 0 ? 100 : 0);
          const curRev = sum(current, 'total'), prevRev = sum(previous, 'total');
          const curProfit = sum(current, 'profit'), prevProfit = sum(previous, 'profit');
          return {
            type: 'METRICS',
            title: `${label} vs previous`,
            tiles: [
              money('Revenue', curRev, `was ${round2(prevRev)}`),
              percent('Revenue growth', growth(curRev, prevRev)),
              money('Profit', curProfit, `was ${round2(prevProfit)}`),
              count('Transactions', current.length, `was ${previous.length}`),
              percent('Transaction growth', growth(current.length, previous.length)),
            ],
          };
        } catch (e: any) { return fail('Failed to compare periods', e); }
      },
    }),

    getTopSellingProducts: tool({
      description: 'Best sellers ranked by units sold or revenue generated.',
      inputSchema: z.object({
        period: z.enum(['today', 'last7days', 'last30days', 'last90days', 'thisMonth']),
        rankBy: z.enum(['quantity', 'revenue']).default('revenue'),
        topN: z.number().min(1).max(20).default(10),
      }),
      execute: async ({ period, rankBy, topN }) => {
        try {
          const { start, end, label } = periodRange(period);
          const receipts = await paidBetween(start, end);
          const totals = new Map<string, { name: string; quantity: number; revenue: number }>();
          for (const r of receipts) {
            for (const item of r.items ?? []) {
              if (!item?.productId) continue;
              const row = totals.get(item.productId) ?? { name: item.name ?? 'Unknown', quantity: 0, revenue: 0 };
              row.quantity += item.quantity ?? 0;
              row.revenue += (item.price ?? 0) * (item.quantity ?? 0);
              totals.set(item.productId, row);
            }
          }
          const ranked = [...totals.entries()]
            .sort(([, a], [, b]) => (rankBy === 'quantity' ? b.quantity - a.quantity : b.revenue - a.revenue))
            .slice(0, topN ?? 10);
          // Receipt items carry only a name, so the card view needs the real
          // product doc. allProducts() is memoised per request, so this is free
          // whenever anything else in the same turn already loaded the
          // catalogue, and one collection read when nothing has.
          const catalogue = new Map((await allProducts()).map((p) => [p.id, p]));
          return {
            type: 'PRODUCT_TABLE',
            title: `Top sellers — ${label}`,
            currency,
            products: productCards(ranked.map(([id, r]) => ({
              p: catalogue.get(id),
              name: r.name,
              stats: [
                { label: 'Units sold', value: r.quantity, format: 'number' },
                { label: 'Revenue', value: round2(r.revenue), format: 'currency' },
              ],
            }))),
            columns: ['#', 'Product', 'Units', 'Revenue'],
            rows: ranked.map(([, r], i) => ({ '#': i + 1, Product: r.name, Units: r.quantity, Revenue: round2(r.revenue) })),
          };
        } catch (e: any) { return fail('Failed to get top products', e); }
      },
    }),

    getWorstSellingProducts: tool({
      description: 'Slowest-moving products that DID sell at least once in the period — the tail end of the catalogue.',
      inputSchema: z.object({
        period: z.enum(['last7days', 'last30days', 'last90days']).default('last30days'),
        topN: z.number().min(1).max(20).default(10),
      }),
      execute: async ({ period, topN }) => {
        try {
          const { start, end, label } = periodRange(period);
          const receipts = await paidBetween(start, end);
          const totals = new Map<string, { name: string; quantity: number; revenue: number }>();
          for (const r of receipts) {
            for (const item of r.items ?? []) {
              if (!item?.productId) continue;
              const row = totals.get(item.productId) ?? { name: item.name ?? 'Unknown', quantity: 0, revenue: 0 };
              row.quantity += item.quantity ?? 0;
              row.revenue += (item.price ?? 0) * (item.quantity ?? 0);
              totals.set(item.productId, row);
            }
          }
          // `.entries()`, not `.values()` — the productId is what joins these
          // receipt-derived rows back to the catalogue for the card view.
          const ranked = [...totals.entries()].sort(([, a], [, b]) => a.quantity - b.quantity).slice(0, topN ?? 10);
          const catalogue = new Map((await allProducts()).map((p) => [p.id, p]));
          return {
            type: 'PRODUCT_TABLE',
            title: `Slowest movers — ${label}`,
            currency,
            note: 'Products with zero sales are not listed here — use getDeadStock for those.',
            products: productCards(ranked.map(([id, r]) => ({
              p: catalogue.get(id),
              name: r.name,
              stats: [
                { label: 'Units sold', value: r.quantity, format: 'number' },
                { label: 'Revenue', value: round2(r.revenue), format: 'currency' },
              ],
            }))),
            columns: ['Product', 'Units', 'Revenue'],
            rows: ranked.map(([, r]) => ({ Product: r.name, Units: r.quantity, Revenue: round2(r.revenue) })),
          };
        } catch (e: any) { return fail('Failed to get slow movers', e); }
      },
    }),

    getPeakHours: tool({
      description: 'Busiest hours of the day and days of the week by revenue — for staffing and opening-hours decisions.',
      inputSchema: z.object({ days: z.number().min(7).max(90).default(30) }),
      execute: async ({ days }) => {
        try {
          const receipts = (await receiptsSince(days)).filter(isPaid);

          /*
           * With no paid receipts every bucket is zero, and `reduce` below seeds
           * at index 0 and never finds anything greater — so the tool used to
           * report "busiest day is Sunday, peak hour 00:00" with total
           * confidence on an empty book. A staffing decision made on that is
           * actively harmful, so say plainly that there is nothing to read.
           */
          if (receipts.length === 0) {
            return {
              type: 'METRICS',
              title: `Trading patterns — last ${days} days`,
              insufficientData: true,
              caveat: `No paid sales in the last ${days} days, so there is no trading pattern to read yet.`,
              currency,
              tiles: [],
            };
          }

          const hours = Array.from({ length: 24 }, () => ({ revenue: 0, transactions: 0 }));
          const dow = Array.from({ length: 7 }, () => ({ revenue: 0, transactions: 0 }));
          for (const r of receipts) {
            const d = new Date(toMillis(r.createdAt));
            const h = hours[d.getHours()];
            h.revenue = round2(h.revenue + (r.total ?? 0)); h.transactions++;
            const w = dow[d.getDay()];
            w.revenue = round2(w.revenue + (r.total ?? 0)); w.transactions++;
          }
          const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const busiestHour = hours.reduce((best, h, i) => (h.revenue > hours[best].revenue ? i : best), 0);
          const busiestDay = dow.reduce((best, d, i) => (d.revenue > dow[best].revenue ? i : best), 0);
          return {
            type: 'CHART', chartKind: 'bar',
            title: `Trading patterns — last ${days} days`,
            subtitle: 'Revenue by day of week',
            xKey: 'Day',
            series: [{ key: 'Revenue', label: 'Revenue', format: 'currency', color: '#ea580c' }],
            highlights: [
              { label: 'Busiest day', value: dow[busiestDay].revenue, format: 'currency' },
              { label: 'Transactions', value: dow.reduce((s, d) => s + d.transactions, 0), format: 'number' },
            ],
            note: `Busiest day is ${names[busiestDay]}; peak hour is ${String(busiestHour).padStart(2, '0')}:00.`,
            currency,
            busiestHour: `${String(busiestHour).padStart(2, '0')}:00`,
            busiestDay: names[busiestDay],
            // Short labels on the axis, full names kept for the model's prose.
            rows: dow.map((d, i) => ({ Day: names[i].slice(0, 3), fullDay: names[i], Revenue: d.revenue, Transactions: d.transactions })),
            hourly: hours.map((h, i) => ({ hour: `${String(i).padStart(2, '0')}:00`, ...h })).filter((h) => h.transactions > 0),
          };
        } catch (e: any) { return fail('Failed to compute peak hours', e); }
      },
    }),

    getRecentTransactions: tool({
      description: 'The most recent sales, newest first, with items and payment method.',
      inputSchema: z.object({ limit: z.number().min(1).max(25).default(10) }),
      execute: async ({ limit }) => {
        try {
          const rows = (await receiptsSince(30))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
            .slice(0, limit ?? 10);
          return {
            type: 'TABLE',
            title: 'Recent transactions',
            currency,
            columns: ['When', 'Receipt', 'Items', 'Total', 'Method', 'Status'],
            rows: rows.map((r) => ({
              When: new Date(toMillis(r.createdAt)).toISOString(),
              Receipt: r.receiptNumber ?? r.id.slice(0, 8),
              Items: (r.items ?? []).length,
              Total: round2(r.total ?? 0),
              Method: r.paymentMethod ?? '—',
              Status: r.status ?? 'paid',
            })),
          };
        } catch (e: any) { return fail('Failed to load transactions', e); }
      },
    }),

    getUnpaidInvoices: tool({
      description: 'Outstanding receipts that are unpaid or pending — money owed to the business.',
      inputSchema: z.object({ days: z.number().min(7).max(365).default(90) }),
      execute: async ({ days }) => {
        try {
          const rows = (await receiptsSince(days))
            .filter((r) => r.paymentMethod === 'Invoice' && (r.status === 'unpaid' || r.status === 'pending'))
            .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
          const owed = rows.reduce((s, r) => s + (r.total ?? 0), 0);
          return {
            type: 'TABLE',
            title: 'Outstanding payments',
            currency,
            totalOwed: round2(owed),
            count: rows.length,
            columns: ['Age (days)', 'Receipt', 'Customer', 'Amount', 'Status'],
            rows: rows.slice(0, 25).map((r) => ({
              'Age (days)': Math.floor((Date.now() - toMillis(r.createdAt)) / DAY_MS),
              Receipt: r.receiptNumber ?? r.id.slice(0, 8),
              Customer: r.customer?.name ?? 'Walk-in',
              Amount: round2(r.total ?? 0),
              Status: r.status,
            })),
          };
        } catch (e: any) { return fail('Failed to load unpaid invoices', e); }
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // CUSTOMERS
    // ═══════════════════════════════════════════════════════════════════════

    queryCustomer: tool({
      description: 'Find a customer by name or email. Returns profile, loyalty points and total spent.',
      inputSchema: z.object({ searchTerm: z.string().describe('Name, email or phone.') }),
      execute: async ({ searchTerm }) => {
        try {
          const lower = searchTerm.toLowerCase();
          const byName = await db.collection('customers')
            .where('businessId', '==', businessId)
            .where('lowercaseName', '>=', lower)
            .where('lowercaseName', '<=', lower + '')
            .limit(5).get();

          const map = (d: any) => {
            const c = d.data();
            return {
              id: d.id, name: c.name, email: c.email, phone: c.phone ?? null,
              loyaltyPoints: c.loyaltyPoints ?? 0, totalSpent: c.totalSpent ?? 0,
              lastPurchaseDate: c.lastPurchaseDate ? new Date(toMillis(c.lastPurchaseDate)).toISOString() : null,
            };
          };
          const results = byName.docs.map(map);
          if (results.length === 0) {
            const byEmail = await db.collection('customers')
              .where('businessId', '==', businessId)
              .where('lowercaseEmail', '==', lower)
              .limit(3).get();
            results.push(...byEmail.docs.map(map));
          }
          return {
            type: 'CUSTOMER_LIST',
            title: results.length === 1 ? 'Customer' : `Customers matching "${searchTerm}"`,
            emptyText: `No customer matching "${searchTerm}".`,
            count: results.length,
            customers: results,
            currency,
          };
        } catch (e: any) { return fail('Failed to query customers', e); }
      },
    }),

    getTopCustomers: tool({
      description: 'Highest-spending customers, ranked by lifetime spend.',
      inputSchema: z.object({ limit: z.number().min(1).max(25).default(10) }),
      execute: async ({ limit }) => {
        try {
          const snap = await db.collection('customers')
            .where('businessId', '==', businessId)
            .orderBy('totalSpent', 'desc')
            .limit(limit ?? 10).get();
          return {
            type: 'CUSTOMER_LIST',
            title: 'Top customers',
            emptyText: 'No customers on record yet.',
            currency,
            customers: snap.docs.map((d, i) => {
              const c = d.data();
              return {
                id: d.id,
                rank: i + 1,
                name: c.name,
                email: c.email ?? null,
                phone: c.phone ?? null,
                totalSpent: round2(c.totalSpent ?? 0),
                loyaltyPoints: c.loyaltyPoints ?? 0,
                lastPurchaseDate: c.lastPurchaseDate ? new Date(toMillis(c.lastPurchaseDate)).toISOString() : null,
              };
            }),
          };
        } catch (e: any) { return fail('Failed to load top customers', e); }
      },
    }),

    getCustomerPurchaseHistory: tool({
      description: 'Every recorded purchase for one customer, newest first.',
      inputSchema: z.object({
        customerId: z.string().describe('Firestore document ID of the customer.'),
        limit: z.number().min(1).max(30).default(15),
      }),
      execute: async ({ customerId, limit }) => {
        try {
          const snap = await db.collection('receipts')
            .where('businessId', '==', businessId)
            .where('customer.id', '==', customerId)
            .orderBy('createdAt', 'desc')
            .limit(limit ?? 15).get();
          const rows = snap.docs.map((d) => d.data());
          return {
            type: 'TABLE',
            title: 'Purchase history',
            currency,
            lifetimeValue: round2(rows.reduce((s, r) => s + (r.total ?? 0), 0)),
            columns: ['When', 'Items', 'Total', 'Method'],
            rows: rows.map((r) => ({
              When: new Date(toMillis(r.createdAt)).toISOString(),
              Items: (r.items ?? []).map((i: any) => `${i.quantity}× ${i.name}`).join(', '),
              Total: round2(r.total ?? 0),
              Method: r.paymentMethod ?? '—',
            })),
          };
        } catch (e: any) { return fail('Failed to load purchase history', e); }
      },
    }),

    getAtRiskCustomers: tool({
      description: 'Previously active customers who have not purchased in a long time — win-back candidates.',
      inputSchema: z.object({
        inactiveDays: z.number().min(14).max(365).default(60),
        limit: z.number().min(1).max(30).default(15),
      }),
      execute: async ({ inactiveDays, limit }) => {
        try {
          const cutoff = Date.now() - inactiveDays * DAY_MS;
          const snap = await db.collection('customers').where('businessId', '==', businessId).get();
          const rows = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter((c) => (c.totalSpent ?? 0) > 0 && c.lastPurchaseDate && toMillis(c.lastPurchaseDate) < cutoff)
            .sort((a, b) => (b.totalSpent ?? 0) - (a.totalSpent ?? 0));
          return {
            type: 'CUSTOMER_LIST',
            title: `No purchase in ${inactiveDays}+ days`,
            emptyText: `Nobody has been quiet for ${inactiveDays}+ days — every paying customer has been back recently.`,
            currency,
            atRiskCount: rows.length,
            totalMatches: rows.length,
            // Formatted by the card, not here — a string built server-side
            // would miss the business's currency symbol.
            revenueAtRisk: round2(rows.reduce((s, c) => s + (c.totalSpent ?? 0), 0)),
            customers: rows.slice(0, limit ?? 15).map((c) => ({
              id: c.id,
              name: c.name,
              email: c.email ?? null,
              phone: c.phone ?? null,
              totalSpent: round2(c.totalSpent ?? 0),
              loyaltyPoints: c.loyaltyPoints ?? 0,
              lastPurchaseDate: new Date(toMillis(c.lastPurchaseDate)).toISOString(),
              daysAgo: Math.floor((Date.now() - toMillis(c.lastPurchaseDate)) / DAY_MS),
            })),
          };
        } catch (e: any) { return fail('Failed to find at-risk customers', e); }
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════

    getBranchPerformance: tool({
      description: 'Revenue and transaction count per branch. Only useful when multi-branch is enabled.',
      inputSchema: z.object({ period: z.enum(['today', 'last7days', 'last30days', 'thisMonth']).default('last30days') }),
      execute: async ({ period }) => {
        try {
          const { start, end, label } = periodRange(period);
          const [receipts, branchSnap] = await Promise.all([
            paidBetween(start, end),
            db.collection('branches').where('businessId', '==', businessId).get(),
          ]);
          const names = new Map(branchSnap.docs.map((d) => [d.id, (d.data() as any).name]));
          const totals = new Map<string, { revenue: number; transactions: number }>();
          for (const r of receipts) {
            const key = r.branchId ?? 'unassigned';
            const row = totals.get(key) ?? { revenue: 0, transactions: 0 };
            row.revenue = round2(row.revenue + (r.total ?? 0)); row.transactions++;
            totals.set(key, row);
          }
          return {
            type: 'TABLE',
            title: `Branch performance — ${label}`,
            currency,
            columns: ['Branch', 'Revenue', 'Transactions', 'Avg order'],
            rows: [...totals.entries()]
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .map(([id, r]) => ({
                Branch: names.get(id) ?? (id === 'unassigned' ? 'Unassigned' : id),
                Revenue: r.revenue, Transactions: r.transactions,
                'Avg order': round2(r.transactions ? r.revenue / r.transactions : 0),
              })),
          };
        } catch (e: any) { return fail('Failed to load branch performance', e); }
      },
    }),

    getStaffPerformance: tool({
      description: 'Sales attributed to each staff member over a period, by the user who rang up the sale.',
      inputSchema: z.object({ period: z.enum(['today', 'last7days', 'last30days', 'thisMonth']).default('last30days') }),
      execute: async ({ period }) => {
        try {
          const { start, end, label } = periodRange(period);
          const [receipts, userSnap] = await Promise.all([
            paidBetween(start, end),
            db.collection('users').where('businessId', '==', businessId).get(),
          ]);
          const names = new Map(userSnap.docs.map((d) => [d.id, (d.data() as any).name]));
          const totals = new Map<string, { revenue: number; transactions: number }>();
          for (const r of receipts) {
            const key = r.createdBy ?? 'unknown';
            const row = totals.get(key) ?? { revenue: 0, transactions: 0 };
            row.revenue = round2(row.revenue + (r.total ?? 0)); row.transactions++;
            totals.set(key, row);
          }
          return {
            type: 'TABLE',
            title: `Staff performance — ${label}`,
            currency,
            columns: ['Staff', 'Revenue', 'Transactions', 'Avg order'],
            rows: [...totals.entries()]
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .map(([id, r]) => ({
                Staff: names.get(id) ?? (id === 'unknown' ? 'Unattributed' : id),
                Revenue: r.revenue, Transactions: r.transactions,
                'Avg order': round2(r.transactions ? r.revenue / r.transactions : 0),
              })),
          };
        } catch (e: any) { return fail('Failed to load staff performance', e); }
      },
    }),

    getAuditTrail: tool({
      description: 'Recent audit log entries — who changed what and when. Use for "who edited this" or suspicious-activity questions.',
      inputSchema: z.object({
        limit: z.number().min(1).max(40).default(20),
        action: z.string().optional().describe('Filter by action prefix, e.g. "product." or "sale.void".'),
      }),
      execute: async ({ limit, action }) => {
        try {
          // Audit logs live in the **subcollection**
          // `businessInstances/{businessId}/auditLogs` — that is where every
          // writer puts them (`logAuditEvent`, and the `add-audit-log` queue
          // action in pos-context). This used to read a top-level `auditLogs`
          // collection with a `businessId` filter, which nothing has ever
          // written to, so the tool silently answered every "who changed this"
          // and every suspicious-activity question with zero rows.
          //
          // No orderBy in the query: only single-field overrides exist for
          // auditLogs.createdAt, so sort in memory. See the header note.
          const snap = await db
            .collection('businessInstances')
            .doc(businessId)
            .collection('auditLogs')
            .limit(400)
            .get();
          let rows = snap.docs
            .map((d) => d.data() as any)
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          if (action) rows = rows.filter((r) => (r.action ?? '').startsWith(action));
          rows = rows.slice(0, limit ?? 20);
          return {
            type: 'TABLE',
            title: 'Audit trail',
            columns: ['When', 'User', 'Action', 'Entity'],
            rows: rows.map((r) => ({
              When: new Date(toMillis(r.createdAt)).toISOString(),
              User: r.userName ?? r.userEmail ?? r.userId,
              Action: r.action,
              Entity: `${r.entityType ?? ''} ${r.entityId ?? ''}`.trim(),
            })),
          };
        } catch (e: any) { return fail('Failed to load audit trail', e); }
      },
    }),

    getBusinessOverview: tool({
      description:
        'One-shot health snapshot: today and this month revenue, inventory value, low stock count, data issues. Use for open-ended questions like "how is my business doing".',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const today = periodRange('today');
          const month = periodRange('thisMonth');
          const [todayRows, monthRows, products] = await Promise.all([
            paidBetween(today.start, today.end),
            paidBetween(month.start, month.end),
            allProducts(),
          ]);
          const sum = (rows: any[], k: string) => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
          const retail = products.reduce((s, p) => s + Math.max(0, p.stock ?? 0) * (p.price ?? 0), 0);
          // Stock counts exclude services: they sit in the same collection and
          // carry stock 0 because the field is shared, so counting them makes
          // every service read as "out of stock". See `isServiceItem`.
          const stocked = products.filter((p) => !isServiceItem(p));
          const low = stocked.filter((p) => (p.stock ?? 0) <= (p.lowStockThreshold ?? 5)).length;
          const negative = stocked.filter((p) => (p.stock ?? 0) < 0).length;
          return {
            type: 'METRICS',
            title: 'Business snapshot',
            tiles: [
              money('Revenue today', sum(todayRows, 'total')),
              count('Sales today', todayRows.length),
              money('Revenue this month', sum(monthRows, 'total')),
              money('Profit this month', sum(monthRows, 'profit')),
              money('Unsold stock value', retail),
              count('Low stock items', low),
            ],
            flags: [
              low > 0 ? `${low} item(s) at or below the low stock threshold.` : null,
              negative > 0 ? `${negative} item(s) have negative stock — the inventory data needs correcting.` : null,
            ].filter(Boolean),
            totalProducts: products.length,
          };
        } catch (e: any) { return fail('Failed to build overview', e); }
      },
    }),

    /**
     * The full loss-prevention sweep — the same engine as the audit log page's
     * "Run forensic scan" button.
     *
     * Every judgement in the result was made by deterministic code in
     * `src/lib/forensics.ts`, not by the model. That matters here more than
     * anywhere else in this file: the output names members of staff and says
     * their numbers look like theft. A model asked to eyeball receipts would
     * reach a different conclusion on a re-run, and an owner cannot confront an
     * employee with something that changes its mind. The model's only job is to
     * relay `summary` and let the card render.
     */
    runLossPreventionScan: tool({
      description:
        'Run the full theft and shrinkage sweep over this business: cancelled sales, discount and price-override abuse, price-swaps, stock write-offs, out-of-hours trading, receipt integrity and staff risk profiles. Use for "is anyone stealing from me", "check for fraud", "why is my stock short", "review my staff", "run an audit". Returns a finished report — relay its summary, do not re-derive or second-guess its findings.',
      inputSchema: z.object({
        days: z
          .number()
          .min(7)
          .max(180)
          .default(90)
          .describe('How much trading history to examine. Patterns need weeks; 90 is the sensible default.'),
      }),
      execute: async ({ days }) => {
        try {
          const window = days ?? 90;
          const [receipts, products, userSnap, customerSnap, auditSnap, bizSnap] = await Promise.all([
            receiptsSince(window),
            allProducts(),
            db.collection('users').where('businessId', '==', businessId).get(),
            // Only needed to put a name to a customer in the sweethearting
            // check; capped because a large book would dominate the read cost of
            // the whole scan and the check degrades gracefully to an id.
            db.collection('customers').where('businessId', '==', businessId).limit(1000).get(),
            // Subcollection, not a top-level collection — see getAuditTrail.
            db
              .collection('businessInstances')
              .doc(businessId)
              .collection('auditLogs')
              .limit(1000)
              .get(),
            db.collection('businessInstances').doc(businessId).get(),
          ]);

          const business = bizSnap.data() as any | undefined;
          const cutoff = Date.now() - window * DAY_MS;

          const report = runForensicScan({
            receipts,
            // Trim to the requested window in memory: no composite index covers
            // this subcollection by date, so the query cannot do it.
            auditLogs: auditSnap.docs
              .map((d) => ({ id: d.id, ...(d.data() as any) }))
              .filter((l) => toMillis(l.createdAt) >= cutoff),
            products,
            users: userSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
            customers: customerSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
            settings: business?.settings ?? null,
            currency,
            ownerId: business?.ownerId ?? null,
            windowDays: window,
          });

          return {
            type: 'LOSS_SCAN',
            title: 'Loss-prevention scan',
            // Prose for the model to read out. Already contains every
            // conclusion, so there is nothing left for it to work out.
            summary: summariseReport(report),
            // Trimmed for the card. The engine already caps evidence per
            // finding; this bounds the total so a badly-run shop does not
            // stream a hundred cards into the chat.
            report: {
              ...report,
              findings: report.findings.slice(0, 15),
              watchlist: report.watchlist.slice(0, 8),
            },
            truncated: report.findings.length > 15 ? report.findings.length - 15 : 0,
          };
        } catch (e: any) { return fail('Failed to run the loss-prevention scan', e); }
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // WRITES — proposals only. Nothing here touches the database.
    // ═══════════════════════════════════════════════════════════════════════

    /*
     * Cost prices for many products at once, from what the owner typed.
     *
     * The important part of this tool is what it does **not** ask the model for: product
     * ids. A shop owner writes "coke 380, indomie 190" and the model's job is to
     * transcribe that into pairs — nothing more. Resolving "coke" to
     * `Coca-Cola Original 500ml` happens here, in code, through the same deterministic
     * matcher the importer uses (SKU, then normalised name, then size-aware similarity
     * that knows 50cl is 500ml).
     *
     * That split is the whole design. A model asked to emit ids will emit plausible ones,
     * and a hallucinated id writes a cost price onto an unrelated product — silently, and
     * in a field that then quietly poisons every margin figure the shop reads. Names are
     * cheap for a model and matching is cheap for code, so each does the half it cannot
     * get wrong.
     *
     * Anything ambiguous comes back as a question in the card rather than a guess.
     */
    proposeCostPrices: tool({
      description:
        'Propose cost prices for several products from a list the owner gave, e.g. "coke 380, indomie 190". Pass the names exactly as they said them — Zeneva matches them to real products itself. Streams an approval card and does NOT write to the database.',
      inputSchema: z.object({
        entries: z
          .array(
            z.object({
              name: z.string().describe('The product name as the owner wrote it. Do not correct or expand it.'),
              cost: z.number().min(0).describe('What they paid, as a plain number.'),
            }),
          )
          .min(1)
          .max(200)
          .describe('One entry per product they named.'),
      }),
      execute: async (p) => {
        const products = await allProducts();
        if (products.length === 0) return { error: 'This business has no products yet.' };

        const index = buildProductIndex(products as any);
        const byId = new Map(products.map((product: any) => [product.id, product]));
        const claimed = new Set<string>();

        const matched: any[] = [];
        const ambiguous: any[] = [];
        const unmatched: string[] = [];

        for (const entry of p.entries) {
          const name = String(entry.name ?? '').trim();
          if (!name) continue;

          const verdict = resolveOne(name, index, claimed);

          if (verdict.kind === 'certain') {
            claimed.add(verdict.match.productId);
            const product: any = byId.get(verdict.match.productId);
            const price = Number(product?.price) || 0;
            matched.push({
              productId: verdict.match.productId,
              productName: verdict.match.productName,
              wrote: name,
              currentCost: Number(product?.costPrice) || 0,
              currentIsEstimate: !!product?.costPriceEstimated,
              newCost: entry.cost,
              price,
              // Flagged, not blocked: clearance stock is real, but far more often it means
              // the owner read out selling prices by mistake.
              notBelowPrice: price > 0 && entry.cost >= price,
            });
            continue;
          }

          if (verdict.kind === 'possible') {
            ambiguous.push({
              wrote: name,
              cost: entry.cost,
              candidates: verdict.candidates.slice(0, 3).map((c) => ({
                productId: c.productId,
                productName: c.productName,
                why: c.explanation,
              })),
            });
            continue;
          }

          unmatched.push(name);
        }

        if (matched.length === 0 && ambiguous.length === 0) {
          return {
            error: `None of those names matched a product in this shop: ${unmatched.slice(0, 8).join(', ')}. Ask them to check the spelling, or to use the Cost prices screen on the Inventory page.`,
          };
        }

        return {
          type: 'PROPOSAL',
          action: 'COST_PRICES',
          // Stable across identical proposals so the client can dedupe a repeated turn.
          proposalId: `prop_costs_${matched.length}_${matched.reduce((sum, m) => sum + m.newCost, 0)}`,
          matched,
          ambiguous,
          unmatched,
          status: 'PENDING_APPROVAL',
          currency,
        };
      },
    }),

    /*
     * The zero-typing path, as a proposal.
     *
     * "I make about 25% on drinks" fills every drink's cost from its selling price. What
     * it returns is a **rule plus a full preview**, not a list of values the model chose —
     * the arithmetic is `previewBulkOp`, and every value the owner approves was computed
     * by the same function that will write it.
     *
     * Everything it produces is an estimate and is stamped `costPriceEstimated`, and
     * products that already hold a real cost price are skipped rather than overwritten.
     * Both of those are enforced in `bulk-ops.ts`, not here, so they hold no matter which
     * surface asks.
     */
    proposeCostEstimate: tool({
      description:
        'Propose estimating cost prices from selling prices and a margin the owner states, e.g. "I make about 25% on drinks". Fills gaps only — never overwrites a real cost price. Streams an approval card and does NOT write to the database.',
      inputSchema: z.object({
        percent: z.number().min(1).max(95).describe('The percentage they said.'),
        basis: z
          .enum(['margin', 'markup'])
          .describe(
            'margin = share of the selling price ("I make 25% on it"); markup = added on top of cost ("I add 25%"). If genuinely unclear, use markup — it is the smaller change.',
          ),
        category: z
          .string()
          .nullable()
          .optional()
          .describe('Limit to one category if they named one. Omit for the whole catalogue.'),
      }),
      execute: async (p) => {
        const products = await allProducts();
        if (products.length === 0) return { error: 'This business has no products yet.' };

        const op = {
          field: 'costPrice' as const,
          mode:
            p.basis === 'margin'
              ? { kind: 'cost-from-margin' as const, percent: p.percent }
              : { kind: 'cost-from-markup' as const, percent: p.percent },
          filter: p.category ? { categories: [p.category] } : {},
        };

        const preview = previewBulkOp(products as any, op);

        if (preview.changes.length === 0) {
          const reason = preview.skipped[0]?.reason;
          return {
            error: p.category
              ? `Nothing to estimate in "${p.category}".${reason ? ` ${reason}` : ''} Check the category name, or they may already have real cost prices.`
              : `Nothing to estimate.${reason ? ` ${reason}` : ''}`,
          };
        }

        return {
          type: 'PROPOSAL',
          action: 'COST_ESTIMATE',
          proposalId: `prop_costest_${p.basis}_${p.percent}_${p.category ?? 'all'}`,
          rule: describeBulkOp(op, ''),
          basis: p.basis,
          percent: p.percent,
          category: p.category ?? null,
          count: preview.changes.length,
          skipped: preview.skipped.length,
          skippedReason: preview.skipped[0]?.reason ?? null,
          // Capped for the card. The approved write recomputes from the rule, so the
          // sample is illustrative and the total is what gets applied.
          sample: preview.changes.slice(0, 12).map((change) => ({
            productName: change.productName,
            newCost: change.after,
          })),
          estimated: true,
          status: 'PENDING_APPROVAL',
          currency,
        };
      },
    }),

    proposeStockAdjustment: tool({
      description: 'Propose a stock quantity change. Streams an approval card. Does NOT write to the database.',
      inputSchema: z.object({
        productId: z.string(), productName: z.string(),
        currentStock: z.number(), newStock: z.number().min(0),
        reason: z.string().describe('Why this change is needed.'),
      }),
      execute: async (p) => {
        if (p.newStock < 0) return { error: 'Cannot set stock to a negative value.' };
        return {
          type: 'PROPOSAL', action: 'STOCK_ADJUSTMENT',
          proposalId: `prop_stock_${p.productId}_${p.newStock}`,
          productId: p.productId, productName: p.productName,
          currentValue: p.currentStock, newValue: p.newStock,
          change: p.newStock - p.currentStock, reason: p.reason,
          status: 'PENDING_APPROVAL', currency,
        };
      },
    }),

    proposePriceChange: tool({
      description: 'Propose a selling price change. Streams an approval card. Does NOT write to the database.',
      inputSchema: z.object({
        productId: z.string(), productName: z.string(),
        currentPrice: z.number(), newPrice: z.number().min(0.01),
        reason: z.string(),
      }),
      execute: async (p) => {
        if (p.newPrice <= 0) return { error: 'Price must be a positive number.' };
        if (p.currentPrice <= 0) return { error: 'Current price is zero or missing, so the change cannot be validated.' };
        const changePercent = round2(((p.newPrice - p.currentPrice) / p.currentPrice) * 100);
        if (Math.abs(changePercent) > 200) {
          return { error: `Blocked: a ${changePercent}% price change is unusually large. Verify the figure and propose a smaller adjustment.` };
        }
        return {
          type: 'PROPOSAL', action: 'PRICE_CHANGE',
          proposalId: `prop_price_${p.productId}_${p.newPrice}`,
          productId: p.productId, productName: p.productName,
          currentValue: p.currentPrice, newValue: p.newPrice,
          changePercent, reason: p.reason,
          status: 'PENDING_APPROVAL', currency,
        };
      },
    }),

    proposeLoyaltyAdjustment: tool({
      description: 'Propose adding or deducting customer loyalty points. Requires approval.',
      inputSchema: z.object({
        customerId: z.string(), customerName: z.string(),
        currentPoints: z.number(), pointsChange: z.number(),
        reason: z.string(),
      }),
      execute: async (p) => {
        const newPoints = p.currentPoints + p.pointsChange;
        if (newPoints < 0) {
          return { error: `Cannot deduct ${Math.abs(p.pointsChange)} points — the customer only has ${p.currentPoints}.` };
        }
        return {
          type: 'PROPOSAL', action: 'LOYALTY_ADJUSTMENT',
          proposalId: `prop_loyalty_${p.customerId}_${newPoints}`,
          customerId: p.customerId, customerName: p.customerName,
          currentValue: p.currentPoints, newValue: newPoints,
          change: p.pointsChange, reason: p.reason,
          status: 'PENDING_APPROVAL', currency,
        };
      },
    }),

    proposeRestock: tool({
      description:
        'Propose raising a product\'s stock by a given number of units, e.g. after a delivery arrives. Requires approval.',
      inputSchema: z.object({
        productId: z.string(), productName: z.string(),
        currentStock: z.number(), unitsToAdd: z.number().min(1),
        reason: z.string(),
      }),
      execute: async (p) => {
        const newStock = p.currentStock + p.unitsToAdd;
        return {
          type: 'PROPOSAL', action: 'STOCK_ADJUSTMENT',
          proposalId: `prop_restock_${p.productId}_${newStock}`,
          productId: p.productId, productName: p.productName,
          currentValue: p.currentStock, newValue: newStock,
          change: p.unitsToAdd, reason: p.reason,
          status: 'PENDING_APPROVAL', currency,
        };
      },
    }),

    proposeLowStockThreshold: tool({
      description: 'Propose changing the low-stock alert threshold for a product. Requires approval.',
      inputSchema: z.object({
        productId: z.string(), productName: z.string(),
        currentThreshold: z.number(), newThreshold: z.number().min(0),
        reason: z.string(),
      }),
      execute: async (p) => ({
        type: 'PROPOSAL', action: 'THRESHOLD_CHANGE',
        proposalId: `prop_threshold_${p.productId}_${p.newThreshold}`,
        productId: p.productId, productName: p.productName,
        currentValue: p.currentThreshold, newValue: p.newThreshold,
        change: p.newThreshold - p.currentThreshold, reason: p.reason,
        status: 'PENDING_APPROVAL', currency,
      }),
    }),

    /**
     * Propose recording a sale.
     *
     * Only call this once the owner has actually confirmed *every* line — the
     * system prompt requires asking for product, quantity and payment method
     * before this tool runs. It is the one proposal that moves money, so it is
     * the strictest.
     *
     * Every line is re-resolved against Firestore here: the model supplies only
     * `productId` and `quantity`, and prices, names and stock come from the
     * product documents. That means the card the owner reads shows the real
     * total even if the model miscalculated, and it lets the tool refuse an
     * oversell before a card is ever drawn. The client re-checks all of this in
     * `proposal-guard.ts` against its own live snapshot, because stock can move
     * between this call and the owner tapping Approve.
     */
    proposeSale: tool({
      description:
        'Propose recording a sale, producing an approval card. Does NOT write to the database. ' +
        'Only call after the owner has confirmed the exact products, quantities and payment method. ' +
        'Never guess a quantity or a payment method — ask first.',
      inputSchema: z.object({
        items: z.array(z.object({
          productId: z.string().describe('Exact product id from a lookup tool, never a guess.'),
          quantity: z.number().int().min(1),
        })).min(1).max(50),
        paymentMethod: z.enum(['Cash', 'Card', 'Bank Transfer', 'Invoice']),
        customerId: z.string().optional().describe('Only if the owner named a customer.'),
        discount: z.number().min(0).optional().describe('Absolute amount off, not a percentage.'),
        confirmedByOwner: z.boolean().describe('True only if the owner explicitly confirmed these exact lines.'),
      }),
      execute: async (p) => {
        try {
          if (!p.confirmedByOwner) {
            return { error: 'Ask the owner to confirm the products, quantities and payment method first.' };
          }

          const catalogue = await allProducts();
          const lines: any[] = [];
          const wanted = new Map<string, number>();
          let subtotal = 0;

          for (const line of p.items) {
            const product = catalogue.find((x) => x.id === line.productId);
            if (!product) {
              return { error: `No product with id "${line.productId}". Look it up again before proposing the sale.` };
            }
            const price = Number(product.price) || 0;
            if (price <= 0) {
              return { error: `${product.name} has no price set, so it cannot be sold. Set a price first.` };
            }

            // Same product listed twice — total the ask before comparing stock.
            const running = (wanted.get(product.id) ?? 0) + line.quantity;
            wanted.set(product.id, running);

            const isService = product.categoryType === 'service' || product.type === 'service';
            const onHand = Number(product.stock) || 0;
            if (!isService && running > onHand) {
              return {
                error: `Not enough stock for ${product.name}: ${onHand} on hand but ${running} requested. ` +
                  'Tell the owner and ask whether to reduce the quantity or record a delivery first.',
              };
            }

            subtotal += price * line.quantity;
            lines.push({
              productId: product.id,
              name: product.name,
              quantity: line.quantity,
              price,
              lineTotal: round2(price * line.quantity),
              stockAfter: isService ? null : onHand - running,
            });
          }

          const discount = p.discount && p.discount > 0 ? p.discount : 0;
          if (discount > subtotal) {
            return { error: `The discount (${discount}) is more than the subtotal (${round2(subtotal)}).` };
          }

          let customerName: string | null = null;
          if (p.customerId) {
            const snap = await db.collection('customers').doc(p.customerId).get();
            if (!snap.exists) return { error: 'That customer id does not exist. Look the customer up again.' };
            // The Admin SDK bypasses firestore.rules, so the tenant check has to
            // happen here. Same wording as the not-found case on purpose: a
            // different message would confirm the id exists in another tenant.
            if ((snap.data() as any)?.businessId !== businessId) {
              return { error: 'That customer id does not exist. Look the customer up again.' };
            }
            customerName = (snap.data() as any)?.name ?? null;
          }

          // Tax is recomputed on the client from business settings; shown here
          // so the approval card can state the figure the owner will commit to.
          const settingsSnap = await db.collection('businessInstances').doc(businessId).get();
          const taxRate = Number((settingsSnap.data() as any)?.settings?.defaultTaxRate) || 0;
          const tax = round2((subtotal * taxRate) / 100);
          const total = round2(subtotal + tax - discount);

          return {
            type: 'PROPOSAL', action: 'RECORD_SALE',
            proposalId: `prop_sale_${lines.map((l) => `${l.productId}x${l.quantity}`).join('_')}_${total}`,
            items: lines,
            paymentMethod: p.paymentMethod,
            customerId: p.customerId ?? null, customerName,
            subtotal: round2(subtotal), tax, taxRate, discount, total,
            reason: `${lines.length} line${lines.length === 1 ? '' : 's'}, paid by ${p.paymentMethod}`,
            status: 'PENDING_APPROVAL', currency,
          };
        } catch (e: any) { return fail('Failed to build the sale', e); }
      },
    }),

    forecastRevenue: tool({
      description:
        'Project revenue forward from the actual sales trend. Use this for ANY forward-looking money question — "what will I make next month", "how much in a year", "where are we heading". It fits a line to real daily takings and reports its own confidence, refusing to extrapolate when the history is too thin. Never answer a projection question from memory; call this.',
      inputSchema: z.object({
        aheadDays: z.number().min(7).max(3650).default(30).describe('How far ahead to project, in days.'),
        basedOnDays: z.number().min(14).max(365).default(90).describe('How much history to fit the trend to.'),
      }),
      execute: async ({ aheadDays, basedOnDays }) => {
        try {
          const receipts = (await receiptsSince(basedOnDays)).filter(isPaid);
          const bucketed = bucketByDay(receipts, basedOnDays);

          const daily = [...bucketed.daily.values()];
          const daysWithSales = daily.filter((v) => v > 0).length;
          const observed = round2(daily.reduce((s, v) => s + v, 0));
          const unplaced = unplacedNote(bucketed, currency);

          /*
           * The honest refusal. A handful of sales cannot support a projection,
           * and the failure mode is not a vague answer — it is a confident
           * multi-year figure built from one transaction, which an owner could
           * actually plan against. Hand back the facts and say why instead.
           *
           * But refuse for the right reason. This used to conclude "only 1 day of
           * sales in the last 90" from the bucketed data alone, while receipts the
           * bucketing had thrown away sat in the same result set — so the tool told
           * owners their shop had barely traded when it had. If anything went
           * unplaced, that is the finding, and the refusal has to say so rather
           * than making a claim about how little the shop sold.
           */
          if (daysWithSales < 7) {
            const dropped = bucketed.undated + bucketed.future;
            return {
              type: 'METRICS',
              title: dropped ? 'Cannot project — the sales dates need fixing' : 'Not enough trading history to project',
              insufficientData: true,
              currency,
              tiles: [
                { label: `Revenue, last ${basedOnDays}d`, value: observed, format: 'currency' },
                { label: 'Days with a sale', value: daysWithSales, format: 'number' },
                ...(dropped ? [{ label: 'Sales with a bad date', value: dropped, format: 'number' as const }] : []),
              ],
              dataGap: unplaced ?? undefined,
              caveat: dropped
                ? `${unplaced} So the ${daysWithSales} day(s) counted above is not how much this shop has traded — it is how much of its trading carries a date that can be placed on a calendar. Fix those receipts' dates and ask again.`
                : `A projection needs at least 7 days that actually had sales; this book has ${daysWithSales}. Record more trading and ask again — a forecast from this little data would be a guess dressed up as a number.`,
            };
          }

          const { slope, intercept, r2 } = linearFit(daily);
          const n = daily.length;

          // Sum the fitted line across the future window, floored at zero: a
          // declining trend eventually predicts negative takings, which is not
          // a thing that happens in a shop.
          let projected = 0;
          for (let i = n; i < n + aheadDays; i++) projected += Math.max(0, intercept + slope * i);
          projected = round2(projected);

          const runRate = round2((observed / n) * aheadDays);
          const { level, caveat } = horizonConfidence(aheadDays, r2, daysWithSales);
          const direction = slope > 0.01 ? 'growing' : slope < -0.01 ? 'declining' : 'flat';

          const months = aheadDays / 30.44;
          const horizonLabel =
            aheadDays >= 365 ? `${round2(aheadDays / 365)} year${aheadDays >= 730 ? 's' : ''}`
            : months >= 1.5 ? `${Math.round(months)} months`
            : `${aheadDays} days`;

          return {
            type: 'METRICS',
            title: `Projection — next ${horizonLabel}`,
            currency,
            confidence: level,
            trend: direction,
            r2: round2(r2),
            projected,
            runRate,
            tiles: [
              { label: `Trend projection`, value: projected, format: 'currency', hint: `Fitted to ${n} days of takings` },
              { label: 'Flat run-rate', value: runRate, format: 'currency', hint: 'If today\'s average simply continued' },
              { label: `Actual, last ${basedOnDays}d`, value: observed, format: 'currency' },
              { label: 'Daily average', value: round2(observed / n), format: 'currency' },
              { label: 'Trend', value: direction, format: 'text' },
              { label: 'Fit quality', value: `${Math.round(r2 * 100)}%`, format: 'text', hint: 'How well a straight line explains the history' },
            ],
            flags: [`Confidence: ${level}.`],
            // The gap matters more here than in the refusal above, not less: this
            // branch hands back an actual number. A trend fitted to a history that
            // is missing receipts under-projects, and nothing else on this card
            // would hint at it.
            dataGap: unplaced ?? undefined,
            caveat: unplaced ? `${unplaced} ${caveat}` : caveat,
          };
        } catch (e: any) { return fail('Failed to build the projection', e); }
      },
    }),

    getGrowthRate: tool({
      description:
        'Growth rate between two consecutive equal periods, with the annualised equivalent. Use for "are we growing", "how fast", "what rate are we growing at".',
      inputSchema: z.object({ periodDays: z.number().min(7).max(180).default(30).describe('Length of each half being compared.') }),
      execute: async ({ periodDays }) => {
        try {
          const rows = (await receiptsSince(periodDays * 2)).filter(isPaid);
          const cutoff = Date.now() - periodDays * DAY_MS;
          let recent = 0;
          let prior = 0;
          for (const r of rows) {
            const t = toMillis(r.createdAt);
            if (t >= cutoff) recent = round2(recent + (r.total ?? 0));
            else prior = round2(prior + (r.total ?? 0));
          }

          if (prior === 0) {
            return {
              type: 'METRICS',
              title: `Growth — last ${periodDays} days`,
              insufficientData: true,
              currency,
              tiles: [{ label: 'Recent period', value: recent, format: 'currency' }],
              caveat: `Nothing was sold in the previous ${periodDays}-day period, so there is no baseline to measure growth against.`,
            };
          }

          const change = round2(((recent - prior) / prior) * 100);
          // Compounding a single period's change over a year overstates it wildly
          // when the period is short, so cap what gets presented as annualised.
          const periodsPerYear = 365 / periodDays;
          const annualised = periodsPerYear <= 12 ? round2((Math.pow(recent / prior, periodsPerYear) - 1) * 100) : null;

          return {
            type: 'METRICS',
            title: `Growth — last ${periodDays} days vs previous ${periodDays}`,
            currency,
            growthPercent: change,
            tiles: [
              { label: 'Change', value: change, format: 'percent' },
              { label: `Last ${periodDays}d`, value: recent, format: 'currency' },
              { label: `Previous ${periodDays}d`, value: prior, format: 'currency' },
              ...(annualised !== null ? [{ label: 'Annualised', value: annualised, format: 'percent', hint: 'If this rate repeated all year' }] : []),
            ],
            caveat: annualised === null
              ? 'Too short a period to annualise meaningfully.'
              : 'Annualised figures compound one period\'s change across a year — treat as indicative.',
          };
        } catch (e: any) { return fail('Failed to compute growth rate', e); }
      },
    }),

    forecastStockout: tool({
      description:
        'When each product will run out, based on its recent sales velocity, and the date to reorder by. Use for "what will run out", "what should I reorder first", "how long will stock last".',
      inputSchema: z.object({
        basedOnDays: z.number().min(7).max(180).default(30).describe('History window used to measure velocity.'),
        withinDays: z.number().min(1).max(365).default(30).describe('Only report items running out within this many days.'),
        limit: z.number().min(1).max(50).default(15),
      }),
      execute: async ({ basedOnDays, withinDays, limit }) => {
        try {
          const [products, receipts] = await Promise.all([allProducts(), receiptsSince(basedOnDays)]);
          const paid = receipts.filter(isPaid);

          const sold = new Map<string, number>();
          for (const r of paid) {
            for (const it of (r.items ?? [])) {
              const id = it.productId ?? it.id;
              if (id) sold.set(id, (sold.get(id) ?? 0) + (it.quantity ?? 0));
            }
          }

          const rows = products
            .map((p) => {
              const units = sold.get(p.id) ?? 0;
              const perDay = units / basedOnDays;
              const stock = p.stock ?? 0;
              // No movement means no forecastable stockout — an untouched item
              // is a dead-stock question, not a reorder one.
              const daysLeft = perDay > 0 ? Math.floor(stock / perDay) : null;
              return { id: p.id, name: p.name ?? 'Unnamed', sku: p.sku ?? null, stock, unitsSold: units, perDay: round2(perDay), daysLeft };
            })
            .filter((r) => r.daysLeft !== null && r.daysLeft <= withinDays)
            .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
            .slice(0, limit);

          if (rows.length === 0) {
            return {
              type: 'METRICS',
              title: `Stockout forecast — next ${withinDays} days`,
              currency,
              tiles: [{ label: 'Items at risk', value: 0, format: 'number' }],
              caveat: `Nothing with recent movement is projected to run out within ${withinDays} days. Items with no sales in the last ${basedOnDays} days are excluded — they have no velocity to project.`,
            };
          }

          const catalogue = new Map(products.map((p) => [p.id, p]));
          return {
            type: 'PRODUCT_TABLE',
            title: `Projected to run out within ${withinDays} days`,
            currency,
            products: productCards(rows.map((r) => ({
              p: catalogue.get(r.id),
              name: r.name,
              stats: [
                { label: 'Sold/day', value: r.perDay, format: 'number' },
                { label: 'Days left', value: r.daysLeft, format: 'number' },
              ],
            }))),
            // `columns` are display labels used directly as row keys by
            // DataTable — not {key,label} objects.
            columns: ['Product', 'In stock', 'Sold/day', 'Days left'],
            rows: rows.map((r) => ({
              Product: r.name,
              'In stock': r.stock,
              'Sold/day': r.perDay,
              'Days left': r.daysLeft,
            })),
            atRisk: rows.length,
            note: `Based on ${basedOnDays} days of velocity. Soonest first.`,
          };
        } catch (e: any) { return fail('Failed to forecast stockouts', e); }
      },
    }),
    reportUnanswered: tool({
      description:
        'Call this when you genuinely do not have the answer to the user\'s question, either because it is outside your business data or you lack the tools for it. It logs the unanswered query so the admin can review it later.',
      inputSchema: z.object({
        question: z.string().describe('The user\'s original question that you cannot answer.'),
      }),
      execute: async ({ question }) => {
        try {
          await db.collection('ai_unanswered_queries').add({
            businessId,
            question,
            createdAt: Timestamp.now(),
          });
          return {
            fallbackText: "I'm sorry, I don't have the answer to that right now.",
          };
        } catch (e: any) {
          return fail('Failed to report unanswered query', e);
        }
      },
    }),
  };
}

/**
 * Fields a tool result carries for the chat card and for nothing else.
 *
 * `imageUrl` is the whole reason this exists. It is a Firebase Storage URL, ~300
 * characters of signed path, the model cannot see the image behind it, and a
 * twelve-product `queryProducts` result therefore spent roughly 900 input tokens on
 * nothing — then spent them again on every later turn, because the result stays in
 * the history.
 */
const CARD_ONLY_KEYS = new Set(['imageUrl']);

/**
 * Strip a tool result down to what the model actually reads.
 *
 * Input is 98% of the tokens Zen AI sends and 85% of the Gemini bill, and a tool
 * result is charged more than once: when the step loop feeds it back, again on every
 * later step of the same turn, and again on every subsequent turn for as long as it
 * sits in the history. A field the model never reads is therefore not paid for once.
 *
 * This only ever *removes*. Nothing here rewrites a value, reorders a list or rounds
 * a figure — the card the owner sees and the JSON the model reads must never be able
 * to disagree about what the shop's numbers are.
 */
export function slimForModel(value: any): any {
  if (Array.isArray(value)) return value.map(slimForModel);
  if (value === null || typeof value !== 'object') return value;

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (CARD_ONLY_KEYS.has(k)) continue;
    // An absent key and a null one read identically to a model, and most shops leave
    // costPrice, baseUnit and expiryDate unset — so across a sparse catalogue the
    // nulls alone are a real share of the payload.
    if (v === null || v === undefined) continue;
    out[k] = slimForModel(v);
  }

  /*
   * `PRODUCT_TABLE` deliberately carries the same figures twice — `products` for the
   * card view and `columns`/`rows` for the table view, so the reader can pick (see
   * `productCards`). The model has no view to pick, and `products` is the half that
   * keeps the product ids it needs to chain into a proposal, so the table half goes.
   * Guarded on `products` actually being populated: the fallback must be the payload
   * that already worked, never no payload at all.
   */
  if (out.type === 'PRODUCT_TABLE' && Array.isArray(out.products) && out.products.length) {
    delete out.columns;
    delete out.rows;
  }

  /*
   * `LOSS_SCAN.summary` already holds every conclusion the scan reached —
   * `src/lib/forensics.ts` is arithmetic, not a model, and the prompt's only
   * instruction is to relay the summary. `report` is the card's copy: up to 15
   * findings with their evidence plus an eight-name watchlist. Sending it bought the
   * model nothing and made the most expensive turn in the product — a scan can run
   * the full 24 steps, each one resending it — more expensive still.
   */
  if (out.type === 'LOSS_SCAN' && out.summary) delete out.report;

  return out;
}

/**
 * The Zen AI toolkit, with the model's copy of every result slimmed.
 *
 * `toModelOutput` is the SDK's split between the two audiences: the full result
 * still streams to the client and draws the card, while the model is handed
 * `slimForModel`'s return. It fires inside the multi-step loop during a turn.
 *
 * It does **not** cover results replayed out of the chat history: that path runs
 * through `convertToModelMessages`, which only applies `toModelOutput` if the tool set
 * is passed to it as well — and in `route.ts` the conversion deliberately happens
 * *before* the credit reservation, so the tool set (which needs the business document)
 * does not exist yet. History is slimmed explicitly there instead, by `slimHistory`,
 * which calls the exported `slimForModel` so the two paths cannot drift.
 *
 * Applied here, over the whole set, rather than tool by tool: 46 hand-written
 * `toModelOutput`s is 46 chances to forget one, and forgetting is invisible — it
 * costs money silently and breaks nothing.
 */
export function createZenTools(ctx: Ctx): ToolSet {
  const built: Record<string, any> = buildZenTools(ctx);

  /*
   * With the rating off, `getBusinessRating` exists only to say so — and
   * `RATING_SECTION_OFF` in the prompt already says it, at more length, and tells the
   * model to answer with real figures instead. Sending the schema anyway cost ~157
   * input tokens on every turn of every opted-out shop, which is most of them while
   * the opt-in is new.
   */
  if (!ctx.ratingEnabled) delete built.getBusinessRating;

  const out: ToolSet = {};
  for (const [name, t] of Object.entries(built)) {
    out[name] = {
      ...t,
      toModelOutput: ({ output }: { output: any }) =>
        typeof output === 'string'
          ? ({ type: 'text', value: output } as const)
          : ({ type: 'json', value: slimForModel(output) } as const),
    };
  }
  return out;
}

/**
 * How many of the most recent tool results in a chat history keep their full payload.
 *
 * Everything older is replaced by a one-line stand-in. Zen averages ~1.5 tool calls per
 * turn, so eight covers roughly the last five exchanges intact — beyond which the model
 * has already said what it made of those figures, and its own prose saying so is still
 * in the history.
 *
 * The bound is the point. Every past tool result is resent on every subsequent turn, so
 * without one the cost of a conversation grows with its length even when each new
 * question is trivial: the twentieth question pays for the previous nineteen answers,
 * and one `queryProducts` result can be a few thousand tokens. Eight is deliberately
 * generous — this is protection against the runaway case, not a squeeze on ordinary
 * chats.
 */
const HISTORY_FULL_TOOL_RESULTS = 8;

/**
 * Below this, an old payload is left alone.
 *
 * Digesting a `LINK` or a two-figure `METRICS` card saves nothing and discards
 * something the model might want, so the trade only makes sense above a size where
 * re-fetching would genuinely have been cheaper than carrying it.
 */
const HISTORY_DIGEST_MIN_CHARS = 400;

/** UI message parts that carry a tool result — static (`tool-<name>`) or dynamic. */
function isToolPart(part: any): boolean {
  return (
    part != null &&
    typeof part.type === 'string' &&
    (part.type.startsWith('tool-') || part.type === 'dynamic-tool')
  );
}

/**
 * Cut a chat history down to what the model needs to read out of it.
 *
 * Input is ~98% of the tokens a Zen turn sends and ~85% of the Gemini bill, and the
 * history is the part that grows without limit. Two passes, both subtractive:
 *
 * 1. **Every** tool result goes through `slimForModel` — the same function
 *    `toModelOutput` applies to results produced *within* a turn. History cannot use
 *    that path: `convertToModelMessages` only honours `toModelOutput` when the tool set
 *    is handed to it, and in `route.ts` the conversion deliberately runs before the
 *    credit reservation that reads the business document the tool set is built from.
 *    Calling the same function here is what keeps one definition of "what the model
 *    reads" across both paths.
 * 2. Results older than `HISTORY_FULL_TOOL_RESULTS` and bigger than
 *    `HISTORY_DIGEST_MIN_CHARS` are replaced by their `type` and `title` plus a note
 *    saying the tool can be called again.
 *
 * It never touches text, never drops a message and never reorders anything, so the
 * transcript the owner is reading stays the transcript the model sees. The client's own
 * copy is untouched regardless — this builds a server-side view for one request.
 */
export function slimHistory(messages: any[]): any[] {
  const toolParts: string[] = [];
  messages.forEach((m, mi) => {
    if (!Array.isArray(m?.parts)) return;
    m.parts.forEach((part: any, pi: number) => {
      if (isToolPart(part) && 'output' in part) toolParts.push(`${mi}:${pi}`);
    });
  });
  if (!toolParts.length) return messages;

  // Newest last, so the tail is what survives in full.
  const stale = new Set(
    toolParts.slice(0, Math.max(0, toolParts.length - HISTORY_FULL_TOOL_RESULTS)),
  );

  return messages.map((m, mi) => {
    if (!Array.isArray(m?.parts)) return m;
    return {
      ...m,
      parts: m.parts.map((part: any, pi: number) => {
        if (!isToolPart(part) || !('output' in part)) return part;

        const slim = slimForModel(part.output);
        if (!stale.has(`${mi}:${pi}`)) return { ...part, output: slim };

        let size = 0;
        try {
          size = JSON.stringify(slim ?? null).length;
        } catch {
          // A result that will not serialise cannot be measured, so leave it alone
          // rather than guess — `convertToModelMessages` is the right place for that to
          // fail loudly.
          return { ...part, output: slim };
        }
        if (size < HISTORY_DIGEST_MIN_CHARS) return { ...part, output: slim };

        const digest: Record<string, any> = {
          note: 'Earlier result, omitted to keep this conversation cheap. Call the tool again if you need these figures.',
        };
        if (slim && typeof slim === 'object') {
          if (typeof slim.type === 'string') digest.type = slim.type;
          if (typeof slim.title === 'string') digest.title = slim.title;
        }
        return { ...part, output: digest };
      }),
    };
  });
}
