
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, CartesianGrid, XAxis, YAxis, Line } from 'recharts';
import { TrendingUp, Bot } from 'lucide-react';
import type { Receipt } from '@/types';
import type { ChartConfig } from "@/components/ui/chart";
import { TimeframePicker, type Timeframe } from './timeframe-picker';
import { subDays, startOfDay } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';

interface SalesOverTimeChartProps {
    receipts: Receipt[];
    currencySymbol: string;
    data?: { month: string, sales: number }[];
}

export default function SalesOverTimeChart({ receipts, currencySymbol, data }: SalesOverTimeChartProps) {
    const { t } = useI18n();
    const [timeframe, setTimeframe] = React.useState<Timeframe>('all');
    // Inside the component because the label is translated; there is no `t` at module scope.
    const chartConfig = {
      sales: {
        label: t('reports.colSales'),
        color: "hsl(var(--primary))",
      },
    } satisfies ChartConfig;

    const chartData = React.useMemo(() => {
        if (data && timeframe === 'all') return data;
        
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

        const monthlySales: Record<string, number> = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const currentYear = new Date().getFullYear();

        filteredReceipts.forEach(receipt => {
          const date = safeToDate(receipt.createdAt);
          const year = date.getFullYear();
          if (year === currentYear || timeframe !== 'all') { 
            const monthName = monthNames[date.getMonth()];
            monthlySales[monthName] = (monthlySales[monthName] || 0) + receipt.total;
          }
        });

        return monthNames.map(month => ({
          month,
          sales: monthlySales[month] || 0,
        }));
    }, [receipts, data, timeframe]);

    const noData = chartData.every(d => d.sales === 0);

    return (
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                   <CardTitle>{t('reports.sotTitle')}</CardTitle>
                   <CardDescription>{t('reports.sotSubtitle')}</CardDescription>
                </div>
                <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
            </CardHeader>
            <CardContent>
                {noData ? (
                    <div className="h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                        <TrendingUp className="h-16 w-16 opacity-50 mb-4" />
                        <div className="text-sm p-2 rounded-md bg-muted/50 max-w-sm">
                             <p className="font-semibold flex items-center gap-2 justify-center"><Bot className="h-4 w-4 text-primary"/> Zen AI</p>
                            <p>{t('reports.sotEmpty')}</p>
                        </div>
                    </div>
                ) : (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={8} 
                                tickFormatter={(value) => {
                                    const val = Number(value);
                                    if (val >= 1000000) return `${currencySymbol}${(val / 1000000).toFixed(1)}M`;
                                    if (val >= 1000) return `${currencySymbol}${val / 1000}k`;
                                    return `${currencySymbol}${val}`;
                                }} 
                            />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" formatter={(value) => `${currencySymbol}${Number(value).toLocaleString()}`} />} />
                            <Line dataKey="sales" type="monotone" stroke="var(--color-sales, #f97316)" strokeWidth={3} dot={false} />
                        </LineChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}
