'use client';

/**
 * Achievements & Goals.
 *
 * ── What this page used to get wrong ───────────────────────────────────────────
 *
 * Two things, both of which showed on a certificate the owner could download and
 * post:
 *
 * 1. **It invented dates.** Product and customer milestones were stamped
 *    `new Date()` plus `milestone.value / 10` milliseconds so the timeline would
 *    sort, and that fabricated timestamp was then printed as "Achieved On". A
 *    "500 products added" milestone has no event behind it, so there is no date to
 *    print. `src/lib/achievements.ts` returns `earnedAt: null` and this page shows
 *    the figure instead. Sales crossings *do* have an event and are dated from the
 *    receipt that crossed the line.
 *
 * 2. **It measured the wrong sales figure.** It summed the receipts held on the
 *    device and filtered them to the current year. The listener holds 200, so for
 *    any busy shop that was a fraction of the year — while the notification
 *    announcing the same milestone used lifetime revenue from `stats/overall`. Shops
 *    were told they had crossed ₦1 million and found no badge for it. Both now read
 *    the lifetime counter.
 *
 * The rest is structure: a hero fixed on the nearest unearned rung (the nearest, not
 * the biggest — two customers short beats ₦95m short for getting somebody to act),
 * a trophy case that draws every rung on all three ladders so the next one is always
 * visible, and goals keyed per business.
 *
 * ── Goals were global-keyed ────────────────────────────────────────────────────
 *
 * `userGoals` had no businessId in it, the same trap CLAUDE.md documents for the
 * `pos_synced_*` blobs: a support admin impersonating a tenant saw their own goals
 * on the tenant's page. Now `zeneva_goals_<businessId>`, with the legacy key adopted
 * once — a missing key is a legacy install, not a mismatch — and adoption skipped
 * while impersonating, because those goals are the admin's.
 */

import * as React from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { format, isValid } from 'date-fns';
import html2canvas from 'html2canvas';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Award,
  ChevronDown,
  DollarSign,
  Download,
  Info,
  Lock,
  Package,
  PartyPopper,
  PlusCircle,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react';

import PageTitle from '@/components/shared/page-title';
import RatingBadges from '@/components/achievements/rating-badges';
import { CachedImage } from '@/components/shared/cached-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { usePOS } from '@/context/pos-context';
import { useToast } from '@/hooks/use-toast';
import { useAchievements } from '@/hooks/use-achievements';
import { useCountUp } from '@/hooks/use-count-up';
import { secureStorage } from '@/lib/secure-storage';
import { cn } from '@/lib/utils';
import type { Achievement, AchievementKind, AchievementLadder, AchievementSet } from '@/lib/achievements';

/* ───────────────────────────── shared formatting ──────────────────────────── */

function useFigureFormatter() {
  const { currencySymbol } = usePOS();
  return React.useCallback(
    (value: number, isMoney: boolean) =>
      isMoney
        ? `${currencySymbol || '₦'}${Math.max(0, Math.round(value)).toLocaleString()}`
        : Math.max(0, Math.round(value)).toLocaleString(),
    [currencySymbol],
  );
}

/** Null for anything that has no real date behind it, including the epoch. */
function earnedOnLabel(date: Date | null): string | null {
  if (!date || !isValid(date) || date.getTime() <= 0) return null;
  return format(date, 'd MMMM yyyy');
}

const LADDER_ICON: Record<AchievementKind, React.ElementType> = {
  sales: DollarSign,
  products: Package,
  customers: Users,
};

/* ──────────────────────────────── the hero ────────────────────────────────── */

/**
 * A progress ring drawn with a conic gradient — no SVG, no library, and it reads at
 * a glance from across a counter, which a 4px bar does not.
 */
function ProgressRing({ pct, children }: { pct: number; children: React.ReactNode }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div
      className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full sm:h-32 sm:w-32"
      style={{
        background: `conic-gradient(hsl(var(--primary)) ${clamped}%, hsl(var(--muted)) ${clamped}% 100%)`,
      }}
    >
      <div className="flex h-[86%] w-[86%] items-center justify-center overflow-hidden rounded-full bg-background">
        {children}
      </div>
    </div>
  );
}

