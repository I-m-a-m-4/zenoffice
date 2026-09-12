'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The studio's control bar: everything the recorder needs, collapsed into one row.
 *
 * ## Why this is a container and not the controls themselves
 *
 * It takes each group's markup as a `React.ReactNode` rather than owning any of it.
 * That is deliberate: the controls already exist and work in `recorder-panel.tsx`,
 * and re-typing seven hundred lines of form markup into a second file to change a
 * *layout* is all risk and no benefit — every transcription is a chance to drop an
 * `aria-pressed` or invert a `disabled`. The panel keeps its JSX; this decides
 * where it appears.
 *
 * It also keeps this file honest. Nothing here knows what a flow or a voice is, so
 * a new control group needs no change to it at all.
 *
 * ## The summary is the point, not decoration
 *
 * A toolbar of dropdowns is only an improvement on a column of cards if you can
 * still see the state without opening anything. Nine cards were at least legible
 * at a glance; four closed popovers that say "Look" and nothing else would be a
 * regression dressed as a tidy-up. So `summary` is required, and it should read as
 * the current value — "Mobile · Dark · Cinematic" — not as a description of what
 * the group contains.
 */
export type ToolbarGroup = {
  /** Stable key. Also the popover's accessible name prefix. */
  id: string;
  /** Short group name on the trigger. One word where possible. */
  label: string;
  /**
   * The current value, shown on the trigger next to the label. Required — see the
   * note above about not hiding state behind a dropdown.
   */
  summary: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** The group's existing markup, unchanged. */
  content: React.ReactNode;
  /**
   * Draw attention to this group — an unset subject, a missing key. Renders a dot
   * on the trigger so a problem is visible while the popover is shut, which is the
   * failure mode this layout would otherwise introduce.
   */
  attention?: boolean;
  /** Width of the popover panel. Some groups need more room than others. */
  width?: 'sm' | 'md' | 'lg';
};

const WIDTHS = {
  sm: 'w-[min(22rem,calc(100vw-2rem))]',
  md: 'w-[min(30rem,calc(100vw-2rem))]',
  lg: 'w-[min(42rem,calc(100vw-2rem))]',
} as const;

export function StudioToolbar({
  groups,
  action,
  className,
}: {
  groups: ToolbarGroup[];
  /** The record button. Outside every popover, because it is the one control that
   *  must never be more than one click away. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 p-2',
        className,
      )}
    >
      {groups.map((g) => {
        const Icon = g.icon;
        return (
          <Popover key={g.id}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-auto gap-2 py-1.5 text-left font-normal"
              >
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {g.label}
                    {g.attention && (
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full bg-amber-500"
                      />
                    )}
                  </span>
                  {/* Truncated rather than wrapped: the bar must stay one row tall
                      on a desktop, and a long music filename should not be what
                      pushes the viewport down. The full value is in the popover. */}
                  <span className="max-w-[16rem] truncate text-xs font-medium text-foreground">
                    {g.summary}
                  </span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            {/*
              `align="start"` so a wide panel opens inward from the left of its
              trigger rather than off the right edge of the window, and the panel
              scrolls rather than growing past the viewport — the recipe editor is
              tall enough to do that on a laptop.
            */}
            <PopoverContent
              align="start"
              className={cn(
                WIDTHS[g.width ?? 'md'],
                'max-h-[min(34rem,70vh)] overflow-y-auto',
              )}
            >
              <div className="space-y-4">{g.content}</div>
            </PopoverContent>
          </Popover>
        );
      })}

      {action && <div className="ms-auto flex items-center gap-2">{action}</div>}
    </div>
  );
}
