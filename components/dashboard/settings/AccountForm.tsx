'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { SettingsField, SettingsSection } from './SettingsSection';

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'success' };

export function AccountForm() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const initialName =
    (user?.user_metadata as { name?: string } | undefined)?.name ?? '';
  const [name, setName] = useState(initialName);
  const [state, setState] = useState<SaveState>({ kind: 'idle' });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || !user) {
      setState({ kind: 'error', message: 'Belum login.' });
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setState({ kind: 'error', message: 'Nama minimal 2 karakter.' });
      return;
    }
    setState({ kind: 'saving' });
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { name: trimmed },
      });
      if (error) {
        setState({ kind: 'error', message: error.message });
        return;
      }
      setState({ kind: 'success' });
      router.refresh();
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Save gagal.',
      });
    }
  }

  const saving = state.kind === 'saving';

  return (
    <SettingsSection
      title="Akun"
      description="Info dasar akun kamu. Email tidak bisa diganti — buat akun baru kalau perlu email lain."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <SettingsField label="Email" hint="Read-only — terhubung ke akun Supabase">
          <input
            type="email"
            value={user?.email ?? ''}
            disabled
            className="rounded-md border border-cream/10 bg-ink/30 px-3 py-2.5 text-sm text-cream-muted"
          />
        </SettingsField>

        <SettingsField
          label="Nama tampilan"
          hint="Muncul di profil, komentar, dan greeting dashboard."
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cantika Maharani"
            minLength={2}
            disabled={saving}
            className="rounded-md border border-cream/20 bg-ink/40 px-3 py-2.5 text-sm text-cream placeholder:text-cream-muted/60 focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/30 disabled:opacity-60"
          />
        </SettingsField>

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
            ✓ Nama berhasil diupdate.
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || name.trim() === initialName.trim()}
            className="rounded-[10px] bg-wine px-5 py-2.5 text-sm font-bold text-cream shadow-playly-sm transition-colors hover:bg-wine-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </SettingsSection>
  );
}
