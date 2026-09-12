import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { requireSuperAdmin, corsHeaders } from '../../_guard';
import { OUT_DIR, VIDEO_EXT, hasFfmpeg, hostReason, jobSlot } from '../_host';
import {
    TRIM_MODES, TRIM_MIN_SECONDS,
    type TrimMode, type TrimResult,
} from '@/lib/marketing/recorder';

/**
 * Cut a take down before anyone downloads it.
 *
 * The whole point is that this **never touches the source**. A cut writes a new
 * `-cut` file beside the original, picks a name that does not exist yet, and
 * refuses to run at all while a recording is in progress. So the worst outcome
 * of a mis-set in-point is a junk file you delete — never a lost take, which is
 * the one thing the studio cannot get back: the frame sequence a take was built
 * from is deleted the moment it is encoded.
 *
 * ## Why the cut can land somewhere you did not ask for
 *
 * A stream copy can only begin on a keyframe. Ask for 3.5s on a file whose
 * keyframes are two seconds apart and the copy starts at 2.0s, because there is
 * no way to hand a decoder the middle of a group of pictures. Rather than
 * silently returning a clip 1.5 seconds longer than requested — which is what
 * the naive `-ss … -c copy` does, and it also reports the wrong duration — this
 * finds the real keyframe first, cuts from *there*, and tells the studio the
 * in-point moved. `exact` re-encodes and lands on the frame asked for.
 *
 * ## The trust boundary
 *
 * Everything that reaches `spawn` is either a number that survived a range check
 * or a filename that was matched against the directory listing — never joined
 * onto a path, so `../../.env` does not resolve to anything that exists as far
 * as this route is concerned. The output name is derived here and never accepted
 * from the request, which is what makes "cannot overwrite" a property of the
 * code rather than a promise. `spawn` runs without a shell.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Cap the cut's wall clock. A re-encode of a two-minute take is ~20s. */
const FFMPEG_TIMEOUT_MS = 10 * 60_000;

/** How many `-cut`, `-cut2`, `-cut3`… names to try before giving up. */
const MAX_CUTS = 99;

// ------------------------------------------------------------------ ffmpeg

function runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
            stdio: ['ignore', 'ignore', 'pipe'],
        });
        let err = '';
        const timer = setTimeout(() => {
            p.kill();
            reject(new Error('ffmpeg took too long and was stopped.'));
        }, FFMPEG_TIMEOUT_MS);
        p.stderr.on('data', (d) => { err += d; });
        p.on('error', () => {
            clearTimeout(timer);
            reject(new Error('ffmpeg could not be started.'));
        });
        p.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0) resolve();
            // ffmpeg's own message is far more useful than a code, and it is
            // describing our arguments to our own files — nothing user-supplied
            // reaches it that has not already been validated.
            else reject(new Error(err.trim().split('\n').slice(-2).join(' ') || `ffmpeg exited ${code}`));
        });
    });
}

function ffprobe(args: string[]): Promise<string> {
    return new Promise((resolve) => {
        const p = spawn('ffprobe', ['-v', 'error', ...args], { stdio: ['ignore', 'pipe', 'ignore'] });
        let out = '';
        p.stdout.on('data', (d) => { out += d; });
        // Resolves empty rather than rejecting: every caller here treats "could
        // not measure" as a reason to fall back, not as a failed request. A box
        // with ffmpeg but no ffprobe can still make an exact cut.
        p.on('error', () => resolve(''));
        p.on('close', () => resolve(out));
    });
}

