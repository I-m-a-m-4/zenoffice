/**
 * Shared contract between the recorder control panel and the route that runs it.
 *
 * Deliberately no `'use client'` and no runtime imports: the UI reads these lists
 * to draw its controls, and `/api/admin/record` reads the *same* lists to validate
 * what arrives. One definition means a flow the UI can offer is exactly a flow the
 * route will accept — a second copy would eventually drift, and the failure mode
 * of that drift is an allow-list with a hole in it.
 *
 * The one import is `SlideMotion`, and it is `import type`, so it is erased at
 * build and this file still pulls nothing into either bundle. The alternative was
 * writing the motion union out a second time here, which is the exact drift the
 * paragraph above is about.
 *
 * The recorder itself (`scripts/record/`) is a standalone Node CLI and does not
 * import this file. It has its own `FLOWS` map, which is the real source of
 * truth; `FLOWS` here must be kept in step with it. Nothing in `src/` is on the
 * recorder's code path, which is what keeps the CLI deletable.
 */

import type { SlideMotion } from './slides';

export const FLOW_IDS = ['pos', 'inventory', 'zen'] as const;
export const DEVICE_IDS = ['desktop', 'mobile'] as const;
export const THEME_IDS = ['light', 'dark'] as const;
export const FORMAT_IDS = ['mp4', 'webm'] as const;
export const STYLE_IDS = ['plain', 'cinematic'] as const;

export type FlowId = (typeof FLOW_IDS)[number];
export type DeviceId = (typeof DEVICE_IDS)[number];
export type ThemeId = (typeof THEME_IDS)[number];
export type FormatId = (typeof FORMAT_IDS)[number];
export type StyleId = (typeof STYLE_IDS)[number];

/**
 * The two looks a take can be cut in.
 *
 * ## Why this is a style and not a filter
 *
 * `plain` and `cinematic` are different *pipelines*, not the same footage graded
 * two ways. `plain` streams the live app at `fps` and samples it; `cinematic`
 * screenshots the app at chosen beats and then animates those stills in a scene.
 *
 * That difference is the whole point, and it comes from a measurement. A browser
 * only paints when the page changes, so a screen recording of a web app repeats
 * frames through every still moment — takes in `marketing-out/` measure 21-50%
 * unique frames against a 30fps container, which is what "it stutters" is. The
 * reference promo this style is modelled on measures 97%, because every frame of
 * it was rendered rather than sampled.
 *
 * No encoder setting closes that gap. Rendering does. So `cinematic` is the
 * answer to "make it smoother" as much as it is the answer to "make it pretty" —
 * the two asks turn out to be the same ask.
 *
 * ## What `cinematic` costs
 *
 * A still is a still: the take shows the app at the moments it was screenshotted,
 * not a continuous session. That is the trade for smoothness and for text that
 * stays sharp when the camera pushes in. When the point of a take is to prove the
 * app really does something in one unbroken go, `plain` is the honest choice.
 */
export const STYLES: Record<StyleId, { label: string; hint: string }> = {
  plain: {
    label: 'Screen recording',
    hint: 'The live app, captured as it runs. Honest and continuous, but only'
      + ' repaints when something changes — so still moments repeat frames.',
  },
  cinematic: {
    label: 'Cinematic',
    hint: 'Screenshots the app, then animates the stills in 3D over a warm'
      + ' gradient. Every frame is rendered, so it is smooth throughout and stays'
      + ' sharp when the camera moves in.',
  },
};

/** What a request with no `style` plays as — today's look, unchanged. */
export const DEFAULT_STYLE: StyleId = 'plain';

/**
 * The narration voices, mirroring `VOICES` in `scripts/record/narrate.mjs`.
 *
 * Same relationship as `FLOWS` below: that file is the source of truth and this
 * is the copy the studio draws its picker from. Kept short deliberately — Gemini
 * offers around thirty prebuilt voices and most are characterful in a way that
 * fights a product demo.
 *
 * Enumerated rather than free text because the value reaches `--voice`, and an
 * allow-list on both sides is what makes an unknown voice a rejected request
 * rather than a take that records for forty seconds and then fails at the TTS
 * call.
 */
