-- Profiles table — Phase B2 (2026-05-22). Public user metadata mirror dari
-- legacy localStorage `playly-account-{email}`. Linked 1-1 ke auth.users.
--
-- Dipakai oleh /api/auth/bridge: setiap legacy signin/signup → upsert row
-- di sini. Foundation buat B3 (state) + B4 (switch primary read ke Supabase).
--
-- Schema: PUBLIC-readable fields. Sensitive admin flags (suspended, role,
-- mustChangePassword, pin) DITARUH terpisah nanti di tabel `account_security`
-- (B3+) dengan RLS lebih ketat.
--
-- Run via Supabase Dashboard → SQL Editor → paste → Run. Idempotent.

-- ============================================================
-- 1. profiles table
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  username    text unique,
  name        text,
  bio         text default '',
  avatar_url  text,
  tier        text not null default 'free'
              check (tier in ('free', 'premium')),
  joined_at   timestamptz default now(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_email_idx    on public.profiles (email);
create index if not exists profiles_tier_idx     on public.profiles (tier);

-- ============================================================
-- 2. updated_at auto-bump trigger
-- ============================================================
create or replace function public.profiles_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.profiles_set_updated_at();

-- ============================================================
-- 3. RLS policies
-- ============================================================
alter table public.profiles enable row level security;

-- 3a. Anyone (anon + authenticated) bisa SELECT semua profil
--     (untuk feature discover / search creator / public profile pages).
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles
  for select
  to anon, authenticated
  using (true);

-- 3b. Authenticated user dapat INSERT profil mereka sendiri (id = auth.uid()).
drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert" on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- 3c. Authenticated user dapat UPDATE profil mereka sendiri.
drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update" on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3d. Authenticated user dapat DELETE profil mereka sendiri (kalau hapus akun).
drop policy if exists "profiles_owner_delete" on public.profiles;
create policy "profiles_owner_delete" on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id);

-- ============================================================
-- DONE. Verifikasi (run terpisah kalau mau):
--   select count(*) from public.profiles;
--   select policyname from pg_policies where tablename = 'profiles';
-- ============================================================
