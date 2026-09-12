/**
 * Turning a mapped table into staged products.
 *
 * The narrow waist of the importer: whatever the source, this is the only place
 * that decides how a cell becomes a field, so the money-parsing and validation
 * rules cannot drift between a spreadsheet and a photograph. It also carries the
 * two pieces of judgement that are easy to leave out and expensive to miss —
 * dropping the total row off the bottom of an invoice, and telling the owner what
 * looked wrong rather than silently fixing it.
 */

import {
  parseDate,
  parseMoney,
  parseQuantity,
  parseUnit,
  tidyName,
  wasNegative,
} from './normalize';
import type {
  ColumnMapping,
  DraftIssue,
  DraftProduct,
  ImportField,
  ImportSource,
  MappingResult,
  RawTable,
} from './types';

/**
 * Row labels that are a summary of the rows above, not a product.
 *
 * Every invoice and half of all spreadsheet exports end with one, and importing
 * it creates a product called "TOTAL" priced at the value of the whole delivery.
 * Matched against the *name* only, anchored, so a genuine product called
 * "Total Toothpaste" survives.
 */
const SUMMARY_ROW = /^\s*(sub[\s-]?total|total|grand[\s-]?total|sum|balance|amount\s+due|vat|tax|discount|net|gross|carried\s+forward|c\/?f|page\s+total)\b/i;

/**
 * Prices above this are treated as suspicious rather than accepted silently.
 *
 * Not a hard limit — a jeweller's stock is legitimately in the millions. It is a
 * threshold for *saying something*, because the usual cause of a nine-figure
 * price is a thousands separator read as a decimal point somewhere upstream, and
 * that is worth a glance before it lands on a shelf label.
 */
const IMPLAUSIBLE_PRICE = 50_000_000;

/** Stock counts above this are almost always a misread barcode in the qty column. */
const IMPLAUSIBLE_STOCK = 1_000_000;

/**
 * Build staged products from a table and its column mapping.
 *
 * Every row that carries a usable name becomes a draft. Rows are not silently
 * dropped for being incomplete: a product with no price imports at no price and
 * says so, because an importer that discards a tenth of a catalogue without
 * mentioning it is worse than one that imports it imperfectly.
 *
 * `keyPrefix` distinguishes batches so a second capture appended to the first
 * cannot collide on row index — the desktop capture and multi-photo paths both
 * rely on that.
 */
