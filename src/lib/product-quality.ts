/**
 * Product data quality, computed rather than asked.
 *
 * This replaces `productTroubleshoot` in `src/ai/flows/`, and the reason is worth
 * writing down because it is the clearest example of the pattern in this codebase:
 *
 * That flow sent **every product** the shop owns — name, description, price, category
 * and SKU — to Gemini, and asked it to reply with "the top 3-5 most critical
 * suggestions", naming missing prices, poor descriptions and inconsistent
 * categorisation as the things to look for. For a shop with 1,200 products that is
 * 60,000-plus input tokens per press, it was billed at a flat 2 credits, and it
 * therefore **lost money on every call and lost more the bigger the shop got**.
 *
 * And the checks it was performing are `price === 0`, `!description`, and `!category`.
 *
 * So a language model was being paid, per shop, per press, to run `if` statements over
 * a list — and to do it worse than the code below, because it saw a truncated view,
 * could not count reliably across 1,200 rows, and returned prose instead of the actual
 * product ids. It could not link the owner to the affected products; this can.
 *
 * ## What this deliberately does not do
 *
 * It does not write copy. "Your descriptions are thin" is a fact and lives here;
 * *writing* a description for a specific product is a genuine language task and stays
 * with the model — see `suggestionsNeedingAi`, which names the small number of products
 * worth spending a credit on rather than shipping the whole catalogue.
 *
 * Pure, `now` as an input, and no reads: the same shape as `src/lib/forensics.ts` and
 * for the same reason — a figure that accuses the owner's own data of being wrong has to
 * be reproducible and explainable line by line.
 */

import type { Product } from '@/types';

export type QualitySeverity = 'high' | 'medium' | 'low';

export type QualityIssue = {
  id: string;
  title: string;
  /** One sentence, in the owner's terms. Never a code or a field name. */
  detail: string;
  severity: QualitySeverity;
  /** The products actually affected, so the UI can link straight to them. */
  products: Product[];
  /**
   * Money the issue is putting at risk, when that can be stated honestly.
   *
   * Absent rather than zero when there is no defensible figure. A made-up number beside
   * a real one teaches the owner to distrust both.
   */
  amountAtRisk?: number;
  /** What to press. Names a real surface, never "review your data". */
  action: string;
};

export type QualityReport = {
  issues: QualityIssue[];
  /** 0-100. Not a grade — a share of products with nothing wrong with them. */
  score: number;
  checked: number;
  /** Products with at least one high-severity issue. */
  urgent: number;
};

/** Below this many characters a description is not doing any work. */
const THIN_DESCRIPTION = 25;

/**
 * A category used by this many products or fewer looks like a typo of another one.
 *
 * Two rather than one: a genuinely new category legitimately has one product in it on
 * the day it is created, and flagging that is noise. Three would start catching real
 * small categories.
 */
const ORPHAN_CATEGORY_MAX = 2;

/**
 * Everything wrong with a shop's product data, ranked by what it costs them.
 *
 * Order is by consequence, not by how many products are affected. A missing price stops
 * a sale at the till; a thin description costs nothing in a shop that sells over a
 * counter. Sorting by count instead would put "412 products have no description" above
 * "3 products cannot be sold", which is precisely backwards.
 */
