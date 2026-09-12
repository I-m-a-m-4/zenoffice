
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Award } from 'lucide-react';
import type { Receipt } from '@/types';
import Link from 'next/link';
import { Button } from '../ui/button';

import { TimeframePicker, type Timeframe } from './timeframe-picker';
import { subDays, startOfDay } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';

interface TopCustomersListProps {
  receipts: Receipt[];
  currencySymbol: string;
}

export default function TopCustomersList({ receipts, currencySymbol }: TopCustomersListProps) {
  const { t } = useI18n();
  const [timeframe, setTimeframe] = React.useState<Timeframe>('all');

  const customerData = React.useMemo(() => {
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

    const customerStats: Record<string, { name: string; email: string, sales: number; totalSpent: number }> = {};
    
    filteredReceipts.forEach(receipt => {
      if (receipt.customer) {
        const id = receipt.customer.id;
        if (!customerStats[id]) {
          customerStats[id] = { name: receipt.customer.name, email: receipt.customer.email, sales: 0, totalSpent: 0 };
        }
        customerStats[id].sales += 1;
        customerStats[id].totalSpent += receipt.total;
      }
    });

    return Object.entries(customerStats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
  }, [receipts, timeframe]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
            <CardTitle>{t('reports.tcTitle')}</CardTitle>
            <CardDescription>{t('reports.tcSubtitle')}</CardDescription>
        </div>
        <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72">
          {customerData.length > 0 ? (
            <ul className="space-y-3">
              {customerData.map(customer => (
                <li key={customer.id} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback>{customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" title={customer.name}>{customer.name}</p>
                      <p className="text-xs text-muted-foreground truncate" title={customer.email}>{customer.email}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-primary">{currencySymbol}{customer.totalSpent.toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <Award className="h-16 w-16 opacity-50 mb-4" />
                <p className="font-medium">{t('reports.tcEmptyTitle')}</p>
                <p className="text-sm">{t('reports.tcEmptyBody')}</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
