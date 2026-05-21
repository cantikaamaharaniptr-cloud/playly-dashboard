// Dashboard home — Beranda. Phase 7b session 1: placeholder. Future
// session: ranking, recent videos, KPI tiles, dst.

import { getUser } from '@/lib/auth/guard';

export const metadata = {
  title: 'Playly — Beranda',
};

export default async function DashboardHome() {
  const user = await getUser();
  const display = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Creator';

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-cream-muted">
          Beranda
        </p>
        <h1 className="mt-1 text-3xl font-bold text-cream">
          Hi, {display} 👋
        </h1>
        <p className="mt-1 text-sm text-cream-soft">
          Welcome back to your Playly dashboard.
        </p>
      </header>

      <div className="rounded-[14px] border border-dashed border-cream/20 bg-ink-elev/40 p-10 text-center">
        <p className="text-sm font-semibold text-cream-soft">
          Dashboard content akan dibangun di session berikutnya.
        </p>
        <p className="mt-2 text-xs text-cream-muted">
          Sidebar nav sudah ready — klik tiap item untuk navigate (page-page
          itu masih 404 sampai dibangun).
        </p>
      </div>
    </div>
  );
}
