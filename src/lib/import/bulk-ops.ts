/**
 * Changing a field on many products at once, safely.
 *
 * The problem this solves: an owner whose supplier raised prices 8% has to touch
 * a thousand cost prices, and doing it one product at a time is not a real
 * option. The problem it avoids: "AI, update my cost prices" turning into a
 * thousand opaque writes nobody can check or undo.
 *
 * The answer to both is that a bulk edit is a **declarative operation** — one
 * small object saying which field, which products, and what arithmetic. The model
 * (or the form) produces the operation; this module applies it locally and returns
 * every before→after pair; the owner approves what they can see; only then does
 * anything get written. Nothing here touches Firestore, and the model never emits
 * a value — only the rule that derives one.
 *
 * That is the same shape as Zen AI's `propose*` tools, and for the same reason:
 * an AI-authored write the owner cannot inspect before it lands is not a feature
 * anyone should ship over somebody's stock ledger.
 */

import type { Product } from '@/types';
import { normalizeName } from './normalize';

// ─────────────────────────────────────────────────────────────────────────────
// The operation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fields a bulk edit may touch.
 *
 * `name` and `sku` are deliberately absent. They are identity: a bulk rewrite of
 * either breaks every receipt, every barcode label and every duplicate check that
 * has ever run, and no arithmetic rule expresses a sensible change to them.
 */
export type BulkField = 'price' | 'costPrice' | 'stock' | 'lowStockThreshold' | 'category';

export type BulkMode =
  /** Same value on every matched product. */
  | { kind: 'set'; value: number | string }
  | { kind: 'increase-percent'; percent: number }
  | { kind: 'decrease-percent'; percent: number }
  | { kind: 'increase-amount'; amount: number }
  | { kind: 'decrease-amount'; amount: number }
  /** Round to the nearest multiple — `50` turns ₦1,237 into ₦1,250. */
  | { kind: 'round'; nearest: number }
  /**
   * Set the selling price from the cost price and a target **margin**
   * (`price = cost / (1 - margin)`). Margin is a share of the *selling* price.
   */
  | { kind: 'margin'; percent: number }
  /**
   * Set the selling price from the cost price and a **markup**
   * (`price = cost × (1 + markup)`). Markup is a share of the *cost*.
   *
   * Kept distinct from `margin` because shopkeepers say "50%" for both and mean
   * very different numbers — a 50% markup on ₦100 is ₦150, a 50% margin is ₦200.
   * Collapsing them silently underprices stock by a third.
   */
  | { kind: 'markup'; percent: number }
  /**
   * Set the **cost** price from the selling price and a target margin
   * (`cost = price × (1 − margin)`).
   *
   * The inverse of `margin`, and the reason it exists is the single cheapest way to fill
   * a catalogue that has selling prices and no costs: one sentence — "I sell drinks at
   * about 25%" — covers hundreds of products with no typing at all.
   *
   * Everything it writes is an **estimate** and is flagged as such. See
   * `costPriceEstimated` in `src/types.ts`: an unflagged guess would be read as fact by
   * every margin report the shop runs afterwards.
   */
  | { kind: 'cost-from-margin'; percent: number }
  /** As above, from a markup on cost instead: `cost = price ÷ (1 + markup)`. */
  | { kind: 'cost-from-markup'; percent: number };

/**
 * Which products an operation applies to.
 *
 * Every member is optional and they combine with AND. An empty filter matches the
 * whole catalogue, which is a legitimate thing to want and is why the preview
 * always states the count before anything is written.
 */
export type BulkFilter = {
  /** Explicit ids — what the Inventory page's checkboxes produce. */
  productIds?: string[];
  /** Matched case-insensitively against the exact category name. */
  categories?: string[];
  /** Token-wise containment against the product name. */
  nameContains?: string;
  stockBelow?: number;
  stockAbove?: number;
  priceBelow?: number;
  priceAbove?: number;
  /** Only products with no usable cost price — the "fill in the gaps" case. */
  missingCostPrice?: boolean;
  missingPrice?: boolean;
};

export type BulkOp = {
  field: BulkField;
  mode: BulkMode;
  filter: BulkFilter;
};

// ─────────────────────────────────────────────────────────────────────────────
// Selection
// ─────────────────────────────────────────────────────────────────────────────

