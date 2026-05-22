-- Playly kv table — key-value store. cloud-sync.js mirror localStorage
-- playly-* keys ke sini (cross-device backup).
--
-- Project Supabase lama punya kv table dari history-nya. Project baru
-- (urfkqcdwcvyzctbtbpwv) fresh — perlu dibuat manual via migration ini.
--
-- Run via Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- ⚠️ SECURITY NOTE: cloud-sync.js pakai ANON key dengan policy permissif
-- (anon boleh CRUD semua row). Ini DESAIN LEGACY — kv = shared localStorage
-- mirror tanpa per-user scoping. Password di key playly-account-* di-hash
-- (PBKDF2 + salt) jadi tidak plaintext. Idealnya nanti di-scope per-user,
-- tapi untuk sekarang match behavior project lama supaya cloud-sync jalan.

-- ============================================================
-- 1. kv table
-- ============================================================
create table if not exists public.kv (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz default now()
);

-- Index untuk delta fetch (cloud-sync query: where updated_at > since)
create index if not exists kv_updated_at_idx on public.kv (updated_at);

-- ============================================================
-- 2. RLS — permissive (match legacy cloud-sync via anon key)
-- ============================================================
alter table public.kv enable row level security;

drop policy if exists "kv_anon_all" on public.kv;
create policy "kv_anon_all" on public.kv
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ============================================================
-- DONE. Verifikasi (run terpisah kalau mau):
--   select count(*) from public.kv;
-- ============================================================
