'use client';

/**
 * The "Update required" modal for store-installed apps.
 *
 * Play Store and Microsoft Store builds cannot self-patch, so this is how they are
 * told a new version exists. Driven by `platform_settings/app_updates`, written on
 * /admin-imamshaffy/updates.
 *
 * ## Three things that were broken here
 *
 * 1. **Targeting compared an email against a Firebase UID.** The admin field was
 *    labelled "Target User IDs", so anyone typing an email — which is what every
 *    other admin surface in this app targets by — got a silent no-match, because
 *    an address can never equal a uid. Both are now accepted: emails
 *    case-insensitively, uids exactly (uids *are* case-sensitive, so they must not
 *    be lower-cased).
 * 2. **The listener had no error callback.** `platform_settings` had no Firestore
 *    rule at all, so every non-super-admin read was denied and `settings` stayed
 *    null with nothing said. The rule is added; the error handler stays, because a
 *    feature that shows nothing must not also explain nothing.
 * 3. **Category targeting read a field that does not exist.** It looked for
 *    `category` on `users/{uid}`; `UserProfile` has no such field. The business
 *    category is `business.settings.industry`, which the POS context already holds
 *    — so this now costs **no read at all**, where before it spent one per app
 *    load to fetch a field that was always undefined.
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { isNativeApp, isMobileApp } from '@/lib/platform';
import { usePOS } from '@/context/pos-context';

interface UpdateSettings {
  forceUpdateNative: boolean;
  isHardForce?: boolean;
  desktopLink: string;
  mobileLink: string;
  /** Emails or uids. Emails are matched case-insensitively. */
  targetUsers?: string[];
  /** Matched against `business.settings.industry`, case-insensitively. */
  targetCategories?: string[];
}

/** Trimmed, lower-cased, empty-safe — for comparing addresses and categories. */
const norm = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export function UpdateRequiredModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(false);
  const [settings, setSettings] = useState<UpdateSettings | null>(null);
  const firestore = useFirestore();
  const { user } = useUser();
  const { business } = usePOS();

  useEffect(() => {
    // Only run this on native apps (desktop/mobile)
    if (!isNativeApp() || !firestore) return;

    const unsub = onSnapshot(
      doc(firestore, 'platform_settings', 'app_updates'),
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as UpdateSettings);
        }
      },
      (error) => {
        // Almost always permission-denied, which used to be invisible. Say so:
        // "the modal never appeared" and "the modal could not read its settings"
        // need different fixes, and only one of them is a rules deploy.
        console.warn('Update settings unavailable:', error?.message || error);
      },
    );

    return () => unsub();
  }, [firestore]);

  useEffect(() => {
    if (!settings || hasDismissed) {
      if (!settings) setIsOpen(false);
      return;
    }

    let shouldShow = false;
    if (settings.forceUpdateNative) {
      shouldShow = true;
    } else if (user) {
      const email = norm(user.email);
      const targets = settings.targetUsers || [];
      // Email match is case-insensitive; uid match is exact, because uids are
      // case-sensitive and lower-casing one would silently stop matching it.
      const matchedUser = targets.some(
        (entry) => entry === user.uid || (!!email && norm(entry) === email),
      );

      const industry = norm(business?.settings?.industry);
      const matchedCategory =
        !!industry && (settings.targetCategories || []).some((c) => norm(c) === industry);

      shouldShow = matchedUser || matchedCategory;
    }

    setIsOpen(shouldShow);
  }, [settings, user, business, hasDismissed]);

  // If not a native app, don't render anything
  if (!isNativeApp()) return null;

  const handleUpdate = () => {
    if (!settings) return;
    const link = isMobileApp() ? settings.mobileLink : settings.desktopLink;
    if (link) {
      window.open(link, '_blank');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setHasDismissed(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // If it's a hard force, ignore requests to close (e.g. clicking outside)
      if (!open && !settings?.isHardForce) {
        handleClose();
      }
    }}>
      <DialogContent 
        className={`sm:max-w-[425px] bg-background border-border text-foreground p-6 rounded-xl gap-6 ${settings?.isHardForce ? '[&>button]:hidden' : ''}`}
        onPointerDownOutside={(e) => {
          if (settings?.isHardForce) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (settings?.isHardForce) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">Update required</DialogTitle>
        </DialogHeader>
        
        <div className="text-sm text-muted-foreground leading-relaxed">
          {settings?.isHardForce 
            ? "Please update to the latest version of Zeneva. This version has expired and you can no longer use it."
            : "A new version of Zeneva is available. Please update to get the latest features and improvements."}
        </div>
        
        <DialogFooter className="flex flex-row sm:justify-end gap-3 pt-2">
          {!settings?.isHardForce && (
            <Button 
              variant="outline" 
              onClick={handleClose}
              className="rounded-full bg-transparent border-border text-orange-600 dark:text-orange-500 hover:bg-orange-500/10 transition-colors h-10 px-6"
            >
              Close
            </Button>
          )}
          <Button 
            onClick={handleUpdate}
            className="rounded-full bg-orange-600 hover:bg-orange-700 text-white font-medium h-10 px-6 border-0"
          >
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
