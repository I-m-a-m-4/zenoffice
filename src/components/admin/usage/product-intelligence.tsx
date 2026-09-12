'use client';

/**
 * Product Intelligence — the section of the Usage Analytics tab that answers
 * "what should we change about the app", rather than "how many people used it".
 *
 * Costs nothing to render. Every figure is derived from the `users` documents the
 * dashboard has already loaded, and every counter behind those figures rides on a
 * heartbeat write that was already happening. See `src/lib/product-telemetry.ts`
 * for why it is built that way and `src/lib/product-insights.ts` for the analysis.
 *
 * Each insight that has a cohort links straight into the campaign console with
 * that cohort preselected, which is the point of the whole thing: the finding and
 * the people it is about are the same object.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Gauge,
  Info,
  Lightbulb,
  Mail,
  Timer,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { UserProfile } from '@/types';
import {
  aggregateTelemetry,
  deriveInsights,
  LOW_ADOPTION,
  SLOW_ROUTE_MS,
  type Insight,
  type InsightSeverity,
} from '@/lib/product-insights';
import { storeInsightCohort } from '@/lib/insight-cohort';

const SEVERITY: Record<
  InsightSeverity,
  { icon: React.ElementType; chip: string; icon_color: string; ring: string; label: string }
> = {
  critical: {
    icon: AlertTriangle,
    chip: 'border-destructive/30 bg-destructive/10 text-destructive',
    icon_color: 'text-destructive',
    ring: 'border-l-destructive',
    label: 'Act on this',
  },
  warn: {
    icon: Info,
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    icon_color: 'text-amber-600 dark:text-amber-400',
    ring: 'border-l-amber-500',
    label: 'Worth a look',
  },
  info: {
    icon: Lightbulb,
    chip: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
    icon_color: 'text-sky-600 dark:text-sky-400',
    ring: 'border-l-sky-500',
    label: 'Context',
  },
  good: {
    icon: CheckCircle2,
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    icon_color: 'text-emerald-600 dark:text-emerald-400',
    ring: 'border-l-emerald-500',
    label: 'Working',
  },
};

function InsightCard({ insight }: { insight: Insight }) {
  const meta = SEVERITY[insight.severity];
  const Icon = meta.icon;
  const cohortSize = insight.cohortIds?.length ?? 0;

  return (
    /*
     * `min-w-0` on the card and on the flex row below is what stops this
     * overflowing its grid column. Flex and grid children default to
     * `min-width: auto`, meaning they refuse to shrink below their content's
     * intrinsic width — and this card's content includes route paths and long
     * unbroken titles, so without it the card pushes past the column and the
     * whole page scrolls sideways.
     */
    <div className={cn('min-w-0 rounded-lg border border-l-4 bg-card p-4', meta.ring)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.icon_color)} />
          <p className="min-w-0 break-words text-sm font-semibold leading-snug">
            {insight.title}
          </p>
        </div>
        <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.chip)}>
          {meta.label}
        </Badge>
      </div>

      <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground">
        {insight.finding}
      </p>
      <p className="mt-2 break-words text-xs leading-relaxed">
        <span className="font-semibold">What to do: </span>
        {insight.recommendation}
      </p>

      {cohortSize > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="min-w-0 break-words text-[11px] text-muted-foreground">
            {cohortSize} {cohortSize === 1 ? 'account' : 'accounts'}
            {insight.cohortLabel ? ` · ${insight.cohortLabel}` : ''}
          </span>
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="ml-auto h-7 shrink-0 gap-1.5 text-[11px]"
            // Handed over through sessionStorage rather than the URL: a cohort can
            // run to hundreds of ids, which no browser will carry in a query string.
            onClick={() => storeInsightCohort(insight.id, insight.cohortIds ?? [], insight.cohortLabel)}
          >
            <Link href={`/admin-imamshaffy/outreach?cohort=${encodeURIComponent(insight.id)}`}>
              <Mail className="h-3 w-3" />
              Email these {cohortSize}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ProductIntelligence({ users }: { users: UserProfile[] }) {
  const telemetry = React.useMemo(() => aggregateTelemetry(users), [users]);
  const insights = React.useMemo(() => deriveInsights(telemetry), [telemetry]);

  const timedRoutes = React.useMemo(
    () =>
      telemetry.routes
        .filter(r => r.avgLoadMs !== null)
        .sort((a, b) => (b.avgLoadMs as number) - (a.avgLoadMs as number))
        .slice(0, 10),
    [telemetry.routes],
  );

  if (telemetry.empty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-primary" />
            Product Intelligence
          </CardTitle>
          <CardDescription className="text-xs">
            Nothing measured yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Feature counters, page dwell time and route timings start arriving once
            users are on a build that includes them — the first data lands on each
            user&apos;s next five-minute heartbeat. Nothing here is backfilled, so this
            panel stays empty until then rather than showing zeroes that look like
            findings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Gauge className="h-5 w-5 shrink-0 text-primary" />
          Product Intelligence
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          What the behaviour data says about the app itself — which features earn
          their keep, which pages are slow, and where people get stuck. Measured
          against {telemetry.engaged.length} engaged{' '}
          {telemetry.engaged.length === 1 ? 'account' : 'accounts'} and{' '}
          {telemetry.sellers.length} that actually sell.
        </p>
      </div>

      {/* ── The findings ── */}
      {insights.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No findings clear the reporting threshold yet. Every cohort still has
            fewer than five users, and a rate drawn from four people is noise rather
            than a signal.
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {insights.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* ── Feature adoption, including the zeroes ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Feature adoption
          </CardTitle>
          <CardDescription className="text-xs">
            Every tracked feature, measured against the users who had the chance to
            use it — POS features against merchants who actually sell, not against
            every signup. A feature nobody has touched still appears, as a zero.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Feature</TableHead>
                  <TableHead className="hidden lg:table-cell">The question it answers</TableHead>
                  <TableHead>Adoption</TableHead>
                  <TableHead className="text-right">Uses</TableHead>
                  <TableHead className="pr-4 text-right">Per adopter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {telemetry.adoption.map(a => {
                  const dead = a.users === 0;
                  const low = !dead && a.rate <= LOW_ADOPTION;
                  return (
                    <TableRow key={a.event.key}>
                      <TableCell className="pl-4">
                        <p className="text-sm font-medium break-words">{a.event.label}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {a.event.category}
                          {a.event.opportunity === 'sellers' ? ' · of sellers' : ' · of engaged'}
                        </p>
                      </TableCell>
                      <TableCell className="hidden max-w-[280px] lg:table-cell">
                        <p className="text-xs text-muted-foreground">{a.event.question}</p>
                      </TableCell>
                      <TableCell className="w-[170px]">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                dead ? 'bg-destructive' : low ? 'bg-amber-500' : 'bg-emerald-500',
                              )}
                              style={{ width: `${Math.round(a.rate * 100)}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold tabular-nums">
                            {Math.round(a.rate * 100)}%
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                          {a.users} of {a.opportunity}
                          {a.opportunity < 5 ? ' · too few to read' : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {dead ? (
                          <Badge variant="outline" className="gap-1 border-destructive/30 text-[10px] text-destructive">
                            <Ban className="h-2.5 w-2.5" />
                            never
                          </Badge>
                        ) : (
                          a.total.toLocaleString()
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right text-sm tabular-nums">
                        {a.perAdopter > 0 ? a.perAdopter.toFixed(1) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Page speed and dwell ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-4 w-4 text-primary" />
            Page speed and attention
          </CardTitle>
          <CardDescription className="text-xs">
            Time from navigation to the page being painted, and how long it then
            holds the screen. Client-side transitions only — the initial cold load is
            excluded on purpose, since mixing it in would make whichever page people
            land on look broken and every other page look fast.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {timedRoutes.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No route timings recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Page</TableHead>
                    <TableHead className="text-right">Opens in</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Time on page</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Views</TableHead>
                    <TableHead className="pr-4 text-right">Samples</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timedRoutes.map(route => {
                    const ms = route.avgLoadMs as number;
                    const isSlow = ms >= SLOW_ROUTE_MS;
                    return (
                      <TableRow key={route.routeKey}>
                        {/* Route paths are single unbreakable tokens, so they need an
                            explicit break rule and a width to break against — otherwise
                            /sales/pos/select-products widens the table on a phone. */}
                        <TableCell className="max-w-[180px] break-all pl-4 font-mono text-xs">
                          {route.path}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'text-sm font-semibold tabular-nums',
                              isSlow ? 'text-destructive' : 'text-emerald-600',
                            )}
                          >
                            {ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right text-sm tabular-nums">
                          {route.avgDwellSeconds > 0
                            ? `${Math.round(route.avgDwellSeconds)}s`
                            : '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right text-sm tabular-nums">
                          {route.views.toLocaleString()}
                        </TableCell>
                        <TableCell className="pr-4 text-right text-xs tabular-nums text-muted-foreground">
                          {route.loadSamples}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