/** Products a filter matches, in catalogue order. */
export function selectProducts(products: Product[], filter: BulkFilter): Product[] {
  const ids = filter.productIds ? new Set(filter.productIds) : null;
  const categories = filter.categories
    ? new Set(filter.categories.map((c) => c.trim().toLowerCase()))
    : null;
  // Compared on normalised tokens so "coca cola" finds "Coca-Cola Original".
  const wanted = filter.nameContains ? normalizeName(filter.nameContains).split(' ').filter(Boolean) : null;

  return products.filter((product) => {
    if (!product?.id) return false;
    if (ids && !ids.has(product.id)) return false;
    if (categories && !categories.has(String(product.category ?? '').trim().toLowerCase())) return false;

    if (wanted && wanted.length > 0) {
      const haystack = normalizeName(product.name || '');
      if (!wanted.every((token) => haystack.includes(token))) return false;
    }

    const stock = Number(product.stock) || 0;
    if (filter.stockBelow != null && !(stock < filter.stockBelow)) return false;
    if (filter.stockAbove != null && !(stock > filter.stockAbove)) return false;

    const price = Number(product.price) || 0;
    if (filter.priceBelow != null && !(price < filter.priceBelow)) return false;
    if (filter.priceAbove != null && !(price > filter.priceAbove)) return false;

    if (filter.missingCostPrice && Number(product.costPrice) > 0) return false;
    if (filter.missingPrice && Number(product.price) > 0) return false;

    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Application
// ─────────────────────────────────────────────────────────────────────────────

/** One product's before and after, or why it was left alone. */
export type BulkChange = {
  productId: string;
  productName: string;
  field: BulkField;
  before: number | string | undefined;
  after: number | string;
};

/**
 * Why a product was left alone, as a code rather than a sentence.
 *
 * `reason` below is English prose and stays that way: it is written into the audit
 * log and into a queued action's description, both of which are read later — the
 * audit log possibly by the owner rather than by whoever performed the sweep, and a
 * queued description after the reader may have switched language. A stored sentence
 * in the performer's language is a record nobody else can read.
 *
 * The screen is the opposite case: it is read now, by the person looking at it, and
 * must be in their language. So the code is what the UI translates and the prose is
 * what gets stored. Both come out of the same `switch`, so they cannot describe
 * different things.
 */
export type BulkSkipCode =
  | 'category-set-only'
  | 'no-category-name'
  | 'not-a-number'
  | 'margin-price-only'
  | 'no-cost-price'
  | 'margin-impossible'
  | 'cost-fill-only'
  | 'already-has-real-cost'
  | 'no-selling-price'
  | 'markup-unusable'
  | 'margin-would-zero-cost'
  | 'nothing-to-round-to'
  | 'nothing-to-round'
  | 'no-cost-for-percent'
  | 'nothing-to-adjust'
  | 'unrecognised';

export type BulkSkip = {
  productId: string;
  productName: string;
  /** A sentence, shown in the preview. Skipped rows are never hidden. */
  reason: string;
  /** The same fact as `reason`, for a caller that needs to translate it. */
  code: BulkSkipCode;
};

export type BulkPreview = {
  op: BulkOp;
  changes: BulkChange[];
  skipped: BulkSkip[];
  /** Matched but already at the target value — counted, not listed. */
  unchanged: number;
};

/** Money rounded to two decimals, so a percentage never yields ₦12.340000001. */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Work out what an operation would do, without doing it.
 *
 * The whole safety story lives in the return value: the caller renders it, the
 * owner reads it, and only the `changes` array is ever written. `skipped` is
 * equally important and must be shown — a margin rule silently skipping 400
 * products with no cost price looks like success and is not.
 */
export function previewBulkOp(products: Product[], op: BulkOp): BulkPreview {
  const selected = selectProducts(products, op.filter);
  const changes: BulkChange[] = [];
  const skipped: BulkSkip[] = [];
  let unchanged = 0;

  for (const product of selected) {
    const outcome = applyMode(product, op.field, op.mode);

    if ('reason' in outcome) {
      skipped.push({ productId: product.id, productName: product.name, reason: outcome.reason, code: outcome.code });
      continue;
    }

    const before = currentValue(product, op.field);
    if (sameValue(before, outcome.value)) {
      unchanged++;
      continue;
    }

    changes.push({
      productId: product.id,
      productName: product.name,
      field: op.field,
      before,
      after: outcome.value,
    });
  }

  return { op, changes, skipped, unchanged };
}

function currentValue(product: Product, field: BulkField): number | string | undefined {
  if (field === 'category') return product.category;
  const raw = (product as any)[field];
  return typeof raw === 'number' ? raw : raw == null ? undefined : Number(raw) || 0;
}

function sameValue(before: number | string | undefined, after: number | string): boolean {
  if (typeof after === 'number' && typeof before === 'number') {
    return Math.abs(before - after) < 0.005;
  }
  return String(before ?? '') === String(after);
}

type ModeOutcome = { value: number | string } | { reason: string; code: BulkSkipCode };

/**
 * Apply one mode to one product.
 *
 * The refusals matter more than the arithmetic:
 *
 * - **A percentage of nothing is nothing.** Raising a cost price of 0 by 8% is 0,
 *   so a product with no cost price is skipped and reported rather than written
 *   back as 0 — which would look like the edit worked.
 * - **Margin and markup need a cost price.** Deriving a selling price from a cost
 *   of 0 gives 0, and a product priced at 0 is one the POS will sell for free.
 *   This is the single most destructive thing this module could do, so it is a
 *   hard skip.
 * - **A 100% margin is impossible**, not infinite: `cost / (1 - 1)` divides by
 *   zero. Refused with a sentence rather than yielding `Infinity`.
 * - **Nothing goes negative.** A decrease past zero floors at zero.
 */
function applyMode(product: Product, field: BulkField, mode: BulkMode): ModeOutcome {
  if (field === 'category') {
    if (mode.kind !== 'set') return { reason: 'Category can only be set to a value, not adjusted.', code: 'category-set-only' };
    const value = String(mode.value ?? '').trim();
    if (!value) return { reason: 'No category name given.', code: 'no-category-name' };
    return { value };
  }

  if (mode.kind === 'set') {
    const value = Number(mode.value);
    if (!Number.isFinite(value) || value < 0) return { reason: 'Not a usable number.', code: 'not-a-number' };
    return { value: field === 'price' || field === 'costPrice' ? money(value) : Math.round(value) };
  }

  const isMoney = field === 'price' || field === 'costPrice';
  const round = (value: number) => (isMoney ? money(value) : Math.max(0, Math.round(value)));

  if (mode.kind === 'margin' || mode.kind === 'markup') {
    if (field !== 'price') {
      return { reason: 'A margin or markup can only set the selling price.', code: 'margin-price-only' };
    }
    const cost = Number(product.costPrice) || 0;
    if (cost <= 0) {
      return { reason: 'No cost price on record, so a margin cannot be worked out.', code: 'no-cost-price' };
    }
    const share = mode.percent / 100;
    if (mode.kind === 'markup') return { value: money(cost * (1 + share)) };
    if (share >= 1) return { reason: 'A margin of 100% or more is not possible.', code: 'margin-impossible' };
    return { value: money(cost / (1 - share)) };
  }

  /*
   * The inverse: derive the cost from the selling price.
   *
   * Refuses on a zero selling price rather than writing a zero cost. A cost of 0 reads
   * as "this product is pure profit" everywhere downstream — it would inflate the
   * rating's margin pillar, the dead-stock figure and every profit report at once, and
   * it is silent because 0 is a legal value.
   */
  if (mode.kind === 'cost-from-margin' || mode.kind === 'cost-from-markup') {
    if (field !== 'costPrice') {
      return { reason: 'That only works when filling in cost prices.', code: 'cost-fill-only' };
    }
    /*
     * An estimate must never overwrite a real cost.
     *
     * This is the asymmetry the whole `costPriceEstimated` flag exists to enforce. A
     * shop that has entered thirty real cost prices and then runs a margin sweep to fill
     * the other nine hundred must keep those thirty — silently replacing a figure read
     * off a waybill with one derived from an assumed margin destroys the only accurate
     * data they had, and nothing on screen would look different afterwards.
     */
    const existing = Number(product.costPrice) || 0;
    if (existing > 0 && !product.costPriceEstimated) {
      return { reason: 'Already has a real cost price, so it was left alone.', code: 'already-has-real-cost' };
    }
    const price = Number(product.price) || 0;
    if (price <= 0) {
      return { reason: 'No selling price on record, so the cost cannot be worked back.', code: 'no-selling-price' };
    }
    const share = mode.percent / 100;
    if (mode.kind === 'cost-from-markup') {
      if (share <= -1) return { reason: 'That markup is not a usable number.', code: 'markup-unusable' };
      return { value: money(price / (1 + share)) };
    }
    if (share >= 1) return { reason: 'A margin of 100% or more would make the cost zero.', code: 'margin-would-zero-cost' };
    return { value: money(price * (1 - share)) };
  }

  const current = Number(currentValue(product, field)) || 0;

  if (mode.kind === 'round') {
    const nearest = mode.nearest;
    if (!Number.isFinite(nearest) || nearest <= 0) return { reason: 'Nothing to round to.', code: 'nothing-to-round-to' };
    if (current <= 0) return { reason: 'Nothing recorded to round.', code: 'nothing-to-round' };
    return { value: round(Math.round(current / nearest) * nearest) };
  }

  if (mode.kind === 'increase-percent' || mode.kind === 'decrease-percent') {
    if (current <= 0) {
      return field === 'costPrice'
        ? {
            reason: 'No cost price on record, so a percentage change has nothing to work from.',
            code: 'no-cost-for-percent',
          }
        : { reason: 'Nothing recorded to adjust by a percentage.', code: 'nothing-to-adjust' };
    }
    const factor = mode.kind === 'increase-percent'
      ? 1 + mode.percent / 100
      : 1 - mode.percent / 100;
    return { value: round(Math.max(0, current * factor)) };
  }

  if (mode.kind === 'increase-amount') return { value: round(current + mode.amount) };
  if (mode.kind === 'decrease-amount') return { value: round(Math.max(0, current - mode.amount)) };

  return { reason: 'Unrecognised operation.', code: 'unrecognised' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Description
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_WORDS: Record<BulkField, string> = {
  price: 'selling price',
  costPrice: 'cost price',
  stock: 'stock',
  lowStockThreshold: 'low-stock alert',
  category: 'category',
};

/**
 * One sentence describing an operation, for the confirm step and the audit log.
 *
 * Written from the operation rather than from the model's own words on purpose.
 * If the sentence the owner approves is generated by the same object that
 * performs the write, the two cannot disagree — whereas a model-authored summary
 * beside a model-authored op can describe a 5% rise and apply 50%.
 */
export function describeBulkOp(op: BulkOp, currency = ''): string {
  const field = FIELD_WORDS[op.field];
  const amount = (value: number) => `${currency}${value.toLocaleString()}`;

  const action = (() => {
    switch (op.mode.kind) {
      case 'set':
        return op.field === 'category'
          ? `Move to category "${op.mode.value}"`
          : `Set ${field} to ${op.field === 'stock' || op.field === 'lowStockThreshold' ? op.mode.value : amount(Number(op.mode.value))}`;
      case 'increase-percent':
        return `Raise ${field} by ${op.mode.percent}%`;
      case 'decrease-percent':
        return `Cut ${field} by ${op.mode.percent}%`;
      case 'increase-amount':
        return `Add ${amount(op.mode.amount)} to ${field}`;
      case 'decrease-amount':
        return `Take ${amount(op.mode.amount)} off ${field}`;
      case 'round':
        return `Round ${field} to the nearest ${amount(op.mode.nearest)}`;
      case 'margin':
        return `Price at a ${op.mode.percent}% margin on cost`;
      case 'markup':
        return `Price at cost plus ${op.mode.percent}%`;
      case 'cost-from-margin':
        return `Estimate cost prices at a ${op.mode.percent}% margin off the selling price`;
      case 'cost-from-markup':
        return `Estimate cost prices assuming a ${op.mode.percent}% markup`;
    }
  })();

  return `${action}${describeFilter(op.filter)}`;
}

function describeFilter(filter: BulkFilter): string {
  const parts: string[] = [];
  if (filter.productIds?.length) parts.push(`${filter.productIds.length} selected products`);
  if (filter.categories?.length) parts.push(`category ${filter.categories.join(', ')}`);
  if (filter.nameContains) parts.push(`names containing "${filter.nameContains}"`);
  if (filter.stockBelow != null) parts.push(`stock under ${filter.stockBelow}`);
  if (filter.stockAbove != null) parts.push(`stock over ${filter.stockAbove}`);
  if (filter.priceBelow != null) parts.push(`price under ${filter.priceBelow}`);
  if (filter.priceAbove != null) parts.push(`price over ${filter.priceAbove}`);
  if (filter.missingCostPrice) parts.push('no cost price recorded');
  if (filter.missingPrice) parts.push('no selling price recorded');

  if (parts.length === 0) return ' for every product';
  return ` for ${parts.join(' and ')}`;
}

/** One translatable fragment: a catalog key plus whatever it interpolates. */
export type BulkClause = { key: string; vars: Record<string, string | number> };

/**
 * The same description as `describeBulkOp`, as catalog keys instead of English.
 *
 * Two clauses rather than one string because the sentence is "do X to Y", and the
 * eleven languages disagree about the order. `interpolate` substitutes `{action}`
 * and `{scope}` wherever the catalog puts them and leaves an unknown placeholder
 * verbatim, so a translation is free to reorder or drop either — which is what makes
 * a two-slot sentence safe here where interpolating a bare *noun* would not be. The
 * field name is never a variable for exactly that reason: `Set {field} to …` needs
 * agreement German and Arabic would get wrong, so each field would get its own key.
 *
 * **Returns `null` for anything it does not yet have keys for**, and the caller falls
 * back to `describeBulkOp`. That is deliberate: only the two cost-derivation modes are
 * rendered on a translated surface today (the cost-price dialog), and inventing 29
 * action keys across eleven catalogs for the modes only `ai-bulk-edit.tsx` can reach
 * would be 300 translations for a screen this pass has not reached. A later batch
 * extends the map; until then the fallback is exactly today's behaviour, so nothing
 * regresses and nothing is half-translated.
 */
export function bulkOpClauses(op: BulkOp): { action: BulkClause; scope: BulkClause } | null {
  let action: BulkClause | null = null;
  if (op.mode.kind === 'cost-from-margin') {
    action = { key: 'inventory.bulkActionCostFromMargin', vars: { percent: op.mode.percent } };
  } else if (op.mode.kind === 'cost-from-markup') {
    action = { key: 'inventory.bulkActionCostFromMarkup', vars: { percent: op.mode.percent } };
  }
  if (!action) return null;

  const f = op.filter;
  const onlyCategories =
    f.categories?.length &&
    !f.productIds?.length &&
    !f.nameContains &&
    f.stockBelow == null &&
    f.stockAbove == null &&
    f.priceBelow == null &&
    f.priceAbove == null &&
    !f.missingCostPrice &&
    !f.missingPrice;

  const empty =
    !f.categories?.length &&
    !f.productIds?.length &&
    !f.nameContains &&
    f.stockBelow == null &&
    f.stockAbove == null &&
    f.priceBelow == null &&
    f.priceAbove == null &&
    !f.missingCostPrice &&
    !f.missingPrice;

  if (empty) return { action, scope: { key: 'inventory.bulkScopeEveryProduct', vars: {} } };
  if (onlyCategories) {
    return {
      action,
      scope: { key: 'inventory.bulkScopeCategories', vars: { categories: f.categories!.join(', ') } },
    };
  }
  return null;
}

/**
 * Extra fields that must ride along with a write, beyond the field being changed.
 *
 * Only one case so far, and it is load-bearing: an operation that *derives* a cost price
 * has to stamp `costPriceEstimated: true`, and one that sets a cost from a real figure
 * has to clear it. If the flag did not travel with the value, a margin sweep would leave
 * behind numbers that look exactly like invoice-sourced costs, and the next person to
 * read a margin report would have no way to tell.
 *
 * Cleared explicitly rather than deleted: a product previously filled by a sweep and now
 * corrected by hand must stop being marked as estimated, and `false` is what a
 * `merge`-style update can express. Firestore stores the `false`, which is fine — it is
 * a boolean field, not a sentinel.
 */
function extraFieldsFor(op: BulkOp): Record<string, any> {
  if (op.field !== 'costPrice') return {};
  const derived = op.mode.kind === 'cost-from-margin' || op.mode.kind === 'cost-from-markup';
  return { costPriceEstimated: derived };
}

/**
 * Group a preview's changes into the smallest set of writes that expresses it.
 *
 * `bulk-update-products` in `pos-context` takes one value object and a list of
 * ids, so products landing on the *same* new value share a single queued action.
 * A percentage change gives every product a different value and collapses to
 * nothing; `set`, `margin` on a uniform cost, and rounding all collapse hard —
 * which is the difference between one queued action and a thousand.
 */
export function groupWrites(preview: BulkPreview): { value: Record<string, any>; productIds: string[] }[] {
  const buckets = new Map<string, { value: Record<string, any>; productIds: string[] }>();
  const extra = extraFieldsFor(preview.op);

  for (const change of preview.changes) {
    const key = `${change.field}:${String(change.after)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.productIds.push(change.productId);
    } else {
      buckets.set(key, {
        value: { [change.field]: change.after, ...extra },
        productIds: [change.productId],
      });
    }
  }

  return [...buckets.values()];
}