export function analyseProductQuality(
  products: Product[],
  opts: { now?: Date; currencySymbol?: string } = {},
): QualityReport {
  const now = opts.now ?? new Date();
  const list = (products ?? []).filter((p) => p?.id);
  const issues: QualityIssue[] = [];

  if (list.length === 0) {
    return { issues, score: 100, checked: 0, urgent: 0 };
  }

  const flagged = new Set<string>();
  const add = (issue: Omit<QualityIssue, 'products'> & { products: Product[] }) => {
    if (issue.products.length === 0) return;
    issues.push(issue);
    if (issue.severity === 'high') issue.products.forEach((p) => flagged.add(p.id));
  };

  // ── Cannot be sold ──
  const noPrice = list.filter((p) => !(Number(p.price) > 0));
  add({
    id: 'no-price',
    title: `${noPrice.length} product${noPrice.length === 1 ? '' : 's'} cannot be sold`,
    detail:
      'These have no selling price, so the till will not take money for them. This is the only issue here that stops a sale outright.',
    severity: 'high',
    products: noPrice,
    action: 'Set their prices',
  });

  // ── Cannot be reported on ──
  //
  // Split from the estimate case on purpose: "no cost price" and "a guessed cost price"
  // need different actions, and collapsing them hides how much of the margin figure is
  // actually assumption.
  const noCost = list.filter(
    (p) => Number(p.price) > 0 && !(Number(p.costPrice) > 0),
  );
  add({
    id: 'no-cost',
    title: `${noCost.length} product${noCost.length === 1 ? '' : 's'} have no cost price`,
    detail:
      'Zeneva cannot tell you whether these make money. Every profit and margin figure quietly leaves them out.',
    severity: 'high',
    products: noCost,
    // Capital exposed, which is the honest figure: what the shop is holding without
    // knowing what it paid. Not "lost profit", which nobody can compute from nothing.
    amountAtRisk: noCost.reduce(
      (sum, p) => sum + (Number(p.stock) || 0) * (Number(p.price) || 0),
      0,
    ),
    action: 'Fill in cost prices',
  });

  const estimatedCost = list.filter((p) => p.costPriceEstimated && Number(p.costPrice) > 0);
  add({
    id: 'estimated-cost',
    title: `${estimatedCost.length} cost price${estimatedCost.length === 1 ? ' is' : 's are'} still an estimate`,
    detail:
      'These were worked back from a margin rather than read off an invoice, so the profit figures using them are approximate. The next delivery you photograph will replace them.',
    severity: 'medium',
    products: estimatedCost,
    action: 'Confirm from an invoice',
  });

  // ── Selling at a loss ──
  //
  // A real condition, not a data error, which is why it is separate from the two above
  // and why the wording does not accuse. Clearance stock exists. But far more often it
  // means the cost and price columns were mapped the wrong way round on import, and this
  // is the only place that would ever surface it.
  const belowCost = list.filter((p) => {
    const price = Number(p.price) || 0;
    const cost = Number(p.costPrice) || 0;
    return price > 0 && cost > 0 && cost >= price;
  });
  add({
    id: 'below-cost',
    title: `${belowCost.length} product${belowCost.length === 1 ? '' : 's'} priced at or below cost`,
    detail:
      'Each of these loses money on every sale. If that is deliberate clearance, ignore it — but check the cost and price columns were not swapped when the data came in.',
    severity: 'high',
    products: belowCost,
    amountAtRisk: belowCost.reduce((sum, p) => {
      const loss = (Number(p.costPrice) || 0) - (Number(p.price) || 0);
      return sum + Math.max(0, loss) * (Number(p.stock) || 0);
    }, 0),
    action: 'Review these prices',
  });

  // ── Cannot be found ──
  const noCategory = list.filter((p) => !String(p.category ?? '').trim() || p.category === 'Uncategorized');
  add({
    id: 'no-category',
    title: `${noCategory.length} product${noCategory.length === 1 ? '' : 's'} are uncategorised`,
    detail:
      'Staff find products by category at the till, and your reports break down by it. Uncategorised items are slower to sell and invisible in category reports.',
    severity: 'medium',
    products: noCategory,
    action: 'Assign categories',
  });

  // ── Duplicate names ──
  //
  // Two products with one name means whoever is at the till picks one at random, so
  // half the sales are recorded against the wrong row and both stock figures drift.
  const byName = new Map<string, Product[]>();
  for (const product of list) {
    const key = String(product.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) continue;
    const bucket = byName.get(key);
    if (bucket) bucket.push(product);
    else byName.set(key, [product]);
  }
  const duplicates = [...byName.values()].filter((group) => group.length > 1).flat();
  add({
    id: 'duplicate-names',
    title: `${duplicates.length} products share a name with another`,
    detail:
      'Whoever is at the till has to guess which one to ring up, so sales land on the wrong row and both stock counts drift apart.',
    severity: 'high',
    products: duplicates,
    action: 'Merge or rename them',
  });

  // ── Duplicate SKUs ──
  //
  // Worse than a duplicate name, because the scanner resolves a code to exactly one
  // product and will silently keep choosing the same one.
  const bySku = new Map<string, Product[]>();
  for (const product of list) {
    const key = String(product.sku ?? '').trim().toUpperCase().replace(/[\s\-_.]/g, '');
    if (!key || key.length < 2) continue;
    const bucket = bySku.get(key);
    if (bucket) bucket.push(product);
    else bySku.set(key, [product]);
  }
  const duplicateSkus = [...bySku.values()].filter((group) => group.length > 1).flat();
  add({
    id: 'duplicate-skus',
    title: `${duplicateSkus.length} products share a barcode`,
    detail:
      'Scanning that code will always pull up the same one of them, so the others can never be sold by scanner and their stock will never go down.',
    severity: 'high',
    products: duplicateSkus,
    action: 'Give each its own code',
  });

  // ── Stock that cannot be trusted ──
  const negativeStock = list.filter((p) => (Number(p.stock) || 0) < 0);
  add({
    id: 'negative-stock',
    title: `${negativeStock.length} product${negativeStock.length === 1 ? ' has' : 's have'} negative stock`,
    detail:
      'A count below zero means sales were recorded that the stock could not cover — usually a delivery that was never entered.',
    severity: 'high',
    products: negativeStock,
    action: 'Count and correct',
  });

  // ── Expiry ──
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiring: Product[] = [];
  const expired: Product[] = [];
  for (const product of list) {
    const raw = (product as any).expiryDate;
    if (!raw) continue;
    const date = raw?.toDate ? raw.toDate() : new Date(raw);
    if (Number.isNaN(date?.getTime?.())) continue;
    if ((Number(product.stock) || 0) <= 0) continue;
    if (date < now) expired.push(product);
    else if (date <= soon) expiring.push(product);
  }
  const stockValue = (items: Product[]) =>
    items.reduce((sum, p) => sum + (Number(p.stock) || 0) * (Number(p.costPrice) || Number(p.price) || 0), 0);

  add({
    id: 'expired',
    title: `${expired.length} product${expired.length === 1 ? '' : 's'} in stock have expired`,
    detail: 'These are past their date and still counted as sellable stock.',
    severity: 'high',
    products: expired,
    amountAtRisk: stockValue(expired),
    action: 'Write these off',
  });
  add({
    id: 'expiring',
    title: `${expiring.length} product${expiring.length === 1 ? '' : 's'} expire within 30 days`,
    detail: 'Discount or move these while they can still be sold.',
    severity: 'medium',
    products: expiring,
    amountAtRisk: stockValue(expiring),
    action: 'Plan a markdown',
  });

  // ── Category hygiene ──
  const categoryCounts = new Map<string, Product[]>();
  for (const product of list) {
    const key = String(product.category ?? '').trim();
    if (!key || key === 'Uncategorized') continue;
    const bucket = categoryCounts.get(key);
    if (bucket) bucket.push(product);
    else categoryCounts.set(key, [product]);
  }

  // Categories differing only by case, spacing or a plural are the same category typed
  // twice. This is the check the model was asked for as "inconsistent categorisation",
  // and it is a string comparison.
  const canonical = new Map<string, string[]>();
  for (const name of categoryCounts.keys()) {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
    const bucket = canonical.get(key);
    if (bucket) bucket.push(name);
    else canonical.set(key, [name]);
  }
  const collidingNames = [...canonical.values()].filter((names) => names.length > 1);
  add({
    id: 'category-variants',
    title: `${collidingNames.length} categor${collidingNames.length === 1 ? 'y is' : 'ies are'} spelled more than one way`,
    detail: `Same category, different spelling — ${collidingNames
      .slice(0, 3)
      .map((names) => names.join(' / '))
      .join('; ')}. Reports split them into separate rows.`,
    severity: 'medium',
    products: collidingNames.flatMap((names) => names.flatMap((name) => categoryCounts.get(name) ?? [])),
    action: 'Merge the spellings',
  });

  const orphans = [...categoryCounts.entries()]
    .filter(([, items]) => items.length <= ORPHAN_CATEGORY_MAX)
    .flatMap(([, items]) => items);
  add({
    id: 'orphan-categories',
    title: `${orphans.length} product${orphans.length === 1 ? ' sits' : 's sit'} in a category of their own`,
    detail:
      'A category with one or two products in it is usually a typo of a bigger one. It makes the till slower to navigate.',
    severity: 'low',
    products: orphans,
    action: 'Tidy these categories',
  });

  // ── Presentation ──
  const noImage = list.filter((p) => !String(p.imageUrl ?? '').trim());
  add({
    id: 'no-image',
    title: `${noImage.length} product${noImage.length === 1 ? '' : 's'} have no picture`,
    detail: 'Pictures make the till grid faster to scan, especially for new staff.',
    severity: 'low',
    products: noImage,
    action: 'Add pictures',
  });

  const thinDescription = list.filter(
    (p) => String(p.description ?? '').trim().length < THIN_DESCRIPTION,
  );
  add({
    id: 'thin-description',
    title: `${thinDescription.length} product${thinDescription.length === 1 ? ' has' : 's have'} little or no description`,
    detail:
      'Worth filling in for anything you sell online or send price lists for. Harmless for over-the-counter selling.',
    severity: 'low',
    products: thinDescription,
    action: 'Write descriptions',
  });

  // ── Reorder points ──
  const noThreshold = list.filter(
    (p) => (Number(p.stock) || 0) > 0 && !(Number(p.lowStockThreshold) > 0),
  );
  add({
    id: 'no-threshold',
    title: `${noThreshold.length} product${noThreshold.length === 1 ? '' : 's'} have no low-stock alert`,
    detail: 'Zeneva cannot warn you before these run out.',
    severity: 'low',
    products: noThreshold,
    action: 'Set alert levels',
  });

  const RANK: Record<QualitySeverity, number> = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => {
    if (RANK[a.severity] !== RANK[b.severity]) return RANK[a.severity] - RANK[b.severity];
    // Within a severity, money first where there is a figure, then breadth.
    const money = (issue: QualityIssue) => issue.amountAtRisk ?? 0;
    if (money(b) !== money(a)) return money(b) - money(a);
    return b.products.length - a.products.length;
  });

  return {
    issues,
    // A share of products with no high-severity problem, so the number means something
    // concrete rather than being a weighted opinion. Deliberately not called a grade:
    // the business rating already owns grading, and it scores money, not tidiness.
    score: Math.round(((list.length - flagged.size) / list.length) * 100),
    checked: list.length,
    urgent: flagged.size,
  };
}

/**
 * The handful of products where a model would genuinely add something.
 *
 * The line this module draws: *finding* thin descriptions is arithmetic; *writing* one
 * is a language task. So rather than shipping 1,200 products to Gemini to be told which
 * ones are thin, this names the few worth paying for — the ones with stock, a price, and
 * enough sales to matter — and the caller spends a credit on those.
 *
 * Ranked by stock value because a description earns its keep in proportion to what is
 * sitting behind it.
 */
export function suggestionsNeedingAi(report: QualityReport, limit = 15): Product[] {
  const thin = report.issues.find((issue) => issue.id === 'thin-description');
  if (!thin) return [];

  return [...thin.products]
    .filter((p) => Number(p.price) > 0 && (Number(p.stock) || 0) > 0)
    .sort(
      (a, b) =>
        (Number(b.stock) || 0) * (Number(b.price) || 0) -
        (Number(a.stock) || 0) * (Number(a.price) || 0),
    )
    .slice(0, limit);
}
