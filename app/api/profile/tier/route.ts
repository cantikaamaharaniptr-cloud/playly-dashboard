// Tier persist endpoint — 2026-07-02.
//
// Tujuan: saat user MENGAKTIFKAN Premium (trial / bayar) di client, tier langsung
// disimpan ke DB `public.profiles` TANPA menunggu login berikutnya. Sebelumnya
// activatePremium() hanya menulis localStorage → tier baru sampai ke cloud saat
// bridge upsert di signin berikut → ada jeda di mana premium belum tersimpan di
// pusat data → ganti device tampil "Gratis". Endpoint ini menutup jeda itu.
//
// POST — set tier user yang sedang login (cookie session) jadi 'premium'.
//
// UPGRADE-ONLY dari client: hanya 'premium' yang boleh diset di sini. Downgrade
// (premium→free) HANYA lewat admin / expiry server-side, konsisten dgn guard
// anti-downgrade di /api/auth/bridge. Ini mencegah salinan lokal "free" yang
// belum ter-sync menghapus status berbayar di cloud.

import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/api/responses';

export async function POST(req: Request) {
  let body: { tier?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('bad_json', 400);
  }

  // Client hanya boleh menaikkan ke premium. Nilai lain ditolak.
  if (body?.tier !== 'premium') {
    return jsonError('invalid_tier', 400);
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return jsonError('supabase_unavailable', 503);
  }

  const {
    data: { user: authUser },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !authUser?.id) {
    return jsonError('not_authenticated', 401);
  }

  // Upsert row profil milik user ini (email not-null wajib untuk kasus row belum ada).
  // Kolom lain (name/username/bio/avatar) TIDAK disentuh → aman dari overwrite.
  const { error: upErr } = await supabase
    .from('profiles')
    .upsert(
      { id: authUser.id, email: authUser.email ?? '', tier: 'premium' },
      { onConflict: 'id' },
    );

  if (upErr) {
    if (upErr.code === '42P01' || /relation/.test(upErr.message)) {
      console.warn('[profile/tier] profiles table belum di-apply (run migration 0004)');
      return jsonError('schema_missing', 503);
    }
    console.warn('[profile/tier] upsert failed:', upErr.message);
    return jsonError(upErr.message, 500);
  }

  return jsonOk({ tier: 'premium' });
}
