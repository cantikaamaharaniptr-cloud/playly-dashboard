// Phase 6 preview route — admin variant of auth screen.
// Mirror of /auth-preview but with admin showcase (chrome silver brand,
// "Administrators Only" pill, ops stats). Sama AuthCard di kanan (signin
// flow sama persis di Supabase level — admin lock & role enforcement
// dilakukan SETELAH signin, di middleware/server check Phase 7).
//
// NOT routed at /admin yet — legacy /admin masih jalan via rewrite.

import { AdminAuthShowcase } from '@/components/auth/AdminAuthShowcase';
import { AuthCard } from '@/components/auth/AuthCard';

export const metadata = {
  title: 'Playly Admin — Auth Preview',
  robots: { index: false, follow: false },
};

export default function AdminAuthPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-bg text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
        <AdminAuthShowcase />
        <div className="grid place-items-center bg-slate-elev/30 p-6 sm:p-10">
          <div className="w-full max-w-md space-y-5">
            <header className="text-center lg:hidden">
              <p className="text-xs uppercase tracking-widest text-slate-accent/70">
                Phase 6 · Admin Auth Preview
              </p>
            </header>
            <AuthCard />
            <p className="text-center text-[11px] text-slate-accent/70">
              Form wired ke Supabase. Admin role check + lock akan
              dilakukan di server-side middleware Phase 7.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
