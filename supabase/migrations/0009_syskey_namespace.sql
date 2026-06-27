-- Sysem key namespace migration — Phase B6c (2026-05-25).
--
-- Sebelumnya `playly-account-cutoff-ts-v1` di-namespace `playly-account-*`
-- yang juga dipakai user accounts (suffix @email). Akibat: ambiguous —
-- cleanup logic + RLS per-user check butuh suffix-@ guard untuk skip
-- system key. Plus jadi blocker untuk B6a-4 (drop kv_anon_all) karena
-- /api/kv/sync sulit detect "system" vs "user" by prefix alone.
--
-- B6c: pindah ke `playly-syskey-*` namespace. `playly-account-*` 100% user.
-- /api/kv/sync sekarang aman stamp user_id untuk semua `playly-account-*`.
--
-- Migration: rename row di kv table (kalau ada). Aman idempotent.
--
-- Run via Supabase Dashboard → SQL Editor → paste → Run.

-- ============================================================
-- 1. Rename legacy cutoff-ts key di kv table
-- ============================================================
update public.kv
set key = 'playly-syskey-account-cutoff-ts-v1'
where key = 'playly-account-cutoff-ts-v1'
  and not exists (
    select 1 from public.kv where key = 'playly-syskey-account-cutoff-ts-v1'
  );

-- Kalau key baru udah ada (dari client-side migrateCutoffKey IIFE) tapi
-- legacy masih nyangkut → cleanup legacy.
delete from public.kv
where key = 'playly-account-cutoff-ts-v1'
  and exists (
    select 1 from public.kv where key = 'playly-syskey-account-cutoff-ts-v1'
  );

-- ============================================================
-- 2. (Optional) Backfill user_id untuk playly-account-* yg belum
-- ke-stamp dari migration 0008. Sekarang aman karena semua sisa
-- `playly-account-*` adalah user account (suffix @email).
-- ============================================================
update public.kv
set user_id = p.id
from public.profiles p
where kv.user_id is null
  and kv.key like 'playly-account-%'
  and substring(kv.key from 16) like '%@%'
  and lower(substring(kv.key from 16)) = lower(p.email);

-- ============================================================
-- DONE. Verifikasi:
--   -- Cek tidak ada lagi legacy cutoff key
--   select * from public.kv where key = 'playly-account-cutoff-ts-v1';
--   -- (harus 0 rows)
--
--   -- Cek new namespace key exist (kalau pernah ada cutoff)
--   select key, value from public.kv where key like 'playly-syskey-%';
--
--   -- Cek playly-account-* sudah ke-stamp user_id
--   select
--     count(*) filter (where user_id is not null) as stamped,
--     count(*) filter (where user_id is null) as unstamped_orphans
--   from public.kv where key like 'playly-account-%';
-- ============================================================