export function buildDrafts(
  table: RawTable,
  mapping: MappingResult,
  source: ImportSource,
  keyPrefix = 'r',
): { drafts: DraftProduct[]; skipped: { row: number; reason: string }[] } {
  const byField = new Map<ImportField, ColumnMapping>();
  for (const column of mapping.columns) {
    if (column.field && !byField.has(column.field)) byField.set(column.field, column);
  }

  const drafts: DraftProduct[] = [];
  const skipped: { row: number; reason: string }[] = [];

  table.rows.forEach((row, rowIndex) => {
    const cell = (field: ImportField): string => {
      const column = byField.get(field);
      if (!column) return '';
      return String(row[column.index] ?? '').trim();
    };

    const rawName = cell('name');

    // An entirely empty row is a blank line in a spreadsheet, not an error.
    const anyContent = row.some((value) => String(value ?? '').trim().length > 0);
    if (!anyContent) return;

    if (!rawName) {
      skipped.push({ row: rowIndex + 1, reason: 'no product name' });
      return;
    }
    if (SUMMARY_ROW.test(rawName)) {
      skipped.push({ row: rowIndex + 1, reason: `looks like a summary line ("${rawName}")` });
      return;
    }

    const issues: DraftIssue[] = [];
    const raw: Partial<Record<ImportField, string>> = {};
    const record = (field: ImportField, value: string) => {
      if (value) raw[field] = value;
    };

    const name = tidyName(rawName);
    record('name', rawName);

    const draft: DraftProduct = {
      key: `${keyPrefix}-${rowIndex}`,
      name,
      raw,
      issues,
      source,
    };

    // ── SKU ──
    const rawSku = cell('sku');
    if (rawSku) {
      record('sku', rawSku);
      draft.sku = rawSku;
    }

    // ── Category ──
    const rawCategory = cell('category');
    if (rawCategory) {
      record('category', rawCategory);
      draft.category = tidyName(rawCategory);
    }

    // ── Money ──
    for (const field of ['price', 'costPrice'] as const) {
      const rawValue = cell(field);
      if (!rawValue) continue;
      record(field, rawValue);
      const parsed = parseMoney(rawValue);
      if (parsed == null) {
        issues.push({ field, message: `Could not read "${rawValue}" as an amount.`, severity: 'warn' });
        continue;
      }
      if (parsed < 0) {
        issues.push({ field, message: `"${rawValue}" is negative; imported as 0.`, severity: 'warn' });
        draft[field] = 0;
        continue;
      }
      if (parsed > IMPLAUSIBLE_PRICE) {
        issues.push({
          field,
          message: `${parsed.toLocaleString()} looks too large — check the decimal point.`,
          severity: 'warn',
        });
      }
      draft[field] = parsed;
    }

    // Cost above selling price is not an error — clearance stock exists — but it
    // is worth flagging, because far more often it means the two columns were
    // mapped the wrong way round, and that inverts every margin the shop reports.
    if (
      typeof draft.price === 'number' && draft.price > 0 &&
      typeof draft.costPrice === 'number' && draft.costPrice > draft.price
    ) {
      issues.push({
        field: 'costPrice',
        message: 'Cost is higher than the selling price — are these two columns the right way round?',
        severity: 'warn',
      });
    }

    // ── Stock ──
    const rawStock = cell('stock');
    if (rawStock) {
      record('stock', rawStock);
      const parsed = parseQuantity(rawStock);
      if (parsed == null) {
        issues.push({ field: 'stock', message: `Could not read "${rawStock}" as a quantity.`, severity: 'warn' });
      } else {
        if (wasNegative(rawStock)) {
          issues.push({ field: 'stock', message: `"${rawStock}" is negative; imported as 0.`, severity: 'warn' });
        }
        if (parsed > IMPLAUSIBLE_STOCK) {
          issues.push({
            field: 'stock',
            message: `${parsed.toLocaleString()} units looks like a code in the quantity column.`,
            severity: 'warn',
          });
        }
        draft.stock = parsed;
      }
      // A quantity cell often carries the unit with it — "20 cartons" — and that
      // is the only place the unit appears in most files.
      const impliedUnit = parseUnit(rawStock);
      if (impliedUnit && !byField.has('baseUnit')) draft.baseUnit = impliedUnit;
    }

    // ── Threshold ──
    const rawThreshold = cell('lowStockThreshold');
    if (rawThreshold) {
      record('lowStockThreshold', rawThreshold);
      const parsed = parseQuantity(rawThreshold);
      if (parsed != null) draft.lowStockThreshold = parsed;
    }

    // ── Unit ──
    const rawUnit = cell('baseUnit');
    if (rawUnit) {
      record('baseUnit', rawUnit);
      draft.baseUnit = parseUnit(rawUnit) ?? tidyName(rawUnit);
    }

    // ── Text ──
    const rawDescription = cell('description');
    if (rawDescription) {
      record('description', rawDescription);
      draft.description = rawDescription;
    }

    // ── Image ──
    const rawImage = cell('imageUrl');
    if (rawImage) {
      record('imageUrl', rawImage);
      // Only absolute http(s) URLs. A relative path or a local `C:\...` from
      // somebody's export resolves to nothing and renders as a broken image on
      // every product tile, which looks worse than no image at all.
      if (/^https?:\/\//i.test(rawImage)) {
        draft.imageUrl = rawImage;
      } else {
        issues.push({
          field: 'imageUrl',
          message: 'Image skipped — only full web addresses can be imported.',
          severity: 'warn',
        });
      }
    }

    // ── Expiry ──
    const rawExpiry = cell('expiryDate');
    if (rawExpiry) {
      record('expiryDate', rawExpiry);
      const parsed = parseDate(rawExpiry);
      if (parsed) draft.expiryDate = parsed;
      else issues.push({ field: 'expiryDate', message: `Could not read "${rawExpiry}" as a date.`, severity: 'warn' });
    }

    drafts.push(draft);
  });

  return { drafts, skipped };
}

/**
 * Merge a second batch of drafts into a first, on SKU then exact name.
 *
 * Used by the multi-page paths — desktop capture and several photos of the same
 * shelving — where the same product legitimately appears in two batches and must
 * not become two drafts. Quantities **add** here, unlike everywhere else, because
 * two pages of one capture are two parts of one count.
 */
export function mergeDrafts(existing: DraftProduct[], incoming: DraftProduct[]): DraftProduct[] {
  const merged = [...existing];
  const skuAt = new Map<string, number>();
  const nameAt = new Map<string, number>();

  merged.forEach((draft, at) => {
    if (draft.sku) skuAt.set(draft.sku.trim().toUpperCase(), at);
    nameAt.set(draft.name.trim().toLowerCase(), at);
  });

  for (const draft of incoming) {
    const skuKey = draft.sku?.trim().toUpperCase() || undefined;
    const nameKey = draft.name.trim().toLowerCase();
    // Written out rather than chained: `(skuKey && skuAt.get(skuKey)) ?? …` looks
    // equivalent but yields `''` when there is no SKU, and `'' == null` is false,
    // so the row would index `merged['']` and merge into nothing.
    const at = (skuKey !== undefined ? skuAt.get(skuKey) : undefined) ?? nameAt.get(nameKey);

    if (at == null) {
      const position = merged.push(draft) - 1;
      if (skuKey) skuAt.set(skuKey, position);
      nameAt.set(nameKey, position);
      continue;
    }

    const held = merged[at];
    merged[at] = {
      ...held,
      stock: (held.stock ?? 0) + (draft.stock ?? 0),
      // Later pages fill gaps but never overwrite a value an earlier page had:
      // the first reading of a price is as good as the second, and flapping
      // between them across pages is impossible to review.
      price: held.price ?? draft.price,
      costPrice: held.costPrice ?? draft.costPrice,
      category: held.category ?? draft.category,
      sku: held.sku ?? draft.sku,
      baseUnit: held.baseUnit ?? draft.baseUnit,
      description: held.description ?? draft.description,
      imageUrl: held.imageUrl ?? draft.imageUrl,
      expiryDate: held.expiryDate ?? draft.expiryDate,
      issues: [...held.issues, ...draft.issues],
    };
  }

  return merged;
}
