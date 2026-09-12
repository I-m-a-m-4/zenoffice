
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Wallet, CreditCard, Landmark, FileText, PieChart as PieChartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';

import { TimeframePicker, type Timeframe } from './timeframe-picker';
import { subDays, startOfDay } from 'date-fns';
import { safeToDate } from '@/lib/utils';

interface PaymentMethodDistributionProps {
    receipts: Receipt[];
    currencySymbol: string;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

export default function PaymentMethodDistribution({ receipts, currencySymbol }: PaymentMethodDistributionProps) {
    const { t } = useI18n();
    const [timeframe, setTimeframe] = React.useState<Timeframe>('all');

    const data = React.useMemo(() => {
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

        const distribution: Record<string, { total: number; count: number }> = {
            'Cash': { total: 0, count: 0 },
            'Card': { total: 0, count: 0 },
            'Bank Transfer': { total: 0, count: 0 },
            'Invoice': { total: 0, count: 0 }
        };

        filteredReceipts.forEach(receipt => {
            const method = receipt.paymentMethod || 'Cash';
            if (!distribution[method]) {
                distribution[method] = { total: 0, count: 0 };
            }
            distribution[method].total += receipt.total;
            distribution[method].count += 1;
        });

        return Object.entries(distribution)
            .filter(([, stats]) => stats.count > 0)
            .map(([name, stats]) => ({
                name,
                value: stats.total,
                count: stats.count
            }))
            .sort((a, b) => b.value - a.value);
    }, [receipts, timeframe]);

    const totalRevenue = data.reduce((sum, item) => sum + item.value, 0);

    const getIcon = (method: string) => {
        switch (method) {
            case 'Cash': return <Wallet className="h-4 w-4 text-emerald-500" />;
            case 'Card': return <CreditCard className="h-4 w-4 text-blue-500" />;
            case 'Bank Transfer': return <Landmark className="h-4 w-4 text-violet-500" />;
            case 'Invoice': return <FileText className="h-4 w-4 text-amber-500" />;
            default: return <Wallet className="h-4 w-4" />;
        }
    };

    return (
        <Card className="shadow-md overflow-hidden w-full">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5 text-primary" />
                        {t('reports.pmTitle')}
                    </CardTitle>
                    <CardDescription>{t('reports.pmSubtitle')}</CardDescription>
                </div>
                <div className="flex justify-end">
                    <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[300px] md:h-[300px]">
                    <div className="h-[250px] md:h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value: number) => [`${currencySymbol}${value.toLocaleString()}`, 'Revenue']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col justify-center space-y-4">
                        {data.map((item, index) => (
                            <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-1.5 rounded-full bg-background border")} style={{ borderColor: COLORS[index % COLORS.length] }}>
                                        {getIcon(item.name)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{item.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{item.count} {t('reports.pmTransactions')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold">{currencySymbol}{item.value.toLocaleString()}</p>
                                    <p className="text-[10px] text-primary font-medium">
                                        {totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(1) : 0}%
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
