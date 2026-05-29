-- KV table strict RLS cutover — Phase B6a-4 (2026-05-26).
--
-- DROP permissive kv_anon_all policy (dari migration 0002) yang ngebolehin
-- siapapun (anon role) read+write SEMUA row di kv table termasuk per-user
-- data (password hash, profile, state). Replace dengan policies yang BEDAIN
-- platform data vs per-user data:
--
--   kv_anon_platform_read  : anon HANYA boleh SELECT user_id IS NULL
--   kv_anon_platform_write : anon HANYA boleh INSERT/UPDATE/DELETE user_id IS NULL
--   kv_per_user_*          : authenticated owner-only CRUD (dari 0008, tetap aktif)
--
-- SECURITY FIX achieved:
--   Sebelum: anon bisa READ semua password hash, account, profile, state user lain
--   Sesudah: anon HANYA bisa CRUD platform-wide data (seeds, allowlist, system configs)
--            Per-user data (user_id NOT NULL) only accessible by owner via auth cookie
--
-- BACKWARD COMPAT preserved:
--   Cloud-sync.js current behavior: per-user keys via bridge cookie (works),
--   platform/system keys via anon-key (TETAP WORK karena anon_platform_write).
--   Tidak ada cloud-sync refactor wajib untuk apply migration ini.
--
-- BEFORE applying — checklist:
--   [ ] v547-v552 stable di production >2 hari (no R2 issues, no widespread auth issues)
--   [ ] Pre-flight check section dijalankan, hasil masuk akal
--   [ ] Rollback SQL siap copy-paste kalau emergency
--   [ ] Tahu Supabase Dashboard URL — apply via SQL Editor (BUKAN CLI)
--
-- IMPACT after apply:
--   ✓ Anon visitors browsing landing → CRUD platform data tetap jalan
--   ✓ Authenticated users dgn cookie valid → CRUD via bridge tetap jalan
--   ✓ Authenticated users dgn cookie EXPIRED → fallback anon-key bekerja
--     UNTUK platform keys (system seeds, dll). UNTUK per-user keys mereka
--     akan FAIL (RLS reject) → state changes mereka tidak persist ke cloud
--     sampai re-login. v552 warning ngasih tau di console.
--   ✗ Anonymous READ to per-user data (password hash, profile, state) → BLOCKED
--   ✗ Anonymous WRITE to per-user data → BLOCKED
--
-- Run via Supabase Dashboard → SQL Editor → paste section yang mau di-run.

-- ============================================================
-- PRE-FLIGHT CHECK (run dulu sebelum apply migration)
-- ============================================================
-- Query 1: berapa row platform (akan tetap accessible via anon)?
--   select count(*) from public.kv where user_id is null;
--   -- Expected: significant count (seeds, syskeys, allowlist, dll)
--
-- Query 2: berapa row per-user (akan locked ke owner only)?
--   select count(*) from public.kv where user_id is not null;
--   -- Expected: 1 row per (user × per-user-key-type)
--
-- Query 3: confirm policy kv_per_user_* dari migration 0008 ada
--   select policyname, cmd, roles
--   from pg_policies
--   where schemaname = 'public' and tablename = 'kv'
--   order by policyname;
--   -- Expected: kv_anon_all + 4× kv_per_user_* (select/insert/update/delete)
--   -- Kalau kv_per_user_* TIDAK ADA → JANGAN apply 0012, jalanin 0008 dulu.
--
-- Query 4: sample 5 row platform untuk verify mereka emang shareable
--   select key, jsonb_typeof(value), updated_at
--   from public.kv where user_id is null
--   order by updated_at desc limit 5;
--   -- Expected: keys spt playly-dummy-creators-seed-v, playly-account-allowlist,
--   --           playly-syskey-account-cutoff-ts-v1 (system data, bukan PII user)
--
-- Query 5: sample 5 row per-user untuk verify ada user_id valid
--   select key, user_id, jsonb_typeof(value), updated_at
--   from public.kv where user_id is not null
--   order by updated_at desc limit 5;
--   -- Expected: keys playly-state-{username}, playly-account-{email},
--   --           dgn user_id matching profile mereka
--
-- Query 6: orphan check — per-user-pattern keys yang user_id-nya NULL
--   select key, updated_at from public.kv
--   where user_id is null
--     and (key like 'playly-state-%' or
--          (key like 'playly-account-%' and substring(key from 16) like '%@%') or
--          key like 'playly-prefs-%' or
--          key like 'playly-welcomed-%' or
--          key like 'playly-2fa-%')
--   limit 20;
--   -- Expected: 0 rows (idealnya). Kalau ada orphans, mereka akan TETAP
--   --           accessible via anon_platform_read (karena user_id IS NULL).
--   --           Bukan blocker untuk migrate, tapi note untuk cleanup nanti.
--
-- Kalau semua query OK + production stable, lanjut ke MIGRATION section.

