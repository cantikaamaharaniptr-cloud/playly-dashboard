-- Purge admin.playly2 — DIKONFIRMASI ULANG (2026-06-27).
--
-- KONTEKS: migrasi 0011 (purge admin.playly2) DINETRALKAN 2026-06-17 karena saat
-- itu admin.playly2 dijadikan admin senior sah. Pada 2026-06-27 user MEMINTA
-- penghapusan permanen DENGAN INFO LENGKAP bahwa ini admin senior aktif (bukan
-- dummy) — keputusan sadar. File ini MENGGANTIKAN 0011 untuk operasi ini.
--
-- Yang SUDAH dikerjakan via REST (anon) sebelum file ini:
--   - admin.playly2 dihapus dari kv allowlist (playly-admin-allowlist → [])  → akses admin dicabut
--   - key transien dihapus: playly-login-attempts-* (×2, termasuk typo @gmai.com), playly-sessions-*
-- Sisa (butuh hak Dashboard / service-role) = file ini: account row (owner-only),
-- profiles, user_state, auth.users.
--
-- Run via Supabase Dashboard → SQL Editor → paste → Run. Idempotent.

-- ============================================================
-- 1. kv — semua key milik admin.playly2 (account/state/prefs/welcomed/2fa/dst)
-- ============================================================
delete from public.kv where key ilike '%admin.playly2%';

-- ============================================================
-- 2. profiles
-- ============================================================
delete from public.profiles
where lower(email) = 'admin.playly2@gmail.com' or lower(username) = 'admin.playly2';

-- ============================================================
-- 3. user_state (by user_id dari auth.users)
-- ============================================================
delete from public.user_state
where user_id in (select id from auth.users where lower(email) = 'admin.playly2@gmail.com');

-- ============================================================
-- 4. auth.users (FK on delete cascade akan ikut bersihkan kv.user_id/profiles/user_state)
-- ============================================================
delete from auth.users where lower(email) = 'admin.playly2@gmail.com';

-- ============================================================
-- VERIFIKASI (target semua 0)
-- ============================================================
-- select 'kv' t, count(*) c from public.kv where key ilike '%admin.playly2%'
-- union all select 'profiles', count(*) from public.profiles where lower(email)='admin.playly2@gmail.com'
-- union all select 'user_state', count(*) from public.user_state where user_id in (select id from auth.users where lower(email)='admin.playly2@gmail.com')
-- union all select 'auth', count(*) from auth.users where lower(email)='admin.playly2@gmail.com';
-- ============================================================