export const VOICE_IDS = ['Charon', 'Kore', 'Puck', 'Aoede', 'Fenrir', 'Leda'] as const;
export type VoiceId = (typeof VOICE_IDS)[number];

export const VOICES: Record<VoiceId, { note: string }> = {
  Charon: { note: 'Warm, measured. The default.' },
  Kore: { note: 'Bright and direct.' },
  Puck: { note: 'Upbeat, quicker.' },
  Aoede: { note: 'Soft, unhurried.' },
  Fenrir: { note: 'Deeper, steady.' },
  Leda: { note: 'Youthful, clear.' },
};

export const DEFAULT_VOICE: VoiceId = 'Charon';

/** Longest tone direction accepted, matching the route's clamp. */
export const VOICE_STYLE_MAX = 240;

// ------------------------------------------------------------------ recipes

/**
 * A recording described as data, for any page that does not have a coded flow.
 *
 * These mirror `scripts/record/recipe.mjs`, which is the real parser — the same
 * relationship `FLOWS` below has with the CLI's own map. The types here exist so
 * the studio's builder can be type-checked; they are **not** the validation.
 * Everything a recipe contains is checked by `parseRecipe` inside the recorder,
 * on the recorder's side of the process boundary, because that is the only place
 * a check cannot be skipped by talking to the API differently.
 */
export const STEP_KINDS = [
  'caption', 'hold', 'click', 'clickTo', 'hover', 'scroll', 'fill', 'press', 'goto', 'card',
  'punch', 'wide',
] as const;

export type StepKind = (typeof STEP_KINDS)[number];

/** How an element is named. `text` is what a person reads on screen. */
export type TargetSpec = {
  text?: string;
  css?: string;
  placeholder?: string;
  tag?: string;
  nth?: number;
  exact?: boolean;
};

export type RecipeStep =
  | { kind: 'caption'; text: string; ms?: number }
  | { kind: 'hold'; ms: number }
  | { kind: 'click'; spec: TargetSpec; ms?: number }
  | { kind: 'clickTo'; spec: TargetSpec; path: string; ms?: number }
  | { kind: 'hover'; spec: TargetSpec; ms?: number }
  | { kind: 'scroll'; dy: number }
  | { kind: 'fill'; spec: TargetSpec; text: string; enter?: boolean; clear?: boolean; ms?: number }
  | { kind: 'press'; key: 'Enter' | 'Escape' | 'Tab' | 'Backspace' | 'Delete' }
  | { kind: 'goto'; route: string; ms?: number }
  | { kind: 'card'; title: string; subtitle?: string; cta?: string; ms?: number }
  /**
   * Camera moves. These are an **encode-time ffmpeg filter**, never a CSS
   * transform on the page — the app renders exactly as it always does and the
   * punch is applied to the finished frames afterwards.
   *
   * `to` is clamped to 1–1.6 by the recorder for a physical reason: the camera is
   * a lanczos upscale of captured 1080p rather than a re-render, so text softens
   * past roughly 1.5. Capturing supersampled instead measured 10–17fps painted,
   * under the 30 the sampler needs.
   */
  | { kind: 'punch'; to?: number; spec?: TargetSpec; ms?: number }
  | { kind: 'wide'; ms?: number };

/**
 * A title screen.
 *
 * `motion` and `image` are optional and stay that way: every preset, recipe and
 * saved card written before slides existed omits them, and must keep playing
 * exactly as it did. Absent `motion` means `rise`, the look the overlay has
 * always drawn. See `./slides` for the catalogue and the validators.
 */
export type TitleCard = {
  title: string;
  subtitle?: string;
  cta?: string;
  ms?: number;
  motion?: SlideMotion;
  /** A `data:image/...;base64` still, full-bleed behind the words. */
  image?: string | null;
};

