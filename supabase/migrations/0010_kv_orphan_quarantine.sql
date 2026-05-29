-- Orphan cleanup + auto-heal trigger — Phase B6c-extension (2026-05-25 v542).
--
-- Setelah migration 0009 (B6c), 5 row `playly-account-*` di kv table user_id
-- NULL — tidak match profile manapun. Audit hasilnya:
--   1-4. Test orphans (cantika@playly.app, user1, userbaru1, usernew1)
--        → safe DELETE
--   5. admin.playly2@gmail.com → REAL admin backup, belum pernah login via
--      Supabase Auth bridge (no profile row). PRESERVE — akan self-heal
--      saat admin login via auto-heal trigger.
--
-- Scope migration ini:
--   1. Cleanup 4 known test orphans (idempotent, safe)
--   2. Auto-heal trigger: stamp user_id otomatis saat profile baru
--      ke-create dgn email/username matching orphan kv key
--   3. SKIP RLS tightening — defer ke B6a-4 dimana cloud-sync read path
--      juga harus refactor (anon-key → cookie-auth). Stricter RLS sekarang
--      tanpa cloud-sync refactor → break boot sync untuk user belum login.
--
-- Run via Supabase Dashboard → SQL Editor → paste → Run. Idempotent.

-- ============================================================
-- 1. Auto-cleanup known test orphans
-- ============================================================
delete from public.kv
where key like 'playly-account-%'
  and user_id is null
  and (
    -- Test patterns yg pernah ke-purge via /api/cleanup atau IIFE
    key = 'playly-account-user1@gmail.com' or
    key = 'playly-account-userbaru1@gmail.com' or
    key = 'playly-account-usernew1@gmail.com' or
    key = 'playly-account-cantika@playly.app' or
    -- Pattern test umum (suffix dot test/demo/example)
    key like 'playly-account-test%@%' or
    key like 'playly-account-demo%@%' or
    key like 'playly-account-example%@%'
  );

-- ============================================================
-- 2. Update kv_is_per_user_key untuk include playly-account-{email}
-- Hanya kalau suffix berisi @ (= user email account, bukan system key).
-- ============================================================
create or replace function public.kv_is_per_user_key(k text)
returns boolean
language sql
immutable
as $$
  select
    k like 'playly-state-%' or
    (k like 'playly-account-%' and position('@' in substring(k from 16)) > 0) or
    k like 'playly-prefs-%' or
    k like 'playly-welcomed-%' or
    k like 'playly-welcome-%' or
    k like 'playly-onboarding-%' or
    k like 'playly-notif-%' or
    k like 'playly-2fa-%';
$$;

-- ============================================================
-- 3. Auto-heal trigger: stamp user_id saat profile baru ke-create
--
-- Use case:
--   - admin.playly2 login pertama kali via Supabase Auth bridge
--   - Bridge upsert ke profiles table (B2 flow)
--   - Trigger ini fire → scan kv table untuk orphan `playly-account-{email}`
--     matching NEW.email → stamp user_id otomatis
--   - Akun ter-restore ke per-user RLS scope tanpa manual intervention
-- ============================================================
create or replace function public.kv_autoheal_on_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Stamp orphan `playly-account-{email}` matching new profile email
  update public.kv
  set user_id = NEW.id
  where user_id is null
    and key = 'playly-account-' || lower(NEW.email);

  -- Stamp orphan keys by username (state, prefs, welcomed)
  if NEW.username is not null then
    update public.kv
    set user_id = NEW.id
    where user_id is null
      and key in (
        'playly-state-' || lower(NEW.username),
        'playly-prefs-' || lower(NEW.username),
        'playly-welcomed-' || lower(NEW.username),
        'playly-welcome-' || lower(NEW.username),
        'playly-onboarding-' || lower(NEW.username),
        'playly-notif-' || lower(NEW.username)
      );
  end if;

  -- Stamp orphan prefs/notif by email (some keys use email suffix)
  update public.kv
  set user_id = NEW.id
  where user_id is null
    and key in (
      'playly-prefs-' || lower(NEW.email),
      'playly-notif-' || lower(NEW.email)
    );

  return NEW;
end;
$$;

drop trigger if exists kv_autoheal_on_profile_trg on public.profiles;
create trigger kv_autoheal_on_profile_trg
  after insert or update of email, username
  on public.profiles
  for each row
  execute function public.kv_autoheal_on_profile();

-- ============================================================
-- DONE. Verifikasi:
--
-- (a) Cek orphan tersisa — harus 1 row (admin.playly2 saja)
--   select key from kv
--   where key like 'playly-account-%' and user_id is null;
--
-- (b) Cek helper function updated — playly-account-{email} sekarang per-user
--   select kv_is_per_user_key('playly-account-test@example.com');  -- true
--   select kv_is_per_user_key('playly-account-allowlist');         -- false
--
-- (c) Cek trigger ter-install
--   select tgname from pg_trigger where tgname = 'kv_autoheal_on_profile_trg';
--
-- (d) Test auto-heal: kalau admin.playly2 login + bridge create profile,
--     orphan auto-stamp. Cek setelah login:
--   select user_id from kv where key = 'playly-account-admin.playly2@gmail.com';
--   -- harus return UUID profile baru, bukan NULL lagi
-- ============================================================
