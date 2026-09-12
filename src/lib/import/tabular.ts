/**
 * Reading a rectangle of data out of text a person pasted.
 *
 * Two very different things arrive through the same box. A paste out of Excel,
 * Google Sheets or a POS report is tab-delimited and perfectly regular. A paste
 * out of WhatsApp is a list of lines a human typed, with the price on the end and
 * no delimiter at all. Both are extremely common and both are handled here
 * without spending a credit, because the shapes are recognisable:
 *
 *     Coke 50cl     24      1200          ← delimited
 *     Coke 50cl - 1200                    ← line list
 *     24 x Coke 50cl @ 1200               ← line list with a leading count
 *
 * Anything this module cannot make a rectangle out of is handed to the model, and
 * `confidence` on the result is what the dialog uses to decide whether to offer
 * that. Guessing badly and importing the guess is much worse than asking.
 */

import { normalizeHeader } from './column-map';
import { parseMoney } from './normalize';
import type { RawTable } from './types';

/** Candidate delimiters, in the order they are tried. */
const DELIMITERS = ['\t', '|', ';', ','] as const;

export type TabularResult = {
  table: RawTable;
  /** 0–1: how confident the *shape* is. Not about what the columns mean. */
  confidence: number;
  /** How the rectangle was found, for the dialog's explanation line. */
  via: 'delimited' | 'line-list' | 'single-column';
};

/**
 * Split pasted text into a table.
 *
 * Returns `null` only for input with nothing in it — every other case produces a
 * table plus a confidence, so the caller decides whether to trust it rather than
 * having the decision made for it by a thrown error.
 */
export function parseTabular(text: string): TabularResult | null {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return null;

  const delimited = tryDelimited(lines);
  const lineList = tryLineList(lines);

  // Prefer whichever is more confident. A tab-delimited paste scores near 1 and
  // wins outright; a WhatsApp list has no delimiter to find and the line-list
  // reader is the only one that produces anything usable.
  if (delimited && (!lineList || delimited.confidence >= lineList.confidence)) return delimited;
  if (lineList) return lineList;

  // A bare list of names, one per line. Legitimate — somebody typing out what
  // they stock — and the review screen lets them fill in prices.
  return {
    table: {
      headers: [],
      rows: lines.map((line) => [line.trim()]),
      hasHeaderRow: false,
      label: 'pasted list',
    },
    confidence: 0.4,
    via: 'single-column',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Delimited
// ─────────────────────────────────────────────────────────────────────────────

function tryDelimited(lines: string[]): TabularResult | null {
  /*
   * A table needs at least two lines.
   *
   * With one line, "consistency" is trivially 1.0 — the single row always agrees with
   * itself — so any sentence containing a comma passed as a two-column table. "I went
   * to the market today, and bought some things." became a product called "I went to
   * the market today" priced at "and bought some things".
   *
   * A genuine one-row paste is not lost by this: it falls through to the line-list
   * reader, which handles "Coke 50cl - 450" properly, and then to the single-column
   * reader, which at least gets the name right.
   */
  if (lines.length < 2) return null;

  let best: { delimiter: string; columns: number; consistency: number } | null = null;

  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => splitLine(line, delimiter).length);
    const columns = mode(counts);
    if (columns < 2) continue;

    // How many lines agree on the column count. A real table is near-unanimous;
    // prose containing the odd comma is not, which is exactly what stops a
    // sentence being read as a two-column table.
    const consistency = counts.filter((c) => c === columns).length / counts.length;
    if (consistency < 0.7) continue;

    if (!best || consistency > best.consistency || (consistency === best.consistency && columns > best.columns)) {
      best = { delimiter, columns, consistency };
    }
  }

  if (!best) return null;

  const rows = lines
    .map((line) => splitLine(line, best!.delimiter))
    // Ragged rows are padded rather than dropped: a trailing empty cell is
    // omitted by most exporters and dropping the row loses a real product.
    .map((cells) => {
      const padded = [...cells];
      while (padded.length < best!.columns) padded.push('');
      return padded.slice(0, best!.columns);
    });

  const hasHeaderRow = looksLikeHeaderRow(rows);
  return {
    table: {
      headers: hasHeaderRow ? rows[0] : [],
      rows: hasHeaderRow ? rows.slice(1) : rows,
      hasHeaderRow,
      label: 'pasted table',
    },
    confidence: Math.min(0.95, 0.6 + best.consistency * 0.35),
    via: 'delimited',
  };
}

/**
 * Split one line, honouring double quotes.
 *
 * A product called `Milo 400g, refill` in a comma-paste is one cell, and treating
 * it as two shifts every column after it — the kind of failure that produces a
 * catalogue where all the prices belong to the wrong products.
 */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // A doubled quote inside a quoted cell is a literal quote.
      if (quoted && line[i + 1] === '"') { current += '"'; i++; continue; }
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) { cells.push(current.trim()); current = ''; continue; }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = 0, bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value > best)) { best = value; bestCount = count; }
  }
  return best;
}

