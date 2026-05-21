'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useI18n } from '@/components/providers/i18n-provider';
import { useTheme } from '@/components/providers/theme-provider';
import type { Locale } from '@/lib/i18n/dictionary';

// Demo subcomponent — verifies all three providers wire up correctly.
// Lives only in /playground; production pages will compose their own UIs
// on top of these hooks.
export function ProvidersDemo() {
  const auth = useAuth();
  const { locale, setLocale, t, supportedLocales } = useI18n();
  const { role, theme, setTheme } = useTheme();

  return (
    <section className="space-y-4 rounded bg-ink-elev p-6 shadow-playly-md">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cream-soft">
          Providers Demo (Phase 3)
        </h2>
        <p className="text-xs text-cream-muted">
          Tiga context — Auth, I18n, Theme — semua wired ke <code className="font-mono">app/layout.tsx</code>.
        </p>
      </header>

      <Row label="auth.ready">
        <code className="font-mono text-sm">{String(auth.ready)}</code>
        {!auth.ready && (
          <span className="text-xs text-status-warning">
            ⚠ NEXT_PUBLIC_SUPABASE_URL / ANON_KEY belum di-set di Vercel
          </span>
        )}
      </Row>

      <Row label="auth.loading">
        <code className="font-mono text-sm">{String(auth.loading)}</code>
      </Row>

      <Row label="auth.user">
        <code className="font-mono text-sm">{auth.user?.email ?? '(not signed in)'}</code>
      </Row>

      <Row label="auth.isAdmin">
        <code className="font-mono text-sm">{String(auth.isAdmin)}</code>
      </Row>

      <Row label="i18n.locale">
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="rounded-sm border border-cream/20 bg-ink px-2 py-1 font-mono text-sm text-cream"
        >
          {supportedLocales.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Row>

      <Row label='t("nav.home")'>
        <code className="font-mono text-sm">{t('nav.home')}</code>
      </Row>

      <Row label='t("section.main")'>
        <code className="font-mono text-sm">{t('section.main')}</code>
      </Row>

      <Row label='t("untranslated.key", "fallback!")'>
        <code className="font-mono text-sm">{t('untranslated.key', 'fallback!')}</code>
      </Row>

      <Row label="theme.role (from URL)">
        <code className="font-mono text-sm">{role}</code>
        <span className="text-xs text-cream-muted">
          tambah <code className="font-mono">?admin=1</code> di URL → flip ke admin
        </span>
      </Row>

      <Row label="theme.theme">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`rounded-sm border px-3 py-1 text-xs ${
              theme === 'dark'
                ? 'border-cream bg-cream text-ink'
                : 'border-cream/30 text-cream hover:bg-cream/10'
            }`}
          >
            dark
          </button>
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`rounded-sm border px-3 py-1 text-xs ${
              theme === 'light'
                ? 'border-cream bg-cream text-ink'
                : 'border-cream/30 text-cream hover:bg-cream/10'
            }`}
          >
            light
          </button>
        </div>
      </Row>

      <Row label="body dataset">
        <code className="font-mono text-xs text-cream-muted">
          data-role={role} · data-theme={theme}
        </code>
      </Row>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-cream/10 pb-2 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <span className="min-w-[180px] font-mono text-xs uppercase tracking-wider text-cream-muted">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
