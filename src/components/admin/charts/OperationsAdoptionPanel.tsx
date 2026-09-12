'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    ResponsiveContainer,
    BarChart as ReBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ReTooltip,
    ReferenceLine,
    LabelList,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
} from 'recharts';
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    Globe,
    Minus,
    ScanLine,
    Share2,
    ShoppingCart,
    Smartphone,
    Table as TableIcon,
    WifiOff,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TimeframePicker, type Timeframe } from '@/components/reports/timeframe-picker';
import {
    subDays,
    startOfDay,
    startOfHour,
    startOfWeek,
    endOfDay,
    format,
    eachDayOfInterval,
    eachHourOfInterval,
    eachWeekOfInterval,
} from 'date-fns';
import type { Receipt } from '@/types';

/**
 * Colours come from the --viz-* tokens in globals.css, which are re-stepped for
 * the dark card surface rather than flipped. Three categorical slots is the cap:
 * a fourth hue stops being separable under colour-vision deficiency. Slot 3 sits
 * just under 3:1 on the light surface, so every chart using it ships direct
 * labels and the table view as relief — do not drop either.
 */
const VIZ = {
    s1: 'var(--viz-1)',
    s2: 'var(--viz-2)',
    s3: 'var(--viz-3)',
    neutral: 'var(--viz-neutral)',
    grid: 'var(--viz-grid)',
    axis: 'var(--viz-axis)',
};

const GOOD = '#0ca30c';
const CRITICAL = '#d03b3b';

type Bucket = {
    key: string;
    label: string;
    start: Date;
    end: Date;
    sales: number;
    online: number;
    offline: number;
    scanned: number;
    digital: number;
    storefrontShares: number;
    receiptShares: number;
    offlineRate: number | null;
    scannerRate: number | null;
    digitalRate: number | null;
};

type Totals = {
    sales: number;
    offline: number;
    scanned: number;
    digital: number;
    storefrontShares: number;
    receiptShares: number;
    offlineRate: number;
    scannerRate: number;
    digitalRate: number;
};

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
};

const rate = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);

/**
 * Adoption here is often a fraction of a percent, and a fixed 0–100% axis draws
 * that as nothing at all. Snap the axis to the smallest step that still contains
 * the data so the shape is readable; the tick labels carry the real scale, so
 * zooming in this way states the range rather than hiding it.
 */
const PCT_STEPS = [1, 2, 5, 10, 25, 50, 100];
const niceCeil = (max: number) => PCT_STEPS.find(step => max <= step) ?? 100;

const emptyTotals = (): Totals => ({
    sales: 0,
    offline: 0,
    scanned: 0,
    digital: 0,
    storefrontShares: 0,
    receiptShares: 0,
    offlineRate: 0,
    scannerRate: 0,
    digitalRate: 0,
});

/**
 * A bar whose top end is rounded and whose baseline end stays square, with an
 * optional surface-coloured gap above it so touching stacked segments separate
 * without a stroke being drawn around either one.
 */
const BarShape = (props: any) => {
    const { x, y, width, height, fill, gapTop = 0, topRadius = 0 } = props;
    if (!(width > 0) || !(height > 0)) return null;
    const h = Math.max(0, height - gapTop);
    if (h <= 0) return null;
    const top = y + gapTop;
    const r = Math.max(0, Math.min(topRadius, h, width / 2));
    if (r === 0) return <rect x={x} y={top} width={width} height={h} fill={fill} />;
    const d = [
        `M${x},${top + h}`,
        `L${x},${top + r}`,
        `Q${x},${top} ${x + r},${top}`,
        `L${x + width - r},${top}`,
        `Q${x + width},${top} ${x + width},${top + r}`,
        `L${x + width},${top + h}`,
        'Z',
    ].join(' ');
    return <path d={d} fill={fill} />;
};

