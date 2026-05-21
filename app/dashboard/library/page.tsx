// Library page — list semua video user. Phase 7b session 4: simple list.
// Future: filter (Video Saya / Status / Baru / Unduhan), sort, bulk actions.

import Link from 'next/link';
import { VideoCard } from '@/components/dashboard/library/VideoCard';
import { requireUser } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import type { Video } from '@/lib/videos/types';

export const metadata = { title: 'Playly — Pustaka Saya' };

export default async function LibraryPage() {
  const user = await requireUser('/');
  const supabase = await createClient();
  const { data: videos, error } = await supabase
    .from('videos')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  // Error bukan SQL/permission error tapi schema belum apply
  const schemaMissing =
    error?.code === '42P01' || error?.message?.includes('relation') || false;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-cream-muted">
            Pustaka
          </p>
          <h1 className="mt-1 text-3xl font-bold text-cream">Pustaka Saya</h1>
          <p className="mt-1 text-sm text-cream-soft">
            Semua video yang kamu upload.
          </p>
        </div>
        <Link
          href="/dashboard/upload"
          className="rounded-[10px] bg-wine px-4 py-2.5 text-xs font-bold text-cream shadow-playly-sm transition-colors hover:bg-wine-hover"
        >
          + Unggah baru
        </Link>
      </header>

      {schemaMissing ? (
        <SchemaMissingNotice />
      ) : error ? (
        <ErrorNotice message={error.message} />
      ) : !videos || videos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {(videos as Video[]).map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[14px] border border-dashed border-cream/20 bg-ink-elev/30 p-12 text-center">
      <div className="mb-3 text-4xl">🎬</div>
      <p className="text-sm font-semibold text-cream-soft">
        Belum ada video di pustaka kamu
      </p>
      <p className="mt-1 text-xs text-cream-muted">
        Upload video pertama untuk mulai membangun kanal kreator.
      </p>
      <Link
        href="/dashboard/upload"
        className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-wine px-5 py-2.5 text-xs font-bold text-cream shadow-playly-sm transition-colors hover:bg-wine-hover"
      >
        Unggah Video Pertama
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="rounded-[14px] border border-status-danger/40 bg-status-danger/10 p-6 text-sm text-status-danger">
      <p className="font-semibold">Gagal load library</p>
      <p className="mt-1 text-xs">{message}</p>
    </div>
  );
}

function SchemaMissingNotice() {
  return (
    <div className="rounded-[14px] border border-status-warning/40 bg-status-warning/10 p-6">
      <p className="text-sm font-semibold text-status-warning">
        ⚠ Tabel <code className="font-mono">videos</code> belum ada di Supabase
      </p>
      <p className="mt-2 text-xs text-cream-soft">
        Sebelum bisa pakai Upload &amp; Library, jalankan migration SQL di
        Supabase Dashboard:
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-cream-soft">
        <li>
          Buka{' '}
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-cream underline"
          >
            Supabase Dashboard
          </a>{' '}
          → project Playly → SQL Editor
        </li>
        <li>
          Buka file{' '}
          <code className="font-mono">supabase/migrations/0001_videos_schema.sql</code>{' '}
          di repo
        </li>
        <li>Copy semua isi, paste ke SQL Editor, klik Run</li>
        <li>
          Storage → Create bucket <code className="font-mono">videos</code>{' '}
          (private), set 3 policies sesuai komentar di SQL file
        </li>
        <li>Refresh halaman ini</li>
      </ol>
    </div>
  );
}
