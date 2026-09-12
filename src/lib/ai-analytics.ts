/**
 * Zen AI usage analytics — the shared vocabulary between the recorder and the board.
 *
 * Imported by BOTH `src/app/api/chat/route.ts` (server, writes the rollups) and
 * `src/app/admin-imamshaffy/ai-usage/page.tsx` (client, reads them). So it must
 * stay free of `firebase-admin` and of anything Node-only — the moment this
 * module pulls in the Admin SDK the admin page stops building.
 *
 * ## What is deliberately NOT recorded
 *
 * Prompts are never stored. An owner's question carries customer names, phone
 * numbers and order details, and this board is platform-wide — one archive of
 * raw prompts would put every tenant's business under the platform owner's eye
 * with no way for them to know. What gets written instead is derived and
 * lossy: one intent label per turn, plus matches against the fixed retail
 * vocabulary below. A word that is not in `KEYWORD_VOCAB` cannot be recorded,
 * so a customer's surname has no path into the rollup even if it is typed.
 *
 * That is what makes "what are people asking" answerable without keeping the
 * asking. If raw samples are ever wanted, that is a policy decision to take
 * deliberately, not a line to slip in here.
 */

/** One rollup document per UTC day. Day boundaries match the quota reset in the route. */
export const AI_DAILY_COLLECTION = 'platform_stats/ai_usage_global/daily';

export function aiDailyDocId(date: Date | string): string {
  return typeof date === 'string' ? date : date.toISOString().split('T')[0];
}

