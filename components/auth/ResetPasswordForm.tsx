'use client';

// Reset password destination — user lands here after clicking the email
// reset link from ForgotPasswordForm. Supabase JS client auto-picks tokens
// from URL hash on mount (detectSessionInUrl default), fires
// PASSWORD_RECOVERY event in onAuthStateChange. Then user submits new
// password → supabase.auth.updateUser({ password }).
//
// Also handles "already logged in & wants to change password" case —
// updateUser works for any authenticated session.

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success' };

export function ResetPasswordForm() {
  const { ready, user, loading } = useAuth();
  const [recoveryEvent, setRecoveryEvent] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  useEffect(() => {
    if (!ready) return;
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryEvent(true);
    });
    return () => data.subscription.unsubscribe();
  }, [ready]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready) {
      setState({ kind: 'error', message: 'Supabase belum ready.' });
      return;
    }
    if (!password || !password2) {
      setState({ kind: 'error', message: 'Semua field wajib diisi.' });
      return;
    }
    if (password !== password2) {
      setState({ kind: 'error', message: 'Konfirmasi password tidak cocok.' });
      return;
    }
    if (password.length < 6) {
      setState({ kind: 'error', message: 'Password minimal 6 karakter.' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setState({ kind: 'error', message: error.message });
        return;
      }
      setState({ kind: 'success' });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Update password gagal.',
      });
    }
  }

  const submitting = state.kind === 'submitting';
  // Has either: explicit PASSWORD_RECOVERY event OR a normal authenticated session
  const canReset = recoveryEvent || (!loading && user !== null);

  if (loading || !ready) {
    return (
      <div className="w-full max-w-md rounded-[20px] border border-cream/15 bg-ink-elev/70 p-7 text-sm text-cream-soft shadow-playly-md">
        <div className="text-center">Loading…</div>
      </div>
    );
  }

  if (!canReset) {
    return (
      <div className="w-full max-w-md rounded-[20px] border border-status-warning/40 bg-ink-elev/70 p-7 shadow-playly-md">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-status-warning/15 text-lg">
            ⚠
          </div>
          <div>
            <h2 className="m-0 text-base font-bold text-cream">
              Reset link invalid atau expired
            </h2>
            <p className="mt-1 text-xs text-cream-soft">
              Link reset password sudah expired atau kamu langsung buka halaman
              ini tanpa klik link dari email. Coba request reset ulang dari
              halaman sign-in.
            </p>
            <a
              href="/auth-preview"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cream hover:underline"
            >
              ← Kembali ke Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-4 rounded-[20px] border border-cream/15 bg-ink-elev/70 p-7 shadow-playly-md"
      noValidate
    >
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-wine/15 text-lg">
          🔑
        </div>
        <div>
          <h2 className="m-0 text-xl font-extrabold text-cream">
            Set Password Baru
          </h2>
          <p className="mt-1 text-sm text-cream-soft">
            Pilih password baru. Setelah submit, kamu otomatis login.
          </p>
        </div>
      </header>

      <Field label="Password Baru" name="password" value={password} setValue={setPassword} disabled={submitting} />
      <Field label="Konfirmasi Password" name="password2" value={password2} setValue={setPassword2} disabled={submitting} />

      {state.kind === 'error' ? (
        <div
          role="alert"
          className="rounded-md border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-xs text-status-danger"
        >
          {state.message}
        </div>
      ) : null}

      {state.kind === 'success' ? (
        <div
          role="status"
          className="rounded-md border border-status-success/40 bg-status-success/10 px-3 py-2 text-xs text-status-success"
        >
          ✓ Password berhasil diupdate. Kamu sudah login.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-[12px] bg-wine px-6 py-3 text-sm font-bold text-cream shadow-playly-md transition-colors hover:bg-wine-hover disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? 'Updating…' : 'Set Password'}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  setValue,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  setValue: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-cream-soft">{label}</span>
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream-muted"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <input
          type="password"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Min. 6 characters"
          autoComplete="new-password"
          required
          minLength={6}
          disabled={disabled}
          className="w-full rounded-md border border-cream/20 bg-ink/40 px-3 py-2.5 pl-10 text-sm text-cream placeholder:text-cream-muted/60 focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/30 disabled:opacity-60"
        />
      </div>
    </label>
  );
}
