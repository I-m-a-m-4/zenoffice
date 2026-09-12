/**
 * Getting a shop's data out of the Windows program they used before Zeneva.
 *
 * The situation this exists for: a business has years of stock in some legacy
 * desktop POS or accounting package that has no export, or whose export is a
 * report rather than a data file. Retyping it is not going to happen, so they stay
 * on the old software.
 *
 * ## What this actually does, and what it cannot
 *
 * Almost every one of those programs displays its products in a grid, and almost
 * every grid on Windows supports select-all and copy. So the capture loop is:
 *
 *   1. The owner switches to the old program and copies the visible grid.
 *   2. They switch back to Zeneva. **Regaining focus is the trigger** — Zeneva reads
 *      the clipboard by itself, parses it, merges it with the pages already taken,
 *      and updates the count.
 *   3. They page down and repeat. Nothing to press in Zeneva between pages.
 *
 * That automates every part of it except the copy gesture, and the reason the copy
 * gesture is left to a human is worth stating plainly rather than dressing up:
 * **reading another process's window, or sending it keystrokes, cannot be done from
 * a webview.** It needs native code — UI Automation and `SendInput` through the
 * Windows API, which means new Rust in `src-tauri` and a new capability. That is a
 * real path and `docs/desktop-import.md` describes it, but it is not what this
 * module is, and describing this as fully autonomous would be a lie the owner finds
 * out about in about four seconds.
 *
 * What is here works today, on every platform, with no native surface added, and it
 * turns a week of retyping into a few minutes of alt-tabbing.
 *
 * ## Clipboard reading is allowed to fail
 *
 * `navigator.clipboard.readText()` needs the document focused and, in a browser, a
 * permission the owner can refuse. Both failures are expected, not exceptional, so
 * every one of them falls through to a textarea the owner pastes into by hand —
 * which cannot fail and is the only path a locked-down browser will allow.
 */

import { parseTabular } from './tabular';
import type { RawTable } from './types';

/**
 * A capture in progress.
 *
 * Deliberately a plain object with functions rather than React state: the focus
 * handler that drives it fires outside React's control, and page accumulation has
 * to be correct even when two focus events arrive in the same tick.
 */
export type CaptureSession = {
  pages: CapturedPage[];
  /** Hashes of clipboard content already taken, so re-focusing does not re-ingest. */
  seen: Set<string>;
};

export type CapturedPage = {
  index: number;
  table: RawTable;
  rowCount: number;
};

export type IngestResult =
  | { status: 'added'; page: CapturedPage; totalRows: number }
  | { status: 'duplicate'; message: string }
  | { status: 'unusable'; message: string }
  | { status: 'empty'; message: string };

export function newSession(): CaptureSession {
  return { pages: [], seen: new Set() };
}

