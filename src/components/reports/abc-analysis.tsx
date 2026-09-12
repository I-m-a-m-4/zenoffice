
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BarChart, Package, Search } from 'lucide-react';
import type { Product, Receipt } from '@/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, ShoppingBag, Calendar, Activity, Info, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useI18n } from '@/context/i18n-context';

interface AbcAnalysisProps {
    receipts: Receipt[];
    products: Product[];
    currencySymbol: string;
}

type ProductAnalysis = {
    id: string;
    name: string;
    revenue: number;
    quantity: number;
    orderCount: number;
    cumulativePercent: number;
    class: 'A' | 'B' | 'C';
}

export default function AbcAnalysis({ receipts, products, currencySymbol }: AbcAnalysisProps) {
    const { t } = useI18n();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedProduct, setSelectedProduct] = React.useState<ProductAnalysis | null>(null);

    const analysisData = React.useMemo(() => {
        const productDataMap: Record<string, { revenue: number, quantity: number, orderCount: number, name: string }> = {};

        receipts.forEach(receipt => {
            const productsInReceipt = new Set(receipt.items.map(i => i.productId));
            productsInReceipt.forEach(pid => {
                if (!productDataMap[pid]) {
                    const item = receipt.items.find(i => i.productId === pid);
                    const prod = products?.find(p => p.id === pid || p.name === item?.name);
                    const parentProd = prod?.parentId ? products?.find(p => p.id === prod.parentId) : null;
                    const displayName = parentProd ? `${parentProd.name} (${prod?.variantValue || item?.name})` : (item?.name || t('inventory.unknownProduct'));

                    productDataMap[pid] = { revenue: 0, quantity: 0, orderCount: 0, name: displayName };
                }
                productDataMap[pid].orderCount++;
            });
            receipt.items.forEach(item => {
                if (!productDataMap[item.productId]) {
                    const prod = products?.find(p => p.id === item.productId || p.name === item.name);
                    const parentProd = prod?.parentId ? products?.find(p => p.id === prod.parentId) : null;
                    const displayName = parentProd ? `${parentProd.name} (${prod?.variantValue || item.name})` : item.name;

                    productDataMap[item.productId] = { revenue: 0, quantity: 0, orderCount: 0, name: displayName };
                }
                productDataMap[item.productId].revenue += item.price * item.quantity;
                productDataMap[item.productId].quantity += item.quantity;
            });
        });

        const totalRevenue = Object.values(productDataMap).reduce((sum, { revenue }) => sum + revenue, 0);

        if (totalRevenue === 0) {
            return { all: [], classA: [], classB: [], classC: [] };
        }

        const sortedProducts = Object.entries(productDataMap)
            .map(([productId, data]) => ({
                id: productId,
                ...data,
            }))
            .sort((a, b) => b.revenue - a.revenue);

        let cumulativeRevenue = 0;
        const classifiedProducts: ProductAnalysis[] = sortedProducts.map(p => {
            cumulativeRevenue += p.revenue;
            const cumulativePercent = (cumulativeRevenue / totalRevenue) * 100;
            let productClass: 'A' | 'B' | 'C';
            if (cumulativePercent <= 80) {
                productClass = 'A';
            } else if (cumulativePercent <= 95) {
                productClass = 'B';
            } else {
                productClass = 'C';
            }
            return { ...p, cumulativePercent, class: productClass };
        });

        return {
            all: classifiedProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())),
            classA: classifiedProducts.filter(p => p.class === 'A' && p.name.toLowerCase().includes(searchQuery.toLowerCase())),
            classB: classifiedProducts.filter(p => p.class === 'B' && p.name.toLowerCase().includes(searchQuery.toLowerCase())),
            classC: classifiedProducts.filter(p => p.class === 'C' && p.name.toLowerCase().includes(searchQuery.toLowerCase())),
        };

    }, [receipts, products, searchQuery, t]);

    const { all, classA, classB, classC } = analysisData;
    const hasData = classA.length > 0 || classB.length > 0 || classC.length > 0;

    return (
        <Card className="border-primary/5 overflow-hidden w-full">
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className='flex items-center gap-2'><BarChart className="h-5 w-5 text-primary" /> {t('reports.abcTitle')}</CardTitle>
                        <CardDescription>
                            {t('reports.abcSubtitle')}
                        </CardDescription>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                        <Input
                            placeholder={t('inventory.searchProducts')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {hasData ? (
                    <Tabs defaultValue="all">
                        <div className="overflow-x-auto pb-2">
                            <TabsList className="flex w-max md:w-full md:grid md:grid-cols-4 mb-2">
                                <TabsTrigger value="all" className="px-4">{t('reports.abcAllProducts', { count: all.length })}</TabsTrigger>
                                <TabsTrigger value="classA" className="px-4">{t('reports.abcClassA', { count: classA.length })}</TabsTrigger>
                                <TabsTrigger value="classB" className="px-4">{t('reports.abcClassB', { count: classB.length })}</TabsTrigger>
                                <TabsTrigger value="classC" className="px-4">{t('reports.abcClassC', { count: classC.length })}</TabsTrigger>
                            </TabsList>
                        </div>
                        <TabsContent value="all">
                            <CategoryTable products={all} currencySymbol={currencySymbol} onRowClick={setSelectedProduct} />
                        </TabsContent>
                        <TabsContent value="classA">
                            <CategoryTable products={classA} currencySymbol={currencySymbol} onRowClick={setSelectedProduct} />
                        </TabsContent>
                        <TabsContent value="classB">
                            <CategoryTable products={classB} currencySymbol={currencySymbol} onRowClick={setSelectedProduct} />
                        </TabsContent>
                        <TabsContent value="classC">
                            <CategoryTable products={classC} currencySymbol={currencySymbol} onRowClick={setSelectedProduct} />
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <Package className="mx-auto h-12 w-12 opacity-50" />
                        <h3 className="mt-4 text-lg font-medium">{t('reports.abcEmptyTitle')}</h3>
                        <p className="mt-2 max-w-md mx-auto">{t('reports.abcEmptyBody')}</p>
                    </div>
                )}
            </CardContent>

            <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant={selectedProduct?.class === 'A' ? 'default' : selectedProduct?.class === 'B' ? 'secondary' : 'outline'} className={selectedProduct?.class === 'A' ? 'bg-primary' : ''}>{t('reports.abcClassBadge', { letter: selectedProduct?.class ?? '' })}</Badge>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('reports.abcProductInsight')}</span>
                        </div>
                        <DialogTitle className="text-xl font-bold">{selectedProduct?.name}</DialogTitle>
                        <DialogDescription>{t('reports.abcInsightSubtitle')}</DialogDescription>
                    </DialogHeader>

                    {selectedProduct && (
                        <div className="grid gap-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/40 p-4 rounded-xl border border-primary/5">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="h-3 w-3" /> {t('dashboard.totalRevenue')}</div>
                                    <div className="text-lg font-bold">{currencySymbol}{selectedProduct.revenue.toLocaleString()}</div>
                                </div>
                                <div className="bg-muted/40 p-4 rounded-xl border border-primary/5">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><ShoppingCart className="h-3 w-3" /> {t('reports.colOrders')}</div>
                                    <div className="text-lg font-bold">{selectedProduct.orderCount}</div>
                                </div>
                                <div className="bg-muted/40 p-4 rounded-xl border border-primary/5">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><ShoppingBag className="h-3 w-3" /> {t('dashboard.unitsSold')}</div>
                                    <div className="text-lg font-bold">{selectedProduct.quantity}</div>
                                </div>
                                <div className="bg-muted/40 p-4 rounded-xl border border-primary/5">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Activity className="h-3 w-3" /> {t('reports.abcRevShare')}</div>
                                    <div className="text-lg font-bold">{selectedProduct.cumulativePercent.toFixed(1)}% <span className="text-[10px] font-normal text-muted-foreground">{t('reports.abcCumulative')}</span></div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-primary/10 bg-primary/5">
                                <h4 className="flex items-center gap-2 text-sm font-semibold mb-2 text-primary"><Sparkles className="h-4 w-4" /> {t('reports.abcRecommendation')}</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {selectedProduct.class === 'A'
                                        ? t('reports.abcRecA')
                                        : selectedProduct.class === 'B'
                                            ? t('reports.abcRecB')
                                            : t('reports.abcRecC')}
                                </p>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedProduct(null)} className="w-full">{t('reports.abcClose')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

function CategoryTable({ products, currencySymbol, onRowClick }: { products: ProductAnalysis[], currencySymbol: string, onRowClick: (p: ProductAnalysis) => void }) {
    const { t } = useI18n();
    if (products.length === 0) {
        return <div className="text-center text-muted-foreground py-10">{t('reports.abcNoProducts')}</div>
    }
    return (
        <div className="h-[400px] overflow-auto border rounded-md">
            <div className="min-w-[600px]">
                <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead>{t('reports.colProduct')}</TableHead>
                        <TableHead className="text-center">{t('reports.colOrders')}</TableHead>
                        <TableHead className="text-right">{t('reports.colQtySold')}</TableHead>
                        <TableHead className="text-right">{t('reports.colRevenue')}</TableHead>
                        <TableHead className="text-center">{t('reports.colClass')}</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {products.map(p => (
                        <TableRow
                            key={p.id}
                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => onRowClick(p)}
                        >
                            <TableCell className="font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">{p.name}</TableCell>
                            <TableCell className="text-center">
                                <Badge variant="secondary" className="font-mono">{p.orderCount}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{p.quantity}</TableCell>
                            <TableCell className="text-right font-semibold">{currencySymbol}{p.revenue.toLocaleString()}</TableCell>
                            <TableCell className="text-center">
                                <Badge variant={p.class === 'A' ? 'default' : p.class === 'B' ? 'secondary' : 'outline'} className={p.class === 'A' ? 'bg-primary' : ''}>
                                    {p.class}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Info className="h-4 w-4 text-muted-foreground/50" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    </div>
);
}
