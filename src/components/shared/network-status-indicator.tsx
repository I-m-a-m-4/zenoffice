'use client';

import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePOS } from '@/context/pos-context';

export default function NetworkStatusIndicator() {
  const { isOnline } = usePOS();
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerType, setBannerType] = useState<'offline' | 'online' | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);
  const isMounted = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const triggerBanner = (type: 'online' | 'offline', duration: number) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setBannerType(type);
      setBannerVisible(true);
      timeoutRef.current = setTimeout(() => setBannerVisible(false), duration);
    };

    if (!isMounted.current) {
      // On initial boot, only trigger visible banners if starting disconnected
      isMounted.current = true;
      if (!isOnline) {
        triggerBanner('offline', 6000);
      }
      return;
    }

    // Transition banner: Triggers exactly when WAN connectivity status flips
    if (isOnline) {
      triggerBanner('online', 5000);
    } else {
      triggerBanner('offline', 6000);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOnline, mounted]);

  if (!mounted) return null;

  return (
    <>
      {/* 1. Desktop-Only static minimal flag indicator */}
      {!isOnline && (
        <div className="hidden md:flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-amber-600 no-print cursor-default select-none text-xs font-extrabold tracking-wide uppercase">
          <WifiOff className="h-3.5 w-3.5" /> Offline
        </div>
      )}

    </>
  );
}
