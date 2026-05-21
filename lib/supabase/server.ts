// Server-side Supabase client. Use in Server Components, Route Handlers,
// and Server Actions. Reads & refreshes the auth cookie via next/headers.
//
// Defensive: kalau env vars hilang, return null. Caller wajib handle
// null (mostly: assume logged-out → render landing).

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.',
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
          // setAll dipanggil dari Server Component — cookies di sana
          // read-only. Middleware sudah refresh, jadi aman di-abaikan.
        }
      },
    },
  });
}
