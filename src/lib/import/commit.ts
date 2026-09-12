/**
 * Turning approved rows into the exact writes that will happen.
 *
 * Kept pure and separate from the dialog for the same reason the rest of this
 * folder is: "what will this import actually do to my shop" has to be answerable
 * without running it. The dialog renders this plan; the hook hands it to
 * `addToQueue`; nothing else writes.
 *
 * ## Why `addToQueue` and not a `writeBatch`
 *
 * The old CSV dialog built a `writeBatch` inline, and that quietly skipped four
 * things `addToQueue` is the only place that does: the RBAC check, injecting
 * `activeBranchId`, surviving a lost connection, and updating the SQLite mirror the
 * desktop app sells from. A cashier without `manage_inventory` could import a
 * thousand products through it, and an import done on a flaky connection half
 * committed and reported success.
 *
 * It also means an import works offline, which for this market is not a footnote.
 */

import type { Product } from '@/types';
import { normalizeName } from './normalize';
import type { CommitPlan, DraftProduct, ImportField, StagedRow } from './types';

/** One queued write, in the shape `pos-context`'s queue expects. */
export type CommitWrite =
  | { type: 'add-product'; payload: Record<string, any>; description: string }
  | { type: 'update-product'; payload: { productId: string; values: Record<string, any> }; description: string }
  | { type: 'bulk-update-products'; payload: { productIds: string[]; values: Record<string, any> }; description: string };

export type CommitBundle = {
  writes: CommitWrite[];
  /** Category names not already on the business doc, for the settings update. */
  newCategories: string[];
  created: number;
  updated: number;
  skipped: number;
};

/**
 * Group rows by what the owner decided, for the review screen's counts and the
 * Import button's label.
 *
 * `newCategories` is computed here rather than at commit time so the review screen
 * can say "this will add 3 new categories" — which is the moment somebody notices
 * their file says "Bevrages".
 */
export function buildCommitPlan(rows: StagedRow[], existingCategories: string[]): CommitPlan {
  const known = new Set(existingCategories.map((c) => c.trim().toLowerCase()));
  const fresh = new Map<string, string>();

  const plan: CommitPlan = {
    create: [],
    addStock: [],
    overwrite: [],
    skipped: [],
    newCategories: [],
  };

  for (const row of rows) {
    switch (row.decision.action) {
      case 'create': plan.create.push(row); break;
      case 'add-stock': plan.addStock.push(row); break;
      case 'overwrite': plan.overwrite.push(row); break;
      case 'skip': plan.skipped.push(row); break;
    }

    // Only a row that will actually be written can introduce a category, and only
    // a created product carries one — an `add-stock` row deliberately touches
    // nothing but the quantity.
    if (row.decision.action === 'skip' || row.decision.action === 'add-stock') continue;
    const category = row.draft.category?.trim();
    if (!category) continue;
    const key = category.toLowerCase();
    if (known.has(key) || fresh.has(key)) continue;
    fresh.set(key, category);
  }

  plan.newCategories = [...fresh.values()].sort((a, b) => a.localeCompare(b));
  return plan;
}

/**
 * Fields a draft actually carries a value for.
 *
 * The distinction that makes `overwrite` safe: a file with only names and stock
 * counts must not blank out the prices the shop already has. `undefined` means "the
 * source said nothing", and nothing is written for it. A cell that genuinely said
 * `0` parsed to `0` and *is* written, which is why `parseMoney` distinguishes the
 * two in the first place.
 */
function presentFields(draft: DraftProduct): Partial<Record<ImportField, any>> {
  const out: Partial<Record<ImportField, any>> = {};
  if (draft.sku) out.sku = draft.sku;
  if (draft.category) out.category = draft.category;
  if (typeof draft.price === 'number') out.price = draft.price;
  if (typeof draft.costPrice === 'number') out.costPrice = draft.costPrice;
  if (typeof draft.stock === 'number') out.stock = draft.stock;
  if (typeof draft.lowStockThreshold === 'number') out.lowStockThreshold = draft.lowStockThreshold;
  if (draft.description) out.description = draft.description;
  if (draft.imageUrl) out.imageUrl = draft.imageUrl;
  if (draft.baseUnit) out.baseUnit = draft.baseUnit;
  if (draft.expiryDate) out.expiryDate = draft.expiryDate;
  return out;
}

/**
 * Build every write the plan implies.
 *
 * `newId` is injected rather than called directly so the planner stays pure and
 * testable — the hook passes `crypto.randomUUID`.
 *
 * `branchId` is deliberately **not** set here even though products carry one:
 * `addToQueue` injects the active branch itself, and setting it in two places is how
 * the two disagree.
 */
