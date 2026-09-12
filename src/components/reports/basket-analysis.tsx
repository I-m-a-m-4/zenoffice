
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt } from '@/types';
import { ShoppingBag, Plus, ArrowRight, Zap, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/context/i18n-context';

import { TimeframePicker, type Timeframe } from './timeframe-picker';
import { subDays, startOfDay } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BasketAnalysisProps {
    receipts: Receipt[];
}

export default function BasketAnalysis({ receipts }: BasketAnalysisProps) {
    const { t } = useI18n();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [timeframe, setTimeframe] = React.useState<Timeframe>('all');

    const topSets = React.useMemo(() => {
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

        const sets: Record<string, { count: number; items: string[] }> = {};

        filteredReceipts.forEach(r => {
            if (!r.items || r.items.length < 2) return;

            const items = r.items.map(i => ({ id: i.productId, name: i.name }));
            
            // Generate unique pairs
            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const group = [items[i], items[j]].sort((a, b) => a.id.localeCompare(b.id));
                    const key = group.map(g => g.id).join('_');
                    if (!sets[key]) {
                        sets[key] = { count: 0, items: group.map(g => g.name) };
                    }
                    sets[key].count += 1;

                    // Generate unique trios
                    for (let k = j + 1; k < items.length; k++) {
                        const trio = [items[i], items[j], items[k]].sort((a, b) => a.id.localeCompare(b.id));
                        const trioKey = trio.map(g => g.id).join('_');
                        if (!sets[trioKey]) {
                            sets[trioKey] = { count: 0, items: trio.map(g => g.name) };
                        }
                        sets[trioKey].count += 1;
                    }
                }
            }
        });

        return Object.values(sets)
            .filter(set => set.count > 1) // Only show if more than 1 joint sale
            .filter(set => {
                if (!searchTerm) return true;
                return set.items.some(itemName => 
                    itemName.toLowerCase().includes(searchTerm.toLowerCase())
                );
            })
            .sort((a, b) => b.count - a.count);
    }, [receipts, searchTerm, timeframe]);

    return (
        <Card className="shadow-md overflow-hidden w-full">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-primary" />
                        {t('reports.baTitle')}
                    </CardTitle>
                    <CardDescription>{t('reports.baSubtitle')}</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder={t('inventory.searchProducts')}
                            className="pl-9 h-9 text-xs bg-muted/20 w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end">
                        <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {topSets.length > 0 ? (
                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-3">
                            <Zap className="h-5 w-5 text-primary animate-pulse" />
                            <p className="text-xs text-muted-foreground">
                                {t('reports.baHint')}
                            </p>
                        </div>

                        <ScrollArea className="h-[350px] pr-4">
                            <div className="space-y-3">
                                {topSets.map((set, index) => (
                                    <div key={index} className="relative p-3 rounded-lg border bg-background hover:border-primary/50 transition-colors mb-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                                                {set.items.map((itemName, i) => (
                                                    <React.Fragment key={i}>
                                                        <Badge variant="secondary" className="max-w-[120px] truncate bg-muted/40" title={itemName}>
                                                            {itemName}
                                                        </Badge>
                                                        {i < set.items.length - 1 && <Plus className="h-3 w-3 text-muted-foreground shrink-0" />}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                            <div className="flex-shrink-0 text-right">
                                                <p className="text-lg font-bold text-primary leading-none">{set.count}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">{t('reports.baJointSales')}</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-primary/40 rounded-full" 
                                                style={{ width: `${(set.count / topSets[0].count) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <ShoppingBag className="mx-auto h-12 w-12 opacity-20 mb-3" />
                        <p className="text-sm">
                            {searchTerm
                                ? t('reports.baEmptySearch')
                                : t('reports.baEmptyNoPairs')}
                        </p>
                        <p className="text-xs mt-1">{t('reports.baFootnote')}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
