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
-- (PBKDF2 + salt) jadi tidak plaintext.
--
-- MIGRASI BERTAHAP ke tabel dedicated dengan RLS owner-only:
--   Phase B2 (2026-05-22): playly-account-* → public.profiles (public read).
--   Phase B3 (2026-05-25): playly-state-*   → public.user_state (owner only).
--   Phase B5 (2026-05-25): cloud-sync NO_SYNC_PREFIXES block 'playly-state-'
--                          + 'playly-2fa-'. Migration 0006 hapus row lama.
--   Defer:  playly-account-* hapus dari kv (sistem key seperti
--           playly-account-allowlist masih di kv — perlu split).
--   Defer:  RLS tighten — butuh user_id column di kv + refactor cloud-sync
--           supaya signin pakai cookie auth (bukan anon key).

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