/** Shape written by the route. Every map is sparse — absent means zero. */
export type AiDailyStats = {
  date: string;
  /** Chat turns that reached the model. */
  count?: number;
  /** Turns refused before the model: quota, injection scan, bad history. */
  blocked?: Record<string, number>;
  /** Turns that reached the model and then threw. */
  errors?: number;
  tools?: Record<string, number>;
  intents?: Record<string, number>;
  keywords?: Record<string, number>;
  /** Keyed by UTC hour, '0'–'23'. */
  hours?: Record<string, number>;
  /** Keyed by the plan in force at the time of the turn. */
  plans?: Record<string, number>;
  /** Keyed by businessId. Gives distinct-actives per day, which no other field can. */
  businesses?: Record<string, number>;
  tokensIn?: number;
  tokensOut?: number;
  /**
   * The same tokens as `tokensIn`/`tokensOut`, split by businessId.
   *
   * Parallel to `businesses` rather than nested inside it, because that map is
   * `Record<string, number>` by contract — it is what distinct-actives is counted
   * from, and `mergeCountMaps` skips any value that is not already a number. So
   * these are the only per-tenant cost figures that exist, and the only input to
   * "what is this business costing us": a turn count cannot price anything when one
   * turn is anywhere between one model round-trip and twenty-four.
   *
   * Absent for days before August 2026, when the route started writing them. A
   * business with turns and no tokens is old data, not a free tenant.
   */
  businessTokensIn?: Record<string, number>;
  businessTokensOut?: Record<string, number>;
  /**
   * Credits actually debited, platform-wide and per business.
   *
   * Not derivable from `count`: a turn costs one credit or twenty depending on how
   * much work it did, which is the entire reason `src/lib/server/ai-credits.ts`
   * exists. `count` stays the turn counter — the two answer different questions, and
   * the gap between them is what says whether the pricing is calibrated.
   */
  credits?: number;
  businessCredits?: Record<string, number>;
  /**
   * Credits that were spent but could not be collected.
   *
   * A turn already answered cannot be un-answered, so when the true cost overruns an
   * empty balance the difference is written off rather than pushing a shop negative.
   * This is that write-off: money the platform ate. Persistently non-zero means
   * `RESERVATION_CREDITS` reserves too little for the work being asked for, or that
   * `TOKENS_PER_CREDIT` is set too high.
   */
  unbilledCredits?: number;
  /** Summed, not averaged — divide by `count` at read time. */
  latencyMsTotal?: number;
  /** Turns where at least one propose* card was drawn. */
  proposalTurns?: number;

  /**
   * Smart importer AI usage, kept in its own series rather than folded into the
   * chat figures above.
   *
   * `count`, `credits`, `tokensIn`/`Out` and every per-business map above describe
   * **chat turns**, and several charts read meaning into the ratios between them —
   * credits ÷ count is how `TOKENS_PER_CREDIT` gets calibrated, and latency ÷ count
   * is the response-time series. Adding importer work to those would not break a
   * chart loudly; it would silently change what each one means, which is worse.
   *
   * So the importer writes here instead. Nothing existing shifts, and a board panel
   * can read these alongside the chat series without either having to be migrated.
   * Absent for days before the importer shipped, which is old data rather than a
   * quiet day.
   */
  importer?: Record<string, number>;
  /**
   * Flat count of importer AI calls that day, which the route's own rate limit
   * reads on every request.
   *
   * Redundant against summing `importer` and deliberately so: summing a map means
   * reading and parsing the whole map to answer one comparison, and this is
   * checked before every call. It is also why the importer's ceiling lives on this
   * per-day document rather than on `platform_stats/ai_usage_global` — that
   * document's `count` is only ever incremented and relies on a shared `date`
   * stamp to *appear* to reset, so a second feature stamping that date would make
   * the chat route read yesterday's total as today's.
   */
  importerCalls?: number;
  importerCredits?: number;
  importerTokensIn?: number;
  importerTokensOut?: number;
  /** Keyed by businessId — distinct shops that imported with AI that day. */
  importerBusinesses?: Record<string, number>;
  importerBusinessCredits?: Record<string, number>;
  /** Importer calls refused before the model, keyed by reason. */
  importerBlocked?: Record<string, number>;
  /** Importer calls that reached the model and then threw. */
  importerErrors?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Intent classification
// ─────────────────────────────────────────────────────────────────────────────

export type IntentMeta = { id: string; label: string; hint: string; color: string };

/**
 * The question behind the question, in the owner's terms rather than ours.
 *
 * Order matters: `classifyPrompt` returns the first match, so the specific
 * intents ("record a sale") sit above the general ones ("how is stock").
 */
export const INTENTS: IntentMeta[] = [
  { id: 'record_sale', label: 'Record a sale', hint: 'Ringing up a transaction from the chat', color: '#f97316' },
  { id: 'stock_change', label: 'Change stock or price', hint: 'Adjustments, restocks, thresholds, price edits', color: '#ef4444' },
  { id: 'stock_levels', label: "What's in stock", hint: 'Counts, low stock, what is about to run out', color: '#3b82f6' },
  { id: 'expiry_dead', label: 'Expiry & dead stock', hint: 'Ageing shelves and what to discount now', color: '#a855f7' },
  { id: 'sales_perf', label: 'How is business doing', hint: 'Takings, profit, trends, comparisons', color: '#10b981' },
  { id: 'forecasting', label: 'What happens next', hint: 'Projections, growth rate, stockout timing', color: '#8b5cf6' },
  { id: 'pricing_margin', label: 'Pricing & margins', hint: 'Cost, markup, which lines actually earn', color: '#14b8a6' },
  { id: 'product_lookup', label: 'Look up a product', hint: 'Show me, picture of, details for one item', color: '#ec4899' },
  { id: 'customers', label: 'Customers & debt', hint: 'Regulars, loyalty, who owes money', color: '#6366f1' },
  { id: 'staff_branch', label: 'Staff & branches', hint: 'Per-person and per-location performance', color: '#0ea5e9' },
  { id: 'audit', label: 'What changed', hint: 'Audit trail, history, who did what', color: '#64748b' },
  { id: 'reporting', label: 'Reports & overview', hint: 'Day book, summaries, full stock-take', color: '#22c55e' },
  { id: 'how_to', label: 'How do I…', hint: 'Navigation and product help', color: '#eab308' },
  { id: 'smalltalk', label: 'Greetings & thanks', hint: 'Hello, thank you, who are you', color: '#94a3b8' },
  { id: 'other', label: 'Something else', hint: 'No rule matched — worth reading if this climbs', color: '#cbd5e1' },
];

export const INTENT_LABELS: Record<string, string> = Object.fromEntries(
  INTENTS.map((i) => [i.id, i.label]),
);

export function intentColor(id: string): string {
  return INTENTS.find((i) => i.id === id)?.color ?? '#cbd5e1';
}

const INTENT_RULES: { id: string; test: RegExp }[] = [
  { id: 'record_sale', test: /\b(record|ring(ing)? up|log|enter|make)\s+(a\s+)?(sale|transaction|order)\b|\bsell\s+\d|\bsold\s+\d/i },
  { id: 'stock_change', test: /\b(adjust|update|change|set|increase|reduce|decrease|correct|restock|reorder|add)\b.{0,24}\b(stock|price|quantity|qty|threshold|level|loyalty|points)\b|\bmark\s+(up|down)\b/i },
  { id: 'expiry_dead', test: /\bexpir\w*|\bdead\s*stock\b|\bnot\s+(moving|sold|selling)\b|\bsitting\b|\bslow\s+mov\w*|\bobsolete\b|\bstale\b/i },
  { id: 'forecasting', test: /\bforecast\w*|\bproject\w*|\bpredict\w*|\bwill\s+i\b|\bnext\s+(week|month|quarter|year)\b|\bgrow\w*\s+(rate|fast)|\bhow\s+fast\s+am\s+i\b|\brun\s+out\s+in\b|\btrend\w*\s+for\b/i },
  { id: 'stock_levels', test: /\b(stock|inventory|shelf|shelves|units?|quantity|qty)\b|\brun(ning)?\s+out\b|\blow\b|\bhow\s+many\b|\bdays?\s+of\s+cover\b|\bvaluation\b|\bworth\b/i },
  { id: 'pricing_margin', test: /\bmargin\w*|\bmark\s*up\b|\bcost\s+price\b|\bprofit\s+per\b|\bbelow\s+cost\b|\bprofitab\w*/i },
  { id: 'sales_perf', test: /\b(sales?|takings?|revenue|turnover|profit|income|earnings?)\b|\bhow\s+(did|are|is)\s+(we|it|business|today|things)\b|\bcompare\b|\bbest\s+sell\w*|\bworst\s+sell\w*|\bpeak\s+hours?\b|\bbusiest\b/i },
  { id: 'product_lookup', test: /\bshow\s+me\b|\bpicture\b|\bphoto\b|\bimage\b|\bwhat\s+does\b.{0,20}\blook\s+like\b|\bfind\s+product\w*|\bdetails?\s+(for|of|on)\b|\bsku\b|\bbarcode\b/i },
  { id: 'customers', test: /\bcustomer\w*|\bclient\w*|\bloyalty\b|\bpoints?\b|\bowes?\b|\bowing\b|\bdebt\w*|\bunpaid\b|\binvoice\w*|\breceivable\w*|\bregular\w*|\bat[-\s]?risk\b/i },
  { id: 'staff_branch', test: /\bstaff\b|\bemployee\w*|\bcashier\w*|\bbranch\w*|\bstore\s+(location|performance)|\boutlet\w*|\bwho\s+sold\b|\bper\s+person\b/i },
  { id: 'audit', test: /\baudit\b|\blog\w*\b|\bwho\s+(changed|did|deleted|edited)\b|\bwhat\s+changed\b|\bhistory\b|\btrail\b/i },
  { id: 'reporting', test: /\breport\w*|\bsummar\w*|\boverview\b|\bday\s*book\b|\bexport\b|\bstock[-\s]?take\b|\bdashboard\b|\bfull\s+picture\b/i },
  { id: 'how_to', test: /\bhow\s+do\s+i\b|\bhow\s+(can|to)\b|\bwhere\s+(is|do|can)\b|\bopen\s+(my|the)\b|\btake\s+me\s+to\b|\bhelp\s+me\b|\bexplain\b|\bwhat\s+can\s+you\s+do\b/i },
  { id: 'smalltalk', test: /^\s*(hi|hey|hello|yo|good\s+(morning|afternoon|evening)|thanks?|thank\s+you|ok(ay)?|cool|nice|well\s+done|who\s+are\s+you|what\s+are\s+you)\b/i },
];

/**
 * Bucket a prompt into one intent.
 *
 * Keyword rules rather than a model call: classifying with Gemini would double
 * the cost of every turn to fill in a chart, and a wrong bucket here is a
 * cosmetic problem, not a wrong answer to the owner.
 */
export function classifyPrompt(text: string): string {
  const t = (text || '').slice(0, 500);
  if (!t.trim()) return 'other';
  for (const rule of INTENT_RULES) {
    if (rule.test.test(t)) return rule.id;
  }
  return 'other';
}
// ─────────────────────────────────────────────────────────────────────────────
// Keyword extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The only words that can ever be recorded.
 *
 * An allow-list, not a stop-word filter, and that direction is the whole point:
 * a filter has to anticipate every word worth suppressing (names, phone
 * numbers, addresses) and leaks whatever it failed to think of. This can only
 * ever emit retail vocabulary that was decided here, in advance.
 */
export const KEYWORD_VOCAB: string[] = [
  'stock', 'inventory', 'product', 'products', 'price', 'prices', 'cost', 'profit', 'margin',
  'sale', 'sales', 'sell', 'sold', 'revenue', 'takings', 'turnover', 'income',
  'customer', 'customers', 'loyalty', 'points', 'debt', 'owes', 'unpaid', 'invoice',
  'today', 'yesterday', 'week', 'month', 'year', 'quarter', 'daily', 'weekly', 'monthly',
  'low', 'empty', 'restock', 'reorder', 'expiry', 'expired', 'expiring', 'dead',
  'best', 'worst', 'top', 'bottom', 'busiest', 'peak', 'hours', 'trend', 'trending',
  'forecast', 'projection', 'predict', 'growth', 'grow', 'compare', 'comparison',
  'report', 'summary', 'overview', 'export', 'receipt', 'receipts', 'transaction', 'transactions',
  'staff', 'branch', 'branches', 'employee', 'cashier', 'shift',
  'audit', 'log', 'history', 'changed', 'deleted', 'edited',
  'category', 'categories', 'brand', 'supplier', 'purchase', 'order', 'orders',
  'cash', 'card', 'transfer', 'payment', 'discount', 'tax', 'vat',
  'threshold', 'quantity', 'units', 'valuation', 'worth', 'coverage', 'velocity',
  'picture', 'photo', 'image', 'show', 'find', 'search', 'check', 'help',
  'problem', 'problems', 'wrong', 'error', 'missing', 'negative', 'duplicate',
];

const VOCAB_SET = new Set(KEYWORD_VOCAB);

/**
 * Terms from the prompt that appear in the vocabulary, de-duplicated.
 *
 * Capped so one long paste cannot dominate a day's counts, and lower-cased so
 * "Stock" and "stock" are the same bar on the chart.
 */
export function extractKeywords(text: string, max = 8): string[] {
  const words = (text || '').slice(0, 500).toLowerCase().match(/[a-z]+/g) ?? [];
  const seen: string[] = [];
  for (const w of words) {
    if (VOCAB_SET.has(w) && !seen.includes(w)) {
      seen.push(w);
      if (seen.length >= max) break;
    }
  }
  return seen;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool grouping
// ─────────────────────────────────────────────────────────────────────────────

export type ToolGroup = {
  id: string;
  label: string;
  color: string;
};

export const TOOL_GROUPS: ToolGroup[] = [
  { id: 'inventory', label: 'Inventory', color: '#3b82f6' },
  { id: 'sales', label: 'Sales & reports', color: '#10b981' },
  { id: 'forecast', label: 'Forecasting', color: '#8b5cf6' },
  { id: 'customers', label: 'Customers', color: '#6366f1' },
  { id: 'operations', label: 'Branches & staff', color: '#0ea5e9' },
  { id: 'navigation', label: 'Navigation & help', color: '#eab308' },
  { id: 'writes', label: 'Proposed changes', color: '#f97316' },
];

export const TOOL_GROUP_LABELS: Record<string, string> = Object.fromEntries(
  TOOL_GROUPS.map((g) => [g.id, g.label]),
);

/**
 * Which part of the business a tool touches.
 *
 * Matched on the tool name rather than kept as a row-per-tool table, so a tool
 * added to `tools.ts` lands in the right group without anyone remembering to come
 * back here. A genuinely new area falls to `inventory` — visible in the chart
 * as a group that grew for no reason, which is the cue to add a rule.
 */
export function groupForTool(name: string): string {
  if (/^propose/.test(name)) return 'writes';
  if (/Customer|Loyalty|Unpaid|Invoice/i.test(name)) return 'customers';
  if (/forecast|Growth|Trend|Compare/i.test(name)) return 'forecast';
  // `LossPrevention` and `Unanswered` are named here rather than left to the
  // fallback: neither has an inventory word in it, so both used to be filed under
  // Inventory — a loss sweep is operational, and a logged miss is a help gap.
  if (/Branch|Staff|Audit|Overview|LossPrevention/i.test(name)) return 'operations';
  if (/linkToPage|explainHowTo|Unanswered/i.test(name)) return 'navigation';
  if (/Sales|Daily|Transactions|Peak|Selling|Margin|Rating/i.test(name)) return 'sales';
  return 'inventory';
}

/** Sum the per-tool maps of many documents into one. */
export function mergeCountMaps(
  maps: (Record<string, number> | undefined)[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) {
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/** Highest-first entries of a count map, ready for a bar chart. */
export function topEntries(
  map: Record<string, number>,
  limit = 10,
): { key: string; value: number }[] {
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => ({ key, value }));
}

/**
 * The last `days` UTC dates, oldest first.
 *
 * UTC to match `aiDailyDocId` and the quota reset — deriving these from local
 * midnight would ask for documents a day either side of the ones that exist.
 */
export function recentDates(days: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(now - i * 86_400_000).toISOString().split('T')[0]);
  }
  return out;
}
