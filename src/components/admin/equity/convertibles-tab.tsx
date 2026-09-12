'use client';

/**
 * SAFEs and convertible notes.
 *
 * These are the instruments that own nothing until they own something. A SAFE
 * holder has no shares and no percentage — they have a contractual right to
 * shares at the next priced round, at a price set by whichever of the cap or the
 * discount treats them better.
 *
 * The as-converted preview here is an estimate priced off the last closed round,
 * and it is labelled as one everywhere it appears. Presenting an estimate as a
 * settled number is how a founder promises the same 5% twice.
 */

import * as React from 'react';
import * as z from 'zod';
import { FileSignature, Info, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { accruedAmount, convertibleAsConverted, toDate } from '@/lib/equity/engine';
import { isKind } from '@/lib/equity/types';
import type { CapTableSummary, Convertible, EquityRecord } from '@/lib/equity/types';
import {
  DeleteConfirmDialog,
  EmptyState,
  EquityFormDialog,
  TabSection,
  fromDateInput,
  toDateInput,
  type FieldDef,
} from './equity-dialogs';

const convertibleSchema = z.object({
  stakeholderId: z.string().min(1, 'Select a holder.'),
  instrument: z.enum(['safe', 'note']),
  principal: z.coerce.number().positive('Must be greater than zero.'),
  issueDate: z.string().min(1, 'Enter a date.'),
  valuationCap: z.coerce.number().min(0).optional(),
  discountPercent: z.coerce.number().min(0).max(99, 'Must be under 100.').optional(),
  interestRate: z.coerce.number().min(0).optional(),
  maturityDate: z.string().optional(),
  safeType: z.enum(['pre', 'post']),
  status: z.enum(['outstanding', 'converted', 'cancelled']),
});

export function ConvertiblesTab({
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
  const [editing, setEditing] = React.useState<Convertible | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Convertible | null>(null);

  const asOf = summary.asOf;

  const convertibles = React.useMemo(
    () =>
      records
        .filter(isKind('convertible'))
        .sort((a, b) => (toDate(b.issueDate)?.getTime() ?? 0) - (toDate(a.issueDate)?.getTime() ?? 0)),
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

  /** Pre-money base used for cap pricing — issued plus the pool, excluding the instruments. */
  const preMoneyFd =
    summary.outstandingShares + summary.optionsOutstanding + summary.poolUnallocated;

  const outstanding = convertibles.filter((c) => c.status === 'outstanding');
  const totalPrincipal = outstanding.reduce((sum, c) => sum + (c.principal ?? 0), 0);

  const fields: FieldDef[] = [
    { name: 'stakeholderId', label: 'Holder', type: 'select', options: stakeholderOptions },
    {
      name: 'instrument',
      label: 'Instrument',
      type: 'select',
      options: [
        { value: 'safe', label: 'SAFE' },
        { value: 'note', label: 'Convertible note' },
      ],
    },
    {
      name: 'principal',
      label: `Principal (${summary.currency})`,
      type: 'number',
      min: 0,
      step: '1000',
    },
    { name: 'issueDate', label: 'Issue date', type: 'date' },
    {
      name: 'valuationCap',
      label: `Valuation cap (${summary.currency})`,
      type: 'number',
      min: 0,
      step: '1000',
      description: '0 for no cap.',
    },
    {
      name: 'discountPercent',
      label: 'Discount (%)',
      type: 'number',
      min: 0,
      step: '1',
      description: '0 for no discount. 20 means 20% off the round price.',
    },
    {
      name: 'safeType',
      label: 'Cap basis',
      type: 'select',
      options: [
        { value: 'post', label: 'Post-money (fixes their %)' },
        { value: 'pre', label: 'Pre-money (dilutes with other SAFEs)' },
      ],
      description: 'Post-money is the current YC standard.',
    },
    {
      name: 'interestRate',
      label: 'Interest rate (%)',
      type: 'number',
      min: 0,
      step: '0.5',
      description: 'Notes only. Accrues simple interest to conversion.',
    },
    { name: 'maturityDate', label: 'Maturity date', type: 'date' },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'outstanding', label: 'Outstanding' },
        { value: 'converted', label: 'Converted' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
  ];

  const save = async (values: z.infer<typeof convertibleSchema>) => {
    if (!firestore) return;
    try {
      const payload = {
        kind: 'convertible' as const,
        stakeholderId: values.stakeholderId,
        instrument: values.instrument,
        principal: values.principal,
        issueDate: fromDateInput(values.issueDate),
        // 0 in the form means "not set", which the engine reads as null.
        valuationCap: values.valuationCap ? values.valuationCap : null,
        discountPercent: values.discountPercent ? values.discountPercent : null,
        interestRate: values.instrument === 'note' ? (values.interestRate ?? 0) : 0,
        maturityDate: values.maturityDate ? fromDateInput(values.maturityDate) : null,
        safeType: values.safeType,
        status: values.status,
      };

      if (editing) {
        await updateEquityRecord(firestore, editing.id, payload, actorEmail, editing as any);
        toast({ variant: 'success', title: 'Instrument updated' });
      } else {
        await createEquityRecord(firestore, payload, actorEmail);
        toast({ variant: 'success', title: 'Instrument added' });
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
      toast({ variant: 'success', title: 'Instrument deleted' });
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
    <TabSection
      title="SAFEs & convertible notes"
      description="Money in now, shares at the next priced round."
      action={
        <Button
          onClick={() => setIsCreating(true)}
          className="gap-2"
          disabled={stakeholderOptions.length === 0}
        >
          <Plus className="size-4" />
          Add instrument
        </Button>
      }
    >
      {outstanding.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Outstanding principal</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {money(totalPrincipal, summary.currency)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Instruments</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{outstanding.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Estimated dilution</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {summary.fullyDilutedShares > 0
                ? percent((summary.convertiblesAsConverted / summary.fullyDilutedShares) * 100)
                : '—'}
            </p>
          </Card>
        </div>
      )}

      {summary.lastRoundPps === null && outstanding.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <p>
            These instruments cannot be priced until a round closes, so they are excluded from the
            fully-diluted totals. Use the Modeling tab to see what a round would convert them into.
          </p>
        </div>
      )}

      {convertibles.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="No instruments"
          description="SAFEs and convertible notes let an investor put money in before you agree a valuation."
        />
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Holder</TableHead>
                <TableHead className="min-w-[100px]">Type</TableHead>
                <TableHead className="min-w-[120px] text-right">Principal</TableHead>
                <TableHead className="min-w-[120px] text-right">Cap</TableHead>
                <TableHead className="min-w-[90px] text-right">Discount</TableHead>
                <TableHead className="min-w-[130px] text-right">
                  As converted
                  <span className="ml-1 font-normal text-muted-foreground">(est.)</span>
                </TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {convertibles.map((c) => {
                const estimated =
                  c.status === 'outstanding' && summary.lastRoundPps
                    ? convertibleAsConverted(c, summary.lastRoundPps, preMoneyFd, asOf)
                    : 0;
                const accrued = accruedAmount(c, asOf);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <span className="block truncate">{nameOf(c.stakeholderId)}</span>
                      <span className="text-xs text-muted-foreground">
                        {toDate(c.issueDate)?.toLocaleDateString() ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase">
                        {c.instrument}
                      </Badge>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {c.safeType === 'post' ? 'post-money' : 'pre-money'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(c.principal, summary.currency)}
                      {accrued > c.principal && (
                        <span className="block text-[11px] text-muted-foreground">
                          {money(accrued, summary.currency)} with interest
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.valuationCap ? money(c.valuationCap, summary.currency) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.discountPercent ? `${c.discountPercent}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {estimated > 0 ? (
                        fmtShares(estimated)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.status === 'outstanding'
                            ? 'default'
                            : c.status === 'converted'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="capitalize"
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setEditing(c)}
                          aria-label="Edit instrument"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(c)}
                          aria-label="Delete instrument"
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

      <EquityFormDialog
        open={isCreating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditing(null);
          }
        }}
        title={editing ? 'Edit instrument' : 'Add SAFE or note'}
        description="The holder converts at whichever of the cap price or the discount price is cheaper."
        schema={convertibleSchema}
        fields={fields}
        defaultValues={
          editing
            ? {
                stakeholderId: editing.stakeholderId,
                instrument: editing.instrument,
                principal: editing.principal,
                issueDate: toDateInput(editing.issueDate),
                valuationCap: editing.valuationCap ?? 0,
                discountPercent: editing.discountPercent ?? 0,
                interestRate: editing.interestRate ?? 0,
                maturityDate: toDateInput(editing.maturityDate),
                safeType: editing.safeType,
                status: editing.status,
              }
            : {
                stakeholderId: '',
                instrument: 'safe' as const,
                principal: 0,
                issueDate: new Date().toISOString().slice(0, 10),
                valuationCap: 0,
                discountPercent: 20,
                interestRate: 0,
                maturityDate: '',
                safeType: 'post' as const,
                status: 'outstanding' as const,
              }
        }
        onSubmit={save}
        submitLabel={editing ? 'Save changes' : 'Add instrument'}
      />

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this instrument?"
        description="The audit trail keeps a copy. If it has already converted, delete the issuance too or the shares will remain."
        onConfirm={remove}
      />
    </TabSection>
  );
}
