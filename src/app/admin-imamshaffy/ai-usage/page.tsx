'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import {
  collection, doc, getDoc, getDocs, query, where, increment, documentId, orderBy, limit,
  runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Zap, TrendingUp, AlertTriangle, Search, PlusCircle, CheckCircle2, Wrench, Users,
  ShieldAlert, Timer, Coins, MessageSquare, RefreshCw, ShieldCheck, Gauge, Activity,
  ScrollText, Gift, CreditCard, Eye, Copy, Bot, MessageCircle, User, Sparkles,
} from 'lucide-react';
import { Markdown } from '@/components/ai-insights/markdown';
import {
  ZEN_TOOL_COUNT, ZEN_TOOL_NAMES, ZEN_READ_TOOL_NAMES, ZEN_WRITE_TOOL_NAMES, labelForTool,
} from '@/components/ai-insights/zen-status';
import {
  AI_DAILY_COLLECTION, INTENTS, TOOL_GROUPS,
  groupForTool, mergeCountMaps, topEntries, recentDates,
  type AiDailyStats,
} from '@/lib/ai-analytics';
import {
  AI_CREDIT_LEDGER_COLLECTION, describeLedgerEntry, type AiCreditLedgerEntry,
} from '@/lib/ai-credit-ledger';
import {
  ZEN_MODEL, estimateCostUsd, formatUsd, formatTokens,
} from '@/lib/ai-cost';
import {
  MetricCard, DetailRow, ReferenceNote, type SparkPoint,
} from '@/components/admin/ai-usage/metric-card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  BarChart, LineChart, PieChart, ComposedChart, XAxis, YAxis, Bar, Line, Pie, Cell, Area,
  CartesianGrid, Legend, Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';

/**
 * Admin AI board.
 *
 * Two data sources, and the split matters for reading the numbers:
 *
 *   - `platform_stats/ai_usage_global/daily/{YYYY-MM-DD}` — platform-wide day
 *     rollups written by the chat route. Everything time-based comes from here,
 *     which means history only exists from the day that recorder shipped.
 *     Earlier days are genuinely absent, not zero, and the page says so rather
 *     than drawing a flat line that looks like nobody used it.
 *   - `businessInstances` — per-tenant lifetime tool counts, today's quota
 *     position and bonus credits.
 *
 * Reads are bounded on purpose: N day documents for the selected range plus one
 * query for active businesses. Nothing here fans out per tenant per day.
 */

const GLOBAL_LIMIT = 1500;
const RANGES = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
];

const AXIS = { fontSize: 11, tickLine: false, axisLine: false } as const;

/** Chart-ready day, with the gaps filled so the x-axis stays evenly spaced. */
type DayPoint = {
  date: string;
  label: string;
  turns: number;
  blocked: number;
  errors: number;
  businesses: number;
  proposals: number;
  tokens: number;
  tokensIn: number;
  tokensOut: number;
  avgLatency: number;
  present: boolean;
};

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/**
 * A credit-ledger row's time, tolerating the row that has no time yet.
 *
 * `serverTimestamp()` is a sentinel, not a value: the local echo of a freshly
 * written row carries `null` there until the server acknowledges it. "Just now" is
 * the honest reading of that — the movement happened, only the server's clock has
 * not come back — and it beats an empty cell, which reads as data loss on the one
 * table that exists to prove nothing was lost.
 */
