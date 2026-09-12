'use client';

/**
 * Rounds and share classes.
 *
 * These live together because a priced round almost always creates a class: the
 * Series A investors buy Series A Preferred, with its own liquidation preference
 * and seniority. Separating them into two tabs would mean defining a class in one
 * place and immediately switching to record the round that needed it.
 *
 * A round record here is documentation of terms. It does not itself issue shares
 * — the issuances on the Transactions tab do, tagged with `roundId`. That split
 * keeps one source of truth for share counts.
 */

import * as React from 'react';
import * as z from 'zod';
import { Layers, Pencil, Plus, Landmark, Trash2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { money, multiple, shares as fmtShares } from '@/lib/equity/format';
import { toDate } from '@/lib/equity/engine';
import { isKind } from '@/lib/equity/types';
import type { CapTableSummary, EquityRecord, FundingRound, ShareClass } from '@/lib/equity/types';
import {
  DeleteConfirmDialog,
  EmptyState,
  EquityFormDialog,
  TabSection,
  fromDateInput,
  toDateInput,
  type FieldDef,
} from './equity-dialogs';

const roundSchema = z.object({
  name: z.string().min(1, 'Name the round.'),
  closeDate: z.string().min(1, 'Enter a date.'),
  preMoneyValuation: z.coerce.number().min(0, 'Cannot be negative.'),
  amountRaised: z.coerce.number().min(0, 'Cannot be negative.'),
  pricePerShare: z.coerce.number().min(0, 'Cannot be negative.'),
  shareClassId: z.string().optional(),
  status: z.enum(['planned', 'closed']),
});

const shareClassSchema = z.object({
  name: z.string().min(1, 'Name the class.'),
  classType: z.enum(['common', 'preferred']),
  authorizedShares: z.coerce.number().int().positive('Must be a positive whole number.'),
  parValue: z.coerce.number().min(0),
  seniorityRank: z.coerce.number().int().min(0),
  votesPerShare: z.coerce.number().min(0),
  liquidationMultiple: z.coerce.number().min(0),
  participating: z.boolean().optional(),
  participationCapMultiple: z.coerce.number().min(0).optional(),
});

export function RoundsTab({
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

  const [creatingRound, setCreatingRound] = React.useState(false);
  const [editingRound, setEditingRound] = React.useState<FundingRound | null>(null);
  const [creatingClass, setCreatingClass] = React.useState(false);
  const [editingClass, setEditingClass] = React.useState<ShareClass | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<FundingRound | ShareClass | null>(null);

  const rounds = React.useMemo(
    () =>
      records
        .filter(isKind('round'))
        .sort((a, b) => (toDate(a.closeDate)?.getTime() ?? 0) - (toDate(b.closeDate)?.getTime() ?? 0)),
    [records],
  );

  const shareClasses = React.useMemo(
    () => records.filter(isKind('shareClass')).sort((a, b) => b.seniorityRank - a.seniorityRank),
    [records],
  );

  const classOptions = React.useMemo(
    () => [
      { value: '', label: 'No class linked yet' },
      ...shareClasses.map((c) => ({ value: c.id, label: c.name })),
    ],
    [shareClasses],
  );

  /** Shares actually issued under a round, from the ledger rather than the terms. */
  const sharesIssuedIn = React.useCallback(
    (roundId: string) =>
      records
        .filter(isKind('issuance'))
        .filter((i) => i.roundId === roundId)
        .reduce((sum, i) => sum + (i.shares ?? 0), 0),
    [records],
  );

  const roundFields: FieldDef[] = [
    { name: 'name', label: 'Round name', type: 'text', placeholder: 'Seed' },
    { name: 'closeDate', label: 'Close date', type: 'date' },
    {
      name: 'preMoneyValuation',
      label: `Pre-money valuation (${summary.currency})`,
      type: 'number',
      min: 0,
      step: '1000',
    },
    {
      name: 'amountRaised',
      label: `Amount raised (${summary.currency})`,
      type: 'number',
      min: 0,
      step: '1000',
    },
    {
      name: 'pricePerShare',
      label: `Price per share (${summary.currency})`,
      type: 'number',
      min: 0,
      step: '0.0001',
      description: 'Pre-money valuation divided by pre-money fully diluted shares.',
    },
    {
      name: 'shareClassId',
      label: 'Share class',
      type: 'select',
      options: classOptions,
      description: 'The class this round buys into.',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'planned', label: 'Planned' },
        { value: 'closed', label: 'Closed' },
      ],
      description: 'Only closed rounds set the implied valuation.',
    },
  ];

  const classFields: FieldDef[] = [
    { name: 'name', label: 'Class name', type: 'text', placeholder: 'Series A Preferred' },
    {
      name: 'classType',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'common', label: 'Common' },
        { value: 'preferred', label: 'Preferred' },
      ],
    },
    { name: 'authorizedShares', label: 'Authorised shares', type: 'number', min: 1, step: '1' },
    { name: 'parValue', label: 'Par value', type: 'number', min: 0, step: '0.0001' },
    {
      name: 'seniorityRank',
      label: 'Seniority rank',
      type: 'number',
      min: 0,
      step: '1',
      description: 'Higher is paid first on an exit. Common is 0.',
    },
    { name: 'votesPerShare', label: 'Votes per share', type: 'number', min: 0, step: '1' },
    {
      name: 'liquidationMultiple',
      label: 'Liquidation multiple',
      type: 'number',
      min: 0,
      step: '0.5',
      description: 'Preferred only. 1x returns the investment before common is paid.',
    },
    {
      name: 'participating',
      label: 'Participating preferred',
      type: 'checkbox',
      description:
        'Participating preferred takes its preference AND shares the remainder. Non-participating takes whichever is higher.',
    },
    {
      name: 'participationCapMultiple',
      label: 'Participation cap',
      type: 'number',
      min: 0,
      step: '0.5',
      description: 'Total return ceiling as a multiple of investment. 0 means uncapped.',
    },
  ];

  const saveRound = async (values: z.infer<typeof roundSchema>) => {
    if (!firestore) return;
    try {
      const payload = {
        kind: 'round' as const,
        name: values.name,
        closeDate: fromDateInput(values.closeDate),
        preMoneyValuation: values.preMoneyValuation,
        amountRaised: values.amountRaised,
        pricePerShare: values.pricePerShare,
        shareClassId: values.shareClassId || null,
        status: values.status,
      };
      if (editingRound) {
        await updateEquityRecord(firestore, editingRound.id, payload, actorEmail, editingRound as any);
        toast({ variant: 'success', title: 'Round updated', description: values.name });
      } else {
        await createEquityRecord(firestore, payload, actorEmail);
        toast({ variant: 'success', title: 'Round added', description: values.name });
      }
      setCreatingRound(false);
      setEditingRound(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not save round',
        description: error?.message || 'An unexpected error occurred.',
      });
    }
  };

  const saveClass = async (values: z.infer<typeof shareClassSchema>) => {
    if (!firestore) return;
    try {
      const payload = {
        kind: 'shareClass' as const,
        name: values.name,
        classType: values.classType,
        authorizedShares: values.authorizedShares,
        parValue: values.parValue,
        seniorityRank: values.seniorityRank,
        votesPerShare: values.votesPerShare,
        conversionRatio: 1,
        liquidationMultiple: values.classType === 'preferred' ? values.liquidationMultiple : 0,
        participating: values.classType === 'preferred' ? Boolean(values.participating) : false,
        // 0 in the form means "uncapped", which the engine reads as null.
        participationCapMultiple:
          values.classType === 'preferred' && values.participationCapMultiple
            ? values.participationCapMultiple
            : null,
      };
      if (editingClass) {
        await updateEquityRecord(firestore, editingClass.id, payload, actorEmail, editingClass as any);
        toast({ variant: 'success', title: 'Share class updated', description: values.name });
      } else {
        await createEquityRecord(firestore, payload, actorEmail);
        toast({ variant: 'success', title: 'Share class added', description: values.name });
      }
      setCreatingClass(false);
      setEditingClass(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not save share class',
        description: error?.message || 'An unexpected error occurred.',
      });
    }
  };

  const remove = async () => {
    if (!firestore || !pendingDelete) return;
    try {
      await deleteEquityRecord(firestore, pendingDelete.id, pendingDelete as any, actorEmail);
      toast({ variant: 'success', title: 'Deleted' });
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
        title="Funding rounds"
        description="Terms of each raise. Shares are issued on the Transactions tab and tagged to a round."
        action={
          <Button onClick={() => setCreatingRound(true)} className="gap-2">
            <Plus className="size-4" />
            Add round
          </Button>
        }
      >
        {rounds.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No rounds yet"
            description="When you raise, record the terms here — then model the dilution before you sign anything."
            action={
              <Button onClick={() => setCreatingRound(true)} className="gap-2">
                <Plus className="size-4" />
                Add round
              </Button>
            }
          />
        ) : (
          <div className="w-full overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Round</TableHead>
                  <TableHead className="min-w-[110px]">Closed</TableHead>
                  <TableHead className="min-w-[130px] text-right">Pre-money</TableHead>
                  <TableHead className="min-w-[120px] text-right">Raised</TableHead>
                  <TableHead className="min-w-[130px] text-right">Post-money</TableHead>
                  <TableHead className="min-w-[110px] text-right">Price</TableHead>
                  <TableHead className="min-w-[110px] text-right">Shares</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rounds.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.name}
                      <Badge
                        variant={r.status === 'closed' ? 'secondary' : 'outline'}
                        className="ml-2 capitalize"
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {toDate(r.closeDate)?.toLocaleDateString() ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(r.preMoneyValuation, summary.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(r.amountRaised, summary.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(r.preMoneyValuation + r.amountRaised, summary.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(r.pricePerShare, summary.currency, { maximumFractionDigits: 4 })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtShares(sharesIssuedIn(r.id))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setEditingRound(r)}
                          aria-label={`Edit ${r.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(r)}
                          aria-label={`Delete ${r.name}`}
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

      <TabSection
        title="Share classes"
        description="Common, and a preferred class per priced round. Seniority and preference drive the exit waterfall."
        action={
          <Button variant="outline" onClick={() => setCreatingClass(true)} className="gap-2">
            <Plus className="size-4" />
            Add class
          </Button>
        }
      >
        {shareClasses.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No share classes"
            description="Every issuance belongs to a class. Start with Common."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shareClasses.map((c) => {
              const stats = summary.classes.find((s) => s.shareClassId === c.id);
              return (
                <Card key={c.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{c.name}</CardTitle>
                        <CardDescription className="capitalize">
                          {c.classType} · rank {c.seniorityRank}
                        </CardDescription>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setEditingClass(c)}
                          aria-label={`Edit ${c.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(c)}
                          aria-label={`Delete ${c.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-sm">
                    <Row label="Issued" value={fmtShares(stats?.issuedShares ?? 0)} />
                    <Row label="Authorised" value={fmtShares(c.authorizedShares)} />
                    <Row label="Votes / share" value={String(c.votesPerShare)} />
                    {c.classType === 'preferred' && (
                      <>
                        <Row label="Preference" value={multiple(c.liquidationMultiple)} />
                        <Row
                          label="Participation"
                          value={
                            c.participating
                              ? c.participationCapMultiple
                                ? `Capped at ${multiple(c.participationCapMultiple)}`
                                : 'Uncapped'
                              : 'Non-participating'
                          }
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabSection>

      <EquityFormDialog
        open={creatingRound || editingRound !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreatingRound(false);
            setEditingRound(null);
          }
        }}
        title={editingRound ? 'Edit round' : 'Add funding round'}
        description="Recording the terms here does not issue shares — do that on the Transactions tab and tag them to this round."
        schema={roundSchema}
        fields={roundFields}
        defaultValues={
          editingRound
            ? {
                name: editingRound.name,
                closeDate: toDateInput(editingRound.closeDate),
                preMoneyValuation: editingRound.preMoneyValuation,
                amountRaised: editingRound.amountRaised,
                pricePerShare: editingRound.pricePerShare,
                shareClassId: editingRound.shareClassId ?? '',
                status: editingRound.status,
              }
            : {
                name: '',
                closeDate: new Date().toISOString().slice(0, 10),
                preMoneyValuation: 0,
                amountRaised: 0,
                pricePerShare: 0,
                shareClassId: '',
                status: 'planned' as const,
              }
        }
        onSubmit={saveRound}
        submitLabel={editingRound ? 'Save changes' : 'Add round'}
      />

      <EquityFormDialog
        open={creatingClass || editingClass !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreatingClass(false);
            setEditingClass(null);
          }
        }}
        title={editingClass ? 'Edit share class' : 'Add share class'}
        description="Preference terms here are what the exit waterfall pays out on."
        schema={shareClassSchema}
        fields={classFields}
        defaultValues={
          editingClass
            ? {
                name: editingClass.name,
                classType: editingClass.classType,
                authorizedShares: editingClass.authorizedShares,
                parValue: editingClass.parValue,
                seniorityRank: editingClass.seniorityRank,
                votesPerShare: editingClass.votesPerShare,
                liquidationMultiple: editingClass.liquidationMultiple,
                participating: Boolean(editingClass.participating),
                participationCapMultiple: editingClass.participationCapMultiple ?? 0,
              }
            : {
                name: '',
                classType: 'preferred' as const,
                authorizedShares: 1_000_000,
                parValue: 0.0001,
                seniorityRank: 1,
                votesPerShare: 1,
                liquidationMultiple: 1,
                participating: false,
                participationCapMultiple: 0,
              }
        }
        onSubmit={saveClass}
        submitLabel={editingClass ? 'Save changes' : 'Add class'}
      />

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this record?"
        description={
          pendingDelete && (pendingDelete as any).kind === 'shareClass'
            ? 'Any issuances in this class will drop out of the cap table. Reassign them first if the totals need to stay correct.'
            : 'Issuances tagged to this round keep their shares — only the round record is removed.'
        }
        onConfirm={remove}
      />
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
