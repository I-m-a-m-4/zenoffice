'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Zap, Volume2, Maximize2, MoreVertical, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AppConfig } from '@/lib/config';

export interface FeatureUpdate {
  id: string;
  title: string;
  badge?: string;
  description: string;
  videoUrl?: string; // YouTube link, mp4, or webm
  changelogLink?: string;
  actionText?: string;
  actionHref?: string;
  releaseVersion?: string;
  isActive?: boolean;
  imageUrl?: string;
}

const DEFAULT_LATEST_UPDATE: FeatureUpdate = {
  id: 'release_bulk_image_fetch',
  title: 'Bulk AI Image Fetch is Here!',
  badge: 'New Feature',
  description:
    'Imported products via CSV with missing images? Zen AI can now automatically search and fetch images for multiple products at once! Head to your inventory, click "Fetch Images", and let AI do the heavy lifting.',
  videoUrl: '',
  imageUrl: '/images/bulk-image-promo.png',
  changelogLink: '/notifications',
  actionText: 'Try it now',
  actionHref: '/inventory',
  releaseVersion: '3.3.2',
  isActive: true,
};

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const watchMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (watchMatch && watchMatch[1]) {
      return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&mute=0&rel=0&modestbranding=1`;
    }
  } catch {}
  return null;
}

export function FeatureUpdateModal() {
  const firestore = useFirestore();
  const router = useRouter();

  const [update, setUpdate] = React.useState<FeatureUpdate>(DEFAULT_LATEST_UPDATE);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [progress, setProgress] = React.useState(28);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Demo progress timer for visual aesthetic when no live video is loaded
  React.useEffect(() => {
    if (!isOpen || !isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 1.2));
    }, 200);
    return () => clearInterval(interval);
  }, [isOpen, isPlaying]);

  // Listen for active feature releases in Firestore
  React.useEffect(() => {
    if (!firestore) return;

    try {
      const q = query(
        collection(firestore, 'feature_updates'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data() as any;
          const activeUpdate: FeatureUpdate = {
            id: snapshot.docs[0].id,
            title: docData.title || DEFAULT_LATEST_UPDATE.title,
            badge: docData.badge || DEFAULT_LATEST_UPDATE.badge,
            description: docData.description || DEFAULT_LATEST_UPDATE.description,
            videoUrl: docData.videoUrl || '',
            changelogLink: docData.changelogLink || '/notifications',
            actionText: docData.actionText || 'Got it',
            actionHref: docData.actionHref || '',
            releaseVersion: docData.releaseVersion || '3.2.10',
            imageUrl: docData.imageUrl || '',
            isActive: true,
          };
          setUpdate(activeUpdate);
          checkAndShow(activeUpdate.id);
        } else {
          setUpdate(DEFAULT_LATEST_UPDATE);
          checkAndShow(DEFAULT_LATEST_UPDATE.id);
        }
      }, () => {
        checkAndShow(DEFAULT_LATEST_UPDATE.id);
      });

      return () => unsubscribe();
    } catch {
      checkAndShow(DEFAULT_LATEST_UPDATE.id);
    }
  }, [firestore]);

  const checkAndShow = (updateId: string) => {
    if (typeof window === 'undefined') return;
    const dismissed = localStorage.getItem(`dismissed_update_${updateId}`);
    if (!dismissed) {
      // Mark as shown immediately so it NEVER pops up a second time on reload/navigation
      localStorage.setItem(`dismissed_update_${updateId}`, 'true');
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined' && update?.id) {
      localStorage.setItem(`dismissed_update_${update.id}`, 'true');
    }
    setIsOpen(false);
  };

  const handleAction = () => {
    handleDismiss();
    if (update.actionHref && update.actionText !== 'Got it') {
      if (update.actionHref.startsWith('http://') || update.actionHref.startsWith('https://')) {
        window.open(update.actionHref, '_blank', 'noopener,noreferrer');
      } else {
        router.push(update.actionHref);
      }
    }
  };

  if (!isClient) return null;

  const youtubeEmbed = update.videoUrl ? getYouTubeEmbedUrl(update.videoUrl) : null;
  const isDirectVideo = update.videoUrl && !youtubeEmbed && (update.videoUrl.endsWith('.mp4') || update.videoUrl.endsWith('.webm'));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          {/* Subtle Dimmed Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative z-10 w-full max-w-[520px] bg-white text-zinc-900 rounded-3xl border border-zinc-200/80 shadow-[0_25px_70px_rgba(0,0,0,0.22)] overflow-hidden flex flex-col"
          >
            {/* Circular Close Button Top Right */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-3.5 right-3.5 z-30 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all shadow-md backdrop-blur-xs cursor-pointer"
              title="Close"
            >
              <X className="h-4 w-4 stroke-[2.5]" />
            </button>

            {/* Top Media / Showcase Area */}
            <div className="relative w-full aspect-[16/10] bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-white flex flex-col justify-between overflow-hidden border-b border-zinc-800 select-none">
              {youtubeEmbed ? (
                <iframe
                  src={youtubeEmbed}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={update.title}
                />
              ) : isDirectVideo ? (
                <video
                  src={update.videoUrl}
                  controls
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : update.imageUrl ? (
                <img
                  src={update.imageUrl}
                  alt={update.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Rich Animated Showcase Canvas in Zeneva Signature Warm Orange */
                <div className="relative w-full h-full flex flex-col justify-center items-center px-6 text-center overflow-hidden">
                  {/* Ambient Glowing Background Orbs in Warm Orange & Amber */}
                  <motion.div
                    animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.65, 0.35] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -top-12 -left-12 w-48 h-48 bg-orange-500/30 rounded-full blur-3xl pointer-events-none"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.25, 0.55, 0.25] }}
                    transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                    className="absolute -bottom-12 -right-12 w-56 h-56 bg-amber-500/25 rounded-full blur-3xl pointer-events-none"
                  />

                  {/* Faded Background Typography Watermark */}
                  <div className="absolute inset-0 flex flex-col justify-center items-center opacity-[0.05] pointer-events-none select-none font-black text-5xl sm:text-6xl tracking-tighter text-white leading-tight uppercase">
                    <span>Zeneva</span>
                    <span>Zen AI</span>
                    <span>Bulk Images</span>
                  </div>

                  {/* Hero Animated Content */}
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    {/* Zeneva Brand Badge with Logo */}
                    <motion.div
                      initial={{ scale: 0.85, opacity: 0, y: 8 }}
                      animate={{ scale: 1, opacity: 1, y: [0, -4, 0] }}
                      transition={{
                        scale: { duration: 0.4 },
                        opacity: { duration: 0.4 },
                        y: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
                      }}
                      className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-500/20 border border-orange-400/35 text-orange-300 shadow-md backdrop-blur-md"
                    >
                      <img src={AppConfig.logoIconUrl} alt="Zeneva" className="h-4 w-4" />
                      <span className="text-xs font-semibold tracking-wide">
                        {update.badge || 'v3.3.0 Update'}
                      </span>
                    </motion.div>

                    {/* Title Text (Without 'Introducing') */}
                    <motion.h2
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                      className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-white max-w-[420px] leading-snug"
                    >
                      {update.title.replace(/^introducing\s+/i, '')}
                    </motion.h2>

                    {/* Feature Pills */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                      className="flex flex-wrap justify-center items-center gap-2 mt-1 text-[11px] text-zinc-300"
                    >
                      <span className="px-2.5 py-0.5 rounded-md bg-white/10 border border-white/10 backdrop-blur-xs font-medium">📱 Phone & Tablet</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-white/10 border border-white/10 backdrop-blur-xs font-medium">⚡ Real-time Sync</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-white/10 border border-white/10 backdrop-blur-xs font-medium">🤖 Zen AI</span>
                    </motion.div>
                  </div>

                  {/* Bottom Accent Shimmer Line in Signature Orange */}
                  <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-80" />
                </div>
              )}
            </div>

            {/* Lower Content Area */}
            <div className="p-6 sm:p-7 bg-white flex flex-col gap-3">
              <h3 className="text-xl sm:text-[22px] font-bold text-zinc-900 tracking-tight">
                {update.title}
              </h3>
              
              <p className="text-sm text-zinc-600 leading-relaxed font-normal">
                {update.description}
              </p>

              {/* Footer Row */}
              <div className="flex items-center justify-between pt-5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleDismiss();
                    router.push(update.changelogLink || '/notifications');
                  }}
                  className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                >
                  See all updates
                </button>

                <Button
                  onClick={handleAction}
                  className="bg-[#18181b] hover:bg-black text-white font-medium text-xs h-9 px-6 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {update.actionText || 'Got it'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
