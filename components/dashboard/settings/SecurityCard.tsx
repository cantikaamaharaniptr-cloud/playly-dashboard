'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { SettingsSection } from './SettingsSection';

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }
  | { kind: 'success' };

export function SecurityCard() {
  const { user, ready } = useAuth();
  const [state, setState] = useState<SendState>({ kind: 'idle' });

  async function handleSendReset() {
    if (!ready || !user?.email) {
      setState({ kind: 'error', message: 'Belum login atau email kosong.' });
      return;
    }
    setState({ kind: 'sending' });
    try {
      const supabase = createClient();
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/reset`
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
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

  const sending = state.kind === 'sending';

  return (
    <SettingsSection
      title="Keamanan"
      description="Atur password & lihat sesi aktif kamu."
    >
      <div className="rounded-md border border-cream/10 bg-ink/30 p-4">
        <h3 className="m-0 text-sm font-bold text-cream">Ganti password</h3>
        <p className="mt-1 text-xs text-cream-soft">
          Kami akan kirim link reset ke <b>{user?.email ?? '—'}</b>. Klik link
          itu lalu set password baru.
        </p>

        {state.kind === 'error' ? (
          <div
            role="alert"
            className="mt-3 rounded-md border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-xs text-status-danger"
          >
            {state.message}
          </div>
        ) : null}

        {state.kind === 'success' ? (
          <div
            role="status"
            className="mt-3 rounded-md border border-status-success/40 bg-status-success/10 px-3 py-2 text-xs text-status-success"
          >
            ✓ Reset link dikirim ke {user?.email}. Cek inbox & folder spam.
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSendReset}
          disabled={sending}
          className="mt-3 rounded-md border border-cream/20 bg-transparent px-4 py-2 text-xs font-semibold text-cream-soft transition-colors hover:bg-cream/5 hover:text-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'Send reset link'}
        </button>
      </div>

      <div className="rounded-md border border-dashed border-cream/15 bg-ink/30 p-4">
        <h3 className="m-0 text-sm font-bold text-cream-soft">
          2FA & Active sessions
        </h3>
        <p className="mt-1 text-xs text-cream-muted">
          Two-factor authentication dan list sesi aktif akan dibangun di
          session berikutnya.
        </p>
      </div>
    </SettingsSection>
  );
}
