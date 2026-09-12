'use client';

/**
 * "We understood your file."
 *
 * The screen that replaces column mapping. Nobody should have to tell an inventory
 * system that `Selling` means selling price — so this does not ask, it *reports*,
 * and the owner's job is to glance and press Import.
 *
 * Two details carry most of the value:
 *
 * - **Every row shows a real value from the file.** "Selling → Selling price" is
 *   agreeable in the abstract; "Selling → Selling price · 1,200" is checkable. This
 *   is what catches a cost column read as a price, which is the one mistake here that
 *   silently corrupts every margin figure the shop ever reports.
 * - **Low-confidence guesses are marked.** A mapping from the alias table is a fact;
 *   one inferred from the values or from AI is a guess, and showing them identically
 *   discourages exactly the glance that catches the guess being wrong.
 *
 * AI is offered here, never required. There is always a dropdown.
 */

import * as React from 'react';
import { ArrowRight, Check, CircleHelp, Sparkles, Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  AI_MAPPING_THRESHOLD,
  FIELD_LABELS,
  IMPORT_FIELDS,
  type ColumnMapping,
  type ImportField,
  type MappingResult,
  type RawTable,
} from '@/lib/import/types';

/** `null` needs a stable value for the Select; empty string is not allowed by Radix. */
const IGNORE = '__ignore__';

export default function MappingReview({
  table,
  mapping,
  busy,
  quote,
  creditsLeft,
  onChange,
  onRunAi,
  onContinue,
  rowCount,
}: {
  table: RawTable;
  mapping: MappingResult;
  busy: string | null;
  quote: number;
  creditsLeft: number | null;
  onChange: (index: number, field: ImportField | null) => void;
  onRunAi: () => void;
  onContinue: () => void;
  rowCount: number;
}) {
  const mapped = mapping.columns.filter((c) => c.field !== null);
  const missingName = !mapped.some((c) => c.field === 'name');

  /** A value from the file for this column, so the mapping is checkable. */
  const sampleFor = React.useCallback(
    (index: number): string => {
      for (const row of table.rows.slice(0, 25)) {
        const value = String(row[index] ?? '').trim();
        if (value) return value.length > 28 ? `${value.slice(0, 27)}…` : value;
      }
      return '—';
    },
    [table.rows],
  );

  /** Columns already claimed, so the dropdown cannot create a duplicate mapping. */
  const claimed = React.useMemo(
    () => new Set(mapping.columns.map((c) => c.field).filter(Boolean) as ImportField[]),
    [mapping.columns],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          {missingName ? (
            <>
              <CircleHelp className="h-4 w-4 text-amber-500" />
              Which column is the product name?
            </>
          ) : (
            <>
              <Check className="h-4 w-4 text-emerald-500" />
              We understood your file
            </>
          )}
        </h3>
        <p className="text-sm text-muted-foreground">
          {missingName
            ? 'Zeneva needs to know which column holds the product name. Everything else it can work out.'
            : `${rowCount.toLocaleString()} row${rowCount === 1 ? '' : 's'} found${table.label ? ` in ${table.label}` : ''}. Check the matches below.`}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[1fr_auto_1.2fr] items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Your data</span>
          <span />
          <span>Zeneva</span>
        </div>

        <div className="max-h-[42vh] overflow-y-auto">
          <div className="divide-y">
            {mapping.columns.map((column) => (
              <MappingRow
                key={column.index}
                column={column}
                sample={sampleFor(column.index)}
                claimed={claimed}
                onChange={onChange}
              />
            ))}
          </div>
        </div>
      </div>

      {mapping.uncertain.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">
                {mapping.uncertain.length} column{mapping.uncertain.length === 1 ? '' : 's'} Zeneva
                could not place
              </p>
              <p className="text-xs text-muted-foreground">
                {mapping.uncertain
                  .slice(0, 4)
                  .map((c) => c.source)
                  .join(', ')}
                {mapping.uncertain.length > 4 ? ` and ${mapping.uncertain.length - 4} more` : ''}
                {' · '}
                Set them yourself above, or let AI read them.
              </p>
            </div>
            <Button size="sm" onClick={onRunAi} disabled={!!busy} className="gap-1.5 shrink-0">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Let AI read them
              <span className="ms-1 rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">
                ~{quote}
                {quote === 1 ? ' credit' : ' credits'}
              </span>
            </Button>
          </div>
          {creditsLeft != null && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {creditsLeft.toLocaleString()} credits left. Leaving a column unmapped is free and
              usually the right answer — Zeneva only needs the product name.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onContinue} disabled={missingName || !!busy} size="lg">
          {missingName ? 'Pick the name column' : `Continue with ${rowCount.toLocaleString()} rows`}
          <ArrowRight className="ms-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MappingRow({
  column,
  sample,
  claimed,
  onChange,
}: {
  column: ColumnMapping;
  sample: string;
  claimed: Set<ImportField>;
  onChange: (index: number, field: ImportField | null) => void;
}) {
  const isGuess = column.field !== null && column.via !== 'exact' && column.via !== 'alias' && column.via !== 'manual';
  const weak = column.field !== null && column.confidence < AI_MAPPING_THRESHOLD + 0.1;

  return (
    <div className="grid grid-cols-[1fr_auto_1.2fr] items-center gap-2 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{column.source}</p>
        <p className="truncate text-xs text-muted-foreground" title={sample}>
          {sample}
        </p>
      </div>

      <ArrowRight
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          column.field ? 'text-muted-foreground' : 'text-muted-foreground/30',
        )}
      />

      <div className="min-w-0 space-y-1">
        <Select
          value={column.field ?? IGNORE}
          onValueChange={(value) => onChange(column.index, value === IGNORE ? null : (value as ImportField))}
        >
          <SelectTrigger
            className={cn(
              'h-8 text-sm',
              !column.field && 'text-muted-foreground',
              weak && 'border-amber-500/60',
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={IGNORE}>Don&apos;t import this</SelectItem>
            {IMPORT_FIELDS.map((field) => (
              <SelectItem
                key={field}
                value={field}
                // Taken by another column. Not hidden — seeing it greyed out explains
                // why it is not offered, whereas an absent option looks like a bug.
                disabled={claimed.has(field) && column.field !== field}
              >
                {FIELD_LABELS[field]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isGuess && (
          <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-500">
            <TriangleAlert className="h-3 w-3 shrink-0" />
            {column.via === 'ai'
              ? 'AI worked this one out — worth a look'
              : column.via === 'value'
                ? 'Guessed from the values — worth a look'
                : 'Close match — worth a look'}
          </p>
        )}
      </div>
    </div>
  );
}
