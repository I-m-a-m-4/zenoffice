'use client';

/**
 * The two screens between reading a file and writing anything: the column mapping,
 * and the row-by-row review.
 *
 * The review screen is the whole promise of the importer — *you check it before
 * anything is saved* — so two things about it are deliberate rather than incidental.
 *
 * **Questions come first.** Rows Zeneva is unsure about are sorted to the top, because
 * a migration is three thousand rows and the four that need a human decision are
 * otherwise on screen 40. The product importer renders in file order, which is
 * defensible for a hundred products and is not for a customer book.
 *
 * **The list is capped, and says so.** Every row carries editable inputs, and three
 * thousand of those mounted at once locks the tab on the low-end Android hardware this
 * runs on. `VISIBLE_STEP` more appear on request. The cap is stated on screen rather
 * than being silent — a truncated list that looks complete is how somebody imports
 * half a book and believes they checked it.
 */

import * as React from 'react';
import { AlertTriangle, ChevronDown, Sparkles, TriangleAlert, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CUSTOMER_FIELD_LABELS,
  CUSTOMER_IMPORT_FIELDS,
  type CustomerImportField,
  type CustomerMappingResult,
  type StagedCustomerRow,
  type CustomerRowDecision,
  type DraftCustomer,
} from '@/lib/import/customers';

/** How many rows are drawn at once, and how many more each press adds. */
const VISIBLE_STEP = 60;

/** The sentinel for "ignore this column" — `Select` cannot carry a null value. */
const IGNORE = '__ignore__';

// ─────────────────────────────────────────────────────────────────────────────
// Mapping
// ─────────────────────────────────────────────────────────────────────────────