/** Values lead, labels follow; a short stroke of the series colour carries identity. */
const VizTooltip = ({
    active,
    payload,
    label,
    unit = '',
    decimals = 0,
    footer,
}: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((p: any) => p.value !== null && p.value !== undefined);
    if (!rows.length) return null;
    return (
        <div className="rounded-lg border bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{label}</p>
            <div className="space-y-1">
                {rows.map((row: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                        <span
                            aria-hidden
                            className="h-0.5 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color || row.fill || row.stroke }}
                        />
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                            {Number(row.value).toLocaleString(undefined, {
                                minimumFractionDigits: decimals,
                                maximumFractionDigits: decimals,
                            })}
                            {unit}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{row.name}</span>
                    </div>
                ))}
            </div>
            {footer && <p className="mt-1.5 border-t pt-1.5 text-[10px] text-muted-foreground">{footer}</p>}
        </div>
    );
};

/** Legend is always present for two or more series; identity is never colour alone. */
const VizLegend = ({ items }: { items: { name: string; color: string; shape?: 'rect' | 'line' }[] }) => (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {items.map(item => (
            <div key={item.name} className="flex items-center gap-1.5">
                <span
                    aria-hidden
                    className={item.shape === 'line' ? 'h-0.5 w-4 rounded-full' : 'h-2.5 w-2.5 rounded-[2px]'}
                    style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] text-muted-foreground">{item.name}</span>
            </div>
        ))}
    </div>
);

const Sparkline = ({ points, color }: { points: number[]; color: string }) => {
    if (points.length < 2) return <div className="h-6" />;
    const max = Math.max(...points);
    const min = Math.min(...points);
    const span = max - min || 1;
    const w = 96;
    const h = 24;
    const step = w / (points.length - 1);
    const coords = points.map((p, i) => [i * step, h - 2 - ((p - min) / span) * (h - 4)] as const);
    const path = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const lead = coords.slice(-2).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const [lastX, lastY] = coords[coords.length - 1];
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden focusable="false">
            <polyline points={path} fill="none" stroke={VIZ.neutral} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={lead} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
        </svg>
    );
};

const Delta = ({
    current,
    previous,
    unit = '',
    neutral = false,
    periodLabel,
}: {
    current: number;
    previous: number;
    unit?: string;
    neutral?: boolean;
    periodLabel: string;
}) => {
    const diff = current - previous;
    const flat = Math.abs(diff) < (unit === '%' ? 0.05 : 0.5);
    const Icon = flat ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
    const color = neutral || flat ? undefined : diff > 0 ? GOOD : CRITICAL;
    const text = flat
        ? 'No change'
        : `${diff > 0 ? '+' : '−'}${Math.abs(diff).toLocaleString(undefined, {
              maximumFractionDigits: unit === '%' ? 1 : 0,
          })}${unit}`;
    return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={color ? { color } : undefined}>
            <Icon className="h-3 w-3 shrink-0" aria-hidden />
            <span className={color ? undefined : 'text-muted-foreground'}>{text}</span>
            <span className="font-normal text-muted-foreground">vs prev {periodLabel}</span>
        </span>
    );
};

const KpiTile = ({
    label,
    value,
    icon: Icon,
    hint,
    spark,
    color,
    delta,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
    hint: string;
    spark: number[];
    color: string;
    delta: React.ReactNode;
}) => (
    <Card className="p-4">
        <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
            </div>
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
            <div className="min-w-0 space-y-1">
                {delta}
                <p className="truncate text-[10px] text-muted-foreground">{hint}</p>
            </div>
            <Sparkline points={spark} color={color} />
        </div>
    </Card>
);

interface OperationsAdoptionPanelProps {
    receipts: Receipt[];
    storefrontShares: any[];
    receiptShares: any[];
}

