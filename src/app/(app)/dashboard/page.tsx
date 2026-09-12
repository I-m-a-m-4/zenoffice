
'use client';
import *as React from 'react';
import dynamic from 'next/dynamic';
import PageTitle from '@/components/shared/page-title';
import SummaryCard from '@/components/dashboard/summary-card';
import TodaysFocus from '@/components/dashboard/todays-focus';
import {
  DollarSign,
  Package,
  AlertCircle,
  ShoppingCart,
  TrendingUp,
  Activity,
  PackageCheck,
  PackageSearch,
  FileDigit,
  Layers,
  Archive,
  Award,
  PlusCircle,
  Download,
  Globe,
  Bot,
  ArrowRight,
  Users, // for new customers
  ShoppingBag, // for units sold
  TrendingDown,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import type { TopSellingItem, BusinessAnalysisOutput, Receipt } from '@/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { usePOS } from '@/context/pos-context';
import { useBranch } from '@/context/branch-context';
import AddCustomerDialog from '@/components/customers/add-customer-dialog';
import html2canvas from 'html2canvas';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
// New imports for date filtering
import { DateRangePicker } from '@/components/reports/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { isWithinInterval, startOfDay, endOfDay, format, formatDistanceToNow } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CachedImage } from '@/components/shared/cached-image';
import { CurrencyAmount } from '@/components/shared/currency-amount';
import { useI18n } from '@/context/i18n-context';
import { DashboardBodySkeleton } from './skeleton';

const OverviewChart = dynamic(() => import('@/components/dashboard/overview-chart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[350px] lg:col-span-2" />
});

const CategoryPieChart = dynamic(() => import('@/components/dashboard/category-pie-chart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[350px]" />
});

/*
 * The shape lives in `./skeleton.tsx` so this and `loading.tsx` cannot drift.
 * `restricted` mirrors the `view_reports` check below: staff who may not see
 * money get three cards and no charts, which is what actually arrives for them.
 */
function DashboardSkeleton({ restricted }: { restricted: boolean }) {
  return (
    <DashboardBodySkeleton
      cards={restricted ? 3 : 8}
      charts={!restricted}
      className="bg-background p-1 pb-10 sm:pb-1"
    />
  );
}

export default function DashboardPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const dashboardRef = React.useRef<HTMLDivElement>(null);

  const [isAddCustomerOpen, setIsAddCustomerOpen] = React.useState(false);

  const { products, receipts, customers, isLoading: isPosLoading, currencySymbol, business, onlineOrders, stats, fetchReceiptsInRange } = usePOS();
  const { activeBranchId } = useBranch();

  // Date range state, defaults to today
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date())
  });


  const [dashboardBatchReceipts, setDashboardBatchReceipts] = React.useState<Receipt[]>([]);
  const [isFetchingBatch, setIsFetchingBatch] = React.useState(false);

  const isNative = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
  const isLoading = isNative ? (isPosLoading && (!products || products.length === 0)) : isPosLoading; // Primary connection loading only
  const isUpdating = isFetchingBatch; // Secondary background update state

  const dashboardData = React.useMemo(() => {
    const inventoryItems = products || [];
    const allReceipts = dashboardBatchReceipts.length > 0 ? dashboardBatchReceipts : (receipts || []);
    const allCustomers = customers || [];
    const allOnlineOrders = onlineOrders || [];

    // Filter data based on selected date range
    const fromDate = date?.from;
    const toDate = date?.to;

    const filterByDate = (item: { createdAt?: any }) => {
      if (!item.createdAt) return false;
      const itemDate = safeToDate(item.createdAt);
      
      if (isNaN(itemDate.getTime())) return false;

      if (fromDate && !toDate) { // single day selection
        return isWithinInterval(itemDate, { start: startOfDay(fromDate), end: endOfDay(fromDate) });
      }
      if (fromDate && toDate) {
        return isWithinInterval(itemDate, { start: startOfDay(fromDate), end: endOfDay(toDate) });
      }
      return true; // No date filter applied
    };

    const filteredReceipts = allReceipts.filter(filterByDate);
    const filteredOnlineOrders = allOnlineOrders.filter(filterByDate);
    const newCustomers = allCustomers.filter(filterByDate);

    const totalStock = inventoryItems.filter(item => item.categoryType !== 'service').reduce((sum, item) => sum + Math.max(0, item.stock || 0), 0);
    const uniqueSkus = inventoryItems.filter(item => item.categoryType !== 'service').length;
    const lowStockItems = inventoryItems.filter(item => item.categoryType !== 'service' && (item.stock || 0) <= (item.lowStockThreshold || 0)).length;

    const totalSalesValue = filteredReceipts.reduce((sum, receipt) => sum + (receipt.total || 0), 0);
    const totalReceiptsCount = filteredReceipts.length;

    const totalOnlineSalesValue = filteredOnlineOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalOnlineOrdersCount = filteredOnlineOrders.length;

    const totalRevenue = (totalSalesValue || 0) + (totalOnlineSalesValue || 0);

    const posUnitsSold = filteredReceipts.reduce((sum, r) => sum + (r.items?.reduce((q: number, i: any) => q + (i.quantity || 0), 0) || 0), 0);
    const onlineUnitsSold = filteredOnlineOrders.reduce((sum, o) => sum + (o.items?.reduce((q: number, i: any) => q + (i.quantity || 0), 0) || 0), 0);
    const totalUnitsSold = posUnitsSold + onlineUnitsSold;

    const itemSalesCount: Record<string, number> = {};
    let serviceUnitsSold = 0;
    let productUnitsSold = 0;
    let serviceRevenue = 0;
    let productRevenue = 0;

    filteredReceipts.forEach(receipt => {
      if (!receipt || !Array.isArray(receipt.items)) return;
      
      let receiptProductSum = 0;
      let receiptServiceSum = 0;

      receipt.items.forEach(item => {
        if (!item || !item.productId) return;
        const product = inventoryItems.find(p => p.id === item.productId);
        const name = product?.name || item.name || 'Unknown Item';
        itemSalesCount[name] = (itemSalesCount[name] || 0) + (item.quantity || 0);
        
        const itemRev = (Number(item.price) || 0) * (Number(item.quantity) || 0);
        if (product) {
          if (product.categoryType === 'service') {
            serviceUnitsSold += (item.quantity || 0);
            receiptServiceSum += itemRev;
          } else {
            productUnitsSold += (item.quantity || 0);
            receiptProductSum += itemRev;
          }
        } else {
          productUnitsSold += (item.quantity || 0);
          receiptProductSum += itemRev;
        }
      });

      const receiptTotalRaw = receiptProductSum + receiptServiceSum;
      const actualReceiptRevenue = Number(receipt.total) || 0;

      if (receiptTotalRaw > 0) {
        const pRatio = receiptProductSum / receiptTotalRaw;
        const sRatio = receiptServiceSum / receiptTotalRaw;
        productRevenue += (pRatio * actualReceiptRevenue);
        serviceRevenue += (sRatio * actualReceiptRevenue);
      } else {
        productRevenue += actualReceiptRevenue; // Fallback to product revenue if no item info
      }
    });

    filteredOnlineOrders.forEach(order => {
      if (!order || !Array.isArray(order.items)) return;
      
      let orderProductSum = 0;
      let orderServiceSum = 0;

      order.items.forEach(item => {
        if (!item || !item.productId) return;
        const product = inventoryItems.find(p => p.id === item.productId);
        const name = product?.name || item.name || 'Unknown Item';
        itemSalesCount[name] = (itemSalesCount[name] || 0) + (item.quantity || 0);
        
        const itemRev = (Number(item.price) || 0) * (Number(item.quantity) || 0);
        if (product) {
          if (product.categoryType === 'service') {
            serviceUnitsSold += (item.quantity || 0);
            orderServiceSum += itemRev;
          } else {
            productUnitsSold += (item.quantity || 0);
            orderProductSum += itemRev;
          }
        } else {
          productUnitsSold += (item.quantity || 0);
          orderProductSum += itemRev;
        }
      });

      const orderTotalRaw = orderProductSum + orderServiceSum;
      const actualOrderRevenue = Number(order.total) || 0;

      if (orderTotalRaw > 0) {
        const pRatio = orderProductSum / orderTotalRaw;
        const sRatio = orderServiceSum / orderTotalRaw;
        productRevenue += (pRatio * actualOrderRevenue);
        serviceRevenue += (sRatio * actualOrderRevenue);
      } else {
        productRevenue += actualOrderRevenue;
      }
    });

    const topSellingItems = Object.entries(itemSalesCount)
      .sort(([, qtyA], [, qtyB]) => qtyB - qtyA)
      .slice(0, 5) // Show top 5
      .map(([name, quantitySold]) => {
        const inventoryItem = inventoryItems.find(invItem => invItem.name === name);
        return {
          ...(inventoryItem || { id: `manual-${name}`, name: name, sku: 'N/A', stock: 0, price: 0, category: 'N/A', lowStockThreshold: 10 }),
          quantitySold: quantitySold
        } as TopSellingItem;
      });

    const isLoyaltyEnabled = business?.settings?.loyaltyProgramEnabled;
    
    // Calculate spend in range for all customers found in filtered receipts
    const customerSpendInRange: Record<string, number> = {};
    filteredReceipts.forEach(r => {
      if (r.customer?.id) {
        customerSpendInRange[r.customer.id] = (customerSpendInRange[r.customer.id] || 0) + (r.total || 0);
      }
    });

    let sortedCustomers = [...allCustomers];
    if (isLoyaltyEnabled) {
      sortedCustomers = sortedCustomers.filter(c => (c.loyaltyPoints || 0) > 0);
      sortedCustomers.sort((a, b) => (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0));
    } else {
      sortedCustomers = sortedCustomers.filter(c => (customerSpendInRange[c.id] || 0) > 0);
      sortedCustomers.sort((a, b) => (customerSpendInRange[b.id] || 0) - (customerSpendInRange[a.id] || 0));
    }

    const topLoyaltyCustomers = sortedCustomers.slice(0, 3).map(c => ({
        ...c,
        spendInRange: customerSpendInRange[c.id] || 0
    }));

    // Flatten receipts to get sales items for the current period (limit to 5 items for dashboard preview)
    const recentSalesItems: {
      id: string;
      productId: string;
      receiptId: string;
      name: string;
      quantity: number;
      price: number;
      total: number;
      receiptNumber: string;
      createdAt: Date;
      paymentMethod: string;
      imageUrl?: string;
      categoryType?: string;
    }[] = [];

    filteredReceipts.forEach(r => {
      const date = safeToDate(r.createdAt);
      r.items?.forEach((item, index) => {
        const cleanItemName = item.name.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
        const product = inventoryItems.find(p => 
          p.id === item.productId || 
          p.name.toLowerCase() === cleanItemName
        );
        recentSalesItems.push({
          id: `${r.id}-${item.productId}-${index}`,
          productId: item.productId,
          receiptId: r.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          receiptNumber: r.receiptNumber || 'N/A',
          createdAt: date,
          paymentMethod: r.paymentMethod || 'Walk-in',
          imageUrl: product?.imageUrl || undefined,
          categoryType: product?.categoryType || 'product'
        });
      });
    });

    recentSalesItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Default to lifetime stats if no range is selected or if it's broad
    const showLifetime = !date?.from || !date?.to;

    const useGlobalStats = showLifetime && (!activeBranchId || activeBranchId === 'all');

    return {
      totalStock,
      uniqueSkus,
      lowStockItems,
      totalSalesValue: useGlobalStats ? (stats?.totalRevenue || 0) : totalSalesValue,
      totalReceipts: useGlobalStats ? (stats?.totalSales || 0) : totalReceiptsCount,
      totalOnlineSalesValue,
      totalOnlineOrdersCount,
      totalRevenue: useGlobalStats ? (stats?.totalRevenue || 0) : totalRevenue,
      newCustomersCount: useGlobalStats ? (stats?.totalCustomers || 0) : newCustomers.length,
      totalUnitsSold: useGlobalStats ? (stats?.totalUnitsSold || 0) : totalUnitsSold,

      topSellingItems,
      topLoyaltyCustomers,
      isLoyaltyEnabled,
      recentSalesItems: recentSalesItems.slice(0, 5),
      debtItemsCount: inventoryItems.filter(p => p.categoryType !== 'service' && (p.stock || 0) < 0).length,
      totalDebtUnits: inventoryItems.filter(p => p.categoryType !== 'service' && (p.stock || 0) < 0).reduce((acc, p) => acc + Math.abs(p.stock || 0), 0),
      serviceUnitsSold,
      productUnitsSold,
      serviceRevenue,
      productRevenue
    };
  }, [products, receipts, customers, onlineOrders, date, stats, dashboardBatchReceipts, activeBranchId]);

  // Surgical Analytics for Date Range
  const [rangeStats, setRangeStats] = React.useState<{ revenue: number, count: number, customers: number } | null>(null);
  const [monthlyStats, setMonthlyStats] = React.useState<{ month: string, totalSales: number }[] | null>(null);
  const { fetchDetailedAnalytics, fetchMonthlyAnalytics } = usePOS();

  React.useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      try {
        const res = await fetchMonthlyAnalytics(12);
        if (isMounted) {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            
            // Map existing data
            const dataMap: Record<string, number> = {};
            res.forEach(m => {
              let label = m.month;
              if (label.includes('-')) {
                const monthIdx = parseInt(label.split('-')[1]) - 1;
                label = months[monthIdx] || label;
              }
              dataMap[label] = m.revenue;
            });

            // Ensure all 12 months are present
            const paddedStats = months.map(m => ({
              month: m,
              totalSales: dataMap[m] || 0
            }));

            setMonthlyStats(paddedStats);
        }
      } catch (err) {

        console.error("Dashboard history fetch failed:", err);
      }
    };
    fetchHistory();
    return () => { isMounted = false; };
  }, [fetchMonthlyAnalytics]);


  const dateFromTime = date?.from ? safeToDate(date.from).getTime() : 0;
  const dateToTime = date?.to ? safeToDate(date.to).getTime() : 0;

  React.useEffect(() => {
    if (dateFromTime && dateToTime) {
      const fetchRange = async () => {
        setIsFetchingBatch(true);
        try {
          const parsedFrom = new Date(dateFromTime);
          const parsedTo = new Date(dateToTime);
          
          // Fetch high-fidelity range stats
          const res = await fetchDetailedAnalytics(startOfDay(parsedFrom), endOfDay(parsedTo));
          setRangeStats(res);
          
          // Also fetch the actual receipts for Top Selling Items calculation
          const BatchRes = await fetchReceiptsInRange(startOfDay(parsedFrom), endOfDay(parsedTo), 500);
          setDashboardBatchReceipts(BatchRes);
        } catch (err) {
          console.error("Dashboard range fetch failed:", err);
        } finally {
          setIsFetchingBatch(false);
        }
      };
      fetchRange();
    } else {
      setRangeStats(null);
      setDashboardBatchReceipts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFromTime, dateToTime, fetchDetailedAnalytics, fetchReceiptsInRange]);

  // Merge range stats into dashboard calculations
  const finalDashboardData = React.useMemo(() => {
    if (!dashboardData) return null;
    if (!rangeStats) return dashboardData;

    const rawRevenueSum = (dashboardData.productRevenue || 0) + (dashboardData.serviceRevenue || 0);
    let finalProductRevenue = dashboardData.productRevenue;
    let finalServiceRevenue = dashboardData.serviceRevenue;

    if (rawRevenueSum > 0) {
      const pRatio = (dashboardData.productRevenue || 0) / rawRevenueSum;
      const sRatio = (dashboardData.serviceRevenue || 0) / rawRevenueSum;
      finalProductRevenue = pRatio * rangeStats.revenue;
      finalServiceRevenue = sRatio * rangeStats.revenue;
    }

    return {
      ...dashboardData,
      totalRevenue: rangeStats.revenue,
      totalSalesValue: rangeStats.revenue,
      totalReceipts: rangeStats.count,
      newCustomersCount: rangeStats.customers,
      productRevenue: finalProductRevenue,
      serviceRevenue: finalServiceRevenue
    };
  }, [dashboardData, rangeStats]);

  const handleDownloadImage = async () => {
    const element = dashboardRef.current;
    if (!element) return;
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        ignoreElements: (el) => el.classList.contains('no-capture')
      });
      const data = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = data;
      link.download = `zeneva-dashboard-${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ variant: 'success', title: t('dashboard.downloaded'), description: t('dashboard.downloadedDescription') });
    } catch (err) {
      toast({ variant: 'destructive', title: t('dashboard.downloadFailed'), description: t('dashboard.downloadFailedDescription') });
    }
  };

  const { currentUserProfile } = usePOS();

  const hasReportPermission = currentUserProfile?.permissions?.view_reports ?? (currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'owner');
  const isRestricted = !hasReportPermission;

  if (isLoading || !finalDashboardData) {
    return <DashboardSkeleton restricted={isRestricted} />;
  }

  const { totalRevenue, newCustomersCount, totalUnitsSold, totalStock, uniqueSkus, lowStockItems, totalSalesValue, totalReceipts, totalOnlineSalesValue, totalOnlineOrdersCount, topSellingItems, topLoyaltyCustomers, isLoyaltyEnabled, debtItemsCount, totalDebtUnits, serviceUnitsSold, productUnitsSold, serviceRevenue, productRevenue, recentSalesItems } = finalDashboardData;


  return (
    <div ref={dashboardRef} className="flex flex-col gap-6 bg-background p-1 pb-10 sm:pb-1">
      <PageTitle title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>
        <div className="no-capture flex flex-wrap items-center justify-start sm:justify-end gap-2">
          <DateRangePicker date={date} onDateChange={setDate} />
          <Button onClick={handleDownloadImage} variant="outline">
            <Download className="me-2 h-4 w-4" /> {t('dashboard.download')}
          </Button>
        </div>
      </PageTitle>

      {/* The one thing worth doing today, from the business rating. Gated with the
          revenue cards below — it quotes money, so it follows the same permission. */}
      {!isRestricted && <TodaysFocus />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
        {!isRestricted && (
          <SummaryCard
            title={t('dashboard.totalRevenue')}
            value={<CurrencyAmount symbol={currencySymbol} amount={totalRevenue || 0} />}
            icon={currencySymbol}
            description={t('dashboard.totalTransactions', { count: ((totalReceipts || 0) + (totalOnlineOrdersCount || 0)).toLocaleString() })}
            href="/reports"
          />
        )}
        {!isRestricted && (
          <SummaryCard
            title={t('dashboard.productRevenue')}
            value={<CurrencyAmount symbol={currencySymbol} amount={productRevenue || 0} />}
            icon={Package}
            description={t('dashboard.productsSold', { count: (productUnitsSold || 0).toLocaleString() })}
            href="/reports"
          />
        )}
        {!isRestricted && (
          <SummaryCard
            title={t('dashboard.serviceRevenue')}
            value={<CurrencyAmount symbol={currencySymbol} amount={serviceRevenue || 0} />}
            icon={Activity}
            description={t('dashboard.servicesRendered', { count: (serviceUnitsSold || 0).toLocaleString() })}
            href="/reports"
          />
        )}
        <SummaryCard
          title={t('dashboard.unitsSold')}
          value={(totalUnitsSold || 0).toLocaleString()}
          icon={ShoppingBag}
          description={t('dashboard.unitsBreakdown', { products: (productUnitsSold || 0).toLocaleString(), services: (serviceUnitsSold || 0).toLocaleString() })}
          href="/reports"
        />
        <SummaryCard
          title={t('dashboard.newCustomers')}
          value={(newCustomersCount || 0).toLocaleString()}
          icon={Users}
          description={t('dashboard.signedUpThisPeriod')}
          href="/customers"
        />
        {!isRestricted && (
          <SummaryCard
            title={t('dashboard.posSales')}
            value={<CurrencyAmount symbol={currencySymbol} amount={totalSalesValue || 0} />}
            icon={currencySymbol}
            description={t('dashboard.transactions', { count: (totalReceipts || 0).toLocaleString() })}
            href="/receipts"
          />
        )}
        {!isRestricted && (
          <SummaryCard
            title={t('dashboard.onlineSales')}
            value={<CurrencyAmount symbol={currencySymbol} amount={totalOnlineSalesValue || 0} />}
            icon={currencySymbol}
            description={t('dashboard.onlineOrdersCount', { count: (totalOnlineOrdersCount || 0).toLocaleString() })}
            href="/online-orders"
          />
        )}
        <SummaryCard
          title={t('dashboard.lowStockAlerts')}
          value={(lowStockItems || 0).toLocaleString()}
          icon={AlertCircle}
          description={(lowStockItems || 0) > 0 ? t('dashboard.itemsNeedingAttention', { count: (lowStockItems || 0).toLocaleString() }) : t('dashboard.allStockHealthy')}
          href="/inventory"
        />
        {debtItemsCount > 0 && (
          <SummaryCard
            title={t('dashboard.recordedDebts')}
            value={totalDebtUnits}
            icon={TrendingDown}
            description={t('dashboard.productsBackordered', { count: debtItemsCount.toLocaleString() })}
            href="/inventory/debts"
          />
        )}
      </div>

      {!isRestricted && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <OverviewChart receipts={receipts || []} currencySymbol={currencySymbol} data={monthlyStats || undefined} />
          </div>
          <CategoryPieChart products={products || []} />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className={cn("shadow-md transition-all duration-300 hover:-translate-y-1 hover:scale-105 cursor-pointer", isRestricted ? "md:col-span-3" : "md:col-span-2")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {t('dashboard.salesActivity')}
            </CardTitle>
            <CardDescription>{t('dashboard.salesActivityDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 text-center">
                <PackageCheck className="h-8 w-8 text-primary mb-2" />
                <p className="text-2xl font-bold">{totalReceipts + totalOnlineOrdersCount}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.completedSales')}</p>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 text-center">
                <FileDigit className="h-8 w-8 text-primary mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.toBeInvoiced')}</p>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 text-center">
                <PackageSearch className="h-8 w-8 text-primary mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.toBeDelivered')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {!isRestricted && (
          <Card className="shadow-md transition-all duration-300 hover:-translate-y-1 hover:scale-105 cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                {t('dashboard.inventorySummary')}
              </CardTitle>
              <CardDescription>{t('dashboard.inventorySummaryDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">{t('dashboard.quantityInHand')}</p>
                  <p className="text-2xl font-bold">{(totalStock || 0).toLocaleString()}</p>
                </div>
                <Archive className="h-8 w-8 text-primary" />
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">{t('dashboard.quantityToBeReceived')}</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <PackageSearch className="h-8 w-8 text-primary" />
              </div>
              <div className="pt-2">
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href="/inventory?sortBy=stock-desc">
                    {t('dashboard.viewHighestStock')} <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md transition-all duration-300 hover:-translate-y-1 hover:scale-105 cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              {isLoyaltyEnabled ? t('dashboard.topLoyaltyCustomers') : t('dashboard.topCustomers')}
            </CardTitle>
            <CardDescription>
              {isLoyaltyEnabled ? t('dashboard.topLoyaltyDesc') : t('dashboard.topCustomersDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topLoyaltyCustomers.length > 0 ? (
              <ul className="space-y-3">
                {topLoyaltyCustomers.map(customer => (
                  <li key={customer.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src="" alt={customer.name} data-ai-hint="person avatar placeholder" />
                        <AvatarFallback>{customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" title={customer.name}>{customer.name}</p>
                        <p className="text-xs text-muted-foreground" title={customer.email}>{customer.email}</p>
                      </div>
                    </div>
                    <div className="text-end flex-shrink-0">
                      <p className="text-sm font-semibold text-primary">
                        {(isLoyaltyEnabled && (customer.loyaltyPoints || 0) > 0)
                          ? `${customer.loyaltyPoints} ${t('dashboard.points')}`
                          : `${currencySymbol}${(customer as any).spendInRange?.toLocaleString() || 0}`
                        }
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isLoyaltyEnabled ? t('dashboard.noLoyaltyData') : t('dashboard.noCustomerSales')}
              </p>
            )}
            <Button variant="link" size="sm" asChild className="mt-3 w-full justify-center">
              <Link href="/customers">{t('dashboard.viewAllCustomers')}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md transition-all duration-300 hover:-translate-y-1 hover:scale-105 cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('dashboard.topSellingItems')}
            </CardTitle>
            <CardDescription>{t('dashboard.topSellingDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {topSellingItems.length > 0 ? (
              <>
                <ul className="space-y-3">
                  {topSellingItems.map(item => (
                    <li key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm">
                      <Link 
                        href={item.id.startsWith('manual-') ? '#' : `/inventory/details?id=${item.id}`} 
                        className={cn("font-medium", item.id.startsWith('manual-') ? "text-muted-foreground cursor-default" : "hover:underline text-primary")} 
                        title={item.name}
                      >
                        {item.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] h-4">
                          {item.categoryType === 'service' ? t('dashboard.service') : t('dashboard.product')}
                        </Badge>
                        <span className="text-muted-foreground">{item.quantitySold} {t('dashboard.sold')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="pt-4">
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link href="/inventory">
                      {t('dashboard.viewInventoryDetails')} <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="mx-auto h-12 w-12 opacity-50 mb-3" />
                <p>{t('dashboard.noTopSelling')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
 
      {/* Daily Sales Items Card */}
      {!isRestricted && (
        <Card className="shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                {t('dashboard.dailySalesLog')}
              </CardTitle>
              <CardDescription>{t('dashboard.dailySalesLogDesc')}</CardDescription>
            </div>
            <Button
              size="sm"
              asChild
              className="h-9 bg-primary text-white hover:bg-primary/95 hover:scale-[1.03] active:scale-[0.97] shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/40 transition-all duration-300 font-bold px-4 rounded-lg flex items-center gap-2 border border-primary/20"
            >
              <Link href="/reports?tab=daily-sales">
                <span>{t('dashboard.viewAllDailySales')}</span>
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentSalesItems && recentSalesItems.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="font-semibold text-sm">{t('dashboard.itemName')}</TableHead>
                      <TableHead className="font-semibold text-sm text-center">{t('dashboard.qty')}</TableHead>
                      <TableHead className="font-semibold text-sm">{t('common.price')}</TableHead>
                      <TableHead className="font-semibold text-sm">{t('common.total')}</TableHead>
                      <TableHead className="font-semibold text-sm">{t('dashboard.receipt')}</TableHead>
                      <TableHead className="font-semibold text-sm text-end pe-4">{t('dashboard.time')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSalesItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/10">
                        <TableCell className="py-2.5">
                          {item.productId && item.productId !== 'custom' ? (
                            <Link href={`/inventory/details?id=${item.productId}`} className="hover:opacity-80 transition-opacity block w-max">
                              {item.imageUrl ? (
                                <div className="relative h-9 w-9">
                                  <CachedImage
                                    alt={item.name}
                                    className="aspect-square rounded-md object-cover w-full h-full border border-border"
                                    src={item.imageUrl}
                                    fallback={<Package className="h-4.5 w-4.5" />}
                                  />
                                </div>
                              ) : (
                                <div className="h-9 w-9 bg-muted rounded-md flex items-center justify-center text-muted-foreground border border-border">
                                  <Package className="h-4 w-4" />
                                </div>
                              )}
                            </Link>
                          ) : (
                            item.imageUrl ? (
                              <div className="relative h-9 w-9">
                                <CachedImage
                                  alt={item.name}
                                  className="aspect-square rounded-md object-cover w-full h-full border border-border"
                                  src={item.imageUrl}
                                  fallback={<Package className="h-4.5 w-4.5" />}
                                />
                              </div>
                            ) : (
                              <div className="h-9 w-9 bg-muted rounded-md flex items-center justify-center text-muted-foreground border border-border">
                                <Package className="h-4 w-4" />
                              </div>
                            )
                          )}
                        </TableCell>
                        <TableCell className="font-medium py-2.5">
                          <div className="flex flex-col">
                            {item.productId && item.productId !== 'custom' ? (
                              <Link href={`/inventory/details?id=${item.productId}`} className="text-sm font-semibold hover:underline text-foreground hover:text-primary transition-colors">
                                {item.name}
                              </Link>
                            ) : (
                              <span className="text-sm font-semibold text-foreground">{item.name}</span>
                            )}
                            <div className="mt-0.5">
                              <Badge
                                variant="outline"
                                className={item.categoryType === 'service' 
                                  ? "text-[9px] h-3.5 bg-blue-500/10 text-blue-600 border-blue-500/20 px-1 font-semibold" 
                                  : "text-[9px] h-3.5 bg-orange-500/10 text-orange-600 border-orange-500/20 px-1 font-semibold"}
                              >
                                {item.categoryType === 'service' ? t('dashboard.service') : t('dashboard.product')}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold py-2.5 text-sm text-foreground">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-muted-foreground">
                          {currencySymbol}{item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="py-2.5 font-bold text-sm text-foreground">
                          {currencySymbol}{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Link href={`/receipts/details?id=${item.receiptId}`} className="group flex flex-col w-max">
                            <span className="text-xs font-mono bg-muted group-hover:bg-primary/10 group-hover:text-primary py-0.5 px-1.5 rounded w-max text-foreground font-medium flex items-center gap-1 border border-border transition-colors">
                              <FileText className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                              {item.receiptNumber}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-end text-xs text-muted-foreground py-2.5 pe-4 whitespace-nowrap">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-foreground">{formatDistanceToNow(item.createdAt, { addSuffix: true })}</span>
                            <span className="text-[10px] text-muted-foreground/85 mt-0.5">{format(item.createdAt, 'PPp')}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="mx-auto h-12 w-12 opacity-50 mb-3" />
                <p>{t('dashboard.noSalesItems')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {business && (
        <AddCustomerDialog
          isOpen={isAddCustomerOpen}
          onOpenChange={setIsAddCustomerOpen}
          businessId={business.id}
          customers={customers}
        />
      )}
    </div>
  );
}
