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
    "playly-cloud-retry",     // Bug #9 (2026-05-20): retry queue lokal,
                              // jangan di-sync (akan loop / overwrite cross-
                              // device dgn antrian device lain).
    "playly-cloud-last-sync", // EGRESS OPT (2026-05-21): timestamp delta fetch.
                              // Per device, jangan di-sync.
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

  // Bug #7 fix (2026-05-20): keys yg di-store sebagai array of records butuh
  // MERGE on write (bukan overwrite) supaya konflik cross-device tidak
  // clobber entry yg di-tulis device lain. Mis. user A submit pending +
  // admin B approve simultaneously → last upsert wins = salah satu hilang.
  // Strategi merge: union by `code`/`id`, pick higher status priority +
  // latest paidAt sebagai tie-break.
  const MERGE_KEYS_ARRAY = {
    "playly-premium-payments": {
      idField: "code",
      rank: (e) => {
        const s = e && e.status;
        if (s === "activated") return 4;
        if (s === "approved") return 3;
        if (s === "rejected") return 2;
        if (s === "pending") return 1;
        return 0;
      },
      tieBreak: (e) => Number(e && (e.updatedAt || e.paidAt)) || 0,
    },
    // CR-6 fix (2026-05-21): SECURITY — report queue rentan race-stomp. User
    // A & B report video bersamaan → last-write-wins di cloud-sync → salah
    // satu laporan hilang. Merge by report id, status sebagai rank
    // (removed/approved overrides pending; pending > undefined).
    "playly-admin-mod": {
      idField: "id",
      rank: (e) => {
        const s = e && e.status;
        if (s === "removed") return 3;
        if (s === "approved") return 2;
        if (s === "pending") return 1;
        return 0;
      },
      tieBreak: (e) => Number(e && (e.updatedAt || e.reportedAt)) || 0,
    },
  };

  function mergeArrayRecords(local, cloud, cfg) {
    if (!Array.isArray(local)) local = [];
    if (!Array.isArray(cloud)) cloud = [];
    const byId = new Map();
    const upsert = (e) => {
      if (!e) return;
      const id = e[cfg.idField];
      if (id == null) return;
      const prev = byId.get(id);
      if (!prev) { byId.set(id, e); return; }
      const rankP = cfg.rank(prev);
      const rankE = cfg.rank(e);
      if (rankE > rankP) { byId.set(id, e); return; }
      if (rankE < rankP) return;
      // Equal rank → pick newer tieBreak (updatedAt > paidAt)
      if (cfg.tieBreak(e) >= cfg.tieBreak(prev)) byId.set(id, e);
    };
    // Cloud first (server state), then local (our recent edits) → local wins
    // for ties because Map preserves insertion order but we overwrite via set.
    cloud.forEach(upsert);
    local.forEach(upsert);
    return Array.from(byId.values());
  }

  // Fetch cloud row for a single key (untuk merge logic).
  async function fetchOneRow(key) {
    const sb = client();
    if (!sb) return null;
    try {
      const { data, error } = await sb.from("kv").select("value").eq("key", key).maybeSingle();
      if (error) { console.warn("[cloud] fetchOne", key, error.message); return null; }
      return data ? data.value : null;
    } catch (err) { console.warn("[cloud] fetchOne exception", key, err); return null; }
  }

  // Bug #9 fix (2026-05-20): retry queue untuk pushes yg gagal (Supabase
  // down, network error, RLS reject). Sebelumnya fire-and-forget hanya
  // console.warn → data user nyangkut di localStorage saja, admin tidak
  // pernah lihat. Sekarang failed pushes di-enqueue ke retry list +
  // di-coba ulang otomatis pada interval / online event / next softResync.
  const RETRY_QUEUE_KEY = "playly-cloud-retry";
  function loadRetryQueue() {
    try { return JSON.parse(window.localStorage.getItem(RETRY_QUEUE_KEY) || "[]"); }
    catch { return []; }
  }
  function saveRetryQueue(arr) {
    try { origSet.call(window.localStorage, RETRY_QUEUE_KEY, JSON.stringify(arr.slice(-50))); } catch {}
  }
  function enqueueRetry(key, value) {
    const q = loadRetryQueue();
    // Dedupe by key — keep latest value only
    const filtered = q.filter(e => e.key !== key);
    filtered.push({ key, value, queuedAt: Date.now() });
    saveRetryQueue(filtered);
  }
  let _retryFlushing = false;
  async function flushRetryQueue() {
    if (_retryFlushing) return;
    const sb = client();
    if (!sb) return;
    const q = loadRetryQueue();
    if (!q.length) return;
    _retryFlushing = true;
    const remaining = [];
    for (const entry of q) {
      try {
        const { error } = await sb.from("kv")
          .upsert({ key: entry.key, value: entry.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) { remaining.push(entry); console.warn("[cloud] retry still failing:", entry.key, error.message); }
      } catch (err) { remaining.push(entry); console.warn("[cloud] retry exception:", entry.key, err); }
    }
    saveRetryQueue(remaining);
    _retryFlushing = false;
  }

  // === push (fire-and-forget) ============================================
  function pushToCloud(key, raw) {
    const sb = client();
    if (!sb) return;
    if (!shouldSync(key)) return;
    if (key === RETRY_QUEUE_KEY) return; // jangan loop the retry queue itself
    let value;
    try { value = JSON.parse(raw); } catch { value = raw; }
    // Merge-on-write untuk array-of-records keys yg rentan stomp.
    const mergeCfg = MERGE_KEYS_ARRAY[key];
    if (mergeCfg && Array.isArray(value)) {
      // Async path: pull cloud → merge → upsert. Fire-and-forget tetap.
      (async () => {
        try {
          const cloudValue = await fetchOneRow(key);
          const cloudArr = Array.isArray(cloudValue) ? cloudValue : [];
          const merged = mergeArrayRecords(value, cloudArr, mergeCfg);
          try {
            const newRaw = JSON.stringify(merged);
            if (newRaw !== raw) origSet.call(window.localStorage, key, newRaw);
          } catch {}
          const { error } = await sb.from("kv")
            .upsert({ key, value: merged, updated_at: new Date().toISOString() }, { onConflict: "key" });
          if (error) { enqueueRetry(key, merged); console.warn("[cloud] merge-push failed, queued retry:", error.message); }
        } catch (err) { enqueueRetry(key, value); console.warn("[cloud] merge-push exception, queued retry:", err); }
      })();
      return;
    }
    sb.from("kv")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      )
      .then(({ error }) => {
        if (error) { enqueueRetry(key, value); console.warn("[cloud] push failed, queued retry:", error.message); }
      })
      .catch((err) => { enqueueRetry(key, value); console.warn("[cloud] push exception, queued retry:", err); });
  }
  function deleteFromCloud(key) {
    const sb = client();
    if (!sb) return Promise.resolve();
    if (!shouldSync(key)) return Promise.resolve();
    return sb.from("kv").delete().eq("key", key)
      .then(({ error }) => { if (error) console.warn("[cloud]", error.message); });
  }

  // === fetch all =========================================================
  // EGRESS OPTIMIZATION (2026-05-21): support delta fetch via `since` arg.
  // Tanpa since → full fetch (dipakai di boot). Dengan since → cuma rows
  // yg updated_at > since → drastis kurangi egress (90%+ saving).
  async function fetchAllRows(opts) {
    const sb = client();
    if (!sb) return [];
    const since = opts && opts.since ? opts.since : null;
    let q = sb.from("kv").select("key,value,updated_at").like("key", `${PREFIX}%`);
    if (since) q = q.gt("updated_at", since);
    const { data, error } = await q;
    if (error) {
      console.warn("[cloud] fetch failed:", error.message);
      return [];
    }
    return data || [];
  }
  // Track latest updated_at yg sudah kita pull — untuk delta selanjutnya.
  const LAST_SYNC_KEY = "playly-cloud-last-sync";
  function getLastSync() {
    try { return window.localStorage.getItem(LAST_SYNC_KEY) || null; }
    catch { return null; }
  }
  function setLastSync(ts) {
    try { origSet.call(window.localStorage, LAST_SYNC_KEY, ts); } catch {}
  }
  function updateLastSyncFromRows(rows) {
    let maxTs = getLastSync();
    for (const r of rows) {
      if (r.updated_at && (!maxTs || r.updated_at > maxTs)) maxTs = r.updated_at;
    }
    if (maxTs) setLastSync(maxTs);
  }

  function applyToLocal(rows) {
    const changedKeys = [];
    for (const row of rows) {
      if (row.value == null) continue;
      if (NO_SYNC_KEYS.has(row.key)) continue; // hormati privasi device-local
      try {
        // Bug fix 2026-05-11: JSON.stringify pada raw string menambah quote
        // pembungkus ('"light"' instead of 'light') — bikin attribute matcher
        // gagal (mis. body[data-theme="light"] nggak match). Solusi: kalau
        // value sudah string, simpan as-is; cuma stringify objek/array/number.
        const newVal = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
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
    // EGRESS OPT (2026-05-21): boot/full sync ambil semua, tapi simpan
    // lastSync timestamp setelahnya supaya softResync berikutnya delta saja.
    const cloudRows = await fetchAllRows();
    const cloudKeys = new Set(cloudRows.map((r) => r.key));
    applyToLocal(cloudRows);
    updateLastSyncFromRows(cloudRows);
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

  // CR-5 fix (2026-05-21): SECURITY/COST — delete video blob dari Supabase
  // Storage. Sebelumnya deleteAdminVideo hanya hapus localStorage + IDB blob,
  // file MP4 di Supabase Storage dibiarkan → bucket grows forever, egress
  // drain (relevan kita lagi krisis egress quota). Caller bisa await
  // (rekomendasi) atau fire-and-forget; return promise resolves dgn
  // {ok, error?}.
  async function deleteVideoBlob(id) {
    const sb = client();
    if (!sb) return { ok: false, error: "cloud_disabled" };
    try {
      const filename = await findVideoFilename(id);
      if (!filename) return { ok: true, skipped: "not_found" };
      const { error } = await sb.storage.from(BUCKET).remove([filename]);
      if (error) {
        console.warn("[cloud] delete blob failed:", error.message);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (err) {
      console.warn("[cloud] delete blob exception:", err);
      return { ok: false, error: err?.message || "exception" };
    }
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
  let lastSyncCallAt = 0;
  // EGRESS OPT (2026-05-21): rate-limit dari 3s → 60s (was burning quota dgn
  // pull tiap focus). Delta fetch via updated_at > lastSync → 90%+ saving.
  async function softResync(opts) {
    const force = opts && opts.force === true;
    const now = Date.now();
    if (!force && now - lastSyncCallAt < 60000) return;
    lastSyncCallAt = now;
    try { await flushRetryQueue(); } catch {}
    const since = getLastSync();
    const rows = await fetchAllRows({ since });
    if (rows.length > 0) {
      applyToLocal(rows);
      updateLastSyncFromRows(rows);
    }
  }
  // EGRESS OPT (2026-05-21): force selective key sync — pull SATU key saja.
  // Dipakai oleh admin queue auto-sync supaya nggak narik 200+ keys cuma
  // untuk cek premium-payments updates.
  async function syncSingleKey(key) {
    const sb = client();
    if (!sb) return;
    try {
      const { data, error } = await sb.from("kv")
        .select("key,value,updated_at")
        .eq("key", key)
        .maybeSingle();
      if (error || !data) return;
      applyToLocal([data]);
      updateLastSyncFromRows([data]);
    } catch (err) { console.warn("[cloud] syncSingleKey:", err); }
  }
  function attachAutoRefresh() {
    if (!enabled) return;
    window.addEventListener("focus", () => { void softResync(); });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void softResync();
    });
    // Bug #9: retry pada `online` event — koneksi kembali setelah offline
    window.addEventListener("online", () => { void flushRetryQueue(); });
    // Periodic flush tiap 30s sebagai safety net (kalau push gagal tanpa
    // network event yang clear, mis. RLS sementara reject).
    setInterval(() => { void flushRetryQueue(); }, 30000);
  }

  // === expose helpers ====================================================
  window.cloudSync = {
    enabled,
    uploadVideoBlob,
    deleteVideoBlob,
    getVideoUrl,
    getSignedVideoUrl,
    fetchAllRows,
    softResync,
    syncSingleKey,
    computeBucketBytes,
    // pushKey: explicit force-push specific localStorage key ke Supabase kv.
    // Dipakai DM/notification code untuk push ke peer state immediately
    // tanpa menunggu next softResync. Sebelumnya tidak diekspor → silently
    // no-op. Fix B3/C9 audit 2026-05-02.
    pushKey: function(key) {
      if (!key) return;
      const raw = localStorage.getItem(key);
      if (raw == null) return;
      try { pushToCloud(key, raw); } catch (err) { console.warn("[cloud-sync] pushKey", key, err); }
    },
    // removeKey/removeKeys: explicit force-delete dari cloud kv tanpa
    // perlu touch localStorage. Hijack `localStorage.removeItem` di atas
    // udah auto-mirror delete, jadi method ini sebagian besar belt-and-
    // suspenders + dipakai untuk batch cleanup yang udah lewat (mis.
    // hapus key yang udah ke-remove dari localStorage tapi masih nyangkut
    // di cloud karena race-condition saat Reset Data).
    removeKey: function(key) {
      if (!key) return Promise.resolve();
      try { return deleteFromCloud(key) || Promise.resolve(); }
      catch (err) { console.warn("[cloud-sync] removeKey", key, err); return Promise.resolve(); }
    },
    // Returns Promise.all dari semua deletes — caller WAJIB await supaya
    // delete bener-bener committed di cloud sebelum reload page. Tanpa await,
    // race-condition bisa bikin bidirectionalSync di boot berikutnya pull
    // row stale dari cloud lalu re-apply ke localStorage → akun "balik".
    removeKeys: function(keys) {
      if (!Array.isArray(keys)) return Promise.resolve();
      const promises = [];
      for (const k of keys) {
        if (!k) continue;
        try {
          const p = deleteFromCloud(k);
          if (p && typeof p.then === "function") promises.push(p);
        } catch (err) { console.warn("[cloud-sync] removeKeys", k, err); }
      }
      return Promise.all(promises);
    },
    // wipeUserKeys: BULK delete semua user-specific keys dari Supabase kv
    // dalam SATU request per prefix (pake `like` filter). Jauh lebih reliable
    // dari per-key delete — Supabase commit semua hapus atomically + 1 request
    // = 1 commit point. Account keys di-fetch dulu lalu filter exclude admin
    // emails sebelum delete (admin keyed by email juga di prefix yang sama).
    // Caller WAJIB await sebelum reload supaya delete bener2 commit.
    wipeUserKeys: async function(adminEmails) {
      const sb = client();
      if (!sb) return { ok: false, reason: "cloud_disabled" };
      const adminSet = new Set((adminEmails || []).map(e => String(e).toLowerCase()));
      try {
        // 1) Fetch semua playly-account-* dari cloud, filter non-admin, delete
        const { data: acctRows } = await sb
          .from("kv")
          .select("key,value")
          .like("key", "playly-account-%");
        const acctKeysToDelete = [];
        for (const row of (acctRows || [])) {
          const key = row.key;
          // Email-keyed account: parse identifier dari key
          const identifier = key.replace(/^playly-account-/, "").toLowerCase();
          if (adminSet.has(identifier)) continue;
          // Defensive: cek role di value juga, jangan hapus admin yang
          // username-keyed (rare tapi mungkin).
          let val = row.value;
          if (typeof val === "string") {
            try { val = JSON.parse(val); } catch {}
          }
          if (val && val.role === "admin") continue;
          acctKeysToDelete.push(key);
        }
        if (acctKeysToDelete.length) {
          await sb.from("kv").delete().in("key", acctKeysToDelete);
        }
        // 2) Bulk delete user-specific keys by prefix dalam 1 request per prefix.
        const userPrefixes = [
          "playly-state-%",
          "playly-welcomed-%",
          "playly-welcome-%",
          "playly-onboarding-%",
          "playly-notif-%",
          "playly-prefs-%",
        ];
        await Promise.all(
          userPrefixes.map(p =>
            sb.from("kv").delete().like("key", p)
              .then(({ error }) => { if (error) console.warn("[cloud] wipe", p, error.message); })
          )
        );
        return { ok: true, accountsDeleted: acctKeysToDelete.length };
      } catch (err) {
        console.warn("[cloud-sync] wipeUserKeys error:", err);
        return { ok: false, reason: "exception", message: err?.message };
      }
    },
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
    s.src = "script.js?v=20260517-home-typo-v278";
    s.dataset.playlyMain = "1";
    document.body.appendChild(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
