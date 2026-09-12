'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  Flame,
  Info,
  AlertTriangle,
  Eye,
  ReceiptText,
  Package,
  ScrollText,
  User,
  ChevronDown,
  TrendingDown,
  Scale,
  Clock,
  Banknote,
  Percent,
  Boxes,
  KeyRound,
  FileSearch,
  CircleHelp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type {
  Confidence,
  Evidence,
  Finding,
  FindingGroup,
  ForensicReport,
  Severity,
  StaffMetric,
  StaffRisk,
} from '@/lib/forensics';

/**
 * The loss-prevention report.
 *
 * Renders whatever `runForensicScan` produced and adds no judgement of its own —
 * every number, severity and sentence here was decided in `src/lib/forensics.ts`.
 * That separation is deliberate: the engine is the part that has to be
 * defensible when an owner confronts a member of staff with it.
 *
 * The design follows from what the report is *for*. An owner reading this is
 * about to have a difficult conversation with someone they employ, so:
 *
 * - Every finding carries **why it matters** and **the innocent explanation** in
 *   the same breath as the accusation. A report that only accuses gets someone
 *   fired over a returns desk rota.
 * - Confidence is on the surface of every card, not buried. "Signal" and
 *   "confirmed" lead to very different conversations.
 * - Coverage gaps are a first-class section rather than a footnote, because an
 *   absent check reads as a clean result otherwise.
 * - Evidence links out to the actual receipt, product or log row, so nothing has
 *   to be taken on trust.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<
  Severity,
  { label: string; chip: string; ring: string; bar: string; text: string; icon: React.ElementType }
> = {
  critical: {
    label: 'Critical',
    chip: 'bg-destructive/12 text-destructive border-destructive/30',
    ring: 'border-destructive/35',
    bar: 'bg-destructive',
    text: 'text-destructive',
    icon: Flame,
  },
  high: {
    label: 'High',
    chip: 'bg-orange-500/12 text-orange-600 dark:text-orange-400 border-orange-500/30',
    ring: 'border-orange-500/30',
    bar: 'bg-orange-500',
    text: 'text-orange-600 dark:text-orange-400',
    icon: ShieldAlert,
  },
  medium: {
    label: 'Medium',
    chip: 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30',
    ring: 'border-amber-500/25',
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    icon: AlertTriangle,
  },
  low: {
    label: 'Low',
    chip: 'bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/30',
    ring: 'border-sky-500/20',
    bar: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-400',
    icon: Info,
  },
};

const CONFIDENCE_COPY: Record<Confidence, { label: string; hint: string; className: string }> = {
  confirmed: {
    label: 'Confirmed',
    hint: 'The data says this happened. It is not an interpretation.',
    className: 'bg-foreground/8 text-foreground border-foreground/20',
  },
  strong: {
    label: 'Strong pattern',
    hint: 'Few innocent explanations. The likely one is named in the finding.',
    className: 'bg-primary/10 text-primary border-primary/25',
  },
  signal: {
    label: 'Worth a look',
    hint: 'Commonly harmless on its own. Matters most alongside another finding.',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

const GROUP_META: Record<FindingGroup, { label: string; icon: React.ElementType }> = {
  voids: { label: 'Cancelled sales', icon: TrendingDown },
  discounts: { label: 'Pricing', icon: Percent },
  cash: { label: 'Cash handling', icon: Banknote },
  stock: { label: 'Stock', icon: Boxes },
  timing: { label: 'Timing', icon: Clock },
  integrity: { label: 'Record integrity', icon: Scale },
  access: { label: 'Access & controls', icon: KeyRound },
};

const BAND_STYLE: Record<StaffRisk['band'], { label: string; chip: string; dot: string }> = {
  critical: { label: 'Act now', chip: 'bg-destructive/12 text-destructive border-destructive/30', dot: 'bg-destructive' },
  elevated: { label: 'Elevated', chip: 'bg-orange-500/12 text-orange-600 dark:text-orange-400 border-orange-500/30', dot: 'bg-orange-500' },
  watch: { label: 'Watch', chip: 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
  clear: { label: 'Clear', chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-500' },
};

const TONE_STROKE: Record<Severity | 'ok', string> = {
  ok: 'text-emerald-500',
  low: 'text-sky-500',
  medium: 'text-amber-500',
  high: 'text-orange-500',
  critical: 'text-destructive',
};

// ─────────────────────────────────────────────────────────────────────────────
// Small pieces
// ─────────────────────────────────────────────────────────────────────────────

function fmt(value: number, format: StaffMetric['format'], currency: string) {
  if (format === 'currency') return `${currency}${Math.round(value).toLocaleString()}`;
  if (format === 'percent') return `${Math.round(value * 10) / 10}%`;
  return Math.round(value).toLocaleString();
}

/**
 * The score, as an arc.
 *
 * A dial rather than a number alone because the figure has no natural units — 71
 * out of 100 means nothing until you can see how much of the ring is missing.
 */
