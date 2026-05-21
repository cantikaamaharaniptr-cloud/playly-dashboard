// Phase 5 preview route — new React-based user landing (pre-login marketing).
// NOT routed at / yet (rewrite still serves legacy). Once all sections
// migrate + auth screen also ready, swap rewrites.
//
// Sections plan:
//   1. Plans (Free + Premium cards)   [pending]
//   2. Dashboard preview              [pending]
//   3. How it works                   [pending]
//   4. FAQ (10 questions)             ✅ done (session 1)
//   5. Final CTA + mini footer        ✅ done (session 1)

import { UserFaq } from '@/components/user/landing/UserFaq';
import { UserFinalCta } from '@/components/user/landing/UserFinalCta';

export const metadata = {
  title: 'Playly — Landing Preview',
  robots: { index: false, follow: false },
};

export default function UserPreviewPage() {
  return (
    <main className="min-h-screen bg-ink text-cream">
      <header className="border-b border-cream/10 px-6 py-4 sm:px-10">
        <p className="text-xs uppercase tracking-widest text-cream-soft/70">
          Phase 5 · User Landing Preview
        </p>
        <h1 className="mt-1 text-2xl font-bold">Playly</h1>
        <p className="mt-1 max-w-2xl text-sm text-cream-soft">
          Sections migrate satu per satu di sini. Live <code className="font-mono">/</code>{' '}
          masih pakai legacy bundle.
        </p>
      </header>

      <SectionPlaceholder index={1} title="Plans · Free + Premium cards" />
      <SectionPlaceholder index={2} title="Dashboard preview mockup" />
      <SectionPlaceholder index={3} title="How it works · steps" />

      {/* ✅ Migrated session 1 */}
      <UserFaq />

      {/* ✅ Migrated session 1 */}
      <UserFinalCta />
    </main>
  );
}

function SectionPlaceholder({ index, title }: { index: number; title: string }) {
  return (
    <section className="border-y border-cream/5 px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-[880px] rounded-lg border border-dashed border-cream/20 bg-ink-elev/40 p-6 text-center">
        <span className="font-mono text-xs uppercase tracking-widest text-cream-soft/60">
          § {index} · pending
        </span>
        <p className="mt-2 text-base font-semibold text-cream-soft">{title}</p>
        <p className="mt-1 text-xs text-cream-muted">
          Belum di-migrate. Lihat legacy di / untuk tampilan aslinya.
        </p>
      </div>
    </section>
  );
}
