import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { requireSuperAdmin, corsHeaders } from '../_guard';
import { OUT_DIR, VIDEO_EXT, hasFfmpeg, hostReason, jobSlot } from './_host';
import {
    FLOW_IDS, DEVICE_IDS, THEME_IDS, FORMAT_IDS, FPS_RANGE, QUALITY_RANGE,
    VOICE_IDS, DEFAULT_VOICE, VOICE_STYLE_MAX,
    cleanRecordUrl, recipeId, recipeToWire,
    type JobStatus, type Recipe, type RecorderStatus, type RecorderTake,
} from '@/lib/marketing/recorder';
import { cleanSlideImage, MAX_SLIDE_IMAGE_CHARS } from '@/lib/marketing/slides';

/**
 * Drives `scripts/record/record.mjs` from the admin Marketing Studio.
 *
 * The recorder launches a real Chrome, signs into the app and shells out to
 * ffmpeg. That is a local developer tool wearing an HTTP endpoint so the studio
 * page can have buttons — it is emphatically not a production feature, and the
 * gates below say so in three independent ways:
 *
 *   1. Super-admin bearer token, same as every other admin route.
 *   2. Refuses to run anywhere that looks like a serverless host, even if
 *      something else has gone wrong and the first gate passed.
 *   3. Refuses to run under `next build` output unless someone has explicitly
 *      set ZENEVA_RECORDER_ENABLE=1, because a self-hosted production server is
 *      the one case where "not dev" and "not serverless" are both true.
 *
 * Everything that reaches `spawn` is either enumerated against a list in
 * `@/lib/marketing/recorder` or clamped to a numeric range, and the argument
 * array is passed directly — never through a shell — so no value here can be
 * read as a command. Credentials are never accepted over HTTP at all: the
 * recorder reads `.env.recorder` off disk itself, so a request cannot carry an
 * account, and this route cannot leak one.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, 'scripts', 'record', 'record.mjs');
const RECIPE_FILE = path.join(OUT_DIR, '.recipes', 'studio.json');
const CARDS_FILE = path.join(OUT_DIR, '.recipes', 'cards.json');
const MUSIC_DIR = path.join(ROOT, 'marketing-music');
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus']);

/** Keep the tail bounded — a twelve-take run is thousands of lines. */
const MAX_LOG_LINES = 400;

// Shared with the trim route so a cut cannot start in the middle of a take, and
// so a hot reload does not orphan a running child.
const slot = jobSlot();

// ------------------------------------------------------------------ gates

/** Why this machine may not run the recorder, or null if it may. */
function unavailableReason(): string | null {
    const host = hostReason();
    if (host) return host;
    if (!existsSync(SCRIPT)) {
        return 'scripts/record/record.mjs is missing from this checkout.';
    }
    return null;
}

const ENV_FILE = path.join(ROOT, '.env.recorder');

/** Strip one layer of matching quotes, the same way the CLI's reader does. */
function unquote(v: string): string {
    return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
        ? v.slice(1, -1)
        : v;
}

/** KEY -> value from `.env.recorder`, or an empty map if it isn't there. */
function readEnvFile(): Record<string, string> {
    if (!existsSync(ENV_FILE)) return {};
    const out: Record<string, string> = {};
    for (const raw of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq < 1) continue;
        out[line.slice(0, eq).trim()] = unquote(line.slice(eq + 1).trim());
    }
    return out;
}

/**
 * Which account the bot will use, and where it came from.
 *
 * Returns the email in full — the studio has to show and edit it — but reads the
 * password only to answer "is one set?". The password is never returned by any
 * handler in this file.
 *
 * `source` matters: `record.mjs` prefers `process.env` over the file, so if a
 * shell exported `ZENEVA_RECORD_EMAIL`, saving from the studio would appear to
 * work and change nothing. The studio warns instead of lying.
 */
function credentialState(): { configured: boolean; email: string | null; source: 'env' | 'file' | null } {
    if (process.env.ZENEVA_RECORD_EMAIL && process.env.ZENEVA_RECORD_PASSWORD) {
        return { configured: true, email: process.env.ZENEVA_RECORD_EMAIL, source: 'env' };
    }
    const env = readEnvFile();
    return env.ZENEVA_RECORD_EMAIL && env.ZENEVA_RECORD_PASSWORD
        ? { configured: true, email: env.ZENEVA_RECORD_EMAIL, source: 'file' }
        : { configured: false, email: null, source: null };
}

