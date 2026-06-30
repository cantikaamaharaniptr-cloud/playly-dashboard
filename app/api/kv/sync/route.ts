// KV sync endpoint — Phase B6a-2 (2026-05-25).
//
// Cloud-sync legacy (public/legacy/cloud-sync.js) sebelumnya pakai
// Supabase anon key langsung dari browser → no per-user context →
// RLS permissive (kv_anon_all). Privacy risk: PIN hash + payment data
// shared accessible.
//
// Endpoint ini = future-proof migration target untuk cloud-sync. Pakai
// cookie auth (createClient dari lib/supabase/server) → server stamp
// user_id otomatis untuk per-user keys. RLS per-user (migration 0008)
// enforce ownership.
//
// Strategi adoption:
//   B6a-2 (sekarang): endpoint ada, BELUM dipakai cloud-sync (anon-key
//     path masih default). Endpoint siap untuk gradual migration.
//   B6a-3: cloud-sync.js refactor — detect per-user keys (via prefix
//     match yg sama dgn kv_is_per_user_key di Postgres) → route through
//     POST /api/kv/sync (bukan anon-key langsung).
//   B6a-4: drop kv_anon_all permissive policy. Anon-key path mati.
//     Cloud-sync 100% via bridge endpoint.
//
// Endpoint:
//   POST  /api/kv/sync  body { key, value } → upsert per-user (stamp user_id)
//   GET   /api/kv/sync?key=X            → fetch single per-user value
//   DELETE /api/kv/sync  body { key }   → delete per-user row

import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/api/responses';

// Same prefix list as cloud-sync.js PER_USER_PREFIXES_BRIDGE.
// Sync between these 2 lists MANDATORY — keep in lockstep.
//
// B6a-3 (2026-05-25): SCOPE LIMITED ke 5 prefix yang jelas per-user:
//   - playly-prefs-/welcomed-/welcome-/onboarding-/notif-
//
// EXCLUDED (di-handle terpisah):
//   - playly-state-* → public.user_state table (B3)
//   - playly-2fa-* → NO_SYNC entirely (B5)
//   - playly-account-* → punya overlap dgn system keys (allowlist, cutoff-ts).
//     Special handling: suffix WAJIB ada @ (email) supaya bukan system key.
//   - playly-cloud-* → device-local, NO_SYNC
const PER_USER_PREFIXES = [
  'playly-prefs-',
  'playly-welcomed-',
  'playly-welcome-',
  'playly-onboarding-',
  'playly-notif-',
];

function isPerUserKey(key: string): boolean {
  // Standard prefix match
  if (PER_USER_PREFIXES.some(p => key.startsWith(p))) return true;
  // playly-account-* dgn suffix berisi @ = user email account
  if (key.startsWith('playly-account-')) {
    const suffix = key.slice('playly-account-'.length);
    return suffix.includes('@');
  }
  return false;
}

type SyncBody = {
  key?: string;
  value?: unknown;
};

export async function POST(req: Request) {
  let body: SyncBody;
  try {
    body = await req.json();
  } catch {
    return jsonError('bad_json', 400);
  }
  if (!body.key || typeof body.key !== 'string') {
    return jsonError('missing_key', 400);
  }
  if (body.value === undefined) {
    return jsonError('missing_value', 400);
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return jsonError('supabase_unavailable', 503);
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Per-user keys WAJIB ada session
  if (isPerUserKey(body.key) && !authUser?.id) {
    return jsonError('not_authenticated', 401);
  }

  // Stamp user_id otomatis untuk per-user keys (server-side, can't be spoofed)
  const row = {
    key: body.key,
    value: body.value,
    user_id: isPerUserKey(body.key) ? authUser!.id : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('kv')
    .upsert(row, { onConflict: 'key' });

  if (error) {
    if (error.code === '42P01' || /relation/.test(error.message)) {
      return jsonError('schema_missing', 503);
    }
    if (error.code === '42703' || /column .* does not exist/.test(error.message)) {
      // user_id column belum di-apply (migration 0008 not yet run)
      return jsonError('schema_outdated', 503);
    }
    console.warn('[kv/sync] upsert failed:', error.message);
    return jsonError(error.message, 500);
  }

  return jsonOk({ perUser: isPerUserKey(body.key) });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  if (!key) {
    return jsonError('missing_key_param', 400);
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return jsonError('supabase_unavailable', 503);
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (isPerUserKey(key) && !authUser?.id) {
    return jsonError('not_authenticated', 401);
  }

  const { data, error } = await supabase
    .from('kv')
    .select('key, value, updated_at')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk({ row: data });
}

export async function DELETE(req: Request) {
  let body: SyncBody;
  try {
    body = await req.json();
  } catch {
    return jsonError('bad_json', 400);
  }
  if (!body.key) {
    return jsonError('missing_key', 400);
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return jsonError('supabase_unavailable', 503);
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (isPerUserKey(body.key) && !authUser?.id) {
    return jsonError('not_authenticated', 401);
  }

  const { error } = await supabase
    .from('kv')
    .delete()
    .eq('key', body.key);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk();
}