export type Recipe = {
  title: string;
  route: string;
  open?: TitleCard | null;
  end?: TitleCard | null;
  steps: RecipeStep[];
};

/**
 * The flow id a recipe records under — derived from its title, never typed.
 *
 * Two properties matter here and neither is cosmetic:
 *
 * 1. **`custom-` prefix.** The recorder registers a recipe in the *same* map as
 *    the coded flows, so a recipe called "POS" would silently replace the real
 *    POS flow for that run and the operator would never know why the footage was
 *    wrong. The prefix puts recipes in their own namespace.
 * 2. **Same normalisation as the CLI.** `parseRecipe` reduces an id with
 *    `replace(/[^a-z0-9-]/gi, '-').toLowerCase()`; the output of this function is
 *    already a fixed point of that, so what the route predicts for `takesExpected`
 *    and the filename is exactly what the recorder registers.
 */
export function recipeId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '');
  return `custom-${slug || 'recording'}`;
}

/**
 * Convert the builder's tagged steps into the shape `parseRecipe` reads.
 *
 * The studio models a step as `{ kind: 'click', spec }` because a discriminated
 * union is what makes the editor type-check. The CLI's recipe format predates it
 * and is hand-writable — `{ "click": { "text": "Save" } }` — because a person
 * editing a JSON file should not have to repeat the step name twice.
 *
 * This is the only place those two spellings meet. It is a translation and
 * nothing more: **no validation happens here.** Everything a recipe contains is
 * checked by `parseRecipe` on the recorder's side of the process boundary, which
 * is the only side a request cannot skip by posting different JSON.
 */
export function recipeToWire(r: Recipe): Record<string, unknown> {
  return {
    id: recipeId(r.title),
    title: r.title,
    route: r.route,
    open: r.open ?? null,
    end: r.end ?? null,
    steps: r.steps.map(stepToWire),
  };
}

function stepToWire(s: RecipeStep): Record<string, unknown> {
  switch (s.kind) {
    case 'caption': return { caption: s.text, ms: s.ms };
    case 'hold': return { hold: s.ms };
    case 'click': return { click: s.spec, ms: s.ms };
    case 'clickTo': return { clickTo: { spec: s.spec }, path: s.path, ms: s.ms };
    case 'hover': return { hover: s.spec, ms: s.ms };
    case 'scroll': return { scroll: s.dy };
    case 'fill': return { fill: { spec: s.spec, text: s.text, enter: s.enter, clear: s.clear }, ms: s.ms };
    case 'press': return { press: s.key };
    case 'goto': return { goto: s.route, ms: s.ms };
    case 'card': return { card: { title: s.title, subtitle: s.subtitle, cta: s.cta, ms: s.ms } };
    // A punch with no target frames the middle of the screen, which is what "just
    // push in a bit" means. Sending `spec: undefined` inside the object would read
    // as a malformed target rather than as an absent one, so it is left off.
    case 'punch': return { punch: s.spec ? { spec: s.spec, to: s.to } : { to: s.to ?? 1.3 }, ms: s.ms };
    case 'wide': return { wide: true, ms: s.ms };
  }
}

/** Human labels for the step palette, so the builder is not a JSON textarea. */
export const STEP_LABELS: Record<StepKind, { label: string; hint: string }> = {
  caption: { label: 'Say something', hint: 'A subtitle across the bottom of the frame.' },
  hold: { label: 'Hold still', hint: 'Let the viewer read the screen.' },
  click: { label: 'Click', hint: 'Click something by its on-screen text.' },
  clickTo: { label: 'Click and go', hint: 'A click that navigates — waits for the new page.' },
  hover: { label: 'Hover', hint: 'Rest the cursor on something to show its hover state.' },
  scroll: { label: 'Scroll', hint: 'Glide down the page. Negative goes back up.' },
  fill: { label: 'Type into', hint: 'Type into a field, character by character.' },
  press: { label: 'Press a key', hint: 'Enter, Escape, Tab, Backspace or Delete.' },
  goto: { label: 'Go to a page', hint: 'Jump straight to another route.' },
  card: { label: 'Title card', hint: 'A full-screen card over the app.' },
  punch: { label: 'Push the camera in', hint: 'Zoom towards something to make it the subject.' },
  wide: { label: 'Pull back wide', hint: 'Return the camera to the full frame.' },
};

