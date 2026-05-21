// Server-side auth helpers. Use in Server Components / Route Handlers /
// Server Actions untuk gate akses & redirect.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

// Hardcoded admin allowlist — mirror dari components/providers/auth-provider.tsx.
// Sync saat allowlist berubah.
const ADMIN_EMAILS: ReadonlySet<string> = new Set([
  // Phase 7b starter: empty. Port dari legacy script.js (ADMIN_EMAILS_PROTECTED
  // ~L380-420) saat first admin migration touch.
]);

export function detectAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase();
  if (email && ADMIN_EMAILS.has(email)) return true;
  const meta = user.user_metadata as { role?: string } | undefined;
  const appMeta = user.app_metadata as { role?: string } | undefined;
  return meta?.role === 'admin' || appMeta?.role === 'admin';
}

// Get current Supabase user from Server Component / Route Handler.
// Returns null if no session.
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// Require authenticated user. Redirect to /redirectTo (default `/`) if no
// session. Use as the first line in Server Components that need auth.
export async function requireUser(redirectTo = '/'): Promise<User> {
  const user = await getUser();
  if (!user) redirect(redirectTo);
  return user;
}

// Require user NOT authenticated (use on public landing/auth pages — redirect
// logged-in users to their dashboard).
export async function requireAnon(redirectTo = '/dashboard'): Promise<void> {
  const user = await getUser();
  if (user) redirect(redirectTo);
}
