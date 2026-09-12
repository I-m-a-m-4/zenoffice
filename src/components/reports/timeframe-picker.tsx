'use client';

import * as React from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '@/context/i18n-context';

export type Timeframe = 'today' | '7d' | '30d' | '90d' | 'all';

interface TimeframePickerProps {
    value: Timeframe;
    onValueChange: (value: Timeframe) => void;
}

const ORDER: Timeframe[] = ['today', '7d', '30d', '90d', 'all'];

export function TimeframePicker({ value, onValueChange }: TimeframePickerProps) {
    const { t } = useI18n();

    const labels: Record<Timeframe, string> = {
        today: t('reports.drToday'),
        '7d': t('reports.tfLast7d'),
        '30d': t('reports.tfLast30d'),
        '90d': t('reports.tf90Days'),
        all: t('reports.tfLifetime'),
    };

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[100px] h-8 text-[11px] px-2.5 justify-between font-normal bg-background border-input">
                    {labels[value]}
                    <ChevronDown className="h-3 w-3 opacity-50 ml-1 shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                {ORDER.map(tf => (
                    <DropdownMenuItem key={tf} onClick={() => onValueChange(tf)} className="text-[11px]">
                        {labels[tf]}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
