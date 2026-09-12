'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ExternalLink, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { DEFAULT_PROMO_CONFIG, THEME_STYLES } from '@/lib/promo-toast';
import { isTauriEnv } from '@/lib/native-notifications';
import type { PromoToastConfig } from '@/types';

export function PromoToastWindow() {
  const router = useRouter();
  const firestore = useFirestore();

  const [config, setConfig] = useState<PromoToastConfig>(DEFAULT_PROMO_CONFIG);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Check if promo should be visible based on settings and cooldown
  const evaluateVisibility = useCallback((currentConfig: PromoToastConfig) => {
    if (!currentConfig.enabled) {
      setIsVisible(false);
      return;
    }

    // Platform filtering
    if (currentConfig.targetPlatform === 'desktop' && !isTauriEnv()) {
      setIsVisible(false);
      return;
    }
    if (currentConfig.targetPlatform === 'web' && isTauriEnv()) {
      setIsVisible(false);
      return;
    }

    // Cooldown check
    if (typeof window !== 'undefined') {
      const storageKey = `zeneva_promo_dismissed_${currentConfig.id}`;
      const dismissedTimestamp = localStorage.getItem(storageKey);
      if (dismissedTimestamp) {
        const elapsedHours = (Date.now() - parseInt(dismissedTimestamp, 10)) / (1000 * 60 * 60);
        if (elapsedHours < (currentConfig.cooldownHours || 24)) {
          setIsVisible(false);
          return;
        }
      }
    }

    // Delay showing smoothly
    const delayMs = Math.max((currentConfig.autoShowDelaySec || 3) * 1000, 1000);
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, []);

  // Real-time listener to Firestore
  useEffect(() => {
    if (!firestore) return;

    const docRef = doc(firestore, 'platform_settings', 'promo_toast');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PromoToastConfig;
        setConfig(data);
        evaluateVisibility(data);
      }
    }, (err) => {
      console.warn('PromoToast listener notice:', err);
    });

    return () => unsubscribe();
  }, [firestore, evaluateVisibility]);

  // Listener for instant admin test triggers
  useEffect(() => {
    const handleTestTrigger = (event: Event) => {
      const customEvent = event as CustomEvent<PromoToastConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      }
      setIsVisible(true);
    };

    window.addEventListener('zeneva_trigger_promo_test', handleTestTrigger);
    return () => window.removeEventListener('zeneva_trigger_promo_test', handleTestTrigger);
  }, []);

  const handleDismiss = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setIsVisible(false);

    if (typeof window !== 'undefined' && config.id) {
      const storageKey = `zeneva_promo_dismissed_${config.id}`;
      localStorage.setItem(storageKey, Date.now().toString());
    }
  };

  const handleAction = () => {
    const url = (config.targetUrl || '').trim();
    handleDismiss();

    if (!url) return;

    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else {
      router.push(url);
    }
  };

  const currentTheme = THEME_STYLES[config.themeColor] || THEME_STYLES.blue;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 70, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`fixed bottom-5 right-5 z-[9999] pointer-events-auto max-w-[360px] sm:max-w-[380px] w-[calc(100vw-2.5rem)] rounded-2xl overflow-hidden backdrop-blur-xl bg-card/95 border ${currentTheme.glowBorder} shadow-2xl shadow-black/50 select-none group`}
        >
          {/* Subtle glowing ambient gradient behind */}
          <div className={`absolute -inset-1 bg-gradient-to-b ${currentTheme.headerGlow} opacity-70 pointer-events-none`} />

          {/* Floating Dismiss Button */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss offer"
            className="absolute top-2.5 right-2.5 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-md hover:bg-black/90 hover:text-white transition-all active:scale-90 shadow-md"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Poster Mode (Full Custom Graphic Artwork) */}
          {config.displayMode === 'poster' ? (
            <div 
              onClick={handleAction}
              className="relative cursor-pointer overflow-hidden group/poster"
            >
              {config.imageUrl ? (
                <img
                  src={config.imageUrl}
                  alt={config.title || 'Promotional Offer'}
                  className="w-full h-auto max-h-[360px] object-cover transition-transform duration-500 group-hover/poster:scale-[1.02]"
                />
              ) : (
                <div className="h-48 w-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  Custom Designed Graphic
                </div>
              )}

              {/* Hover Click Action Overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-8 flex items-center justify-between opacity-95 transition-opacity">
                <span className="text-xs font-bold text-white flex items-center gap-1.5 drop-shadow-md">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                  {config.buttonText || 'Claim Offer'}
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black shadow-md transition-transform group-hover/poster:translate-x-1">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ) : (
            /* Card Mode (Banner + Title + Copy + CTA Button) */
            <div className="relative flex flex-col">
              {/* Graphic Banner at Top */}
              {config.imageUrl && (
                <div 
                  onClick={handleAction}
                  className="relative h-36 w-full cursor-pointer overflow-hidden bg-muted/30"
                >
                  <img
                    src={config.imageUrl}
                    alt={config.title || 'Promotional Offer'}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/30 pointer-events-none" />
                </div>
              )}

              {/* Content Body */}
              <div className="p-4 pt-3.5 space-y-2.5">
                {/* Badge Row */}
                {config.badgeText && (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${currentTheme.badgeBg}`}>
                      <Sparkles className="h-3 w-3" />
                      {config.badgeText}
                    </span>
                  </div>
                )}

                {/* Title & Description */}
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base leading-snug text-foreground tracking-tight">
                    {config.title || 'Special Zeneva Offer'}
                  </h3>
                  {config.description && (
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {config.description}
                    </p>
                  )}
                </div>

                {/* Shiny CTA Button */}
                <div className="pt-1">
                  <button
                    onClick={handleAction}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${currentTheme.buttonClass}`}
                  >
                    <span>{config.buttonText || 'Get my OFFER'}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
