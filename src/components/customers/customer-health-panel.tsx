'use client';

/**
 * Customer book integrity, as a tab on the customers page.
 *
 * Mirrors the Inventory page's Health tab deliberately — same shape, same
 * clickable-tile-sets-the-filter interaction — because a shopkeeper who has
 * learned one should not have to learn the other. Two differences, both on
 * purpose:
 *
 *  - **No score.** Inventory grades a catalogue out of 100 because a missing cost
 *    price is a spectrum. A duplicated customer is not: it is either two records
 *    for one person or it is not. `src/lib/customer-health.ts` explains why
 *    counting is honest here and grading is not.
 *  - **The duplicates get their own list, not just a filter.** A filtered table
 *    shows the flagged rows in whatever order the page is sorted, which is
 *    exactly the wrong shape for the decision being asked — "are these two the
 *    same person?" needs the two side by side.
 *
 * All arithmetic lives in the pure module; this file renders it and asks for
 * confirmation. Nothing here reads the clock.
 */

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Hash,
  Loader2,
  Merge,
  PhoneOff,
  Store,
  UserX,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Customer } from '@/types';
import {
  buildMergePlan,
  suggestFreeCode,
  realEmail,
  type CustomerHealthReport,
  type CustomerIssueKind,
  type DuplicateGroup,
} from '@/lib/customer-health';

export type HealthFilter = 'all' | CustomerIssueKind;

interface CustomerHealthPanelProps {
  report: CustomerHealthReport;
  currencySymbol: string;
  activeFilter: HealthFilter;
  onFilterChange: (filter: HealthFilter) => void;
  /** Queue the merge. The panel has already confirmed it with the user. */
  onMerge: (group: DuplicateGroup) => void | Promise<void>;
  /** Queue a new code for one member of a code collision. */
  onRecode: (customer: Customer, newCode: string) => void | Promise<void>;
  /** Every code in the book, normalised — so a suggested code cannot collide. */
  codesInUse: Set<string>;
  busy?: boolean;
}

