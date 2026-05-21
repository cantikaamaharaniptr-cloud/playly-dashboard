// Upload page — drag-drop video + metadata form + Supabase Storage wire.
// Phase 7b session 4: MVP scope. Future: thumbnail picker, AI subtitle,
// quota meter, post-upload edit flow.

import { UploadForm } from '@/components/dashboard/upload/UploadForm';

export const metadata = { title: 'Playly — Unggah Video' };

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-cream-muted">
          Upload
        </p>
        <h1 className="mt-1 text-3xl font-bold text-cream">Unggah Video Baru</h1>
        <p className="mt-1 text-sm text-cream-soft">
          Pilih file, isi metadata, atur visibility, terus publish.
        </p>
      </header>

      <UploadForm />

      <p className="text-center text-[11px] text-cream-muted">
        Storage: Supabase Storage (1 GB free tier). Migrate ke Cloudflare R2
        untuk 10 GB + zero egress saat siap scale.
      </p>
    </div>
  );
}
