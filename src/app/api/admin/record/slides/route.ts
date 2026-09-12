import { NextResponse } from 'next/server';
import { requireSuperAdmin, corsHeaders } from '../../_guard';
import { hostReason } from '../_host';
import {
    SLIDE_MOTION_IDS, SLIDE_TEXT_LIMITS,
    cleanSlide, slidePrompt,
    type Slide,
} from '@/lib/marketing/slides';

/**
 * Ask Gemini to write the opening and closing title screens for a take.
 *
 * ## The model writes data, never code
 *
 * The tempting version of this feature hands the model the overlay and lets it
 * write the CSS — that is how you get a slide that looks like nobody's template.
 * It is also a remote-code-execution path into an authenticated admin surface,
 * and not a subtle one: the model's reply arrives in an HTTP response, the
 * recorder evaluates what it is given inside a Chrome that is *signed into the
 * owner's business*, and a model that has been prompt-injected — or is simply
 * confused by a product description pasted from somewhere — would be authoring
 * script with the owner's session. There is no sandbox on that path and adding
 * one would be a bigger project than this whole feature.
 *
 * So the model picks from a fixed catalogue of four motions and fills in three
 * strings, and every field comes back through `cleanSlide`, which is the same
 * function the studio's paste-it-yourself path uses. An unknown motion becomes
 * the default rather than an error; over-long copy is clipped; anything that is
 * not one of the six known keys is dropped on the floor. What the recorder
 * receives from this route is indistinguishable from what it receives when a
 * person types the words in by hand, which is the property worth having.
 *
 * `cleanSlide` runs here, and `recipe.mjs` validates the same shapes again on the
 * recorder's side of the process boundary — the side a request cannot skip by
 * posting different JSON.
 *
 * ## Why this route exists at all when the panel can already copy a prompt
 *
 * `slidePrompt()` gives the operator text to paste into any chat window, and that
 * path needs no key, no route and no network call from this machine. It is the
 * one that will still work in a year. This route is the convenience on top: it
 * only answers when a Gemini key is already on the machine for narration, and it
 * fails with a message pointing at the copy-the-prompt button rather than at a
 * missing environment variable, because the person reading it is doing marketing.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Text model, not the TTS one `narrate.mjs` uses — same key, different endpoint.
 * Flash because this is four short strings and an operator is watching a spinner.
 */
const MODEL = 'gemini-3.6-flash';

/** A slide pair is a few hundred bytes. Anything slower is the API being down. */
const TIMEOUT_MS = 45_000;

/** Free-text the operator typed, bounded before it becomes part of a prompt. */
const BRIEF_MAX = 400;

function apiKey(): string | null {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;
}

/**
 * One line of the operator's brief, flattened.
 *
 * Newlines come out because the brief is interpolated into a prompt and a newline
 * there lets pasted text read as a fresh instruction to the model. That is not a
 * security boundary — the worst a poisoned prompt can produce is bad ad copy,
 * since the reply is validated into four strings either way — but a slide that
 * quietly ignores the brief because something in it said "ignore the above" is a
 * confusing afternoon for whoever is using this.
 */
function brief(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    let out = '';
    for (const ch of raw) {
        const c = ch.codePointAt(0)!;
        out += c < 0x20 || c === 0x7f ? ' ' : ch;
    }
    return out.replace(/\s+/g, ' ').trim().slice(0, BRIEF_MAX);
}

/**
 * The instruction to the model.
 *
 * Deliberately the same shape `slidePrompt()` hands a person to paste elsewhere,
 * so the two paths cannot drift into producing different-looking slides — plus
 * the response schema below, which is what makes parsing unnecessary.
 */
function buildPrompt(body: Record<string, unknown>): string {
    const base = slidePrompt({
        product: brief(body.product),
        audience: brief(body.audience),
        angle: brief(body.angle),
    });
    const flow = brief(body.flowLabel);
    const extra = flow
        ? `\nThe recording shows this part of the app: ${flow}. The words should suit it.`
        : '';
    return `${base}${extra}`;
}

/**
 * The shape the model must answer in.
 *
 * `responseSchema` makes the reply parseable without stripping code fences or
 * guessing, and it constrains `motion` to the catalogue at the source. It is not
 * the *reason* the output is safe — `cleanSlide` is, because a schema is the
 * model's cooperation and a validator is not — but it means the common case
 * arrives clean instead of being repaired.
 */