async function durationOf(file: string): Promise<number | null> {
    const raw = await ffprobe(['-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    const n = Number(raw.trim().split('\n')[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The last keyframe at or before `before`, which is where a copied cut can start.
 *
 * Reads packet flags rather than decoding — `-read_intervals` bounds it to the
 * head of the file, so this stays cheap on a long take. Falls back to 0, which
 * is always a keyframe and always safe: a cut that starts too early is a clip
 * with a little extra on the front, while a cut that starts on a mid-GOP packet
 * is a clip that opens on garbage.
 */
async function keyframeAtOrBefore(file: string, before: number): Promise<number> {
    if (before <= 0) return 0;
    const raw = await ffprobe([
        '-select_streams', 'v:0',
        '-show_entries', 'packet=pts_time,flags',
        '-of', 'csv=p=0',
        // A hair past the in-point, so a keyframe sitting exactly on it counts.
        '-read_intervals', `%+${(before + 0.05).toFixed(3)}`,
        file,
    ]);
    let best = 0;
    for (const line of raw.split('\n')) {
        const [time, flags] = line.trim().split(',');
        if (!flags?.startsWith('K')) continue;
        const t = Number(time);
        if (Number.isFinite(t) && t <= before + 1e-3 && t > best) best = t;
    }
    return best;
}

// ------------------------------------------------------------------ input

/**
 * Resolve a requested name to a real file in `marketing-out/`.
 *
 * Matched against the directory listing, the same way the file server and the
 * music picker do it. `path.basename` already strips traversal; comparing to
 * what is actually on disk means a crafted name cannot resolve outside this
 * folder even if some later refactor loosens the join.
 */
function resolveTake(raw: unknown): { base: string; file: string; ext: string } {
    if (typeof raw !== 'string' || !raw.trim()) throw new Error('Which recording?');
    const base = path.basename(raw);
    const ext = path.extname(base).toLowerCase();
    if (!VIDEO_EXT.has(ext)) throw new Error('That is not a video.');

    let listing: string[];
    try {
        listing = readdirSync(OUT_DIR);
    } catch {
        throw new Error('There are no recordings yet.');
    }
    if (!listing.includes(base)) throw new Error(`No such recording: ${base}`);
    return { base, file: path.join(OUT_DIR, base), ext };
}

/** `zeneva-pos-desktop-light.mp4` → the first free `…-cut.mp4`, `…-cut2.mp4`, … */
function freeCutName(base: string, ext: string): string {
    const stem = path.basename(base, ext);
    for (let i = 1; i <= MAX_CUTS; i++) {
        const name = `${stem}-cut${i === 1 ? '' : i}${ext}`;
        if (!existsSync(path.join(OUT_DIR, name))) return name;
    }
    throw new Error(`There are already ${MAX_CUTS} cuts of this take — delete some first.`);
}

const finite = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

// ------------------------------------------------------------------ sidecar

type Marks = {
    clicks?: unknown;
    keys?: unknown;
    zooms?: unknown;
    narration?: unknown;
    [key: string]: unknown;
};

/**
 * Re-time the marks sidecar onto the cut.
 *
 * Worth doing rather than dropping: the sidecar is the only record of when each
 * click, keystroke, camera move and spoken line happened, and it cannot be
 * recovered once the frame sequence is gone. Carrying it means a cut can still be
 * re-scored or re-narrated by `add-audio.mjs` with everything landing on the right
 * frames — without it, a trimmed take is a file you can never touch the audio of
 * again.
 *
 * A mark outside the window is dropped rather than clamped. Clamping would pile
 * every click from the discarded head onto frame zero, which sounds exactly like
 * the bug it would look like. Anything with a duration — a spoken line, a camera
 * move — is kept when the instant it *started* falls inside the cut: half a spoken
 * sentence is worse than none, and a zoom is already baked into the picture, so
 * the sidecar is only describing what the footage does.
 */
function retimeMarks(src: Marks, from: number, to: number, seconds: number, take: string): Marks {
    const inside = (t: number) => t >= from - 1e-6 && t <= to + 1e-6;
    const rebase = (t: number) => Math.max(0, Number((t - from).toFixed(3)));

    const times = (v: unknown): number[] => (Array.isArray(v) ? v : [])
        .map(Number)
        .filter((t) => Number.isFinite(t) && inside(t))
        .map(rebase);

    /** Marks that are objects carrying an `at`: narration lines, camera moves. */
    const stamped = (v: unknown, keep: (o: any) => boolean = () => true) => (Array.isArray(v) ? v : [])
        .filter((o: any) => o && typeof o === 'object'
            && Number.isFinite(Number(o.at)) && inside(Number(o.at)) && keep(o))
        // Spread first so every other field — a zoom's dur/from/to/px/py — survives
        // a cut untouched. Only the clock changes.
        .map((o: any) => ({ ...o, at: rebase(Number(o.at)) }));

    return {
        ...src,
        duration: Number(seconds.toFixed(3)),
        clicks: times(src.clicks),
        keys: times(src.keys),
        zooms: stamped(src.zooms),
        narration: stamped(src.narration, (o) => typeof o.text === 'string'),
        // Provenance, so a folder of cuts is still readable a month later.
        trimmedFrom: { name: take, start: Number(from.toFixed(3)), end: Number(to.toFixed(3)) },
    };
}

// ------------------------------------------------------------------ handlers

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    });
}

