// User state sync endpoint — Phase B3 (2026-05-25).
//
// Legacy `saveState()` di public/legacy/script.js (lewat
// supabase-auth-bridge.syncState) → debounced POST blob ke sini →
// upsert ke public.user_state.
//
// Sumber kebenaran tetap localStorage (B3 dual-write). B4 akan switch
// primary read ke endpoint ini.
//
// GET — ambil state milik user yang sedang login (foundation B4).
// POST — upsert state blob untuk user yang sedang login.
//
// Auth wajib (cookie session). Tanpa cookie → 401.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Hard cap blob size — defense terhadap localStorage yang membengkak
// (mis. user upload banyak myVideos dengan thumbnail base64).
// 2 MB cukup untuk profile aktif normal, di atas itu ada masalah lain
// (pakai storage bucket, jangan dump ke jsonb).
const MAX_STATE_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  let body: { state?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  if (!body || typeof body.state !== 'object' || body.state === null) {
    return NextResponse.json(
      { ok: false, error: 'missing_state' },
      { status: 400 },
    );
  }

  // Quick size guard sebelum hit Supabase.
  const stateStr = JSON.stringify(body.state);
  if (stateStr.length > MAX_STATE_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'state_too_large', size: stateStr.length, max: MAX_STATE_BYTES },
      { status: 413 },
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

  const {
    data: { user: authUser },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !authUser?.id) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 });
  }

  const { error: upsertErr } = await supabase
    .from('user_state')
    .upsert({ user_id: authUser.id, state: body.state }, { onConflict: 'user_id' });

  if (upsertErr) {
    // Schema-missing → tabel belum di-apply. Non-fatal di sisi client
    // (legacy tetap baca localStorage), tapi log eksplisit.
    if (upsertErr.code === '42P01' || /relation/.test(upsertErr.message)) {
      console.warn('[state/sync] user_state table belum di-apply (run migration 0005)');
      return NextResponse.json(
        { ok: false, error: 'schema_missing' },
        { status: 503 },
      );
    }
    console.warn('[state/sync] upsert failed:', upsertErr.message);
    return NextResponse.json(
      { ok: false, error: upsertErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, size: stateStr.length });
}

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'supabase_unavailable' },
      { status: 503 },
    );
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_state')
    .select('state, updated_at')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01' || /relation/.test(error.message)) {
      return NextResponse.json(
        { ok: false, error: 'schema_missing' },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    state: data?.state ?? null,
    updated_at: data?.updated_at ?? null,
  });
}
