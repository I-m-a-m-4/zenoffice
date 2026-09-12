
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import type { Customer, Receipt } from '@/types';
import Link from 'next/link';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import { TimeframePicker, type Timeframe } from './timeframe-picker';
import { subDays, startOfDay } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';

interface CustomerAnalyticsProps {
  customers: Customer[];
  receipts: Receipt[];
  currencySymbol: string;
  totalBusinessCustomers?: number;
}

export default function CustomerAnalytics({ customers, receipts, currencySymbol, totalBusinessCustomers }: CustomerAnalyticsProps) {
  const { t } = useI18n();
  const [timeframe, setTimeframe] = React.useState<Timeframe>('90d');

  const analyticsData = React.useMemo(() => {
    if (!customers || !receipts) {
      return {
        totalCustomers: 0,
        newCustomers: 0,
        returningCustomers: 0,
        topCustomersBySpend: [],
        topCustomersByOrders: [],
      };
    }

    const customerStats: Record<string, { name: string; email: string, totalSpent: number; orderCount: number; firstOrder: Date }> = {};

    customers.forEach(c => {
        customerStats[c.id] = {
            name: c.name,
            email: c.email,
            totalSpent: 0,
            orderCount: 0,
            firstOrder: safeToDate(c.createdAt)
        }
    });

    receipts.forEach(receipt => {
      if (receipt.customer?.id) {
        if (!customerStats[receipt.customer.id]) {
            customerStats[receipt.customer.id] = {
                name: receipt.customer.name || t('reports.caAnonymousBuyer'),
                email: receipt.customer.email || t('inventory.notAvailable'),
                totalSpent: 0,
                orderCount: 0,
                firstOrder: safeToDate(receipt.createdAt)
            };
        }
        customerStats[receipt.customer.id].totalSpent += receipt.total;
        customerStats[receipt.customer.id].orderCount += 1;
        
        const rDate = safeToDate(receipt.createdAt);
        if (rDate < customerStats[receipt.customer.id].firstOrder) {
            customerStats[receipt.customer.id].firstOrder = rDate;
        }
      }
    });
    
    const customerArray = Object.entries(customerStats).map(([id, data]) => ({ id, ...data }));
    
    const topCustomersBySpend = [...customerArray].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const newCustomers = customerArray.filter(c => c.firstOrder > oneMonthAgo).length;
    const returningCustomers = customerArray.filter(c => c.orderCount > 1).length;
    const totalUniqueBuyers = customerArray.filter(c => c.orderCount >= 1).length;

    return {
      totalCustomers: totalBusinessCustomers && totalBusinessCustomers > customerArray.length ? totalBusinessCustomers : customerArray.length,
      totalUniqueBuyers,
      newCustomers,
      returningCustomers,
      topCustomersBySpend,
    };
  }, [customers, receipts, totalBusinessCustomers, t]);

  const acquisitionData = React.useMemo(() => {
    if (!customers) return [];
    const days: Record<string, number> = {};
    
    // Take based on timeframe
    const now = new Date();
    let limitDate: Date;
    if (timeframe === 'today') limitDate = startOfDay(now);
    else if (timeframe === '7d') limitDate = subDays(now, 7);
    else if (timeframe === '30d') limitDate = subDays(now, 30);
    else if (timeframe === '90d') limitDate = subDays(now, 90);
    else limitDate = new Date(0);

    customers.forEach(c => {
        const date = safeToDate(c.createdAt);
        if (date >= limitDate) {
            const day = date.toISOString().split('T')[0];
            days[day] = (days[day] || 0) + 1;
        }
    });

    return Object.entries(days)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, count]) => ({ day, count }));
  }, [customers, timeframe]);

  return (
    <Card className="overflow-hidden w-full">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {t('reports.caTitle')}
            </CardTitle>
            <CardDescription>
                {t('reports.caSubtitle')}
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>{t('reports.caTotalCustomers')}</CardDescription>
                        <CardTitle className="text-4xl">{analyticsData.totalCustomers}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>{t('reports.caNewLast30')}</CardDescription>
                        <CardTitle className="text-4xl">{analyticsData.newCustomers}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>{t('reports.caReturning')}</CardDescription>
                        <CardTitle className="text-4xl flex items-baseline gap-1">
                            {analyticsData.returningCustomers}
                            <span className="text-sm font-normal text-muted-foreground">/ {analyticsData.totalUniqueBuyers}</span>
                        </CardTitle>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {t('reports.caRetentionRate', {
                                pct:
                                    analyticsData.totalUniqueBuyers > 0
                                        ? ((analyticsData.returningCustomers / analyticsData.totalUniqueBuyers) * 100).toFixed(1)
                                        : '0',
                            })}
                        </p>
                    </CardHeader>
                </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <h4 className="font-semibold text-sm">{t('reports.caAcquisition')}</h4>
                        <div className="flex justify-end">
                            <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
                        </div>
                    </div>
                    <div className="overflow-x-auto border rounded-lg p-4 bg-muted/20">
                        <div className="min-w-[600px] md:min-w-full h-[400px] w-full">
                            {acquisitionData.length > 0 ? (
                                <ChartContainer config={{ count: { label: t('reports.caNewCustomers'), color: "hsl(var(--primary))" } }} className="h-full w-full">
                                    <BarChart data={acquisitionData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis 
                                            dataKey="day" 
                                            tickFormatter={(val) => {
                                                const parts = val.split('-');
                                                if (parts.length < 3) return val;
                                                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                                const m = parseInt(parts[1]) - 1;
                                                const d = parseInt(parts[2]);
                                                return `${monthNames[m]} ${d}`;
                                            }}
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={12}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                            fontSize={10}
                                        />
                                        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ChartContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                    {t('reports.caNoAcquisition')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="md:col-span-1">
                    <h4 className="font-semibold mb-2 text-sm">{t('reports.caTop5')}</h4>
                    <div className="border rounded-lg overflow-auto w-full">
                        <div className="min-w-[500px]">
                            <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('reports.colCustomer')}</TableHead>
                                    <TableHead className="text-right">{t('reports.colTotalSpent')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analyticsData.topCustomersBySpend.map(c => (
                                    <TableRow 
                                        key={c.id} 
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    >
                                        <TableCell>
                                            <Link href={`/customers/details?id=${c.id}`} className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback>{c.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="font-medium">{c.name}</div>
                                                    <div className="text-xs text-muted-foreground">{c.email}</div>
                                                </div>
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">{currencySymbol}{c.totalSpent.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
            </div>
        </CardContent>
    </Card>
  );
}
