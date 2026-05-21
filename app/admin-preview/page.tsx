// Phase 4 preview route — new React-based admin landing. NOT routed at /admin
// yet (rewrite still serves legacy). Once all 7 admin sections migrate &
// visual parity verified, swap by removing the /admin rewrite from
// next.config.mjs and pointing this page at app/admin/page.tsx.
//
// Sections plan (Phase 4 multi-session):
//   1. Activity ticker          ✅ done (session 2)
//   2. Modules (8 cards)        [pending]
//   3. Preview console          [pending]
//   4. Security badges          [pending]
//   5. Workflow steps           [pending]
//   6. FAQ (10 questions)       ✅ done (session 1)
//   7. Restricted access footer ✅ done (session 2)

import { AdminActivityTicker } from '@/components/admin/landing/AdminActivityTicker';
import { AdminFaq } from '@/components/admin/landing/AdminFaq';
import { AdminFoot } from '@/components/admin/landing/AdminFoot';

export const metadata = {
  title: 'Playly Admin — Landing Preview',
  robots: { index: false, follow: false },
};

export default function AdminPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-bg text-white">
      <header className="border-b border-slate-accent/10 px-6 py-4 sm:px-10">
        <p className="text-xs uppercase tracking-widest text-slate-accent/70">
          Phase 4 · Admin Landing Preview
        </p>
        <h1 className="mt-1 text-2xl font-bold">Playly Admin</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-accent">
          Sections migrate satu per satu di sini. Live <code className="font-mono">/admin</code>{' '}
          masih pakai legacy bundle sampai semua section selesai.
        </p>
      </header>

      {/* ✅ Migrated session 2 */}
      <AdminActivityTicker />

      <SectionPlaceholder index={2} title="Modules · 8 capability cards" />
      <SectionPlaceholder index={3} title="Preview console" />
      <SectionPlaceholder index={4} title="Security badges" />
      <SectionPlaceholder index={5} title="Workflow steps" />

      {/* ✅ Migrated session 1 */}
      <AdminFaq />

      {/* ✅ Migrated session 2 */}
      <AdminFoot />
    </main>
  );
}

function SectionPlaceholder({ index, title }: { index: number; title: string }) {
  return (
    <section className="border-y border-slate-accent/5 px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-[880px] rounded-lg border border-dashed border-slate-accent/20 bg-slate-elev/20 p-6 text-center">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-accent/60">
          § {index} · pending
        </span>
        <p className="mt-2 text-base font-semibold text-slate-accent">{title}</p>
        <p className="mt-1 text-xs text-slate-accent/60">
          Belum di-migrate. Lihat legacy di /admin untuk tampilan aslinya.
        </p>
      </div>
    </section>
  );
}