export default function OperationsAdoptionPanel({
    receipts,
    storefrontShares,
    receiptShares,
}: OperationsAdoptionPanelProps) {
    const [timeframe, setTimeframe] = React.useState<Timeframe>('30d');
    const [showTable, setShowTable] = React.useState(false);

    const { buckets, current, previous, periodLabel, grain, peakSales, radarData, radarMax } = React.useMemo(() => {
        const now = new Date();

        // The window the reader picked.
        const windowDays = timeframe === 'today' ? 1 : timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
        const start = timeframe === 'today' ? startOfDay(now) : subDays(startOfDay(now), windowDays - 1);

        // Hourly for a single day, weekly past 30 days — a 365-bar column chart is a smear.
        const bucketGrain: 'hour' | 'day' | 'week' =
            timeframe === 'today' ? 'hour' : timeframe === '90d' || timeframe === 'all' ? 'week' : 'day';

        let seeds: Date[];
        if (bucketGrain === 'hour') {
            seeds = eachHourOfInterval({ start, end: now });
        } else if (bucketGrain === 'week') {
            seeds = eachWeekOfInterval({ start, end: now });
        } else {
            seeds = eachDayOfInterval({ start, end: now });
        }

        const list: Bucket[] = seeds.map(seed => {
            let bStart: Date;
            let bEnd: Date;
            let label: string;
            if (bucketGrain === 'hour') {
                bStart = startOfHour(seed);
                bEnd = new Date(bStart.getTime() + 60 * 60 * 1000 - 1);
                label = format(bStart, 'HH:00');
            } else if (bucketGrain === 'week') {
                bStart = startOfWeek(seed);
                bEnd = new Date(bStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
                label = `w/c ${format(bStart, 'MMM d')}`;
            } else {
                bStart = startOfDay(seed);
                bEnd = endOfDay(seed);
                label = format(bStart, 'MMM d');
            }
            return {
                key: bStart.toISOString(),
                label,
                start: bStart,
                end: bEnd,
                sales: 0,
                online: 0,
                offline: 0,
                scanned: 0,
                digital: 0,
                storefrontShares: 0,
                receiptShares: 0,
                offlineRate: null,
                scannerRate: null,
                digitalRate: null,
            };
        });

        const firstStart = list.length ? list[0].start : start;

        // Weekly bucketing snaps the first bucket back to its Sunday, so the shown
        // window can start earlier than the picked one. Derive the comparison
        // window from what is actually plotted, or the two would overlap and the
        // deltas would count the same sales twice.
        const prevEnd = firstStart;
        const prevStart = new Date(firstStart.getTime() - (now.getTime() - firstStart.getTime()));

        const findBucket = (d: Date) => {
            if (d < firstStart) return null;
            for (let i = list.length - 1; i >= 0; i--) {
                if (d >= list[i].start) return d <= list[i].end ? list[i] : null;
            }
            return null;
        };

        const cur = emptyTotals();
        const prev = emptyTotals();

        (receipts || []).forEach(r => {
            const d = toDate(r.createdAt);
            if (!d) return;
            const isOffline = !!r.isOffline;
            const isScanned = !!r.wasScanned;
            const isDigital = r.receiptMethod === 'digital';

            if (d >= prevStart && d < prevEnd) {
                prev.sales += 1;
                if (isOffline) prev.offline += 1;
                if (isScanned) prev.scanned += 1;
                if (isDigital) prev.digital += 1;
            }
            if (d < firstStart) return;
            cur.sales += 1;
            if (isOffline) cur.offline += 1;
            if (isScanned) cur.scanned += 1;
            if (isDigital) cur.digital += 1;

            const b = findBucket(d);
            if (!b) return;
            b.sales += 1;
            if (isOffline) b.offline += 1;
            else b.online += 1;
            if (isScanned) b.scanned += 1;
            if (isDigital) b.digital += 1;
        });

        const countShares = (rows: any[], field: 'storefrontShares' | 'receiptShares') => {
            (rows || []).forEach(s => {
                const d = toDate(s?.timestamp);
                if (!d) return;
                if (d >= prevStart && d < prevEnd) prev[field] += 1;
                if (d < firstStart) return;
                cur[field] += 1;
                const b = findBucket(d);
                if (b) b[field] += 1;
            });
        };
        countShares(storefrontShares, 'storefrontShares');
        countShares(receiptShares, 'receiptShares');

        // A bucket with no sales has no rate — leave it null so the chart breaks
        // the series rather than drawing a misleading 0%.
        list.forEach(b => {
            b.offlineRate = rate(b.offline, b.sales);
            b.scannerRate = rate(b.scanned, b.sales);
            b.digitalRate = rate(b.digital, b.sales);
        });

        [cur, prev].forEach(t => {
            t.offlineRate = rate(t.offline, t.sales) ?? 0;
            t.scannerRate = rate(t.scanned, t.sales) ?? 0;
            t.digitalRate = rate(t.digital, t.sales) ?? 0;
        });

        // One unit across every spoke: events per 100 sales. The first three are
        // rates by definition; the two sharing spokes are capped at 100 so a
        // heavily-shared, low-volume period cannot blow the web out of shape.
        const perHundred = (n: number, sales: number) => (sales > 0 ? Math.min(100, (n / sales) * 100) : 0);
        const spokes = [
            { axis: 'Offline sync', cur: cur.offlineRate, prev: prev.offlineRate },
            { axis: 'Scanner use', cur: cur.scannerRate, prev: prev.scannerRate },
            { axis: 'Digital receipts', cur: cur.digitalRate, prev: prev.digitalRate },
            {
                axis: 'Storefront shares',
                cur: perHundred(cur.storefrontShares, cur.sales),
                prev: perHundred(prev.storefrontShares, prev.sales),
            },
            {
                axis: 'Receipt shares',
                cur: perHundred(cur.receiptShares, cur.sales),
                prev: perHundred(prev.receiptShares, prev.sales),
            },
        ].map(s => ({ axis: s.axis, 'This period': +s.cur.toFixed(1), 'Previous period': +s.prev.toFixed(1) }));

        const label = timeframe === 'today' ? 'day' : timeframe === 'all' ? 'year' : timeframe.replace('d', ' days');

        const radarMax = niceCeil(
            Math.max(0, ...spokes.flatMap(s => [s['This period'], s['Previous period']]))
        );

        return {
            buckets: list,
            current: cur,
            previous: prev,
            periodLabel: label,
            grain: bucketGrain,
            peakSales: Math.max(0, ...list.map(b => b.sales)),
            radarData: spokes,
            radarMax,
        };
    }, [receipts, storefrontShares, receiptShares, timeframe]);

    const sparkOf = (pick: (b: Bucket) => number) => {
        const vals = buckets.map(pick);
        return vals.length <= 12 ? vals : vals.slice(-12);
    };

    const grainNote = grain === 'hour' ? 'per hour' : grain === 'week' ? 'per week' : 'per day';
    const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
    const hoverBand = { fill: 'hsl(var(--foreground) / 0.05)' };

    // One shared scale across the three adoption panels — small multiples are only
    // comparable if their axes match, so the max is taken across all three.
    const adoptionMax = niceCeil(
        Math.max(
            0,
            ...buckets.flatMap(b => [b.offlineRate ?? 0, b.scannerRate ?? 0, b.digitalRate ?? 0])
        )
    );
    const adoptionTicks = [0, adoptionMax / 2, adoptionMax];
    const hasSales = current.sales > 0;

    /** Only the peak bucket gets a number — a value on every bar goes unread. */
    const peakLabel = (peak: number, format1: (v: number) => string) => (props: any) => {
        const { x, y, width, value } = props;
        if (value === null || value === undefined || peak <= 0 || Math.abs(value - peak) > 0.001) return null;
        return (
            <text
                x={x + width / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-foreground"
                style={{ fontSize: 11, fontWeight: 600 }}
            >
                {format1(value)}
            </text>
        );
    };

    const adoptionSeries = [
        {
            key: 'offlineRate' as const,
            title: 'Offline sync rate',
            blurb: 'Sales rung up with no connection, then synced.',
            icon: WifiOff,
            color: VIZ.s1,
            value: current.offlineRate,
            countLabel: `${current.offline.toLocaleString()} of ${current.sales.toLocaleString()} sales`,
        },
        {
            key: 'scannerRate' as const,
            title: 'Scanner adoption',
            blurb: 'Sales where at least one item was scanned.',
            icon: ScanLine,
            color: VIZ.s2,
            value: current.scannerRate,
            countLabel: `${current.scanned.toLocaleString()} of ${current.sales.toLocaleString()} sales`,
        },
        {
            key: 'digitalRate' as const,
            title: 'Digital receipts',
            blurb: 'Receipts delivered by email or WhatsApp.',
            icon: Smartphone,
            color: VIZ.s3,
            value: current.digitalRate,
            countLabel: `${current.digital.toLocaleString()} of ${current.sales.toLocaleString()} sales`,
        },
    ];

    return (
        <Card>
            <CardHeader className="gap-3 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary" />
                            Operations &amp; Feature Adoption
                        </CardTitle>
                        <CardDescription>
                            How sales are actually being rung up across the platform — volume, resilience, and which
                            features get used.
                        </CardDescription>
                    </div>
                    {/* One filter row, scoping every tile and chart below it. */}
                    <div className="flex items-center gap-2">
                        <TimeframePicker value={timeframe} onValueChange={setTimeframe} />
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 px-2.5 text-[11px]"
                            onClick={() => setShowTable(v => !v)}
                            aria-pressed={showTable}
                        >
                            {showTable ? <BarChart3 className="h-3.5 w-3.5" /> : <TableIcon className="h-3.5 w-3.5" />}
                            {showTable ? 'Charts' : 'Table'}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <KpiTile
                        label="Sales processed"
                        value={current.sales.toLocaleString()}
                        icon={ShoppingCart}
                        hint={`Receipts in the last ${periodLabel}`}
                        spark={sparkOf(b => b.sales)}
                        color={VIZ.s1}
                        delta={<Delta current={current.sales} previous={previous.sales} periodLabel={periodLabel} />}
                    />
                    <KpiTile
                        label="Offline sync rate"
                        value={`${current.offlineRate.toFixed(1)}%`}
                        icon={WifiOff}
                        hint={`${current.offline.toLocaleString()} sales created offline`}
                        spark={sparkOf(b => b.offlineRate ?? 0)}
                        color={VIZ.s1}
                        delta={
                            <Delta
                                current={current.offlineRate}
                                previous={previous.offlineRate}
                                unit="%"
                                neutral
                                periodLabel={periodLabel}
                            />
                        }
                    />
                    <KpiTile
                        label="Scanner adoption"
                        value={`${current.scannerRate.toFixed(1)}%`}
                        icon={ScanLine}
                        hint={`${current.scanned.toLocaleString()} sales used a scanner`}
                        spark={sparkOf(b => b.scannerRate ?? 0)}
                        color={VIZ.s2}
                        delta={
                            <Delta
                                current={current.scannerRate}
                                previous={previous.scannerRate}
                                unit="%"
                                periodLabel={periodLabel}
                            />
                        }
                    />
                    <KpiTile
                        label="Digital receipts"
                        value={`${current.digitalRate.toFixed(1)}%`}
                        icon={Smartphone}
                        hint={`${current.digital.toLocaleString()} sent by email or WhatsApp`}
                        spark={sparkOf(b => b.digitalRate ?? 0)}
                        color={VIZ.s3}
                        delta={
                            <Delta
                                current={current.digitalRate}
                                previous={previous.digitalRate}
                                unit="%"
                                periodLabel={periodLabel}
                            />
                        }
                    />
                    <KpiTile
                        label="Storefront shares"
                        value={current.storefrontShares.toLocaleString()}
                        icon={Globe}
                        hint="Store links copied or shared"
                        spark={sparkOf(b => b.storefrontShares)}
                        color={VIZ.s1}
                        delta={
                            <Delta
                                current={current.storefrontShares}
                                previous={previous.storefrontShares}
                                periodLabel={periodLabel}
                            />
                        }
                    />
                    <KpiTile
                        label="Receipt shares"
                        value={current.receiptShares.toLocaleString()}
                        icon={Share2}
                        hint="Receipt links copied or shared"
                        spark={sparkOf(b => b.receiptShares)}
                        color={VIZ.s2}
                        delta={
                            <Delta
                                current={current.receiptShares}
                                previous={previous.receiptShares}
                                periodLabel={periodLabel}
                            />
                        }
                    />
                </div>

                {showTable ? (
                    <div className="max-h-[520px] overflow-auto rounded-md border">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                    <TableHead className="text-xs">Period</TableHead>
                                    <TableHead className="text-right text-xs">Sales</TableHead>
                                    <TableHead className="text-right text-xs">Online</TableHead>
                                    <TableHead className="text-right text-xs">Offline</TableHead>
                                    <TableHead className="text-right text-xs">Offline %</TableHead>
                                    <TableHead className="text-right text-xs">Scanned</TableHead>
                                    <TableHead className="text-right text-xs">Scanner %</TableHead>
                                    <TableHead className="text-right text-xs">Digital</TableHead>
                                    <TableHead className="text-right text-xs">Digital %</TableHead>
                                    <TableHead className="text-right text-xs">Store shares</TableHead>
                                    <TableHead className="text-right text-xs">Receipt shares</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {buckets.map(b => (
                                    <TableRow key={b.key}>
                                        <TableCell className="whitespace-nowrap text-xs font-medium">{b.label}</TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">{b.sales}</TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">{b.online}</TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">{b.offline}</TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">
                                            {b.offlineRate === null ? '—' : `${b.offlineRate.toFixed(1)}%`}
                                        </TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">{b.scanned}</TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">
                                            {b.scannerRate === null ? '—' : `${b.scannerRate.toFixed(1)}%`}
                                        </TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">{b.digital}</TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">
                                            {b.digitalRate === null ? '—' : `${b.digitalRate.toFixed(1)}%`}
                                        </TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">{b.storefrontShares}</TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">{b.receiptShares}</TableCell>
                                    </TableRow>
                                ))}
                                {buckets.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={11} className="py-8 text-center text-xs text-muted-foreground">
                                            No activity in this period.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                ) : !hasSales ? (
                    <div className="rounded-md border border-dashed py-12 text-center">
                        <p className="text-sm font-medium">No sales recorded in the last {periodLabel}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Adoption rates are a share of sales, so there is nothing to plot yet. Pick a longer
                            timeframe to look further back.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Sales volume, split by how the sale was rung up. */}
                        <Card className="p-4">
                            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                                <h3 className="text-sm font-semibold">Sales volume {grainNote}</h3>
                                <p className="text-[11px] text-muted-foreground">
                                    {current.sales.toLocaleString()} sales &middot;{' '}
                                    {current.offline.toLocaleString()} of them offline
                                </p>
                            </div>
                            <p className="mb-3 text-xs text-muted-foreground">
                                Every bar is one {grain}. The stack shows how much of that volume the app carried with no
                                connection.
                            </p>
                            <VizLegend
                                items={[
                                    { name: 'Online', color: VIZ.s1 },
                                    { name: 'Offline (synced later)', color: VIZ.s2 },
                                ]}
                            />
                            <ResponsiveContainer width="100%" height={300}>
                                <ReBarChart data={buckets} margin={{ top: 20, right: 8, left: 0, bottom: 4 }}>
                                    <CartesianGrid stroke={VIZ.grid} strokeWidth={1} vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        tick={axisTick}
                                        tickLine={false}
                                        axisLine={{ stroke: VIZ.axis }}
                                        interval="preserveStartEnd"
                                        minTickGap={24}
                                    />
                                    <YAxis
                                        tick={axisTick}
                                        tickLine={false}
                                        axisLine={false}
                                        allowDecimals={false}
                                        width={40}
                                    />
                                    <ReTooltip
                                        cursor={hoverBand}
                                        content={<VizTooltip />}
                                    />
                                    <Bar
                                        dataKey="online"
                                        name="Online"
                                        stackId="sales"
                                        fill={VIZ.s1}
                                        maxBarSize={24}
                                        isAnimationActive={false}
                                        shape={<BarShape />}
                                    />
                                    <Bar
                                        dataKey="offline"
                                        name="Offline (synced later)"
                                        stackId="sales"
                                        fill={VIZ.s2}
                                        maxBarSize={24}
                                        isAnimationActive={false}
                                        shape={<BarShape gapTop={2} topRadius={4} />}
                                    >
                                        <LabelList
                                            dataKey="sales"
                                            content={peakLabel(peakSales, v => v.toLocaleString())}
                                        />
                                    </Bar>
                                </ReBarChart>
                            </ResponsiveContainer>
                        </Card>

                        {/* Small multiples — one adoption rate each, so no second y-axis is ever needed. */}
                        <p className="text-xs text-muted-foreground">
                            All three panels share one 0–{Number(adoptionMax.toFixed(1))}% axis, so their heights are
                            directly comparable. The axis is zoomed to fit the data rather than fixed at 100%.
                        </p>
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            {adoptionSeries.map(series => {
                                const values = buckets
                                    .map(b => b[series.key])
                                    .filter((v): v is number => v !== null);
                                const peak = values.length ? Math.max(...values) : 0;
                                const avg = series.value;
                                const Icon = series.icon;
                                return (
                                    <Card key={series.key} className="p-4">
                                        <div className="mb-1 flex items-start justify-between gap-2">
                                            <h3 className="text-sm font-semibold">{series.title}</h3>
                                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                        </div>
                                        <p className="text-2xl font-bold leading-none">{avg.toFixed(1)}%</p>
                                        <p className="mt-1 text-[11px] text-muted-foreground">{series.countLabel}</p>
                                        <p className="mb-2 mt-2 text-xs text-muted-foreground">{series.blurb}</p>                                        <ResponsiveContainer width="100%" height={190}>
                                            <ReBarChart data={buckets} margin={{ top: 18, right: 8, left: 0, bottom: 4 }}>
                                                <CartesianGrid stroke={VIZ.grid} strokeWidth={1} vertical={false} />
                                                <XAxis
                                                    dataKey="label"
                                                    tick={axisTick}
                                                    tickLine={false}
                                                    axisLine={{ stroke: VIZ.axis }}
                                                    interval="preserveStartEnd"
                                                    minTickGap={32}
                                                />
                                                <YAxis
                                                    tick={axisTick}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    width={40}
                                                    domain={[0, adoptionMax]}
                                                    ticks={adoptionTicks}
                                                    tickFormatter={v => `${Number(v.toFixed(1))}%`}
                                                />
                                                <ReTooltip
                                                    cursor={hoverBand}
                                                    content={
                                                        <VizTooltip
                                                            unit="%"
                                                            decimals={1}
                                                            footer="Periods with no sales have no rate and are left blank."
                                                        />
                                                    }
                                                />
                                                {avg > 0 && (
                                                    <ReferenceLine
                                                        y={avg}
                                                        stroke={VIZ.axis}
                                                        strokeDasharray="4 4"
                                                        ifOverflow="extendDomain"
                                                    />
                                                )}
                                                <Bar
                                                    dataKey={series.key}
                                                    name={series.title}
                                                    fill={series.color}
                                                    maxBarSize={20}
                                                    isAnimationActive={false}
                                                    shape={<BarShape topRadius={4} />}
                                                >
                                                    <LabelList
                                                        dataKey={series.key}
                                                        content={peakLabel(peak, v => `${Number(v.toFixed(1))}%`)}
                                                    />
                                                </Bar>
                                            </ReBarChart>
                                        </ResponsiveContainer>
                                    </Card>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {/* The cob-web: the whole operating profile in one shape, against last period. */}
                            <Card className="p-4">
                                <h3 className="text-sm font-semibold">Operations profile</h3>
                                <p className="mb-3 mt-1 text-xs text-muted-foreground">
                                    Every spoke is events per 100 sales, so the shape can be compared against the previous{' '}
                                    {periodLabel} directly. Sharing spokes are capped at 100; the rings run to{' '}
                                    {radarMax} per 100 sales.
                                </p>
                                <VizLegend
                                    items={[
                                        { name: 'This period', color: VIZ.s1, shape: 'line' },
                                        { name: `Previous ${periodLabel}`, color: VIZ.s2, shape: 'line' },
                                    ]}
                                />
                                <ResponsiveContainer width="100%" height={320}>
                                    <RadarChart data={radarData} outerRadius="72%">
                                        <PolarGrid stroke={VIZ.grid} />
                                        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                                        <PolarRadiusAxis
                                            angle={90}
                                            domain={[0, radarMax]}
                                            tickCount={3}
                                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                            tickFormatter={v => `${v}`}
                                            axisLine={false}
                                        />
                                        <ReTooltip
                                            content={<VizTooltip unit=" / 100 sales" decimals={1} />}
                                            cursor={false}
                                        />
                                        <Radar
                                            name={`Previous ${periodLabel}`}
                                            dataKey="Previous period"
                                            stroke={VIZ.s2}
                                            strokeWidth={2}
                                            fill={VIZ.s2}
                                            fillOpacity={0.1}
                                            isAnimationActive={false}
                                            dot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                                        />
                                        <Radar
                                            name="This period"
                                            dataKey="This period"
                                            stroke={VIZ.s1}
                                            strokeWidth={2}
                                            fill={VIZ.s1}
                                            fillOpacity={0.1}
                                            isAnimationActive={false}
                                            dot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </Card>

                            {/* Sharing is a different unit from sales, so it gets its own plot, not a second axis. */}
                            <Card className="p-4">
                                <h3 className="text-sm font-semibold">Link sharing {grainNote}</h3>
                                <p className="mb-3 mt-1 text-xs text-muted-foreground">
                                    Storefront and receipt links copied or shared out of the app.
                                </p>
                                <VizLegend
                                    items={[
                                        { name: 'Storefront links', color: VIZ.s1 },
                                        { name: 'Receipt links', color: VIZ.s2 },
                                    ]}
                                />
                                <ResponsiveContainer width="100%" height={320}>
                                    <ReBarChart data={buckets} margin={{ top: 12, right: 8, left: 0, bottom: 4 }} barGap={2}>
                                        <CartesianGrid stroke={VIZ.grid} strokeWidth={1} vertical={false} />
                                        <XAxis
                                            dataKey="label"
                                            tick={axisTick}
                                            tickLine={false}
                                            axisLine={{ stroke: VIZ.axis }}
                                            interval="preserveStartEnd"
                                            minTickGap={24}
                                        />
                                        <YAxis
                                            tick={axisTick}
                                            tickLine={false}
                                            axisLine={false}
                                            allowDecimals={false}
                                            width={36}
                                        />
                                        <ReTooltip cursor={hoverBand} content={<VizTooltip />} />
                                        <Bar
                                            dataKey="storefrontShares"
                                            name="Storefront links"
                                            fill={VIZ.s1}
                                            maxBarSize={16}
                                            isAnimationActive={false}
                                            shape={<BarShape topRadius={4} />}
                                        />
                                        <Bar
                                            dataKey="receiptShares"
                                            name="Receipt links"
                                            fill={VIZ.s2}
                                            maxBarSize={16}
                                            isAnimationActive={false}
                                            shape={<BarShape topRadius={4} />}
                                        />
                                    </ReBarChart>
                                </ResponsiveContainer>
                            </Card>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
