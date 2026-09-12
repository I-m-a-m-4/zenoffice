
'use client';

import * as React from 'react';
import { usePOS } from '@/context/pos-context';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, getAggregateFromServer, count, sum } from 'firebase/firestore';
import type { Receipt } from '@/types';
import PageTitle from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, Package, PieChart, ShoppingCart, Users, Download, Loader2, Bot, Info } from 'lucide-react';
import SalesOverTimeChart from './sales-over-time-chart';
import TopProductsChart from './top-products-chart';
import { DateRangePicker } from './date-range-picker';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import RecentSalesTable from './recent-sales-table';
import TopCustomersList from './top-customers-list';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import RefreshButton from '../shared/refresh-button';

function ReportStatCard({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    )
}

function PlaceholderChart({ title, description }: { title: string, description: string }) {
    return (
         <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center bg-muted/50 rounded-b-lg">
                <div className="text-center text-muted-foreground p-4">
                    <div className="font-semibold flex items-center justify-center gap-2 mb-2"><Bot className="h-4 w-4 text-primary"/> Zen AI</div>
                    <p className="text-sm">Once your first sale is made, this report will automatically activate. Upgrade your plan for more detailed analytics.</p>
                </div>
            </CardContent>
        </Card>
    );
};

/**
 * How many receipts the charts and tables below load for the selected range.
 *
 * The listener used to be unbounded: opening Reports on a busy store pulled
 * every receipt in the window, and re-pulled them on each range change. The
 * headline figures come from a server-side aggregation instead, so this bound
 * only limits how much detail the charts draw — and `businessId ASC +
 * createdAt DESC` is already a deployed index, so ordering newest-first costs
 * nothing. Ordering matters: without an explicit orderBy, Firestore's implicit
 * ascending order would make a limit keep the *oldest* receipts in range.
 */
const REPORT_RECEIPT_LIMIT = 2000;

