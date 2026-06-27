-- User state table — Phase B3 (2026-05-25). Mirror dari legacy
-- localStorage `playly-state-{username}` JSON blob (preferences, video lists,
-- counters, history, messages, notifications, achievements).
--
-- Strategi penyimpanan: SATU row per user, kolom `state jsonb` berisi
-- blob utuh. Sama bentuknya dengan localStorage — minim perubahan kode
-- legacy, mudah rollback. Nanti di B4/B5 boleh kita pecah per kategori
-- kalau diperlukan (mis. messages → tabel terpisah untuk realtime).
--
-- Dipakai oleh /api/state/sync: legacy `saveState()` di-hook → debounced
-- POST blob → upsert row di sini. RLS ketat: user hanya akses state-nya
-- sendiri (tidak public-readable seperti `profiles`).
--
-- Run via Supabase Dashboard → SQL Editor → paste → Run. Idempotent.

-- ============================================================
-- 1. user_state table
-- ============================================================
create table if not exists public.user_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  state       jsonb not null default '{}'::jsonb,
  state_size  integer generated always as (octet_length(state::text)) stored,
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);

-- Index untuk monitoring kalau ada user state-nya membengkak (debug egress).
create index if not exists user_state_updated_idx on public.user_state (updated_at desc);

-- ============================================================
-- 2. updated_at auto-bump trigger
-- ============================================================
create or replace function public.user_state_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_state_set_updated_at on public.user_state;
create trigger user_state_set_updated_at
  before update on public.user_state
  for each row execute function public.user_state_set_updated_at();

-- ============================================================
-- 3. RLS — owner-only (private data, beda dari profiles yang public-read)
-- ============================================================
alter table public.user_state enable row level security;

-- 3a. SELECT — hanya owner
drop policy if exists "user_state_owner_select" on public.user_state;
create policy "user_state_owner_select" on public.user_state
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 3b. INSERT — hanya owner (id = auth.uid())
drop policy if exists "user_state_owner_insert" on public.user_state;
create policy "user_state_owner_insert" on public.user_state
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 3c. UPDATE — hanya owner
drop policy if exists "user_state_owner_update" on public.user_state;
create policy "user_state_owner_update" on public.user_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3d. DELETE — hanya owner
drop policy if exists "user_state_owner_delete" on public.user_state;
create policy "user_state_owner_delete" on public.user_state
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- DONE. Verifikasi (run terpisah kalau mau):
--   select count(*) from public.user_state;
--   select user_id, state_size, updated_at from public.user_state order by updated_at desc;
--   select policyname from pg_policies where tablename = 'user_state';
-- ============================================================
