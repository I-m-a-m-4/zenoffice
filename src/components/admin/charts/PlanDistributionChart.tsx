'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip as ReTooltip, Legend } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { TimeframePicker, type Timeframe } from '@/components/reports/timeframe-picker';
import { subDays, startOfDay } from 'date-fns';
import type { BusinessInstance } from '@/types';

interface PlanDistributionChartProps {
  businesses: BusinessInstance[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

export default function PlanDistributionChart({ businesses }: PlanDistributionChartProps) {
  const [timeframe, setTimeframe] = React.useState<Timeframe>('all');

  const chartData = React.useMemo(() => {
    const now = new Date();
    let limitDate: Date | null = null;
    if (timeframe === 'today') limitDate = startOfDay(now);
    else if (timeframe === '7d') limitDate = subDays(now, 7);
    else if (timeframe === '30d') limitDate = subDays(now, 30);
    else if (timeframe === '90d') limitDate = subDays(now, 90);

    const filtered = businesses.filter(b => {
      if (!limitDate) return true;
      const date = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return date >= limitDate;
    });

    const groups: Record<string, number> = {
      'Starter': 0,
      'Pro': 0,
      'Business': 0,
      'Lifetime': 0
    };

    filtered.forEach(b => {
      if (b.accessLevel === 'lifetime') groups['Lifetime']++;
      else if (b.plan === 'business') groups['Business']++;
      else if (b.plan === 'pro') groups['Pro']++;
      else groups['Starter']++;
    });

    return [
      { name: 'Starter', value: groups['Starter'], fill: '#3b82f6' },
      { name: 'Pro', value: groups['Pro'], fill: '#10b981' },
      { name: 'Business', value: groups['Business'], fill: '#f59e0b' },
      { name: 'Lifetime', value: groups['Lifetime'], fill: '#8b5cf6' }
    ].filter(d => d.value > 0);
  }, [businesses, timeframe]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-purple-500" /> Plan Distribution</CardTitle>
          <CardDescription>Businesses created in selected period.</CardDescription>
        </div>
        <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
      </CardHeader>
      <CardContent className="flex items-center justify-center p-0">
        <ResponsiveContainer width="100%" height={300}>
          <RePieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ReTooltip />
            <Legend verticalAlign="bottom" height={36}/>
          </RePieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
