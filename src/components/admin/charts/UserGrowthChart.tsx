'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import { Users } from 'lucide-react';
import { TimeframePicker, type Timeframe } from '@/components/reports/timeframe-picker';
import { subDays, startOfDay, format, eachDayOfInterval } from 'date-fns';
import type { UserProfile } from '@/types';

interface UserGrowthChartProps {
  users: UserProfile[];
}

export default function UserGrowthChart({ users }: UserGrowthChartProps) {
  const [timeframe, setTimeframe] = React.useState<Timeframe>('30d');

  const chartData = React.useMemo(() => {
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

    users.forEach(u => {
      const date = u.createdAt?.toDate ? u.createdAt.toDate() : new Date(u.createdAt || 0);
      if (date >= limitDate) {
        const dayKey = format(date, 'MMM d');
        if (dailyData[dayKey] !== undefined) {
          dailyData[dayKey] += 1;
        }
      }
    });

    return Object.entries(dailyData).map(([date, users]) => ({ date, 'New Users': users }));
  }, [users, timeframe]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-500" /> User Acquisition Trend</CardTitle>
          <CardDescription>New user signups over time.</CardDescription>
        </div>
        <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ReLineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ReTooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Line name="New Users" type="monotone" dataKey="New Users" stroke="#3b82f6" strokeWidth={3} dot={timeframe === '7d'} />
          </ReLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
