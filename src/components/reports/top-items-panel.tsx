'use client';

/**
 * Top selling items — one panel for both products and services.
 *
 * Replaces `top-products-chart.tsx` and `top-services-chart.tsx`, which were
 * near-copies of each other. Four things changed, and the first two are the
 * reason a rewrite was needed rather than a bigger `.slice()`:
 *
 * 1. **Aggregation is keyed by product id, not by the display label.** The old
 *    charts summed into `productSales[displayName]`, so two different products
 *    that happened to share a name were added together and reported as one
 *    bestseller, while a product renamed mid-period was split across two rows and
 *    could fall off its own chart. See `src/lib/reports-aggregates.ts`.
 * 2. **The whole list is reachable.** The old cap was a hardcoded `.slice(0, 5)`
 *    with no expand — "View all" opens the full ranked table, searchable and
 *    exportable.
 * 3. **Ranking is by units, revenue *or* profit.** Ranking by units alone puts 50
 *    units of a loss leader above 5 units of the best-margin line in the shop.
 * 4. **Service detection uses the shared `isService`.** These two charts held the
 *    narrowest of the four definitions in the codebase (`categoryType` only), so a
 *    shop using the legacy `category: 'services'` shape had its services counted
 *    as products here *and* an empty services chart.
 *
 * ## The local timeframe picker is gone, on purpose
 *
 * Both old charts carried their own `TimeframePicker`, independent of the page's
 * `DateRangePicker`. That produced a card captioned "Lifetime" sitting under a page
 * header that said "Last 7 Days" — and the card's own "all" only ever saw the
 * receipts the page had already fetched for its range, so the label was wrong in
 * both directions. One range control per page, at the top.
 */

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ArrowDown, ArrowUp, Bot, Download, Package, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { downloadCsv } from '@/lib/csv';
import { aggregateItems, rankItems, type ItemStat, type RankBy } from '@/lib/reports-aggregates';
import { trackFeature } from '@/lib/product-telemetry';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';
import type { Product, Receipt } from '@/types';

/** How many bars the chart shows. The rest are one click away. */
const CHART_ROWS = 8;

type SortKey = 'rank' | 'name' | 'units' | 'revenue' | 'profit' | 'margin' | 'share';

interface TopItemsPanelProps {
  receipts: Receipt[];
  products: Product[];
  kind: 'product' | 'service';
  currencySymbol?: string;
}

