/**
 * Deciding whether an imported row is a product the shop already has.
 *
 * This is the module that stops an import doubling somebody's catalogue, and the
 * rule that governs all of it is: **be certain, or ask.** There is no middle
 * setting. A wrong merge silently adds 30 units to the wrong line and corrupts a
 * stock figure the owner will trust for months; a wrong split makes a visible
 * duplicate they can see and delete in a second. So the code is deliberately
 * biased towards asking, and the review screen is built to make answering cheap.
 *
 * ## Order of evidence
 *
 * 1. **SKU** — Zeneva has no separate barcode field, so a SKU *is* the barcode
 *    when one exists. Two rows with the same code are the same article. This is
 *    the only tier that is a fact rather than a judgement, and it is never
 *    presented as a question.
 * 2. **Normalised name equality** — a fact about the strings once case, word
 *    order, punctuation, noise words and unit spellings are gone. `50cl` and
 *    `500ml` reduce to the same thing here, which is what catches
 *    `Coca Cola 50cl` against `Coca-Cola Original 500ml`.
 * 3. **Token overlap with an agreeing size** — a judgement, offered as a
 *    question with both answers one click away.
 * 4. **AI** — only the residue of tier 3, batched into one call, and only when
 *    the owner asks for it.
 *
 * ## Why an index rather than a scan
 *
 * A thousand imported rows against twelve thousand products is twelve million
 * comparisons, each one tokenising two strings. Built as a nested loop it locks
 * the tab for a minute. The postings index below turns it into one pass over the
 * catalogue plus a handful of candidates per row.
 */

import type { Product } from '@/types';
import {
  extractSize,
  isPlausibleSku,
  nameSimilarity,
  nameTokens,
  normalizeName,
  normalizeSku,
  sizesEqual,
} from './normalize';
import type {
  DraftProduct,
  ImportSource,
  MatchCandidate,
  MatchVerdict,
  RowDecision,
  StagedRow,
} from './types';

/**
 * Similarity at or above which two names are worth asking about.
 *
 * 0.62 is low, on purpose. Anything above it becomes a *question*, never an
 * action, so the cost of setting it low is one extra glance and the cost of
 * setting it high is a duplicate nobody noticed. Below this the row is simply
 * treated as new.
 */
export const ASK_THRESHOLD = 0.62;

/**
 * Similarity above which a name match is treated as certain without a size check.
 *
 * Only reached by names that are nearly identical after normalisation, which in
 * practice means a difference in a word the noise list did not cover.
 */
export const CERTAIN_THRESHOLD = 0.93;

// ─────────────────────────────────────────────────────────────────────────────
// Index
// ─────────────────────────────────────────────────────────────────────────────

type IndexedProduct = {
  product: Product;
  normalized: string;
  tokens: Set<string>;
  size: ReturnType<typeof extractSize>;
};

export type ProductIndex = {
  items: IndexedProduct[];
  /** Normalised SKU → items carrying it. An array because bad data duplicates. */
  bySku: Map<string, IndexedProduct[]>;
  /** Normalised name → items carrying it. */
  byName: Map<string, IndexedProduct[]>;
  /** Token → indices into `items`. The candidate generator for tier 3. */
  postings: Map<string, number[]>;
  /**
   * Tokens too common to narrow anything down.
   *
   * A token in more than a fifth of the catalogue ("water" in a water shop)
   * generates a candidate list the size of the catalogue and contributes almost
   * nothing to the score. Excluded from candidate *generation* only — it still
   * counts towards similarity once a candidate is on the list.
   */
  commonTokens: Set<string>;
};

