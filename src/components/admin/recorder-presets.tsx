'use client';

import * as React from 'react';
import { Check, Film, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PRESETS, presetRecipe, presetsByGroup, type Preset } from '@/lib/marketing/presets';
import { recipeSeconds, durationLabel, type Recipe } from '@/lib/marketing/recorder';

/**
 * Pick a page and get a finished recording for it.
 *
 * The recorder could always shoot any route; what it asked for first was a recipe,
 * and writing one is a job. This turns that job into a choice — every page in the
 * app arrives pre-scripted, with its captions, camera moves and pacing already
 * set, and drops into the builder below as an ordinary recipe you can then edit.
 *
 * Picking a preset **replaces** whatever recipe is loaded. That is deliberate: a
 * merge would produce a recording that is neither the preset nor the edit, and the
 * only way to notice would be watching the finished video.
 */

type Props = {
  recipe: Recipe | null;
  onPick: (recipe: Recipe) => void;
  disabled?: boolean;
};

export function RecorderPresets({ recipe, onPick, disabled }: Props) {
  const [query, setQuery] = React.useState('');

  const groups = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return presetsByGroup();
    const hit = (p: Preset) =>
      p.title.toLowerCase().includes(q) ||
      p.route.toLowerCase().includes(q) ||
      p.blurb.toLowerCase().includes(q) ||
      p.group.toLowerCase().includes(q);
    return presetsByGroup()
      .map((g) => ({ ...g, presets: g.presets.filter(hit) }))
      .filter((g) => g.presets.length > 0);
  }, [query]);

  // Matched on route rather than title, because the title is the first thing an
  // operator edits after loading one and the tick should survive that.
  const activeRoute = recipe?.route ?? null;
  const found = groups.reduce((n, g) => n + g.presets.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Every page, ready to shoot</h3>
            <Badge variant="secondary" className="text-[10px]">{PRESETS.length}</Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Pick a page and its recording is already written — captions, camera moves,
            pacing. It loads into the builder below, where you can change every word of it.
          </p>
        </div>
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a page…"
            className="h-9 pl-8 pr-8 text-xs"
            disabled={disabled}
            aria-label="Filter pages"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {groups.map(({ group, presets }) => (
        <div key={group} className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {group}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {presets.map((p) => {
              const active = activeRoute === p.route;
              const seconds = recipeSeconds(presetRecipe(p));
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(presetRecipe(p))}
                  aria-pressed={active}
                  className={cn(
                    'group relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all',
                    'hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40 hover:shadow-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:pointer-events-none disabled:opacity-50',
                    active ? 'border-primary/60 bg-primary/5 shadow-sm' : 'border-border',
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-tight">{p.title}</span>
                    {active
                      ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      : <span className="mt-0.5 shrink-0 font-code text-[10px] text-muted-foreground">~{durationLabel(seconds)}</span>}
                  </span>
                  <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {p.blurb}
                  </span>
                  <span className="truncate font-code text-[10px] text-muted-foreground/70">{p.route}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!found && (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No page matches “{query}”.{' '}
          <button type="button" className="underline hover:text-foreground" onClick={() => setQuery('')}>
            Show all {PRESETS.length}
          </button>
        </p>
      )}
    </div>
  );
}
