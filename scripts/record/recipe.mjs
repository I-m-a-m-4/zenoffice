/**
 * Recipes: recording any page without writing JavaScript.
 *
 * The three hand-written flows in `flows.mjs` exist because the POS checkout, the
 * inventory fix and a Zen AI answer each need domain knowledge to shoot well —
 * which button is conditional, which toast covers what, how long a tool call
 * takes. That knowledge does not generalise, so those stay coded.
 *
 * Everything else is the same handful of moves in a different order: open a page,
 * say something about it, click a thing, drift down the page, hold on the good
 * part. A recipe is that sequence as data, so a new video is a JSON body from the
 * studio rather than an edit to a script file and a redeploy.
 *
 * Deliberately not a scripting language. There are no variables, no conditionals
 * and no loops, because every one of those turns "the marketing video is wrong"
 * into a debugging session. If a recording needs logic, it needs a coded flow.
 *
 *   {
 *     "title": "Dashboard",
 *     "route": "/dashboard",
 *     "open":  { "title": "Your whole business.", "subtitle": "One screen." },
 *     "steps": [
 *       { "caption": "Today's numbers, live.", "ms": 3600 },
 *       { "hold": 1200 },
 *       { "scroll": 520 },
 *       { "click": { "text": "This Week" } },
 *       { "hold": 1500 }
 *     ],
 *     "end": { "title": "Zeneva", "subtitle": "Retail, handled.", "cta": "Start free" }
 *   }
 *
 * Anything a recipe can express, a person could do with a mouse — the steps are
 * dispatched through the same `Page` the coded flows use, so there is no second
 * input path to keep honest.
 */

/** Step names a recipe may use, with the shape each one expects. */
export const STEP_KINDS = {
  goto: 'route to open, e.g. "/inventory"',
  caption: 'subtitle text; pair with ms for how long it stays',
  card: 'full-screen title card: { title, subtitle, cta, ms }',
  click: 'element spec: { text } | { css } | { placeholder }, plus optional nth',
  clickTo: 'a click that navigates: { spec, path }',
  fill: 'type into a field: { spec, text, enter, clear }',
  press: 'a single key: "Enter" | "Escape" | "Tab" | "Backspace" | "Delete"',
  scroll: 'pixels to glide down (negative for up)',
  hold: 'milliseconds to sit still',
  hover: 'move the cursor onto something without clicking',
  punch: 'push the camera in: { spec, to } — to is 1-1.6, or true for a plain 1.3x',
  wide: 'pull the camera back to the full frame',
};

const MAX_STEPS = 60;
const MAX_HOLD_MS = 20_000;
const MAX_CAPTION = 160;

/**
 * A spec the overlay's `find()` understands, or a thrown error saying why not.
 *
 * Recipes arrive from an HTTP body, so this is the trust boundary: `css` reaches
 * `document.querySelectorAll` inside the page, and a spec is the one part of a
 * recipe that is not a plain scalar. Restricting it to the three shapes `find()
 * actually reads means a malformed or hostile recipe fails here, with a message
 * naming the step, rather than throwing from inside injected page code where the
 * only symptom is a take that dies on step 7.
 */
function spec(raw, where) {
  if (typeof raw === 'string') return { text: raw, exact: false };
  if (!raw || typeof raw !== 'object') {
    throw new Error(`${where}: needs a target — text, css or placeholder`);
  }
  const out = {};
  for (const k of ['text', 'css', 'placeholder', 'tag']) {
    if (raw[k] != null) {
      if (typeof raw[k] !== 'string') throw new Error(`${where}: ${k} must be a string`);
      out[k] = raw[k];
    }
  }
  if (!out.text && !out.css && !out.placeholder) {
    throw new Error(`${where}: needs one of text, css or placeholder`);
  }
  if (raw.nth != null) {
    const n = Number(raw.nth);
    if (!Number.isInteger(n) || n < 0 || n > 99) throw new Error(`${where}: nth must be 0-99`);
    out.nth = n;
  }
  if (raw.exact != null) out.exact = !!raw.exact;
  else if (out.text) out.exact = false;
  return out;
}