export function CustomerMappingReview({
  mapping,
  table,
  onChange,
  onRunAi,
  onContinue,
  busy,
  quote,
  creditsLeft,
}: {
  mapping: CustomerMappingResult;
  table: { headers: string[]; rows: string[][]; hasHeaderRow: boolean } | null;
  onChange: (index: number, field: CustomerImportField | null) => void;
  onRunAi: () => void;
  onContinue: () => void;
  busy: string | null;
  quote: number;
  creditsLeft: number | null;
}) {
  const hasName = mapping.columns.some((c) => c.field === 'name');
  const unplaced = mapping.columns.filter((c) => !c.field).length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Check the columns</h3>
        <p className="text-sm text-muted-foreground">
          {hasName
            ? 'Zeneva worked these out. Change anything it got wrong — this part is free.'
            : 'Tell Zeneva which column holds the customer name. That is the only one it needs.'}
        </p>
      </div>

      {!hasName && unplaced > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">
            Or let AI read the headings for you — about {quote} credit{quote === 1 ? '' : 's'}
            {creditsLeft != null ? `, you have ${creditsLeft.toLocaleString()}` : ''}.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onRunAi} disabled={!!busy}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Work it out for me
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {mapping.columns.map((column) => {
          const samples = (table?.rows ?? [])
            .slice(0, 3)
            .map((row) => row[column.index])
            .filter((v) => v && String(v).trim());

          return (
            <div
              key={column.index}
              className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{column.source}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {samples.length ? samples.join(' · ') : 'This column is empty'}
                </p>
              </div>
              <Select
                value={column.field ?? IGNORE}
                onValueChange={(value) => onChange(column.index, value === IGNORE ? null : (value as CustomerImportField))}
              >
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={IGNORE}>Ignore this column</SelectItem>
                  {CUSTOMER_IMPORT_FIELDS.map((field) => (
                    <SelectItem key={field} value={field}>
                      {CUSTOMER_FIELD_LABELS[field]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={onContinue} disabled={!hasName || !!busy}>
          Continue
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Review
// ─────────────────────────────────────────────────────────────────────────────

export function CustomerReviewStep({
  rows,
  plan,
  openQuestions,
  skippedRows,
  notes,
  onDecide,
  onEdit,
  onRemove,
  onCommit,
  busy,
}: {
  rows: StagedCustomerRow[];
  plan: { create: StagedCustomerRow[]; update: StagedCustomerRow[]; skipped: StagedCustomerRow[] };
  openQuestions: StagedCustomerRow[];
  skippedRows: number;
  notes: string[];
  onDecide: (key: string, decision: CustomerRowDecision) => void;
  onEdit: (key: string, patch: Partial<DraftCustomer>) => void;
  onRemove: (key: string) => void;
  onCommit: () => void;
  busy: string | null;
}) {
  const [visible, setVisible] = React.useState(VISIBLE_STEP);

  /*
   * Unanswered questions first, then everything in file order.
   *
   * A stable sort, so rows that need nothing stay in the order the file had them —
   * somebody checking their own spreadsheet against this screen is reading down their
   * own rows, and shuffling those would make the check impossible.
   */
  const ordered = React.useMemo(() => {
    const needsAnswer = (row: StagedCustomerRow) => row.verdict.kind === 'possible' && !row.decidedByUser;
    return [...rows].sort((a, b) => Number(needsAnswer(b)) - Number(needsAnswer(a)));
  }, [rows]);

  const shown = ordered.slice(0, visible);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Count label="New" value={plan.create.length} tone="primary" />
        <Count label="Updating" value={plan.update.length} tone="muted" />
        <Count label="Skipping" value={plan.skipped.length} tone="muted" />
      </div>

      {notes.map((note, i) => (
        <p key={i} className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
          {note}
        </p>
      ))}

      {skippedRows > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {skippedRows.toLocaleString()} row{skippedRows === 1 ? '' : 's'} had no name against
          {skippedRows === 1 ? ' it' : ' them'} and{skippedRows === 1 ? ' was' : ' were'} left out — a
          customer with no name cannot be found at the till.
        </p>
      )}

      {openQuestions.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {openQuestions.length} row{openQuestions.length === 1 ? '' : 's'} might already be on file.
            </span>{' '}
            They are at the top. Anything you leave alone will be added as a new customer — Zeneva
            never merges two records on a guess, because a duplicate you can see is easy to fix and a
            wrong merge is not.
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        <div className="max-h-[46vh] overflow-y-auto p-2">
          <div className="space-y-2">
            {shown.map((row) => (
              <ReviewRow 
                key={row.draft.key} 
                row={row} 
                hasMatchesOrQuestions={plan.update.length > 0 || openQuestions.length > 0}
                onDecide={onDecide} 
                onEdit={onEdit} 
                onRemove={onRemove} 
              />
            ))}
          </div>

          {ordered.length > shown.length && (
            <div className="mt-4 space-y-1.5 pb-2 text-center">
              <Button type="button" variant="outline" size="sm" onClick={() => setVisible((v) => v + VISIBLE_STEP)}>
                <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
                Show {Math.min(VISIBLE_STEP, ordered.length - shown.length)} more
              </Button>
              <p className="text-xs text-muted-foreground">
                Showing {shown.length.toLocaleString()} of {ordered.length.toLocaleString()}. All of them
                will be imported — this list is shortened so the page stays quick.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-3">
        <Button type="button" onClick={onCommit} disabled={!!busy || plan.create.length + plan.update.length === 0}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Import {(plan.create.length + plan.update.length).toLocaleString()} customer
          {plan.create.length + plan.update.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: 'primary' | 'muted' }) {
  return (
    <div className={cn('rounded-lg border p-2.5 text-center', tone === 'primary' && 'border-primary/40 bg-primary/5')}>
      <p className={cn('text-lg font-semibold leading-tight', tone === 'primary' && 'text-primary')}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ReviewRow({
  row,
  hasMatchesOrQuestions,
  onDecide,
  onEdit,
  onRemove,
}: {
  row: StagedCustomerRow;
  hasMatchesOrQuestions?: boolean;
  onDecide: (key: string, decision: CustomerRowDecision) => void;
  onEdit: (key: string, patch: Partial<DraftCustomer>) => void;
  onRemove: (key: string) => void;
}) {
  const { draft, verdict, decision, decidedByUser } = row;
  const needsAnswer = verdict.kind === 'possible' && !decidedByUser;

  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border bg-card p-3',
        needsAnswer && 'border-amber-500/50 bg-amber-500/[0.03]',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
          <Input
            value={draft.name}
            onChange={(e) => onEdit(draft.key, { name: e.target.value })}
            className="h-8 text-sm font-medium"
            aria-label="Customer name"
          />
          <Input
            value={draft.phone ?? ''}
            onChange={(e) => onEdit(draft.key, { phone: e.target.value || undefined })}
            className="h-8 text-sm"
            placeholder="No phone"
            aria-label="Phone"
          />
          <Input
            value={draft.email ?? ''}
            onChange={(e) => onEdit(draft.key, { email: e.target.value || undefined })}
            className="h-8 text-sm"
            placeholder="No email"
            aria-label="Email"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          onClick={() => onRemove(draft.key)}
          aria-label={`Remove ${draft.name}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* What Zeneva concluded, and the control that overrides it. */}
      <div className="flex flex-wrap items-center gap-2">
        {hasMatchesOrQuestions !== false && verdict.kind === 'new' && (
          <Badge variant="outline" className="text-xs font-normal">
            New customer
          </Badge>
        )}

        {verdict.kind === 'certain' && (
          <>
            <Badge variant="secondary" className="text-xs font-normal">
              {verdict.match.explanation} as {verdict.match.customerName}
            </Badge>
            <Select
              value={decision.action}
              onValueChange={(value) =>
                onDecide(
                  draft.key,
                  value === 'update'
                    ? { action: 'update', customerId: verdict.match.customerId }
                    : value === 'skip'
                      ? { action: 'skip' }
                      : { action: 'create' },
                )
              }
            >
              <SelectTrigger className="h-7 w-auto gap-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="update">Fill in their blanks</SelectItem>
                <SelectItem value="create">Add as a separate customer</SelectItem>
                <SelectItem value="skip">Leave this row out</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {verdict.kind === 'possible' && (
          <>
            <span className="text-xs text-muted-foreground">
              {verdict.candidates[0]?.reason === 'in-file'
                ? 'Also appears earlier in this file'
                : `Might be ${verdict.candidates.map((c) => c.customerName).join(' or ')}`}
            </span>
            <Select
              value={decision.action === 'update' ? `update:${decision.customerId}` : decision.action}
              onValueChange={(value) =>
                onDecide(
                  draft.key,
                  value.startsWith('update:')
                    ? { action: 'update', customerId: value.slice('update:'.length) }
                    : value === 'skip'
                      ? { action: 'skip' }
                      : { action: 'create' },
                )
              }
            >
              <SelectTrigger className="h-7 w-auto gap-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create">Add as a new customer</SelectItem>
                {verdict.candidates
                  .filter((c) => c.customerId)
                  .map((c) => (
                    <SelectItem key={c.customerId} value={`update:${c.customerId}`}>
                      This is {c.customerName}
                    </SelectItem>
                  ))}
                <SelectItem value="skip">Leave this row out</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {draft.tags?.length ? (
          <span className="text-xs text-muted-foreground">{draft.tags.join(', ')}</span>
        ) : null}
      </div>

      {draft.issues.length > 0 && (
        <ul className="space-y-0.5">
          {draft.issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
