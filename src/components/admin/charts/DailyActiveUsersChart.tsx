'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ReferenceLine } from 'recharts';
import { Activity } from 'lucide-react';
import { TimeframePicker, type Timeframe } from '@/components/reports/timeframe-picker';
import { subDays, startOfDay, format, eachDayOfInterval } from 'date-fns';
import type { UserProfile, Receipt } from '@/types';

interface DailyActiveUsersChartProps {
  users: UserProfile[];
  receipts: Receipt[];
}

export default function DailyActiveUsersChart({ users, receipts }: DailyActiveUsersChartProps) {
  const [timeframe, setTimeframe] = React.useState<Timeframe>('30d');

  const { chartData, averageDAU } = React.useMemo(() => {
    const now = new Date();
    let limitDate: Date;
    if (timeframe === 'today') limitDate = startOfDay(now);
    else if (timeframe === '7d') limitDate = subDays(now, 7);
    else if (timeframe === '30d') limitDate = subDays(now, 30);
    else if (timeframe === 'all') limitDate = subDays(now, 365);
    else limitDate = subDays(now, 90);

    const interval = eachDayOfInterval({ start: limitDate, end: now });
    
    // Structure daily active set to store unique user IDs active per day
    const dailyActiveUsersMap: Record<string, Set<string>> = {};
    interval.forEach(day => {
      dailyActiveUsersMap[format(day, 'MMM d')] = new Set<string>();
    });

    // 1. Add users based on receipt creation dates
    receipts.forEach(r => {
      if (!r.createdAt) return;
      const date = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
      if (date >= limitDate && r.createdBy) {
        const dayKey = format(date, 'MMM d');
        if (dailyActiveUsersMap[dayKey]) {
          dailyActiveUsersMap[dayKey].add(r.createdBy);
        }
      }
    });

    // 2. Add users based on signup date (they are active on signup day)
    users.forEach(u => {
      if (!u.createdAt) return;
      const date = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
      if (date >= limitDate && u.id) {
        const dayKey = format(date, 'MMM d');
        if (dailyActiveUsersMap[dayKey]) {
          dailyActiveUsersMap[dayKey].add(u.id);
        }
      }
    });

    // 3. Add users to their last seen day
    users.forEach(u => {
      if (!u.lastSeen) return;
      const date = u.lastSeen.toDate ? u.lastSeen.toDate() : new Date(u.lastSeen);
      if (date >= limitDate && u.id) {
        const dayKey = format(date, 'MMM d');
        if (dailyActiveUsersMap[dayKey]) {
          dailyActiveUsersMap[dayKey].add(u.id);
        }
      }
    });

    // Construct chart data array
    const data = Object.entries(dailyActiveUsersMap).map(([date, userSet]) => ({
      date,
      DAU: userSet.size
    }));

    // Calculate Average DAU
    const totalDAU = data.reduce((sum, item) => sum + item.DAU, 0);
    const avg = data.length > 0 ? Math.round(totalDAU / data.length) : 0;

    return { chartData: data, averageDAU: avg };
  }, [users, receipts, timeframe]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500" /> 
            Daily Active Users (DAU)
          </CardTitle>
          <CardDescription>
            Active accounts executing actions (average: <strong className="text-emerald-600">{averageDAU} DAU</strong>).
          </CardDescription>
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
            {averageDAU > 0 && (
              <ReferenceLine 
                y={averageDAU} 
                stroke="#10b981" 
                strokeDasharray="4 4" 
                label={{ value: `Avg: ${averageDAU}`, fill: '#10b981', fontSize: 10, position: 'top' }} 
              />
            )}
            <Line name="Active Users" type="monotone" dataKey="DAU" stroke="#10b981" strokeWidth={3} dot={timeframe === '7d'} />
          </ReLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
