'use client';

import { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { AlertTriangle, Info, Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import type { SystemBroadcast } from '@/types';

import { useRouter } from 'next/navigation';

export function GlobalAnnouncement() {
    const firestore = useFirestore();
    const router = useRouter();
    const [broadcast, setBroadcast] = useState<SystemBroadcast | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!firestore) return;

        const broadcastsRef = collection(firestore, 'system_broadcasts');
        // Query for active broadcasts, ordered by creation time (newest first)
        const q = query(
            broadcastsRef,
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data() as SystemBroadcast;
                // Check expiry client-side as well
                if (data.expiresAt && data.expiresAt.toDate() > new Date()) {
                    // Check if user has already dismissed this specific message in this session
                    // Check if user has already dismissed this specific message
                    const dismissedId = localStorage.getItem('dismissed_broadcast');
                    if (dismissedId !== snapshot.docs[0].id) {
                        setBroadcast({ ...data, id: snapshot.docs[0].id });
                        setIsVisible(true);
                    }
                } else {
                    setBroadcast(null);
                    setIsVisible(false);
                }
            } else {
                setBroadcast(null);
                setIsVisible(false);
            }
        });

        return () => unsubscribe();
    }, [firestore]);

    const handleDismiss = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        if (broadcast) {
            localStorage.setItem('dismissed_broadcast', broadcast.id);
        }
        setIsVisible(false);
    };

    const handleBannerClick = () => {
        if (broadcast?.link) {
            router.push(broadcast.link);
            handleDismiss();
        }
    };

    if (!broadcast || !isVisible) return null;

    const bgColors = {
        info: 'bg-blue-600',
        warning: 'bg-amber-600',
        alert: 'bg-destructive'
    };

    const icons = {
        info: Info,
        warning: AlertTriangle,
        alert: Bell
    };

    const Icon = icons[broadcast.type] || Info;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    onClick={handleBannerClick}
                    className={`fixed top-[var(--tauri-title-height,0)] left-0 right-0 z-[100] ${bgColors[broadcast.type] || 'bg-primary'} text-white shadow-lg ${broadcast.link ? 'cursor-pointer hover:brightness-105 active:brightness-95 transition-all' : ''}`}
                >
                    <div className="container mx-auto px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                <span className="font-bold whitespace-nowrap">{broadcast.title}</span>
                                <span className="hidden sm:inline opacity-70">|</span>
                                <span className="text-sm sm:text-base truncate">{broadcast.message}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {broadcast.link && (
                                <span className="hidden md:inline-block text-xs bg-white/20 px-2 py-1 rounded font-bold uppercase tracking-wider">
                                    Click to view
                                </span>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleDismiss}
                                className="text-white hover:bg-white/20 h-8 w-8 rounded-full"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
