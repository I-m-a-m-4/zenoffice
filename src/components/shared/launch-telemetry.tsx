'use client';

/**
 * Fires the anonymous funnel events. One mount, in the root layout.
 *
 * Deliberately mounted **outside** `<FirebaseClientProvider>`, unlike
 * `<UserActivityTracker />`. Two reasons:
 *
 * - It must not need a signed-in user. That is the entire population it measures.
 * - A broken Firebase client config is itself a candidate explanation for the
 *   lost signups — CLAUDE.md records a release where `NEXT_PUBLIC_*` secrets were
 *   declared per-step, so the nested Tauri rebuild inlined `undefined` and every
 *   correct password reported "Invalid email or password". Telemetry that lived
 *   inside the provider would have gone dark for exactly the build it needed to
 *   explain.
 *
 * The route stages come from watching `pathname` here rather than from a call in
 * each page, so /login, /signup and /welcome cannot silently stop reporting when
 * someone edits them. The pages only report what a pathname cannot know: which
 * button was pressed, and why an attempt failed.
 */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { markLaunched } from '@/lib/platform';
import {
  flushLaunchQueue,
  stageForPath,
  trackLaunchStage,
} from '@/lib/launch-telemetry';

export function LaunchTelemetry() {
  const pathname = usePathname();

  React.useEffect(() => {
    // Order matters and is safe in both directions: `trackLaunchStage` reads
    // `isFirstLaunchEver()` synchronously before its first await, and
    // `markLaunched()` primes that memo before it writes. Without the second
    // guarantee this effect — which runs before the root page's redirect effect,
    // being earlier in the tree — would flip the flag and send a genuine first
    // launch to /login instead of the carousel.
    void trackLaunchStage('app_opened');
    markLaunched();

    // Anything a previous launch could not deliver. Deliberately after the open
    // event, so the live session is reported first on a slow connection.
    void flushLaunchQueue();
  }, []);

  React.useEffect(() => {
    const stage = stageForPath(pathname);
    if (stage) void trackLaunchStage(stage);
  }, [pathname]);

  return null;
}
