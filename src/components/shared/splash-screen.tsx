'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppConfig } from '@/lib/config';

export function SplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [isTauri, setIsTauri] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Robust check for Tauri environment
    const isTauriEnv = typeof window !== 'undefined' && (
      (window as any).__TAURI__ || 
      (window as any).__TAURI_INTERNALS__ || 
      (window as any).__TAURI_METADATA__ || 
      (typeof (window as any).rpc !== 'undefined')
    );
    setIsTauri(!!isTauriEnv);

    // Only run if not already shown in this session
    const hasBeenShown = sessionStorage.getItem('zeneva_splash_shown');
    if (hasBeenShown) {
      setIsFinished(true);
      return;
    }

    // Only run the loading simulation if in Tauri
    if (isTauriEnv) {
      const duration = 800;
      const interval = 15;
      const step = 100 / (duration / interval);

      const timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            sessionStorage.setItem('zeneva_splash_shown', 'true');
            setTimeout(() => setIsFinished(true), 300);
            return 100;
          }
          return prev + step;
        });
      }, interval);

      return () => clearInterval(timer);
    } else {
      setIsFinished(true);
    }
  }, []);

  if (!mounted || !isTauri) return null;

  return (
    <AnimatePresence>
      {!isFinished && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#131110] overflow-hidden"
        >
          <div className="relative flex flex-col items-center w-full max-w-[320px]">
            {/* Full Logo Container */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mb-6"
            >
              <img 
                src={AppConfig.logoUrl} 
                alt="Zeneva Logo" 
                className="w-64 h-auto object-contain grayscale brightness-0 invert opacity-90"
              />
            </motion.div>

            {/* Ultra-minimalist progress bar */}
            <div className="w-full h-[1px] bg-white/5 relative overflow-hidden">
              <motion.div 
                className="absolute inset-y-0 left-0 bg-white/40"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "linear" }}
              />
            </div>
          </div>
          
        </motion.div>
      )}
    </AnimatePresence>
  );
}
