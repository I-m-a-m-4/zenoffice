'use client';

/**
 * Value the company from what it actually earns.
 *
 * This card exists to answer one question the owner asked directly — "our total
 * revenue is ₦102,050, is that not our valuation?" — and the answer is no, so the
 * card is built to show *why* rather than just quietly compute something else.
 *
 * Cumulative revenue is a record of money that has already come in. A valuation
 * is a price on what the business will do next. The bridge between them is the
 * run rate: annualise the subscriptions that are live right now, apply a multiple
 * the market recognises, and add whatever cash has been raised. Every one of
 * those terms is rendered separately below, deliberately — a single total would
 * hide exactly the step that is easy to get wrong.
 *
 * The figures are read live from Zeneva's own `purchases` and `businessInstances`
 * collections, not typed in, so the valuation cannot quietly drift away from the
 * books. The read is lazy: Radix unmounts an inactive tab, so nothing is fetched
 * until the Valuation tab is opened, and the result is cached for the page's life.
 */

import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Info,
  Loader,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createEquityRecord } from '@/lib/equity/data';
import { DEFAULT_ARR_MULTIPLE, revenueValuation } from '@/lib/equity/engine';
import { useRevenueSnapshot } from '@/lib/equity/revenue';
import { money, pricePerShare as fmtPps, shares as fmtShares } from '@/lib/equity/format';
import type { CapTableSummary, EquityRecord } from '@/lib/equity/types';
import { TabSection } from './equity-dialogs';
import { Term } from './term';

/** Multiples worth one tap. Anchored on the conservative end on purpose. */
const QUICK_MULTIPLES = [3, 5, 8, 10];

