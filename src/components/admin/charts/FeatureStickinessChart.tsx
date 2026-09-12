'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Cell } from 'recharts';
import { Sparkles, Package, FileText, Zap } from 'lucide-react';
import type { BusinessInstance, Product } from '@/types';

interface FeatureStickinessChartProps {
  businesses: BusinessInstance[];
  products: Product[];
}

export default function FeatureStickinessChart({ businesses, products }: FeatureStickinessChartProps) {
  const chartData = React.useMemo(() => {
    const total = businesses.filter(b => b.status !== 'deleted').length;
    if (total === 0) return [];

    const stats = {
        'AI Analysis': 0,
        'Advanced Inventory': 0,
        'Pro Reports': 0,
        'Multiple Users': 0
    };

    const businessProductCounts = products.reduce((acc, p) => {
        acc[p.businessId] = (acc[p.businessId] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    businesses.forEach(b => {
        // AI Adoption
        if (b.settings?.businessAnalysis) stats['AI Analysis']++;
        
        // Advanced Inventory (> 50 products)
        if ((businessProductCounts[b.id] || 0) > 50) stats['Advanced Inventory']++;

        // Multiple Users (check if they have invited others - mocked for now or infer from user count per biz if available)
        // Assume if they are on Pro/Business, they are stickier with reporting
        if (b.plan === 'pro' || b.plan === 'business') stats['Pro Reports']++;
        
        // Mocking Multiple Users adoption based on plan
        if (b.plan === 'business') stats['Multiple Users']++;
    });

    return Object.entries(stats).map(([name, count]) => ({
        name,
        Adoption: (count / total) * 100,
        count
    })).sort((a, b) => b.Adoption - a.Adoption);
  }, [businesses, products]);

  const COLORS = ['#8b5cf6', '#3b82f6', '#f59e0b', '#10b981'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" /> Feature Stickiness Index
        </CardTitle>
        <CardDescription>Adoption percentage of Pro features across all businesses.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ReBarChart data={chartData} layout="vertical" margin={{ left: 40, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" unit="%" hide />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
            <ReTooltip 
                cursor={{ fill: 'transparent' }}
                formatter={(val: number) => [`${val.toFixed(1)}%`, 'Adoption']}
            />
            <Bar dataKey="Adoption" radius={[0, 4, 4, 0]} barSize={30}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </ReBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
