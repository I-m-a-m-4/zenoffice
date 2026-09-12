'use client';

/**
 * Notification engagement — does anyone actually use the bell?
 *
 * Costs nothing to render. Every figure comes from the `users` documents the Usage
 * tab has already loaded, and the counters behind them ride the heartbeat write
 * `UserActivityTracker` was already making. See `src/lib/product-telemetry.ts`.
 *
 * ## Why three counters and not one
 *
 * Opens alone cannot answer the question. An account that opens the bell every day
 * and one that opens it every day only to hit "mark all read" produce the same
 * open count and point at opposite decisions. So the set is: opened it, acted on
 * something in it, or wiped the badge without acting.
 *
 * ## Two honesty constraints, both load-bearing
 *
 * 1. **No sparkline, no trend.** `featureUsage` is a lifetime total, not a time
 *    series — that is the deliberate trade in product-telemetry.ts. Drawing a
 *    trend here would mean inventing a time dimension the data does not have.
 * 2. **Zero is only a finding once something has been observed.** These counters
 *    did not exist before the build that introduced them and nothing is
 *    backfilled, so on a platform mid-rollout an empty set means "not measured
 *    yet", not "nobody cares". The component renders the not-measured state until
 *    at least one account reports a bell counter, rather than a wall of zeroes
 *    that reads as a verdict.
 */

import * as React from 'react';
import { ArrowDown, ArrowUp, Bell, BellOff, MousePointerClick } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { BusinessInstance, UserProfile } from '@/types';

const OPENED = 'notif_bell_opened';
const TAPPED = 'notif_tapped';
const CLEARED = 'notif_bell_cleared';

type Row = {
  businessId: string;
  name: string;
  accounts: number;
  openers: number;
  opens: number;
  taps: number;
  clears: number;
  /** Accounts that wiped the badge at least once and never tapped anything. */
  clearOnly: number;
};

type SortField = 'opens' | 'taps' | 'perOpen' | 'name';

