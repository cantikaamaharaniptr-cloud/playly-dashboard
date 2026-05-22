// Auth bridge endpoint — Phase 7b (2026-05-22).
//
// Legacy auth (public/legacy/supabase-auth-bridge.js) POST email+password
// ke sini setelah legacy signin/signup success. Endpoint ini sign-in ke
// Supabase via @supabase/ssr server client → session ter-tulis ke COOKIE
// (bukan localStorage). Karena same-origin (playly-dashboard.vercel.app),
// cookie ke-set di browser → Next.js /dashboard auth-gate (yang baca
// cookie via middleware + Server Components) lulus.
//
// Kenapa nggak langsung pakai CDN supabase-js di legacy: supabase-js
// standalone simpan session di localStorage, sedangkan @supabase/ssr
// (dipakai Next.js) baca cookie. Beda storage → /dashboard nggak lihat
// session. Route ini jembatannya.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type BridgeBody = {
  email?: string;
  password?: string;
  name?: string;
};

// POST — signin (fallback signup kalau akun belum ada di Supabase).
export async function POST(req: Request) {
  let body: BridgeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const name = (body.name || '').trim();

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: 'missing_credentials' },
      { status: 400 },
    );
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'supabase_unavailable' },
      { status: 503 },
    );
  }

  // 1. Coba signin — akun mungkin sudah ada di Supabase (login berulang).
  const { error: signinErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (!signinErr) {
    return NextResponse.json({ ok: true, action: 'signin' });
  }

  // 2. Akun belum ada → signUp dengan kredensial yang sama.
  const { error: signupErr } = await supabase.auth.signUp({
    email,
    password,
    options: { data: name ? { name } : {} },
  });
  if (signupErr) {
    // "User already registered" tapi signin di atas gagal = password beda
    // antara legacy & Supabase. Bukan fatal — legacy auth tetap jalan.
    return NextResponse.json(
      { ok: false, error: signupErr.message },
      { status: 401 },
    );
  }

  // 3. signUp sukses → signin lagi supaya session/cookie ter-set.
  const { error: retryErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (retryErr) {
    return NextResponse.json(
      { ok: false, error: retryErr.message },
      { status: 401 },
    );
  }
  return NextResponse.json({ ok: true, action: 'signup' });
}

// DELETE — signout (clear Supabase cookie).
export async function DELETE() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // ignore — cookie mungkin sudah nggak ada
  }
  return NextResponse.json({ ok: true });
}
