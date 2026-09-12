'use client';

import * as React from 'react';
import { usePOS } from '@/context/pos-context';
import { useI18n } from '@/context/i18n-context';

/**
 * Bridges the business record's `settings.language` into the i18n provider.
 *
 * The provider has to sit high in the tree (just inside ThemeProvider) so the
 * public marketing pages get it too, but the business record only exists deep
 * inside POSProvider. Rendering this one component inside POSProvider carries
 * the value up without making either context depend on the other.
 *
 * `adoptLocale` deliberately yields to an explicit device choice, so a staff
 * member who picks a language on their own phone is not overridden by the
 * business default on the next load.
 */
export function LocaleSync() {
  const { business } = usePOS();
  const { adoptLocale } = useI18n();
  const language = business?.settings?.language;

  React.useEffect(() => {
    if (language) adoptLocale(language);
  }, [language, adoptLocale]);

  return null;
}
