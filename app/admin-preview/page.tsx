// Phase 4 preview route — new React-based admin landing. NOT routed at /admin
// yet (rewrite still serves legacy). All 7 sections now migrated — once
// visual parity verified, swap by removing the /admin rewrite from
// next.config.mjs and pointing this at app/admin/page.tsx.
//
// Sections progress (7/7 ✅):
//   1. Activity ticker          ✅ done
//   2. Modules (8 cards)        ✅ done
//   3. Preview console          ✅ done
//   4. Security badges (6)      ✅ done
//   5. Workflow steps (8)       ✅ done
//   6. FAQ (10 questions)       ✅ done
//   7. Restricted access footer ✅ done

import { AdminActivityTicker } from '@/components/admin/landing/AdminActivityTicker';
import { AdminFaq } from '@/components/admin/landing/AdminFaq';
import { AdminFoot } from '@/components/admin/landing/AdminFoot';
import { AdminModules } from '@/components/admin/landing/AdminModules';
import { AdminPreviewConsole } from '@/components/admin/landing/AdminPreviewConsole';
import { AdminSecurity } from '@/components/admin/landing/AdminSecurity';
import { AdminWorkflow } from '@/components/admin/landing/AdminWorkflow';

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
          Semua 7 section sudah di-migrate. Visual parity check di sini sebelum
          rewrite <code className="font-mono">/admin</code> di-flip ke React.
        </p>
      </header>

      <AdminActivityTicker />
      <AdminModules />
      <AdminPreviewConsole />
      <AdminSecurity />
      <AdminWorkflow />
      <AdminFaq />
      <AdminFoot />
    </main>
  );
}
