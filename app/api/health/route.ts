// Healthcheck endpoint (audit Fase 1 #20, Pilar 3 observability).
//
// Endpoint ringan untuk uptime monitor (UptimeRobot/BetterStack/Vercel):
// cek apakah app HIDUP + Supabase TERJANGKAU.
//   GET /api/health
//   200 { status: 'ok',       db: 'ok'   } — sehat
//   503 { status: 'degraded', db: 'down' } — DB tak terjangkau
//
// PUBLIK (tanpa auth) supaya monitor bisa hit tanpa kredensial. TIDAK membocorkan
// data/secret — hanya status + waktu + latency. Detail error di-log server-side.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Jangan di-cache: tiap hit harus mengecek kondisi LIVE.
export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  let db: 'ok' | 'down' = 'down';

  try {
    const supabase = await createClient();
    // head:true → tak menarik baris (tak ada data/PII keluar), cuma memastikan
    // query ke Postgres berhasil = DB terjangkau. count exact biar query benar2 jalan.
    const { error } = await supabase
      .from('kv')
      .select('key', { head: true, count: 'exact' })
      .limit(1);
    if (!error) {
      db = 'ok';
    } else {
      console.warn('[health] db query error:', error.code, error.message);
    }
  } catch (e) {
    console.warn('[health] supabase client unavailable:', e instanceof Error ? e.message : e);
  }

  const healthy = db === 'ok';
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      db,
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'cache-control': 'no-store' },
    },
  );
}
