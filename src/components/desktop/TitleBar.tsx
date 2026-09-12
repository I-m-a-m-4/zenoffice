'use client';

import React, { useEffect, useState } from 'react';
import { X, Minus, Square, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppConfig } from '@/lib/config';
import { CachedImage } from '@/components/shared/cached-image';
import { usePOS } from '@/context/pos-context';

export function DesktopTitleBar() {
  const { business } = usePOS();
  const [isTauri, setIsTauri] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  
  const displayLogo = business?.settings?.logoUrl || AppConfig.logoIconUrl;

  useEffect(() => {
    // Check if we are in Tauri or Web
    const checkTauri = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        if (getCurrentWindow()) {
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          if (isMobile) {
            setIsTauri(false);
            return;
          }
          setIsTauri(true);
          const win = getCurrentWindow();
          setIsMaximized(await win.isMaximized());
        }
      } catch {
        // Not in Tauri
        setIsTauri(false);
      }
    };

    checkTauri();
    
    // Listen for resize to update maximized state
    window.addEventListener('resize', () => {
       import('@tauri-apps/api/window').then(m => m.getCurrentWindow().isMaximized().then(setIsMaximized)).catch(() => {});
    });
  }, []);

  if (!isTauri) return null;

  const handleMinimize = async () => {
    if (!isTauri) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.minimize();
    } catch (err) {
      console.error('Minimize failed:', err);
    }
  };

  const handleMaximize = async () => {
    if (!isTauri) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.toggleMaximize();
    } catch (err) {
      console.error('Maximize toggle failed:', err);
    }
  };

  const handleClose = async () => {
    if (!isTauri) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      // Trigger the native close request — Rust intercepts this to hide to tray
      await win.close();
    } catch (err) {
      console.error('Close failed:', err);
    }
  };

  return (
    <div 
      data-tauri-drag-region
      className="h-9 w-full bg-background border-b border-border/40 flex items-center justify-between select-none fixed top-0 left-0 z-[9999] no-print"
    >
      <div className="flex items-center gap-2.5 px-4" data-tauri-drag-region>
         {/* Premium Logo Container */}
         <div className="h-6 w-6 relative">
            <div className="absolute inset-0 bg-primary/20 rounded-lg blur-[2px] animate-pulse"></div>
            <CachedImage src={displayLogo} alt="Zeneva" className="h-6 w-6 relative z-10 drop-shadow-sm" />
         </div>
         <div className="flex flex-col" data-tauri-drag-region>
            <span className="text-[10px] font-black tracking-[0.25em] text-primary/90 leading-none">ZENEVA</span>
            <div className="flex items-center gap-1.5 mt-0.5">
               <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-widest leading-none">Desktop v{AppConfig.version}</span>
               <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
         </div>
      </div>

      <div data-tauri-drag-region className="flex-1 h-full cursor-default" />

      <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button 
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center hover:bg-muted/80 transition-all active:scale-95"
          title="Minimize"
        >
          <Minus className="h-3.5 w-3.5 text-muted-foreground/80" />
        </button>
        <button 
          onClick={handleMaximize}
          className="h-full w-12 flex items-center justify-center hover:bg-muted/80 transition-all active:scale-95"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Copy className="h-3 w-3 text-muted-foreground/80 -rotate-90" />
          ) : (
            <Square className="h-3 w-3 text-muted-foreground/80" />
          )}
        </button>
        <button 
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center hover:bg-destructive hover:text-white transition-all active:scale-95 group"
          title="Close to Tray"
        >
          <X className="h-4 w-4 text-muted-foreground/80 group-hover:text-white" />
        </button>
      </div>
    </div>
  );
}
