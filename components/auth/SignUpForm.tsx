'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';

// Phase 6 session 2: single-step sign-up (name + email + password). Legacy
// has a 4-step stepper (Profile → Username → Account → Done) — port that
// in a future session when full UX is reproduced.

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; needsConfirm: boolean };

export function SignUpForm() {
  const { ready } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<SubmitState>({ kind: 'idle' });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready) {
      setState({
        kind: 'error',
        message:
          'Supabase env vars belum di-set di Vercel. Set NEXT_PUBLIC_SUPABASE_URL + ANON_KEY lalu redeploy.',
      });
      return;
    }
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || !password) {
      setState({ kind: 'error', message: 'Semua field wajib diisi.' });
      return;
    }
    if (password.length < 6) {
      setState({ kind: 'error', message: 'Password minimal 6 karakter.' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { name: trimmedName } },
      });
      if (error) {
        setState({ kind: 'error', message: error.message });
        return;
      }
      // Supabase returns session=null when email-confirmation is enabled.
      const needsConfirm = !data.session;
      setState({ kind: 'success', needsConfirm });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Sign-up gagal.',
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
      <header>
        <h2 className="m-0 text-xl font-extrabold text-cream">
          Create new account
        </h2>
        <p className="mt-1 text-sm text-cream-soft">
          Start sharing your creation today.
        </p>
      </header>

      {!ready ? (
        <div className="rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          ⚠ Supabase belum ready. Set env vars di Vercel lalu redeploy.
        </div>
      ) : null}

      <Field
        label="Full Name"
        icon={
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </>
        }
      >
        <input
          type="text"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cantika Maharani"
          autoComplete="name"
          required
          minLength={2}
          disabled={submitting}
          className="w-full rounded-md border border-cream/20 bg-ink/40 px-3 py-2.5 pl-10 text-sm text-cream placeholder:text-cream-muted/60 focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/30 disabled:opacity-60"
        />
      </Field>

      <Field
        label="Email"
        icon={
          <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </>
        }
      >
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
      </Field>

      <Field
        label="Password"
        icon={
          <>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </>
        }
      >
        <input
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 6 characters"
          autoComplete="new-password"
          required
          minLength={6}
          disabled={submitting}
          className="w-full rounded-md border border-cream/20 bg-ink/40 px-3 py-2.5 pl-10 text-sm text-cream placeholder:text-cream-muted/60 focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/30 disabled:opacity-60"
        />
      </Field>

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
          {state.needsConfirm
            ? '✓ Sign-up sukses. Cek email kamu untuk konfirmasi.'
            : '✓ Sign-up sukses. Kamu sudah login.'}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-wine px-6 py-3 text-sm font-bold text-cream shadow-playly-md transition-colors hover:bg-wine-hover disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? 'Creating account…' : 'Create Account'}
      </button>

      <p className="text-center text-[11px] text-cream-muted">
        Dengan sign up, kamu setuju ke Terms &amp; Privacy Playly.
      </p>
    </form>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
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
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream-muted"
          aria-hidden="true"
        >
          {icon}
        </svg>
        {children}
      </div>
    </label>
  );
}
