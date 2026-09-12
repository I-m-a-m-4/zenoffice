'use client';

/**
 * Bulk editing by instruction: "raise all my drink costs 8%".
 *
 * The problem: a supplier raises prices and the owner has to touch a thousand cost
 * prices. Doing it one product at a time is not a real option, and the existing Bulk
 * Edit dialog only helps with the handful of rows they had already selected.
 *
 * The shape of the answer, which is the whole reason this is safe:
 *
 *   1. The instruction goes to the model, which returns **a rule, not values** — one
 *      small declarative operation (see `src/lib/import/bulk-ops.ts`).
 *   2. The rule is applied locally against the catalogue already in memory.
 *   3. Every single before→after pair is shown, with the skips and the reasons.
 *   4. Only what the owner approves is written, and it goes through `addToQueue`.
 *
 * So the model never names a product, never produces a number that gets written, and
 * never touches Firestore. It converts English into a rule; arithmetic and consent do
 * the rest. An AI-authored write nobody can inspect before it lands has no business
 * anywhere near a shop's price list.
 *
 * The sentence the owner approves is generated from the operation by
 * `describeBulkOp`, not from the model's own summary — if the description and the
 * write come from the same object they cannot disagree, whereas a model-authored
 * summary beside a model-authored op can describe a 5% rise and apply 50%.
 */

import * as React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Sparkles,
  TriangleAlert,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { usePOS } from '@/context/pos-context';
import { useFirestore } from '@/firebase';
import { logAuditEvent } from '@/lib/audit';
import { aiBulkOp, AiCreditsError, ImportAiError } from '@/lib/import/client';
import { estimateCredits } from '@/lib/import/pricing';
import {
  describeBulkOp,
  groupWrites,
  previewBulkOp,
  type BulkOp,
  type BulkPreview,
} from '@/lib/import/bulk-ops';

const EXAMPLES = [
  'Estimate cost prices at a 30% margin off selling price',
  'Raise all my cost prices by 8%',
  'Set a 35% margin on everything in Drinks',
  'Round all my selling prices to the nearest 50',
  'Cut prices 10% on anything with stock over 100',
  'Set stock to 0 for these products',
  'Set low-stock alert to 15 for these products',
];