function LadderRail({
  ladder,
  formatFigure,
}: {
  ladder: AchievementLadder;
  formatFigure: (value: number, isMoney: boolean) => string;
}) {
  const Icon = LADDER_ICON[ladder.kind];
  const pct = ladder.rungs.length ? (ladder.earnedCount / ladder.rungs.length) * 100 : 0;
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {ladder.title}
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {ladder.earnedCount}/{ladder.rungs.length}
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <p className="mt-2 truncate text-[11px] text-muted-foreground">
        {ladder.current === null ? 'Not measured here' : formatFigure(ladder.current, ladder.isMoney)}
      </p>
    </div>
  );
}

function NextMilestoneHero({
  set,
  formatFigure,
}: {
  set: AchievementSet;
  formatFigure: (value: number, isMoney: boolean) => string;
}) {
  const reduce = useReducedMotion();
  const focus = set.focus;
  const pct = focus ? focus.progress * 100 : 100;
  const shownPct = useCountUp(pct, !reduce);
  const isMoney = focus?.kind === 'sales';

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
      className="relative overflow-hidden rounded-xl border border-dashed border-orange-500/40 bg-gradient-to-b from-orange-500/10 via-background to-background p-5 sm:p-6"
    >
      {!reduce && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-sheen absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
        </div>
      )}

      <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
        <ProgressRing pct={pct}>
          {focus ? (
            <CachedImage
              src={focus.image}
              alt={focus.label}
              className={cn('h-full w-full object-contain p-3', !focus.earned && 'opacity-70')}
            />
          ) : (
            <Trophy className="h-10 w-10 text-primary" />
          )}
        </ProgressRing>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">
            {focus ? 'Next milestone' : 'Every badge earned'}
          </p>
          {focus ? (
            <>
              <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">{focus.label}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                <strong className="font-bold text-foreground">{Math.round(shownPct)}%</strong> of the way there —{' '}
                {formatFigure(focus.current ?? 0, !!isMoney)} of {formatFigure(focus.value, !!isMoney)}.{' '}
                <span className="whitespace-nowrap">
                  {formatFigure(focus.remaining, !!isMoney)} to go.
                </span>
              </p>
              <div className="mt-3 sm:max-w-md">
                <Progress
                  value={pct}
                  className="h-2"
                  indicatorClassName="bg-gradient-to-r from-amber-400 via-orange-500 to-pink-600"
                />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                {set.totalCount > 0 ? 'Nothing left to unlock' : 'Your first milestone is close'}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {set.totalCount > 0
                  ? 'You have cleared every badge Zeneva tracks. New ones get added as shops outgrow these.'
                  : 'Record a sale, add products or save a customer and the ladders below start filling in.'}
              </p>
            </>
          )}
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            <Sparkles className="h-3 w-3" />
            {set.earnedCount} of {set.totalCount} badges earned
          </p>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {set.ladders.map((ladder) => (
          <LadderRail key={ladder.kind} ladder={ladder} formatFigure={formatFigure} />
        ))}
      </div>
    </motion.div>
  );
}

/* ────────────────────────────── the trophy case ───────────────────────────── */

