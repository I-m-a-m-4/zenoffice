'use client';

/**
 * Getting cost prices onto a catalogue that has none.
 *
 * Three ways in, in one dialog, ordered by how little work they are — see
 * `src/lib/import/cost-prices.ts` for why the ordering is the whole design. The thing
 * this screen is fighting is not a missing feature, it is despair: a shop with 1,200
 * products and no cost prices closes any screen that implies 1,200 pieces of work. So
 * the first thing it shows is not a form, it is **how much of their money is currently
 * unexplained**, and every path from there is finite.
 *
 * The engine is pure and lives in `cost-prices.ts`. This file renders it and queues the
 * writes; it does no matching and no arithmetic of its own.
 */

import * as React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  Check,
  ClipboardPaste,
  Coins,
  ListChecks,
  Loader2,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { usePOS } from '@/context/pos-context';
import { cn } from '@/lib/utils';
import {
  applyAiCostMatches,
  buildCostWrites,
  costMatchQueue,
  coverage,
  fillQueue,
  matchCostLines,
  parseCostList,
  unitsSoldFrom,
  unresolvedCostRows,
  type CostGap,
  type CostRow,
} from '@/lib/import/cost-prices';
import {
  bulkOpClauses,
  describeBulkOp,
  groupWrites,
  previewBulkOp,
  type BulkOp,
  type BulkSkip,
} from '@/lib/import/bulk-ops';
import { aiMatchProducts, AiCreditsError, ImportAiError } from '@/lib/import/client';
import { estimateCredits } from '@/lib/import/pricing';
import { bulkSkipKey, matchExplanationKey } from '@/lib/i18n/import-labels';
import { useI18n, type TranslateFn } from '@/context/i18n-context';

type Mode = 'sweep' | 'queue' | 'list';

/**
 * The preview sentence, translated where a key exists.
 *
 * `bulkOpClauses` covers only the two cost-derivation modes this dialog can produce, and
 * returns `null` for anything else — the other 29 action shapes are reachable from the
 * bulk-edit dialog and would cost ~300 translations for a screen this pass has not
 * reached. So the fallback is the English `describeBulkOp`, which is what the whole app
 * showed until now: a missing translation is not a regression here.
 *
 * Two slots rather than one concatenation because the scope carries its own preposition
 * ("for every product") and a translation may need it first.
 */
function bulkOpSentence(op: BulkOp, t: TranslateFn, currencySymbol: string): string {
  const clauses = bulkOpClauses(op);
  if (!clauses) return describeBulkOp(op, currencySymbol);
  return t('inventory.bulkOpSentence', {
    action: t(clauses.action.key, clauses.action.vars),
    scope: t(clauses.scope.key, clauses.scope.vars),
  });
}

/** The first skip reason, translated from its code. */
function firstSkipReason(skipped: BulkSkip[], t: TranslateFn): string {
  const first = skipped[0];
  return first ? t(bulkSkipKey(first.code)) : '';
}

