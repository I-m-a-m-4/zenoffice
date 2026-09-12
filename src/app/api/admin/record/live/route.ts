import { NextResponse } from 'next/server';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { requireSuperAdmin, corsHeaders } from '../../_guard';
import { LIVE_STALE_MS, type LiveResponse, type LiveStatus } from '@/lib/marketing/recorder';

/**
 * The studio's window into a take that is already running.
 *
 * The recorder is a **child process**, not a module — once `POST /api/admin/record`
 * has spawned it there is no function call between the two, so neither "what is it
 * doing right now" nor "pause" can be answered in memory. Both travel through two
 * small files in `marketing-out/.live/`, written by `scripts/record/control.mjs`:
 *
 *   live.json     recorder writes  ->  GET  reads     (phase, current step, paused)
 *   live.jpg      recorder writes  ->  the sibling frame route serves it
 *   control.json  POST writes      ->  recorder polls (pause / resume / abort)
 *
 * Files rather than a socket because the dev server hot-reloads on every edit: an
 * in-memory channel would be severed mid-recording by a save, and a port would
 * need cleanup that a crashed take never gets to do. A file survives both.
 *
 * This route deliberately duplicates the tiny read/write helpers from
 * `control.mjs` instead of importing them. `scripts/record/` is a standalone CLI
 * with no path into `src/`, and importing across that line in either direction is
 * what would make the recorder undeletable.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LIVE_DIR = path.join(process.cwd(), 'marketing-out', '.live');
const STATUS_FILE = path.join(LIVE_DIR, 'live.json');
const CONTROL_FILE = path.join(LIVE_DIR, 'control.json');
const FRAME_FILE = path.join(LIVE_DIR, 'live.jpg');

const ACTIONS = ['pause', 'resume', 'abort'] as const;
type Action = (typeof ACTIONS)[number];

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
    });
}

/**
 * Read the recorder's published status, or null if there isn't a usable one.
 *
 * Returns null for a *stale* file as well as a missing one. The recorder
 * republishes on every checkpoint, so a status older than `LIVE_STALE_MS` means
 * the process died without the chance to write a final state — and a studio that
 * trusted the file would sit showing "recording" over a frozen frame forever.
 */
function readStatus(): LiveStatus | null {
    try {
        if (!existsSync(STATUS_FILE)) return null;
        const parsed = JSON.parse(readFileSync(STATUS_FILE, 'utf8')) as LiveStatus;
        if (typeof parsed?.at !== 'number') return null;
        // Terminal states are kept regardless of age: "this is how the last take
        // ended" is exactly what the studio wants to show once it is over.
        if (parsed.phase === 'done' || parsed.phase === 'failed') return parsed;
        return Date.now() - parsed.at > LIVE_STALE_MS ? null : parsed;
    } catch {
        // A torn read is possible if we opened the file mid-rename. The next poll
        // gets a clean one; a missed frame of status is not worth reporting.
        return null;
    }
}

export async function GET(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    const live = readStatus();
    let frameAge: number | null = null;
    try {
        if (existsSync(FRAME_FILE)) frameAge = Date.now() - statSync(FRAME_FILE).mtimeMs;
    } catch {
        frameAge = null;
    }

    const body: LiveResponse = {
        live,
        frameAge,
        running: !!live && live.phase !== 'done' && live.phase !== 'failed',
    };
    return NextResponse.json(body, {
        headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
    });
}

/**
 * Ask the running take to pause, resume, or stop at the next safe point.
 *
 * "Next safe point" is the recorder's choice, not this route's: the gate is
 * checked *between* actions, never inside one, because pausing halfway through a
 * click would leave the mouse button down and the overlay's halo lit — a state
 * the app was never asked to handle and cannot be resumed from cleanly.
 *
 * Writing a control file for a run that is not happening is harmless: the file is
 * cleared at the start of every take, so a stale pause cannot freeze the next one.
 */
export async function POST(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    let action: Action;
    try {
        const body = await req.json();
        if (!ACTIONS.includes(body?.action)) throw new Error('unknown action');
        action = body.action;
    } catch {
        return NextResponse.json(
            { error: `Action must be one of: ${ACTIONS.join(', ')}.` },
            { status: 400, headers: corsHeaders },
        );
    }

    const patch =
        action === 'pause' ? { paused: true }
            : action === 'resume' ? { paused: false }
                : { abort: true };

    try {
        mkdirSync(LIVE_DIR, { recursive: true });
        const current = existsSync(CONTROL_FILE)
            ? JSON.parse(readFileSync(CONTROL_FILE, 'utf8'))
            : {};
        // Temp-then-rename, because rename is atomic and the recorder polls this
        // on its own schedule — a plain write it happened to read mid-flight
        // would parse as nothing and be treated as "carry on".
        const tmp = `${CONTROL_FILE}.tmp`;
        writeFileSync(tmp, JSON.stringify({ ...current, ...patch, at: Date.now() }), 'utf8');
        renameSync(tmp, CONTROL_FILE);
    } catch (err: any) {
        return NextResponse.json(
            { error: `Could not reach the recorder: ${err?.message ?? 'unknown error'}` },
            { status: 500, headers: corsHeaders },
        );
    }

    return NextResponse.json({ ok: true, action, live: readStatus() }, { headers: corsHeaders });
}
