/**
 * Reading a spreadsheet file into `RawTable`s, entirely on the device.
 *
 * This path is **free and always will be**: no model is involved, nothing leaves
 * the browser, and the owner's catalogue is not sent anywhere to be understood.
 * That is the deliberate shape of the pricing — a shop with a clean export pays
 * nothing, and AI is what you buy when your data is messy.
 *
 * ## Why there is an XLSX parser in here
 *
 * `.xlsx` is a ZIP of XML and the shop's Excel file is the single most common way
 * inventory arrives, so it has to be supported. The obvious library for it,
 * SheetJS on npm, is pinned at 0.18.5 there and carries a prototype-pollution
 * advisory (CVE-2023-30533) — parsing an arbitrary file somebody was handed by a
 * supplier is exactly the situation that advisory describes. The maintained build
 * lives on the vendor's own CDN, which a Tauri static export cannot fetch at
 * runtime.
 *
 * So this reads the parts of the format that matter: shared strings, inline
 * strings, numbers, and dates via the style table. It is a **reader**, not a
 * spreadsheet engine — formulas are taken at their cached value, which is what a
 * data import wants anyway. `fflate` does the unzipping and is a direct dependency
 * for this reason; it was previously present only via `jspdf`, and depending on a
 * transitive is how a working feature breaks on an unrelated version bump.
 */

import Papa from 'papaparse';
import { unzipSync } from 'fflate';
import type { RawTable } from './types';

/** Anything bigger is refused before it locks the tab up. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Rows past this are dropped, and the caller is told how many. */
export const MAX_ROWS = 20_000;

export type SpreadsheetResult = {
  sheets: RawTable[];
  /** Non-fatal notes to show the owner: dropped rows, skipped sheets. */
  notes: string[];
};

export class SpreadsheetError extends Error {}

/**
 * Read a dropped file into one table per sheet.
 *
 * CSV and TSV yield a single sheet. `.xlsx`/`.xlsm` yield one per worksheet, in
 * workbook order, and the dialog asks which to use when there is more than one
 * with data in it — picking the first silently is how somebody imports the
 * "Instructions" tab.
 */
