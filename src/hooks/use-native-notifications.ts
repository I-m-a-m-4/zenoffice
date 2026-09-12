'use client';

/**
 * React-facing wrapper over {@link triggerNativeNotification}.
 *
 * The implementation used to live here in full, duplicated from
 * `src/lib/native-notifications.ts` with different bugs in each copy — this one had
 * click handling for the browser but none for Tauri, the other had neither. Both are
 * now one funnel; this file exists so the existing `const { notify } = useNativeNotifications()`
 * call sites keep working.
 *
 * Two things it fixes on the way through:
 *
 * - **`notify` is stable.** It was rebuilt on every render and is listed in the
 *   dependency array of several `onSnapshot` effects, so those listeners
 *   re-attached — and re-billed — on every render of the layout.
 * - **Both call shapes are accepted.** `src/app/(app)/layout.tsx` calls this with an
 *   object for the CEO broadcast while everything else passes positional arguments.
 *   The object form used to throw a `TypeError` on `title.toLowerCase()` that was
 *   swallowed by a `catch`, which is why that particular notification had never once
 *   appeared.
 */

import * as React from 'react';
import { triggerNativeNotification } from '@/lib/native-notifications';

type NotifyPayload = { title: string; body?: string; url?: string; link?: string };

export function useNativeNotifications() {
  const notify = React.useCallback(
    async (titleOrPayload: string | NotifyPayload, body?: string, link?: string) => {
      const payload: NotifyPayload =
        typeof titleOrPayload === 'string'
          ? { title: titleOrPayload, body, url: link }
          : titleOrPayload;

      const url = payload.url || payload.link;

      await triggerNativeNotification({
        // No document id at these call sites, so identity falls back to the title
        // and destination. The body fingerprint inside the dispatcher is what
        // actually collapses the overlap with the document-backed listeners.
        key: `notify:${payload.title}:${url || ''}`,
        title: payload.title,
        body: payload.body || '',
        url,
      });
    },
    [],
  );

  return { notify };
}
