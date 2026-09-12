'use client';

/**
 * Reports → Business Rating.
 *
 * Replaces a tab that showed four permanently-zero pillar bars, 400 invented
 * competitors, and hardcoded prose ("Reorder points are set correctly") printed
 * under whichever number happened to be on screen.
 *
 * ── What this tab is for ───────────────────────────────────────────────────
 *
 * **Growing revenue.** Inventory condition has its own score on the Inventory
 * page's Health tab; this one scores the four terms that multiply money —
 * margin, basket, repeat, momentum — and then answers the only question an owner
 * actually has: *where is the money I am not getting.*
 *
 * ── Why it looks like this ─────────────────────────────────────────────────
 *
 * **One hero figure.** The score, ≥48px, in ink — the ring beside it carries the
 * severity colour, because a colored numeral is the one piece of text that cannot
 * also be read as a label.
 *
 * **The delta names its own cause.** `business-rating.ts` rule 2 promises that
 * *"why did I drop four points"* has an answer, so the movement is never shown
 * alone: the pillars that produced it sit next to it. A day whose history predates
 * per-pillar snapshots shows the delta with no attribution rather than a guess.
 *
 * **Every pillar carries the one action that moves it**, and the pillar with the
 * most points available is expanded on arrival — so the page always opens with a
 * concrete next step visible without a click.
 *
 * **Opportunities are priced in currency, not points.** A shop does not care that
 * winning back its lapsed buyers is worth six points; it cares that it is worth
 * ₦480,000. Every figure is summed from its own receipts, and the two that are
 * conditional say the condition on the line beneath. Points appear only on the
 * pillar meters, where they are the literal arithmetic of the score.
 *
 * **Competition is against yesterday, then against the median shop.** Delta,
 * streak, personal best and the trend line come first, because they are the owner's
 * own and always available. The peer comparison is a tick on each meter and one
 * figure beside the personal best — real medians over real Zeneva shops
 * (`src/lib/rating-benchmark.ts`), captioned with the cohort size and the date the
 * platform last computed them. When there is no cohort the comparison is absent
 * rather than approximated: the tab this replaced showed 400 invented competitors
 * and percentiles computed as `score * 0.8`, and that is the failure being
 * corrected, not a feature being matched.
 *
 * **Confetti fires here and nowhere else.** The top bar consumes the same hook and
 * is mounted on every page, so celebrating in the hook would fire twice and fire
 * on whatever page the owner was looking at. This component is the single caller
 * of `triggerConfetti` for a tier crossing, and it acknowledges the level-up only
 * after celebrating — so an owner who never opens this tab still gets the moment
 * the first time they do.
 */

import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Crown,
  EyeOff,
  Gauge,
  Loader2,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/i18n-context';
import { usePOS } from '@/context/pos-context';
import { useBusinessRating, type RatingMover } from '@/hooks/use-business-rating';
import { useRatingBenchmark } from '@/hooks/use-rating-benchmark';
import { useRatingOptIn } from '@/hooks/use-rating-opt-in';
import { useCountUp } from '@/hooks/use-count-up';
import { insightOfTheDay } from '@/lib/rating-insights';
import InsightOfTheDay from '@/components/reports/insight-of-the-day';
import PeerCompare from '@/components/reports/peer-compare';
import { StreakBadge } from '@/components/reports/streak-flame';
import type { Opportunity, PillarKey, RatingPillar } from '@/lib/business-rating';

/**
 * Severity, on the app's existing three steps — the same thresholds the top-bar
 * banner has always used, so a shop's colour does not change meaning between the
 * chrome and this page.
 */
function tone(score: number | null) {
  if (score === null) return { stroke: 'stroke-muted-foreground', fill: 'bg-muted-foreground' };
  if (score >= 80) return { stroke: 'stroke-emerald-500', fill: 'bg-emerald-500' };
  if (score >= 60) return { stroke: 'stroke-amber-500', fill: 'bg-amber-500' };
  return { stroke: 'stroke-destructive', fill: 'bg-destructive' };
}

/** Compact currency — these figures are read at a glance, not reconciled. */
function money(symbol: string, value: number): string {
  const v = Math.round(value);
  const trim = (s: string) => s.replace(/\.0$/, '');
  if (v >= 1_000_000) return `${symbol}${trim((v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1))}M`;
  if (v >= 10_000) return `${symbol}${trim((v / 1_000).toFixed(0))}k`;
  return `${symbol}${v.toLocaleString()}`;
}

