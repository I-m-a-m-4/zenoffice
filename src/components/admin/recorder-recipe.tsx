'use client';

import * as React from 'react';
import {
  Plus, Trash2, ArrowUp, ArrowDown, Wand2, X, Info, MousePointerClick,
  Type, Timer, MoveVertical, Keyboard, Navigation, Captions, Hand, LayoutTemplate,
  ZoomIn, Maximize,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  STEP_KINDS, STEP_LABELS, blankRecipe, recipeSeconds, durationLabel,
  type Recipe, type RecipeStep, type StepKind, type TargetSpec,
} from '@/lib/marketing/recorder';
import { TitleCardEditor, SlideWriter } from './recorder-cards';
import { RecorderPresets } from './recorder-presets';

/**
 * Build a recording for any page, without writing a flow.
 *
 * The three coded flows exist because a POS checkout needs to know which button
 * is conditional and how long a Firestore write takes. Every other page is the
 * same few moves in a different order — open it, say what it does, click a thing,
 * drift down, hold on the good part — so those are expressed as data here and
 * dispatched through the identical `Page` object the coded flows use.
 *
 * Steps are targeted by **the text a person reads on screen**, not by CSS. A
 * selector like `.grid > div:nth-child(3)` breaks the next time the layout moves
 * and the only symptom is a take that dies mid-flow; "Add to cart" keeps working
 * because if that text changes, the video needed re-shooting anyway.
 *
 * Nothing here validates. The recorder's `parseRecipe` checks every field on its
 * own side of the process boundary — the only side a request cannot skip by
 * posting different JSON — so this file stays a plain editor.
 */

const ICONS: Record<StepKind, React.ElementType> = {
  caption: Captions,
  hold: Timer,
  click: MousePointerClick,
  clickTo: Navigation,
  hover: Hand,
  scroll: MoveVertical,
  fill: Type,
  press: Keyboard,
  goto: Navigation,
  card: LayoutTemplate,
  punch: ZoomIn,
  wide: Maximize,
};

/** A new step of each kind, with defaults that already read well on camera. */
function makeStep(kind: StepKind): RecipeStep {
  switch (kind) {
    case 'caption': return { kind, text: 'Say something about this screen.', ms: 3400 };
    case 'hold': return { kind, ms: 1400 };
    case 'click': return { kind, spec: { text: '' }, ms: 900 };
    case 'clickTo': return { kind, spec: { text: '' }, path: '/dashboard', ms: 1400 };
    case 'hover': return { kind, spec: { text: '' }, ms: 800 };
    case 'scroll': return { kind, dy: 520 };
    case 'fill': return { kind, spec: { placeholder: '' }, text: '', ms: 700 };
    case 'press': return { kind, key: 'Enter' };
    case 'goto': return { kind, route: '/dashboard', ms: 1200 };
    case 'card': return { kind, title: 'Zeneva', subtitle: 'Retail, handled.', ms: 2200 };
    // 1.25 rather than the recorder's 1.3 default: the camera is an upscale of
    // captured 1080p, so a gentler push keeps text crisp. The recorder clamps to
    // 1.6 regardless.
    case 'punch': return { kind, to: 1.25, ms: 900 };
    case 'wide': return { kind, ms: 800 };
  }
}

/** One-line summary of a step, for the collapsed row. */
function describe(s: RecipeStep): string {
  const target = (spec: TargetSpec) =>
    spec.text || spec.placeholder || spec.css || '(nothing chosen yet)';
  switch (s.kind) {
    case 'caption': return `“${s.text || '…'}”`;
    case 'hold': return `${(s.ms / 1000).toFixed(1)}s`;
    case 'click': return target(s.spec);
    case 'clickTo': return `${target(s.spec)} → ${s.path}`;
    case 'hover': return target(s.spec);
    case 'scroll': return s.dy >= 0 ? `down ${s.dy}px` : `up ${Math.abs(s.dy)}px`;
    case 'fill': return `“${s.text}” into ${target(s.spec)}`;
    case 'press': return s.key;
    case 'goto': return s.route;
    case 'card': return s.title || '(untitled)';
    case 'punch': return `${(s.to ?? 1.3).toFixed(2)}×${s.spec?.text ? ` on “${s.spec.text}”` : ' (centre)'}`;
    case 'wide': return 'back to full frame';
  }
}

/** Which single field of a spec this step edits, so the row stays one input. */
function specField(s: Extract<RecipeStep, { spec: TargetSpec }>): 'text' | 'placeholder' {
  return s.kind === 'fill' ? 'placeholder' : 'text';
}

type Props = {
  recipe: Recipe | null;
  onChange: (recipe: Recipe | null) => void;
  disabled?: boolean;
  /** Whether a Gemini key is on the recorder's machine, for the slide writer. */
  hasKey?: boolean;
};

