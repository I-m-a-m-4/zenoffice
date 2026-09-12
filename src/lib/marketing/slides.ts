/**
 * Animated slides: the motion catalogue, and the validators that keep an
 * AI-written or hand-pasted slide from becoming anything but data.
 *
 * A slide is the opening or closing screen of a take — the same `TitleCard` the
 * studio already edits, plus two things it could not express: *how* it animates,
 * and an optional still image behind the words.
 *
 * ## Both new fields are optional, and that is load-bearing
 *
 * Every existing card, preset, recipe and `--cards` file omits them, and must
 * keep playing exactly as it does today. So `motion` absent means `rise` — the
 * look the overlay has always drawn — and `image` absent means no picture. A
 * take recorded before this file existed and a take recorded after it, from the
 * same inputs, are the same film.
 *
 * ## Why an AI writes JSON here and never code
 *
 * The obvious way to let a model design a slide is to let it write the CSS or the
 * markup. That would be a remote-code-execution path into an authenticated admin
 * surface: the model's output arrives in an HTTP body, and anything the recorder
 * *executes* from that body runs in a browser already signed into the owner's
 * business, with the owner's session. A prompt-injected or simply confused model
 * would be writing script that reads real customer data.
 *
 * So the model chooses from a fixed catalogue and fills in text. `cleanSlide`
 * accepts nothing else: an unknown motion becomes the default rather than an
 * error, text is clipped to a length the overlay can lay out, and `image` must be
 * a `data:image/...;base64` still under a size cap. The overlay draws those
 * values into `textContent` and a `background-image`, never into `innerHTML`.
 *
 * This mirrors `recipe.mjs`, which validates the same shapes again on the
 * recorder's side of the process boundary — the only side a request cannot skip
 * by posting different JSON. Keep the two in step: `SLIDE_MOTION_IDS` here and
 * `MOTIONS` there are the same list, and a motion added to one and not the other
 * silently falls back to `rise`.
 */

/** How the words arrive. Ids are stable — they travel in saved recipes. */
export const SLIDE_MOTIONS = [
  {
    id: 'rise',
    label: 'Rise',
    hint: 'Lines lift into place, staggered. The original look, and the safe default.',
  },
  {
    id: 'wipe',
    label: 'Wipe',
    hint: 'An orange panel sweeps across and leaves the words behind it.',
  },
  {
    id: 'zoom',
    label: 'Push in',
    hint: 'The whole slide settles from slightly too large. Reads as confident.',
  },
  {
    id: 'split',
    label: 'Split',
    hint: 'Headline from the left, sub-line from the right, meeting in the middle.',
  },
] as const;

export type SlideMotion = (typeof SLIDE_MOTIONS)[number]['id'];

export const SLIDE_MOTION_IDS = SLIDE_MOTIONS.map((m) => m.id) as readonly SlideMotion[];

/** What a card with no `motion` plays as — today's look, unchanged. */
export const DEFAULT_MOTION: SlideMotion = 'rise';

/**
 * Ceiling on an uploaded still, measured on the base64 text rather than the
 * decoded bytes, because the base64 is what actually travels: through a request
 * body, into the `--cards` scratch file, and then into a CDP evaluate string.
 * A 1920x1080 JPEG worth looking at is a few hundred KB, so this is generous.
 */
export const MAX_SLIDE_IMAGE_CHARS = 4_000_000;

/** Formats a browser will paint and Chrome will decode without a plugin. */
const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const SLIDE_IMAGE_ACCEPT = IMAGE_MIME.join(',');

export const SLIDE_TEXT_LIMITS = { title: 70, subtitle: 90, cta: 40 } as const;

export function cleanMotion(raw: unknown): SlideMotion {
  return (SLIDE_MOTION_IDS as readonly string[]).includes(raw as string)
    ? (raw as SlideMotion)
    : DEFAULT_MOTION;
}

/**
 * A still image, or null.
 *
 * Only `data:` URIs, and only image ones. An `https:` URL would look harmless and
 * is not: the recording browser is signed into the owner's business, so a slide
 * fetching a remote image tells whoever serves it when a take ran, and turns an
 * outage in someone else's CDN into a blank slide halfway through a shoot. An
 * uploaded file is self-contained and cannot do either.
 */
export function cleanSlideImage(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  const comma = raw.indexOf(',');
  if (!raw.startsWith('data:') || comma < 0) return null;
  const header = raw.slice(5, comma);
  if (!header.endsWith(';base64')) return null;
  const mime = header.slice(0, -';base64'.length).toLowerCase();
  if (!(IMAGE_MIME as readonly string[]).includes(mime)) return null;
  const body = raw.slice(comma + 1);
  if (!body || body.length > MAX_SLIDE_IMAGE_CHARS) return null;
  // Reject anything that is not actually base64 before it reaches a browser.
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    const ok = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
      || c === '+' || c === '/' || c === '=';
    if (!ok) return null;
  }
  return `data:${mime};base64,${body}`;
}

