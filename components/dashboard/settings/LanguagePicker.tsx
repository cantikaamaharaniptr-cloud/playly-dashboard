'use client';

import { useI18n } from '@/components/providers/i18n-provider';
import type { Locale } from '@/lib/i18n/dictionary';
import { SettingsSection } from './SettingsSection';

const LOCALE_LABELS: Record<Locale, { label: string; flag: string }> = {
  id: { label: 'Bahasa Indonesia', flag: '🇮🇩' },
  en: { label: 'English', flag: '🇬🇧' },
  ms: { label: 'Bahasa Melayu', flag: '🇲🇾' },
  ja: { label: '日本語', flag: '🇯🇵' },
  ar: { label: 'العربية', flag: '🇸🇦' },
  zh: { label: '中文', flag: '🇨🇳' },
  ko: { label: '한국어', flag: '🇰🇷' },
  es: { label: 'Español', flag: '🇪🇸' },
};

export function LanguagePicker() {
  const { locale, setLocale, supportedLocales } = useI18n();

  return (
    <SettingsSection
      title="Bahasa & Region"
      description="Pilih bahasa untuk UI dashboard. Konten kreator tidak ikut diterjemahkan."
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {supportedLocales.map((l) => {
          const meta = LOCALE_LABELS[l];
          const active = locale === l;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'border-wine bg-wine/15 text-cream'
                  : 'border-cream/15 bg-ink/30 text-cream-soft hover:border-cream/30 hover:text-cream'
              }`}
            >
              <span className="text-base" aria-hidden="true">
                {meta.flag}
              </span>
              <span className="flex-1 text-left font-medium">{meta.label}</span>
              {active ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-wine"
                  aria-hidden="true"
                >
                  <path d="M5 12l5 5L20 7" />
                </svg>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-cream-muted">
        Phase 5 dict: hanya 14 key (nav + section) per locale terisi.
        Sisanya pakai fallback ke id/en sampai dict full di-port.
      </p>
    </SettingsSection>
  );
}