/** Build the index once per matching run. O(products × tokens). */
export function buildProductIndex(products: Product[]): ProductIndex {
  const items: IndexedProduct[] = [];
  const bySku = new Map<string, IndexedProduct[]>();
  const byName = new Map<string, IndexedProduct[]>();
  const postings = new Map<string, number[]>();
  const frequency = new Map<string, number>();

  for (const product of products) {
    if (!product?.id) continue;
    const normalized = normalizeName(product.name || '');
    const tokens = nameTokens(product.name || '');
    const item: IndexedProduct = {
      product,
      normalized,
      tokens,
      size: extractSize(product.name || ''),
    };
    const at = items.push(item) - 1;

    const sku = normalizeSku(product.sku);
    if (sku && isPlausibleSku(sku)) {
      const bucket = bySku.get(sku);
      if (bucket) bucket.push(item); else bySku.set(sku, [item]);
    }

    if (normalized) {
      const bucket = byName.get(normalized);
      if (bucket) bucket.push(item); else byName.set(normalized, [item]);
    }

    for (const token of tokens) {
      const bucket = postings.get(token);
      if (bucket) bucket.push(at); else postings.set(token, [at]);
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  const ceiling = Math.max(50, Math.floor(items.length * 0.2));
  const commonTokens = new Set<string>();
  for (const [token, count] of frequency) {
    if (count > ceiling) commonTokens.add(token);
  }

  return { items, bySku, byName, postings, commonTokens };
}

function toCandidate(
  item: IndexedProduct,
  reason: MatchCandidate['reason'],
  score: number,
  explanation: string,
  explanationCode: MatchCandidate['explanationCode'],
  explanationVars?: MatchCandidate['explanationVars'],
): MatchCandidate {
  return {
    productId: item.product.id,
    productName: item.product.name,
    productSku: item.product.sku || undefined,
    productStock: Number(item.product.stock) || 0,
    productPrice: typeof item.product.price === 'number' ? item.product.price : undefined,
    productCostPrice:
      typeof item.product.costPrice === 'number' ? item.product.costPrice : undefined,
    reason,
    score,
    explanation,
    explanationCode,
    explanationVars,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching one row
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find what an imported row corresponds to in the catalogue.
 *
 * `exclude` carries the product ids already claimed by earlier rows in the same
 * import. Without it a file listing `Coke 50cl` and `Coca-Cola 500ml` on separate
 * lines matches both to the same product and the second silently overwrites the
 * first — one of the two would vanish with no warning anywhere.
 */
export function matchDraft(
  draft: DraftProduct,
  index: ProductIndex,
  exclude: Set<string> = new Set(),
): MatchVerdict {
  const available = (item: IndexedProduct) => !exclude.has(item.product.id);

  // ── Tier 1: SKU. A fact. ──
  const sku = normalizeSku(draft.sku);
  if (sku && isPlausibleSku(sku)) {
    const hits = (index.bySku.get(sku) ?? []).filter(available);
    if (hits.length > 0) {
      return {
        kind: 'certain',
        match: toCandidate(hits[0], 'sku', 1, `same code ${hits[0].product.sku}`, 'same-code', {
          sku: String(hits[0].product.sku ?? ''),
        }),
      };
    }
  }

  const normalized = normalizeName(draft.name);
  if (!normalized) return { kind: 'new' };

  // ── Tier 2: normalised name equality. A fact about the strings. ──
  const exact = (index.byName.get(normalized) ?? []).filter(available);
  if (exact.length === 1) {
    return { kind: 'certain', match: toCandidate(exact[0], 'name-exact', 1, 'same name', 'same-name') };
  }
  if (exact.length > 1) {
    // The catalogue itself already holds two products under one name. Zeneva
    // must not pick between them — whichever it picks is a coin toss with the
    // shop's stock figures on it.
    return {
      kind: 'possible',
      candidates: exact.map((item) => toCandidate(item, 'name-exact', 1, 'same name', 'same-name')),
    };
  }

  // ── Tier 3: token overlap, size-aware. A judgement. ──
  const draftTokens = nameTokens(draft.name);
  const draftSize = extractSize(draft.name);

  const seen = new Set<number>();
  const rare = [...draftTokens].filter((t) => !index.commonTokens.has(t));
  // With nothing but common tokens to go on, fall back to using them — a shop
  // whose every product says "water" still deserves duplicate detection.
  const lookup = rare.length > 0 ? rare : [...draftTokens];
  for (const token of lookup) {
    for (const at of index.postings.get(token) ?? []) seen.add(at);
  }

  const scored: MatchCandidate[] = [];
  for (const at of seen) {
    const item = index.items[at];
    if (!available(item)) continue;

    let score = nameSimilarity(draft.name, item.product.name);
    if (score < ASK_THRESHOLD - 0.15) continue;

    // Size is the tie-breaker that carries real information. Agreeing sizes are
    // strong corroboration; disagreeing sizes are close to disqualifying, because
    // `Coke 50cl` and `Coke 150cl` are genuinely different products and are
    // exactly the pair a name-only score gets wrong.
    let explanation = 'similar name';
    let explanationCode: MatchCandidate['explanationCode'] = 'similar-name';
    if (draftSize && item.size) {
      if (sizesEqual(draftSize, item.size)) {
        score = Math.min(1, score + 0.18);
        explanation = `similar name, same size`;
        explanationCode = 'similar-name-same-size';
      } else {
        score -= 0.45;
        explanation = 'similar name but a different size';
        explanationCode = 'similar-name-different-size';
      }
    } else if (draftSize || item.size) {
      // One names a size and the other does not. Mildly suspicious, not damning:
      // shops routinely leave the size off the product they only stock one of.
      score -= 0.05;
    }

    if (score >= ASK_THRESHOLD) {
      scored.push(toCandidate(item, 'name-similar', Math.min(1, score), explanation, explanationCode));
    }
  }

  if (scored.length === 0) return { kind: 'new' };

  scored.sort((a, b) => b.score - a.score);

  // A single, very strong, size-corroborated hit is treated as certain. Anything
  // less — including two good hits — is a question.
  const top = scored[0];
  const clear = scored.length === 1 || top.score - scored[1].score >= 0.15;
  if (clear && top.score >= CERTAIN_THRESHOLD && (!draftSize || !!top.explanation.includes('same size'))) {
    return { kind: 'certain', match: { ...top, reason: 'name-exact' } };
  }

  // Three is as many as a person will read. More than that and the review row
  // becomes a wall, which is how a bad merge gets clicked through.
  return { kind: 'possible', candidates: scored.slice(0, 3) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Import intent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What the owner means by importing this batch.
 *
 * The single most consequential setting in the importer, and it cannot be
 * inferred per row — only per batch. The same file of names and numbers means
 * "these are my correct figures" or "these just arrived in a van" depending on
 * why it was opened, and getting it wrong either loses a stock count or invents
 * stock that does not exist.
 *
 * So it is asked once, at the top of the review screen, defaulted from the
 * source, and never guessed at row level.
 */
export type ImportIntent =
  /** The batch is the truth: overwrite the mapped fields on anything matched. */
  | 'replace'
  /** The batch is an arrival: add its quantity to whatever is on hand. */
  | 'restock';

/**
 * The intent a source implies, before the owner says otherwise.
 *
 * - An **invoice** is goods received. Adding is the only reading of it.
 * - A **photo of a shelf** is a count of what is there now, so it replaces.
 * - A **spreadsheet, paste or desktop capture** is a list, and a list is a
 *   statement of fact about the whole catalogue — replace.
 * - **Typed text** is the ambiguous one, and it is resolved from the words
 *   themselves in `parseIntentFromText` rather than from the source.
 */
export function defaultIntent(source: ImportSource): ImportIntent {
  switch (source) {
    case 'invoice':
      return 'restock';
    case 'photo':
    case 'spreadsheet':
    case 'paste':
    case 'desktop':
    case 'barcode':
      return 'replace';
    case 'text':
      return 'restock';
  }
}

/**
 * Read the intent out of a typed sentence.
 *
 * "Add 20 cartons of Indomie" is a restock and "Indomie is now ₦12,000" is not,
 * and the verb is the only thing that distinguishes them. Falls back to the
 * source default when no verb is recognisable, rather than guessing.
 */
export function parseIntentFromText(text: string): ImportIntent | null {
  if (/\b(add|received|receive|delivered|delivery|bought|purchased|restock|top ?up|came in|supplied)\b/i.test(text)) {
    return 'restock';
  }
  if (/\b(set|change|update|correct|now|reprice|is now|should be|count|counted)\b/i.test(text)) {
    return 'replace';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Staging a whole batch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The decision a verdict implies, before a human touches it.
 *
 * A `possible` match always resolves to `create`, never to a merge. That is the
 * bias stated at the top of the file: if the owner clicks Import without reading
 * the questions, the worst outcome is a visible duplicate, not a corrupted stock
 * figure.
 */
export function autoDecision(verdict: MatchVerdict, intent: ImportIntent): RowDecision {
  if (verdict.kind === 'certain') {
    return intent === 'restock'
      ? { action: 'add-stock', productId: verdict.match.productId }
      : { action: 'overwrite', productId: verdict.match.productId };
  }
  return { action: 'create' };
}

/**
 * Match every draft against the catalogue, and against each other.
 *
 * Rows are processed in file order and each certain match claims its product, so
 * a second row matching the same product is forced to be a question. That is the
 * within-file duplicate case, and it is more common than it sounds: a file with a
 * per-branch or per-batch row per product hits it on every line.
 *
 * `previous` lets the caller preserve decisions a human already made — pass the
 * rows from the last run and any `decidedByUser` decision survives the re-match.
 */
export function stageRows(
  drafts: DraftProduct[],
  products: Product[],
  intent: ImportIntent,
  previous: StagedRow[] = [],
): StagedRow[] {
  const index = buildProductIndex(products);
  const claimed = new Set<string>();
  const held = new Map(previous.map((row) => [row.draft.key, row]));

  return drafts.map((draft) => {
    const verdict = matchDraft(draft, index, claimed);
    if (verdict.kind === 'certain') claimed.add(verdict.match.productId);

    const prior = held.get(draft.key);
    if (prior?.decidedByUser) {
      // Keep the human's decision, but refresh the verdict so the row still
      // shows what it matched. Dropping the verdict here is what made a
      // re-matched row lose the "existing stock: 24" line it was decided on.
      return { draft, verdict, decision: prior.decision, decidedByUser: true };
    }

    return { draft, verdict, decision: autoDecision(verdict, intent), decidedByUser: false };
  });
}

/** Rows still holding an unanswered question. Drives the review screen's badge. */
export function unresolvedRows(rows: StagedRow[]): StagedRow[] {
  return rows.filter((row) => row.verdict.kind === 'possible' && !row.decidedByUser);
}

/**
 * Pairs worth spending a credit on.
 *
 * Only `possible` verdicts nobody has answered, only their best candidate, and
 * capped. The cap is a cost control the owner can see: past 60 questions the
 * answer is not "spend more", it is that the file needs a SKU column, and the
 * review screen says so.
 */
export function aiMatchQueue(
  rows: StagedRow[],
  cap = 60,
): { key: string; name: string; candidates: MatchCandidate[] }[] {
  return unresolvedRows(rows)
    .slice(0, cap)
    .map((row) => ({
      key: row.draft.key,
      name: row.draft.name,
      candidates: row.verdict.kind === 'possible' ? row.verdict.candidates : [],
    }));
}

/**
 * Fold AI verdicts back in.
 *
 * The model may only *choose between candidates the deterministic pass already
 * produced*, or decline. It cannot introduce a product id, and one that tries is
 * ignored — a hallucinated id would merge a row into an unrelated product, which
 * is the worst outcome the whole module exists to prevent.
 */
export function applyAiMatches(
  rows: StagedRow[],
  verdicts: { key: string; productId: string | null }[],
  intent: ImportIntent,
): StagedRow[] {
  const byKey = new Map(verdicts.map((v) => [v.key, v]));

  return rows.map((row) => {
    if (row.decidedByUser) return row;
    const verdict = byKey.get(row.draft.key);
    if (!verdict || row.verdict.kind !== 'possible') return row;

    if (verdict.productId === null) {
      return { ...row, decision: { action: 'create' as const }, decidedByUser: false };
    }

    const chosen = row.verdict.candidates.find((c) => c.productId === verdict.productId);
    if (!chosen) return row;

    return {
      ...row,
      verdict: { kind: 'possible', candidates: [{ ...chosen, reason: 'ai' as const }, ...row.verdict.candidates.filter((c) => c.productId !== chosen.productId)] },
      decision:
        intent === 'restock'
          ? { action: 'add-stock' as const, productId: chosen.productId }
          : { action: 'overwrite' as const, productId: chosen.productId },
      decidedByUser: false,
    };
  });
}
