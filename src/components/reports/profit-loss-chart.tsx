'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, CartesianGrid, XAxis, YAxis, Area, Legend } from 'recharts';
import { TrendingUp, Bot } from 'lucide-react';
import type { Receipt } from '@/types';
import type { ChartConfig } from "@/components/ui/chart";
import { TimeframePicker, type Timeframe } from './timeframe-picker';
import { subDays, startOfDay } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';

interface ProfitLossChartProps {
    receipts: Receipt[];
    currencySymbol: string;
}

export default function ProfitLossChart({ receipts, currencySymbol }: ProfitLossChartProps) {
    const { t } = useI18n();
    const [timeframe, setTimeframe] = React.useState<Timeframe>('all');
    // Inside the component: the three series labels are translated, and there is no `t`
    // at module scope.
    const chartConfig = {
      revenue: { label: t('reports.colRevenue'), color: "hsl(var(--chart-2))" },
      profit: { label: t('reports.colProfit'), color: "hsl(var(--chart-1))" },
      cost: { label: t('reports.colCost'), color: "hsl(var(--chart-5))" },
    } satisfies ChartConfig;

    const chartData = React.useMemo(() => {
        let filteredReceipts = [...receipts];
        
        if (timeframe !== 'all') {
            const now = new Date();
            let limitDate: Date;
            if (timeframe === 'today') limitDate = startOfDay(now);
            else if (timeframe === '7d') limitDate = subDays(now, 7);
            else if (timeframe === '30d') limitDate = subDays(now, 30);
            else limitDate = subDays(now, 90);

            filteredReceipts = receipts.filter(r => {
                const rd = safeToDate(r.createdAt);
                return rd >= limitDate;
            });
        }

        const monthlyData: Record<string, { revenue: number; cost: number; profit: number; }> = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const currentYear = new Date().getFullYear();

        filteredReceipts.forEach(receipt => {
          const date = safeToDate(receipt.createdAt);
          const year = date.getFullYear();
          if (year === currentYear || timeframe !== 'all') { 
            const monthName = monthNames[date.getMonth()];
            if (!monthlyData[monthName]) {
                monthlyData[monthName] = { revenue: 0, cost: 0, profit: 0 };
            }
            monthlyData[monthName].revenue += receipt.total || 0;
            monthlyData[monthName].cost += receipt.totalCost || 0;
            monthlyData[monthName].profit += receipt.profit || 0;
          }
        });

        return monthNames.map(month => ({
          month,
          revenue: monthlyData[month]?.revenue || 0,
          cost: monthlyData[month]?.cost || 0,
          profit: monthlyData[month]?.profit || 0,
        }));
    }, [receipts, timeframe]);

    const totals = React.useMemo(() => {
        return chartData.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.revenue,
            cost: acc.cost + curr.cost,
            profit: acc.profit + curr.profit,
        }), { revenue: 0, cost: 0, profit: 0 });
    }, [chartData]);

    const noData = chartData.every(d => d.revenue === 0 && d.profit === 0);
    const hasCostData = chartData.some(d => d.cost > 0);

    return (
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                   <CardTitle>{t('reports.tabProfitLoss')}</CardTitle>
                   <CardDescription>{t('reports.plcSubtitle')}</CardDescription>
                </div>
                <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6 pt-2">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">{t('dashboard.totalRevenue')}</p>
                        <p className="text-sm font-bold truncate">{currencySymbol}{totals.revenue.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">{t('reports.plcTotalCost')}</p>
                        <p className="text-sm font-bold truncate text-destructive/80">{currencySymbol}{totals.cost.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold font-bold text-primary">{t('reports.kpiNetProfit')}</p>
                        <p className="text-sm font-bold truncate text-primary">{currencySymbol}{totals.profit.toLocaleString()}</p>
                    </div>
                </div>

                {noData ? (
                    <div className="h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                        <TrendingUp className="h-16 w-16 opacity-50 mb-4" />
                         <div className="text-sm p-2 rounded-md bg-muted/50 max-w-sm">
                             <p className="font-semibold flex items-center gap-2 justify-center"><Bot className="h-4 w-4 text-primary"/> Zen AI</p>
                            <p>{t('reports.plcEmpty')}</p>
                        </div>
                    </div>
                ) : (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-revenue, #f97316)" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="var(--color-revenue, #f97316)" stopOpacity={0.0}/>
                                </linearGradient>
                                <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-profit, #10b981)" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="var(--color-profit, #10b981)" stopOpacity={0.0}/>
                                </linearGradient>
                                <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-cost, #ef4444)" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="var(--color-cost, #ef4444)" stopOpacity={0.0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={8} 
                                tickFormatter={(value) => {
                                    const val = Number(value);
                                    if (val >= 1000000) return `${currencySymbol}${val / 1000000}M`;
                                    if (val >= 1000) return `${currencySymbol}${val / 1000}k`;
                                    return `${currencySymbol}${val}`;
                                }} 
                            />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="line" formatter={(value) => `${currencySymbol}${Number(value).toLocaleString()}`} />}
                            />
                            <Legend verticalAlign="top" height={36}/>
                            <Area dataKey="revenue" type="linear" fill="url(#fillRevenue)" fillOpacity={1} stroke="var(--color-revenue, #f97316)" strokeWidth={3} dot={false} />
                            <Area dataKey="profit" type="linear" fill="url(#fillProfit)" fillOpacity={1} stroke="var(--color-profit, #10b981)" strokeWidth={3} dot={false} />
                            {hasCostData && <Area dataKey="cost" type="linear" fill="url(#fillCost)" fillOpacity={1} stroke="var(--color-cost, #ef4444)" strokeDasharray="5 5" strokeWidth={2} dot={false} />}
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}
