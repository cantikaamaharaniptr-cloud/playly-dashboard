# Playly Dashboard — Cleanup Scripts

Script untuk reset SEMUA data user + video Storage di Supabase, **PRESERVE** akun admin + config + migration markers.

⚠️ **DESTRUKTIF — tidak ada backup, tidak bisa recover.**

## Kapan menjalankan

Setelah Supabase quota unlock (salah satu):
- Reset bulanan (Free tier reset awal bulan)
- Upgrade Pro $25/mo (instant unlock)
- Restore via Supabase support

## Urutan eksekusi

### Step 1 — Cleanup KV table (di Supabase Studio)

1. Login Supabase Dashboard → project `playly-dashboard`
2. Sidebar → **SQL Editor**
3. New query → paste isi [`cleanup-kv.sql`](cleanup-kv.sql)
4. **Preview dulu**: uncomment block STEP 1 (SELECT count), Run, cek angka
5. Re-comment STEP 1, **Run STEP 2** (BEGIN/DELETE/COMMIT)
6. Cek output `remaining_rows` + `key list` di hasil — pastikan cuma key yang harus dipreserve yang tersisa

Yang AKAN dihapus:
- Akun non-admin (`playly-account-*` kecuali admin emails)
- State non-admin (`playly-state-*` kecuali admin)
- Semua platform data (videos, views, likes, comments, payments, queue, dll)
- Audit log (admin events)
- Login attempt rate limit non-admin

Yang DIPRESERVE:
- `playly-account-admin.playly@gmail.com` (+ admin2 jika ada)
- `playly-state-admin`
- `playly-ad-config` (konfigurasi iklan)
- Migration markers (`playly-platform-reset-*`, `playly-hard-purge-*`, dll)
- `playly-theme`, `playly-guest-theme`, `playly-guest-lang`

### Step 2 — Cleanup Storage videos (di terminal)

1. Ambil **service role key** dari Supabase Dashboard → Settings → API → service_role secret
   - ⚠️ BUKAN anon key. Service role bypass RLS untuk delete files.
   - ⚠️ Jangan commit key ini ke git!

2. Set env var (atau edit script langsung):
   ```bash
   # Bash / Linux / macOS
   export SUPABASE_SERVICE_KEY="paste_service_role_key_here"

   # PowerShell / Windows
   $env:SUPABASE_SERVICE_KEY="paste_service_role_key_here"
   ```

3. **Preview dulu** (DRY RUN — tidak hapus):
   ```bash
   node scripts/cleanup-storage.js --dry-run
   ```
   Cek output: jumlah file + total MB + sample 10 file pertama.

4. Kalau sudah yakin, **eksekusi delete**:
   ```bash
   node scripts/cleanup-storage.js --confirm
   ```
   Script akan hapus per batch 100 file. Tunggu sampai selesai.

5. Verifikasi di Studio → Storage → bucket `videos` → harus kosong.

### Step 3 — Verifikasi platform

1. Buka https://playly-dashboard.vercel.app/
2. Login pakai akun admin (`admin.playly@gmail.com`) — harus masih bisa login
3. Cek dashboard:
   - Total user: hanya admin (1-2 akun)
   - Total video: 0
   - Pendapatan: 0
   - Audit log: kosong (atau cuma event login admin baru)
4. Login pakai akun user lama (cth. `u1@gmail.com`) — harus GAGAL (akun sudah dihapus)
5. Register akun user baru — harus berhasil + sync ke Supabase

## Troubleshooting

**HTTP 402 saat menjalankan script**
- Berarti Supabase masih restricted. Tunggu unlock dulu.

**HTTP 401/403 saat list/delete**
- Service role key salah atau anon key yang dipakai. Pastikan ambil dari Settings → API → **service_role secret** (bukan anon).

**SQL Editor "permission denied"**
- Pastikan login sebagai owner project, bukan member dengan read-only role.

**Akun admin terhapus tidak sengaja**
- Sudah di-preserve di SQL. Tapi kalau email admin kamu BUKAN `admin.playly@gmail.com`, edit baris `key NOT IN (...)` di SQL dengan email admin asli.

## Setelah cleanup selesai

Platform fresh state. Saran:
1. Update memory file `[[reference-playly-infra.md]]` dengan tanggal reset
2. Pertimbangkan migrate video baru ke Cloudflare R2 (zero egress) supaya tidak kena quota lagi
3. Monitor Supabase Usage di Dashboard → Settings → Usage selama 1-2 minggu pertama setelah reset
