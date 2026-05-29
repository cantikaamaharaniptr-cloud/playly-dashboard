-- ============================================================================
-- PLAYLY DASHBOARD — KV TABLE CLEANUP / FULL RESET
-- ============================================================================
-- Purpose: hapus semua data user + platform, PRESERVE admin/config/markers.
-- When to run: setelah Supabase quota unlock (reset bulanan atau upgrade Pro).
-- Where to run: Supabase Dashboard → SQL Editor → paste & Run.
--
-- ⚠️ DESTRUKTIF — TIDAK BISA RECOVER tanpa backup.
-- Author: 2026-05-21, atas request user untuk full reset platform.
-- ============================================================================

-- STEP 1: dry-run dulu (SELECT, bukan DELETE) — lihat berapa row yang AKAN dihapus
-- Uncomment block ini untuk preview, lalu comment lagi sebelum jalankan DELETE.

-- SELECT count(*) AS rows_to_delete FROM kv WHERE
--   -- Akun non-admin
--   (key LIKE 'playly-account-%' AND key NOT IN (
--     'playly-account-admin.playly@gmail.com',
--     'playly-account-admin.playly2@gmail.com'
--   ))
--   -- State non-admin
--   OR (key LIKE 'playly-state-%' AND key != 'playly-state-admin')
--   -- Platform data
--   OR key IN (
--     'playly-platform-videos',
--     'playly-platform-views',
--     'playly-platform-likes',
--     'playly-platform-comments',
--     'playly-platform-stars',
--     'playly-premium-payments',
--     'playly-pending-videos',
--     'playly-trash-videos',
--     'playly-takedowns',
--     'playly-banned-emails-v1',
--     'playly-admin-events',
--     'playly-admin-events-compacted-v1',
--     'playly-cloud-retry',
--     'playly-cloud-last-sync',
--     'playly-cloud-filename-cache',
--     'playly-account-cutoff-ts-v1',
--     'playly-revenue-today-cleared-v1',
--     'playly-welcomed-admin',
--     'playly-welcomed-premuser',
--     'playly-hqs-history'
--   )
--   -- Login attempts non-admin
--   OR (key LIKE 'playly-login-attempts-%' AND key NOT IN (
--     'playly-login-attempts-admin.playly@gmail.com',
--     'playly-login-attempts-admin.playly2@gmail.com'
--   ))
--   -- Admin mod queue
--   OR key = 'playly-admin-mod';

-- ============================================================================
-- STEP 2: DELETE — jalankan ini setelah preview di STEP 1 sesuai ekspektasi
-- ============================================================================

BEGIN;  -- transaksi supaya bisa ROLLBACK kalau salah

-- 2.1 Hapus akun non-admin
DELETE FROM kv WHERE key LIKE 'playly-account-%'
  AND key NOT IN (
    'playly-account-admin.playly@gmail.com',
    'playly-account-admin.playly2@gmail.com'
  );

-- 2.2 Hapus state non-admin (state user dashboard)
DELETE FROM kv WHERE key LIKE 'playly-state-%'
  AND key != 'playly-state-admin';

-- 2.3 Hapus semua platform data
DELETE FROM kv WHERE key IN (
  'playly-platform-videos',
  'playly-platform-views',
  'playly-platform-likes',
  'playly-platform-comments',
  'playly-platform-stars',
  'playly-premium-payments',
  'playly-pending-videos',
  'playly-trash-videos',
  'playly-takedowns',
  'playly-banned-emails-v1',
  'playly-admin-events',
  'playly-admin-events-compacted-v1',
  'playly-cloud-retry',
  'playly-cloud-last-sync',
  'playly-cloud-filename-cache',
  'playly-account-cutoff-ts-v1',
  'playly-revenue-today-cleared-v1',
  'playly-welcomed-admin',
  'playly-welcomed-premuser',
  'playly-hqs-history',
  'playly-admin-mod'
);

-- 2.4 Hapus login attempts non-admin
DELETE FROM kv WHERE key LIKE 'playly-login-attempts-%'
  AND key NOT IN (
    'playly-login-attempts-admin.playly@gmail.com',
    'playly-login-attempts-admin.playly2@gmail.com'
  );

-- Cek summary akhir
SELECT count(*) AS remaining_rows FROM kv;
SELECT key FROM kv ORDER BY key;  -- list semua key yang TERSISA

-- ⚠️ Kalau ada row yang TIDAK seharusnya kehapus, ROLLBACK:
-- ROLLBACK;

-- Kalau OK, commit:
COMMIT;

-- ============================================================================
-- YANG SEHARUSNYA TERSISA (PRESERVED):
-- - playly-account-admin.playly@gmail.com (+ admin.playly2 jika ada)
-- - playly-state-admin
-- - playly-ad-config
-- - playly-ads-seeded-v1
-- - playly-ad-dummy-purged-v2
-- - playly-ad-reset-v20260430
-- - playly-ad-seed-dummy-v20260518
-- - playly-platform-reset-2026-05-09-v1
-- - playly-hard-purge-users-2026-05-11-v7
-- - playly-theme, playly-guest-theme, playly-guest-lang
-- - playly-login-attempts-admin.playly@gmail.com (jika ada)
-- ============================================================================
