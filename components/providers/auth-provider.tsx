'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

// Hardcoded admin allowlist — port dari public/legacy/script.js (OFFICIAL_ADMIN_EMAIL
// + ADMIN_EMAILS_PROTECTED). Sync kalau allowlist legacy berubah.
const ADMIN_EMAILS: ReadonlySet<string> = new Set([
  // Phase 3: starter list kosong. Saat first admin login flow di-migrate
  // (Phase 4), port list dari legacy script.js (~line 380-420).
]);

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  ready: boolean; // env vars present & supabase client wired
};

const initialState: AuthState = {
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  ready: false,
};

const AuthContext = createContext<AuthState>(initialState);

function detectAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase();
  if (email && ADMIN_EMAILS.has(email)) return true;
  const meta = user.user_metadata as { role?: string } | undefined;
  const appMeta = user.app_metadata as { role?: string } | undefined;
  return meta?.role === 'admin' || appMeta?.role === 'admin';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      // Env vars belum di-set (umum saat first deploy Phase 3 di Vercel).
      // No-op mode — provider expose null user, ready=false. UI bisa
      // gracefully degrade.
      setState({ ...initialState, loading: false, ready: false });
      return;
    }

    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data.session;
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
        isAdmin: detectAdmin(session?.user),
        ready: true,
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
        isAdmin: detectAdmin(session?.user),
        ready: true,
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
