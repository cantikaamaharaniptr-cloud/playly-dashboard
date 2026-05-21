// Server-side auth helpers. Use in Server Components / Route Handlers /
// Server Actions untuk gate akses & redirect.
//
// Defensive: kalau Supabase client init gagal (env missing, dst), treat
// sebagai logged-out — no crash.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

// Hardcoded admin allowlist — mirror dari components/providers/auth-provider.tsx.
const ADMIN_EMAILS: ReadonlySet<string> = new Set([
  // Phase 7b starter: empty. Port dari legacy ADMIN_EMAILS_PROTECTED nanti.
]);

export function detectAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase();
  if (email && ADMIN_EMAILS.has(email)) return true;
  const meta = user.user_metadata as { role?: string } | undefined;
  const appMeta = user.app_metadata as { role?: string } | undefined;
  return meta?.role === 'admin' || appMeta?.role === 'admin';
}

// Get current Supabase user. Returns null kalau no session OR Supabase
// client gagal init (mis. env missing).
export async function getUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch (err) {
    console.error('[guard] getUser failed:', err);
    return null;
  }
}

// Require authenticated user. Redirect kalau no session.
export async function requireUser(redirectTo = '/'): Promise<User> {
  const user = await getUser();
  if (!user) redirect(redirectTo);
  return user;
}

// Require user NOT authenticated.
export async function requireAnon(redirectTo = '/dashboard'): Promise<void> {
  const user = await getUser();
  if (user) redirect(redirectTo);
}
