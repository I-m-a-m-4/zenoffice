'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Users,
  TrendingUp,
  Sparkles,
  MessageSquare,
  ExternalLink,
  ShieldAlert,
  Award,
  Clock,
  ArrowUpRight,
  CreditCard,
  Repeat,
} from 'lucide-react';
import { safeToDate, cn } from '@/lib/utils';
import type { Customer, Receipt } from '@/types';
import { SegmentResult, SEGMENT_LABELS, type SegmentKey } from '@/lib/customer-segments';
import Link from 'next/link';

type AnalyticsPeriod = '30d' | '90d' | '6m' | '1y' | 'all';

interface CustomerAnalyticsTabProps {
  customers: Customer[];
  receipts: Receipt[];
  currencySymbol: string;
  segmentData: SegmentResult;
  businessName?: string;
}

const SEGMENT_COLORS: Record<SegmentKey, string> = {
  vip: '#f59e0b',
  loyal: '#10b981',
  new: '#06b6d4',
  'at-risk': '#f97316',
  lapsed: '#64748b',
  owing: '#ef4444',
  'never-seen': '#94a3b8',
};

const PAYMENT_COLORS: Record<string, string> = {
  Cash: '#10b981',
  'Bank Transfer': '#3b82f6',
  Card: '#f59e0b',
  Invoice: '#ef4444',
};

