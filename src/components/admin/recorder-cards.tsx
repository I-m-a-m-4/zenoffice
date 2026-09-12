'use client';

/**
 * The opening and closing screen editor, shared by recipes and coded flows.
 *
 * These two cards are the first and last thing a viewer sees, and they are the
 * part of a recording most likely to be rewritten: the click path through the POS
 * encodes real knowledge about the app, but "Sell anywhere. Even offline." is ad
 * copy and changes with the campaign. Both kinds of recording now play their
 * cards from the same table on the recorder's side, so both get the same editor
 * here rather than one having fields and the other requiring a code change.
 *
 * A card can be switched off entirely. That is a real editorial choice — a demo
 * embedded in a landing page usually wants to start on the product, not on a
 * title — so "off" is stored as an explicit `null` rather than as a missing
 * value, and survives all the way to the CLI, which distinguishes the two.
 *
 * ## Slides
 *
 * A card also carries *how* it animates and an optional still behind the words.
 * Both are optional everywhere, so a saved run from before they existed plays
 * exactly as it did — absent motion means `rise`, the look the overlay has always
 * drawn. `SlideWriter` can fill both cards in at once, either from Gemini on this
 * machine or from a prompt pasted into any other chat window; everything it
 * produces goes through `cleanSlide` before it reaches this editor, so a model's
 * output and a person's typing are the same kind of thing by the time they land.
 */

import * as React from 'react';
import { ChevronDown, ImagePlus, Sparkles, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  FLOWS, FLOW_IDS, FLOW_CARD_DEFAULTS,
  type FlowId, type RecorderRequest, type TitleCard,
} from '@/lib/marketing/recorder';
import {
  SLIDE_MOTIONS, SLIDE_IMAGE_ACCEPT, MAX_SLIDE_IMAGE_CHARS, DEFAULT_MOTION,
  cleanSlideImage, parseSlidePair, slidePrompt,
  type SlideMotion, type SlidePair,
} from '@/lib/marketing/slides';

export type CardSlot = 'open' | 'end';

const COPY: Record<CardSlot, { label: string; off: string }> = {
  open: { label: 'Opening card', off: 'Straight into the app, no cold open.' },
  end: { label: 'Closing card', off: 'Ends on the last frame of the page.' },
};

/** The card used when an operator switches a slot back on. */
export const FALLBACK_CARD: Record<CardSlot, TitleCard> = {
  open: { title: 'Zeneva', subtitle: 'Retail, handled.', ms: 2200 },
  end: { title: 'Zeneva', subtitle: 'Retail, handled.', cta: 'Start free', ms: 2600 },
};

/**
 * How the words arrive. Four buttons rather than a select: there are only four,
 * and an operator picking a look wants to see the options at once.
 */
