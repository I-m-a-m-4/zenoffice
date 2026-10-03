'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';

export type Timeframe = 'today' | '7d' | '30d' | '90d' | 'all';

export interface TimeframePickerProps {
  value: Timeframe;
  onChange?: (value: Timeframe) => void;
  onValueChange?: (value: Timeframe) => void;
  className?: string;
}

const TIMEFRAME_OPTIONS: { label: string; value: Timeframe }[] = [
  { label: 'Today', value: 'today' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: 'All', value: 'all' },
];

export function TimeframePicker({ value, onChange, onValueChange, className = '' }: TimeframePickerProps) {
  const handleClick = (val: Timeframe) => {
    onChange?.(val);
    onValueChange?.(val);
  };

  return (
    <div className={`inline-flex items-center gap-1 bg-muted/60 p-1 rounded-lg border text-xs ${className}`}>
      {TIMEFRAME_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          variant={value === opt.value ? 'default' : 'ghost'}
          size="sm"
          className={`h-7 px-2.5 text-xs font-medium rounded-md ${
            value === opt.value ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => handleClick(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

export default TimeframePicker;
