import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import type { JobStatus } from '@/lib/marketing/recorder';

/**
 * What the recorder routes share about *this machine*.
 *
 * The recorder and the trimmer are both local developer tooling behind an HTTP
 * endpoint: they launch browsers and shell out to ffmpeg. Deciding "may this
 * host do that at all" therefore has to give the same answer in both places, and
 * a check that exists twice is a check that eventually disagrees with itself —
 * so it lives here once and each route adds only the tool it needs on top.
 *
 * Files under `src/app/api/**` are only routable when named `route.ts`, so a
 * leading-underscore module here is a plain import and not an endpoint.
 */

export const OUT_DIR = path.join(process.cwd(), 'marketing-out');
export const VIDEO_EXT = new Set(['.mp4', '.webm']);

/**
 * Why this machine may not run local tooling, or null if it may.
 *
 * Two independent gates, both deliberately blunt. A serverless host has no
 * browser, no ffmpeg and a read-only filesystem, so the answer there is never
 * "try it and see". A self-hosted production server is the one case where "not
 * serverless" and "not dev" are both true, and that is exactly the case where
 * someone should have to say out loud that this is their own machine.
 */
export function hostReason(): string | null {
    const serverless =
        process.env.VERCEL
        || process.env.AWS_LAMBDA_FUNCTION_NAME
        || process.env.NETLIFY
        || process.env.CF_PAGES
        || process.env.K_SERVICE;
    if (serverless) {
        return 'The recorder runs a real browser and ffmpeg, so it only works on a developer machine — not on the hosted deployment.';
    }
    if (process.env.NODE_ENV === 'production' && process.env.ZENEVA_RECORDER_ENABLE !== '1') {
        return 'This is a production build. Run `npm run dev` to use the recorder, or set ZENEVA_RECORDER_ENABLE=1 if this really is your own machine.';
    }
    return null;
}

export function hasFfmpeg(): Promise<boolean> {
    return new Promise((resolve) => {
        const p = spawn(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], {
            stdio: 'ignore',
        });
        p.on('error', () => resolve(false));
        p.on('exit', (code) => resolve(code === 0));
    });
}

/**
 * The running recorder, parked on `globalThis`.
 *
 * The dev server reloads modules on edit, which would otherwise orphan a running
 * child and lose the job state mid-recording. One accessor rather than the same
 * `??=` in each importer, because the *key* is the thing that has to match: two
 * spellings of it would be two jobs that cannot see each other, and the trimmer
 * would happily run ffmpeg in the middle of a take.
 */
export type JobSlot = { job: JobStatus | null; child: ChildProcess | null };

export function jobSlot(): JobSlot {
    return ((globalThis as any).__zenevaRecorderJob ??= { job: null, child: null });
}