function MotionPicker({
  value, disabled, onChange,
}: {
  value: SlideMotion;
  disabled?: boolean;
  onChange: (next: SlideMotion) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {SLIDE_MOTIONS.map((m) => (
        <button
          key={m.id}
          type="button"
          disabled={disabled}
          title={m.hint}
          onClick={() => onChange(m.id)}
          className={cn(
            'rounded-md border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50',
            value === m.id
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A still behind the words, read straight into a `data:` URI.
 *
 * Read in the browser rather than uploaded anywhere: the slide has to be
 * self-contained by the time the recorder plays it, because the recording browser
 * is signed into a real business and a slide that fetches from a remote host would
 * both leak when a take ran and let someone else's outage blank a frame mid-shoot.
 * So the bytes go straight from the operator's disk into the request that starts
 * the recording, and `cleanSlideImage` is the gate — the same function the API
 * route and the recorder run, checked here only so the message arrives while the
 * file picker is still in mind.
 */
function ImageField({
  image, disabled, onChange,
}: {
  image: string | null | undefined;
  disabled?: boolean;
  onChange: (next: string | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  const read = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => setError('Could not read that file.');
    reader.onload = () => {
      const clean = cleanSlideImage(reader.result);
      if (!clean) {
        setError(
          `Needs to be a PNG, JPEG or WebP under about ${Math.round(MAX_SLIDE_IMAGE_CHARS / 1400)}kB. `
          + 'Scale it down and try again.',
        );
        return;
      }
      onChange(clean);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={SLIDE_IMAGE_ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so picking the same file twice still fires a change event —
          // otherwise a failed read cannot be retried without choosing another file.
          e.target.value = '';
          if (file) read(file);
        }}
      />
      {image ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI has
              nothing for the image optimiser to fetch, resize or cache. */}
          <img
            src={image}
            alt=""
            className="h-9 w-16 shrink-0 rounded border border-border object-cover"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive"
            disabled={disabled}
            onClick={() => { setError(null); onChange(null); }}
          >
            <X className="mr-1 h-3 w-3" />
            Remove
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full px-2 text-[10px] text-muted-foreground"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="mr-1.5 h-3 w-3" />
          Background image
        </Button>
      )}
      {error && <p className="text-[10px] leading-relaxed text-destructive">{error}</p>}
    </div>
  );
}

export function TitleCardEditor({
  slot, card, disabled, onChange, onReset, dirty, fallback,
}: {
  slot: CardSlot;
  /** The card as it will be played, or null for none. */
  card: TitleCard | null;
  disabled?: boolean;
  onChange: (next: TitleCard | null) => void;
  /** Shown as a Reset control when present and `dirty`. */
  onReset?: () => void;
  dirty?: boolean;
  /** What switching the slot back on restores. Defaults to a generic card. */
  fallback?: TitleCard;
}) {
  const copy = COPY[slot];
  const set = (patch: Partial<TitleCard>) => onChange({ ...(card ?? FALLBACK_CARD[slot]), ...patch });

  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border bg-card p-3 transition-colors',
        dirty ? 'border-primary/40' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold">{copy.label}</Label>
        <div className="flex items-center gap-1">
          {onReset && dirty && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              disabled={disabled}
              onClick={onReset}
            >
              Reset
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] hover:bg-muted/60"
            disabled={disabled}
            onClick={() => onChange(card ? null : (fallback ?? FALLBACK_CARD[slot]))}
          >
            {card ? 'Off' : 'On'}
          </Button>
        </div>
      </div>

      {card ? (
        <div className="space-y-2">
          <Input
            value={card.title}
            disabled={disabled}
            placeholder="Headline"
            className="h-8 text-xs"
            onChange={(e) => set({ title: e.target.value })}
          />
          <Input
            value={card.subtitle ?? ''}
            disabled={disabled}
            placeholder="Sub-line"
            className="h-8 text-xs"
            onChange={(e) => set({ subtitle: e.target.value })}
          />
          {/* Only the closing card gets a call to action: a button drawn on the
              opening card would be asking for the click before anything has been
              shown, which is the wrong order for an advert. */}
          {slot === 'end' && (
            <Input
              value={card.cta ?? ''}
              disabled={disabled}
              placeholder="Button text, e.g. Start free"
              className="h-8 text-xs"
              onChange={(e) => set({ cta: e.target.value })}
            />
          )}
          <MotionPicker
            value={card.motion ?? DEFAULT_MOTION}
            disabled={disabled}
            onChange={(motion) => set({ motion })}
          />
          <ImageField
            image={card.image}
            disabled={disabled}
            onChange={(image) => set({ image })}
          />
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{copy.off}</p>
      )}
    </div>
  );
}

/**
 * Write both cards at once — with Gemini, or with any other AI.
 *
 * Two paths on purpose, and the second is the one that matters. "Write it for me"
 * only works when a Gemini key happens to be on this machine for narration, and
 * the person writing ad copy is the least likely to have one. So the prompt itself
 * is copyable: paste it into whatever chat window is already open, paste the reply
 * back, and the result is identical — `parseSlidePair` reads the same JSON either
 * way, tolerating the code fence and the "Sure, here you go!" that comes with it.
 *
 * Neither path is trusted. What arrives is coerced by `cleanSlide` into a headline,
 * two optional lines, a motion from the catalogue and a hold in a sane range, and
 * anything else is dropped — the model is choosing words and a look, not writing
 * markup or code, which is what keeps a confused or injected reply from being able
 * to do anything to a browser that is signed into the owner's business.
 */
export function SlideWriter({
  hasKey, disabled, flowLabel, onApply,
}: {
  /** Whether a Gemini key is on the recorder's machine. */
  hasKey?: boolean;
  disabled?: boolean;
  /** What is being recorded, so the copy can suit it. */
  flowLabel?: string;
  onApply: (pair: SlidePair) => void;
}) {
  const [showPaste, setShowPaste] = React.useState(false);
  const [paste, setPaste] = React.useState('');
  const [angle, setAngle] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const prompt = React.useMemo(
    () => slidePrompt({ angle, product: flowLabel ? `Zeneva — ${flowLabel}` : undefined }),
    [angle, flowLabel],
  );

  const copy = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused; the textarea is the way out.
      setShowPaste(true);
      setError('Could not reach the clipboard — the prompt is below, copy it by hand.');
    }
  };

  const apply = () => {
    setError(null);
    try {
      onApply(parseSlidePair(paste));
      setPaste('');
      setShowPaste(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that.');
    }
  };

  const write = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/record/slides', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ angle, flowLabel }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `The request failed (${res.status}).`);
      onApply({ open: body.open ?? null, end: body.end ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the recorder.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/20 p-3">
      <Input
        value={angle}
        disabled={disabled || busy}
        placeholder="What should it lead with? e.g. it works offline"
        className="h-8 text-xs"
        onChange={(e) => setAngle(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {hasKey && (
          <Button
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            disabled={disabled || busy}
            onClick={write}
          >
            <Sparkles className="mr-1.5 h-3 w-3" />
            {busy ? 'Writing…' : 'Write both cards'}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-[11px]"
          disabled={disabled || busy}
          onClick={copy}
        >
          {copied ? <Check className="mr-1.5 h-3 w-3" /> : <Copy className="mr-1.5 h-3 w-3" />}
          {copied ? 'Copied' : 'Copy the prompt'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          disabled={disabled || busy}
          onClick={() => setShowPaste((v) => !v)}
        >
          Paste a reply
        </Button>
      </div>
      {!hasKey && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          No Gemini key on the recorder&rsquo;s machine — copy the prompt into any AI and paste
          the reply back.
        </p>
      )}
      {showPaste && (
        <div className="space-y-1.5">
          <Textarea
            value={paste}
            disabled={disabled || busy}
            rows={4}
            placeholder='Paste the whole reply — {"open": …, "end": …}'
            className="text-[11px] font-mono"
            onChange={(e) => setPaste(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-[11px]"
            disabled={disabled || busy || !paste.trim()}
            onClick={apply}
          >
            Use these cards
          </Button>
        </div>
      )}
      {error && <p className="text-[10px] leading-relaxed text-destructive">{error}</p>}
    </div>
  );
}

/**
 * The title screens of the coded flows.
 *
 * A coded flow's click path is code because it encodes real knowledge about the
 * app — which button is conditional, how long a write takes. The cards are the
 * opposite: ad copy, rewritten with every campaign, and they must not need a
 * deploy. The defaults come from the same table the recorder ships, so the
 * editor shows the wording that will actually be played; nothing is sent unless
 * it differs.
 */
export function FlowTitleCards({
  cards, disabled, hasKey, onChange,
}: {
  /** Current overrides, keyed by flow id. */
  cards: RecorderRequest['cards'];
  disabled?: boolean;
  /** Whether a Gemini key is on the recorder's machine. */
  hasKey?: boolean;
  onChange: (next: RecorderRequest['cards']) => void;
}) {
  const [open, setOpen] = React.useState<FlowId | null>(null);

  /**
   * Write one slot, or drop the override when `next` is undefined.
   *
   * `undefined` (reset), `null` (no card) and a card are three distinct outcomes
   * and all three have to survive to the CLI — reset restores the authored copy,
   * null ships a video with no title screen.
   */
  const set = (id: FlowId, slot: CardSlot, next: TitleCard | null | undefined) => {
    const base = FLOW_CARD_DEFAULTS[id][slot];
    // An override that re-states the default is not an override. Only real edits
    // are sent, so a run that leaves the copy alone carries nothing at all.
    //
    // Motion and image are part of that comparison, not an afterthought: without
    // them, changing *only* the look would compare equal to the default and be
    // dropped on the way out — the operator would pick "Wipe", see the badge go
    // away, and get the old animation with no indication why.
    const same = next != null && next.title === base.title && next.subtitle === base.subtitle
      && next.cta === base.cta && (next.ms ?? 2200) === (base.ms ?? 2200)
      && (next.motion ?? DEFAULT_MOTION) === (base.motion ?? DEFAULT_MOTION)
      && (next.image ?? null) === (base.image ?? null);

    const flow = { ...(cards[id] ?? {}) };
    if (next === undefined || same) delete flow[slot];
    else flow[slot] = next;

    const rest = { ...cards };
    if (Object.keys(flow).length) rest[id] = flow;
    else delete rest[id];
    onChange(rest);
  };

  /**
   * Apply a written pair to both slots at once.
   *
   * A slot the writer left empty is left alone rather than switched off — the
   * model failing to produce a closing card is not an instruction to remove the
   * one already there.
   */
  const applyPair = (id: FlowId, pair: SlidePair) => {
    const base = FLOW_CARD_DEFAULTS[id];
    const flow = { ...(cards[id] ?? {}) };
    for (const slot of ['open', 'end'] as const) {
      const slide = pair[slot];
      if (!slide) continue;
      // The written words replace the copy; a picture already chosen for this slot
      // stays, because the writer never produces one and losing an upload to a
      // rewrite of the text would be infuriating.
      const existing = slot in flow ? flow[slot] : base[slot];
      const image = existing?.image ?? null;
      flow[slot] = { ...slide, ...(image ? { image } : {}) };
    }
    const rest = { ...cards };
    if (Object.keys(flow).length) rest[id] = flow;
    else delete rest[id];
    onChange(rest);
  };

  return (
    <div className="space-y-2">
      {FLOW_IDS.map((id) => {
        const flow = cards[id];
        // "Edited" includes switching a card off — an explicit null is an
        // override, and the one most worth offering a Reset for.
        const edited = (slot: CardSlot) => (slot in (flow ?? {}) ? flow![slot] : undefined);
        const dirty = (slot: CardSlot) => edited(slot) !== undefined;
        const openCard = edited('open') === undefined ? FLOW_CARD_DEFAULTS[id].open : edited('open') ?? null;
        const endCard = edited('end') === undefined ? FLOW_CARD_DEFAULTS[id].end : edited('end') ?? null;
        const isOpen = open === id;
        return (
          <div key={id} className="overflow-hidden rounded-lg border border-border bg-card">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setOpen(isOpen ? null : id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
            >
              <span className="text-xs font-semibold">{FLOWS[id].title}</span>
              <span className="flex items-center gap-2">
                {(edited('open') !== undefined || edited('end') !== undefined) && (
                  <Badge variant="secondary" className="font-mono text-[10px]">edited</Badge>
                )}                <ChevronDown
                  className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
                />
              </span>
            </button>
            {isOpen && (
              <div className="space-y-3 border-t border-border p-3">
                <SlideWriter
                  hasKey={hasKey}
                  disabled={disabled}
                  flowLabel={FLOWS[id].title}
                  onApply={(pair) => applyPair(id, pair)}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['open', 'end'] as const).map((slot) => (
                    <TitleCardEditor
                      key={slot}
                      slot={slot}
                      card={slot === 'open' ? openCard : endCard}
                      disabled={disabled}
                      dirty={dirty(slot)}
                      fallback={FLOW_CARD_DEFAULTS[id][slot]}
                      onReset={() => set(id, slot, undefined)}
                      onChange={(next) => set(id, slot, next)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
