-- KV orphan-account leak fix + anon-insert hardening + dummy purge (2026-06-27).
--
-- MASALAH (P3): row akun `playly-account-{email}` dengan user_id = NULL bisa
-- DIBACA anon (lewat policy kv_anon_platform_read dari 0012) → field "password"
-- (hash) ter-expose ke siapa pun yang punya anon key (anon key publik, ada di
-- browser). Contoh ter-temu 27 Jun 2026: playly-account-cantikaputri@gmail.com
-- (sudah di-stamp manual via bridge) + playly-account-admin.playly2@gmail.com.
--
-- AKAR: cloud-sync.js anon-fallback dulu menulis key per-user sebagai row
-- user_id = NULL ketika bridge gagal; policy kv_anon_platform_insert (0012)
-- cuma cek `user_id is null` → row per-user lolos → jadi orphan anon-readable.
-- CODE FIX sudah live (cloud-sync v559): per-user TIDAK pernah fallback anon
-- lagi (antre retry via bridge). Migration ini beresin sisa DATA + tutup
-- celah policy supaya orphan tak bisa dibuat lagi dari sisi DB.
--
-- Run via Supabase Dashboard → SQL Editor. Idempotent. JALANKAN PRE-FLIGHT DULU.

-- ============================================================
-- PRE-FLIGHT (read-only — jalankan + tinjau dulu sebelum eksekusi apa pun)
-- ============================================================
-- A) Semua orphan per-user yang anon-readable (INI yang bocor):
--    select key, (value ? 'password') as has_password, updated_at
--    from public.kv
--    where user_id is null and public.kv_is_per_user_key(key)
--    order by key;
--
-- B) Orphan akun yang PUNYA match di profiles (akan ke-stamp di Step 1):
--    select k.key, p.id
--    from public.kv k
--    join public.profiles p
--      on lower(substring(k.key from 16)) = lower(p.email)
--    where k.user_id is null
--      and k.key like 'playly-account-%'
--      and substring(k.key from 16) like '%@%';
--
-- C) Kandidat akun TEST (akan ke-purge di Step 3) — TINJAU sebelum hapus:
--    select key from public.kv
--    where key like 'playly-account-%@%'
--      and substring(key from 16) ~* '@(playly\.(com|test)|local\.(test|dev))$';

-- ============================================================
-- STEP 1 — STAMP user_id ke orphan dari profiles (jadi owner-only, anon tak bisa baca lagi)
-- (Mengulang backfill 0008; menangkap akun/prefs/state yang masuk profiles SETELAH 0008.)
-- ============================================================
update public.kv kv set user_id = p.id
from public.profiles p
where kv.user_id is null
  and kv.key like 'playly-account-%'
  and substring(kv.key from 16) like '%@%'
  and lower(substring(kv.key from 16)) = lower(p.email);

update public.kv kv set user_id = p.id
from public.profiles p
where kv.user_id is null
  and kv.key like 'playly-prefs-%'
  and (lower(substring(kv.key from 14)) = lower(p.email)
       or lower(substring(kv.key from 14)) = lower(p.username));

update public.kv kv set user_id = p.id
from public.profiles p
where kv.user_id is null
  and kv.key like 'playly-state-%'
  and lower(substring(kv.key from 14)) = lower(p.username);

-- ============================================================
-- STEP 2 — PERKETAT policy anon: tolak key per-user walau user_id NULL
-- (tutup celah pembuatan orphan dari sisi DB; reuse kv_is_per_user_key dari 0008)
-- ============================================================
drop policy if exists "kv_anon_platform_insert" on public.kv;
create policy "kv_anon_platform_insert" on public.kv
  for insert
  to anon
  with check (user_id is null and not public.kv_is_per_user_key(key));

drop policy if exists "kv_anon_platform_update" on public.kv;
create policy "kv_anon_platform_update" on public.kv
  for update
  to anon
  using (user_id is null and not public.kv_is_per_user_key(key))
  with check (user_id is null and not public.kv_is_per_user_key(key));

-- NOTE: kv_anon_platform_read (0012) tetap. Setelah Step 1, orphan ber-password
-- sudah ke-stamp (user_id ≠ null) → tak lagi lolos read anon. Orphan yang TIDAK
-- ada di profiles (mis. akun test) ditangani Step 3.

-- ============================================================
-- STEP 3 — PURGE akun TEST. Domain sintetis = AMAN auto. Gibberish @gmail =
-- daftar eksplisit (TINJAU + hapus '--' baris yang mau dijalankan).
-- ============================================================
-- 3a. Domain test sintetis (playly.com / playly.test / local.test / local.dev) — aman.
delete from public.kv
where public.kv_is_per_user_key(key)
  and key ~* '@(playly\.(com|test)|local\.(test|dev))';

delete from public.profiles
where email ~* '@(playly\.(com|test)|local\.(test|dev))$';

delete from auth.users
where email ~* '@(playly\.(com|test)|local\.(test|dev))$';

-- 3b. Akun gibberish di domain ASLI (@gmail dst) — EKSPLISIT, tinjau dulu.
--     Hapus tanda komentar (--) pada baris yang sudah kamu pastikan dummy.
-- delete from public.kv where key in (
--   'playly-account-afasf@gmail.com',
--   'playly-account-sgsdgsdg@gmai.com',
--   'playly-account-sefsefsdfsa@gmail.com',
--   'playly-account-demoplayly2026@gmail.com'
-- );
-- delete from public.profiles where email in (
--   'afasf@gmail.com','sgsdgsdg@gmai.com','sefsefsdfsa@gmail.com','demoplayly2026@gmail.com'
-- );
-- delete from auth.users where email in (
--   'afasf@gmail.com','sgsdgsdg@gmai.com','sefsefsdfsa@gmail.com','demoplayly2026@gmail.com'
-- );

-- ============================================================
-- POST-VERIFY
-- ============================================================
-- 1) Tidak ada lagi orphan akun ber-password yang anon-readable:
--    select key from public.kv
--    where user_id is null and key like 'playly-account-%@%';
--    -- target: 0 baris (kalau ada sisa = akun belum di profiles → review manual)
--
-- 2) Anon TIDAK bisa bikin orphan baru (browser incognito, anon key):
--    fetch('<url>/rest/v1/kv', {method:'POST', headers:{apikey, authorization,
--      'Content-Type':'application/json'},
--      body: JSON.stringify({key:'playly-account-x@y.com', value:{}, user_id:null})})
--      .then(r=>console.log('expect 401/403:', r.status));

-- ============================================================
-- ROLLBACK (kembalikan policy anon insert/update ke versi 0012)
-- ============================================================
-- drop policy if exists "kv_anon_platform_insert" on public.kv;
-- create policy "kv_anon_platform_insert" on public.kv
--   for insert to anon with check (user_id is null);
-- drop policy if exists "kv_anon_platform_update" on public.kv;
-- create policy "kv_anon_platform_update" on public.kv
--   for update to anon using (user_id is null) with check (user_id is null);
-- ============================================================
-- DONE.
-- ============================================================
