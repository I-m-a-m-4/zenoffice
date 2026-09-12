'use client';

/**
 * Team performance — what each person rang up.
 *
 * ## This panel does not accuse anyone
 *
 * That boundary is deliberate and it is the reason this file is separate from the
 * loss-prevention work. `src/lib/forensics.ts` is the thing that names a member of
 * staff and says their numbers look like theft: it compares a person against the
 * median of their colleagues *with the subject excluded from that median*, every
 * conclusion is arithmetic rather than a model's opinion, and it runs only when the
 * owner explicitly asks for it from the audit log. See `docs/loss-prevention.md`.
 *
 * Nothing here scores, flags or ranks anyone as suspicious. A high discount rate on
 * this panel means "worth asking about", not "worth suspecting", and the link at the
 * bottom is how you get to the tool that is allowed to draw the harder conclusion.
 *
 * ## Unattributed sales are shown, not dropped
 *
 * `Receipt.createdBy` is optional — sales recorded before it existed carry no
 * author. Those land in a single "Unattributed" row. Hiding them would make the
 * per-person revenue quietly fail to add up to the shop's revenue, and an owner
 * who notices that stops trusting the page.
 */

import * as React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Info, ShieldCheck, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { aggregateStaff } from '@/lib/reports-aggregates';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';
import type { Receipt, UserProfile } from '@/types';

/** Bars past this stop being readable; the table below carries everyone. */
const CHART_ROWS = 10;

interface StaffPerformanceProps {
  receipts: Receipt[];
  users: UserProfile[];
  currencySymbol?: string;
}

export default function StaffPerformance({
  receipts,
  users,
  currencySymbol = '',
}: StaffPerformanceProps) {
  const { t } = useI18n();
  // Inside the component: the series label is translated and there is no `t` at module scope.
  const chartConfig = {
    revenue: { label: t('reports.colRevenue'), color: 'hsl(var(--primary))' },
  } satisfies ChartConfig;
  const stats = React.useMemo(() => aggregateStaff(receipts, users), [receipts, users]);

  const money = (n: number) =>
    `${currencySymbol}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const chartData = React.useMemo(
    () =>
      stats
        .filter(s => s.revenue > 0)
        .slice(0, CHART_ROWS)
        .map(s => ({ name: s.name, revenue: s.revenue })),
    [stats],
  );

  const totalRevenue = stats.reduce((sum, s) => sum + s.revenue, 0);
  const attributed = stats.filter(s => s.userId !== null);
  const unattributed = stats.find(s => s.userId === null);

  if (stats.length === 0) {
    return null;
  }

  // A single-person shop has nothing to compare, so the comparison framing is
  // dropped rather than dressed up as a team view.
  const solo = attributed.length <= 1 && !unattributed;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {solo ? t('reports.spTitleSolo') : t('reports.spTitleTeam')}
        </CardTitle>
        <CardDescription>
          {solo
            ? t('reports.spSubtitleSolo')
            : t(unattributed ? 'reports.spSubtitleTeamPlus' : 'reports.spSubtitleTeam', {
                count: attributed.length,
              })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartData.length > 1 && (
          <ChartContainer
            config={chartConfig}
            className="w-full"
            style={{ height: Math.max(140, chartData.length * 34 + 40) }}
          >
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 10, right: 16, top: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={96}
                interval={0}
                style={{ fontSize: '12px' }}
              />
              <XAxis type="number" hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={(value: any) => (
                      <span className="text-xs">
                        {t('reports.revenueColon')}{' '}
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {money(Number(value))}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="revenue" fill="var(--color-revenue, hsl(var(--primary)))" radius={4} />
            </BarChart>
          </ChartContainer>
        )}

        <ScrollArea className="max-h-[340px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>{t('reports.colMember')}</TableHead>
                <TableHead className="text-end">{t('reports.colSales')}</TableHead>
                <TableHead className="text-end">{t('reports.colRevenue')}</TableHead>
                <TableHead className="text-end">{t('reports.colShare')}</TableHead>
                <TableHead className="hidden text-end sm:table-cell">{t('reports.spAvgBasket')}</TableHead>
                <TableHead className="hidden text-end md:table-cell">{t('reports.spItemsPerSale')}</TableHead>
                <TableHead className="hidden text-end md:table-cell">{t('reports.spDiscounted')}</TableHead>
                <TableHead className="hidden text-end lg:table-cell">{t('reports.spPriceOverrides')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map(s => {
                const isUnattributed = s.userId === null;
                return (
                  <TableRow key={s.userId ?? '__unattributed__'} className={isUnattributed ? 'bg-muted/30' : undefined}>
                    <TableCell>
                      <p
                        className={cn(
                          'text-sm font-medium',
                          isUnattributed && 'italic text-muted-foreground',
                        )}
                      >
                        {s.name}
                      </p>
                      {isUnattributed ? (
                        <p className="text-[11px] text-muted-foreground">
                          {t('reports.spNoAuthor')}
                        </p>
                      ) : (
                        s.role && (
                          <p className="text-[11px] capitalize text-muted-foreground">
                            {s.role.replace(/_/g, ' ')}
                          </p>
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-end text-sm tabular-nums">
                      {s.sales.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-end text-sm font-medium tabular-nums">
                      {money(s.revenue)}
                    </TableCell>
                    <TableCell className="text-end text-xs text-muted-foreground tabular-nums">
                      {totalRevenue > 0 ? `${((s.revenue / totalRevenue) * 100).toFixed(1)}%` : '—'}
                    </TableCell>
                    <TableCell className="hidden text-end text-sm tabular-nums sm:table-cell">
                      {money(s.avgBasket)}
                    </TableCell>
                    <TableCell className="hidden text-end text-sm tabular-nums md:table-cell">
                      {s.itemsPerSale.toFixed(1)}
                    </TableCell>
                    <TableCell className="hidden text-end md:table-cell">
                      {s.discountedSales === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {Math.round(s.discountRate * 100)}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-end text-sm tabular-nums lg:table-cell">
                      {s.overriddenLines === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        s.overriddenLines.toLocaleString()
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex flex-col gap-2 rounded-md border border-dashed bg-muted/30 p-3 sm:flex-row sm:items-start">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('reports.spFootnote')}
            </p>
            <Link
              href="/audit-log"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('reports.spRunScan')}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
