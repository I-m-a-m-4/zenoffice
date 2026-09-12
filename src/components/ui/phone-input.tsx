'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRIES, findCountryByName, isoToFlag } from '@/lib/countries';

export interface CountryCode {
  name: string;
  code: string; // dial code e.g. "+234"
  iso: string;  // ISO 3166-1 alpha-2
  flag: string; // emoji flag
}

/**
 * Shown first in the dropdown - the markets most Zeneva shops are in. This is
 * ordering only. It used to double as the fallback country (`countries[0]`),
 * which is what pinned every empty phone field to +234 regardless of the
 * business's own country; the fallback now comes from `defaultCountry`.
 */
const PINNED_ISO = ['NG', 'GH', 'KE', 'ZA', 'GB', 'US', 'CA'];

const toCountryCode = (c: { name: string; iso: string; dial: string }): CountryCode => ({
  name: c.name,
  code: c.dial,
  iso: c.iso,
  flag: isoToFlag(c.iso),
});

/**
 * Every country the onboarding form offers, pinned markets first.
 * Derived from `@/lib/countries` so there is one dial-code table in the app -
 * see that file for why a second one was a bug rather than a duplication.
 */
export const COUNTRY_CODES: CountryCode[] = [
  ...PINNED_ISO.map((iso) => COUNTRIES.find((c) => c.iso === iso))
    .filter((c): c is (typeof COUNTRIES)[number] => !!c)
    .map(toCountryCode),
  ...COUNTRIES.filter((c) => !PINNED_ISO.includes(c.iso)).map(toCountryCode),
];

/**
 * Countries that share a dialling code. Longest-match sorting cannot break
 * these ties, so without an explicit preference whichever entry happens to come
 * first in the list decides: +7 is both Russia and Kazakhstan, and plain
 * alphabetical order would render every Russian number under a Kazakh flag.
 */
const PREFERRED_BY_DIAL: Record<string, string> = { '+1': 'US', '+7': 'RU' };

/** Longest dial code first, so "+1" cannot swallow "+1868". Computed once. */
const BY_CODE_LENGTH = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

const preferredFor = (match: CountryCode): CountryCode => {
  const iso = PREFERRED_BY_DIAL[match.code];
  if (!iso || iso === match.iso) return match;
  return COUNTRY_CODES.find((c) => c.iso === iso && c.code === match.code) ?? match;
};

/** The entry for a stored country *name*, e.g. business.settings.country. */
export function countryCodeForName(name: string | null | undefined): CountryCode | undefined {
  const found = findCountryByName(name);
  if (!found) return undefined;
  return COUNTRY_CODES.find((c) => c.iso === found.iso);
}

/**
 * National-format hints. Deliberately sparse: an absent example falls back to a
 * neutral placeholder rather than to a Nigerian one. The old default was
 * '801 234 5678' for all 94 countries, which is a Lagos mobile number.
 */
const NATIONAL_EXAMPLE: Record<string, string> = {
  NG: '801 234 5678',
  GH: '24 123 4567',
  KE: '712 345 678',
  ZA: '71 123 4567',
  GB: '7400 123456',
  US: '555 123 4567',
  CA: '555 123 4567',
};

/** Parse a full E.164 number into country + local digits */
function parseE164(
  value: string,
  countries: CountryCode[],
  fallback: CountryCode
): { country: CountryCode; local: string } {
  if (!value) return { country: fallback, local: '' };
  const raw = value.startsWith('+') ? value : `+${value}`;
  // Try longest match first to avoid "+1" swallowing "+1868" etc.
  const sorted = countries === COUNTRY_CODES
    ? BY_CODE_LENGTH
    : [...countries].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (raw.startsWith(c.code)) {
      return { country: preferredFor(c), local: raw.slice(c.code.length) };
    }
  }
  return { country: fallback, local: value.replace(/^\+?/, '') };
}

