
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { usePOS } from '@/context/pos-context';
import { doc, deleteDoc, updateDoc, serverTimestamp, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import type { Customer, Receipt, CustomerInsightsOutput, Product } from '@/types';
import { generateLocalCustomerIntelligence } from '@/lib/customer-intelligence';
import NProgress from 'nprogress';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { 
    ArrowLeft, Bot, Sparkles, BrainCircuit, Lightbulb, Package, Loader2, Trash2, Pencil, 
    Wallet, Scale, Ruler, History, AlertTriangle, CheckCircle2, MoreVertical, Plus, ChevronRight,
    Receipt, FileText, Clock, ShoppingBag, PlusCircle
} from 'lucide-react';
import EditCustomerDialog from '@/components/customers/edit-customer-dialog';
import { getCachedCustomerReceipts, syncCustomersToOffline } from '@/lib/sqlite-sync';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { logAuditEvent } from '@/lib/audit';
import Image from 'next/image';
import Link from 'next/link';
import { safeToDate, cn } from '@/lib/utils';
import CustomerCrmPanel from '@/components/customers/customer-crm-panel';
import {
    computeCustomerSegments,
    segmentLabelKey,
    type SegmentKey,
} from '@/lib/customer-segments';
import { useI18n } from '@/context/i18n-context';

/**
 * The AI summary is generated from customer records, and a customer name is a
 * field any staff-role user can write. Rendering it raw let markup in a name
 * reach the owner's session, so escape everything first and only then reinstate
 * the one bit of formatting the summary actually uses (`**bold**`).
 */
function renderBoldSafe(summary: string | undefined | null): string {
    return String(summary ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

export default function CustomerDetailPage() {
    return (
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <CustomerDetailContent />
        </Suspense>
    );
}

function CustomerDetailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const customerId = searchParams.get('id') as string;
    const { toast } = useToast();
    const { t } = useI18n();

    const { firestore, currencySymbol, customers, products: allProducts, receipts: allReceipts, isLoading: isPosLoading, currentUserProfile, triggerRefresh, addToQueue, business, selectCustomer } = usePOS();

    const customer = React.useMemo(() => customers?.find(c => c.id === customerId), [customers, customerId]);
    
    const [fetchedCustomer, setFetchedCustomer] = React.useState<Customer | null>(null);
    const [isFetchingCustomer, setIsFetchingCustomer] = React.useState(false);

    React.useEffect(() => {
        if (!customer && customerId && firestore && business?.id) {
            const fetchFallback = async () => {
                setIsFetchingCustomer(true);
                try {
                    const { doc, getDoc } = await import('firebase/firestore');
                    const ref = doc(firestore, 'customers', customerId);
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        setFetchedCustomer({ ...snap.data(), id: snap.id } as Customer);
                    }
                } catch(e) {
                    console.error("Fallback customer fetch failed:", e);
                } finally {
                    setIsFetchingCustomer(false);
                }
            };
            fetchFallback();
        }
    }, [customer, customerId, firestore, business?.id]);

    const displayCustomer = customer || fetchedCustomer;

    // FETCH FULL RECEIPT HISTORY FOR THIS CUSTOMER
    const [allCustomerReceipts, setAllCustomerReceipts] = React.useState<Receipt[]>(() => {
        if (!allReceipts || !customerId) return [];
        return allReceipts.filter(r => r.customer?.id === customerId);
    });
    const [isFetchingReceipts, setIsFetchingReceipts] = React.useState(true);

    // Sync incoming receipts reactive to pos-context hydration
    React.useEffect(() => {
        if (allReceipts && customerId) {
            const matching = allReceipts.filter(r => r.customer?.id === customerId);
            if (matching.length > 0) {
                setAllCustomerReceipts(prev => {
                    const merged = [...prev];
                    matching.forEach(m => {
                        if (!merged.some(existing => existing.id === m.id)) {
                            merged.push(m);
                        }
                    });
                    return merged.sort((a, b) => safeToDate(b.createdAt).getTime() - safeToDate(a.createdAt).getTime());
                });
            }
        }
    }, [allReceipts, customerId]);

    React.useEffect(() => {
        if (!firestore || !customerId || !business?.id) return;

        const fetchFullHistory = async () => {
            setIsFetchingReceipts(true);
            const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
            
            // 1. Initial hit from SQLite for instant UI in Native
            if (isTauri) {
                try {
                    const localReceipts = await getCachedCustomerReceipts(business.id, customerId);
                    if (localReceipts.length > 0) {
                        setAllCustomerReceipts(prev => {
                            const merged = [...prev];
                            localReceipts.forEach(lr => {
                                if (!merged.some(m => m.id === lr.id)) merged.push(lr);
                            });
                            return merged.sort((a, b) => safeToDate(b.createdAt).getTime() - safeToDate(a.createdAt).getTime());
                        });
                    }
                } catch (err) {
                    console.warn("SQLite Receipt Fetch failed:", err);
                }
            }

            // 2. If offline, do not attempt to contact Firestore which causes hang
            const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
            if (!isOnline) {
                setIsFetchingReceipts(false);
                return;
            }

            try {
                const q = query(
                    collection(firestore, 'receipts'),
                    where('businessId', '==', business.id),
                    where('customer.id', '==', customerId),
                    orderBy('createdAt', 'desc')
                );
                const snap = await getDocs(q);
                const docs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Receipt));
                
                setAllCustomerReceipts(prev => {
                    const merged = [...prev];
                    docs.forEach(rd => {
                        if (!merged.find(m => m.id === rd.id)) {
                            merged.push(rd);
                        }
                    });
                    return merged.sort((a,b) => safeToDate(b.createdAt).getTime() - safeToDate(a.createdAt).getTime());
                });
            } catch (err) {
                console.error("Failed to fetch customer history from Firestore:", err);
            } finally {
                setIsFetchingReceipts(false);
            }
        };

        fetchFullHistory();
    }, [firestore, customerId, business?.id]);

    const receipts = allCustomerReceipts;

    const [insights, setInsights] = React.useState<CustomerInsightsOutput | null>(customer?.aiInsights || null);
    const [isGeneratingInsights, setIsGeneratingInsights] = React.useState(false);
    const [customerToDelete, setCustomerToDelete] = React.useState<Customer | null>(null);
    const [customerToEdit, setCustomerToEdit] = React.useState<Customer | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    const unpaidReceipts = React.useMemo(() => {
        return receipts.filter(r => r.paymentMethod === 'Invoice' && r.status === 'unpaid');
    }, [receipts]);

    const totalDebt = React.useMemo(() => {
        return unpaidReceipts.reduce((sum, r) => sum + r.total, 0);
    }, [unpaidReceipts]);

    // Calculate Purchase Frequency and Churn Risk
    const behaviorInsights = React.useMemo(() => {
        if (!receipts || receipts.length === 0) {
            return {
                frequencyText: 'No purchases yet',
                daysSinceLast: 0,
                churnRisk: 'low' as 'low' | 'medium' | 'high',
                riskLabel: 'Low Risk',
                riskColor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            };
        }

        const dates = receipts
            .map(r => safeToDate(r.createdAt))
            .sort((a, b) => a.getTime() - b.getTime()); // oldest to newest

        const now = new Date();
        const lastPurchaseDate = dates[dates.length - 1];
        const daysSinceLast = Math.max(0, Math.ceil((now.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)));

        if (dates.length < 2) {
            let churnRisk: 'low' | 'medium' | 'high' = 'low';
            if (daysSinceLast > 60) churnRisk = 'high';
            else if (daysSinceLast > 30) churnRisk = 'medium';

            const riskLabel = churnRisk === 'high' ? 'High Risk' : (churnRisk === 'medium' ? 'Medium Risk' : 'Low Risk');
            const riskColor = churnRisk === 'high' 
                ? 'bg-destructive/10 text-destructive' 
                : (churnRisk === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400');

            return {
                frequencyText: 'N/A (Single Purchase)',
                daysSinceLast,
                churnRisk,
                riskLabel,
                riskColor,
            };
        }

        let totalIntervalDays = 0;
        for (let i = 1; i < dates.length; i++) {
            const diffTime = dates[i].getTime() - dates[i - 1].getTime();
            totalIntervalDays += diffTime / (1000 * 60 * 60 * 24);
        }
        const avgFrequency = Math.max(1, Math.round(totalIntervalDays / (dates.length - 1)));

        let churnRisk: 'low' | 'medium' | 'high' = 'low';
        if (daysSinceLast > avgFrequency * 2) {
            churnRisk = 'high';
        } else if (daysSinceLast > avgFrequency * 1.5) {
            churnRisk = 'medium';
        }

        const riskLabel = churnRisk === 'high' ? 'High Risk' : (churnRisk === 'medium' ? 'Medium Risk' : 'Low Risk');
        const riskColor = churnRisk === 'high' 
            ? 'bg-destructive/10 text-destructive' 
            : (churnRisk === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400');

        return {
            frequencyText: `Every ${avgFrequency} day${avgFrequency > 1 ? 's' : ''}`,
            daysSinceLast,
            churnRisk,
            riskLabel,
            riskColor,
        };
    }, [receipts]);

    // Calculate Top Categories (visual progress bar breakdown)
    const topCategories = React.useMemo(() => {
        const categoryCounts: Record<string, number> = {};
        let totalItemsCount = 0;

        receipts.forEach(r => {
            if (!r || !Array.isArray(r.items)) return;
            r.items.forEach(item => {
                const prod = allProducts?.find(p => p.id === item.productId);
                const cat = prod?.category || 'Uncategorized';
                const qty = item.quantity || 0;
                categoryCounts[cat] = (categoryCounts[cat] || 0) + qty;
                totalItemsCount += qty;
            });
        });

        if (totalItemsCount === 0) return [];

        return Object.entries(categoryCounts)
            .map(([name, count]) => ({
                name,
                percentage: Math.round((count / totalItemsCount) * 100),
            }))
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 3);
    }, [receipts, allProducts]);

    React.useEffect(() => {
        if (customer?.aiInsights) {
            setInsights(customer.aiInsights);
        }
    }, [customer]);

    const purchaseSummary = React.useMemo(() => {
        if (!receipts) return [];

        const summaryMap: Record<string, {
            product: Partial<Product>;
            totalQuantity: number;
            totalRevenue: number;
            lastPurchase: Date;
        }> = {};

        receipts.forEach(receipt => {
            if (!receipt) return;
            const purchaseDate = safeToDate(receipt.createdAt);
            (receipt.items || []).forEach(item => {
                if (!item) return;
                const productId = item.productId || 'unknown';
                
                if (!summaryMap[productId]) {
                    // Fallback to item data if product record is missing
                    const cleanItemName = (item.name || '').replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
                    const productInfo = allProducts?.find(p => 
                        p.id === productId || 
                        p.name.toLowerCase() === cleanItemName
                    );
                    summaryMap[productId] = {
                        product: productInfo || {
                            id: productId,
                            name: item.name || t('inventory.unknownProduct'),
                            price: item.price || 0,
                            imageUrl: (item as any).image || '',
                        },
                        totalQuantity: 0,
                        totalRevenue: 0,
                        lastPurchase: purchaseDate,
                    };
                }

                summaryMap[productId].totalQuantity += (item.quantity || 0);
                summaryMap[productId].totalRevenue += (item.price || 0) * (item.quantity || 0);
                if (purchaseDate > summaryMap[productId].lastPurchase) {
                    summaryMap[productId].lastPurchase = purchaseDate;
                }
            });
        });

        return Object.values(summaryMap).sort((a, b) => b.lastPurchase.getTime() - a.lastPurchase.getTime());
    }, [receipts, allProducts, t]);


    const handleGenerateInsights = async () => {
        if (!customer || !receipts || !firestore || !currentUserProfile) {
            toast({
                variant: "destructive",
                title: t('customers.insightsUnavailableTitle'),
                description: t('customers.insightsUnavailableBody')
            });
            return;
        }
        setIsGeneratingInsights(true);
        setInsights(null);
        try {
            // Simulation of intelligence processing (local is fast, but we add a small delay for UX)
            await new Promise(resolve => setTimeout(resolve, 800));

            const result = generateLocalCustomerIntelligence(
                customer,
                receipts,
                allProducts || [],
                currencySymbol
            );

            const insightsWithTimestamp = { ...result, createdAt: new Date() };

            /**
             * Routed through the offline queue rather than a direct `updateDoc`.
             *
             * The stranded comment that used to sit here ("let's just use the direct
             * update…") is why `addToQueue` was destructured on this page and never
             * called. The queue is the only path that enforces RBAC, scopes to the
             * active branch, survives an offline moment and updates the SQLite mirror
             * — so the hand-rolled `syncCustomersToOffline` call that followed the
             * direct write is no longer needed either.
             */
            try {
                await addToQueue({
                    type: 'update-customer',
                    payload: {
                        id: customerId,
                        values: { aiInsights: insightsWithTimestamp },
                    },
                } as any);
            } catch (e) {
                console.warn('Queueing insights failed; they remain available locally this session.');
            }

            // Optimistically update local state to avoid re-fetch
            setInsights(insightsWithTimestamp);
            // triggerRefresh(); // No need if we set state locally
            toast({ variant: 'success', title: t('customers.insightsDoneTitle'), description: t('customers.insightsDoneBody') });

        } catch (error) {
            console.error("Failed to generate insights:", error);
            toast({ variant: 'destructive', title: t('common.error'), description: t('customers.insightsFailed') });
        } finally {
            setIsGeneratingInsights(false);
        }
    };

    const totalSpent = React.useMemo(() => {
        const fromReceipts = receipts?.reduce((sum, r) => sum + r.total, 0) || 0;
        return Math.max(displayCustomer?.totalSpent || 0, fromReceipts);
    }, [displayCustomer, receipts]);

    /**
     * The segment badges under the name.
     *
     * These replaced a hardcoded `totalSpent > 100000 ? 'VIP' : 'Regular'`. A fixed
     * money threshold cannot mean the same thing in a corner shop and a wholesaler,
     * and it does not survive a currency change at all — `computeCustomerSegments`
     * sets the VIP floor from the shop's own top decile instead.
     *
     * Computed against the shop-wide receipt set because a segment is inherently
     * relative to the other customers. The money on this page keeps using the
     * page's own unbounded per-customer query, which is the more accurate figure.
     */
    const segmentBadges = React.useMemo(() => {
        if (!displayCustomer) return [] as SegmentKey[];
        const result = computeCustomerSegments({
            customers: customers || null,
            receipts: allReceipts,
            now: new Date(),
        });
        const own = result.byCustomerId.get(displayCustomer.id);
        const segments = own?.segments ?? [];
        // The page shows outstanding debt in its own right, from a better query, so
        // "Owing" is added from that rather than from the capped receipt window.
        const withDebt = totalDebt > 0 ? ['owing' as SegmentKey, ...segments.filter(s => s !== 'owing')] : segments;
        // "No purchases on record" is misleading beside a purchase history table.
        return withDebt.filter(s => s !== 'never-seen').slice(0, 3);
    }, [displayCustomer, customers, allReceipts, totalDebt]);

    const isLoading = isPosLoading || isFetchingReceipts || isFetchingCustomer || !firestore;
    const canDelete = currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'manager';

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <div className="grid md:grid-cols-3 gap-6">
                    <Skeleton className="h-48 md:col-span-1" />
                    <Skeleton className="h-96 md:col-span-2" />
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (!displayCustomer && !isLoading) {
        return (
            <div className="text-center p-8">
                <p className="font-bold text-lg">{t('customers.detailNotFound')}</p>
                <Button variant="ghost" onClick={() => { NProgress.start(); router.push('/customers'); }} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('customers.backToCustomers')}
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Button variant="ghost" onClick={() => { NProgress.start(); router.push('/customers'); }} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> {t('customers.backToCustomers')}
            </Button>

            <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 flex flex-col bg-card border-border/60 shadow-sm">
                    <CardHeader className="flex flex-col items-center text-center pb-2">
                        <Avatar className="h-24 w-24 mb-4 text-3xl border-2 border-primary/20">
                            <AvatarFallback className="bg-primary/5 text-primary">
                                {displayCustomer.name ? displayCustomer.name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase() : 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <CardTitle className="text-2xl font-bold">{displayCustomer.name}</CardTitle>
                        <CardDescription>{displayCustomer.email}</CardDescription>
                        {displayCustomer.phone && <CardDescription>{displayCustomer.phone}</CardDescription>}
                    </CardHeader>
                    <CardContent className="text-center flex-grow pt-4">
                        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                            {segmentBadges.length === 0 ? (
                                <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                    {t('customers.segmentRegular')}
                                </span>
                            ) : (
                                segmentBadges.map(key => (
                                    <span
                                        key={key}
                                        className={cn(
                                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                            key === 'owing'
                                                ? "bg-destructive/10 text-destructive"
                                                : key === 'vip'
                                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                                    : key === 'lapsed' || key === 'at-risk'
                                                        ? "bg-amber-100/70 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                                                        : "bg-primary/10 text-primary"
                                        )}
                                    >
                                        {t(segmentLabelKey(key))}
                                    </span>
                                ))
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-2xl font-bold">{currencySymbol}{(totalSpent || 0).toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">{t('customers.totalSpent')}</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{receipts?.length || 0}</p>
                                <p className="text-xs text-muted-foreground">{t('customers.totalOrders')}</p>
                            </div>
                            <div className="col-span-2 pt-2">
                                <Separator className="my-2" />
                                <div className={`p-3 rounded-lg flex items-center justify-between ${totalDebt > 0 ? 'bg-destructive/10 border border-destructive/20 text-destructive' : 'bg-primary/10 border border-primary/20 text-primary'}`}>
                                    <div className="text-left">
                                        <p className="text-xs font-semibold uppercase tracking-wider">{t('customers.outstandingDebt')}</p>
                                        <p className="text-xl font-black">{currencySymbol}{(totalDebt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <Wallet className="h-6 w-6 opacity-50" />
                                </div>
                                {displayCustomer.createdAt && (
                                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                        <History className="h-3.5 w-3.5 shrink-0" />
                                        {/*
                                          * One key carrying the date, not "Member since" beside a
                                          * bolded span: several of the eleven languages put the
                                          * date first, and a split sentence cannot be reordered.
                                          * The date loses its bold; the sentence stays correct.
                                          */}
                                        <span>
                                            {t('customers.memberSince', {
                                                date: format(safeToDate(displayCustomer.createdAt), 'dd MMM yyyy'),
                                            })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                        <Button variant="outline" className="w-full" onClick={() => setCustomerToEdit(displayCustomer)}>
                            <Pencil className="mr-2 h-4 w-4" /> {t('customers.editProfile')}
                        </Button>
                        {canDelete && (
                            <Button variant="destructive" className="w-full" onClick={() => setCustomerToDelete(displayCustomer)} disabled={isDeleting}>
                                <Trash2 className="mr-2 h-4 w-4" /> {t('customers.deleteCustomer')}
                            </Button>
                        )}
                    </CardFooter>
                </Card>

                {/* Insights and Quick Actions Card to fill the empty space next to the Profile Card */}
                <Card className="md:col-span-2 bg-card border-border/60 shadow-sm flex flex-col justify-between">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            Insights & Quick Actions
                        </CardTitle>
                        <CardDescription>
                            Real-time customer statistics, product preferences, and fast sale shortcuts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                        {/* Behavioral Insights */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Behavioral Insights</h4>
                            
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                                    <div className="flex items-center gap-2.5">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">Purchase Frequency</span>
                                    </div>
                                    <span className="text-sm font-bold text-foreground">
                                        {behaviorInsights.frequencyText}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                                    <div className="flex items-center gap-2.5">
                                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">Churn Risk Status</span>
                                    </div>
                                    <span className={cn(
                                        "text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                        behaviorInsights.riskColor
                                    )}>
                                        {behaviorInsights.riskLabel}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Top Categories */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top Categories</h4>
                            
                            <div className="space-y-3">
                                {topCategories.length > 0 ? (
                                    topCategories.map(cat => (
                                        <div key={cat.name} className="space-y-1">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-medium truncate max-w-[70%]">{cat.name}</span>
                                                <span className="text-muted-foreground font-bold">{cat.percentage}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-primary rounded-full transition-all duration-500" 
                                                    style={{ width: `${cat.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center justify-center h-20 border border-dashed rounded-lg text-xs text-muted-foreground">
                                        No purchase categories on record
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="border-t border-border/40 pt-4 flex flex-col sm:flex-row gap-3">
                        <Button 
                            className="w-full flex-1" 
                            onClick={() => {
                                if (selectCustomer) selectCustomer(displayCustomer);
                                NProgress.start();
                                router.push('/sales/pos/select-products');
                            }}
                        >
                            <ShoppingBag className="mr-2 h-4 w-4" /> Start New Sale
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full flex-1"
                            onClick={() => {
                                if (selectCustomer) selectCustomer(displayCustomer);
                                toast({
                                    variant: "success",
                                    title: "Customer Selected",
                                    description: `Pre-loaded ${displayCustomer.name} for the invoice. Proceed to select products.`
                                });
                                NProgress.start();
                                router.push('/sales/pos/select-products');
                            }}
                        >
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Invoice
                        </Button>
                    </CardFooter>
                </Card>

                {/*
                    Tags, a note and the contact deep links. In the same column as the
                    profile so the "who is this person" material stays together.
                    `outstanding` is the page's own unbounded per-customer figure, not
                    the segment module's capped one.
                */}
                <div className="md:col-span-1 md:col-start-1">
                    <CustomerCrmPanel
                        customer={displayCustomer}
                        outstanding={totalDebt}
                        currencySymbol={currencySymbol}
                    />
                </div>

                <Card className="md:col-span-2 bg-card border-border/60 shadow-sm">
                    <CardHeader>
                        <CardTitle>{t('customers.purchaseHistory')}</CardTitle>
                        <CardDescription>{t('customers.purchaseHistoryDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('inventory.colProduct')}</TableHead>
                                    <TableHead className="text-center">{t('customers.colTotalQuantity')}</TableHead>
                                    <TableHead className="text-right">{t('customers.totalSpent')}</TableHead>
                                    <TableHead className="text-right">{t('customers.colLastPurchased')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {purchaseSummary && purchaseSummary.length > 0 ? purchaseSummary.map(summary => (
                                    <TableRow key={summary.product.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-muted rounded-md relative flex-shrink-0">
                                                    {summary.product.imageUrl ? (
                                                        <Image src={summary.product.imageUrl} alt={summary.product.name} fill className="object-cover rounded-md" />
                                                    ) : <Package className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />}
                                                </div>
                                                <div>
                                                    <Link href={`/inventory/details?id=${summary.product.id}`} className="font-medium hover:underline">{summary.product.name}</Link>
                                                    <div className="text-xs text-muted-foreground">{summary.product.sku}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">{summary.totalQuantity || 0}</TableCell>
                                        <TableCell className="text-right">{currencySymbol}{(summary.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                        <TableCell className="text-right">{summary.lastPurchase ? format(summary.lastPurchase, 'PP') : t('customers.notAvailable')}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={4} className="text-center h-24">{t('customers.noPurchases')}</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* ADVANCED DEBT TRACKING */}
                <Card className="border-destructive/20 bg-card shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle className="flex items-center gap-2"><History className="text-destructive h-5 w-5" /> {t('customers.debtLedger')}</CardTitle>
                            <CardDescription>{t('customers.debtLedgerDesc')}</CardDescription>
                        </div>
                        {totalDebt > 0 && <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />}
                    </CardHeader>
                    <CardContent>
                        {unpaidReceipts.length > 0 ? (
                            <div className="space-y-4">
                                {unpaidReceipts.map(receipt => (
                                    <div key={receipt.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-transparent hover:border-destructive/30 transition-all">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm">{receipt.receiptNumber}</span>
                                            <span className="text-[10px] text-muted-foreground">{format(safeToDate(receipt.createdAt), 'PPp')}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <span className="font-bold text-destructive">{currencySymbol}{(receipt.total || 0).toLocaleString()}</span>
                                                <div className="text-[10px] text-muted-foreground bg-destructive/5 px-1 rounded inline-block ml-1 uppercase">{t('invoices.statusUnpaid')}</div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                <Link href={`/receipts/details?id=${receipt.id}`}><ChevronRight className="h-4 w-4" /></Link>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" className="w-full text-xs h-8 border-dashed" asChild>
                                    <Link href={`/receipts?customerId=${displayCustomer.id}`}>{t('customers.viewFullStatement')}</Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 text-center bg-primary/5 rounded-lg">
                                <CheckCircle2 className="h-8 w-8 text-primary mb-2" />
                                <p className="text-sm font-medium">{t('customers.clearAccount')}</p>
                                <p className="text-xs text-muted-foreground">{t('customers.clearAccountDesc')}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* RECEIPT HISTORY */}
                <Card className="bg-card border-border/60 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Receipt className="text-primary h-5 w-5" /> {t('customers.recentReceipts')}</CardTitle>
                            <CardDescription>{t('customers.recentReceiptsDesc')}</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {receipts && receipts.length > 0 ? (
                            <div className="space-y-4">
                                {receipts.slice(0, 5).map(receipt => {
                                    const isUnpaid = receipt.paymentMethod === 'Invoice' && receipt.status === 'unpaid';
                                    const isPending = receipt.paymentMethod === 'Invoice' && receipt.status === 'pending';
                                    const badgeText = isUnpaid ? t('invoices.statusUnpaid') : (isPending ? t('invoices.statusPending') : t('invoices.statusPaid'));
                                    const badgeClass = isUnpaid 
                                        ? "bg-destructive/10 text-destructive" 
                                        : (isPending 
                                            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400");
                                    
                                    return (
                                        <div key={receipt.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-transparent hover:border-primary/30 transition-all">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-sm">{receipt.receiptNumber || `REC-${receipt.id.substring(0, 5).toUpperCase()}`}</span>
                                                <span className="text-[10px] text-muted-foreground">{format(safeToDate(receipt.createdAt), 'PPp')}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="font-bold text-primary">{currencySymbol}{(receipt.total || 0).toLocaleString()}</span>
                                                    <div className={cn(
                                                        "text-[10px] px-1 rounded inline-block ml-1 uppercase font-bold",
                                                        badgeClass
                                                    )}>
                                                        {badgeText}
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                    <Link href={`/receipts/details?id=${receipt.id}`}><ChevronRight className="h-4 w-4" /></Link>
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <Button variant="outline" className="w-full text-xs h-8 border-dashed" asChild>
                                    <Link href={`/receipts?customerId=${displayCustomer.id}`}>{t('customers.viewAllTransactions')}</Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 rounded-lg">
                                <FileText className="h-8 w-8 text-muted-foreground mb-2 opacity-20" />
                                <p className="text-sm font-medium">{t('customers.noReceipts')}</p>
                                <p className="text-xs text-muted-foreground">{t('customers.noReceiptsDesc')}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BrainCircuit className="text-primary" /> {t('customers.analyticsTitle')}</CardTitle>
                    <CardDescription>{t('customers.analyticsDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {!insights && !isGeneratingInsights && (
                        <div className="text-center p-8 border-2 border-dashed rounded-lg">
                            <p className="font-medium">{t('customers.analyticsReady')}</p>
                            <p className="text-sm text-muted-foreground mb-4">{t('customers.analyticsReadyDesc')}</p>
                            <Button onClick={handleGenerateInsights} disabled={isGeneratingInsights}>
                                {isGeneratingInsights ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                {t('customers.generateAnalysis')}
                            </Button>
                        </div>
                    )}
                    {isGeneratingInsights && (
                        <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    )}
                    {insights && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold mb-2 flex items-center gap-2"><Lightbulb /> {t('customers.businessSummary')}</h3>
                                <div className="text-muted-foreground prose prose-sm" dangerouslySetInnerHTML={{ __html: renderBoldSafe(insights.summary) }}></div>
                            </div>
                            <Separator />
                            <div>
                                <h3 className="font-semibold mb-2 flex items-center gap-2"><Package /> {t('customers.productSuggestions')}</h3>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    {insights.productSuggestions.map((p, i) => <li key={i}>{p}</li>)}
                                </ul>
                            </div>
                            <Separator />
                            <div>
                                <h3 className="font-semibold mb-2 flex items-center gap-2"><Bot /> {t('customers.engagementTactics')}</h3>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    {/* Not `t` as the parameter name — it would shadow the translator. */}
                                    {insights.engagementTactics.map((tactic, i) => <li key={i}>{tactic}</li>)}
                                </ul>
                            </div>
                            <Button variant="outline" onClick={handleGenerateInsights} disabled={isGeneratingInsights}>
                                {isGeneratingInsights ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                {t('customers.regenerate')}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!customerToDelete} onOpenChange={(open) => { if (!open) setCustomerToDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('customers.deleteOneConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('customers.deleteOneConfirmBody', { name: customerToDelete?.name ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting} onClick={() => setCustomerToDelete(null)}>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                if (!customerToDelete || !firestore || !currentUserProfile) {
                                    toast({
                                        variant: 'destructive',
                                        title: t('customers.deleteFailedTitle'),
                                        description: t('customers.deleteOneFailedSession'),
                                        duration: 5000,
                                    });
                                    setIsDeleting(false);
                                    return;
                                }

                                setIsDeleting(true);
                                try {
                                    // Through the queue, not a raw `deleteDoc`: the
                                    // `delete-customer` handler also decrements
                                    // `stats.totalCustomers`, which the direct delete
                                    // silently skipped — so the shop's customer count
                                    // drifted up by one on every deletion.
                                    await addToQueue({
                                        type: 'delete-customer',
                                        payload: {
                                            id: customerToDelete.id,
                                            name: customerToDelete.name,
                                            email: customerToDelete.email,
                                        },
                                    } as any);

                                    await logAuditEvent(firestore, currentUserProfile.businessId, currentUserProfile, {
                                        action: 'customer.delete',
                                        entity: { type: 'Customer', id: customerToDelete.id, name: customerToDelete.name },
                                        details: { customerName: customerToDelete.name, customerEmail: customerToDelete.email }
                                    });

                                    triggerRefresh();

                                    toast({
                                        variant: 'success',
                                        title: t('customers.deletedOneTitle'),
                                        description: t('customers.deletedOneDescription', { name: customerToDelete.name })
                                    });

                                    setCustomerToDelete(null);
                                    NProgress.start();
                                    router.push('/customers');

                                } catch (error: any) {
                                    console.error("Failed to delete customer:", error);
                                    toast({
                                        variant: 'destructive',
                                        title: t('customers.deleteFailedTitle'),
                                        description: error.message || t('customers.deleteOneFailed')
                                    });
                                } finally {
                                    setIsDeleting(false);
                                }
                            }}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <EditCustomerDialog
                isOpen={!!customerToEdit}
                onOpenChange={(open) => !open && setCustomerToEdit(null)}
                customer={customerToEdit}
            />
        </div>
    );
}