export function buildWrites(
  plan: CommitPlan,
  products: Product[],
  businessId: string,
  newId: () => string,
): CommitBundle {
  const byId = new Map(products.map((p) => [p.id, p]));
  const writes: CommitWrite[] = [];

  // ── Creates ──
  for (const row of plan.create) {
    const draft = row.draft;
    const fields = presentFields(draft);
    writes.push({
      type: 'add-product',
      payload: {
        id: newId(),
        businessId,
        name: draft.name,
        // `lowercaseName` is what the product search queries against, so a product
        // imported without it is invisible to the search box on every screen.
        lowercaseName: draft.name.toLowerCase(),
        sku: fields.sku ?? '',
        category: fields.category ?? 'Uncategorized',
        price: fields.price ?? 0,
        costPrice: fields.costPrice ?? 0,
        stock: fields.stock ?? 0,
        ...(fields.description ? { description: fields.description } : {}),
        ...(fields.imageUrl ? { imageUrl: fields.imageUrl } : {}),
        ...(fields.baseUnit ? { baseUnit: fields.baseUnit } : {}),
        ...(fields.expiryDate ? { expiryDate: fields.expiryDate } : {}),
        ...(typeof fields.lowStockThreshold === 'number'
          ? { lowStockThreshold: fields.lowStockThreshold }
          : {}),
      },
      description: `Importing ${draft.name}`,
    });
  }

  // ── Add to stock ──
  //
  // One write per product rather than a grouped bulk update: every row adds a
  // different quantity to a different starting figure, so there is no shared value
  // to group on. Grouping is only available where the resulting value is identical,
  // which is what `overwrite` below exploits.
  for (const row of plan.addStock) {
    if (row.decision.action !== 'add-stock') continue;
    const existing = byId.get(row.decision.productId);
    if (!existing) continue;

    const added = row.draft.stock ?? 0;
    // Zero to add means nothing to do. Writing it anyway costs a Firestore write
    // per row for no change, and on a 2,000-row restock file that is 2,000 writes.
    if (added === 0) continue;

    const values: Record<string, any> = { stock: (Number(existing.stock) || 0) + added };

    // An arrival legitimately tells you the new cost — that is what an invoice is
    // for — but it must never touch the selling price, which is the shop's decision
    // and not the supplier's.
    if (typeof row.draft.costPrice === 'number' && row.draft.costPrice > 0) {
      values.costPrice = row.draft.costPrice;
    }
    // Fill a missing SKU, never replace one. Replacing a barcode the shop already
    // scans against breaks the till for that product.
    if (row.draft.sku && !existing.sku) values.sku = row.draft.sku;
    if (row.draft.expiryDate) values.expiryDate = row.draft.expiryDate;

    writes.push({
      type: 'update-product',
      payload: { productId: existing.id, values },
      description: `Adding ${added} to ${existing.name}`,
    });
  }

  // ── Overwrite ──
  for (const row of plan.overwrite) {
    if (row.decision.action !== 'overwrite') continue;
    const existing = byId.get(row.decision.productId);
    if (!existing) continue;

    const fields = presentFields(row.draft);
    const values: Record<string, any> = {};
    for (const [field, value] of Object.entries(fields)) {
      // Only write what actually differs. A price-list import where 90% of prices
      // are unchanged should cost 10% of the writes, and on a plan billed per write
      // that difference is the owner's money.
      const current = (existing as any)[field];
      const same =
        typeof value === 'number' && typeof current === 'number'
          ? Math.abs(current - value) < 0.005
          : String(current ?? '') === String(value ?? '');
      if (!same) values[field] = value;
    }

    // Renaming is off the table for a matched row: the row matched *because* it is
    // this product, and rewriting the name to the file's spelling churns receipts
    // and breaks the barcode label the shop already printed. The exception is a
    // name the shop never had.
    if (!existing.name && row.draft.name) {
      values.name = row.draft.name;
      values.lowercaseName = row.draft.name.toLowerCase();
    }

    if (Object.keys(values).length === 0) continue;

    writes.push({
      type: 'update-product',
      payload: { productId: existing.id, values },
      description: `Updating ${existing.name}`,
    });
  }

  return {
    writes,
    newCategories: plan.newCategories,
    created: plan.create.length,
    updated: writes.filter((w) => w.type !== 'add-product').length,
    skipped: plan.skipped.length,
  };
}

/**
 * Rows that would create a product whose name already exists in the same batch.
 *
 * A last guard before the commit, catching the case where the owner answered two
 * duplicate questions with "create new product" for what is really one product. Not
 * blocking — they may genuinely stock two things with one name — but worth saying
 * out loud on the button, because it is far cheaper to fix now than afterwards.
 */
export function selfDuplicates(plan: CommitPlan): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const row of plan.create) {
    const key = normalizeName(row.draft.name);
    if (!key) continue;
    const held = counts.get(key);
    if (held) held.count++;
    else counts.set(key, { name: row.draft.name, count: 1 });
  }
  return [...counts.values()].filter((entry) => entry.count > 1);
}