export async function readSpreadsheet(file: File): Promise<SpreadsheetResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new SpreadsheetError(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is ${MAX_FILE_BYTES / 1024 / 1024}MB — try exporting just the product sheet.`,
    );
  }

  const name = file.name.toLowerCase();

  if (/\.(xlsx|xlsm)$/.test(name)) return readXlsx(await file.arrayBuffer());

  if (/\.xls$/.test(name)) {
    // The pre-2007 binary format is a different thing entirely and not worth a
    // second parser. The fix takes the owner ten seconds and the message says so.
    throw new SpreadsheetError(
      'That is the older .xls format. Open it in Excel and use File → Save As → CSV or Excel Workbook (.xlsx), then try again.',
    );
  }

  if (/\.(numbers|ods)$/.test(name)) {
    throw new SpreadsheetError(
      `Zeneva cannot read ${name.endsWith('.ods') ? 'OpenDocument' : 'Numbers'} files directly. Export it as CSV or Excel (.xlsx) first.`,
    );
  }

  return readCsv(await file.text(), file.name);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse delimited text with Papa Parse.
 *
 * `header: false` on purpose. Papa's header mode silently collapses duplicate
 * column names and drops the original order, and both matter here: the mapping
 * review shows the owner their columns as they wrote them, in the order they
 * wrote them, and two columns called `Price` is a case the mapper resolves rather
 * than one the parser should hide.
 */
function readCsv(text: string, label: string): SpreadsheetResult {
  // A UTF-8 BOM survives `file.text()` and would become part of the first
  // header, so `Name` arrives with U+FEFF glued to the front of it and
  // matches no alias at all. Compared by codepoint rather than written as a
  // literal: a byte-order mark is invisible in an editor, so a regex containing
  // one silently survives being "cleaned up" by a later edit and stops working.
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const parsed = Papa.parse<string[]>(clean, {
    header: false,
    skipEmptyLines: 'greedy',
    // Let Papa sniff between comma, tab, semicolon and pipe. European exports
    // are semicolon-delimited and guessing comma turns each row into one cell.
    delimitersToGuess: [',', '\t', ';', '|'],
  });

  const rows = (parsed.data ?? []).filter((row) => Array.isArray(row) && row.some((c) => String(c ?? '').trim()));
  if (rows.length === 0) throw new SpreadsheetError('That file has no rows in it.');

  const notes: string[] = [];
  const trimmed = capRows(rows, notes);

  return { sheets: [toTable(trimmed, label, notes)], notes };
}

// ─────────────────────────────────────────────────────────────────────────────
// XLSX
// ─────────────────────────────────────────────────────────────────────────────

function readXlsx(buffer: ArrayBuffer): SpreadsheetResult {
  if (typeof DOMParser === 'undefined') {
    throw new SpreadsheetError('Spreadsheet reading is only available in the app, not on the server.');
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new SpreadsheetError('That file is not a readable Excel workbook — it may be corrupted or password-protected.');
  }

  const text = (path: string): string | null => {
    const entry = files[path];
    if (!entry) return null;
    return new TextDecoder('utf-8').decode(entry);
  };

  const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');

  const workbookXml = text('xl/workbook.xml');
  if (!workbookXml) throw new SpreadsheetError('That workbook is missing its index and cannot be read.');
  const workbook = parse(workbookXml);

  // The 1904 epoch is a Mac-Excel legacy setting. Rare, but a workbook using it
  // reads every date four years early, which for an expiry date means importing
  // stock that is already expired.
  const date1904 = workbook.querySelector('workbookPr')?.getAttribute('date1904');
  const epoch1904 = date1904 === '1' || date1904 === 'true';

  const sharedStrings = readSharedStrings(text('xl/sharedStrings.xml'), parse);
  const dateStyles = readDateStyles(text('xl/styles.xml'), parse);
  const relationships = readRelationships(text('xl/_rels/workbook.xml.rels'), parse);

  const notes: string[] = [];
  const sheets: RawTable[] = [];

  const sheetNodes = Array.from(workbook.getElementsByTagName('sheet'));
  for (const node of sheetNodes) {
    const sheetName = node.getAttribute('name') ?? `Sheet ${sheets.length + 1}`;
    const relId = node.getAttribute('r:id') ?? node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const target = relId ? relationships[relId] : undefined;

    const path = target
      ? `xl/${target.replace(/^\/?xl\//, '').replace(/^\//, '')}`
      : `xl/worksheets/sheet${sheets.length + 1}.xml`;

    const sheetXml = text(path);
    if (!sheetXml) continue;

    const rows = readSheetRows(parse(sheetXml), sharedStrings, dateStyles, epoch1904);
    if (rows.length === 0) {
      notes.push(`Sheet "${sheetName}" is empty and was skipped.`);
      continue;
    }
    const capped = capRows(rows, notes);
    sheets.push(toTable(capped, sheetName, notes));
  }

  if (sheets.length === 0) throw new SpreadsheetError('That workbook has no rows in any sheet.');
  return { sheets, notes };
}

/**
 * The shared string table, flattened.
 *
 * Rich text splits one string across several `<r><t>` runs — a product name with
 * one bold word arrives in three pieces — so every `<t>` under an `<si>` is
 * concatenated. Taking only the first is how `Coca-Cola 50cl` becomes `Coca`.
 */
function readSharedStrings(xml: string | null, parse: (xml: string) => Document): string[] {
  if (!xml) return [];
  const doc = parse(xml);
  return Array.from(doc.getElementsByTagName('si')).map((si) => {
    // `rPh` holds phonetic hints for Japanese text and is not part of the value.
    Array.from(si.getElementsByTagName('rPh')).forEach((node) => node.parentNode?.removeChild(node));
    return Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('');
  });
}

/** Built-in number-format ids that mean "this number is a date". */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/**
 * Which cell-style indices render as a date.
 *
 * An Excel date is a plain number and only the *style* says otherwise, so without
 * this an expiry column imports as `46388`. Custom formats are matched on
 * containing a date placeholder while excluding the ones that only look like it —
 * `0.00` has no `y`, `m` or `d`, but `General` and a red-negative currency mask
 * can, so the check is on the placeholder characters outside quoted literals.
 */
function readDateStyles(xml: string | null, parse: (xml: string) => Document): Set<number> {
  const dateXfs = new Set<number>();
  if (!xml) return dateXfs;

  const doc = parse(xml);
  const customDateFormats = new Set<number>();
  for (const numFmt of Array.from(doc.getElementsByTagName('numFmt'))) {
    const id = Number(numFmt.getAttribute('numFmtId'));
    const code = numFmt.getAttribute('formatCode') ?? '';
    // Strip quoted literals and colour/condition blocks before looking for
    // placeholders, so `"day"0` is not read as a date format.
    const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
    if (/[yd]/i.test(bare) || /m{3,}/i.test(bare) || (/m/i.test(bare) && /[dy]/i.test(bare))) {
      customDateFormats.add(id);
    }
  }

  const cellXfs = doc.getElementsByTagName('cellXfs')[0];
  if (!cellXfs) return dateXfs;

  Array.from(cellXfs.getElementsByTagName('xf')).forEach((xf, index) => {
    const id = Number(xf.getAttribute('numFmtId') ?? '0');
    if (BUILTIN_DATE_FORMATS.has(id) || customDateFormats.has(id)) dateXfs.add(index);
  });

  return dateXfs;
}

function readRelationships(xml: string | null, parse: (xml: string) => Document): Record<string, string> {
  const map: Record<string, string> = {};
  if (!xml) return map;
  const doc = parse(xml);
  for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) map[id] = target;
  }
  return map;
}

