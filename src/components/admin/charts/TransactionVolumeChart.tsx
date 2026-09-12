'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import { ShoppingCart } from 'lucide-react';
import { TimeframePicker, type Timeframe } from '@/components/reports/timeframe-picker';
import { subDays, startOfDay, format, eachDayOfInterval } from 'date-fns';
import type { Receipt } from '@/types';

interface TransactionVolumeChartProps {
  receipts: Receipt[];
}

export default function TransactionVolumeChart({ receipts }: TransactionVolumeChartProps) {
  const [timeframe, setTimeframe] = React.useState<Timeframe>('30d');

  const { chartData, averageSales } = React.useMemo(() => {
    const now = new Date();
    let limitDate: Date;
    if (timeframe === 'today') limitDate = startOfDay(now);
    else if (timeframe === '7d') limitDate = subDays(now, 7);
    else if (timeframe === '30d') limitDate = subDays(now, 30);
    else if (timeframe === 'all') limitDate = subDays(now, 365);
    else limitDate = subDays(now, 90);

    const interval = eachDayOfInterval({ start: limitDate, end: now });
    const dailyData: Record<string, number> = {};
    
    interval.forEach(day => {
      dailyData[format(day, 'MMM d')] = 0;
    });

    receipts.forEach(r => {
      const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      if (date >= limitDate) {
        const dayKey = format(date, 'MMM d');
        if (dailyData[dayKey] !== undefined) {
          dailyData[dayKey] += 1;
        }
      }
    });

    const dataArray = Object.entries(dailyData).map(([date, count]) => ({ date, Sales: count }));
    const totalSales = dataArray.reduce((acc, curr) => acc + curr.Sales, 0);
    const average = dataArray.length > 0 ? totalSales / dataArray.length : 0;

    return { chartData: dataArray, averageSales: average };
  }, [receipts, timeframe]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-orange-500" /> 
              Transaction Volume
            </CardTitle>
            <div className="text-right mr-4">
              <span className="text-2xl font-bold">{averageSales.toFixed(1)}</span>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Avg Sales / Day</p>
            </div>
          </div>
          <CardDescription>Daily number of receipts generated platform-wide.</CardDescription>
        </div>
        <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ReBarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ReTooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Bar name="Sales" dataKey="Sales" fill="#f97316" radius={[4, 4, 0, 0]} />
          </ReBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
