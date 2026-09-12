'use client';

/**
 * The customer importer's state machine.
 *
 * Four sources, one pipeline — the product importer's shape, minus the parts that
 * only make sense for stock. Whatever the owner gives becomes a `RawTable`, gets its
 * columns mapped, becomes `DraftCustomer[]`, gets matched against the customers
 * already on file, and gets committed through `addToQueue`.
 *
 *   pick → reading → map (free, AI offered) → review (free) → committing → done
 *
 * Four things differ from `use-smart-import.ts`, and each is a decision rather than
 * an omission:
 *
 *  - **No intent question.** A file of customers means "these are my customers".
 *    There is no restock-versus-replace ambiguity to resolve, because a customer
 *    record is not a running quantity — the `add-stock` / `overwrite` distinction has
 *    no analogue here. Updates fill blanks and take the larger of the two running
 *    totals, which is the only sane reading of a migration snapshot.
 *  - **No AI duplicate matching.** The product importer pays a model to settle
 *    ambiguous name matches. Here a name match stays a question the owner answers,
 *    because two people genuinely are called Musa Ibrahim and no model can know which
 *    one a row means — the shop can. Spending credits to guess at that would be
 *    selling a coin flip.
 *  - **No plan limit.** `productLimit` caps a catalogue; nothing caps a customer book,
 *    so there is no ceiling to check before committing.
 *  - **Duplicate detection runs against `allCustomersUnfiltered`.** The page's own
 *    list is branch-filtered, search-filtered and segment-filtered, and matching
 *    against a filtered book is matching against a book with most of it missing —
 *    which reports everybody as new and creates the duplicates this feature exists to
 *    prevent.
 */

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { usePOS, useBusiness } from '@/context/pos-context';
import type { Customer } from '@/types';

import {
  mapCustomerColumns,
  applyCustomerAiMapping,
  setCustomerMapping,
  buildCustomerDrafts,
  stageCustomerRows,
  planCustomerCommit,
  buildCustomerWrites,
  type CustomerImportField,
  type CustomerMappingResult,
  type StagedCustomerRow,
  type CustomerRowDecision,
  type DraftCustomer,
} from '@/lib/import/customers';
import { readSpreadsheet, SpreadsheetError } from '@/lib/import/spreadsheet';
import { parseTabular } from '@/lib/import/tabular';
import {
  aiMapCustomerColumns,
  aiParseCustomerText,
  aiParseCustomerImage,
  aiCustomerRowsToTable,
  AiCreditsError,
  ImportAiError,
} from '@/lib/import/client';
import { estimateCredits } from '@/lib/import/pricing';
import type { RawTable } from '@/lib/import/types';

export type CustomerImportStage = 'pick' | 'reading' | 'map' | 'review' | 'committing' | 'done';

/** The four doors in. No barcode, no desktop capture, no supplier invoice. */
export type CustomerImportSource = 'spreadsheet' | 'paste' | 'photo' | 'text';

