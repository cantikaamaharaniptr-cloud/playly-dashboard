// Sign-in entry point untuk Next.js dashboard. Mirror layout legacy auth
// screen (2-column showcase + auth card). Redirect ke /dashboard kalau
// sudah login.
//
// Pattern URL:
//   /signin       → user auth (wine theme)
//   /signin/admin → admin auth (chrome theme) — see app/signin/admin/page.tsx

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthShowcase } from '@/components/auth/AuthShowcase';
import { requireAnon } from '@/lib/auth/guard';

export const metadata = {
  title: 'Playly — Sign In',
};

export default async function SignInPage() {
  await requireAnon('/dashboard');

  return (
    <main className="min-h-screen bg-ink text-cream">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
        <AuthShowcase />
        <div className="grid place-items-center bg-ink-elev/30 p-6 sm:p-10">
          <div className="w-full max-w-md">
            <AuthCard />
          </div>
        </div>
      </div>
    </main>
  );
}
