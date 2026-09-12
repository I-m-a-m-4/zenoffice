'use client';

/**
 * Transactions: the ledger that moves shares.
 *
 * Everything on the cap table is derived from these three record types —
 * issuances create shares, transfers move them between holders, cancellations
 * destroy them. The grid on the Overview tab is a projection of this ledger, not
 * a separate store, so a correction is made by editing the entry rather than
 * adjusting a balance.
 */

import * as React from 'react';
import * as z from 'zod';
import { ArrowRight, FileText, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  createEquityRecord,
  deleteEquityRecord,
  updateEquityRecord,
} from '@/lib/equity/data';
import { money, shares as fmtShares } from '@/lib/equity/format';
import { toDate } from '@/lib/equity/engine';
import { isKind } from '@/lib/equity/types';
import type {
  CapTableSummary,
  Cancellation,
  EquityRecord,
  Issuance,
  Transfer,
} from '@/lib/equity/types';
import {
  DeleteConfirmDialog,
  EmptyState,
  EquityFormDialog,
  TabSection,
  fromDateInput,
  toDateInput,
  type FieldDef,
} from './equity-dialogs';

type TxKind = 'issuance' | 'transfer' | 'cancellation';
type TxRecord = Issuance | Transfer | Cancellation;

const issuanceSchema = z.object({
  stakeholderId: z.string().min(1, 'Select a holder.'),
  shareClassId: z.string().min(1, 'Select a share class.'),
  shares: z.coerce.number().int().positive('Must be a positive whole number.'),
  pricePerShare: z.coerce.number().min(0, 'Cannot be negative.'),
  issueDate: z.string().min(1, 'Enter a date.'),
  certificateNo: z.string().optional(),
  consideration: z.enum(['cash', 'ip', 'services', 'conversion']),
  roundId: z.string().optional(),
});

const transferSchema = z
  .object({
    fromStakeholderId: z.string().min(1, 'Select the seller.'),
    toStakeholderId: z.string().min(1, 'Select the buyer.'),
    shareClassId: z.string().min(1, 'Select a share class.'),
    shares: z.coerce.number().int().positive('Must be a positive whole number.'),
    date: z.string().min(1, 'Enter a date.'),
    pricePerShare: z.coerce.number().min(0).optional(),
  })
  .refine((v) => v.fromStakeholderId !== v.toStakeholderId, {
    message: 'Seller and buyer must be different.',
    path: ['toStakeholderId'],
  });

const cancellationSchema = z.object({
  stakeholderId: z.string().min(1, 'Select a holder.'),
  shareClassId: z.string().min(1, 'Select a share class.'),
  shares: z.coerce.number().int().positive('Must be a positive whole number.'),
  date: z.string().min(1, 'Enter a date.'),
  reason: z.enum(['buyback', 'forfeiture', 'cancellation']),
});

