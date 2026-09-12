'use client';

/**
 * The cap table itself: one row per holder, with a per-class breakdown.
 *
 * The basis toggle is the important control here. "Outstanding" counts only
 * issued shares; "fully diluted" also counts options, the unallocated pool and
 * unconverted SAFEs. The same holder is a different percentage under each, and
 * conflating them is how founders end up quoting a number an investor disputes.
 * Both are shown, and the active basis is stated rather than implied.
 */

import * as React from 'react';
import { ArrowUpDown, Crown, Download } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { investedLabel, money, percent, shares as fmtShares } from '@/lib/equity/format';
import type { CapTableSummary, HolderRow } from '@/lib/equity/types';

export type OwnershipBasis = 'outstanding' | 'fullyDiluted';

type SortKey = 'name' | 'shares' | 'pct' | 'invested';

export function CapTableGrid({
  summary,
  basis,
  onBasisChange,
}: {
  summary: CapTableSummary;
  basis: OwnershipBasis;
  onBasisChange: (basis: OwnershipBasis) => void;
}) {
  const [sortKey, setSortKey] = React.useState<SortKey>('pct');
  const [ascending, setAscending] = React.useState(false);

  const sharesFor = React.useCallback(
    (h: HolderRow) => (basis === 'outstanding' ? h.outstandingShares : h.fullyDilutedShares),
    [basis],
  );
  const pctFor = React.useCallback(
    (h: HolderRow) => (basis === 'outstanding' ? h.pctOutstanding : h.pctFullyDiluted),
    [basis],
  );

  const rows = React.useMemo(() => {
    const sorted = [...summary.holders].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'shares':
          return sharesFor(a) - sharesFor(b);
        case 'invested':
          return a.invested - b.invested;
        case 'pct':
        default:
          return pctFor(a) - pctFor(b);
      }
    });
    return ascending ? sorted : sorted.reverse();
  }, [summary.holders, sortKey, ascending, sharesFor, pctFor]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setAscending((prev) => !prev);
      return;
    }
    setSortKey(key);
    // Names read naturally A-Z; numbers read naturally largest-first.
    setAscending(key === 'name');
  };

  const denominator =
    basis === 'outstanding' ? summary.outstandingShares : summary.fullyDilutedShares;

  const exportCsv = () => {
    const header = [
      'Holder',
      'Type',
      'Founder',
      ...summary.classes.map((c) => `${c.name} shares`),
      'Outstanding shares',
      'Options',
      'Convertibles (est.)',
      'Fully diluted shares',
      `Invested (${summary.currency})`,
      'Consideration',
      '% outstanding',
      '% fully diluted',
      '% votes',
    ];

    const lines = summary.holders.map((h) => [
      h.name,
      h.entityType,
      h.isFounder ? 'yes' : 'no',
      ...summary.classes.map(
        (c) => h.positions.find((p) => p.shareClassId === c.shareClassId)?.shares ?? 0,
      ),
      h.outstandingShares,
      h.optionShares,
      h.convertibleShares,
      h.fullyDilutedShares,
      Math.round(h.invested),
      // Without this column a zero in Invested is indistinguishable from a blank
      // one once the file leaves the app.
      h.nonCashConsiderations.length > 0
        ? h.nonCashConsiderations.join(' + ')
        : h.invested > 0
          ? 'cash'
          : '',
      h.pctOutstanding.toFixed(4),
      h.pctFullyDiluted.toFixed(4),
      h.pctVotes.toFixed(4),
    ]);

    const csv = [header, ...lines]
      // Quote every cell and double any embedded quote — a holder named
      // `Acme, Inc. "Holdings"` would otherwise split into three columns.
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const stamp = summary.asOf.toISOString().slice(0, 10);
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zeneva-cap-table-${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!summary.holders.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
        <h3 className="text-lg font-medium">No shares issued yet</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Add a stakeholder and issue them shares, and the cap table will build itself from there.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-card p-1">
            {(
              [
                { key: 'outstanding', label: 'Outstanding' },
                { key: 'fullyDiluted', label: 'Fully diluted' },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onBasisChange(option.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  basis === option.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {fmtShares(denominator)} shares
          </span>
        </div>

        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">
                <SortButton label="Holder" active={sortKey === 'name'} onClick={() => toggleSort('name')} />
              </TableHead>
              {summary.classes.map((c) => (
                <TableHead key={c.shareClassId} className="min-w-[110px] text-right">
                  {c.name}
                </TableHead>
              ))}
              <TableHead className="min-w-[100px] text-right">Options</TableHead>
              {summary.convertiblesAsConverted > 0 && (
                <TableHead className="min-w-[120px] text-right">
                  Convertibles
                  <span className="ml-1 font-normal text-muted-foreground">(est.)</span>
                </TableHead>
              )}
              <TableHead className="min-w-[120px] text-right">
                <SortButton
                  label="Total"
                  active={sortKey === 'shares'}
                  onClick={() => toggleSort('shares')}
                  align="right"
                />
              </TableHead>
              <TableHead className="min-w-[120px] text-right">
                <SortButton
                  label="Invested"
                  active={sortKey === 'invested'}
                  onClick={() => toggleSort('invested')}
                  align="right"
                />
              </TableHead>
              <TableHead className="min-w-[110px] text-right">
                <SortButton
                  label="Ownership"
                  active={sortKey === 'pct'}
                  onClick={() => toggleSort('pct')}
                  align="right"
                />
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((h) => (
              <TableRow key={h.stakeholderId}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{h.name}</span>
                    {h.isFounder && (
                      <Crown className="size-3.5 shrink-0 text-amber-500" aria-label="Founder" />
                    )}
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{h.entityType}</span>
                </TableCell>

                {summary.classes.map((c) => {
                  const position = h.positions.find((p) => p.shareClassId === c.shareClassId);
                  return (
                    <TableCell key={c.shareClassId} className="text-right tabular-nums">
                      {position ? fmtShares(position.shares) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  );
                })}

                <TableCell className="text-right tabular-nums">
                  {h.optionShares ? fmtShares(h.optionShares) : <span className="text-muted-foreground">—</span>}
                </TableCell>

                {summary.convertiblesAsConverted > 0 && (
                  <TableCell className="text-right tabular-nums">
                    {h.convertibleShares ? (
                      fmtShares(h.convertibleShares)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}

                <TableCell className="text-right font-medium tabular-nums">
                  {fmtShares(sharesFor(h))}
                </TableCell>

                <TableCell className="text-right tabular-nums">
                  {h.invested > 0 ? (
                    money(h.invested, summary.currency)
                  ) : (
                    /* An empty cell here means no cash was ever paid, which for a
                       founder who built the product is the correct answer — not
                       missing data. Saying which non-cash consideration it was
                       stops the dash reading as a gap, and stops par value
                       reading as an investment that was never made. */
                    <span className="text-muted-foreground">
                      {investedLabel(h.invested, h.nonCashConsiderations, summary.currency)}
                    </span>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <Badge variant="secondary" className="font-semibold tabular-nums">
                    {percent(pctFor(h))}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}

            {/* Totals. The percentage column must read 100.00% — if it does not,
                the engine has a rounding bug and this row is where it shows. */}
            <TableRow className="border-t-2 bg-muted/40 font-semibold hover:bg-muted/40">
              <TableCell>Total</TableCell>
              {summary.classes.map((c) => (
                <TableCell key={c.shareClassId} className="text-right tabular-nums">
                  {fmtShares(c.issuedShares)}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">
                {fmtShares(summary.optionsOutstanding)}
              </TableCell>
              {summary.convertiblesAsConverted > 0 && (
                <TableCell className="text-right tabular-nums">
                  {fmtShares(summary.convertiblesAsConverted)}
                </TableCell>
              )}
              <TableCell className="text-right tabular-nums">{fmtShares(denominator)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {summary.totalInvested > 0 ? (
                  money(summary.totalInvested, summary.currency)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {percent(rows.reduce((sum, h) => sum + pctFor(h), 0))}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {basis === 'fullyDiluted' && summary.poolUnallocated > 0 && (
        <p className="text-xs text-muted-foreground">
          Fully diluted includes {fmtShares(summary.poolUnallocated)} unallocated option pool shares,
          which belong to no holder yet and so appear only in the total.
        </p>
      )}

      {/* Stated once here rather than as a tooltip on every row. Without it a
          bootstrapped cap table looks like one where somebody forgot to enter
          the money — and the alternative, showing par value as if it were an
          investment, is worse: it invents a cash contribution and, in the exit
          waterfall, a liquidation preference nobody paid for. */}
      {summary.holders.some((h) => h.nonCashConsiderations.length > 0) && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Invested</span> is cash actually paid into the company.
          Shares issued for IP or for services show what they were issued for instead of a figure —
          those shares are assigned at par value so the certificate has a price, but no money
          changed hands, and counting par value as investment would overstate both what was put in
          and what gets paid back first on an exit.
        </p>
      )}
    </div>
  );
}

function SortButton({
  label,
  active,
  onClick,
  align = 'left',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground',
        active ? 'text-foreground' : 'text-muted-foreground',
        align === 'right' && 'ml-auto',
      )}
    >
      {label}
      <ArrowUpDown className="size-3" aria-hidden />
    </button>
  );
}