function ms(raw, dflt, where) {
  if (raw == null) return dflt;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${where}: ms must be a positive number`);
  // A step that sits for a minute is nearly always a typo for milliseconds, and
  // it costs a whole take to find out. Clamp instead of failing, so the video is
  // merely shorter than intended rather than not produced at all.
  return Math.min(n, MAX_HOLD_MS);
}

function text(raw, where, max = MAX_CAPTION) {
  const s = String(raw ?? '');
  if (s.length > max) throw new Error(`${where}: text is longer than ${max} characters`);
  return s;
}

/**
 * A same-origin path, or a thrown error.
 *
 * The recorder drives a browser that is *signed in* to the real app, so a route
 * is not just a string: an absolute URL would take an authenticated session
 * somewhere off-app, and a protocol-relative `//evil.example` reads as a path to
 * a careless check while being an absolute URL to the browser. Both are refused.
 */
function routePath(raw, where) {
  const route = String(raw ?? '').trim();
  if (!route) throw new Error(`${where}: needs a route, e.g. "/inventory"`);
  if (!route.startsWith('/') || route.startsWith('//')) {
    throw new Error(`${where}: route must be a path beginning with "/" — external URLs are not allowed`);
  }
  return route;
}

/**
 * Check a recipe completely, before the browser launches.
 *
 * Validation is separated from execution so the studio can reject a bad recipe
 * the moment it is submitted. The alternative — validating as each step runs —
 * spends a Chrome launch, a real login and half a recording to discover a typo in
 * step 9, and leaves a truncated video behind that looks like a recorder bug.
 *
 * Returns a normalised recipe. Throws with a message naming the step index.
 */
export function parseRecipe(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Recipe must be an object.');

  const route = routePath(raw.route, 'route');

  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  if (!steps.length) throw new Error('Recipe needs at least one step.');
  if (steps.length > MAX_STEPS) throw new Error(`Recipe has ${steps.length} steps; the limit is ${MAX_STEPS}.`);

  const out = steps.map((s, i) => normaliseStep(s, `step ${i + 1}`));

  return {
    id: String(raw.id ?? 'custom').replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'custom',
    title: text(raw.title ?? 'Custom recording', 'title', 80),
    route,
    open: raw.open ? card(raw.open, 'open') : null,
    // Through `card()` rather than written out, so every card leaving this file
    // has the same six fields whether it was authored or defaulted. It played
    // correctly either way — an absent motion is `rise` downstream — but a
    // default that is shaped differently from an override is the kind of
    // asymmetry that eventually gets read as meaningful.
    end: card(
      raw.end ?? { title: 'Zeneva', subtitle: 'Retail, handled.', cta: 'Start free', ms: 2600 },
      'end',
    ),
    steps: out,
  };
}

/*
 * Slide motions, and the still-image check.
 *
 * This list is the twin of `SLIDE_MOTIONS` in `src/lib/marketing/slides.ts`; a
 * motion added there and not here is rejected at the boundary rather than played
 * wrong. Unlike the TypeScript side — which clips and defaults, because it is
 * cleaning up after a model — this side throws, for the same reason `text()`
 * throws on an over-long title: by the time a value reaches the recorder it has
 * already been through one validator, so anything invalid here came from a
 * hand-written file and its author wants to be told.
 */
const MOTIONS = ['rise', 'wipe', 'zoom', 'split'];
const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_CHARS = 4_000_000;

function motion(raw, where) {
  if (raw == null || raw === '') return 'rise';
  if (typeof raw !== 'string' || !MOTIONS.includes(raw)) {
    throw new Error(`${where} motion: must be one of ${MOTIONS.join(', ')}`);
  }
  return raw;
}

/**
 * A slide's background still, or null.
 *
 * Only a self-contained `data:` image. A remote URL is refused on purpose: the
 * recording browser is signed into a real business, so a slide that fetches from
 * someone else's host leaks when a take ran and lets an outage there blank a
 * frame mid-shoot. The base64 body is scanned before it is handed to a browser —
 * a `data:` URI is the one place a stray quote would escape the `url("...")` it
 * gets interpolated into.
 */
function image(raw, where) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') throw new Error(`${where} image: must be a data: URI string`);
  const comma = raw.indexOf(',');
  if (!raw.startsWith('data:') || comma < 0) {
    throw new Error(`${where} image: must be a data: URI, not a URL`);
  }
  const header = raw.slice(5, comma);
  if (!header.endsWith(';base64')) throw new Error(`${where} image: must be base64-encoded`);
  const mime = header.slice(0, -7).toLowerCase();
  if (!IMAGE_MIME.includes(mime)) {
    throw new Error(`${where} image: ${mime || 'no type'} is not one of ${IMAGE_MIME.join(', ')}`);
  }
  const body = raw.slice(comma + 1);
  if (!body) throw new Error(`${where} image: empty`);
  if (body.length > MAX_IMAGE_CHARS) {
    throw new Error(`${where} image: ${Math.round(body.length / 1000)}kB of base64 exceeds the `
      + `${MAX_IMAGE_CHARS / 1000}kB cap`);
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) throw new Error(`${where} image: not valid base64`);
  return `data:${mime};base64,${body}`;
}

