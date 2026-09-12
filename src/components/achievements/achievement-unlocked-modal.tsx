'use client';

/**
 * The card an owner sees the moment their shop crosses a milestone.
 *
 * Deliberately built from `FeatureGateUpgradeCard`'s vocabulary
 * (`src/components/shared/feature-gate.tsx`) rather than a new look: the dashed
 * orange border, the orange→background wash, the sparkle cluster, the
 * gradient-framed tile, the `font-black` headline, the `Check` rows and the
 * full-width `rounded-full` call to action. That card is the most rewarding surface
 * in the product and an owner already reads it as "something good just happened".
 * The one substitution is the tile's contents — the earned badge image instead of a
 * lucide glyph.
 *
 * ── Every line on it is the shop's own arithmetic ──────────────────────────────
 *
 * The figure is lifetime revenue from the `stats/overall` counter (or the catalogue
 * or customer count), the date comes off the receipt that crossed the line or is
 * omitted, and the "next" row is the next rung with its real distance. Nothing here
 * is a round number chosen to look impressive, and there is no claim about other
 * businesses — the same rule `src/lib/rating-insights.ts` is held to.
 *
 * Motion: the tile ignites once (`animate-ignite`) and a single sheen crosses the
 * card (`animate-sheen`); neither loops, and both are dropped under
 * `useReducedMotion` along with the sparkle pings. Confetti fires once on open via
 * the POS context, which is the same trigger `/achievements` uses.
 */

import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CachedImage } from '@/components/shared/cached-image';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/use-count-up';
import type { AchievementUnlock } from '@/lib/achievements';

const VERB: Record<AchievementUnlock['achievement']['kind'], string> = {
  sales: 'crossed',
  products: 'reached',
  customers: 'reached',
};

function CheckRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Check className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
      <p className="text-left text-sm font-medium text-muted-foreground">{children}</p>
    </div>
  );
}

export default function AchievementUnlockedModal({
  unlock,
  businessName,
  formatFigure,
  formatDate,
  onDismiss,
}: {
  unlock: AchievementUnlock;
  businessName: string;
  /** Formats a ladder figure — money for sales, a plain count otherwise. */
  formatFigure: (value: number, isMoney: boolean) => string;
  /** Formats the crossing date, or returns null when there is none to show. */
  formatDate: (date: Date | null) => string | null;
  onDismiss: () => void;
}) {
  const reduce = useReducedMotion();
  const { achievement, alsoCrossed, next } = unlock;
  const isMoney = achievement.kind === 'sales';
  const figure = achievement.current ?? achievement.value;
  const shown = useCountUp(figure, !reduce);
  const crossedOn = formatDate(achievement.earnedAt);

  return (
    <Dialog open onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">{achievement.label} unlocked</DialogTitle>
        <DialogDescription className="sr-only">
          Your business has {VERB[achievement.kind]} {achievement.label}.
        </DialogDescription>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
          className="relative w-full overflow-hidden rounded-xl border border-dashed border-orange-500/40 bg-background bg-gradient-to-b from-orange-500/10 via-background to-background p-7 text-center backdrop-blur-md sm:p-8"
        >
          {/* One pass of light across the card on reveal. Never loops. */}
          {!reduce && (
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              <div className="animate-sheen absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
            </div>
          )}

          <div className="relative z-10">
            <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1">
              <Trophy className="h-3 w-3 text-orange-600 dark:text-orange-400" />
              <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-400">
                {businessName}
              </p>
            </div>

            {/* The badge, framed exactly as the upgrade card frames its icon. */}
            <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
              <div
                className={cn(
                  'absolute inset-0 scale-150 rounded-full bg-amber-500/10 blur-xl',
                  !reduce && 'animate-pulse',
                )}
              />
              <Sparkles
                className={cn('absolute -right-1 -top-1 h-5 w-5 text-amber-500', !reduce && 'animate-bounce')}
              />
              <Sparkles className="absolute -bottom-2 -left-2 h-4 w-4 text-amber-400 opacity-75" />
              <div
                className={cn(
                  'absolute -left-4 top-8 h-2.5 w-2.5 rounded-full bg-amber-300',
                  !reduce && 'animate-ping',
                )}
              />
              <div className="absolute -right-4 bottom-8 h-2 w-2 rounded-full bg-amber-400" />

              <div
                className={cn(
                  'relative z-10 h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-pink-600 p-[3px] shadow-lg',
                  !reduce && 'animate-ignite',
                )}
              >
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[13px] bg-background">
                  <CachedImage
                    src={achievement.image}
                    alt={achievement.label}
                    className="h-full w-full object-contain p-1.5"
                  />
                </div>
              </div>
            </div>

            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">
              Milestone unlocked
            </p>
            <h3 className="mb-2 text-2xl font-black tracking-tight sm:text-3xl">{achievement.label}</h3>
            <p className="mb-6 px-2 text-sm leading-relaxed text-muted-foreground">
              Your shop just {VERB[achievement.kind]} it
              {crossedOn ? ` on ${crossedOn}` : ''}. That is real money through a real till — well done.
            </p>

            <div className="mb-7 space-y-3.5">
              <CheckRow>
                <strong className="font-semibold text-foreground">
                  {formatFigure(Math.round(shown), isMoney)}
                </strong>{' '}
                {isMoney ? 'in lifetime sales' : achievement.kind === 'products' ? 'products on the shelf' : 'customers on file'}.
              </CheckRow>

              {alsoCrossed > 0 && (
                <CheckRow>
                  <strong className="font-semibold text-foreground">
                    {alsoCrossed} earlier milestone{alsoCrossed === 1 ? '' : 's'}
                  </strong>{' '}
                  cleared on the way here. They are all in your trophy case.
                </CheckRow>
              )}

              {next && (
                <CheckRow>
                  Next up: <strong className="font-semibold text-foreground">{next.label}</strong> —{' '}
                  {Math.round(next.progress * 100)}% there, {formatFigure(Math.round(next.remaining), isMoney)}{' '}
                  to go.
                </CheckRow>
              )}

              {!next && (
                <CheckRow>
                  <strong className="font-semibold text-foreground">Top of the ladder.</strong> There is no
                  higher badge on this one yet.
                </CheckRow>
              )}
            </div>

            <div className="space-y-2.5 pt-1">
              <Button
                asChild
                onClick={onDismiss}
                className="h-12 w-full rounded-full bg-orange-400 font-extrabold text-white shadow-md transition-all duration-300 hover:scale-[1.01] hover:bg-orange-500 hover:text-white active:scale-95"
              >
                <Link href={`/achievements?badge=${achievement.id}`}>
                  See my badge
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                onClick={onDismiss}
                className="h-9 w-full rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Back to selling
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
