'use client';

/**
 * Valuation: what the company is worth, and what that makes one share worth.
 *
 * This tab exists because the rest of the page is meaningless without it. Share
 * counts net out fine with no valuation, but "what is 1% worth" and "what does
 * this cheque buy" have no answer until someone names a number.
 *
 * The method field is not bureaucracy. A founder estimate and a priced round are
 * both legitimate valuations, but only one of them has been tested by someone
 * actually paying it, and the page should never present them as equivalent.
 */

import * as React from 'react';
import * as z from 'zod';
import { Calculator, Info, Pencil, Plus, Scale, Trash2, TrendingUp } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createEquityRecord,
  deleteEquityRecord,
  updateEquityRecord,
} from '@/lib/equity/data';
import { investmentOffer, toDate, valuationForStake } from '@/lib/equity/engine';
import { money, percent, pricePerShare as fmtPps, shares as fmtShares } from '@/lib/equity/format';
import { isKind } from '@/lib/equity/types';
import type { CapTableSummary, EquityRecord, Valuation, ValuationMethod } from '@/lib/equity/types';
import {
  DeleteConfirmDialog,
  EmptyState,
  EquityFormDialog,
  TabSection,
  fromDateInput,
  toDateInput,
  type FieldDef,
} from './equity-dialogs';
import { RevenueValuationCard } from './revenue-valuation-card';
import { Term } from './term';

const METHOD_LABELS: Record<ValuationMethod, string> = {
  priced_round: 'Priced round',
  revenue_multiple: 'Revenue multiple',
  comparable: 'Comparable companies',
  dcf: 'Discounted cash flow',
  founder_estimate: 'Founder estimate',
};

