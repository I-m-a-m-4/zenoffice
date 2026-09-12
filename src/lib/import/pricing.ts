/**
 * What importing costs, and what it does not.
 *
 * The rule, stated once so every surface can repeat it honestly:
 *
 * > **Structured data is free. Understanding mess costs credits.**
 *
 * A CSV or Excel file whose columns Zeneva recognises is parsed on the device by
 * `spreadsheet.ts`, mapped by the alias table and value inference in
 * `column-map.ts`, and matched against the catalogue by `match.ts`. No model is
 * called, nothing leaves the browser, and the owner is charged nothing — no
 * matter how many rows. A hundred-thousand-row import is free.
 *
 * A photograph of a shelf, a photograph of a supplier invoice, a sentence typed in
 * English, or a file whose columns nothing recognises: those need a model, the
 * model costs money, and that is what a credit buys.
 *
 * ## Why this file exists separately from the server
 *
 * `src/lib/server/ai-credits.ts` is the authority on balances and is Admin-SDK
 * only. This module holds the *estimate*, and it is client-safe on purpose: the
 * importer has to be able to tell the owner "this will cost about 3 credits, you
 * have 180" **before** they press the button. An AI feature that spends a paid
 * balance without quoting first is one people learn to distrust and stop using.
 *
 * The estimates are ceilings, not measurements. The server settles on the tokens
 * Gemini actually reported, exactly as the chat route does, so the real charge is
 * usually lower than the quote. Quoting high and charging low is the only safe
 * direction for that error.
 */

import type { ImportSource } from './types';

/** The AI operations the importer can run. One entry per API action. */
export type ImportAiAction =
  /** Read a file's column headers and say which Zeneva field each one is. */
  | 'map-columns'
  /** Turn typed or pasted prose into rows. */
  | 'parse-text'
  /** Read products off a photograph of shelves or stock. */
  | 'parse-photo'
  /** Read line items off a photograph of a supplier invoice. */
  | 'parse-invoice'
  /** Decide which existing product an ambiguous row refers to. */
  | 'match'
  /** Turn "raise all my drink costs 8%" into a checked bulk operation. */
  | 'bulk-op'
  /**
   * The customer-book equivalents of the three above.
   *
   * Separate actions rather than a `kind` on the product ones, for two reasons
   * that are not stylistic. The route gates on permission per action, and
   * importing customers needs `view_customers` where importing stock needs
   * `manage_inventory` — folding them together would let a cashier who cannot
   * touch inventory be refused a customer import, or worse, the reverse. And the
   * admin usage board buckets spend by action name, so a shop asking "what is the
   * AI costing me" can see reading ledgers apart from reading shelves.
   */
  | 'map-customer-columns'
  | 'parse-customer-text'
  | 'parse-customer-photo';

/**
 * Minimum charge per operation, in credits.
 *
 * These are **floors on a metered charge**, not prices. The server measures real
 * tokens and charges the greater of the two, so a heavy call costs more than its
 * floor and a trivial one still costs the floor.
 *
 * The floors are a product decision and worth being straight about, because
 * measured cost alone would not justify them. A shelf photograph is only about
 * 1,500 image tokens — well under one credit at `TOKENS_PER_CREDIT` — yet:
 *
 *  - it is the highest-value operation in the product, replacing an hour of typing;
 *  - it has by far the highest retry rate, because people reshoot a blurry photo,
 *    and a retry loop that is individually free is a cost with no brake on it;
 *  - it is the one operation that can be pointed at an arbitrarily large image.
 *
 * `map-columns` and `bulk-op` sit at 1 because they are genuinely cheap and are
 * the two most likely to be a first experience of paying for anything here. A
 * first AI action that costs five credits teaches the owner to avoid the feature.
 *
 * Revisit these against the Cost ceiling column on `/admin-imamshaffy/ai-usage`,
 * not against this comment — the same instruction `TOKENS_PER_CREDIT` carries.
 */
export const IMPORT_CREDIT_FLOORS: Record<ImportAiAction, number> = {
  'map-columns': 1,
  'parse-text': 1,
  'parse-photo': 3,
  'parse-invoice': 3,
  match: 1,
  'bulk-op': 1,
  /*
   * The customer actions mirror their product counterparts. A photograph of a
   * ledger page or a page of a visitors' book is the same kind of operation as a
   * shelf photo — highest value, highest retry rate, arbitrarily large input — so
   * it carries the same floor rather than a cheaper one.
   */
  'map-customer-columns': 1,
  'parse-customer-text': 1,
  'parse-customer-photo': 3,
};

/**
 * Roughly what an operation will cost, for the quote shown before it runs.
 *
 * `size` is whatever the operation scales on — rows for a paste, ambiguous pairs
 * for a match, image bytes for a photo. Deliberately coarse: this number's job is
 * to stop somebody being surprised, not to be an invoice.
 */
export function estimateCredits(action: ImportAiAction, size = 0): number {
  const floor = IMPORT_CREDIT_FLOORS[action];

  switch (action) {
    case 'map-columns':
    case 'map-customer-columns':
      // Headers plus a handful of sample rows. Bounded by construction — the
      // route sends `SAMPLE_ROWS` rows and no more, whatever the file's size.
      return floor;

    case 'parse-text':
    case 'parse-customer-text':
      // Output dominates, and output is weighted 8×. About 40 tokens of JSON per
      // row against a 20,000-token credit puts the crossover near 60 rows.
      return Math.max(floor, Math.ceil(size / 60));

    case 'parse-photo':
    case 'parse-invoice':
    case 'parse-customer-photo':
      // One image, plus its line items back out. An invoice with 40 lines is the
      // large end of realistic; a page of a customer ledger is comparable.
      return Math.max(floor, Math.ceil(size / 50));

    case 'match':
      // A name and up to three candidate names in, one id out. Cheap per pair.
      return Math.max(floor, Math.ceil(size / 80));

    case 'bulk-op':
      // One sentence in, one small object out, regardless of how many products
      // it ends up touching — that is the whole point of a declarative op.
      return floor;
  }
}

/**
 * Whether a source needs a model at all, before anything has been read.
 *
 * Drives the little "Free" and "Uses AI" markers on the source tiles, so the
 * owner knows which door costs money before they open it rather than after.
 * `spreadsheet` and `paste` are listed free because they *usually* are — a file
 * with unrecognisable headers can still offer a paid mapping step, and the offer
 * is made at that point with its own quote.
 */
export function sourceUsesAi(source: ImportSource): boolean {
  switch (source) {
    case 'photo':
    case 'invoice':
    case 'text':
      return true;
    case 'spreadsheet':
    case 'paste':
    case 'barcode':
    case 'desktop':
      return false;
  }
}

/** One short sentence for the quote line. `null` when nothing will be charged. */
export function describeCharge(action: ImportAiAction, size: number, remaining: number | null): string {
  const credits = estimateCredits(action, size);
  const plural = credits === 1 ? 'credit' : 'credits';
  if (remaining == null) return `About ${credits} ${plural}.`;
  return `About ${credits} ${plural} — you have ${remaining.toLocaleString()} left.`;
}
