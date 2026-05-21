// Supabase auth session refresh — called from root middleware.ts on every
// matching request so the auth cookie stays current.
//
// Defensive: kalau env vars hilang ATAU Supabase init/fetch error apapun
// terjadi, JANGAN crash request. Return next response unchanged — page
// downstream akan baca session = null & gracefully render landing.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Env vars belum di-set di Vercel (mis. first deploy sebelum config).
  // Lewati session refresh — request lanjut tanpa cookie update.
  if (!url || !key) {
    return response;
  }

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    await supabase.auth.getUser();
  } catch (err) {
    // Network error, invalid token, Supabase down, atau apapun — JANGAN
    // crash request. Log untuk debugging, lalu lanjut.
    console.error('[middleware] supabase session refresh failed:', err);
  }

  return response;
}