export function RecorderRecipe({ recipe, onChange, disabled, hasKey }: Props) {
  const [adding, setAdding] = React.useState(false);

  const patch = (next: Partial<Recipe>) => {
    if (recipe) onChange({ ...recipe, ...next });
  };

  const patchStep = (i: number, next: Partial<RecipeStep>) => {
    if (!recipe) return;
    const steps = recipe.steps.slice();
    steps[i] = { ...steps[i], ...next } as RecipeStep;
    onChange({ ...recipe, steps });
  };

  const move = (i: number, by: -1 | 1) => {
    if (!recipe) return;
    const j = i + by;
    if (j < 0 || j >= recipe.steps.length) return;
    const steps = recipe.steps.slice();
    [steps[i], steps[j]] = [steps[j], steps[i]];
    onChange({ ...recipe, steps });
  };

  if (!recipe) {
    return (
      <div className="space-y-4">
        <RecorderPresets recipe={null} onPick={onChange} disabled={disabled} />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(blankRecipe())}
          className={cn(
            'flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6',
            'text-center transition-all hover:border-primary/40 hover:bg-accent/40 disabled:opacity-50',
          )}
        >
          <Wand2 className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-semibold">Or start from nothing</span>
          <span className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Point the bot at any route and describe what it should do there — click, type,
            scroll, hold, push the camera in. No code, and it runs through the same
            machinery as the flows above.
          </span>
        </button>
      </div>
    );
  }

  const seconds = recipeSeconds(recipe);

  return (
    <div className="space-y-4">
      {/* Still visible with a recipe loaded, so switching page is one click rather
          than Remove → hunt → pick. Choosing another replaces this one; the tick
          on the current page's card says which is loaded. */}
      <RecorderPresets recipe={recipe} onPick={onChange} disabled={disabled} />

      <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <h4 className="font-headline text-sm font-bold">Custom recording</h4>
          <Badge variant="secondary" className="font-mono text-[10px]">
            ~{durationLabel(seconds)}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          <X className="h-3 w-3" /> Remove
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="rp-title" className="text-xs text-muted-foreground">Name</Label>
          <Input
            id="rp-title"
            value={recipe.title}
            disabled={disabled}
            placeholder="Dashboard tour"
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rp-route" className="text-xs text-muted-foreground">Starting page</Label>
          <Input
            id="rp-route"
            value={recipe.route}
            disabled={disabled}
            placeholder="/dashboard"
            className="font-mono text-xs"
            onChange={(e) => patch({ route: e.target.value })}
          />
        </div>
      </div>

      {/* Title cards. Both optional, and both are what makes a screen recording
          read as an advert rather than a support ticket attachment. Same editor
          the coded flows use — see recorder-cards.tsx. */}
      <div className="space-y-3">
        <SlideWriter
          hasKey={hasKey}
          disabled={disabled}
          flowLabel={recipe.title}
          onApply={(pair) => {
            // Only the slots the writer filled in. A recipe's cards live directly
            // on the recipe rather than in an override map, so an untouched slot
            // keeps whatever is already there.
            const next: Partial<Recipe> = {};
            if (pair.open) next.open = { ...pair.open, ...(recipe.open?.image ? { image: recipe.open.image } : {}) };
            if (pair.end) next.end = { ...pair.end, ...(recipe.end?.image ? { image: recipe.end.image } : {}) };
            patch(next);
          }}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {(['open', 'end'] as const).map((slot) => (
            <TitleCardEditor
              key={slot}
              slot={slot}
              card={recipe[slot] ?? null}
              disabled={disabled}
              onChange={(next) => patch({ [slot]: next } as Partial<Recipe>)}
            />
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs text-muted-foreground">
            Steps ({recipe.steps.length})
          </Label>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            disabled={disabled || recipe.steps.length >= 60}
            onClick={() => setAdding((a) => !a)}
          >
            <Plus className="h-3 w-3" /> Add step
          </Button>
        </div>

        {adding && (
          <div className="grid gap-1.5 rounded-lg border border-border bg-card p-2 sm:grid-cols-2">
            {STEP_KINDS.map((kind) => {
              const Icon = ICONS[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    patch({ steps: [...recipe.steps, makeStep(kind)] });
                    setAdding(false);
                  }}
                  className="flex items-start gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-accent/60 disabled:opacity-50"
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">{STEP_LABELS[kind].label}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">
                      {STEP_LABELS[kind].hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {recipe.steps.map((step, i) => {
          const Icon = ICONS[step.kind];
          return (
            <div key={i} className="rounded-lg border border-border bg-card p-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
                  {i + 1}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="shrink-0 text-xs font-medium">{STEP_LABELS[step.kind].label}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                  {describe(step)}
                </span>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    size="sm" variant="ghost" className="h-6 w-6 p-0"
                    aria-label="Move up" disabled={disabled || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-6 w-6 p-0"
                    aria-label="Move down" disabled={disabled || i === recipe.steps.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive"
                    aria-label="Delete step" disabled={disabled}
                    onClick={() => patch({ steps: recipe.steps.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <StepFields step={step} disabled={disabled} onChange={(next) => patchStep(i, next)} />
            </div>
          );
        })}

        {!recipe.steps.length && (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            No steps yet — the bot would open the page and stop.
          </p>
        )}
      </div>

      <div className="flex gap-2.5 rounded-lg border border-border bg-card p-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Target things by the words on screen — <strong className="text-foreground">Add to cart</strong>,
          not a CSS selector. Text keeps working when the layout moves; a selector breaks
          silently and takes the whole take with it.
        </p>
      </div>
      </div>
    </div>
  );
}

/** The one or two inputs a given step kind needs, inline under its row. */
function StepFields({
  step, disabled, onChange,
}: {
  step: RecipeStep;
  disabled?: boolean;
  onChange: (next: Partial<RecipeStep>) => void;
}) {
  const cls = 'h-8 text-xs';

  if (step.kind === 'hold' || step.kind === 'press' || step.kind === 'scroll') {
    return (
      <div className="mt-2 pl-7">
        {step.kind === 'hold' && (
          <Input
            type="number" min={100} step={100} value={step.ms} disabled={disabled} className={cn(cls, 'max-w-[140px]')}
            onChange={(e) => onChange({ ms: Number(e.target.value) })}
          />
        )}
        {step.kind === 'scroll' && (
          <Input
            type="number" step={40} value={step.dy} disabled={disabled} className={cn(cls, 'max-w-[140px]')}
            onChange={(e) => onChange({ dy: Number(e.target.value) })}
          />
        )}
        {step.kind === 'press' && (
          <div className="flex flex-wrap gap-1.5">
            {(['Enter', 'Escape', 'Tab', 'Backspace', 'Delete'] as const).map((k) => (
              <button
                key={k}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ key: k })}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50',
                  step.key === k
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40 hover:text-foreground',
                )}
              >
                {k}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (step.kind === 'wide') {
    return (
      <div className="mt-2 pl-7">
        <p className="text-[11px] text-muted-foreground">
          Nothing to set — the camera glides back to the whole frame.
        </p>
      </div>
    );
  }

  if (step.kind === 'punch') {
    return (
      <div className="mt-2 grid gap-2 pl-7 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Zoom</span>
            <span className="font-code text-[11px]">{(step.to ?? 1.25).toFixed(2)}×</span>
          </div>
          <input
            type="range" min={1} max={1.6} step={0.05}
            value={step.to ?? 1.25}
            disabled={disabled}
            onChange={(e) => onChange({ to: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:opacity-50"
            aria-label="Zoom amount"
          />
          {/* 1.6 is the recorder's own ceiling. Stated here because a soft-looking
              take at 1.55 reads as a broken encoder rather than as physics. */}
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Past about 1.5× text starts to soften — the camera enlarges the captured
            frame rather than re-rendering the page.
          </p>
        </div>
        <Input
          value={step.spec?.text ?? ''}
          disabled={disabled}
          className={cls}
          placeholder="Push in on this text (blank = centre)"
          onChange={(e) => {
            const text = e.target.value;
            onChange({ spec: text ? { text } : undefined });
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-2 grid gap-2 pl-7 sm:grid-cols-2">
      {step.kind === 'caption' && (
        <Input
          value={step.text} disabled={disabled} className={cls} placeholder="What to say here"
          onChange={(e) => onChange({ text: e.target.value })}
        />
      )}
      {step.kind === 'goto' && (
        <Input
          value={step.route} disabled={disabled} className={cn(cls, 'font-mono')} placeholder="/inventory"
          onChange={(e) => onChange({ route: e.target.value })}
        />
      )}
      {step.kind === 'card' && (
        <>
          <Input
            value={step.title} disabled={disabled} className={cls} placeholder="Headline"
            onChange={(e) => onChange({ title: e.target.value })}
          />
          <Input
            value={step.subtitle ?? ''} disabled={disabled} className={cls} placeholder="Sub-line"
            onChange={(e) => onChange({ subtitle: e.target.value })}
          />
        </>
      )}
      {(step.kind === 'click' || step.kind === 'clickTo' || step.kind === 'hover' || step.kind === 'fill') && (
        <>
          <Input
            value={step.spec[specField(step)] ?? ''}
            disabled={disabled}
            className={cls}
            placeholder={step.kind === 'fill' ? 'Field placeholder text' : 'Text on the element'}
            onChange={(e) => onChange({ spec: { ...step.spec, [specField(step)]: e.target.value } })}
          />
          {step.kind === 'fill' && (
            <Input
              value={step.text} disabled={disabled} className={cls} placeholder="What to type"
              onChange={(e) => onChange({ text: e.target.value })}
            />
          )}
          {step.kind === 'clickTo' && (
            <Input
              value={step.path} disabled={disabled} className={cn(cls, 'font-mono')} placeholder="/page it lands on"
              onChange={(e) => onChange({ path: e.target.value })}
            />
          )}
        </>
      )}
    </div>
  );
}