/**
 * A real arc, not the decorative `animate-spin-slow` ring this replaces.
 *
 * The arc sweeps out and the numeral counts up together on first paint, on the same
 * easing as the money figure on the insight card so nothing on the page settles at a
 * different speed. Both stop dead under reduced motion — the arc is drawn at its
 * final length and the numeral starts at its final value, which loses the reveal and
 * nothing else.
 */
function ScoreRing({ score, grade }: { score: number | null; grade: string }) {
  const reduce = useReducedMotion();
  const animate = !reduce;
  const r = 56;
  const circumference = 2 * Math.PI * r;
  const t = tone(score);

  const counted = useCountUp(score ?? 0, animate && score !== null);
  const drawn = ((score ?? 0) / 100) * circumference;

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="8" className={cn(t.stroke, 'opacity-15')} />
        {score !== null && (
          <motion.circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={t.stroke}
            initial={{ strokeDasharray: `${animate ? 0 : drawn} ${circumference}` }}
            animate={{ strokeDasharray: `${drawn} ${circumference}` }}
            transition={{ duration: animate ? 0.9 : 0, ease: 'easeOut' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-5xl font-bold tracking-tight text-foreground tabular-nums">
          {score === null ? '--' : Math.round(counted)}
        </span>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{grade}</span>
      </div>
    </div>
  );
}

function DeltaChip({ delta }: { delta: number | null }) {
  const { t } = useI18n();
  if (delta === null) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {t('reports.brFirstReading')}
      </span>
    );
  }
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold',
        delta > 0
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : delta < 0
            ? 'border-destructive/30 bg-destructive/10 text-destructive'
            : 'border-border bg-muted text-muted-foreground',
      )}
    >
      <Icon className="h-3 w-3" />
      {delta > 0 ? `+${delta}` : delta}
    </span>
  );
}

/**
 * Why the number moved. Two pillars at most — the third is noise at this size,
 * and the pillar list below carries the full picture anyway.
 */