export default function AiBulkEdit({
  selectedIds,
  onDone,
  initialInstruction = '',
}: {
  /** Products the owner has ticked. Substituted when the instruction says "these". */
  selectedIds: string[];
  onDone: () => void;
  initialInstruction?: string;
}) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { products, currencySymbol, addToQueue, currentUserProfile, triggerRefresh } = usePOS();

  const [instruction, setInstruction] = React.useState(initialInstruction);

  React.useEffect(() => {
    if (initialInstruction) {
      setInstruction(initialInstruction);
    }
  }, [initialInstruction]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<BulkPreview | null>(null);
  const [creditsLeft, setCreditsLeft] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  const catalogue = React.useMemo(() => products ?? [], [products]);

  const categories = React.useMemo(
    () => [...new Set(catalogue.map((p) => p.category).filter(Boolean) as string[])].sort(),
    [catalogue],
  );

  const quote = estimateCredits('bulk-op');

  const ask = async () => {
    if (!instruction.trim()) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const result = await aiBulkOp(instruction, {
        categories,
        selectedCount: selectedIds.length,
        currency: currencySymbol,
      });
      if (result.credits) setCreditsLeft(result.credits.remaining);

      if (result.refusal || !result.op) {
        setError(result.refusal ?? 'Zeneva could not turn that into a single change.');
        return;
      }

      // `useSelection` comes back as a flag, never as ids — the client owns the
      // selection, so the model cannot name which products an edit touches.
      const op: BulkOp = {
        field: result.op.field,
        mode: result.op.mode,
        filter: (result.op as any).useSelection
          ? { ...result.op.filter, productIds: selectedIds }
          : result.op.filter,
      };

      const computed = previewBulkOp(catalogue, op);
      if (computed.changes.length === 0) {
        setError(
          computed.skipped.length > 0
            ? `Nothing would change. ${computed.skipped.length} product${computed.skipped.length === 1 ? '' : 's'} were skipped — ${computed.skipped[0].reason}`
            : 'Nothing in your inventory matches that, so there is nothing to change.',
        );
        return;
      }
      setPreview(computed);
    } catch (err) {
      if (err instanceof AiCreditsError) setError(`${err.message}${err.hint ? ` ${err.hint}` : ''}`);
      else if (err instanceof ImportAiError) setError(err.message);
      else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    setSaving(true);

    /*
     * Grouped, then queued.
     *
     * `groupWrites` collapses products landing on the same new value into one
     * `bulk-update-products` action. A `set` or a rounding rule collapses hard — a
     * thousand products can become a handful of writes — while a percentage gives
     * every product its own value and collapses to nothing. Either way the queue,
     * not this component, decides how it reaches Firestore, which is what keeps RBAC,
     * the branch id, offline support and the SQLite mirror in play.
     */
    const groups = groupWrites(preview);
    let queued = 0;
    for (const group of groups) {
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
      setSaving(false);
      setError('Those changes could not be queued — you may not have permission to change inventory.');
      return;
    }

    // The audit trail records the *rule* and the count, not a thousand rows. That is
    // what makes the entry readable a month later, and `describeBulkOp` is generated
    // from the operation that was actually applied.
    if (firestore && currentUserProfile) {
      logAuditEvent(firestore, currentUserProfile.businessId, currentUserProfile, {
        action: 'product.bulk_update',
        entity: {
          type: 'Product',
          id: 'multiple',
          name: `${preview.changes.length} products`,
        },
        details: {
          productCount: preview.changes.length,
          rule: describeBulkOp(preview.op, currencySymbol),
          field: preview.op.field,
          viaAi: true,
          skipped: preview.skipped.length,
        },
      }).catch(() => {});
    }

    triggerRefresh();
    toast({
      variant: 'success',
      title: 'Changes queued',
      description: `${preview.changes.length.toLocaleString()} product${preview.changes.length === 1 ? '' : 's'} updated.`,
    });
    setSaving(false);
    onDone();
  };

  const money = (value: number | string | undefined) => {
    if (value == null || value === '') return '—';
    if (typeof value === 'string') return value;
    const isMoney = preview?.op.field === 'price' || preview?.op.field === 'costPrice';
    return isMoney ? `${currencySymbol}${value.toLocaleString()}` : value.toLocaleString();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Change many products at once
        </h3>
        <p className="text-xs text-muted-foreground">
          Say what you want. Zeneva shows you every change before anything is saved.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) ask();
          }}
          placeholder="Raise all my cost prices by 8%"
          disabled={busy || saving}
        />
        <Button onClick={ask} disabled={!instruction.trim() || busy || saving} className="shrink-0 gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Work it out
          <span className="rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">~{quote}</span>
        </Button>
      </div>

      {!preview && !error && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInstruction(example)}
              className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {selectedIds.length > 0 && !preview && (
        <p className="text-[11px] text-muted-foreground">
          You have {selectedIds.length} product{selectedIds.length === 1 ? '' : 's'} selected — say
          &quot;these&quot; or &quot;the selected ones&quot; to limit the change to them.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p>{error}</p>
        </div>
      )}

      {creditsLeft != null && <p className="text-[11px] text-muted-foreground">{creditsLeft.toLocaleString()} AI credits left.</p>}

      {preview && (
        <div className="space-y-2.5 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{describeBulkOp(preview.op, currencySymbol)}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {preview.changes.length.toLocaleString()} will change
                </Badge>
                {preview.unchanged > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {preview.unchanged.toLocaleString()} already correct
                  </Badge>
                )}
                {preview.skipped.length > 0 && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/50 text-[10px] text-amber-600 dark:text-amber-500"
                  >
                    {preview.skipped.length.toLocaleString()} skipped
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 text-xs"
              onClick={() => {
                setPreview(null);
                setError(null);
              }}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Start again
            </Button>
          </div>

          {/* Skips are shown, never hidden. A margin rule silently skipping 400
              products with no cost price looks like success and is not. */}
          {preview.skipped.length > 0 && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[11px]">
              <p className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-500">
                <TriangleAlert className="h-3 w-3" />
                {preview.skipped.length.toLocaleString()} left alone
              </p>
              <p className="mt-0.5 text-muted-foreground">{preview.skipped[0].reason}</p>
            </div>
          )}

          <div className="overflow-hidden rounded border">
            <ScrollArea className="max-h-64">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="w-24 text-xs">Now</TableHead>
                    <TableHead className="w-8" />
                    <TableHead className="w-24 text-xs">After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.changes.slice(0, 200).map((change) => (
                    <TableRow key={change.productId}>
                      <TableCell className="truncate py-1.5 text-xs font-medium">
                        {change.productName}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {money(change.before)}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="py-1.5 text-xs font-medium">{money(change.after)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          {preview.changes.length > 200 && (
            <p className="text-[11px] text-muted-foreground">
              Showing the first 200 of {preview.changes.length.toLocaleString()}. All of them will be
              updated.
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={apply} disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Apply to {preview.changes.length.toLocaleString()} product
              {preview.changes.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
