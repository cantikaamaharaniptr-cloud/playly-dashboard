// R2 presigned upload endpoint — v547 (2026-05-25).
//
// Client request URL ini → server generate presigned PUT URL → client PUT
// file langsung ke R2 (bypass Vercel 4.5MB body limit, file gak masuk fungsi).
//
// Request:
//   POST /api/r2/sign-upload
//   { id: string, contentType?: string, sizeBytes?: number }
//
// Response 200:
//   { ok: true, uploadUrl, publicUrl, key, expiresIn }
//
// Response 503: { ok: false, error: "r2_unavailable" } — env vars hilang
// Response 401: { ok: false, error: "not_authenticated" } — anon disallowed
// Response 413: { ok: false, error: "file_too_large", maxBytes } — > size cap
// Response 400: bad request body
//
// Auth: cookie-auth via createClient (lib/supabase/server). Anonymous user
// nggak boleh upload (cegah abuse R2 quota). Authenticated user OK.
//
// Size cap: 500 MB per file (R2 free tier 10 GB total, lim per-file).

import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Config, videoObjectKey, publicUrlFor } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';
import { getDailyQuotaStatus } from '@/lib/quota/daily';

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB
const PRESIGN_TTL_SECONDS = 300; // 5 menit cukup untuk upload commit

type SignUploadBody = {
  id?: string;
  contentType?: string;
  sizeBytes?: number;
};

export async function POST(req: Request) {
  const r2 = getR2Config();
  if (!r2) {
    return NextResponse.json(
      { ok: false, error: 'r2_unavailable' },
      { status: 503 },
    );
  }

  // Auth check — anonymous tidak boleh upload.
  let authUserId: string | null = null;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    authUserId = authUser?.id || null;
  } catch {
    // Supabase env hilang — treat sbg degraded; tolak upload.
    return NextResponse.json(
      { ok: false, error: 'auth_unavailable' },
      { status: 503 },
    );
  }
  if (!authUserId || !supabase) {
    return NextResponse.json(
      { ok: false, error: 'not_authenticated' },
      { status: 401 },
    );
  }

  let body: SignUploadBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const id = String(body.id || '').trim();
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'missing_id' },
      { status: 400 },
    );
  }

  const sizeBytes = Number(body.sizeBytes) || 0;
  if (sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'file_too_large', maxBytes: MAX_BYTES },
      { status: 413 },
    );
  }

  // Daily upload quota enforcement (Free 2 GB/hari, Premium 10 GB/hari).
  // Reset 00:00 UTC. Sum file_size_bytes dari videos table = source of truth.
  // Race antar concurrent uploads diterima sbg trade-off MVP (sama persis dgn
  // perilaku monthly quota lama yg juga sum dari videos table).
  try {
    const quota = await getDailyQuotaStatus(supabase, authUserId);
    if (sizeBytes > 0 && quota.usedBytes + sizeBytes > quota.quotaBytes) {
      return NextResponse.json(
        {
          ok: false,
          error: 'daily_quota_exceeded',
          tier: quota.tier,
          quotaBytes: quota.quotaBytes,
          usedBytes: quota.usedBytes,
          remainingBytes: quota.remainingBytes,
        },
        { status: 413 },
      );
    }
  } catch (err) {
    // Kalau query quota gagal (DB down, schema mismatch), tolak upload — safer
    // ketimbang issue presigned URL tanpa enforcement.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[r2/sign-upload] quota check failed:', msg);
    return NextResponse.json(
      { ok: false, error: 'quota_check_failed' },
      { status: 503 },
    );
  }

  const contentType = String(body.contentType || 'video/mp4');
  const key = videoObjectKey(id, contentType);

  // v548 (2026-05-26): minimal PutObjectCommand — no CacheControl.
  // CacheControl di signed payload bikin browser harus echo header
  // `Cache-Control: public, max-age=604800` di PUT, kalau gak → signature
  // mismatch. Set cache via bucket-level metadata atau lifecycle policy
  // kalau perlu (deferred — R2 default CDN cache cukup untuk MVP).
  const cmd = new PutObjectCommand({
    Bucket: r2.bucket,
    Key: key,
    ContentType: contentType,
  });

  let uploadUrl: string;
  try {
    uploadUrl = await getSignedUrl(r2.client, cmd, {
      expiresIn: PRESIGN_TTL_SECONDS,
      // v548: unhoistableHeaders kosong + signableHeaders minimal supaya
      // signature SDK match dgn header browser fetch (cuma Content-Type +
      // Host). Tanpa ini, SDK auto-sign x-amz-checksum-* atau Cache-Control
      // yang browser ga reproduce → 403/Failed to fetch.
      signableHeaders: new Set(['host', 'content-type']),
    });
    // v549 diagnostic: log first 120 chars + length untuk debug invisible
    // chars / malformed URLs di Vercel function logs.
    console.log('[r2/sign-upload] url len=', uploadUrl.length, 'preview=', uploadUrl.slice(0, 120));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[r2/sign-upload] presign failed:', msg);
    return NextResponse.json(
      { ok: false, error: 'presign_failed', message: msg },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    uploadUrl,
    publicUrl: publicUrlFor(r2, key),
    key,
    expiresIn: PRESIGN_TTL_SECONDS,
  });
}