function RungRow({
  rung,
  formatFigure,
  onSelect,
}: {
  rung: Achievement;
  formatFigure: (value: number, isMoney: boolean) => string;
  onSelect: (rung: Achievement) => void;
}) {
  const isMoney = rung.kind === 'sales';
  const crossedOn = earnedOnLabel(rung.earnedAt);

  return (
    <div className="relative pb-4 last:pb-0">
      <div
        className={cn(
          'absolute left-2 top-7 h-4 w-4 -translate-x-1/2 rounded-full border-4 border-background md:left-6',
          rung.earned ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted',
        )}
      />
      <div className="ml-6 md:ml-10">
        <button
          type="button"
          disabled={!rung.earned}
          onClick={() => rung.earned && onSelect(rung)}
          className={cn(
            'group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition-all md:gap-5 md:p-4',
            rung.earned
              ? 'cursor-pointer hover:scale-[1.01] hover:shadow-md'
              : 'cursor-default border-dashed opacity-70',
          )}
        >
          {rung.earned && (
            <div className="absolute inset-0 z-0">
              <Image
                src="/achievement_bg.png"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover opacity-20"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/90 to-background/40" />
            </div>
          )}

          <div
            className={cn(
              'relative z-10 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border shadow-sm transition-transform duration-500 md:h-16 md:w-16',
              rung.earned
                ? 'bg-background/50 backdrop-blur-sm group-hover:scale-110'
                : 'bg-muted/60',
            )}
          >
            {rung.earned ? (
              <CachedImage src={rung.image} alt={rung.label} className="h-full w-full object-contain p-1.5" />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          <div className="relative z-10 min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm font-bold md:text-base',
                rung.earned ? 'text-foreground group-hover:text-primary' : 'text-muted-foreground',
              )}
            >
              {rung.label}
            </p>
            {rung.earned ? (
              <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
                {crossedOn
                  ? `Crossed on ${crossedOn}`
                  : rung.kind === 'sales'
                    ? 'Crossed before your recent receipts'
                    : `Now at ${formatFigure(rung.current ?? 0, isMoney)}`}
              </p>
            ) : rung.current === null ? (
              <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">Not measured here</p>
            ) : (
              <div className="mt-1.5 md:max-w-xs">
                <Progress value={rung.progress * 100} className="h-1.5" />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {Math.round(rung.progress * 100)}% · {formatFigure(rung.remaining, isMoney)} to go
                </p>
              </div>
            )}
          </div>

          {rung.earned && (
            <div className="relative z-10 hidden shrink-0 opacity-0 transition-opacity group-hover:opacity-100 sm:block">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary">
                <PartyPopper className="h-5 w-5" />
              </span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

function LadderSection({
  ladder,
  formatFigure,
  onSelect,
}: {
  ladder: AchievementLadder;
  formatFigure: (value: number, isMoney: boolean) => string;
  onSelect: (rung: Achievement) => void;
}) {
  const Icon = LADDER_ICON[ladder.kind];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Icon className="h-4 w-4 text-primary" />
          {ladder.title}
          <span className="font-semibold text-muted-foreground">
            {ladder.earnedCount}/{ladder.rungs.length}
          </span>
        </h3>
        <span className="text-xs text-muted-foreground">
          {ladder.current === null
            ? 'Not measured in this view'
            : `${formatFigure(ladder.current, ladder.isMoney)} ${ladder.unit}`}
        </span>
      </div>
      <div className="relative pl-2 before:absolute before:left-2 before:top-2 before:h-[calc(100%-1.5rem)] before:w-0.5 before:-translate-x-1/2 before:bg-border before:content-[''] md:pl-6 md:before:left-6">
        {ladder.rungs.map((rung) => (
          <RungRow key={rung.id} rung={rung} formatFigure={formatFigure} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────── the goals ───────────────────────────────── */

type GoalMetric = 'totalSales' | 'customerCount' | 'productCount';

interface Goal {
  id: number;
  title: string;
  target: number;
  metric: GoalMetric;
}

const GOAL_METRICS: { key: GoalMetric; label: string; icon: React.ElementType; isMoney: boolean }[] = [
  { key: 'totalSales', label: 'Total Sales', icon: DollarSign, isMoney: true },
  { key: 'customerCount', label: 'Customer Count', icon: Users, isMoney: false },
  { key: 'productCount', label: 'Products in Catalogue', icon: Package, isMoney: false },
];

const LEGACY_GOALS_KEY = 'userGoals';

function GoalSetting({
  set,
  formatFigure,
}: {
  set: AchievementSet;
  formatFigure: (value: number, isMoney: boolean) => string;
}) {
  const { business, isImpersonating, triggerConfetti } = usePOS();
  const businessId = business?.id || null;
  const { toast } = useToast();

  const [goals, setGoals] = React.useState<Goal[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [newGoal, setNewGoal] = React.useState({ title: '', target: '', metric: 'totalSales' as GoalMetric });
  const loadedFor = React.useRef<string | null>(null);

  // Per business, with the old global key adopted once. Adoption is skipped while
  // impersonating: those goals belong to the admin, not to the shop on screen.
  React.useEffect(() => {
    if (!businessId || loadedFor.current === businessId) return;
    const key = `zeneva_goals_${businessId}`;
    const stored = secureStorage.getItem<Goal[]>(key);
    if (Array.isArray(stored)) {
      loadedFor.current = businessId;
      setGoals(stored);
      return;
    }
    const legacy = !isImpersonating ? secureStorage.getItem<Goal[]>(LEGACY_GOALS_KEY) : null;
    const adopted = Array.isArray(legacy) ? legacy : [];
    secureStorage.setItem(key, adopted);
    loadedFor.current = businessId;
    setGoals(adopted);
  }, [businessId, isImpersonating]);

  const persist = React.useCallback(
    (next: Goal[]) => {
      setGoals(next);
      if (businessId) secureStorage.setItem(`zeneva_goals_${businessId}`, next);
    },
    [businessId],
  );

  const figures = React.useMemo<Record<GoalMetric, number | null>>(() => {
    const byKind = (kind: AchievementKind) => set.ladders.find((l) => l.kind === kind)?.current ?? null;
    return {
      // Lifetime revenue, the same figure the ladders and the milestone notification
      // use — not the capped receipt sum this used to add up.
      totalSales: byKind('sales'),
      customerCount: byKind('customers'),
      productCount: byKind('products'),
    };
  }, [set.ladders]);

  const handleAddGoal = () => {
    const target = Number(newGoal.target);
    if (!newGoal.title.trim() || !Number.isFinite(target) || target <= 0) {
      toast({
        variant: 'destructive',
        title: 'Missing Info',
        description: 'Give the goal a title and a target above zero.',
      });
      return;
    }
    const newId = goals.length > 0 ? Math.max(...goals.map((g) => g.id)) + 1 : 1;
    persist([...goals, { title: newGoal.title.trim(), metric: newGoal.metric, id: newId, target }]);
    setIsDialogOpen(false);
    setNewGoal({ title: '', target: '', metric: 'totalSales' });
    toast({ variant: 'success', title: 'Goal Set!', description: 'Your new goal has been added.' });
  };

  const activeMetric = GOAL_METRICS.find((m) => m.key === newGoal.metric) || GOAL_METRICS[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target />
            Your Goals
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Set New Goal
          </Button>
        </CardTitle>
        <CardDescription>
          Your own targets, alongside the milestones above. Saved on this device for this business only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {goals.length > 0 ? (
          goals.map((goal) => {
            const metric = GOAL_METRICS.find((m) => m.key === goal.metric) || GOAL_METRICS[0];
            const current = figures[goal.metric];
            const progress = current === null ? 0 : Math.min(100, (current / goal.target) * 100);
            const isAchieved = current !== null && current >= goal.target;
            const MetricIcon = metric.icon;
            return (
              <div
                key={goal.id}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  isAchieved && 'border-primary/40 bg-primary/5',
                )}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <MetricIcon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{goal.title}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => {
                      persist(goals.filter((g) => g.id !== goal.id));
                      toast({ title: 'Goal Removed' });
                    }}
                  >
                    Delete
                  </Button>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {current === null ? 'Not measured here' : formatFigure(current, metric.isMoney)} of{' '}
                    {formatFigure(goal.target, metric.isMoney)}
                  </span>
                  <span className="font-semibold">{progress.toFixed(progress < 10 ? 1 : 0)}%</span>
                </div>
                {isAchieved && (
                  <button
                    type="button"
                    onClick={() => triggerConfetti?.()}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                  >
                    <PartyPopper className="h-3.5 w-3.5" /> Goal achieved — celebrate
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border-2 border-dashed p-8 text-center text-muted-foreground">
            <p>You haven&apos;t set any goals yet.</p>
            <p className="text-sm">Click &quot;Set New Goal&quot; to get started.</p>
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set a New Goal</DialogTitle>
            <DialogDescription>Define a new target for your business to work towards.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="goal-title">Goal Title</Label>
              <Input
                id="goal-title"
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                placeholder="e.g., Reach 1,000 Customers"
              />
            </div>
            <div>
              <Label htmlFor="goal-metric">Metric to Track</Label>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="mt-1 w-full justify-between bg-background font-normal"
                    id="goal-metric"
                  >
                    <span className="flex items-center">
                      <activeMetric.icon className="mr-2 inline-block h-4 w-4" />
                      {activeMetric.label}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full min-w-[220px]">
                  {GOAL_METRICS.map((metric) => (
                    <DropdownMenuItem
                      key={metric.key}
                      onClick={() => setNewGoal({ ...newGoal, metric: metric.key })}
                    >
                      <metric.icon className="mr-2 inline-block h-4 w-4" />
                      {metric.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div>
              <Label htmlFor="goal-target">Target Value</Label>
              <Input
                id="goal-target"
                type="number"
                value={newGoal.target}
                onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
                placeholder="e.g., 1000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddGoal}>Add Goal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ────────────────────────────────── page ──────────────────────────────────── */

export default function AchievementsPage() {
  const { toast } = useToast();
  const { business, triggerConfetti, currencySymbol } = usePOS();
  const { set } = useAchievements();
  const searchParams = useSearchParams();
  const formatFigure = useFigureFormatter();

  const [selected, setSelected] = React.useState<Achievement | null>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  // `set.dated` holds only rungs with a real crossing date, newest first. Re-checked
  // through `earnedOnLabel` so an epoch timestamp can never surface as 1970.
  const mostRecent = React.useMemo(
    () => set.dated.find((r) => earnedOnLabel(r.earnedAt) !== null) ?? null,
    [set.dated],
  );

  // Deep link from the celebration card: `/achievements?badge=sales-1000000`. Opened
  // once, so closing it and refreshing does not fight the URL.
  const openedDeepLink = React.useRef(false);
  const badgeParam = searchParams?.get('badge') || null;
  React.useEffect(() => {
    if (!badgeParam || openedDeepLink.current) return;
    const match = set.ladders.flatMap((l) => l.rungs).find((r) => r.id === badgeParam && r.earned);
    if (!match) return;
    openedDeepLink.current = true;
    setSelected(match);
    triggerConfetti?.();
  }, [badgeParam, set.ladders, triggerConfetti]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, { useCORS: true, scale: 3, backgroundColor: null });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `zeneva-achievement-${(selected?.label || 'badge').replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Downloaded!', description: 'Your achievement card has been saved.' });
    } catch (error) {
      console.error('Download failed', error);
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: 'Could not save the image. Please try again.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const selectedDate = earnedOnLabel(selected?.earnedAt ?? null);
  const selectedIsMoney = selected?.kind === 'sales';

  return (
    <div className="space-y-6">
      <PageTitle
        title="Achievements & Goals"
        subtitle="Celebrate your milestones and set new targets for your business."
      />

      <NextMilestoneHero set={set} formatFigure={formatFigure} />

      {/* Rating badges: the only section here whose progress moves every day, so it
          is what makes the page worth reopening. */}
      <RatingBadges />

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-primary">
            <div className="flex items-center gap-2">
              <Award />
              Trophy Case
            </div>
            <Button variant="outline" size="sm" onClick={() => triggerConfetti?.()}>
              <PartyPopper className="mr-2 h-4 w-4" />
              Celebrate!
            </Button>
          </CardTitle>
          <CardDescription>
            Every badge Zeneva tracks, earned and unearned. Tap an earned badge for a certificate you can
            download and share.
            {mostRecent && (
              <>
                {' '}
                Most recent: <strong className="font-semibold text-foreground">{mostRecent.label}</strong>,{' '}
                {earnedOnLabel(mostRecent.earnedAt)}.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {set.ladders.map((ladder) => (
            <LadderSection
              key={ladder.kind}
              ladder={ladder}
              formatFigure={formatFigure}
              onSelect={(rung) => {
                setSelected(rung);
                triggerConfetti?.();
              }}
            />
          ))}

          <div className="space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Sales badges use your lifetime total, and a date is shown only where the receipt that crossed
                the line is still on this device. Catalogue and customer badges are counts, so they carry a
                figure rather than a date.
              </span>
            </p>
            {set.revenueIsFloor && (
              <p className="pl-[1.375rem]">
                Your lifetime sales counter has not loaded yet, so the sales figure above is a floor from the
                receipts held on this device.
              </p>
            )}
            {currencySymbol && currencySymbol !== '₦' && (
              <p className="pl-[1.375rem]">
                Milestone thresholds are naira figures and are the same for every shop; your own totals are
                shown in {currencySymbol}.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <GoalSetting set={set} formatFigure={formatFigure} />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="gap-0 overflow-hidden border-0 p-0 sm:max-w-md">
          <DialogTitle className="sr-only">Achievement Details</DialogTitle>
          <DialogDescription className="sr-only">
            Detailed view of your selected achievement milestone
          </DialogDescription>

          <div
            ref={cardRef}
            className="relative flex min-h-[420px] flex-col items-center justify-center bg-background p-8 text-center"
          >
            <div className="absolute inset-0 z-0">
              <Image src="/achievement_bg.png" alt="" fill sizes="100vw" className="object-cover opacity-40" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent" />
            </div>

            <div className="relative z-10 mb-4 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 backdrop-blur-md">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                {business?.name || 'My Store'}
              </p>
            </div>

            <div className="relative z-10 mb-6 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-background/80 shadow-xl ring-4 ring-primary/20 backdrop-blur-md">
              {selected && (
                <CachedImage
                  src={selected.image}
                  alt={selected.label}
                  className="h-full w-full rounded-full object-cover"
                />
              )}
            </div>

            <div className="relative z-10 mb-6 w-full">
              <h2 className="mb-2 text-2xl font-bold leading-tight text-primary">{selected?.label}</h2>
              <p className="px-4 text-base font-medium text-foreground/80">
                Earned by {selected?.kind === 'sales' ? 'real sales through the till' : 'real records on file'}.
              </p>
            </div>

            {/* Two facts, both checkable. Where there is no date, the slot states the
                figure instead of inventing one — see the module header. */}
            <div className="relative z-10 grid w-full grid-cols-2 gap-4 rounded-xl border border-white/20 bg-white/60 p-4 shadow-sm backdrop-blur-sm">
              <div className="border-r border-slate-200/60 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {selectedDate ? 'Achieved On' : 'Milestone'}
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-slate-700">
                  {selectedDate || formatFigure(selected?.value ?? 0, !!selectedIsMoney)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {selected?.kind === 'sales' ? 'Lifetime Sales' : selected?.kind === 'products' ? 'Catalogue' : 'Customers'}
                </p>
                <p className="mt-1 text-sm font-bold text-primary">
                  {formatFigure(selected?.current ?? selected?.value ?? 0, !!selectedIsMoney)}
                </p>
              </div>
            </div>

            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80">zeneva.space</p>
            </div>
          </div>

          {/* Action buttons — outside the captured node on purpose. */}
          <div className="flex flex-col gap-3 border-t bg-muted/30 p-4">
            <Button
              className="h-11 w-full gap-2 text-base shadow-md transition-all hover:shadow-lg"
              onClick={() => triggerConfetti?.()}
            >
              <PartyPopper className="h-4 w-4" />
              Celebrate Again!
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full gap-2 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>Downloading...</>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download Certificate
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