export default function TopItemsPanel({
  receipts,
  products,
  kind,
  currencySymbol = '',
}: TopItemsPanelProps) {
  const { t } = useI18n();
  // Inside the component: every label below is translated, and there is no `t` at
  // module scope. `labelLower` is a key of its own rather than `.toLowerCase()` on
  // `label` — see the note on `tiByUnitsLower` in en.ts.
  const chartConfig = {
    value: { label: t('reports.tiValue'), color: 'hsl(var(--primary))' },
  } satisfies ChartConfig;
  const MEASURES: { value: RankBy; label: string; labelLower: string; axis: string }[] = [
    {
      value: 'units',
      label: t('reports.tiByUnits'),
      labelLower: t('reports.tiByUnitsLower'),
      axis: t('reports.colUnits'),
    },
    {
      value: 'revenue',
      label: t('reports.tiByRevenue'),
      labelLower: t('reports.tiByRevenueLower'),
      axis: t('reports.colRevenue'),
    },
    {
      value: 'profit',
      label: t('reports.tiByProfit'),
      labelLower: t('reports.tiByProfitLower'),
      axis: t('reports.colProfit'),
    },
  ];
  const [measure, setMeasure] = React.useState<RankBy>('units');
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [sortKey, setSortKey] = React.useState<SortKey>('rank');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const isService = kind === 'service';
  // English on purpose, and the only use left is the CSV filename slug: an export keeps
  // an ASCII, stable name so a shop's files still sort together whatever the app language.
  const nounPlural = isService ? 'services' : 'products';

  const money = React.useCallback(
    (n: number) =>
      `${currencySymbol}${n.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`,
    [currencySymbol],
  );

  const { ranked, costGaps } = React.useMemo(() => {
    const { items } = aggregateItems(receipts, products, { kind });
    return {
      ranked: rankItems(items, measure),
      costGaps: items.filter(i => !i.costKnown).length,
    };
  }, [receipts, products, kind, measure]);

  const measureValue = React.useCallback(
    (s: ItemStat): number | null => {
      if (measure === 'units') return s.units;
      if (measure === 'revenue') return s.revenue;
      return s.profit;
    },
    [measure],
  );

  // Only rows the selected measure can actually plot. Under `profit`, an item with
  // no cost price has an unknown value, and a bar of zero would assert it makes
  // nothing — so it is left out of the chart and reported in the caption instead.
  const chartData = React.useMemo(
    () =>
      ranked
        .map(s => ({ name: s.name, value: measureValue(s), key: s.key }))
        .filter((d): d is { name: string; value: number; key: string } => d.value !== null && d.value > 0)
        .slice(0, CHART_ROWS),
    [ranked, measureValue],
  );

  const activeMeasure = MEASURES.find(m => m.value === measure)!;
  const soldCount = ranked.length;
  // Under `profit`, items with an unknown or negative profit are not plottable, so
  // the chart shows fewer bars than there are items. Saying "N sold" here while
  // ranking by profit would be counting a different thing from what is on screen.
  const lossMaking = ranked.filter(s => s.profit !== null && s.profit < 0).length;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        (s.sku || '').toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    );
  }, [ranked, search]);

  const sorted = React.useMemo(() => {
    if (sortKey === 'rank') {
      return sortDir === 'asc' ? filtered : [...filtered].reverse();
    }
    const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1; // unknown always sinks, whichever way we sort
      if (b === null) return -1;
      return (a - b) * dir;
    };
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'units':
          return (a.units - b.units) * dir;
        case 'revenue':
          return (a.revenue - b.revenue) * dir;
        case 'profit':
          return nullsLast(a.profit, b.profit, dir);
        case 'margin':
          return nullsLast(a.marginPct, b.marginPct, dir);
        case 'share':
          return (a.revenueShare - b.revenueShare) * dir;
        default:
          return 0;
      }
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'rank' ? 'asc' : 'desc');
    }
  };

  const handleExport = () => {
    const header = [
      'Rank',
      isService ? 'Service' : 'Product',
      'SKU',
      'Category',
      'Units sold',
      `Line revenue (${currencySymbol || 'currency'})`,
      `Cost (${currencySymbol || 'currency'})`,
      `Profit (${currencySymbol || 'currency'})`,
      'Margin %',
      'Share of revenue %',
      'Orders',
      'Last sold',
    ];
    const rows = sorted.map((s, i) => [
      i + 1,
      s.name,
      s.sku ?? '',
      s.category,
      s.units,
      Math.round(s.revenue),
      s.cost === null ? '' : Math.round(s.cost),
      s.profit === null ? '' : Math.round(s.profit),
      s.marginPct === null ? '' : s.marginPct.toFixed(1),
      (s.revenueShare * 100).toFixed(2),
      s.orders,
      s.lastSoldAt ? s.lastSoldAt.toISOString().slice(0, 10) : '',
    ]);
    downloadCsv(`zeneva-top-${nounPlural}-${new Date().toISOString().slice(0, 10)}.csv`, [
      header,
      ...rows,
    ]);
    trackFeature('reports_exported');
  };

  const SortHead = ({
    k,
    children,
    numeric = true,
  }: {
    k: SortKey;
    children: React.ReactNode;
    numeric?: boolean;
  }) => (
    <TableHead className={numeric ? 'text-end' : undefined}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          sortKey === k ? 'font-semibold text-foreground' : 'text-muted-foreground',
        )}
      >
        {children}
        {sortKey === k &&
          (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );

  const noData = ranked.length === 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="min-w-0">
          <CardTitle>
            {t(isService ? 'reports.tiTitleServices' : 'reports.tiTitleProducts')}
          </CardTitle>
          <CardDescription>
            {noData
              ? t(isService ? 'reports.tiNoDataServices' : 'reports.tiNoDataProducts')
              : t(isService ? 'reports.tiCaptionServices' : 'reports.tiCaptionProducts', {
                  count: ranked.length,
                  shown: chartData.length,
                  total: ranked.length,
                  measure: activeMeasure.labelLower,
                })}
          </CardDescription>
        </div>
        <Select value={measure} onValueChange={v => setMeasure(v as RankBy)}>
          <SelectTrigger className="h-8 w-[150px] shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEASURES.map(m => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {noData ? (
          <div className="flex h-[300px] flex-col items-center justify-center p-4 text-center text-muted-foreground">
            <Package className="mb-4 h-16 w-16 opacity-50" />
            <div className="max-w-sm rounded-md bg-muted/50 p-2 text-sm">
              <p className="flex items-center justify-center gap-2 font-semibold">
                <Bot className="h-4 w-4 text-primary" /> Zen AI
              </p>
              <p>{t(isService ? 'reports.tiEmptyServices' : 'reports.tiEmptyProducts')}</p>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          // Reachable when ranking by profit and no item has a cost price.
          <div className="flex h-[300px] flex-col items-center justify-center p-4 text-center text-muted-foreground">
            <Sparkles className="mb-4 h-12 w-12 opacity-50" />
            <p className="max-w-sm text-sm">
              {t(isService ? 'reports.tiNoCostServices' : 'reports.tiNoCostProducts')}
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 10, right: 16, top: 10, bottom: 10 }}
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
                        {activeMeasure.axis}:{' '}
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {measure === 'units'
                            ? Number(value).toLocaleString()
                            : money(Number(value))}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="value" fill="var(--color-value, hsl(var(--primary)))" radius={4} />
            </BarChart>
          </ChartContainer>
        )}

        {!noData && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <p className="text-[11px] leading-snug text-muted-foreground">
              {measure === 'profit' ? (
                <>
                  {t(isService ? 'reports.tiSoldServices' : 'reports.tiSoldProducts', {
                    count: soldCount,
                    formatted: soldCount.toLocaleString(),
                  })}
                  {costGaps > 0 && ` ${t('reports.tiUncosted', { count: costGaps })}`}
                  {lossMaking > 0 && ` ${t('reports.tiAtALoss', { count: lossMaking })}`}
                </>
              ) : (
                t(
                  isService
                    ? 'reports.tiSoldInPeriodServices'
                    : 'reports.tiSoldInPeriodProducts',
                  { count: soldCount, formatted: soldCount.toLocaleString() },
                )
              )}
            </p>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs">
                  {t('reports.tiViewAllCount', { count: ranked.length })}
                </Button>
              </DialogTrigger>
              <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col">
                <DialogHeader>
                  <DialogTitle>
                    {t(
                      isService
                        ? 'reports.tiDialogTitleServices'
                        : 'reports.tiDialogTitleProducts',
                      { count: ranked.length },
                    )}
                  </DialogTitle>
                  {/* The inline <strong>line revenue</strong> is lost here: `translate`
                      returns a string, so one key cannot carry a React node. The whole
                      sentence is one key rather than three, so the emphasis is the only
                      casualty — splitting it would put the clause order under the caller's
                      control instead of the translator's. */}
                  <DialogDescription className="text-xs">
                    {t('reports.tiDialogBody', { measure: activeMeasure.labelLower })}
                  </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder={t(
                      isService ? 'reports.tiSearchServices' : 'reports.tiSearchProducts',
                    )}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-8 max-w-xs text-xs"
                  />
                  <span className="text-xs text-muted-foreground">
                    {t('reports.tiShowingOf', {
                      shown: filtered.length,
                      total: ranked.length,
                    })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="ms-auto h-8 shrink-0 text-xs"
                  >
                    <Download className="me-1.5 h-3.5 w-3.5" />
                    {t('reports.tiExportCsv')}
                  </Button>
                </div>

                <ScrollArea className="min-h-0 flex-1 rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <SortHead k="rank" numeric={false}>
                          #
                        </SortHead>
                        <SortHead k="name" numeric={false}>
                          {t(isService ? 'reports.colService' : 'reports.colProduct')}
                        </SortHead>
                        <SortHead k="units">{t('reports.colUnits')}</SortHead>
                        <SortHead k="revenue">{t('reports.colRevenue')}</SortHead>
                        <SortHead k="profit">{t('reports.colProfit')}</SortHead>
                        <SortHead k="margin">{t('reports.colMargin')}</SortHead>
                        <SortHead k="share">{t('reports.colShare')}</SortHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                            {t('reports.tiNothingMatches', { query: search })}
                          </TableCell>
                        </TableRow>
                      ) : (
                        sorted.map((s, i) => (
                          <TableRow key={s.key}>
                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                              {i + 1}
                            </TableCell>
                            <TableCell className="max-w-[240px]">
                              <p className="truncate text-sm font-medium">{s.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {s.category}
                                {s.sku ? ` · ${s.sku}` : ''}
                              </p>
                            </TableCell>
                            <TableCell className="text-end text-sm tabular-nums">
                              {s.units.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-end text-sm tabular-nums">
                              {money(s.revenue)}
                            </TableCell>
                            <TableCell className="text-end text-sm tabular-nums">
                              {s.profit === null ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help text-muted-foreground">—</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-[220px] text-xs">
                                      {s.costCoverage > 0
                                        ? t('reports.tiNoCostPartial', {
                                            pct: Math.round((1 - s.costCoverage) * 100),
                                          })
                                        : t('reports.tiNoCostAll')}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className={s.profit < 0 ? 'text-destructive' : undefined}>
                                  {money(s.profit)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-end text-sm tabular-nums">
                              {s.marginPct === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'font-mono text-[11px]',
                                    s.marginPct < 0 && 'border-destructive/30 text-destructive',
                                  )}
                                >
                                  {s.marginPct.toFixed(1)}%
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-end text-xs text-muted-foreground tabular-nums">
                              {(s.revenueShare * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
