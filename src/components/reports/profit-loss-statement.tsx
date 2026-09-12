'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, FileText, TrendingUp, TrendingDown, Coins, PieChart, Percent, ArrowUpRight, ArrowDownRight, Layers, Download } from 'lucide-react';
import type { Receipt, Product, Expense } from '@/types';
import ProfitLossChart from './profit-loss-chart';
import TopItemsPanel from './top-items-panel';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { usePOS } from '@/context/pos-context';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/context/i18n-context';

interface ProfitLossStatementProps {
    receipts: Receipt[];
    products: Product[];
    currencySymbol: string;
    expenses?: Expense[];
}

export default function ProfitLossStatement({ receipts, products, currencySymbol, expenses = [] }: ProfitLossStatementProps) {
    const { t } = useI18n();
    const financialSummary = React.useMemo(() => {
        let grossRevenue = 0;
        let totalCogs = 0;
        let totalDiscounts = 0;
        let totalItemsSold = 0;

        const categoryFinancials: Record<string, { revenue: number; cogs: number; qty: number }> = {};

        receipts.forEach(receipt => {
            let receiptDiscount = Number(receipt.discount) || 0;
            totalDiscounts += receiptDiscount;

            receipt.items.forEach(item => {
                const itemRevenue = (Number(item.price) || 0) * (Number(item.quantity) || 0);
                grossRevenue += itemRevenue;
                totalItemsSold += Number(item.quantity) || 0;

                // Match cost price from product record
                const product = products.find(p => p.id === item.productId || p.name === item.name);
                const itemCost = Number(product?.costPrice) || 0;
                const itemCogs = itemCost * (Number(item.quantity) || 0);
                totalCogs += itemCogs;

                // Category tracking
                const category = product?.category || t('inventory.uncategorized');
                if (!categoryFinancials[category]) {
                    categoryFinancials[category] = { revenue: 0, cogs: 0, qty: 0 };
                }
                categoryFinancials[category].revenue += itemRevenue;
                categoryFinancials[category].cogs += itemCogs;
                categoryFinancials[category].qty += Number(item.quantity) || 0;
            });
        });

        const grossProfit = grossRevenue - totalCogs;

        // Operating Expenses tracking
        let totalOperatingExpenses = 0;
        const expenseCategoryTotals: Record<string, number> = {};

        expenses.forEach(exp => {
            const amt = Number(exp.amount) || 0;
            totalOperatingExpenses += amt;
            const cat = String(exp.category || 'miscellaneous');
            expenseCategoryTotals[cat] = (expenseCategoryTotals[cat] || 0) + amt;
        });

        const netProfit = grossProfit - totalDiscounts - totalOperatingExpenses;
        const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;
        const netMarginPct = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

        const categoryList = Object.entries(categoryFinancials).map(([category, data]) => {
            const profit = data.revenue - data.cogs;
            const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
            return {
                category,
                revenue: data.revenue,
                cogs: data.cogs,
                profit,
                margin,
                qty: data.qty
            };
        }).sort((a, b) => b.profit - a.profit);

        return {
            grossRevenue,
            totalCogs,
            grossProfit,
            totalDiscounts,
            totalOperatingExpenses,
            expenseCategoryTotals,
            netProfit,
            grossMarginPct,
            netMarginPct,
            totalItemsSold,
            categoryList
        };
    }, [receipts, products, expenses, t]);

    const { business } = usePOS();
    const { toast } = useToast();

    const handleExportPDF = async () => {
        toast({
            title: t('reports.generatingPdf'),
            description: t('reports.generatingPdfBody'),
        });

        const doc = new jsPDF();
        
        let hasDMSans = false;
        try {
            const fontUrl = 'https://cdn.jsdelivr.net/fontsource/fonts/dm-sans@latest/latin-400-normal.ttf';
            const fontResponse = await fetch(fontUrl);
            if (fontResponse.ok) {
                const buffer = await fontResponse.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = window.btoa(binary);
                doc.addFileToVFS('DMSans.ttf', base64);
                doc.addFont('DMSans.ttf', 'DMSans', 'normal');
                doc.setFont('DMSans');
                hasDMSans = true;
            }
        } catch (e) {
            console.warn('Could not load font.', e);
        }

        const formatCurrencyForPDF = (amount: number) => {
            const prefix = hasDMSans && currencySymbol === '₦' ? '₦' : currencySymbol;
            return `${prefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };

        doc.setTextColor(242, 242, 242);
        doc.setFontSize(80);
        doc.text("ZENEVA", 105, 150, { align: "center", angle: 45 });
        
        doc.setTextColor(20, 20, 20);
        doc.setFontSize(18);
        doc.text(business?.name || "Zeneva POS", 14, 18);
        
        doc.setFontSize(12);
        doc.setTextColor(60, 60, 60);
        doc.text("Advanced Profit & Loss Statement", 14, 25);
        
        doc.setFontSize(9);
        doc.setTextColor(110, 110, 110);
        doc.text(`Generated: ${format(new Date(), 'EEEE, MMMM d, yyyy')}`, 14, 31);

        /*
         * The PDF body stays English, deliberately, and this is a font limitation rather
         * than an oversight. The embedded face is DM Sans `latin-400-normal.ttf` — the Latin
         * subset — and when that fetch fails jsPDF falls back to built-in Helvetica, which is
         * WinAnsi-encoded. Neither carries a Korean, Japanese, Chinese or Arabic glyph, so a
         * translated statement would export as blank boxes: worse than English, not better.
         * Shipping this properly means bundling a CJK/Arabic face per locale (~5-15MB each),
         * which is its own decision.
         *
         * `didParseCell` below also string-matches these labels to bold the section rows, so
         * translating them in place would silently lose the styling as well.
         */
        const tableColumn = ["Financial Line Item", "Amount", "% of Gross Revenue"];
        const netSales = financialSummary.grossRevenue - financialSummary.totalDiscounts;
        const tableRows = [
            ["Revenue", "", ""],
            ["  Gross Sales Revenue", formatCurrencyForPDF(financialSummary.grossRevenue), "100.0%"],
            ["  Less: Discounts & Price Markdowns", `(${formatCurrencyForPDF(financialSummary.totalDiscounts)})`, `${financialSummary.grossRevenue > 0 ? ((financialSummary.totalDiscounts / financialSummary.grossRevenue) * 100).toFixed(1) : '0.0'}%`],
            ["Net Sales Revenue", formatCurrencyForPDF(netSales), `${financialSummary.grossRevenue > 0 ? ((netSales / financialSummary.grossRevenue) * 100).toFixed(1) : '0.0'}%`],
            ["", "", ""],
            ["Cost of Goods Sold (COGS)", "", ""],
            ["  Total Cost of Goods Sold", `(${formatCurrencyForPDF(financialSummary.totalCogs)})`, `${financialSummary.grossRevenue > 0 ? ((financialSummary.totalCogs / financialSummary.grossRevenue) * 100).toFixed(1) : '0.0'}%`],
            ["", "", ""],
            ["Gross Profit", formatCurrencyForPDF(financialSummary.grossProfit), `${financialSummary.grossMarginPct.toFixed(1)}%`],
            ["", "", ""],
            ["Operating Expenses", "", ""],
            ...Object.entries(financialSummary.expenseCategoryTotals).map(([cat, amt]) => [
                `  ${cat.replace(/_/g, ' ')}`,
                `(${formatCurrencyForPDF(amt)})`,
                `${financialSummary.grossRevenue > 0 ? ((amt / financialSummary.grossRevenue) * 100).toFixed(1) : '0.0'}%`
            ]),
            ["  Total Operating Expenses", `(${formatCurrencyForPDF(financialSummary.totalOperatingExpenses)})`, `${financialSummary.grossRevenue > 0 ? ((financialSummary.totalOperatingExpenses / financialSummary.grossRevenue) * 100).toFixed(1) : '0.0'}%`],
            ["", "", ""],
            ["Net Operating Profit", formatCurrencyForPDF(financialSummary.netProfit), `${financialSummary.netMarginPct.toFixed(1)}%`]
        ];

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 38,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 4 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            didParseCell: function(data) {
                if (data.row.raw[0] === "Revenue" || data.row.raw[0] === "Cost of Goods Sold (COGS)" || data.row.raw[0] === "Operating Expenses") {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
                if (data.row.raw[0] === "Net Sales Revenue" || data.row.raw[0] === "Gross Profit" || data.row.raw[0] === "Net Operating Profit") {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.textColor = [15, 23, 42];
                    if (data.row.raw[0] === "Net Operating Profit") {
                        data.cell.styles.fillColor = [230, 245, 230];
                    }
                }
            }
        });

        doc.save(`zeneva-profit-loss-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        toast({
            variant: 'success',
            title: t('reports.exportSuccessful'),
            description: t('reports.plsExportedBody'),
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 px-2 lg:px-6">
            {/* Executive P&L Key Metrics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border border-border/60 bg-gradient-to-br from-card to-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">{t('reports.plsGrossRevenue')}</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{currencySymbol}{financialSummary.grossRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <p className="text-xs text-muted-foreground mt-1">{t('reports.plsGrossRevenueHint')}</p>
                    </CardContent>
                </Card>

                <Card className="border border-border/60 bg-gradient-to-br from-card to-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">{t('reports.plsCogs')}</CardTitle>
                        <FileText className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{currencySymbol}{financialSummary.totalCogs.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <p className="text-xs text-muted-foreground mt-1">{t('reports.plsCogsHint')}</p>
                    </CardContent>
                </Card>

                <Card className="border border-border/60 bg-gradient-to-br from-card to-muted/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">{t('reports.colGrossProfit')}</CardTitle>
                        <Coins className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{currencySymbol}{financialSummary.grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                {t('reports.plsMarginPct', {
                                    pct: financialSummary.grossMarginPct.toFixed(1),
                                })}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{t('reports.plsNetOperatingIncome')}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {currencySymbol}{financialSummary.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">
                            {t('reports.plsNetMarginPct', {
                                pct: financialSummary.netMarginPct.toFixed(1),
                            })}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Comprehensive Visual Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                    <ProfitLossChart receipts={receipts} currencySymbol={currencySymbol} />
                </div>
                <div className="lg:col-span-2">
                    {/*
                        Swapped from the old `TopProductsChart`, which capped at five,
                        keyed its aggregation on the display name (merging two products
                        that share a name) and could only rank by units. On a Profit &
                        Loss tab, ranking by profit is the whole point.
                    */}
                    <TopItemsPanel
                        receipts={receipts}
                        products={products}
                        kind="product"
                        currencySymbol={currencySymbol}
                    />
                </div>
            </div>

            {/* Formal Income Statement Table */}
            <Card className="border border-border/50">
                <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10 pb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" /> {t('reports.plsTitle')}
                        </CardTitle>
                        <CardDescription className="mt-1">
                            {t('reports.plsSubtitle')}
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExportPDF} className="hidden sm:flex">
                        <Download className="mr-2 h-4 w-4" /> {t('reports.plsExportStatement')}
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-transparent">
                                <TableHead className="font-semibold text-foreground">{t('reports.plsColLineItem')}</TableHead>
                                <TableHead className="text-right font-semibold text-foreground">{t('reports.plsColAmount', { symbol: currencySymbol })}</TableHead>
                                <TableHead className="text-right font-semibold text-foreground">{t('reports.plsColPctGross')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Revenue Section */}
                            <TableRow className="bg-muted/20">
                                <TableCell colSpan={3} className="font-bold text-foreground py-2 text-xs uppercase tracking-wider">{t('reports.colRevenue')}</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-muted/30">
                                <TableCell className="ps-8 font-medium">{t('reports.plsGrossSalesRevenue')}</TableCell>
                                <TableCell className="text-right font-medium">{financialSummary.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">100.0%</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-muted/30">
                                <TableCell className="ps-8 text-muted-foreground">{t('reports.plsLessDiscounts')}</TableCell>
                                <TableCell className="text-right font-medium text-destructive">({financialSummary.totalDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2 })})</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                    {financialSummary.grossRevenue > 0 ? ((financialSummary.totalDiscounts / financialSummary.grossRevenue) * 100).toFixed(1) : '0.0'}%
                                </TableCell>
                            </TableRow>
                            <TableRow className="font-semibold border-b border-muted">
                                <TableCell className="ps-4">{t('reports.plsNetSalesRevenue')}</TableCell>
                                <TableCell className="text-right">{((financialSummary.grossRevenue) - (financialSummary.totalDiscounts)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                    {financialSummary.grossRevenue > 0 ? (((financialSummary.grossRevenue - financialSummary.totalDiscounts) / financialSummary.grossRevenue) * 100).toFixed(1) : '0.0'}%
                                </TableCell>
                            </TableRow>

                            {/* COGS Section */}
                            <TableRow className="bg-muted/20">
                                <TableCell colSpan={3} className="font-bold text-foreground py-2 text-xs uppercase tracking-wider">{t('reports.plsCogs')}</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-muted/30">
                                <TableCell className="ps-8 text-muted-foreground">{t('reports.plsTotalCogs')}</TableCell>
                                <TableCell className="text-right font-medium text-amber-600">({financialSummary.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2 })})</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                    {financialSummary.grossRevenue > 0 ? ((financialSummary.totalCogs / financialSummary.grossRevenue) * 100).toFixed(1) : '0.0'}%
                                </TableCell>
                            </TableRow>
                            <TableRow className="font-bold border-y border-muted bg-indigo-50/30 dark:bg-indigo-950/10">
                                <TableCell className="ps-4 text-indigo-700 dark:text-indigo-300">{t('reports.colGrossProfit')}</TableCell>
                                <TableCell className="text-right text-indigo-700 dark:text-indigo-300">{financialSummary.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right font-mono text-indigo-700 dark:text-indigo-300">{financialSummary.grossMarginPct.toFixed(1)}%</TableCell>
                            </TableRow>

                            {/* Expenses Section */}
                            <TableRow className="bg-muted/20">
                                <TableCell colSpan={3} className="font-bold text-foreground py-2 text-xs uppercase tracking-wider">{t('reports.plsOperatingExpenses')}</TableCell>
                            </TableRow>
                            {Object.entries(financialSummary.expenseCategoryTotals).length > 0 ? (
                                Object.entries(financialSummary.expenseCategoryTotals).map(([cat, amt]) => (
                                    <TableRow key={cat} className="hover:bg-muted/30">
                                        <TableCell className="ps-8 text-muted-foreground capitalize">{cat.replace(/_/g, ' ')}</TableCell>
                                        <TableCell className="text-right font-medium text-rose-600 dark:text-rose-400">({amt.toLocaleString(undefined, { minimumFractionDigits: 2 })})</TableCell>
                                        <TableCell className="text-right font-mono text-muted-foreground">
                                            {financialSummary.grossRevenue > 0 ? ((amt / financialSummary.grossRevenue) * 100).toFixed(1) : '0.0'}%
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : null}
                            <TableRow className="hover:bg-muted/30 font-medium">
                                <TableCell className="ps-8 text-foreground">{t('reports.plsTotalOperatingExpenses')}</TableCell>
                                <TableCell className="text-right font-bold text-rose-600 dark:text-rose-400">
                                    ({financialSummary.totalOperatingExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                                </TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                    {financialSummary.grossRevenue > 0 ? ((financialSummary.totalOperatingExpenses / financialSummary.grossRevenue) * 100).toFixed(1) : '0.0'}%
                                </TableCell>
                            </TableRow>
                            
                            {/* Net Profit Section */}
                            <TableRow className="font-black text-base border-t-2 border-primary/20 bg-emerald-50/50 dark:bg-emerald-950/20">
                                <TableCell className="font-black text-emerald-700 dark:text-emerald-400 py-4">{t('reports.plsNetOperatingProfit')}</TableCell>
                                <TableCell className="text-right font-black text-emerald-700 dark:text-emerald-400 py-4">{financialSummary.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 py-4">{financialSummary.netMarginPct.toFixed(1)}%</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Category Profitability Breakdown */}
            <Card className="border border-border/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" /> {t('reports.plsHeatmapTitle')}
                    </CardTitle>
                    <CardDescription>
                        {t('reports.plsHeatmapSubtitle')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-transparent">
                                <TableHead className="font-semibold">{t('inventory.category')}</TableHead>
                                <TableHead className="text-center font-semibold">{t('dashboard.unitsSold')}</TableHead>
                                <TableHead className="text-right font-semibold">{t('reports.colRevenue')}</TableHead>
                                <TableHead className="text-right font-semibold">{t('reports.colCogs')}</TableHead>
                                <TableHead className="text-right font-semibold">{t('reports.colGrossProfit')}</TableHead>
                                <TableHead className="text-center font-semibold">{t('reports.plsProfitMargin')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {financialSummary.categoryList.length > 0 ? (
                                financialSummary.categoryList.map(cat => (
                                    <TableRow key={cat.category} className="hover:bg-muted/30">
                                        <TableCell className="font-medium text-foreground">{cat.category}</TableCell>
                                        <TableCell className="text-center font-mono">{cat.qty}</TableCell>
                                        <TableCell className="text-right font-medium">{currencySymbol}{cat.revenue.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">{currencySymbol}{cat.cogs.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-bold text-indigo-600 dark:text-indigo-400">{currencySymbol}{cat.profit.toLocaleString()}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge 
                                                variant="outline"
                                                className={cat.margin >= 40 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : cat.margin >= 20 ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}
                                            >
                                                {cat.margin.toFixed(1)}%
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        {t('reports.plsHeatmapEmpty')}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
