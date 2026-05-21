'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  TRANSLATIONS,
  type Locale,
} from '@/lib/i18n/dictionary';

const STORAGE_KEY = 'playly-lang';

type I18nState = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, fallback?: string) => string;
  supportedLocales: readonly Locale[];
};

const I18nContext = createContext<I18nState>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, fallback) => fallback ?? key,
  supportedLocales: SUPPORTED_LOCALES,
});

function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isSupportedLocale(stored)) {
        setLocaleState(stored);
      }
    } catch {
      // localStorage unavailable (e.g. SSR or sandboxed iframe) — fallback OK
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  // Lookup order matches legacy script.js t():
  //   current locale → default (id) → en → caller fallback → key
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const cur = TRANSLATIONS[locale]?.[key];
      if (cur) return cur;
      const def = TRANSLATIONS[DEFAULT_LOCALE]?.[key];
      if (def) return def;
      const en = TRANSLATIONS.en?.[key];
      if (en) return en;
      return fallback ?? key;
    },
    [locale],
  );

  const value = useMemo<I18nState>(
    () => ({ locale, setLocale, t, supportedLocales: SUPPORTED_LOCALES }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  return useContext(I18nContext);
}