/**
 * A cheap content hash, for spotting a clipboard we have already taken.
 *
 * FNV-1a, not a cryptographic hash — the question is only "is this the same text I
 * just read", and it is asked on every window focus. Collisions would cost a
 * skipped page, so the length is mixed in as well, which makes an accidental
 * collision between two different grid pages effectively impossible.
 *
 * This matters more than it sounds: without it, alt-tabbing back and forth once
 * without copying anything new would ingest the same 143 rows a second time and
 * double every quantity on the page.
 */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}:${text.length}`;
}

/** Below this, whatever was copied is not a product grid. */
const MIN_USABLE_ROWS = 1;

/**
 * Offer the clipboard's contents to a session.
 *
 * Returns what happened rather than throwing, because every outcome here is
 * ordinary and each one needs its own sentence on screen: a page was taken, the
 * same page was copied twice, or what was copied is not a table.
 */
export function ingest(session: CaptureSession, text: string): IngestResult {
  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    return { status: 'empty', message: 'Nothing was copied. Select the product rows in the other program, then press Ctrl+C.' };
  }

  const hash = hashText(trimmed);
  if (session.seen.has(hash)) {
    return {
      status: 'duplicate',
      message: 'That is the same rows as last time — scroll to the next page in the other program and copy again.',
    };
  }

  const parsed = parseTabular(trimmed);
  if (!parsed || parsed.table.rows.length < MIN_USABLE_ROWS) {
    return {
      status: 'unusable',
      message: 'That did not look like a table of products. Try selecting just the grid rows rather than the whole window.',
    };
  }

  // A single-column result means the copy came out as one blob per line with no
  // delimiter — usually a report view rather than a grid. Worth taking (the names
  // alone are useful) but worth saying so, because the owner can often switch the
  // old program to a grid view and get everything.
  const single = parsed.via === 'single-column';

  // Mutating rather than returning a new session, on purpose. Two focus events in
  // one tick against an immutable copy means the second overwrites the first and a
  // page is silently lost.
  session.seen.add(hash);
  const page: CapturedPage = {
    index: session.pages.length + 1,
    table: { ...parsed.table, label: `page ${session.pages.length + 1}` },
    rowCount: parsed.table.rows.length,
  };
  session.pages.push(page);

  return {
    status: 'added',
    page,
    totalRows: session.pages.reduce((sum, p) => sum + p.rowCount, 0),
  };
}

/**
 * Read the clipboard, or say why not.
 *
 * Never throws. The three failure modes — no API, no permission, not focused — are
 * indistinguishable to the caller and all have the same remedy, which is the manual
 * paste box.
 */
export async function readClipboard(): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
    return { ok: false, reason: 'This browser will not let Zeneva read the clipboard. Paste into the box instead.' };
  }
  try {
    const text = await navigator.clipboard.readText();
    return { ok: true, text };
  } catch {
    return {
      ok: false,
      reason: 'Zeneva was not allowed to read the clipboard. Paste into the box below instead — it works the same way.',
    };
  }
}

/**
 * Whether the pages captured so far look like one consistent grid.
 *
 * Pages with different column counts mean the owner copied two different views —
 * a product list and then a sales report, say — and merging them produces nonsense
 * rows. Reported so the review screen can flag it rather than quietly interleaving
 * two schemas.
 */
export function pagesAgree(session: CaptureSession): boolean {
  if (session.pages.length < 2) return true;
  const width = (page: CapturedPage) =>
    Math.max(page.table.headers.length, ...page.table.rows.map((r) => r.length), 0);
  const first = width(session.pages[0]);
  return session.pages.every((page) => width(page) === first);
}

/**
 * Fold every captured page into one table.
 *
 * The header is taken from the **first** page that had one. Legacy grids repeat
 * their header on every copied page, so pages two onwards contribute a row that is
 * really a header — dropped here by matching it against the header already held,
 * because importing it creates a product called "Description".
 */
export function combine(session: CaptureSession): RawTable | null {
  if (session.pages.length === 0) return null;

  const withHeader = session.pages.find((page) => page.table.hasHeaderRow);
  const headers = withHeader ? withHeader.table.headers : [];
  const headerKey = headers.join('').toLowerCase();

  const rows: string[][] = [];
  for (const page of session.pages) {
    for (const row of page.table.rows) {
      if (headerKey && row.join('').toLowerCase() === headerKey) continue;
      rows.push(row);
    }
    // A page whose own header row was detected has already had it removed by the
    // parser; one that was not detected as having a header contributes it as a row,
    // which the check above catches.
  }

  return {
    headers,
    rows,
    hasHeaderRow: headers.length > 0,
    label: `${session.pages.length} captured page${session.pages.length === 1 ? '' : 's'}`,
  };
}

/**
 * Step-by-step wording, per platform.
 *
 * Only the desktop shell can realistically do this — there is no alt-tabbing to a
 * Windows program from a phone — so the mobile copy says so instead of offering
 * something that cannot work.
 */
export function captureInstructions(platform: 'windows' | 'mac' | 'other'): string[] {
  if (platform === 'mac') {
    return [
      'Open the other program next to Zeneva.',
      'Click its product list, then press Cmd+A to select it all and Cmd+C to copy.',
      'Click back on Zeneva — it will read the rows automatically.',
      'Scroll to the next page in the other program and copy again. Repeat until you have it all.',
    ];
  }
  if (platform === 'other') {
    return [
      'This works best on a computer, where you can switch between Zeneva and your old program.',
      'You can still paste data in from anywhere using the Paste option.',
    ];
  }
  return [
    'Open your old program next to Zeneva.',
    'Click its product list, then press Ctrl+A to select it all and Ctrl+C to copy.',
    'Click back on Zeneva — it will read the rows automatically.',
    'Page down in the old program and copy again. Repeat until every page is in.',
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct window reading (Windows desktop only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The automatic path: read the other program's grid without touching the clipboard.
 *
 * Backed by `src-tauri/src/win_grid.rs`, which asks Windows UI Automation for the grid
 * inside a window and reads its cells. When it works it replaces the whole
 * copy-alt-tab-repeat loop with one press — no paging, no clipboard permission, no
 * chance of missing a page.
 *
 * It does not always work, and the clipboard bridge above is why that is survivable.
 * An old application that draws its own grid with GDI exposes nothing to UIA, so this
 * returns no rows and the owner falls back. Both paths are offered rather than one
 * being chosen for them.
 *
 * Read-only by construction: the Rust side uses element discovery and the `Name`
 * property and nothing that can send input.
 */

export type DesktopWindow = { handle: number; title: string; minimized: boolean };

export type DesktopGrid = {
  headers: string[];
  rows: string[][];
  kind: string;
  truncated: boolean;
};

/** True when the automatic path could exist at all: the Windows desktop shell. */
export function canReadWindowsDirectly(): boolean {
  if (typeof window === 'undefined') return false;
  if (!(window as any).__TAURI_INTERNALS__) return false;
  return /Windows/i.test(navigator.userAgent) && !/android|iphone|ipad/i.test(navigator.userAgent);
}

/**
 * Open windows worth offering, most likely first.
 *
 * Zeneva's own windows are filtered out — offering to read ourselves is nonsense and
 * would succeed, producing a grid of our own product rows. Minimized windows are kept
 * but sorted last: UIA can usually still read one, and a shop that minimised the old
 * program to find Zeneva should not have to go and un-minimise it.
 */
export async function listDesktopWindows(): Promise<DesktopWindow[]> {
  const { invoke } = await import('@tauri-apps/api/core');
  const found = await invoke<DesktopWindow[]>('list_desktop_windows');
  return (found ?? [])
    .filter((w) => w.title && !/^zeneva\b/i.test(w.title.trim()))
    .sort((a, b) => Number(a.minimized) - Number(b.minimized) || a.title.localeCompare(b.title));
}

/** Read one window's grid into the shared `RawTable` shape. */
export async function readDesktopWindow(handle: number): Promise<{ table: RawTable; notes: string[] }> {
  const { invoke } = await import('@tauri-apps/api/core');
  const grid = await invoke<DesktopGrid>('read_desktop_grid', { handle });

  if (!grid?.rows?.length) {
    throw new Error('No product rows could be read from that window. Try the copy-and-paste method.');
  }

  /*
   * A single-cell row means UIA exposed the whole line as one string rather than as
   * cells — common for an old ListView. Handing those to the paste reader recovers the
   * columns with the same delimiter detection a pasted table gets, so the two paths
   * share one implementation rather than growing a second splitter here.
   */
  const singleColumn = grid.rows.every((row) => row.length <= 1);
  if (singleColumn) {
    const parsed = parseTabular(grid.rows.map((row) => row[0] ?? '').join('\n'));
    if (parsed && parsed.table.rows.length > 0) {
      return {
        table: { ...parsed.table, label: 'read from another program' },
        notes: [
          'That program exposed its rows as plain lines, so Zeneva split the columns itself — check them.',
        ],
      };
    }
  }

  const notes: string[] = [`Read ${grid.rows.length.toLocaleString()} rows straight from the other program.`];
  if (grid.truncated) {
    notes.push('Only the first 20,000 rows were read. Import these, then read the rest.');
  }

  const headers = (grid.headers ?? []).filter((h) => h && h.trim());
  return {
    table: {
      headers,
      rows: grid.rows,
      hasHeaderRow: headers.length > 0,
      label: 'read from another program',
    },
    notes,
  };
}
