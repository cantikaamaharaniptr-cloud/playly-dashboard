import { NextResponse, type NextRequest } from 'next/server';

// PHASE 1: legacy bundle still uses localStorage auth, so the Supabase SSR
// session refresh isn't needed yet. Middleware is a no-op until Phase 3
// (Core providers) — at that point swap the body for `updateSession(request)`
// from `@/lib/supabase/middleware` and ensure NEXT_PUBLIC_SUPABASE_URL +
// NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Vercel.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Empty matcher so middleware never runs in Phase 1.
  matcher: [],
};
