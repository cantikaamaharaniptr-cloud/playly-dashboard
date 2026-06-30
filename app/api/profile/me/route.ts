// Profile read endpoint — Phase B4 (2026-05-25).
//
// GET — kembalikan profil milik user yang sedang login (cookie session).
// Dipakai legacy signin flow untuk hydrate playly-account-{email} dari
// cloud setelah B2 bridge upsert. Use case: user yang ganti device,
// ke localStorage `playly-account-{email}` masih kosong, tapi profil
// sudah ada di public.profiles dari device sebelumnya.
//
// Tidak ada POST di sini — write profile masih lewat /api/auth/bridge
// (upsert otomatis pada signin/signup, B2 behavior).

import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/api/responses';

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return jsonError('supabase_unavailable', 503);
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.id) {
    return jsonError('not_authenticated', 401);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, name, bio, avatar_url, tier, joined_at, updated_at')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01' || /relation/.test(error.message)) {
      return jsonError('schema_missing', 503);
    }
    return jsonError(error.message, 500);
  }

  if (!data) {
    return jsonOk({ profile: null });
  }

  return jsonOk({ profile: data });
}