/** Blank recipe pointed at a route, as the starting point for a new recording. */
export function blankRecipe(route = '/dashboard'): Recipe {
  return {
    title: 'New recording',
    route,
    open: { title: 'Zeneva', subtitle: 'Retail, handled.', ms: 2200 },
    end: { title: 'Zeneva', subtitle: 'Retail, handled.', cta: 'Start free', ms: 2600 },
    steps: [
      { kind: 'caption', text: 'Here is what this page does.', ms: 3400 },
      { kind: 'hold', ms: 1400 },
      { kind: 'scroll', dy: 520 },
      { kind: 'hold', ms: 1600 },
    ],
  };
}

/** What each flow actually does on camera, for the picker. */
export const FLOWS: Record<FlowId, { title: string; blurb: string; seconds: number }> = {
  pos: {
    title: 'Point of sale',
    blurb: 'Builds a cart from the product grid, walks customer and payment, lands on the review screen.',
    seconds: 42,
  },
  inventory: {
    title: 'Inventory',
    blurb: 'Searches the catalogue, opens Inventory Health, drills into low stock and corrects a count.',
    seconds: 38,
  },
  zen: {
    title: 'Zen AI',
    blurb: 'Asks a real question and holds while the tool-call status line and the answer stream in.',
    seconds: 34,
  },
};

export const DEVICES: Record<DeviceId, { label: string; note: string; w: number; h: number }> = {
  desktop: { label: 'Desktop', note: '1920×1080 · landscape', w: 1920, h: 1080 },
  mobile: { label: 'Mobile', note: '1080×1920 · Reels / Shorts / TikTok', w: 1080, h: 1920 },
};

/**
 * Where the bot points its browser, when the studio does not say.
 *
 * The recorder's own default, repeated here because the panel has to show it in a
 * field before the CLI ever sees the request.
 */
export const DEFAULT_RECORD_URL = 'http://localhost:9007';

/**
 * One-click targets, so pointing the bot at the hosted site is a choice rather
 * than a typed URL.
 *
 * All three are still run through `cleanRecordUrl` on both sides — these are a
 * convenience, never a trust boundary. A preset that shipped malformed would be
 * rejected exactly like a typo.
 *
 * Worth knowing which to pick, because they are not interchangeable:
 *
 * - **localhost** records what is on this machine right now, including work that
 *   is not committed. It is also the only one that pays the dev server's
 *   on-demand compile, which is why `record()` only warms routes for a local URL.
 * - **A hosted target** records the product as customers actually see it: routes
 *   are prebuilt, so there is nothing to warm, and there is no dev indicator to
 *   hide. The cost is that the bot signs a real account into a real deployment,
 *   and `--commit` there writes to real data. Preview and production are separate
 *   entries for that reason — they are different blast radii, and the operator
 *   should have to choose.
 */
export const RECORD_TARGETS = [
  {
    url: DEFAULT_RECORD_URL,
    label: 'Local dev',
    note: 'This machine. Records uncommitted work; pays the dev compile.',
  },
  {
    url: 'https://zeneva.vercel.app',
    label: 'Preview',
    note: 'The hosted preview build. Prebuilt routes, no dev indicator.',
  },
  {
    url: 'https://zeneva.space',
    label: 'Production',
    note: 'What customers see. Real data — take care with "save for real".',
  },
] as const;

