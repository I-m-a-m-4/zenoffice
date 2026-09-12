'use client';

/**
 * The smart importer's state machine.
 *
 * Six sources, one pipeline. Whatever the owner drops in becomes a `RawTable`, gets
 * its columns mapped, becomes `DraftProduct[]`, gets matched against the catalogue,
 * and gets committed through `addToQueue`. The dialog is a view of this hook and
 * holds no import state of its own.
 *
 * The stages, and which of them can cost money:
 *
 *   pick → read (free) → map (free, AI offered) → review (free, AI offered) → commit (free)
 *
 * Two rules the whole thing is built around:
 *
 * 1. **No AI call happens without a press.** Every paid step is a button with a quote
 *    beside it. An importer that silently spends a balance while you look at a
 *    preview is one people stop opening.
 * 2. **Re-matching never overwrites a human's decision.** `stageRows` carries
 *    `decidedByUser` forward, and every path that re-stages passes the previous rows
 *     in. Losing somebody's forty duplicate answers is unforgivable.
 */

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { usePOS, useBusiness } from '@/context/pos-context';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { productLimit, isCoreFeatureBlocked } from '@/lib/plan';
import type { Product } from '@/types';

import { mapColumns, applyAiMapping, setMapping } from '@/lib/import/column-map';
import { buildDrafts, mergeDrafts } from '@/lib/import/build';
import {
  stageRows,
  defaultIntent,
  parseIntentFromText,
  aiMatchQueue,
  applyAiMatches,
  unresolvedRows,
  type ImportIntent,
} from '@/lib/import/match';
import { buildCommitPlan, buildWrites, selfDuplicates } from '@/lib/import/commit';
import { readSpreadsheet, SpreadsheetError } from '@/lib/import/spreadsheet';
import { parseTabular } from '@/lib/import/tabular';
import {
  aiMapColumns,
  aiMatchProducts,
  aiParseImage,
  aiParseText,
  aiRowsToTable,
  AiCreditsError,
  ImportAiError,
} from '@/lib/import/client';
import { estimateCredits } from '@/lib/import/pricing';
import type {
  ImportField,
  ImportSource,
  MappingResult,
  RawTable,
  StagedRow,
} from '@/lib/import/types';

export type ImportStage = 'pick' | 'reading' | 'map' | 'review' | 'committing' | 'done';

export type SheetChoice = { index: number; label: string; rows: number };

