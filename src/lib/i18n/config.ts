export type LocaleCode =
  | 'en'
  | 'fr'
  | 'es'
  | 'pt'
  | 'de'
  | 'it'
  | 'ar'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'hi';

export type LocaleDir = 'ltr' | 'rtl';

export interface LocaleDefinition {
  code: LocaleCode;
  /** English name, for admin analytics and the searchable dropdown. */
  label: string;
  /** Endonym — what speakers of the language call it. Shown in the selector. */
  nativeLabel: string;
  /** flagcdn.com country code, matching the currency Combobox pattern. */
  flag: string;
  dir: LocaleDir;
  /** BCP 47 tag handed to Intl for money and date formatting. */
  intlTag: string;
}

export const LOCALES: LocaleDefinition[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: 'gb', dir: 'ltr', intlTag: 'en' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', flag: 'fr', dir: 'ltr', intlTag: 'fr' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: 'es', dir: 'ltr', intlTag: 'es' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', flag: 'pt', dir: 'ltr', intlTag: 'pt' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', flag: 'de', dir: 'ltr', intlTag: 'de' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano', flag: 'it', dir: 'ltr', intlTag: 'it' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', flag: 'sa', dir: 'rtl', intlTag: 'ar' },
  { code: 'zh', label: 'Chinese (Simplified)', nativeLabel: '简体中文', flag: 'cn', dir: 'ltr', intlTag: 'zh-Hans' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', flag: 'jp', dir: 'ltr', intlTag: 'ja' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어', flag: 'kr', dir: 'ltr', intlTag: 'ko' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: 'in', dir: 'ltr', intlTag: 'hi' },
];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export const LOCALE_STORAGE_KEY = 'zeneva_locale';

const BY_CODE = new Map<string, LocaleDefinition>(LOCALES.map(l => [l.code, l]));

/**
 * Legacy and display-name values that predate this registry.
 *
 * Onboarding wrote `settings.language: 'English'` — the literal string, regardless of
 * anything the user did — for every shop created before the language step existed, so
 * these aliases are not a nicety: they are the only reason those records resolve at
 * all. Onboarding now writes a code, but the old rows are permanent, and older ones
 * may hold a native name, so both spellings have to resolve rather than fall back
 * blindly.
 */
const ALIASES: Record<string, LocaleCode> = LOCALES.reduce((acc, l) => {
  acc[l.label.toLowerCase()] = l.code;
  acc[l.nativeLabel.toLowerCase()] = l.code;
  return acc;
}, {
  'chinese': 'zh',
  'mandarin': 'zh',
  'simplified chinese': 'zh',
  'portuguese (brazil)': 'pt',
  'castilian': 'es',
  'deutsch': 'de',
  'german (germany)': 'de',
  'italiano': 'it',
  'japanese (japan)': 'ja',
  'nihongo': 'ja',
  'korean (south korea)': 'ko',
  'hangul': 'ko',
} as Record<string, LocaleCode>);

export function getLocaleDefinition(code: LocaleCode): LocaleDefinition {
  return BY_CODE.get(code) ?? BY_CODE.get(DEFAULT_LOCALE)!;
}

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && BY_CODE.has(value);
}

/**
 * Tolerant coercion to a supported locale. Handles exact codes ('fr'), region
 * subtags ('en-US', 'pt-BR', 'zh-Hans-CN'), and human-readable names written by
 * onboarding. Returns null when nothing matches so callers can keep looking
 * down their resolution chain instead of latching onto English too early.
 */
export function resolveLocale(raw: unknown): LocaleCode | null {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (isLocaleCode(lower)) return lower;

  const alias = ALIASES[lower];
  if (alias) return alias;

  const base = lower.split(/[-_]/)[0];
  if (isLocaleCode(base)) return base;

  return null;
}

export function getLocaleDir(code: LocaleCode): LocaleDir {
  return getLocaleDefinition(code).dir;
}
