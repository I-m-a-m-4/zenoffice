'use client';

import * as React from 'react';
import { usePOS } from '@/context/pos-context';
import { useBranch } from '@/context/branch-context';
import type { Receipt, Customer } from '@/types';
import PageTitle from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, Package, ShoppingCart, Users, Download, Loader2, BarChart, Bot, Layers, TrendingUp, Coins, Sparkles, AlertCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import SalesOverTimeChart from '@/components/reports/sales-over-time-chart';
import TopItemsPanel from '@/components/reports/top-items-panel';
import { DateRangePicker } from '@/components/reports/date-range-picker';
import { DateRange } from 'react-day-picker';
import { subDays, isSameDay } from 'date-fns';
import TopCustomersList from '@/components/reports/top-customers-list';
import { safeToDate, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import Link from 'next/link';
import ProfitLossChart from '@/components/reports/profit-loss-chart';
import OverviewChart from '@/components/dashboard/overview-chart';
import CustomerAnalytics from '@/components/reports/customer-analytics';
import DailySalesItemsTable from '@/components/reports/daily-sales-items-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Printer, Image as ImageIcon, BarChart2, CheckCircle } from 'lucide-react';

import FeatureGate from '@/components/shared/feature-gate';
import AbcAnalysis from '@/components/reports/abc-analysis';
import PaymentMethodDistribution from '@/components/reports/payment-method-analysis';
import DeadStockAnalysis from '@/components/reports/dead-stock-analysis';
import HourlySalesHeatmap from '@/components/reports/hourly-sales-heatmap';
import BasketAnalysis from '@/components/reports/basket-analysis';
import ProfitLossStatement from '@/components/reports/profit-loss-statement';
import RevenueForecastCard from '@/components/reports/revenue-forecast-card';
import InventoryDepletionCard from '@/components/reports/inventory-depletion-card';
import BusinessRatingPanel from '@/components/reports/business-rating-panel';
import StaffPerformance from '@/components/reports/staff-performance';
import CategoryPerformance from '@/components/reports/category-performance';
import MarginLeaksPanel from '@/components/reports/margin-leaks';
import {
    aggregateCategories,
    aggregateItems,
    aggregateStaff,
    periodDelta,
    previousWindow,
    summarisePeriod,
    type KpiDelta,
} from '@/lib/reports-aggregates';
import { downloadCsv } from '@/lib/csv';
import { trackFeature } from '@/lib/product-telemetry';
import { useI18n } from '@/context/i18n-context';

/**
 * A KPI figure with, where we have one, its comparison against the equivalent
 * previous period.
 *
 * The chip is the whole point of the comparison: a bare number tells an owner what
 * happened but not whether it is good. Note what it refuses to draw — a percentage
 * against a zero baseline (undefined, so it reads "new" instead), and any figure at
 * all when there is no previous period to compare with (`unknown` renders nothing
 * rather than a misleading 0%).
 */
function DeltaChip({ delta }: { delta: KpiDelta | null | undefined }) {
    const { t } = useI18n();
    if (!delta || delta.direction === 'unknown') return null;

    if (delta.direction === 'new') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3 w-3" />
                {t('reports.deltaNewThisPeriod')}
            </span>
        );
    }
    if (delta.direction === 'flat') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Minus className="h-3 w-3" />
                {t('reports.deltaFlat')}
            </span>
        );
    }
    const up = delta.direction === 'up';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium tabular-nums',
                up ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
            )}
        >
            {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {t('reports.deltaVsPrevious', { pct: Math.abs(delta.deltaPct ?? 0).toFixed(1) })}
        </span>
    );
}

function ReportStatCard({ title, value, icon: Icon, description, delta }: { title: string, value: string | number, icon: React.ElementType, description?: string, delta?: KpiDelta | null }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <DeltaChip delta={delta} />
                {description && <p className="text-[10px] text-muted-foreground mt-1">{description}</p>}
            </CardContent>
        </Card>
    );
}

/*
 * Removed here: `PlaceholderChart`, `ReportsPlaceholder` and `COMPUTE_STEPS`.
 *
 * All three were dead. `ReportsPlaceholder` was declared and never rendered;
 * `PlaceholderChart` was only ever used by it; `COMPUTE_STEPS` fed the
 * `AutoComputingBanner` removed below. They were left behind when the fake
 * 400-competitor leaderboard came out (see the header doc on
 * `business-rating-panel.tsx`).
 */

