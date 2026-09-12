

"use client"

import *as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, XAxis, YAxis, Bar, CartesianGrid, ResponsiveContainer } from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import { TrendingUp, Bot } from "lucide-react";
import type { Receipt } from '@/types';
import { safeToDate } from '@/lib/utils';

const chartConfig = {
  totalSales: {
    label: "Total Sales",
    color: "#ea580c", // Zeneva Orange
  },
} satisfies ChartConfig;

interface OverviewChartProps {
  receipts: Receipt[];
  currencySymbol: string;
  data?: { month: string, totalSales: number }[];
}

export default function OverviewChart({ receipts, currencySymbol, data }: OverviewChartProps) {
  const chartData = React.useMemo(() => {
    if (data) return data;
    
    const monthlySales: Record<string, number> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentYear = new Date().getFullYear();

    (receipts || []).forEach(receipt => {
      if (!receipt) return;
      const date = safeToDate(receipt.createdAt);
      if (isNaN(date.getTime())) return;
      
      const year = date.getFullYear();
      if (year === currentYear) {
        const monthName = monthNames[date.getMonth()];
        monthlySales[monthName] = (monthlySales[monthName] || 0) + (receipt.total || 0);
      }
    });

    return monthNames.map(month => ({
      month,
      totalSales: monthlySales[month] || 0,
    }));
  }, [receipts, data]);

  const noData = chartData.every(d => d.totalSales === 0);

  return (
    <Card className="shadow-md transition-all duration-300">
      <CardHeader>

        <CardTitle>Sales Overview</CardTitle>
        <CardDescription>Monthly sales performance for the current year.</CardDescription>
      </CardHeader>
      <CardContent>
        {noData ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground p-4">
            <TrendingUp className="h-16 w-16 opacity-50 mb-4" />
            <div className="text-sm p-2 rounded-md bg-muted/50 max-w-sm">
              <p className="font-semibold flex items-center gap-2 justify-center"><Bot className="h-4 w-4 text-primary" /> Zen AI</p>
              <p>This chart will track your revenue over time once you complete your first sale through the POS.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="min-w-[600px] md:min-w-full h-[300px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      fontSize={11}
                    />

                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={60}
                      tickFormatter={(value) => {
                        const val = Number(value);
                        if (val >= 1000000) return `${currencySymbol}${(val / 1000000).toFixed(val >= 10000000 ? 0 : 1)}M`;
                        if (val >= 1000) return `${currencySymbol}${(val / 1000).toLocaleString()}k`;
                        return `${currencySymbol}${val}`;
                      }}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" formatter={(value) => `${currencySymbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} />}
                    />
                    <Bar dataKey="totalSales" fill="#ea580c" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
