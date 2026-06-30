// Auth verify endpoint — Phase B6b P1 (2026-05-25 v545).
//
// STRICT signin-only check terhadap Supabase Auth, TANPA fallback signup
// dan TANPA persist session/cookie. Dipakai legacy login flow untuk
// telemetri parallel-verify: setelah local SHA-256 verify pass, panggil
// endpoint ini paralel → log apakah Supabase setuju.
//
// Phase B6b roadmap:
//   P1 (this endpoint): observe agreement rate, zero behavior change
//   P2: bridge-primary, local SHA-256 jadi fallback
//   P3: drop SHA-256 entirely
//
// Beda dari /api/auth/bridge:
//   - /bridge POST: signin → fallback signup → set cookie (state-mutating)
//   - /verify POST: signin only → response only (no cookie, no signup)
//
// Response:
//   200 { ok: true, verified: true }                   — Supabase setuju
//   200 { ok: true, verified: false, reason: "..." }   — kredensial salah / akun blm ada
//   503 { ok: false, error: "supabase_unavailable" }   — env hilang / network down
//   400 { ok: false, error: "missing_credentials" }    — body invalid

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { jsonError, jsonOk } from '@/lib/api/responses';

type VerifyBody = {
  email?: string;
  password?: string;
};

export async function POST(req: Request) {
  let body: VerifyBody;
  try {
    body = await req.json();
  } catch {
    return jsonError('bad_json', 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) {
    return jsonError('missing_credentials', 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return jsonError('supabase_unavailable', 503);
  }

  // Stateless client: persistSession=false memastikan token hasil signin
  // nggak di-cache/di-write ke cookie/storage. Cuma untuk verify response.
  // autoRefreshToken=false skip background refresh logic yang nggak relevan
  // di server-side ephemeral call.
  const supa = createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supa.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Jangan bocor pesan error mentah ke client — Supabase return generic
    // "Invalid login credentials" untuk wrong-password DAN no-account.
    // Telemetri tetap punya status via response.
    const msg = (error.message || '').toLowerCase();
    let reason: string = 'invalid';
    if (msg.includes('invalid login')) reason = 'wrong_or_missing';
    else if (msg.includes('email not confirmed')) reason = 'email_unconfirmed';
    else if (msg.includes('rate')) reason = 'rate_limited';
    return jsonOk({ verified: false, reason });
  }

  // signin sukses → discard session (kita gak persist). Cuma return verified.
  // Defensive: signOut di stateless client = no-op (no session to clear)
  // tapi panggil supaya pasti gak ada token lingering di memory.
  try {
    await supa.auth.signOut();
  } catch {
    /* ignore — stateless, ga ada cookie */
  }

  return jsonOk({
    verified: true,
    userId: data.user?.id || null,
  });
}