function card(raw, where) {
  return {
    title: text(raw?.title, `${where} card title`, 70),
    subtitle: text(raw?.subtitle, `${where} card subtitle`, 90),
    cta: text(raw?.cta, `${where} card cta`, 40),
    ms: ms(raw?.ms, 2200, `${where} card`),
    motion: motion(raw?.motion, `${where} card`),
    image: image(raw?.image, `${where} card`),
  };
}

function normaliseStep(s, where) {
  if (!s || typeof s !== 'object') throw new Error(`${where}: each step must be an object`);

  if (s.goto != null) return { kind: 'goto', route: routePath(s.goto, where), settle: ms(s.ms, 900, where) };
  if (s.caption != null) return { kind: 'caption', text: text(s.caption, where), ms: ms(s.ms, 3600, where) };
  if (s.card != null) return { kind: 'card', ...card(s.card, where) };
  if (s.clickTo != null) {
    const path = routePath(s.path ?? s.clickTo?.path, `${where}: clickTo`);
    return { kind: 'clickTo', spec: spec(s.clickTo.spec ?? s.clickTo, where), path, settle: ms(s.ms, 1200, where) };
  }
  if (s.click != null) return { kind: 'click', spec: spec(s.click, where), settle: ms(s.ms, 800, where) };
  if (s.hover != null) return { kind: 'hover', spec: spec(s.hover, where), settle: ms(s.ms, 700, where) };
  if (s.fill != null) {
    return {
      kind: 'fill',
      spec: spec(s.fill.spec ?? s.fill, where),
      text: text(s.fill.text ?? s.text, where),
      enter: !!(s.fill.enter ?? s.enter),
      clear: !!(s.fill.clear ?? s.clear),
      settle: ms(s.ms, 700, where),
    };
  }
  if (s.press != null) {
    const key = String(s.press);
    const allowed = ['Enter', 'Escape', 'Tab', 'Backspace', 'Delete'];
    if (!allowed.includes(key)) throw new Error(`${where}: press must be one of ${allowed.join(', ')}`);
    return { kind: 'press', key };
  }
  if (s.scroll != null) {
    const n = Number(s.scroll);
    if (!Number.isFinite(n)) throw new Error(`${where}: scroll must be a number of pixels`);
    return { kind: 'scroll', dy: Math.max(-4000, Math.min(4000, Math.round(n))) };
  }
  if (s.hold != null) return { kind: 'hold', ms: ms(s.hold, 1000, where) };
  if (s.punch != null) {
    /*
     * `to` is capped at 1.6, and the cap is not arbitrary taste.
     *
     * The camera is a lanczos upscale of already-captured 1080p frames, not a
     * re-render at a higher resolution — supersampled capture was measured on
     * this machine at 10-17 fps painted, well under the 30 the sampler needs, so
     * it is not on the table. Past roughly 1.5x, app text visibly softens. A
     * recipe asking for 3x would get a blurry shot and blame the recorder.
     */
    const to = s.punch === true ? 1.3 : Number(s.to ?? s.punch?.to ?? 1.3);
    if (!Number.isFinite(to) || to < 1 || to > 1.6) {
      throw new Error(`${where}: punch "to" must be between 1 and 1.6`);
    }
    return {
      kind: 'punch',
      // A punch with no target frames the middle, which is what "just push in a
      // bit" means and is worth allowing.
      spec: s.punch === true || s.punch?.spec == null ? null : spec(s.punch.spec ?? s.punch, where),
      to,
      ms: ms(s.ms, 760, where),
    };
  }
  if (s.wide != null) return { kind: 'wide', ms: ms(s.ms ?? (s.wide === true ? null : s.wide), 800, where) };

  throw new Error(`${where}: unknown step — expected one of ${Object.keys(STEP_KINDS).join(', ')}`);
}

