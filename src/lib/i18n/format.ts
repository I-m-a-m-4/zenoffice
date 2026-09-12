import { DEFAULT_LOCALE, getLocaleDefinition, type LocaleCode } from './config';

function intlTag(locale: LocaleCode): string {
  return getLocaleDefinition(locale).intlTag;
}

/**
 * Money formatter for the surfaces this i18n pass touches. Falls back to a bare
 * amount rather than throwing on an unknown currency code, because currency
 * comes from user-entered business settings.
 */
export function formatMoney(
  amount: number,
  currency: string | undefined,
  locale: LocaleCode = DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions,
): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const code = (currency || '').trim().toUpperCase();

  if (code) {
    try {
      return new Intl.NumberFormat(intlTag(locale), {
        style: 'currency',
        currency: code,
        ...options,
      }).format(value);
    } catch {
      // Unsupported/invalid currency code — fall through to a plain number.
    }
  }

  try {
    return new Intl.NumberFormat(intlTag(locale), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

export function formatNumber(
  value: number,
  locale: LocaleCode = DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions,
): string {
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(intlTag(locale), options).format(safe);
  } catch {
    return String(safe);
  }
}

/** Accepts a Date, epoch millis, an ISO string, or a Firestore-style timestamp. */
function toDate(input: unknown): Date | null {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (input && typeof input === 'object' && typeof (input as { toDate?: unknown }).toDate === 'function') {
    try {
      const d = (input as { toDate: () => Date }).toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  return null;
}

export function formatDate(
  input: unknown,
  locale: LocaleCode = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  const date = toDate(input);
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(intlTag(locale), options).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export function formatDateTime(input: unknown, locale: LocaleCode = DEFAULT_LOCALE): string {
  return formatDate(input, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
