// R2 delete endpoint — v547 (2026-05-25).
//
// Hapus video object dari R2. Server-side karena delete ops tidak butuh
// body besar (cuma metadata) — direct call dari Next.js function aman.
//
// Request:
//   POST /api/r2/delete
//   { id: string, contentType?: string }   — server derive key dari id+ct
//   atau:
//   { key: string }                        — explicit key (kalau client tahu)
//
// Response 200: { ok: true }
// Response 503: r2_unavailable
// Response 401: not_authenticated
// Response 400: bad request

import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getR2Config, videoObjectKey } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';
import { jsonError, jsonOk } from '@/lib/api/responses';

type DeleteBody = {
  id?: string;
  contentType?: string;
  key?: string;
};

export async function POST(req: Request) {
  const r2 = getR2Config();
  if (!r2) {
    return jsonError('r2_unavailable', 503);
  }

  // Auth check — anon nggak boleh delete.
  let authUserId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    authUserId = authUser?.id || null;
  } catch {
    return jsonError('auth_unavailable', 503);
  }
  if (!authUserId) {
    return jsonError('not_authenticated', 401);
  }

  let body: DeleteBody;
  try {
    body = await req.json();
  } catch {
    return jsonError('bad_json', 400);
  }

  let key = String(body.key || '').trim();
  if (!key) {
    const id = String(body.id || '').trim();
    if (!id) {
      return jsonError('missing_id_or_key', 400);
    }
    key = videoObjectKey(id, body.contentType);
  }

  // Safety: scope key to videos/ prefix supaya endpoint ini gak bisa
  // di-abuse hapus object lain (kalau bucket nanti shared multi-prefix).
  if (!key.startsWith('videos/')) {
    return jsonError('invalid_key_scope', 400);
  }

  try {
    await r2.client.send(
      new DeleteObjectCommand({
        Bucket: r2.bucket,
        Key: key,
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // R2 DeleteObject = idempotent (404 / not-found gak throw biasanya),
    // tapi tetap surface error lain.
    console.warn('[r2/delete] failed:', msg);
    return jsonError('delete_failed', 500, { message: msg });
  }

  return jsonOk({ key });
}
