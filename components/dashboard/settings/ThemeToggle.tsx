'use client';

import { useTheme } from '@/components/providers/theme-provider';
import { SettingsSection } from './SettingsSection';

type Option = { value: 'dark' | 'light'; label: string; description: string };

const OPTIONS: Option[] = [
  {
    value: 'dark',
    label: 'Dark',
    description: 'Wine on ink — default Playly look.',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Cream on sand — daylight friendly.',
  },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingsSection
      title="Tampilan"
      description="Pilih tema warna untuk dashboard kamu."
    >
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((opt) => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={`rounded-md border p-4 text-left transition-colors ${
                active
                  ? 'border-wine bg-wine/15'
                  : 'border-cream/15 bg-ink/30 hover:border-cream/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-cream">{opt.label}</span>
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
              </div>
              <p className="mt-1 text-xs text-cream-soft">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </SettingsSection>
  );
}
