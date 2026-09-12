'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    try {
      const historyStr = sessionStorage.getItem('zeneva_recent_pages');
      let history: string[] = historyStr ? JSON.parse(historyStr) : [];

      // Only add if it's different from the last page
      if (history[history.length - 1] !== pathname) {
        history.push(pathname);
      }

      // Keep only the last 5 pages to avoid bloated storage
      if (history.length > 5) {
        history = history.slice(history.length - 5);
      }

      sessionStorage.setItem('zeneva_recent_pages', JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to save page history to sessionStorage', e);
    }
  }, [pathname]);

  return null;
}
