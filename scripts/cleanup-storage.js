#!/usr/bin/env node
/**
 * PLAYLY DASHBOARD — STORAGE BUCKET CLEANUP
 * ==============================================================
 * Purpose: hapus SEMUA file di Supabase Storage bucket "videos"
 *          (MP4 video + thumbnail/poster + file lain).
 * When to run: setelah Supabase quota unlock + setelah cleanup-kv.sql sukses.
 * How to run:
 *   1. Ambil SERVICE ROLE key dari Supabase Dashboard → Settings → API
 *      (BUKAN anon key — service role bypass RLS untuk delete)
 *   2. Edit baris SERVICE_KEY di bawah, paste service role key kamu
 *   3. cd ke folder project, run:
 *      node scripts/cleanup-storage.js --dry-run     # preview, tidak hapus
 *      node scripts/cleanup-storage.js --confirm     # eksekusi delete
 *
 * ⚠️ DESTRUKTIF — file dihapus permanent dari Supabase Storage.
 * Author: 2026-05-21, atas request user untuk full reset platform.
 * ==============================================================
 */

// ===== CONFIG =====
const SUPABASE_URL = "https://ocsonstwwdnwjmhojntf.supabase.co";

// ⚠️ ISI INI DENGAN SERVICE ROLE KEY (BUKAN anon key).
// Ambil di: Supabase Dashboard → Settings → API → service_role secret.
// JANGAN commit key ini ke git!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "PASTE_SERVICE_ROLE_KEY_HERE";

const BUCKET = "videos";
const PAGE_SIZE = 1000;

// ===== ARGS =====
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run") || !args.includes("--confirm");

// ===== MAIN =====
async function listAllFiles() {
  const files = [];
  let offset = 0;
  while (true) {
    const url = `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) {
      console.error(`✗ List failed (HTTP ${res.status}):`, await res.text());
      process.exit(1);
    }
    const data = await res.json();
    if (!data.length) break;
    files.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }
  return files;
}

async function deleteBatch(filenames) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: filenames }),
  });
  if (!res.ok) {
    console.error(`✗ Delete batch failed (HTTP ${res.status}):`, await res.text());
    return false;
  }
  return true;
}

async function main() {
  if (SERVICE_KEY === "PASTE_SERVICE_ROLE_KEY_HERE") {
    console.error("✗ SERVICE_KEY belum diisi. Edit baris SERVICE_KEY di script ini.");
    console.error("  Ambil di: Supabase Dashboard → Settings → API → service_role secret.");
    process.exit(1);
  }

  console.log(`📡 Connecting to ${SUPABASE_URL}`);
  console.log(`🗂️  Bucket: ${BUCKET}`);
  console.log(`🧪 Mode: ${DRY_RUN ? "DRY RUN (preview only)" : "CONFIRM (akan hapus permanent)"}`);
  console.log();

  console.log("📋 Listing semua file di bucket...");
  const files = await listAllFiles();
  console.log(`   Total: ${files.length} file ditemukan`);

  if (files.length === 0) {
    console.log("✓ Bucket sudah kosong. Tidak ada yang dihapus.");
    return;
  }

  // Kalkulasi total bytes
  let totalBytes = 0;
  for (const f of files) {
    if (typeof f?.metadata?.size === "number") totalBytes += f.metadata.size;
  }
  const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
  console.log(`   Total size: ${totalMB} MB`);
  console.log();

  console.log("📄 Preview (10 file pertama):");
  for (const f of files.slice(0, 10)) {
    const sz = ((f?.metadata?.size || 0) / 1024).toFixed(1);
    console.log(`   - ${f.name} (${sz} KB)`);
  }
  if (files.length > 10) console.log(`   ... + ${files.length - 10} file lainnya`);
  console.log();

  if (DRY_RUN) {
    console.log("✓ DRY RUN selesai. Tidak ada file yang dihapus.");
    console.log("  Untuk eksekusi delete, jalankan: node scripts/cleanup-storage.js --confirm");
    return;
  }

  // Eksekusi delete dalam batch 100 file
  console.log("🗑️  Menghapus file (batch 100/request)...");
  const BATCH = 100;
  let deleted = 0;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH).map((f) => f.name);
    const ok = await deleteBatch(batch);
    if (ok) {
      deleted += batch.length;
      console.log(`   ${deleted}/${files.length} dihapus...`);
    } else {
      console.error(`   ✗ Batch ${i}-${i + batch.length} gagal, lanjut batch berikutnya`);
    }
  }

  console.log();
  console.log(`✓ Selesai. ${deleted}/${files.length} file dihapus.`);
  console.log(`   Storage space dibebaskan: ~${totalMB} MB`);
}

main().catch((err) => {
  console.error("✗ Error:", err);
  process.exit(1);
});
