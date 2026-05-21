'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { activeAdapter } from '@/lib/storage/adapter';
import type { Video } from '@/lib/videos/types';

const VISIBILITY_STYLE: Record<Video['visibility'], string> = {
  public: 'bg-status-success/15 text-status-success',
  unlisted: 'bg-status-warning/15 text-status-warning',
  private: 'bg-cream/10 text-cream-muted',
};

export function VideoCard({ video }: { video: Video }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (deleting) return;
    if (!confirm(`Hapus "${video.title}"? Tindakan ini tidak bisa di-undo.`)) {
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      // Hapus file dulu, lalu row (kalau file delete gagal, row tetap valid).
      await activeAdapter.delete(video.storage_path).catch(() => {
        // File mungkin sudah hilang — abaikan, lanjut hapus row.
      });
      const supabase = createClient();
      const { error: rowErr } = await supabase
        .from('videos')
        .delete()
        .eq('id', video.id);
      if (rowErr) throw rowErr;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete gagal.');
      setDeleting(false);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-[14px] border border-cream/15 bg-ink-elev/50 p-4 sm:flex-row sm:items-start">
      <div className="grid h-24 w-full flex-shrink-0 place-items-center rounded-md bg-gradient-to-br from-wine/30 to-ink text-3xl sm:w-32">
        🎬
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="m-0 flex-1 truncate text-base font-bold text-cream">
            {video.title}
          </h3>
          <span
            className={`flex-shrink-0 rounded-[6px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${VISIBILITY_STYLE[video.visibility]}`}
          >
            {video.visibility}
          </span>
        </div>

        {video.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-cream-soft">
            {video.description}
          </p>
        ) : (
          <p className="mt-1 text-xs italic text-cream-muted">
            (Tanpa deskripsi)
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-cream-muted">
          <span>{formatDate(video.created_at)}</span>
          {video.file_size_bytes ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatSize(video.file_size_bytes)}</span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{video.view_count} views</span>
        </div>

        {error ? (
          <div className="mt-2 rounded-md border border-status-danger/40 bg-status-danger/10 px-2 py-1 text-[11px] text-status-danger">
            {error}
          </div>
        ) : null}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md border border-status-danger/40 px-3 py-1 text-[11px] font-semibold text-status-danger transition-colors hover:bg-status-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            disabled
            title="Edit (akan dibangun di session berikut)"
            className="rounded-md border border-cream/15 px-3 py-1 text-[11px] font-semibold text-cream-muted/60"
          >
            Edit
          </button>
        </div>
      </div>
    </article>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