function count(u: UserProfile, key: string): number {
  const n = u.featureUsage?.[key];
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/**
 * Whether this account is on a build that reports telemetry at all.
 *
 * This is the denominator that makes the percentages mean something. Dividing by
 * every user on the platform would fold in accounts that *cannot* report these
 * fields, which understates engagement by however much of the estate is on an old
 * build — a measurement artifact dressed up as a product finding.
 */
function isReporting(u: UserProfile): boolean {
  return (
    Object.keys(u.featureUsage || {}).length > 0 ||
    Object.keys(u.pageDwell || {}).length > 0 ||
    Object.keys(u.pagePerf || {}).length > 0
  );
}

function pct(n: number, d: number): string {
  if (!d) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

export default function NotificationEngagement({
  users,
  businesses,
}: {
  users: UserProfile[];
  businesses: BusinessInstance[];
}) {
  const [sortField, setSortField] = React.useState<SortField>('opens');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  const data = React.useMemo(() => {
    const list = users || [];
    const nameById = new Map((businesses || []).map(b => [b.id, b.name]));

    const reporting = list.filter(isReporting);

    let opens = 0;
    let taps = 0;
    let clears = 0;
    let openers = 0;
    let tappers = 0;
    let clearOnly = 0;

    const byBusiness = new Map<string, Row>();

    for (const u of list) {
      const o = count(u, OPENED);
      const t = count(u, TAPPED);
      const c = count(u, CLEARED);

      opens += o;
      taps += t;
      clears += c;
      if (o > 0) openers += 1;
      if (t > 0) tappers += 1;
      if (c > 0 && t === 0) clearOnly += 1;

      // Only tenants with something to show enter the table — see the caption.
      if (o === 0 && t === 0 && c === 0) continue;

      const bid = u.businessId || 'unknown';
      const row =
        byBusiness.get(bid) ||
        ({
          businessId: bid,
          name: nameById.get(bid) || 'Unknown business',
          accounts: 0,
          openers: 0,
          opens: 0,
          taps: 0,
          clears: 0,
          clearOnly: 0,
        } as Row);

      row.accounts += 1;
      if (o > 0) row.openers += 1;
      row.opens += o;
      row.taps += t;
      row.clears += c;
      if (c > 0 && t === 0) row.clearOnly += 1;
      byBusiness.set(bid, row);
    }

    return {
      rows: [...byBusiness.values()],
      reporting: reporting.length,
      totalUsers: list.length,
      opens,
      taps,
      clears,
      openers,
      tappers,
      clearOnly,
      /** Nothing has been observed at all — distinct from "observed as zero". */
      empty: opens === 0 && taps === 0 && clears === 0,
    };
  }, [users, businesses]);

  const sorted = React.useMemo(() => {
    const perOpen = (r: Row) => (r.opens > 0 ? r.taps / r.opens : -1);
    const arr = [...data.rows];
    arr.sort((a, b) => {
      let d = 0;
      if (sortField === 'name') d = a.name.localeCompare(b.name);
      else if (sortField === 'opens') d = a.opens - b.opens;
      else if (sortField === 'taps') d = a.taps - b.taps;
      else d = perOpen(a) - perOpen(b);
      return sortDir === 'asc' ? d : -d;
    });
    return arr;
  }, [data.rows, sortField, sortDir]);

  const toggle = (f: SortField) => {
    if (f === sortField) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(f);
      setSortDir(f === 'name' ? 'asc' : 'desc');
    }
  };

  const SortHead = ({ field, children, align = 'end' }: { field: SortField; children: React.ReactNode; align?: 'start' | 'end' }) => (
    <TableHead className={align === 'end' ? 'text-end' : undefined}>
      <button
        type="button"
        onClick={() => toggle(field)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          sortField === field ? 'text-foreground font-semibold' : 'text-muted-foreground',
        )}
      >
        {children}
        {sortField === field &&
          (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );

  if (data.empty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Notification engagement
          </CardTitle>
          <CardDescription className="text-xs">Not measured yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Bell counters start arriving once users are on a build that includes
            them — the first data lands on each user&apos;s next five-minute
            heartbeat. Nothing is backfilled, so this panel stays empty until then
            rather than showing zeroes that would read as &ldquo;nobody opens the
            bell&rdquo;.
          </p>
        </CardContent>
      </Card>
    );
  }

  const tapsPerOpen = data.opens > 0 ? data.taps / data.opens : null;

  const tiles: { label: string; value: string; hint: string; icon: React.ElementType; tone?: string }[] = [
    {
      label: 'Bell opens',
      value: data.opens.toLocaleString(),
      hint: `${data.openers.toLocaleString()} of ${data.reporting.toLocaleString()} reporting accounts (${pct(data.openers, data.reporting)}) have ever opened it`,
      icon: Bell,
    },
    {
      label: 'Taps per open',
      value: tapsPerOpen === null ? '—' : `${tapsPerOpen.toFixed(2)}×`,
      hint:
        tapsPerOpen === null
          ? 'No opens recorded yet'
          : 'Above 1.00× means several notifications opened per visit — this is a ratio, not a percentage',
      icon: MousePointerClick,
    },
    {
      label: 'Accounts that ever tapped',
      value: `${data.tappers.toLocaleString()} · ${pct(data.tappers, data.reporting)}`,
      hint: 'Opened the bell and followed a notification somewhere',
      icon: MousePointerClick,
    },
    {
      label: 'Wiped without reading',
      value: data.clearOnly.toLocaleString(),
      hint: 'Marked all read at least once and never tapped anything — for these accounts the bell is noise',
      icon: BellOff,
      tone: 'text-destructive',
    },
  ];

  return (
    <div className="min-w-0 space-y-4">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Bell className="h-5 w-5 shrink-0 text-primary" />
          Notification engagement
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Whether the bell earns the interruption. Measured against{' '}
          {data.reporting.toLocaleString()}{' '}
          {data.reporting === 1 ? 'account' : 'accounts'} on a build that reports
          telemetry, out of {data.totalUsers.toLocaleString()} total.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(t => (
          <Card key={t.label} className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <t.icon className="h-3.5 w-3.5 shrink-0" />
                {t.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn('text-2xl font-bold tabular-nums', t.tone)}>{t.value}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Which businesses care</CardTitle>
          <CardDescription className="text-xs">
            {sorted.length} {sorted.length === 1 ? 'business has' : 'businesses have'}{' '}
            recorded at least one bell event. Tenants with none are left out — on a
            platform still rolling out, an absent row means &ldquo;no data from that
            build yet&rdquo;, which is not the same as indifference.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead field="name" align="start">Business</SortHead>
                <TableHead className="text-end">Accounts</TableHead>
                <SortHead field="opens">Opens</SortHead>
                <SortHead field="taps">Taps</SortHead>
                <SortHead field="perOpen">Taps / open</SortHead>
                <TableHead className="text-end">Wiped w/o reading</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(r => {
                const ratio = r.opens > 0 ? r.taps / r.opens : null;
                return (
                  <TableRow key={r.businessId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-end tabular-nums text-muted-foreground">
                      {r.openers}/{r.accounts}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{r.opens.toLocaleString()}</TableCell>
                    <TableCell className="text-end tabular-nums">{r.taps.toLocaleString()}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {ratio === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        `${ratio.toFixed(2)}×`
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      {r.clearOnly > 0 ? (
                        <Badge variant="outline" className="border-destructive/30 text-destructive">
                          {r.clearOnly}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
        Source: the <code>featureUsage</code> map on each user document
        (<code>{OPENED}</code>, <code>{TAPPED}</code>, <code>{CLEARED}</code>),
        written by <code>UserActivityTracker</code> on its existing heartbeat, so
        this section costs no extra reads or writes. These are{' '}
        <strong>lifetime totals, not a time series</strong> — there is deliberately
        no trend line here, because the underlying counters carry no dates. Counters
        only exist on builds from the version that introduced them and are never
        backfilled, so treat a small total as a rollout in progress rather than a
        verdict.
      </p>
    </div>
  );
}