/**
 * `"C"` → 2. Column letters, not cell order.
 *
 * Empty cells are simply absent from the XML, so a row reading
 * `<c r="A5"/><c r="D5"/>` has to place the second value in column 3 and not
 * column 1. Reading cells positionally is the classic way to shift every value in
 * a sparse sheet one column left.
 */
function columnIndex(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref.toUpperCase())?.[1] ?? 'A';
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

function readSheetRows(
  doc: Document,
  sharedStrings: string[],
  dateStyles: Set<number>,
  epoch1904: boolean,
): string[][] {
  const out: string[][] = [];

  for (const rowNode of Array.from(doc.getElementsByTagName('row'))) {
    const cells: string[] = [];

    for (const cellNode of Array.from(rowNode.getElementsByTagName('c'))) {
      const ref = cellNode.getAttribute('r') ?? '';
      const at = ref ? columnIndex(ref) : cells.length;
      while (cells.length < at) cells.push('');

      cells[at] = readCell(cellNode, sharedStrings, dateStyles, epoch1904);
    }

    if (cells.some((value) => String(value ?? '').trim().length > 0)) out.push(cells);
  }

  return out;
}

function readCell(
  cell: Element,
  sharedStrings: string[],
  dateStyles: Set<number>,
  epoch1904: boolean,
): string {
  const type = cell.getAttribute('t');

  if (type === 's') {
    const index = Number(cell.getElementsByTagName('v')[0]?.textContent ?? '');
    return sharedStrings[index] ?? '';
  }

  if (type === 'inlineStr') {
    const is = cell.getElementsByTagName('is')[0];
    if (!is) return '';
    return Array.from(is.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('');
  }

  if (type === 'b') {
    return cell.getElementsByTagName('v')[0]?.textContent === '1' ? 'TRUE' : 'FALSE';
  }

  // `e` is an error cell (#REF!, #N/A). Returning the error text would import
  // "#N/A" as a product name, so it reads as empty.
  if (type === 'e') return '';

  const raw = cell.getElementsByTagName('v')[0]?.textContent ?? '';
  if (!raw) return '';

  // `str` is a formula whose cached result is text.
  if (type === 'str') return raw;

  // ISO dates, written by some generators instead of a serial.
  if (type === 'd') return raw.slice(0, 10);

  const styleIndex = Number(cell.getAttribute('s') ?? '');
  if (Number.isFinite(styleIndex) && dateStyles.has(styleIndex)) {
    const serial = Number(raw);
    if (Number.isFinite(serial)) {
      const iso = serialToIso(serial, epoch1904);
      if (iso) return iso;
    }
  }

  return raw;
}

/**
 * Excel serial number → `YYYY-MM-DD`.
 *
 * The 1900 system counts from 1899-12-30 rather than 1900-01-01 because Excel
 * believes 1900 was a leap year. That deliberate off-by-one is why the constant
 * looks wrong and is correct; serials below 61 predate the phantom 29 February
 * and are refused rather than shifted, since a date that early in a product file
 * is a misread number, not a date.
 */
function serialToIso(serial: number, epoch1904: boolean): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  if (!epoch1904 && serial < 61) return null;

  const epoch = epoch1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const date = new Date(epoch + Math.round(serial) * 86_400_000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

function capRows(rows: string[][], notes: string[]): string[][] {
  if (rows.length <= MAX_ROWS) return rows;
  // Never silently. A truncated import that reports success is how a shop
  // discovers three thousand missing products a week later.
  notes.push(
    `Only the first ${MAX_ROWS.toLocaleString()} rows were read — ${(rows.length - MAX_ROWS).toLocaleString()} were left out. Split the file and import the rest separately.`,
  );
  return rows.slice(0, MAX_ROWS);
}

/**
 * Decide the header row and package the table.
 *
 * Header detection is deliberately its own function here rather than shared with
 * `tabular.ts`: that one judges lines it split itself, this one judges cells Excel
 * typed, and coupling them means tuning one silently retunes the other.
 */
function toTable(rows: string[][], label: string, notes: string[]): RawTable {
  const width = Math.max(...rows.map((r) => r.length), 0);
  const padded = rows.map((row) => {
    const copy = [...row];
    while (copy.length < width) copy.push('');
    return copy;
  });

  const hasHeaderRow = firstRowIsHeader(padded);
  if (!hasHeaderRow) {
    notes.push(`"${label}" has no header row, so Zeneva worked the columns out from the values.`);
  }

  return {
    headers: hasHeaderRow ? padded[0].map((h) => String(h ?? '').trim()) : [],
    rows: hasHeaderRow ? padded.slice(1) : padded,
    hasHeaderRow,
    label,
  };
}

/**
 * Whether row one names the columns.
 *
 * Same two signals as the paste reader: a recognised header word, or a text cell
 * sitting above a column of numbers. Duplicated deliberately rather than shared —
 * the paste reader works on lines it split itself and this one on cells Excel
 * typed, and coupling them means a change for one silently alters the other.
 */
function firstRowIsHeader(rows: string[][]): boolean {
  if (rows.length < 2) {
    // A single row could be either. Treat it as data: importing one product the
    // owner can rename beats discarding the only row in the file.
    return false;
  }

  const [first, ...rest] = rows;
  const numericish = (value: string) => /^\s*[₦$#]?\s*-?[\d.,]+\s*%?\s*$/.test(String(value ?? ''));

  // A header row is all text. One numeric cell in it and it is almost certainly
  // data — no export names a column `1200`.
  const firstRowNumeric = first.filter((v) => String(v ?? '').trim() && numericish(v)).length;
  if (firstRowNumeric > 0) return false;

  const sample = rest.slice(0, 12);
  const dataHasNumbers = sample.some((row) => row.some((v) => String(v ?? '').trim() && numericish(v)));
  const firstRowHasText = first.some((v) => String(v ?? '').trim().length > 0);

  return firstRowHasText && dataHasNumbers;
}