export async function POST(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    const reason = hostReason();
    if (reason) {
        return NextResponse.json({ error: reason }, { status: 409, headers: corsHeaders });
    }
    if (!(await hasFfmpeg())) {
        return NextResponse.json(
            { error: 'ffmpeg is not installed, so there is nothing to cut with.' },
            { status: 409, headers: corsHeaders },
        );
    }
    // Not because it would corrupt anything — a cut reads one finished file and
    // writes another — but because a take is encoding on this machine right now
    // and both of them want every core.
    if (jobSlot().job?.state === 'running') {
        return NextResponse.json(
            { error: 'A recording is running — let it finish, then cut.' },
            { status: 409, headers: corsHeaders },
        );
    }

    let source: { base: string; file: string; ext: string };
    let start: number;
    let end: number;
    let mode: TrimMode;
    try {
        const body = await req.json();
        source = resolveTake(body?.name);
        // A request that does not name a mode gets the one that does what its two
        // points say, matching the studio's default. Falling back to the cheap
        // copy would quietly move the in-point on a caller who never chose that.
        mode = TRIM_MODES.includes(body?.mode) ? body.mode : 'exact';

        const rawStart = finite(body?.start);
        const rawEnd = finite(body?.end);
        if (rawStart === null || rawEnd === null) throw new Error('Set an in-point and an out-point.');

        start = Math.max(0, rawStart);
        end = rawEnd;

        // Clamp to what the file actually is, when that is measurable. Asking for
        // 90s of a 40s take is a mis-read timeline, not a request to pad.
        const total = await durationOf(source.file);
        if (total !== null) {
            end = Math.min(end, total);
            if (start >= total) throw new Error('The in-point is past the end of this recording.');
        }
        if (end - start < TRIM_MIN_SECONDS) {
            throw new Error(`A cut has to be at least ${TRIM_MIN_SECONDS}s long.`);
        }
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || 'Invalid request.' },
            { status: 400, headers: corsHeaders },
        );
    }

    // Where the cut can actually begin. Only a copy is constrained.
    const cutFrom = mode === 'fast' ? await keyframeAtOrBefore(source.file, start) : start;
    const length = end - cutFrom;

    const outName = freeCutName(source.base, source.ext);
    const outFile = path.join(OUT_DIR, outName);
    const webm = source.ext === '.webm';

    // `-ss` before `-i` seeks the input, which is both fast and — when
    // re-encoding — frame-accurate. `-t` rather than `-to` because `-to` is
    // measured from the seek point in some versions and from zero in others;
    // a length has one meaning everywhere.
    const args = [
        '-ss', cutFrom.toFixed(3),
        '-i', source.file,
        '-t', length.toFixed(3),
        // Video and audio if there is any. A take that came out silent (nothing
        // to score, no music) has no audio stream at all, and `0:a?` is how that
        // stays a cut rather than an ffmpeg error.
        '-map', '0:v:0', '-map', '0:a?',
    ];
    if (mode === 'fast') {
        // make_zero rebases the copied timestamps to start at 0. Without it the
        // clip carries the source's original PTS and players open it on a stall.
        args.push('-c', 'copy', '-avoid_negative_ts', 'make_zero');
    } else if (webm) {
        args.push(
            '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-row-mt', '1',
            '-deadline', 'realtime', '-cpu-used', '4',
            '-c:a', 'libopus', '-b:a', '160k',
        );
    } else {
        // The same settings capture.mjs encodes takes with, so a re-encoded cut
        // and the take it came from are the same kind of file.
        args.push(
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-profile:v', 'high',
            '-c:a', 'aac', '-b:a', '192k',
        );
    }
    if (!webm) args.push('-movflags', '+faststart');
    args.push(outFile);

    try {
        await runFfmpeg(args);
    } catch (err: any) {
        return NextResponse.json(
            { error: `Could not cut this take: ${err?.message ?? 'unknown error'}` },
            { status: 500, headers: corsHeaders },
        );
    }

    if (!existsSync(outFile)) {
        return NextResponse.json(
            { error: 'ffmpeg reported success but wrote nothing.' },
            { status: 500, headers: corsHeaders },
        );
    }

    // Measured from the finished file, not from the request. A copied cut ends on
    // a packet boundary, so it runs a fraction longer than asked — reporting the
    // request back would be reporting a number we know to be slightly wrong.
    const stat = statSync(outFile);
    const seconds = (await durationOf(outFile)) ?? length;

    let marks = false;
    const srcMarks = `${source.file}.marks.json`;
    if (existsSync(srcMarks)) {
        try {
            const parsed = JSON.parse(readFileSync(srcMarks, 'utf8')) as Marks;
            writeFileSync(
                `${outFile}.marks.json`,
                JSON.stringify(retimeMarks(parsed, cutFrom, end, seconds, source.base), null, 2),
                'utf8',
            );
            marks = true;
        } catch {
            // A cut with no sidecar is still a cut. The only thing lost is the
            // ability to re-score *this* clip later, and saying so in the
            // response beats failing a video that was written correctly.
            marks = false;
        }
    }

    const result: TrimResult = {
        take: { name: outName, bytes: stat.size, modified: stat.mtimeMs },
        start: Number(cutFrom.toFixed(3)),
        end: Number(end.toFixed(3)),
        seconds: Number(seconds.toFixed(3)),
        mode,
        snappedFrom: Math.abs(cutFrom - start) > 0.01 ? Number(start.toFixed(3)) : null,
        marks,
    };
    return NextResponse.json(result, { headers: corsHeaders });
}