function ScoreDial({ score, tone }: { score: number; tone: Severity | 'ok' }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  // Three-quarter ring, opening at the bottom, so the gap reads as a gauge.
  const sweep = 0.75;
  const filled = circumference * sweep * (Math.max(0, Math.min(100, score)) / 100);

  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 132 132" className="h-full w-full -rotate-[225deg]">
        <circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="stroke-muted"
          strokeDasharray={`${circumference * sweep} ${circumference}`}
        />
        <motion.circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className={cn('stroke-current', TONE_STROKE[tone])}
          strokeDasharray={`${filled} ${circumference}`}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${filled} ${circumference}` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[34px] font-bold leading-none tabular-nums">{score}</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          of 100
        </span>
      </div>
    </div>
  );
}

function SeverityChip({ severity }: { severity: Severity }) {
  const style = SEVERITY_STYLE[severity];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        style.chip,
      )}
    >
      <Icon className="h-3 w-3" />
      {style.label}
    </span>
  );
}

function ConfidenceChip({ confidence }: { confidence: Confidence }) {
  const copy = CONFIDENCE_COPY[confidence];
  return (
    <span
      title={copy.hint}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        copy.className,
      )}
    >
      <CircleHelp className="h-3 w-3 opacity-60" />
      {copy.label}
    </span>
  );
}

/**
 * One evidence item.
 *
 * Log rows open the existing detail dialog on the audit page; receipts and
 * products deep-link out. Nothing in this report should have to be believed
 * without being checkable in one click.
 */
function EvidenceChip({
  item,
  onOpenLog,
}: {
  item: Evidence;
  onOpenLog?: (logId: string) => void;
}) {
  const base =
    'inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors';

  if (item.kind === 'note') {
    return (
      <span className={base}>
        <Info className="h-3 w-3 shrink-0 opacity-60" />
        <span className="truncate">{item.label}</span>
      </span>
    );
  }

  if (item.kind === 'log') {
    return (
      <button type="button" onClick={() => onOpenLog?.(item.id)} className={cn(base, 'hover:border-primary/40 hover:text-foreground')}>
        <ScrollText className="h-3 w-3 shrink-0 opacity-60" />
        <span className="truncate">{item.label}</span>
      </button>
    );
  }

  if (item.kind === 'receipt') {
    return (
      <Link href={`/receipts?search=${encodeURIComponent(item.id)}`} className={cn(base, 'hover:border-primary/40 hover:text-foreground')}>
        <ReceiptText className="h-3 w-3 shrink-0 opacity-60" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  if (item.kind === 'product') {
    return (
      <Link href={`/inventory/details?id=${encodeURIComponent(item.id)}`} className={cn(base, 'hover:border-primary/40 hover:text-foreground')}>
        <Package className="h-3 w-3 shrink-0 opacity-60" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <span className={base}>
      <User className="h-3 w-3 shrink-0 opacity-60" />
      <span className="truncate">{item.label}</span>
    </span>
  );
}

/** A metric against the team median. The peer marker is the whole point. */
function MetricBar({ metric, currency }: { metric: StaffMetric; currency: string }) {
  // Scale to whichever is larger so both the value and the peer marker fit, with
  // headroom so a bar at the maximum does not read as "off the chart".
  const ceiling = Math.max(metric.value, metric.peer ?? 0, 1) * 1.25;
  const valuePct = Math.min(100, (metric.value / ceiling) * 100);
  const peerPct = metric.peer === null ? null : Math.min(100, (metric.peer / ceiling) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground" title={metric.hint}>
          {metric.label}
        </span>
        <span className={cn('text-[11px] font-semibold tabular-nums', metric.flagged && 'text-destructive')}>
          {fmt(metric.value, metric.format, currency)}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn('absolute inset-y-0 left-0 rounded-full', metric.flagged ? 'bg-destructive' : 'bg-primary/60')}
          initial={{ width: 0 }}
          animate={{ width: `${valuePct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        {peerPct !== null && (
          <div
            className="absolute inset-y-[-2px] w-[2px] rounded-full bg-foreground/45"
            style={{ left: `${peerPct}%` }}
            title={`Team median: ${fmt(metric.peer as number, metric.format, currency)}`}
          />
        )}
      </div>
      {peerPct === null && (
        <p className="text-[10px] text-muted-foreground/70">No peer group to compare against.</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────────

function Verdict({ report }: { report: ForensicReport }) {
  const tone = report.level.tone;
  const clean = report.findings.length === 0;
  const window = report.windowDays;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/40 p-5 sm:p-7">
      {/* A wash of the verdict colour, so the panel reads before the text does. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-[0.10] blur-3xl',
          tone === 'ok' ? 'bg-emerald-500' : tone === 'critical' ? 'bg-destructive' : tone === 'high' ? 'bg-orange-500' : tone === 'medium' ? 'bg-amber-500' : 'bg-sky-500',
        )}
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <ScoreDial score={report.score} tone={tone} />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {clean ? (
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            ) : (
              <ShieldAlert className={cn('h-5 w-5', TONE_STROKE[tone])} />
            )}
            <span className={cn('text-sm font-bold uppercase tracking-[0.16em]', TONE_STROKE[tone])}>
              {report.level.label}
            </span>
            <span className="text-[11px] text-muted-foreground">
              · {window} day{window === 1 ? '' : 's'} of history
            </span>
          </div>

          <p className="text-[15px] leading-relaxed text-foreground/90">{report.headline}</p>

          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
            {report.exposure > 0 && (
              <Stat
                label="Value involved"
                value={`${report.currency}${Math.round(report.exposure).toLocaleString()}`}
                emphasis
              />
            )}
            <Stat label="Findings" value={String(report.findings.length)} />
            <Stat label="Checks completed" value={`${report.checksRun} of ${report.checksTotal}`} />
            <Stat
              label="Examined"
              value={`${report.scanned.receipts.toLocaleString()} sales · ${report.scanned.auditLogs.toLocaleString()} log entries`}
            />
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border/50 pt-4 text-[11px] text-muted-foreground">
        <span>{report.scanned.staff} active staff account{report.scanned.staff === 1 ? '' : 's'}</span>
        <span>{report.scanned.voids} cancelled sale{report.scanned.voids === 1 ? '' : 's'}</span>
        <span>{report.scanned.stockAdjustments} stock adjustment{report.scanned.stockAdjustments === 1 ? '' : 's'}</span>
        <span>{report.scanned.priceEdits} price change{report.scanned.priceEdits === 1 ? '' : 's'}</span>
        {report.scanned.oldestRecord && (
          <span>
            oldest record {new Date(report.scanned.oldestRecord).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums', emphasis && 'text-destructive')}>{value}</p>
    </div>
  );
}

function Watchlist({ report }: { report: ForensicReport }) {
  const ranked = report.watchlist.filter((w) => w.band !== 'clear');
  const clear = report.watchlist.filter((w) => w.band === 'clear');

  if (report.watchlist.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4 text-primary" />
          Who to look at
        </CardTitle>
        <CardDescription>
          Each bar is one person against the median of their colleagues over the same window. The vertical
          mark is the median — a bar well past it is the outlier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ranked.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm text-muted-foreground">
            No member of staff stands out from the rest of the team on any measure.
          </div>
        ) : (
          ranked.map((person) => {
            const band = BAND_STYLE[person.band];
            return (
              <motion.div
                key={person.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/60 bg-card/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', band.dot)} />
                      <p className="truncate text-sm font-semibold">{person.name}</p>
                      {person.role && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {person.role.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {person.sales.toLocaleString()} sale{person.sales === 1 ? '' : 's'} ·{' '}
                      {report.currency}
                      {Math.round(person.revenue).toLocaleString()} taken
                      {person.exposure > 0 && (
                        <>
                          {' '}
                          ·{' '}
                          <span className="font-semibold text-destructive">
                            {report.currency}
                            {Math.round(person.exposure).toLocaleString()} involved
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0 text-[10px] font-bold uppercase tracking-wider', band.chip)}>
                    {band.label} · {person.risk}
                  </Badge>
                </div>

                {person.reasons.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {person.reasons.map((reason, i) => (
                      <li key={i} className="flex gap-2 text-[12px] text-foreground/80">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {person.metrics.map((metric) => (
                    <MetricBar key={metric.label} metric={metric} currency={report.currency} />
                  ))}
                </div>
              </motion.div>
            );
          })
        )}

        {clear.length > 0 && (
          <p className="pt-1 text-[11px] text-muted-foreground">
            Nothing stood out for {clear.map((c) => c.name).join(', ')}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FindingCard({
  finding,
  currency,
  onOpenLog,
  defaultOpen,
}: {
  finding: Finding;
  currency: string;
  onOpenLog?: (logId: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const style = SEVERITY_STYLE[finding.severity];
  const group = GROUP_META[finding.group];
  const GroupIcon = group.icon;

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card/60', style.ring)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/30"
      >
        <span className={cn('mt-0.5 h-8 w-1 shrink-0 rounded-full', style.bar)} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityChip severity={finding.severity} />
            <ConfidenceChip confidence={finding.confidence} />
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <GroupIcon className="h-3 w-3" />
              {group.label}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/60">{finding.code}</span>
          </div>
          <p className="text-sm font-semibold leading-snug">{finding.title}</p>
          {!open && <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{finding.what}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {finding.exposure > 0 && (
            <span className="text-[13px] font-bold tabular-nums text-destructive">
              {currency}
              {Math.round(finding.exposure).toLocaleString()}
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="border-t border-border/50"
        >
          <div className="space-y-4 p-4">
            <Block label="What the records show" body={finding.what} />
            <Block label="Why this matters" body={finding.why} />
            <Block label="What to do next" body={finding.action} accent />

            {finding.metric && (
              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {finding.metric.label}
                  </p>
                  <p className="text-sm font-bold tabular-nums">
                    {fmt(finding.metric.value, finding.metric.format, currency)}
                  </p>
                </div>
                {finding.metric.peer !== null && finding.metric.peer !== undefined && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Team median
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-muted-foreground">
                      {fmt(finding.metric.peer, finding.metric.format, currency)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {finding.suspects.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Accounts involved
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {finding.suspects.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[11px]"
                    >
                      <User className="h-3 w-3 opacity-60" />
                      {s.name}
                      {s.role && <span className="text-muted-foreground/70">· {s.role.replace('_', ' ')}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {finding.evidence.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Evidence
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {finding.evidence.map((item, i) => (
                    <EvidenceChip key={i} item={item} onOpenLog={onOpenLog} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Block({ label, body, accent }: { label: string; body: string; accent?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-[13px] leading-relaxed',
          accent ? 'rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 font-medium text-foreground' : 'text-foreground/85',
        )}
      >
        {body}
      </p>
    </div>
  );
}

function Shrinkage({ report }: { report: ForensicReport }) {
  if (report.shrinkage.length === 0) return null;
  const total = report.shrinkage.reduce((sum, r) => sum + r.valueRemoved, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingDown className="h-4 w-4 text-primary" />
          Where stock is going
        </CardTitle>
        <CardDescription>
          Stock removed by adjustment rather than by a sale, worst first. About {report.currency}
          {Math.round(total).toLocaleString()} across these lines — this is your shrinkage, itemised.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Units gone</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Times adjusted</TableHead>
                <TableHead>Adjusted by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.shrinkage.map((row) => (
                <TableRow key={row.productId}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/inventory/details?id=${encodeURIComponent(row.productId)}`}
                      className="hover:text-primary hover:underline"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(row.unitsRemoved).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {report.currency}
                    {Math.round(row.valueRemoved).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.adjustments}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{row.actors.join(', ') || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function Coverage({ report }: { report: ForensicReport }) {
  if (report.coverage.length === 0) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSearch className="h-4 w-4 text-muted-foreground" />
          What could not be checked
        </CardTitle>
        <CardDescription>
          {report.checksRun} of {report.checksTotal} checks ran. These are the blind spots — without them, a
          clean result above is narrower than it looks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {report.coverage.map((gap, i) => (
          <div key={`${gap.code}-${i}`} className="rounded-lg border border-border/50 bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground/70">{gap.code}</span>
              <p className="text-[13px] font-semibold">{gap.title}</p>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{gap.detail}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/75">
              <span className="font-semibold">To fix: </span>
              {gap.fix}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** What a clean scan actually means, spelled out. */
function CleanState({ report }: { report: ForensicReport }) {
  return (
    <Card className="border-emerald-500/25 bg-emerald-500/[0.04]">
      <CardContent className="p-6 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="mt-3 text-base font-semibold">No loss patterns found in this window</p>
        <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          {report.checksRun} checks ran across {report.scanned.receipts.toLocaleString()} sale
          {report.scanned.receipts === 1 ? '' : 's'} and {report.scanned.auditLogs.toLocaleString()} audit
          record{report.scanned.auditLogs === 1 ? '' : 's'} — cancelled sales, discounts, price changes,
          stock write-offs, trading hours, receipt arithmetic and account access. Nothing matched a known
          pattern.
        </p>
        <p className="mx-auto mt-3 max-w-xl text-[12px] leading-relaxed text-muted-foreground/80">
          This cannot see goods that never reached the till at all. For that you need a physical count — but
          if stock is walking, the write-off used to cover it would show up here.
        </p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

export function ForensicReportView({
  report,
  onOpenLog,
  onDismiss,
}: {
  report: ForensicReport;
  /** Opens the audit page's own log-detail dialog for an evidence row. */
  onOpenLog?: (logId: string) => void;
  onDismiss?: () => void;
}) {
  const [severityFilter, setSeverityFilter] = React.useState<Severity | 'all'>('all');

  const counts = React.useMemo(() => {
    const acc: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of report.findings) acc[f.severity]++;
    return acc;
  }, [report.findings]);

  const visible = React.useMemo(
    () => (severityFilter === 'all' ? report.findings : report.findings.filter((f) => f.severity === severityFilter)),
    [report.findings, severityFilter],
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
      aria-label="Loss prevention report"
    >
      <Verdict report={report} />

      {report.findings.length === 0 ? (
        <CleanState report={report} />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Findings
                </CardTitle>
                <CardDescription>
                  Most serious first. Open one for the evidence and the innocent explanation to rule out.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <FilterPill
                  active={severityFilter === 'all'}
                  onClick={() => setSeverityFilter('all')}
                  label="All"
                  count={report.findings.length}
                />
                {(['critical', 'high', 'medium', 'low'] as Severity[])
                  .filter((s) => counts[s] > 0)
                  .map((s) => (
                    <FilterPill
                      key={s}
                      active={severityFilter === s}
                      onClick={() => setSeverityFilter(s)}
                      label={SEVERITY_STYLE[s].label}
                      count={counts[s]}
                      className={SEVERITY_STYLE[s].text}
                    />
                  ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {visible.map((finding, i) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                currency={report.currency}
                onOpenLog={onOpenLog}
                // Open the worst one so the report says something without a click.
                defaultOpen={i === 0 && severityFilter === 'all'}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Watchlist report={report} />
      <Shrinkage report={report} />
      <Coverage report={report} />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-muted-foreground">
          Scanned {new Date(report.generatedAt).toLocaleString()}. Every figure here is arithmetic over your own
          records — no part of this report was written by a language model.
        </p>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss} className="text-muted-foreground">
            Close report
          </Button>
        )}
      </div>
    </motion.section>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
  className,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : cn('border-border bg-background hover:bg-muted', className),
      )}
    >
      {label}
      <span className={cn('tabular-nums', active ? 'opacity-80' : 'text-muted-foreground')}>{count}</span>
    </button>
  );
}
