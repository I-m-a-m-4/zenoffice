import { NextResponse } from 'next/server';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { requireSuperAdmin, corsHeaders } from '../../../_guard';

/**
 * The newest frame of the take in progress, as a JPEG.
 *
 * This is the picture behind the studio's live view. The recorder mirrors every
 * few screencast frames here (`Recorder.#writePreview`), writing to a temp name
 * and renaming, so what this reads is always a whole image rather than a
 * half-flushed one.
 *
 * Served as its own route rather than base64 inside the status poll: the status
 * is polled several times a second and is a few hundred bytes, while a 1080p
 * frame is a couple of hundred KB. Inlining it would make every status request
 * as expensive as the image, and would defeat `If-None-Match` — with a separate
 * route, a frame that has not changed costs a 304 and no body at all.
 *
 * Bearer-authenticated like the rest of `/api/admin`, which is why the studio
 * fetches it and builds an object URL instead of pointing an `<img src>` at it:
 * an `<img>` tag cannot send an Authorization header.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FRAME_FILE = path.join(process.cwd(), 'marketing-out', '.live', 'live.jpg');

export async function OPTIONS() {
    return NextResponse.json({}, { headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

export async function GET(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    if (!existsSync(FRAME_FILE)) {
        return NextResponse.json(
            { error: 'No frame yet.' },
            { status: 404, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } },
        );
    }

    let bytes: Buffer;
    let mtime: number;
    try {
        mtime = statSync(FRAME_FILE).mtimeMs;
        bytes = readFileSync(FRAME_FILE);
    } catch {
        // Read raced the recorder's rename. The poll after this one gets it.
        return NextResponse.json(
            { error: 'Frame is being written.' },
            { status: 503, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } },
        );
    }

    // mtime is a sufficient validator here: the file is replaced wholesale by a
    // rename, never appended to, so a changed picture always has a changed mtime.
    const etag = `W/"${Math.round(mtime)}-${bytes.length}"`;
    if (req.headers.get('if-none-match') === etag) {
        return new NextResponse(null, {
            status: 304,
            headers: { ...corsHeaders, ETag: etag, 'Cache-Control': 'no-store' },
        });
    }

    return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
            ...corsHeaders,
            'Content-Type': 'image/jpeg',
            'Content-Length': String(bytes.length),
            'Cache-Control': 'no-store',
            ETag: etag,
        },
    });
}
