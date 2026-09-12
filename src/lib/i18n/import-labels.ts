/**
 * Catalog keys for the importer's machine-readable codes.
 *
 * `src/lib/import/*` is pure and stays English on purpose — `BulkSkip.reason` lands in
 * the audit log and in queued-action descriptions, and `MatchCandidate.explanation` is
 * *tested* by `matchDraft` (`top.explanation.includes('same size')`) when deciding
 * whether a similar-name hit is certain enough to merge without asking. Translating
 * either in place would change which imports ask the owner and which ones merge
 * silently, which corrupts stock figures.
 *
 * So the prose stays and a code rides alongside it. This module is the one place those
 * codes become catalog keys, rather than a `switch` copied into each of the four screens
 * that renders them (the cost-price dialog, the bulk-edit dialog, and both smart-import
 * review steps). Copies drift, and a drifted copy shows a raw `similar-name-same-size`
 * to a shopkeeper.
 *
 * Both maps are `Record<Code, string>` rather than functions with a `default`, so adding
 * a member to `BulkSkipCode` or `MatchExplanationCode` is a **compile error here** until
 * it has a key. A `default` branch would silently render the fallback forever.
 */

import type { BulkSkipCode } from '@/lib/import/bulk-ops';
import type { MatchExplanationCode } from '@/lib/import/types';

const BULK_SKIP_KEYS: Record<BulkSkipCode, string> = {
  'category-set-only': 'inventory.bulkSkipCategorySetOnly',
  'no-category-name': 'inventory.bulkSkipNoCategoryName',
  'not-a-number': 'inventory.bulkSkipNotANumber',
  'margin-price-only': 'inventory.bulkSkipMarginPriceOnly',
  'no-cost-price': 'inventory.bulkSkipNoCostPrice',
  'margin-impossible': 'inventory.bulkSkipMarginImpossible',
  'cost-fill-only': 'inventory.bulkSkipCostFillOnly',
  'already-has-real-cost': 'inventory.bulkSkipAlreadyHasRealCost',
  'no-selling-price': 'inventory.bulkSkipNoSellingPrice',
  'markup-unusable': 'inventory.bulkSkipMarkupUnusable',
  'margin-would-zero-cost': 'inventory.bulkSkipMarginWouldZeroCost',
  'nothing-to-round-to': 'inventory.bulkSkipNothingToRoundTo',
  'nothing-to-round': 'inventory.bulkSkipNothingToRound',
  'no-cost-for-percent': 'inventory.bulkSkipNoCostForPercent',
  'nothing-to-adjust': 'inventory.bulkSkipNothingToAdjust',
  unrecognised: 'inventory.bulkSkipUnrecognised',
};

const MATCH_EXPLANATION_KEYS: Record<MatchExplanationCode, string> = {
  'same-code': 'inventory.matchSameCode',
  'same-name': 'inventory.matchSameName',
  'similar-name': 'inventory.matchSimilarName',
  'similar-name-same-size': 'inventory.matchSimilarNameSameSize',
  'similar-name-different-size': 'inventory.matchSimilarNameDifferentSize',
};

/** Why a product was left out of a bulk change, as a catalog key. */
export function bulkSkipKey(code: BulkSkipCode): string {
  return BULK_SKIP_KEYS[code];
}

/** Why the importer thinks a row is an existing product, as a catalog key. */
export function matchExplanationKey(code: MatchExplanationCode): string {
  return MATCH_EXPLANATION_KEYS[code];
}
