import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Phase 7b (2026-05-21): middleware aktif untuk refresh Supabase auth cookie
// pada setiap request ke route React (kecuali static assets dan legacy bundle).
// Server Components (mis. app/dashboard/page.tsx) baca session via
// lib/supabase/server.ts — kalau cookie tidak fresh, baca = anonim.
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip _next internals, static images, dan legacy bundle (legacy auth
    // pakai localStorage, nggak butuh Supabase cookie refresh).
    '/((?!_next/static|_next/image|favicon.ico|legacy/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
