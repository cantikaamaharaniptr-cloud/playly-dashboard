// Storage adapter — abstrak supaya bisa swap Supabase Storage ↔ Cloudflare R2
// dengan 1 config change. Phase 7b session 4: Supabase Storage adapter only.
// R2 adapter di-build saat user siap migrasi (set env R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET_URL).

export type UploadResult = {
  path: string; // path/key di storage backend
  size: number;
  contentType: string;
};

export interface StorageAdapter {
  // Upload file (called dari client-side). Path generated dari user_id +
  // video_id. Return path untuk disimpan di videos.storage_path.
  upload(file: File, path: string): Promise<UploadResult>;

  // Get public URL untuk streaming. Untuk private/unlisted videos, ini
  // signed URL dengan expiry. Untuk public, direct URL.
  getStreamUrl(path: string, expiresIn?: number): Promise<string>;

  // Delete file. Called saat user hapus video.
  delete(path: string): Promise<void>;
}

// Active adapter — saat ini Supabase Storage. Migrate ke R2 dengan ganti
// import berikut ke './r2-adapter' (after R2 setup).
export { supabaseStorageAdapter as activeAdapter } from './supabase-adapter';
