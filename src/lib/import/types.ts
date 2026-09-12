/**
 * The vocabulary the whole importer shares.
 *
 * Six very different sources — a spreadsheet, a photo of a shelf, a photo of a
 * supplier invoice, a paste out of WhatsApp, a scanned barcode, a sentence typed
 * by the owner — all converge on `DraftProduct[]` before anything else looks at
 * them. Everything downstream (the mapping review, duplicate matching, the
 * commit) is written once against that one shape, which is the only reason six
 * sources do not mean six importers.
 *
 * Nothing in this folder touches Firestore, React or the network. That is what
 * makes the hard parts — money parsing, duplicate detection, bulk arithmetic —
 * testable, and it is the same reasoning that keeps `src/lib/forensics.ts` and
 * `src/lib/business-rating.ts` pure.
 */

import type { Product } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Fields
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The Zeneva product fields an import is allowed to fill.
 *
 * Deliberately a closed list, and deliberately much smaller than `Product`. The
 * AI column mapper is handed these names and nothing else, so a model that
 * hallucinates `supplierEmail` produces an unmapped column the owner can see
 * rather than a write to a field no screen reads. `type`, `parentId`,
 * `components` and the UoM table are all absent for the same reason: they encode
 * relationships between products, and a flat row cannot express one.
 */
