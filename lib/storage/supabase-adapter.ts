// Supabase Storage adapter — default backend untuk Phase 7b.
// Bucket: 'videos', path convention: {owner_id}/{video_id}.{ext}
// RLS policy di Supabase Dashboard limit upload ke folder owner sendiri.

import { createClient } from '@/lib/supabase/client';
import type { StorageAdapter, UploadResult } from './adapter';

const BUCKET = 'videos';
const DEFAULT_SIGNED_URL_EXPIRY = 60 * 60; // 1 hour

export const supabaseStorageAdapter: StorageAdapter = {
  async upload(file, path) {
    const supabase = createClient();
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    return {
      path,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
    };
  },

  async getStreamUrl(path, expiresIn = DEFAULT_SIGNED_URL_EXPIRY) {
    const supabase = createClient();
    // Try public URL first (kalau bucket public atau RLS allow)
    const { data: signed, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    return signed.signedUrl;
  },

  async delete(path) {
    const supabase = createClient();
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  },
};

// Helper untuk generate storage path. Pattern: {owner_id}/{video_id}.{ext}
// — folder pertama = owner_id supaya RLS policy bisa check
// `auth.uid()::text = (storage.foldername(name))[1]`.
export function buildStoragePath(ownerId: string, videoId: string, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || 'mp4';
  return `${ownerId}/${videoId}.${ext}`;
}

// Helper untuk extract result type (re-export for convenience)
export type { UploadResult };
