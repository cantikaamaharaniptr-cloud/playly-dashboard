// Auth bridge endpoint — Phase B1+B2 (2026-05-22).
//
// Legacy auth (public/legacy/supabase-auth-bridge.js) POST kredensial +
// profile metadata ke sini setelah legacy signin/signup success.
// Endpoint:
//   1. Signin/signup ke Supabase Auth → akun di auth.users (B1)
//   2. Upsert profile row di public.profiles (B2)
//
// Goal: legacy UI utuh, backend = Supabase. Tahap berikut (B3-B5) shift
// state data + switch primary source ke Supabase.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type BridgeBody = {
  email?: string;
  password?: string;
  name?: string;
  username?: string;
  tier?: string;
  bio?: string;
  avatar?: string;
  joined_at?: string;
};

// POST — signin (fallback signup kalau akun belum ada di Supabase).
// Setelah auth sukses, upsert profile row.
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

  // 1. Auth flow — try signin, fallback signup
  let action: 'signin' | 'signup' = 'signin';
  const { error: signinErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signinErr) {
    // Akun belum ada → signUp
    const { error: signupErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: name ? { name } : {} },
    });
    if (signupErr) {
      return NextResponse.json(
        { ok: false, error: signupErr.message },
        { status: 401 },
      );
    }
    // signUp sukses → signin lagi supaya cookie ter-set
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
    action = 'signup';
  }

  // 2. Profile upsert (B2) — non-fatal, log only kalau gagal
  let profileSynced = false;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser?.id) {
      const profileData = buildProfileData(authUser.id, email, body);
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });
      if (profileErr) {
        // Schema-missing error → tabel belum di-create. Bukan fatal — auth tetap jalan.
        if (profileErr.code === '42P01' || /relation/.test(profileErr.message)) {
          console.warn('[bridge] profiles table belum di-apply (run migration 0004)');
        } else if (profileErr.code === '23505') {
          // Unique constraint (username) — retry tanpa username
          delete (profileData as { username?: string }).username;
          const { error: retryProfileErr } = await supabase
            .from('profiles')
            .upsert(profileData, { onConflict: 'id' });
          if (!retryProfileErr) profileSynced = true;
          else console.warn('[bridge] profile upsert retry failed:', retryProfileErr.message);
        } else {
          console.warn('[bridge] profile upsert failed:', profileErr.message);
        }
      } else {
        profileSynced = true;
      }
    }
  } catch (err) {
    console.warn('[bridge] profile sync exception:', err);
  }

  return NextResponse.json({ ok: true, action, profileSynced });
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

function buildProfileData(
  id: string,
  email: string,
  body: BridgeBody,
): Record<string, unknown> {
  const tier = body.tier === 'premium' ? 'premium' : 'free';
  const data: Record<string, unknown> = {
    id,
    email,
    name: body.name?.trim() || null,
    bio: body.bio?.trim() || '',
    avatar_url: body.avatar?.trim() || null,
    tier,
  };
  if (body.username?.trim()) data.username = body.username.trim().toLowerCase();
  if (body.joined_at) data.joined_at = body.joined_at;
  return data;
}
