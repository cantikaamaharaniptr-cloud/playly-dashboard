-- Cleanup orphan key di kv table (2026-05-22).
-- playly-current-user: dulu ditulis legacy code, sekarang tidak ada writer.
-- Tapi value lama ("demo_creator", dst) masih nyangkut di cloud kv table →
-- cloud-sync pull → local localStorage ke-pollute → state inconsistency
-- (data-role=user di body, tapi playly-current-user=demo_creator).
--
-- Code-side fix sudah deploy:
--   1. cloud-sync.js NO_SYNC_KEYS += "playly-current-user" (no pull from cloud)
--   2. script.js boot purge: localStorage.removeItem("playly-current-user")
-- SQL ini cleanup historical value di Supabase kv. One-time, idempotent.
--
-- Run via Supabase Dashboard → SQL Editor → paste → Run.

delete from public.kv
where key = 'playly-current-user';

-- Verifikasi (run terpisah):
-- select * from public.kv where key like 'playly-current-user%';
