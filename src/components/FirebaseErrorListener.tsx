'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { User } from 'firebase/auth';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx.
 */
export function FirebaseErrorListener({ user }: { user: User | null }) {
  const [error, setError] = useState<FirestorePermissionError | null>(null);
  const [stabilizeUntil, setStabilizeUntil] = useState(() => Date.now() + 5000);
  const [lastUid, setLastUid] = useState<string | null>(null);

  useEffect(() => {
    // Whenever the user changes (login/logout/signup), reset the stabilization period.
    // This prevents transient permission errors during auth transitions from crashing the app.
    if (user?.uid !== lastUid) {
      setLastUid(user?.uid || null);
      setStabilizeUntil(Date.now() + 8000); // 8 seconds of silence for rule propagation
    }
  }, [user, lastUid]);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Ignore permission errors during the stabilization window.
      if (Date.now() < stabilizeUntil) {
        console.warn(`[Firebase] Swallowed transient permission error for ${error.path} during auth stabilization.`);
        return;
      }
      
      // Only throw/crash the app for critical database permission errors
      const isCritical = error.path?.includes('businessInstances') || error.path?.includes('onlineOrders');
      if (isCritical) {
        setError(error);
      } else {
        console.warn(`[Firebase] Swallowed non-critical permission error for ${error.path}.`);
      }
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [stabilizeUntil]);

  if (error) {
    throw error;
  }

  return null;
}
