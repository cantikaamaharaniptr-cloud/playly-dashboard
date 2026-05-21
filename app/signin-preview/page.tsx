// Phase 6 preview route — auth screen sign-in form.
// NOT routed at / or /admin (rewrite still serves legacy). Once full auth
// screen (signin + signup + admin variant) migrate & visual parity ok,
// swap rewrites.
//
// Phase 6 progress:
//   ✅ session 1: SignIn form (email + password, Supabase wired)
//   pending: Sign-up multi-step form
//   pending: Forgot password flow
//   pending: Admin auth-left panel variant
//   pending: Auth-grid 2-column layout (showcase left + form right)
//   pending: Lock banner (account lockout countdown)

import { SignInForm } from '@/components/auth/SignInForm';

export const metadata = {
  title: 'Playly — Sign In Preview',
  robots: { index: false, follow: false },
};

export default function SignInPreviewPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink px-4 py-12 text-cream">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <p className="text-xs uppercase tracking-widest text-cream-soft/70">
            Phase 6 · Auth Preview
          </p>
          <h1 className="mt-1 text-3xl font-bold">Playly</h1>
        </header>

        <SignInForm />

        <footer className="text-center text-xs text-cream-muted">
          Form ini wired ke Supabase auth. Form-nya jalan tanpa env vars
          (defensive guard), tapi submit hanya berhasil setelah{' '}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_*</code> di-set di
          Vercel.
        </footer>
      </div>
    </main>
  );
}
