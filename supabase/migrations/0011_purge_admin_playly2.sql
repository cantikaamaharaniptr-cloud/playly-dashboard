-- Purge admin.playly2 (2026-05-25 v543).
--
-- Konfirmasi user: admin.playly2@gmail.com BUKAN akun admin real.
-- Sisa test data. Real admin tunggal = admin.playly@gmail.com.
--
-- Migration 0010 (v542) sebelumnya mengira admin.playly2 = backup admin
-- karena listed di ADMIN_EMAILS_PROTECTED. Salah — list itu mengandung
-- nama yang user pernah test setup tapi tidak production.
--
-- Cleanup full: kv, profiles, user_state, auth.users untuk admin.playly2.

-- ============================================================
-- 1. kv table — delete admin.playly2 account row
-- ============================================================
delete from public.kv
where key = 'playly-account-admin.playly2@gmail.com';

-- Plus delete kv data lain yang mungkin orphan (state/prefs/welcomed/etc)
delete from public.kv
where (
  key like 'playly-state-%' or
  key like 'playly-prefs-%' or
  key like 'playly-welcomed-%' or
  key like 'playly-welcome-%' or
  key like 'playly-onboarding-%' or
  key like 'playly-notif-%' or
  key like 'playly-2fa-%'
) and (
  -- Match suffix admin.playly2 atau email-nya
  key like '%admin.playly2%' or
  key like '%admin.playly2@gmail.com'
);

-- ============================================================
-- 2. profiles (B2) cleanup kalau ada
-- ============================================================
delete from public.profiles
where email = 'admin.playly2@gmail.com'
   or username = 'admin.playly2';

-- ============================================================
-- 3. user_state (B3) cleanup kalau ada
-- ============================================================
delete from public.user_state
where user_id in (
  select id from auth.users where email = 'admin.playly2@gmail.com'
);

-- ============================================================
-- 4. auth.users — delete (cascade ke profiles + user_state)
-- ============================================================
delete from auth.users
where email = 'admin.playly2@gmail.com';

-- ============================================================
-- DONE. Verifikasi:
--   select * from kv where key like '%admin.playly2%';        -- 0 rows
--   select * from profiles where email like '%admin.playly2%'; -- 0 rows
--   select * from auth.users where email = 'admin.playly2@gmail.com'; -- 0 rows
--
--   -- Cek orphan tersisa di kv (harusnya semua bersih sekarang)
--   select count(*) from kv where key like 'playly-account-%' and user_id is null;
--   -- harus return 0
-- ============================================================
