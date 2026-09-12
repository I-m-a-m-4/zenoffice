
"use client";

import dynamic from 'next/dynamic';
import { usePOS } from '@/context/pos-context';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

const OverviewChart = dynamic(() => import('@/components/dashboard/overview-chart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[350px]" />
});

const CategoryPieChart = dynamic(() => import('@/components/dashboard/category-pie-chart'), {
  ssr: false,
  loading: () => <Skeleton className="h-[350px]" />
});

export default function DashboardClientContent() {
    const { receipts, products, isLoading, currencySymbol } = usePOS();

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Skeleton className="h-[350px] lg:col-span-2" />
                <Skeleton className="h-[350px]" />
            </div>
        );
    }
  
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <OverviewChart receipts={receipts || []} currencySymbol={currencySymbol} />
        </div>
            <CategoryPieChart products={products || []} />
        </div>
    );
}
