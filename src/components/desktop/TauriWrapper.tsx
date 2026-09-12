'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Routes that own the top inset, so the wrapper must not paint it.
 *
 * The `h-9` spacer below exists for the **desktop** custom title bar, but
 * `__TAURI_INTERNALS__` is present on Android and iOS too, so the mobile shells get
 * it as well — and there it lands exactly where the OS status bar sits. That is
 * harmless (36px is about a status bar tall, so it doubles as the inset that keeps
 * a page's top row clear of the clock) right up until the page behind it is dark:
 * the spacer is transparent, the wrapper is `bg-background`, and on `/welcome` that
 * put a warm-white band across the top of a full-bleed dark video. The status bar
 * icons are drawn by Android from the *system* theme, so a shop running the app in
 * light mode with the phone in dark mode gets white icons on that white band —
 * invisible.
 *
 * So a route listed here keeps the spacer (removing it would slide the logo under
 * the clock) and gets a black wrapper instead of the app background. It is a list
 * rather than a prop because the wrapper is mounted once in the root layout, above
 * every route group.
 *
 * Note this is the *only* lever that works in the Tauri Android shell: the WebView
 * ignores `<meta name="theme-color">`, which is why the imperative one in
 * `welcome/page.tsx` never moved this band — that meta is for the browser and the
 * PWA, where there is no spacer to begin with.
 */
const DARK_TOP_INSET_ROUTES = new Set(['/welcome']);

export function TauriLayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isTauri, setIsTauri] = useState(false);
  const pathname = usePathname();
  const darkTopInset = DARK_TOP_INSET_ROUTES.has(pathname ?? '');

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      setIsTauri(true);
    }
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col",
        darkTopInset ? "bg-black text-white" : "bg-background text-foreground",
        isTauri ? "h-screen overflow-hidden" : "min-h-screen"
      )}
      style={{ '--tauri-title-height': isTauri ? '2.25rem' : '0px' } as React.CSSProperties}
    >
      {/* Spacer for Tauri TitleBar (h-9 = 2.25rem) */}
      {isTauri && <div className="h-9 w-full shrink-0" />}
      <div className={cn(
        "flex-1 flex flex-col relative h-full",
        isTauri && "min-h-0"
      )}>
        {children}
      </div>
    </div>
  );
}
