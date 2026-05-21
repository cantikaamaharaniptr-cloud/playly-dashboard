// Phase 5 preview route — new React-based user landing (pre-login marketing).
// All 5 sections migrated. NOT routed at / yet (rewrite still serves legacy).
// Swap to / once auth screen also migrates + visual parity verified.
//
// Sections progress (5/5 ✅):
//   1. Plans · Free + Premium cards  ✅ done
//   2. Dashboard preview mockup      ✅ done
//   3. How it works · 6 steps        ✅ done
//   4. FAQ · 10 questions            ✅ done
//   5. Final CTA + mini footer       ✅ done

import { UserDashboardPreview } from '@/components/user/landing/UserDashboardPreview';
import { UserFaq } from '@/components/user/landing/UserFaq';
import { UserFinalCta } from '@/components/user/landing/UserFinalCta';
import { UserHowItWorks } from '@/components/user/landing/UserHowItWorks';
import { UserPlans } from '@/components/user/landing/UserPlans';

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
          Semua 5 section sudah React. Live <code className="font-mono">/</code>{' '}
          masih legacy sampai auth screen juga ready.
        </p>
      </header>

      <UserPlans />
      <UserDashboardPreview />
      <UserHowItWorks />
      <UserFaq />
      <UserFinalCta />
    </main>
  );
}
