// Cloudflare R2 client untuk Next.js Route Handlers — v547 (2026-05-25).
//
// R2 = S3-compatible object storage. Egress GRATIS (vs Supabase Storage
// $0.09/GB after free quota 5GB/mo). Pakai @aws-sdk/client-s3 +
// s3-request-presigner untuk presigned URLs (client → R2 direct upload,
// bypass Vercel 4.5MB body limit).
//
// Env vars (set di Vercel dashboard atau .env.local):
//   R2_ACCOUNT_ID         — Cloudflare account ID (R2 dashboard kanan atas)
//   R2_ACCESS_KEY_ID      — R2 API token Access Key ID
//   R2_SECRET_ACCESS_KEY  — R2 API token Secret Access Key
//   R2_BUCKET             — bucket name (e.g. "playly-videos")
//   R2_PUBLIC_URL         — public access URL (e.g. "https://pub-xxx.r2.dev")
//                            atau custom domain (e.g. "https://cdn.playly.id")

import { S3Client } from '@aws-sdk/client-s3';

export type R2Config = {
  client: S3Client;
  bucket: string;
  publicUrl: string;
};

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    return null;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return {
    client,
    bucket,
    publicUrl: publicUrl.replace(/\/+$/, ''),
  };
}

// Object key format: videos/<id>.<ext>
// id: client-provided video id (timestamp or uuid)
// ext: derived dari contentType, fallback "mp4"
export function videoObjectKey(id: string, contentType?: string | null): string {
  const ext = extFromContentType(contentType);
  return `videos/${sanitizeId(id)}.${ext}`;
}

export function publicUrlFor(config: R2Config, key: string): string {
  return `${config.publicUrl}/${key}`;
}

function extFromContentType(ct?: string | null): string {
  if (!ct) return 'mp4';
  const lower = String(ct).toLowerCase();
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('quicktime') || lower.includes('mov')) return 'mov';
  if (lower.includes('mpeg')) return 'mpeg';
  if (lower.includes('ogg')) return 'ogg';
  return 'mp4';
}

function sanitizeId(id: string): string {
  // Defensive: strip path traversal + invalid chars. Video id biasanya
  // timestamp atau uuid jadi cuma allow alfanumerik + dash + underscore.
  return String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';
}
