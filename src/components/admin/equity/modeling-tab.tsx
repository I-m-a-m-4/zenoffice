'use client';

/**
 * Modeling: what a round costs you, and what an exit pays you.
 *
 * Both calculators are read-only. Nothing here writes to Firestore, so an owner
 * can push numbers around freely without worrying about corrupting the record —
 * which is the point, because the useful thing to do with a term sheet is try it
 * ten different ways before agreeing to it.
 */

import * as React from 'react';
import { Calculator, Info, TrendingDown, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { exitWaterfall, modelRound } from '@/lib/equity/engine';
import {
  money,
  multiple as fmtMultiple,
  percent,
  percentDelta,
  shares as fmtShares,
} from '@/lib/equity/format';
import type { CapTableSummary, EquityRecord } from '@/lib/equity/types';
import { TabSection } from './equity-dialogs';

export function ModelingTab({
  records,
  summary,
}: {
  records: EquityRecord[];
  summary: CapTableSummary;
}) {
  return (
    <div className="space-y-8">
      <RoundSimulator records={records} summary={summary} />
      <WaterfallCalculator records={records} summary={summary} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function RoundSimulator({
  records,
  summary,
}: {
  records: EquityRecord[];
  summary: CapTableSummary;
}) {
  // Seeded off the current company so the first render shows something plausible
  // rather than zeroes.
  const [preMoney, setPreMoney] = React.useState(() =>
    summary.impliedValuation ? Math.round(summary.impliedValuation * 2) : 100_000_000,
  );
  const [raised, setRaised] = React.useState(() =>
    summary.impliedValuation ? Math.round(summary.impliedValuation * 0.5) : 25_000_000,
  );
  const [poolPercent, setPoolPercent] = React.useState(0);

  const model = React.useMemo(
    () =>
      modelRound(
        records,
        {
          preMoneyValuation: preMoney,
          amountRaised: raised,
          targetPoolPercent: poolPercent || undefined,
        },
        summary.asOf,
      ),
    [records, preMoney, raised, poolPercent, summary.asOf],
  );

  return (
    <TabSection
      title="Round simulator"
      description="What a raise does to everyone's percentage, before you sign the term sheet."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="size-4 text-primary" />
              Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="preMoney">Pre-money valuation ({summary.currency})</Label>
              <Input
                id="preMoney"
                type="number"
                min={0}
                step={1_000_000}
                value={preMoney}
                onChange={(e) => setPreMoney(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="raised">Amount raised ({summary.currency})</Label>
              <Input
                id="raised"
                type="number"
                min={0}
                step={1_000_000}
                value={raised}
                onChange={(e) => setRaised(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pool">Option pool target (% post-money)</Label>
              <Input
                id="pool"
                type="number"
                min={0}
                max={50}
                step={1}
                value={poolPercent}
                onChange={(e) => setPoolPercent(Number(e.target.value) || 0)}
              />
              <p className="text-[11px] leading-snug text-muted-foreground">
                A pool created as part of the round comes out of the pre-money, so existing holders
                absorb it — not the new investor. Set 0 to skip.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Result</CardTitle>
            <CardDescription>
              Post-money {money(model.postMoneyValuation, summary.currency)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Price per share"
                value={money(model.pricePerShare, summary.currency, { maximumFractionDigits: 4 })}
              />
              <Stat label="New shares" value={fmtShares(model.newShares)} />
              <Stat label="Investor stake" value={percent(model.investorPct)} />
              <Stat label="Post-money FD" value={fmtShares(model.postMoneyFullyDiluted)} />
            </div>

            {(model.poolTopUpShares > 0 || model.convertedShares > 0) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {model.poolTopUpShares > 0 && (
                  <Badge variant="outline">
                    Pool top-up: {fmtShares(model.poolTopUpShares)} shares
                  </Badge>
                )}
                {model.convertedShares > 0 && (
                  <Badge variant="outline">
                    SAFEs convert into {fmtShares(model.convertedShares)} shares
                  </Badge>
                )}
              </div>
            )}

            {model.warnings.map((w) => (
              <div
                key={w}
                className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs"
              >
                <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
                <span>{w}</span>
              </div>
            ))}

            {model.holders.length > 0 && (
              <div className="w-full overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Holder</TableHead>
                      <TableHead className="min-w-[100px] text-right">Before</TableHead>
                      <TableHead className="min-w-[100px] text-right">After</TableHead>
                      <TableHead className="min-w-[100px] text-right">Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.holders.map((h) => (
                      <TableRow key={h.stakeholderId}>
                        <TableCell className="font-medium">{h.name}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {percent(h.pctBefore)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {percent(h.pctAfter)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              h.delta < -0.005
                                ? 'tabular-nums text-destructive'
                                : 'tabular-nums text-muted-foreground'
                            }
                          >
                            {percentDelta(h.delta)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-muted/40 font-semibold hover:bg-muted/40">
                      <TableCell>New investor</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        —
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {percent(model.investorPct)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-[var(--viz-3)]">
                        {percentDelta(model.investorPct)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TabSection>
  );
}

// ---------------------------------------------------------------------------

function WaterfallCalculator({
  records,
  summary,
}: {
  records: EquityRecord[];
  summary: CapTableSummary;
}) {
  const [exitValue, setExitValue] = React.useState(() =>
    summary.impliedValuation ? Math.round(summary.impliedValuation * 5) : 500_000_000,
  );

  const result = React.useMemo(
    () => exitWaterfall(records, exitValue, summary.asOf),
    [records, exitValue, summary.asOf],
  );

  const hasPreferred = summary.classes.some((c) => c.classType === 'preferred');

  return (
    <TabSection
      title="Exit waterfall"
      description="Who gets what if the company sells, after liquidation preferences."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" />
              Exit price
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="exitValue">Sale price ({summary.currency})</Label>
              <Input
                id="exitValue"
                type="number"
                min={0}
                step={10_000_000}
                value={exitValue}
                onChange={(e) => setExitValue(Number(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2 border-t pt-4 text-sm">
              <Row
                label="Liquidation preferences"
                value={money(result.totalPreferences, summary.currency)}
              />
              <Row label="Residual to common" value={money(result.residual, summary.currency)} />
              {result.optionExerciseProceeds > 0 && (
                <Row
                  label="Option strike paid in"
                  value={money(result.optionExerciseProceeds, summary.currency)}
                />
              )}
            </div>

            {result.convertedClassIds.length > 0 && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                <p className="font-medium">Converted to common</p>
                <p className="mt-1 text-muted-foreground">
                  {result.convertedClassIds
                    .map(
                      (id) =>
                        summary.classes.find((c) => c.shareClassId === id)?.name ?? 'A class',
                    )
                    .join(', ')}{' '}
                  — converting pays more than taking the preference at this price.
                </p>
              </div>
            )}

            {!hasPreferred && (
              <p className="text-[11px] leading-snug text-muted-foreground">
                With only common stock, proceeds split strictly pro rata. Preferences start
                mattering once you raise a priced round.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribution</CardTitle>
            <CardDescription>
              {money(exitValue, summary.currency)} exit
              {result.didNotConverge && ' — indicative, the model did not settle'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.warnings.map((w) => (
              <div
                key={w}
                className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs"
              >
                <TrendingDown className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
                <span>{w}</span>
              </div>
            ))}

            {result.payouts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Issue some shares to model an exit.
              </p>
            ) : (
              <div className="w-full overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Holder</TableHead>
                      <TableHead className="min-w-[120px] text-right">Preference</TableHead>
                      <TableHead className="min-w-[120px] text-right">Residual</TableHead>
                      <TableHead className="min-w-[130px] text-right">Total</TableHead>
                      <TableHead className="min-w-[90px] text-right">% of exit</TableHead>
                      <TableHead className="min-w-[80px] text-right">Return</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.payouts.map((p) => (
                      <TableRow key={p.stakeholderId}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {p.preference > 0 ? money(p.preference, summary.currency) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {p.participation + p.optionProceeds > 0
                            ? money(p.participation + p.optionProceeds, summary.currency)
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {money(p.total, summary.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {percent(p.pctOfExit)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {fmtMultiple(p.multiple)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="text-[11px] leading-snug text-muted-foreground">
              Vested options with a strike below the exit price are treated as exercised, and the
              strike they pay is added to the distributable proceeds. Unvested options are
              excluded.
            </p>
          </CardContent>
        </Card>
      </div>
    </TabSection>
  );
}

// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
