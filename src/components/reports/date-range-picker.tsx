
'use client';

import * as React from 'react';
import { format, isSameDay, startOfDay, subDays, endOfDay, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { cn, safeToDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '../ui/separator';
import { usePOS } from '@/context/pos-context';
import { useI18n } from '@/context/i18n-context';

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
}

export function DateRangePicker({ className, date, onDateChange }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const { business } = usePOS();
    const { t } = useI18n();

    const presets = React.useMemo(() => {
        const basePresets = [
            { label: t('reports.drToday'), range: { from: startOfDay(new Date()), to: endOfDay(new Date()) } },
            { label: t('reports.drYesterday'), range: { from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) } },
            { label: t('reports.drLast7'), range: { from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) } },
        ];

        // Add "All Time" if business start date is available
        const businessStart = business?.settings?.inventoryStartDate || business?.createdAt;
        if (businessStart) {
            const startDate = safeToDate(businessStart);
            basePresets.push({ label: t('reports.drAllTime'), range: { from: startOfDay(startDate), to: endOfDay(new Date()) } });
        } else {
            // Fallback if no business date is found
            basePresets.push({ label: t('reports.drLast30'), range: { from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) } });
        }

        basePresets.push(
            { label: t('reports.drThisMonth'), range: { from: startOfMonth(new Date()), to: endOfDay(new Date()) } },
            { label: t('reports.drLastMonth'), range: { from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) } }
        );

        return basePresets;
    }, [business]);

    const getDisplayString = () => {
        if (!date?.from) return "Pick a date range";

        const from = safeToDate(date.from);
        const to = date.to ? safeToDate(date.to) : null;
        
        if (to && isSameDay(from, to)) {
            if (isSameDay(from, new Date())) return "Today";
            if (isSameDay(from, subDays(new Date(), 1))) return "Yesterday";
            return format(from, 'LLL dd, y');
        }

        return `${format(from, 'LLL dd, y')} - ${to ? format(to, 'LLL dd, y') : '...'}`;
    };

    const handlePresetClick = (range: DateRange) => {
        onDateChange(range);
        setIsOpen(false);
    };

    return (
        <div className={cn('grid gap-2', className)}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={'outline'}
                        className={cn(
                        'w-full sm:w-[300px] justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {getDisplayString()}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 flex" align="start">
                    <div className="flex flex-col space-y-1 p-2 border-r">
                        {presets.map((preset) => (
                             <Button
                                key={preset.label}
                                variant="ghost"
                                className="w-full justify-start text-sm"
                                onClick={() => handlePresetClick(preset.range)}
                             >
                                {preset.label}
                            </Button>
                        ))}
                    </div>
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={(range) => {
                            onDateChange(range);
                            if (range?.from && range?.to) {
                                setIsOpen(false);
                            }
                        }}
                        numberOfMonths={1}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}

