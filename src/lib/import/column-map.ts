/**
 * Working out what a spreadsheet's columns mean, without asking the owner.
 *
 * The old CSV dialog had eight header aliases and refused any file missing
 * `Name` or `Price`. That is the wrong shape of failure: a shop with a working
 * stock list gets told their own data is invalid. This module answers the
 * question in three passes, cheapest first, and only the third costs money:
 *
 * 1. **Header lookup** — an alias table covering the exports people actually
 *    arrive with (WooCommerce, Shopify, QuickBooks, Sage, Tally, Zoho, and the
 *    bare `Item/Selling/Buy/Qty/Dept` a hand-made sheet uses). Free, instant,
 *    and correct for the large majority of files.
 * 2. **Value inference** — when the headers are useless (`Column3`, blank, or no
 *    header row at all), read the *cells*. A column of money is a price; the
 *    cheaper of two money columns is the cost. Free, and it is the only thing
 *    that can read a file with no header row at all.
 * 3. **AI** — the residue. Charged, offered rather than imposed, and never the
 *    only way forward: the review screen always allows mapping by hand.
 *
 * Pass 2 is the interesting one and the reason pass 3 is rarely needed. It is
 * also why this module is pure: the inference rules are guesses about human
 * behaviour and they need to be testable without a model in the loop.
 */

import {
  AI_MAPPING_THRESHOLD,
  IMPORT_FIELDS,
  MONEY_FIELDS,
  REQUIRED_FIELDS,
  type ColumnMapping,
  type ImportField,
  type MappingResult,
  type RawTable,
} from './types';
import { isPlausibleSku, parseDate, parseMoney } from './normalize';

// ─────────────────────────────────────────────────────────────────────────────
// Pass 1 — header aliases
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Header spellings, per field, in no particular order.
 *
 * Compared after `normalizeHeader`, so case, spaces, underscores and punctuation
 * are already gone — `Cost Price`, `cost_price` and `COST-PRICE` all arrive here
 * as `costprice` and only need the one entry. What still needs listing is genuine
 * vocabulary differences, and the ones that matter most are the terse ones a
 * human writes by hand: `selling`, `buy`, `qty`, `dept`.
 *
 * Order within a field does not matter, but order *between* fields does, and it
 * is handled in `scoreHeader` rather than here: `price` and `costPrice` share the
 * substring `price`, so the more specific field has to win. Adding a new alias
 * that is a substring of another field's alias needs that checked.
 */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  name: [
    'name', 'productname', 'itemname', 'product', 'item', 'title', 'description1',
    'particulars', 'goods', 'article', 'articlename', 'stockitem', 'itemdescription',
    'productdescription', 'produkt', 'nombre', 'produit', 'descriptionofgoods',
    'itemtitle', 'productitle', 'inventoryitem', 'stockname', 'brand',
  ],
  sku: [
    'sku', 'barcode', 'code', 'itemcode', 'productcode', 'ean', 'upc', 'gtin',
    'partnumber', 'partno', 'ref', 'reference', 'refno', 'stockcode', 'articleno',
    'articlenumber', 'productid', 'itemid', 'itemno', 'itemnumber', 'plu',
    'scancode', 'serial', 'skucode', 'barcodeean', 'productsku',
  ],
  category: [
    'category', 'categories', 'productcategory', 'itemcategory', 'type', 'dept',
    'department', 'group', 'productgroup', 'itemgroup', 'class', 'classification',
    'section', 'family', 'productype', 'producttype', 'kategorie', 'categoria',
    'maincategory', 'subcategory', 'itemtype',
  ],
  price: [
    'price', 'sellingprice', 'selling', 'saleprice', 'sales', 'salesprice',
    'retailprice', 'retail', 'unitprice', 'rate', 'mrp', 'listprice', 'amount',
    'sellprice', 'sell', 'regularprice', 'regularprices', 'pricengn', 'sp',
    'outprice', 'sellingrate', 'sellingamount', 'customerprice', 'shelfprice',
  ],
  costPrice: [
    'costprice', 'cost', 'buy', 'buyingprice', 'buying', 'purchaseprice',
    'purchase', 'purchaserate', 'landedcost', 'unitcost', 'wholesaleprice',
    'wholesale', 'supplierprice', 'cp', 'inprice', 'buyprice', 'costeach',
    'purchaseamount', 'costofgoods', 'cogs', 'lastcost', 'averagecost', 'avgcost',
  ],
  stock: [
    'stock', 'quantity', 'qty', 'instock', 'stockonhand', 'onhand', 'available',
    'availablequantity', 'balance', 'closingbalance', 'closingstock', 'count',
    'units', 'unitsinstock', 'inventory', 'inventoryquantity', 'stocklevel',
    'currentstock', 'qtyonhand', 'quantityonhand', 'opening', 'openingstock',
    'physicalcount', 'countedqty', 'stockqty', 'menge',
  ],
  description: [
    'description', 'details', 'notes', 'note', 'remark', 'remarks', 'bodyhtml',
    'shortdescription', 'longdescription', 'productdetails', 'comment', 'comments',
    'specification', 'specs', 'about',
  ],
  imageUrl: [
    'imageurl', 'image', 'images', 'imagelink', 'imagesrc', 'photo', 'photourl',
    'picture', 'pictureurl', 'thumbnail', 'img', 'imgurl', 'image1', 'mainimage',
    'productimage', 'featuredimage',
  ],
  baseUnit: [
    'unit', 'uom', 'unitofmeasure', 'measure', 'baseunit', 'packsize', 'pack',
    'sellingunit', 'stockunit', 'unitname', 'einheit',
  ],
  lowStockThreshold: [
    'lowstockthreshold', 'reorderlevel', 'reorderpoint', 'minstock',
    'minimumstock', 'minqty', 'minimumquantity', 'safetystock', 'alertquantity',
    'lowstockalert', 'threshold', 'reorderqty',
  ],
  expiryDate: [
    'expirydate', 'expiry', 'expires', 'expiresat', 'expirationdate', 'expiration',
    'bestbefore', 'bestbeforedate', 'usebydate', 'useby', 'shelflife', 'batchexpiry',
    'exp', 'expdate',
  ],
};