/**
 * A target the recorder can be pointed at, or null if it cannot be one.
 *
 * The hosted site is the better subject: nothing to warm, because its routes are
 * already built, and no dev-mode indicator to hide. It is also the one string in
 * the request that names something off this machine, so it is narrowed hard —
 * http(s) only, no credentials in the URL, query and fragment dropped, and the
 * trailing slash removed because the driver joins routes onto it directly
 * (`${baseUrl}/dashboard`, which a kept slash would turn into `//dashboard`).
 *
 * Shared with the route so the panel can reject a typo without a round trip. The
 * check that counts is the one the route runs, on the far side of the process
 * boundary — the copy a caller posting its own JSON cannot skip.
 */
export function cleanRecordUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  // A URL carrying a login is a credential in a request body and then in argv,
  // which is readable by every process on the machine. The account belongs in
  // `.env.recorder` — that is the entire reason that file exists.
  if (u.username || u.password) return null;
  if (!u.hostname) return null;
  let base = `${u.protocol}//${u.host}${u.pathname}`;
  while (base.endsWith('/')) base = base.slice(0, -1);
  return base;
}

/** Options the panel may send. Everything here is enumerated or clamped. */
export type RecorderRequest = {
  flows: FlowId[];
  devices: DeviceId[];
  themes: ThemeId[];
  format: FormatId;
  fps: number;
  quality: number;
  /**
   * The app to record, or null for the recorder's default dev server.
   *
   * Pointing this at the live site records the product as customers see it, and
   * costs the take two things worth knowing about: the bot signs a real account
   * into production, and `--commit` there would write to a real business. The
   * dev-server compile and the dev indicator are both gone, which is the reason
   * to want it.
   */
  url: string | null;
  /** Basename of a track in `marketing-music/`, or null for no bed. */
  music: string | null;
  musicVolume: number;
  clickSfx: boolean;
  typingSfx: boolean;
  /**
   * Speak the captions.
   *
   * Off by default and never inferred, because it is the one audio option that
   * costs money — every caption in the take is a Gemini TTS request. The captions
   * are already the script, so this adds no writing: it speaks the sentences the
   * flow was going to put on screen anyway, each landing on the frame it was
   * written for.
   */
  narrate: boolean;
  voice: VoiceId;
  /**
   * How the line should be read — "slower, and a little drier", say.
   *
   * Free text, because Gemini TTS takes its direction in the prompt rather than
   * through a style parameter. `null` uses the recorder's own direction, which is
   * tuned for restraint; the failure mode of TTS on marketing copy is an
   * infomercial voice.
   */
  voiceStyle: string | null;
  /** Let the flow actually save — rings up the sale, writes the stock count. */
  commit: boolean;
  /** Show the browser while it records, for debugging a broken selector. */
  headed: boolean;
  /**
   * Which look the take is cut in. See `STYLES`.
   *
   * `plain` is the screen recording this recorder has always produced, and is the
   * default so that every existing preset, recipe and saved request keeps
   * producing the same film.
   */
  style: StyleId;
  /**
   * Let the flows push the camera in.
   *
   * Off by default, and that is a deliberate change of behaviour: the coded flows
   * are full of `page.punch()` calls and the operator never got a say in them.
   * Gating it here rather than deleting those calls keeps the flows readable as
   * choreography — a flow still says where it *would* frame, and the switch
   * decides whether the camera obeys.
   *
   * There is a second reason to leave it off. A punch is applied at encode time,
   * so it is an upscale of already-captured pixels rather than a re-render: past
   * about 1.5x the text visibly softens (see `Page.punch`). `cinematic` does not
   * use this path at all — it moves its camera in the scene, where a punch-in is
   * a downscale of a 2x still and stays sharp.
   */
  punch: boolean;
  /**
   * A page to record that has no coded flow, or null to record only `flows`.
   *
   * When set, this is written to a scratch file and passed as `--recipe`, and
   * it becomes the only thing recorded unless `flows` also names something —
   * the recipe's `id` joins the flow list rather than replacing the concept.
   */
  recipe: Recipe | null;
  /**
   * Rewritten opening/closing screens, keyed by flow id.
   *
   * Copied from `FLOW_CARDS` in `scripts/record/flows.mjs` when the panel loads,
   * so the editor starts from the authored wording rather than from blank fields
   * — a title card is the first thing a viewer sees and an empty one is worse
   * than a default one. Only flows whose copy actually changed are sent, and the
   * result is written to a scratch file and passed as `--cards`, for the same
   * reason the recipe is: argv is world-readable and a card set is long.
   *
   * `null` for either card means "play no card there", which the CLI
   * distinguishes from the key being absent.
   */
  cards: Record<string, { open?: TitleCard | null; end?: TitleCard | null }>;
};

