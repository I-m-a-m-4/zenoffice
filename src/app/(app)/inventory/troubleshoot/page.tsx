
"use client";

import type { Product } from "@/types";
import { analyseProductQuality } from "@/lib/product-quality";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePOS } from "@/context/pos-context";
import { hasProFeatures } from "@/lib/plan";
import { AlertTriangle, CheckCircle, Lightbulb, Loader2, PartyPopper, Package, FileText, DollarSign, BarChart, Zap, Edit, Flame, ShieldAlert, Info } from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function IssueDetailsDialog({ isOpen, onOpenChange, issue }: { isOpen: boolean, onOpenChange: (open: boolean) => void, issue: { title: string, items: Product[] } | null }) {
  if (!issue) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{issue.title}</DialogTitle>
          <DialogDescription>
            Found {issue.items.length} products with this issue. Click on a product to go to its edit page and resolve the issue.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96">
          <div className="space-y-2 pr-4">
            {issue.items.map(product => (
              <Link href={`/inventory/details?id=${product.id}`} key={product.id} className="block p-3 rounded-md border hover:bg-muted" onClick={() => onOpenChange(false)}>
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.sku || 'No SKU'}</p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                        <div className="flex items-center">
                            <Edit className="h-4 w-4 mr-2"/> Fix
                        </div>
                    </Button>
                </div>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function IssueCard({ icon: Icon, title, count, items, unit = "items", onFixClick }: { icon: React.ElementType, title: string, count: number, items: Product[], unit?: string, onFixClick: () => void }) {
    if (count === 0) return null;
    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Icon className="h-5 w-5 text-destructive"/>
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-3xl font-bold text-destructive">{count}</p>
                <p className="text-xs text-muted-foreground">{unit} with this issue</p>
                {items.length > 0 && (
                     <ul className="text-xs text-muted-foreground mt-4 space-y-1">
                        {items.slice(0, 2).map(p => <li key={p.id} className="truncate" title={p.name}>- {p.name}</li>)}
                        {items.length > 2 && <li>...and {items.length - 2} more</li>}
                     </ul>
                )}
            </CardContent>
            <CardFooter>
                <Button variant="secondary" className="w-full" onClick={onFixClick}>
                    <Edit className="h-4 w-4 mr-2" />
                    View & Fix
                </Button>
            </CardFooter>
        </Card>
    )
}

const severityIcons = {
    High: <Flame className="h-5 w-5 text-destructive" />,
    Medium: <ShieldAlert className="h-5 w-5 text-amber-500" />,
    Low: <Info className="h-5 w-5 text-sky-500" />,
}

export default function TroubleshootPage() {
    const { products, business, isLoading: isDataLoading, currentUserProfile, isLoading: isUserLoading, currencySymbol } = usePOS();
    const isLoading = isDataLoading || isUserLoading;
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && currentUserProfile) {
            const hasPermission = currentUserProfile.permissions?.manage_inventory ?? (currentUserProfile.role === 'admin' || currentUserProfile.role === 'manager');
            if (!hasPermission) {
                router.push('/dashboard');
            }
        }
    }, [currentUserProfile, isLoading, router]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedIssue, setSelectedIssue] = useState<{ title: string, items: Product[] } | null>(null);

    /*
     * Data quality, computed on the device.
     *
     * This used to call `productTroubleshoot`, which shipped **every product** — name,
     * description, price, category and SKU — to Gemini and asked for "the top 3-5 most
     * critical suggestions", specifically naming missing prices, poor descriptions and
     * inconsistent categorisation as what to look for.
     *
     * Two things were wrong with that. It cost 60,000+ input tokens for a 1,200-product
     * shop against a flat 2-credit charge, so it lost money on every press and lost more
     * the bigger the shop. And the page **already computed the same checks locally** — the
     * `analysis` memo below has done `!p.price`, `!p.category` and short-description checks
     * all along. Gemini was being paid to read a list and describe conclusions the page had
     * already reached.
     *
     * `analyseProductQuality` is a strict superset: it adds duplicate names, duplicate
     * barcodes, negative stock, expiry, below-cost pricing, estimated cost prices and
     * categories spelled two ways — and, unlike prose, it returns **the affected products**,
     * so every row links straight to them through `handleFixClick`. It is instant, free,
     * works offline, and cannot miscount.
     */
    const quality = useMemo(
        () => (products ? analyseProductQuality(products, { now: new Date() }) : null),
        [products],
    );
    const analysis = useMemo(() => {
        if (!products) return null;
        const productsWithoutPrice = products.filter(p => !p.price || p.price <= 0);
        const productsWithoutCategory = products.filter(p => !p.category);
        const productsWithoutDescription = products.filter(p => !p.description || p.description.length < 10);
        const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.lowStockThreshold || 5));
        
        const totalPoints = products.length * 4;
        const issuePoints = productsWithoutPrice.length + productsWithoutCategory.length + productsWithoutDescription.length + lowStockProducts.length;
        const dataQualityScore = totalPoints > 0 ? Math.round(((totalPoints - issuePoints) / totalPoints) * 100) : 100;

        return {
            productsWithoutPrice,
            productsWithoutCategory,
            productsWithoutDescription,
            lowStockProducts,
            dataQualityScore,
            totalProducts: products.length
        }
    }, [products]);

    const handleFixClick = (title: string, items: Product[]) => {
        setSelectedIssue({ title, items });
        setIsModalOpen(true);
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
    }
    
    if (!analysis || analysis.totalProducts === 0) {
         return (
             <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Inventory Health Check</CardTitle>
                </CardHeader>
                <CardContent className="text-center py-12">
                     <Package className="h-16 w-16 mx-auto text-muted-foreground/50"/>
                     <h3 className="text-xl font-semibold mt-4">No Products to Analyze</h3>
                     <p className="text-muted-foreground mt-2">Add some products to your inventory to get started.</p>
                </CardContent>
            </Card>
         )
    }

    const canUseAIFeature = hasProFeatures(business);

    const allIssues = [
        { icon: DollarSign, title: "Missing Price", count: analysis.productsWithoutPrice.length, items: analysis.productsWithoutPrice },
        { icon: BarChart, title: "Low Stock", count: analysis.lowStockProducts.length, items: analysis.lowStockProducts },
        { icon: FileText, title: "Short Description", count: analysis.productsWithoutDescription.length, items: analysis.productsWithoutDescription },
        { icon: Package, title: "Missing Category", count: analysis.productsWithoutCategory.length, items: analysis.productsWithoutCategory },
    ];
    
    const hasIssues = allIssues.some(issue => issue.count > 0);

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">Inventory Health Check</CardTitle>
                    <CardDescription>Automated analysis of your {analysis.totalProducts} products to identify potential issues.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">Overall Data Quality</span>
                            <span className="text-sm font-bold">{analysis.dataQualityScore}%</span>
                        </div>
                        <Progress value={analysis.dataQualityScore} aria-label={`${analysis.dataQualityScore}% data quality`} />
                        <p className="text-xs text-muted-foreground mt-2">A score based on data completeness and stock levels.</p>
                    </div>

                    {hasIssues ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {allIssues.map(issue => <IssueCard key={issue.title} {...issue} onFixClick={() => handleFixClick(issue.title, issue.items)} />)}
                        </div>
                    ) : (
                        <Alert variant="default" className="bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300 [&>svg]:text-green-600">
                           <CheckCircle className="h-4 w-4" />
                           <AlertTitle className="font-semibold">Excellent Data Quality!</AlertTitle>
                           <AlertDescription>All your products have prices, categories, descriptions, and healthy stock levels.</AlertDescription>
                       </Alert>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2"><Lightbulb className="text-primary"/> What needs fixing</CardTitle>
                    <CardDescription>
                        Everything Zeneva can see wrong with your product records, worst first. Tap any
                        row to see exactly which products it affects.
                    </CardDescription>
                </CardHeader>
                {/*
                  * No plan gate, and that is deliberate.
                  *
                  * This card used to be behind `canUseAIFeature` because it called Gemini. It no
                  * longer does — it is arithmetic over products the browser already has — so gating
                  * it would mean charging for `if` statements. It is also exactly what a new free
                  * shop most needs to see, and a shop whose data is in order is the one most likely
                  * to upgrade later.
                  */}
                <CardContent>
                    {!quality || quality.issues.length === 0 ? (
                        <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                            <PartyPopper className="mx-auto h-12 w-12" />
                            <p className="mt-4 font-medium">Nothing to fix</p>
                            <p className="text-sm">Every product has what Zeneva needs to report on it properly.</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
                                <div>
                                    <p className="text-2xl font-semibold leading-none">{quality.score}%</p>
                                    <p className="text-xs text-muted-foreground mt-1">of products are clean</p>
                                </div>
                                {quality.urgent > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        <span className="font-medium text-destructive">{quality.urgent.toLocaleString()}</span> need
                                        attention before they can be sold or reported on properly.
                                    </p>
                                )}
                            </div>

                            <Accordion type="multiple" className="w-full space-y-2">
                                {quality.issues.map((issue) => (
                                    <AccordionItem key={issue.id} value={issue.id} className="border-b-0 rounded-lg border bg-muted/50 px-4">
                                        <AccordionTrigger className="py-3 hover:no-underline">
                                            <div className="flex items-center gap-3 text-start">
                                                {severityIcons[issue.severity === 'high' ? 'High' : issue.severity === 'medium' ? 'Medium' : 'Low']}
                                                <span className="font-medium text-base">{issue.title}</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-4 space-y-3">
                                            <p className="text-muted-foreground">{issue.detail}</p>
                                            {typeof issue.amountAtRisk === 'number' && issue.amountAtRisk > 0 && (
                                                <p className="text-sm font-medium">
                                                    {currencySymbol}{Math.round(issue.amountAtRisk).toLocaleString()} of stock is involved.
                                                </p>
                                            )}
                                            {/*
                                              * The thing prose could never do: name the products.
                                              * The old AI answer said "some products are missing prices";
                                              * this opens the list of them.
                                              */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleFixClick(issue.title, issue.products)}
                                            >
                                                {issue.action} ({issue.products.length.toLocaleString()})
                                            </Button>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </>
                    )}
                </CardContent>
            </Card>

            <IssueDetailsDialog 
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                issue={selectedIssue}
            />
        </div>
    );
}
