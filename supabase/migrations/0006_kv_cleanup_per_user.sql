-- KV table cleanup — Phase B5 (2026-05-25). Hapus data per-user yang
-- sekarang punya tabel Supabase dedicated (RLS owner-only). Sebelum
-- migrasi B3+B4, cloud-sync mirror SEMUA `playly-*` keys ke kv table
-- (RLS permissive). Sekarang:
--
--   playly-state-*   → public.user_state (B3, RLS owner-only)
--   playly-2fa-*     → JANGAN sync (sensitive PIN hash, B5 audit)
--
-- Cloud-sync.js sekarang block prefix di atas via NO_SYNC_PREFIXES.
-- Migration ini hapus rows yang sudah terlanjur ke kv supaya:
--   1) cloud-sync.js applyToLocal tidak re-populate localStorage dgn
--      data stale (sebelum B3 di-deploy).
--   2) kv table footprint mengecil → kurangi egress.
--   3) privacy: PIN hash + state blob keluar dari permissive table.
--
-- Run via Supabase Dashboard → SQL Editor → paste → Run. Idempotent.

-- ============================================================
-- 1. playly-state-* — sekarang di public.user_state
-- ============================================================
delete from public.kv
where key like 'playly-state-%';

-- ============================================================
-- 2. playly-2fa-* — sensitive PIN hash, tidak boleh di shared table
-- ============================================================
delete from public.kv
where key like 'playly-2fa-%';

-- ============================================================
-- DONE. Verifikasi (run terpisah kalau mau):
--   select count(*) from public.kv;
--   select key from public.kv where key like 'playly-state-%' or key like 'playly-2fa-%';
--   -- Harusnya empty: 0 rows
-- ============================================================