/**
 * Save the account into `.env.recorder`, leaving any other key in there alone.
 *
 * A password belongs in a gitignored file and nowhere else — never in `src/`,
 * never as a spawn argument (argv is readable by every user on the machine via
 * `ps`), never in the job log. Written 0600 so it is not world-readable on a
 * POSIX box; Windows ignores the mode and inherits the directory ACL.
 *
 * Values are double-quoted on the way out so a password containing `#` or an
 * edge space survives the round trip through `unquote`.
 */
function writeCredentials(email: string, password: string): void {
    const keep = existsSync(ENV_FILE)
        ? readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).filter((raw) => {
            const line = raw.trim();
            if (line.startsWith('#')) return false;
            const eq = line.indexOf('=');
            if (eq < 1) return line !== '';
            const k = line.slice(0, eq).trim();
            return k !== 'ZENEVA_RECORD_EMAIL' && k !== 'ZENEVA_RECORD_PASSWORD';
        })
        : [];

    const body = [
        '# Recorder account — written by the Marketing Studio.',
        '# Gitignored via the `.env*` line in .gitignore. Never commit this file.',
        '#',
        '# Use a DEMO business, not the live one: whatever this account can see ends',
        '# up in the footage, and every take costs real Firestore reads.',
        `ZENEVA_RECORD_EMAIL="${email}"`,
        `ZENEVA_RECORD_PASSWORD="${password}"`,
        ...keep,
    ].join('\n').trimEnd() + '\n';

    writeFileSync(ENV_FILE, body, { encoding: 'utf8', mode: 0o600 });
}

function listDir(dir: string, exts: Set<string>): RecorderTake[] {
    if (!existsSync(dir)) return [];
    try {
        return readdirSync(dir)
            .filter((f) => exts.has(path.extname(f).toLowerCase()))
            .map((f) => {
                const s = statSync(path.join(dir, f));
                return { name: f, bytes: s.size, modified: s.mtimeMs };
            })
            .sort((a, b) => b.modified - a.modified);
    } catch {
        return [];
    }
}

// ------------------------------------------------------------------ input

const oneOf = <T extends string>(allowed: readonly T[], values: unknown, label: string): T[] => {
    if (!Array.isArray(values) || values.length === 0) {
        throw new Error(`Pick at least one ${label}.`);
    }
    const out: T[] = [];
    for (const v of values) {
        if (!allowed.includes(v as T)) throw new Error(`Unknown ${label}: ${String(v)}`);
        if (!out.includes(v as T)) out.push(v as T);
    }
    return out;
};

const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
};

/**
 * Resolve a music choice to a real path inside `marketing-music/`.
 *
 * Matched against the directory listing by basename rather than joined onto it,
 * so `../../.env` or an absolute path cannot name a file outside the folder —
 * a value that is not in the listing simply does not exist as far as this is
 * concerned.
 */
function resolveMusic(name: unknown): string | null {
    if (name === null || name === undefined || name === '') return null;
    if (typeof name !== 'string') throw new Error('Invalid music selection.');
    const base = path.basename(name);
    const available = listDir(MUSIC_DIR, AUDIO_EXT).map((t) => t.name);
    if (!available.includes(base)) throw new Error(`No such track in marketing-music: ${base}`);
    return path.join(MUSIC_DIR, base);
}

/**
 * Write the studio's recipe to disk and return the `--recipe <file>` pair.
 *
 * The recipe travels as a **file rather than an argument** for two reasons. It is
 * far past any sane command-line length once it has ten steps and a pair of title
 * cards; and argv on this machine is readable by every other process, which is
 * the same reason the account password is never passed here either.
 *
 * Only the two fields the CLI needs are asserted before writing — the real check
 * is `parseRecipe` inside the recorder, which runs on the far side of the process
 * boundary and cannot be skipped by posting different JSON. Duplicating that
 * validation here would be a second copy to keep in step, and the copy that
 * drifts is always the one that lets something through.
 */
function writeRecipe(raw: unknown): string[] {
    if (raw === null || raw === undefined) return [];
    const recipe = raw as Recipe;
    if (typeof recipe?.route !== 'string' || !Array.isArray(recipe?.steps)) {
        throw new Error('A recipe needs a route and at least one step.');
    }
    mkdirSync(path.dirname(RECIPE_FILE), { recursive: true });
    writeFileSync(RECIPE_FILE, JSON.stringify(recipeToWire(recipe), null, 2), 'utf8');
    return ['--recipe', RECIPE_FILE];
}