export function CustomerAnalyticsTab({
  customers,
  receipts,
  currencySymbol,
  segmentData,
  businessName = 'Our Store',
}: CustomerAnalyticsTabProps) {
  const [analyticsPeriod, setAnalyticsPeriod] = React.useState<AnalyticsPeriod>('90d');

  const analyticsData = React.useMemo(() => {
    const totalCustomers = customers.length;
    const now = new Date();

    // Determine period cutoff
    const periodCutoff = new Date();
    if (analyticsPeriod === '30d') periodCutoff.setDate(now.getDate() - 30);
    else if (analyticsPeriod === '90d') periodCutoff.setDate(now.getDate() - 90);
    else if (analyticsPeriod === '6m') periodCutoff.setMonth(now.getMonth() - 6);
    else if (analyticsPeriod === '1y') periodCutoff.setFullYear(now.getFullYear() - 1);
    else if (analyticsPeriod === 'all') periodCutoff.setTime(0);

    // Map each customer to orders & spend in this period
    const customerSpendMap = new Map<
      string,
      {
        customer: Customer;
        periodSpend: number;
        periodOrders: number;
        lastOrderDate: Date | null;
      }
    >();

    customers.forEach((c) => {
      customerSpendMap.set(c.id, {
        customer: c,
        periodSpend: 0,
        periodOrders: 0,
        lastOrderDate: null,
      });
    });

    let totalRevenue = 0;
    let totalOrders = 0;
    const periodReceipts: Receipt[] = [];

    // Payment method distribution
    const paymentMap: Record<string, { label: string; count: number; total: number; color: string }> = {
      Cash: { label: 'Cash', count: 0, total: 0, color: PAYMENT_COLORS.Cash },
      'Bank Transfer': { label: 'Bank Transfer', count: 0, total: 0, color: PAYMENT_COLORS['Bank Transfer'] },
      Card: { label: 'POS Card', count: 0, total: 0, color: PAYMENT_COLORS.Card },
      Invoice: { label: 'Credit / Invoice', count: 0, total: 0, color: PAYMENT_COLORS.Invoice },
    };

    // Tracking for repurchase cycles
    const customerReceiptDates = new Map<string, Date[]>();

    (receipts || []).forEach((r) => {
      const rDate = safeToDate(r.createdAt);
      if (rDate >= periodCutoff) {
        periodReceipts.push(r);
        const rTotal = Number(r.total) || 0;
        totalRevenue += rTotal;
        totalOrders += 1;

        const method = (r.paymentMethod as string) || 'Cash';
        const targetPayment = paymentMap[method] || paymentMap['Cash'];
        targetPayment.count += 1;
        targetPayment.total += rTotal;

        if (r.customer?.id) {
          if (!customerReceiptDates.has(r.customer.id)) {
            customerReceiptDates.set(r.customer.id, []);
          }
          customerReceiptDates.get(r.customer.id)!.push(rDate);

          if (customerSpendMap.has(r.customer.id)) {
            const entry = customerSpendMap.get(r.customer.id)!;
            entry.periodSpend += rTotal;
            entry.periodOrders += 1;
            if (!entry.lastOrderDate || rDate > entry.lastOrderDate) {
              entry.lastOrderDate = rDate;
            }
          }
        }
      }
    });

    // Calculate Average Repurchase Interval
    let totalIntervalDays = 0;
    let repeatCycleCount = 0;
    customerReceiptDates.forEach((dates) => {
      if (dates.length >= 2) {
        dates.sort((a, b) => a.getTime() - b.getTime());
        const spanDays = (dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24);
        const avgDays = spanDays / (dates.length - 1);
        if (avgDays > 0 && avgDays < 365) {
          totalIntervalDays += avgDays;
          repeatCycleCount += 1;
        }
      }
    });
    const avgRepurchaseDays = repeatCycleCount > 0 ? Math.round(totalIntervalDays / repeatCycleCount) : 14;

    // Retention Funnel Metrics
    const totalUniqueBuyersWithOrders = customerReceiptDates.size;
    const secondOrderBuyers = Array.from(customerReceiptDates.values()).filter((d) => d.length >= 2).length;
    const thirdOrderBuyers = Array.from(customerReceiptDates.values()).filter((d) => d.length >= 3).length;
    const secondOrderRate =
      totalUniqueBuyersWithOrders > 0 ? (secondOrderBuyers / totalUniqueBuyersWithOrders) * 100 : 0;
    const thirdOrderRate = secondOrderBuyers > 0 ? (thirdOrderBuyers / secondOrderBuyers) * 100 : 0;

    const paymentList = Object.values(paymentMap)
      .filter((p) => p.count > 0)
      .sort((a, b) => b.total - a.total);

    const activeEntries = Array.from(customerSpendMap.values()).filter((e) => e.periodOrders > 0);
    const activeBuyersCount = activeEntries.length;
    const repeatBuyersCount = activeEntries.filter((e) => e.periodOrders > 1).length;
    const retentionRate = activeBuyersCount > 0 ? (repeatBuyersCount / activeBuyersCount) * 100 : 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const avgSpendPerCustomer = activeBuyersCount > 0 ? totalRevenue / activeBuyersCount : 0;

    // Segment summary counts from segmentData
    const counts = segmentData.summary.counts;
    const vipAndLoyalCount = (counts.vip || 0) + (counts.loyal || 0);

    // Calculate total debt from segmentData
    let totalDebt = 0;
    segmentData.byCustomerId.forEach((m) => {
      if (m.outstanding > 0) {
        totalDebt += m.outstanding;
      }
    });

    // Top Spenders in selected period (or lifetime fallback if period has 0)
    let topSpenders = activeEntries
      .sort((a, b) => b.periodSpend - a.periodSpend)
      .slice(0, 7)
      .map((e) => ({
        name: e.customer.name || 'Unnamed',
        spent: e.periodSpend,
        orders: e.periodOrders,
      }));

    if (topSpenders.length === 0) {
      topSpenders = customers
        .map((c) => ({
          name: c.name || 'Unnamed',
          spent: Number((c as any).computedTotalSpent) || 0,
          orders: segmentData.byCustomerId.get(c.id)?.orders || 0,
        }))
        .filter((e) => e.spent > 0)
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 7);
    }

    // Customer flow movement over time
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const numMonths = analyticsPeriod === '30d' ? 1 : analyticsPeriod === '90d' ? 3 : analyticsPeriod === '1y' ? 12 : 6;
    const customerFlow: { label: string; orders: number; revenue: number }[] = [];

    if (numMonths === 1) {
      // 4 Weekly buckets for 30-day view
      for (let w = 3; w >= 0; w--) {
        const startDay = new Date(now.getTime() - (w + 1) * 7 * 86400000);
        const endDay = new Date(now.getTime() - w * 7 * 86400000);
        const label = `Wk ${4 - w} (${monthNames[startDay.getMonth()]} ${startDay.getDate()})`;

        let wOrders = 0;
        let wRev = 0;
        periodReceipts.forEach((r) => {
          const d = safeToDate(r.createdAt);
          if (d >= startDay && d < endDay) {
            wOrders += 1;
            wRev += Number(r.total) || 0;
          }
        });

        customerFlow.push({ label, orders: wOrders, revenue: Math.round(wRev) });
      }
    } else {
      // Monthly buckets
      for (let i = numMonths - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const targetMonth = d.getMonth();
        const targetYear = d.getFullYear();
        const label = `${monthNames[targetMonth]} ${targetYear !== now.getFullYear() ? `'${String(targetYear).slice(2)}` : ''}`;

        let mOrders = 0;
        let mRev = 0;
        (receipts || []).forEach((r) => {
          const rDate = safeToDate(r.createdAt);
          if (rDate.getMonth() === targetMonth && rDate.getFullYear() === targetYear) {
            mOrders += 1;
            mRev += Number(r.total) || 0;
          }
        });

        customerFlow.push({ label, orders: mOrders, revenue: Math.round(mRev) });
      }
    }

    // Segment Distribution for Donut Chart
    const segmentChartData: { key: SegmentKey; name: string; value: number; color: string }[] = (
      Object.keys(counts) as SegmentKey[]
    )
      .map((k) => ({
        key: k,
        name: SEGMENT_LABELS[k],
        value: counts[k] || 0,
        color: SEGMENT_COLORS[k] || '#8884d8',
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);

    // Actionable 1: Top VIP Champions
    const vipList = customers
      .filter((c) => {
        const m = segmentData.byCustomerId.get(c.id);
        return m?.segments.includes('vip') || m?.segments.includes('loyal');
      })
      .map((c) => {
        const m = segmentData.byCustomerId.get(c.id);
        return {
          customer: c,
          metrics: m,
          spent: Number((c as any).computedTotalSpent) || m?.observedSpend || 0,
        };
      })
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);

    // Actionable 2: At-Risk & Lapsed Buyers
    const atRiskList = customers
      .filter((c) => {
        const m = segmentData.byCustomerId.get(c.id);
        return m?.segments.includes('at-risk') || m?.segments.includes('lapsed');
      })
      .map((c) => {
        const m = segmentData.byCustomerId.get(c.id);
        return {
          customer: c,
          metrics: m,
          daysInactive: m?.daysSinceLastPurchase ?? 30,
        };
      })
      .sort((a, b) => b.daysInactive - a.daysInactive)
      .slice(0, 5);

    // Actionable 3: Debt / Owing Customers
    const owingList = customers
      .filter((c) => {
        const m = segmentData.byCustomerId.get(c.id);
        return (m?.outstanding || 0) > 0;
      })
      .map((c) => {
        const m = segmentData.byCustomerId.get(c.id);
        return {
          customer: c,
          debt: m?.outstanding || 0,
        };
      })
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 5);

    const top3DebtSum = owingList.slice(0, 3).reduce((sum, item) => sum + item.debt, 0);
    const debtConcentrationRate = totalDebt > 0 ? Math.round((top3DebtSum / totalDebt) * 100) : 0;

    return {
      totalCustomers,
      activeBuyersCount,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      avgSpendPerCustomer,
      repeatBuyersCount,
      retentionRate,
      avgRepurchaseDays,
      totalUniqueBuyersWithOrders,
      secondOrderBuyers,
      thirdOrderBuyers,
      secondOrderRate,
      thirdOrderRate,
      paymentList,
      vipAndLoyalCount,
      totalDebt,
      owingCount: counts.owing || 0,
      debtConcentrationRate,
      topSpenders,
      customerFlow,
      segmentChartData,
      vipList,
      atRiskList,
      owingList,
    };
  }, [customers, receipts, segmentData, analyticsPeriod]);

  // WhatsApp quick handlers
  const handleSendWhatsApp = (phone: string | undefined, message: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 mb-6">
      {/* Header Controls: Time Period Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/60 p-4 rounded-xl border">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Customer Analytics & Insights</h2>
          <p className="text-xs text-muted-foreground">
            Deep dive into customer spending, retention trends, segment distribution, and high-value buyers.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs">
          <span className="text-[11px] font-semibold text-muted-foreground px-2">Period:</span>
          {[
            { id: '30d', label: '30 Days' },
            { id: '90d', label: '90 Days' },
            { id: '6m', label: '6 Months' },
            { id: '1y', label: '1 Year' },
            { id: 'all', label: 'All Time' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setAnalyticsPeriod(p.id as AnalyticsPeriod)}
              className={cn(
                'px-3 py-1.5 rounded-md font-medium transition-all',
                analyticsPeriod === p.id
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 6 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-card/50 backdrop-blur-sm border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Customers</p>
            <p className="text-2xl font-bold mt-1">{analyticsData.totalCustomers.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {analyticsData.activeBuyersCount.toLocaleString()} active in period
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Customer Revenue</p>
            <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400 truncate">
              {currencySymbol}
              {analyticsData.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {analyticsData.totalOrders.toLocaleString()} orders placed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Avg Customer Value</p>
            <p className="text-xl font-bold mt-1 text-blue-600 dark:text-blue-400 truncate">
              {currencySymbol}
              {analyticsData.avgSpendPerCustomer.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ~{currencySymbol}
              {analyticsData.avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} avg basket
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Retention Rate</p>
            <p className="text-xl font-bold mt-1 text-teal-600 dark:text-teal-400 truncate">
              {analyticsData.retentionRate.toFixed(1)}%
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
              {analyticsData.repeatBuyersCount} repeat • ~{analyticsData.avgRepurchaseDays}d cycle
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">VIP & Loyal</p>
            <p className="text-2xl font-bold mt-1 text-amber-500">{analyticsData.vipAndLoyalCount}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">High-frequency accounts</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Outstanding Credit</p>
            <p className="text-xl font-bold mt-1 text-rose-500 truncate">
              {currencySymbol}
              {analyticsData.totalDebt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {analyticsData.owingCount} owing • Top 3 hold {analyticsData.debtConcentrationRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Activity Flow Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Customer Spending & Activity Flow</span>
              <Badge variant="outline" className="text-xs font-normal">
                Sales & Volume
              </Badge>
            </CardTitle>
            <CardDescription>Orders placed and revenue flow across selected period</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.customerFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  formatter={(value: any, name: string) => [
                    name === 'Revenue' ? `${currencySymbol}${Number(value).toLocaleString()}` : value,
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="orders" name="Orders Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Spending Customers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Top Spending Customers</span>
              <Badge variant="outline" className="text-xs font-normal">
                By Spend
              </Badge>
            </CardTitle>
            <CardDescription>Highest-contributing customer accounts</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {analyticsData.topSpenders.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={analyticsData.topSpenders}
                  margin={{ top: 10, right: 20, left: 30, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    type="number"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `${currencySymbol}${Number(val).toLocaleString()}`}
                  />
                  <YAxis dataKey="name" type="category" fontSize={11} width={100} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '8px' }}
                    formatter={(val: any) => [`${currencySymbol}${Number(val).toLocaleString()}`, 'Total Spent']}
                  />
                  <Bar dataKey="spent" name="Total Spent" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No customer purchase data recorded for this time period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Segments Portfolio Distribution */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Customer Portfolio by Segment</CardTitle>
            <CardDescription>
              Distribution of customers across loyalty, activity, and recency tiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsData.segmentChartData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData.segmentChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {analyticsData.segmentChartData.map((entry) => (
                          <Cell key={`cell-${entry.key}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(val: any) => `${val} customers`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2">
                  {analyticsData.segmentChartData.map((seg) => {
                    const pct =
                      analyticsData.totalCustomers > 0
                        ? ((seg.value / analyticsData.totalCustomers) * 100).toFixed(1)
                        : '0';
                    return (
                      <div key={seg.key} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40 border">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span className="font-medium truncate max-w-[160px]">{seg.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold">{seg.value.toLocaleString()}</span>
                          <span className="text-muted-foreground ml-2">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">No segment data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Behavioral Deep-Dive: Retention Funnel & Payment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Retention Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Customer Repurchase Funnel
              </span>
              <Badge variant="outline" className="text-xs">
                ~{analyticsData.avgRepurchaseDays}d cycle
              </Badge>
            </CardTitle>
            <CardDescription>
              Conversion progression from initial purchase to repeat and champion patron
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span>1st Order (All Unique Buyers)</span>
                <span>{analyticsData.totalUniqueBuyersWithOrders} buyers (100%)</span>
              </div>
              <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: '100%' }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1">
                  2nd Order (Repeat Buyers)
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({analyticsData.secondOrderRate.toFixed(1)}% conversion)
                  </span>
                </span>
                <span>{analyticsData.secondOrderBuyers} buyers</span>
              </div>
              <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, analyticsData.secondOrderRate)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1">
                  3rd+ Order (Loyal Champions)
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({analyticsData.thirdOrderRate.toFixed(1)}% retention)
                  </span>
                </span>
                <span>{analyticsData.thirdOrderBuyers} buyers</span>
              </div>
              <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      analyticsData.totalUniqueBuyersWithOrders > 0
                        ? (analyticsData.thirdOrderBuyers / analyticsData.totalUniqueBuyersWithOrders) * 100
                        : 0
                    )}%`,
                  }}
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground pt-1">
              💡 Customers return on average every <strong>{analyticsData.avgRepurchaseDays} days</strong>. Send
              re-engagement reminders when a patron reaches day {Math.round(analyticsData.avgRepurchaseDays * 1.5)}.
            </p>
          </CardContent>
        </Card>

        {/* Payment Preferences */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Payment Method Split
              </span>
              <Badge variant="outline" className="text-xs">
                {analyticsData.totalOrders} transactions
              </Badge>
            </CardTitle>
            <CardDescription>How customers preferred to pay during this period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {analyticsData.paymentList.length > 0 ? (
              analyticsData.paymentList.map((p) => {
                const sharePct =
                  analyticsData.totalRevenue > 0
                    ? ((p.total / analyticsData.totalRevenue) * 100).toFixed(1)
                    : '0';
                return (
                  <div key={p.label} className="p-2.5 rounded-lg border bg-muted/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="font-semibold">{p.label}</span>
                        <span className="text-[11px] text-muted-foreground">({p.count} orders)</span>
                      </div>
                      <div className="text-right font-semibold">
                        <span>
                          {currencySymbol}
                          {p.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-muted-foreground font-normal ml-1.5">({sharePct}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${sharePct}%`, backgroundColor: p.color }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">No payment data recorded in period</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actionable Intelligence Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. VIP Champions */}
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <span>⚡</span> Top VIP Champions
            </CardTitle>
            <CardDescription>High-frequency & high-spend patrons</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {analyticsData.vipList.length > 0 ? (
              analyticsData.vipList.map(({ customer, metrics, spent }) => (
                <div
                  key={customer.id}
                  className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs"
                >
                  <div className="truncate max-w-[170px]">
                    <Link
                      href={`/customers/details?id=${customer.id}`}
                      className="font-semibold hover:underline flex items-center gap-1 truncate"
                    >
                      {customer.name || 'Unnamed'}
                      <ArrowUpRight className="h-3 w-3 opacity-60 shrink-0" />
                    </Link>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {metrics?.orders || 0} orders • {customer.loyaltyPoints || 0} pts
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {currencySymbol}
                      {spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Keep recording customer sales to see your VIP champions 🎉
              </p>
            )}
          </CardContent>
        </Card>

        {/* 2. At-Risk & Lapsed Buyers */}
        <Card className="border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <span>💤</span> At-Risk & Lapsed Buyers
            </CardTitle>
            <CardDescription>Quiet accounts needing re-engagement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {analyticsData.atRiskList.length > 0 ? (
              analyticsData.atRiskList.map(({ customer, metrics, daysInactive }) => (
                <div
                  key={customer.id}
                  className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs"
                >
                  <div className="truncate max-w-[160px]">
                    <p className="font-semibold truncate">{customer.name || 'Unnamed'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {daysInactive}d inactive • ~{currencySymbol}
                      {(metrics?.ownBasket || 0).toLocaleString()} basket
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {customer.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px] gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 border-blue-500/30"
                        onClick={() =>
                          handleSendWhatsApp(
                            customer.phone,
                            `Hello ${customer.name || 'there'}, we noticed it has been a while since your last visit to ${businessName}! We have exciting restocks and would love to welcome you back.`
                          )
                        }
                      >
                        <MessageSquare className="h-3 w-3" />
                        Win Back
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No lapsed or at-risk buyers detected 👍
              </p>
            )}
          </CardContent>
        </Card>

        {/* 3. Outstanding Debt / Recovery */}
        <Card className="border-rose-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <span>⚠️</span> Credit Risk & Owing Balances
              </CardTitle>
              {analyticsData.debtConcentrationRate > 0 && (
                <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-600 font-medium">
                  Top 3 hold {analyticsData.debtConcentrationRate}% risk
                </Badge>
              )}
            </div>
            <CardDescription>Accounts with pending / unpaid debt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {analyticsData.owingList.length > 0 ? (
              analyticsData.owingList.map(({ customer, debt }) => (
                <div
                  key={customer.id}
                  className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs"
                >
                  <div className="truncate max-w-[150px]">
                    <p className="font-semibold truncate">{customer.name || 'Unnamed'}</p>
                    <p className="text-[11px] text-rose-600/80 font-medium">
                      Owes: {currencySymbol}
                      {debt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {customer.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px] gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30"
                        onClick={() =>
                          handleSendWhatsApp(
                            customer.phone,
                            `Hello ${customer.name || 'there'}, gentle reminder regarding your outstanding balance of ${currencySymbol}${debt.toLocaleString()} with ${businessName}. Please let us know if you need any assistance.`
                          )
                        }
                      >
                        <MessageSquare className="h-3 w-3" />
                        Remind
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                All customer accounts are settled! Zero outstanding debt 👏
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