export default function CostPriceDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { t } = useI18n();
  const { products, receipts, currencySymbol, addToQueue, triggerRefresh } = usePOS();

  const [mode, setMode] = React.useState<Mode>('queue');
  const [error, setError] = React.useState<string | null>(null);

  const catalogue = React.useMemo(() => products ?? [], [products]);

  /*
   * Units sold, from the receipts the POS context already holds.
   *
   * That listener is capped, so this measures recent activity rather than lifetime sales
   * — the same capped-window caveat the rating's dormant buyers and the overdue-credit
   * figure both carry. It is the right input anyway: the question is which cost prices
   * matter *now*, and a product that sold well two years ago and not since is correctly
   * ranked low.
   */
  const soldUnits = React.useMemo(() => unitsSoldFrom(receipts ?? []), [receipts]);
  const cover = React.useMemo(() => coverage(catalogue, soldUnits), [catalogue, soldUnits]);

  const categories = React.useMemo(
    () => [...new Set(catalogue.map((p) => p.category).filter(Boolean) as string[])].sort(),
    [catalogue],
  );

  const close = (open: boolean) => {
    if (!open) setError(null);
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            {t('inventory.costPricesTitle')}
          </DialogTitle>
          <DialogDescription>{t('inventory.costPricesDesc')}</DialogDescription>
        </DialogHeader>

        {/* The number that makes this worth starting. */}
        <div className="shrink-0 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">
              {t('inventory.costCoverage', { percent: cover.percentKnown })}
            </p>
            <span className="text-xs text-muted-foreground">
              {currencySymbol}
              {Math.round(cover.missing).toLocaleString()} {t('inventory.costUnexplained')}
            </span>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-emerald-500"
              style={{ width: `${pct(cover.known, cover)}%` }}
              title={t('inventory.costBarKnown')}
            />
            <div
              className="bg-amber-400"
              style={{ width: `${pct(cover.estimated, cover)}%` }}
              title={t('inventory.costBarEstimated')}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {t('inventory.costBarLegend')}
          </p>
        </div>

        <div className="flex shrink-0 gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { id: 'queue' as const, label: t('inventory.costTabQueue'), icon: ListChecks },
              { id: 'sweep' as const, label: t('inventory.costTabSweep'), icon: Calculator },
              { id: 'list' as const, label: t('inventory.costTabList'), icon: ClipboardPaste },
            ]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id);
                setError(null);
              }}
              aria-pressed={mode === tab.id}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                mode === tab.id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex shrink-0 items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <p>{error}</p>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-0.5">
          {mode === 'queue' && (
            <FillQueue
              gaps={fillQueue(catalogue, soldUnits, { limit: 40 })}
              currencySymbol={currencySymbol}
              onSave={(entries) => {
                let queued = 0;
                for (const [productId, cost] of entries) {
                  const id = addToQueue(
                    {
                      type: 'update-product',
                      // `costPriceEstimated: false` is not noise — a product previously
                      // filled by a margin sweep must stop being marked as a guess once a
                      // human types the real figure.
                      payload: { productId, values: { costPrice: cost, costPriceEstimated: false } },
                    },
                    'Setting a cost price',
                  );
                  if (id) queued++;
                }
                if (queued === 0) {
                  setError(t('inventory.costQueueNoPermission'));
                  return;
                }
                triggerRefresh();
                toast({
                  variant: 'success',
                  title: t('inventory.costSavedTitle'),
                  description: t('inventory.costSavedBody', { count: queued }),
                });
              }}
            />
          )}

          {mode === 'sweep' && (
            <MarginSweep
              categories={categories}
              currencySymbol={currencySymbol}
              onApply={(op) => {
                const preview = previewBulkOp(catalogue, op);
                if (preview.changes.length === 0) {
                  setError(
                    preview.skipped.length > 0
                      ? t('inventory.costNothingToFill', {
                          count: preview.skipped.length,
                          reason: firstSkipReason(preview.skipped, t),
                        })
                      : t('inventory.costNoMatch'),
                  );
                  return null;
                }
                return preview;
              }}
              onCommit={(preview) => {
                let queued = 0;
                for (const group of groupWrites(preview)) {
                  // `describeBulkOp` stays English here on purpose: this string is the
                  // queued action's description and the audit-log entry, read later —
                  // possibly by the owner rather than whoever ran the sweep, and after
                  // either of them may have switched language. The on-screen copy above
                  // is translated; the record is not.
                  const id =
                    group.productIds.length === 1
                      ? addToQueue(
                          { type: 'update-product', payload: { productId: group.productIds[0], values: group.value } },
                          describeBulkOp(preview.op, currencySymbol),
                        )
                      : addToQueue(
                          { type: 'bulk-update-products', payload: { productIds: group.productIds, values: group.value } },
                          `${describeBulkOp(preview.op, currencySymbol)} (${group.productIds.length} products)`,
                        );
                  if (id) queued++;
                }
                if (queued === 0) {
                  setError(t('inventory.costQueueFailed'));
                  return;
                }
                triggerRefresh();
                toast({
                  variant: 'success',
                  title: t('inventory.costEstimatesAppliedTitle'),
                  description: t('inventory.costEstimatesAppliedBody', {
                    count: preview.changes.length.toLocaleString(),
                  }),
                });
                onOpenChange(false);
              }}
            />
          )}

          {mode === 'list' && (
            <PasteList
              currencySymbol={currencySymbol}
              catalogue={catalogue}
              onError={setError}
              onCommit={(rows) => {
                const writes = buildCostWrites(rows, catalogue);
                if (writes.length === 0) {
                  setError(t('inventory.costNothingToChange'));
                  return;
                }
                let queued = 0;
                for (const write of writes) {
                  const id = addToQueue(
                    {
                      type: 'update-product',
                      payload: {
                        productId: write.productId,
                        values: { costPrice: write.after, costPriceEstimated: false },
                      },
                    },
                    // English for the same reason as the sweep above — this is the record,
                    // not the screen.
                    `Cost price for ${write.productName}`,
                  );
                  if (id) queued++;
                }
                if (queued === 0) {
                  setError(t('inventory.costQueueFailed'));
                  return;
                }
                triggerRefresh();
                toast({
                  variant: 'success',
                  title: t('inventory.costSavedTitle'),
                  description: t('inventory.costSavedFromListBody', { count: queued }),
                });
                onOpenChange(false);
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function pct(part: number, cover: { known: number; estimated: number; missing: number }): number {
  const total = cover.known + cover.estimated + cover.missing;
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. The ones that matter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A short, ranked queue of gaps worth typing by hand.
 *
 * Keyboard-first because this is the one path that involves real typing: Enter moves to
 * the next field, so twenty numbers is twenty keystroke groups and no mouse. The
 * "why this one" line under each product is what stops it feeling arbitrary.
 */
function FillQueue({
  gaps,
  currencySymbol,
  onSave,
}: {
  gaps: CostGap[];
  currencySymbol: string;
  onSave: (entries: [string, number][]) => void;
}) {
  const { t } = useI18n();
  const [values, setValues] = React.useState<Record<string, string>>({});

  const filled = React.useMemo(
    () =>
      Object.entries(values)
        .map(([id, raw]) => [id, Number(raw)] as [string, number])
        .filter(([, cost]) => Number.isFinite(cost) && cost > 0),
    [values],
  );

  if (gaps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Check className="h-8 w-8 text-emerald-500" />
        <p className="text-sm font-medium">{t('inventory.costAllCovered')}</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {t('inventory.costAllCoveredHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('inventory.costQueueHint')}</p>

      <div className="overflow-hidden rounded-lg border">
        <ScrollArea className="max-h-[46vh]">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="text-xs">{t('inventory.costColProduct')}</TableHead>
                <TableHead className="w-24 text-xs">{t('inventory.costColSellsFor')}</TableHead>
                <TableHead className="w-32 text-xs">{t('inventory.costColYouPaid')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gaps.map((gap, index) => (
                <TableRow key={gap.product.id}>
                  <TableCell className="py-1.5">
                    <p className="text-xs font-medium leading-tight">{gap.product.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {gap.unitsSold > 0
                        ? t('inventory.costWhySold', {
                            units: gap.unitsSold.toLocaleString(),
                            amount: `${currencySymbol}${Math.round(gap.revenueAtStake).toLocaleString()}`,
                          })
                        : t('inventory.costWhyUnsold', {
                            count: (Number(gap.product.stock) || 0).toLocaleString(),
                          })}
                      {gap.estimated ? ` · ${t('inventory.costWhyEstimate')}` : ''}
                    </p>
                  </TableCell>
                  <TableCell className="py-1.5 text-xs text-muted-foreground">
                    {currencySymbol}
                    {(Number(gap.product.price) || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder="—"
                      className="h-8 text-sm"
                      value={values[gap.product.id] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [gap.product.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        // Enter advances rather than submitting: this is a data-entry run,
                        // and a form that saves on the first Enter loses the other 19.
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        const next = document.querySelector<HTMLInputElement>(
                          `[data-cost-row="${index + 1}"] input`,
                        );
                        next?.focus();
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {filled.length > 0
            ? t('inventory.costFilledIn', { count: filled.length })
            : t('inventory.costTypeEach')}
        </p>
        <Button disabled={filled.length === 0} onClick={() => onSave(filled)}>
          {filled.length > 0
            ? t('inventory.costSaveSome', { count: filled.length })
            : t('inventory.costSaveNone')}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Margin sweep
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fill hundreds of cost prices from one stated margin.
 *
 * The cheapest possible path and the one most likely to be misused, so the wording is
 * careful: it says **estimate** everywhere, it shows the preview before writing, and it
 * states plainly that products with a real cost are skipped. An owner who thinks this is
 * entering real cost prices will trust margin reports they should not.
 */
function MarginSweep({
  categories,
  currencySymbol,
  onApply,
  onCommit,
}: {
  categories: string[];
  currencySymbol: string;
  onApply: (op: BulkOp) => ReturnType<typeof previewBulkOp> | null;
  onCommit: (preview: ReturnType<typeof previewBulkOp>) => void;
}) {
  const { t } = useI18n();
  const ALL = '__all__';
  const [percent, setPercent] = React.useState('25');
  const [basis, setBasis] = React.useState<'margin' | 'markup'>('margin');
  const [category, setCategory] = React.useState<string>(ALL);
  const [preview, setPreview] = React.useState<ReturnType<typeof previewBulkOp> | null>(null);

  const build = (): BulkOp => ({
    field: 'costPrice',
    mode:
      basis === 'margin'
        ? { kind: 'cost-from-margin', percent: Number(percent) || 0 }
        : { kind: 'cost-from-markup', percent: Number(percent) || 0 },
    filter: category === ALL ? {} : { categories: [category] },
  });

  return (
    <div className="space-y-3">
      {/* The inline <strong> around "estimate" is dropped on purpose: `t()` returns a
          string and cannot carry a React node, and splitting the sentence into three
          keys to keep one bold word would force every translator to reproduce an
          English clause boundary. The word "estimate" appears twice more on this panel. */}
      <p className="text-xs text-muted-foreground">{t('inventory.costSweepHint')}</p>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            {t('inventory.costSweepOn')}
          </label>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPreview(null); }}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('inventory.costSweepEveryProduct')}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            {t('inventory.costSweepIMakeAbout')}
          </label>
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={99}
              value={percent}
              onChange={(e) => { setPercent(e.target.value); setPreview(null); }}
              className="h-9 pe-7 text-sm"
            />
            <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            {t('inventory.costSweepMeasuredAs')}
          </label>
          <Select value={basis} onValueChange={(v) => { setBasis(v as 'margin' | 'markup'); setPreview(null); }}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="margin">{t('inventory.costSweepOfPrice')}</SelectItem>
              <SelectItem value="markup">{t('inventory.costSweepOnCost')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Both readings of "25%" spelled out, because shopkeepers say it for both and the
          two give different costs. Showing the arithmetic is cheaper than explaining it. */}
      <p className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
        {t('inventory.costSweepExample', {
          price: `${currencySymbol}1,000`,
          cost: `${currencySymbol}${(basis === 'margin'
            ? Math.round(1000 * (1 - (Number(percent) || 0) / 100))
            : Math.round(1000 / (1 + (Number(percent) || 0) / 100))
          ).toLocaleString()}`,
        })}
      </p>

      {!preview ? (
        <Button className="w-full" onClick={() => setPreview(onApply(build()))}>
          {t('inventory.costSweepShowMe')}
          <ArrowRight className="ms-2 h-4 w-4" />
        </Button>
      ) : (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{bulkOpSentence(preview.op, t, currencySymbol)}</p>
            <Badge variant="secondary" className="text-[10px]">
              {t('inventory.costWillEstimate', { count: preview.changes.length.toLocaleString() })}
            </Badge>
          </div>

          {preview.skipped.length > 0 && (
            <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
              {t('inventory.costLeftAlone', {
                count: preview.skipped.length.toLocaleString(),
                reason: firstSkipReason(preview.skipped, t),
              })}
            </p>
          )}

          <div className="overflow-hidden rounded border">
            <ScrollArea className="max-h-48">
              <Table>
                <TableBody>
                  {preview.changes.slice(0, 100).map((change) => (
                    <TableRow key={change.productId}>
                      <TableCell className="truncate py-1 text-xs">{change.productName}</TableCell>
                      <TableCell className="w-28 py-1 text-xs font-medium">
                        {currencySymbol}
                        {Number(change.after).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreview(null)}>
              {t('inventory.costChangeIt')}
            </Button>
            <Button onClick={() => onCommit(preview)}>
              {t('inventory.costApplyTo', { count: preview.changes.length.toLocaleString() })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Paste a list
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "Coke 50cl - 380" × 200 lines, matched against the catalogue.
 *
 * Deterministic first: SKU, then normalised name, then size-aware similarity — all of it
 * `match.ts`, which already knows `50cl` is `500ml`. Only what is genuinely ambiguous
 * becomes a question, and AI is offered for those rather than imposed.
 */
function PasteList({
  currencySymbol,
  catalogue,
  onError,
  onCommit,
}: {
  currencySymbol: string;
  catalogue: any[];
  onError: (message: string | null) => void;
  onCommit: (rows: CostRow[]) => void;
}) {
  const { t } = useI18n();
  const [text, setText] = React.useState('');
  const [rows, setRows] = React.useState<CostRow[] | null>(null);
  const [unreadable, setUnreadable] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [creditsLeft, setCreditsLeft] = React.useState<number | null>(null);

  const read = () => {
    onError(null);
    const { lines, unreadable: bad } = parseCostList(text);
    if (lines.length === 0) {
      onError(t('inventory.costNoPairsRead'));
      return;
    }
    setUnreadable(bad);
    setRows(matchCostLines(lines, catalogue));
  };

  const open = rows ? unresolvedCostRows(rows) : [];
  const willSet = rows ? rows.filter((r) => r.decision.action === 'set').length : 0;

  const runAi = async () => {
    if (!rows) return;
    const queue = costMatchQueue(rows);
    if (queue.length === 0) return;
    setBusy(true);
    onError(null);
    try {
      const result = await aiMatchProducts(
        queue.map((item) => ({
          key: item.key,
          name: item.name,
          candidates: item.candidates.map((c) => ({
            productId: c.productId,
            name: c.productName,
            sku: c.productSku,
          })),
        })),
      );
      if (result.credits) setCreditsLeft(result.credits.remaining);
      setRows((prev) => (prev ? applyAiCostMatches(prev, result.verdicts, catalogue) : prev));
    } catch (err) {
      if (err instanceof AiCreditsError) onError(`${err.message}${err.hint ? ` ${err.hint}` : ''}`);
      else if (err instanceof ImportAiError) onError(err.message);
      else onError(t('inventory.costAiFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!rows) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('inventory.costPasteHint')}</p>
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          spellCheck={false}
          className="font-mono text-xs"
          // i18n-exempt — brand names and a "name - price" shape that reads the same
          // in every language; there is nothing here to translate.
          placeholder={'Coca-Cola 50cl - 380\nIndomie Chicken 70g - 190\nPeak Milk 400g - 3,600'}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t('inventory.costReadingIsFree')}</p>
          <Button disabled={!text.trim()} onClick={read}>
            {t('inventory.costMatchToProducts')}
            <ArrowRight className="ms-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {t('inventory.costCountMatched', { count: willSet })}
        </Badge>
        {open.length > 0 && (
          <Badge variant="outline" className="border-amber-500/50 text-[10px] text-amber-600 dark:text-amber-500">
            {t('inventory.costCountUnsure', { count: open.length })}
          </Badge>
        )}
        {unreadable.length > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {t('inventory.costCountUnreadable', { count: unreadable.length })}
          </Badge>
        )}
        <Button variant="ghost" size="sm" className="ms-auto h-7 text-xs" onClick={() => setRows(null)}>
          {t('inventory.costStartAgain')}
        </Button>
      </div>

      {open.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5">
          <p className="text-xs">{t('inventory.costAmbiguous', { count: open.length })}</p>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={runAi} disabled={busy}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {t('inventory.costLetAiDecide')}
            <span className="ms-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
              ~{estimateCredits('match', open.length)}
            </span>
          </Button>
        </div>
      )}
      {creditsLeft != null && (
        <p className="text-[11px] text-muted-foreground">
          {t('inventory.costCreditsLeft', { count: creditsLeft.toLocaleString() })}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border">
        <ScrollArea className="max-h-[40vh]">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="text-xs">{t('inventory.costColYourLine')}</TableHead>
                <TableHead className="text-xs">{t('inventory.costColMatchedTo')}</TableHead>
                <TableHead className="w-32 text-xs">{t('inventory.costColCost')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const target =
                  row.verdict.kind === 'certain'
                    ? row.verdict.match
                    : row.verdict.kind === 'possible'
                      ? row.verdict.candidates.find(
                          (c) => row.decision.action === 'set' && c.productId === row.decision.productId,
                        )
                      : undefined;

                return (
                  <TableRow key={row.line.key} className={cn(row.decision.action === 'skip' && 'opacity-60')}>
                    <TableCell className="py-1.5">
                      <p className="text-xs font-medium">{row.line.name}</p>
                    </TableCell>
                    <TableCell className="py-1.5">
                      {row.decision.action === 'skip' ? (
                        row.verdict.kind === 'possible' ? (
                          <div className="space-y-1">
                            {row.verdict.candidates.slice(0, 2).map((c) => (
                              <button
                                key={c.productId}
                                type="button"
                                onClick={() =>
                                  setRows((prev) =>
                                    prev
                                      ? prev.map((r) =>
                                          r.line.key === row.line.key
                                            ? {
                                                ...r,
                                                decision: { action: 'set', productId: c.productId },
                                                decidedByUser: true,
                                              }
                                            : r,
                                        )
                                      : prev,
                                  )
                                }
                                className="block w-full rounded border bg-background px-1.5 py-1 text-start text-[11px] hover:border-primary/60"
                              >
                                {c.productName}
                                <span className="ms-1 text-muted-foreground">
                                  · {t(matchExplanationKey(c.explanationCode), c.explanationVars)}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {t('inventory.costNoMatchSkipped')}
                          </span>
                        )
                      ) : (
                        <div>
                          <p className="text-xs">{target?.productName ?? '—'}</p>
                          {row.currentCost != null && (
                            <p className="text-[11px] text-muted-foreground">
                              {t('inventory.costWasAmount', {
                                amount: `${currencySymbol}${row.currentCost.toLocaleString()}`,
                              })}
                              {row.currentIsEstimate ? ` ${t('inventory.costIsEstimate')}` : ''}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <span className="text-xs font-medium">
                        {currencySymbol}
                        {(row.line.cost ?? 0).toLocaleString()}
                      </span>
                      {row.currentPrice != null &&
                        row.line.cost != null &&
                        row.line.cost >= row.currentPrice && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-500">
                            {t('inventory.costNotBelowPrice', {
                              price: `${currencySymbol}${row.currentPrice.toLocaleString()}`,
                            })}
                          </p>
                        )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t('inventory.costNothingSavedYet')}</p>
        <Button disabled={willSet === 0} onClick={() => onCommit(rows)}>
          {willSet > 0 ? t('inventory.costSetSome', { count: willSet }) : t('inventory.costSetNone')}
        </Button>
      </div>
    </div>
  );
}
