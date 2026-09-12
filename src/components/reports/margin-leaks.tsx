'use client';

/**
 * Margin leaks — where money left the business without anyone deciding it should.
 *
 * **Deliberately not a chart.** Every row here is a thing to go and act on: a price
 * to raise, a cost to check, a discount habit to talk about. A bar chart of leaks
 * would look analytical and be harder to use than the list.
 *
 * Three leaks, and they are three different kinds of claim:
 *
 * 1. **Sold below cost** — arithmetic on rows the shop entered itself. Only items
 *    with a known cost appear; the count of uncosted items is stated instead of
 *    being silently excluded, because "no items below cost" reads very differently
 *    when half the catalogue has no cost price.
 * 2. **Price overrides** — exact, and the strongest signal here. `priceOverridden`
 *    and `listPrice` are captured on the receipt line at the moment of sale, so
 *    this is what the shelf said versus what was charged. It cannot be recovered
 *    later: comparing a historic sale against a product's *current* price makes
 *    every honest price rise look like an override.
 * 3. **Receipt discounts** — one period figure, and **never attributed to a
 *    product**. `Receipt.discount` is a single number on the sale with no per-line
 *    breakdown, so splitting it across the basket would be an invention.
 */

import * as React from 'react';
import { AlertTriangle, PercentCircle, TrendingDown, Tag } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { aggregateItems, findMarginLeaks } from '@/lib/reports-aggregates';
import { useI18n } from '@/context/i18n-context';
import type { Product, Receipt } from '@/types';

/** Rows shown per list before scrolling. The scroll area carries the rest. */
const VISIBLE = 6;

interface MarginLeaksPanelProps {
  receipts: Receipt[];
  products: Product[];
  currencySymbol?: string;
}

export default function MarginLeaksPanel({
  receipts,
  products,
  currencySymbol = '',
}: MarginLeaksPanelProps) {
  const { t } = useI18n();
  const money = (n: number) =>
    `${currencySymbol}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const leaks = React.useMemo(() => {
    const { items } = aggregateItems(receipts, products);
    return findMarginLeaks(items, receipts);
  }, [receipts, products]);

  const hasBelowCost = leaks.belowCost.length > 0;
  const hasOverrides = leaks.overrides.length > 0;
  const hasDiscounts = leaks.discountTotal > 0;

  // Nothing found and nothing measurable — say so rather than render three empty
  // lists that look like a clean bill of health.
  if (!hasBelowCost && !hasOverrides && !hasDiscounts) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            {t('reports.mlTitle')}
          </CardTitle>
          <CardDescription>
            {t('reports.mlCleanBody')}
            {leaks.uncostedItems > 0 &&
              ` ${t('reports.mlCleanUncosted', { count: leaks.uncostedItems })}`}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalLeak = leaks.totalBelowCostLoss + leaks.totalOverrideGiveaway;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          {t('reports.mlTitle')}
        </CardTitle>
        <CardDescription>
          {t('reports.mlSubtitle')}
          {totalLeak > 0 && (
            <>
              {' '}
              <strong className="text-foreground">{money(totalLeak)}</strong>{' '}
              {t('reports.mlAcross')}
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {hasBelowCost && (
          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {t('reports.mlSoldBelowCost')}
              </h4>
              <Badge variant="outline" className="border-destructive/30 text-destructive">
                −{money(leaks.totalBelowCostLoss)}
              </Badge>
            </div>
            <ScrollArea className={leaks.belowCost.length > VISIBLE ? 'h-[220px]' : undefined}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.colItem')}</TableHead>
                    <TableHead className="text-end">{t('reports.colUnits')}</TableHead>
                    <TableHead className="text-end">{t('reports.mlColSoldFor')}</TableHead>
                    <TableHead className="text-end">{t('reports.colCost')}</TableHead>
                    <TableHead className="text-end">{t('reports.mlColLost')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaks.belowCost.map(r => (
                    <TableRow key={r.key}>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        {r.sku && (
                          <p className="truncate text-[11px] text-muted-foreground">{r.sku}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-end text-sm tabular-nums">
                        {r.units.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-end text-sm tabular-nums">
                        {money(r.revenue)}
                      </TableCell>
                      <TableCell className="text-end text-sm tabular-nums text-muted-foreground">
                        {money(r.cost)}
                      </TableCell>
                      <TableCell className="text-end text-sm font-medium tabular-nums text-destructive">
                        −{money(r.loss)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </section>
        )}

        {hasOverrides && (
          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                <Tag className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                {t('reports.mlOverridesTitle')}
              </h4>
              <Badge variant="outline">{money(leaks.totalOverrideGiveaway)}</Badge>
            </div>
            <ScrollArea className={leaks.overrides.length > VISIBLE ? 'h-[220px]' : undefined}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.colItem')}</TableHead>
                    <TableHead className="text-end">{t('reports.mlColUnitsTyped')}</TableHead>
                    <TableHead className="text-end">{t('reports.mlColBelowShelf')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaks.overrides.map(r => (
                    <TableRow key={r.key}>
                      <TableCell className="max-w-[240px]">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        {r.sku && (
                          <p className="truncate text-[11px] text-muted-foreground">{r.sku}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-end text-sm tabular-nums">
                        {r.overriddenUnits.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-end text-sm font-medium tabular-nums">
                        {money(r.giveaway)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t('reports.mlOverridesFootnote')}
            </p>
          </section>
        )}

        {hasDiscounts && (
          <section className="space-y-1 rounded-md border border-dashed bg-muted/30 p-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <PercentCircle className="h-4 w-4 text-muted-foreground" />
              {t('reports.mlDiscountsTitle')}
            </h4>
            <p className="text-2xl font-bold tabular-nums">{money(leaks.discountTotal)}</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t('reports.mlDiscountsFootnote', {
                count: leaks.discountedSales,
                formatted: leaks.discountedSales.toLocaleString(),
              })}
            </p>
          </section>
        )}

        {leaks.uncostedItems > 0 && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t('reports.mlUncostedFootnote', { count: leaks.uncostedItems })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
