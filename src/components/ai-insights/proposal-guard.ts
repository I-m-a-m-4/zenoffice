/**
 * Client-side validation for anything Zen AI proposes to write.
 *
 * The model's output is untrusted input. The system prompt tells it to only
 * propose sane changes, but a prompt is a request, not a constraint — an
 * injected instruction in a product name, a hallucinated product id, or a
 * confused unit conversion all produce a proposal card that *looks* fine.
 *
 * So every proposal is re-checked here, against the live records in POS context,
 * at the moment the owner taps Approve. Two things this catches that the server
 * cannot:
 *
 *   1. **Staleness.** The model read stock a minute ago; a cashier has sold
 *      three since. Approving a "set stock to 12" built on stale data silently
 *      reverses that sale.
 *   2. **Existence.** A hallucinated `productId` would otherwise be written as
 *      a new document by `updateDoc`'s merge behaviour on some paths.
 *
 * Anything refused here returns a plain-language reason that goes straight into
 * a toast, so the owner learns why rather than seeing a silent no-op.
 */

import { describeBulkOp, groupWrites, previewBulkOp } from '@/lib/import/bulk-ops';

/** Absolute ceilings. Anything past these is a data-entry or model error. */
const MAX_STOCK = 1_000_000;
const MAX_PRICE = 1_000_000_000;
const MAX_LINE_QTY = 10_000;
const MAX_SALE_LINES = 50;
const MAX_SALE_TOTAL = 1_000_000_000;

/** How far the live value may have drifted from what the model saw. */
const STOCK_DRIFT_TOLERANCE = 0;

/**
 * A write this guard has authorised, ready for `addToQueue`.
 *
 * Returned by the multi-product proposals rather than leaving the caller to rebuild the
 * list, because the guard is the only thing that knows which rows survived validation. A
 * caller that reconstructed the writes from the proposal card would be writing rows the
 * guard had already rejected.
 *
 * Exactly one of `productId` / `productIds` is set: single-product writes go through
 * `update-product` and grouped ones through `bulk-update-products`.
 */
export type GuardWrite = {
  productId?: string;
  productIds?: string[];
  values: Record<string, any>;
  /** Queue description, shown in the offline queue and the sync log. */
  label: string;
};

type GuardOk = {
  ok: true;
  current?: number;
  /** Set by proposals that touch many products at once. */
  writes?: GuardWrite[];
  /** Products affected, when that differs from `writes.length` because of grouping. */
  count?: number;
};
type GuardFail = { ok: false; reason: string };
export type GuardResult = GuardOk | GuardFail;

const fail = (reason: string): GuardFail => ({ ok: false, reason });

