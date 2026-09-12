'use client';

import { useEffect } from 'react';

/**
 * DesktopLauncher handles Tauri-specific body styling and system events.
 */
export function DesktopLauncher() {
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) return;

      // Mark as desktop environment
      document.body.classList.add('is-desktop');
      
      const updateBackground = () => {
        const root = document.documentElement;
        const body = document.body;
        
        // Get the actual computed HSL background from CSS variables
        const bgValue = getComputedStyle(root).getPropertyValue('--background').trim();
        
        if (bgValue) {
          const hslColor = `hsl(${bgValue})`;
          body.style.backgroundColor = hslColor;
          root.style.backgroundColor = hslColor;
          
          // Debugging log for Tauri console
          console.log(`[Zeneva Desktop] Syncing background: ${hslColor} (Theme: ${root.classList.contains('dark') ? 'Dark' : 'Light'})`);
        }
      };

      updateBackground();

      // Observe BOTH class changes (theme) and style changes
      const observer = new MutationObserver((mutations) => {
        updateBackground();
      });
      
      observer.observe(document.documentElement, { 
        attributes: true, 
        attributeFilter: ['class', 'style', 'data-theme'] 
      });

      return () => observer.disconnect();
    }
  }, []);

  return null;
}
