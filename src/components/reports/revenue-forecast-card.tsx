'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Target, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import type { Receipt } from '@/types';
import { safeToDate } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';
import { startOfDay, endOfDay, differenceInDays, subDays, format, isAfter, isBefore } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface RevenueForecastCardProps {
    receipts: Receipt[];
    currencySymbol: string;
}

export default function RevenueForecastCard({ receipts, currencySymbol }: RevenueForecastCardProps) {
    const { t } = useI18n();
    const forecastData = React.useMemo(() => {
        if (!receipts || receipts.length === 0) return null;

        // 1. Calculate overall metrics
        let totalRevenue = 0;
        let oldestDate = safeToDate(receipts[0].createdAt);
        let newestDate = safeToDate(receipts[0].createdAt);

        receipts.forEach(r => {
            const d = safeToDate(r.createdAt);
            if (d < oldestDate) oldestDate = d;
            if (d > newestDate) newestDate = d;
            
            r.items.forEach(item => {
                totalRevenue += (Number(item.price) || 0) * (Number(item.quantity) || 0);
            });
        });

        // Ensure at least 1 day elapsed to avoid division by zero
        let daysElapsed = differenceInDays(endOfDay(newestDate), startOfDay(oldestDate)) + 1;
        const dailyRunRate = totalRevenue / daysElapsed;
        
        // 30 day projection
        const projected30Days = dailyRunRate * 30;

        // 2. Calculate recent trend (Last 7 days vs Previous 7 days)
        const sevenDaysAgo = subDays(newestDate, 7);
        const fourteenDaysAgo = subDays(newestDate, 14);

        let last7Revenue = 0;
        let prev7Revenue = 0;

        receipts.forEach(r => {
            const d = safeToDate(r.createdAt);
            const rev = r.items.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);
            
            if (isAfter(d, sevenDaysAgo)) {
                last7Revenue += rev;
            } else if (isAfter(d, fourteenDaysAgo) && isBefore(d, sevenDaysAgo)) {
                prev7Revenue += rev;
            }
        });

        const trendPercent = prev7Revenue === 0 ? 100 : ((last7Revenue - prev7Revenue) / prev7Revenue) * 100;

        // 3. Generate Chart Data (Historical + Projected)
        const chartData: any[] = [];
        
        // Group historical by day for the last 14 days
        const dailyTotals: Record<string, number> = {};
        for (let i = 13; i >= 0; i--) {
            const d = subDays(newestDate, i);
            dailyTotals[format(d, 'MMM dd')] = 0;
        }

        receipts.forEach(r => {
            const d = safeToDate(r.createdAt);
            if (isAfter(d, fourteenDaysAgo)) {
                const dateStr = format(d, 'MMM dd');
                if (dailyTotals[dateStr] !== undefined) {
                    dailyTotals[dateStr] += r.items.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);
                }
            }
        });

        Object.entries(dailyTotals).forEach(([date, revenue]) => {
            chartData.push({ date, historical: revenue, projected: null });
        });

        // Add 7 days of projection
        let currentTrendRate = dailyRunRate;
        // Adjust future projection slightly based on recent trend (capped at 5% daily variance for realism)
        const dailyGrowthFactor = Math.min(Math.max(1 + (trendPercent / 100 / 30), 0.95), 1.05);

        for (let i = 1; i <= 7; i++) {
            const d = new Date(newestDate);
            d.setDate(d.getDate() + i);
            currentTrendRate = currentTrendRate * dailyGrowthFactor;
            chartData.push({ 
                date: format(d, 'MMM dd'), 
                historical: null, 
                projected: currentTrendRate 
            });
        }

        // Bridge the gap so the line connects
        const lastHistorical = chartData.filter(d => d.historical !== null).pop();
        if (lastHistorical) {
            const firstProjected = chartData.find(d => d.projected !== null);
            if (firstProjected) {
                lastHistorical.projected = lastHistorical.historical;
            }
        }

        return {
            dailyRunRate,
            projected30Days,
            trendPercent,
            chartData,
            isPositiveTrend: trendPercent >= 0
        };

    }, [receipts]);

    if (!forecastData) {
        return (
            <Card className="h-full flex flex-col justify-center items-center p-6 text-center text-muted-foreground">
                <Target className="h-10 w-10 opacity-20 mb-3" />
                <p>{t('reports.rfNotEnough')}</p>
            </Card>
        );
    }

    const { dailyRunRate, projected30Days, trendPercent, chartData, isPositiveTrend } = forecastData;

    return (
        <Card className="border border-border/50 relative overflow-hidden bg-gradient-to-br from-card to-card/50">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Target className="h-24 w-24" />
            </div>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-indigo-500" /> {t('reports.rfTitle')}
                </CardTitle>
                <CardDescription>{t('reports.rfSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-6 mt-2">
                    <div className="flex flex-col justify-center space-y-4 md:w-1/3">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('reports.rfProjection')}</p>
                            <p className="text-3xl font-black text-foreground mt-1">
                                {currencySymbol}{projected30Days.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                            <div className={`flex items-center gap-1 mt-2 text-sm font-semibold ${isPositiveTrend ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isPositiveTrend ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                <span>{t('reports.rfVsPrevious7', { pct: Math.abs(trendPercent).toFixed(1) })}</span>
                            </div>
                        </div>
                        
                        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                            <p className="text-xs text-muted-foreground">{t('reports.rfRunRate')}</p>
                            <p className="font-semibold text-lg">{currencySymbol}{dailyRunRate.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('reports.rfPerDay')}</p>
                        </div>
                    </div>
                    
                    <div className="md:w-2/3 h-[180px]">
                        <ChartContainer config={{ 
                            historical: { label: t('reports.rfHistorical'), color: "hsl(var(--primary))" },
                            projected: { label: t('reports.rfForecast'), color: "hsl(var(--chart-3))" }
                        }} className="h-full w-full">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorHist" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-historical, #3b82f6)" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="var(--color-historical, #3b82f6)" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-projected, #8b5cf6)" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="var(--color-projected, #8b5cf6)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} minTickGap={20} />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" formatter={(value) => `${currencySymbol}${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />} />
                                <Area type="monotone" dataKey="historical" stroke="var(--color-historical, #3b82f6)" strokeWidth={3} fill="url(#colorHist)" isAnimationActive={false} />
                                <Area type="monotone" dataKey="projected" stroke="var(--color-projected, #8b5cf6)" strokeWidth={3} strokeDasharray="4 4" fill="url(#colorProj)" isAnimationActive={false} />
                            </AreaChart>
                        </ChartContainer>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