/**
 * The opening and closing screens each coded flow ships with.
 *
 * A mirror of `FLOW_CARDS` in `scripts/record/flows.mjs`, which is the real
 * source — this copy exists only so the studio can *show* the current wording
 * without shelling out to the recorder to ask. Nothing here is sent unless the
 * operator edits it, so the two drifting costs a stale placeholder in a form
 * field, not a video with the wrong copy: whatever is not overridden is played
 * from the recorder's own table.
 */
export const FLOW_CARD_DEFAULTS: Record<FlowId, { open: TitleCard; end: TitleCard }> = {
  pos: {
    open: { title: 'Sell anywhere.', subtitle: 'Even offline.', ms: 1900 },
    end: { title: 'Sell anywhere. Even offline.', subtitle: 'Zeneva POS', cta: 'Start free', ms: 2600 },
  },
  inventory: {
    open: { title: 'Know what you have.', subtitle: 'Down to the last unit.', ms: 1900 },
    end: { title: 'Counts you can trust, on every device.', subtitle: 'Zeneva Inventory', cta: 'Start free', ms: 2600 },
  },
  zen: {
    open: { title: '41 tools.', subtitle: 'Reads everything. Writes nothing without you.', ms: 2000 },
    end: { title: 'Zen AI', subtitle: 'Reads everything. Writes nothing without you.', cta: 'Try Zen AI', ms: 2600 },
  },
};

export const FPS_RANGE = { min: 24, max: 60, default: 30 } as const;
export const QUALITY_RANGE = { min: 60, max: 100, default: 92 } as const;

export function defaultRequest(): RecorderRequest {
  return {
    flows: ['pos'],
    devices: ['desktop'],
    themes: ['light'],
    format: 'mp4',
    fps: FPS_RANGE.default,
    quality: QUALITY_RANGE.default,
    url: null,
    music: null,
    musicVolume: 0.28,
    clickSfx: true,
    typingSfx: true,
    narrate: false,
    voice: DEFAULT_VOICE,
    voiceStyle: null,
    commit: false,
    headed: false,
    style: DEFAULT_STYLE,
    punch: false,
    recipe: null,
    cards: {},
  };
}

/** How many videos a request produces, and roughly how long that will take. */
export function takeCount(r: Pick<RecorderRequest, 'flows' | 'devices' | 'themes' | 'recipe'>): number {
  const subjects = r.flows.length + (r.recipe ? 1 : 0);
  return Math.max(1, subjects) * r.devices.length * r.themes.length;
}

/**
 * Rough wall-clock estimate. Each take pays for a cold Chrome launch and a real
 * login on top of the flow itself, plus an encode that scales with the footage.
 * Deliberately pessimistic — a progress hint that runs under is worse than one
 * that runs over.
 *
 * `style` is deliberately not a factor. A cinematic take is *shorter* than this
 * predicts on both clocks: it skips every punch's hold while driving the app, and
 * its film is `beats x ~2.2s` rather than the flow's own length. Correcting for
 * that would mean guessing how many `punch()` calls a flow makes — unknowable
 * here for a coded flow — in order to turn an over-estimate into a possible
 * under-estimate, which is the trade this function exists to refuse.
 */