/**
 * Write rewritten title cards to disk and return the `--cards <file>` pair.
 *
 * Same reasoning as the recipe — a file, not argv — and the same division of
 * labour: `parseCardOverrides` on the recorder's side is the real check, and it
 * is the one a request cannot get around. The only thing asserted here is the
 * outer shape, so a malformed body fails with a message about the request rather
 * than as a recorder that exits 1 thirty seconds later.
 *
 * An entry whose value is `null` is passed through untouched: that is how the
 * operator says "no opening card", and dropping it would silently restore the
 * default they just removed. Nothing here rewrites a card for the same reason —
 * "not mentioned", "removed" and "overridden" are three different instructions
 * and normalising them here would lose one.
 *
 * The exception is a slide's image, which is checked now rather than later. It is
 * the only field an operator can make enormous by accident — a phone photo is
 * several megabytes of base64 — and the difference between a clear message and a
 * recorder that dies half a minute in is worth one early call.
 */
function writeCards(raw: unknown): string[] {
    if (raw === null || raw === undefined) return [];
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Title cards must be an object keyed by flow.');
    const entries = Object.entries(raw as Record<string, unknown>).filter(([, v]) => {
        if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
        return 'open' in (v as object) || 'end' in (v as object);
    });
    for (const [flow, v] of entries) {
        for (const which of ['open', 'end'] as const) {
            const slide = (v as Record<string, unknown>)[which];
            if (!slide || typeof slide !== 'object') continue;
            const img = (slide as Record<string, unknown>).image;
            if (img === null || img === undefined || img === '') continue;
            if (!cleanSlideImage(img)) {
                throw new Error(
                    `${flow} ${which}: the slide image must be a PNG, JPEG or WebP upload under `
                    + `${Math.round(MAX_SLIDE_IMAGE_CHARS / 1000)}kB once encoded.`
                );
            }
        }
    }
    if (!entries.length) return [];
    mkdirSync(path.dirname(CARDS_FILE), { recursive: true });
    writeFileSync(CARDS_FILE, JSON.stringify(Object.fromEntries(entries), null, 2), 'utf8');
    return ['--cards', CARDS_FILE];
}

/**
 * Whether a Gemini key is on this machine. Answers a boolean and nothing else.
 *
 * Both names because `narrate.mjs` accepts either, and the recorder is a child
 * process of this one — so if the key is visible here it will be visible there.
 */
