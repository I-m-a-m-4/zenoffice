'use client';

import React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpCircle, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { AppConfig } from '@/lib/config';
import {
  isNativeApp,
  isNewerVersion,
  openStore,
  storeName,
  updateChannel,
} from '@/lib/platform';

/**
 * Tells store-distributed installs (Google Play, Microsoft Store) that a newer
 * version is available.
 *
 * Sideloaded desktop builds patch themselves through TauriUpdater, so this only
 * runs where the store owns the update and the most the app can do is point the
 * user at the listing.
 *
 * Source of truth is Firestore `system_config/app_release`:
 *   { latestVersion: "3.1.5", notes?: string, mandatory?: boolean }
 * If the document is missing or malformed nothing renders - a broken config
 * should never nag every user on every launch.
 */

const DISMISS_KEY = 'zeneva_update_dismissed_version';

export function UpdatePrompt() {
  const firestore = useFirestore();
  const [latestVersion, setLatestVersion] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<string>('');
  const [mandatory, setMandatory] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true);

  const channel = React.useMemo(
    () => (typeof window === 'undefined' ? 'web' : updateChannel()),
    []
  );
  const storeManaged = channel === 'play' || channel === 'microsoft';

  React.useEffect(() => {
    if (!firestore || !storeManaged) return;

    const ref = doc(firestore, 'system_config', 'app_release');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        if (!data || typeof data.latestVersion !== 'string') return;
        setLatestVersion(data.latestVersion);
        setNotes(typeof data.notes === 'string' ? data.notes : '');
        setMandatory(data.mandatory === true);
      },
      // Never surface a permissions/network error as a broken banner.
      () => setLatestVersion(null)
    );
    return () => unsub();
  }, [firestore, storeManaged]);

  const updateAvailable =
    !!latestVersion && isNewerVersion(latestVersion, AppConfig.version);

  // Re-show when the announced version changes, even if a previous one was dismissed.
  React.useEffect(() => {
    if (!updateAvailable || !latestVersion) return;
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === latestVersion);
    } catch {
      setDismissed(false);
    }
  }, [updateAvailable, latestVersion]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      if (latestVersion) sessionStorage.setItem(DISMISS_KEY, latestVersion);
    } catch {
      /* private mode - dismissing for this render is enough */
    }
  };

  if (!storeManaged || !isNativeApp() || !updateAvailable) return null;
  if (dismissed && !mandatory) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-x-0 top-0 z-[95] flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] no-print"
      >
        <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur-md">
          <ArrowUpCircle className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">
              Version {latestVersion} available
            </p>
            <p className="truncate text-xs leading-tight text-muted-foreground">
              {notes || `Update Zeneva on ${storeName(channel)}`}
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 shrink-0 rounded-full px-4 text-xs font-semibold"
            onClick={() => openStore(channel)}
          >
            Update
          </Button>
          {!mandatory && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Dismiss update notice"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
