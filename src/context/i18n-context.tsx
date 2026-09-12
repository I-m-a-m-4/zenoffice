'use client';

import * as React from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getLocaleDefinition,
  resolveLocale,
  type LocaleCode,
  type LocaleDir,
} from '@/lib/i18n/config';
import {
  englishMessages,
  getCachedMessages,
  loadMessages,
  type Messages,
} from '@/lib/i18n/messages';

type Vars = Record<string, string | number>;

/**
 * The signature of `t`, exported so a pure helper can take it as a parameter.
 *
 * Needed because plenty of copy is assembled outside a component — a code-to-sentence
 * mapper, a table's column definitions, a chart's axis formatter. Those want `t` passed
 * in rather than a hook they cannot call, and writing the signature out at each one
 * invites a drifted copy that quietly loses the `vars` argument.
 */
export type TranslateFn = (key: string, vars?: Vars) => string;

interface I18nContextValue {
  locale: LocaleCode;
  /** Persists to localStorage and loads the catalog. Does not write Firestore. */
  setLocale: (locale: LocaleCode) => void;
  /**
   * Adopt a locale coming from the business record without overriding an
   * explicit local choice. Used by <LocaleSync />.
   */
  adoptLocale: (raw: unknown) => void;
  t: TranslateFn;
  dir: LocaleDir;
  /** False until the active catalog has loaded. English renders meanwhile. */
  isReady: boolean;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

function lookup(source: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, source);
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

/**
 * Resolves a key against the active catalog, then English, then returns the key
 * itself. It never throws and never renders an empty string — an untranslated
 * string shows English, which is what keeps a partial translation from breaking
 * a screen.
 */
function translate(messages: Messages, key: string, vars?: Vars): string {
  const plural =
    vars && typeof vars.count === 'number'
      ? `${key}_${Math.abs(vars.count) === 1 ? 'one' : 'other'}`
      : null;

  const candidates = plural ? [plural, key] : [key];

  for (const candidate of candidates) {
    for (const source of [messages, englishMessages]) {
      const hit = lookup(source, candidate);
      if (typeof hit === 'string') return interpolate(hit, vars);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(`[i18n] Missing translation key: "${key}"`);
  }
  return key;
}

function readStoredLocale(): LocaleCode | null {
  try {
    return resolveLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Always start at the default so the client's first paint matches the
  // server-rendered markup; the real locale is applied in the effect below.
  const [locale, setLocaleState] = React.useState<LocaleCode>(DEFAULT_LOCALE);
  const [messages, setMessages] = React.useState<Messages>(englishMessages);
  const [isReady, setIsReady] = React.useState(false);

  /** True once the user has picked a language on this device. */
  const hasExplicitChoiceRef = React.useRef(false);
  /** Mirrors `locale` so async callbacks can read it without a stale closure. */
  const localeRef = React.useRef<LocaleCode>(DEFAULT_LOCALE);

  const applyLocale = React.useCallback((next: LocaleCode) => {
    localeRef.current = next;
    setLocaleState(next);

    const cached = getCachedMessages(next);
    if (cached) {
      setMessages(cached);
      setIsReady(true);
      return;
    }

    setIsReady(false);
    void loadMessages(next).then(loaded => {
      // Ignore a late-resolving catalog if the user switched again meanwhile.
      if (localeRef.current !== next) return;
      setMessages(loaded);
      setIsReady(true);
    });
  }, []);

  // Resolution order: explicit device choice → browser language → English.
  // The business `settings.language` slots in between via adoptLocale().
  React.useEffect(() => {
    const stored = readStoredLocale();
    if (stored) {
      hasExplicitChoiceRef.current = true;
      applyLocale(stored);
      return;
    }

    const fromBrowser =
      resolveLocale(typeof navigator !== 'undefined' ? navigator.language : null) ??
      resolveLocale(typeof navigator !== 'undefined' ? navigator.languages?.[0] : null);

    if (fromBrowser && fromBrowser !== DEFAULT_LOCALE) {
      applyLocale(fromBrowser);
      return;
    }

    setIsReady(true);
  }, [applyLocale]);

  const dir = getLocaleDefinition(locale).dir;

  // Keep the document in sync so native form controls, scrollbars and text
  // selection follow the locale, and RTL flows without per-component work.
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dir;
  }, [locale, dir]);

  const setLocale = React.useCallback(
    (next: LocaleCode) => {
      hasExplicitChoiceRef.current = true;
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        // Quota or private mode — the in-memory locale still applies for this
        // session, and the business record remains the durable source.
      }
      applyLocale(next);
    },
    [applyLocale],
  );

  const adoptLocale = React.useCallback(
    (raw: unknown) => {
      if (hasExplicitChoiceRef.current) return;
      const next = resolveLocale(raw);
      if (!next || next === localeRef.current) return;
      applyLocale(next);
    },
    [applyLocale],
  );

  const t = React.useCallback(
    (key: string, vars?: Vars) => translate(messages, key, vars),
    [messages],
  );

  const value = React.useMemo<I18nContextValue>(
    () => ({ locale, setLocale, adoptLocale, t, dir, isReady }),
    [locale, setLocale, adoptLocale, t, dir, isReady],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Safe outside the provider: falls back to English so a component can be lifted
 * into a tree without one (an error page, a portal) without crashing.
 */
export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (ctx) return ctx;

  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => { },
    adoptLocale: () => { },
    t: (key: string, vars?: Vars) => translate(englishMessages, key, vars),
    dir: 'ltr',
    isReady: true,
  };
}
