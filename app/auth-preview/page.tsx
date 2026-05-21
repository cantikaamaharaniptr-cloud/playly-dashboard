// Phase 6 preview route — 2-column auth screen (showcase left + auth card right).
// NOT routed at / or /admin yet (rewrite still serves legacy). Swap saat semua
// flow complete: signin ✓, signup ✓ (single-step), forgot-pw, admin variant.
//
// Phase 6 progress:
//   session 1 ✅ SignInForm (email + password, Supabase wired)
//   session 2 ✅ Auth-grid 2-column + SignUpForm single-step + tab switcher
//   pending: Sign-up 4-step stepper (Profile→Username→Account→Done)
//   pending: Forgot password flow
//   pending: Admin auth-left panel variant
//   pending: Animated dashboard preview frame (auth-hero-preview)

import { AuthCard } from '@/components/auth/AuthCard';
import { AuthShowcase } from '@/components/auth/AuthShowcase';

export const metadata = {
  title: 'Playly — Auth Preview',
  robots: { index: false, follow: false },
};

export default function AuthPreviewPage() {
  return (
    <main className="min-h-screen bg-ink text-cream">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
        {/* LEFT: Showcase */}
        <AuthShowcase />

        {/* RIGHT: Form card */}
        <div className="grid place-items-center bg-ink-elev/30 p-6 sm:p-10">
          <div className="w-full max-w-md space-y-5">
            <header className="text-center lg:hidden">
              <p className="text-xs uppercase tracking-widest text-cream-soft/70">
                Phase 6 · Auth Preview
              </p>
            </header>
            <AuthCard />
            <p className="text-center text-[11px] text-cream-muted">
              Form wired ke Supabase. Setelah env vars di-set, sign-in dan
              sign-up real.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
