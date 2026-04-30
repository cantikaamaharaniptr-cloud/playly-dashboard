/* Playly Cloud Sync — sync localStorage + IndexedDB video blobs ke Supabase.
 * Loaded sebelum script.js. Boot flow:
 *   1) tampilkan overlay "Sinkronisasi..."
 *   2) fetch semua row playly-* dari kv table → populate localStorage
 *   3) inject script.js dinamis
 *   4) hide overlay
 *
 * Setelah boot, semua localStorage.setItem/removeItem untuk key playly-*
 * otomatis di-mirror ke Supabase. Helper window.cloudSync.uploadVideoBlob()
 * dan window.cloudSync.getVideoUrl() di-export untuk dipakai script.js.
 */

(function () {
  "use strict";

  const PREFIX = "playly-";
  const BUCKET = "videos";
  // Key yang TIDAK boleh sync ke cloud — privasi / device-specific.
  const NO_SYNC_KEYS = new Set([
    "playly-device-accounts", // daftar akun yang pernah login di device ini
    "playly-user",            // session marker — wajib device-local, jangan
                              // di-sync dari cloud (kalau di-sync, device lain
                              // bisa "auto-login" dari session orang lain)
  ]);
  function shouldSync(key) {
    if (typeof key !== "string") return false;
    if (!key.startsWith(PREFIX)) return false;
    if (NO_SYNC_KEYS.has(key)) return false;
    return true;
  }
  const cfg = window.PLAYLY_SUPABASE || {};
  const enabled = !!(cfg.url && cfg.key && window.supabase?.createClient);

  // === overlay ============================================================
  function makeOverlay() {
    const el = document.createElement("div");
    el.id = "playly-cloud-overlay";
    el.style.cssText = [
      "position:fixed", "inset:0", "z-index:99999",
      "display:grid", "place-items:center",
      "background:#1a0e10", "color:#bfae9e",
      "font-family:'Inter',sans-serif", "gap:12px",
      "text-align:center", "padding:20px",
    ].join(";");
    el.innerHTML =
      '<div style="font-size:36px">☁️</div>' +
      '<p style="margin:0;font-size:14px">Sinkronisasi data dari cloud...</p>';
    return el;
  }
  function removeOverlay() {
    document.getElementById("playly-cloud-overlay")?.remove();
  }

  // === localStorage hijack ================================================
  // Jalan SEKARANG (synchronous) supaya semua write yang terjadi setelah ini
  // langsung di-mirror ke Supabase.
  const origSet = Storage.prototype.setItem;
  const origRemove = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key, value) {
    origSet.call(this, key, value);
    if (this !== window.localStorage) return;
    if (!shouldSync(key)) return;
    pushToCloud(key, value);
  };
  Storage.prototype.removeItem = function (key) {
    origRemove.call(this, key);
    if (this !== window.localStorage) return;
    if (!shouldSync(key)) return;
    deleteFromCloud(key);
  };

  // === Supabase client (lazy) =============================================
  let _client = null;
  function client() {
    if (!enabled) return null;
    if (!_client) {
      _client = window.supabase.createClient(cfg.url, cfg.key, {
        auth: { persistSession: false },
      });
    }
    return _client;
  }

  // === push (fire-and-forget) ============================================
  function pushToCloud(key, raw) {
    const sb = client();
    if (!sb) return;
    if (!shouldSync(key)) return;
    let value;
    try { value = JSON.parse(raw); } catch { value = raw; }
    sb.from("kv")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      )
      .then(({ error }) => { if (error) console.warn("[cloud]", error.message); });
  }
  function deleteFromCloud(key) {
    const sb = client();
    if (!sb) return;
    if (!shouldSync(key)) return;
    sb.from("kv").delete().eq("key", key)
      .then(({ error }) => { if (error) console.warn("[cloud]", error.message); });
  }

  // === fetch all =========================================================
  async function fetchAllRows() {
    const sb = client();
    if (!sb) return [];
    const { data, error } = await sb
      .from("kv")
      .select("key,value")
      .like("key", `${PREFIX}%`);
    if (error) {
      console.warn("[cloud] fetch failed:", error.message);
      return [];
    }
    return data || [];
  }

  function applyToLocal(rows) {
    const changedKeys = [];
    for (const row of rows) {
      if (row.value == null) continue;
      if (NO_SYNC_KEYS.has(row.key)) continue; // hormati privasi device-local
      try {
        const newVal = JSON.stringify(row.value);
        const prevVal = window.localStorage.getItem(row.key);
        if (prevVal !== newVal) changedKeys.push(row.key);
        // pakai origSet supaya tidak trigger pushToCloud (loop infinit)
        origSet.call(window.localStorage, row.key, newVal);
      } catch {}
    }
    if (changedKeys.length) {
      // Beri tahu script.js supaya re-render view yang terdampak (mis. admin user table)
      window.dispatchEvent(new CustomEvent("playly:cloud-applied", { detail: { keys: changedKeys } }));
    }
  }

  // Snapshot semua key playly-* yang ada di localStorage SAAT ini.
  function snapshotLocalKeys() {
    const out = new Map();
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const v = window.localStorage.getItem(k);
      if (v != null) out.set(k, v);
    }
    return out;
  }

  // Bidirectional sync:
  // 1. Snapshot keys lokal yang ada SEBELUM apply cloud
  // 2. Pull cloud → local (cloud wins untuk konflik)
  // 3. Push key yang local-only (tidak ada di cloud) → cloud
  async function bidirectionalSync() {
    const sb = client();
    if (!sb) return;
    const localBefore = snapshotLocalKeys();
    const cloudRows = await fetchAllRows();
    const cloudKeys = new Set(cloudRows.map((r) => r.key));
    applyToLocal(cloudRows);
    // Push key yang ada di local TAPI belum ada di cloud
    for (const [k, raw] of localBefore.entries()) {
      if (cloudKeys.has(k)) continue;
      pushToCloud(k, raw);
    }
  }

  // === video blob: Supabase Storage =====================================
  function blobPath(id, mime) {
    const ext = !mime ? "mp4"
      : mime.includes("webm") ? "webm"
      : mime.includes("quicktime") ? "mov"
      : "mp4";
    return `${id}.${ext}`;
  }

  // Upload video blob ke Supabase Storage.
  // Return { ok, url, error } supaya caller bisa surface error ke user.
  async function uploadVideoBlob(id, blob) {
    const sb = client();
    if (!sb) return { ok: false, error: "cloud_disabled" };
    if (!blob) return { ok: false, error: "no_blob" };
    const sizeMB = blob.size / 1024 / 1024;
    try {
      const path = blobPath(id, blob.type);
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
        upsert: true,
        contentType: blob.type || "video/mp4",
      });
      if (error) {
        console.warn("[cloud] upload error:", error);
        // Detect "Payload too large" / quota issues
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("payload") || msg.includes("too large") || msg.includes("size")) {
          return {
            ok: false,
            error: "file_too_large",
            message: `File ${sizeMB.toFixed(1)} MB melebihi batas Supabase Storage. Naikkan limit di Supabase dashboard → Storage → bucket "videos" → File size limit, atau pilih video yang lebih kecil.`,
          };
        }
        return { ok: false, error: "upload_failed", message: error.message };
      }
      const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
      return { ok: true, url: data?.publicUrl || null };
    } catch (e) {
      console.warn("[cloud] upload exception:", e);
      return { ok: false, error: "exception", message: e?.message || "Upload gagal" };
    }
  }

  async function findVideoFilename(id) {
    const sb = client();
    if (!sb) return null;
    try {
      const { data } = await sb.storage.from(BUCKET).list("", {
        search: `${id}.`,
      });
      const f = (data || []).find((x) => x.name.startsWith(`${id}.`));
      return f?.name || null;
    } catch { return null; }
  }

  async function getVideoUrl(id) {
    const sb = client();
    if (!sb) return null;
    const filename = await findVideoFilename(id);
    if (!filename) return null;
    const { data } = sb.storage.from(BUCKET).getPublicUrl(filename);
    return data?.publicUrl || null;
  }

  // Direct link bertanda-tangan (signed URL) — beda tiap akses + auto-expire.
  // Default 2 jam (7200 detik). Pakai untuk share .mp4 langsung yang aman.
  async function getSignedVideoUrl(id, expiresIn = 7200) {
    const sb = client();
    if (!sb) return null;
    const filename = await findVideoFilename(id);
    if (!filename) return null;
    try {
      const { data, error } = await sb.storage
        .from(BUCKET).createSignedUrl(filename, expiresIn);
      if (!error && data?.signedUrl) return data.signedUrl;
    } catch {}
    // Fallback ke public URL kalau signed gagal (bucket public-only)
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(filename);
    return pub?.publicUrl || null;
  }

  // List semua file di bucket "videos" → total bytes. Pagination 1000/halaman.
  async function computeBucketBytes() {
    const sb = client();
    if (!sb) return 0;
    let total = 0;
    let offset = 0;
    const PAGE = 1000;
    try {
      while (true) {
        const { data, error } = await sb.storage.from(BUCKET).list("", {
          limit: PAGE,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error || !data || !data.length) break;
        for (const f of data) {
          const sz = f?.metadata?.size;
          if (typeof sz === "number") total += sz;
        }
        if (data.length < PAGE) break;
        offset += data.length;
      }
    } catch (e) {
      console.warn("[cloud] bucket size scan failed:", e);
    }
    return total;
  }

  // === auto-refresh saat tab dapat focus ================================
  let lastSync = 0;
  async function softResync() {
    const now = Date.now();
    if (now - lastSync < 3000) return;
    lastSync = now;
    // Soft refresh: cuma pull cloud (tab aktif tidak butuh push, hijack
    // setItem sudah handle write berikutnya secara real-time).
    const rows = await fetchAllRows();
    applyToLocal(rows);
  }
  function attachAutoRefresh() {
    if (!enabled) return;
    window.addEventListener("focus", () => { void softResync(); });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void softResync();
    });
  }

  // === expose helpers ====================================================
  window.cloudSync = {
    enabled,
    uploadVideoBlob,
    getVideoUrl,
    getSignedVideoUrl,
    fetchAllRows,
    softResync,
    computeBucketBytes,
  };

  // === boot ==============================================================
  async function boot() {
    if (!enabled) {
      // Supabase tidak di-set → langsung load script.js (mode lokal)
      injectMainScript();
      return;
    }
    document.body.appendChild(makeOverlay());
    try {
      await Promise.race([
        bidirectionalSync(),
        new Promise((r) => setTimeout(r, 8000)), // timeout 8s
      ]);
    } catch (e) {
      console.warn("[cloud] boot sync failed:", e);
    }
    injectMainScript();
    attachAutoRefresh();
    // overlay dihilangkan setelah script.js mulai jalan (browser paint cycle)
    setTimeout(removeOverlay, 250);
  }

  function injectMainScript() {
    if (document.querySelector('script[data-playly-main]')) return;
    const s = document.createElement("script");
    s.src = "script.js?v=20260430-broadcasts-subpage";
    s.dataset.playlyMain = "1";
    document.body.appendChild(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
