'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PWAContextType {
    promptInstall: () => Promise<void>;
    isInstallable: boolean;
    isAppInstalled: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function PWAProvider({ children }: { children: ReactNode }) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isAppInstalled, setIsAppInstalled] = useState(false);

    useEffect(() => {
        // Check if app is already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone || document.referrer.includes('android-app://');
        setIsAppInstalled(isStandalone);

        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const promptInstall = async () => {
        if (!deferredPrompt) {
            console.log('No deferred prompt available');
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            try {
                const { doc, setDoc, increment } = await import('firebase/firestore');
                const { firestore } = await import('@/firebase');
                await setDoc(doc(firestore, 'platform', 'stats'), {
                    appInstalls: increment(1)
                }, { merge: true });
            } catch (err) {
                console.error("Failed to update install stats:", err);
            }
        }
    };

    return (
        <PWAContext.Provider value={{ promptInstall, isInstallable: !!deferredPrompt, isAppInstalled }}>
            {children}
        </PWAContext.Provider>
    );
}

export function usePWA() {
    const context = useContext(PWAContext);
    if (context === undefined) {
        throw new Error('usePWA must be used within a PWAProvider');
    }
    return context;
}
