'use client';

/**
 * Shared chart pieces for the cap table.
 *
 * Colours come from the `--viz-*` tokens in `src/app/globals.css`, which are
 * re-stepped for dark mode rather than auto-flipped. The admin panel's older
 * charts hardcode hex values and read badly in dark mode; these do not.
 *
 * The categorical palette deliberately runs only three hues before falling back
 * to a neutral. A cap table with fifteen holders should not be fifteen
 * competing colours — the long tail groups into "Others", and the table below
 * the chart is where per-holder detail belongs.
 */

import * as React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';

/** Three categorical hues plus a neutral for the tail. */
export const VIZ_SERIES = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)'] as const;
export const VIZ_NEUTRAL = 'var(--viz-neutral)';
export const VIZ_GRID = 'var(--viz-grid)';
export const VIZ_AXIS = 'var(--viz-axis)';

/** Shared axis styling — flat, unobtrusive, matching OperationsAdoptionPanel. */
export const AXIS_PROPS = {
  tick: { fontSize: 11, fill: VIZ_AXIS },
  tickLine: false,
  axisLine: false,
} as const;

/**
 * A colour per slice, cycling the three hues and greying anything past them.
 *
 * Index 3 onward is neutral on purpose: past three slices the eye stops reading
 * hue as identity, and a rainbow implies distinctions that are not meaningful.
 */
export function sliceColor(index: number): string {
  return index < VIZ_SERIES.length ? VIZ_SERIES[index] : VIZ_NEUTRAL;
}

/** Tooltip surface that follows the theme instead of assuming a white card. */
export const TOOLTIP_STYLE: React.CSSProperties = {
  fontSize: 12,
  borderRadius: 10,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
};

export interface DonutDatum {
  name: string;
  value: number;
  /** Pre-formatted label shown in the tooltip, e.g. "58.31%". */
  label?: string;
}

/**
 * Ownership donut.
 *
 * Collapses everything past `maxSlices` into a single "Others" slice so the
 * chart stays readable when the cap table grows — the underlying table is
 * already the exhaustive view.
 */
export function OwnershipDonut({
  data,
  maxSlices = 6,
  height = 260,
  centerLabel,
  centerValue,
}: {
  data: DonutDatum[];
  maxSlices?: number;
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const sliced = React.useMemo(() => {
    const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    if (sorted.length <= maxSlices) return sorted;
    const head = sorted.slice(0, maxSlices - 1);
    const tail = sorted.slice(maxSlices - 1);
    const rest = tail.reduce((sum, d) => sum + d.value, 0);
    return [...head, { name: `${tail.length} others`, value: rest }];
  }, [data, maxSlices]);

  if (!sliced.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Nothing issued yet.
      </div>
    );
  }

  const total = sliced.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={sliced}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={1}
            strokeWidth={0}
          >
            {sliced.map((entry, i) => (
              <Cell key={entry.name} fill={sliceColor(i)} />
            ))}
          </Pie>
          <ReTooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [
              `${((value / total) * 100).toFixed(2)}%`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Centre readout. Absolutely positioned so it survives the chart resizing. */}
      {(centerLabel || centerValue) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <span className="text-2xl font-bold leading-none tabular-nums">{centerValue}</span>
          )}
          {centerLabel && (
            <span className="mt-1 text-[11px] text-muted-foreground">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Legend rows that pair with the donut, since the chart itself has no labels. */
export function DonutLegend({
  data,
  maxRows = 6,
  format,
}: {
  data: DonutDatum[];
  maxRows?: number;
  format: (value: number) => string;
}) {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, maxRows - 1);
  const tail = sorted.slice(maxRows - 1);
  const rows =
    tail.length > 0
      ? [...head, { name: `${tail.length} others`, value: tail.reduce((s, d) => s + d.value, 0) }]
      : head;

  return (
    <ul className="space-y-2">
      {rows.map((row, i) => (
        <li key={row.name} className="flex items-center gap-2 text-sm">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: sliceColor(i) }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.name}</span>
          <span className="shrink-0 font-medium tabular-nums">{format(row.value)}</span>
        </li>
      ))}
    </ul>
  );
}
