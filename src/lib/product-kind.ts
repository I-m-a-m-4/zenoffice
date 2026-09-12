/**
 * Is this row a service rather than a stocked product?
 *
 * Services live in the `products` collection and carry `stock: 0` because the
 * field is shared, not because they have run out. Anything that reasons about
 * stock — health tiles, dead-stock, depletion warnings, restock advice — has to
 * skip them, or it tells an owner to reorder a haircut and buries the items that
 * genuinely did run out.
 *
 * ## Why this module exists
 *
 * The same predicate was written out four times, each copy with a comment saying
 * it mirrored the others, and they had drifted:
 *
 * | Site | Checked |
 * |---|---|
 * | `src/lib/forensics.ts` | `categoryType`, `category` string |
 * | `src/app/api/chat/tools.ts` | `categoryType`, `category` string |
 * | `src/app/(app)/inventory/page.tsx` | `categoryType`, `category` string |
 * | `top-products-chart` / `top-services-chart` | **`categoryType` only** |
 * | `proposal-guard.ts`, `tools.ts:2225` | `categoryType`, legacy `type` |
 *
 * The reports charts having the narrowest check is why a shop that categorises
 * services the legacy way (`category: 'services'`, no `categoryType`) had its
 * services counted as products in "Top Selling Products" and got an empty
 * services chart. Same data, two different answers on one page.
 *
 * `isService` here is the **union** of every variant above, so adopting it can
 * only ever widen detection, never narrow it.
 *
 * Note on `type === 'service'`: `Product.type` is declared
 * `'single' | 'variant' | 'composite'`, so that comparison cannot be true for a
 * well-formed row. It is kept because two call sites check it, which means rows
 * in the wild carry it — dropping it would silently reclassify them.
 *
 * **`src/lib/forensics.ts` deliberately still uses its own copy.** Widening
 * service detection changes which rows its detectors examine, and that file names
 * a member of staff as a suspected thief — see `docs/loss-prevention.md`, which
 * requires a review for any change to a detector's inputs. Migrating it is a
 * separate, deliberate change.
 */

type ProductLike = {
  categoryType?: string | null;
  category?: string | null;
  type?: string | null;
} | null | undefined;

export function isService(p: ProductLike): boolean {
  if (!p) return false;
  if (p.categoryType === 'service') return true;
  if (p.type === 'service') return true; // legacy rows; see the note above
  const category = String(p.category ?? '').toLowerCase().trim();
  return category === 'service' || category === 'services';
}

/** The complement, for filters that read better in the positive. */
export function isStockedProduct(p: ProductLike): boolean {
  return !!p && !isService(p);
}