/**
 * Whether the first row names the columns rather than being data.
 *
 * Two signals, either of which is enough:
 *
 * 1. A cell in the first row is a header alias we recognise. Decisive — nobody
 *    stocks a product called "Cost Price".
 * 2. The first row has no numbers in a column where later rows do. A price column
 *    whose first cell is text is a label.
 *
 * Getting this wrong in the *safe* direction matters: a header row misread as data
 * imports one junk product the owner deletes, whereas a data row misread as a
 * header silently loses a real product with no trace. So the bar for calling
 * something a header is deliberately the higher of the two.
 */
function looksLikeHeaderRow(rows: string[][]): boolean {
  if (rows.length < 2) return false;
  const [first, ...rest] = rows;

  const knownAliases = new Set([
    'name', 'productname', 'item', 'itemname', 'product', 'description',
    'sku', 'barcode', 'code', 'itemcode', 'price', 'sellingprice', 'selling',
    'cost', 'costprice', 'buy', 'qty', 'quantity', 'stock', 'category', 'dept',
    'department', 'unit', 'rate', 'amount',
  ]);
  if (first.some((cell) => knownAliases.has(normalizeHeader(cell)))) return true;

  const sample = rest.slice(0, 12);
  let numericColumnsWithTextHeader = 0;
  let numericColumns = 0;

  for (let column = 0; column < first.length; column++) {
    const values = sample.map((row) => row[column] ?? '').filter((v) => v.trim().length > 0);
    if (values.length === 0) continue;
    const numeric = values.filter((v) => parseMoney(v) != null).length / values.length;
    if (numeric < 0.8) continue;
    numericColumns++;
    if (parseMoney(first[column]) == null && String(first[column] ?? '').trim().length > 0) {
      numericColumnsWithTextHeader++;
    }
  }

  return numericColumns > 0 && numericColumnsWithTextHeader === numericColumns;
}

// ─────────────────────────────────────────────────────────────────────────────
// Line lists
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A hand-typed line, decomposed.
 *
 * The patterns are ordered most-specific first, and each one is anchored so a
 * product name containing a digit does not get eaten. Between them they cover
 * what a WhatsApp price list or a stock note actually looks like.
 */
const LINE_PATTERNS: { re: RegExp; take: (m: RegExpMatchArray) => { name: string; qty?: string; price?: string } }[] = [
  // "24 x Coke 50cl @ 1200"  /  "24x Coke 50cl - 1200"
  {
    re: /^(\d[\d.,]*)\s*(?:x|\*|pcs?|pieces?|units?)?\s+(.+?)\s*(?:@|-|=|:|for|at)\s*([₦$#N]?\s?[\d.,]+k?)\s*$/i,
    take: (m) => ({ qty: m[1], name: m[2], price: m[3] }),
  },
  // "Coke 50cl x 24 @ 1200"
  {
    re: /^(.+?)\s*(?:x|\*)\s*(\d[\d.,]*)\s*(?:@|-|=|:|for|at)\s*([₦$#N]?\s?[\d.,]+k?)\s*$/i,
    take: (m) => ({ name: m[1], qty: m[2], price: m[3] }),
  },
  // "Coke 50cl - 1200"  /  "Coke 50cl = ₦1,200"  /  "Coke 50cl: 1200"
  {
    re: /^(.+?)\s*(?:@|--|-|=|:|—|–)\s*([₦$#N]?\s?[\d.,]+k?)\s*$/i,
    take: (m) => ({ name: m[1], price: m[2] }),
  },
  // "Coke 50cl 1200" — a bare trailing number. Least specific, so it runs last,
  // and the name must contain a letter so a row of two numbers is not a product.
  {
    re: /^(.*[a-z].*?)\s+([₦$#]?\s?[\d.,]+k?)\s*$/i,
    take: (m) => ({ name: m[1], price: m[2] }),
  },
];

function tryLineList(lines: string[]): TabularResult | null {
  const parsed = lines.map((line) => {
    const cleaned = line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim();
    if (!cleaned) return null;
    for (const pattern of LINE_PATTERNS) {
      const match = cleaned.match(pattern.re);
      if (!match) continue;
      const taken = pattern.take(match);
      const name = taken.name.replace(/[\s,;:-]+$/, '').trim();
      // A name that is only digits and punctuation is a stray number, not a
      // product, and importing it creates a product called "1,200".
      if (!/[a-z]/i.test(name)) continue;
      if (taken.price != null && parseMoney(taken.price) == null) continue;
      return { name, qty: taken.qty ?? '', price: taken.price ?? '' };
    }
    return null;
  });

  const hits = parsed.filter(Boolean) as { name: string; qty: string; price: string }[];
  const ratio = hits.length / lines.length;
  // Under two thirds and this is prose that happens to contain numbers. The model
  // handles that far better than a regex can, and pretending otherwise imports
  // fragments of sentences as products.
  if (ratio < 0.66 || hits.length === 0) return null;

  const anyQty = hits.some((h) => h.qty);
  const headers = anyQty ? ['Product', 'Quantity', 'Price'] : ['Product', 'Price'];
  const rows = hits.map((h) => (anyQty ? [h.name, h.qty, h.price] : [h.name, h.price]));

  return {
    table: { headers, rows, hasHeaderRow: true, label: 'pasted list' },
    // Capped below the delimited path: this reader inferred the columns rather
    // than being told them, so the review screen should still be read carefully.
    confidence: Math.min(0.8, 0.45 + ratio * 0.35),
    via: 'line-list',
  };
}
