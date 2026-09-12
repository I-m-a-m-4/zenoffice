'use client';

import { useState, useEffect } from 'react';

/**
 * Defer rendering of heavy or complex components on mobile devices by a short delay.
 * This allows the layout page container to mount immediately on mobile screen transitions,
 * preventing layout stutter or navigation lag.
 */
export function useDeferredMobileRender(delay = 100) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setShouldRender(true);
      return;
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);

    if (!isMobile) {
      setShouldRender(true);
      return;
    }

    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return shouldRender;
}