const valuationSchema = z.object({
  amount: z.coerce.number().positive('Enter a valuation above zero.'),
  asOfDate: z.string().min(1, 'Enter a date.'),
  method: z.enum(['priced_round', 'revenue_multiple', 'comparable', 'dcf', 'founder_estimate']),
  basis: z.string().optional(),
  floorPricePerShare: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

export function ValuationTab({
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

  const [isCreating, setIsCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Valuation | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Valuation | null>(null);

  const valuations = React.useMemo(
    () =>
      records
        .filter(isKind('valuation'))
        .sort((a, b) => (toDate(b.asOfDate)?.getTime() ?? 0) - (toDate(a.asOfDate)?.getTime() ?? 0)),
    [records],
  );

  const fields: FieldDef[] = [
    {
      name: 'amount',
      label: `Company valuation (${summary.currency})`,
      type: 'number',
      min: 0,
      step: '100000',
      description: 'Pre-money — what the business is worth before any new money comes in.',
      full: true,
    },
    { name: 'asOfDate', label: 'As of', type: 'date' },
    {
      name: 'method',
      label: 'How you arrived at it',
      type: 'select',
      options: (Object.keys(METHOD_LABELS) as ValuationMethod[]).map((m) => ({
        value: m,
        label: METHOD_LABELS[m],
      })),
    },
    {
      name: 'basis',
      label: 'Working',
      type: 'textarea',
      placeholder: 'e.g. ₦20M ARR at a 6x multiple — comparable African SaaS trading at 5-8x',
      description:
        'The numbers behind the figure. In six months this is the only thing that will let you defend or revisit it.',
      full: true,
    },
    {
      name: 'floorPricePerShare',
      label: `Floor price per share (${summary.currency})`,
      type: 'number',
      min: 0,
      step: '0.01',
      description: 'Optional. The calculator warns when an offer prices shares below this.',
    },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  const save = async (values: z.infer<typeof valuationSchema>) => {
    if (!firestore) return;
    try {
      const payload = {
        kind: 'valuation' as const,
        amount: values.amount,
        asOfDate: fromDateInput(values.asOfDate),
        method: values.method,
        basis: values.basis || '',
        floorPricePerShare: values.floorPricePerShare ? values.floorPricePerShare : null,
        notes: values.notes || '',
      };
      if (editing) {
        await updateEquityRecord(firestore, editing.id, payload, actorEmail, editing as any);
        toast({ variant: 'success', title: 'Valuation updated' });
      } else {
        await createEquityRecord(firestore, payload, actorEmail);
        toast({ variant: 'success', title: 'Valuation recorded' });
      }
      setIsCreating(false);
      setEditing(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not save',
        description: error?.message || 'An unexpected error occurred.',
      });
    }
  };

  const remove = async () => {
    if (!firestore || !pendingDelete) return;
    try {
      await deleteEquityRecord(firestore, pendingDelete.id, pendingDelete as any, actorEmail);
      toast({ variant: 'success', title: 'Valuation deleted' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not delete',
        description: error?.message || 'An unexpected error occurred.',
      });
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-8">
      <TabSection
        title="What the company is worth"
        description="Sets the share price, and therefore what any investment buys."
        action={
          <Button onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="size-4" />
            Set valuation
          </Button>
        }
      >
        {summary.currentValuation === null ? (
          <EmptyState
            icon={Scale}
            title="No valuation set"
            description="Until you record what the company is worth, there is no share price — so nothing on this page can tell you what an investment would buy. If Zeneva has subscription revenue, the card below works one out from the live figures; otherwise set your own estimate."
            action={
              <Button onClick={() => setIsCreating(true)} className="gap-2">
                <Plus className="size-4" />
                Set valuation
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Company valuation</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {money(summary.currentValuation, summary.currency)}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {summary.currentValuationMethod
                  ? METHOD_LABELS[summary.currentValuationMethod]
                  : 'Method not stated'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">
                <Term k="price-per-share">Price per share</Term>
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {summary.pricePerShare ? fmtPps(summary.pricePerShare, summary.currency) : '—'}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Across {fmtShares(summary.fullyDilutedShares)} fully diluted shares
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Your stake is worth</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {summary.holders[0] && summary.pricePerShare
                  ? money(
                      summary.holders[0].fullyDilutedShares * summary.pricePerShare,
                      summary.currency,
                    )
                  : '—'}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {summary.holders[0]
                  ? `${summary.holders[0].name} — ${percent(summary.holders[0].pctFullyDiluted)}`
                  : 'No holders yet'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">1% of the company</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {money(summary.currentValuation / 100, summary.currency)}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                What a single percentage point costs
              </p>
            </Card>
          </div>
        )}

        {summary.currentValuationBasis && (
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-xs font-medium">How this number was reached</p>
            <p className="mt-1 text-sm text-muted-foreground">{summary.currentValuationBasis}</p>
          </div>
        )}

        {summary.currentValuationMethod === 'founder_estimate' && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <p>
              This is your own estimate rather than a price anyone has paid. That is a perfectly
              normal starting point and it is fine for planning — but an investor will push back on
              it, so be ready to show your working.
            </p>
          </div>
        )}

        {valuations.length > 0 && (
          <div className="w-full overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[110px]">As of</TableHead>
                  <TableHead className="min-w-[140px] text-right">Valuation</TableHead>
                  <TableHead className="min-w-[150px]">Method</TableHead>
                  <TableHead className="min-w-[120px] text-right">Per share</TableHead>
                  <TableHead className="min-w-[200px]">Basis</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {valuations.map((v, i) => (
                  <TableRow key={v.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {toDate(v.asOfDate)?.toLocaleDateString() ?? '—'}
                      {i === 0 && (
                        <Badge variant="secondary" className="ml-2">
                          Current
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(v.amount, summary.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{METHOD_LABELS[v.method]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {summary.fullyDilutedShares > 0
                        ? fmtPps(v.amount / summary.fullyDilutedShares, summary.currency)
                        : '—'}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">
                      {v.basis || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setEditing(v)}
                          aria-label="Edit valuation"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(v)}
                          aria-label="Delete valuation"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabSection>

      {/* Sits above the calculator because it is what produces a valuation,
          and the calculator is what spends one. */}
      <RevenueValuationCard records={records} summary={summary} actorEmail={actorEmail} />

      <InvestmentCalculator summary={summary} />

      <EquityFormDialog
        open={isCreating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditing(null);
          }
        }}
        title={editing ? 'Edit valuation' : 'Set company valuation'}
        description="There is no formula that returns a company's true worth. Record how you reached the number, and it stays defensible."
        schema={valuationSchema}
        fields={fields}
        defaultValues={
          editing
            ? {
                amount: editing.amount,
                asOfDate: toDateInput(editing.asOfDate),
                method: editing.method,
                basis: editing.basis ?? '',
                floorPricePerShare: editing.floorPricePerShare ?? 0,
                notes: editing.notes ?? '',
              }
            : {
                amount: 0,
                asOfDate: new Date().toISOString().slice(0, 10),
                method: 'founder_estimate' as const,
                basis: '',
                floorPricePerShare: 0,
                notes: '',
              }
        }
        onSubmit={save}
        submitLabel={editing ? 'Save changes' : 'Set valuation'}
      />

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this valuation?"
        description="If it is the current one, the share price reverts to the next most recent valuation or the last priced round."
        onConfirm={remove}
      />
    </div>
  );
}

/**
 * "Someone offers me X — what do they get?"
 *
 * The question the owner actually asks, and the one the rest of the page could
 * not answer. Deliberately shows the same cheque against two valuations at once,
 * because the lesson only lands when you see it side by side.
 */
function InvestmentCalculator({ summary }: { summary: CapTableSummary }) {
  const [amount, setAmount] = React.useState(100_000);
  const [valuation, setValuation] = React.useState<number>(() => summary.currentValuation ?? 0);
  const [targetPct, setTargetPct] = React.useState(10);

  const offer = React.useMemo(
    () => investmentOffer(summary, amount, valuation || null),
    [summary, amount, valuation],
  );

  const impliedValuation = React.useMemo(
    () => valuationForStake(amount, targetPct),
    [amount, targetPct],
  );

  return (
    <TabSection
      title="What would an investment buy?"
      description="Work out what a cheque gets before you agree to anything."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="size-4 text-primary" />
              The offer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="offerAmount">Investment ({summary.currency})</Label>
              <Input
                id="offerAmount"
                type="number"
                min={0}
                step={10_000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offerValuation">
                At a <Term k="pre-money">pre-money</Term> valuation of
              </Label>
              <Input
                id="offerValuation"
                type="number"
                min={0}
                step={1_000_000}
                value={valuation}
                onChange={(e) => setValuation(Number(e.target.value) || 0)}
              />
              {summary.currentValuation !== null && valuation !== summary.currentValuation && (
                <button
                  type="button"
                  onClick={() => setValuation(summary.currentValuation!)}
                  className="text-[11px] text-primary hover:underline"
                >
                  Reset to your current valuation
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What they get</CardTitle>
            {offer && (
              <CardDescription>
                {money(offer.amount, summary.currency)} at{' '}
                {money(offer.valuation, summary.currency)} pre-money
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!offer ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Set a valuation above to price an investment.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat
                    label="They get"
                    value={percent(offer.investorPct)}
                    emphasis={offer.investorPct >= 20}
                  />
                  <Stat label="Shares issued" value={fmtShares(offer.sharesIssued)} />
                  <Stat
                    label="Price per share"
                    value={fmtPps(offer.pricePerShare, summary.currency)}
                  />
                  <Stat label="You drop to" value={percent(offer.founderPctAfter)} />
                </div>

                {offer.warnings.map((w) => (
                  <div
                    key={w}
                    className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs"
                  >
                    <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
                    <span>{w}</span>
                  </div>
                ))}

                {/* The comparison that makes the point. Same cheque, valuation
                    doubled — the stake roughly halves. */}
                <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                  <p className="font-medium">The same cheque at a different valuation</p>
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    {[0.5, 1, 2, 5].map((mult) => {
                      const alt = investmentOffer(summary, amount, offer.valuation * mult);
                      if (!alt) return null;
                      return (
                        <div key={mult} className="flex justify-between gap-2 tabular-nums">
                          <span>{money(alt.valuation, summary.currency)} valuation</span>
                          <span className={mult === 1 ? 'font-semibold text-foreground' : ''}>
                            {percent(alt.investorPct)} of the company
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 leading-snug">
                    Same money, very different outcomes. The valuation is the whole negotiation.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-primary" />
            Working backwards
          </CardTitle>
          <CardDescription>
            Start from the stake you are willing to give up, and see what valuation that needs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="targetPct">Willing to sell (%)</Label>
              <Input
                id="targetPct"
                type="number"
                min={0.1}
                max={99}
                step={0.5}
                value={targetPct}
                onChange={(e) => setTargetPct(Number(e.target.value) || 0)}
                className="w-32"
              />
            </div>
            <div className="min-w-0 flex-1">
              {impliedValuation === null ? (
                <p className="text-sm text-muted-foreground">
                  Enter a percentage between 0 and 100.
                </p>
              ) : (
                <p className="text-sm">
                  To raise{' '}
                  <span className="font-semibold">{money(amount, summary.currency)}</span> for{' '}
                  <span className="font-semibold">{percent(targetPct)}</span>, you need a pre-money
                  valuation of{' '}
                  <span className="font-semibold tabular-nums">
                    {money(impliedValuation, summary.currency)}
                  </span>
                  .{' '}
                  <span className="text-muted-foreground">
                    Whether you can defend that number is the real question.
                  </span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TabSection>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          emphasis
            ? 'mt-0.5 text-lg font-bold tabular-nums text-destructive'
            : 'mt-0.5 text-lg font-bold tabular-nums'
        }
      >
        {value}
      </p>
    </div>
  );
}
