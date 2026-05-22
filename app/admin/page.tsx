// Playly admin landing — replaces legacy /legacy/index.html (auth-mode +
// admin role). 2-column admin auth screen (chrome silver showcase +
// signin/signup card) lalu admin landing sections di bawah.
//
// Phase 7b: Server Component — admin yang sudah login redirect ke /dashboard
// (dashboard route handle role detection nantinya).

import { AdminActivityTicker } from '@/components/admin/landing/AdminActivityTicker';
import { AdminFaq } from '@/components/admin/landing/AdminFaq';
import { AdminFoot } from '@/components/admin/landing/AdminFoot';
import { AdminModules } from '@/components/admin/landing/AdminModules';
import { AdminPreviewConsole } from '@/components/admin/landing/AdminPreviewConsole';
import { AdminSecurity } from '@/components/admin/landing/AdminSecurity';
import { AdminWorkflow } from '@/components/admin/landing/AdminWorkflow';
import { AdminAuthShowcase } from '@/components/auth/AdminAuthShowcase';
import { AuthCard } from '@/components/auth/AuthCard';
import { requireAnon } from '@/lib/auth/guard';

// Baca cookie session (requireAnon) — selalu dynamic.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Playly. — Admin Login',
};

export default async function AdminPage() {
  await requireAnon('/dashboard');

  return (
    <main className="min-h-screen bg-slate-bg text-white">
      <section className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
        <AdminAuthShowcase />
        <div className="grid place-items-center bg-slate-elev/30 p-6 sm:p-10">
          <div className="w-full max-w-md">
            <AuthCard />
          </div>
        </div>
      </section>

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
