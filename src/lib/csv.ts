/**
 * CSV export, lifted from the inline recipe in
 * `src/components/admin/equity/cap-table-grid.tsx` so more than one screen can
 * use it. The two details that matter and are easy to get wrong:
 *
 * - Every cell is quoted and embedded quotes are doubled. A business named
 *   `Acme, Inc. "Holdings"` otherwise splits into three columns.
 * - The blob is prefixed with a UTF-8 BOM. Without it Excel reads the file as
 *   the local ANSI codepage and mangles every non-ASCII name.
 */

export type CsvCell = string | number | boolean | null | undefined;

/** Serialise rows to an RFC-4180-ish CSV string (no BOM, no download). */
export function toCsv(rows: CsvCell[][]): string {
    return rows
        .map(row =>
            row
                .map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`)
                .join(','),
        )
        .join('\r\n');
}

/**
 * Serialise and hand the browser a download.
 *
 * `filename` should already carry its `.csv` extension. No-ops outside the
 * browser so a server render never touches `document`.
 */
export function downloadCsv(filename: string, rows: CsvCell[][]): void {
    if (typeof document === 'undefined') return;

    const blob = new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
