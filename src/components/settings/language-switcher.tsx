'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Combobox } from '@/components/ui/combobox';
import { useI18n } from '@/context/i18n-context';
import { DEFAULT_LOCALE, LOCALES, getLocaleDefinition, isLocaleCode } from '@/lib/i18n/config';
import { useToast } from '@/hooks/use-toast';

const options = LOCALES.map(l => ({ value: l.code, label: `${l.nativeLabel} (${l.label})` }));

/** Combobox hands back a plain string; narrow it before hitting the registry. */
function definitionFor(value: string) {
  return getLocaleDefinition(isLocaleCode(value) ? value : DEFAULT_LOCALE);
}

function Flag({ code }: { code: string }) {
  return (
    <img
      src={`https://flagcdn.com/16x12/${code}.png`}
      alt=""
      className="w-4 h-3 object-cover rounded-sm shrink-0"
      loading="lazy"
    />
  );
}

interface LanguageSwitcherProps {
  /**
   * Persists the choice to the business record. Settings passes its existing
   * dual-path save handler so the write queues offline under Tauri.
   */
  onPersist?: (localeCode: string) => void;
}

export function LanguageSwitcher({ onPersist }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const { toast } = useToast();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton className="h-20 w-full" />;
  }

  const handleChange = (value: string) => {
    if (!isLocaleCode(value) || value === locale) return;

    setLocale(value);
    onPersist?.(value);

    const nativeLabel = getLocaleDefinition(value).nativeLabel;
    toast({
      variant: 'success',
      title: t('toast.languageChanged'),
      description: t('toast.languageChangedDescription', { language: nativeLabel }),
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="language-select" className="text-base">
          {t('settings.languageLabel')}
        </Label>
        <p className="text-sm text-muted-foreground">{t('settings.languageDescription')}</p>
      </div>
      <div className="w-full sm:w-64 shrink-0">
        <Combobox
          options={options}
          value={locale}
          onChange={handleChange}
          placeholder={t('settings.languagePlaceholder')}
          searchPlaceholder={t('settings.languageSearchPlaceholder')}
          emptyPlaceholder={t('common.noResults')}
          renderSelected={opt => (
            <div className="flex items-center gap-2">
              <Flag code={definitionFor(opt.value).flag} />
              <span>{definitionFor(opt.value).nativeLabel}</span>
            </div>
          )}
          renderItem={opt => (
            <div className="flex items-center gap-2">
              <Flag code={definitionFor(opt.value).flag} />
              <span>{opt.label}</span>
            </div>
          )}
          triggerClassName="w-full justify-between font-normal bg-background hover:bg-accent border border-input h-10 px-3 py-2 text-sm rounded-md"
        />
      </div>
    </div>
  );
}

/**
 * Compact icon-and-flag variant for the public marketing header, so a visitor
 * can switch language before they ever sign up.
 */
export function LanguageSwitcherCompact({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton className="h-9 w-28" />;
  }

  return (
    <Combobox
      options={options}
      value={locale}
      onChange={value => {
        if (isLocaleCode(value)) setLocale(value);
      }}
      placeholder={t('common.language')}
      searchPlaceholder={t('settings.languageSearchPlaceholder')}
      emptyPlaceholder={t('common.noResults')}
      renderSelected={opt => (
        <div className="flex items-center gap-2">
          <Flag code={definitionFor(opt.value).flag} />
          <span className="text-sm">{definitionFor(opt.value).nativeLabel}</span>
        </div>
      )}
      renderItem={opt => (
        <div className="flex items-center gap-2">
          <Flag code={definitionFor(opt.value).flag} />
          <span>{opt.label}</span>
        </div>
      )}
      triggerClassName={
        className ??
        'h-9 w-auto min-w-[7.5rem] justify-between font-normal bg-transparent hover:bg-accent border-border/40 px-2.5 text-sm rounded-md'
      }
      contentClassName="w-80"
      itemClassName="aria-selected:bg-slate-900 aria-selected:text-white"
    />
  );
}
