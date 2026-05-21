'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';

// Phase 6 session 3: email-link reset flow (modern Supabase pattern). User
// enters email, gets a reset link in email, clicks → lands on /auth/reset
// (separate route, to-be-built next session) where they set a new password.
//
// Legacy form let user set new password DIRECTLY (no email link) since legacy
// auth = localStorage. Migrating to email-link is more secure.

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success' };

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { ready } = useAuth();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready) {
      setState({
        kind: 'error',
        message: 'Supabase belum ready. Set env vars di Vercel dulu.',
      });
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setState({ kind: 'error', message: 'Email wajib diisi.' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      const supabase = createClient();
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/reset`
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (error) {
        setState({ kind: 'error', message: error.message });
        return;
      }
      setState({ kind: 'success' });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Gagal kirim reset link.',
      });
    }
  }

  const submitting = state.kind === 'submitting';

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-4"
      noValidate
    >
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-wine/15 text-lg">
          🔑
        </div>
        <div>
          <h2 className="m-0 text-xl font-extrabold text-cream">
            Reset Password
          </h2>
          <p className="mt-1 text-sm text-cream-soft">
            Masukin email akun kamu, kami kirim link reset ke inbox.
          </p>
        </div>
      </header>

      {!ready ? (
        <div className="rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          ⚠ Supabase belum ready. Set env vars di Vercel.
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-cream-soft">Email</span>
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream-muted"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            required
            disabled={submitting}
            className="w-full rounded-md border border-cream/20 bg-ink/40 px-3 py-2.5 pl-10 text-sm text-cream placeholder:text-cream-muted/60 focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/30 disabled:opacity-60"
          />
        </div>
      </label>

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
          ✓ Reset link sudah dikirim ke email kamu. Cek inbox (dan folder spam).
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="flex-1 rounded-[12px] border border-cream/20 bg-transparent px-4 py-3 text-sm font-bold text-cream-soft transition-colors hover:bg-cream/5 hover:text-cream disabled:opacity-60"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 inline-flex items-center justify-center rounded-[12px] bg-wine px-4 py-3 text-sm font-bold text-cream shadow-playly-md transition-colors hover:bg-wine-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Sending…' : 'Send Reset Link'}
        </button>
      </div>
    </form>
  );
}
