'use client';

/**
 * The expandable metric card behind every figure on the admin AI board.
 *
 * A bare stat tile answers "what is the number" and nothing else — you cannot
 * tell from `4.2s` whether that is good, whether it moved, or what it is even
 * measuring. So each card carries four layers, collapsed to the first two:
 *
 *   1. the figure, with its unit and a one-line summary;
 *   2. a comparison against the previous window of the same length, and a
 *      per-day sparkline where the metric has a daily shape;
 *   3. `explain` — what the number actually counts, in the platform owner's
 *      terms rather than the recorder's;
 *   4. `children` — whatever detail only that metric has (the token split, the
 *      tool roster, the refusal reasons).
 *
 * Layers 3 and 4 are behind a disclosure rather than always-on because nine
 * cards' worth of prose at once is a wall nobody reads, and the figure is what
 * you came for.
 *
 * Light-mode only, matching the rest of `admin-imamshaffy/ai-usage/page.tsx` —
 * that page hardcodes `text-slate-900` throughout, and dark variants on these
 * cards alone would read as a half-finished theme.
 */

import * as React from 'react';
import { ChevronDown, ArrowUp, ArrowDown, Minus, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { percentChange, deltaTone } from '@/lib/ai-cost';

export type Accent = 'orange' | 'emerald' | 'blue' | 'violet' | 'slate' | 'amber' | 'red' | 'cyan';

/**
 * Per-card accent. Each hex clears 3:1 against the white card surface, which is
 * the check that applies to a single-series sparkline; the adjacent-pair CVD
 * gates do not, because no two of these ever sit inside one chart — they sit on
 * separate cards, each with its own icon and label.
 */
const ACCENTS: Record<Accent, { chip: string; stroke: string }> = {
  orange: { chip: 'bg-orange-100 text-orange-600', stroke: '#ea580c' },
  emerald: { chip: 'bg-emerald-100 text-emerald-600', stroke: '#059669' },
  blue: { chip: 'bg-blue-100 text-blue-600', stroke: '#2563eb' },
  violet: { chip: 'bg-violet-100 text-violet-600', stroke: '#7c3aed' },
  slate: { chip: 'bg-slate-100 text-slate-700', stroke: '#475569' },
  amber: { chip: 'bg-amber-100 text-amber-700', stroke: '#b45309' },
  red: { chip: 'bg-red-100 text-red-600', stroke: '#dc2626' },
  cyan: { chip: 'bg-cyan-100 text-cyan-700', stroke: '#0e7490' },
};

export type SparkPoint = { label: string; value: number; present: boolean };

/**
 * Daily shape, as bars.
 *
 * Bars rather than a line so every day is its own hover target, and so a day
 * with **no rollup document** can be drawn as a hollow tick instead of a zero.
 * That distinction is the whole reason this page carries a history banner: a
 * flat line across unrecorded days reads as "nobody used it", which is a
 * different and wrong conclusion.
 */
export function Sparkbars({
  data,
  stroke,
  format = (v: number) => v.toLocaleString(),
}: {
  data: SparkPoint[];
  stroke: string;
  format?: (value: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const missing = data.filter((d) => !d.present).length;

  return (
    <div
      className="flex items-end gap-[2px] h-9 mt-3"
      role="img"
      aria-label={
        `Daily values across ${data.length} days, ` +
        `highest ${format(max)}` +
        (missing > 0 ? `, ${missing} days not recorded` : '')
      }
    >
      {data.map((d, i) => {
        if (!d.present) {
          return (
            <div
              key={`${d.label}-${i}`}
              title={`${d.label}: not recorded`}
              className="flex-1 min-w-[2px] h-[3px] rounded-full bg-slate-200"
            />
          );
        }
        const height = d.value === 0 ? 3 : Math.max(4, Math.round((d.value / max) * 36));
        return (
          <div
            key={`${d.label}-${i}`}
            title={`${d.label}: ${format(d.value)}`}
            className="flex-1 min-w-[2px] rounded-t-[2px] hover:opacity-70 transition-opacity"
            style={{
              height,
              backgroundColor: d.value === 0 ? '#cbd5e1' : stroke,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Change against the previous window of equal length.
 *
 * `percentChange` returns null against a zero baseline, and this renders that
 * case in words. "+900%" from 0 → 9 is arithmetic, not information: the honest
 * statement is that the activity is new.
 */
export function DeltaChip({
  current,
  previous,
  higherIsBetter,
  windowLabel,
  format = (v: number) => v.toLocaleString(),
}: {
  current: number;
  previous: number;
  higherIsBetter: boolean;
  windowLabel: string;
  format?: (value: number) => string;
}) {
  const change = percentChange(current, previous);
  const tone = deltaTone(change, higherIsBetter);

  const TONE: Record<string, { text: string; Icon: React.ElementType }> = {
    'up-good': { text: 'text-emerald-700', Icon: ArrowUp },
    'up-bad': { text: 'text-red-600', Icon: ArrowUp },
    'down-good': { text: 'text-emerald-700', Icon: ArrowDown },
    'down-bad': { text: 'text-red-600', Icon: ArrowDown },
    flat: { text: 'text-slate-500', Icon: Minus },
  };
  const { text, Icon } = TONE[tone];

  if (change === null) {
    return (
      <p className="text-[11px] text-slate-500 mt-2 leading-snug">
        {current > 0
          ? `New activity — nothing recorded in the previous ${windowLabel}.`
          : `Nothing in this or the previous ${windowLabel}.`}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-2">
      {/* Icon + words, never colour alone — the arrow and the "vs" phrase carry
          the direction for anyone who cannot separate the red from the green. */}
      <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold', text)}>
        <Icon className="w-3 h-3" />
        {tone === 'flat' ? 'flat' : `${change > 0 ? '+' : ''}${change.toFixed(0)}%`}
      </span>
      <span className="text-[11px] text-slate-400">
        vs previous {windowLabel} ({format(previous)})
      </span>
    </div>
  );
}
/** A labelled figure inside an expanded card — the token split, cost per turn. */
export function DetailRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-slate-600">{label}</p>
        {hint && <p className="text-[10px] text-slate-400 leading-snug mt-0.5">{hint}</p>}
      </div>
      {/* tabular-nums so a stack of these aligns on the decimal point */}
      <p className="text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">{value}</p>
    </div>
  );
}

/** The "where this figure comes from" block. Every claim on the card is traceable. */
export function ReferenceNote({
  lines,
  href,
  hrefLabel,
  checkedOn,
}: {
  lines: string[];
  href?: string;
  hrefLabel?: string;
  checkedOn?: string;
}) {
  return (
    <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
        Reference
      </p>
      <ul className="space-y-1">
        {lines.map((line) => (
          <li key={line} className="text-[11px] text-slate-600 leading-relaxed">
            {line}
          </li>
        ))}
      </ul>
      {(href || checkedOn) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
            >
              {hrefLabel ?? 'Source'} <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {checkedOn && (
            <span className="text-[10px] text-slate-400">Rates checked {checkedOn}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  summary,
  icon: Icon,
  accent = 'slate',
  emphasis = false,
  alert = false,
  delta,
  spark,
  explain,
  children,
}: {
  label: string;
  value: string;
  /** Sits beside the figure — "/ 1,500", "~4/day", "capabilities". */
  unit?: string;
  /** The one line that shows without expanding. */
  summary: React.ReactNode;
  icon: React.ElementType;
  accent?: Accent;
  /** Larger figure. Used by the four headline cards in the top row. */
  emphasis?: boolean;
  /** Red border — the card is reporting a genuine problem, not just a big number. */
  alert?: boolean;
  delta?: {
    current: number;
    previous: number;
    higherIsBetter: boolean;
    windowLabel: string;
    format?: (value: number) => string;
  };
  spark?: { data: SparkPoint[]; format?: (value: number) => string };
  /** What the number counts, and what to do when it moves. */
  explain: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const { chip, stroke } = ACCENTS[accent];
  const panelId = React.useId();

  return (
    <Card className={cn('border-slate-200 flex flex-col', alert && 'border-red-200 bg-red-50/50')}>
      <CardContent className={cn('flex flex-col flex-1', emphasis ? 'pt-6' : 'pt-5 pb-5')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 leading-snug">{label}</p>
            <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
              <h2
                className={cn(
                  'font-bold text-slate-900 tracking-tight',
                  emphasis ? 'text-3xl' : 'text-2xl',
                )}
              >
                {value}
              </h2>
              {unit && <span className="text-sm font-medium text-slate-500">{unit}</span>}
            </div>
          </div>
          <div className={cn('rounded-xl flex-shrink-0', chip, emphasis ? 'p-3' : 'p-2')}>
            <Icon className={emphasis ? 'w-5 h-5' : 'w-4 h-4'} />
          </div>
        </div>

        {delta && <DeltaChip {...delta} />}
        {spark && spark.data.length > 0 && (
          <Sparkbars data={spark.data} stroke={stroke} format={spark.format} />
        )}

        <div className="text-[11px] text-slate-500 mt-2 leading-snug flex-1">{summary}</div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="mt-3 -mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
          {open ? 'Hide detail' : 'What this means'}
        </button>

        {open && (
          <div id={panelId} className="mt-3 pt-3 border-t border-slate-100 animate-fade-in">
            <div className="text-[11px] text-slate-600 leading-relaxed space-y-2">{explain}</div>
            {children && <div className="mt-3">{children}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