/**
 * Turn a parsed recipe into something `record.mjs` can run like any coded flow.
 *
 * Same signature as `posFlow` and friends, so the runner does not know or care
 * which kind it was handed. The opening and closing cards are deliberately *not*
 * played here — the runner plays them for every kind of recording from its own
 * card table, which is what lets the studio rewrite them per run.
 */
export function recipeToFlow(recipe) {
  return async function customFlow(page) {
    await page.goto(recipe.route);

    for (const s of recipe.steps) {
      switch (s.kind) {
        case 'goto':    await page.goto(s.route); await page.hold(s.settle); break;
        case 'caption': await page.caption(s.text, s.ms); await page.hold(Math.min(s.ms, 1400)); break;
        case 'card':    await page.card(s); await page.clearCard(); break;
        case 'click':   await page.click(s.spec, { settle: s.settle }); break;
        case 'clickTo': await page.clickTo(s.spec, s.path, { settle: s.settle }); break;
        case 'hover':   await page.hover(s.spec, s.settle); break;
        case 'fill':    await page.fill(s.spec, s.text, { enter: s.enter, clear: s.clear, settle: s.settle }); break;
        case 'press':   await page.press(s.key); break;
        case 'scroll':  await page.scrollBy(s.dy); break;
        case 'hold':    await page.hold(s.ms); break;
        case 'punch':   await page.punch(s.spec, { to: s.to, ms: s.ms }); break;
        case 'wide':    await page.wide({ ms: s.ms }); break;
        default:        break; // unreachable: parseRecipe rejects unknown kinds
      }
    }
    await page.caption('');
  };
}

/**
 * Validate a `{ flowId: { open, end } }` card-override map.
 *
 * Separate from `parseRecipe` because overriding the copy on an existing flow is
 * the common case and writing a whole recipe to do it would be absurd — the three
 * coded flows have no recipe to edit at all.
 *
 * Keys are preserved exactly as given, including an explicit `null`: the runner
 * distinguishes "not mentioned" (keep the authored card) from "removed" (play no
 * card), and collapsing the two here would make it impossible to ship a video
 * with no title screen.
 */
export function parseCardOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Card overrides must be an object keyed by flow id.');
  }
  const out = {};
  for (const [id, val] of Object.entries(raw)) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      throw new Error(`${id}: must be an object with "open" and/or "end"`);
    }
    const entry = {};
    for (const which of ['open', 'end']) {
      if (!(which in val)) continue;
      entry[which] = val[which] == null ? null : card(val[which], `${id} ${which}`);
    }
    if (Object.keys(entry).length) out[id] = entry;
  }
  return out;
}

/** Routes a recipe visits, so they can be pre-compiled like a coded flow's. */
export function recipeRoutes(recipe) {
  const seen = [recipe.route];
  for (const s of recipe.steps) {
    if (s.kind === 'goto' && !seen.includes(s.route)) seen.push(s.route);
    if (s.kind === 'clickTo' && !seen.includes(s.path)) seen.push(s.path);
  }
  return seen;
}

