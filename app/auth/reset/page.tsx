// Reset password destination — landed dari email link yang dikirim
// ForgotPasswordForm via supabase.auth.resetPasswordForEmail dengan
// redirectTo=/auth/reset. URL hash punya access_token + refresh_token +
// type=recovery. Supabase client auto-pick di mount, fire PASSWORD_RECOVERY
// event di onAuthStateChange. ResetPasswordForm listen & enable form.

import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata = {
  title: 'Playly — Reset Password',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink px-4 py-12 text-cream">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <p className="text-xs uppercase tracking-widest text-cream-soft/70">
            Playly · Reset Password
          </p>
          <h1 className="mt-1 text-3xl font-bold">Playly</h1>
        </header>

        <ResetPasswordForm />
      </div>
    </main>
  );
}