function isFiniteNumber(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Validate a non-sale proposal against live data.
 *
 * `currentValue` on the proposal is what the model believed; we compare it to
 * the record as it stands now and refuse if they disagree, because the owner is
 * approving the *card they can see*, and the card shows the model's numbers.
 */
export function validateProposal(
  action: any,
  { products, customers }: { products?: any[] | null; customers?: any[] | null },
): GuardResult {
  if (!action || typeof action !== 'object') return fail('The proposal is malformed.');
  if (action.type !== 'PROPOSAL') return fail('That is not an approvable proposal.');

  switch (action.action) {
    case 'STOCK_ADJUSTMENT': {
      const product = products?.find(p => p.id === action.productId);
      if (!product) return fail('That product is no longer in your inventory. Ask Zen AI to look it up again.');
      if (!isFiniteNumber(action.newValue)) return fail('The proposed stock figure is not a number.');
      if (action.newValue < 0) return fail('Stock cannot be set below zero.');
      if (action.newValue > MAX_STOCK) return fail(`${action.newValue.toLocaleString()} is beyond the allowed stock ceiling.`);
      if (!Number.isInteger(action.newValue)) return fail('Stock must be a whole number of units.');

      const live = product.stock ?? 0;
      if (isFiniteNumber(action.currentValue) && Math.abs(live - action.currentValue) > STOCK_DRIFT_TOLERANCE) {
        return fail(
          `Stock changed since Zen AI checked — it is now ${live}, not ${action.currentValue}. ` +
          'Ask again so the proposal is based on the current figure.',
        );
      }
      return { ok: true, current: live };
    }

    case 'THRESHOLD_CHANGE': {
      const product = products?.find(p => p.id === action.productId);
      if (!product) return fail('That product is no longer in your inventory.');
      if (!isFiniteNumber(action.newValue) || action.newValue < 0) return fail('The threshold must be zero or more.');
      if (!Number.isInteger(action.newValue)) return fail('The threshold must be a whole number.');
      if (action.newValue > MAX_STOCK) return fail('That threshold is unreasonably high.');
      return { ok: true, current: product.lowStockThreshold ?? 0 };
    }

    case 'PRICE_CHANGE': {
      const product = products?.find(p => p.id === action.productId);
      if (!product) return fail('That product is no longer in your inventory.');
      if (!isFiniteNumber(action.newValue)) return fail('The proposed price is not a number.');
      if (action.newValue <= 0) return fail('Price must be greater than zero.');
      if (action.newValue > MAX_PRICE) return fail('That price is beyond the allowed ceiling.');

      const live = product.price ?? 0;
      if (isFiniteNumber(action.currentValue) && Math.abs(live - action.currentValue) > 0.005) {
        return fail(
          `The price changed since Zen AI checked — it is now ${live}, not ${action.currentValue}. Ask again.`,
        );
      }
      // Selling below cost is legitimate (clearance), but it should be a
      // deliberate choice rather than something approved by accident.
      const cost = product.costPrice ?? 0;
      if (cost > 0 && action.newValue < cost) {
        return fail(
          `That price (${action.newValue}) is below the cost price (${cost}), so every sale would lose money. ` +
          'Change it from the Inventory page if that is intended.',
        );
      }
      return { ok: true, current: live };
    }

    case 'LOYALTY_ADJUSTMENT': {
      const customer = customers?.find(c => c.id === action.customerId);
      if (!customer) return fail('That customer is no longer in your records.');
      if (!isFiniteNumber(action.newValue) || action.newValue < 0) return fail('Loyalty points cannot go below zero.');
      if (!Number.isInteger(action.newValue)) return fail('Loyalty points must be a whole number.');
      return { ok: true, current: customer.loyaltyPoints ?? 0 };
    }

    case 'RECORD_SALE':
      // Sales are validated in full by buildSaleFromProposal, which needs the
      // business settings too. Only the shape is checked here.
      if (!Array.isArray(action.items) || action.items.length === 0) return fail('The sale has no items.');
      if (action.items.length > MAX_SALE_LINES) return fail(`A sale cannot have more than ${MAX_SALE_LINES} lines.`);
      return { ok: true };

    /*
     * Cost prices for many products at once.
     *
     * No staleness check, and that is deliberate rather than an omission. A stock
     * adjustment says "set it to 12" and is only correct relative to what it was when the
     * model looked, so drift invalidates it. "The cost price is ₦380" is a statement about
     * a purchase the owner made — it does not depend on what Zeneva currently holds, so a
     * cashier selling three units in the meantime changes nothing about whether it is true.
     *
     * What is checked is existence and sanity, per row, and a row whose product has since
     * been deleted is dropped rather than failing the whole card: refusing twenty good
     * cost prices because the twenty-first product was deleted would be maddening.
     */
    case 'COST_PRICES': {
      const rows = Array.isArray(action.matched) ? action.matched : [];
      if (rows.length === 0) return fail('That proposal has no matched products in it.');

      const writes: GuardWrite[] = [];
      for (const row of rows) {
        const product = products?.find((p) => p.id === row?.productId);
        if (!product) continue;
        const cost = Number(row?.newCost);
        if (!isFiniteNumber(cost) || cost < 0 || cost > MAX_PRICE) continue;
        // Unchanged rows are dropped so approving twice costs no writes.
        if (isFiniteNumber(product.costPrice) && Math.abs(product.costPrice - cost) < 0.005) continue;

        writes.push({
          productId: product.id,
          // `costPriceEstimated: false` matters: this figure came from a human, so it must
          // clear any earlier margin-derived guess rather than sit alongside it looking
          // identical.
          values: { costPrice: cost, costPriceEstimated: false },
          label: `Cost price for ${product.name}`,
        });
      }

      if (writes.length === 0) {
        return fail('Nothing to apply — those products already have those cost prices, or they have been deleted.');
      }
      return { ok: true, writes };
    }

    /*
     * A margin sweep, revalidated by recomputing the rule.
     *
     * The card carries a *rule* and a sample, never the full list of values, so approval
     * recomputes against the products as they stand now — `previewBulkOp` is the same
     * function that produced the server's preview, and it is what enforces the two things
     * that must hold however this is reached: a real cost price is never overwritten by an
     * estimate, and a product with no selling price is skipped rather than given a cost of
     * zero.
     *
     * So the model's numbers are not trusted here; only its *percentage* and *basis* are,
     * and both are bounded below.
     */
    case 'COST_ESTIMATE': {
      const percent = Number(action.percent);
      if (!isFiniteNumber(percent) || percent <= 0 || percent >= 100) {
        return fail('That margin is not a usable percentage.');
      }
      if (action.basis !== 'margin' && action.basis !== 'markup') {
        return fail('That proposal does not say whether it is a margin or a markup.');
      }
      if (!products || products.length === 0) return fail('No products to work on.');

      const op = {
        field: 'costPrice' as const,
        mode:
          action.basis === 'margin'
            ? { kind: 'cost-from-margin' as const, percent }
            : { kind: 'cost-from-markup' as const, percent },
        filter: action.category ? { categories: [String(action.category)] } : {},
      };

      const preview = previewBulkOp(products as any, op);
      if (preview.changes.length === 0) {
        return fail(
          preview.skipped.length > 0
            ? `Nothing to estimate — ${preview.skipped[0].reason}`
            : 'Nothing matches that any more.',
        );
      }

      const writes: GuardWrite[] = groupWrites(preview).map((group) => ({
        productIds: group.productIds,
        values: group.value,
        label: `${describeBulkOp(op, '')} (${group.productIds.length} products)`,
      }));

      return { ok: true, writes, count: preview.changes.length };
    }

    default:
      return fail(`"${action.action}" is not an action Zen AI is allowed to apply.`);
  }
}

type SaleOk = { ok: true; payload: any; receiptNumber: string };
export type SaleResult = SaleOk | GuardFail;

/**
 * Is `when` outside the business's configured trading hours?
 *
 * Mirrors the same check in `sales/pos/review/page.tsx`, including the
 * overnight case (close time earlier than open time, e.g. 20:00–02:00), where
 * "inside hours" means *either* side of midnight rather than between the two
 * numbers. Returns null when the feature is off or the times are unparseable,
 * so a malformed setting cannot block a sale.
 */
function outsideOperatingHours(business: any, when: Date): { openTime: string; closeTime: string } | null {
  const hours = business?.settings?.operatingHours;
  if (!hours?.enabled || typeof hours.openTime !== 'string' || typeof hours.closeTime !== 'string') return null;

  const [openH, openM] = hours.openTime.split(':').map(Number);
  const [closeH, closeM] = hours.closeTime.split(':').map(Number);
  if (![openH, openM, closeH, closeM].every(Number.isFinite)) return null;

  const nowMinutes = when.getHours() * 60 + when.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const outside = closeMinutes < openMinutes
    ? !(nowMinutes >= openMinutes || nowMinutes <= closeMinutes)
    : nowMinutes < openMinutes || nowMinutes > closeMinutes;

  return outside ? { openTime: hours.openTime, closeTime: hours.closeTime } : null;
}

/**
 * Turn an approved RECORD_SALE proposal into a `complete-sale` queue payload.
 *
 * This deliberately mirrors `src/app/(app)/sales/pos/review/page.tsx` rather
 * than trusting the model's arithmetic: **prices, tax and totals are all
 * recomputed from the master product records here.** The model's figures are
 * used only to decide *what* to sell, never *for how much* — same reason the POS
 * review page ignores the cart's prices and re-reads them from `products`.
 *
 * Stock is checked per line. Overselling is refused rather than allowed to push
 * stock negative, because the owner approving a card cannot see that a cashier
 * sold the last unit thirty seconds ago.
 */
export function buildSaleFromProposal(
  action: any,
  { products, customers, business, businessId, userId, isAdmin }: {
    products?: any[] | null;
    customers?: any[] | null;
    /** The `businessInstances/{id}` document — read for `settings` only. */
    business?: any;
    /**
     * Passed separately because the caller holds the business document from
     * `docSnap.data()`, which does not carry its own id. Without this the
     * receipt would be written with `businessId: undefined` and vanish from
     * every list that filters on it.
     */
    businessId?: string | null;
    userId?: string | null;
    /** Admins may record outside operating hours; staff may not. */
    isAdmin?: boolean;
  },
): SaleResult {
  if (!userId) return fail('You are signed out. Sign in again to record a sale.');
  if (!businessId) return fail('Your business is still loading. Try again in a moment.');
  if (!Array.isArray(action?.items) || action.items.length === 0) return fail('The sale has no items.');

  const paymentMethod = action.paymentMethod;
  const ALLOWED = ['Cash', 'Card', 'Bank Transfer', 'Invoice'];
  if (!ALLOWED.includes(paymentMethod)) {
    return fail(`"${paymentMethod}" is not a payment method. Use Cash, Card, Bank Transfer or Invoice.`);
  }

  let subtotal = 0;
  let totalCost = 0;
  const items: any[] = [];
  const stockByProduct = new Map<string, number>();
  /*
   * Units sold per product, carried alongside the absolute figure above.
   *
   * The queue writes stock as `increment(-quantitySold)` so a concurrent till's
   * sale is added to rather than overwritten. Without this the sale falls back to
   * the legacy absolute write and takes the lost-update bug with it — the POS
   * review page carries the same field for the same reason. `stockByProduct` is
   * still needed: it is what the running availability check above reads, and what
   * the optimistic local update uses.
   */
  const soldByProduct = new Map<string, number>();

  for (const line of action.items) {
    const product = products?.find(p => p.id === line.productId);
    if (!product) return fail(`"${line.name ?? line.productId}" is not in your inventory any more.`);

    const qty = line.quantity;
    if (!isFiniteNumber(qty) || qty <= 0) return fail(`The quantity for ${product.name} is not valid.`);
    if (!Number.isInteger(qty)) return fail(`${product.name}: quantity must be a whole number.`);
    if (qty > MAX_LINE_QTY) return fail(`${product.name}: ${qty} units is beyond the per-line limit.`);

    // Price comes from the master record, never from the model.
    const price = product.price ?? 0;
    if (!isFiniteNumber(price) || price <= 0) {
      return fail(`${product.name} has no valid price set, so it cannot be sold from here.`);
    }
    const costPrice = product.costPrice ?? 0;

    // Services do not carry stock.
    const isService = product.categoryType === 'service' || product.type === 'service';
    if (!isService) {
      const already = stockByProduct.get(product.id) ?? (product.stock ?? 0);
      if (already - qty < 0) {
        return fail(
          `Not enough stock for ${product.name} — ${already} on hand, ${qty} requested. ` +
          'Record the delivery first, or reduce the quantity.',
        );
      }
      stockByProduct.set(product.id, already - qty);
      soldByProduct.set(product.id, (soldByProduct.get(product.id) ?? 0) + qty);
    }

    subtotal += price * qty;
    totalCost += costPrice * qty;
    items.push({
      productId: product.id,
      name: product.name,
      quantity: qty,
      unit: null,
      multiplier: 1,
      price,
      costPrice,
    });
  }

  const discount = isFiniteNumber(action.discount) && action.discount > 0 ? action.discount : 0;
  if (discount > subtotal) return fail(`The discount (${discount}) is larger than the sale subtotal (${subtotal}).`);

  const taxRate = business?.settings?.defaultTaxRate || 0;
  const tax = (subtotal * taxRate) / 100;
  const total = subtotal + tax - discount;

  if (!isFiniteNumber(total) || total < 0) return fail('The sale total works out negative. Check the discount.');
  if (total > MAX_SALE_TOTAL) return fail('That sale total is implausibly large — record it from the POS page instead.');

  /*
   * The owner approves the total printed on the card. If a price or the tax rate
   * moved between the card being drawn and Approve being tapped, this figure no
   * longer matches what they read — so committing it would charge a number they
   * never agreed to. Refuse and make them ask again rather than silently
   * substituting the new total.
   *
   * A cent of tolerance absorbs float noise in the tax multiplication.
   */
  if (isFiniteNumber(action.total) && Math.abs(total - action.total) > 0.01) {
    return fail(
      `Prices changed since Zen AI drew this up — the total is now ${total.toFixed(2)}, not ${Number(action.total).toFixed(2)}. ` +
      'Ask for the sale again so you are approving the right figure.',
    );
  }

  const customer = action.customerId ? customers?.find(c => c.id === action.customerId) : null;
  if (action.customerId && !customer) return fail('That customer is no longer in your records.');

  const receiptId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const receiptNumber = `rec-${receiptId.split('-')[0]}`;
  const status = paymentMethod === 'Invoice' ? 'unpaid' : 'paid';

  // Operating hours are enforced here for the same reason the POS review page
  // enforces them: a sale rung up at 3am is either a mistake or worth knowing
  // about. `preventSalesOutsideHours` is a hard stop for non-admins; otherwise
  // the receipt carries the flag so it still surfaces in reports.
  const breach = outsideOperatingHours(business, new Date());
  if (breach && business?.settings?.operatingHours?.preventSalesOutsideHours && !isAdmin) {
    return fail(
      `Your settings block sales outside ${breach.openTime}–${breach.closeTime}. ` +
      'An admin can record this one from the POS page.',
    );
  }

  const receiptData = {
    id: receiptId,
    businessId,
    receiptNumber,
    items,
    customer: customer ? { id: customer.id, name: customer.name, email: customer.email ?? null } : null,
    subtotal,
    tax,
    discount,
    total,
    totalCost,
    profit: total - totalCost,
    paymentMethod,
    status,
    createdAt: new Date(),
    isBackdated: false,
    createdBy: userId,
    flagged: breach
      ? { reason: 'outside_operating_hours', openTime: breach.openTime, closeTime: breach.closeTime }
      : null,
    wasScanned: false,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    receiptMethod: 'none',
    // Marks the sale as AI-assisted so it is distinguishable in the audit trail.
    recordedVia: 'zen-ai',
  };

  const productUpdates = Array.from(stockByProduct.entries()).map(([id, newStock]) => {
    const product = products?.find(p => p.id === id);
    return { id, newStock, quantitySold: soldByProduct.get(id) ?? 0, type: product?.type, components: product?.components };
  });

  const customerUpdate = customer
    ? {
        id: customer.id,
        loyaltyPoints: business?.settings?.loyaltyProgramEnabled
          ? (customer.loyaltyPoints || 0) + Math.floor(total * (business.settings.pointsPerUnit || 0))
          : (customer.loyaltyPoints || 0),
        totalSpent: total,
      }
    : null;

  return { ok: true, receiptNumber, payload: { receiptData, productUpdates, customerUpdate } };
}
