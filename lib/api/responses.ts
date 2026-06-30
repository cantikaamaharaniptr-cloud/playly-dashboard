// Helper respons JSON untuk Route Handler API — branch refactor/api-route-helpers.
//
// Tujuan: hilangkan pola berulang `NextResponse.json({ ok: false, error }, { status })`
// dan `{ ok: true, ... }` yang tersebar di app/api/**/route.ts. Helper ini MURNI
// pembungkus (behaviour-preserving) — output JSON-nya identik byte-per-byte dengan
// pola lama, cuma dipindah ke satu sumber supaya konsisten + gampang diubah serempak.
//
// Urutan key sengaja dijaga: `ok` selalu pertama, lalu `error`/field data, lalu
// `extra` di-spread di belakang — sama persis dengan kode lama (mis.
// { ok: false, error: 'file_too_large', maxBytes: N }).
//
// CATATAN: sengaja TIDAK dipakai di app/api/translate-subtitle/route.ts — route itu
// Edge runtime + pakai Response manual dengan header `cache-control: no-store`
// sendiri (kontrak beda). Helper ini khusus route yang pakai NextResponse.

import { NextResponse } from 'next/server';

// Respons gagal: { ok: false, error, ...extra }.
// `extra` untuk field tambahan yang sudah dipakai sebagian route, mis.
// `maxBytes` (r2/sign-upload), `max`/`size` (state/sync), `message` (r2/delete).
export function jsonError(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

// Respons sukses: { ok: true, ...data }. Status default 200 (sama dengan
// NextResponse.json tanpa opsi status).
export function jsonOk(
  data?: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status });
}
