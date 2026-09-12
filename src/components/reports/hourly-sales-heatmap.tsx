
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Clock, Users, Calendar, TrendingUp } from 'lucide-react';
import { TimeframePicker, type Timeframe } from './timeframe-picker';
import { subDays, startOfDay } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface HourlySalesHeatmapProps {
    receipts: Receipt[];
}

const DAY_KEYS = [
    'reports.hhDaySunday',
    'reports.hhDayMonday',
    'reports.hhDayTuesday',
    'reports.hhDayWednesday',
    'reports.hhDayThursday',
    'reports.hhDayFriday',
    'reports.hhDaySaturday',
];
const DAY_SHORT_KEYS = [
    'reports.hhDayShortSunday',
    'reports.hhDayShortMonday',
    'reports.hhDayShortTuesday',
    'reports.hhDayShortWednesday',
    'reports.hhDayShortThursday',
    'reports.hhDayShortFriday',
    'reports.hhDayShortSaturday',
];

export default function HourlySalesHeatmap({ receipts }: HourlySalesHeatmapProps) {
    const { t } = useI18n();
    const [timeframe, setTimeframe] = React.useState<Timeframe>('all');

    const filteredReceipts = React.useMemo(() => {
        let results = [...receipts];
        
        if (timeframe !== 'all') {
            const now = new Date();
            let limitDate: Date;
            if (timeframe === 'today') limitDate = startOfDay(now);
            else if (timeframe === '7d') limitDate = subDays(now, 7);
            else if (timeframe === '30d') limitDate = subDays(now, 30);
            else limitDate = subDays(now, 90);

            results = receipts.filter(r => {
                const rd = safeToDate(r.createdAt);
                return rd >= limitDate;
            });
        }
        return results;
    }, [receipts, timeframe]);

    const hourlyData = React.useMemo(() => {
        const hours: Record<number, number> = {};
        for (let i = 0; i < 24; i++) hours[i] = 0;

        filteredReceipts.forEach(r => {
            const date = safeToDate(r.createdAt);
            const hour = date.getHours();
            hours[hour] = (hours[hour] || 0) + 1;
        });

        return Object.entries(hours).map(([hour, count]) => {
            const h = parseInt(hour);
            const period = h >= 12 ? 'PM' : 'AM';
            const displayHour = h === 0 ? 12 : (h > 12 ? h - 12 : h);
            return {
                hour: h,
                count,
                display: `${displayHour}:00 ${period}`
            };
        });
    }, [filteredReceipts]);

    const dailyData = React.useMemo(() => {
        const days: Record<number, number> = {};
        for (let i = 0; i < 7; i++) days[i] = 0;

        filteredReceipts.forEach(r => {
            const date = safeToDate(r.createdAt);
            const day = date.getDay();
            days[day] = (days[day] || 0) + 1;
        });

        return Object.entries(days).map(([day, count]) => ({
            day: parseInt(day),
            name: t(DAY_KEYS[parseInt(day)]),
            count
        }));
    }, [filteredReceipts, t]);

    const peakHour = React.useMemo(() => {
        return [...hourlyData].sort((a, b) => b.count - a.count)[0];
    }, [hourlyData]);

    const peakDay = React.useMemo(() => {
        return [...dailyData].sort((a, b) => b.count - a.count)[0];
    }, [dailyData]);

    return (
        <Card className="shadow-md overflow-hidden w-full">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        {t('reports.hhTitle')}
                    </CardTitle>
                    <CardDescription>{t('reports.hhSubtitle')}</CardDescription>
                </div>
                <div className="flex justify-end">
                    <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="hourly" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="hourly" className="text-xs">{t('reports.hhPeakHours')}</TabsTrigger>
                        <TabsTrigger value="daily" className="text-xs">{t('reports.hhPeakDays')}</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="hourly" className="space-y-4">
                        {peakHour && peakHour.count > 0 && (
                            <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                                <div className="p-2 rounded-full bg-primary/10">
                                    <Clock className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{t('reports.hhPeakWindow')}</p>
                                    <p className="text-sm font-bold">
                                        {t('reports.hhPeakLine', { label: peakHour.display, count: peakHour.count })}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                    <XAxis 
                                        dataKey="hour" 
                                        tickFormatter={(h) => {
                                            const hour = parseInt(h);
                                            if (hour === 0) return '12am';
                                            if (hour === 12) return '12pm';
                                            return hour > 12 ? `${hour - 12}pm` : `${hour}am`;
                                        }} 
                                        fontSize={9} 
                                        axisLine={false} 
                                        tickLine={false}
                                        interval={2} // Show every 2nd hour to keep it clean
                                    />
                                    <YAxis hide />
                                    <Tooltip 
                                        cursor={{ fill: 'transparent' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-background border rounded-lg p-2 shadow-xl text-xs">
                                                        <p className="font-bold">{data.display}</p>
                                                        <p className="text-primary">{t('reports.hhSalesCount', { count: data.count })}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                        {hourlyData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={entry.count === peakHour?.count && entry.count > 0 ? 'var(--primary)' : 'rgba(var(--primary-rgb, 249, 115, 22), 0.3)'} 
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </TabsContent>

                    <TabsContent value="daily" className="space-y-4">
                        {peakDay && peakDay.count > 0 && (
                            <div className="flex items-center gap-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                <div className="p-2 rounded-full bg-emerald-500/10">
                                    <Calendar className="h-4 w-4 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{t('reports.hhBusiestDay')}</p>
                                    <p className="text-sm font-bold">
                                        {t('reports.hhPeakLine', { label: peakDay.name, count: peakDay.count })}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                    <XAxis 
                                        dataKey="day"
                                        tickFormatter={(d) => t(DAY_SHORT_KEYS[Number(d)])}
                                        fontSize={10} 
                                        axisLine={false} 
                                        tickLine={false}
                                    />
                                    <YAxis hide />
                                    <Tooltip 
                                        cursor={{ fill: 'transparent' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-background border rounded-lg p-2 shadow-xl text-xs">
                                                        <p className="font-bold">{data.name}</p>
                                                        <p className="text-emerald-500">{t('reports.hhSalesCount', { count: data.count })}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                        {dailyData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-daily-${index}`} 
                                                fill={entry.count === peakDay?.count && entry.count > 0 ? '#10b981' : 'rgba(16, 185, 129, 0.2)'} 
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