function Movers({ movers }: { movers: RatingMover[] }) {
  if (movers.length === 0) return null;
  return (
    <span className="text-xs text-muted-foreground">
      {movers.slice(0, 2).map((m, i) => (
        <React.Fragment key={m.key}>
          {i > 0 && <span className="px-1 opacity-40">·</span>}
          {m.label}{' '}
          <span className={cn('font-bold', m.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
            {m.delta > 0 ? `+${m.delta}` : m.delta}
          </span>
        </React.Fragment>
      ))}
    </span>
  );
}

function PillarRow({
  pillar,
  median,
  open,
  onToggle,
}: {
  pillar: RatingPillar;
  /** Platform median for this pillar, or null when there is no cohort behind it. */
  median: number | null;
  open: boolean;
  onToggle: () => void;
}) {
  const { t: translate } = useI18n();
  const t = tone(pillar.score);
  // Nothing to offer when the pillar is already at the ceiling — showing "+0 pts"
  // and an action next to a full meter reads as busywork.
  const worthFixing = pillar.headroom >= 1 || !pillar.measured;
  const showMedian = median !== null && pillar.measured;

  return (
    <div className={cn(!pillar.measured && 'opacity-60')}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!worthFixing}
        aria-expanded={worthFixing ? open : undefined}
        title={
          showMedian
            ? translate('reports.brHintWithMedian', { hint: pillar.hint, median })
            : pillar.hint
        }
        className={cn(
          'flex w-full items-center gap-3 py-2.5 text-left',
          worthFixing && 'cursor-pointer',
        )}
      >
        <span className="w-20 shrink-0 text-sm font-semibold text-foreground">{pillar.label}</span>
        <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
          {pillar.measured ? pillar.score : '--'}
        </span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full">
          <div
            className={cn('absolute inset-0 rounded-full opacity-15', pillar.measured ? t.fill : 'bg-muted-foreground')}
          />
          {pillar.measured && (
            <div
              className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-700', t.fill)}
              style={{ width: `${pillar.score}%` }}
            />
          )}
          {/* Where the median shop sits on this meter. A tick rather than a second
              bar: the comparison is a reference point, not a competing quantity. */}
          {showMedian && (
            <span
              aria-hidden
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground/50"
              style={{ left: `${median}%` }}
            />
          )}
        </div>
        {pillar.measured && pillar.headroom >= 1 && (
          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary">
            +{pillar.headroom}
          </span>
        )}
        <span className="hidden w-40 shrink-0 text-right text-xs text-muted-foreground sm:block">{pillar.hint}</span>
        {worthFixing && (
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        )}
      </button>

      {worthFixing && open && (
        <Link
          href={pillar.fix.href}
          className="group mb-2.5 ml-20 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 transition-colors hover:border-primary/50 hover:bg-primary/10"
        >
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{pillar.fix.label}</span>
          {pillar.measured && pillar.headroom >= 1 && (
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-primary">
              {translate('reports.brPlusPts', { count: pillar.headroom })}
            </span>
          )}
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function OpportunityRow({ item, symbol }: { item: Opportunity; symbol: string }) {
  const blind = item.kind === 'blind';
  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        blind
          ? 'border-dashed border-border/60 bg-transparent hover:border-muted-foreground/40'
          : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-primary/5',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
        <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
      </div>
      <span
        className={cn(
          'flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold tabular-nums',
          blind ? 'bg-muted text-muted-foreground' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        )}
      >
        {blind && <EyeOff className="h-3 w-3" />}
        {money(symbol, item.money)}
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * The recorded days, evenly spaced by index.
 *
 * Days the app was not opened are absent rather than drawn as zero — the count in
 * the caption says how many days there are, so a short line reads as a short
 * history instead of a collapse.
 *
 * The line stretches to the container (`preserveAspectRatio="none"`), which is why
 * the end marker is an HTML dot positioned over the SVG rather than a `<circle>`
 * inside it: a circle in a non-uniform viewBox renders as an ellipse.
 */
function TrendLine({ points }: { points: number[] }) {
  const width = 100;
  const height = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : 0;

  const coords = points.map((value, i) => ({
    x: i * step,
    y: height - ((value - min) / span) * (height - 4) - 2,
  }));
  const last = coords[coords.length - 1];

  return (
    <div className="relative h-7 w-full">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full">
        <polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
          fill="none"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-primary"
        />
      </svg>
      <span
        aria-hidden
        className="absolute h-2 w-2 -translate-x-full -translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
        style={{ left: '100%', top: `${(last.y / height) * 100}%` }}
      />
    </div>
  );
}

/**
 * What this tab shows before the owner has said yes.
 *
 * ── Two different states, not one ──────────────────────────────────────────
 *
 * `neverAsked` is the invitation: an offer, with **no score, no grade and no
 * preview of their number**. Showing a sample score to sell the feature would be
 * the exact thing the opt-in exists to prevent — you cannot un-see a 41.
 *
 * Once they have answered, this is a two-line pointer to Settings and nothing
 * more. Re-pitching a feature somebody declined, every time they open Reports, is
 * how a preference becomes nagging. The tab trigger stays in the list because
 * this is where turning it back on is discoverable, but the page itself stops
 * arguing.
 *
 * **Turn it on takes one click.** There is no Save button here — the offer is the
 * decision, and a two-step confirmation on a preference this reversible only adds
 * a way to fail halfway. Settings, where the switch sits among other settings
 * that do batch, keeps its Save.
 */
function RatingOptInCard({
  neverAsked,
  isSaving,
  onEnable,
  onDecline,
}: {
  neverAsked: boolean;
  isSaving: boolean;
  onEnable: () => void;
  onDecline: () => void;
}) {
  const { t } = useI18n();
  if (!neverAsked) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center sm:p-10">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <EyeOff className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{t('reports.brOffTitle')}</p>
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">
            {t('reports.brOffBody')}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="mt-1">
          <Link href="/settings">{t('reports.brOpenSettings')}</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex flex-col items-center gap-4 p-8 text-center sm:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Gauge className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-bold text-foreground sm:text-xl">
            {t('reports.brPitchTitle')}
          </h3>
          {/* Ends on "in money" on purpose — currency, not points. The note lives on
              `brPitchBody` in en.ts so a translator sees it. */}
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            {t('reports.brPitchBody')}
          </p>
        </div>

        {/* Four plain claims. No sample score, no mocked-up meter — see the note
            above this component. */}
        <ul className="mx-auto max-w-sm space-y-1.5 text-left text-xs text-muted-foreground">
          {[
            t('reports.brClaimPrivate'),
            t('reports.brClaimPriced'),
            t('reports.brClaimReversible'),
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <Button onClick={onEnable} disabled={isSaving} className="min-w-[11rem]">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('reports.brTurnOn')}
          </Button>
          <Button variant="ghost" onClick={onDecline} disabled={isSaving} className="text-muted-foreground">
            {t('reports.brNoThanks')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function BusinessRatingPanel() {
  const { t } = useI18n();
  const { currencySymbol, triggerConfetti, business } = usePOS();
  const rating = useBusinessRating();
  const benchmark = useRatingBenchmark(rating.enabled);
  const { setRatingEnabled, isSaving } = useRatingOptIn();
  const {
    score,
    grade,
    tier,
    pillars,
    opportunities,
    delta,
    movers,
    best,
    isPersonalBest,
    streak,
    streakAtRisk,
    history,
    facts,
    leveledUpTo,
    acknowledgeLevelUp,
    today,
    enabled,
    neverAsked,
  } = rating;

  // The pillar with the most points available opens on arrival, so the page never
  // greets the owner with four closed rows and no next step.
  const biggestLever = React.useMemo<PillarKey | null>(() => {
    const candidates = pillars.filter((p) => p.headroom >= 1 || !p.measured);
    if (candidates.length === 0) return null;
    return candidates.reduce((a, b) => (b.headroom > a.headroom ? b : a)).key;
  }, [pillars]);
  const [openPillar, setOpenPillar] = React.useState<PillarKey | null>(null);
  const [touched, setTouched] = React.useState(false);
  const shownPillar = touched ? openPillar : biggestLever;

  // Celebrate a tier crossing exactly once. The ref guards against a re-render
  // between firing and the acknowledgement landing in storage; the acknowledgement
  // itself is what stops it firing again on the next visit.
  const celebrated = React.useRef(false);
  React.useEffect(() => {
    if (!leveledUpTo || celebrated.current) return;
    celebrated.current = true;
    triggerConfetti?.();
    acknowledgeLevelUp();
  }, [leveledUpTo, triggerConfetti, acknowledgeLevelUp]);

  const toNextTier = tier.next && score !== null ? Math.max(0, tier.next.floor - score) : 0;
  const tierSpan = tier.next ? tier.next.floor - tier.floor : 1;
  const tierProgress =
    score === null ? 0 : tier.next ? Math.min(100, ((score - tier.floor) / tierSpan) * 100) : 100;

  const onTheTable = opportunities.filter((o) => o.kind === 'gain').reduce((sum, o) => sum + o.money, 0);

  // One insight a day, stable for the whole day. `today` comes from the hook's own
  // date state so it rolls over at midnight with everything else rather than being
  // a second, separately-frozen clock.
  const { insight, total: insightCount } = React.useMemo(
    () => insightOfTheDay(rating, benchmark, today),
    [rating, benchmark, today],
  );

  // ── The opt-in ────────────────────────────────────────────────────────────
  // Everything above is a hook, so this gate sits below all of them: the flag
  // flips at runtime the moment the owner clicks, and an early return placed
  // higher would change the number of hooks between two renders.
  //
  // This tab is the only rating surface that shows anything at all when the
  // feature is off, because it is where turning it on happens.
  if (!enabled) {
    // Until the business doc lands, neither card is honest — `enabled` is false
    // and `neverAsked` is false, which is the truth (nothing is known yet) and
    // not a state with a card. One blank beat beats flashing the wrong one.
    if (!business) return null;
    return (
      <RatingOptInCard
        neverAsked={neverAsked}
        isSaving={isSaving}
        onEnable={() => setRatingEnabled(true)}
        onDecline={() => setRatingEnabled(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Level-up. Rendered from `leveledUpTo`, which the hook only sets against a
          stored high-water mark, so this is a first-time crossing and not a shop
          oscillating around a threshold. */}
      {leveledUpTo && (
        <Card className="flex items-center gap-3 border-primary/40 bg-gradient-to-r from-primary/10 to-transparent p-4">
          <Crown className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              {t('reports.brLevelUp', { index: leveledUpTo.index, name: leveledUpTo.name })}
            </p>
            <p className="text-xs text-muted-foreground">{t('reports.brNewTier')}</p>
          </div>
        </Card>
      )}

      {/* Hero — the one figure this view leads with */}
      <Card className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:gap-8">
        <ScoreRing score={score} grade={grade} />

        <div className="w-full min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xl font-bold tracking-tight text-foreground">
              {score === null ? t('reports.brNotRated') : tier.name}
            </span>
            {score !== null && (
              <span className="rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t('reports.brLevelBadge', { index: tier.index })}
              </span>
            )}
            <DeltaChip delta={delta} />
            {isPersonalBest && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                <Sparkles className="h-3 w-3" />
                {t('reports.brNewBest')}
              </span>
            )}
            {streak > 0 && <StreakBadge streak={streak} atRisk={streakAtRisk} />}
          </div>

          {/* The delta's cause, on its own line so it can be read without crowding
              the chips above. Absent when the previous snapshot has no pillar
              scores to compare against. */}
          {delta !== null && delta !== 0 && movers.length > 0 && <Movers movers={movers} />}

          {score === null ? (
            <p className="text-sm text-muted-foreground">{t('reports.brNeedFirstSale')}</p>
          ) : (
            <div className="space-y-1.5">
              <div className="relative h-1.5 overflow-hidden rounded-full bg-primary/15">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700"
                  style={{ width: `${tierProgress}%` }}
                />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {tier.next
                  ? t('reports.brToNextTier', { points: toNextTier, name: tier.next.name })
                  : t('reports.brTopTier')}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* The why behind the number. One a day, so there is a reason to come back
          tomorrow — and it sits directly under the hero because the score is the
          hook and this is the payoff. Absent when the shop's own figures do not
          support a single honest claim; nothing generic is substituted. */}
      {insight && (
        <InsightOfTheDay insight={insight} total={insightCount} currencySymbol={currencySymbol} />
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* The four terms that multiply revenue, each with the action that moves it */}
        <Card className="p-5 lg:col-span-2">
          <div className="divide-y divide-border/40">
            {pillars.map((pillar) => (
              <PillarRow
                key={pillar.key}
                pillar={pillar}
                median={benchmark?.medians?.[pillar.key] ?? null}
                open={shownPillar === pillar.key}
                onToggle={() => {
                  setTouched(true);
                  setOpenPillar(shownPillar === pillar.key ? null : pillar.key);
                }}
              />
            ))}
          </div>
          {/* Provenance for the ticks lives on the comparison card below, which is
              where the comparison is spelled out — saying it twice on one screen
              buys nothing and crowds the meters. */}
        </Card>

        {/* Where the money is */}
        <Card className="flex flex-col gap-3 p-5 lg:col-span-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('reports.brOnTheTable')}
            </span>
            {onTheTable > 0 && (
              <span className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {money(currencySymbol, onTheTable)}
              </span>
            )}
          </div>

          {opportunities.length > 0 ? (
            <div className="flex flex-col gap-2">
              {opportunities.map((item) => (
                <OpportunityRow key={item.id} item={item} symbol={currencySymbol} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {score === null ? t('reports.brNothingYet') : t('reports.brNothingLeft')}
            </p>
          )}
        </Card>
      </div>

      {/* The reference point — where this shop stands against shops like it */}
      <PeerCompare score={score} pillars={pillars} benchmark={benchmark} />

      {/* Personal best + trend */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {t('reports.brYourBest')}
          </span>
          <p className="text-2xl font-bold tabular-nums text-foreground">{best ?? '--'}</p>
        </div>
        {/* The peer figure is not repeated here — the comparison card above owns it. */}
        <div className="min-w-0 flex-1">
          {history.length > 1 ? (
            <>
              <TrendLine points={history.map((h) => h.s)} />
              <p className="mt-1 text-xs text-muted-foreground">
                {t('reports.brDaysRecorded', { count: history.length })}
                {facts.truncated &&
                  ` · ${t('reports.brScoredOnLast', { days: facts.coveredDays })}`}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t('reports.brCheckBack')}</p>
          )}
        </div>
        <Link
          href="/achievements"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {t('reports.brBadges')}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </Card>
    </div>
  );
}