/**
 * Reduce a header to its comparable form.
 *
 * The bracketed suffix strip is what makes `Price (₦)`, `Cost [USD]`,
 * `Qty (pcs)` and `Stock {units}` all resolve — a unit or currency in brackets is
 * annotation, never identity. `*` is stripped because required-field markers are
 * everywhere in hand-made templates.
 */
export function normalizeHeader(header: string): string {
  return String(header ?? '')
    .replace(/[([{].*?[)\]}]/g, ' ')
    .replace(/\*+/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Best field for a header, with a confidence.
 *
 * Specificity beats position: `costprice` contains `price`, so a substring hit is
 * only accepted when nothing matched exactly, and among substring hits the
 * **longest** alias wins. Without that rule a `Cost Price` column maps to `price`
 * and the shop's margins are inverted on every product — silently, because both
 * fields are money and both look plausible in the preview.
 */
function scoreHeader(header: string): { field: ImportField | null; confidence: number; via: 'exact' | 'alias' | 'fuzzy' } {
  const key = normalizeHeader(header);
  if (!key) return { field: null, confidence: 0, via: 'fuzzy' };

  // Exact alias hit. Certain, and cannot be improved on.
  for (const field of IMPORT_FIELDS) {
    if (HEADER_ALIASES[field].includes(key)) {
      return { field, confidence: 1, via: key === field.toLowerCase() ? 'exact' : 'alias' };
    }
  }

  // Substring hit, longest alias wins so `costprice` beats `price`.
  let best: { field: ImportField; alias: string } | null = null;
  for (const field of IMPORT_FIELDS) {
    for (const alias of HEADER_ALIASES[field]) {
      // Aliases under 3 characters (`sp`, `cp`, `qty`) are too short to be safe
      // as substrings — `cp` matches `cpu`. They only ever match exactly, above.
      if (alias.length < 4) continue;
      if (!key.includes(alias)) continue;
      if (!best || alias.length > best.alias.length) best = { field, alias };
    }
  }
  if (best) {
    // How much of the header the alias accounts for. `unitprice` → `price` is
    // 5/9 and a fair guess; `pricelistrevisionnotes` → `price` is 5/22 and is
    // not, so it falls below the threshold and becomes a question instead.
    const coverage = best.alias.length / key.length;
    return { field: best.field, confidence: 0.55 + coverage * 0.4, via: 'fuzzy' };
  }

  return { field: null, confidence: 0, via: 'fuzzy' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass 2 — value inference
// ─────────────────────────────────────────────────────────────────────────────

/** What a column's cells look like, which is often more honest than its header. */
type ColumnStats = {
  index: number;
  filled: number;
  /** Fraction of filled cells that parse as a number. */
  numericRatio: number;
  /** Fraction of filled cells that are whole numbers. */
  integerRatio: number;
  /** Fraction of filled cells containing at least one letter. */
  alphaRatio: number;
  /** Distinct values ÷ filled. 1 means every row differs. */
  uniqueRatio: number;
  /** Fraction that look like a URL. */
  urlRatio: number;
  /** Fraction that parse as a date. */
  dateRatio: number;
  meanNumber: number;
  meanLength: number;
  /** Fraction that contain a space — names have them, codes rarely do. */
  spaceRatio: number;
};

function columnStats(rows: string[][], index: number): ColumnStats {
  const values = rows.map((r) => String(r[index] ?? '').trim());
  const filled = values.filter((v) => v.length > 0);
  const n = filled.length;

  if (n === 0) {
    return {
      index, filled: 0, numericRatio: 0, integerRatio: 0, alphaRatio: 0,
      uniqueRatio: 0, urlRatio: 0, dateRatio: 0, meanNumber: 0, meanLength: 0,
      spaceRatio: 0,
    };
  }

  let numeric = 0, integer = 0, alpha = 0, url = 0, dates = 0, spaces = 0;
  let sum = 0, lengthSum = 0;

  for (const value of filled) {
    lengthSum += value.length;
    if (/\s/.test(value)) spaces++;
    if (/[a-z]/i.test(value)) alpha++;
    if (/^https?:\/\//i.test(value) || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(value)) url++;

    // A pure number must not also be read as a date, or every price column
    // scores as an expiry. Only try dates on things carrying a separator.
    if (/[-/.]/.test(value) || /[a-z]{3}/i.test(value)) {
      if (parseDate(value)) dates++;
    }

    // Only cells that are *mostly* numeric count as numeric — `12 cartons` is
    // not a price column's cell, and letting it through makes a unit column
    // score as money.
    const digitShare = (value.replace(/[^0-9]/g, '').length) / value.length;
    const parsed = digitShare >= 0.5 ? parseMoney(value) : null;
    if (parsed != null) {
      numeric++;
      sum += parsed;
      if (Number.isInteger(parsed)) integer++;
    }
  }

  return {
    index,
    filled: n,
    numericRatio: numeric / n,
    integerRatio: numeric > 0 ? integer / numeric : 0,
    alphaRatio: alpha / n,
    uniqueRatio: new Set(filled).size / n,
    urlRatio: url / n,
    dateRatio: dates / n,
    meanNumber: numeric > 0 ? sum / numeric : 0,
    meanLength: lengthSum / n,
    spaceRatio: spaces / n,
  };
}

/**
 * Fill unmapped columns by reading their contents.
 *
 * Runs after pass 1 and only on what pass 1 left over, so a file with good
 * headers never reaches it. Assignment is greedy by confidence and each field is
 * claimed at most once — two columns cannot both be `price`, and the loser stays
 * unmapped rather than silently overwriting.
 *
 * The money pair is the rule worth stating: given two unclaimed money columns,
 * the one with the **higher mean is the selling price** and the lower is cost.
 * That holds for any shop that is not losing money on every line, which makes it
 * about as safe an inference as exists here — and it is exactly the
 * `Selling`/`Buy` pair a hand-made sheet uses without ever writing "price".
 */
function inferFromValues(
  table: RawTable,
  columns: ColumnMapping[],
): void {
  const taken = new Set(columns.map((c) => c.field).filter(Boolean) as ImportField[]);
  const open = columns.filter((c) => c.field === null && c.confidence < AI_MAPPING_THRESHOLD);
  if (open.length === 0) return;

  const stats = new Map(open.map((c) => [c.index, columnStats(table.rows, c.index)]));

  const assign = (column: ColumnMapping, field: ImportField, confidence: number) => {
    column.field = field;
    column.confidence = confidence;
    column.via = 'value';
    taken.add(field);
  };

  const statFor = (c: ColumnMapping) => stats.get(c.index)!;
  const stillOpen = () => open.filter((c) => c.field === null);

  // Images and dates first: both are unmistakable, so claiming them early stops
  // a URL column being mistaken for a name (long, unique, alphabetic — it fits).
  for (const column of stillOpen()) {
    const s = statFor(column);
    if (!taken.has('imageUrl') && s.urlRatio >= 0.6) assign(column, 'imageUrl', 0.9);
  }
  for (const column of stillOpen()) {
    const s = statFor(column);
    if (!taken.has('expiryDate') && s.dateRatio >= 0.7 && s.numericRatio < 0.7) {
      assign(column, 'expiryDate', 0.8);
    }
  }

  // The money pair.
  const moneyColumns = stillOpen()
    .filter((c) => {
      const s = statFor(c);
      // Money is numeric, non-trivial in magnitude, and not a small tally. The
      // magnitude floor is what separates a price column from a stock column in
      // a currency with no subunit in daily use.
      return s.numericRatio >= 0.8 && s.meanNumber >= 20;
    })
    .sort((a, b) => statFor(b).meanNumber - statFor(a).meanNumber);

  const wantPrice = MONEY_FIELDS.filter((f) => !taken.has(f));
  if (moneyColumns.length >= 2 && wantPrice.length >= 2) {
    assign(moneyColumns[0], 'price', 0.75);
    assign(moneyColumns[1], 'costPrice', 0.75);
  } else if (moneyColumns.length >= 1 && wantPrice.length >= 1) {
    // One money column and only one money field left — take it. When both are
    // still open a lone column is the selling price: that is the one a shop
    // cannot operate without, so it is the safer of the two to assume.
    assign(moneyColumns[0], wantPrice.includes('price') ? 'price' : wantPrice[0], 0.7);
  }

  // Stock: whole numbers, modest magnitude, and repeats itself (many products
  // share a count of 0, 1, 2). Zero-heavy columns are stock far more often than
  // they are anything else.
  if (!taken.has('stock')) {
    const candidates = stillOpen()
      .filter((c) => {
        const s = statFor(c);
        return s.numericRatio >= 0.8 && s.integerRatio >= 0.9 && s.meanNumber < 100_000;
      })
      .sort((a, b) => statFor(a).meanNumber - statFor(b).meanNumber);
    if (candidates.length > 0) assign(candidates[0], 'stock', 0.72);
  }

  // SKU: unique, short, no spaces, and plausible as a real code.
  if (!taken.has('sku')) {
    const candidates = stillOpen().filter((c) => {
      const s = statFor(c);
      if (s.uniqueRatio < 0.9 || s.spaceRatio > 0.2 || s.meanLength > 24) return false;
      const sample = table.rows.map((r) => String(r[c.index] ?? '').trim()).filter(Boolean).slice(0, 20);
      return sample.length > 0 && sample.filter(isPlausibleSku).length / sample.length >= 0.8;
    });
    if (candidates.length > 0) assign(candidates[0], 'sku', 0.75);
  }

  // Name: the most text-like column left. Required, so this runs even when the
  // evidence is thin — an unmapped name means the whole file is unusable, and a
  // low-confidence guess the owner can see and correct beats that.
  if (!taken.has('name')) {
    const candidates = stillOpen()
      .filter((c) => statFor(c).alphaRatio >= 0.6)
      .sort((a, b) => {
        const sa = statFor(a), sb = statFor(b);
        // Prefer long, spacey, distinctive text — that is what a product name is.
        const score = (s: ColumnStats) => s.meanLength * (1 + s.spaceRatio) * (0.5 + s.uniqueRatio);
        return score(sb) - score(sa);
      });
    if (candidates.length > 0) {
      const s = statFor(candidates[0]);
      assign(candidates[0], 'name', s.uniqueRatio >= 0.8 && s.spaceRatio >= 0.3 ? 0.78 : 0.6);
    }
  }

  // Category: alphabetic and *repetitive*. Low uniqueness is the signal — a
  // category column says "Drinks" forty times, which is precisely what
  // disqualifies it from being a name.
  if (!taken.has('category')) {
    const candidates = stillOpen()
      .filter((c) => {
        const s = statFor(c);
        return s.alphaRatio >= 0.7 && s.uniqueRatio <= 0.5 && s.meanLength <= 30;
      })
      .sort((a, b) => statFor(a).uniqueRatio - statFor(b).uniqueRatio);
    if (candidates.length > 0) assign(candidates[0], 'category', 0.72);
  }

  // Unit: alphabetic, very repetitive, very short. Distinguished from category
  // only by length, which is enough — "Carton" and "pcs" against "Beverages".
  if (!taken.has('baseUnit')) {
    const candidates = stillOpen().filter((c) => {
      const s = statFor(c);
      return s.alphaRatio >= 0.8 && s.uniqueRatio <= 0.3 && s.meanLength <= 8;
    });
    if (candidates.length > 0) assign(candidates[0], 'baseUnit', 0.7);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a table's columns to Zeneva fields, free of charge.
 *
 * `needsAi` on the result is the *offer* to spend a credit, not a decision to.
 * It is true only when a required field is still missing or something meaningful
 * is unaccounted for — an unmapped `Supplier Phone` column is not a reason to
 * charge anybody, since ignoring it is the correct outcome anyway.
 */
export function mapColumns(table: RawTable): MappingResult {
  const width = Math.max(
    table.headers.length,
    ...table.rows.slice(0, 50).map((r) => r.length),
    0,
  );

  const columns: ColumnMapping[] = Array.from({ length: width }, (_, index) => {
    const header = table.hasHeaderRow ? String(table.headers[index] ?? '').trim() : '';
    const source = header || `Column ${index + 1}`;

    if (!table.hasHeaderRow || !header) {
      return { index, source, field: null, confidence: 0, via: 'fuzzy' as const };
    }
    const scored = scoreHeader(header);
    return {
      index,
      source,
      field: scored.confidence >= AI_MAPPING_THRESHOLD ? scored.field : null,
      confidence: scored.confidence,
      via: scored.via,
    };
  });

  // A field claimed twice by pass 1 — `Price` and `Unit Price` in the same sheet
  // — keeps the higher-confidence column and releases the other. Leaving both
  // means the later one silently wins when the rows are built.
  const claimed = new Map<ImportField, ColumnMapping>();
  for (const column of columns) {
    if (!column.field) continue;
    const held = claimed.get(column.field);
    if (!held) { claimed.set(column.field, column); continue; }
    const loser = column.confidence > held.confidence ? held : column;
    const winner = loser === held ? column : held;
    loser.field = null;
    loser.confidence = 0;
    claimed.set(winner.field!, winner);
  }

  inferFromValues(table, columns);

  const uncertain = columns.filter(
    (c) => c.field === null && hasContent(table, c.index),
  );
  const mapped = new Set(columns.map((c) => c.field).filter(Boolean) as ImportField[]);
  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapped.has(f));

  return {
    columns,
    uncertain,
    // Worth paying for only when the file is not yet usable, or when a column
    // carrying real data went unexplained.
    needsAi: missingRequired.length > 0 || uncertain.length > 0,
  };
}

/** True when a column has data in it at all — an empty column is not a mystery. */
function hasContent(table: RawTable, index: number): boolean {
  return table.rows.some((row) => String(row[index] ?? '').trim().length > 0);
}

/**
 * Fold an AI mapping decision into a deterministic result.
 *
 * The model may only speak about columns pass 1 and 2 left open, and may only
 * claim fields nothing else has claimed. Both limits are enforced here rather
 * than trusted from the response: a model that renames the column the deterministic
 * pass got right is a regression, and it has no way of knowing it did it.
 */
export function applyAiMapping(
  result: MappingResult,
  ai: { index: number; field: ImportField | null }[],
): MappingResult {
  const columns = result.columns.map((c) => ({ ...c }));
  const taken = new Set(columns.map((c) => c.field).filter(Boolean) as ImportField[]);

  for (const suggestion of ai) {
    const column = columns.find((c) => c.index === suggestion.index);
    if (!column || column.field !== null) continue;
    if (suggestion.field === null) continue;
    if (!IMPORT_FIELDS.includes(suggestion.field)) continue;
    if (taken.has(suggestion.field)) continue;

    column.field = suggestion.field;
    // 0.85 rather than 1: an AI mapping is a good guess, and showing it as
    // certain would discourage the glance at the review table that catches it
    // being wrong.
    column.confidence = 0.85;
    column.via = 'ai';
    taken.add(suggestion.field);
  }

  const uncertain = columns.filter((c) => c.field === null);
  const missingRequired = REQUIRED_FIELDS.filter((f) => !taken.has(f));
  return { columns, uncertain, needsAi: missingRequired.length > 0 };
}

/** Set one column by hand. Always wins, and is never revisited. */
export function setMapping(
  result: MappingResult,
  index: number,
  field: ImportField | null,
): MappingResult {
  const columns = result.columns.map((c) => {
    // Releasing whoever else held this field is what makes the mapping dropdown
    // behave: picking `Cost price` for column 4 must take it off column 3.
    if (field !== null && c.field === field && c.index !== index) {
      return { ...c, field: null, confidence: 0, via: 'manual' as const };
    }
    if (c.index !== index) return c;
    return { ...c, field, confidence: 1, via: 'manual' as const };
  });

  const mapped = new Set(columns.map((c) => c.field).filter(Boolean) as ImportField[]);
  return {
    columns,
    uncertain: columns.filter((c) => c.field === null),
    needsAi: REQUIRED_FIELDS.some((f) => !mapped.has(f)),
  };
}
