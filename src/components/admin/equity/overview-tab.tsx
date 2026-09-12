'use client';

/**
 * Overview: the headline numbers, the ownership split, and the cap table.
 *
 * Deliberately answers the two questions in order — "what is the company worth
 * and who owns it" before "here is the full grid". A founder opening this page
 * usually wants the first and only sometimes the second.
 */

import * as React from 'react';
import { AlertTriangle, Coins, PieChart, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CapTableGrid, type OwnershipBasis } from './cap-table-grid';
import { DonutLegend, OwnershipDonut } from './equity-charts';
import { money, percent, pricePerShare as fmtPps, shares as fmtShares } from '@/lib/equity/format';
import type { CapTableSummary } from '@/lib/equity/types';

export function OverviewTab({ summary }: { summary: CapTableSummary }) {
  const [basis, setBasis] = React.useState<OwnershipBasis>('fullyDiluted');

  const donutData = React.useMemo(
    () =>
      summary.holders.map((h) => ({
        name: h.name,
        value: basis === 'outstanding' ? h.outstandingShares : h.fullyDilutedShares,
      })),
    [summary.holders, basis],
  );

  const largest = summary.holders[0];

  const tiles = [
    {
      label: 'Company valuation',
      value:
        summary.currentValuation === null
          ? 'Not set'
          : money(summary.currentValuation, summary.currency),
      hint:
        summary.currentValuation === null
          ? 'Set one on the Valuation tab — nothing can be priced without it'
          : summary.currentValuationMethod === 'founder_estimate'
            ? 'Your own estimate, not a tested market price'
            : `Based on ${(summary.currentValuationMethod ?? '').replace(/_/g, ' ')}`,
      icon: TrendingUp,
    },
    {
      label: 'Price per share',
      value:
        summary.pricePerShare === null
          ? '—'
          : fmtPps(summary.pricePerShare, summary.currency),
      hint:
        summary.pricePerShare === null
          ? 'Appears once a valuation is recorded'
          : `Valuation across ${fmtShares(summary.fullyDilutedShares)} fully diluted shares`,
      icon: Coins,
    },
    {
      label: 'Fully diluted shares',
      value: fmtShares(summary.fullyDilutedShares),
      hint:
        summary.outstandingShares === summary.fullyDilutedShares
          ? 'No options or convertibles outstanding'
          : `${fmtShares(summary.outstandingShares)} issued and outstanding`,
      icon: PieChart,
    },
    {
      label: 'Shareholders',
      value: String(summary.holders.length),
      hint: largest ? `Largest holds ${percent(largest.pctFullyDiluted)}` : 'No holders yet',
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      {summary.warnings.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Worth checking</p>
            <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
              {summary.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">{tile.label}</p>
                <p className="mt-1 text-2xl font-bold leading-none tabular-nums">{tile.value}</p>
              </div>
              <tile.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </div>
            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">{tile.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ownership</CardTitle>
            <CardDescription>
              {basis === 'outstanding' ? 'Issued and outstanding' : 'Fully diluted'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <OwnershipDonut
              data={donutData}
              centerValue={largest ? percent(basis === 'outstanding' ? largest.pctOutstanding : largest.pctFullyDiluted, 1) : undefined}
              centerLabel={largest ? largest.name : undefined}
            />
            <DonutLegend
              data={donutData}
              format={(value) =>
                percent(
                  (value /
                    (basis === 'outstanding'
                      ? summary.outstandingShares
                      : summary.fullyDilutedShares)) *
                    100,
                )
              }
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Share classes</CardTitle>
            <CardDescription>Authorised versus issued, by class</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.classes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No share classes defined yet.
              </p>
            ) : (
              summary.classes.map((c) => {
                const used = c.authorizedShares > 0 ? (c.issuedShares / c.authorizedShares) * 100 : 0;
                const over = c.availableShares < 0;
                return (
                  <div key={c.shareClassId} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {fmtShares(c.issuedShares)} / {fmtShares(c.authorizedShares)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={over ? 'h-full bg-destructive' : 'h-full bg-primary'}
                        style={{ width: `${Math.min(100, Math.max(0, used))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span className="capitalize">
                        {c.classType}
                        {c.classType === 'preferred' &&
                          ` · ${c.liquidationMultiple}x ${c.participating ? 'participating' : 'non-participating'}`}
                      </span>
                      <span>
                        {over
                          ? `${fmtShares(Math.abs(c.availableShares))} over-issued`
                          : `${fmtShares(c.availableShares)} available`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {summary.poolReserved > 0 && (
              <div className="space-y-1.5 border-t pt-4">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">Option pool</span>
                  <span className="tabular-nums text-muted-foreground">
                    {fmtShares(summary.poolReserved - summary.poolUnallocated)} /{' '}
                    {fmtShares(summary.poolReserved)} granted
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-[var(--viz-3)]"
                    style={{
                      width: `${Math.min(
                        100,
                        summary.poolReserved > 0
                          ? ((summary.poolReserved - summary.poolUnallocated) /
                              summary.poolReserved) *
                              100
                          : 0,
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {fmtShares(summary.poolUnallocated)} still available to grant
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cap table</CardTitle>
          <CardDescription>
            Every holder, as of {summary.asOf.toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CapTableGrid summary={summary} basis={basis} onBasisChange={setBasis} />
        </CardContent>
      </Card>
    </div>
  );
}
