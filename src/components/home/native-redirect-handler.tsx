'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isTauriEnv } from '@/lib/native-notifications';
import { useUser } from '@/firebase';

export function NativeRedirectHandler() {
    const router = useRouter();
    const { user, isUserLoading } = useUser();

    useEffect(() => {
        if (isUserLoading) return;

        // If this app is running in a Tauri or native mobile environment,
        // bypass the marketing homepage and go straight to the signup/login flow.
        const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTauriProtocol = typeof window !== 'undefined' && (window.location.protocol === 'tauri:' || window.location.href.includes('tauri.localhost') || window.location.protocol === 'asset:');
        const isNative = isTauriEnv() || isTauriProtocol || (isMobile && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone));
        
        if (user) {
            // Always redirect logged-in users to the dashboard (standard SaaS behavior)
            router.replace('/dashboard');
        } else if (isNative) {
            // Not logged in, but running in the native Desktop/Mobile app
            router.replace('/signup');
        }
    }, [router, user, isUserLoading]);

    return null;
}