export function TransactionsTab({
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

  const [creating, setCreating] = React.useState<TxKind | null>(null);
  const [editing, setEditing] = React.useState<TxRecord | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<TxRecord | null>(null);

  const stakeholderOptions = React.useMemo(
    () =>
      records
        .filter(isKind('stakeholder'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ value: s.id, label: s.name })),
    [records],
  );

  const classOptions = React.useMemo(
    () =>
      records
        .filter(isKind('shareClass'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name })),
    [records],
  );

  const roundOptions = React.useMemo(
    () => [
      { value: '', label: 'Not part of a round' },
      ...records.filter(isKind('round')).map((r) => ({ value: r.id, label: r.name })),
    ],
    [records],
  );

  const nameOf = React.useCallback(
    (id: string) => stakeholderOptions.find((s) => s.value === id)?.label ?? 'Unknown',
    [stakeholderOptions],
  );
  const classOf = React.useCallback(
    (id: string) => classOptions.find((c) => c.value === id)?.label ?? 'Unknown',
    [classOptions],
  );

  /** All three ledger types in one list, newest first. */
  const ledger = React.useMemo(() => {
    const rows: Array<{ record: TxRecord; kind: TxKind; date: Date | null }> = [
      ...records.filter(isKind('issuance')).map((r) => ({
        record: r as TxRecord,
        kind: 'issuance' as TxKind,
        date: toDate(r.issueDate),
      })),
      ...records.filter(isKind('transfer')).map((r) => ({
        record: r as TxRecord,
        kind: 'transfer' as TxKind,
        date: toDate(r.date),
      })),
      ...records.filter(isKind('cancellation')).map((r) => ({
        record: r as TxRecord,
        kind: 'cancellation' as TxKind,
        date: toDate(r.date),
      })),
    ];
    return rows.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  }, [records]);

  const activeKind: TxKind | null = creating ?? (editing ? kindOf(editing) : null);

  const fieldsFor = (kind: TxKind): FieldDef[] => {
    if (kind === 'issuance') {
      return [
        { name: 'stakeholderId', label: 'Holder', type: 'select', options: stakeholderOptions },
        { name: 'shareClassId', label: 'Share class', type: 'select', options: classOptions },
        { name: 'shares', label: 'Shares', type: 'number', min: 1, step: '1' },
        {
          name: 'pricePerShare',
          label: `Price per share (${summary.currency})`,
          type: 'number',
          min: 0,
          step: '0.0001',
        },
        { name: 'issueDate', label: 'Issue date', type: 'date' },
        { name: 'certificateNo', label: 'Certificate no.', type: 'text', placeholder: 'CS-2' },
        {
          name: 'consideration',
          label: 'Paid with',
          type: 'select',
          options: [
            { value: 'cash', label: 'Cash' },
            { value: 'ip', label: 'IP assignment' },
            { value: 'services', label: 'Services' },
            { value: 'conversion', label: 'Conversion of a note or SAFE' },
          ],
        },
        {
          name: 'roundId',
          label: 'Round',
          type: 'select',
          options: roundOptions,
          description: 'Links this issuance to a funding round.',
        },
      ];
    }
    if (kind === 'transfer') {
      return [
        { name: 'fromStakeholderId', label: 'From', type: 'select', options: stakeholderOptions },
        { name: 'toStakeholderId', label: 'To', type: 'select', options: stakeholderOptions },
        { name: 'shareClassId', label: 'Share class', type: 'select', options: classOptions },
        { name: 'shares', label: 'Shares', type: 'number', min: 1, step: '1' },
        { name: 'date', label: 'Transfer date', type: 'date' },
        {
          name: 'pricePerShare',
          label: `Price per share (${summary.currency})`,
          type: 'number',
          min: 0,
          step: '0.0001',
          description: 'Secondary sale price. Leave at 0 for a gift or restructure.',
        },
      ];
    }
    return [
      { name: 'stakeholderId', label: 'Holder', type: 'select', options: stakeholderOptions },
      { name: 'shareClassId', label: 'Share class', type: 'select', options: classOptions },
      { name: 'shares', label: 'Shares', type: 'number', min: 1, step: '1' },
      { name: 'date', label: 'Date', type: 'date' },
      {
        name: 'reason',
        label: 'Reason',
        type: 'select',
        options: [
          { value: 'buyback', label: 'Company buyback' },
          { value: 'forfeiture', label: 'Forfeiture (unvested on exit)' },
          { value: 'cancellation', label: 'Cancellation' },
        ],
      },
    ];
  };

  const defaultsFor = (kind: TxKind): Record<string, unknown> => {
    if (editing) {
      const r = editing as any;
      if (kind === 'issuance') {
        return {
          stakeholderId: r.stakeholderId ?? '',
          shareClassId: r.shareClassId ?? '',
          shares: r.shares ?? 0,
          pricePerShare: r.pricePerShare ?? 0,
          issueDate: toDateInput(r.issueDate),
          certificateNo: r.certificateNo ?? '',
          consideration: r.consideration ?? 'cash',
          roundId: r.roundId ?? '',
        };
      }
      if (kind === 'transfer') {
        return {
          fromStakeholderId: r.fromStakeholderId ?? '',
          toStakeholderId: r.toStakeholderId ?? '',
          shareClassId: r.shareClassId ?? '',
          shares: r.shares ?? 0,
          date: toDateInput(r.date),
          pricePerShare: r.pricePerShare ?? 0,
        };
      }
      return {
        stakeholderId: r.stakeholderId ?? '',
        shareClassId: r.shareClassId ?? '',
        shares: r.shares ?? 0,
        date: toDateInput(r.date),
        reason: r.reason ?? 'buyback',
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    if (kind === 'issuance') {
      return {
        stakeholderId: '',
        shareClassId: classOptions[0]?.value ?? '',
        shares: 0,
        pricePerShare: 0,
        issueDate: today,
        certificateNo: '',
        consideration: 'cash',
        roundId: '',
      };
    }
    if (kind === 'transfer') {
      return {
        fromStakeholderId: '',
        toStakeholderId: '',
        shareClassId: classOptions[0]?.value ?? '',
        shares: 0,
        date: today,
        pricePerShare: 0,
      };
    }
    return {
      stakeholderId: '',
      shareClassId: classOptions[0]?.value ?? '',
      shares: 0,
      date: today,
      reason: 'buyback',
    };
  };

  const save = async (kind: TxKind, values: Record<string, any>) => {
    if (!firestore) return;
    try {
      const payload: Record<string, unknown> = { kind, ...values };

      // Convert the form's date strings into real Dates for the data layer.
      for (const key of ['issueDate', 'date']) {
        if (typeof payload[key] === 'string' && payload[key]) {
          payload[key] = fromDateInput(payload[key] as string);
        }
      }
      // An empty select means "no round", which must be null rather than ''.
      if (payload.roundId === '') payload.roundId = null;

      if (editing) {
        await updateEquityRecord(
          firestore,
          editing.id,
          payload as any,
          actorEmail,
          editing as any,
        );
        toast({ variant: 'success', title: 'Transaction updated' });
      } else {
        await createEquityRecord(firestore, payload as any, actorEmail);
        toast({ variant: 'success', title: 'Transaction recorded' });
      }
      setCreating(null);
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
      toast({ variant: 'success', title: 'Transaction deleted' });
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

  const canRecord = stakeholderOptions.length > 0 && classOptions.length > 0;

  return (
    <TabSection
      title="Transactions"
      description="Every issuance, transfer and cancellation. The cap table is built from this ledger."
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2" disabled={!canRecord}>
              <Plus className="size-4" />
              Record transaction
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setCreating('issuance')}>
              <Plus className="mr-2 size-4" />
              Issue shares
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCreating('transfer')}>
              <ArrowRight className="mr-2 size-4" />
              Transfer shares
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCreating('cancellation')}>
              <Minus className="mr-2 size-4" />
              Cancel shares
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {!canRecord && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4 text-sm">
            Add at least one stakeholder and one share class before recording a transaction.
          </CardContent>
        </Card>
      )}

      {ledger.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No transactions yet"
          description="Issue shares to a stakeholder and the cap table will populate from there."
        />
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[110px]">Date</TableHead>
                <TableHead className="min-w-[110px]">Type</TableHead>
                <TableHead className="min-w-[200px]">Detail</TableHead>
                <TableHead className="min-w-[120px]">Class</TableHead>
                <TableHead className="min-w-[110px] text-right">Shares</TableHead>
                <TableHead className="min-w-[120px] text-right">Value</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map(({ record, kind, date }) => {
                const r = record as any;
                const value =
                  typeof r.pricePerShare === 'number' && r.pricePerShare > 0
                    ? r.pricePerShare * r.shares
                    : 0;
                return (
                  <TableRow key={record.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {date ? date.toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          kind === 'issuance'
                            ? 'default'
                            : kind === 'transfer'
                              ? 'secondary'
                              : 'destructive'
                        }
                        className="capitalize"
                      >
                        {kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {kind === 'transfer' ? (
                        <span className="flex items-center gap-1.5 text-sm">
                          <span className="truncate">{nameOf(r.fromStakeholderId)}</span>
                          <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{nameOf(r.toStakeholderId)}</span>
                        </span>
                      ) : (
                        <span className="truncate">{nameOf(r.stakeholderId)}</span>
                      )}
                      <span className="block text-xs capitalize text-muted-foreground">
                        {kind === 'issuance'
                          ? String(r.consideration ?? '').replace('ip', 'IP assignment')
                          : kind === 'cancellation'
                            ? r.reason
                            : r.pricePerShare
                              ? 'Secondary sale'
                              : 'Gift or restructure'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {classOf(r.shareClassId)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {kind === 'cancellation' ? '−' : ''}
                      {fmtShares(r.shares ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {value > 0 ? (
                        money(value, summary.currency)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setEditing(record)}
                          aria-label="Edit transaction"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(record)}
                          aria-label="Delete transaction"
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

      {activeKind && (
        <EquityFormDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setCreating(null);
              setEditing(null);
            }
          }}
          title={
            editing
              ? `Edit ${activeKind}`
              : activeKind === 'issuance'
                ? 'Issue shares'
                : activeKind === 'transfer'
                  ? 'Transfer shares'
                  : 'Cancel shares'
          }
          description={
            activeKind === 'issuance'
              ? 'Creates new shares and adds them to the holder’s position.'
              : activeKind === 'transfer'
                ? 'Moves existing shares between holders. Total outstanding does not change.'
                : 'Removes shares from a holder. Total outstanding decreases.'
          }
          schema={
            activeKind === 'issuance'
              ? issuanceSchema
              : activeKind === 'transfer'
                ? transferSchema
                : cancellationSchema
          }
          fields={fieldsFor(activeKind)}
          defaultValues={defaultsFor(activeKind) as any}
          onSubmit={(values) => save(activeKind, values)}
          submitLabel={editing ? 'Save changes' : 'Record'}
        />
      )}

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this transaction?"
        description="The cap table recalculates without it. The audit trail keeps a copy of what was deleted."
        onConfirm={remove}
      />
    </TabSection>
  );
}

function kindOf(record: TxRecord): TxKind {
  return (record as any).kind as TxKind;
}
