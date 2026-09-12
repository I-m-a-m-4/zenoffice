
'use client';

import * as React from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    AlertCircle,
    Package,
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Receipt,
    Search,
    Info,
    RefreshCw,
    Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { usePOS } from '@/context/pos-context';
import { useI18n } from '@/context/i18n-context';
import { cn } from '@/lib/utils';
import SummaryCard from '@/components/dashboard/summary-card';
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { format } from 'date-fns';



export default function DebtsPage() {
    const { 
        products, 
        receipts, 
        onlineOrders, 
        currencySymbol, 
        isLoading: isDataLoading, 
        triggerRefresh,
        currentUserProfile,
        isLoading: isUserLoading
    } = usePOS();
    const router = useRouter();
    const { t } = useI18n();
    const isLoading = isDataLoading || isUserLoading;

    React.useEffect(() => {
        if (!isLoading && currentUserProfile) {
            const hasPermission = currentUserProfile.permissions?.manage_inventory ?? (currentUserProfile.role === 'admin' || currentUserProfile.role === 'manager');
            if (!hasPermission) {
                router.push('/dashboard');
            }
        }
    }, [currentUserProfile, isLoading, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const hasDebtPermission = currentUserProfile?.permissions?.manage_inventory ?? (currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'manager');
    if (!hasDebtPermission) {
        return null; // Effect will handle redirect
    }
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [selectedProductOrders, setSelectedProductOrders] = React.useState<any[] | null>(null);
    const [viewingProductName, setViewingProductName] = React.useState('');
    const [viewingProductId, setViewingProductId] = React.useState('');

    const handleRefresh = React.useCallback(() => {
        setIsRefreshing(true);
        triggerRefresh();
        setTimeout(() => setIsRefreshing(false), 1500);
    }, [triggerRefresh]);

    const debtProducts = React.useMemo(() => {
        if (!products) return [];
        return products
            .filter(p => p.categoryType !== 'service' && (p.stock || 0) < 0)
            .filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
            )
            .sort((a, b) => (a.stock || 0) - (b.stock || 0)); // Most negative first
    }, [products, searchTerm]);

    const totalDebtItems = React.useMemo(() => {
        return debtProducts.reduce((acc, p) => acc + Math.abs(p.stock || 0), 0);
    }, [debtProducts]);

    const totalDebtValue = React.useMemo(() => {
        return debtProducts.reduce((acc, p) => acc + (Math.abs(p.stock || 0) * p.price), 0);
    }, [debtProducts]);

    const potentialRevenue = React.useMemo(() => {
        return debtProducts.reduce((acc, p) => acc + (Math.abs(p.stock || 0) * (p.price - (p.costPrice || 0))), 0);
    }, [debtProducts]);

    if (isLoading) {
        return (
            <div className="flex flex-col h-full w-full space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                    <Skeleton className="h-9 w-32" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i} className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-5 w-5" />
                            </div>
                            <Skeleton className="h-8 w-16 mb-2" />
                            <Skeleton className="h-4 w-32" />
                        </Card>
                    ))}
                </div>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
                    <CardContent className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('inventory.debtTitle')}</h1>
                        <p className="text-muted-foreground">{t('inventory.debtSubtitle')}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {t('common.refresh')}
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                        <Link href="/inventory">{t('inventory.debtViewAllInventory')}</Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                    title={t('inventory.debtTotalItemsOwed')}
                    value={totalDebtItems}
                    icon={Package}
                    description={t('inventory.debtUnitsToFulfil')}
                    href="/inventory"
                />
                <SummaryCard
                    title={t('inventory.debtValue')}
                    value={`${currencySymbol}${totalDebtValue.toLocaleString()}`}
                    icon={DollarSign}
                    description={t('inventory.debtValueDesc')}
                />
                <SummaryCard
                    title={t('inventory.debtPotentialProfit')}
                    value={`${currencySymbol}${potentialRevenue.toLocaleString()}`}
                    icon={TrendingUp}
                    description={t('inventory.debtPotentialProfitDesc')}
                />
                <SummaryCard
                    title={t('inventory.debtDemandIndex')}
                    value={t('inventory.debtDemandHigh')}
                    icon={ShoppingCart}
                    description={t('inventory.debtDemandBasis', { count: debtProducts.length })}
                />
            </div>

            <Card className="border-none shadow-premium bg-background/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b pb-6">
                    <div className="space-y-1">
                        <CardTitle>{t('inventory.debtBackorderedProducts')}</CardTitle>
                        <CardDescription>{t('inventory.debtBackorderedProductsDesc')}</CardDescription>
                    </div>
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t('inventory.debtSearchPlaceholder')}
                            className="pl-9 bg-muted/20 border-muted/50 focus:bg-background transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="font-semibold">{t('inventory.colProduct')}</TableHead>
                                <TableHead className="font-semibold">SKU</TableHead>
                                <TableHead className="font-semibold">{t('inventory.debtColUnitsOwed')}</TableHead>
                                <TableHead className="font-semibold text-right">{t('inventory.debtValue')}</TableHead>
                                <TableHead className="font-semibold text-center">{t('inventory.debtColSeverity')}</TableHead>
                                <TableHead className="font-semibold text-right">{t('common.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {debtProducts.length > 0 ? (
                                debtProducts.map((product) => {
                                    const debtCount = Math.abs(product.stock || 0);
                                    const debtValue = debtCount * product.price;
                                    // The rung is picked here and translated at render — the four
                                    // labels are adjectives, and several of the eleven languages
                                    // inflect them, so each rung is its own key rather than one
                                    // key with a word substituted in.
                                    let severity = t('inventory.debtSeverityLow');
                                    let severityColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";

                                    if (debtCount > 10) {
                                        severity = t('inventory.debtSeverityCritical');
                                        severityColor = "bg-red-500/10 text-red-500 border-red-500/20";
                                    } else if (debtCount > 5) {
                                        severity = t('inventory.debtSeverityHigh');
                                        severityColor = "bg-orange-500/10 text-orange-500 border-orange-500/20";
                                    } else if (debtCount > 2) {
                                        severity = t('inventory.debtSeverityMedium');
                                        severityColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                                    }

                                    return (
                                        <TableRow key={product.id} className="hover:bg-muted/10 transition-colors">
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{product.name}</span>
                                                    <span className="text-xs text-muted-foreground">{product.category}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-mono text-muted-foreground">{product.sku}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="destructive" className="font-mono">{product.stock}</Badge>
                                                    <span className="text-xs text-muted-foreground">{t('inventory.debtUnitsParen', { count: debtCount })}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {currencySymbol}{debtValue.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={cn("rounded-full px-3", severityColor)}>
                                                    {severity}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right flex items-center justify-end gap-2 p-4">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        const debtToFulfill = Math.abs(product.stock || 0);
                                                        const offlineOrders = (receipts || []).filter(r => r.items.some(item => item.productId === product.id));
                                                        const onlineSales = (onlineOrders || []).filter(o => o.items.some(item => item.productId === product.id));

                                                        // Combine and sort by date descending (newest first)
                                                        const allOrders = [
                                                            ...offlineOrders.map(o => ({ ...o, orderType: 'In-store' })),
                                                            ...onlineSales.map(o => ({ ...o, orderType: 'Online', customer: { name: o.customerName, email: o.customerEmail } }))
                                                        ].sort((a, b) => {
                                                            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                                                            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                                                            return dateB.getTime() - dateA.getTime();
                                                        });

                                                        // Filter only those that contributed to the debt
                                                        let runningTotal = 0;
                                                        const debtContributingOrders = [];

                                                        for (const order of allOrders) {
                                                            if (runningTotal >= debtToFulfill) break;

                                                            const item = order.items.find((it: any) => it.productId === product.id);
                                                            if (item) {
                                                                const qtyInThisOrder = item.quantity || 1;
                                                                runningTotal += qtyInThisOrder;
                                                                debtContributingOrders.push(order);
                                                            }
                                                        }

                                                        setSelectedProductOrders(debtContributingOrders);
                                                        setViewingProductName(product.name);
                                                        setViewingProductId(product.id);
                                                    }}
                                                >
                                                    <Receipt className="h-3.5 w-3.5 mr-1" />
                                                    {t('inventory.debtDetails')}
                                                </Button>
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/inventory/details?id=${product.id}`}>{t('common.edit')}</Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                                <AlertCircle className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                            <p className="text-muted-foreground font-medium">{t('inventory.debtNoneFound')}</p>
                                            <p className="text-sm text-muted-foreground max-w-xs">{t('inventory.debtNoneFoundHint')}</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                {debtProducts.length > 0 && (
                    <CardFooter className="py-4 border-t bg-muted/10 justify-center">
                        <p className="text-xs text-muted-foreground italic flex items-center gap-2">
                            <TrendingUp className="h-3 w-3" />
                            {t('inventory.debtFooterNote')}
                        </p>
                    </CardFooter>
                )}
            </Card>

            <Dialog open={!!selectedProductOrders} onOpenChange={(open) => !open && setSelectedProductOrders(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('inventory.debtHistoryTitle', { product: viewingProductName })}</DialogTitle>
                        <DialogDescription>
                            {t('inventory.debtHistoryDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        <ScrollArea className="h-[400px] pr-4">
                            <div className="space-y-4">
                                {selectedProductOrders && selectedProductOrders.length > 0 ? (
                                    selectedProductOrders.map((order, i) => {
                                        const item = order.items.find((it: any) => it.productId === viewingProductId);
                                        return (
                                            <div key={order.id || i} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                                                <div className="space-y-1">
                                                    <p className="font-semibold text-sm">
                                                        {order.customer?.name || t('pos.walkIn')}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {order.customer?.email || t('inventory.debtNoEmail')}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                        {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'PPP p') : format(new Date(order.createdAt), 'PPP p')}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-sm text-primary">
                                                        {t('inventory.debtUnits', { count: item?.quantity || 1 })}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {currencySymbol}{(item?.price * (item?.quantity || 1)).toLocaleString()}
                                                    </p>
                                                    <div className="flex flex-wrap gap-1 mt-1 justify-end">
                                                        <Badge variant="outline" className="text-[10px] h-4">
                                                            {order.paymentMethod || (order.orderType === 'Online' ? 'Paystack' : t('pos.cash'))}
                                                        </Badge>
                                                        {/*
                                                          * `orderType` is compared against above ('Online'), so the
                                                          * stored value stays English and only the badge translates.
                                                          */}
                                                        <Badge variant="secondary" className="text-[10px] h-4">
                                                            {order.orderType === 'Online' ? t('common.online') : t('inventory.debtOrderTypeInStore')}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-muted-foreground">{t('inventory.debtNoRecentOrders')}</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
