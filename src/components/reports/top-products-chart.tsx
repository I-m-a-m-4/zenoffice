
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';
import { Package, Bot } from 'lucide-react';
import type { Receipt } from '@/types';
import type { ChartConfig } from "@/components/ui/chart";
import { TimeframePicker, type Timeframe } from './timeframe-picker';
import { subDays, startOfDay } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { usePOS } from '@/context/pos-context';

const chartConfig = {
  quantity: {
    label: "Quantity Sold",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

interface TopProductsChartProps {
    receipts: Receipt[];
}

export default function TopProductsChart({ receipts }: TopProductsChartProps) {
    const [timeframe, setTimeframe] = React.useState<Timeframe>('all');
    const { products } = usePOS();

    const chartData = React.useMemo(() => {
        let filteredReceipts = [...receipts];
        
        if (timeframe !== 'all') {
            const now = new Date();
            let limitDate: Date;
            if (timeframe === 'today') limitDate = startOfDay(now);
            else if (timeframe === '7d') limitDate = subDays(now, 7);
            else if (timeframe === '30d') limitDate = subDays(now, 30);
            else limitDate = subDays(now, 90);

            filteredReceipts = receipts.filter(r => {
                const rd = safeToDate(r.createdAt);
                return rd >= limitDate;
            });
        }

        const productSales: Record<string, number> = {};
        filteredReceipts.forEach(receipt => {
            receipt.items.forEach(item => {
                const prod = products?.find(p => p.id === item.productId || p.name === item.name);
                const isService = prod && prod.categoryType === 'service';
                if (!isService) {
                    // Check if item is a variant child — if so, display name cleanly
                    const parentProd = prod?.parentId ? products?.find(p => p.id === prod.parentId) : null;
                    const displayName = parentProd ? `${parentProd.name} (${prod?.variantValue || item.name})` : item.name;
                    productSales[displayName] = (productSales[displayName] || 0) + item.quantity;
                }
            });
        });

        return Object.entries(productSales)
            .sort(([, qtyA], [, qtyB]) => qtyB - qtyA)
            .slice(0, 5)
            .map(([name, quantity]) => ({ name, quantity }));
    }, [receipts, timeframe, products]);
    
    const noData = chartData.length === 0;

    return (
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Top Selling Products</CardTitle>
                  <CardDescription>Bestsellers by quantity sold.</CardDescription>
                </div>
                <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
            </CardHeader>
            <CardContent>
                 {noData ? (
                    <div className="h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                        <Package className="h-16 w-16 opacity-50 mb-4" />
                        <div className="text-sm p-2 rounded-md bg-muted/50 max-w-sm">
                             <p className="font-semibold flex items-center gap-2 justify-center"><Bot className="h-4 w-4 text-primary"/> Zen AI</p>
                            <p>This chart will highlight your bestsellers once you start making sales through the POS.</p>
                        </div>
                    </div>
                ) : (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                             <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                             <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={80} interval={0} style={{ fontSize: '12px' }}/>
                             <XAxis type="number" hide />
                             <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                             <Bar dataKey="quantity" fill="var(--color-quantity, #f97316)" radius={4} />
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}
