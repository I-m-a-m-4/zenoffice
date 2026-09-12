'use client';

/**
 * The review screen — the last thing between a messy file and the shop's catalogue.
 *
 * Everything about it is arranged around one claim: **duplicates should never
 * happen.** So the questions come first, above the table, and the Import button
 * counts them. A row Zeneva is unsure about is never resolved by scrolling past it —
 * the default is always "create a new product", which produces a visible duplicate
 * the owner can delete, rather than silently adding stock to the wrong line and
 * corrupting a figure they will trust for months.
 *
 * The other load-bearing control is the intent toggle at the top. The same file means
 * "these are my correct figures" or "these just arrived in a van" depending on why it
 * was opened, and no amount of cleverness can infer which from the numbers. It is
 * asked once, defaulted from the source, and never guessed per row.
 */

import * as React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CirclePlus,
  Loader2,
  PackagePlus,
  Pencil,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ImportIntent } from '@/lib/import/match';
import type { CommitPlan, MatchCandidate, RowDecision, StagedRow } from '@/lib/import/types';

export default function ReviewStep({
  rows,
  intent,
  plan,
  openQuestions,
  duplicateWarnings,
  skippedRows,
  notes,
  busy,
  matchQuote,
  creditsLeft,
  currencySymbol,
  limitMessage,
  onIntentChange,
  onDecide,
  onEdit,
  onRemove,
  onRunAiMatching,
  onCommit,
}: {
  rows: StagedRow[];
  intent: ImportIntent;
  plan: CommitPlan;
  openQuestions: StagedRow[];
  duplicateWarnings: { name: string; count: number }[];
  skippedRows: { row: number; reason: string }[];
  notes: string[];
  busy: string | null;
  matchQuote: number;
  creditsLeft: number | null;
  currencySymbol: string;
  limitMessage: string | null;
  onIntentChange: (intent: ImportIntent) => void;
  onDecide: (key: string, decision: RowDecision) => void;
  onEdit: (key: string, patch: Partial<StagedRow['draft']>) => void;
  onRemove: (key: string) => void;
  onRunAiMatching: () => void;
  onCommit: () => void;
}) {
  const [showOnlyIssues, setShowOnlyIssues] = React.useState(false);
  
  const matched = plan.addStock.length + plan.overwrite.length;
  const issueCount = rows.reduce((sum, row) => sum + row.draft.issues.length, 0);
  const hasMatchesOrQuestions = matched > 0 || openQuestions.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* ── What will happen ── */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary" className="gap-1">
          <CirclePlus className="h-3 w-3" /> {plan.create.length.toLocaleString()} new
        </Badge>
        {matched > 0 && (
          <Badge variant="secondary" className="gap-1">
            <RefreshCw className="h-3 w-3" /> {matched.toLocaleString()} already in your inventory
          </Badge>
        )}
        {plan.newCategories.length > 0 && (
          <Badge variant="outline" className="gap-1">
            {plan.newCategories.length} new categor{plan.newCategories.length === 1 ? 'y' : 'ies'}
          </Badge>
        )}
        {issueCount > 0 && (
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1 border-amber-500/50 text-amber-600 dark:text-amber-500 cursor-pointer hover:bg-amber-500/10 transition-colors",
              showOnlyIssues && "bg-amber-500/10 border-amber-500 font-bold"
            )}
            onClick={() => setShowOnlyIssues(!showOnlyIssues)}
          >
            <TriangleAlert className="h-3 w-3" /> {issueCount} to check {showOnlyIssues ? '(Filtered)' : ''}
          </Badge>
        )}
      </div>

      {/* ── Intent ── */}
      {hasMatchesOrQuestions && (
        <div className="rounded-lg border bg-muted/30 p-2.5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            For products you already have, what does this data mean?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <IntentOption
              active={intent === 'replace'}
              title="These are my correct figures"
              body="Update the products to match what is in this data."
              onClick={() => onIntentChange('replace')}
            />
            <IntentOption
              active={intent === 'restock'}
              title="These are goods I just received"
              body="Add these quantities on top of what is on hand."
              onClick={() => onIntentChange('restock')}
            />
          </div>
        </div>
      )}

      {/* ── Questions, above the table on purpose ── */}
      {openQuestions.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                {openQuestions.length} product{openQuestions.length === 1 ? '' : 's'} might already be
                in your inventory
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Answer these below, or leave them — anything unanswered is imported as a new
                product, never merged by guesswork.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onRunAiMatching}
              disabled={!!busy}
              className="shrink-0 gap-1.5"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Let AI decide
              <span className="ms-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">~{matchQuote}</span>
            </Button>
          </div>
          {creditsLeft != null && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {creditsLeft.toLocaleString()} credits left.
            </p>
          )}
        </div>
      )}

      {/* ── Rows ── */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        <div className="max-h-[46vh] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="min-w-[180px]">Product</TableHead>
                <TableHead className="w-36">Price</TableHead>
                <TableHead className="w-36">Cost</TableHead>
                <TableHead className="w-24">Stock</TableHead>
                {hasMatchesOrQuestions && <TableHead className="w-[150px]">What happens</TableHead>}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows
                .filter(row => showOnlyIssues ? row.draft.issues.length > 0 : true)
                .map((row) => (
                <ReviewRow
                  key={row.draft.key}
                  row={row}
                  intent={intent}
                  currencySymbol={currencySymbol}
                  hasMatchesOrQuestions={hasMatchesOrQuestions}
                  onDecide={onDecide}
                  onEdit={onEdit}
                  onRemove={onRemove}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Footnotes ── */}
      {(notes.length > 0 || skippedRows.length > 0 || duplicateWarnings.length > 0) && (
        <div className="space-y-1 text-xs text-muted-foreground">
          {notes.map((note, i) => (
            <p key={i}>{note}</p>
          ))}
          {skippedRows.length > 0 && (
            <p>
              {skippedRows.length} row{skippedRows.length === 1 ? '' : 's'} skipped —{' '}
              {[...new Set(skippedRows.map((s) => s.reason))].slice(0, 2).join('; ')}.
            </p>
          )}
          {duplicateWarnings.length > 0 && (
            <p className="text-amber-600 dark:text-amber-500">
              {duplicateWarnings.length} name
              {duplicateWarnings.length === 1 ? '' : 's'} appear more than once in this import (
              {duplicateWarnings.slice(0, 2).map((d) => d.name).join(', ')}
              ) — they will become separate products.
            </p>
          )}
        </div>
      )}

      {limitMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{limitMessage}</p>
        </div>
      )}

      {/* ── Commit ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Nothing is saved until you press Import.
        </p>
        <Button size="lg" onClick={onCommit} disabled={!!busy || rows.length === 0}>
          {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
          {commitLabel(plan)}
        </Button>
      </div>
    </div>
  );
}

/** "Import 247 products" — or the honest breakdown when it is not just creates. */
function commitLabel(plan: CommitPlan): string {
  const created = plan.create.length;
  const updated = plan.addStock.length + plan.overwrite.length;

  if (created > 0 && updated === 0) {
    return `Import ${created.toLocaleString()} product${created === 1 ? '' : 's'}`;
  }
  if (created === 0 && updated > 0) {
    return `Update ${updated.toLocaleString()} product${updated === 1 ? '' : 's'}`;
  }
  if (created === 0 && updated === 0) return 'Nothing to import';
  return `Import ${created.toLocaleString()} · Update ${updated.toLocaleString()}`;
}

function IntentOption({
  active,
  title,
  body,
  onClick,
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md border p-2 text-start transition-colors',
        active ? 'border-primary bg-primary/10' : 'bg-background hover:bg-muted/60',
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium">
        {active && <Check className="h-3 w-3 text-primary" />}
        {title}
      </span>
      <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{body}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One row
// ─────────────────────────────────────────────────────────────────────────────

function ReviewRow({
  row,
  intent,
  currencySymbol,
  hasMatchesOrQuestions,
  onDecide,
  onEdit,
  onRemove,
}: {
  row: StagedRow;
  intent: ImportIntent;
  currencySymbol: string;
  hasMatchesOrQuestions?: boolean;
  onDecide: (key: string, decision: RowDecision) => void;
  onEdit: (key: string, patch: Partial<StagedRow['draft']>) => void;
  onRemove: (key: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const { draft, verdict } = row;
  const asking = verdict.kind === 'possible' && !row.decidedByUser;

  return (
    <>
      <TableRow className={cn(asking && 'bg-amber-500/5')}>
        <TableCell className="align-top">
          {editing ? (
            <Input
              autoFocus
              defaultValue={draft.name}
              className="h-8"
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== draft.name) onEdit(draft.key, { name: next });
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="group flex items-start gap-1.5 text-start"
            >
              <span className="text-sm font-medium leading-tight">{draft.name}</span>
              <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
            {draft.sku && <span>Code {draft.sku}</span>}
            {draft.category && <span>{draft.category}</span>}
            {draft.baseUnit && <span>{draft.baseUnit}</span>}
          </div>
          {draft.issues.map((issue, i) => (
            <p
              key={i}
              className="mt-0.5 flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-500"
            >
              <TriangleAlert className="mt-0.5 h-2.5 w-2.5 shrink-0" />
              {issue.message}
            </p>
          ))}
        </TableCell>

        <TableCell className="align-top">
          <NumberCell
            value={draft.price}
            prefix={currencySymbol}
            onChange={(value) => onEdit(draft.key, { price: value })}
          />
        </TableCell>
        <TableCell className="align-top">
          <NumberCell
            value={draft.costPrice}
            prefix={currencySymbol}
            onChange={(value) => onEdit(draft.key, { costPrice: value })}
          />
        </TableCell>
        <TableCell className="align-top">
          <NumberCell
            value={draft.stock}
            integer
            onChange={(value) => onEdit(draft.key, { stock: value })}
          />
        </TableCell>

        {hasMatchesOrQuestions !== false && (
          <TableCell className="align-top">
            <Outcome row={row} intent={intent} />
          </TableCell>
        )}

        <TableCell className="align-top">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(draft.key)}
            aria-label={`Remove ${draft.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      </TableRow>

      {/* The duplicate question, inline under its row so the two are never confused. */}
      {asking && verdict.kind === 'possible' && (
        <TableRow className="bg-amber-500/5 hover:bg-amber-500/5">
          <TableCell colSpan={6} className="pt-0">
            <div className="space-y-2 rounded-md border border-amber-500/30 bg-background p-2.5">
              <p className="text-xs font-medium">
                You may already have this — imported quantity {draft.stock ?? 0}
              </p>
              {verdict.candidates.map((candidate) => (
                <CandidateRow
                  key={candidate.productId}
                  candidate={candidate}
                  importedStock={draft.stock ?? 0}
                  intent={intent}
                  currencySymbol={currencySymbol}
                  onChoose={(action) => onDecide(draft.key, { action, productId: candidate.productId } as RowDecision)}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-full gap-1.5 text-xs"
                onClick={() => onDecide(draft.key, { action: 'create' })}
              >
                <CirclePlus className="h-3 w-3" />
                None of these — create a new product
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * One existing product the row might be.
 *
 * Shows the barcode when there is one, because a barcode is the fact that settles the
 * question — and it is deliberately given more room than the similarity score, which
 * is only an opinion.
 */
function CandidateRow({
  candidate,
  importedStock,
  intent,
  currencySymbol,
  onChoose,
}: {
  candidate: MatchCandidate;
  importedStock: number;
  intent: ImportIntent;
  currencySymbol: string;
  onChoose: (action: 'add-stock' | 'overwrite') => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/30 p-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{candidate.productName}</p>
        <p className="text-[11px] text-muted-foreground">
          {candidate.productSku ? `Barcode ${candidate.productSku} · ` : ''}
          Existing stock: {candidate.productStock.toLocaleString()}
          {typeof candidate.productPrice === 'number'
            ? ` · ${currencySymbol}${candidate.productPrice.toLocaleString()}`
            : ''}
          {' · '}
          {candidate.explanation}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => onChoose('add-stock')}>
          <PackagePlus className="h-3 w-3" />
          Add {importedStock.toLocaleString()} to stock
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={() => onChoose('overwrite')}
        >
          <RefreshCw className="h-3 w-3" />
          {intent === 'restock' ? 'Replace instead' : 'Update this one'}
        </Button>
      </div>
    </div>
  );
}

/** What this row will do, in the fewest words that are still true. */
function Outcome({ row, intent }: { row: StagedRow; intent: ImportIntent }) {
  const { verdict, decision } = row;

  if (decision.action === 'skip') {
    return <span className="text-xs text-muted-foreground">Skipped</span>;
  }

  if (decision.action === 'create') {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
        <CirclePlus className="h-3 w-3" /> New product
      </span>
    );
  }

  const target =
    verdict.kind === 'certain'
      ? verdict.match
      : verdict.kind === 'possible'
        ? verdict.candidates.find((c) => c.productId === (decision as any).productId)
        : undefined;

  if (decision.action === 'add-stock') {
    const before = target?.productStock ?? 0;
    const added = row.draft.stock ?? 0;
    return (
      <span className="text-xs">
        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <PackagePlus className="h-3 w-3" /> Add to existing
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {before.toLocaleString()} → {(before + added).toLocaleString()}
        </span>
      </span>
    );
  }

  return (
    <span className="text-xs">
      <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
        <RefreshCw className="h-3 w-3" /> Update existing
      </span>
      {target && (
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground" title={target.productName}>
          {target.productName}
        </span>
      )}
    </span>
  );
}

/**
 * An inline numeric cell.
 *
 * Uncontrolled with a `key` tied to the incoming value, so an external change (an AI
 * re-read, a mapping change) refreshes it, while typing is never fought over by a
 * re-render mid-keystroke. A cleared field means "no value", which is different from
 * zero and is what `undefined` carries through to the commit.
 */
function NumberCell({
  value,
  prefix,
  integer,
  onChange,
}: {
  value?: number;
  prefix?: string;
  integer?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        key={String(value ?? '')}
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        min={0}
        step={integer ? 1 : 'any'}
        defaultValue={value ?? ''}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (raw === '') {
            onChange(undefined);
            return;
          }
          const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
          if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
        }}
        className={cn(
          'h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
        )}
        style={prefix ? { paddingLeft: `calc(0.5rem + ${prefix.length + 1}ch)` } : undefined}
      />
    </div>
  );
}
