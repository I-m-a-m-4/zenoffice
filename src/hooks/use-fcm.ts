'use client';

import { useEffect, useState } from 'react';
import { initializeMessaging } from '@/firebase/messaging';
import { getToken, onMessage } from 'firebase/messaging';
import { usePOS } from '@/context/pos-context';
import { useFirestore } from '@/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { updateChannel, isNativeApp } from '@/lib/platform';

export function useFCM() {
    const { user } = usePOS();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = async (showToast = true) => {
        setIsLoading(true);
        try {
            if (typeof window === 'undefined' || !('Notification' in window)) {
                if (showToast) toast({ title: "Not Supported", description: "This browser does not support notifications." });
                return;
            }

            const newPermission = await Notification.requestPermission();
            setPermission(newPermission);

            if (newPermission === 'granted') {
                const messaging = await initializeMessaging();
                if (!messaging) {
                    throw new Error("Messaging not initialized");
                }

                // TODO: User needs to provide VAPID Key in env
                const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

                if (!vapidKey) {
                    console.warn("VAPID Key is missing! Notifications won't work without it.");
                    if (showToast) toast({ variant: "destructive", title: "Configuration Error", description: "VAPID Key is missing." });
                    return;
                }

                // Register Service Worker explicitly to avoid "Registration failed" errors
                let serviceWorkerRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
                if (!serviceWorkerRegistration) {
                    serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                }

                const token = await getToken(messaging, {
                    vapidKey,
                    serviceWorkerRegistration
                });

                if (token) {
                    setFcmToken(token);
                    console.log('FCM Token:', token);

                    if (user) {
                        // Save token to Firestore
                        // `channel` is what makes uninstall reporting possible: when
                        // this token later comes back "not registered" from FCM, it is
                        // the only record of which store the install came from.
                        const tokenRef = doc(firestore, `users/${user.uid}/fcmTokens`, token);
                        await setDoc(tokenRef, {
                            token,
                            lastUsed: serverTimestamp(),
                            device: navigator.userAgent,
                            channel: updateChannel(),
                            isNative: isNativeApp(),
                            status: 'active',
                            // Clear any previous uninstall verdict — the token is live again.
                            uninstalledAt: null,
                        }, { merge: true });
                        if (showToast) toast({ title: "Notifications Enabled", description: "You will now receive alerts." });
                    }
                } else {
                    console.log('No registration token available. Request permission to generate one.');
                }
            } else {
                if (showToast) toast({ variant: "destructive", title: "Permission Denied", description: "Please enable notifications in your browser settings." });
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            if (showToast) {
                toast({
                    variant: 'destructive',
                    title: 'System Notification Error',
                    description: error instanceof Error ? `Protocol Error: ${error.message}` : 'Permission conflict or network restriction prevented notification setup.'
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const unsubscribe = async () => {
        if (!fcmToken || !user) return;
        setIsLoading(true);
        try {
            const tokenRef = doc(firestore, `users/${user.uid}/fcmTokens`, fcmToken);
            await deleteDoc(tokenRef);
            setFcmToken(null);
            toast({ title: "Notifications Disabled", description: "This device will no longer receive alerts." });
        } catch (error) {
            console.error("Error unsubscribing:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to disable notifications." });
        } finally {
            setIsLoading(false);
        }
    }

    return { permission, requestPermission, unsubscribe, fcmToken, isLoading };
}
