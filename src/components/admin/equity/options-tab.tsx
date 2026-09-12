'use client';

/**
 * Employee options (ESOP).
 *
 * Two things live here: the reserved pool, and the grants drawn from it. The
 * distinction matters on the cap table — reserved-but-ungranted shares dilute
 * everyone in the fully-diluted count while belonging to nobody, which is why
 * investors insist the pool is sized before their money goes in rather than
 * after.
 *
 * Vesting is shown as progress rather than a date, because the question a
 * founder asks about a grant is "how much of this is actually theirs today".
 */

import * as React from 'react';
import * as z from 'zod';
import { Award, Pencil, Plus, Trash2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { money, percent, shares as fmtShares } from '@/lib/equity/format';
import { toDate, vestedPercent, vestedShares } from '@/lib/equity/engine';
import { isKind } from '@/lib/equity/types';
import type { CapTableSummary, EquityRecord, OptionGrant, PoolReservation } from '@/lib/equity/types';
import {
  DeleteConfirmDialog,
  EmptyState,
  EquityFormDialog,
  TabSection,
  fromDateInput,
  toDateInput,
  type FieldDef,
} from './equity-dialogs';

const grantSchema = z.object({
  stakeholderId: z.string().min(1, 'Select a holder.'),
  shares: z.coerce.number().int().positive('Must be a positive whole number.'),
  strikePrice: z.coerce.number().min(0),
  grantDate: z.string().min(1, 'Enter a date.'),
  vestingStart: z.string().min(1, 'Enter a vesting start date.'),
  cliffMonths: z.coerce.number().int().min(0),
  totalMonths: z.coerce.number().int().positive('Must be greater than zero.'),
  exercised: z.coerce.number().int().min(0),
  cancelled: z.coerce.number().int().min(0),
  status: z.enum(['outstanding', 'exercised', 'cancelled']),
});

const poolSchema = z.object({
  shares: z.coerce.number().int().positive('Must be a positive whole number.'),
  date: z.string().min(1, 'Enter a date.'),
  note: z.string().optional(),
});

export function OptionsTab({
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

  const [creatingGrant, setCreatingGrant] = React.useState(false);
  const [editingGrant, setEditingGrant] = React.useState<OptionGrant | null>(null);
  const [creatingPool, setCreatingPool] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<OptionGrant | PoolReservation | null>(
    null,
  );

  const asOf = summary.asOf;

  const grants = React.useMemo(
    () =>
      records
        .filter(isKind('optionGrant'))
        .sort((a, b) => (toDate(b.grantDate)?.getTime() ?? 0) - (toDate(a.grantDate)?.getTime() ?? 0)),
    [records],
  );

  const reservations = React.useMemo(
    () =>
      records
        .filter(isKind('poolReservation'))
        .sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0)),
    [records],
  );

  const stakeholderOptions = React.useMemo(
    () =>
      records
        .filter(isKind('stakeholder'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ value: s.id, label: s.name })),
    [records],
  );

  const nameOf = (id: string) => stakeholderOptions.find((s) => s.value === id)?.label ?? 'Unknown';

  const poolPct =
    summary.fullyDilutedShares > 0 ? (summary.poolReserved / summary.fullyDilutedShares) * 100 : 0;

  const grantFields: FieldDef[] = [
    { name: 'stakeholderId', label: 'Grantee', type: 'select', options: stakeholderOptions },
    { name: 'shares', label: 'Options granted', type: 'number', min: 1, step: '1' },
    {
      name: 'strikePrice',
      label: `Strike price (${summary.currency})`,
      type: 'number',
      min: 0,
      step: '0.0001',
      description: 'What the holder pays per share to exercise.',
    },
    { name: 'grantDate', label: 'Grant date', type: 'date' },
    { name: 'vestingStart', label: 'Vesting starts', type: 'date' },
    {
      name: 'cliffMonths',
      label: 'Cliff (months)',
      type: 'number',
      min: 0,
      step: '1',
      description: 'Nothing vests before this. 12 is standard.',
    },
    {
      name: 'totalMonths',
      label: 'Total vesting (months)',
      type: 'number',
      min: 1,
      step: '1',
      description: '48 is standard.',
    },
    { name: 'exercised', label: 'Already exercised', type: 'number', min: 0, step: '1' },
    {
      name: 'cancelled',
      label: 'Cancelled / forfeited',
      type: 'number',
      min: 0,
      step: '1',
      description: 'Returns to the pool and can be regranted.',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'outstanding', label: 'Outstanding' },
        { value: 'exercised', label: 'Fully exercised' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
  ];

  const poolFields: FieldDef[] = [
    { name: 'shares', label: 'Shares to reserve', type: 'number', min: 1, step: '1' },
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'note', label: 'Note', type: 'text', placeholder: 'Pool top-up ahead of Series A' },
  ];

  const saveGrant = async (values: z.infer<typeof grantSchema>) => {
    if (!firestore) return;
    try {
      const payload = {
        kind: 'optionGrant' as const,
        stakeholderId: values.stakeholderId,
        shares: values.shares,
        strikePrice: values.strikePrice,
        grantDate: fromDateInput(values.grantDate),
        vesting: {
          startDate: fromDateInput(values.vestingStart),
          cliffMonths: values.cliffMonths,
          totalMonths: values.totalMonths,
        },
        exercised: values.exercised,
        cancelled: values.cancelled,
        status: values.status,
      };
      if (editingGrant) {
        await updateEquityRecord(firestore, editingGrant.id, payload, actorEmail, editingGrant as any);
        toast({ variant: 'success', title: 'Grant updated' });
      } else {
        await createEquityRecord(firestore, payload, actorEmail);
        toast({ variant: 'success', title: 'Grant added' });
      }
      setCreatingGrant(false);
      setEditingGrant(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not save grant',
        description: error?.message || 'An unexpected error occurred.',
      });
    }
  };

  const savePool = async (values: z.infer<typeof poolSchema>) => {
    if (!firestore) return;
    try {
      await createEquityRecord(
        firestore,
        {
          kind: 'poolReservation',
          shares: values.shares,
          date: fromDateInput(values.date),
          note: values.note || '',
        },
        actorEmail,
      );
      toast({ variant: 'success', title: 'Pool reserved' });
      setCreatingPool(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not reserve',
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
        title="Option pool"
        description="Shares set aside for employee grants. Reserved shares dilute the fully-diluted count even before they are granted."
        action={
          <Button variant="outline" onClick={() => setCreatingPool(true)} className="gap-2">
            <Plus className="size-4" />
            Reserve shares
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Reserved</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {fmtShares(summary.poolReserved)}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {percent(poolPct)} of fully diluted
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Granted</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {fmtShares(summary.poolReserved - summary.poolUnallocated)}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Across {grants.length} grant{grants.length === 1 ? '' : 's'}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Available</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {fmtShares(summary.poolUnallocated)}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">Still to grant</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Outstanding options</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {fmtShares(summary.optionsOutstanding)}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">Unexercised and uncancelled</p>
          </Card>
        </div>

        {reservations.length > 0 && (
          <div className="w-full overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[110px]">Date</TableHead>
                  <TableHead className="min-w-[120px] text-right">Shares</TableHead>
                  <TableHead className="min-w-[200px]">Note</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {toDate(p.date)?.toLocaleDateString() ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {fmtShares(p.shares)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.note || '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete(p)}
                        aria-label="Delete reservation"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabSection>

      <TabSection
        title="Grants"
        description="Options granted to employees and advisors, with vesting progress."
        action={
          <Button
            onClick={() => setCreatingGrant(true)}
            className="gap-2"
            disabled={stakeholderOptions.length === 0}
          >
            <Plus className="size-4" />
            Grant options
          </Button>
        }
      >
        {grants.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No grants yet"
            description="Reserve a pool first, then grant options from it to employees and advisors."
          />
        ) : (
          <div className="w-full overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Grantee</TableHead>
                  <TableHead className="min-w-[110px] text-right">Granted</TableHead>
                  <TableHead className="min-w-[110px] text-right">Strike</TableHead>
                  <TableHead className="min-w-[180px]">Vested</TableHead>
                  <TableHead className="min-w-[110px] text-right">Outstanding</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {grants.map((g) => {
                  const vested = vestedShares(g.vesting, g.shares, asOf);
                  const vestedPct = vestedPercent(g.vesting, g.shares, asOf);
                  const live = Math.max(
                    0,
                    (g.shares ?? 0) - (g.exercised ?? 0) - (g.cancelled ?? 0),
                  );
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">
                        <span className="block truncate">{nameOf(g.stakeholderId)}</span>
                        <span className="text-xs text-muted-foreground">
                          {toDate(g.grantDate)?.toLocaleDateString() ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtShares(g.shares)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(g.strikePrice, summary.currency, { maximumFractionDigits: 4 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-[var(--viz-3)]"
                              style={{ width: `${Math.min(100, vestedPct)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {fmtShares(vested)} ({percent(vestedPct, 0)})
                          </span>
                        </div>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {g.vesting?.cliffMonths ?? 0}m cliff · {g.vesting?.totalMonths ?? 0}m total
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtShares(live)}
                        {g.status !== 'outstanding' && (
                          <Badge variant="outline" className="ml-2 capitalize">
                            {g.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setEditingGrant(g)}
                            aria-label="Edit grant"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => setPendingDelete(g)}
                            aria-label="Delete grant"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </TabSection>

      <EquityFormDialog
        open={creatingGrant || editingGrant !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreatingGrant(false);
            setEditingGrant(null);
          }
        }}
        title={editingGrant ? 'Edit grant' : 'Grant options'}
        description="Options are not shares until exercised, but they count towards fully diluted from the day they are granted."
        schema={grantSchema}
        fields={grantFields}
        defaultValues={
          editingGrant
            ? {
                stakeholderId: editingGrant.stakeholderId,
                shares: editingGrant.shares,
                strikePrice: editingGrant.strikePrice,
                grantDate: toDateInput(editingGrant.grantDate),
                vestingStart: toDateInput(editingGrant.vesting?.startDate),
                cliffMonths: editingGrant.vesting?.cliffMonths ?? 12,
                totalMonths: editingGrant.vesting?.totalMonths ?? 48,
                exercised: editingGrant.exercised ?? 0,
                cancelled: editingGrant.cancelled ?? 0,
                status: editingGrant.status,
              }
            : {
                stakeholderId: '',
                shares: 0,
                strikePrice: summary.lastRoundPps ?? 0.0001,
                grantDate: new Date().toISOString().slice(0, 10),
                vestingStart: new Date().toISOString().slice(0, 10),
                cliffMonths: 12,
                totalMonths: 48,
                exercised: 0,
                cancelled: 0,
                status: 'outstanding' as const,
              }
        }
        onSubmit={saveGrant}
        submitLabel={editingGrant ? 'Save changes' : 'Grant options'}
      />

      <EquityFormDialog
        open={creatingPool}
        onOpenChange={setCreatingPool}
        title="Reserve shares for the option pool"
        description="Top-ups add to the pool. The total reserved is the sum of every reservation."
        schema={poolSchema}
        fields={poolFields}
        defaultValues={{
          shares: 0,
          date: new Date().toISOString().slice(0, 10),
          note: '',
        }}
        onSubmit={savePool}
        submitLabel="Reserve"
      />

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this record?"
        description="The pool and grant totals recalculate without it. The audit trail keeps a copy."
        onConfirm={remove}
      />
    </div>
  );
}
