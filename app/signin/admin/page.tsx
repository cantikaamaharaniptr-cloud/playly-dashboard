// Admin sign-in. Sama AuthCard di kanan (Supabase auth shared), beda
// showcase di kiri (chrome silver, restricted, monitoring ticker).
// Role check + admin lock dijalankan SETELAH signin di server-side
// (lib/auth/guard.detectAdmin) — kalau bukan admin, redirect ke /dashboard
// biasa.

import { AdminAuthShowcase } from '@/components/auth/AdminAuthShowcase';
import { AuthCard } from '@/components/auth/AuthCard';
import { requireAnon } from '@/lib/auth/guard';

export const metadata = {
  title: 'Playly — Admin Sign In',
};

export default async function AdminSignInPage() {
  await requireAnon('/dashboard');

  return (
    <main className="min-h-screen bg-slate-bg text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
        <AdminAuthShowcase />
        <div className="grid place-items-center bg-slate-elev/30 p-6 sm:p-10">
          <div className="w-full max-w-md">
            <AuthCard />
          </div>
        </div>
      </div>
    </main>
  );
}
