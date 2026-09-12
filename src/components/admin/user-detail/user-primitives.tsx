'use client';

/**
 * Shared per-user presentation helpers for the admin surface.
 *
 * These four lived as module-private copies inside the 5,000-line
 * `admin-imamshaffy/page.tsx`, which meant the standalone /users pages could not
 * reuse them. Moved here verbatim so the dashboard and the user directory render
 * a user identically — a second copy is how the two drift apart.
 */

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { resolveLocale, getLocaleDefinition } from '@/lib/i18n/config';

/**
 * Firestore Timestamp | Date | ISO string | epoch ms -> Date, or null.
 *
 * The tolerant one: prefer this over calling `.toDate()` directly, because the
 * admin surface reads documents written by several generations of the app and
 * not all of them carry real Timestamps.
 */
export function toDate(value: any): Date | null {
    if (!value) return null;
    try {
        const d = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
        return isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
}

export function formatDuration(seconds: number): string {
    if (!seconds || seconds < 1) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

/**
 * The app language a user reads Zeneva in. Coerced through the same tolerant
 * resolver the runtime uses, so a legacy `'English'` value written by onboarding
 * renders as English instead of as an unrecognised code. Null means the user has
 * not checked in since language tracking shipped — shown as Unknown, never
 * silently counted as English.
 */
export function userLanguage(raw: unknown) {
    const code = resolveLocale(raw);
    return code ? getLocaleDefinition(code) : null;
}

/**
 * Online dot + relative last-seen. Online means seen within five minutes.
 *
 * Goes through `toDate`, unlike the original which required a real Timestamp and
 * rendered a plain Date as "Never".
 */
export const UserPresence = ({ lastSeen, status }: { lastSeen: any, status?: string }) => {
    const lastSeenDate = toDate(lastSeen);
    if (!lastSeenDate) {
        return <span className="text-muted-foreground text-xs">Never</span>;
    }

    const isOnline = lastSeenDate > new Date(Date.now() - 5 * 60 * 1000);
    const isMinimized = isOnline && status === 'minimized';

    return (
        <div className="flex items-center gap-2">
            {isOnline ? (
                <span className="relative flex h-2.5 w-2.5 group">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMinimized ? 'bg-amber-400' : 'bg-green-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isMinimized ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                    {isMinimized && (
                        <div className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap bg-black text-white text-[10px] px-1.5 py-0.5 rounded shadow z-50">
                            App Minimized
                        </div>
                    )}
                </span>
            ) : (
                <span className="relative flex h-2.5 w-2.5">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-muted-foreground/50"></span>
                </span>
            )}
            <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(lastSeenDate, { addSuffix: true })}
            </span>
        </div>
    );
};
