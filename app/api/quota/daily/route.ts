// Daily quota status endpoint — phase Penyimpanan-User (2026-05-29).
//
// GET /api/quota/daily
//   200 { ok: true, tier, quotaBytes, usedBytes, remainingBytes, resetAt }
//   401 { ok: false, error: 'not_authenticated' }
//   503 { ok: false, error: 'supabase_unavailable' | 'query_failed' }
//
// Dipakai legacy frontend (script.js) untuk render sidebar storage indicator
// dan storage page dengan angka otoritatif (cross-device aware), bukan cuma
// hitung dari local state.myVideos.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDailyQuotaStatus } from '@/lib/quota/daily';

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

  try {
    const status = await getDailyQuotaStatus(supabase, authUser.id);
    // Reset 00:00 UTC besok.
    const reset = new Date();
    reset.setUTCHours(24, 0, 0, 0);
    return NextResponse.json({
      ok: true,
      ...status,
      resetAt: reset.toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[quota/daily] query failed:', msg);
    return NextResponse.json(
      { ok: false, error: 'query_failed', message: msg },
      { status: 503 },
    );
  }
}
