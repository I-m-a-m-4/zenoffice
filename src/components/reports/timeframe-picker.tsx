'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type Timeframe = 'today' | '7d' | '30d' | '90d' | 'all';

const OPTIONS: { label: string; value: Timeframe }[] = [
  { label: 'Today', value: 'today' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'All', value: 'all' },
];

interface TimeframePickerProps {
  value: Timeframe;
  onValueChange: (value: Timeframe) => void;
  className?: string;
}

export function TimeframePicker({ value, onValueChange, className }: TimeframePickerProps) {
  return (
    <div className={cn('flex items-center gap-1 rounded-lg border bg-muted p-1', className)}>
      {OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={value === opt.value ? 'secondary' : 'ghost'}
          size="sm"
          className={cn('h-7 px-2.5 text-xs', value === opt.value && 'shadow-sm')}
          onClick={() => onValueChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
