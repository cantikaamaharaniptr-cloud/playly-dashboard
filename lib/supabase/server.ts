// Server-side Supabase client untuk Next.js Route Handlers.
// Phase B1 (2026-05-22): backend migration foundation — dipakai
// /api/auth/bridge untuk sync legacy auth ke Supabase auth.users.
//
// Defensive: kalau env vars NEXT_PUBLIC_SUPABASE_URL / ANON_KEY hilang
// di runtime, throw explicit error supaya gampang di-debug dari Vercel logs.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY di Vercel.',
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component → cookies read-only di sana. Route Handler boleh
          // tulis cookie. Try/catch jaga-jaga kalau caller bukan handler.
        }
      },
    },
  });
}
