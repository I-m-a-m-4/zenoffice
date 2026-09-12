
'use client';

import * as React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { ConsoleGuard } from './console-guard';

import { flushOfflineErrors } from '@/lib/error-logger';

export function ClientSideInitializer() {
  const [isMounted, setIsMounted] = React.useState(false);
  
  React.useEffect(() => {
    setIsMounted(true);

    // next-pwa is disabled in dev, but it does not clean up after itself: a
    // `npm run build` leaves a production `public/sw.js` behind, and Next then
    // serves that file on the dev server. The worker precaches the *built*
    // app chunks, so localhost keeps serving stale code and source edits look
    // like they do nothing. That cost a debugging session once already - the
    // ai-insights page kept 401ing from a chunk built before the fix.
    //
    // Only unregister workers scoped to a script we know is the PWA one.
    // `firebase-messaging-sw.js` is registered on purpose by useFCM and must
    // survive, or push notifications break in dev.
    if (process.env.NODE_ENV === 'development' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(async (registrations) => {
          let killed = false;
          for (const registration of registrations) {
            const scriptURL =
              registration.active?.scriptURL ??
              registration.waiting?.scriptURL ??
              registration.installing?.scriptURL ??
              '';
            if (scriptURL.includes('firebase-messaging-sw.js')) continue;
            const ok = await registration.unregister();
            if (ok) {
              killed = true;
              console.warn(`[dev] Unregistered stale service worker (${scriptURL || 'unknown script'}).`);
            }
          }

          /*
           * Unregistering is not enough on its own. The worker's precached
           * responses live in Cache Storage, which outlives the registration —
           * so a reload can still be answered from a chunk built before your
           * edit, and the page looks like it reverted. Delete the workbox
           * caches too.
           *
           * `firebase-messaging-sw.js` keeps no precache, so nothing it relies
           * on is in these buckets.
           */
          if (typeof caches !== 'undefined') {
            const keys = await caches.keys();
            for (const key of keys) {
              if (/^(workbox|next-|start-url|apis|static-|image|audio|video|font|others|cross-origin)/i.test(key)) {
                await caches.delete(key);
                killed = true;
              }
            }
          }

          // An unregistered worker keeps controlling already-open pages until
          // they are reloaded, so say so rather than reloading here (an
          // automatic reload races with HMR and can loop).
          if (killed) {
            console.warn('[dev] Cleared stale PWA caches. Reload once to pick up your current source.');
          }
        })
        .catch((err) => console.warn('Failed to inspect service workers:', err));
    }

    // Flush any cached errors queued while offline/failed
    flushOfflineErrors().catch((err) => console.warn('Failed to flush offline errors:', err));

    // Zeneva Console Branding
    // Note: Important errors are NOT suppressed. Only non-critical tracker and network noise is silenced.
    console.log(
      `%c\n ███████  ███████  ██   ██  ███████  ██   ██   █████ \n    ███   ███      ███  ██  ███      ██   ██  ██   ██\n   ███    ███████  ████ ██  ███████   ██ ██   ███████\n  ███     ███      ██ ████  ███        ███    ██   ██\n ███████  ███████  ██   ██  ███████     █     ██   ██\n\n %c NEVER LOSE A SALE, NEVER WASTE A STOCK FOR ZENEVA %c \n`,
      "color: #F97316; font-weight: bold; font-family: monospace;",
      "background: #F97316; color: white; padding: 4px 8px; font-weight: bold; border-radius: 4px;",
      "color: inherit;"
    );
  }, []);

  if (!isMounted) return <ConsoleGuard />;

  const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

  return (
    <>
      {!isTauri && <Analytics />}
      <ConsoleGuard />
    </>
  );
}
