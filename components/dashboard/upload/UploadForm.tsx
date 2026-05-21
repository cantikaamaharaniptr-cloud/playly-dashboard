'use client';

// Upload form — drag-drop file picker + metadata form + upload progress.
// Wired ke Supabase Storage via lib/storage/adapter (swap ke R2 later via
// satu config change).
//
// Phase 7b session 4 — MVP scope:
//   ✅ Drag-drop / click to pick file
//   ✅ Validate type (video/*) + size (50MB free tier limit)
//   ✅ Title + description + visibility form
//   ✅ Upload to Storage + INSERT videos row
//   ✅ Success state + reset
//   ⏳ Thumbnail picker (auto-generate 3 candidates) — next session
//   ⏳ AI subtitle (Premium) — separate edge function
//   ⏳ Quota meter (60 videos/1GB monthly) — separate component

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { activeAdapter } from '@/lib/storage/adapter';
import { buildStoragePath } from '@/lib/storage/supabase-adapter';
import type { VideoInsert, VideoVisibility } from '@/lib/videos/types';

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB Supabase free tier
const ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

type UploadState =
  | { kind: 'idle' }
  | { kind: 'uploading'; progress: string }
  | { kind: 'error'; message: string }
  | { kind: 'success'; videoId: string };

export function UploadForm() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<VideoVisibility>('private');
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<UploadState>({ kind: 'idle' });

  function handleFile(f: File) {
    setState({ kind: 'idle' });
    if (!ACCEPTED_TYPES.includes(f.type) && !f.type.startsWith('video/')) {
      setState({ kind: 'error', message: 'File harus video (mp4/webm/mov).' });
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      setState({
        kind: 'error',
        message: `File terlalu besar (${formatSize(f.size)}). Max ${formatSize(MAX_SIZE_BYTES)} di free tier.`,
      });
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || !user) {
      setState({ kind: 'error', message: 'Belum login.' });
      return;
    }
    if (!file) {
      setState({ kind: 'error', message: 'Pilih file video dulu.' });
      return;
    }
    if (!title.trim()) {
      setState({ kind: 'error', message: 'Judul wajib diisi.' });
      return;
    }

    try {
      setState({ kind: 'uploading', progress: 'Preparing…' });
      const supabase = createClient();
      const videoId = crypto.randomUUID();
      const path = buildStoragePath(user.id, videoId, file.name);

      setState({ kind: 'uploading', progress: 'Uploading file…' });
      const result = await activeAdapter.upload(file, path);

      setState({ kind: 'uploading', progress: 'Saving metadata…' });
      const insert: VideoInsert = {
        owner_id: user.id,
        title: title.trim(),
        description: description.trim(),
        category: '',
        visibility,
        storage_path: result.path,
        file_size_bytes: result.size,
        mime_type: result.contentType,
      };
      const { data, error } = await supabase
        .from('videos')
        .insert({ id: videoId, ...insert })
        .select('id')
        .single();
      if (error) {
        // Cleanup uploaded file kalau metadata insert gagal
        await activeAdapter.delete(path).catch(() => {});
        throw error;
      }

      setState({ kind: 'success', videoId: data.id });
      // Reset form
      setFile(null);
      setTitle('');
      setDescription('');
      setVisibility('private');
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Upload gagal.',
      });
    }
  }

  const uploading = state.kind === 'uploading';

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (uploading) return;
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className={`rounded-[14px] border-2 border-dashed p-10 text-center transition-colors ${
          dragOver
            ? 'border-wine bg-wine/10'
            : file
              ? 'border-cream/30 bg-ink-elev/40'
              : 'border-cream/15 bg-ink-elev/30 hover:border-cream/30'
        } ${uploading ? 'opacity-60' : ''}`}
      >
        {file ? (
          <div>
            <div className="mb-2 text-3xl">🎬</div>
            <p className="font-mono text-sm text-cream">{file.name}</p>
            <p className="mt-1 text-xs text-cream-muted">
              {formatSize(file.size)} · {file.type}
            </p>
            <button
              type="button"
              onClick={() => {
                if (uploading) return;
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              disabled={uploading}
              className="mt-3 text-xs font-semibold text-cream-soft underline hover:text-cream disabled:opacity-50"
            >
              Pick different file
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-2 text-3xl">📤</div>
            <p className="text-sm font-semibold text-cream">
              Drag &amp; drop video file di sini
            </p>
            <p className="mt-1 text-xs text-cream-muted">
              atau klik untuk pilih dari device — max {formatSize(MAX_SIZE_BYTES)}, MP4/WebM/MOV
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 rounded-md border border-cream/20 px-4 py-2 text-xs font-semibold text-cream transition-colors hover:bg-cream/5"
            >
              Choose file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-4 rounded-[14px] border border-cream/15 bg-ink-elev/50 p-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-cream-soft">
            Judul <span className="text-status-danger">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Beri judul yang catchy"
            maxLength={200}
            disabled={uploading}
            className="rounded-md border border-cream/20 bg-ink/40 px-3 py-2.5 text-sm text-cream placeholder:text-cream-muted/60 focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/30 disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-cream-soft">
            Deskripsi
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cerita di balik video kamu (opsional)"
            maxLength={5000}
            rows={4}
            disabled={uploading}
            className="resize-y rounded-md border border-cream/20 bg-ink/40 px-3 py-2.5 text-sm text-cream placeholder:text-cream-muted/60 focus:border-wine focus:outline-none focus:ring-2 focus:ring-wine/30 disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-cream-soft">
            Visibility
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['public', 'unlisted', 'private'] as VideoVisibility[]).map((v) => (
              <button
                key={v}
                type="button"
                disabled={uploading}
                onClick={() => setVisibility(v)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                  visibility === v
                    ? 'border-wine bg-wine/15 text-cream'
                    : 'border-cream/15 bg-ink/30 text-cream-soft hover:border-cream/30'
                } disabled:opacity-60`}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-cream-muted">
            <b>Public</b> — tampil di Discover · <b>Unlisted</b> — hanya yang
            punya link · <b>Private</b> — hanya kamu
          </p>
        </div>
      </div>

      {/* Status & submit */}
      {state.kind === 'uploading' ? (
        <div className="rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          ⏳ {state.progress}
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div
          role="alert"
          className="rounded-md border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-xs text-status-danger"
        >
          {state.message}
        </div>
      ) : null}

      {state.kind === 'success' ? (
        <div
          role="status"
          className="rounded-md border border-status-success/40 bg-status-success/10 px-3 py-2 text-xs text-status-success"
        >
          ✓ Upload sukses! Video sudah tersimpan. Cek di Pustaka Saya.
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={uploading || !file || !title.trim()}
          className="inline-flex items-center gap-2 rounded-[12px] bg-wine px-6 py-3 text-sm font-bold text-cream shadow-playly-md transition-colors hover:bg-wine-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : 'Publish Video'}
        </button>
      </div>
    </form>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
