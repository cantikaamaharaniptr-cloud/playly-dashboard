'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success' };

export function SignInForm() {
  const { ready } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
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
    if (!email || !password) {
      setState({ kind: 'error', message: 'Email dan password wajib diisi.' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setState({ kind: 'error', message: error.message });
        return;
      }
      setState({ kind: 'success' });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Sign-in gagal.',
      });
    }
  }

  const submitting = state.kind === 'submitting';

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-4 rounded-[20px] border border-cream/15 bg-ink-elev/70 p-7 shadow-playly-md"
      noValidate
    >
      <header>
        <h2 className="m-0 text-xl font-extrabold text-cream">Sign In</h2>
        <p className="mt-1 text-sm text-cream-soft">
          Welcome back. Masuk untuk lanjut ke dashboard kamu.
        </p>
      </header>

      {!ready ? (
        <div className="rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          ⚠ Supabase belum ready. Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
          dan <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di Vercel, lalu
          redeploy. Form di bawah tetap render tapi submit akan no-op.
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
            autoComplete="username"
            required
            disabled={submitting}
            className="w-full rounded-md border border-cream/20 bg-ink/40 px-3 py-2.5 pl-10 text-sm text-cream placeholder:text-cream-muted/60 focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/30 disabled:opacity-60"
          />
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-cream-soft">Password</span>
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
            type={showPw ? 'text' : 'password'}
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 6 characters"
            autoComplete="current-password"
            required
            minLength={6}
            disabled={submitting}
            className="w-full rounded-md border border-cream/20 bg-ink/40 px-3 py-2.5 pl-10 pr-10 text-sm text-cream placeholder:text-cream-muted/60 focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/30 disabled:opacity-60"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-cream-muted hover:text-cream"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              {showPw ? (
                <>
                  <path d="m3 3 18 18" />
                  <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                  <path d="M9.4 5.2A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7-.5 1-1.2 1.9-2 2.7" />
                  <path d="M6.7 6.7C3.7 8.7 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.6-1.2" />
                </>
              ) : (
                <>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
      </label>

      <div className="flex items-center justify-between text-xs">
        <label className="inline-flex cursor-pointer items-center gap-2 text-cream-soft">
          <input
            type="checkbox"
            defaultChecked
            className="h-3.5 w-3.5 rounded border-cream/30 accent-wine"
          />
          <span>Remember me</span>
        </label>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="font-semibold text-cream-soft hover:text-cream hover:underline"
        >
          Forgot password?
        </a>
      </div>

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
          ✓ Sign-in sukses. Redirect ke dashboard nanti diaktifin saat dashboard
          route ready.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-wine px-6 py-3 text-sm font-bold text-cream shadow-playly-md transition-colors hover:bg-wine-hover disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? 'Signing in…' : 'Sign In Now'}
      </button>

      <p className="text-center text-xs text-cream-soft">
        Don&apos;t have an account?{' '}
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="font-semibold text-cream hover:underline"
        >
          Register free
        </a>
      </p>
    </form>
  );
}
