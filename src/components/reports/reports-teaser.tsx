'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, Package, PieChart, ShoppingCart, Users } from 'lucide-react';

function ReportStatCard({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) {
    return (
        <Card className="bg-muted/50">
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
                <div className="text-center text-muted-foreground">
                    <PieChart className="mx-auto h-12 w-12 opacity-30" />
                    <p className="mt-2 text-sm">Upgrade to view this chart</p>
                </div>
            </CardContent>
        </Card>
    )
}

export default function ReportsTeaser() {
  return (
    <div className="flex flex-col gap-6 p-1">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <ReportStatCard title="Total Revenue" value="₦--,--" icon={DollarSign} />
        <ReportStatCard title="Total Sales" value="---" icon={ShoppingCart} />
        <ReportStatCard title="Avg. Order Value" value="₦--.--" icon={FileText} />
        <ReportStatCard title="Products Sold" value="---" icon={Package} />
        <ReportStatCard title="Total Customers" value="---" icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <PlaceholderChart title="Sales Over Time" description="Revenue performance for the selected period." />
        </div>
        <div className="lg:col-span-2">
          <PlaceholderChart title="Top Selling Products" description="Top 5 products by quantity sold." />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <PlaceholderChart title="Recent Transactions" description="A list of sales within the selected date range." />
        </div>
        <div className="lg:col-span-2">
          <PlaceholderChart title="Top Customers" description="Customers with the highest spending." />
        </div>
      </div>
    </div>
  );
}
