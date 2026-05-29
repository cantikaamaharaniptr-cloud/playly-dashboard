-- Purge test accounts (2026-05-25). User lapor akun "user1" muncul di
-- halaman Pencarian padahal Supabase auth.users tidak punya entry ini.
-- Akun-akun test (user1, userbaru1, usernew1) sisa testing yg ter-mirror
-- ke kv table via cloud-sync (sebelum B5 cleanup).
--
-- Cleanup:
--   1. Hapus row dari kv table (account + state + prefs + welcomed + 2fa)
--   2. Hapus dari profiles (B2) kalau ada
--   3. Hapus dari user_state (B3) kalau ada
--   4. Hapus dari auth.users hanya kalau email match (defensive cek)
--
-- Run via Supabase Dashboard → SQL Editor → paste → Run. Idempotent.

-- ============================================================
-- 1. kv table cleanup
-- ============================================================
delete from public.kv
where key in (
  'playly-account-user1@gmail.com',
  'playly-account-userbaru1@gmail.com',
  'playly-account-usernew1@gmail.com',
  'playly-state-user1',
  'playly-state-userbaru1',
  'playly-state-usernew1',
  'playly-prefs-user1@gmail.com',
  'playly-prefs-userbaru1@gmail.com',
  'playly-prefs-usernew1@gmail.com',
  'playly-welcomed-user1',
  'playly-welcomed-userbaru1',
  'playly-welcomed-usernew1',
  'playly-2fa-user1',
  'playly-2fa-userbaru1',
  'playly-2fa-usernew1'
);

-- ============================================================
-- 2. profiles (B2) cleanup
-- ============================================================
delete from public.profiles
where email in (
  'user1@gmail.com',
  'userbaru1@gmail.com',
  'usernew1@gmail.com'
)
   or username in ('user1', 'userbaru1', 'usernew1');

-- ============================================================
-- 3. user_state (B3) cleanup — cascade dari auth.users delete, tapi
-- bersihkan eksplisit kalau ada orphan row.
-- ============================================================
delete from public.user_state
where user_id in (
  select id from auth.users where email in (
    'user1@gmail.com',
    'userbaru1@gmail.com',
    'usernew1@gmail.com'
  )
);

-- ============================================================
-- 4. auth.users — hapus kalau ada (cascade ke profiles + user_state)
-- ============================================================
delete from auth.users
where email in (
  'user1@gmail.com',
  'userbaru1@gmail.com',
  'usernew1@gmail.com'
);

-- ============================================================
-- DONE. Verifikasi:
--   select email from auth.users where email like '%user%@gmail.com';
--   select key from public.kv where key like 'playly-%user1%' or key like 'playly-%userbaru%' or key like 'playly-%usernew%';
--   -- Harusnya: 0 rows
-- ============================================================
