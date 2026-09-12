import type { LocaleCode } from '../config';
import en from './en';
import type { Messages } from './en';

export type { Messages };

/**
 * English ships in the main bundle because it is the fallback for every missing
 * key — it has to be there synchronously. The others are dynamic imports so
 * a visitor downloads one catalog, not all of them. Code-splitting survives
 * `output: 'export'`, so this works in the Tauri build too.
 */
const LOADERS: Record<Exclude<LocaleCode, 'en'>, () => Promise<{ default: Messages }>> = {
  fr: () => import('./fr'),
  es: () => import('./es'),
  pt: () => import('./pt'),
  de: () => import('./de'),
  it: () => import('./it'),
  ar: () => import('./ar'),
  zh: () => import('./zh'),
  ja: () => import('./ja'),
  ko: () => import('./ko'),
  hi: () => import('./hi'),
};

const cache = new Map<LocaleCode, Messages>([['en', en]]);

export const englishMessages = en;

export function getCachedMessages(locale: LocaleCode): Messages | undefined {
  return cache.get(locale);
}

/**
 * Never rejects. A failed chunk load (offline first-visit, stale service
 * worker) falls back to English rather than leaving the UI blank.
 */
export async function loadMessages(locale: LocaleCode): Promise<Messages> {
  const cached = cache.get(locale);
  if (cached) return cached;

  const loader = LOADERS[locale as Exclude<LocaleCode, 'en'>];
  if (!loader) return en;

  try {
    const mod = await loader();
    cache.set(locale, mod.default);
    return mod.default;
  } catch (error) {
    console.warn(`[i18n] Failed to load "${locale}" catalog, falling back to English.`, error);
    return en;
  }
}