function Tile({
  label,
  value,
  icon: Icon,
  active,
  tone = 'neutral',
  onClick,
  hint,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  active: boolean;
  tone?: 'critical' | 'warning' | 'neutral';
  onClick: () => void;
  hint?: string;
}) {
  const toneRing =
    tone === 'critical'
      ? 'border-destructive/50 bg-destructive/5'
      : tone === 'warning'
        ? 'border-amber-500/50 bg-amber-500/5'
        : 'border-transparent';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={cn(
        'rounded-lg border p-4 text-start transition-all hover:bg-muted/50',
        active
          ? 'border-orange-500/50 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent shadow-[inset_0_0_20px_rgba(249,115,22,0.15)]'
          : value > 0
            ? toneRing
            : 'border-transparent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</span>
        <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <span className="mt-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </button>
  );
}

/** How a customer is identified in a duplicate row — name plus whatever else is on file. */
function MemberLine({
  customer,
  currencySymbol,
  isPrimary,
}: {
  customer: Customer;
  currencySymbol: string;
  isPrimary: boolean;
}) {
  const email = realEmail(customer);
  return (
    <div
      className={cn(
        'flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md px-3 py-2 text-sm',
        isPrimary ? 'bg-primary/5 border border-primary/20' : 'bg-muted/40',
      )}
    >
      <span className="font-medium">{customer.name?.trim() || 'Unnamed customer'}</span>
      {isPrimary && (
        <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
          Keeps this one
        </Badge>
      )}
      {customer.code && <span className="font-mono text-xs text-muted-foreground">{customer.code}</span>}
      {customer.phone && <span className="text-xs text-muted-foreground">{customer.phone}</span>}
      {email && <span className="text-xs text-muted-foreground">{email}</span>}
      <span className="ms-auto text-xs tabular-nums text-muted-foreground">
        {currencySymbol}
        {(customer.totalSpent || 0).toLocaleString()}
        {(customer.loyaltyPoints || 0) > 0 && ` · ${customer.loyaltyPoints} pts`}
      </span>
    </div>
  );
}

const GROUP_COPY: Record<
  DuplicateGroup['kind'],
  { title: string; blurb: string; certain: boolean }
> = {
  'duplicate-code': {
    title: 'Same customer code',
    blurb:
      'A code has to point at one person. While two records share one, looking a customer up by code returns the wrong one — so give one of them a different code. These may well be two different people, so nothing is merged here.',
    certain: true,
  },
  'duplicate-phone': {
    title: 'Same phone number',
    blurb: 'Almost certainly one person entered twice. Merging keeps the record with the spend and adds the other one to it.',
    certain: true,
  },
  'duplicate-email': {
    title: 'Same email address',
    blurb: 'One person entered twice. Merging keeps the record with the spend and adds the other one to it.',
    certain: true,
  },
  'duplicate-name': {
    title: 'Same name',
    blurb:
      'Possibly one person entered twice — but two customers really can share a name. Check the phone, code and spend below before merging.',
    certain: false,
  },
};

export default function CustomerHealthPanel({
  report,
  currencySymbol,
  activeFilter,
  onFilterChange,
  onMerge,
  onRecode,
  codesInUse,
  busy,
}: CustomerHealthPanelProps) {
  const [pendingMerge, setPendingMerge] = React.useState<DuplicateGroup | null>(null);

  const { counts } = report;
  const duplicatePeople = counts.duplicatePhones + counts.duplicateEmails + counts.duplicateNames;

  const plan = pendingMerge ? buildMergePlan(pendingMerge.members) : null;
  const planPrimary = plan ? pendingMerge!.members.find(m => m.id === plan.primaryId) : null;

  if (report.examined === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <p className="font-medium">No customers on file yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add or import customers and this tab will check them for duplicates, code clashes and
            missing contact details.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {report.affected === 0 ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Your customer book looks clean
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {report.affected.toLocaleString()} of {report.examined.toLocaleString()} customers
                need a look
              </>
            )}
          </CardTitle>
          <CardDescription>
            {report.affected === 0
              ? `Checked all ${report.examined.toLocaleString()} records for duplicate codes, phones, emails and names, and for missing contact details.`
              : report.redundantRecords > 0
                ? `Merging every duplicate below would retire ${report.redundantRecords.toLocaleString()} record${report.redundantRecords === 1 ? '' : 's'}. Nothing is changed until you confirm each one.`
                : 'Nothing is changed until you confirm each fix.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile
              label="All issues"
              value={report.affected}
              icon={AlertTriangle}
              active={activeFilter === 'all'}
              onClick={() => onFilterChange('all')}
              hint="Every customer carrying at least one issue. Not the sum of the other tiles — one record can have several."
            />
            <Tile
              label="Code clashes"
              value={counts.duplicateCodes}
              icon={Hash}
              tone="critical"
              active={activeFilter === 'duplicate-code'}
              onClick={() => onFilterChange('duplicate-code')}
              hint="Groups of customers sharing one code. Lookup by code is broken while this stands."
            />
            <Tile
              label="Likely duplicates"
              value={duplicatePeople}
              icon={Copy}
              tone="warning"
              active={activeFilter === 'duplicate-phone'}
              onClick={() => onFilterChange('duplicate-phone')}
              hint="Groups matching on phone, email or name."
            />
            <Tile
              label="No contact"
              value={counts.noContact}
              icon={PhoneOff}
              active={activeFilter === 'no-contact'}
              onClick={() => onFilterChange('no-contact')}
              hint="No phone and no real email, so they cannot be reached or looked up."
            />
            <Tile
              label="Fake emails"
              value={counts.placeholderEmails}
              icon={Mail}
              active={activeFilter === 'placeholder-email'}
              onClick={() => onFilterChange('placeholder-email')}
              hint="Placeholder addresses an older CSV import invented. They reach nobody."
            />
            {counts.noBranch > 0 ? (
              <Tile
                label="No branch"
                value={counts.noBranch}
                icon={Store}
                tone="critical"
                active={activeFilter === 'no-branch'}
                onClick={() => onFilterChange('no-branch')}
                hint="Not assigned to any branch, so no branch's customer list shows them."
              />
            ) : (
              <Tile
                label="Unnamed"
                value={counts.missingNames}
                icon={UserX}
                tone="warning"
                active={activeFilter === 'missing-name'}
                onClick={() => onFilterChange('missing-name')}
                hint="Blank name. Impossible to find at the till."
              />
            )}
          </div>
        </CardContent>
      </Card>

      {report.groups.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {report.groups.length.toLocaleString()} duplicate group
              {report.groups.length === 1 ? '' : 's'}
            </CardTitle>
            <CardDescription>
              Each group is one decision. The record with the most money spent is kept, because that
              is the one the receipts and the loyalty balance belong to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[32rem] pe-3">
              <div className="space-y-4">
                {report.groups.map((group, i) => {
                  const copy = GROUP_COPY[group.kind];
                  return (
                    <div
                      key={`${group.kind}-${group.members.map(m => m.id).join('-')}-${i}`}
                      className="rounded-lg border p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{copy.title}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                group.kind === 'duplicate-code'
                                  ? 'border-destructive/40 text-destructive'
                                  : 'border-amber-500/40 text-amber-600 dark:text-amber-400',
                              )}
                            >
                              {group.value || '(blank)'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {group.members.length} records
                            </span>
                          </div>
                          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{copy.blurb}</p>
                        </div>

                        {group.kind === 'duplicate-code' ? (
                          <div className="flex flex-wrap gap-2">
                            {group.members.slice(1).map(m => {
                              const suggested = suggestFreeCode(group.value, codesInUse);
                              return (
                                <Button
                                  key={m.id}
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  disabled={busy}
                                  onClick={() => onRecode(m, suggested)}
                                >
                                  <Hash className="me-1 h-3.5 w-3.5" />
                                  Give {firstWord(m.name)} {suggested}
                                </Button>
                              );
                            })}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant={copy.certain ? 'default' : 'outline'}
                            className="h-8"
                            disabled={busy}
                            onClick={() => setPendingMerge(group)}
                          >
                            {busy ? (
                              <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Merge className="me-1 h-3.5 w-3.5" />
                            )}
                            Merge {group.members.length}
                          </Button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {group.members.map((m, idx) => (
                          <MemberLine
                            key={m.id}
                            customer={m}
                            currencySymbol={currencySymbol}
                            isPrimary={idx === 0 && group.kind !== 'duplicate-code'}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!pendingMerge} onOpenChange={open => !open && setPendingMerge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Merge into {planPrimary?.name?.trim() || 'this customer'}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  {plan?.duplicateIds.length} record
                  {plan?.duplicateIds.length === 1 ? '' : 's'} will be deleted. Their spend and
                  loyalty points are added to the record that is kept, and any phone, email, code or
                  note only they had is copied across.
                </p>
                {plan && (
                  <ul className="space-y-1 rounded-md bg-muted/50 p-3 text-xs">
                    <li>
                      Total spent becomes{' '}
                      <span className="font-medium tabular-nums">
                        {currencySymbol}
                        {(plan.values.totalSpent || 0).toLocaleString()}
                      </span>
                    </li>
                    <li>
                      Loyalty points become{' '}
                      <span className="font-medium tabular-nums">
                        {(plan.values.loyaltyPoints || 0).toLocaleString()}
                      </span>
                    </li>
                    {plan.values.phone && <li>Phone {plan.values.phone} is adopted</li>}
                    {plan.values.email && <li>Email {plan.values.email} is adopted</li>}
                    {plan.values.code && <li>Code {plan.values.code} is adopted</li>}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  Past receipts are not changed. Each one keeps the customer details that were
                  printed on it, because a receipt is a record of what was handed over.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMerge) onMerge(pendingMerge);
                setPendingMerge(null);
              }}
            >
              Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Next free code in whatever scheme the shop already types — see
 * `suggestFreeCode` in the pure module for the rule.
 */
function firstWord(name: string | undefined): string {
  const w = (name || '').trim().split(/\s+/)[0];
  return w || 'this record';
}