interface PhoneInputProps {
  id?: string;
  value: string; // full E.164 e.g. "+2348012345678"
  onChange: (e164: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Country *name* to show when `value` carries no dial code of its own -
   * pass the business's own `settings.country`. Without it an empty field falls
   * back to the first pinned entry, which is Nigeria and is wrong everywhere
   * else. Unresolvable names are ignored rather than guessed at.
   */
  defaultCountry?: string;
}

export function PhoneInput({ id, value, onChange, className, placeholder, disabled, defaultCountry }: PhoneInputProps) {
  const fallbackCountry = useMemo(
    () => countryCodeForName(defaultCountry) ?? COUNTRY_CODES[0],
    [defaultCountry]
  );
  const { country: parsedCountry, local: parsedLocal } = useMemo(
    () => parseE164(value, COUNTRY_CODES, fallbackCountry),
    [value, fallbackCountry]
  );

  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(parsedCountry);
  const [localNumber, setLocalNumber] = useState(parsedLocal);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /** An explicit pick outranks both the parsed value and `defaultCountry`. */
  const userPickedRef = useRef(false);

  // Sync when parent value changes externally
  useEffect(() => {
    if (!value) {
      // Nothing to parse. Clear the digits but keep the country on screen:
      // re-deriving it here is what made a country picked before any digits were
      // typed snap straight back to the fallback.
      setLocalNumber('');
      return;
    }
    const { country, local } = parseE164(value, COUNTRY_CODES, fallbackCountry);
    setSelectedCountry(country);
    setLocalNumber(local);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // The business country arrives after mount - the settings page hydrates it
  // from Firestore - so this cannot be a useState initialiser alone. It must not
  // run over an explicit pick, and not once there is a number to parse.
  useEffect(() => {
    if (userPickedRef.current || value) return;
    setSelectedCountry(fallbackCountry);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackCountry]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 40);
  }, [open]);

  const filtered = useMemo(() =>
    search.trim()
      ? COUNTRY_CODES.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search)
        )
      : COUNTRY_CODES,
    [search]
  );

  const handleCountrySelect = (country: CountryCode) => {
    userPickedRef.current = true;
    setSelectedCountry(country);
    setOpen(false);
    setSearch('');
    onChange(localNumber ? `${country.code}${localNumber}` : '');
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setLocalNumber(raw);
    onChange(raw ? `${selectedCountry.code}${raw}` : '');
  };

  return (
    <div className={cn('relative', className)} ref={wrapperRef}>
      <div className={cn(
        'flex items-center rounded-md border border-input bg-background overflow-hidden transition-shadow',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        disabled && 'opacity-50 cursor-not-allowed'
      )}>
        {/* Country code selector */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(v => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 h-10 bg-muted/50 border-r border-input shrink-0',
            'hover:bg-muted/80 transition-colors text-sm font-medium focus:outline-none'
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="text-base leading-none">{selectedCountry.flag}</span>
          <span className="text-xs font-semibold tracking-wide text-foreground">{selectedCountry.code}</span>
          <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform duration-150', open && 'rotate-180')} />
        </button>

        {/* Number input */}
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          disabled={disabled}
          placeholder={placeholder ?? NATIONAL_EXAMPLE[selectedCountry.iso] ?? 'Phone number'}
          value={localNumber}
          onChange={handleNumberChange}
          className="flex-1 h-10 px-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
        />
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search country or code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground text-center">No results</li>
            )}
            {filtered.map(c => (
              <li
                key={`${c.iso}-${c.code}`}
                role="option"
                aria-selected={c.iso === selectedCountry.iso && c.code === selectedCountry.code}
                onClick={() => handleCountrySelect(c)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 cursor-pointer text-sm transition-colors select-none',
                  'hover:bg-accent hover:text-accent-foreground',
                  c.iso === selectedCountry.iso && c.code === selectedCountry.code
                    ? 'bg-primary/10 text-primary font-semibold'
                    : ''
                )}
              >
                <span className="text-base w-6 shrink-0 leading-none">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground font-mono shrink-0">{c.code}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
