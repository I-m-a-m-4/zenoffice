'use client';

import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';
import { firebaseApp } from './index';

let messaging: Messaging | null = null;

export const initializeMessaging = async () => {
    if (typeof window !== 'undefined') {
        const supported = await isSupported();
        if (supported) {
            messaging = getMessaging(firebaseApp);
        }
    }
    return messaging;
};

export const getMessagingInstance = () => messaging;
