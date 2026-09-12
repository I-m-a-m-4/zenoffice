
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Product, Receipt } from '@/types';
import { PackageX, TrendingDown, AlertTriangle, ArrowRight } from 'lucide-react';
import { subDays, isAfter } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/context/i18n-context';
import Link from 'next/link';

import { ScrollArea } from '@/components/ui/scroll-area';

interface DeadStockAnalysisProps {
    products: Product[];
    receipts: Receipt[];
    currencySymbol: string;
}

export default function DeadStockAnalysis({ products, receipts, currencySymbol }: DeadStockAnalysisProps) {
    const { t } = useI18n();
    const deadStock = React.useMemo(() => {
        const sixtyDaysAgo = subDays(new Date(), 60);
        
        // Find all product IDs sold in the last 60 days
        const soldProductIds = new Set<string>();
        receipts.forEach(r => {
            const date = safeToDate(r.createdAt);
            if (isAfter(date, sixtyDaysAgo)) {
                r.items.forEach(item => soldProductIds.add(item.productId));
            }
        });

        // Filter products that are in stock but haven't sold in 60 days
        return products
            .filter(p => p.categoryType !== 'service' && (p.stock || 0) > 0)
            .filter(p => !soldProductIds.has(p.id))
            .map(p => ({
                ...p,
                lockedCapital: (p.costPrice || p.price * 0.7) * p.stock // Estimate cost if missing
            }))
            .sort((a, b) => b.lockedCapital - a.lockedCapital);
    }, [products, receipts]);

    const totalLockedCapital = React.useMemo(() => {
        return deadStock.reduce((sum, p) => sum + p.lockedCapital, 0);
    }, [deadStock]);

    return (
        <Card className="shadow-md overflow-hidden w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <PackageX className="h-5 w-5 text-destructive" />
                    {t('reports.dsTitle')}
                </CardTitle>
                <CardDescription>{t('reports.dsSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
                {deadStock.length > 0 ? (
                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingDown className="h-4 w-4 text-destructive" />
                                <span className="text-sm font-semibold">{t('reports.dsLockedCapital')}</span>
                            </div>
                            <span className="text-lg font-bold text-destructive">{currencySymbol}{totalLockedCapital.toLocaleString()}</span>
                        </div>
 
                        <ScrollArea className="h-[350px]">
                            <div className="overflow-x-auto pb-2">
                                <div className="space-y-2 min-w-[500px] pr-4">
                                    {deadStock.map(product => (
                                        <div key={product.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors border">
                                            <div className="min-w-0 pr-2">
                                                <p className="text-sm font-medium truncate" title={product.name}>{product.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge variant="outline" className="text-[10px] h-4">
                                                        {product.stock} {t('reports.dsUnitsLeft')}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('reports.dsSku')} {product.sku}</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-bold text-primary">{currencySymbol}{product.lockedCapital.toLocaleString()}</p>
                                                <p className="text-[10px] text-muted-foreground whitespace-nowrap">{t('reports.dsValueLocked')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </ScrollArea>

                        <div className="pt-2">
                            <Link href="/inventory?sortBy=stock-desc" className="text-xs text-primary flex items-center gap-1 hover:underline">
                                {t('reports.dsViewInventory')} <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <div className="flex justify-center mb-3">
                            <AlertTriangle className="h-10 w-10 opacity-20" />
                        </div>
                        <p className="text-sm">{t('reports.dsEmpty')}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
