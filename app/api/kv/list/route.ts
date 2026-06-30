// KV list/fetch-all endpoint — Phase B6a-4 prep (2026-05-25 v544).
//
// Replace cloud-sync.js fetchAllRows() yang sebelumnya pakai anon-key
// langsung. Setelah B6a-4 migration 0012 drop kv_anon_all policy, anon
// role nggak bisa SELECT per-user rows. Bridge endpoint ini pakai cookie
// auth (createClient lib/supabase/server) → server-side filter by RLS:
// authenticated user dapat platform rows + own per-user rows.
//
// Anonymous (no cookie) → 401. Client (cloud-sync.js) fall back ke
// anon-key path untuk platform-only data sementara migration 0012
// belum di-deploy.
//
// Egress optimization: support `since` query param untuk delta fetch
// (mirror existing fetchAllRows behavior).
//
// Endpoint:
//   GET /api/kv/list                   → return semua accessible rows
//   GET /api/kv/list?since=ISOSTRING  → return rows updated_at > since
//   GET /api/kv/list?keysonly=1       → return cuma keys (egress opt)

import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/api/responses';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const since = url.searchParams.get('since');
  const keysOnly = url.searchParams.get('keysonly') === '1';

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return jsonError('supabase_unavailable', 503);
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Anonymous → 401 (client fallback ke anon-key path untuk platform-only).
  // Setelah migration 0012 drop kv_anon_all + add kv_anon_platform_read,
  // anon path masih bisa read platform rows. Per-user reads cuma via bridge.
  if (!authUser?.id) {
    return jsonError('not_authenticated', 401);
  }

  // Query kv table — RLS otomatis filter: platform rows (user_id NULL) +
  // owned per-user rows (auth.uid() = user_id).
  let query = supabase
    .from('kv')
    .select(keysOnly ? 'key,updated_at' : 'key,value,updated_at,user_id')
    .like('key', 'playly-%');

  if (since) {
    query = query.gt('updated_at', since);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === '42P01' || /relation/.test(error.message)) {
      return jsonError('schema_missing', 503);
    }
    if (error.code === '42703') {
      return jsonError('schema_outdated', 503);
    }
    console.warn('[kv/list] query failed:', error.message);
    return jsonError(error.message, 500);
  }

  return jsonOk({
    rows: data || [],
    count: data?.length || 0,
    since: since || null,
    keysOnly,
  });
}
