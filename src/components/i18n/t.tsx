'use client';

import { useI18n } from '@/context/i18n-context';

/**
 * A translated string as a leaf client component.
 *
 * `src/app/page.tsx` and the other marketing routes export `metadata`, so they
 * are server components and cannot call `useI18n` themselves. A server
 * component *can* render a client component, so `<T k="landing.heroLine1" />`
 * lets those pages translate without a wholesale 'use client' refactor that
 * would drop their static metadata.
 *
 * There is no hydration mismatch: the static export prerenders English, the
 * provider's first client render is also DEFAULT_LOCALE, and the stored locale
 * is applied in an effect afterwards.
 */
export function T({
  k,
  vars,
}: {
  k: string;
  vars?: Record<string, string | number>;
}) {
  const { t } = useI18n();
  return <>{t(k, vars)}</>;
}

/**
 * Same lookup, but returns the raw string for places that need a value rather
 * than a node — `alt`, `placeholder`, `aria-label`. Only usable from a client
 * component; a server component should render `<T>` instead.
 */
export function useT() {
  return useI18n().t;
}
