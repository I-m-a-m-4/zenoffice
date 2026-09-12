'use client';

/**
 * Stakeholders: the people and entities that can hold equity.
 *
 * A stakeholder is just an identity — it holds nothing until shares are issued
 * to it on the Transactions tab. Keeping the two separate is what lets one
 * person hold several classes, options and a SAFE without duplicate records.
 */

import * as React from 'react';
import * as z from 'zod';
import { Crown, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { investedLabel, percent, shares as fmtShares } from '@/lib/equity/format';
import { isKind } from '@/lib/equity/types';
import type { CapTableSummary, EquityRecord, Stakeholder } from '@/lib/equity/types';
import {
  DeleteConfirmDialog,
  EmptyState,
  EquityFormDialog,
  TabSection,
  type FieldDef,
} from './equity-dialogs';

const stakeholderSchema = z.object({
  name: z.string().min(2, 'Enter a name.'),
  email: z.string().email('Enter a valid email.').or(z.literal('')),
  entityType: z.enum(['individual', 'entity', 'fund', 'employee', 'advisor']),
  country: z.string().optional(),
  isFounder: z.boolean().optional(),
  notes: z.string().optional(),
});

type StakeholderValues = z.infer<typeof stakeholderSchema>;

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', placeholder: 'Bello Imam' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'investor@example.com' },
  {
    name: 'entityType',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'individual', label: 'Individual' },
      { value: 'entity', label: 'Company / entity' },
      { value: 'fund', label: 'Fund / VC' },
      { value: 'employee', label: 'Employee' },
      { value: 'advisor', label: 'Advisor' },
    ],
  },
  { name: 'country', label: 'Country', type: 'text', placeholder: 'Nigeria' },
  {
    name: 'isFounder',
    label: 'Founder',
    type: 'checkbox',
    description: 'Marks this holder as a founder on the cap table.',
  },
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional context' },
];

const EMPTY: StakeholderValues = {
  name: '',
  email: '',
  entityType: 'individual',
  country: '',
  isFounder: false,
  notes: '',
};

export function StakeholdersTab({
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

  const [editing, setEditing] = React.useState<Stakeholder | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<Stakeholder | null>(null);

  const stakeholders = React.useMemo(() => {
    return records.filter(isKind('stakeholder')).sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  /** Holdings lookup, so a row can show what this identity actually owns. */
  const holdingFor = React.useCallback(
    (id: string) => summary.holders.find((h) => h.stakeholderId === id) ?? null,
    [summary.holders],
  );

  const save = async (values: StakeholderValues) => {
    if (!firestore) return;
    try {
      const payload = {
        kind: 'stakeholder' as const,
        name: values.name,
        email: values.email || '',
        entityType: values.entityType,
        country: values.country || '',
        isFounder: Boolean(values.isFounder),
        notes: values.notes || '',
      };

      if (editing) {
        await updateEquityRecord(firestore, editing.id, payload, actorEmail, editing as any);
        toast({ variant: 'success', title: 'Stakeholder updated', description: values.name });
      } else {
        await createEquityRecord(firestore, payload, actorEmail);
        toast({ variant: 'success', title: 'Stakeholder added', description: values.name });
      }
      setEditing(null);
      setIsCreating(false);
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
      await deleteEquityRecord(
        firestore,
        pendingDelete.id,
        pendingDelete as any,
        actorEmail,
      );
      toast({ variant: 'success', title: 'Stakeholder removed', description: pendingDelete.name });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not remove',
        description: error?.message || 'An unexpected error occurred.',
      });
    } finally {
      setPendingDelete(null);
    }
  };

  const holdsShares = (id: string) => {
    const h = holdingFor(id);
    return Boolean(h && h.fullyDilutedShares > 0);
  };

  return (
    <TabSection
      title="Stakeholders"
      description="Everyone who holds — or could hold — equity in the company."
      action={
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus className="size-4" />
          Add stakeholder
        </Button>
      }
    >
      {stakeholders.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No stakeholders yet"
          description="Add the founders and investors who hold equity, then issue them shares on the Transactions tab."
          action={
            <Button onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="size-4" />
              Add stakeholder
            </Button>
          }
        />
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Name</TableHead>
                <TableHead className="min-w-[120px]">Type</TableHead>
                <TableHead className="min-w-[180px]">Email</TableHead>
                <TableHead className="min-w-[110px] text-right">Shares</TableHead>
                <TableHead className="min-w-[110px] text-right">Invested</TableHead>
                <TableHead className="min-w-[100px] text-right">Ownership</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stakeholders.map((s) => {
                const holding = holdingFor(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{s.name}</span>
                        {s.isFounder && (
                          <Crown className="size-3.5 shrink-0 text-amber-500" aria-label="Founder" />
                        )}
                      </div>
                      {s.country && (
                        <span className="text-xs text-muted-foreground">{s.country}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {s.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="block max-w-[220px] truncate">{s.email || '—'}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {holding ? fmtShares(holding.fullyDilutedShares) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {/* Reads "for IP" rather than a dash where the shares were
                          not bought with money — see investedLabel. */}
                      {holding
                        ? investedLabel(
                            holding.invested,
                            holding.nonCashConsiderations,
                            summary.currency,
                          )
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {holding ? (
                        <Badge variant="secondary" className="tabular-nums">
                          {percent(holding.pctFullyDiluted)}
                        </Badge>
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
                          onClick={() => setEditing(s)}
                          aria-label={`Edit ${s.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(s)}
                          aria-label={`Remove ${s.name}`}
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

      <EquityFormDialog<StakeholderValues>
        open={isCreating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditing(null);
          }
        }}
        title={editing ? 'Edit stakeholder' : 'Add stakeholder'}
        description={
          editing
            ? 'Updating an identity does not change any shares already issued to it.'
            : 'Create the identity first, then issue shares to it on the Transactions tab.'
        }
        schema={stakeholderSchema}
        fields={FIELDS}
        defaultValues={
          editing
            ? {
                name: editing.name,
                email: editing.email ?? '',
                entityType: editing.entityType,
                country: editing.country ?? '',
                isFounder: Boolean(editing.isFounder),
                notes: editing.notes ?? '',
              }
            : EMPTY
        }
        onSubmit={save}
        submitLabel={editing ? 'Save changes' : 'Add stakeholder'}
      />

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Remove ${pendingDelete?.name ?? 'stakeholder'}?`}
        description={
          pendingDelete && holdsShares(pendingDelete.id)
            ? 'This stakeholder still holds shares. Removing the identity leaves those issuances orphaned and they will drop out of the cap table — cancel or transfer the shares first if you want the totals to stay correct.'
            : 'This removes the stakeholder record. The audit trail keeps a copy of what was deleted.'
        }
        onConfirm={remove}
      />
    </TabSection>
  );
}