const SCHEMA = {
    type: 'object',
    properties: {
        open: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                subtitle: { type: 'string' },
                motion: { type: 'string', enum: [...SLIDE_MOTION_IDS] },
                ms: { type: 'integer' },
            },
            required: ['title', 'subtitle', 'motion', 'ms'],
        },
        end: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                subtitle: { type: 'string' },
                cta: { type: 'string' },
                motion: { type: 'string', enum: [...SLIDE_MOTION_IDS] },
                ms: { type: 'integer' },
            },
            required: ['title', 'subtitle', 'cta', 'motion', 'ms'],
        },
    },
    required: ['open', 'end'],
} as const;

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    });
}

export async function POST(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    // Same host gate as the rest of the recorder: this is a local developer tool
    // wearing an HTTP endpoint, and it should not answer in production even
    // though writing ad copy is harmless on its own.
    const reason = hostReason();
    if (reason) {
        return NextResponse.json({ error: reason }, { status: 409, headers: corsHeaders });
    }

    const key = apiKey();
    if (!key) {
        return NextResponse.json({
            error: 'No Gemini key on this machine. Use "Copy the prompt" instead and '
                + 'paste the reply back — that path needs no key.',
        }, { status: 409, headers: corsHeaders });
    }

    let body: Record<string, unknown> = {};
    try {
        body = (await req.json()) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400, headers: corsHeaders });
    }

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let raw: unknown;
    try {
        const res = await fetch(`${API_ROOT}/${MODEL}:generateContent`, {
            method: 'POST',
            signal: ctl.signal,
            headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
                contents: [{ parts: [{ text: buildPrompt(body) }] }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: SCHEMA,
                    // Ad copy wants some spread; the schema keeps the shape fixed
                    // regardless, so temperature only affects the words.
                    temperature: 1,
                },
            }),
        });

        if (!res.ok) {
            let detail = `Gemini answered ${res.status}`;
            try {
                const err = await res.json();
                detail = err?.error?.message || detail;
            } catch { /* the status alone is the message */ }
            // The key is never echoed, and neither is the request — only the
            // API's own complaint, which is what the operator can act on.
            return NextResponse.json({ error: detail }, { status: 502, headers: corsHeaders });
        }

        const payload = await res.json();
        const text = payload?.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p?.text)
            .filter(Boolean)
            .join('') ?? '';
        if (!text) {
            return NextResponse.json(
                { error: 'The model returned nothing. Try again, or write the slides by hand.' },
                { status: 502, headers: corsHeaders },
            );
        }
        raw = JSON.parse(text);
    } catch (e) {
        clearTimeout(timer);
        const msg = e instanceof Error && e.name === 'AbortError'
            ? 'Gemini took too long. Try again, or use "Copy the prompt".'
            : e instanceof Error ? e.message : 'Could not reach Gemini.';
        return NextResponse.json({ error: msg }, { status: 502, headers: corsHeaders });
    } finally {
        clearTimeout(timer);
    }

    // Everything above produced *suggested* values; this is the line that decides
    // what the studio is allowed to see. A model that ignored the schema, a model
    // that wrote a 300-character headline, a model that invented a fifth motion:
    // all of them end here as either a clean slide or nothing.
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const open: Slide | null = cleanSlide(r.open);
    const end: Slide | null = cleanSlide(r.end);
    if (!open && !end) {
        return NextResponse.json(
            { error: 'The model wrote nothing usable. Try again with a clearer brief.' },
            { status: 502, headers: corsHeaders },
        );
    }
    // Never a picture: the model writes words, and an image is an upload. Said
    // explicitly rather than relied upon, because `cleanSlide` would happily pass
    // a valid data URI through if a future prompt ever invited one.
    if (open) delete open.image;
    if (end) delete end.image;
    // The opening screen has no button — asking for the click before anything has
    // been shown is the one rule the prompt states and the model still sometimes
    // breaks, and the card editor enforces the same thing in the UI.
    if (open) delete open.cta;

    return NextResponse.json({ open, end, limits: SLIDE_TEXT_LIMITS }, { headers: corsHeaders });
}