/** One line of slide text, trimmed, collapsed and clipped. Never throws. */
export function cleanSlideText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  // Collapse newlines and runs of space: the overlay centres a single block and
  // an authored line break there reads as a layout bug rather than a choice.
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max).trimEnd() : flat;
}

export type Slide = {
  title: string;
  subtitle?: string;
  cta?: string;
  ms?: number;
  motion?: SlideMotion;
  image?: string | null;
};

/**
 * Coerce anything into a playable slide, or null if there is no headline left.
 *
 * Deliberately forgiving rather than strict: this runs on a model's output and on
 * an operator's paste, and a slide with a too-long subtitle should play with a
 * shorter subtitle, not fail the run. The one thing it will not do is invent a
 * headline — a slide with no words is a black screen with a hold, so it is
 * dropped and the take starts on the product instead.
 */
export function cleanSlide(raw: unknown): Slide | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const title = cleanSlideText(r.title, SLIDE_TEXT_LIMITS.title);
  const image = cleanSlideImage(r.image);
  // A picture with no headline is still a slide worth playing; nothing at all is not.
  if (!title && !image) return null;

  const subtitle = cleanSlideText(r.subtitle, SLIDE_TEXT_LIMITS.subtitle);
  const cta = cleanSlideText(r.cta, SLIDE_TEXT_LIMITS.cta);
  const rawMs = typeof r.ms === 'number' && Number.isFinite(r.ms) ? Math.round(r.ms) : 2200;

  const out: Slide = {
    title,
    // 900ms is about the shortest hold a viewer can read a headline in; 8s is
    // long enough that anything more is a mistake in a 30-second advert.
    ms: Math.min(8000, Math.max(900, rawMs)),
    motion: cleanMotion(r.motion),
  };
  if (subtitle) out.subtitle = subtitle;
  if (cta) out.cta = cta;
  if (image) out.image = image;
  return out;
}

/** The two slots a take has room for. */
export type SlidePair = { open: Slide | null; end: Slide | null };

/**
 * Read a `{ open, end }` pair out of whatever a model or an operator pasted.
 *
 * Tolerates a fenced code block and surrounding chatter, because that is what
 * pasting from a chat window actually produces. Throws only when there is no
 * JSON object in there at all — every other problem is the validator's business.
 */
export function parseSlidePair(raw: string): SlidePair {
  const text = String(raw ?? '').trim();
  if (!text) throw new Error('Nothing to read — paste the JSON the model gave you.');

  // Prefer a fenced block when there is one, then fall back to the outermost
  // braces, so a reply like "Sure! ```json {...} ``` Hope that helps" works.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error('That is not valid JSON. Paste the whole object, braces included.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected an object with "open" and "end" keys.');
  }
  const p = parsed as Record<string, unknown>;
  const pair: SlidePair = { open: cleanSlide(p.open), end: cleanSlide(p.end) };
  if (!pair.open && !pair.end) {
    throw new Error('Neither "open" nor "end" had a headline in it.');
  }
  return pair;
}

/**
 * The prompt an operator can paste into any other AI.
 *
 * Exists because the studio's own "write it for me" needs a Gemini key, and a
 * key is exactly the thing a marketing person does not have. The prompt asks for
 * the same JSON `parseSlidePair` reads, so the reply from any chat window pastes
 * straight back in — that round trip is the whole point, which is why the shape
 * is spelled out here rather than left to the model's imagination.
 */
export function slidePrompt(opts: { product?: string; audience?: string; angle?: string } = {}): string {
  const product = opts.product?.trim() || 'Zeneva, a retail point-of-sale and inventory app for small shops';
  const audience = opts.audience?.trim() || 'shop owners in Nigeria running one or two branches';
  const angle = opts.angle?.trim() || 'it keeps working when the internet does not';

  return [
    `Write the opening and closing title screens for a short screen-recorded advert.`,
    ``,
    `Product: ${product}`,
    `Audience: ${audience}`,
    `Angle to lead with: ${angle}`,
    ``,
    `Rules:`,
    `- The opening screen appears before the app is shown. Make someone stay.`,
    `- The closing screen appears after. It carries the call to action.`,
    `- Headlines: ${SLIDE_TEXT_LIMITS.title} characters at most, and shorter is better.`,
    `  Sub-lines: ${SLIDE_TEXT_LIMITS.subtitle}. Button text: ${SLIDE_TEXT_LIMITS.cta}.`,
    `- No emoji, no hashtags, no exclamation marks. Plain confident sentences.`,
    `- "motion" must be one of: ${SLIDE_MOTION_IDS.join(', ')}.`,
    `- "ms" is how long the screen holds, between 900 and 8000.`,
    `- The opening screen has no button. Only the closing screen gets "cta".`,
    ``,
    `Reply with nothing but this JSON:`,
    ``,
    `{`,
    `  "open": { "title": "", "subtitle": "", "motion": "rise", "ms": 2200 },`,
    `  "end":  { "title": "", "subtitle": "", "cta": "", "motion": "rise", "ms": 2600 }`,
    `}`,
  ].join('\n');
}
