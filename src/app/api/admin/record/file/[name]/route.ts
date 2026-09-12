import { NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { requireSuperAdmin, corsHeaders } from '../../../_guard';

/**
 * Serves a finished recording out of `marketing-out/` so the studio can preview
 * and download it. That folder is gitignored and outside `public/`, which is
 * deliberate — marketing takes contain whatever the demo account can see, and
 * dropping them in `public/` would publish every one of them at a guessable URL
 * the moment the app deploys.
 *
 * Super-admin only, same as the rest of `/api/admin`. Range requests are
 * answered so `<video>` can seek: without a 206 the element has to buffer the
 * whole file before it can jump, and a 90-second 1080p take is tens of MB.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OUT_DIR = path.join(process.cwd(), 'marketing-out');
const TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.webm': 'video/webm' };

export async function OPTIONS() {
    return NextResponse.json({}, { headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ name: string }> },
) {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return auth.res;

    const { name: raw } = await params;
    const ext = path.extname(raw).toLowerCase();
    if (!TYPES[ext]) {
        return NextResponse.json({ error: 'Not a video.' }, { status: 400, headers: corsHeaders });
    }

    // Match against the directory listing rather than joining the request onto
    // the path. `path.basename` already strips traversal, but comparing to what
    // is actually there means a crafted name cannot resolve to a file outside
    // this folder even if some future refactor loosens the join.
    const base = path.basename(decodeURIComponent(raw));
    let listing: string[];
    try {
        listing = await readdir(OUT_DIR);
    } catch {
        return NextResponse.json({ error: 'No recordings yet.' }, { status: 404, headers: corsHeaders });
    }
    if (!listing.includes(base)) {
        return NextResponse.json({ error: 'No such recording.' }, { status: 404, headers: corsHeaders });
    }

    const file = path.join(OUT_DIR, base);
    if (!existsSync(file)) {
        return NextResponse.json({ error: 'No such recording.' }, { status: 404, headers: corsHeaders });
    }
    const size = statSync(file).size;
    const type = TYPES[ext];

    const headers: Record<string, string> = {
        ...corsHeaders,
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
    };
    if (new URL(req.url).searchParams.get('download') === '1') {
        headers['Content-Disposition'] = `attachment; filename="${base}"`;
    }

    const range = req.headers.get('range');
    const match = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
    if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
        if (!Number.isFinite(start) || start >= size || start > end) {
            return new NextResponse(null, {
                status: 416,
                headers: { ...headers, 'Content-Range': `bytes */${size}` },
            });
        }
        const stream = createReadStream(file, { start, end });
        return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
            status: 206,
            headers: {
                ...headers,
                'Content-Range': `bytes ${start}-${end}/${size}`,
                'Content-Length': String(end - start + 1),
            },
        });
    }

    return new NextResponse(Readable.toWeb(createReadStream(file)) as ReadableStream, {
        status: 200,
        headers: { ...headers, 'Content-Length': String(size) },
    });
}
