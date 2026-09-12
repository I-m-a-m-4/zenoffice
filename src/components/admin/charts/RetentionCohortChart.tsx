'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  format, 
  startOfMonth, 
  subMonths, 
  isSameMonth, 
  startOfWeek, 
  subWeeks, 
  isSameWeek, 
  addDays, 
  addMonths, 
  addWeeks 
} from 'date-fns';
import { Users, Briefcase, Calendar, RefreshCw } from 'lucide-react';
import type { UserProfile, Receipt } from '@/types';

interface RetentionCohortChartProps {
  users: UserProfile[];
  receipts: Receipt[];
  businesses?: any[];
}

const parseDate = (d: any): Date | null => {
  if (!d) return null;
  if (d.toDate && typeof d.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  if (typeof d === 'string' || typeof d === 'number') {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

export default function RetentionCohortChart({ users, receipts, businesses = [] }: RetentionCohortChartProps) {
  const [cohortType, setCohortType] = React.useState<'business' | 'user'>('business');
  const [granularity, setGranularity] = React.useState<'month' | 'week'>('month');
  const [method, setMethod] = React.useState<'calendar' | 'rolling'>('rolling');

  // Normalize entities based on cohort type
  const entities = React.useMemo(() => {
    const list: { id: string; createdAt: Date; businessId: string }[] = [];
    
    if (cohortType === 'business') {
      if (businesses && businesses.length > 0) {
        businesses.forEach(b => {
          const date = parseDate(b.createdAt);
          if (date) {
            list.push({ id: b.id, createdAt: date, businessId: b.id });
          }
        });
      } else {
        // Fallback: group users by businessId, find earliest user signup as business creation
        const busMap = new Map<string, Date>();
        users.forEach(u => {
          if (!u.businessId) return;
          const date = parseDate(u.createdAt);
          if (date) {
            const currentMin = busMap.get(u.businessId);
            if (!currentMin || date < currentMin) {
              busMap.set(u.businessId, date);
            }
          }
        });
        busMap.forEach((date, bId) => {
          list.push({ id: bId, createdAt: date, businessId: bId });
        });
      }
    } else {
      users.forEach(u => {
        const date = parseDate(u.createdAt);
        if (date) {
          list.push({ id: u.id, createdAt: date, businessId: u.businessId });
        }
      });
    }
    return list;
  }, [users, businesses, cohortType]);

  // Parse and cache receipts
  const parsedReceipts = React.useMemo(() => {
    return receipts.map(r => ({
      businessId: r.businessId,
      date: parseDate(r.createdAt)
    })).filter(r => r.date !== null) as { businessId: string; date: Date }[];
  }, [receipts]);

  // Calculate cohort retention
  const cohortData = React.useMemo(() => {
    const now = new Date();
    const size = 6;
    const cohorts: any[] = [];

    const getBucketStart = (date: Date) => {
      return granularity === 'month' ? startOfMonth(date) : startOfWeek(date);
    };

    const getBucketLabel = (date: Date) => {
      return granularity === 'month' 
        ? format(date, 'MMM yyyy') 
        : `Wk: ${format(date, 'MM/dd/yy')}`;
    };

    // Generate cohorts for the past `size` intervals
    for (let i = size - 1; i >= 0; i--) {
      const cohortDate = granularity === 'month' 
        ? startOfMonth(subMonths(now, i)) 
        : startOfWeek(subWeeks(now, i));

      // Filter entities that signed up in this cohort interval
      const cohortEntities = entities.filter(e => {
        const eStart = getBucketStart(e.createdAt);
        return granularity === 'month' 
          ? isSameMonth(eStart, cohortDate)
          : isSameWeek(eStart, cohortDate);
      });

      if (cohortEntities.length === 0) continue;

      const cohortBusinessIds = new Set(cohortEntities.map(e => e.businessId).filter(Boolean));

      const row: any = {
        label: getBucketLabel(cohortDate),
        total: cohortEntities.length,
        retention: []
      };

      const maxIntervals = size;
      for (let j = 0; j < maxIntervals; j++) {
        // Check if the interval represents a future time relative to now
        const isFuture = granularity === 'month'
          ? addMonths(cohortDate, j) > now
          : addWeeks(cohortDate, j) > now;

        if (isFuture) {
          row.retention.push({
            index: j,
            count: 0,
            percentage: 0,
            isFuture: true
          });
          continue;
        }

        const activeEntities = new Set<string>();

        if (method === 'calendar') {
          // Calendar month/week j after signup
          const checkStartDate = granularity === 'month' 
            ? startOfMonth(addMonths(cohortDate, j))
            : startOfWeek(addWeeks(cohortDate, j));

          parsedReceipts.forEach(r => {
            if (cohortBusinessIds.has(r.businessId)) {
              const rStart = getBucketStart(r.date);
              const isMatch = granularity === 'month'
                ? isSameMonth(rStart, checkStartDate)
                : isSameWeek(rStart, checkStartDate);
              if (isMatch) {
                activeEntities.add(r.businessId);
              }
            }
          });
        } else {
          // Date-Diff (Rolling) index j
          const daysPerInterval = granularity === 'month' ? 30 : 7;
          cohortEntities.forEach(e => {
            const startRange = addDays(e.createdAt, j * daysPerInterval);
            const endRange = addDays(e.createdAt, (j + 1) * daysPerInterval);
            
            // Check if there is any receipt in this specific rolling window
            const hasActivity = parsedReceipts.some(r => 
              r.businessId === e.businessId && 
              r.date >= startRange && 
              r.date < endRange
            );

            if (hasActivity) {
              activeEntities.add(e.businessId);
            }
          });
        }

        row.retention.push({
          index: j,
          count: activeEntities.size,
          percentage: cohortBusinessIds.size > 0 ? (activeEntities.size / cohortBusinessIds.size) * 100 : 0,
          isFuture: false
        });
      }

      cohorts.push(row);
    }

    return cohorts;
  }, [entities, parsedReceipts, granularity, method]);

  const getHeatmapStyle = (percent: number, isFuture: boolean) => {
    if (isFuture) {
      return {
        background: 'repeating-linear-gradient(45deg, hsl(var(--muted)/0.05) 0px, hsl(var(--muted)/0.05) 4px, hsl(var(--muted)/0.15) 4px, hsl(var(--muted)/0.15) 8px)',
        color: 'hsl(var(--muted-foreground)/0.4)',
        border: '1px dashed hsl(var(--border)/0.3)'
      };
    }
    if (percent === 0) {
      return {
        backgroundColor: 'hsl(var(--muted)/0.3)',
        color: 'hsl(var(--muted-foreground)/0.5)',
      };
    }
    // Continuous dynamic color-mix gradient based on theme's primary color
    return {
      backgroundColor: `color-mix(in srgb, hsl(var(--primary)) ${percent}%, hsl(var(--muted)/0.2) ${100 - percent}%)`,
      color: percent > 45 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
    };
  };

  return (
    <Card className="w-full shadow-md border-border/50">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-6 space-y-4 md:space-y-0">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary animate-spin-slow" />
            Retention Cohort Analysis
          </CardTitle>
          <CardDescription>
            Tracks platform retention metrics utilizing advanced rolling windows or calendar ranges.
          </CardDescription>
        </div>

        {/* Action Toggles */}
        <div className="flex flex-wrap gap-2 text-xs">
          {/* Cohort Type */}
          <div className="flex bg-muted p-0.5 rounded-lg border border-border">
            <button
              onClick={() => setCohortType('business')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                cohortType === 'business' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Briefcase className="h-3 w-3" />
              Business
            </button>
            <button
              onClick={() => setCohortType('user')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                cohortType === 'user' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-3 w-3" />
              User
            </button>
          </div>

          {/* Granularity */}
          <div className="flex bg-muted p-0.5 rounded-lg border border-border">
            <button
              onClick={() => setGranularity('month')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                granularity === 'month' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setGranularity('week')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                granularity === 'week' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Weekly
            </button>
          </div>

          {/* Calculation Method */}
          <div className="flex bg-muted p-0.5 rounded-lg border border-border">
            <button
              onClick={() => setMethod('rolling')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                method === 'rolling' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Rolling Date-Diff Cohort windows (e.g. signup + 30 days)"
            >
              Rolling
            </button>
            <button
              onClick={() => setMethod('calendar')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                method === 'calendar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Standard calendar month/week buckets"
            >
              Calendar
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-md border border-border/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[140px] font-bold text-foreground">
                  {cohortType === 'business' ? 'Business Cohort' : 'User Cohort'}
                </TableHead>
                <TableHead className="text-center font-bold text-foreground w-[100px]">
                  Size ({cohortType === 'business' ? 'Stores' : 'Users'})
                </TableHead>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableHead key={i} className="text-center text-[11px] font-bold uppercase text-muted-foreground min-w-[110px]">
                    {granularity === 'month' ? `Month ${i}` : `Week ${i}`}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohortData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-muted/10">
                  <TableCell className="font-semibold text-xs whitespace-nowrap py-3">
                    {row.label}
                  </TableCell>
                  <TableCell className="text-center text-xs font-bold py-3 bg-muted/10">
                    {row.total}
                  </TableCell>
                  {row.retention.map((ret: any) => (
                    <TableCell key={ret.index} className="text-center p-0.5 min-w-[110px]">
                      <div
                        style={getHeatmapStyle(ret.percentage, ret.isFuture)}
                        className="h-11 w-full flex flex-col items-center justify-center m-0 rounded transition-all duration-300 hover:scale-[1.02] hover:shadow-sm p-1 leading-tight"
                      >
                        {ret.isFuture ? (
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-50">N/A</span>
                        ) : (
                          <>
                            <span className="font-bold text-xs">
                              {ret.count} {ret.count === 1 ? 'store' : 'stores'}
                            </span>
                            <span className="text-[10px] font-semibold opacity-90">
                              {ret.percentage.toFixed(0)}%
                            </span>
                          </>
                        )}
                      </div>
                    </TableCell>
                  ))}
                  {Array.from({ length: 6 - row.retention.length }).map((_, i) => (
                    <TableCell key={`empty-${i}`} className="p-0.5">
                      <div className="h-11 w-full bg-muted/5 border border-dashed border-border/10 rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 pt-4 border-t border-border/50 text-xs text-muted-foreground bg-muted/15 p-4 rounded-lg space-y-2">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Active Calculation Metrics:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Cohort Definition:</strong> Grouped by when the {cohortType === 'business' ? 'business entity' : 'user account'} was created.
            </li>
            <li>
              <strong>Calculation Method:</strong> {method === 'rolling' 
                ? 'Date-Diff (Rolling) checks if the business generated a receipt within strict 30-day (or 7-day) intervals relative to their exact signup timestamp, avoiding calendar skew.' 
                : 'Calendar buckets check if the business generated a receipt in the exact calendar month or week matching the signup offset.'
              }
            </li>
            <li>
              <strong>Visual Gradient:</strong> Uses continuous dynamic HSL color blending. Darker cells represent higher customer retention rates. Future cells are designated with a striped <strong>N/A</strong> pattern.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
