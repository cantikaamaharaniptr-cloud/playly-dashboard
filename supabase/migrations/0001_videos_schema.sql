-- Playly videos table + RLS + storage bucket setup.
-- Apply via Supabase Dashboard → SQL Editor (paste & run), or `supabase db push`
-- kalau pakai Supabase CLI.

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
  storage_path    text not null,  -- path di bucket: {owner_id}/{video_id}.{ext}
  duration_seconds int,
  file_size_bytes bigint,
  mime_type       text,
  thumbnail_url   text,
  view_count      bigint default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Indexes untuk query umum
create index if not exists videos_owner_idx       on public.videos(owner_id, created_at desc);
create index if not exists videos_public_idx      on public.videos(visibility, created_at desc)
                                                  where visibility = 'public';
create index if not exists videos_created_at_idx  on public.videos(created_at desc);

-- updated_at auto-bump trigger
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
-- 2. Row-Level Security policies
-- ============================================================
alter table public.videos enable row level security;

-- Owner bisa SELECT/INSERT/UPDATE/DELETE own videos
drop policy if exists "videos_owner_crud" on public.videos;
create policy "videos_owner_crud" on public.videos
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Anyone (authenticated atau anon) bisa SELECT public videos
drop policy if exists "videos_public_read" on public.videos;
create policy "videos_public_read" on public.videos
  for select
  using (visibility = 'public');

-- ============================================================
-- 3. Storage bucket
-- ============================================================
-- Jalankan ini DI Supabase Dashboard → Storage:
--   1. Klik "Create a new bucket"
--   2. Name: videos
--   3. Public bucket: OFF (kita atur via policy di bawah)
--   4. File size limit: 50 MB (free tier) atau biarkan default
--
-- Atau via SQL (uncomment & run):
-- insert into storage.buckets (id, name, public) values ('videos', 'videos', false)
-- on conflict (id) do nothing;

-- Storage policies — apply manually via Dashboard → Storage → videos bucket → Policies:
--
-- POLICY 1: "Authenticated users can upload to their own folder"
--   Allowed operation: INSERT
--   Target roles: authenticated
--   USING: bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]
--
-- POLICY 2: "Authenticated users can update/delete their own files"
--   Allowed operation: UPDATE, DELETE
--   Target roles: authenticated
--   USING: bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]
--
-- POLICY 3: "Anyone can read public videos"
--   Allowed operation: SELECT
--   Target roles: public, authenticated
--   USING: bucket_id = 'videos' AND EXISTS (
--     SELECT 1 FROM public.videos v
--     WHERE v.storage_path = name AND v.visibility = 'public'
--   )
