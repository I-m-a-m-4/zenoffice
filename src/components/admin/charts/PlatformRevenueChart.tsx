'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import { DollarSign } from 'lucide-react';
import { TimeframePicker, type Timeframe } from '@/components/reports/timeframe-picker';
import { subDays, startOfDay, format, eachDayOfInterval } from 'date-fns';
import type { Receipt } from '@/types';

interface PlatformRevenueChartProps {
  receipts: Receipt[];
}

export default function PlatformRevenueChart({ receipts }: PlatformRevenueChartProps) {
  const [timeframe, setTimeframe] = React.useState<Timeframe>('30d');

  const chartData = React.useMemo(() => {
    const now = new Date();
    let limitDate: Date;
    if (timeframe === 'today') limitDate = startOfDay(now);
    else if (timeframe === '7d') limitDate = subDays(now, 7);
    else if (timeframe === '30d') limitDate = subDays(now, 30);
    else if (timeframe === 'all') limitDate = subDays(now, 365); // Default to a year for 'all' in chart
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
          dailyData[dayKey] += r.total || 0;
        }
      }
    });

    return Object.entries(dailyData).map(([date, Revenue]) => ({ date, Revenue }));
  }, [receipts, timeframe]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-500" /> Platform Revenue Velocity (GMV)</CardTitle>
          <CardDescription>Combined sales across all Zeneva businesses.</CardDescription>
        </div>
        <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ReLineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(val) => `₦${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`} tick={{ fontSize: 11 }} />
            <ReTooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(val: number) => [`₦${val.toLocaleString()}`, 'Revenue']}
            />
            <Line name="Revenue" type="monotone" dataKey="Revenue" stroke="hsl(var(--primary))" strokeWidth={3} dot={timeframe === '7d'} />
          </ReLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
