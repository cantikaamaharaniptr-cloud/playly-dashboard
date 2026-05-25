// Auth bridge endpoint — Phase B1 (2026-05-22).
//
// Legacy auth (public/legacy/supabase-auth-bridge.js) POST email+password
// ke sini setelah legacy signin/signup success. Endpoint sign-in ke
// Supabase via @supabase/ssr server client → akun ke-create/sync di
// `auth.users` (server-side, hash bcrypt), bukan cuma localStorage hash.
//
// Goal Phase B1: legacy UI utuh, tapi akun ke-mirror di Supabase Auth.
// Tahap berikut (B2-B5) shift profile/state data juga ke Supabase tables.
//
// Cookie set otomatis via @supabase/ssr — same-origin dari legacy → browser
// simpan. Future Next.js route bisa baca cookie buat auth-protected endpoint.

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

  // 1. Try signin — akun mungkin sudah ada (login berulang).
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
    // Kemungkinan email confirmation aktif. Per setup project-baru, sudah
    // OFF, tapi defensive log.
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