export function useCustomerImport(onFinished: () => void) {
  const { toast } = useToast();
  const business = useBusiness();
  const {
    allCustomersUnfiltered,
    addToQueue,
    triggerRefresh,
    triggerConfetti,
    currencySymbol,
  } = usePOS();

  const [stage, setStage] = React.useState<CustomerImportStage>('pick');
  const [source, setSource] = React.useState<CustomerImportSource>('spreadsheet');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<string[]>([]);

  const [table, setTable] = React.useState<RawTable | null>(null);
  const [sheets, setSheets] = React.useState<RawTable[]>([]);
  const [mapping, setMappingState] = React.useState<CustomerMappingResult | null>(null);
  const [rows, setRows] = React.useState<StagedCustomerRow[]>([]);
  const [skippedRows, setSkippedRows] = React.useState(0);
  const [pendingText, setPendingText] = React.useState('');

  /** Credits left, as last reported by the server. `null` until a call has run. */
  const [creditsLeft, setCreditsLeft] = React.useState<number | null>(null);

  const [committed, setCommitted] = React.useState({ created: 0, updated: 0, skipped: 0 });

  /*
   * The whole book, and `null` while it is still arriving.
   *
   * `null` and `[]` are different claims — the same distinction the POS's product
   * catalogue turns on. An empty array asserts the shop has no customers, and
   * matching against it would report every row as new. So the dialog refuses to
   * stage anything until the list has actually loaded, rather than quietly matching
   * against nothing.
   */
  const bookLoaded = allCustomersUnfiltered !== null;
  const book: Customer[] = React.useMemo(() => allCustomersUnfiltered ?? [], [allCustomersUnfiltered]);

  /** Tags already in use, so a photo reuses one rather than founding a second spelling. */
  const existingTags: string[] = React.useMemo(() => {
    const seen = new Set<string>();
    for (const customer of book) {
      for (const tag of customer.tags ?? []) {
        if (tag?.trim()) seen.add(tag.trim());
        if (seen.size >= 40) break;
      }
      if (seen.size >= 40) break;
    }
    return [...seen];
  }, [book]);

  const reset = React.useCallback(() => {
    setStage('pick');
    setBusy(null);
    setError(null);
    setNotes([]);
    setTable(null);
    setSheets([]);
    setMappingState(null);
    setRows([]);
    setSkippedRows(0);
    setPendingText('');
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Stage transitions
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Build drafts from a mapped table, match them, and go to review.
   *
   * Declared **before** `acceptTable`, so that one can depend on it honestly. The
   * product hook's equivalent documents what happens otherwise: memoising the caller
   * against `[]` while claiming this is stable captures the first render's `book`,
   * which is the render where it was still empty — turning duplicate detection off
   * for exactly the sources most likely to need it.
   */
  const stageFrom = React.useCallback(
    (incoming: RawTable, result: CustomerMappingResult, previous: StagedCustomerRow[] = []) => {
      const { drafts, skippedRows: skipped } = buildCustomerDrafts(incoming, result);
      if (drafts.length === 0) {
        setError(
          skipped > 0
            ? `No customers could be read — ${skipped} row${skipped === 1 ? ' has' : 's have'} no name against them.`
            : 'No customers could be read from that.',
        );
        setStage('map');
        return;
      }
      setSkippedRows(skipped);
      setRows(stageCustomerRows(drafts, book).map((row, i) => {
        // Answers a human already gave survive a re-stage, keyed by draft. Losing
        // somebody's forty duplicate decisions because they fixed one column is
        // unforgivable, and re-mapping is exactly when it would happen.
        const prior = previous.find(p => p.draft.key === row.draft.key);
        return prior?.decidedByUser ? { ...row, decision: prior.decision, decidedByUser: true } : row;
      }));
      setStage('review');
    },
    [book],
  );

  /**
   * Take a table into the mapping stage.
   *
   * Skips straight past mapping when the deterministic pass found a name column — a
   * Shopify or QuickBooks export should not make anybody confirm that Zeneva read
   * "Customer Name" correctly. `needsAi` is an *offer*, never a requirement: the map
   * stage always allows setting the columns by hand instead, for free.
   */
  const acceptTable = React.useCallback(
    (incoming: RawTable, forSource: CustomerImportSource, extraNotes: string[] = []) => {
      const result = mapCustomerColumns(incoming);
      setTable(incoming);
      setMappingState(result);
      setNotes(prev => [...prev, ...extraNotes]);
      setSource(forSource);

      if (result.needsAi) {
        setStage('map');
        return;
      }
      stageFrom(incoming, result);
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

        // More than one sheet is a genuine choice, and picking the first silently is
        // how somebody imports an "Instructions" tab as forty customers.
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
   * Free whenever the shape is recognisable, which a paste out of Excel, Sheets or a
   * WhatsApp list all are. Below the confidence bar the owner is offered the AI
   * reader rather than having a bad guess imported on their behalf.
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
      // Kept so the AI button on the map screen has something to send.
      setPendingText(text);
      if (parsed.confidence < 0.5) {
        setTable(parsed.table);
        setSource('paste');
        setNotes(['Zeneva is not confident it read that correctly — check the columns, or let AI read it.']);
        setMappingState(mapCustomerColumns(parsed.table));
        setStage('map');
        return;
      }
      acceptTable(parsed.table, 'paste');
    },
    [acceptTable],
  );

  /** Typed or dictated prose. Always AI — that is what it is for. */
  const loadText = React.useCallback(
    async (text: string) => {
      setError(null);
      setNotes([]);
      setPendingText(text);
      setStage('reading');
      setBusy('Reading what you wrote…');
      try {
        const result = await aiParseCustomerText(text, currencySymbol);
        if (result.credits) setCreditsLeft(result.credits.remaining);
        setBusy(null);

        if (!result.rows?.length) {
          setStage('pick');
          setError(
            result.note ||
              'Zeneva could not find any customers in that. Try naming each person, and their phone number if you have it.',
          );
          return;
        }

        const built = aiCustomerRowsToTable(result.rows, 'what you typed');
        const mapped = mapCustomerColumns(built);
        setTable(built);
        setMappingState(mapped);
        setSource('text');
        if (result.note) setNotes([result.note]);
        stageFrom(built, mapped);
      } catch (err) {
        setBusy(null);
        setStage('pick');
        setError(messageFor(err));
      }
    },
    [currencySymbol, stageFrom],
  );

  /** A photograph of a ledger page, a visitors' book or a printed list. Always AI. */
  const loadImage = React.useCallback(
    async (file: File) => {
      setError(null);
      setNotes([]);
      setStage('reading');
      setBusy('Reading the page…');
      try {
        const base64 = await fileToBase64(file);
        const result = await aiParseCustomerImage(base64, {
          mimeType: file.type,
          currency: currencySymbol,
          tags: existingTags,
        });
        if (result.credits) setCreditsLeft(result.credits.remaining);
        setBusy(null);

        if (!result.rows?.length) {
          setStage('pick');
          setError(
            result.note ||
              'Zeneva could not read any customers off that page. A straighter, brighter photo of one page at a time usually works.',
          );
          return;
        }

        const built = aiCustomerRowsToTable(result.rows, 'the photo');
        const mapped = mapCustomerColumns(built);
        setTable(built);
        setMappingState(mapped);
        setSource('photo');
        if (result.note) setNotes([result.note]);
        stageFrom(built, mapped);
      } catch (err) {
        setBusy(null);
        setStage('pick');
        setError(messageFor(err));
      }
    },
    [currencySymbol, existingTags, stageFrom],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // The one paid step on this screen
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Ask the model what the unrecognised columns mean.
   *
   * Only the columns the deterministic pass could not place are sent. Sending all of
   * them costs no more but invites the model to contradict a header that matched an
   * alias exactly — which `applyCustomerAiMapping` would then discard, so the call
   * would have been paid for and thrown away.
   */
  const runAiMapping = React.useCallback(async () => {
    if (!table || !mapping) return;
    const unresolved = mapping.columns.filter(c => !c.field);
    if (unresolved.length === 0) return;

    setError(null);
    setBusy('Working out your columns…');
    try {
      const result = await aiMapCustomerColumns(
        unresolved.map(c => ({ index: c.index, header: c.source })),
        table.rows.slice(0, 8),
      );
      if (result.credits) setCreditsLeft(result.credits.remaining);
      const next = applyCustomerAiMapping(mapping, result.mappings);
      setMappingState(next);
      setBusy(null);

      if (next.columns.every(c => !c.field)) {
        setError('Zeneva still could not tell what those columns hold. Set them by hand below — that part is free.');
        return;
      }
      stageFrom(table, next, rows);
    } catch (err) {
      setBusy(null);
      setError(messageFor(err));
    }
  }, [table, mapping, rows, stageFrom]);

  // ───────────────────────────────────────────────────────────────────────────
  // Review edits
  // ───────────────────────────────────────────────────────────────────────────

  const changeMapping = React.useCallback(
    (index: number, field: CustomerImportField | null) => {
      if (!mapping) return;
      const next = setCustomerMapping(mapping, index, field);
      setMappingState(next);
      // Re-derived immediately so the preview under the mapping table is live. The
      // owner's duplicate answers survive through `rows`.
      if (table && !next.needsAi) stageFrom(table, next, rows);
    },
    [mapping, table, rows, stageFrom],
  );

  /**
   * Leave the mapping stage for the review stage.
   *
   * Its own function rather than the dialog re-applying a mapping to force a
   * re-derive: that trick only works because `changeMapping` re-stages as a side
   * effect, and it silently does nothing when the name column is already set — which
   * is the common case.
   */
  const proceedToReview = React.useCallback(() => {
    if (!table || !mapping) return;
    if (!mapping.columns.some(c => c.field === 'name')) {
      setError('Zeneva needs to know which column holds the customer name.');
      return;
    }
    stageFrom(table, mapping, rows);
  }, [table, mapping, rows, stageFrom]);

  const decideRow = React.useCallback((key: string, decision: CustomerRowDecision) => {
    setRows(prev =>
      prev.map(row => (row.draft.key === key ? { ...row, decision, decidedByUser: true } : row)),
    );
  }, []);

  const editDraft = React.useCallback((key: string, patch: Partial<DraftCustomer>) => {
    setRows(prev =>
      prev.map(row => (row.draft.key === key ? { ...row, draft: { ...row.draft, ...patch } } : row)),
    );
  }, []);

  const removeRow = React.useCallback((key: string) => {
    setRows(prev => prev.filter(row => row.draft.key !== key));
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Commit
  // ───────────────────────────────────────────────────────────────────────────

  const plan = React.useMemo(() => planCustomerCommit(rows), [rows]);

  /** Rows whose duplicate question nobody has answered, for the nudge above Import. */
  const openQuestions = React.useMemo(
    () => rows.filter(r => r.verdict.kind === 'possible' && !r.decidedByUser),
    [rows],
  );

  const commit = React.useCallback(() => {
    if (!business?.id) return;

    const bundle = buildCustomerWrites(
      plan,
      book,
      business.id,
      () =>
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );

    if (bundle.writes.length === 0) {
      setError(
        bundle.alreadyCurrent > 0
          ? 'Nothing to import — every one of these customers is already on file with these details.'
          : 'Nothing to import — every row is either skipped or already up to date.',
      );
      return;
    }

    setStage('committing');
    setError(null);

    /*
     * Queued, not batched.
     *
     * `addToQueue` is the only path that enforces RBAC, injects `activeBranchId`,
     * survives a dropped connection and keeps the local mirror in step. The dialog
     * this replaces wrote a `writeBatch` directly and skipped all four — which is
     * also why an imported customer used to belong to no branch until somebody
     * noticed and patched the branch id back in by hand.
     *
     * Synchronous, returning an id, so there is nothing to await: the queue drains
     * itself and reports its own failures.
     */
    let queued = 0;
    for (const write of bundle.writes) {
      const id = addToQueue({ type: write.type, payload: write.payload }, write.description);
      if (id) queued++;
    }

    if (queued === 0) {
      setStage('review');
      setError('None of those changes could be queued — you may not have permission to manage customers.');
      return;
    }

    setCommitted({ created: bundle.created, updated: bundle.updated, skipped: bundle.skipped });
    if (bundle.created > 0) triggerConfetti();
    triggerRefresh();
    setStage('done');

    toast({
      variant: 'success',
      title: 'Import queued',
      description: [
        bundle.created > 0 ? `${bundle.created.toLocaleString()} new customer${bundle.created === 1 ? '' : 's'}` : '',
        bundle.updated > 0 ? `${bundle.updated.toLocaleString()} updated` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    });

    onFinished();
  }, [business, plan, book, addToQueue, triggerConfetti, triggerRefresh, toast, onFinished]);

  return {
    // state
    stage, source, busy, error, notes, table, sheets, mapping, rows, skippedRows,
    creditsLeft, plan, openQuestions, committed, bookLoaded, pendingText,
    currencySymbol, book,
    // quotes
    mappingQuote: estimateCredits('map-customer-columns'),
    // sources
    loadFile, loadPaste, loadText, loadImage, chooseSheet,
    // paid step
    runAiMapping,
    // edits
    changeMapping, decideRow, editDraft, removeRow, proceedToReview,
    // control
    commit, reset, setError,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Base64 without the data-URL prefix — the route takes either, but this is smaller. */
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
 * the owner stuck on a screen that says no.
 */
function messageFor(err: unknown): string {
  if (err instanceof AiCreditsError) {
    return `${err.message}${err.hint ? ` ${err.hint}` : ''}`;
  }
  if (err instanceof ImportAiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}