export function estimateSeconds(r: RecorderRequest): number {
  const coded = r.flows.reduce((sum, f) => sum + FLOWS[f].seconds, 0);
  // A recipe's length is knowable rather than estimated: every step carries its
  // own duration. Summing them beats a per-flow guess, and it means a long
  // recipe is honestly reported as long.
  const custom = r.recipe ? recipeSeconds(r.recipe) : 0;
  const subjects = r.flows.length + (r.recipe ? 1 : 0);
  const perSubject = coded + custom;
  const takes = r.devices.length * r.themes.length;
  const LAUNCH_AND_LOGIN = 22;
  const ENCODE_RATIO = 0.9;
  /**
   * Narration adds a round trip per caption, and the cache is keyed by take, so
   * every take pays for its own.
   *
   * Estimated from footage length rather than from a caption count, because the
   * count is only knowable for a recipe — a coded flow's captions live in the
   * CLI. Roughly one caption per six seconds on camera at about three and a half
   * seconds a request, which is about 0.6× the footage duration.
   */
  const narration = r.narrate ? perSubject * 0.6 : 0;
  return Math.round(
    takes * (perSubject * (1 + ENCODE_RATIO) + narration + LAUNCH_AND_LOGIN * Math.max(1, subjects)),
  );
}

/** Seconds a recipe spends on camera, from its own step timings. */
export function recipeSeconds(r: Recipe): number {
  // Each action costs more than its settle: finding the element, gliding the
  // cursor and blooming the halo are roughly a second before anything settles.
  const ACTION_OVERHEAD = 1.1;
  let ms = (r.open?.ms ?? 0) + (r.end?.ms ?? 0);
  for (const s of r.steps) {
    switch (s.kind) {
      case 'caption': ms += Math.min(s.ms ?? 3600, 1400); break;
      case 'hold': ms += s.ms; break;
      case 'scroll': ms += 900; break;
      case 'press': ms += 300; break;
      // Camera moves are a glide, not an interaction: nothing is searched for and
      // nothing settles afterwards, so they cost only their own duration.
      case 'punch': ms += (s.ms ?? 900) + 200; break;
      case 'wide': ms += (s.ms ?? 800) + 200; break;
      case 'card': ms += (s.ms ?? 2200) + 600; break;
      case 'fill': ms += (s.ms ?? 700) + s.text.length * 90 + ACTION_OVERHEAD * 1000; break;
      default: ms += (s.ms ?? 800) + ACTION_OVERHEAD * 1000; break;
    }
  }
  return Math.round(ms / 1000);
}

export function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

// --------------------------------------------------------------- job status

export type JobState = 'running' | 'done' | 'failed' | 'cancelled';

export type RecorderTake = {
  name: string;
  bytes: number;
  modified: number;
};

export type JobStatus = {
  id: string;
  state: JobState;
  /** Console output, newest last. Trimmed to a bounded tail. */
  log: string[];
  startedAt: number;
  endedAt: number | null;
  takesExpected: number;
  /** Videos this job wrote, resolved when it finishes. */
  takes: RecorderTake[];
  error: string | null;
};

// ----------------------------------------------------------------- trimming

/**
 * How a cut is made. Both are offered because neither is strictly better.
 *
 * `exact` re-encodes, so the cut starts on the frame asked for. It costs real
 * time on a long take (roughly a fifth of the clip's length) and a generation of
 * quality, which on flat UI footage at crf 18 is invisible — but it is a
 * re-encode, and worth saying so. It is the default, because it is the one that
 * does what the in and out points say.
 *
 * `fast` copies the streams untouched — a second or two regardless of length,
 * and the picture is bit-for-bit the take that was approved. The cost is that a
 * copied cut can only begin on a keyframe, and the recorder's takes carry one
 * about every 8.3s (x264's default spacing), so an in-point of 3s becomes 0s.
 * Measured on one: `-g fps` at capture time would fix that and cost 2.6x the
 * file size on every take, which is why the encoder is left alone and this mode
 * is honest about moving the in-point instead. Right choice when the in-point is
 * 0 and you are only trimming the end — then it is exact *and* instant.
 */
export const TRIM_MODES = ['fast', 'exact'] as const;
export type TrimMode = (typeof TRIM_MODES)[number];