export function useSmartImport(onFinished: () => void) {
  const { toast } = useToast();
  const business = useBusiness();
  const firestore = useFirestore();
  const { products, addToQueue, triggerRefresh, triggerConfetti, currencySymbol } = usePOS();

  const [stage, setStage] = React.useState<ImportStage>('pick');
  const [source, setSource] = React.useState<ImportSource>('spreadsheet');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<string[]>([]);

  const [table, setTable] = React.useState<RawTable | null>(null);
  const [sheets, setSheets] = React.useState<RawTable[]>([]);
  const [mapping, setMappingState] = React.useState<MappingResult | null>(null);
  const [rows, setRows] = React.useState<StagedRow[]>([]);
  const [intent, setIntent] = React.useState<ImportIntent>('replace');
  const [skippedRows, setSkippedRows] = React.useState<{ row: number; reason: string }[]>([]);

  /** Credits left, as last reported by the server. `null` until a call has run. */
  const [creditsLeft, setCreditsLeft] = React.useState<number | null>(null);

  const catalogue: Product[] = React.useMemo(() => products ?? [], [products]);

  const existingCategories: string[] = React.useMemo(
    () => (business as any)?.settings?.productCategories ?? [],
    [business],
  );

  const reset = React.useCallback(() => {
    setStage('pick');
    setBusy(null);
    setError(null);
    setNotes([]);
    setTable(null);
    setSheets([]);
    setMappingState(null);
    setRows([]);
    setSkippedRows([]);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Stage transitions
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Build drafts from a mapped table, match them, and go to review.
   *
   * Declared **before** `acceptTable` on purpose, so that one can depend on it
   * honestly. The first version of this pair had `acceptTable` memoised with `[]` and
   * a lint suppression claiming `stageFrom` was stable — it is not: it closes over
   * `catalogue`, so `acceptTable` permanently captured the *first* render's version,
   * which captured an empty product list while `products` was still loading. Every
   * spreadsheet, paste and desktop import would then match against an empty catalogue
   * and report all of it as new, silently turning duplicate detection off for exactly
   * the sources most likely to need it.
   */
  const stageFrom = React.useCallback(
    (
      incoming: RawTable,
      result: MappingResult,
      forSource: ImportSource,
      forIntent: ImportIntent,
      previous: StagedRow[] = [],
    ) => {
      const { drafts, skipped } = buildDrafts(incoming, result, forSource);
      if (drafts.length === 0) {
        setError(
          skipped.length > 0
            ? `No products could be read. ${skipped.length} row${skipped.length === 1 ? '' : 's'} had no product name.`
            : 'No products could be read from that.',
        );
        setStage('map');
        return;
      }
      setSkippedRows(skipped);
      setRows(stageRows(drafts, catalogue, forIntent, previous));
      setStage('review');
    },
    [catalogue],
  );

  /**
   * Take a table into the mapping stage.
   *
   * Skips straight past mapping when the deterministic pass placed everything it
   * needed — a WooCommerce or Shopify export should not make anybody look at a
   * mapping table to be told Zeneva got it right. `needsAi` is the signal, and it is
   * an *offer* rather than a requirement: the map stage always allows setting columns
   * by hand instead.
   */
  const acceptTable = React.useCallback(
    (incoming: RawTable, forSource: ImportSource, extraNotes: string[] = []) => {
      const result = mapColumns(incoming);
      setTable(incoming);
      setMappingState(result);
      setNotes((prev) => [...prev, ...extraNotes]);
      setSource(forSource);

      const nextIntent = defaultIntent(forSource);
      setIntent(nextIntent);

      if (result.needsAi) {
        setStage('map');
        return;
      }
      stageFrom(incoming, result, forSource, nextIntent);
    },
    [stageFrom],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Sources
  // ───────────────────────────────────────────────────────────────────────────

  const loadFile = React.useCallback(
    async (file: File) => {
      setError(null);
      setNotes([]);
      setStage('reading');
      setBusy('Reading your file…');
      try {
        const result = await readSpreadsheet(file);
        setBusy(null);

        // Sheets with no rows are already filtered out by the reader, so more than
        // one here means a genuine choice. Asking is deliberate: picking the first
        // silently is how somebody imports an "Instructions" tab.
        if (result.sheets.length > 1) {
          setSheets(result.sheets);
          setNotes(result.notes);
          setSource('spreadsheet');
          setStage('map');
          return;
        }
        acceptTable(result.sheets[0], 'spreadsheet', result.notes);
      } catch (err) {
        setBusy(null);
        setStage('pick');
        setError(err instanceof SpreadsheetError ? err.message : 'That file could not be read.');
      }
    },
    [acceptTable],
  );

  const chooseSheet = React.useCallback(
    (index: number) => {
      const chosen = sheets[index];
      if (!chosen) return;
      setSheets([]);
      acceptTable(chosen, 'spreadsheet');
    },
    [sheets, acceptTable],
  );

  /**
   * Take pasted text.
   *
   * Free when the shape is recognisable — a paste out of Excel or a WhatsApp price
   * list both are. Below the confidence bar the owner is offered the AI reader
   * rather than having a bad guess imported for them.
   */
  const loadPaste = React.useCallback(
    (text: string) => {
      setError(null);
      setNotes([]);
      const parsed = parseTabular(text);
      if (!parsed) {
        setError('There was nothing in that paste.');
        return;
      }
      if (parsed.confidence < 0.5) {
        // Keep the text so the AI button has something to send.
        setTable(parsed.table);
        setSource('paste');
        setNotes(['Zeneva is not confident it read that correctly — check the columns, or let AI read it.']);
        setMappingState(mapColumns(parsed.table));
        setStage('map');
        return;
      }
      acceptTable(parsed.table, 'paste', parsed.via === 'line-list' ? ['Read as a list of "product — price" lines.'] : []);
    },
    [acceptTable],
  );

  /** Typed instruction or messy prose. Always AI — that is what it is for. */
  const loadText = React.useCallback(
    async (text: string) => {
      setError(null);
      setNotes([]);
      setStage('reading');
      setBusy('Reading what you wrote…');
      try {
        const result = await aiParseText(text, currencySymbol);
        if (result.credits) setCreditsLeft(result.credits.remaining);
        setBusy(null);

        if (!result.rows?.length) {
          setStage('pick');
          setError(result.note || 'Zeneva could not find any products in that. Try naming the product, the quantity and the price.');
          return;
        }

        const built = aiRowsToTable(result.rows, 'what you typed');
        const mapped = mapColumns(built);
        setTable(built);
        setMappingState(mapped);
        setSource('text');

        // The verb decides for typed text, and the model's reading of it is only a
        // fallback — a local regex on the owner's own words is more predictable than
        // a model's opinion of them, and this is a consequential setting.
        const resolved = parseIntentFromText(text) ?? result.intent ?? defaultIntent('text');
        setIntent(resolved);
        if (result.note) setNotes([result.note]);
        stageFrom(built, mapped, 'text', resolved);
      } catch (err) {
        setBusy(null);
        setStage('pick');
        setError(messageFor(err));
      }
    },
    [currencySymbol, stageFrom],
  );

  /** A photograph of shelves, or of a supplier invoice. Always AI. */
  const loadImage = React.useCallback(
    async (file: File, kind: 'photo' | 'invoice') => {
      setError(null);
      setNotes([]);
      setStage('reading');
      setBusy(kind === 'invoice' ? 'Reading the invoice…' : 'Looking at your stock…');
      try {
        const base64 = await fileToBase64(file);
        const result = await aiParseImage(kind, base64, {
          mimeType: file.type || 'image/jpeg',
          currency: currencySymbol,
          categories: existingCategories,
        });
        if (result.credits) setCreditsLeft(result.credits.remaining);
        setBusy(null);

        if (!result.rows?.length) {
          setStage('pick');
          setError(
            result.note ||
              (kind === 'invoice'
                ? 'No line items could be read from that invoice. A straighter, brighter photo usually fixes it.'
                : 'No products could be made out. Try getting closer, with the labels facing the camera.'),
          );
          return;
        }

        const built = aiRowsToTable(result.rows, kind === 'invoice' ? 'the invoice' : 'the photo');
        const mapped = mapColumns(built);
        const resolved = defaultIntent(kind);
        setTable(built);
        setMappingState(mapped);
        setSource(kind);
        setIntent(resolved);
        if (result.note) setNotes([result.note]);
        stageFrom(built, mapped, kind, resolved);
      } catch (err) {
        setBusy(null);
        setStage('pick');
        setError(messageFor(err));
      }
    },
    [currencySymbol, existingCategories, stageFrom],
  );

  /** A finished desktop capture: several pages already combined into one table. */
  const loadCaptured = React.useCallback(
    (captured: RawTable, captureNotes: string[] = []) => {
      setError(null);
      setNotes([]);
      acceptTable(captured, 'desktop', captureNotes);
    },
    [acceptTable],
  );

  /**
   * A barcode scan that matched nothing, turned into a one-row draft.
   *
   * The scanner already searches the catalogue, so reaching here means the code is
   * genuinely new — and a new barcode with nothing else known about it is exactly
   * the row the review screen is for.
   */
  const loadScanned = React.useCallback(
    (code: string, name: string) => {
      const built: RawTable = {
        headers: ['Name', 'SKU', 'Stock'],
        rows: [[name || code, code, '1']],
        hasHeaderRow: true,
        label: 'scanned',
      };
      acceptTable(built, 'barcode');
    },
    [acceptTable],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Paid steps
  // ───────────────────────────────────────────────────────────────────────────

  /** Ask the model about the columns nothing recognised. Explicit press only. */
  const runAiMapping = React.useCallback(async () => {
    if (!table || !mapping) return;
    setError(null);
    setBusy('Reading your column names…');
    try {
      const unknown = mapping.uncertain.map((c) => ({ index: c.index, header: c.source }));
      if (unknown.length === 0) {
        setBusy(null);
        return;
      }
      const result = await aiMapColumns(unknown, table.rows.slice(0, 8));
      if (result.credits) setCreditsLeft(result.credits.remaining);

      const next = applyAiMapping(mapping, result.mappings);
      setMappingState(next);
      setBusy(null);

      if (!next.needsAi) {
        stageFrom(table, next, source, intent, rows);
      } else {
        setError('Zeneva still could not work out which column holds the product name. Set it below and carry on.');
      }
    } catch (err) {
      setBusy(null);
      setError(messageFor(err));
    }
  }, [table, mapping, source, intent, rows, stageFrom]);

  /** Ask the model to settle the duplicate questions nobody has answered. */
  const runAiMatching = React.useCallback(async () => {
    const queue = aiMatchQueue(rows);
    if (queue.length === 0) return;
    setError(null);
    setBusy(`Checking ${queue.length} possible duplicate${queue.length === 1 ? '' : 's'}…`);
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
      setRows((prev) => applyAiMatches(prev, result.verdicts, intent));
      setBusy(null);
    } catch (err) {
      setBusy(null);
      setError(messageFor(err));
    }
  }, [rows, intent]);

  // ───────────────────────────────────────────────────────────────────────────
  // Review edits
  // ───────────────────────────────────────────────────────────────────────────

  const changeMapping = React.useCallback(
    (index: number, field: ImportField | null) => {
      if (!mapping) return;
      const next = setMapping(mapping, index, field);
      setMappingState(next);
      // Re-derive immediately so the preview under the mapping table is live. The
      // owner's duplicate answers survive via `rows`.
      if (table && !next.needsAi) stageFrom(table, next, source, intent, rows);
    },
    [mapping, table, source, intent, rows, stageFrom],
  );

  /**
   * Leave the mapping stage for the review stage.
   *
   * Its own function rather than the dialog re-applying a mapping to force a
   * re-derive: that trick worked only because `changeMapping` happens to re-stage as
   * a side effect, and it silently did nothing whenever the name column was already
   * set — which is the common case. The transition belongs to the hook.
   */
  const proceedToReview = React.useCallback(() => {
    if (!table || !mapping) return;
    if (mapping.needsAi) {
      setError('Zeneva still needs to know which column holds the product name.');
      return;
    }
    stageFrom(table, mapping, source, intent, rows);
  }, [table, mapping, source, intent, rows, stageFrom]);

  /**
   * Change the batch's intent.
   *
   * Re-derives every automatic decision, because the intent *is* the decision for a
   * certain match — restock adds, replace overwrites. Answers a human gave are kept.
   */
  const changeIntent = React.useCallback(
    (next: ImportIntent) => {
      setIntent(next);
      setRows((prev) =>
        prev.map((row) => {
          if (row.decidedByUser) return row;
          if (row.verdict.kind !== 'certain') return row;
          return {
            ...row,
            decision:
              next === 'restock'
                ? { action: 'add-stock', productId: row.verdict.match.productId }
                : { action: 'overwrite', productId: row.verdict.match.productId },
          };
        }),
      );
    },
    [],
  );

  const decideRow = React.useCallback((key: string, decision: StagedRow['decision']) => {
    setRows((prev) =>
      prev.map((row) => (row.draft.key === key ? { ...row, decision, decidedByUser: true } : row)),
    );
  }, []);

  const editDraft = React.useCallback(
    (key: string, patch: Partial<StagedRow['draft']>) => {
      setRows((prev) =>
        prev.map((row) =>
          row.draft.key === key ? { ...row, draft: { ...row.draft, ...patch } } : row,
        ),
      );
    },
    [],
  );

  const removeRow = React.useCallback((key: string) => {
    setRows((prev) => prev.filter((row) => row.draft.key !== key));
  }, []);

  /** Append another batch — a second photo, or another pasted page. */
  const appendTable = React.useCallback(
    (incoming: RawTable, forSource: ImportSource) => {
      const result = mapColumns(incoming);
      const { drafts } = buildDrafts(incoming, result, forSource, `b${Date.now().toString(36)}`);
      if (drafts.length === 0) {
        setError('Nothing new could be read from that.');
        return;
      }
      const merged = mergeDrafts(rows.map((r) => r.draft), drafts);
      setRows(stageRows(merged, catalogue, intent, rows));
    },
    [rows, catalogue, intent],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Commit
  // ───────────────────────────────────────────────────────────────────────────

  const plan = React.useMemo(
    () => buildCommitPlan(rows, existingCategories),
    [rows, existingCategories],
  );

  const duplicateWarnings = React.useMemo(() => selfDuplicates(plan), [plan]);
  const openQuestions = React.useMemo(() => unresolvedRows(rows), [rows]);

  /**
   * The plan cap check.
   *
   * Only newly *created* products count against it — an import that updates 900
   * existing products adds nothing to the total, and refusing it would be wrong.
   */
  const limitCheck = React.useMemo(() => {
    if (business && isCoreFeatureBlocked(business)) {
      return {
        ok: false as const,
        message: `Your trial has expired or your plan has lapsed. Please upgrade to import products.`,
        isBlocked: true as const,
      };
    }
    const limit = productLimit(business);
    if (limit === Infinity) return { ok: true as const };
    const after = catalogue.length + plan.create.length;
    if (after <= limit) return { ok: true as const };
    return {
      ok: false as const,
      message: `This would take you to ${after.toLocaleString()} products, past your plan's limit of ${limit.toLocaleString()}. Upgrade, or import fewer rows.`,
    };
  }, [business, catalogue.length, plan.create.length]);

  const commit = React.useCallback(async () => {
    if (!business?.id) return;
    if (!limitCheck.ok) {
      setError(limitCheck.message);
      return;
    }

    const bundle = buildWrites(plan, catalogue, business.id, () =>
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );

    if (bundle.writes.length === 0) {
      setError('Nothing to import — every row is either skipped or already up to date.');
      return;
    }

    setStage('committing');
    setError(null);

    /*
     * Queued, not batched.
     *
     * `addToQueue` is the only path that enforces RBAC, injects `activeBranchId`,
     * survives a dropped connection and updates the SQLite mirror the desktop till
     * sells from. The old CSV dialog wrote a `writeBatch` directly and skipped all
     * four. It is synchronous and returns an id, so there is nothing to await —
     * the queue drains itself and reports its own failures.
     */
    let queued = 0;
    for (const write of bundle.writes) {
      const id = addToQueue({ type: write.type, payload: write.payload }, write.description);
      if (id) queued++;
    }

    if (queued === 0) {
      setStage('review');
      setError('None of those changes could be queued — you may not have permission to change inventory.');
      return;
    }

    // New categories go on the business doc so they appear in every category
    // dropdown.
    //
    // Written directly rather than queued, and that is not an oversight.
    // `update-settings` exists in the `QueuedAction` union and `pos-context` merges
    // it optimistically into the business object — but there is **no case for it in
    // the queue's commit switch**, so a queued settings change updates the screen,
    // never reaches Firestore, and sits in the queue being retried forever. Until
    // that handler exists, queuing this would silently lose the categories while
    // appearing to work.
    //
    // A failure here is worth a note and nothing more: the products imported fine
    // and each one carries its category, so the only loss is the category not
    // appearing in dropdowns until someone adds it. That is also why this does not
    // block the success toast — offline, the write simply will not happen.
    if (bundle.newCategories.length > 0 && firestore) {
      const merged = [...new Set([...existingCategories, ...bundle.newCategories])].sort((a, b) =>
        a.localeCompare(b),
      );
      updateDoc(doc(firestore, 'businessInstances', business.id), {
        'settings.productCategories': merged,
      }).catch(() => {
        toast({
          variant: 'warning',
          title: 'Categories not added',
          description:
            'Your products imported with their categories, but the category list could not be updated. Add them in Settings when you are back online.',
        });
      });
    }

    if (bundle.created > 0) triggerConfetti();
    triggerRefresh();
    setStage('done');

    toast({
      variant: 'success',
      title: 'Import queued',
      description: [
        bundle.created > 0 ? `${bundle.created.toLocaleString()} new product${bundle.created === 1 ? '' : 's'}` : '',
        bundle.updated > 0 ? `${bundle.updated.toLocaleString()} updated` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    });

    onFinished();
  }, [
    business,
    firestore,
    limitCheck,
    plan,
    catalogue,
    addToQueue,
    existingCategories,
    triggerConfetti,
    triggerRefresh,
    toast,
    onFinished,
  ]);

  return {
    // state
    stage, source, busy, error, notes, table, sheets, mapping, rows, intent,
    skippedRows, creditsLeft, plan, duplicateWarnings, openQuestions, limitCheck,
    currencySymbol, catalogue, existingCategories,
    // quotes
    mappingQuote: mapping ? estimateCredits('map-columns') : 0,
    matchQuote: estimateCredits('match', openQuestions.length),
    // sources
    loadFile, loadPaste, loadText, loadImage, loadCaptured, loadScanned, chooseSheet,
    // paid steps
    runAiMapping, runAiMatching,
    // edits
    changeMapping, changeIntent, decideRow, editDraft, removeRow, appendTable,
    proceedToReview,
    // control
    commit, reset, setError,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Base64 without the data-URL prefix — the route accepts either, but this is smaller. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * A sentence for any error the importer can produce.
 *
 * Out-of-credits is separated out because it is not a failure — it is a state with a
 * remedy, and the message names the free paths that still work rather than leaving
 * the owner stuck.
 */
function messageFor(err: unknown): string {
  if (err instanceof AiCreditsError) {
    return `${err.message}${err.hint ? ` ${err.hint}` : ''}`;
  }
  if (err instanceof ImportAiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}
