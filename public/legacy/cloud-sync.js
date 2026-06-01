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
    "playly-current-user",    // ORPHAN cleanup (2026-05-22): legacy key dari
                              // versi lama script.js. Sekarang tidak ditulis
                              // (cuma dibaca di purchase modal). Tapi cloud kv
                              // masih nyimpen value lama ("demo_creator", dst)
                              // → re-sync tiap load → state inconsistency.
                              // NO_SYNC supaya local nggak ke-pollute dari cloud.
  ]);
  // Phase B5 (2026-05-25) — prefix-based exclusion. Untuk kelompok key
  // per-user yang sekarang punya tabel Supabase dedicated (RLS owner-only)
  // → hapus dari kv mirror supaya:
  //   1) tidak duplikat antara kv + tabel khusus (kv permissive RLS =
  //      data privacy leak).
  //   2) kv table footprint mengecil → kurangi egress.
  //   3) ada satu source of truth per kategori.
  const NO_SYNC_PREFIXES = [
    "playly-state-",          // B3: di public.user_state (RLS owner-only).
                              // Mirror via syncState() di bridge bukan kv.
    "playly-2fa-",            // B5 audit: PIN hash 2FA — sensitif, JANGAN
                              // sync. Sebelumnya tidak di-block (bug). PIN
                              // per-device — user setup 2FA ulang kalau
                              // ganti device (acceptable security tradeoff).
  ];
  function isPrefixExcluded(key) {
    for (let i = 0; i < NO_SYNC_PREFIXES.length; i++) {
      if (key.startsWith(NO_SYNC_PREFIXES[i])) return true;
    }
    return false;
  }
  function shouldSync(key) {
    if (typeof key !== "string") return false;
    if (!key.startsWith(PREFIX)) return false;
    if (NO_SYNC_KEYS.has(key)) return false;
    if (isPrefixExcluded(key)) return false;
    return true;
  }

  // Phase B6a-3 (2026-05-25): Per-user keys yang harus di-bridge via
  // /api/kv/sync (cookie auth + server stamp user_id) instead of anon-key
  // direct write. Tujuan: enforce RLS per-user, kurangi privacy risk.
  //
  // Phase B6c-extension (v542, 2026-05-25): tambah `playly-account-{email}`
  // — setelah B6c rename CUTOFF_TS_KEY ke playly-syskey-*, semua
  // `playly-account-*` 100% user accounts (suffix @email). Migration 0010
  // stricter RLS akan deny anon-key push untuk per-user keys setelah
  // B6a-4 cutover, jadi WAJIB route via bridge.
  //
  // SKIP (di-handle lain):
  //   - playly-state-*, playly-2fa-* (NO_SYNC_PREFIXES, never sync)
  //   - playly-cloud-*, playly-user, playly-device-accounts (NO_SYNC_KEYS)
  //
  // LOCKSTEP dgn app/api/kv/sync/route.ts PER_USER_PREFIXES — sync wajib.
  const PER_USER_PREFIXES_BRIDGE = [
    "playly-prefs-",
    "playly-welcomed-",
    "playly-welcome-",
    "playly-onboarding-",
    "playly-notif-",
    // playly-account-* — special handling via isPerUserBridgeKey suffix check
  ];
  function isPerUserBridgeKey(key) {
    if (typeof key !== "string") return false;
    // Standard prefix match
    for (let i = 0; i < PER_USER_PREFIXES_BRIDGE.length; i++) {
      if (key.startsWith(PER_USER_PREFIXES_BRIDGE[i])) return true;
    }
    // playly-account-* hanya per-user kalau suffix berisi @ (= user email).
    // Sistem keys spt playly-syskey-* atau hipotetical playly-account-allowlist
    // tidak match karena no @. Match API route logic.
    if (key.startsWith("playly-account-")) {
      var suffix = key.slice("playly-account-".length);
      return suffix.indexOf("@") !== -1;
    }
    return false;
  }
  // Feature flag — kill switch kalau bridge bermasalah di production.
  // Set window.PLAYLY_USE_KV_BRIDGE = false sebelum reload untuk disable.
  function useKvBridge() {
    return window.PLAYLY_USE_KV_BRIDGE !== false;
  }
  // POST/DELETE via /api/kv/sync. Returns { ok, reason?, status? }.
  // Fire-and-forget caller — pakai .then() bukan await supaya tidak block.
  async function pushViaKvBridge(key, value) {
    try {
      const resp = await fetch("/api/kv/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key, value: value }),
      });
      let data = null;
      try { data = await resp.json(); } catch (_) {}
      if (resp.ok && data && data.ok) return { ok: true, perUser: !!data.perUser };
      return { ok: false, reason: (data && data.error) || "http_" + resp.status, status: resp.status };
    } catch (err) { return { ok: false, reason: String(err) }; }
  }
  async function deleteViaKvBridge(key) {
    try {
      const resp = await fetch("/api/kv/sync", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key }),
      });
      let data = null;
      try { data = await resp.json(); } catch (_) {}
      if (resp.ok && data && data.ok) return { ok: true };
      return { ok: false, reason: (data && data.error) || "http_" + resp.status, status: resp.status };
    } catch (err) { return { ok: false, reason: String(err) }; }
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
    // Phase B6a-3 (2026-05-25): per-user keys → route via /api/kv/sync
    // (cookie auth + RLS enforcement) BUKAN anon-key langsung.
    // Fallback ke anon-key kalau bridge fail (network / no-auth / schema).
    // Backward compat sampai B6a-4 cutover (drop kv_anon_all policy).
    if (useKvBridge() && isPerUserBridgeKey(key)) {
      pushViaKvBridge(key, value).then(function (res) {
        if (!res.ok) {
          // Bridge gagal — fallback ke anon path (existing behavior)
          console.warn("[cloud] bridge push failed for " + key + " — fallback to anon. Reason:", res.reason);
          pushViaAnon(key, value, raw);
        }
        // res.ok = sukses → no further action
      });
      return;
    }
    pushViaAnon(key, value, raw);
  }

  // Anon-key path — existing behavior, extracted ke function terpisah supaya
  // bisa di-reuse sebagai fallback dari bridge path (B6a-3).
  function pushViaAnon(key, value, raw) {
    const sb = client();
    if (!sb) return;
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
    // Phase B6a-3 (2026-05-25): per-user keys → bridge DELETE.
    if (useKvBridge() && isPerUserBridgeKey(key)) {
      return deleteViaKvBridge(key).then(function (res) {
        if (!res.ok) {
          console.warn("[cloud] bridge delete failed for " + key + " — fallback to anon. Reason:", res.reason);
          return sb.from("kv").delete().eq("key", key)
            .then(({ error }) => { if (error) console.warn("[cloud]", error.message); });
        }
      });
    }
    return sb.from("kv").delete().eq("key", key)
      .then(({ error }) => { if (error) console.warn("[cloud]", error.message); });
  }

  // === fetch all =========================================================
  // EGRESS OPTIMIZATION (2026-05-21): support delta fetch via `since` arg.
  // Tanpa since → full fetch (dipakai di boot). Dengan since → cuma rows
  // yg updated_at > since → drastis kurangi egress (90%+ saving).
  //
  // Phase B6a-4 prep (v544, 2026-05-25): Dispatch via /api/kv/list bridge
  // kalau useKvBridge() aktif. Bridge pakai cookie auth → RLS owner-only
  // for per-user rows + public access untuk platform rows. Fallback ke
  // anon-key path kalau bridge 401 (no session) atau error → anon-key
  // dapat platform rows saja (kv_anon_all masih aktif sampai B6a-4 cutover,
  // setelahnya cuma platform via kv_anon_platform_read).
  async function fetchAllRows(opts) {
    const since = opts && opts.since ? opts.since : null;
    // Bridge attempt
    if (useKvBridge()) {
      const res = await fetchAllRowsViaBridge(since, false);
      if (res.ok) return res.rows;
      // 401 (anon) atau error → fallback anon
      if (res.status !== 401) {
        console.warn("[cloud] bridge list failed (status " + res.status + ") — fallback to anon. Reason:", res.reason);
      }
    }
    return fetchAllRowsViaAnon(since);
  }
  async function fetchAllRowsViaAnon(since) {
    const sb = client();
    if (!sb) return [];
    let q = sb.from("kv").select("key,value,updated_at").like("key", `${PREFIX}%`);
    if (since) q = q.gt("updated_at", since);
    const { data, error } = await q;
    if (error) {
      console.warn("[cloud] fetch failed:", error.message);
      return [];
    }
    return data || [];
  }
  async function fetchAllRowsViaBridge(since, keysOnly) {
    try {
      const params = new URLSearchParams();
      if (since) params.set("since", since);
      if (keysOnly) params.set("keysonly", "1");
      const resp = await fetch("/api/kv/list" + (params.toString() ? "?" + params : ""), {
        method: "GET",
        credentials: "same-origin",
      });
      let data = null;
      try { data = await resp.json(); } catch (_) {}
      if (resp.ok && data && data.ok) {
        return { ok: true, rows: data.rows || [], count: data.count || 0 };
      }
      return { ok: false, status: resp.status, reason: (data && data.error) || "http_" + resp.status };
    } catch (err) {
      return { ok: false, status: 0, reason: String(err) };
    }
  }

  // EGRESS OPT v2 (2026-05-22): fetch key list ONLY (tanpa value). Payload
  // ~30 byte/key vs KB-an per row kalau ikut value. Dipakai boot delta sync
  // untuk tau key apa yang ada di cloud tanpa download semua value.
  //
  // Phase B6a-4 prep (v544): Dispatch via bridge kalau useKvBridge() aktif.
  async function fetchAllKeys() {
    if (useKvBridge()) {
      const res = await fetchAllRowsViaBridge(null, true);
      if (res.ok) return (res.rows || []).map(r => r.key);
      if (res.status !== 401) {
        console.warn("[cloud] bridge keys list failed (status " + res.status + ") — fallback to anon.");
      }
    }
    return fetchAllKeysViaAnon();
  }
  async function fetchAllKeysViaAnon() {
    const sb = client();
    if (!sb) return [];
    const { data, error } = await sb
      .from("kv")
      .select("key")
      .like("key", `${PREFIX}%`);
    if (error) {
      console.warn("[cloud] fetch keys failed:", error.message);
      return [];
    }
    return (data || []).map((r) => r.key);
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
      if (isPrefixExcluded(row.key)) continue; // B5: kategori yg punya tabel khusus
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
    // EGRESS OPT v2 (2026-05-22): boot sync sebelumnya SELALU full-fetch semua
    // value tiap page load → egress drain utama (quota 5GB jebol berulang).
    // Sekarang: kalau device ini PERNAH sync (ada lastSync timestamp), boot
    // cuma tarik DELTA value (updated_at > lastSync, kecil) + key-list
    // (select key only, ~30 byte/key). Hanya first-ever visit yang full fetch.
    // Hasil: ~90%+ egress reduction untuk repeat visitors.
    const lastSync = getLastSync();
    let cloudRows;
    let cloudKeys;
    if (lastSync) {
      cloudRows = await fetchAllRows({ since: lastSync });
      cloudKeys = new Set(await fetchAllKeys());
    } else {
      cloudRows = await fetchAllRows();
      cloudKeys = new Set(cloudRows.map((r) => r.key));
    }
    applyToLocal(cloudRows);
    updateLastSyncFromRows(cloudRows);
    for (const [k, raw] of localBefore.entries()) {
      if (cloudKeys.has(k)) continue;
      pushToCloud(k, raw);
    }
  }

  // === video blob: R2 (primary) + Supabase Storage (fallback) ===========
  //
  // v547 (2026-05-25): Cloudflare R2 jadi primary upload target (egress $0).
  // Supabase Storage tetap ada untuk fallback + existing videos. Strategi:
  //   - New uploads: try R2 → fallback Supabase kalau R2 error/disabled
  //   - Existing videos: tetap stream dari Supabase URL yg tersimpan di
  //     v.videoUrl. getVideoUrl() pakai Supabase API (kalau v.videoUrl
  //     hilang, fallback ke Supabase lookup by id).
  //   - Delete: dispatch by URL prefix (R2 atau Supabase) supaya tidak salah
  //     hapus.
  //
  // Kill switch: window.PLAYLY_USE_R2 (default true). Set false untuk
  // emergency rollback ke Supabase-only (mis. R2 endpoint down).

  function useR2() {
    if (typeof window === "undefined") return false;
    if (window.PLAYLY_USE_R2 === false) return false;
    return true; // default ON setelah v547
  }

  function blobPath(id, mime) {
    const ext = !mime ? "mp4"
      : mime.includes("webm") ? "webm"
      : mime.includes("quicktime") ? "mov"
      : "mp4";
    return `${id}.${ext}`;
  }

  // Upload video blob — try R2 first, fallback to Supabase Storage.
  // Return { ok, url, error, via: "r2"|"supabase" }.
  async function uploadVideoBlob(id, blob) {
    if (!blob) return { ok: false, error: "no_blob" };
    if (useR2()) {
      const r2Res = await uploadViaR2(id, blob);
      if (r2Res.ok) return r2Res;
      // Soft errors (auth/network) → fallback ke Supabase. Hard errors
      // (file_too_large) → bubble up langsung, jangan retry ke Supabase
      // karena Supabase limit lebih kecil.
      if (r2Res.error === "file_too_large") return r2Res;
      console.warn("[cloud] R2 upload failed, fallback to Supabase. Reason:", r2Res.error || r2Res.reason);
    }
    return uploadViaSupabase(id, blob);
  }

  // R2 path: POST /api/r2/sign-upload → PUT to presigned URL.
  // Bypass Vercel 4.5MB body limit karena file PUT langsung ke R2.
  async function uploadViaR2(id, blob) {
    try {
      const signResp = await fetch("/api/r2/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id: String(id),
          contentType: blob.type || "video/mp4",
          sizeBytes: blob.size,
        }),
      });
      let signData = null;
      try { signData = await signResp.json(); } catch (_) {}
      if (!signResp.ok || !signData || !signData.ok) {
        const reason = (signData && signData.error) || ("http_" + signResp.status);
        // file_too_large dari /api/r2/sign-upload → return spesifik supaya
        // caller (UI) bisa kasih pesan jelas.
        if (signData && signData.error === "file_too_large") {
          const maxMB = ((signData.maxBytes || 0) / 1024 / 1024).toFixed(0);
          return {
            ok: false,
            error: "file_too_large",
            message: `File ${(blob.size / 1024 / 1024).toFixed(1)} MB melebihi batas ${maxMB} MB untuk R2.`,
          };
        }
        return { ok: false, error: "r2_presign_failed", reason: reason };
      }
      // PUT file langsung ke R2 presigned URL.
      const putResp = await fetch(signData.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": blob.type || "video/mp4",
        },
        body: blob,
      });
      if (!putResp.ok) {
        return {
          ok: false,
          error: "r2_put_failed",
          reason: "http_" + putResp.status,
        };
      }
      return {
        ok: true,
        url: signData.publicUrl,
        via: "r2",
        key: signData.key,
      };
    } catch (err) {
      return { ok: false, error: "r2_exception", reason: String(err) };
    }
  }

  // Supabase path (legacy / fallback) — original implementation.
  async function uploadViaSupabase(id, blob) {
    const sb = client();
    if (!sb) return { ok: false, error: "cloud_disabled" };
    const sizeMB = blob.size / 1024 / 1024;
    try {
      const path = blobPath(id, blob.type);
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
        upsert: true,
        contentType: blob.type || "video/mp4",
        // EGRESS OPT 2026-05-21: cacheControl 7 hari supaya browser cache
        // video setelah first play → repeat plays serve dari memory/disk
        // cache, NOL egress. Storage public URL otomatis include
        // Cache-Control header sesuai value ini.
        cacheControl: "604800",  // 7 days in seconds
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
      return { ok: true, url: data?.publicUrl || null, via: "supabase" };
    } catch (e) {
      console.warn("[cloud] upload exception:", e);
      return { ok: false, error: "exception", message: e?.message || "Upload gagal" };
    }
  }

  // EGRESS OPT 2026-05-21: cache videoId → filename mapping di localStorage
  // supaya repeat call skip Storage list API. Tanpa cache, tiap getVideoUrl
  // panggil .list() → Storage API egress. Cache invalid kalau file di-delete
  // (caller handle dgn fallback ke null return).
  const FILENAME_CACHE_KEY = "playly-cloud-filename-cache";
  function _loadFilenameCache() {
    try { return JSON.parse(window.localStorage.getItem(FILENAME_CACHE_KEY) || "{}"); }
    catch { return {}; }
  }
  function _saveFilenameCache(map) {
    try { origSet.call(window.localStorage, FILENAME_CACHE_KEY, JSON.stringify(map)); } catch {}
  }
  async function findVideoFilename(id) {
    const sb = client();
    if (!sb) return null;
    // Cache hit → skip Storage API call
    const cache = _loadFilenameCache();
    if (cache[id]) return cache[id];
    try {
      const { data } = await sb.storage.from(BUCKET).list("", {
        search: `${id}.`,
      });
      const f = (data || []).find((x) => x.name.startsWith(`${id}.`));
      const filename = f?.name || null;
      if (filename) {
        cache[id] = filename;
        _saveFilenameCache(cache);
      }
      return filename;
    } catch { return null; }
  }

  // CR-5 fix (2026-05-21): SECURITY/COST — delete video blob dari cloud.
  // Sebelumnya deleteAdminVideo hanya hapus localStorage + IDB blob, file
  // di-storage dibiarkan → bucket grows forever, egress drain.
  //
  // v547 (2026-05-25): Dispatch by URL prefix supaya R2 dan Supabase masing-
  // masing di-delete proper. videoUrl param optional — kalau dikasih, sistem
  // tau lokasi pasti; kalau null, coba R2 dulu (best effort) + Supabase.
  async function deleteVideoBlob(id, videoUrl) {
    const url = String(videoUrl || "");
    const r2Prefix = (typeof window !== "undefined" && window.PLAYLY_R2_PUBLIC_URL)
      ? window.PLAYLY_R2_PUBLIC_URL : "";
    // URL-based dispatch: pasti tahu lokasi → delete spesifik.
    if (url && r2Prefix && url.startsWith(r2Prefix)) {
      return deleteViaR2(id, url);
    }
    if (url && /\.supabase\.co\//.test(url)) {
      return deleteViaSupabase(id);
    }
    // No URL hint — fallback strategy: kalau R2 enabled, coba R2 + Supabase
    // parallel (delete idempotent, no harm kalau salah satu 404). Egress
    // negligible untuk delete request.
    if (useR2()) {
      const [r2Res, sbRes] = await Promise.all([
        deleteViaR2(id, null).catch(err => ({ ok: false, error: String(err) })),
        deleteViaSupabase(id).catch(err => ({ ok: false, error: String(err) })),
      ]);
      // Sukses kalau salah satu OK
      if (r2Res.ok || sbRes.ok) return { ok: true, r2: r2Res, supabase: sbRes };
      return { ok: false, error: "both_failed", r2: r2Res, supabase: sbRes };
    }
    return deleteViaSupabase(id);
  }

  async function deleteViaR2(id, knownUrl) {
    try {
      // Server derive key dari id+contentType, atau pakai explicit key kalau
      // bisa di-extract dari URL. Pure id-based aman karena key sanitized
      // server-side.
      const payload = { id: String(id) };
      if (knownUrl) {
        // Try to extract key dari public URL: <publicUrl>/<key>
        try {
          const u = new URL(knownUrl);
          const path = u.pathname.replace(/^\/+/, "");
          if (path) payload.key = path;
        } catch (_) {}
      }
      const resp = await fetch("/api/r2/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      let data = null;
      try { data = await resp.json(); } catch (_) {}
      if (resp.ok && data && data.ok) {
        return { ok: true, via: "r2" };
      }
      return {
        ok: false,
        error: (data && data.error) || ("http_" + resp.status),
        via: "r2",
      };
    } catch (err) {
      return { ok: false, error: String(err), via: "r2" };
    }
  }

  async function deleteViaSupabase(id) {
    const sb = client();
    if (!sb) return { ok: false, error: "cloud_disabled", via: "supabase" };
    try {
      const filename = await findVideoFilename(id);
      if (!filename) return { ok: true, skipped: "not_found", via: "supabase" };
      const { error } = await sb.storage.from(BUCKET).remove([filename]);
      if (error) {
        console.warn("[cloud] delete blob failed:", error.message);
        return { ok: false, error: error.message, via: "supabase" };
      }
      // Invalidate filename cache so future getVideoUrl returns null
      const cache = _loadFilenameCache();
      delete cache[id];
      _saveFilenameCache(cache);
      return { ok: true, via: "supabase" };
    } catch (err) {
      console.warn("[cloud] delete blob exception:", err);
      return { ok: false, error: err?.message || "exception", via: "supabase" };
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
    s.src = "script.js?v=20260601-edit-video-v687";
    s.dataset.playlyMain = "1";
    document.body.appendChild(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