export function RevenueValuationCard({
  records,
  summary,
  actorEmail,
}: {
  records: EquityRecord[];
  summary: CapTableSummary;
  actorEmail: string;
}) {
  const firestore = useFirestore();
  const { toast } = useToast();

  // `true` because this component only mounts when the Valuation tab is open.
  const { snapshot, isLoading, error, refresh } = useRevenueSnapshot(true, records);

  const [multiple, setMultiple] = React.useState(DEFAULT_ARR_MULTIPLE);
  const [isSaving, setIsSaving] = React.useState(false);

  const valuation = React.useMemo(
    () => (snapshot ? revenueValuation(snapshot, multiple, summary.fullyDilutedShares) : null),
    [snapshot, multiple, summary.fullyDilutedShares],
  );

  const currency = summary.currency;

  const record = async () => {
    if (!firestore || !valuation || valuation.valuation <= 0) return;
    setIsSaving(true);
    try {
      await createEquityRecord(
        firestore,
        {
          kind: 'valuation' as const,
          amount: valuation.valuation,
          asOfDate: new Date(),
          method: 'revenue_multiple' as const,
          basis: valuation.basis,
          floorPricePerShare: summary.floorPricePerShare ?? null,
          notes: 'Computed from live subscription revenue.',
        },
        actorEmail,
      );
      toast({
        variant: 'success',
        title: 'Valuation recorded',
        description: `${money(valuation.valuation, currency)} on a ${multiple}x revenue multiple.`,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Could not record it',
        description: e?.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TabSection
      title="Value it from what it earns"
      description="Zeneva's own subscription revenue, read live from the platform and priced the way an investor would price it."
      action={
        <Button variant="ghost" size="sm" className="gap-2" onClick={refresh} disabled={isLoading}>
          <RefreshCw className={isLoading ? 'size-3.5 animate-spin' : 'size-3.5'} />
          Refresh
        </Button>
      }
    >
      {/* The correction, stated before any number appears. The whole card is
          downstream of getting this one distinction right. */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="font-medium">Revenue collected is not a valuation.</p>
          <p className="leading-relaxed text-muted-foreground">
            What you have earned so far is a record of the past — money already banked or spent. A
            valuation is a price on what the business does next, so what gets priced is the{' '}
            <span className="font-medium text-foreground">run rate</span>: the subscriptions live
            right now, annualised, against a{' '}
            <Term k="revenue-multiple">multiple</Term>. Cash you have raised is added on top,
            because that is an asset the company holds. Every step of that is shown below.
          </p>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Could not read the revenue figures</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : isLoading || !snapshot || !valuation ? (
        <div className="flex items-center justify-center gap-3 rounded-xl border py-12 text-sm text-muted-foreground">
          <Loader className="size-4 animate-spin" />
          Reading the books…
        </div>
      ) : (
        <>
          {/* --- what the books say ----------------------------------------- */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <BookStat
              label="Collected to date"
              value={money(snapshot.lifetimeRevenue, currency)}
              note={`${snapshot.purchaseCount} ${
                snapshot.purchaseCount === 1 ? 'payment' : 'payments'
              } since launch`}
            />
            <BookStat
              label="Last 12 months"
              value={money(snapshot.trailingTwelveMonthRevenue, currency)}
              note="Trailing twelve months"
            />
            <BookStat
              label="Monthly recurring"
              value={money(snapshot.mrr, currency)}
              note={`${snapshot.activeSubscriptions} active ${
                snapshot.activeSubscriptions === 1 ? 'subscription' : 'subscriptions'
              } at list price`}
              emphasis
            />
            <BookStat
              label="Paying right now"
              value={String(snapshot.payingCustomers)}
              note={[
                `${snapshot.everPaidCustomers} have paid at some point`,
                snapshot.lifetimeAccounts > 0
                  ? `${snapshot.lifetimeAccounts} lifetime, paying nothing further`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          </div>

          {/* Anything that would make the figures above read as more precise
              than they are. Silence here is a claim, so it has to be earned. */}
          {(snapshot.internalPurchasesExcluded > 0 || snapshot.usdConverted) && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {snapshot.internalPurchasesExcluded > 0 && (
                <li>
                  Excludes {snapshot.internalPurchasesExcluded} test{' '}
                  {snapshot.internalPurchasesExcluded === 1 ? 'payment' : 'payments'} from the
                  company's own accounts ({money(snapshot.internalRevenueExcluded, currency)}). Your
                  own money is not revenue.
                </li>
              )}
              {snapshot.usdConverted && (
                <li>
                  Dollar subscriptions were converted at a fixed ₦1,500/$1. Move that rate and these
                  figures move with it.
                </li>
              )}
            </ul>
          )}

          {/* --- the arithmetic --------------------------------------------- */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" />
                How that becomes a valuation
              </CardTitle>
              <CardDescription>
                Adjust the multiple and every figure below follows. Nothing is saved until you
                record it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="arrMultiple">Multiple on ARR</Label>
                  <Input
                    id="arrMultiple"
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={multiple}
                    onChange={(e) => setMultiple(Math.max(0, Number(e.target.value) || 0))}
                    className="w-28"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pb-0.5">
                  {QUICK_MULTIPLES.map((m) => (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={multiple === m ? 'default' : 'outline'}
                      className={
                        multiple === m
                          ? 'h-9 px-3'
                          : 'h-9 px-3 hover:bg-muted hover:text-foreground'
                      }
                      onClick={() => setMultiple(m)}
                    >
                      {m}x
                    </Button>
                  ))}
                </div>
              </div>

              {/* The ladder. One row per operation, so the derivation is
                  readable rather than asserted. */}
              <div className="divide-y rounded-lg border">
                <Step
                  label="Monthly recurring revenue"
                  detail="What the live subscriptions bill every month"
                  value={money(snapshot.mrr, currency)}
                />
                <Step
                  label="× 12"
                  detail="Annual run rate (ARR) — the figure investors price on"
                  value={money(valuation.arr, currency)}
                />
                <Step
                  label={`× ${multiple} multiple`}
                  detail="What the operating business is worth on this method"
                  value={money(valuation.enterpriseValue, currency)}
                />
                <Step
                  label="+ capital raised"
                  detail={
                    valuation.capitalRaised > 0
                      ? 'Cash from closed rounds, held on the balance sheet'
                      : 'Nothing raised yet. Close a round and it lands here automatically.'
                  }
                  value={money(valuation.capitalRaised, currency)}
                  muted={valuation.capitalRaised <= 0}
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2 bg-muted/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Company valuation</p>
                    <p className="text-xs text-muted-foreground">
                      On a {multiple}x revenue multiple
                    </p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    {money(valuation.valuation, currency)}
                  </p>
                </div>
                <Step
                  label={`÷ ${fmtShares(summary.fullyDilutedShares)} shares`}
                  detail="Fully diluted — what one share is worth on this method"
                  value={
                    valuation.pricePerShare !== null
                      ? fmtPps(valuation.pricePerShare, currency)
                      : '—'
                  }
                />
              </div>

              {/* Sits under the ladder rather than beside it: the point is that
                  the same books support very different prices, and the multiple
                  is the argument you have to win. */}
              <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                <p className="font-medium">The same books at a different multiple</p>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  {QUICK_MULTIPLES.map((m) => {
                    const alt = revenueValuation(snapshot, m, summary.fullyDilutedShares);
                    return (
                      <div key={m} className="flex justify-between gap-2 tabular-nums">
                        <span>{m}x ARR</span>
                        <span className={m === multiple ? 'font-semibold text-foreground' : ''}>
                          {money(alt.valuation, currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 leading-snug">
                  Growth rate and retention are what move the multiple. Coming to an investor with
                  the reason you deserve the high end is the actual work.
                </p>
              </div>

              {valuation.warnings.map((w) => (
                <div
                  key={w}
                  className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs"
                >
                  <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
                  <span className="leading-relaxed">{w}</span>
                </div>
              ))}

              {/* A price someone actually paid beats a computed one, so say so
                  rather than letting this card silently override it. */}
              {summary.currentValuationMethod === 'priced_round' && (
                <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="leading-relaxed">
                    Your current valuation of{' '}
                    <span className="font-medium">
                      {money(summary.currentValuation ?? 0, currency)}
                    </span>{' '}
                    came from a priced round — someone paid it. That is stronger evidence than any
                    multiple, so treat this as a cross-check rather than a replacement.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <Button
                  onClick={record}
                  disabled={isSaving || valuation.valuation <= 0}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Record as the valuation
                </Button>
                {summary.currentValuation !== null && valuation.valuation > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Currently recorded:{' '}
                    <span className="font-medium text-foreground tabular-nums">
                      {money(summary.currentValuation, currency)}
                    </span>
                    <ArrowRight className="mx-1.5 inline size-3" />
                    <span className="font-medium text-foreground tabular-nums">
                      {money(valuation.valuation, currency)}
                    </span>
                  </p>
                )}
                {valuation.valuation <= 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nothing to record until there is recurring revenue or money raised.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <p className="text-[11px] text-muted-foreground">
            Read from Zeneva's own subscription payments as of{' '}
            {snapshot.asOf.toLocaleString()}. Recording a valuation adds a dated entry to the
            history below — it does not overwrite anything.
          </p>
        </>
      )}
    </TabSection>
  );
}

function BookStat({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {emphasis && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            priced
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{note}</p>
    </Card>
  );
}

function Step({
  label,
  detail,
  value,
  muted,
}: {
  label: string;
  detail: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] leading-snug text-muted-foreground">{detail}</p>
      </div>
      <p
        className={
          muted
            ? 'text-sm tabular-nums text-muted-foreground'
            : 'text-sm font-semibold tabular-nums'
        }
      >
        {value}
      </p>
    </div>
  );
}