-- ============================================================
-- MIGRATION (apply ini di Supabase Dashboard SQL Editor)
-- ============================================================

-- Step 1: Drop permissive policy lama yang ngebolehin anon CRUD semua.
drop policy if exists "kv_anon_all" on public.kv;

-- Step 2: Anon SELECT platform-wide rows (user_id IS NULL) only.
-- Per-user rows (user_id NOT NULL) jadi tidak visible ke anon.
drop policy if exists "kv_anon_platform_read" on public.kv;
create policy "kv_anon_platform_read" on public.kv
  for select
  to anon
  using (user_id is null);

-- Step 3: Anon INSERT platform-wide rows only.
-- Cloud-sync.js anon-path masih perlu write seed/system keys.
drop policy if exists "kv_anon_platform_insert" on public.kv;
create policy "kv_anon_platform_insert" on public.kv
  for insert
  to anon
  with check (user_id is null);

-- Step 4: Anon UPDATE platform-wide rows only.
drop policy if exists "kv_anon_platform_update" on public.kv;
create policy "kv_anon_platform_update" on public.kv
  for update
  to anon
  using (user_id is null)
  with check (user_id is null);

-- Step 5: Anon DELETE platform-wide rows only.
drop policy if exists "kv_anon_platform_delete" on public.kv;
create policy "kv_anon_platform_delete" on public.kv
  for delete
  to anon
  using (user_id is null);

-- NOTE: kv_per_user_* policies (dari migration 0008) handle authenticated
-- user CRUD. Mereka allow platform rows (user_id IS NULL) untuk semua auth
-- user + per-user rows (auth.uid() = user_id) untuk owner only. Tetap aktif.

-- ============================================================
-- POST-APPLY VERIFICATION
-- ============================================================
-- Query 7: confirm kv_anon_all sudah hilang + new policies aktif
--   select policyname, cmd, roles
--   from pg_policies
--   where schemaname='public' and tablename='kv'
--   order by policyname;
--   -- Expected: NO kv_anon_all. NEW kv_anon_platform_* (4 policies).
--   --           Existing kv_per_user_* (4 policies). Total 8 policies.
--
-- Query 8: confirm anon CAN'T read per-user data (run sebagai anon role)
--   Browser test: buka https://playly-dashboard.vercel.app di incognito,
--   F12 console:
--     window.PLAYLY_SUPABASE
--     // dapetin url + anon key
--     fetch('https://urfkqcdwcvyzctbtbpwv.supabase.co/rest/v1/kv?select=*&key=eq.playly-account-admin.playly@gmail.com', {
--       headers: { apikey: '<anon-key>', authorization: 'Bearer <anon-key>' }
--     }).then(r=>r.json()).then(d => console.log('anon read per-user:', d));
--     // Expected: [] (empty array — RLS filtered out)
--
-- Query 9: confirm anon CAN read platform data
--     fetch('https://urfkqcdwcvyzctbtbpwv.supabase.co/rest/v1/kv?select=*&user_id=is.null&limit=3', {
--       headers: { apikey: '<anon-key>', authorization: 'Bearer <anon-key>' }
--     }).then(r=>r.json()).then(d => console.log('anon read platform:', d));
--     // Expected: 3 rows (platform data shows through)
--
-- Query 10: confirm authenticated user CRUD jalan (di app, real flow)
--   Browser test: login, do normal activity (settings save, upload, dst),
--   check console TIDAK ADA pesan "RLS violation" atau 401 cluster.

-- ============================================================
-- ROLLBACK (kalau ada masalah produksi setelah apply)
-- ============================================================
-- Restore kv_anon_all permissive — app behavior kembali pre-0012.
-- Run di Supabase Dashboard SQL Editor:
--
-- drop policy if exists "kv_anon_platform_read"   on public.kv;
-- drop policy if exists "kv_anon_platform_insert" on public.kv;
-- drop policy if exists "kv_anon_platform_update" on public.kv;
-- drop policy if exists "kv_anon_platform_delete" on public.kv;
-- drop policy if exists "kv_anon_all" on public.kv;
-- create policy "kv_anon_all" on public.kv
--   for all
--   to anon, authenticated
--   using (true)
--   with check (true);
--
-- Setelah rollback, fix root cause (mis. authenticated bridge broken,
-- atau cloud-sync write path issue), baru re-apply migration 0012.

-- ============================================================
-- DONE.
-- ============================================================
