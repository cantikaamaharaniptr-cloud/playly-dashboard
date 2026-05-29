-- Playly videos schema + storage bucket + policies — FULLY SELF-CONTAINED.
-- Run once via Supabase Dashboard → SQL Editor → New query → paste all → Run.
--
-- Setelah jalan tanpa error, langsung test di /dashboard/library:
--   - "Tabel videos belum ada" notice hilang
--   - Empty state muncul
--   - Klik "Unggah Video Pertama" → bisa upload

-- ============================================================
-- 1. videos table
-- ============================================================
create table if not exists public.videos (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  title           text not null check (length(title) between 1 and 200),
  description     text default '' check (length(description) <= 5000),
  category        text default '',
  visibility      text not null default 'private'
                    check (visibility in ('public', 'unlisted', 'private')),
  storage_path    text not null,
  duration_seconds int,
  file_size_bytes bigint,
  mime_type       text,
  thumbnail_url   text,
  view_count      bigint default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists videos_owner_idx       on public.videos(owner_id, created_at desc);
create index if not exists videos_public_idx      on public.videos(visibility, created_at desc)
                                                  where visibility = 'public';
create index if not exists videos_created_at_idx  on public.videos(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. RLS pada videos table
-- ============================================================
alter table public.videos enable row level security;

drop policy if exists "videos_owner_crud" on public.videos;
create policy "videos_owner_crud" on public.videos
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "videos_public_read" on public.videos;
create policy "videos_public_read" on public.videos
  for select
  using (visibility = 'public');

-- ============================================================
-- 3. Storage bucket "videos" (private)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  false,  -- private; akses via signed URL atau policy
  52428800,  -- 50 MB free tier (naikkan di Pro / R2)
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================
-- 4. Storage policies untuk bucket "videos"
-- ============================================================
-- Convention path: {owner_id}/{video_id}.{ext}
-- foldername(name)[1] = owner_id (folder pertama)

-- 4a. Authenticated users dapat INSERT (upload) ke folder owner-nya sendiri
drop policy if exists "videos_storage_insert_own" on storage.objects;
create policy "videos_storage_insert_own" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4b. Authenticated users dapat UPDATE (mis. metadata) di file mereka sendiri
drop policy if exists "videos_storage_update_own" on storage.objects;
create policy "videos_storage_update_own" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4c. Authenticated users dapat DELETE file mereka sendiri
drop policy if exists "videos_storage_delete_own" on storage.objects;
create policy "videos_storage_delete_own" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4d. Authenticated users dapat SELECT (download/stream) file mereka sendiri
drop policy if exists "videos_storage_select_own" on storage.objects;
create policy "videos_storage_select_own" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4e. Anyone (anon + authenticated) dapat SELECT file dari video public
drop policy if exists "videos_storage_select_public" on storage.objects;
create policy "videos_storage_select_public" on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'videos'
    and exists (
      select 1
      from public.videos v
      where v.storage_path = storage.objects.name
        and v.visibility = 'public'
    )
  );

-- ============================================================
-- DONE.
-- ============================================================
-- Verifikasi (run terpisah kalau mau):
--   select count(*) from public.videos;
--   select * from storage.buckets where id = 'videos';
--   select policyname from pg_policies where tablename = 'objects';