export const IMPORT_FIELDS = [
  'name',
  'sku',
  'category',
  'price',
  'costPrice',
  'stock',
  'description',
  'imageUrl',
  'baseUnit',
  'lowStockThreshold',
  'expiryDate',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Human labels — what "Zeneva" reads as in the mapping review table. */
export const FIELD_LABELS: Record<ImportField, string> = {
  name: 'Product name',
  sku: 'SKU / barcode',
  category: 'Category',
  price: 'Selling price',
  costPrice: 'Cost price',
  stock: 'Stock',
  description: 'Description',
  imageUrl: 'Image URL',
  baseUnit: 'Unit',
  lowStockThreshold: 'Low stock alert',
  expiryDate: 'Expiry date',
};

/**
 * Fields a row must have to be worth importing at all.
 *
 * Only `name`. Price is *not* required, which is a change from the old CSV
 * dialog — it refused any file without a price column, and a stocktake export
 * legitimately has none. A product with no price imports at 0 and shows up in
 * the Inventory page's own data-quality warnings, which is the right place to
 * chase it; refusing the whole file is not.
 */
export const REQUIRED_FIELDS: ImportField[] = ['name'];

/** Fields that hold money, so one place decides what gets money-parsed. */
export const MONEY_FIELDS: ImportField[] = ['price', 'costPrice'];

/** Fields that hold a count. */
export const NUMERIC_FIELDS: ImportField[] = ['stock', 'lowStockThreshold'];

// ─────────────────────────────────────────────────────────────────────────────
// Sources
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where a batch of rows came from.
 *
 * Carried all the way to the review screen because it changes what the owner
 * should check. Rows read out of a spreadsheet are wrong when the *mapping* is
 * wrong; rows read off a photograph are wrong one row at a time. The review step
 * pre-expands the risky ones for that reason, and the source is also what prices
 * the call — see `src/lib/import/pricing.ts`.
 */
export type ImportSource =
  | 'spreadsheet'
  | 'paste'
  | 'photo'
  | 'invoice'
  | 'barcode'
  | 'text'
  | 'desktop';

export const SOURCE_LABELS: Record<ImportSource, string> = {
  spreadsheet: 'Excel / CSV',
  paste: 'Pasted data',
  photo: 'Photo',
  invoice: 'Supplier invoice',
  barcode: 'Barcode',
  text: 'Text',
  desktop: 'Another program',
};

// ─────────────────────────────────────────────────────────────────────────────
// Raw tabular input
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A rectangle of strings, before anyone has decided what the columns mean.
 *
 * `headers` may be empty — a paste out of WhatsApp often has no header row at
 * all, and a spreadsheet whose first row is already data must not lose that row
 * to a header it never had. `hasHeaderRow: false` is how that case is carried,
 * and the column mapper then infers meaning from the *values* instead.
 */
export type RawTable = {
  headers: string[];
  rows: string[][];
  hasHeaderRow: boolean;
  /** Sheet name, filename, or "page 3" — shown to the owner, never parsed. */
  label?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Column mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How a column's meaning was decided.
 *
 * Shown in the mapping review so a low-confidence guess is visibly a guess.
 * `exact` and `alias` are lookups in a table and cannot be wrong about what they
 * matched; `fuzzy` and `value` are inferences; `ai` cost the owner a credit;
 * `manual` is the owner overriding all of the above and is never second-guessed.
 */
export type MappingVia = 'exact' | 'alias' | 'fuzzy' | 'value' | 'ai' | 'manual';

export type ColumnMapping = {
  /** Index into `RawTable.headers` / each row. */
  index: number;
  /** The header text as the owner wrote it. `"Column 3"` when there was none. */
  source: string;
  /** `null` means "ignore this column" — a real, valid answer. */
  field: ImportField | null;
  /** 0–1. Below `AI_MAPPING_THRESHOLD` is what makes an AI call worth paying for. */
  confidence: number;
  via: MappingVia;
};

/**
 * Confidence below which a mapping is not worth trusting silently.
 *
 * Set at 0.7 so an exact alias hit (1.0) and a good fuzzy hit (0.8+) stand on
 * their own, and only a genuine unknown reaches the model. This threshold is the
 * whole free-versus-paid boundary: a WooCommerce or Shopify export maps at 1.0
 * on every column and costs nothing, which is the common case and is supposed to
 * be free.
 */
export const AI_MAPPING_THRESHOLD = 0.7;

/** Result of mapping a table's columns, plus what it could not work out. */
export type MappingResult = {
  columns: ColumnMapping[];
  /** Headers left unmapped or mapped below the threshold. */
  uncertain: ColumnMapping[];
  /** True when `uncertain` is non-empty *and* a required field is missing. */
  needsAi: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Drafts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single staged product, before it is a `Product`.
 *
 * Every value is already coerced — `price` is a number, not `"₦12,000"` — so the
 * review table renders and the commit writes without either of them re-parsing.
 * The two extra members are what make a bad import recoverable:
 *
 * - `raw` keeps the original cells, so "why does this say 1200 when my file says
 *   1.200" is answerable without the file.
 * - `issues` are per-row complaints. A row with issues still imports; the owner
 *   is told what was odd about it. Refusing rows is how an importer ends up
 *   silently dropping a tenth of somebody's catalogue.
 */
export type DraftProduct = {
  /** Stable across re-renders and re-matches. Not the eventual Firestore id. */
  key: string;
  name: string;
  sku?: string;
  category?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  description?: string;
  imageUrl?: string;
  baseUnit?: string;
  lowStockThreshold?: number;
  expiryDate?: string;
  /** Original cell text, keyed by the field it landed in. */
  raw: Partial<Record<ImportField, string>>;
  issues: DraftIssue[];
  source: ImportSource;
};

export type DraftIssue = {
  field?: ImportField;
  /** Plain sentence shown next to the row. Never a code. */
  message: string;
  severity: 'warn' | 'error';
};

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate matching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why a draft was tied to an existing product.
 *
 * Ordered by how much the code actually knows. `sku` is the only one that is a
 * fact: two products with the same barcode are the same product, and the owner
 * is never asked about it. `name-exact` is a fact about the *strings* after
 * normalisation. `name-similar` and `ai` are opinions, and the UI must present
 * them as a question with both answers one click away — which is why the reason
 * travels with the match rather than being reconstructed in the view.
 */
export type MatchReason = 'sku' | 'name-exact' | 'name-similar' | 'ai';

/**
 * Why a candidate matched, as a code rather than a phrase.
 *
 * `explanation` below stays English and stays exactly as worded, because it is not
 * only copy: `matchDraft` tests `top.explanation.includes('same size')` when deciding
 * whether a similar-name hit is certain enough to skip the question. Translating the
 * phrase in place would change which imports ask the owner and which ones merge
 * silently — a wording change that corrupts stock figures. It also travels into Zen
 * AI's tool payloads, which are English by design.
 *
 * So the phrase is the machine's, and the code is what a screen translates.
 */
export type MatchExplanationCode =
  | 'same-code'
  | 'same-name'
  | 'similar-name'
  | 'similar-name-same-size'
  | 'similar-name-different-size';

export type MatchCandidate = {
  productId: string;
  /** Denormalised so the review row renders without another products lookup. */
  productName: string;
  productSku?: string;
  productStock: number;
  productPrice?: number;
  productCostPrice?: number;
  reason: MatchReason;
  /** 0–1. `1` for `sku` and `name-exact`, which are not scored but certain. */
  score: number;
  /** One short phrase: "same barcode", "same name", "50cl = 500ml". */
  explanation: string;
  /** The same fact as `explanation`, for a caller that needs to translate it. */
  explanationCode: MatchExplanationCode;
  /** What `explanationCode` interpolates — only `same-code` carries anything. */
  explanationVars?: Record<string, string | number>;
};

/**
 * `certain` skips the question entirely; `possible` must be asked.
 *
 * The split exists because the two are different products from the owner's point
 * of view. A certain match is Zeneva telling them what it is about to do. A
 * possible match is Zeneva admitting it does not know, and guessing there is how
 * you end up with 30 units added to the wrong line.
 */
export type MatchVerdict =
  | { kind: 'new' }
  | { kind: 'certain'; match: MatchCandidate }
  | { kind: 'possible'; candidates: MatchCandidate[] };

/** What will actually happen to a row when the owner presses Import. */
export type RowDecision =
  /** Insert a new product. */
  | { action: 'create' }
  /** Add the imported quantity to an existing product's stock. */
  | { action: 'add-stock'; productId: string }
  /** Overwrite the mapped fields on an existing product, stock included. */
  | { action: 'overwrite'; productId: string }
  /** Leave the shop untouched. */
  | { action: 'skip' };

/** A draft, what it matched, and what the owner decided to do about it. */
export type StagedRow = {
  draft: DraftProduct;
  verdict: MatchVerdict;
  decision: RowDecision;
  /**
   * True once a human has touched `decision`.
   *
   * The auto-decision is recomputed whenever matching re-runs — after an AI
   * match pass, or when a draft's name is edited. Without this flag that
   * recompute would quietly undo the owner's own choices, which is the single
   * most infuriating thing a review screen can do.
   */
  decidedByUser: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Commit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a commit is about to do, counted.
 *
 * Rendered on the Import button, so the owner reads "Import 247 products" or
 * "Create 219 · Add stock to 28" and not just "Save". Both totals come from the
 * same place the writes do.
 */
export type CommitPlan = {
  create: StagedRow[];
  addStock: StagedRow[];
  overwrite: StagedRow[];
  skipped: StagedRow[];
  /** Distinct new category names the import introduces. */
  newCategories: string[];
};

/** A product-shaped payload ready for `addToQueue`, minus the ids it injects. */
export type NewProductPayload = Omit<Product, 'id' | 'businessId'> & {
  lowercaseName: string;
};
