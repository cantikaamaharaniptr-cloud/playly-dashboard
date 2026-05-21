// Playly user landing — replaces legacy /legacy/index.html (auth-mode + user
// role). 2-column auth screen di atas (showcase + signin/signup card) lalu
// landing marketing sections di bawah (Plans, Preview, How it works, FAQ,
// Final CTA).
//
// Phase 7b (2026-05-21): Server Component — kalau user sudah authenticated,
// redirect ke /dashboard sebelum render. Logged-out user lihat landing+auth.

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthShowcase } from '@/components/auth/AuthShowcase';
import { UserDashboardPreview } from '@/components/user/landing/UserDashboardPreview';
import { UserFaq } from '@/components/user/landing/UserFaq';
import { UserFinalCta } from '@/components/user/landing/UserFinalCta';
import { UserHowItWorks } from '@/components/user/landing/UserHowItWorks';
import { UserPlans } from '@/components/user/landing/UserPlans';
import { requireAnon } from '@/lib/auth/guard';

export default async function HomePage() {
  await requireAnon('/dashboard');

  return (
    <main className="min-h-screen bg-ink text-cream">
      <section className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
        <AuthShowcase />
        <div className="grid place-items-center bg-ink-elev/30 p-6 sm:p-10">
          <div className="w-full max-w-md">
            <AuthCard />
          </div>
        </div>
      </section>

      <UserPlans />
      <UserDashboardPreview />
      <UserHowItWorks />
      <UserFaq />
      <UserFinalCta />
    </main>
  );
}