/**
 * Shortest cut worth making, in seconds.
 *
 * Not a technical floor — ffmpeg will happily write four frames — but below
 * about half a second the result is a flicker, and the usual cause is a mis-set
 * in-point rather than an intention.
 */
export const TRIM_MIN_SECONDS = 0.4;

export type TrimRequest = {
  /** A filename from `RecorderStatus.takes`, never a path. */
  name: string;
  start: number;
  end: number;
  mode: TrimMode;
};

export type TrimResult = {
  /** The new file, ready to preview or download like any other take. */
  take: RecorderTake;
  /** Where the cut actually landed, measured from the finished file. */
  start: number;
  end: number;
  seconds: number;
  mode: TrimMode;
  /**
   * The in-point that was asked for, when a keyframe forced the cut earlier.
   * `null` when the cut landed where it was requested — so a non-null value is
   * the studio's cue to say the clip starts a moment sooner than you set it.
   */
  snappedFrom: number | null;
  /** Whether the marks sidecar came along, re-timed to the new clip. */
  marks: boolean;
};

// ------------------------------------------------------------- live view

/**
 * What the running take is doing right now, as the recorder publishes it.
 *
 * Written by the child process to `marketing-out/.live/live.json` and read back
 * by `GET /api/admin/record/live`. Every field is optional-by-absence: the whole
 * object is missing before the first take starts and stale for a moment after
 * one ends, and the studio has to render both of those without flickering.
 */
export type LiveStatus = {
  /** `pos-desktop-light` — which take of the run this is. */
  stamp: string;
  flow: string;
  device: DeviceId;
  theme: ThemeId;
  /** Where in the take we are. `recording` is the only one that produces frames. */
  phase: 'launching' | 'signing in' | 'warming' | 'recording' | 'encoding' | 'done' | 'failed';
  /** A short human line: "click \"Add to cart\"". */
  step: string;
  paused: boolean;
  width: number;
  height: number;
  /** Epoch ms the recorder last wrote this. Stale means the take ended. */
  at: number;
};

/** What `GET /api/admin/record/live` answers. */
export type LiveResponse = {
  /** Null when nothing is running, or when the last take's status has gone stale. */
  live: LiveStatus | null;
  /**
   * Milliseconds since the newest preview frame was written, or null for none.
   *
   * The frame itself is fetched separately as a JPEG — sending it inline as
   * base64 would inflate every poll by a third and make the status request as
   * expensive as the image it describes.
   */
  frameAge: number | null;
  running: boolean;
};

/**
 * How long a live status may go unwritten before the studio stops believing it.
 *
 * The recorder republishes on every checkpoint, so a gap this long means the
 * process is gone — which happens on a crash without any chance to write a
 * final state. Without a staleness rule the studio would show "recording" over
 * a frozen frame indefinitely.
 */
export const LIVE_STALE_MS = 15_000;

/** What `GET /api/admin/record` answers. */
export type RecorderStatus = {
  /** False when the app is not running locally — the recorder needs a real machine. */
  available: boolean;
  reason: string | null;
  /**
   * The account the bot will sign in as.
   *
   * `email` comes back in full because the studio has to be able to show and
   * edit it. The **password never leaves the server** — not here, not anywhere
   * else in this type. `source` says which of the two places it was found in,
   * because an environment variable beats `.env.recorder` inside the CLI, so
   * saving the file has no effect while one is set.
   */
  credentials: {
    configured: boolean;
    email: string | null;
    source: 'env' | 'file' | null;
  };
  ffmpeg: boolean;
  /**
   * Whether a Gemini key is on this machine, so the studio can say so up front.
   *
   * Only ever a boolean — the key itself is never returned, for the same reason
   * the recorder password is not. Worth surfacing because narration is wired to
   * fail soft: without a key the recorder logs one line and produces the take
   * unnarrated, which from the studio looks identical to narration that ran and
   * came back silent.
   */
  narration: boolean;
  music: string[];
  job: JobStatus | null;
  takes: RecorderTake[];
};