function ledgerTime(ts: any): string {
  const at = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
  if (!at || Number.isNaN(at.getTime())) return 'Just now';
  return at.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSessionTime(ts: any): string {
  const at = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : (ts?.seconds ? new Date(ts.seconds * 1000) : null);
  if (!at || Number.isNaN(at.getTime())) return 'Recently';
  return at.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * The window immediately before the selected one, same length.
 *
 * `recentDates(2n)` minus its tail rather than its own date maths, so the two
 * windows can never drift apart at a month boundary or across a DST-shifted
 * local midnight — both are derived from the same UTC generator.
 */
function priorDates(rangeDays: number): string[] {
  return recentDates(rangeDays * 2).slice(0, rangeDays);
}

/** Totals for one window, used for both the current period and the one before. */
type WindowTotals = {
  turns: number;
  blocked: number;
  errors: number;
  proposals: number;
  tokens: number;
  tokensIn: number;
  tokensOut: number;
  latencySum: number;
  avgLatency: number;
  businesses: number;
  toolCalls: number;
};

function extractMessageText(msg: any, defaultFallback?: string): string {
  if (typeof msg?.content === 'string' && msg.content.trim()) return msg.content;
  
  if (Array.isArray(msg?.parts)) {
    const textParts = msg.parts
      .filter((p: any) => p.type === 'text' && typeof p.text === 'string' && p.text.trim())
      .map((p: any) => p.text);
      
    if (textParts.length > 0) return textParts.join('\n\n');
    
    // If no text parts, try to format any tool calls for visibility
    const toolCall = msg.parts.find((p: any) => (p.type && p.type.startsWith('tool-')) || p.toolCallId);
    if (toolCall) {
      if (toolCall.output) return `[Tool Result: ${toolCall.type || 'Unknown'}]\n${JSON.stringify(toolCall.output, null, 2)}`;
      if (toolCall.input) return `[Called Tool: ${toolCall.type || 'Unknown'}]\n${JSON.stringify(toolCall.input, null, 2)}`;
      return `[Tool Call: ${toolCall.type || 'Unknown'}]`;
    }
  }
  
  return defaultFallback || JSON.stringify(msg, null, 2);
}

function foldDays(docs: AiDailyStats[]): WindowTotals {
  const turns = docs.reduce((s, d) => s + (d.count ?? 0), 0);
  const latencySum = docs.reduce((s, d) => s + (d.latencyMsTotal ?? 0), 0);
  const tokensIn = docs.reduce((s, d) => s + (d.tokensIn ?? 0), 0);
  const tokensOut = docs.reduce((s, d) => s + (d.tokensOut ?? 0), 0);
  return {
    turns,
    blocked: docs.reduce((s, d) => s + Object.values(d.blocked ?? {}).reduce((a, n) => a + n, 0), 0),
    errors: docs.reduce((s, d) => s + (d.errors ?? 0), 0),
    proposals: docs.reduce((s, d) => s + (d.proposalTurns ?? 0), 0),
    tokens: tokensIn + tokensOut,
    tokensIn,
    tokensOut,
    latencySum,
    avgLatency: turns > 0 ? Math.round(latencySum / turns) : 0,
    // Distinct tenants, not the sum of daily actives — the same shop on five
    // days is one business, not five.
    businesses: new Set(docs.flatMap((d) => Object.keys(d.businesses ?? {}))).size,
    toolCalls: docs.reduce(
      (s, d) => s + Object.values(d.tools ?? {}).reduce((a, n) => a + n, 0),
      0,
    ),
  };
}

export default function AdminAIUsage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [rangeDays, setRangeDays] = useState(14);
  const [globalCount, setGlobalCount] = useState(0);
  const [days, setDays] = useState<AiDailyStats[]>([]);
  const [priorDays, setPriorDays] = useState<AiDailyStats[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [grantAmount, setGrantAmount] = useState(100);
  /**
   * Why the credits were given, carried onto the ledger row.
   *
   * Optional, because refusing a grant over a blank text box would be worse than
   * an unexplained one — but the whole reason the ledger exists is that
   * "who gave this shop 10,000 credits, and why" had no answer, and the amount
   * alone only answers half of it.
   */
  const [grantNote, setGrantNote] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null);
  const [isGranting, setIsGranting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ledger, setLedger] = useState<AiCreditLedgerEntry[]>([]);

  const [unansweredQueries, setUnansweredQueries] = useState<any[]>([]);
  // User chat sessions & transcript inspector
  const [userAiSessions, setUserAiSessions] = useState<any[]>([]);
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<any | null>(null);
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatPlanFilter, setChatPlanFilter] = useState('all');
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!firestore || !user) return;
    loadData();
    // Re-runs when the range changes: a wider window needs day documents that
    // were never fetched, and they cannot be derived from the ones held.
  }, [firestore, user, rangeDays]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const wanted = recentDates(rangeDays);
      const prior = priorDates(rangeDays);

      /*
       * `documentId()` with `in` fetches the whole range in one query rather
       * than one getDoc per day.
       *
       * Chunked at 10 because that is Firestore's floor for `in` across SDK
       * versions, and chunking is free here: billing is per document returned,
       * not per query, so the only cost of an extra chunk is a round trip. The
       * alternative — one query at the current 30-value cap — sits exactly on
       * the limit, and the next range added to RANGES would break it silently.
       *
       * The prior window doubles the day documents read (2 × rangeDays, so 60
       * at the widest range). That is deliberate and bounded: it is what makes
       * every figure comparable rather than a number floating on its own, this
       * page is super-admin-only, and it refetches on an explicit Refresh or a
       * range change — not on a timer and not per tenant.
       */
      const chunks: string[][] = [];
      for (let i = 0; i < wanted.length; i += 10) chunks.push(wanted.slice(i, i + 10));
      const priorChunks: string[][] = [];
      for (let i = 0; i < prior.length; i += 10) priorChunks.push(prior.slice(i, i + 10));

      const [globalDoc, dailySnaps, priorSnaps, bSnap, unansweredSnap, ledgerSnap, aiSessionsSnap] = await Promise.all([
        getDoc(doc(firestore, 'platform_stats', 'ai_usage_global')),
        Promise.all(
          chunks.map((ids) =>
            getDocs(query(collection(firestore, AI_DAILY_COLLECTION), where(documentId(), 'in', ids))),
          ),
        ),
        Promise.all(
          priorChunks.map((ids) =>
            getDocs(query(collection(firestore, AI_DAILY_COLLECTION), where(documentId(), 'in', ids))),
          ),
        ),
        getDocs(query(collection(firestore, 'businessInstances'), where('status', '==', 'active'))),
        getDocs(query(collection(firestore, 'ai_unanswered_queries'), orderBy('createdAt', 'desc'), limit(50))),
        /*
         * Credit movements, newest first.
         *
         * Ordering on one field needs no composite index — Firestore indexes
         * single fields automatically — so this collection needed no index and no
         * rules entry (see the header of `src/lib/ai-credit-ledger.ts`). 40 rows
         * is 40 document reads on a super-admin-only page that refetches on an
         * explicit Refresh, and it is the only record of where a balance came
         * from. Tolerated failing on its own: the ledger is new, so an
         * older deployment or a rules mismatch should cost the page its ledger
         * card, not every chart on it.
         */
        getDocs(
          query(collection(firestore, AI_CREDIT_LEDGER_COLLECTION), orderBy('timestamp', 'desc'), limit(40)),
        ).catch(() => null),
        getDocs(
          query(collection(firestore, 'ai_sessions'), orderBy('updatedAt', 'desc'), limit(150)),
        ).catch(() => null),
      ]);

      if (globalDoc.exists()) {
        const data = globalDoc.data();
        setGlobalCount(data.date === todayStr ? data.count || 0 : 0);
      } else {
        setGlobalCount(0);
      }

      setDays(dailySnaps.flatMap((snap) => snap.docs.map((d) => ({ date: d.id, ...(d.data() as any) }))));
      setPriorDays(priorSnaps.flatMap((snap) => snap.docs.map((d) => ({ date: d.id, ...(d.data() as any) }))));

      const bData = bSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b: any) => b.aiUsageCount > 0 || b.aiBonusCredits > 0 || b.aiToolUsageCounts)
        .sort((a: any, b: any) => {
          const currentMonthStr = todayStr.substring(0, 7);
          const aCount = a.aiUsageCurrentDate === currentMonthStr ? a.aiUsageCount || 0 : 0;
          const bCount = b.aiUsageCurrentDate === currentMonthStr ? b.aiUsageCount || 0 : 0;
          if (bCount !== aCount) return bCount - aCount;
          const aLife = Object.values(a.aiToolUsageCounts || {}).reduce((s: number, n: any) => s + n, 0);
          const bLife = Object.values(b.aiToolUsageCounts || {}).reduce((s: number, n: any) => s + n, 0);
          return (bLife as number) - (aLife as number);
        });

      setBusinesses(bData);
      setUnansweredQueries(unansweredSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLedger(
        ledgerSnap
          ? ledgerSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as AiCreditLedgerEntry)
          : [],
      );
      setUserAiSessions(
        aiSessionsSnap ? aiSessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : [],
      );
    } catch (error) {
      console.error('Failed to load AI usage:', error);
      toast({ variant: 'destructive', title: 'Could not load AI analytics', description: 'Check the console for details.' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Grant credits, and record that it happened.
   *
   * This used to be one bare `updateDoc(bRef, { aiBonusCredits: increment(n) })`
   * with no trail of any kind, which was survivable while a grant was a favour
   * and nothing else could move that number. Now a purchase moves it too, so an
   * unexplained jump in a balance has two possible causes and no way to tell them
   * apart — hence a ledger row alongside every movement.
   *
   * Three things about the shape:
   *
   * - **A transaction, not a plain update.** `balanceBefore`/`balanceAfter` are the
   *   point of the row, and reading the balance outside the write would record a
   *   figure that a chat turn could already have moved. The transaction serialises
   *   on the business document, so what it read is what the increment applied to.
   * - **`increment`, still, inside the transaction.** Writing `before + amount` as
   *   a computed total would be safe here *because* of the transaction, but the
   *   rule across every credit writer is the same — never a computed total — and
   *   this being the one exception is how the rule stops being followed.
   * - **Validated before either write.** `Number(e.target.value)` on an empty box
   *   is `NaN`, and Firestore rejects `increment(NaN)` at the SDK boundary with a
   *   message about unsupported field values that says nothing about credits. Zero
   *   and negatives are worse: they commit, and write a ledger row asserting a
   *   movement that did not happen.
   */
  const handleGrantCredits = async () => {
    if (!selectedBusiness || !firestore) return;

    const amount = Math.floor(Number(grantAmount));
    if (!Number.isFinite(amount) || amount < 1) {
      toast({ variant: 'destructive', title: 'Enter a whole number of credits', description: 'The amount must be at least 1.' });
      return;
    }
    // Not a security boundary — the platform owner can grant whatever they like
    // by clicking twice. It is a typo guard: 100000 instead of 1000 is one held
    // key, and there is no way to take credits back.
    if (amount > 50000) {
      toast({ variant: 'destructive', title: 'That is a lot of credits', description: 'Grants are capped at 50,000 at a time. Grant twice if you meant it.' });
      return;
    }

    setIsGranting(true);
    try {
      const bRef = doc(firestore, 'businessInstances', selectedBusiness.id);
      const note = grantNote.trim();

      const balanceAfter = await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(bRef);
        if (!snap.exists()) throw new Error('That business no longer exists.');
        const before = Math.max(0, Number(snap.data()?.aiBonusCredits) || 0);

        tx.update(bRef, { aiBonusCredits: increment(amount) });

        // `doc(collection(...))` allocates the id client-side without touching the
        // network, which is what lets a brand-new document be written inside a
        // transaction at all — there is no server round trip to await here.
        const ledgerRef = doc(collection(firestore, AI_CREDIT_LEDGER_COLLECTION));
        tx.set(ledgerRef, {
          businessId: selectedBusiness.id,
          businessName: selectedBusiness.name ?? null,
          kind: 'grant',
          source: 'admin',
          credits: amount,
          actorId: user?.uid ?? null,
          actorLabel: user?.email ?? null,
          balanceBefore: before,
          balanceAfter: before + amount,
          note: note || null,
          timestamp: serverTimestamp(),
        });

        return before + amount;
      });

      toast({
        title: 'Credits granted',
        description: `${amount.toLocaleString()} credits added to ${selectedBusiness.name}. Their balance is now ${balanceAfter.toLocaleString()}.`,
      });
      setIsDialogOpen(false);
      setGrantNote('');
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Nothing was granted',
        description: error?.message || 'The grant failed and no credits were added.',
      });
    } finally {
      setIsGranting(false);
    }
  };
  // ── Derived analytics ────────────────────────────────────────────────────
  // All of it memoised on `days`/`businesses`: these fold over every day
  // document and every tenant, and recomputing on each keystroke in the search
  // box made the table janky.

  const byDate = useMemo(() => {
    const m = new Map<string, AiDailyStats>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  /** One point per day in the range, whether or not a document exists for it. */
  const series = useMemo<DayPoint[]>(() => {
    return recentDates(rangeDays).map((date) => {
      const d = byDate.get(date);
      const turns = d?.count ?? 0;
      const blocked = Object.values(d?.blocked ?? {}).reduce((s, n) => s + n, 0);
      return {
        date,
        label: shortDate(date),
        turns,
        blocked,
        errors: d?.errors ?? 0,
        businesses: Object.keys(d?.businesses ?? {}).length,
        proposals: d?.proposalTurns ?? 0,
        tokens: (d?.tokensIn ?? 0) + (d?.tokensOut ?? 0),
        tokensIn: d?.tokensIn ?? 0,
        tokensOut: d?.tokensOut ?? 0,
        // Averaged at read time — the rollup stores the sum, because you cannot
        // add two averages together and get the average of the whole.
        avgLatency: turns > 0 ? Math.round((d?.latencyMsTotal ?? 0) / turns) : 0,
        present: !!d,
      };
    });
  }, [byDate, rangeDays]);

  const totals = useMemo(() => {
    const turns = series.reduce((s, p) => s + p.turns, 0);
    const blocked = series.reduce((s, p) => s + p.blocked, 0);
    const errors = series.reduce((s, p) => s + p.errors, 0);
    const proposals = series.reduce((s, p) => s + p.proposals, 0);
    const tokens = series.reduce((s, p) => s + p.tokens, 0);
    const latencySum = days.reduce((s, d) => s + (d.latencyMsTotal ?? 0), 0);
    const daysWithData = series.filter((p) => p.present).length;
    return {
      turns, blocked, errors, proposals, tokens, daysWithData,
      tokensIn: days.reduce((s, d) => s + (d.tokensIn ?? 0), 0),
      tokensOut: days.reduce((s, d) => s + (d.tokensOut ?? 0), 0),
      avgLatency: turns > 0 ? Math.round(latencySum / turns) : 0,
      avgPerDay: daysWithData > 0 ? Math.round(turns / daysWithData) : 0,
      // Distinct tenants across the window, not the sum of daily actives — the
      // same shop on five days is one business, not five.
      distinctBusinesses: new Set(days.flatMap((d) => Object.keys(d.businesses ?? {}))).size,
      peakDay: series.reduce<DayPoint | null>((best, p) => (!best || p.turns > best.turns ? p : best), null),
    };
  }, [series, days]);

  /** The same fold over the window before this one — every card's comparison. */
  const prior = useMemo(() => foldDays(priorDays), [priorDays]);

  /** Platform-wide tool calls for the window. */
  const toolTotals = useMemo(() => mergeCountMaps(days.map((d) => d.tools)), [days]);

  /**
   * Lifetime tool calls, summed across tenants.
   *
   * Kept beside the windowed figure because the two answer different questions:
   * this one has depth (it predates the day rollups) but cannot be filtered by
   * date, so a tool retired last month still shows here.
   */
  const lifetimeToolTotals = useMemo(
    () => mergeCountMaps(businesses.map((b) => b.aiToolUsageCounts)),
    [businesses],
  );

  /**
   * Every tool Zen AI has, beside how often it was actually reached for.
   *
   * Built from `ZEN_TOOL_NAMES` rather than from the recorded counts, so a tool
   * that has never been called still appears — with a zero. A roster derived
   * from usage can only ever show what was used, which is precisely the half
   * that does not need investigating.
   */
  const toolRoster = useMemo(() => {
    const rows = ZEN_TOOL_NAMES.map((name) => ({
      name,
      label: labelForTool(name),
      group: groupForTool(name),
      isPropose: name.startsWith('propose'),
      windowCalls: toolTotals[name] ?? 0,
      lifetimeCalls: lifetimeToolTotals[name] ?? 0,
    })).map((r) => ({ ...r, everCalled: r.windowCalls > 0 || r.lifetimeCalls > 0 }));

    const used = rows.filter((r) => r.everCalled);
    return {
      rows,
      used,
      unused: rows.filter((r) => !r.everCalled),
      usedInWindow: rows.filter((r) => r.windowCalls > 0).length,
      // Share of the surface that has ever been exercised. The interesting
      // reading is a low number with high turn volume: people are using Zen AI
      // hard through a narrow slice of what it can do.
      coverage: rows.length > 0 ? (used.length / rows.length) * 100 : 0,
      topInWindow: [...rows].filter((r) => r.windowCalls > 0).sort((a, b) => b.windowCalls - a.windowCalls),
      topLifetime: [...rows].filter((r) => r.lifetimeCalls > 0).sort((a, b) => b.lifetimeCalls - a.lifetimeCalls),
      totalWindowCalls: rows.reduce((s, r) => s + r.windowCalls, 0),
    };
  }, [toolTotals, lifetimeToolTotals]);

  /** Ceiling spend for both windows. See `ai-cost.ts` on why it is a ceiling. */
  const cost = useMemo(
    () => ({
      window: estimateCostUsd(totals.tokensIn, totals.tokensOut),
      prior: estimateCostUsd(prior.tokensIn, prior.tokensOut),
      perTurn: totals.turns > 0 ? estimateCostUsd(totals.tokensIn, totals.tokensOut) / totals.turns : 0,
    }),
    [totals, prior],
  );

  /** Sparkline series, one builder so every card's bars mean the same thing. */
  const spark = useMemo(() => {
    const build = (pick: (p: DayPoint) => number): SparkPoint[] =>
      series.map((p) => ({ label: p.label, value: pick(p), present: p.present }));
    return {
      turns: build((p) => p.turns),
      tokens: build((p) => p.tokens),
      latency: build((p) => p.avgLatency),
      businesses: build((p) => p.businesses),
      errors: build((p) => p.errors),
      blocked: build((p) => p.blocked),
      proposals: build((p) => p.proposals),
    };
  }, [series]);

  const toolChart = useMemo(() => {
    const source = totals.turns > 0 ? toolTotals : lifetimeToolTotals;
    return topEntries(source, 12).map((e) => ({
      name: labelForTool(e.key),
      tool: e.key,
      calls: e.value,
      fill: TOOL_GROUPS.find((g) => g.id === groupForTool(e.key))?.color ?? '#94a3b8',
    }));
  }, [toolTotals, lifetimeToolTotals, totals.turns]);

  /** Tool calls rolled up by area of the business. */
  const groupChart = useMemo(() => {
    const source = Object.keys(toolTotals).length ? toolTotals : lifetimeToolTotals;
    const acc: Record<string, number> = {};
    for (const [tool, n] of Object.entries(source)) {
      const g = groupForTool(tool);
      acc[g] = (acc[g] ?? 0) + n;
    }
    return TOOL_GROUPS
      .map((g) => ({ name: g.label, value: acc[g.id] ?? 0, fill: g.color }))
      .filter((r) => r.value > 0);
  }, [toolTotals, lifetimeToolTotals]);

  /** What people are asking, by intent. */
  const intentChart = useMemo(() => {
    const merged = mergeCountMaps(days.map((d) => d.intents));
    const total = Object.values(merged).reduce((s, n) => s + n, 0);
    return INTENTS
      .map((i) => ({
        id: i.id,
        name: i.label,
        hint: i.hint,
        value: merged[i.id] ?? 0,
        share: total > 0 ? Math.round(((merged[i.id] ?? 0) / total) * 100) : 0,
        fill: i.color,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [days]);

  /** Vocabulary hits — the words behind the intents. */
  const keywordChart = useMemo(() => {
    const merged = mergeCountMaps(days.map((d) => d.keywords));
    return topEntries(merged, 22).map((e) => ({ name: e.key, value: e.value }));
  }, [days]);

  /** Refusals by reason. Small numbers, but the ones worth acting on. */
  const blockedChart = useMemo(() => {
    const merged = mergeCountMaps(days.map((d) => d.blocked));
    const LABELS: Record<string, string> = {
      plan_limit: 'Hit their plan limit',
      global_limit: 'Hit the platform limit',
      injection: 'Injection scan fired',
      bad_history: 'Unreadable chat history',
    };
    const COLORS: Record<string, string> = {
      plan_limit: '#f59e0b',
      global_limit: '#ef4444',
      injection: '#7c3aed',
      bad_history: '#64748b',
    };
    return Object.entries(merged)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ key: k, name: LABELS[k] ?? k, value: v, fill: COLORS[k] ?? '#94a3b8' }));
  }, [days]);

  /** Demand by hour, UTC. Tells you when the quota is actually under pressure. */
  const hourChart = useMemo(() => {
    const merged = mergeCountMaps(days.map((d) => d.hours));
    return Array.from({ length: 24 }, (_, h) => ({
      name: `${String(h).padStart(2, '0')}:00`,
      hour: h,
      value: merged[String(h)] ?? 0,
    }));
  }, [days]);

  /** Turns by the plan in force at the time — where the load actually sits. */
  const planChart = useMemo(() => {
    const merged = mergeCountMaps(days.map((d) => d.plans));
    const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#64748b', '#ec4899'];
    return Object.entries(merged)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v], i) => ({ name: k, value: v, fill: COLORS[i % COLORS.length] }));
  }, [days]);

  /** Per-tenant totals for the table, windowed where the data allows. */
  const businessRows = useMemo(() => {
    const windowed = mergeCountMaps(days.map((d) => d.businesses));
    const windowedIn = mergeCountMaps(days.map((d) => d.businessTokensIn));
    const windowedOut = mergeCountMaps(days.map((d) => d.businessTokensOut));
    return businesses.map((b) => {
      const lifetime = Object.values(b.aiToolUsageCounts || {}).reduce(
        (s: number, n: any) => s + (typeof n === 'number' ? n : 0),
        0,
      ) as number;
      const favourite = topEntries(b.aiToolUsageCounts || {}, 1)[0];
      const currentMonthStr = todayStr.substring(0, 7);
      // Per-tenant spend over the charted window. Zero-with-turns is old data:
      // the route only began attributing tokens per business in August 2026, so
      // the column reads "—" rather than "$0.00" in that case — a tenant who
      // cost nothing and a tenant we did not measure are different answers.
      const tokIn = windowedIn[b.id] ?? 0;
      const tokOut = windowedOut[b.id] ?? 0;
      return {
        ...b,
        todayUsage: b.aiUsageCurrentDate === currentMonthStr ? b.aiUsageCount || 0 : 0,
        windowTurns: windowed[b.id] ?? 0,
        windowTokens: tokIn + tokOut,
        windowCost: estimateCostUsd(tokIn, tokOut),
        costMeasured: tokIn + tokOut > 0,
        lifetimeCalls: lifetime,
        favouriteTool: favourite ? labelForTool(favourite.key) : null,
        favouriteCount: favourite?.value ?? 0,
      };
    });
  }, [businesses, days, todayStr]);

  const filteredBusinesses = useMemo(
    () => businessRows.filter((b) => (b.name || '').toLowerCase().includes(searchTerm.toLowerCase())),
    [businessRows, searchTerm],
  );

  const filteredAiSessions = useMemo(() => {
    const filtered = userAiSessions.filter((session) => {
      const q = chatSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (session.businessName && session.businessName.toLowerCase().includes(q)) ||
        (session.businessId && session.businessId.toLowerCase().includes(q)) ||
        (session.userEmail && session.userEmail.toLowerCase().includes(q)) ||
        (session.userName && session.userName.toLowerCase().includes(q)) ||
        (session.lastPrompt && session.lastPrompt.toLowerCase().includes(q)) ||
        (session.title && session.title.toLowerCase().includes(q));

      const matchesPlan =
        chatPlanFilter === 'all' ||
        (session.plan && session.plan.toLowerCase() === chatPlanFilter.toLowerCase());

      return matchesSearch && matchesPlan;
    });

    const grouped = new Map<string, any>();
    for (const session of filtered) {
      const bMatch = businessRows.find(b => b.id === session.businessId);
      const storeName = bMatch?.name || session.businessName || 'Unnamed Store';
      
      if (!grouped.has(session.businessId)) {
        grouped.set(session.businessId, {
          ...session,
          businessName: storeName,
          allSessions: [session],
          totalTurnsCount: session.turnsCount || (session.messages?.length ? Math.ceil(session.messages.length / 2) : 1),
          totalTokens: (session.tokensIn || 0) + (session.tokensOut || 0),
          bMatchTokens: bMatch?.windowTokens || 0,
        });
      } else {
        const existing = grouped.get(session.businessId);
        existing.allSessions.push(session);
        existing.totalTurnsCount += session.turnsCount || (session.messages?.length ? Math.ceil(session.messages.length / 2) : 1);
        existing.totalTokens += (session.tokensIn || 0) + (session.tokensOut || 0);
      }
    }
    return Array.from(grouped.values());
  }, [userAiSessions, chatSearchQuery, chatPlanFilter]);

  const activeToday = businessRows.filter((b) => b.todayUsage > 0).length;
  const rangeLabel = RANGES.find((r) => r.days === rangeDays)?.label ?? `${rangeDays} days`;
  const usagePercent = Math.min((globalCount / GLOBAL_LIMIT) * 100, 100);
  const isDanger = usagePercent > 90;
  const errorRate = totals.turns > 0 ? (totals.errors / totals.turns) * 100 : 0;
  const refusalRate =
    totals.turns + totals.blocked > 0 ? (totals.blocked / (totals.turns + totals.blocked)) * 100 : 0;
  const hasHistory = totals.daysWithData > 0;

  // Rates for the previous window, on the same definitions — comparing a rate
  // against a count would make the delta meaningless.
  const priorErrorRate = prior.turns > 0 ? (prior.errors / prior.turns) * 100 : 0;
  const priorRefusalRate =
    prior.turns + prior.blocked > 0 ? (prior.blocked / (prior.turns + prior.blocked)) * 100 : 0;
  const proposalShare = totals.turns > 0 ? (totals.proposals / totals.turns) * 100 : 0;
  const tokensPerTurn = totals.turns > 0 ? Math.round(totals.tokens / totals.turns) : 0;
  const capHeadroom = Math.max(GLOBAL_LIMIT - globalCount, 0);
  const outputShare = totals.tokens > 0 ? (totals.tokensOut / totals.tokens) * 100 : 0;
  /** Whole windows, so "prev 14 days" is literal rather than approximate. */
  const priorWindowLabel = rangeLabel;

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-3 min-h-[60vh]">
        <Zap className="w-8 h-8 animate-pulse text-orange-300" />
        <p className="text-sm text-slate-400">Loading AI analytics…</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-[1800px] mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Zap className="w-8 h-8 text-orange-500" />
            AI Usage Tracker
          </h1>
          <p className="text-slate-500 mt-1">
            What people ask Zen AI, which tools answer it, and what it costs to run.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRangeDays(r.days)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  rangeDays === r.days ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/*
        History only exists from the day the rollup recorder shipped. Saying so
        beats drawing a flat line across dates that were never recorded — that
        reads as "nobody used it", which is a different and wrong conclusion.
      */}
      {!hasHistory && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">No day-level history yet for this range.</p>
            <p className="text-amber-800/80 mt-0.5">
              Trends, intents and keywords are recorded per day from the moment the rollup shipped;
              earlier days have no document rather than a zero. The tool charts below fall back to
              lifetime per-business counts so they stay useful in the meantime.
            </p>
          </div>
        </div>
      )}

      {/* ── Row 1: today, live ──
          Every card opens to the same four things: what it counts, how it moved
          against the previous window of equal length, where the figure comes
          from, and whatever detail is specific to it. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Global Usage (Today)"
          value={globalCount.toLocaleString()}
          unit={`/ ${GLOBAL_LIMIT.toLocaleString()}`}
          icon={isDanger ? AlertTriangle : TrendingUp}
          accent={isDanger ? 'red' : 'orange'}
          alert={isDanger}
          emphasis
          summary={
            <>
              <div className="w-full bg-slate-100 h-2 rounded-full mb-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isDanger ? 'bg-red-500' : 'bg-orange-500'}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              {Math.round(usagePercent)}% of the daily platform cap ·{' '}
              {capHeadroom.toLocaleString()} turns left today.
            </>
          }
          explain={
            <>
              <p>
                One counter shared by every tenant on the platform, reset at UTC midnight. It is a
                spend brake, not a per-business limit — a single busy shop can exhaust it for
                everyone, and when it is gone every turn is refused with{' '}
                <code className="text-[10px] bg-slate-100 px-1 rounded">global_limit</code> before
                the model is called.
              </p>
              <p>
                Rising steadily is growth. Rising in one hour is a shape problem — check{' '}
                <span className="font-medium">Demand by Hour</span> below before raising the cap,
                because a cap raised against a single spike buys headroom you pay for all day.
              </p>
            </>
          }
        >
          <DetailRow label="Used today" value={globalCount.toLocaleString()} />
          <DetailRow label="Remaining today" value={capHeadroom.toLocaleString()} />
          <DetailRow
            label="Ceiling cost if fully spent"
            value={formatUsd(estimateCostUsd(
              tokensPerTurn > 0 ? capHeadroom * tokensPerTurn * (1 - outputShare / 100) : 0,
              tokensPerTurn > 0 ? capHeadroom * tokensPerTurn * (outputShare / 100) : 0,
            ))}
            hint="Remaining turns at this window's average token use"
          />
          <ReferenceNote
            lines={[
              `Cap: ${GLOBAL_LIMIT.toLocaleString()} turns/day, set as GLOBAL_LIMIT in this page and enforced in src/app/api/chat/route.ts.`,
              'Counter: platform_stats/ai_usage_global — a single document, not a per-tenant sum.',
              'Resets at 00:00 UTC, matching the day-document boundary used everywhere on this page.',
            ]}
          />
        </MetricCard>

        <MetricCard
          label="Businesses Using AI This Month"
          value={activeToday.toLocaleString()}
          unit={`/ ${businessRows.length} active`}
          icon={Users}
          accent="emerald"
          emphasis
          delta={{
            current: totals.distinctBusinesses,
            previous: prior.businesses,
            higherIsBetter: true,
            windowLabel: priorWindowLabel,
          }}
          spark={{ data: spark.businesses }}
          summary={
            totals.distinctBusinesses > 0
              ? `${totals.distinctBusinesses} distinct businesses over ${rangeLabel}.`
              : 'Businesses that sent at least one prompt today.'
          }
          explain={
            <>
              <p>
                The figure is today; the sparkline and the comparison are distinct businesses per
                day across {rangeLabel}. Distinct, not summed — the same shop on five days counts
                once, so this cannot be inflated by one heavy user.
              </p>
              <p>
                Read it against Turns. Both climbing is adoption. Turns climbing while this stays
                flat means your existing users are leaning harder on Zen AI, which moves the quota
                and the bill without moving revenue.
              </p>
            </>
          }
        >
          <DetailRow label="Active today" value={activeToday.toLocaleString()} />
          <DetailRow
            label={`Distinct over ${rangeLabel}`}
            value={totals.distinctBusinesses.toLocaleString()}
          />
          <DetailRow
            label="Previous window"
            value={prior.businesses.toLocaleString()}
            hint="Same number of days, immediately before"
          />
          <DetailRow
            label="Turns per business"
            value={
              totals.distinctBusinesses > 0
                ? (totals.turns / totals.distinctBusinesses).toFixed(1)
                : '—'
            }
            hint="Window turns ÷ distinct businesses"
          />
          <ReferenceNote
            lines={[
              'Counted from the `businesses` map on each day document — keyed by businessId, which is the only field that gives distinct actives per day.',
              '"Active" in the denominator means businessInstances with status == "active" that have any AI history, not all tenants.',
            ]}
          />
        </MetricCard>

        <MetricCard
          label={`Turns — ${rangeLabel}`}
          value={totals.turns.toLocaleString()}
          unit={`~${totals.avgPerDay.toLocaleString()}/day`}
          icon={MessageSquare}
          accent="blue"
          emphasis
          delta={{
            current: totals.turns,
            previous: prior.turns,
            higherIsBetter: true,
            windowLabel: priorWindowLabel,
          }}
          spark={{ data: spark.turns }}
          summary={
            totals.peakDay && totals.peakDay.turns > 0
              ? `Busiest day ${totals.peakDay.label} with ${totals.peakDay.turns.toLocaleString()}.`
              : 'No prompts recorded in this range yet.'
          }
          explain={
            <>
              <p>
                A turn is one prompt that reached the model. Refusals are not in here — they never
                got that far — so Turns is the number that costs money, while Turns + refusals is
                the number that reflects demand.
              </p>
              <p>
                One turn can call several tools, which is why total tool calls below exceeds this
                figure. The per-day average divides by days that have a rollup document, not by
                calendar days, so a range extending before the recorder shipped is not dragged down
                by days that were never recorded.
              </p>
            </>
          }
        >
          <DetailRow label={`Turns over ${rangeLabel}`} value={totals.turns.toLocaleString()} />
          <DetailRow
            label="Previous window"
            value={prior.turns.toLocaleString()}
            hint="Same number of days, immediately before"
          />
          <DetailRow
            label="Days with data"
            value={`${totals.daysWithData} / ${rangeDays}`}
            hint="Days that have a rollup document at all"
          />
          <DetailRow
            label="Refused on top"
            value={totals.blocked.toLocaleString()}
            hint="Demand that never reached the model"
          />
          <DetailRow label="Tool calls made" value={toolRoster.totalWindowCalls.toLocaleString()} />
          <ReferenceNote
            lines={[
              `Source: the \`count\` field on each of the ${rangeDays} day documents under ${AI_DAILY_COLLECTION}.`,
              'A missing day is drawn as a hollow tick on the sparkline, never as a zero — history exists only from the day the rollup recorder shipped.',
            ]}
          />
        </MetricCard>

        <MetricCard
          label="Tools Zen AI Can Call"
          value={String(ZEN_TOOL_COUNT)}
          unit="capabilities"
          icon={Wrench}
          accent="violet"
          emphasis
          summary={
            <span className="flex flex-wrap gap-1.5 items-center">
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[10px]">
                {ZEN_READ_TOOL_NAMES.length} read
              </Badge>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px]">
                {ZEN_WRITE_TOOL_NAMES.length} propose
              </Badge>
              <span className="text-slate-500">
                {toolRoster.used.length} ever used · {Math.round(toolRoster.coverage)}% coverage
              </span>
            </span>
          }
          explain={
            <>
              <p>
                The total is what Zen AI <em>can</em> do; coverage is what anyone has actually
                reached for. Low coverage against high turn volume is the signal worth acting on —
                people are using Zen AI hard through a narrow slice of it, which is a discoverability
                problem rather than a missing feature.
              </p>
              <p>
                The {ZEN_WRITE_TOOL_NAMES.length} propose tools never write on their own. Each
                returns a card the owner has to approve; the write then happens client-side, where
                RBAC, the active branch and offline queueing are enforced.
              </p>
            </>
          }
        >
          <DetailRow label="Used in this window" value={`${toolRoster.usedInWindow} / ${ZEN_TOOL_COUNT}`} />
          <DetailRow
            label="Ever used (lifetime)"
            value={`${toolRoster.used.length} / ${ZEN_TOOL_COUNT}`}
            hint="Includes calls from before the day rollups existed"
          />
          <DetailRow label="Never used" value={toolRoster.unused.length.toLocaleString()} />

          {toolRoster.topInWindow.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                Most called — {rangeLabel}
              </p>
              <div className="space-y-1">
                {toolRoster.topInWindow.slice(0, 8).map((t) => {
                  const max = toolRoster.topInWindow[0].windowCalls || 1;
                  return (
                    <div key={t.name} className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-600 w-[46%] truncate" title={t.name}>
                        {t.label}
                      </span>
                      <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(t.windowCalls / max) * 100}%`,
                            backgroundColor:
                              TOOL_GROUPS.find((g) => g.id === t.group)?.color ?? '#94a3b8',
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-700 tabular-nums w-8 text-right">
                        {t.windowCalls}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {toolRoster.unused.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                Never called by anyone
              </p>
              <div className="flex flex-wrap gap-1">
                {toolRoster.unused.map((t) => (
                  <Badge
                    key={t.name}
                    variant="outline"
                    className="text-[10px] font-normal text-slate-500"
                    title={t.name}
                  >
                    {t.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <ReferenceNote
            lines={[
              'Roster: TOOL_LINES in src/components/ai-insights/zen-status.tsx, which is the same list the chat status line renders from.',
              `Definitions: the ${ZEN_TOOL_COUNT} tools themselves live in src/app/api/chat/tools.ts.`,
              'Windowed counts come from the day documents; lifetime counts from each tenant\'s aiToolUsageCounts, which predates the rollups and cannot be filtered by date.',
            ]}
          />
        </MetricCard>
      </div>

      {/* ── Row 2: health of the service over the window ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard
          label="Avg response time"
          value={totals.avgLatency > 0 ? `${(totals.avgLatency / 1000).toFixed(1)}s` : '—'}
          icon={Timer}
          accent={totals.avgLatency > 12000 ? 'red' : 'slate'}
          alert={totals.avgLatency > 12000}
          delta={{
            current: totals.avgLatency,
            previous: prior.avgLatency,
            higherIsBetter: false,
            windowLabel: priorWindowLabel,
            format: (v) => (v > 0 ? `${(v / 1000).toFixed(1)}s` : '—'),
          }}
          spark={{
            data: spark.latency,
            format: (v) => (v > 0 ? `${(v / 1000).toFixed(1)}s` : 'no turns'),
          }}
          summary="Whole turn, tools included — what the owner actually waits."
          explain={
            <>
              <p>
                Measured from the request arriving to the stream closing, so it includes every
                Firestore round trip a tool makes. It is wall-clock waiting, not model time.
              </p>
              <p>
                Rising here while Tokens stays flat almost always means tools are doing more
                database work per turn, not that answers got longer. Averaged at read time from a
                stored sum — two averages cannot be added to get the average of the whole.
              </p>
            </>
          }
        >
          <DetailRow
            label="This window"
            value={totals.avgLatency > 0 ? `${(totals.avgLatency / 1000).toFixed(2)}s` : '—'}
          />
          <DetailRow
            label="Previous window"
            value={prior.avgLatency > 0 ? `${(prior.avgLatency / 1000).toFixed(2)}s` : '—'}
          />
          <DetailRow
            label="Slowest day"
            value={(() => {
              const worst = series.filter((p) => p.avgLatency > 0)
                .reduce<DayPoint | null>((b, p) => (!b || p.avgLatency > b.avgLatency ? p : b), null);
              return worst ? `${(worst.avgLatency / 1000).toFixed(1)}s on ${worst.label}` : '—';
            })()}
          />
          <DetailRow label="Alert threshold" value="12.0s" hint="Above this the card turns red" />
          <ReferenceNote
            lines={[
              'Source: latencyMsTotal ÷ count, per day document. The rollup stores the sum precisely so it can be re-averaged across any range.',
              'Includes tool execution and Firestore reads, not just model generation.',
            ]}
          />
        </MetricCard>

        <MetricCard
          label="Refusal rate"
          value={`${refusalRate.toFixed(1)}%`}
          icon={ShieldAlert}
          accent={refusalRate > 10 ? 'amber' : 'slate'}
          delta={{
            current: refusalRate,
            previous: priorRefusalRate,
            higherIsBetter: false,
            windowLabel: priorWindowLabel,
            format: (v) => `${v.toFixed(1)}%`,
          }}
          spark={{ data: spark.blocked, format: (v) => `${v} blocked` }}
          summary={`${totals.blocked.toLocaleString()} turns blocked before the model.`}
          explain={
            <>
              <p>
                Refused turns never reached Gemini, so they cost nothing and appear nowhere in Turns
                or Tokens. The denominator here is turns + refusals — the demand that arrived, not
                the demand that was served.
              </p>
              <p>
                The reason matters more than the rate. Plan limits climbing is a pricing signal.
                The injection scan firing repeatedly is a security one, and belongs in Cyber Shield
                for the same window, not here.
              </p>
            </>
          }
        >
          <DetailRow label="Refused this window" value={totals.blocked.toLocaleString()} />
          <DetailRow label="Refused previously" value={prior.blocked.toLocaleString()} />
          <DetailRow
            label="Demand that arrived"
            value={(totals.turns + totals.blocked).toLocaleString()}
            hint="Turns + refusals — the rate's denominator"
          />
          {blockedChart.length > 0 && (
            <div className="mt-2 space-y-1">
              {blockedChart.map((row) => (
                <DetailRow key={row.key} label={row.name} value={row.value.toLocaleString()} />
              ))}
            </div>
          )}
          <ReferenceNote
            lines={[
              'Source: the `blocked` map on each day document, keyed by reason (plan_limit, global_limit, injection, bad_history).',
              'Refusals happen in src/app/api/chat/route.ts before streamText is called.',
            ]}
          />
        </MetricCard>

        <MetricCard
          label="Error rate"
          value={`${errorRate.toFixed(1)}%`}
          icon={Activity}
          accent={errorRate > 2 ? 'red' : 'slate'}
          alert={errorRate > 2}
          delta={{
            current: errorRate,
            previous: priorErrorRate,
            higherIsBetter: false,
            windowLabel: priorWindowLabel,
            format: (v) => `${v.toFixed(1)}%`,
          }}
          spark={{ data: spark.errors, format: (v) => `${v} errors` }}
          summary={`${totals.errors.toLocaleString()} failed mid-stream.`}
          explain={
            <>
              <p>
                These reached the model and then threw — the owner saw a half-written answer stop.
                Unlike a refusal, the tokens up to that point were still spent, so errors cost money
                and produce nothing.
              </p>
              <p>
                A tool throwing is the usual cause. Anything above about 2% is worth tracing to a
                specific tool rather than watching; the rate alone cannot tell you which.
              </p>
            </>
          }
        >
          <DetailRow label="Errors this window" value={totals.errors.toLocaleString()} />
          <DetailRow label="Errors previously" value={prior.errors.toLocaleString()} />
          <DetailRow
            label="Worst day"
            value={(() => {
              const worst = series.reduce<DayPoint | null>(
                (b, p) => (!b || p.errors > b.errors ? p : b), null);
              return worst && worst.errors > 0 ? `${worst.errors} on ${worst.label}` : 'none';
            })()}
          />
          <ReferenceNote
            lines={[
              'Source: the `errors` counter on each day document, incremented when a turn throws after streaming began.',
              'Denominator is turns that reached the model — refusals are excluded, since they never got the chance to fail.',
            ]}
          />
        </MetricCard>

        <MetricCard
          label="Proposal turns"
          value={totals.proposals.toLocaleString()}
          icon={ShieldCheck}
          accent="orange"
          delta={{
            current: totals.proposals,
            previous: prior.proposals,
            higherIsBetter: true,
            windowLabel: priorWindowLabel,
          }}
          spark={{ data: spark.proposals, format: (v) => `${v} proposals` }}
          summary={
            totals.turns > 0
              ? `${proposalShare.toFixed(0)}% of turns asked for a change.`
              : 'Writes awaiting approval.'
          }
          explain={
            <>
              <p>
                Turns where Zen AI drew at least one approval card — a sale to record, stock to
                adjust, a price to change. Nothing was written by the server: the card is a
                proposal, and the write only happens if the owner approves it.
              </p>
              <p>
                This is the clearest read on whether people trust Zen AI to <em>do</em> things
                rather than just answer. A flat zero against healthy turn volume means it is being
                used as a reporting tool, which is a much cheaper product than the one you built.
              </p>
            </>
          }
        >
          <DetailRow label="Proposal turns" value={totals.proposals.toLocaleString()} />
          <DetailRow label="Previous window" value={prior.proposals.toLocaleString()} />
          <DetailRow
            label="Share of all turns"
            value={totals.turns > 0 ? `${proposalShare.toFixed(1)}%` : '—'}
          />
          <DetailRow
            label="Propose tools available"
            value={ZEN_WRITE_TOOL_NAMES.length.toLocaleString()}
          />
          <ReferenceNote
            lines={[
              'Source: proposalTurns on each day document — counted once per turn, however many cards it drew.',
              'Approval happens client-side; the write goes through addToQueue, which is what enforces RBAC, injects the active branch, and survives offline.',
              'This counts proposals made, not proposals accepted — acceptance is not recorded platform-wide.',
            ]}
          />
        </MetricCard>

        <MetricCard
          label="Tokens used"
          value={formatTokens(totals.tokens)}
          icon={Coins}
          accent="emerald"
          delta={{
            current: totals.tokens,
            previous: prior.tokens,
            higherIsBetter: false,
            windowLabel: priorWindowLabel,
            format: formatTokens,
          }}
          spark={{ data: spark.tokens, format: formatTokens }}
          summary={
            <>
              Input + output over {rangeLabel} · ceiling{' '}
              <span className="font-semibold text-slate-700">{formatUsd(cost.window)}</span>
            </>
          }
          explain={
            <>
              <p>
                What {ZEN_MODEL.label} read and wrote. Input is the system prompt, the chat history
                and every tool result fed back for the model to read; output is only the words it
                produced. Output is charged at{' '}
                {(ZEN_MODEL.outputPerMillion / ZEN_MODEL.inputPerMillion).toFixed(1)}× the input
                rate, which is why the split below matters more than the total.
              </p>
              <p>
                <span className="font-semibold text-slate-700">Every money figure here is a
                ceiling, not an invoice.</span> Context caching bills a repeated prompt prefix at a
                large discount and Zen AI resends a long system prompt every turn, so real spend
                lands below this — and the free-tier allowance is not modelled at all.
              </p>
            </>
          }
        >
          <DetailRow
            label="Input tokens"
            value={formatTokens(totals.tokensIn)}
            hint={`System prompt, history, tool results · $${ZEN_MODEL.inputPerMillion}/M`}
          />
          <DetailRow
            label="Output tokens"
            value={formatTokens(totals.tokensOut)}
            hint={`What the model wrote · $${ZEN_MODEL.outputPerMillion}/M`}
          />
          <DetailRow
            label="Output share"
            value={totals.tokens > 0 ? `${outputShare.toFixed(1)}%` : '—'}
            hint="The expensive half of the bill"
          />
          <DetailRow label="Per turn" value={tokensPerTurn > 0 ? formatTokens(tokensPerTurn) : '—'} />
          <DetailRow
            label="Ceiling cost — window"
            value={formatUsd(cost.window)}
            hint={`Previous window ${formatUsd(cost.prior)}`}
          />
          <DetailRow
            label="Ceiling cost — per turn"
            value={cost.perTurn > 0 ? formatUsd(cost.perTurn) : '—'}
          />
          <DetailRow
            label="Context window"
            value={`${formatTokens(ZEN_MODEL.contextWindow)} tokens`}
            hint={
              tokensPerTurn > 0
                ? `An average turn uses ${((tokensPerTurn / ZEN_MODEL.contextWindow) * 100).toFixed(3)}% of it`
                : undefined
            }
          />
          <ReferenceNote
            lines={[
              `Model: ${ZEN_MODEL.label} (${ZEN_MODEL.id}), ${ZEN_MODEL.vendor} — the model src/app/api/chat/route.ts passes to streamText.`,
              `List rates: $${ZEN_MODEL.inputPerMillion} per 1M input tokens, $${ZEN_MODEL.outputPerMillion} per 1M output tokens.`,
              'Token counts come from the SDK usage report on each finished turn, summed into tokensIn / tokensOut per day.',
              'Costs shown are ceilings: caching discounts and free-tier allowance are not modelled, so the real invoice is lower.',
            ]}
            href={ZEN_MODEL.pricingUrl}
            hrefLabel="Google pricing"
            checkedOn={ZEN_MODEL.ratesCheckedOn}
          />
        </MetricCard>
      </div>
      {/* ── Demand over time ── */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            Prompt Volume — {rangeLabel}
          </CardTitle>
          <CardDescription>
            Turns against the number of distinct businesses producing them. Volume climbing while
            businesses stays flat means your existing users are leaning on Zen AI harder, which is a
            different problem from growth — it moves the quota, not the revenue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {/* One y-axis. Turns, blocked turns and distinct businesses are all
                  counts of the same kind of thing, so they share a scale
                  honestly — a second axis scaled to fit would make "businesses
                  crossing turns" look like an event when it is a drawing choice. */}
              <ComposedChart data={series}>
                <defs>
                  <linearGradient id="aiTurnsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eb6834" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#eb6834" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" {...AXIS} />
                <YAxis {...AXIS} allowDecimals={false} />
                <ReTooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone" dataKey="turns" name="Turns"
                  stroke="#eb6834" strokeWidth={2} fill="url(#aiTurnsFill)"
                />
                <Line
                  type="monotone" dataKey="businesses" name="Distinct businesses"
                  stroke="#2a78d6" strokeWidth={2} strokeDasharray="4 3" dot={false}
                />
                <Line
                  type="monotone" dataKey="blocked" name="Blocked"
                  stroke="#4a3aa7" strokeWidth={1.5} dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── What people are asking ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="border-slate-200 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              What People Are Asking — {rangeLabel}
            </CardTitle>
            <CardDescription>
              Every prompt is bucketed into one intent as it arrives. The prompt itself is never
              stored, so this is the closest thing to reading over their shoulder — and the shape of
              it tells you which part of Zeneva people actually reach for Zen AI to do.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {intentChart.length === 0 ? (
              <p className="text-sm text-slate-400 py-12 text-center">No prompts recorded in this range yet.</p>
            ) : (
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={intentChart} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" {...AXIS} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={150} {...AXIS} />
                    <ReTooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(v: any, _n: any, p: any) => [`${v} prompts (${p.payload.share}%)`, p.payload.hint]}
                    />
                    <Bar dataKey="value" name="Prompts" radius={[0, 4, 4, 0]}>
                      {intentChart.map((row) => (
                        <Cell key={row.id} fill={row.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="w-4 h-4 text-violet-500" />
              Words They Use
            </CardTitle>
            <CardDescription>
              Matches against a fixed retail vocabulary — anything outside it, including customer
              names, cannot be recorded. Sized by how often each term appears.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {keywordChart.length === 0 ? (
              <p className="text-sm text-slate-400 py-12 text-center">Nothing recorded yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2 items-center content-start min-h-[300px]">
                {keywordChart.map((k, i) => {
                  const max = keywordChart[0].value || 1;
                  const weight = k.value / max;
                  return (
                    <span
                      key={k.name}
                      title={`${k.value} mentions`}
                      className="rounded-full px-2.5 py-1 font-medium border transition-colors"
                      style={{
                        fontSize: `${11 + Math.round(weight * 9)}px`,
                        color: weight > 0.5 ? '#c2410c' : '#475569',
                        backgroundColor: weight > 0.5 ? '#fff7ed' : '#f8fafc',
                        borderColor: weight > 0.5 ? '#fed7aa' : '#e2e8f0',
                        opacity: 0.55 + weight * 0.45,
                      }}
                    >
                      {k.name}
                      <span className="ml-1.5 text-[10px] opacity-60">{k.value}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Most used tools ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="border-slate-200 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="w-4 h-4 text-blue-500" />
              Most Used Tools
              {totals.turns === 0 && <Badge variant="secondary" className="text-[10px]">lifetime</Badge>}
            </CardTitle>
            <CardDescription>
              {totals.turns > 0
                ? `Tool calls over ${rangeLabel}, coloured by the area of the business they touch. One turn can call several.`
                : 'No windowed data yet, so this is lifetime calls summed across every tenant.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {toolChart.length === 0 ? (
              <p className="text-sm text-slate-400 py-12 text-center">No tool calls recorded yet.</p>
            ) : (
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={toolChart} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" {...AXIS} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={165} {...AXIS} />
                    <ReTooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(v: any, _n: any, p: any) => [`${v} calls`, p.payload.tool]}
                    />
                    <Bar dataKey="calls" name="Calls" radius={[0, 4, 4, 0]}>
                      {toolChart.map((row) => (
                        <Cell key={row.tool} fill={row.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Where the Work Lands</CardTitle>
              <CardDescription>Tool calls grouped by area of the business.</CardDescription>
            </CardHeader>
            <CardContent>
              {groupChart.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">Nothing recorded yet.</p>
              ) : (
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={groupChart} dataKey="value" nameKey="name"
                        innerRadius={45} outerRadius={80} paddingAngle={2}
                      >
                        {groupChart.map((row) => (
                          <Cell key={row.name} fill={row.fill} />
                        ))}
                      </Pie>
                      <ReTooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => [`${v} calls`, 'Calls']} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Never Used</CardTitle>
              <CardDescription>
                Tools no tenant has called. Either nobody needs them, or nobody can tell they exist —
                worth checking against the use-cases page before building more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const used = new Set([...Object.keys(toolTotals), ...Object.keys(lifetimeToolTotals)]);
                const unused = [...ZEN_READ_TOOL_NAMES, ...ZEN_WRITE_TOOL_NAMES].filter((n) => !used.has(n));
                if (unused.length === 0) {
                  return (
                    <p className="text-sm text-emerald-600 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Every tool has been called at least once.
                    </p>
                  );
                }
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {unused.map((n) => (
                      <Badge key={n} variant="outline" className="text-[10px] font-normal text-slate-500">
                        {labelForTool(n)}
                      </Badge>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Load shape and refusals ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="w-4 h-4 text-cyan-600" />
              Demand by Hour (UTC)
            </CardTitle>
            <CardDescription>
              When the daily cap is actually under pressure. A sharp single-hour peak is a case for
              rate shaping rather than a bigger cap — the cap is only exhausted because it all
              arrives at once.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" {...AXIS} interval={2} />
                  <YAxis {...AXIS} allowDecimals={false} />
                  <ReTooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => [`${v} turns`, 'Turns']} />
                  <Bar dataKey="value" name="Turns" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Why Turns Were Refused
            </CardTitle>
            <CardDescription>
              Blocked before the model, so these never appear in the volume chart.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {blockedChart.length === 0 ? (
              <p className="text-sm text-emerald-600 flex items-center gap-2 py-6">
                <CheckCircle2 className="w-4 h-4" /> Nothing refused in this range.
              </p>
            ) : (
              <div className="space-y-3">
                {blockedChart.map((row) => {
                  const max = blockedChart[0].value || 1;
                  return (
                    <div key={row.key}>
                      <div className="flex justify-between items-baseline text-xs mb-1">
                        <span className="font-medium text-slate-700">{row.name}</span>
                        <span className="text-slate-500 font-semibold">{row.value.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(row.value / max) * 100}%`, backgroundColor: row.fill }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-slate-400 pt-2 leading-snug">
                  Plan limits climbing is a pricing signal. The injection scan firing repeatedly is a
                  security one — check Cyber Shield for the same window.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Unanswered Queries ── */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-orange-600" />
              Unanswered Queries
            </CardTitle>
            <CardDescription>
              Questions Zen AI could not answer. Use this to identify missing tools or context.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unansweredQueries.length === 0 ? (
              <p className="text-sm text-slate-400 py-6">No unanswered queries recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200 uppercase">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Business ID</th>
                      <th className="px-4 py-3 font-medium">Question</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unansweredQueries.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                          {q.createdAt?.toDate?.()?.toLocaleString() || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{q.businessId}</td>
                        <td className="px-4 py-3 text-slate-900">{q.question}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Plan mix and cost ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Turns by Plan</CardTitle>
            <CardDescription>
              The plan in force at the moment of the turn, so a lapsed subscription counts where it
              actually landed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {planChart.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">Nothing recorded yet.</p>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={planChart} dataKey="value" nameKey="name" outerRadius={80}>
                      {planChart.map((row) => (
                        <Cell key={row.name} fill={row.fill} />
                      ))}
                    </Pie>
                    <ReTooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => [`${v} turns`, 'Turns']} />
                    <Legend wrapperStyle={{ fontSize: 11, textTransform: 'capitalize' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="w-4 h-4 text-emerald-600" />
              Token Spend — {rangeLabel}
            </CardTitle>
            <CardDescription>
              Split by direction, because they are not priced the same: output costs{' '}
              {(ZEN_MODEL.outputPerMillion / ZEN_MODEL.inputPerMillion).toFixed(1)}× input on{' '}
              {ZEN_MODEL.label}. A day that is mostly input is a day of long context and short
              answers — cheap. Ceiling for this window: {formatUsd(cost.window)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Two separate charts rather than one with a second y-axis. Tokens
                and seconds share no scale, so plotting them together makes the
                crossings look meaningful when they are an artefact of whatever
                the two axes were scaled to. */}
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis {...AXIS} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
                  <ReTooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(v: any, n: any) => [Number(v).toLocaleString(), n]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {/* stroke in the surface colour gives the 2px gap between
                      stacked segments, so the boundary is a gap not a seam */}
                  <Bar
                    dataKey="tokensIn" name="Input" stackId="tok"
                    fill="#2a78d6" stroke="#ffffff" strokeWidth={2}
                  />
                  <Bar
                    dataKey="tokensOut" name="Output" stackId="tok"
                    fill="#eb6834" stroke="#ffffff" strokeWidth={2} radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="h-[150px] w-full mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-1">
                Avg response time — same days, its own scale
              </p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis {...AXIS} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}s`} />
                  <ReTooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(v: any) => [`${(Number(v) / 1000).toFixed(1)}s`, 'Avg response']}
                  />
                  <Line
                    type="monotone" dataKey="avgLatency" name="Avg response"
                    stroke="#7c3aed" strokeWidth={2} dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── User AI Conversations & Inquiries (Zen AI Inspector) ── */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-4 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                  <Bot className="w-4 h-4" />
                </div>
                <CardTitle className="text-xl">User AI Conversations & Inquiries</CardTitle>
                <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                  {filteredAiSessions.length} {filteredAiSessions.length === 1 ? 'session' : 'sessions'}
                </Badge>
              </div>
              <CardDescription className="mt-1">
                Real-time visibility into what merchants are asking Zen AI, which stores are chatting, and complete conversation transcripts.
              </CardDescription>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search prompts, stores, users..."
                  className="pl-9 bg-white text-sm"
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                />
              </div>
              <select
                value={chatPlanFilter}
                onChange={(e) => setChatPlanFilter(e.target.value)}
                className="h-10 px-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Plans</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="scale">Scale</option>
                <option value="free">Free</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredAiSessions.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <MessageCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">No AI conversations found</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                {chatSearchQuery || chatPlanFilter !== 'all'
                  ? 'No conversations match the current search or plan filter.'
                  : 'As merchants ask questions or interact with Zen AI in their POS and inventory, their questions and full chat transcripts will appear here in real time.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5 font-medium">Store / Business</th>
                    <th className="px-6 py-3.5 font-medium">Merchant User</th>
                    <th className="px-6 py-3.5 font-medium">Plan</th>
                    <th className="px-6 py-3.5 font-medium min-w-[280px]">Latest Question / Inquiry</th>
                    <th className="px-6 py-3.5 font-medium text-center">Turns</th>
                    <th className="px-6 py-3.5 font-medium text-center">Tokens & Cost</th>
                    <th className="px-6 py-3.5 font-medium text-center">Last Active</th>
                    <th className="px-6 py-3.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAiSessions.map((session) => {
                    const totalTokens = session.totalTokens || session.bMatchTokens || 0;
                    const costEstimate = estimateCostUsd(totalTokens, 0); // Using simple total for display
                    return (
                      <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 leading-tight">
                            {session.businessName || 'Unnamed Store'}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {session.businessId || 'No ID'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800 text-xs">
                            {session.userName || 'Shop Operator'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {session.userEmail || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="capitalize text-xs font-normal">
                            {session.plan || 'starter'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 max-w-md">
                            <p className="text-xs font-medium text-slate-800 line-clamp-2">
                              "{session.lastPrompt || session.title || 'Conversation started'}"
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-xs">
                            {session.totalTurnsCount} turns
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-xs font-medium text-slate-700">
                            {formatTokens(totalTokens)} tok
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {formatUsd(costEstimate)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap text-xs text-slate-500">
                          {formatSessionTime(session.updatedAt || session.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs text-slate-700 hover:text-orange-600 hover:border-orange-200"
                            onClick={() => {
                              setSelectedSessionForModal(session);
                              setIsTranscriptModalOpen(true);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Inspect Chat
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Per-tenant table ── */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Top AI Users</CardTitle>
              <CardDescription>
                Sorted by this month's credit spend, then by lifetime tool calls. "Favourite tool"
                is what each business reaches for most — the fastest read on what they actually
                bought Zeneva for. "Cost ceiling" is that tenant's own tokens over {rangeLabel} at
                list price, so it is the most this one business could have cost — the figure any
                credit price has to clear. Credits are weighted by tokens, so a tenant's credit
                spend and its call count no longer move together.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search businesses..."
                className="pl-9 bg-slate-50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-medium">Business Name</th>
                  <th className="px-6 py-4 font-medium">Plan</th>
                  <th className="px-6 py-4 font-medium text-center">Credits (month)</th>
                  <th className="px-6 py-4 font-medium text-center">{rangeLabel}</th>
                  <th className="px-6 py-4 font-medium text-center">Cost ceiling</th>
                  <th className="px-6 py-4 font-medium">Favourite Tool</th>
                  <th className="px-6 py-4 font-medium text-center">Lifetime Calls</th>
                  <th className="px-6 py-4 font-medium text-center">Credit Balance</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredBusinesses.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{b.name}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="capitalize text-slate-600">{b.plan || 'starter'}</Badge>
                    </td>
                    <td className="px-6 py-4 text-center font-medium">
                      {b.todayUsage > 0 ? b.todayUsage : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {b.windowTurns > 0 ? b.windowTurns.toLocaleString() : <span className="text-slate-300">—</span>}
                    </td>
                    {/* Ceiling, not an invoice — see the header note in
                        `src/lib/ai-cost.ts`. An em-dash where turns exist means
                        the day documents predate per-tenant token attribution,
                        which is not the same as a tenant that cost nothing. */}
                    <td className="px-6 py-4 text-center">
                      {b.costMeasured ? (
                        <span className="font-medium text-slate-700">
                          {formatUsd(b.windowCost)}
                          <span className="block text-[11px] font-normal text-slate-400">
                            {formatTokens(b.windowTokens)} tok
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {b.favouriteTool ? (
                        <span className="text-xs text-slate-600">
                          {b.favouriteTool}
                          <span className="text-slate-400 ml-1.5">×{b.favouriteCount}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-slate-500">
                      {b.lifetimeCalls > 0 ? b.lifetimeCalls.toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {b.aiBonusCredits ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                          {b.aiBonusCredits} available
                        </Badge>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Dialog open={isDialogOpen && selectedBusiness?.id === b.id} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (open) setSelectedBusiness(b);
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <PlusCircle className="w-3.5 h-3.5" />
                            Grant Credits
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Grant Zen AI credits</DialogTitle>
                            <DialogDescription>
                              Credits for {b.name}. They never expire, and they are spent only after
                              the monthly plan allowance runs out — the same balance a purchased pack
                              tops up. This grant is recorded in the credit ledger below with your
                              name against it.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4 space-y-4">
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-2 block">Credits to grant</label>
                              <Input
                                type="number"
                                min={1}
                                max={50000}
                                value={grantAmount}
                                onChange={(e) => setGrantAmount(Number(e.target.value))}
                                className="text-lg"
                              />
                              <p className="text-xs text-slate-500 mt-1.5">
                                Current balance: {(Number(b.aiBonusCredits) || 0).toLocaleString()} credits.
                              </p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-2 block">
                                Reason <span className="font-normal text-slate-400">(optional, but it is the only record)</span>
                              </label>
                              <Textarea
                                value={grantNote}
                                onChange={(e) => setGrantNote(e.target.value)}
                                placeholder="Goodwill after the sync outage / paid by transfer, ref 4821 / beta tester"
                                className="min-h-[64px] text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleGrantCredits} disabled={isGranting} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                              {isGranting ? <Zap className="w-4 h-4 animate-bounce" /> : <CheckCircle2 className="w-4 h-4" />}
                              Grant credits
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))}
                {filteredBusinesses.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                      No AI usage data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Credit ledger ── */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-slate-400" />
            Credit ledger
          </CardTitle>
          <CardDescription>
            Every movement <em>into</em> a credit balance, newest first — the three writers are a
            Paystack purchase, a Dodo purchase and a grant from the table above. Spending is not
            here: it is metered per day in the charts, and mixing the two would stop this column
            summing to "credits ever given to this shop". A purchase row carries what was paid,
            which is what makes "they say they paid and have no credits" answerable.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {ledger.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No credit movements recorded yet.
              <span className="block text-xs text-slate-400 mt-1">
                Rows appear from the first purchase or grant made after this ledger shipped —
                balances granted before it have no row, and that is missing history rather than a
                balance of zero.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-medium">When</th>
                    <th className="px-6 py-4 font-medium">Business</th>
                    <th className="px-6 py-4 font-medium">Source</th>
                    <th className="px-6 py-4 font-medium text-center">Credits</th>
                    <th className="px-6 py-4 font-medium text-center">Paid</th>
                    <th className="px-6 py-4 font-medium text-center">Balance after</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {ledger.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500">{ledgerTime(row.timestamp)}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {row.businessName || <span className="font-mono text-xs text-slate-400">{row.businessId}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          {row.kind === 'grant'
                            ? <Gift className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                            : <CreditCard className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                          <span className="text-slate-600">{describeLedgerEntry(row)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge
                          variant="secondary"
                          className={row.kind === 'grant'
                            ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}
                        >
                          +{(Number(row.credits) || 0).toLocaleString()}
                        </Badge>
                      </td>
                      {/*
                        * A grant is deliberately blank rather than "₦0" — nobody
                        * paid nothing for it, no money changed hands at all, and a
                        * zero in a money column reads as a free purchase.
                        */}
                      <td className="px-6 py-4 text-center">
                        {typeof row.amount === 'number' && row.amount > 0 ? (
                          <span className="font-medium text-slate-700">
                            {(row.currency || 'NGN').toUpperCase() === 'USD'
                              ? `$${row.amount.toLocaleString()}`
                              : `₦${row.amount.toLocaleString()}`}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500">
                        {typeof row.balanceAfter === 'number'
                          ? row.balanceAfter.toLocaleString()
                          : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Conversation Transcript Modal ── */}
      <Dialog open={isTranscriptModalOpen} onOpenChange={setIsTranscriptModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-lg">
                    {selectedSessionForModal?.businessName || 'Store'} Chat Transcript
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    User: {selectedSessionForModal?.userName || 'Operator'} ({selectedSessionForModal?.userEmail || 'No email'}) • Plan: <span className="capitalize font-medium text-slate-700">{selectedSessionForModal?.plan || 'starter'}</span>
                  </DialogDescription>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-3 pt-2 border-t border-slate-100">
              <div>Store ID: <span className="font-mono text-slate-700">{selectedSessionForModal?.businessId}</span></div>
              <div>Updated: <span className="font-medium text-slate-700">{formatSessionTime(selectedSessionForModal?.updatedAt || selectedSessionForModal?.createdAt)}</span></div>
              <div>Tokens: <span className="font-medium text-slate-700">{formatTokens((selectedSessionForModal?.tokensIn || 0) + (selectedSessionForModal?.tokensOut || 0))}</span></div>
              <div>Est. Cost: <span className="font-medium text-slate-700">{formatUsd(estimateCostUsd(selectedSessionForModal?.tokensIn || 0, selectedSessionForModal?.tokensOut || 0))}</span></div>
            </div>
          </DialogHeader>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
            {(!selectedSessionForModal?.allSessions || selectedSessionForModal.allSessions.length === 0) ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No recorded messages in this session.
              </div>
            ) : (
              selectedSessionForModal.allSessions.slice().reverse().flatMap((sess: any, sIdx: number) => {
                const msgs = sess.messages || [];
                return [
                  <div key={`sep-${sIdx}`} className="flex items-center gap-4 my-6">
                    <div className="h-px bg-slate-200 flex-1" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {formatSessionTime(sess.updatedAt || sess.createdAt)}
                    </span>
                    <div className="h-px bg-slate-200 flex-1" />
                  </div>,
                  ...msgs.map((msg: any, mIdx: number) => {
                    const isUser = msg.role === 'user';
                    const isAssistant = msg.role === 'assistant';
                    const isTool = msg.role === 'tool';
                    return (
                      <div
                        key={`msg-${sIdx}-${mIdx}`}
                        className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                            isUser
                              ? 'bg-slate-900 text-white'
                              : isTool
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-orange-100 text-orange-600'
                          }`}
                        >
                          {isUser ? <User className="w-3.5 h-3.5" /> : isTool ? <Wrench className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>

                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                            isUser
                              ? 'bg-slate-900 text-white rounded-tr-none'
                              : isTool
                              ? 'bg-amber-50/80 text-amber-950 border border-amber-200 text-xs font-mono rounded-tl-none'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                          }`}
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-70">
                            {isUser ? (sess.userName || 'Merchant') : isTool ? 'Tool Result' : 'Zen AI'}
                          </div>
                          <div className="whitespace-pre-wrap break-words [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4">
                            <Markdown className={isUser ? "text-white [&_strong]:text-white [&_a]:text-blue-200" : ""}>
                              {extractMessageText(msg, isUser && mIdx === 0 && sess.lastPrompt ? sess.lastPrompt : undefined)}
                            </Markdown>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ];
              })
            )}
          </div>

          <div className="border-t pt-3 flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => {
                if (!selectedSessionForModal?.allSessions) return;
                const transcriptText = selectedSessionForModal.allSessions.slice().reverse()
                  .flatMap((sess: any) => {
                    const messages = sess.messages || [];
                    const sessionPrefix = `--- Session: ${formatSessionTime(sess.updatedAt || sess.createdAt)} ---\n`;
                    const msgsText = messages.map((m: any) => `[${m.role?.toUpperCase()}]: ${extractMessageText(m)}`).join('\n\n');
                    return sessionPrefix + msgsText;
                  })
                  .join('\n\n\n');
                navigator.clipboard.writeText(transcriptText);
                setCopiedSessionId(selectedSessionForModal.id);
                setTimeout(() => setCopiedSessionId(null), 2000);
                toast({ title: 'Transcript copied to clipboard' });
              }}
            >
              {copiedSessionId === selectedSessionForModal?.id ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Transcript
                </>
              )}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => setIsTranscriptModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-[11px] text-slate-400 text-center leading-relaxed max-w-2xl mx-auto pb-4">
        Conversations and inquiries are captured in real-time to help administrators understand merchant pain points, improve Zen AI responses, and provide prompt support.
      </p>
    </div>
  );
}