function hasNarrationKey(): boolean {
    return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

/**
 * The tone direction for the voice, sanitised.
 *
 * This is the one free-text field in the whole request that reaches argv, and it
 * gets there because Gemini TTS has no style parameter — direction is prepended
 * to the text being spoken. `spawn` runs without a shell so no value here can be
 * read as a command, but three things are still worth doing: strip control
 * characters, since a newline inside the prompt would read as a second
 * instruction to the model; clamp the length, because a thousand-word direction
 * is a thousand words the model weighs against a one-sentence caption; and
 * collapse whitespace so the recorder logs one readable line.
 */
function voiceStyle(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    // Code points rather than a regex character class: the control range has to
    // be written as numeric escapes, and a numeric escape is exactly the kind of
    // thing that arrives already-decoded when a tool edits this file. Comparing
    // numbers cannot be mangled that way.
    const printable = Array.from(raw)
        .filter((ch) => {
            const code = ch.codePointAt(0) ?? 0;
            return code >= 32 && code !== 127;
        })
        .join('');
    const clean = printable.split(/[ \t]+/).join(' ').trim();
    return clean ? clean.slice(0, VOICE_STYLE_MAX) : null;
}

function buildArgs(body: any): string[] {
    // A recipe stands on its own: recording *only* a custom page is the whole
    // point of the feature, so `flows` is allowed to be empty when one is present.
    const hasRecipe = body?.recipe != null;
    const flows = hasRecipe && !body?.flows?.length ? [] : oneOf(FLOW_IDS, body?.flows, 'flow');
    const devices = oneOf(DEVICE_IDS, body?.devices, 'device');
    const themes = oneOf(THEME_IDS, body?.themes, 'theme');
    const format = FORMAT_IDS.includes(body?.format) ? body.format : 'mp4';
    const fps = clampInt(body?.fps, FPS_RANGE.min, FPS_RANGE.max, FPS_RANGE.default);
    const quality = clampInt(body?.quality, QUALITY_RANGE.min, QUALITY_RANGE.max, QUALITY_RANGE.default);
    const music = resolveMusic(body?.music);
    const musicVolume = Math.min(1, Math.max(0, Number(body?.musicVolume ?? 0.28)));

    const recipeArgs = writeRecipe(body?.recipe);
    // The recipe registers under a derived id, so naming it alongside the coded
    // flows is how "record the dashboard *and* the POS flow" is expressed. When
    // nothing else is selected, `--recipe` alone already means "record this" and
    // `--flow` is left off entirely.
    const selected = hasRecipe ? [...flows, recipeId(body.recipe.title ?? '')] : flows;

    const args = [
        SCRIPT,
        ...(selected.length ? ['--flow', selected.join(',')] : []),
        ...recipeArgs,
        // After the recipe on the command line as well as in the runner, so a
        // rewritten card wins over the one the recipe carries.
        ...writeCards(body?.cards),
        '--device', devices.join(','),
        '--theme', themes.join(','),
        '--format', format,
        '--fps', String(fps),
        '--quality', String(quality),
    ];
    // Where to point the browser. Absent or null keeps the CLI's own default, so a
    // caller that never sends this behaves exactly as it did before the field
    // existed. Re-validated here rather than trusted from the panel: this is the
    // one value in the request that names a host, and the panel is not the only
    // thing that can post to this route.
    if (body?.url != null && body.url !== '') {
        const url = cleanRecordUrl(body.url);
        if (!url) {
            throw new Error(
                'That is not an address the recorder can open — http:// or https://, '
                + 'and no username or password in the URL.',
            );
        }
        args.push('--url', url);
    }
    if (music) {
        args.push('--music', music, '--music-volume', musicVolume.toFixed(3));
    } else {
        args.push('--no-music');
    }
    if (body?.clickSfx === false) args.push('--no-click-sfx');
    if (body?.typingSfx === false) args.push('--no-typing-sfx');
    // Narration is opt-in because it is the only option that costs money — one
    // Gemini TTS request per caption. The voice is enumerated on both sides so an
    // unknown one is a rejected request rather than a take that records for forty
    // seconds and then fails at the synthesis call.
    if (body?.narrate === true) {
        const voice = VOICE_IDS.includes(body?.voice) ? body.voice : DEFAULT_VOICE;
        args.push('--narrate', '--voice', voice);
        const style = voiceStyle(body?.voiceStyle);
        if (style) args.push('--voice-style', style);
    }
    // Both of these change what the run does to real data / the real screen, so
    // they are opt-in and never inferred.
    if (body?.commit === true) args.push('--commit');
    if (body?.headed === true) args.push('--headed');
    /*
     * Enumerated rather than passed through, like `--voice` above: the recorder
     * throws on an unknown style, and a request that fails at argument-parse time
     * after the browser has launched wastes the whole launch. Anything that is not
     * exactly 'cinematic' records plain, which is also what an older client that
     * does not send the field gets.
     */
    if (body?.style === 'cinematic') args.push('--style', 'cinematic');
    // The camera is opt-in for a quality reason rather than a safety one — see
    // `--punch` in the recorder's help.
    if (body?.punch === true) args.push('--punch');
    return args;
}

// ------------------------------------------------------------------ handlers

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' },
    });
}

/**
 * Save the recorder account.
 *
 * The password arrives over HTTP once, goes straight into the gitignored
 * `.env.recorder`, and is never read back out by any handler here — `GET`
 * returns the email and a boolean, nothing more. That is the whole reason this
 * writes a file instead of holding credentials in memory: the CLI has to be
 * able to read them too, and a file is the only thing both halves share.
 */
export async function PUT(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    const reason = unavailableReason();
    if (reason) {
        return NextResponse.json({ error: reason }, { status: 409, headers: corsHeaders });
    }
    if (slot.job?.state === 'running') {
        return NextResponse.json(
            { error: 'A recording is running — stop it before changing the account.' },
            { status: 409, headers: corsHeaders },
        );
    }

    let email: string;
    let password: string;
    try {
        const body = await req.json();
        email = String(body?.email ?? '').trim();
        password = String(body?.password ?? '');
    } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: corsHeaders });
    }

    if (!email || !password) {
        return NextResponse.json(
            { error: 'Both an email and a password are required.' },
            { status: 400, headers: corsHeaders },
        );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
            { error: 'That does not look like an email address.' },
            { status: 400, headers: corsHeaders },
        );
    }
    // A newline would let one field forge another `KEY=` line in the file.
    if (/[\r\n]/.test(email) || /[\r\n]/.test(password)) {
        return NextResponse.json(
            { error: 'Line breaks are not allowed in either field.' },
            { status: 400, headers: corsHeaders },
        );
    }
    if (password.includes('"')) {
        return NextResponse.json(
            { error: 'Double quotes are not supported in the password — change it, or edit .env.recorder by hand.' },
            { status: 400, headers: corsHeaders },
        );
    }

    try {
        writeCredentials(email, password);
    } catch (err: any) {
        return NextResponse.json(
            { error: `Could not write .env.recorder: ${err?.message ?? 'unknown error'}` },
            { status: 500, headers: corsHeaders },
        );
    }

    return NextResponse.json({ credentials: credentialState() }, { headers: corsHeaders });
}

