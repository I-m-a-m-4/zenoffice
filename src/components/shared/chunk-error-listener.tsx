'use client';

import { useEffect } from 'react';

export function ChunkErrorListener() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // 1. Standard Webpack/Next.js/ESM chunk error messages
      const msg = event.message || '';
      const errName = event.error?.name || '';
      if (
        msg.includes('ChunkLoadError') || 
        errName === 'ChunkLoadError' ||
        msg.includes('Loading chunk') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Refused to execute script')
      ) {
        if (!navigator.onLine) {
          console.warn('Chunk/Script load error detected while offline, ignoring to prevent reload loop.');
          return;
        }
        console.warn('Chunk/Script load error detected, reloading page to fetch latest version...');
        window.location.reload();
        return;
      }

      // 2. Capture failed script resource loads (e.g. 404, network errors, MIME type errors)
      const target = event.target as HTMLElement;
      if (target && target.tagName === 'SCRIPT') {
        const src = (target as HTMLScriptElement).src || '';
        if (src.includes('_next/static') || src.includes('chunks')) {
          if (!navigator.onLine) {
            console.warn('Next.js script chunk failed to load while offline:', src);
            return;
          }
          console.warn('Next.js script chunk failed to load:', src, 'reloading page to get latest assets...');
          window.location.reload();
        }
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reasonStr = String(event.reason || '');
      const reasonName = event.reason?.name || '';
      if (
        reasonName === 'ChunkLoadError' || 
        reasonStr.includes('ChunkLoadError') ||
        reasonStr.includes('Loading chunk') ||
        reasonStr.includes('Failed to fetch dynamically imported module')
      ) {
        if (!navigator.onLine) {
          console.warn('Unhandled ChunkLoadError rejection detected while offline, ignoring.');
          return;
        }
        console.warn('Unhandled ChunkLoadError rejection detected, reloading page...');
        window.location.reload();
      }
    };

    // Use capturing phase (true) to catch resource loading errors (like failed <script> tags)
    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