export default function ReportsDashboard() {
    const { currencySymbol, business, products, customers, isLoading: isPosLoading } = usePOS();
    const firestore = useFirestore();
    const dashboardRef = React.useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const [date, setDate] = React.useState<DateRange | undefined>({
      from: subDays(new Date(), 29),
      to: new Date(),
    });

    const receiptsQuery = useMemoFirebase(() => {
        if (!business?.id || !firestore) return null;
        let q = query(collection(firestore, "receipts"), where("businessId", "==", business.id));
        if (date?.from) {
            q = query(q, where('createdAt', '>=', date.from));
        }
        if (date?.to) {
            // Adjust to include the whole end day
            const toDate = new Date(date.to);
            toDate.setHours(23, 59, 59, 999);
            q = query(q, where('createdAt', '<=', toDate));
        }
        // Newest-first, then bounded — see REPORT_RECEIPT_LIMIT.
        return query(q, orderBy('createdAt', 'desc'), limit(REPORT_RECEIPT_LIMIT));
    }, [business?.id, firestore, date]);

    const { data: receipts, isLoading: isLoadingReceipts } = useCollection<Receipt>(receiptsQuery);

    const isLoading = isPosLoading || isLoadingReceipts;

    /**
     * Range totals, computed on the server.
     *
     * Revenue and sales count must cover the whole selected range, not just the
     * REPORT_RECEIPT_LIMIT receipts the charts loaded, so they come from an
     * aggregation query — which returns the numbers without transferring, or
     * billing for, a single receipt document.
     */
    const [rangeTotals, setRangeTotals] = React.useState<{ totalRevenue: number; totalSales: number } | null>(null);

    React.useEffect(() => {
        if (!business?.id || !firestore) return;
        let cancelled = false;
        setRangeTotals(null);

        let q = query(collection(firestore, 'receipts'), where('businessId', '==', business.id));
        if (date?.from) q = query(q, where('createdAt', '>=', date.from));
        if (date?.to) {
            const toDate = new Date(date.to);
            toDate.setHours(23, 59, 59, 999);
            q = query(q, where('createdAt', '<=', toDate));
        }

        getAggregateFromServer(q, { totalSales: count(), totalRevenue: sum('total') })
            .then(snap => {
                if (cancelled) return;
                setRangeTotals({
                    totalSales: snap.data().totalSales || 0,
                    totalRevenue: snap.data().totalRevenue || 0,
                });
            })
            .catch(() => {
                // Falls back to the figures derived from the loaded receipts
                // below; never blanks the page.
            });

        return () => { cancelled = true; };
    }, [business?.id, firestore, date]);

    const reportData = React.useMemo(() => {
        if (isLoading || !receipts || !products || !customers) return null;

        // Prefer the server aggregation, which covers the entire range; the
        // reduce over loaded receipts is the fallback for when it has not
        // resolved yet or failed.
        const totalRevenue = rangeTotals?.totalRevenue ?? receipts.reduce((sum, r) => sum + r.total, 0);
        const totalSales = rangeTotals?.totalSales ?? receipts.length;
        const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
        const inventoryValue = products.reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0);
        // Units, not lines. This used to be `sum + r.items.length`, which counted
        // a sale of twelve of one product as 1 — so the "Products Sold" card here
        // disagreed with the same figure on the dashboard and the admin board,
        // both of which sum `quantity` (dashboard/page.tsx:157,
        // admin-imamshaffy/page.tsx:2487). The optional chaining matches those
        // two as well: a receipt written without `items` threw here.
        const totalProductsSold = receipts.reduce(
            (sum, r) => sum + (r.items?.reduce((q, i) => q + (i.quantity || 0), 0) || 0), 0);

        /**
         * True when the range holds more receipts than REPORT_RECEIPT_LIMIT
         * loaded, so everything derived by reducing over `receipts` — products
         * sold, both charts, recent sales, top customers — describes the newest
         * REPORT_RECEIPT_LIMIT sales rather than the whole range.
         *
         * Revenue and sales count are unaffected: they come from the server
         * aggregation above and stay exact at any range size.
         *
         * This is surfaced in the UI rather than papered over. `sum()` needs a
         * scalar field and a receipt's items are an array, so there is no
         * server-side way to total units; denormalising a count at sale time
         * would only cover new receipts and would make the figure quietly wrong
         * for historical ones instead of visibly partial.
         */
        const isPartialRange = rangeTotals !== null && rangeTotals.totalSales > receipts.length;

        return {
            totalRevenue,
            totalSales,
            averageOrderValue,
            inventoryValue,
            totalCustomers: customers.length,
            totalProductsSold,
            isPartialRange,
            loadedReceiptCount: receipts.length,
        }

    }, [receipts, products, customers, isLoading, rangeTotals]);
    
    const handleDownloadImage = async () => {
        const element = dashboardRef.current;
        if (!element) return;
        toast({ title: 'Generating Report...', description: 'Please wait while we capture your dashboard.' });
        try {
            const canvas = await html2canvas(element, { 
              scale: 2,
              ignoreElements: (el) => el.classList.contains('no-capture')
            });
            const data = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = data;
            link.download = `zeneva-report-${new Date().toISOString().split('T')[0]}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ variant: 'success', title: 'Report Downloaded', description: 'Your dashboard image has been saved.' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not capture the dashboard image.' });
        }
      };

    return (
        <div ref={dashboardRef} className="flex flex-col gap-6 bg-background p-1">
            <PageTitle title="Reports" subtitle="Deep dive into your business performance.">
                <div className="flex items-center gap-2 no-capture">
                    <RefreshButton />
                    <DateRangePicker date={date} onDateChange={setDate} />
                    <Button onClick={handleDownloadImage}><Download className="mr-2 h-4 w-4"/>Download</Button>
                </div>
            </PageTitle>
            
            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
             <>
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                    <ReportStatCard 
                        title="Total Revenue"
                        value={`${currencySymbol}${reportData?.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}`}
                        icon={DollarSign}
                    />
                    <ReportStatCard 
                        title="Total Sales"
                        value={reportData?.totalSales.toLocaleString() || '0'}
                        icon={ShoppingCart}
                    />
                     <ReportStatCard 
                        title="Avg. Order Value"
                        value={`${currencySymbol}${reportData?.averageOrderValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0.00'}`}
                        icon={FileText}
                    />
                    <ReportStatCard
                        title={reportData?.isPartialRange ? 'Products Sold (partial)' : 'Products Sold'}
                        value={reportData?.totalProductsSold.toLocaleString() || '0'}
                        icon={Package}
                    />
                    <ReportStatCard
                        title="Total Customers"
                        value={reportData?.totalCustomers.toLocaleString() || '0'}
                        icon={Users}
                    />
                </div>

                {reportData?.isPartialRange && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                        <Info className="h-4 w-4 shrink-0 mt-px" />
                        <p>
                            <span className="font-semibold">Total Revenue</span> and <span className="font-semibold">Total Sales</span> cover
                            this entire range. This range holds {reportData.totalSales.toLocaleString()} sales, so
                            Products Sold, the charts, recent sales and top customers below are based on the
                            most recent {reportData.loadedReceiptCount.toLocaleString()}. Choose a shorter range to include every sale.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3">
                        <SalesOverTimeChart receipts={receipts || []} currencySymbol={currencySymbol} />
                    </div>
                    <div className="lg:col-span-2">
                        <TopProductsChart receipts={receipts || []} />
                    </div>
                </div>

                 <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3">
                        <RecentSalesTable receipts={receipts || []} currencySymbol={currencySymbol}/>
                    </div>
                    <div className="lg:col-span-2">
                        <TopCustomersList receipts={receipts || []} currencySymbol={currencySymbol} />
                    </div>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Profit & Loss Report</CardTitle>
                        <CardDescription>Analyze your profitability over time.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center py-12 text-muted-foreground">
                        <div className="font-semibold flex items-center justify-center gap-2 mb-2"><Bot className="h-4 w-4 text-primary"/> Zen AI</div>
                        <p className="text-sm">This feature requires a 'cost price' field for each product to calculate profit margins. We're working on adding this capability.</p>
                    </CardContent>
                </Card>
             </>
            )}
        </div>
    );
}