/*
 * Removed here: `AutoComputingBanner`, 153 lines of it.
 *
 * It faked a 3.2-second progress bar through eight invented steps
 * ("Benchmarking against global peers…"), then counted a score up and threw
 * twelve random sparkles at the screen. It was declared and **never rendered** —
 * another leftover from the removed leaderboard. The real score arrives on the
 * Business Rating tab, computed rather than performed.
 */



export default function ReportsDashboard() {
    const { currencySymbol, business, products, customers, isLoading: isPosLoading, receipts: allReceipts, stats, fetchReceiptsInRange, users } = usePOS();
    const { activeBranchId } = useBranch();
    const { t } = useI18n();
    const dashboardRef = React.useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const [reportBatchReceipts, setReportBatchReceipts] = React.useState<Receipt[]>([]);
    const [isFetchingBatch, setIsFetchingBatch] = React.useState(false);

    const [date, setDate] = React.useState<DateRange | undefined>({
        from: subDays(new Date(), 365), // Fallback initial
        to: new Date(),
    });

    // Auto-adjust to Business Lifetime once loaded
    const businessCreatedAtTime = business?.createdAt ? safeToDate(business.createdAt).getTime() : 0;
    React.useEffect(() => {
        if (businessCreatedAtTime) {
            const inception = new Date(businessCreatedAtTime);
            setDate(prev => {
                // Prevent infinite state updates if they already match
                if (prev?.from && prev.from.getTime() === inception.getTime()) {
                    return prev;
                }
                return { from: inception, to: new Date() };
            });
        }
    }, [businessCreatedAtTime]);

    const hasLifetimeAccess = business?.accessLevel === 'lifetime';

    const receipts = React.useMemo(() => {
        if (!allReceipts) return [];

        const fromDate = date?.from;
        const toDate = date?.to;

        return allReceipts.filter(receipt => {
            if (!receipt.createdAt) return false;
            const createdAt = safeToDate(receipt.createdAt);

            if (fromDate && createdAt < fromDate) return false;
            if (toDate) {
                const toDateEnd = new Date(toDate);
                toDateEnd.setHours(23, 59, 59, 999);
                if (createdAt > toDateEnd) return false;
            }
            return true;
        });
    }, [allReceipts, date]);

    const isNative = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
    const isBaseLoading = isNative
        ? (isPosLoading && (!allReceipts || allReceipts.length === 0))
        : isPosLoading;

    const hasDataToDisplay = (reportBatchReceipts && reportBatchReceipts.length > 0) || (receipts && receipts.length > 0);
    const showBlankScreenSpinner = (isBaseLoading || isFetchingBatch) && !hasDataToDisplay;

    const reportData = React.useMemo(() => {
        const targetReceipts = reportBatchReceipts.length > 0 ? reportBatchReceipts : (receipts || []);
        if (!targetReceipts || !products || !customers) return { totalRevenue: 0, totalSales: 0, averageOrderValue: 0, inventoryValue: 0, totalCustomers: 0, buyersInRange: 0, totalProductsSold: 0, totalServicesSold: 0, totalItemsSold: 0, totalProductRevenue: 0, totalServiceRevenue: 0, uniqueProductsSold: 0, catalogSize: 0, dailyAverageSales: 0, dailyAverageRevenue: 0, totalProfit: 0, totalCost: 0 };

        const totalRevenue = targetReceipts.reduce((sum, r) => sum + r.total, 0);
        const totalSales = targetReceipts.length;
        const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
        const inventoryValue = products.filter(p => p.categoryType !== 'service').reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0);

        let totalProductsSold = 0;
        let totalServicesSold = 0;
        let totalProductRevenue = 0;
        let totalServiceRevenue = 0;
        const uniqueProductIds = new Set<string>();
        const uniqueCustomerIds = new Set<string>();

        targetReceipts.forEach(r => {
            if (r.customer?.id) uniqueCustomerIds.add(r.customer.id);

            let receiptProductSum = 0;
            let receiptServiceSum = 0;

            r.items?.forEach(i => {
                uniqueProductIds.add(i.productId);
                const product = products.find(p => p.id === i.productId);
                const itemRevenue = (Number(i.price) || 0) * (Number(i.quantity) || 0);

                if (product?.categoryType === 'service') {
                    totalServicesSold += i.quantity;
                    receiptServiceSum += itemRevenue;
                } else {
                    totalProductsSold += i.quantity;
                    receiptProductSum += itemRevenue;
                }
            });

            const receiptTotalRaw = receiptProductSum + receiptServiceSum;
            const actualReceiptRevenue = Number(r.total) || 0;

            if (receiptTotalRaw > 0) {
                const pRatio = receiptProductSum / receiptTotalRaw;
                const sRatio = receiptServiceSum / receiptTotalRaw;
                totalProductRevenue += (pRatio * actualReceiptRevenue);
                totalServiceRevenue += (sRatio * actualReceiptRevenue);
            } else {
                totalProductRevenue += actualReceiptRevenue;
            }
        });

        const activeDays = new Set(targetReceipts.map(r => {
            const d = safeToDate(r.createdAt);
            return d.toISOString().split('T')[0];
        })).size || 1;

        const totalCost = targetReceipts.reduce((sum, r) => sum + (r.totalCost ?? r.items?.reduce((sumCost, item) => sumCost + ((item.costPrice || 0) * (item.quantity || 0)), 0) ?? 0), 0);
        const totalProfit = targetReceipts.reduce((sum, r) => sum + (r.profit ?? (r.total - (r.totalCost ?? 0))), 0);

        return {
            totalRevenue,
            totalSales,
            averageOrderValue,
            inventoryValue,
            /*
             * The size of the customer book — everybody on file, not everybody who
             * bought in this window.
             *
             * This used to read `uniqueCustomerIds.size || <the total below>`, so a
             * card titled "Customers" showed the number of distinct people who
             * appeared on a receipt inside the report range, and only fell back to
             * the real total when no receipt in range had a customer attached. One
             * card meant two different things depending on the data, and a shop with
             * 4,000 customers on file was shown the ~1,000 of them who happened to
             * buy that month. Both figures are worth knowing, so both are returned
             * and the card shows the total with the in-range count underneath.
             *
             * `stats.totalCustomers` is a `getAggregateFromServer` count over the
             * whole collection (pos-context.tsx:718), so it stays right even when
             * the locally synced array is short — which is exactly the case this
             * card has to survive. `Math.max` against `customers.length` covers the
             * other direction: a customer created moments ago is in the array
             * before the aggregate is recounted.
             *
             * With a single branch selected the aggregate is the wrong number —
             * it counts the whole business — so the branch-filtered array is the
             * only honest answer there.
             */
            totalCustomers: activeBranchId && activeBranchId !== 'all'
                ? customers.length
                : Math.max(stats?.totalCustomers || 0, customers.length),
            buyersInRange: uniqueCustomerIds.size,
            totalProductsSold,
            totalServicesSold,
            totalItemsSold: totalProductsSold + totalServicesSold,
            totalProductRevenue,
            totalServiceRevenue,
            uniqueProductsSold: uniqueProductIds.size,
            catalogSize: activeBranchId && activeBranchId !== 'all' ? products.length : Math.max(stats?.totalProducts || 0, products.length),
            dailyAverageSales: totalSales / activeDays,
            dailyAverageRevenue: totalRevenue / activeDays,
            totalProfit,
            totalCost
        }

    }, [reportBatchReceipts, receipts, products, customers, stats, activeBranchId]);

    // Surgical Analytics
    const { fetchMonthlyAnalytics } = usePOS();
    /*
     * `rangeStats` and the effect that filled it are gone. It called
     * `fetchDetailedAnalytics` — a Firestore aggregate query — on every date-range
     * change and **nothing ever rendered the result**. So it was not merely dead
     * code: it was a read the owner paid for on every range change, for a figure
     * that never reached the screen.
     */
    const [monthlyStats, setMonthlyStats] = React.useState<{ month: string, sales: number }[] | null>(null);
    const [activeTab, setActiveTab] = React.useState<string>('analytics');

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tab = params.get('tab');
            if (tab && (tab === 'analytics' || tab === 'daily-sales' || tab === 'profit-loss' || tab === 'business-rating')) {
                setActiveTab(tab);
            }
        }
    }, []);

    const dateFromTime = date?.from ? safeToDate(date.from).getTime() : 0;
    const dateToTime = date?.to ? safeToDate(date.to).getTime() : 0;

    React.useEffect(() => {
        if (dateFromTime && dateToTime) {
            // Clear stale data immediately so old branch data doesn't flash while loading
            setReportBatchReceipts([]);
            const fetchBatch = async () => {
                setIsFetchingBatch(true);
                const timeout = setTimeout(() => {
                    if (isFetchingBatch) {
                        toast({
                            title: t('reports.loadingDataTitle'),
                            description: t('reports.loadingDataBody'),
                            variant: 'default'
                        });
                    }
                }, 4000);

                try {
                    const res = await fetchReceiptsInRange(new Date(dateFromTime), new Date(dateToTime));
                    setReportBatchReceipts(res);
                } finally {
                    clearTimeout(timeout);
                    setIsFetchingBatch(false);
                }
            };
            fetchBatch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateFromTime, dateToTime, fetchReceiptsInRange]);

    /**
     * The equivalent window immediately before the selected one, so every headline
     * figure can say whether it went up or down.
     *
     * **Why this is gated rather than always fetched.** Firestore cost is a standing
     * constraint here, and this is a second range query on top of the one above. The
     * default range runs from business inception to today, so its previous period
     * sits entirely before the shop existed and cannot contain a single receipt —
     * fetching it would double the page's read cost to be told "nothing". So the
     * common case (page load, untouched range) costs nothing extra, and the query
     * only fires once the owner narrows the range to something with a real past.
     */
    const [previousReceipts, setPreviousReceipts] = React.useState<Receipt[] | null>(null);

    React.useEffect(() => {
        if (!dateFromTime || !dateToTime) {
            setPreviousReceipts(null);
            return;
        }
        const prev = previousWindow(new Date(dateFromTime), new Date(dateToTime));
        if (businessCreatedAtTime && prev.to.getTime() < businessCreatedAtTime) {
            setPreviousReceipts(null);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const res = await fetchReceiptsInRange(prev.from, prev.to);
                if (!cancelled) setPreviousReceipts(res);
            } catch {
                // A failed comparison must never break the page it decorates.
                if (!cancelled) setPreviousReceipts(null);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateFromTime, dateToTime, businessCreatedAtTime, fetchReceiptsInRange]);

    React.useEffect(() => {
        const fetchHistory = async () => {
            const res = await fetchMonthlyAnalytics(12);
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            const dataMap: Record<string, number> = {};
            res.forEach(m => {
                let label = m.month;
                if (label.includes('-')) {
                    const monthIdx = parseInt(label.split('-')[1]) - 1;
                    label = monthNames[monthIdx] || label;
                }
                dataMap[label] = m.revenue;
            });

            const paddedStats = monthNames.map(m => ({
                month: m,
                sales: dataMap[m] || 0,
                totalSales: dataMap[m] || 0
            }));

            setMonthlyStats(paddedStats);
        }

        fetchHistory();
    }, [fetchMonthlyAnalytics]);



    const isTodayOnlyRange = React.useMemo(() => {
        if (!date?.from) return false;
        const today = new Date();
        const fromIsToday = isSameDay(date.from, today);
        const toIsToday = !date.to || isSameDay(date.to, today);
        return fromIsToday && toIsToday;
    }, [date]);

    const finalReportData = React.useMemo(() => {
        if (!reportData) return null;
        return reportData;
    }, [reportData]);

    const handleDownloadImage = async () => {
        const element = dashboardRef.current;
        if (!element) return;
        toast({ title: t('reports.generatingTitle'), description: t('reports.generatingBody') });
        try {
            const canvas = await html2canvas(element, {
                scale: 4,
                ignoreElements: (el) => el.classList.contains('no-capture')
            });
            const data = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = data;
            link.download = `zeneva-report-${new Date().toISOString().split('T')[0]}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // The body, and both failure strings below, are dashboard's: same widget, same words.
            toast({ variant: 'success', title: t('reports.downloadedTitle'), description: t('dashboard.downloadedDescription') });
        } catch (err) {
            toast({ variant: 'destructive', title: t('dashboard.downloadFailed'), description: t('dashboard.downloadFailedDescription') });
        }
    };

    const deepReceipts = reportBatchReceipts.length > 0 ? reportBatchReceipts : receipts;

    /**
     * The widest receipt set available, for the two panels whose conclusions get
     * *worse* the less history they see.
     *
     * `DeadStockAnalysis` says "no sale in 60+ days" and `DailySalesItemsTable`
     * answers "what sold on this date". Both were being handed `allReceipts` — the
     * listener's most recent **200** — while every other panel on the page got the
     * 5,000-row range query. A shop that turns over 200 receipts in a fortnight
     * therefore had healthy sellers reported as dead stock, and any day older than
     * its last 200 sales read as empty.
     *
     * The union rather than a straight swap: `deepReceipts` follows the page's date
     * range, so narrowing the range on the Analytics tab would otherwise hide days
     * from the Daily Sales tab, which has its own independent date picker and does
     * not show the range control at all.
     */
    const widestReceipts = React.useMemo(() => {
        const seen = new Set<string>();
        const merged: typeof deepReceipts = [];
        for (const r of [...(deepReceipts || []), ...(allReceipts || [])]) {
            if (!r?.id || seen.has(r.id)) continue;
            seen.add(r.id);
            merged.push(r);
        }
        return merged;
    }, [deepReceipts, allReceipts]);

    /**
     * Headline figures against the previous period. `null` when there is no previous
     * period to compare with, which the chips render as *nothing* rather than 0%.
     */
    const comparison = React.useMemo(() => {
        if (!previousReceipts) return null;
        const current = summarisePeriod(deepReceipts, products || []);
        const prior = summarisePeriod(previousReceipts, products || []);
        return {
            revenue: periodDelta(current.revenue, prior.revenue),
            sales: periodDelta(current.sales, prior.sales),
            avgBasket: periodDelta(current.avgBasket, prior.avgBasket),
            units: periodDelta(current.units, prior.units),
            buyers: periodDelta(current.buyers, prior.buyers),
            // Profit is only comparable when both periods could be costed at all.
            profit:
                current.profit !== null && prior.profit !== null
                    ? periodDelta(current.profit, prior.profit)
                    : null,
        };
    }, [previousReceipts, deepReceipts, products]);

    /**
     * Export the Analytics tab as data rather than as a picture.
     *
     * The tab carried thirteen KPIs and a dozen charts and could only be saved as a
     * screenshot, which is unusable for anyone who wants to check a figure or build
     * on it. One file, four sections, all from the same aggregates the panels render
     * so the numbers cannot disagree with the screen.
     */
    const handleExportAnalyticsCsv = React.useCallback(() => {
        const rows: (string | number)[][] = [];
        const period = `${date?.from ? safeToDate(date.from).toISOString().slice(0, 10) : '?'} to ${date?.to ? safeToDate(date.to).toISOString().slice(0, 10) : '?'}`;

        rows.push(['Zeneva analytics export']);
        rows.push(['Business', business?.name ?? '']);
        rows.push(['Period', period]);
        rows.push(['Generated', new Date().toISOString()]);
        rows.push(['Receipts in scope', deepReceipts.length]);
        rows.push([]);

        rows.push(['Headline figures']);
        rows.push(['Metric', `Value (${currencySymbol || 'currency'} where money)`, 'Previous period', 'Change %']);
        const kpi = (label: string, value: number, delta?: KpiDelta | null) => {
            rows.push([
                label,
                Math.round(value),
                delta && delta.previous !== null ? Math.round(delta.previous) : '',
                delta?.deltaPct !== null && delta?.deltaPct !== undefined ? delta.deltaPct.toFixed(1) : '',
            ]);
        };
        kpi('Revenue', finalReportData?.totalRevenue ?? 0, comparison?.revenue);
        kpi('Net cost', finalReportData?.totalCost ?? 0);
        kpi('Net profit', finalReportData?.totalProfit ?? 0, comparison?.profit);
        kpi('Sales', finalReportData?.totalSales ?? 0, comparison?.sales);
        kpi('Average order value', finalReportData?.averageOrderValue ?? 0, comparison?.avgBasket);
        kpi('Units sold', finalReportData?.totalItemsSold ?? 0, comparison?.units);
        kpi('Product revenue', finalReportData?.totalProductRevenue ?? 0);
        kpi('Service revenue', finalReportData?.totalServiceRevenue ?? 0);
        rows.push([]);

        const { items } = aggregateItems(deepReceipts, products || []);
        rows.push(['Items sold']);
        rows.push(['Item', 'SKU', 'Category', 'Kind', 'Units', 'Line revenue', 'Cost', 'Profit', 'Margin %', 'Share of revenue %']);
        for (const s of [...items].sort((a, b) => b.revenue - a.revenue)) {
            rows.push([
                s.name,
                s.sku ?? '',
                s.category,
                s.isService ? 'Service' : 'Product',
                s.units,
                Math.round(s.revenue),
                s.cost === null ? '' : Math.round(s.cost),
                s.profit === null ? '' : Math.round(s.profit),
                s.marginPct === null ? '' : s.marginPct.toFixed(1),
                (s.revenueShare * 100).toFixed(2),
            ]);
        }
        rows.push([]);

        rows.push(['Categories']);
        rows.push(['Category', 'Items', 'Units', 'Line revenue', 'Profit', 'Margin %', 'Share of revenue %']);
        for (const c of aggregateCategories(items)) {
            rows.push([
                c.category,
                c.items,
                c.units,
                Math.round(c.revenue),
                c.profit === null ? '' : Math.round(c.profit),
                c.marginPct === null ? '' : c.marginPct.toFixed(1),
                (c.revenueShare * 100).toFixed(2),
            ]);
        }
        rows.push([]);

        rows.push(['Team']);
        rows.push(['Member', 'Role', 'Sales', 'Receipt revenue', 'Average basket', 'Items per sale', 'Discounted sales', 'Discount total', 'Price overrides']);
        for (const s of aggregateStaff(deepReceipts, users || [])) {
            rows.push([
                s.name,
                s.role ?? '',
                s.sales,
                Math.round(s.revenue),
                Math.round(s.avgBasket),
                s.itemsPerSale.toFixed(1),
                s.discountedSales,
                Math.round(s.discountTotal),
                s.overriddenLines,
            ]);
        }
        rows.push([]);
        rows.push(['Note', 'Item and category revenue is the sum of price x quantity, so it excludes tax and is gross of receipt-level discounts. Headline revenue and team revenue are receipt totals. Blank cost, profit or margin means no cost price was recorded, which is unknown rather than zero.']);

        downloadCsv(`zeneva-analytics-${new Date().toISOString().slice(0, 10)}.csv`, rows);
        trackFeature('reports_exported');
        toast({ variant: 'success', title: t('reports.exportedTitle'), description: t('reports.exportedBody') });
    }, [deepReceipts, products, users, finalReportData, comparison, currencySymbol, business, date, toast, t]);

    return (
        <div ref={dashboardRef} className="flex flex-col gap-6 bg-background p-1">
            <PageTitle title={t('reports.title')} subtitle={t('reports.subtitle')} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-grow">
                <div className="flex flex-wrap items-center justify-between gap-4 no-capture border-b pb-4 mb-6">
                    <TabsList className="flex flex-col md:grid md:grid-cols-4 w-full md:w-[650px] h-auto gap-1">
                        <TabsTrigger value="analytics" className="text-sm font-semibold w-full">{t('reports.tabAnalytics')}</TabsTrigger>
                        <TabsTrigger value="profit-loss" className="text-sm font-semibold w-full">{t('reports.tabProfitLoss')}</TabsTrigger>
                        <TabsTrigger value="daily-sales" className="text-sm font-semibold w-full">{t('reports.tabDailySales')}</TabsTrigger>
                        <TabsTrigger value="business-rating" className="text-sm font-semibold w-full">{t('reports.tabBusinessRating')}</TabsTrigger>
                    </TabsList>
                    <div className="flex flex-wrap items-center gap-4">
                        {(activeTab === 'analytics' || activeTab === 'profit-loss') && (
                            <>
                                <DateRangePicker date={date} onDateChange={setDate} />
                                {isFetchingBatch && (
                                    <div className="flex items-center gap-2 bg-secondary/50 backdrop-blur-sm border rounded-lg py-1.5 px-3 text-xs font-medium text-muted-foreground animate-in fade-in zoom-in-95 duration-200">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                        <span>{t('reports.updatingMetrics')}</span>
                                    </div>
                                )}
                            </>
                        )}
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9">
                                    <Download className="mr-2 h-4 w-4" />{t('reports.exportReport')}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleExportAnalyticsCsv}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    {t('reports.exportCsv')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleDownloadImage}>
                                    <ImageIcon className="h-4 w-4 mr-2" />
                                    {t('reports.exportImage')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.print()}>
                                    <Printer className="h-4 w-4 mr-2" />
                                    {t('reports.exportPdf')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {showBlankScreenSpinner ? (
                    <div className="flex h-64 items-center justify-center animate-pulse">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <span className="text-sm font-medium text-muted-foreground">{t('reports.loadingDashboard')}</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <TabsContent value="analytics" className="space-y-6 mt-0">
                            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                                <ReportStatCard
                                    title={t('reports.kpiRevenue')}
                                    value={`${currencySymbol}${finalReportData?.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}`}
                                    icon={DollarSign}
                                    description={t('reports.kpiRevenueHint')}
                                    delta={comparison?.revenue}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiNetCost')}
                                    value={`${currencySymbol}${finalReportData?.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}`}
                                    icon={FileText}
                                    description={t('reports.kpiNetCostHint')}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiNetProfit')}
                                    value={`${currencySymbol}${finalReportData?.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}`}
                                    icon={Coins}
                                    description={t('reports.kpiNetProfitHint')}
                                    delta={comparison?.profit}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiProductRevenue')}
                                    value={`${currencySymbol}${finalReportData?.totalProductRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}`}
                                    icon={Package}
                                    description={t('reports.kpiProductRevenueHint')}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiServiceRevenue')}
                                    value={`${currencySymbol}${finalReportData?.totalServiceRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}`}
                                    icon={TrendingUp}
                                    description={t('reports.kpiServiceRevenueHint')}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiSales')}
                                    value={finalReportData?.totalSales.toLocaleString() || '0'}
                                    icon={ShoppingCart}
                                    description={t('reports.kpiSalesHint')}
                                    delta={comparison?.sales}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiUniqueProducts')}
                                    value={finalReportData?.uniqueProductsSold?.toLocaleString() || '0'}
                                    icon={Package}
                                    description={t('reports.kpiUniqueProductsHint')}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiUnitsSold')}
                                    value={finalReportData?.totalItemsSold.toLocaleString() || '0'}
                                    icon={Layers}
                                    description={t('reports.kpiUnitsSoldHint')}
                                    delta={comparison?.units}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiDailyVelocity')}
                                    value={finalReportData?.dailyAverageSales?.toFixed(1) || '0'}
                                    icon={TrendingUp}
                                    description={t('reports.kpiDailyVelocityHint')}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiDailyRevenue')}
                                    value={`${currencySymbol}${finalReportData?.dailyAverageRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}`}
                                    icon={DollarSign}
                                    description={t('reports.kpiDailyRevenueHint')}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiCatalogSize')}
                                    value={finalReportData?.catalogSize?.toLocaleString() || '0'}
                                    icon={Package}
                                    description={t('reports.kpiCatalogSizeHint')}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiAvgOrder')}
                                    value={`${currencySymbol}${finalReportData?.averageOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}`}
                                    icon={FileText}
                                    description={t('reports.kpiAvgOrderHint')}
                                    delta={comparison?.avgBasket}
                                />
                                <ReportStatCard
                                    title={t('reports.kpiCustomers')}
                                    value={finalReportData?.totalCustomers.toLocaleString() || '0'}
                                    icon={Users}
                                    description={
                                        finalReportData
                                            ? t('reports.kpiCustomersBought', {
                                                count: finalReportData.buyersInRange,
                                                formatted: finalReportData.buyersInRange.toLocaleString(),
                                            })
                                            : t('reports.kpiCustomersHint')
                                    }
                                />
                            </div>
                            <FeatureGate
                                requiredPlan="pro"
                                currentPlan={business?.plan}
                                hasLifetimeAccess={hasLifetimeAccess}
                                bypass={isTodayOnlyRange}
                                featureName={t('reports.gateVisualName')}
                                featureDescription={t('reports.gateVisualBody')}
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                                    <RevenueForecastCard receipts={deepReceipts} currencySymbol={currencySymbol} />
                                    <InventoryDepletionCard receipts={deepReceipts} products={products || []} />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
                                    <div className="lg:col-span-5">
                                        <OverviewChart receipts={deepReceipts} currencySymbol={currencySymbol} data={monthlyStats || undefined} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                                    <TopItemsPanel receipts={deepReceipts} products={products || []} kind="product" currencySymbol={currencySymbol} />
                                    <TopItemsPanel receipts={deepReceipts} products={products || []} kind="service" currencySymbol={currencySymbol} />
                                </div>

                                {/*
                                    Where the money comes from and where it leaks out.
                                    Category money and per-person till activity had no home
                                    on this page at all; margin leaks is the only panel that
                                    reads receipt-line `priceOverridden`/`listPrice`, which is
                                    captured at the moment of sale and cannot be recomputed
                                    from a product's current price.
                                */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                                    <CategoryPerformance
                                        receipts={deepReceipts}
                                        previousReceipts={previousReceipts}
                                        products={products || []}
                                        currencySymbol={currencySymbol}
                                    />
                                    <MarginLeaksPanel
                                        receipts={deepReceipts}
                                        products={products || []}
                                        currencySymbol={currencySymbol}
                                    />
                                </div>

                                <div className="mt-6">
                                    <StaffPerformance
                                        receipts={deepReceipts}
                                        users={users || []}
                                        currencySymbol={currencySymbol}
                                    />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
                                    <div className="lg:col-span-3">
                                        <SalesOverTimeChart receipts={deepReceipts} currencySymbol={currencySymbol} data={monthlyStats || undefined} />
                                    </div>
                                    <div className="lg:col-span-2">
                                        <ProfitLossChart receipts={deepReceipts} currencySymbol={currencySymbol} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
                                    <div className="lg:col-span-3">
                                        <PaymentMethodDistribution receipts={deepReceipts} currencySymbol={currencySymbol} />
                                    </div>
                                    <div className="lg:col-span-2">
                                        <TopCustomersList receipts={deepReceipts} currencySymbol={currencySymbol} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 mt-6">
                                    <DeadStockAnalysis products={products || []} receipts={widestReceipts} currencySymbol={currencySymbol} />
                                    <HourlySalesHeatmap receipts={deepReceipts} />
                                    <BasketAnalysis receipts={deepReceipts} />
                                </div>
                                <FeatureGate
                                    requiredPlan="business"
                                    currentPlan={business?.plan}
                                    hasLifetimeAccess={hasLifetimeAccess}
                                    featureName={t('reports.gateCustomerName')}
                                    featureDescription={t('reports.gateCustomerBody')}
                                >
                                    <div className="grid grid-cols-1 gap-6 mt-6">
                                        <CustomerAnalytics
                                            customers={customers || []}
                                            receipts={deepReceipts}
                                            currencySymbol={currencySymbol}
                                            totalBusinessCustomers={finalReportData?.totalCustomers}
                                        />
                                        <AbcAnalysis receipts={deepReceipts} products={products || []} currencySymbol={currencySymbol} />
                                    </div>
                                </FeatureGate>
                            </FeatureGate>
                        </TabsContent>
                        <TabsContent value="profit-loss" className="mt-0">
                            <FeatureGate
                                requiredPlan="business"
                                currentPlan={business?.plan}
                                hasLifetimeAccess={hasLifetimeAccess}
                                bypass={isTodayOnlyRange}
                                featureName={t('reports.gateProfitLossName')}
                                featureDescription={t('reports.gateProfitLossBody')}
                            >
                                <ProfitLossStatement 
                                    receipts={deepReceipts} 
                                    products={products || []} 
                                    currencySymbol={currencySymbol} 
                                />
                            </FeatureGate>
                        </TabsContent>
                        <TabsContent value="daily-sales" className="mt-0">
                            <FeatureGate
                                requiredPlan="pro"
                                currentPlan={business?.plan}
                                hasLifetimeAccess={hasLifetimeAccess}
                                bypass={isTodayOnlyRange}
                                featureName={t('reports.tabDailySales')}
                                featureDescription={t('reports.gateDailySalesBody')}
                            >
                                <DailySalesItemsTable receipts={widestReceipts} products={products || []} currencySymbol={currencySymbol} />
                            </FeatureGate>
                        </TabsContent>
                        <TabsContent value="business-rating" className="mt-0">
                            <BusinessRatingPanel />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
}
