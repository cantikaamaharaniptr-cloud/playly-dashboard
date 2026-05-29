-- KV table per-user RLS migration — Phase B6a-1 (2026-05-25).
--
-- Current state (after migration 0002):
--   kv (key text PK, value jsonb, updated_at)
--   RLS: kv_anon_all — anon + authenticated CRUD all rows (permissive)
-- Privacy risk: PIN hash + payment data + state blob shared accessible.
--
-- Target state (full cutover di B6a-4):
--   Per-user data: only owner CRUD (auth.uid() = user_id)
--   Platform-wide data: public SELECT, admin-only mutate
--
-- B6a-1 (this migration): ADDITIVE foundation. Add user_id column +
-- indexes + new RLS policies BUT KEEP old permissive policy aktif
-- supaya cloud-sync (anon-key) tetap jalan tanpa break production.
-- Cloud-sync refactor + cutover akan di B6a-3+B6a-4.
--
-- Run via Supabase Dashboard → SQL Editor → paste → Run. Idempotent.

-- ============================================================
-- 1. Add user_id column (nullable — backward compat)
-- ============================================================
alter table public.kv
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists kv_user_id_idx on public.kv (user_id) where user_id is not null;

-- Composite index untuk per-user queries: (user_id, key)
create index if not exists kv_user_key_idx on public.kv (user_id, key) where user_id is not null;

-- ============================================================
-- 2. Helper function — detect per-user keys via prefix.
-- Dipakai di RLS policies + cloud-sync untuk stamp user_id otomatis.
-- ============================================================
create or replace function public.kv_is_per_user_key(k text)
returns boolean
language sql
immutable
as $$
  select
    k like 'playly-state-%' or
    k like 'playly-account-%' or
    k like 'playly-prefs-%' or
    k like 'playly-welcomed-%' or
    k like 'playly-welcome-%' or
    k like 'playly-onboarding-%' or
    k like 'playly-notif-%' or
    k like 'playly-2fa-%' or
    k like 'playly-cloud-last-sync%' or
    k like 'playly-cloud-retry%';
$$;

-- ============================================================
-- 3. NEW RLS policies (additive — kv_anon_all tetap aktif untuk
-- backward compat sampai B6a-4 cutover)
-- ============================================================
alter table public.kv enable row level security;

-- 3a. Per-user SELECT — owner only
drop policy if exists "kv_per_user_select" on public.kv;
create policy "kv_per_user_select" on public.kv
  for select
  to authenticated
  using (
    user_id is null  -- platform-wide rows: anyone authenticated can read
    or auth.uid() = user_id
  );

-- 3b. Per-user INSERT — owner only (server-side via bridge bakal stamp user_id)
drop policy if exists "kv_per_user_insert" on public.kv;
create policy "kv_per_user_insert" on public.kv
  for insert
  to authenticated
  with check (
    user_id is null  -- platform rows: any auth user (admin mutates di B6a-4)
    or auth.uid() = user_id
  );

-- 3c. Per-user UPDATE — owner only
drop policy if exists "kv_per_user_update" on public.kv;
create policy "kv_per_user_update" on public.kv
  for update
  to authenticated
  using (
    user_id is null
    or auth.uid() = user_id
  )
  with check (
    user_id is null
    or auth.uid() = user_id
  );

-- 3d. Per-user DELETE — owner only
drop policy if exists "kv_per_user_delete" on public.kv;
create policy "kv_per_user_delete" on public.kv
  for delete
  to authenticated
  using (
    user_id is null
    or auth.uid() = user_id
  );

-- NOTE: kv_anon_all (dari migration 0002) TIDAK di-drop di sini.
-- Akan di-drop di migration B6a-4 setelah cloud-sync sudah refactor
-- pakai cookie auth. Kalau drop sekarang → anon-key cloud-sync break.

-- ============================================================
-- 4. Backfill: stamp user_id untuk existing per-user keys (best-effort)
-- Pattern: extract username/email dari key suffix, lookup profiles.id,
-- set user_id. Rows yg gagal di-lookup (orphan) biarkan user_id NULL —
-- nanti di-cleanup di migration berikutnya atau tetap accessible via
-- legacy permissive policy.
-- ============================================================
-- 4a. playly-state-{username} → join via profiles.username
update public.kv
set user_id = p.id
from public.profiles p
where kv.user_id is null
  and kv.key like 'playly-state-%'
  and lower(substring(kv.key from 14)) = lower(p.username);

-- 4b. playly-account-{email} → join via profiles.email
update public.kv
set user_id = p.id
from public.profiles p
where kv.user_id is null
  and kv.key like 'playly-account-%'
  and substring(kv.key from 16) like '%@%'
  and lower(substring(kv.key from 16)) = lower(p.email);

-- 4c. playly-prefs-{email_or_username} → try both
update public.kv
set user_id = p.id
from public.profiles p
where kv.user_id is null
  and kv.key like 'playly-prefs-%'
  and (
    lower(substring(kv.key from 14)) = lower(p.email)
    or lower(substring(kv.key from 14)) = lower(p.username)
  );

-- ============================================================
-- DONE. Verifikasi:
--   select
--     count(*) filter (where user_id is not null) as per_user_rows,
--     count(*) filter (where user_id is null) as platform_or_orphan
--   from public.kv;
--
--   -- Test RLS (sebagai auth user X):
--   -- SELECT * FROM kv WHERE key = 'playly-state-cantika';  -- ✓ kalau owner
--   -- INSERT INTO kv (key, value, user_id) VALUES ('test', '{}', auth.uid());
-- ============================================================