/** Current state: can we record here, what is running, what has been produced. */
export async function GET(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    const reason = unavailableReason();
    const status: RecorderStatus = {
        available: reason === null,
        reason,
        credentials: credentialState(),
        ffmpeg: await hasFfmpeg(),
        narration: hasNarrationKey(),
        music: listDir(MUSIC_DIR, AUDIO_EXT).map((t) => t.name),
        job: slot.job,
        takes: listDir(OUT_DIR, VIDEO_EXT),
    };
    return NextResponse.json(status, { headers: corsHeaders });
}

/** Start a run. One at a time — a second Chrome would fight for the debug port. */
export async function POST(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    const reason = unavailableReason();
    if (reason) {
        return NextResponse.json({ error: reason }, { status: 409, headers: corsHeaders });
    }
    if (slot.job?.state === 'running') {
        return NextResponse.json(
            { error: 'A recording is already running.' },
            { status: 409, headers: corsHeaders },
        );
    }
    if (!credentialState().configured) {
        return NextResponse.json(
            { error: 'No recorder account. Copy scripts/record/recorder.env.example to .env.recorder and fill it in.' },
            { status: 400, headers: corsHeaders },
        );
    }

    let args: string[];
    let body: any;
    try {
        body = await req.json();
        args = buildArgs(body);
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || 'Invalid request.' },
            { status: 400, headers: corsHeaders },
        );
    }

    // A recipe is a subject like any flow, so it counts toward the expected total
    // — otherwise the studio's progress bar reads "0 of 0" for a recipe-only run.
    const subjects = (body.flows?.length ?? 0) + (body.recipe ? 1 : 0);
    const takesExpected =
        Math.max(1, subjects) * (body.devices?.length ?? 1) * (body.themes?.length ?? 1);

    const job: JobStatus = {
        id: `rec_${Date.now().toString(36)}`,
        state: 'running',
        log: [],
        startedAt: Date.now(),
        endedAt: null,
        takesExpected,
        takes: [],
        error: null,
    };
    slot.job = job;

    const push = (chunk: Buffer | string) => {
        const lines = String(chunk).split(/\r?\n/).filter((l) => l.trim() !== '');
        job.log.push(...lines);
        if (job.log.length > MAX_LOG_LINES) job.log.splice(0, job.log.length - MAX_LOG_LINES);
    };

    // `shell: false` is the default and must stay that way: with a shell, any
    // argument would be re-parsed as a command line.
    const child = spawn(process.execPath, args, {
        cwd: ROOT,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    slot.child = child;

    child.stdout.on('data', push);
    child.stderr.on('data', push);
    child.on('error', (err) => {
        job.state = 'failed';
        job.error = err.message;
        job.endedAt = Date.now();
        slot.child = null;
    });
    child.on('exit', (code, signal) => {
        if (job.state === 'cancelled') {
            job.endedAt = Date.now();
        } else if (code === 0) {
            job.state = 'done';
            job.endedAt = Date.now();
        } else {
            job.state = 'failed';
            job.error = signal
                ? `The recorder was stopped (${signal}).`
                : `The recorder exited with code ${code}. See the log.`;
            job.endedAt = Date.now();
        }
        // Attribute only the files this run actually wrote, so a failed take
        // cannot be reported as a success by picking up an older video.
        job.takes = listDir(OUT_DIR, VIDEO_EXT).filter((t) => t.modified >= job.startedAt);
        slot.child = null;
    });

    return NextResponse.json({ job }, { headers: corsHeaders });
}

/** Stop the run in progress. */
export async function DELETE(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    if (!slot.job || slot.job.state !== 'running') {
        return NextResponse.json(
            { error: 'Nothing is running.' },
            { status: 409, headers: corsHeaders },
        );
    }
    slot.job.state = 'cancelled';
    slot.job.error = 'Stopped from the studio.';
    try {
        slot.child?.kill();
    } catch {
        /* already gone */
    }
    return NextResponse.json({ job: slot.job }, { headers: corsHeaders });
}
