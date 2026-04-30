/* =========================================================
   PLAYLY. — Dashboard Logic (auth + multi-view)
   ========================================================= */

// ----------------------- LEGACY SHARE LINK REDIRECT -----------------------
// Link share lama format `#video=<id>` (sebelum public watch page) → redirect
// ke `/watch?v=<id>` supaya bisa diputar tanpa login.
(function redirectLegacyVideoHash() {
  const m = /^#video=(\d+)/.exec(window.location.hash || "");
  if (!m) return;
  const id = m[1];
  // Pakai replace supaya entry lama gak nyangkut di history
  window.location.replace(`${window.location.origin}/watch?v=${id}`);
})();

// ----------------------- HELPERS -----------------------
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

// ---- Device-local accounts list (TIDAK sync ke cloud) ----
// Hanya akun yang pernah login di device ini muncul di "Pindah Akun".
// Akun user lain di cloud tidak boleh kelihatan (privasi).
const DEVICE_ACCOUNTS_KEY = "playly-device-accounts";
function getDeviceAccountEmails() {
  try {
    const raw = localStorage.getItem(DEVICE_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function addDeviceAccount(email) {
  if (!email) return;
  const lower = String(email).toLowerCase();
  const list = getDeviceAccountEmails();
  if (list.includes(lower)) return;
  list.push(lower);
  // Pakai origSet supaya tidak trigger cloud sync (key sudah di NO_SYNC_KEYS sih, tapi extra safe)
  localStorage.setItem(DEVICE_ACCOUNTS_KEY, JSON.stringify(list));
}
function removeDeviceAccount(email) {
  if (!email) return;
  const lower = String(email).toLowerCase();
  const list = getDeviceAccountEmails().filter(e => e !== lower);
  localStorage.setItem(DEVICE_ACCOUNTS_KEY, JSON.stringify(list));
}
// Catatan: tracking device-account dilakukan SECARA EKSPLISIT di flow login &
// signup (lihat panggilan addDeviceAccount() di handler form login dan signup).
// Tidak pakai interceptor setItem supaya proses auto-boot, role-recovery, atau
// profile-update tidak ikut menambah email ke daftar perangkat.

function toast(msg, type = "") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = msg;
  $("#toastHost").append(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateX(20px)"; }, 2800);
  setTimeout(() => t.remove(), 3200);
}
window.toast = toast;

// Waktu relatif untuk chat (pesan + thread). Hanya menerima timestamp angka.
// Data lama yang tidak punya `ts` (mis. "Mantap 👍" yang sempat tersimpan dengan
// time: "baru") sengaja kembalikan "" supaya tidak terlihat seperti pesan baru.
function chatRelTime(ts) {
  if (!ts || typeof ts !== "number") return "";
  const diff = Date.now() - ts;
  if (diff < 0) return "baru";
  if (diff < 60_000) return "baru";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + " mnt";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + " jam";
  if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + " hari";
  const d = new Date(ts);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

// ----------------------- PLATFORM CONTENT (dinamis dari semua user) -----------------------
// Tidak ada data hardcoded — Discover akan kosong sampai user upload.
// Konten platform = agregasi dari semua user yang sudah upload video.

function getPlatformVideos() {
  // Agregasi semua videos dari semua user yang punya state di localStorage.
  // Skip state milik akun demo/mock supaya video mereka tidak muncul di feed.
  const videos = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("playly-state-")) continue;
    const uname = key.slice("playly-state-".length).toLowerCase();
    if (KNOWN_DEMO_USERNAMES.includes(uname)) continue;
    try {
      const s = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(s.myVideos)) videos.push(...s.myVideos);
    } catch {}
  }
  // Sort by views desc, fallback by id (newest)
  videos.sort((a, b) => (b.viewsNum || 0) - (a.viewsNum || 0) || b.id - a.id);
  return videos;
}

function getPlatformCreators({ activeOnly = false } = {}) {
  // Daftar semua user terdaftar — kecuali user yang sedang login
  const creators = [];
  const seen = new Set();

  // Defensif: kumpulkan semua identifier yang termasuk "diri sendiri"
  const selfIds = new Set();
  if (user) {
    if (user.username) selfIds.add(String(user.username).toLowerCase());
    if (user.email) selfIds.add(String(user.email).toLowerCase());
    if (user.name) selfIds.add(String(user.name).toLowerCase().replace(/\s+/g, ""));
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("playly-account-")) continue;
    try {
      const a = JSON.parse(localStorage.getItem(key));
      if (!a.username) continue;
      const uname = String(a.username).toLowerCase();
      const aemail = String(a.email || "").toLowerCase();
      // Skip diri sendiri (cek username, email, atau key)
      if (selfIds.has(uname) || selfIds.has(aemail)) continue;
      if (seen.has(uname)) continue;
      seen.add(uname);

      // Hitung jumlah video dari user ini + cari upload terakhir untuk fresh-ring
      const stateRaw = localStorage.getItem(`playly-state-${a.username}`);
      let videoCount = 0;
      let latestUploadAt = 0;
      try {
        const s = JSON.parse(stateRaw);
        const myVids = Array.isArray(s?.myVideos) ? s.myVideos : [];
        videoCount = myVids.length;
        for (const v of myVids) {
          const t = Number(v?.uploadedAt || v?.createdAt || v?.ts || 0);
          if (t > latestUploadAt) latestUploadAt = t;
        }
      } catch {}

      // Kalau activeOnly, skip akun yang belum upload video
      if (activeOnly && videoCount === 0) continue;

      creators.push({
        name: a.username,
        displayName: a.name,
        subs: videoCount > 0 ? `${videoCount} video` : "Kreator baru",
        online: Math.random() > 0.4,
        init: (a.name || a.username).slice(0, 2).toUpperCase(),
        videoCount,
        avatar: a.avatar || null,
        latestUploadAt
      });
    } catch {}
  }
  return creators;
}

// ----------------------- ONE-TIME RESET -----------------------
// Hapus semua data user/admin yang pernah login. Jalan sekali saja per browser.
(function purgePlaylyDataOnce() {
  const FLAG = "__playly_reset_v4";
  if (localStorage.getItem(FLAG)) return;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && (k.startsWith("playly-") || k.startsWith("playly."))) {
      localStorage.removeItem(k);
    }
  }
  localStorage.setItem(FLAG, "1");
})();

// ----------------------- ADMIN LOCK -----------------------
// Hanya email & username ini yang boleh jadi admin. User lain tidak boleh memakainya.
const OFFICIAL_ADMIN_EMAIL = "admin.playly@gmail.com";
const OFFICIAL_ADMIN_USERNAME = "admin";
function isOfficialAdminEmail(email) {
  return (email || "").trim().toLowerCase() === OFFICIAL_ADMIN_EMAIL;
}
function isReservedUsername(username) {
  return (username || "").trim().toLowerCase() === OFFICIAL_ADMIN_USERNAME;
}

// Allowlist admin tambahan — dikelola super admin via Settings → Buat Admin.
// Disimpan di localStorage (auto-mirror ke Supabase via cloud-sync) supaya
// admin tambahan ikut sinkron lintas device.
const ADMIN_ALLOWLIST_KEY = "playly-admin-allowlist";
function getExtraAdminEmails() {
  try {
    const arr = JSON.parse(localStorage.getItem(ADMIN_ALLOWLIST_KEY) || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.map(e => String(e || "").trim().toLowerCase()).filter(Boolean);
  } catch { return []; }
}
function setExtraAdminEmails(arr) {
  const dedup = [...new Set((arr || []).map(e => String(e || "").trim().toLowerCase()).filter(Boolean))]
    .filter(e => e !== OFFICIAL_ADMIN_EMAIL);
  localStorage.setItem(ADMIN_ALLOWLIST_KEY, JSON.stringify(dedup));
}
function isAllowedAdminEmail(email) {
  const e = (email || "").trim().toLowerCase();
  if (!e) return false;
  if (e === OFFICIAL_ADMIN_EMAIL) return true;
  return getExtraAdminEmails().includes(e);
}
// Super admin = OFFICIAL_ADMIN_EMAIL. Hanya super admin yang boleh kelola
// admin tambahan (buat/cabut). Admin tambahan punya akses penuh sisanya.
function isSuperAdmin(u) {
  return !!u && isOfficialAdminEmail(u.email);
}

// Ambil data akun admin (kalau sudah signup)
function getAdminAccount() {
  return JSON.parse(localStorage.getItem(`playly-account-${OFFICIAL_ADMIN_EMAIL}`) || "null");
}

// Sweep semua akun di localStorage & paksa role sesuai admin lock.
// Ini fix akun lama yang dibuat sebelum admin lock diaktifkan.
function enforceAdminLock() {
  let fixed = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("playly-account-")) continue;
    try {
      const acc = JSON.parse(localStorage.getItem(key));
      if (!acc?.email) continue;
      const correctRole = isAllowedAdminEmail(acc.email) ? "admin" : "user";
      if (acc.role !== correctRole) {
        acc.role = correctRole;
        localStorage.setItem(key, JSON.stringify(acc));
        fixed++;
      }
    } catch {}
  }
  // Sync current user kalau ada
  const cu = JSON.parse(localStorage.getItem("playly-user") || "null");
  if (cu?.email) {
    const correctRole = isAllowedAdminEmail(cu.email) ? "admin" : "user";
    if (cu.role !== correctRole) {
      cu.role = correctRole;
      localStorage.setItem("playly-user", JSON.stringify(cu));
      fixed++;
    }
  }
  return fixed;
}

// Hash password h2 yang precomputed (SHA-256 + salt fixed). Wajib didefinisikan
// SEBELUM seedOfficialAdmin() dipanggil di bawah — kalau di-deklarasikan
// belakangan, JS lempar ReferenceError "Cannot access before initialization"
// (temporal dead zone) → seluruh script.js mati & login form tidak ter-wire.
// Hex dihitung dari `SHA-256("playly-pwd-salt-v1" + plaintext)`. Hash baru tiap
// akun (h3, PBKDF2 + salt random) di-generate runtime di hashPassword().
const ADMIN_PASSWORD_HASH = "h2:dfdfe2b61ee03d58533ec9bde92cf702eed7429afaaf71cbe65f306763850c96";
const DEFAULT_RESET_PASSWORD_HASH = "h2:c319bf31c9a66a26eaa315c7e0ab2167208179442f21d40591675b0f30b316e1";

// Seed akun admin resmi. Dijalankan sekali saat script load.
// Akun ini wajib ada di dashboard supaya admin bisa langsung login.
function seedOfficialAdmin() {
  const key = `playly-account-${OFFICIAL_ADMIN_EMAIL}`;
  const existing = JSON.parse(localStorage.getItem(key) || "null");

  // Identitas (email, username, role) selalu dipaksa — tahan manipulasi localStorage
  // yang coba jadiin user lain admin atau coba ganti email/role admin.
  const identity = {
    name: existing?.name || "admin.playly",
    username: OFFICIAL_ADMIN_USERNAME,
    email: OFFICIAL_ADMIN_EMAIL,
    role: "admin",
    joinedAt: existing?.joinedAt || new Date().toISOString()
  };

  // Password handling:
  // - Belum pernah ada akun → seed dengan hash default (admin pakai password awal).
  // - Sudah ada hash di existing → JANGAN overwrite (admin sudah ganti password
  //   custom; kalau di-overwrite tiap reload, password change form jadi sia-sia).
  // - Plaintext lama "Adminplayly123" → migrasi ke hash supaya cloud-sync ke
  //   Supabase tidak nyimpen plaintext.
  // - Plaintext custom (admin sempat ganti password sebelum hashing aktif) →
  //   biarkan, akan di-migrate lazily saat login berhasil.
  let password;
  if (!existing || !existing.password) {
    password = ADMIN_PASSWORD_HASH;
  } else if (existing.password === "Adminplayly123") {
    password = ADMIN_PASSWORD_HASH;
  } else {
    password = existing.password;
  }

  const merged = { ...(existing || {}), ...identity, password };
  localStorage.setItem(key, JSON.stringify(merged));
}

// Run sekali saat script load — sebelum apapun
seedOfficialAdmin();
enforceAdminLock();

// ----------------------- PURGE DEMO/MOCK USERS (selalu jalan) -----------------------
// Dashboard wajib 100% real-time — hanya akun yang benar-benar sign up yang boleh tampil.
// Versi lama pernah seed akun demo (`*.demo@playly.local`, `demo: true`) + state mereka.
// Karena cloud-sync re-pull dari Supabase tiap reload, purge HARUS jalan tiap load
// (jangan pakai one-time flag) sampai cloud benar-benar bersih.
const DEMO_EMAIL_DOMAIN = "@playly.local";
const KNOWN_DEMO_USERNAMES = ["citra_d", "rinaldi", "mahasari", "budikece", "andiwijaya", "nadiap"];

function isDemoAccount(acc) {
  if (!acc) return false;
  if (acc.demo === true) return true;
  if (typeof acc.email === "string" && acc.email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN)) return true;
  if (typeof acc.username === "string" && KNOWN_DEMO_USERNAMES.includes(acc.username.toLowerCase())) return true;
  return false;
}

function purgeDemoData() {
  const accountKeys = [];
  const stateKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith("playly-account-")) {
      try {
        const acc = JSON.parse(localStorage.getItem(key));
        if (isDemoAccount(acc)) accountKeys.push({ key, username: acc?.username });
      } catch {}
    } else if (key.startsWith("playly-state-")) {
      const uname = key.slice("playly-state-".length).toLowerCase();
      if (KNOWN_DEMO_USERNAMES.includes(uname)) stateKeys.push(key);
    }
  }
  for (const { key, username } of accountKeys) {
    localStorage.removeItem(key); // cloud-sync hijack ikut hapus dari Supabase
    if (username) localStorage.removeItem(`playly-state-${username}`);
  }
  for (const key of stateKeys) localStorage.removeItem(key);
  // Jaga-jaga: hapus flag seeder versi lama supaya tidak ada yang nyangkut.
  localStorage.removeItem("playly-demo-users-seeded-v1");
  return accountKeys.length + stateKeys.length;
}
purgeDemoData();
// Jalankan lagi setelah cloud-sync apply data dari Supabase (re-pull bisa bawa balik
// kalau cloud-delete sebelumnya belum sampai). Loop akan berhenti sendiri begitu
// cloud bersih.
window.addEventListener("playly:cloud-applied", () => { purgeDemoData(); });

// ----------------------- USER STATE (per-user, persisted) -----------------------
let user = null;          // { name, username, email, joinedAt }
let state = null;         // user-specific state

function defaultState() {
  return {
    currentView: "home",
    prevView: null,
    currentVideo: null,
    filter: "all",
    liked: [],
    saved: [],
    followingCreators: [],
    followers: [],
    comments: {},
    chartRange: "weekly",
    chatOpen: null,
    msgFilter: "all",
    actFilter: "all",
    videoSort: "newest",
    history: [],
    myVideos: [],            // user's own uploaded videos
    deletedVideos: [],       // trash bin — video yang dihapus, bisa dipulihkan
    uploadingVideos: [],     // antrian/progress upload yang sedang berjalan
    downloaded: [],          // video yang sudah di-unduh (entry: {videoId, ts})
    activities: [],
    messages: [],
    notifications: []     // kosong — terisi otomatis saat ada interaksi real
  };
}

function loadUser() {
  const raw = localStorage.getItem("playly-user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function loadState(username) {
  const raw = localStorage.getItem(`playly-state-${username}`);
  if (!raw) return defaultState();
  try {
    const s = JSON.parse(raw);
    // Convert arrays back from JSON (Set was stored as array)
    return { ...defaultState(), ...s };
  } catch { return defaultState(); }
}

function saveState() {
  if (!user) return;
  localStorage.setItem(`playly-state-${user.username}`, JSON.stringify(state));
}

// Combined videos list (user uploads + platform content from all users)
function allVideos() {
  const own = state?.myVideos || [];
  const platform = getPlatformVideos().filter(v => !own.some(o => o.id === v.id));
  return [...own, ...platform];
}

function findVideo(id) {
  return allVideos().find(v => v.id === id);
}

// Update stat real-time pada video di state pemilik (creator).
// Karena cloud-sync.js mirror semua key `playly-*` ke Supabase, perubahan
// langsung kelihatan oleh semua user yang lihat video ini.
function updateVideoStat(videoId, field, delta) {
  // Cek state user lain dulu (creator yg upload video)
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("playly-state-")) continue;
    let s;
    try { s = JSON.parse(localStorage.getItem(k)); } catch { continue; }
    if (!Array.isArray(s?.myVideos)) continue;
    const idx = s.myVideos.findIndex(v => v.id === videoId);
    if (idx < 0) continue;
    const prev = Number(s.myVideos[idx][field] || 0);
    s.myVideos[idx][field] = Math.max(0, prev + delta);
    // Sync display string untuk views
    if (field === "viewsNum") {
      s.myVideos[idx].views = fmtNum(s.myVideos[idx][field]);
    }
    localStorage.setItem(k, JSON.stringify(s));
    // Kalau ini state user yg sedang login, sync in-memory state juga
    if (user?.username && k === `playly-state-${user.username}`) {
      state.myVideos = s.myVideos;
    }
    return true;
  }
  return false;
}

// Shared comments — semua user lihat list yang sama untuk satu video.
// Disimpan di key `playly-video-comments-{id}` supaya cloud-sync mirror.
function getVideoComments(videoId) {
  try {
    return JSON.parse(localStorage.getItem(`playly-video-comments-${videoId}`)) || [];
  } catch { return []; }
}
function setVideoComments(videoId, list) {
  localStorage.setItem(`playly-video-comments-${videoId}`, JSON.stringify(list));
}

// Targeted patch — update counter (views/likes/comments/share) di FYP card
// SECARA LANGSUNG via DOM, tanpa re-render full card. Penting biar timestamp
// "X hari lalu" di header tidak ikut di-recompute (yang bikin user kira waktu
// upload berubah saat views naik). Dipakai oleh openPlayer + cloud-applied.
function patchVideoCountersInDom(videoId) {
  const v = findVideo(videoId);
  if (!v) return;
  const liked = state?.liked?.includes(videoId);
  const commentCount = state?.comments?.[videoId]?.length
    || (typeof getVideoComments === "function" ? getVideoComments(videoId).length : 0);
  document.querySelectorAll(`[data-fyp-views-count="${videoId}"]`).forEach(el => {
    el.textContent = fmtNum(v.viewsNum || 0);
  });
  document.querySelectorAll(`[data-fyp-like-count="${videoId}"]`).forEach(el => {
    el.textContent = fmtNum((v.likes || 0) + (liked ? 1 : 0));
  });
  document.querySelectorAll(`[data-fyp-comment-count="${videoId}"]`).forEach(el => {
    el.textContent = fmtNum(commentCount);
  });
}

// Saat cloud-sync pull data dari Supabase (perubahan dari user lain atau
// sync awal yang baru selesai), refresh tampilan supaya konten dari kreator
// lain langsung muncul tanpa user perlu reload halaman.
window.addEventListener("playly:cloud-applied", e => {
  const keys = e.detail?.keys || [];
  const hasUserOrVideoChange = keys.some(k =>
    k.startsWith("playly-state-") ||
    k.startsWith("playly-account-") ||
    k.startsWith("playly-video-comments-")
  );
  if (!hasUserOrVideoChange) return;

  // Targeted patch counter (views/likes/comments) — biar timestamp di header
  // FYP card tidak shift saat user lain nambah view/like.
  document.querySelectorAll("[data-fyp-views-count]").forEach(el => {
    const id = +el.dataset.fypViewsCount;
    if (id) patchVideoCountersInDom(id);
  });
  if (typeof renderUserStats === "function") renderUserStats();

  // Re-render home/discover/feed views supaya video & kreator dari user lain
  // muncul ketika cloud-sync apply data baru SETELAH dashboard udah ter-render.
  // Ini fix kasus user baru login → dashboard kosong → cloud-sync nyusul bawa
  // data → tampilan stuck kosong sampai user navigate manual.
  // Skip kalau view yang aktif memang lagi ditampilkan (kalau player/upload,
  // jangan ganggu interaksi user yang lagi jalan).
  const view = state?.currentView;
  if (view === "home") {
    if (typeof renderHomeTrending === "function") renderHomeTrending();
    if (typeof renderHomeActivity === "function") renderHomeActivity();
    if (typeof renderHomeStats === "function") renderHomeStats();
    if (typeof renderFeatured === "function") renderFeatured();
    if (typeof renderLiveMetrics === "function") renderLiveMetrics();
    if (typeof renderTrendingHome === "function") renderTrendingHome();
    if (typeof renderCreatorSpotlight === "function") renderCreatorSpotlight();
    if (typeof renderTopPerforming === "function") renderTopPerforming();
  } else if (view === "discover") {
    if (typeof renderFYP === "function") renderFYP();
  } else if (view === "videos") {
    if (typeof refreshAllVideoGrids === "function") refreshAllVideoGrids();
  } else if (view === "player" && state?.currentVideo) {
    // Player: refresh counter + comment list
    const v = findVideo(state.currentVideo);
    if (v) {
      const likeEl = document.getElementById("likeCount");
      if (likeEl) likeEl.textContent = (v.likes || 0).toLocaleString("id-ID");
      const viewEl = document.getElementById("playerViewCount");
      if (viewEl) viewEl.textContent = v.views || fmtNum(v.viewsNum || 0);
    }
    if (keys.some(k => k === `playly-video-comments-${state.currentVideo}`)) {
      renderComments(state.currentVideo);
    }
  }
});

// ----------------------- VIDEO BLOB STORE (IndexedDB) -----------------------
// File video aslinya disimpan di IndexedDB supaya tetap bisa diputar setelah reload.
// localStorage cuma simpan metadata + thumbnail (data URL kecil).
const VIDEO_DB_NAME = "playly-videos";
const VIDEO_STORE = "videos";

function openVideoDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VIDEO_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(VIDEO_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveVideoBlob(id, blob) {
  try {
    const db = await openVideoDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(VIDEO_STORE, "readwrite");
      tx.objectStore(VIDEO_STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Gagal simpan video ke IndexedDB:", err);
  }
}

async function getVideoBlob(id) {
  try {
    const db = await openVideoDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(VIDEO_STORE, "readonly");
      const req = tx.objectStore(VIDEO_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

// Hitung total ukuran semua video blob di IndexedDB
async function computeIDBVideosBytes() {
  try {
    const db = await openVideoDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(VIDEO_STORE, "readonly");
      const store = tx.objectStore(VIDEO_STORE);
      let total = 0;
      const req = store.openCursor();
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          const v = cursor.value;
          if (v && typeof v.size === "number") total += v.size;
          cursor.continue();
        } else resolve(total);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

// Resolve URL aktual untuk diputar — coba blob URL yang sudah ada dulu, lalu IDB, lalu sample.
async function resolveVideoSource(v) {
  // 1. URL eksternal (http/https) → langsung pakai
  if (v.videoUrl && /^https?:/.test(v.videoUrl)) return v.videoUrl;

  // 2. Blob URL existing — cek validitas dengan HEAD fetch
  if (v.videoUrl && v.videoUrl.startsWith("blob:")) {
    try {
      const r = await fetch(v.videoUrl, { method: "HEAD" });
      if (r.ok) return v.videoUrl;
    } catch { /* invalid, jatuh ke IDB */ }
  }

  // 3. Cari file aslinya di IDB & bikin blob URL baru
  if (v.id) {
    const blob = await getVideoBlob(v.id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      v.videoUrl = url;
      return url;
    }
    // 4. Fallback: cek Supabase Storage (cross-browser sync)
    if (window.cloudSync?.getVideoUrl) {
      const cloudUrl = await window.cloudSync.getVideoUrl(v.id);
      if (cloudUrl) {
        v.videoUrl = cloudUrl;
        return cloudUrl;
      }
    }
  }
  return null;
}

// ----------------------- THEME (global, before auth) -----------------------
const savedTheme = localStorage.getItem("playly-theme");
if (savedTheme) {
  document.body.dataset.theme = savedTheme;
  $$("[data-theme-set]").forEach(x => x?.classList.toggle("active", x.dataset.themeSet === savedTheme));
}

// ============================================================
// =================== AUTH FLOW ==============================
// ============================================================

const VIEW_TITLES = {
  home: "Home", videos: "My Library", upload: "Upload", history: "History",
  stats: "Stats", messages: "Messages", activity: "Activity", discover: "Discover", people: "Search User", profile: "Edit Profil", settings: "Settings",
  player: "My Library", "user-profile": "Profil Kreator",
  "admin-dashboard": "Admin Dashboard", "admin-users": "User Management",
  "admin-videos": "Content Control",
  "admin-comms": "Conversation",
  "admin-comms-broadcasts": "Riwayat Broadcast",
  "admin-audit": "Audit Log",
  "admin-inbox": "Inbox",
  "admin-tickets": "Support Tickets",
  "admin-reports": "Bug Reports", "admin-analytics": "Analytics & Monitoring",
  "admin-revenue": "Revenue", "admin-ads": "Ad Manager"
};

// Parent chain untuk breadcrumb sub-page (cuma view yang punya parent eksplisit
// yang masuk sini — selain itu breadcrumb cuma 2 level: home → current).
const VIEW_PARENTS = {
  "admin-comms-broadcasts": "admin-comms"
};

// ----------------------- AUTH MODE (user vs admin login) -----------------------
// Mode ditentukan dari URL: "/admin" → admin, selain itu → user.
// Local dev: bisa pakai query string `?admin=1` karena file:// tidak support routing.
let pickedRole = "user";
// Detect admin mode di awal load — function declaration di-hoist jadi aman dipanggil di sini.
applyAuthScreenMode();

function applyRoleToUI() {
  // Force enforce role berdasarkan allowlist (official + admin tambahan) — final guard
  if (user) user.role = isAllowedAdminEmail(user.email) ? "admin" : "user";
  const role = user?.role || "user";
  document.body.dataset.role = role;
  // Re-run admin logo swap setelah role di-set (idempotent — aman kalau sudah di-call sebelumnya)
  if (typeof ensureAdminGradients === "function") ensureAdminGradients();
  // Tier admin: super (admin.playly) vs regular (admin tambahan).
  // CSS pakai data-super-admin untuk show/hide elemen super-admin-only.
  document.body.dataset.superAdmin = isSuperAdmin(user) ? "true" : "false";
  const status = $$(".sidebar .profile-card small");
  status.forEach(el => {
    el.textContent = role === "admin"
      ? (isSuperAdmin(user) ? `Online • Super Administrator` : `Online • Administrator`)
      : `Online • @${user.username}`;
  });

  // Profile dropdown role badge
  const badge = document.querySelector("[data-role-badge]");
  if (badge) {
    badge.textContent = role === "admin"
      ? (isSuperAdmin(user) ? "👑 SUPER ADMIN" : "🛡️ ADMIN")
      : "USER";
    badge.dataset.role = role;
  }

  // Admin hero card tier label (SUPER ADMIN vs ADMIN)
  const heroTier = document.getElementById("adminHeroTier");
  if (heroTier && role === "admin") {
    heroTier.textContent = isSuperAdmin(user) ? "SUPER ADMIN" : "ADMIN";
  }

  // Admin-aware search placeholder + page title
  const search = $("#globalSearch");
  if (search) {
    search.placeholder = role === "admin"
      ? "Cari user, tiket, bug report, atau laporan..."
      : "Cari video, kreator, atau tag...";
  }
  document.title = role === "admin" ? "Playly. — Admin Panel" : "Playly. — Video Platform";

  // Notification icon tooltip
  const notifBtn = $("#openNotif");
  if (notifBtn) notifBtn.title = role === "admin" ? "Admin Notifications" : "Notifications";
}

// Inject admin-grad SVG defs + swap sidebar logo path ke modern P (admin only).
// Modern P: rounded bowl + stem + counter via fill-rule="evenodd". Gradient
// glacier→slate (top-left → bottom-right). Dark glow effect via CSS drop-shadow.
function ensureAdminGradients() {
  if (!document.getElementById("admin-grad-defs")) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<svg id="admin-grad-defs" width="0" height="0" style="position:absolute"><defs>
      <linearGradient id="admin-grad-sb" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F0EBD3"/>
        <stop offset="40%" stop-color="#DCD3A9"/>
        <stop offset="100%" stop-color="#ACBAC4"/>
      </linearGradient></defs></svg>`;
    document.body.appendChild(wrap.firstChild);
  }
  // Swap sidebar logo SVG dengan modern P shape (cuma untuk admin role).
  // Pakai data-attribute supaya idempotent kalau dipanggil ulang.
  if (document.body?.dataset?.role === "admin") {
    const sbSvg = document.querySelector("#brandHome svg");
    if (sbSvg && sbSvg.dataset.adminP !== "1") {
      sbSvg.setAttribute("viewBox", "0 0 100 100");
      sbSvg.innerHTML = `
        <path
          fill="url(#admin-grad-sb)"
          fill-rule="evenodd"
          d="M 30 6 L 60 6 C 80 6 92 22 92 38 C 92 58 76 70 56 70 L 42 70 L 42 92 C 42 97 38 98 32 98 C 26 98 22 97 22 92 L 22 14 C 22 10 26 6 30 6 Z M 42 22 L 56 22 C 66 22 72 30 72 38 C 72 46 66 54 56 54 L 42 54 Z"
        />`;
      sbSvg.dataset.adminP = "1";
    }
  }
}

function showAuth() {
  document.body.classList.add("auth-mode");
  $("#authScreen").classList.add("show");
  $("#authScreen").classList.remove("hidden");
  // Re-detect admin mode tiap kali auth screen muncul (initial load + setelah logout/switch)
  // — supaya tema admin (caramel/coffee) tetap aktif kalau URL `/?admin=1`.
  applyAuthScreenMode();
  // Field auth = data sensitif. Jangan biarkan autofill browser nge-isi
  // value saat URL dibuka. Reset dilakukan beberapa kali karena Chrome
  // sering menyelipkan autofill 50-300ms setelah DOM siap.
  resetAuthForms();
  setTimeout(resetAuthForms, 80);
  setTimeout(resetAuthForms, 250);
  setTimeout(resetAuthForms, 600);
}

function resetAuthForms() {
  ["#signinForm", "#signupForm", "#forgotPwForm"].forEach(sel => {
    const form = document.querySelector(sel);
    if (!form) return;
    try { form.reset(); } catch {}
    form.querySelectorAll("input").forEach(input => {
      if (input.type === "checkbox") {
        // "Ingat saya" → biarkan default (checked dari markup); terms (signup) → uncheck
        if (input.closest(".auth-check.terms")) input.checked = false;
      } else if (input.type !== "radio" && input.type !== "submit" && input.type !== "button") {
        input.value = "";
      }
    });
    // Clear inline error juga supaya form bersih total
    form.querySelectorAll(".has-error").forEach(el => el.classList.remove("has-error"));
    form.querySelectorAll(".field-error").forEach(el => el.remove());
  });
  // Banner lockout juga di-hide kalau email field kosong (cek ulang nanti
  // saat user mulai ngetik via probeSigninLockout).
  if (typeof hideLockBanner === "function") hideLockBanner();
  // Reset signup stepper kalau ada — semua step balik pending kecuali step 1.
  if (typeof updateSignupStepper === "function") updateSignupStepper();
}

// =================== SIGNUP STEPPER (visual progress 4 step) ===================
// Tiap kali user ngetik di field signup, evaluasi 4 step:
//   1. Profil   → Nama Lengkap (>=2 char)
//   2. Username → Username valid (regex pattern)
//   3. Akun     → Email valid + Password >=6 char
//   4. Selesai  → Terms checkbox checked
function updateSignupStepper() {
  const form = document.querySelector("#signupForm");
  const stepper = document.querySelector("#signupStepper");
  if (!form || !stepper) return;

  const name = (form.querySelector('[name="name"]')?.value || "").trim();
  const username = (form.querySelector('[name="username"]')?.value || "").trim();
  const email = (form.querySelector('[name="email"]')?.value || "").trim();
  const password = form.querySelector('[name="password"]')?.value || "";
  const terms = form.querySelector('.auth-check.terms input[type="checkbox"]')?.checked || false;

  const step1Done = name.length >= 2;
  const step2Done = step1Done && /^[a-z0-9_.]{3,20}$/.test(username);
  const step3Done = step2Done && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 6;
  const step4Done = step3Done && terms;

  // Determine first step yang BELUM done → itu yang active
  let active;
  if (!step1Done) active = 1;
  else if (!step2Done) active = 2;
  else if (!step3Done) active = 3;
  else if (!step4Done) active = 4;
  else active = 0; // semua done

  const setStatus = (n, status) => {
    const el = stepper.querySelector(`.step[data-step="${n}"]`);
    if (el) el.setAttribute("data-status", status);
  };
  setStatus(1, step1Done ? "done" : (active === 1 ? "active" : "pending"));
  setStatus(2, step2Done ? "done" : (active === 2 ? "active" : "pending"));
  setStatus(3, step3Done ? "done" : (active === 3 ? "active" : "pending"));
  setStatus(4, step4Done ? "done" : (active === 4 ? "active" : "pending"));

  const lines = stepper.querySelectorAll(".step-line");
  if (lines[0]) lines[0].setAttribute("data-status", step1Done ? "filled" : "pending");
  if (lines[1]) lines[1].setAttribute("data-status", step2Done ? "filled" : "pending");
  if (lines[2]) lines[2].setAttribute("data-status", step3Done ? "filled" : "pending");
}

// Bind sekali — listen `input` & `change` event di form signup.
(() => {
  const form = document.querySelector("#signupForm");
  if (!form) return;
  form.addEventListener("input", updateSignupStepper);
  form.addEventListener("change", updateSignupStepper);
  // Init di load (kalau ada nilai default / autofill)
  setTimeout(updateSignupStepper, 100);
})();

function applyAuthScreenMode() {
  const path = (location.pathname || "").toLowerCase();
  const search = new URLSearchParams(location.search);
  const isAdminMode = path === "/admin" || path.endsWith("/admin") || search.get("admin") === "1";
  pickedRole = isAdminMode ? "admin" : "user";

  const card = $("#authCard");
  if (card) card.dataset.mode = pickedRole;
  const banner = $("#adminModeBanner");
  if (banner) banner.hidden = !isAdminMode;

  if (isAdminMode) {
    document.body.dataset.role = "admin";
    document.title = "Playly. — Admin Login";
  } else {
    delete document.body.dataset.role;
    document.title = "Playly. — Video Platform";
  }
}

function hideAuth() {
  document.body.classList.remove("auth-mode");
  $("#authScreen").classList.remove("show");
  $("#authScreen").classList.add("hidden");
}

function bootDashboard() {
  // GUARD: Strict URL/role match. `/admin` HANYA untuk akun admin, `/` HANYA
  // untuk akun user. Kalau mismatch (mis. user buka `/admin` di tab baru
  // sementara session-nya masih aktif), kick ke login screen yang sesuai.
  // Defensive ganda dengan tryAutoBoot() — pastikan tidak ada path yang lolos.
  if (user) {
    const urlIsAdmin = pickedRole === "admin";
    const userIsAdmin = isAllowedAdminEmail(user.email);
    if (urlIsAdmin !== userIsAdmin) {
      try { localStorage.removeItem("playly-user"); } catch {}
      user = null;
      state = defaultState();
      showAuth();
      return;
    }
  }
  hideAuth();
  ensureAdminGradients();
  // Refresh all UI bound to user
  applyUserToUI();
  applyRoleToUI();
  initDashboard();
  refreshStorageUsage();

  // Safety net: trigger cloud resync sehabis login. Boot sync di awal page
  // load mungkin timeout (limit 8s) atau dilewat user yang langsung login
  // sebelum sync selesai. Re-pull di sini menjamin user — terutama yang baru
  // sign up — langsung lihat video & kreator dari user lain (bukan dashboard
  // kosong). Listener `playly:cloud-applied` akan re-render home views otomatis
  // begitu data sampai.
  if (window.cloudSync?.softResync) {
    window.cloudSync.softResync().catch(() => { /* gagal cloud, lanjut pakai data lokal */ });
  }
}

// =================== STORAGE USAGE (real-time, dari data aktual) ===================
// Sumber data:
//   - Video blob di IndexedDB (`playly-videos`) — biasanya bagian terbesar
//   - Semua key `playly-*` di localStorage (akun, state, admin data, dll.)
// Kapasitas: 1 GB (cap visualisasi sesuai Supabase free tier).
const STORAGE_CAPACITY_BYTES = 1024 * 1024 * 1024; // 1 GB

function computeLocalStorageBytes() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("playly-")) continue;
    const v = localStorage.getItem(k);
    if (v == null) continue;
    // Approximation: UTF-16 per char di key+value
    total += (k.length + v.length) * 2;
  }
  return total;
}

function fmtStorageBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

let __storageRefreshing = false;
async function refreshStorageUsage() {
  if (__storageRefreshing) return;
  __storageRefreshing = true;
  try {
    const lsBytes = computeLocalStorageBytes();
    const idbBytes = await computeIDBVideosBytes();
    let used = lsBytes + idbBytes;

    // Untuk admin: tampilkan total cloud bucket Supabase (gabungan dari semua user),
    // bukan cuma device lokal. Untuk user biasa: pakai data lokal saja.
    if (user?.role === "admin" && window.cloudSync?.computeBucketBytes) {
      try {
        const cloudBytes = await window.cloudSync.computeBucketBytes();
        if (cloudBytes > 0) used = cloudBytes + lsBytes;
      } catch {}
    }

    const pct = Math.min(100, Math.max(0, (used / STORAGE_CAPACITY_BYTES) * 100));
    const usedTxt = fmtStorageBytes(used);
    const capTxt = fmtStorageBytes(STORAGE_CAPACITY_BYTES);
    const pctTxt = `${pct < 1 && used > 0 ? "<1" : Math.round(pct)}%`;

    const textEl = document.getElementById("storageUsageText");
    if (textEl) textEl.textContent = `${usedTxt} / ${capTxt}`;
    const pctEl = document.getElementById("storageRingPct");
    if (pctEl) pctEl.textContent = pctTxt;
    const ringEl = document.getElementById("storageRingPath");
    if (ringEl) ringEl.setAttribute("stroke-dasharray", `${pct.toFixed(2)}, 100`);
  } catch (err) {
    console.warn("storage refresh failed:", err);
  } finally {
    __storageRefreshing = false;
  }
}

// Re-hitung saat tab kembali aktif (data IDB / localStorage bisa berubah dari device lain)
window.addEventListener("focus", () => { refreshStorageUsage(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshStorageUsage();
});
// Re-hitung saat cloud-sync apply data baru dari Supabase
window.addEventListener("playly:cloud-applied", () => { refreshStorageUsage(); });

function applyUserToUI() {
  const initials = user.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  $$(".sidebar .profile-card .avatar span").forEach(el => el.textContent = initials);
  $$(".user-chip .avatar span").forEach(el => el.textContent = initials);
  $$(".sidebar .profile-card strong").forEach(el => el.textContent = user.name);
  $$(".sidebar .profile-card small").forEach(el => el.textContent = `Online • @${user.username}`);
  $$(".user-chip .user-name").forEach(el => el.textContent = user.name.split(" ")[0]);

  // Profile dropdown header
  const pdHead = $(".pd-header");
  if (pdHead) {
    pdHead.querySelector(".avatar span").textContent = initials;
    pdHead.querySelector("strong").textContent = user.name;
    pdHead.querySelector("small").textContent = user.email;
  }

  // Hero greeting
  const heroH = $(".hero-text h2");
  if (heroH) heroH.innerHTML = `Halo, ${user.name.split(" ")[0]} <span class="wave">👋</span>`;

  // Avatar gambar (kalau ada)
  syncAvatarImages();

  // Profile edit form
  populateProfileForm();
  populateSettingsPrefs();
}

// ----------------------- AVATAR (sync gambar di tempat-tempat utama user sendiri) -----------------------
function syncAvatarImages() {
  // Cuma ganti avatar user sendiri di sidebar, header chip, dan dropdown
  const targets = [
    ...$$(".sidebar .profile-card .avatar"),
    ...$$(".user-chip .avatar"),
    ...$$(".pd-header .avatar")
  ];
  targets.forEach(el => {
    el.style.position ||= "relative";
    let img = el.querySelector("img.avatar-img");
    const span = el.querySelector("span");
    if (user.avatar) {
      if (!img) {
        img = document.createElement("img");
        img.className = "avatar-img";
        img.alt = "";
        img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:1";
        el.appendChild(img);
      }
      img.src = user.avatar;
      if (span) span.style.opacity = "0";
    } else {
      img?.remove();
      if (span) span.style.opacity = "";
    }
  });
}

// ----------------------- PROFILE EDIT FORM -----------------------
function populateProfileForm() {
  const fields = ["username", "name", "email", "bio", "website", "twitter", "instagram", "github"];
  fields.forEach(f => {
    const el = document.querySelector(`[data-profile="${f}"]`);
    if (el) el.value = user[f] || "";
  });
  // Avatar preview
  const av = $("#profileAvatarPreview");
  if (av) {
    av.innerHTML = user.avatar
      ? `<img src="${user.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`
      : `<span>${(user.name || "U").split(/\s+/).map(p => p[0]).slice(0,2).join("").toUpperCase()}</span>`;
  }
  // Info akun
  const joined = user.joinedAt ? new Date(user.joinedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";
  $("#profileJoined") && ($("#profileJoined").textContent = joined);
  $("#profileTotalVid") && ($("#profileTotalVid").textContent = state?.myVideos?.length || 0);
  $("#profileTotalFollow") && ($("#profileTotalFollow").textContent = state?.followingCreators?.length || 0);
  $("#profileRole") && ($("#profileRole").textContent = user.role === "admin" ? "Administrator" : "User");
}

document.getElementById("profileEditForm")?.addEventListener("submit", e => {
  e.preventDefault();
  if (!user) return;
  const newName = (document.querySelector('[data-profile="name"]')?.value || "").trim();
  const newBio = (document.querySelector('[data-profile="bio"]')?.value || "").trim();
  if (newName.length < 2) return toast("⚠️ Display Name minimal 2 karakter", "warning");
  user.name = newName;
  user.bio = newBio;
  persistUserAndAccount();
  applyUserToUI();
  toast("✓ Profil disimpan", "success");
});

document.getElementById("profileSocialForm")?.addEventListener("submit", e => {
  e.preventDefault();
  if (!user) return;
  ["website", "twitter", "instagram", "github"].forEach(f => {
    user[f] = (document.querySelector(`[data-profile="${f}"]`)?.value || "").trim();
  });
  persistUserAndAccount();
  toast("✓ Tautan sosial disimpan", "success");
});

// Avatar upload — file pick membuka avatar editor (crop + zoom)
$("#profileAvatarPick")?.addEventListener("click", () => $("#profileAvatarInput").click());
$("#profileAvatarInput")?.addEventListener("change", e => {
  const file = e.target.files[0];
  e.target.value = ""; // reset supaya pilih file yg sama berikutnya tetap trigger change
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("⚠️ File harus berupa gambar", "warning");
  if (file.size > 2 * 1024 * 1024) return toast("⚠️ Maksimal 2 MB", "warning");
  openAvatarEditor(file);
});
$("#profileAvatarRemove")?.addEventListener("click", () => {
  if (!user) return;
  user.avatar = null;
  persistUserAndAccount();
  applyUserToUI();
  toast("Foto profil dihapus", "info");
});

function downscaleImage(file, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * ratio), h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

/* =========================================================
   AVATAR EDITOR — crop + zoom (drag to pan, slider to zoom)
   ========================================================= */
const avatarEditor = {
  STAGE: 280,        // px, ukuran stage persegi (lihat .avatar-editor-stage di styles.css)
  CROP: 260,         // px, diameter lingkaran crop (lihat .avatar-editor-mask::after)
  OUTPUT: 256,       // px, resolusi akhir avatar
  MIN_ZOOM: 1,
  MAX_ZOOM: 4,
  img: null,         // <img>
  url: null,         // object URL (di-revoke saat tutup)
  natW: 0, natH: 0,  // ukuran natural foto
  baseScale: 1,      // skala minimum agar foto menutupi stage (cover)
  scale: 1,          // skala saat ini (zoom slider)
  tx: 0, ty: 0,      // pan offset (px) terhadap pusat stage
  dragging: false,
  lastX: 0, lastY: 0,
};

function openAvatarEditor(file) {
  const modal = $("#avatarEditorModal");
  const stage = $("#avatarEditorStage");
  const imgEl = $("#avatarEditorImg");
  const slider = $("#avatarZoomSlider");
  if (!modal || !stage || !imgEl || !slider) return;

  // Cleanup state lama
  if (avatarEditor.url) { URL.revokeObjectURL(avatarEditor.url); avatarEditor.url = null; }
  avatarEditor.img = imgEl;

  const url = URL.createObjectURL(file);
  avatarEditor.url = url;

  imgEl.onload = () => {
    avatarEditor.natW = imgEl.naturalWidth;
    avatarEditor.natH = imgEl.naturalHeight;
    // Base scale: cover stage (min dimension foto = STAGE)
    avatarEditor.baseScale = Math.max(
      avatarEditor.STAGE / avatarEditor.natW,
      avatarEditor.STAGE / avatarEditor.natH
    );
    avatarEditor.scale = 1;
    avatarEditor.tx = 0;
    avatarEditor.ty = 0;
    slider.value = "1";
    avatarEditorRender();
  };
  imgEl.src = url;

  modal.classList.add("show");
}

function avatarEditorRender() {
  const a = avatarEditor;
  if (!a.img || !a.natW) return;
  const effScale = a.baseScale * a.scale;
  const dispW = a.natW * effScale;
  const dispH = a.natH * effScale;

  // Clamp pan: foto tidak boleh keluar dari area crop (lingkaran 260) — pakai stage 280 sebagai pendekatan kotak
  const maxPanX = Math.max(0, (dispW - a.STAGE) / 2);
  const maxPanY = Math.max(0, (dispH - a.STAGE) / 2);
  a.tx = Math.max(-maxPanX, Math.min(maxPanX, a.tx));
  a.ty = Math.max(-maxPanY, Math.min(maxPanY, a.ty));

  // Posisi: pusat foto di pusat stage + offset pan
  // img.style top:50% left:50% transform-origin:0 0 → translate(-w/2 + tx, -h/2 + ty) scale(effScale)
  const offX = -a.natW * effScale / 2 + a.tx;
  const offY = -a.natH * effScale / 2 + a.ty;
  a.img.style.transform = `translate(${offX}px, ${offY}px) scale(${effScale})`;
}

function avatarEditorRenderToDataUrl() {
  const a = avatarEditor;
  const canvas = document.createElement("canvas");
  canvas.width = a.OUTPUT;
  canvas.height = a.OUTPUT;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const effScale = a.baseScale * a.scale;
  const dispW = a.natW * effScale;
  const dispH = a.natH * effScale;

  // Bagian foto yang masuk lingkaran crop = kotak CROP × CROP di tengah stage.
  // Dalam koordinat foto natural: lebar potong = CROP / effScale
  const srcSize = a.CROP / effScale;
  // Posisi sumber: pusat foto - pan, lalu kurangi setengah srcSize
  const cxNat = a.natW / 2 - a.tx / effScale;
  const cyNat = a.natH / 2 - a.ty / effScale;
  const sx = cxNat - srcSize / 2;
  const sy = cyNat - srcSize / 2;

  ctx.drawImage(a.img, sx, sy, srcSize, srcSize, 0, 0, a.OUTPUT, a.OUTPUT);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function closeAvatarEditor() {
  const modal = $("#avatarEditorModal");
  modal?.classList.remove("show");
  if (avatarEditor.url) {
    URL.revokeObjectURL(avatarEditor.url);
    avatarEditor.url = null;
  }
  if (avatarEditor.img) avatarEditor.img.removeAttribute("src");
}

// Drag pan (pointer events — mouse + touch)
(function bindAvatarEditor() {
  const stage = $("#avatarEditorStage");
  const slider = $("#avatarZoomSlider");
  const btnIn = $("#avatarZoomIn");
  const btnOut = $("#avatarZoomOut");
  const btnSave = $("#avatarEditorSave");
  if (!stage || !slider) return;

  stage.addEventListener("pointerdown", e => {
    avatarEditor.dragging = true;
    avatarEditor.lastX = e.clientX;
    avatarEditor.lastY = e.clientY;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", e => {
    if (!avatarEditor.dragging) return;
    const dx = e.clientX - avatarEditor.lastX;
    const dy = e.clientY - avatarEditor.lastY;
    avatarEditor.lastX = e.clientX;
    avatarEditor.lastY = e.clientY;
    avatarEditor.tx += dx;
    avatarEditor.ty += dy;
    avatarEditorRender();
  });
  const endDrag = e => {
    avatarEditor.dragging = false;
    try { stage.releasePointerCapture(e.pointerId); } catch {}
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  // Wheel zoom (desktop quality of life)
  stage.addEventListener("wheel", e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    const next = Math.max(avatarEditor.MIN_ZOOM, Math.min(avatarEditor.MAX_ZOOM, avatarEditor.scale + delta));
    avatarEditor.scale = next;
    slider.value = String(next);
    avatarEditorRender();
  }, { passive: false });

  slider.addEventListener("input", () => {
    avatarEditor.scale = parseFloat(slider.value) || 1;
    avatarEditorRender();
  });
  btnIn?.addEventListener("click", () => {
    avatarEditor.scale = Math.min(avatarEditor.MAX_ZOOM, avatarEditor.scale + 0.2);
    slider.value = String(avatarEditor.scale);
    avatarEditorRender();
  });
  btnOut?.addEventListener("click", () => {
    avatarEditor.scale = Math.max(avatarEditor.MIN_ZOOM, avatarEditor.scale - 0.2);
    slider.value = String(avatarEditor.scale);
    avatarEditorRender();
  });

  btnSave?.addEventListener("click", () => {
    if (!user) return;
    try {
      const dataUrl = avatarEditorRenderToDataUrl();
      user.avatar = dataUrl;
      persistUserAndAccount();
      applyUserToUI();
      toast("✓ Foto profil diupdate", "success");
      closeAvatarEditor();
    } catch (err) {
      toast("❌ Gagal proses gambar", "error");
    }
  });

  // Tutup via [data-close] sudah ditangani global handler — tambah cleanup URL
  $("#avatarEditorModal")?.querySelectorAll("[data-close]").forEach(b => {
    b.addEventListener("click", () => {
      if (avatarEditor.url) {
        URL.revokeObjectURL(avatarEditor.url);
        avatarEditor.url = null;
      }
      if (avatarEditor.img) avatarEditor.img.removeAttribute("src");
    });
  });
})();

function persistUserAndAccount() {
  localStorage.setItem("playly-user", JSON.stringify(user));
  const accKey = `playly-account-${user.email}`;
  const acc = JSON.parse(localStorage.getItem(accKey) || "null");
  if (acc) {
    Object.assign(acc, {
      name: user.name, bio: user.bio, avatar: user.avatar,
      website: user.website, twitter: user.twitter,
      instagram: user.instagram, github: user.github
    });
    localStorage.setItem(accKey, JSON.stringify(acc));
  }
}

// ----------------------- SETTINGS PREFERENCES (toggles & dropdowns) -----------------------
function getPrefs() {
  if (!user) return {};
  try { return JSON.parse(localStorage.getItem(`playly-prefs-${user.email}`) || "{}"); }
  catch { return {}; }
}
function setPref(key, value) {
  if (!user) return;
  const prefs = getPrefs();
  // dot-path: "notif.email" → prefs.notif.email
  const parts = key.split(".");
  let obj = prefs;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof obj[parts[i]] !== "object" || !obj[parts[i]]) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
  localStorage.setItem(`playly-prefs-${user.email}`, JSON.stringify(prefs));
}
function getPref(key, defVal) {
  const prefs = getPrefs();
  const parts = key.split(".");
  let obj = prefs;
  for (const p of parts) {
    if (obj == null || typeof obj !== "object") return defVal;
    obj = obj[p];
  }
  return obj === undefined ? defVal : obj;
}

function populateSettingsPrefs() {
  $$("[data-pref]").forEach(el => {
    const key = el.dataset.pref;
    const def = el.type === "checkbox" ? el.checked : el.value;
    const cur = getPref(key, def);
    if (el.type === "checkbox") el.checked = !!cur;
    else el.value = cur;

    if (!el.dataset.bound) {
      el.dataset.bound = "1";
      const handler = () => {
        const v = el.type === "checkbox" ? el.checked : el.value;
        setPref(key, v);
        applyPrefSideEffects(key, v);
      };
      el.addEventListener(el.tagName === "SELECT" ? "change" : "change", handler);
    }
  });
}

function applyPrefSideEffects(key, val) {
  // Reduced motion → set CSS class on body
  if (key === "display.reducedMotion") {
    document.body.classList.toggle("reduced-motion", !!val);
  }
  if (key === "display.compact") {
    document.body.classList.toggle("compact-mode", !!val);
  }
  // Bahasa & timezone hanya disimpan untuk demo (tidak benar-benar mengubah teks)
}

// ----------------------- PLATFORM SETTINGS (admin-only, global) -----------------------
// Settings yang berlaku ke seluruh platform (bukan per-user). Disimpan di
// `playly-platform-config` dan dibaca oleh kode lain (signup, upload, comment).
const PLATFORM_CONFIG_KEY = "playly-platform-config";

function defaultPlatformConfig() {
  return {
    maintenance: false,
    registrationOpen: true,
    uploadEnabled: true,
    commentsEnabled: true,
    autoApproveUpload: true,
    autoFlagWords: true,
    notifyOnFlag: true,
    autoSuspendStrikes: 3,
    auditLog: true,
    serverTz: "WIB",
    currency: "IDR"
  };
}

function getPlatformConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(PLATFORM_CONFIG_KEY) || "null");
    return { ...defaultPlatformConfig(), ...(c || {}) };
  } catch { return defaultPlatformConfig(); }
}

function getPlatformSetting(key, def) {
  const c = getPlatformConfig();
  return key in c ? c[key] : def;
}

function setPlatformSetting(key, val) {
  const c = getPlatformConfig();
  c[key] = val;
  localStorage.setItem(PLATFORM_CONFIG_KEY, JSON.stringify(c));
  applyPlatformSettingSideEffects(key, val);
  // Audit-log aksi kalau auditLog ON
  if (c.auditLog && user?.role === "admin" && typeof pushAdminEvent === "function") {
    pushAdminEvent("⚙️", `Setting platform "${key}" diubah ke ${JSON.stringify(val)}`);
  }
}

function applyPlatformSettingSideEffects(key, val) {
  if (key === "maintenance") {
    document.body.classList.toggle("platform-maintenance", !!val);
    if (val) toast("⚠️ Maintenance mode AKTIF — user non-admin diblokir", "warning");
  }
  if (key === "uploadEnabled" || key === "registrationOpen" || key === "commentsEnabled") {
    // Sinkronkan UI di tab admin saat ini (toggle disable / sembunyikan tombol)
    syncPlatformUiState();
  }
}

// Hidden state class hooks for user-side: <body> kebak class
// "platform-no-upload" / "platform-no-comments" / "platform-no-signup".
// CSS bisa disable tombol upload, hide comment box, dsb.
function syncPlatformUiState() {
  const c = getPlatformConfig();
  document.body.classList.toggle("platform-no-upload", !c.uploadEnabled);
  document.body.classList.toggle("platform-no-comments", !c.commentsEnabled);
  document.body.classList.toggle("platform-no-signup", !c.registrationOpen);
  document.body.classList.toggle("platform-maintenance", !!c.maintenance);
}
syncPlatformUiState();

// Cross-tab sync: kalau admin ubah platform setting di tab lain, refresh class
window.addEventListener("storage", e => {
  if (e.key === PLATFORM_CONFIG_KEY) syncPlatformUiState();
});

function populatePlatformSettings() {
  $$("[data-platform]").forEach(el => {
    const key = el.dataset.platform;
    const cur = getPlatformSetting(key, el.type === "checkbox" ? el.checked : el.value);
    if (el.type === "checkbox") el.checked = !!cur;
    else el.value = cur;
    if (!el.dataset.platformBound) {
      el.dataset.platformBound = "1";
      el.addEventListener("change", () => {
        let v = el.type === "checkbox" ? el.checked : el.value;
        // Coerce numeric for select with numeric values
        if (el.type !== "checkbox" && /^-?\d+$/.test(v)) v = Number(v);
        setPlatformSetting(key, v);
      });
    }
  });
  // Card "Buat Admin" disembunyikan via CSS [data-super-admin-only].
  // Cuma render daftar admin tambahan kalau super admin yang buka.
  if (isSuperAdmin(user)) renderExtraAdminList();
}

// ----------------------- CHANGE PASSWORD -----------------------
document.getElementById("changePasswordForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!user) return;
  const fd = new FormData(e.target);
  const oldPw = fd.get("oldPw");
  const newPw = fd.get("newPw");
  const confirmPw = fd.get("confirmPw");

  if (newPw.length < 6) return toast("⚠️ Password baru minimal 6 karakter", "warning");
  if (newPw !== confirmPw) return toast("❌ Konfirmasi password tidak cocok", "error");

  const accKey = `playly-account-${user.email}`;
  const acc = JSON.parse(localStorage.getItem(accKey) || "null");
  if (!acc) return toast("❌ Akun tidak ditemukan", "error");
  const oldOk = await verifyPassword(oldPw, acc.password);
  if (!oldOk) return toast("❌ Password lama salah", "error");

  acc.password = await hashPassword(newPw);
  localStorage.setItem(accKey, JSON.stringify(acc));
  e.target.reset();
  toast("✓ Password berhasil diubah", "success");
});

// ----------------------- ADMIN SETTINGS (form handlers) -----------------------
$("#adminChangePasswordForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!user || user.role !== "admin") return;
  const fd = new FormData(e.target);
  const oldPw = fd.get("oldPw");
  const newPw = fd.get("newPw");
  const confirmPw = fd.get("confirmPw");
  if (newPw.length < 6) return toast("⚠️ Password baru minimal 6 karakter", "warning");
  if (newPw !== confirmPw) return toast("❌ Konfirmasi password tidak cocok", "error");
  const accKey = `playly-account-${user.email}`;
  const acc = JSON.parse(localStorage.getItem(accKey) || "null");
  if (!acc) return toast("❌ Akun admin tidak ditemukan", "error");
  const oldOk = await verifyPassword(oldPw, acc.password);
  if (!oldOk) return toast("❌ Password lama salah", "error");
  acc.password = await hashPassword(newPw);
  localStorage.setItem(accKey, JSON.stringify(acc));
  e.target.reset();
  if (typeof pushAdminEvent === "function") pushAdminEvent("🔐", "Password admin diubah");
  toast("✓ Password admin berhasil diubah", "success");
});

// ----------------------- ADMIN MANAGEMENT (super admin only) -----------------------
$("#createAdminForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!isSuperAdmin(user)) return toast("⚠ Hanya super admin yang bisa membuat admin baru", "warning");
  const fd = new FormData(e.target);
  const name = String(fd.get("name") || "").trim();
  const username = String(fd.get("username") || "").trim().toLowerCase();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  if (name.length < 2) return toast("⚠ Nama minimal 2 karakter", "warning");
  if (!username) return toast("⚠ Username tidak boleh kosong", "warning");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("⚠ Format email tidak valid", "warning");
  if (password.length < 6) return toast("⚠ Password minimal 6 karakter", "warning");
  if (isOfficialAdminEmail(email)) return toast("⚠ Email itu sudah dipakai super admin", "warning");
  if (isReservedUsername(username)) return toast("⚠ Username \"admin\" direservasi untuk super admin", "warning");
  if (findAccountByEmail(email)) return toast("⚠ Email sudah terdaftar", "warning");
  if (findAccountByUsername(username)) return toast("⚠ Username sudah dipakai", "warning");

  // Allowlist DULU supaya enforceAdminLock tidak downgrade akun ke "user" saat reload
  const list = getExtraAdminEmails();
  if (!list.includes(email)) list.push(email);
  setExtraAdminEmails(list);

  const hashedPw = await hashPassword(password);
  const acc = {
    name, username, email,
    role: "admin",
    joinedAt: new Date().toISOString(),
    password: hashedPw,
    createdBy: user.email
  };
  localStorage.setItem(`playly-account-${email}`, JSON.stringify(acc));

  if (typeof pushAdminEvent === "function") pushAdminEvent("👑", `Admin baru ditambah: <b>@${escapeHtml(username)}</b>`);
  e.target.reset();
  renderExtraAdminList();
  toast(`✓ Admin baru <b>@${escapeHtml(username)}</b> berhasil dibuat`, "success");
});

function renderExtraAdminList() {
  const box = document.getElementById("extraAdminList");
  if (!box) return;
  const emails = getExtraAdminEmails();
  if (!emails.length) {
    box.innerHTML = `<p class="muted" style="font-size:12px;margin-top:14px">Belum ada admin tambahan.</p>`;
    return;
  }
  const accounts = getAllAccounts();
  box.innerHTML = `
    <p class="muted" style="font-size:12px;margin:18px 0 8px">Admin tambahan (${emails.length}):</p>
    <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">
      ${emails.map(em => {
        const a = accounts.find(x => (x.email || "").toLowerCase() === em);
        const label = a
          ? `<b>${escapeHtml(a.name)}</b> <span class="muted" style="font-size:12px">@${escapeHtml(a.username)} · ${escapeHtml(em)}</span>`
          : `<span class="muted">${escapeHtml(em)} <small>(akun belum disinkron)</small></span>`;
        return `<li style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-elev);border:1px solid var(--border);border-radius:8px"><span>${label}</span><button type="button" class="btn ghost danger" data-revoke-admin="${escapeHtml(em)}" style="padding:6px 12px;font-size:12px">Cabut</button></li>`;
      }).join("")}
    </ul>`;
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-revoke-admin]");
  if (!btn) return;
  if (!isSuperAdmin(user)) return toast("⚠ Hanya super admin yang bisa mencabut admin", "warning");
  const email = String(btn.dataset.revokeAdmin || "").toLowerCase();
  if (!email || isOfficialAdminEmail(email)) return;
  openConfirm({
    icon: "⚠️", iconClass: "warn",
    title: "Cabut Admin?",
    desc: `Akun <b>${escapeHtml(email)}</b> akan kehilangan akses admin dan jadi user biasa. Akun-nya tetap ada.`,
    btnText: "Cabut Admin", btnClass: "danger",
    onConfirm: () => {
      const list = getExtraAdminEmails().filter(e2 => e2 !== email);
      setExtraAdminEmails(list);
      const accKey = `playly-account-${email}`;
      const acc = JSON.parse(localStorage.getItem(accKey) || "null");
      if (acc) {
        acc.role = "user";
        localStorage.setItem(accKey, JSON.stringify(acc));
      }
      if (typeof pushAdminEvent === "function") pushAdminEvent("❌", `Admin dicabut: <b>${escapeHtml(email)}</b>`);
      renderExtraAdminList();
      toast("✓ Admin dicabut", "success");
    }
  });
});

function downloadJsonBlob(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ----------------------- AUTH UI -----------------------
const authTabs = $(".auth-tabs");

function switchAuthTab(name) {
  $$("[data-auth-tab]").forEach(b => {
    if (b.tagName === "BUTTON") b.classList.toggle("active", b.dataset.authTab === name);
  });
  authTabs.classList.toggle("signup", name === "signup");
  $$(".auth-form").forEach(f => f.classList.toggle("active", f.dataset.form === name));
}

$$("[data-auth-tab]").forEach(b => {
  b.addEventListener("click", e => { e.preventDefault(); switchAuthTab(b.dataset.authTab); });
});

// Password toggle
$$(".pw-toggle").forEach(b => {
  b.addEventListener("click", () => {
    const input = b.previousElementSibling.tagName === "INPUT" ? b.previousElementSibling : b.parentElement.querySelector("input");
    if (input.type === "password") { input.type = "text"; b.textContent = "🙈"; }
    else { input.type = "password"; b.textContent = "👁"; }
  });
});

// Password strength
const pwInput = $("#signupForm input[name='password']");
const pwStrength = $("#pwStrength");
pwInput?.addEventListener("input", () => {
  const v = pwInput.value;
  let s = 0;
  if (v.length >= 6) s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/[0-9]/.test(v) && /[^a-zA-Z0-9]/.test(v)) s++;
  pwStrength.className = "pw-strength" + (s ? ` s${s}` : "");
  pwStrength.querySelector("small").textContent = ["Lemah", "Lemah", "Sedang", "Kuat", "Sangat kuat"][s];
});

// ----------------------- ACCOUNT LOOKUP HELPERS -----------------------
function findAccountByEmail(email) {
  if (!email) return null;
  return JSON.parse(localStorage.getItem(`playly-account-${email.trim().toLowerCase()}`) || "null");
}

function findAccountByUsername(username) {
  if (!username) return null;
  const target = username.trim().toLowerCase();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("playly-account-")) continue;
    try {
      const a = JSON.parse(localStorage.getItem(k));
      if (a?.username && a.username.toLowerCase() === target) return a;
    } catch {}
  }
  return null;
}

// Find the single registered admin account, if any. Only one admin is allowed.
function findExistingAdmin() {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("playly-account-")) continue;
    try {
      const a = JSON.parse(localStorage.getItem(k));
      if (a?.role === "admin") return a;
    } catch {}
  }
  return null;
}

// ----------------------- PIN HASH (untuk 2FA) -----------------------
// Sederhana — bukan kripto-grade tapi cukup supaya PIN tidak plain-text di localStorage.
// Cocok untuk demo/UI. Di production nyata pakai bcrypt/argon2 server-side.
function hashPin(pin) {
  let h = 5381;
  const salt = "playly-2fa-salt-v1";
  const s = salt + String(pin);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return "h:" + (h >>> 0).toString(16);
}
function verifyPin(plainPin, storedHash) {
  if (!storedHash) return true; // akun lama tanpa PIN → skip 2FA (backward compat)
  return hashPin(plainPin) === storedHash;
}

// ----------------------- PASSWORD HASH (versi-versi) -----------------------
// Pakai Web Crypto SubtleCrypto — async tapi jauh lebih kuat dari djb2.
//
// Format yang didukung (urut dari paling baru):
//   h3:<saltHex>:<iterations>:<hashHex>  → PBKDF2-SHA256, per-user random salt.
//                                           Iterations 100000 bikin brute-force
//                                           ~100k× lebih lambat dari SHA-256
//                                           single-pass.
//   h2:<sha256Hex>                        → SHA-256 dengan salt fixed (legacy
//                                           dari migrasi pertama). Diverifikasi
//                                           tapi semua login berhasil di-upgrade
//                                           ke h3.
//   <plaintext>                           → akun pra-hashing. Diverifikasi tapi
//                                           langsung di-upgrade saat login OK.
//
// Tujuan: meskipun database di Supabase ke-leak, attacker tetap kesulitan
// crack password karena tiap user punya salt random + iterations cost tinggi.

const PLAYLY_PASSWORD_SALT_V2 = "playly-pwd-salt-v1"; // tetap, jangan diubah — dipakai untuk verifikasi h2 lama
const PBKDF2_ITERATIONS = 100000;

function _hex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function _hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// Hash baru: PBKDF2-SHA256 dengan salt random per akun
async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(plain ?? "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const buf = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `h3:${_hex(salt)}:${PBKDF2_ITERATIONS}:${_hex(buf)}`;
}

// Hash lama (h2): tetap di-support untuk verifikasi backward-compat.
async function hashPasswordV2(plain) {
  const data = new TextEncoder().encode(PLAYLY_PASSWORD_SALT_V2 + String(plain ?? ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return "h2:" + _hex(buf);
}

function isHashedPassword(stored) {
  return typeof stored === "string" && (stored.startsWith("h3:") || stored.startsWith("h2:"));
}
function isLatestHashFormat(stored) {
  return typeof stored === "string" && stored.startsWith("h3:");
}

async function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (typeof stored !== "string") return false;
  if (stored.startsWith("h3:")) {
    const parts = stored.split(":");
    if (parts.length !== 4) return false;
    const saltHex = parts[1];
    const iterations = parseInt(parts[2], 10);
    const expectedHashHex = parts[3];
    if (!iterations || iterations < 1 || !saltHex || !expectedHashHex) return false;
    try {
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(String(plain ?? "")),
        "PBKDF2",
        false,
        ["deriveBits"]
      );
      const buf = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: _hexToBytes(saltHex), iterations, hash: "SHA-256" },
        keyMaterial,
        expectedHashHex.length * 4 // 4 bits per hex char
      );
      return _hex(buf) === expectedHashHex;
    } catch { return false; }
  }
  if (stored.startsWith("h2:")) {
    const candidate = await hashPasswordV2(plain);
    return candidate === stored;
  }
  // Plaintext legacy — auto-migrate ke h3 setelah login berhasil
  return stored === plain;
}

// Konstanta ADMIN_PASSWORD_HASH & DEFAULT_RESET_PASSWORD_HASH dipindah ke atas
// (sebelum seedOfficialAdmin) supaya tidak kena temporal-dead-zone saat seed
// jalan di script load.

// ----------------------- LOGIN RATE LIMITING -----------------------
// Tracking per identifier (email/username, di-normalize lowercase) di localStorage.
// Setelah MAX_ATTEMPTS gagal berturut, akun di-lockout selama LOCKOUT_MS.
// Login sukses → reset counter.
const LOGIN_MAX_ATTEMPTS = 3;
const LOGIN_LOCKOUT_MS = 30 * 60 * 1000; // 30 menit
function loginAttemptKey(id) { return `playly-login-attempts-${id}`; }
function getLoginAttempts(id) {
  try {
    const raw = localStorage.getItem(loginAttemptKey(id));
    if (!raw) return { count: 0, lockedUntil: 0 };
    const obj = JSON.parse(raw);
    return { count: obj.count || 0, lockedUntil: obj.lockedUntil || 0 };
  } catch { return { count: 0, lockedUntil: 0 }; }
}
function checkLoginLockout(id) {
  const { lockedUntil } = getLoginAttempts(id);
  const remaining = lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}
function recordLoginFailure(id) {
  const cur = getLoginAttempts(id);
  cur.count += 1;
  if (cur.count >= LOGIN_MAX_ATTEMPTS) {
    cur.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
    cur.count = 0; // reset counter, lockout aktif
  }
  try { localStorage.setItem(loginAttemptKey(id), JSON.stringify(cur)); } catch {}
  return cur;
}
function clearLoginAttempts(id) {
  try { localStorage.removeItem(loginAttemptKey(id)); } catch {}
}
function fmtLockoutDuration(ms) {
  const sec = Math.ceil(ms / 1000);
  if (sec >= 60) return `${Math.ceil(sec / 60)} menit`;
  return `${sec} detik`;
}

// ----------------------- INLINE LOCK BANNER -----------------------
// Pengganti modal popup "Akun Terkunci" — banner inline di form login
// supaya peringatan tetap terlihat di halaman login (tidak menutupi UI).
let _signinLockTimer = null;
function showLockBanner(lockMs) {
  const banner = $("#signinLockBanner");
  const cd = $("#signinLockCountdown");
  if (!banner || !cd) return;
  const targetTs = Date.now() + lockMs;
  banner.hidden = false;
  cd.textContent = fmtLockoutDuration(lockMs);
  if (_signinLockTimer) clearInterval(_signinLockTimer);
  _signinLockTimer = setInterval(() => {
    const remaining = targetTs - Date.now();
    if (remaining <= 0) {
      hideLockBanner();
      return;
    }
    cd.textContent = fmtLockoutDuration(remaining);
  }, 1000);
}
function hideLockBanner() {
  const banner = $("#signinLockBanner");
  if (banner) banner.hidden = true;
  if (_signinLockTimer) {
    clearInterval(_signinLockTimer);
    _signinLockTimer = null;
  }
}
// Proactive check: setiap user ketik email/username, periksa lockout.
// Pakai debounce supaya tidak terlalu sering trigger saat user lagi mengetik.
let _signinLockProbe = null;
function probeSigninLockout() {
  const form = $("#signinForm");
  if (!form) return;
  const input = form.querySelector('input[name="email"]');
  if (!input) return;
  const id = (input.value || "").trim().toLowerCase();
  if (!id) {
    hideLockBanner();
    return;
  }
  const lockMs = checkLoginLockout(id);
  if (lockMs > 0) showLockBanner(lockMs);
  else hideLockBanner();
}

// ----------------------- AUTH FORM ERROR UI HELPERS -----------------------
// Tampilkan error inline di bawah field + shake animation + auto-focus.
// Lebih jelas daripada cuma toast — user langsung tahu field mana yang salah.
function showFieldError(formOrInput, fieldName, message) {
  const form = formOrInput.tagName === "FORM" ? formOrInput : formOrInput.closest("form");
  const input = form?.querySelector(`[name="${fieldName}"]`) || formOrInput;
  if (!input) return;
  const wrap = input.closest(".auth-field") || input.parentElement;
  let err = wrap.querySelector(".field-error");
  if (!err) {
    err = document.createElement("small");
    err.className = "field-error";
    wrap.appendChild(err);
  }
  err.textContent = message;
  wrap.classList.add("has-error");
  input.classList.add("shake");
  setTimeout(() => input.classList.remove("shake"), 450);
  // Focus pertama yang error
  if (!form.querySelector(".has-error input:focus, .has-error textarea:focus")) {
    input.focus();
  }
}
function clearFieldErrors(form) {
  if (!form) return;
  form.querySelectorAll(".has-error").forEach(el => el.classList.remove("has-error"));
  form.querySelectorAll(".field-error").forEach(el => el.remove());
}
// Auto-clear error saat user mulai ngetik di field bermasalah
document.addEventListener("input", e => {
  const wrap = e.target.closest(".has-error");
  if (wrap) {
    wrap.classList.remove("has-error");
    wrap.querySelector(".field-error")?.remove();
  }
});

// Sign In
$("#signinForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  clearFieldErrors(form);
  const fd = new FormData(form);
  const identifier = (fd.get("email") || "").trim().toLowerCase();
  const password = fd.get("password");

  // Validasi field — inline error
  let hasError = false;
  if (!identifier) { showFieldError(form, "email", "Email atau username wajib diisi"); hasError = true; }
  if (!password) { showFieldError(form, "password", "Password wajib diisi"); hasError = true; }
  else if (password.length < 6) { showFieldError(form, "password", "Password minimal 6 karakter"); hasError = true; }
  if (hasError) {
    return toast("⚠️ Lengkapi data login dulu", "warning");
  }

  // Cek lockout SEBELUM submit ke server — tampilkan banner inline (bukan modal)
  const lockMs = checkLoginLockout(identifier);
  if (lockMs > 0) {
    showLockBanner(lockMs);
    return;
  }

  // CAPTCHA gate — minta verifikasi puzzle kalau sudah ada percobaan gagal sebelumnya.
  // Threshold = 1 → percobaan ke-2 dst. butuh CAPTCHA. Mencegah brute force password.
  const prevAttempts = getLoginAttempts(identifier);
  if (prevAttempts.count >= 1) {
    const captchaPassed = await openCaptchaModal();
    if (!captchaPassed) {
      return toast("⚠️ Verifikasi CAPTCHA dibatalkan — login dibatalkan", "warning");
    }
  }

  const btn = e.target.querySelector(".auth-submit");
  btn.classList.add("loading");

  await sleep(800);

  // Resolve identifier → email. Bisa email langsung atau username.
  let email = identifier;
  let existing = null;
  if (identifier.includes("@")) {
    existing = JSON.parse(localStorage.getItem(`playly-account-${identifier}`) || "null");
  } else {
    const byUser = findAccountByUsername(identifier);
    if (byUser) {
      email = byUser.email.toLowerCase();
      existing = byUser;
    }
  }

  // Helper: catat kegagalan + tampilkan sisa percobaan
  const onFail = (toastMsg) => {
    const after = recordLoginFailure(identifier);
    const remaining = LOGIN_MAX_ATTEMPTS - after.count;
    btn.classList.remove("loading");
    if (after.lockedUntil > Date.now()) {
      // Tampilkan banner inline (bukan modal) — peringatan tetap di form login
      showLockBanner(after.lockedUntil - Date.now());
      return;
    }
    return toast(`${toastMsg} (sisa percobaan: ${remaining})`, "error");
  };

  // Tidak ketemu akun & input bukan email valid → user salah ketik
  if (!existing && !identifier.includes("@")) {
    return onFail("❌ Username tidak ditemukan");
  }

  // Akun harus sudah terdaftar — tidak ada auto-create dari email asing.
  // Login gagal (email belum terdaftar) → catat sebagai kegagalan, tetap di halaman login.
  if (!existing) {
    return onFail("❌ Email belum terdaftar — silakan Daftar dulu");
  }

  // Verifikasi password DULU — sebelum guard role. Kalau password salah, user
  // hanya lihat pesan "Password salah" (tidak bocor info bahwa email itu admin).
  // Popup "Akses Ditolak" hanya untuk credentials yang sudah lulus verifikasi.
  const passwordOk = await verifyPassword(password, existing.password);
  if (!passwordOk) {
    return onFail("❌ Password salah");
  }

  // Guard: akun admin (super admin / admin tambahan) tidak boleh login lewat halaman User (/).
  // Jangan auto-redirect ke /admin — tiap URL harus tetap di domainnya sendiri.
  // Dicek SETELAH password verified supaya popup hanya muncul ke admin asli, bukan ke
  // user yang kebetulan salah ketik email.
  if (isAllowedAdminEmail(email) && pickedRole !== "admin") {
    btn.classList.remove("loading");
    return openAlert({
      icon: "⚠️",
      iconClass: "warn",
      title: "Akses Ditolak",
      desc: `Akun admin tidak bisa login di halaman User. Gunakan kredensial user untuk login di sini.`,
      btnText: "Mengerti",
      btnClass: "primary"
    });
  }

  // Guard: halaman /admin hanya untuk akun yang ada di allowlist admin.
  // Jangan auto-redirect ke / — tiap URL harus tetap di domainnya sendiri.
  if (pickedRole === "admin" && !isAllowedAdminEmail(email)) {
    btn.classList.remove("loading");
    return openAlert({
      icon: "🔒",
      iconClass: "danger",
      title: "Akses Admin Ditolak",
      desc: `Akun ini bukan administrator. Halaman ini khusus admin platform.`,
      btnText: "Mengerti",
      btnClass: "danger"
    });
  }
  // Lazy upgrade ke format hash terbaru (plaintext → h3, h2 → h3)
  if (!isLatestHashFormat(existing.password)) {
    existing.password = await hashPassword(password);
    localStorage.setItem(`playly-account-${existing.email}`, JSON.stringify(existing));
  }
  // === 2FA: kalau akun punya PIN, minta PIN sebelum login ===
  if (existing.pin) {
    btn.classList.remove("loading");
    const enteredPin = await open2FAModal();
    if (enteredPin === null) {
      return; // user cancel — tetap di halaman login
    }
    if (!verifyPin(enteredPin, existing.pin)) {
      return onFail("❌ PIN 2FA salah");
    }
    btn.classList.add("loading"); // resume loading
  }
  // Force role berdasarkan allowlist admin — bukan dari data lama yang mungkin sudah dimanipulasi
  const correctRole = isAllowedAdminEmail(existing.email) ? "admin" : "user";
  user = { name: existing.name, username: existing.username, email: existing.email, joinedAt: existing.joinedAt, role: correctRole };

  // Login berhasil → reset rate limit counter & sembunyikan banner kalau masih ada
  clearLoginAttempts(identifier);
  hideLockBanner();

  localStorage.setItem("playly-user", JSON.stringify(user));
  // Track akun ini sebagai akun yang pernah login di device ini (untuk fitur
  // Pindah Akun). Hanya dipanggil di sini — bukan di auto-boot atau update.
  addDeviceAccount(user.email);
  state = loadState(user.username);
  btn.classList.remove("loading");
  toast(`👋 Selamat datang, <b>${user.name.split(" ")[0]}</b>!`, "success");
  bootDashboard();
});

// Proactive lockout probe — jalankan tiap user ketik di field email/username login.
// Debounce 350ms supaya tidak spam saat masih mengetik.
(() => {
  const form = $("#signinForm");
  if (!form) return;
  const input = form.querySelector('input[name="email"]');
  if (!input) return;
  input.addEventListener("input", () => {
    if (_signinLockProbe) clearTimeout(_signinLockProbe);
    _signinLockProbe = setTimeout(probeSigninLockout, 350);
  });
  // Cek juga saat form pertama kali dimuat (kalau autofill ngisi email locked)
  setTimeout(probeSigninLockout, 50);
  // Banner "Reset di sini" → trigger handler forgot password yang sudah ada
  form.addEventListener("click", e => {
    const link = e.target.closest('[data-auth-action="forgot"]');
    if (!link) return;
    e.preventDefault();
    $("#forgotPw")?.click();
  });
})();

// ----------------------- PUZZLE CAPTCHA (box-click sequence in modal) -----------------------
// User klik 6 kotak berurutan dari 1 → 6. Posisi angka di-shuffle tiap kali buka.
// Modal di-trigger saat user klik "Buat Akun" SETELAH validasi field signup lulus.
let captchaResolver = null;
let captchaNextExpected = 1;
const CAPTCHA_TOTAL = 6;
const CAPTCHA_COLORS = ["#561C24", "#8b5a2b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCaptchaGrid() {
  const grid = $("#captchaGrid");
  if (!grid) return;
  const numbers = shuffleArr([1, 2, 3, 4, 5, 6]);
  // Asosiasi warna ke nomor (bukan ke posisi grid) supaya konsisten saat acak ulang
  grid.innerHTML = numbers.map(n => `
    <button type="button" class="captcha-box" data-num="${n}" style="--box-color: ${CAPTCHA_COLORS[n - 1]}">
      <span class="captcha-num">${n}</span>
    </button>
  `).join("");
  captchaNextExpected = 1;
  updateCaptchaProgress();
  $("#captchaStatus").hidden = true;
}

function updateCaptchaProgress() {
  const p = $("#captchaProgress");
  if (!p) return;
  if (captchaNextExpected > CAPTCHA_TOTAL) {
    p.innerHTML = `Selesai! Verifikasi berhasil ✓`;
  } else {
    p.innerHTML = `Cari angka: <b>${captchaNextExpected}</b> <span class="captcha-progress-count">(${captchaNextExpected - 1}/${CAPTCHA_TOTAL})</span>`;
  }
}

function openCaptchaModal() {
  const modal = $("#captchaModal");
  if (!modal) return Promise.resolve(false);
  buildCaptchaGrid();
  modal.classList.add("show");
  return new Promise(resolve => { captchaResolver = resolve; });
}

function closeCaptchaModal(ok) {
  const modal = $("#captchaModal");
  if (!modal) return;
  modal.classList.remove("show");
  if (captchaResolver) {
    captchaResolver(!!ok);
    captchaResolver = null;
  }
}

function initCaptchaModal() {
  $("#captchaCancel")?.addEventListener("click", () => closeCaptchaModal(false));
  $("#captchaShuffle")?.addEventListener("click", buildCaptchaGrid);
  $("#captchaModal")?.querySelector(".modal-backdrop")?.addEventListener("click", () => closeCaptchaModal(false));

  // Klik kotak di grid
  $("#captchaGrid")?.addEventListener("click", e => {
    const box = e.target.closest(".captcha-box");
    if (!box || box.classList.contains("correct")) return;
    const num = +box.dataset.num;
    const status = $("#captchaStatus");
    if (num === captchaNextExpected) {
      box.classList.add("correct");
      captchaNextExpected++;
      updateCaptchaProgress();
      if (captchaNextExpected > CAPTCHA_TOTAL) {
        // Solved — close modal with success
        if (status) {
          status.textContent = "✓ Verifikasi berhasil!";
          status.className = "captcha-status-msg ok";
          status.hidden = false;
        }
        setTimeout(() => closeCaptchaModal(true), 700);
      }
    } else {
      // Wrong order — shake all + reset
      $$("#captchaGrid .captcha-box").forEach(b => b.classList.add("shake"));
      if (status) {
        status.textContent = "✗ Urutan salah! Mengacak ulang...";
        status.className = "captcha-status-msg err";
        status.hidden = false;
      }
      setTimeout(() => buildCaptchaGrid(), 900);
    }
  });

  // ESC untuk batal
  $("#captchaModal")?.addEventListener("keydown", e => {
    if (e.key === "Escape") closeCaptchaModal(false);
  });
}
initCaptchaModal();

// ----------------------- 2FA PIN MODAL -----------------------
// Setelah password verified saat signin, kalau akun punya `pin` → minta PIN.
// Modal dengan 6 input box angka (auto-advance saat ketik).
let twoFAResolver = null;

function open2FAModal() {
  const modal = $("#twoFAModal");
  if (!modal) return Promise.resolve(null);
  return new Promise(resolve => {
    twoFAResolver = resolve;
    modal.classList.add("show");
    // Reset inputs + focus pertama
    const inputs = $$("[data-pin-idx]", modal);
    inputs.forEach(i => { i.value = ""; });
    $("#twoFAError").hidden = true;
    setTimeout(() => inputs[0]?.focus(), 100);
  });
}

function close2FAModal(result) {
  const modal = $("#twoFAModal");
  if (!modal) return;
  modal.classList.remove("show");
  if (twoFAResolver) {
    twoFAResolver(result);
    twoFAResolver = null;
  }
}

// ----------------------- SETUP PIN MODAL (post-signup / from settings) -----------------------
// Modal untuk SET (bukan verifikasi) PIN 2FA. Returns Promise<string|null>:
// - string PIN 6-digit kalau user klik Aktifkan dengan PIN valid
// - null kalau user klik Lewati / Batal
let setupPinResolver = null;

function openSetupPinModal({ context = "signup" } = {}) {
  const modal = $("#setupPinModal");
  if (!modal) return Promise.resolve(null);
  const title = $("#setupPinTitle");
  const desc = $("#setupPinDesc");
  if (context === "settings") {
    if (title) title.textContent = "Atur PIN 2FA";
    if (desc) desc.textContent = "Buat PIN 6-digit baru. PIN diminta setiap kali login untuk keamanan ekstra.";
  } else {
    if (title) title.textContent = "Aktifkan 2FA?";
    if (desc) desc.textContent = "Buat PIN 6-digit untuk verifikasi tambahan saat login. Bisa dilewati dan diatur belakangan di Settings.";
  }
  // Reset inputs + clear error
  const inputs = $$("[data-setpin-idx]", modal);
  inputs.forEach(i => { i.value = ""; });
  $("#setupPinError").hidden = true;
  modal.classList.add("show");
  setTimeout(() => inputs[0]?.focus(), 100);
  return new Promise(resolve => { setupPinResolver = resolve; });
}

function closeSetupPinModal(result) {
  const modal = $("#setupPinModal");
  if (!modal) return;
  modal.classList.remove("show");
  if (setupPinResolver) {
    setupPinResolver(result);
    setupPinResolver = null;
  }
}

function initSetupPinModal() {
  const modal = $("#setupPinModal");
  if (!modal) return;
  const inputs = $$("[data-setpin-idx]", modal);
  inputs.forEach((inp, idx) => {
    inp.addEventListener("input", () => {
      inp.value = inp.value.replace(/\D/g, "").slice(0, 1);
      if (inp.value && idx < inputs.length - 1) inputs[idx + 1].focus();
    });
    inp.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !inp.value && idx > 0) inputs[idx - 1].focus();
      if (e.key === "Enter") $("#setupPinSave")?.click();
    });
    inp.addEventListener("paste", e => {
      e.preventDefault();
      const text = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      if (!text) return;
      [...text].forEach((ch, i) => { if (inputs[i]) inputs[i].value = ch; });
      inputs[Math.min(text.length, 5)].focus();
    });
  });
  $("#setupPinSave")?.addEventListener("click", () => {
    const pin = inputs.map(i => i.value).join("");
    if (!/^\d{6}$/.test(pin)) {
      const err = $("#setupPinError");
      err.textContent = "PIN harus tepat 6 digit angka";
      err.hidden = false;
      return;
    }
    closeSetupPinModal(pin);
  });
  $("#setupPinSkip")?.addEventListener("click", () => closeSetupPinModal(null));
  modal.querySelector(".modal-backdrop")?.addEventListener("click", () => closeSetupPinModal(null));
}
initSetupPinModal();

// ----------------------- SETTINGS: 2FA management -----------------------
function refreshTwoFASettings() {
  if (!user) return;
  const acc = JSON.parse(localStorage.getItem(`playly-account-${user.email}`) || "null");
  const enabled = !!acc?.pin;
  const label = $("#twofaStatusLabel");
  const badge = $("#twofaBadge");
  const hint = $("#twofaStatusHint");
  const activate = $("#twofaActivate");
  const change = $("#twofaChange");
  const disable = $("#twofaDisable");
  if (label) label.textContent = enabled ? "Aktif ✓" : "Nonaktif";
  if (badge) {
    badge.textContent = enabled ? "ON" : "OFF";
    badge.classList.toggle("on", enabled);
  }
  if (hint) hint.textContent = enabled
    ? "PIN 6-digit kamu diminta setiap kali login. Bagus untuk keamanan!"
    : "Tambah lapisan keamanan dengan PIN 6 digit yang diminta saat login.";
  if (activate) activate.hidden = enabled;
  if (change) change.hidden = !enabled;
  if (disable) disable.hidden = !enabled;
}

async function handleTwoFAActivate() {
  const pin = await openSetupPinModal({ context: "settings" });
  if (!pin) return;
  const acc = JSON.parse(localStorage.getItem(`playly-account-${user.email}`) || "{}");
  acc.pin = hashPin(pin);
  localStorage.setItem(`playly-account-${user.email}`, JSON.stringify(acc));
  toast("🔐 2FA aktif. PIN akan diminta saat login.", "success");
  refreshTwoFASettings();
}

function handleTwoFADisable() {
  if (!user) return;
  openConfirm({
    icon: "⚠️",
    iconClass: "warn",
    title: "Nonaktifkan 2FA?",
    desc: "PIN tidak akan diminta lagi saat login. Akun jadi kurang aman.",
    btnText: "Ya, nonaktifkan",
    btnClass: "danger",
    onConfirm: () => {
      const acc = JSON.parse(localStorage.getItem(`playly-account-${user.email}`) || "{}");
      delete acc.pin;
      localStorage.setItem(`playly-account-${user.email}`, JSON.stringify(acc));
      toast("🔓 2FA dinonaktifkan", "success");
      refreshTwoFASettings();
    }
  });
}

$("#twofaActivate")?.addEventListener("click", handleTwoFAActivate);
$("#twofaChange")?.addEventListener("click", handleTwoFAActivate);
$("#twofaDisable")?.addEventListener("click", handleTwoFADisable);

function init2FAModal() {
  const modal = $("#twoFAModal");
  if (!modal) return;
  const inputs = $$("[data-pin-idx]", modal);
  inputs.forEach((inp, idx) => {
    inp.addEventListener("input", e => {
      // Hanya angka
      inp.value = inp.value.replace(/\D/g, "").slice(0, 1);
      if (inp.value && idx < inputs.length - 1) inputs[idx + 1].focus();
    });
    inp.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !inp.value && idx > 0) inputs[idx - 1].focus();
      if (e.key === "Enter") $("#twoFAVerify")?.click();
    });
    inp.addEventListener("paste", e => {
      e.preventDefault();
      const text = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      if (!text) return;
      [...text].forEach((ch, i) => { if (inputs[i]) inputs[i].value = ch; });
      inputs[Math.min(text.length, 5)].focus();
    });
  });
  $("#twoFAVerify")?.addEventListener("click", () => {
    const pin = inputs.map(i => i.value).join("");
    if (pin.length !== 6) {
      const err = $("#twoFAError");
      err.textContent = "PIN harus 6 digit";
      err.hidden = false;
      return;
    }
    close2FAModal(pin);
  });
  $("#twoFACancel")?.addEventListener("click", () => close2FAModal(null));
}
init2FAModal();

// Sign Up
$("#signupForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector(".auth-submit");

  try {
    clearFieldErrors(form);
    const fd = new FormData(form);
    const name = (fd.get("name") || "").trim();
    const username = (fd.get("username") || "").trim().toLowerCase();
    const email = (fd.get("email") || "").trim().toLowerCase();
    const password = fd.get("password") || "";

    // Validasi field — inline error + shake + auto-focus
    let hasError = false;
    if (!name) { showFieldError(form, "name", "Nama wajib diisi"); hasError = true; }
    else if (name.length < 2) { showFieldError(form, "name", "Nama minimal 2 karakter"); hasError = true; }

    if (!username) { showFieldError(form, "username", "Username wajib diisi"); hasError = true; }
    else if (!/^[a-z0-9_.]{3,20}$/.test(username)) { showFieldError(form, "username", "3-20 karakter, hanya huruf kecil, angka, _ atau ."); hasError = true; }

    if (!email) { showFieldError(form, "email", "Email wajib diisi"); hasError = true; }
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) { showFieldError(form, "email", "Format email tidak valid (contoh: nama@email.com)"); hasError = true; }

    if (!password) { showFieldError(form, "password", "Password wajib diisi"); hasError = true; }
    else if (password.length < 6) { showFieldError(form, "password", "Password minimal 6 karakter"); hasError = true; }

    const termsCheckbox = form.querySelector("input[type=checkbox]");
    if (!termsCheckbox.checked) {
      toast("⚠️ Centang persetujuan Syarat & Ketentuan dulu", "warning");
      termsCheckbox.closest(".auth-check")?.classList.add("shake");
      setTimeout(() => termsCheckbox.closest(".auth-check")?.classList.remove("shake"), 450);
      hasError = true;
    }

    if (hasError) {
      toast("⚠️ Ada kolom yang perlu diperbaiki — cek tanda merah", "warning");
      return;
    }

    // Cek duplikat
    if (localStorage.getItem(`playly-account-${email}`)) {
      showFieldError(form, "email", "Email sudah terdaftar — coba login atau gunakan email lain");
      toast("❌ Email sudah terdaftar", "error");
      return;
    }
    if (findAccountByUsername(username)) {
      showFieldError(form, "username", "Username sudah dipakai user lain — pilih yang lain");
      toast("❌ Username sudah dipakai", "error");
      return;
    }

    // === CAPTCHA: minta verifikasi puzzle SETELAH field valid ===
    const captchaPassed = await openCaptchaModal();
    if (!captchaPassed) {
      toast("⚠️ Verifikasi CAPTCHA dibatalkan", "warning");
      return;
    }

    // Admin role lock: hanya OFFICIAL_ADMIN_EMAIL & OFFICIAL_ADMIN_USERNAME yang boleh jadi admin
    if (pickedRole === "admin") {
      if (!isOfficialAdminEmail(email) || !isReservedUsername(username)) {
        openAlert({
          icon: "🔒",
          iconClass: "danger",
          title: "Pendaftaran Admin Ditolak",
          desc: `Akun <b>Admin</b> sudah ditetapkan oleh sistem dan tidak bisa dibuat ulang.<br/><br/>
            Kalau kamu user biasa, silakan pilih role <b>User</b> di atas untuk mendaftar.`,
          btnText: "Pilih Role User",
          btnClass: "primary"
        });
        return;
      }
    } else {
      if (isAllowedAdminEmail(email) || isReservedUsername(username)) {
        openAlert({
          icon: "⚠️",
          iconClass: "warn",
          title: "Email atau Username Tidak Tersedia",
          desc: `Email atau username yang kamu masukkan tidak dapat dipakai untuk akun User.<br/><br/>
            Silakan gunakan email dan username lain untuk mendaftar.`,
          btnText: "Ganti Email/Username",
          btnClass: "primary"
        });
        return;
      }
    }

    btn.classList.add("loading");

    await sleep(900);

    const role = isAllowedAdminEmail(email) ? "admin" : "user";
    user = { name, username, email, role, joinedAt: new Date().toISOString() };
    // Buat account dulu tanpa PIN — setup 2FA opsional setelah ini
    const hashedPw = await hashPassword(password);
    localStorage.setItem(`playly-account-${email}`, JSON.stringify({ ...user, password: hashedPw }));
    localStorage.setItem("playly-user", JSON.stringify(user));
    // Track akun ini di device-list — signup dianggap sebagai login pertama.
    addDeviceAccount(user.email);
    state = defaultState();
    saveState();

    btn.classList.remove("loading");
    toast(`🎉 Akun dibuat! Selamat datang, <b>${name.split(" ")[0]}</b>!`, "success");

    // === Tawarin setup 2FA — opsional, bisa di-skip & diatur di Settings nanti ===
    const newPin = await openSetupPinModal({ context: "signup" });
    if (newPin) {
      const acc = JSON.parse(localStorage.getItem(`playly-account-${email}`) || "{}");
      acc.pin = hashPin(newPin);
      localStorage.setItem(`playly-account-${email}`, JSON.stringify(acc));
      toast("🔐 2FA aktif. PIN diminta saat login berikutnya.", "success");
    }

    bootDashboard();
  } catch (err) {
    console.error("[signup] error:", err);
    btn?.classList.remove("loading");
    toast(`⚠️ Gagal mendaftar: ${err?.message || "kesalahan tidak terduga"}`, "error");
  }
});

// Social login (Google/GitHub) sudah dihapus — Playly hanya pakai email/password.

// ----------------------- FORGOT PASSWORD FLOW -----------------------
// Modal reset password: minta email/username + password baru. Kalau akun
// ada di localStorage, password di-hash & disimpan, lockout di-clear.
function openForgotPwModal(prefillId = "") {
  const modal = $("#forgotPwModal");
  const form = $("#forgotPwForm");
  if (!modal || !form) return;
  form.reset();
  clearFieldErrors(form);
  if (prefillId) form.querySelector('input[name="email"]').value = prefillId;
  modal.classList.add("show");
  setTimeout(() => {
    const target = prefillId ? form.querySelector('input[name="password"]') : form.querySelector('input[name="email"]');
    target?.focus();
  }, 100);
}
function closeForgotPwModal() {
  $("#forgotPwModal")?.classList.remove("show");
}

$("#forgotPw")?.addEventListener("click", e => {
  e.preventDefault();
  // Pre-fill dari field email login kalau sudah diisi user
  const loginInput = $("#signinForm")?.querySelector('input[name="email"]');
  openForgotPwModal((loginInput?.value || "").trim().toLowerCase());
});

// Tombol close (x, backdrop, batal) di forgot-pw modal
$("#forgotPwModal")?.addEventListener("click", e => {
  if (e.target.matches("[data-close]")) closeForgotPwModal();
});

$("#forgotPwForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.target;
  clearFieldErrors(form);
  const fd = new FormData(form);
  const id = (fd.get("email") || "").trim().toLowerCase();
  const pw1 = fd.get("password");
  const pw2 = fd.get("password2");

  let hasError = false;
  if (!id) { showFieldError(form, "email", "Email atau username wajib diisi"); hasError = true; }
  if (!pw1) { showFieldError(form, "password", "Password baru wajib diisi"); hasError = true; }
  else if (pw1.length < 6) { showFieldError(form, "password", "Password minimal 6 karakter"); hasError = true; }
  if (!pw2) { showFieldError(form, "password2", "Konfirmasi password wajib diisi"); hasError = true; }
  else if (pw1 && pw1 !== pw2) { showFieldError(form, "password2", "Konfirmasi password tidak cocok"); hasError = true; }
  if (hasError) return;

  // Resolve identifier → existing account
  let existing = null;
  let email = id;
  if (id.includes("@")) {
    existing = JSON.parse(localStorage.getItem(`playly-account-${id}`) || "null");
  } else {
    const byUser = findAccountByUsername(id);
    if (byUser) { email = byUser.email.toLowerCase(); existing = byUser; }
  }
  if (!existing) {
    showFieldError(form, "email", "Akun tidak ditemukan");
    return;
  }

  // Hash password baru & simpan
  try {
    existing.password = await hashPassword(pw1);
    localStorage.setItem(`playly-account-${email}`, JSON.stringify(existing));
    // Reset rate limit & banner — supaya user langsung bisa login pakai password baru
    clearLoginAttempts(id);
    clearLoginAttempts(email);
    hideLockBanner();
    closeForgotPwModal();
    toast("🔑 Password berhasil di-reset. Silakan login dengan password baru.", "success");
    // Pre-fill identifier di form login supaya user langsung bisa login
    const loginInput = $("#signinForm")?.querySelector('input[name="email"]');
    if (loginInput) loginInput.value = id;
  } catch (err) {
    console.error("[forgot-pw] error:", err);
    toast("⚠️ Gagal reset password. Coba lagi.", "error");
  }
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// =================== DASHBOARD INIT =========================
// ============================================================

function renderAll() {
  renderHomeActivity();
  renderHomeTrending();
  renderHomeStats();
  renderLiveMetrics();
  renderTrendingHome();
  renderCreatorSpotlight();
  renderFeatured();
  renderCreators();
  renderFYP();
  renderPeople();
  renderActivityList();
  renderMsgList();
  renderTopPerforming();
  renderVideoGrid();
  renderUserStats();
  renderNotifications();
}

function initDashboard() {
  renderAll();
  startLiveClock();
  if (user.role === "admin") {
    renderAdminAll();
    // Log login event sekali per sesi browser saja — kalau cuma reload, jangan
    // tambahkan entry baru ke feed (kalau tidak akan flood "login ke control
    // panel" tiap kali admin pencet F5).
    const sessKey = `playly-admin-session-${user.username}`;
    if (!sessionStorage.getItem(sessKey)) {
      pushAdminEvent("🛡️", `Admin <b>${user.name}</b> login ke control panel`);
      sessionStorage.setItem(sessKey, String(Date.now()));
      renderAdminLiveFeed();
    }
    switchView("admin-dashboard");
  } else {
    switchView("home");
  }

  // Deep-link dari /watch?v=... → setelah login, langsung buka video itu di player.
  // Query param dibersihkan dari URL biar gak nyangkut saat reload.
  try {
    const params = new URLSearchParams(location.search);
    const wantVid = parseInt(params.get("v") || "", 10);
    if (wantVid && !Number.isNaN(wantVid)) {
      // Bersihkan query string tanpa reload halaman
      history.replaceState(null, "", location.pathname);
      // Beri jeda kecil supaya view "home"/"admin-dashboard" sempat render dulu
      setTimeout(() => {
        if (typeof openPlayer === "function") openPlayer(wantVid);
      }, 200);
    }
  } catch {}

  if (!localStorage.getItem(`playly-welcomed-${user.username}`)) {
    const msg = user.role === "admin"
      ? `🛡️ Selamat datang, Admin <b>${user.name.split(" ")[0]}</b>! Pantau & kelola platform di sini.`
      : `✨ Dashboard kamu siap! Mulai dari <b>Upload</b> video pertama.`;
    setTimeout(() => toast(msg, "success"), 700);
    localStorage.setItem(`playly-welcomed-${user.username}`, "1");
  }
}

// =================== ADMIN DATA LAYER (real-time, persisted) ===================

const ADMIN_KEYS = {
  mod: "playly-admin-mod",
  tickets: "playly-admin-tickets",
  bugs: "playly-admin-bugs",
  events: "playly-admin-events"
};

function getAllAccounts() {
  const accounts = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("playly-account-")) continue;
    try {
      const a = JSON.parse(localStorage.getItem(key));
      if (!a?.username) continue;
      // Defensive: jangan pernah tampilkan akun demo/mock — dashboard real-time only
      if (isDemoAccount(a)) continue;
      accounts.push(a);
    } catch {}
  }
  return accounts;
}

function getAdminData(key) {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEYS[key]) || "[]"); } catch { return []; }
}
function saveAdminData(key, arr) {
  localStorage.setItem(ADMIN_KEYS[key], JSON.stringify(arr));
}

function pushAdminEvent(ico, text) {
  const events = getAdminData("events");
  // Dedupe: kalau event teratas teks-nya sama persis & baru < 2 menit lalu, skip.
  // Cegah flood karena re-render / reload berulang.
  const top = events[0];
  if (top && top.text === text && (Date.now() - top.ts) < 120000) return;
  events.unshift({ id: Date.now() + Math.random(), ico, text, ts: Date.now() });
  // Keep last 50
  saveAdminData("events", events.slice(0, 50));
}

// Hapus key lama dari versi sebelumnya (tidak dipakai sejak revenue pakai ledger).
(function cleanupOldRevenueKey() {
  const FLAG = "playly-revenue-today-cleared-v1";
  if (localStorage.getItem(FLAG)) return;
  localStorage.removeItem("playly-revenue-today");
  localStorage.setItem(FLAG, "1");
})();

// One-time cleanup: kompres run "Admin login ke control panel" yang berurutan
// jadi 1 entry. Migrasi data dari sebelum fix dedupe.
(function compactAdminLoginEvents() {
  const FLAG = "playly-admin-events-compacted-v1";
  if (localStorage.getItem(FLAG)) return;
  try {
    const events = JSON.parse(localStorage.getItem("playly-admin-events") || "[]");
    if (!Array.isArray(events) || !events.length) {
      localStorage.setItem(FLAG, "1");
      return;
    }
    const out = [];
    for (const e of events) {
      const last = out[out.length - 1];
      const isLogin = e?.text && /login ke control panel/i.test(e.text);
      if (isLogin && last && last.text === e.text) continue; // skip duplicate run
      out.push(e);
    }
    localStorage.setItem("playly-admin-events", JSON.stringify(out));
    localStorage.setItem(FLAG, "1");
  } catch {
    localStorage.setItem(FLAG, "1");
  }
})();

function relTime(ts) {
  if (!ts) return "—";
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 5) return "baru saja";
  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff/60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff/3600)} jam lalu`;
  return `${Math.floor(diff/86400)} hari lalu`;
}

function fmtIDR(n) {
  if (n >= 1e9) return `Rp ${(n/1e9).toFixed(1)} M`;
  if (n >= 1e6) return `Rp ${(n/1e6).toFixed(1)} jt`;
  if (n >= 1e3) return `Rp ${(n/1e3).toFixed(0)}rb`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}
function fmtNum(n) {
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(1)}k`;
  return n.toLocaleString("id-ID");
}

// Admin data starts EMPTY — terisi otomatis dari aksi real (suspend user, approve video, dll.)
// Tidak ada lagi seed mock data (Rinaldi/Maharani/dll, demo tickets/bugs).
function seedAdminData() {
  // Tidak ada mock — semua array localStorage default kosong via getAdminData().
}

// =================== ADMIN PLATFORM METRICS ===================

function getAdminMetrics() {
  const accounts = getAllAccounts();
  const videos = getPlatformVideos();
  const totalViews = videos.reduce((s, v) => s + (v.viewsNum || 0), 0);
  // Revenue: hanya dari transaksi real yang tercatat di ledger.
  // Tidak ada rumus synthetic — sampai ada payment integration, revenue = 0.
  const revenue = computeRevenueFromLedger().total;

  const mod = getAdminData("mod").filter(m => m.status === "pending").length;
  const tickets = getAdminData("tickets").filter(t => t.status === "new").length;
  const ticketsProgress = getAdminData("tickets").filter(t => t.status === "progress").length;
  const ticketsResolved = getAdminData("tickets").filter(t => t.status === "resolved").length;
  const bugs = getAdminData("bugs").filter(b => b.status !== "closed").length;
  const bugsCritical = getAdminData("bugs").filter(b => (b.sev === "critical" || b.sev === "high") && b.status !== "closed").length;

  // New users in last 24h
  const oneDayAgo = Date.now() - 86400000;
  const newUsers24h = accounts.filter(a => {
    const t = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
    return t >= oneDayAgo;
  }).length;

  return { accounts, videos, totalViews, revenue, mod, tickets, ticketsProgress, ticketsResolved, bugs, bugsCritical, newUsers24h };
}

// =================== ADMIN RENDERERS ===================

let adminRefreshTimer = null;
let adminSimTimer = null;

function renderAdminAll() {
  seedAdminData();
  renderAdminKPI();
  renderAdminLiveFeed();
  renderAdminAlerts();
  renderAdminUsers();
  renderAdminVideos();
  renderAdminModeration();
  renderAdminTickets();
  renderAdminBugs();
  renderAdminInbox();
  renderAdminRevenue();
  renderAdminTopInsights();
  syncAdminNavBadges();
  setupAdminEvents();
  setupAdminCrossTabSync();
  startAdminLiveRefresh();
  startAdminEventSimulator();
}

// =================== ADMIN: TOP INSIGHTS (dashboard panel) ===================
function renderAdminTopInsights() {
  if (!$("#adminTopVideosLive")) return;
  const m = getAdminMetrics();
  // Filter admin dari pool — dashboard fokus pada aktivitas USER, bukan akun admin
  const accounts = (m.accounts || []).filter(a => a.role !== "admin");
  const videos = (m.videos || []).filter(v => v.creator && !isAdminUsername(v.creator));

  // Top Performing Videos — combined ranking by views + likes (sort by total engagement)
  // Score = viewsNum + likes*5 (likes lebih bernilai dari sekedar view)
  const topVids = [...videos]
    .map(v => ({ ...v, _score: (v.viewsNum || 0) + (v.likes || 0) * 5 }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);
  $("#adminTopVideosLive").innerHTML = topVids.length ? topVids.map((v, i) => `
    <div class="admin-list-row" data-open-video="${v.id}" title="Tonton video">
      <span class="rank">#${i + 1}</span>
      <div>
        <strong>${escapeHtml(v.title)}</strong>
        <small>@${escapeHtml(v.creator)} • ${v.duration || "0:00"}</small>
      </div>
      <b style="display:flex;gap:14px;align-items:center;white-space:nowrap">
        <span title="Views">👁️ ${fmtNum(v.viewsNum || 0)}</span>
        <span title="Likes">♥ ${fmtNum(v.likes || 0)}</span>
      </b>
    </div>
  `).join("") : `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Belum ada video.</div>`;
  $$("[data-open-video]", $("#adminTopVideosLive")).forEach(b => {
    b.addEventListener("click", () => {
      const vid = Number(b.dataset.openVideo);
      if (vid && typeof openPlayer === "function") openPlayer(vid);
    });
  });

  // Recent Uploads (video baru di-upload) — sort by id (=Date.now() saat upload)
  const recentVids = [...videos].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5);
  const rvEl = $("#adminRecentVideosLive");
  if (rvEl) {
    rvEl.innerHTML = recentVids.length ? recentVids.map(v => {
      const uploaded = v.id ? relTime(v.id) : "—";
      return `
        <div class="admin-list-row" data-open-video="${v.id}" title="Tonton video">
          <span class="rank" style="font-size:18px">🎬</span>
          <div>
            <strong>${escapeHtml(v.title)}</strong>
            <small>@${escapeHtml(v.creator)} • ${uploaded}</small>
          </div>
          <b style="font-size:11px;color:var(--muted);font-weight:600">${fmtNum(v.viewsNum || 0)} views</b>
        </div>
      `;
    }).join("") : `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Belum ada video di-upload.</div>`;
    $$("[data-open-video]", rvEl).forEach(b => {
      b.addEventListener("click", () => {
        const vid = Number(b.dataset.openVideo);
        if (vid && typeof openPlayer === "function") openPlayer(vid);
      });
    });
  }

  // Top 5 creators by total views (sudah filter admin di videos)
  const creatorMap = {};
  videos.forEach(v => {
    if (!v.creator) return;
    creatorMap[v.creator] = creatorMap[v.creator] || { name: v.creator, videos: 0, views: 0 };
    creatorMap[v.creator].videos++;
    creatorMap[v.creator].views += v.viewsNum || 0;
  });
  const topCreators = Object.values(creatorMap).sort((a, b) => b.views - a.views).slice(0, 5);
  $("#adminTopCreatorsLive").innerHTML = topCreators.length ? topCreators.map((c, i) => `
    <div class="admin-list-row" style="cursor:pointer" data-open-user="${escapeHtml(c.name)}">
      <span class="rank">#${i + 1}</span>
      <div>
        <strong>@${escapeHtml(c.name)}</strong>
        <small>${c.videos} video</small>
      </div>
      <b>${fmtNum(c.views)} views</b>
    </div>
  `).join("") : `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Belum ada kreator aktif.</div>`;
  $$("[data-open-user]", $("#adminTopCreatorsLive")).forEach(b => {
    b.addEventListener("click", () => openUserDetail(b.dataset.openUser));
  });

  // Recent users (5 terbaru, BUKAN admin) — sort by joinedAt
  const recentUsers = [...accounts]
    .sort((a, b) => new Date(b.joinedAt || 0) - new Date(a.joinedAt || 0))
    .slice(0, 5);
  $("#adminRecentUsersLive").innerHTML = recentUsers.length ? recentUsers.map(a => {
    const init = (a.name || a.username || "U").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
    const joined = a.joinedAt ? relTime(new Date(a.joinedAt).getTime()) : "—";
    return `
      <div class="admin-list-row" style="cursor:pointer" data-open-user="${escapeHtml(a.username)}">
        <span class="rank" style="font-size:11px">${init}</span>
        <div>
          <strong>${escapeHtml(a.name || a.username)}</strong>
          <small>@${escapeHtml(a.username)} • ${joined}</small>
        </div>
        <b style="font-size:10px;color:var(--muted);font-weight:600">USER</b>
      </div>
    `;
  }).join("") : `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Belum ada user terdaftar.</div>`;
  $$("[data-open-user]", $("#adminRecentUsersLive")).forEach(b => {
    b.addEventListener("click", () => openUserDetail(b.dataset.openUser));
  });

  // Live Activity Stream — gabungan event signup + upload
  renderAdminLiveActivity(accounts, videos);

  // Trend 7 hari terakhir — bar chart upload count per hari
  renderAdminTrend(videos);

  // Ringkasan hari ini
  renderAdminTodaySummary(m, accounts, videos);
}

// Helper: cek apakah username adalah admin (defensive — admin tidak boleh muncul di feed user)
function isAdminUsername(username) {
  if (!username) return false;
  if (typeof OFFICIAL_ADMIN_USERNAME !== "undefined" && username === OFFICIAL_ADMIN_USERNAME) return true;
  // Fallback: cek di accounts
  try {
    const accounts = getAllAccounts();
    return accounts.some(a => a.username === username && a.role === "admin");
  } catch { return false; }
}

function renderAdminLiveActivity(accounts, videos) {
  const list = $("#adminLiveActivity"); if (!list) return;

  const events = [];
  // Event: video upload
  for (const v of videos) {
    if (!v.id) continue;
    events.push({
      type: "upload",
      ts: v.id,
      icon: "🎬",
      text: `<b>@${escapeHtml(v.creator || "—")}</b> upload video <i>"${escapeHtml((v.title || "").slice(0, 60))}${(v.title || "").length > 60 ? "..." : ""}"</i>`,
      onClick: () => { if (typeof openPlayer === "function") openPlayer(v.id); }
    });
  }
  // Event: user signup
  for (const a of accounts) {
    if (!a.joinedAt) continue;
    const ts = new Date(a.joinedAt).getTime();
    if (!ts) continue;
    events.push({
      type: "signup",
      ts,
      icon: "👤",
      text: `<b>@${escapeHtml(a.username)}</b> ${escapeHtml(a.name || "")} bergabung sebagai <i>${(a.role || "user")}</i>`,
      onClick: () => { if (typeof openUserDetail === "function") openUserDetail(a.username); }
    });
  }
  // Event: like milestone — kalau ada video dengan likes >= 10, anggap "trending"
  for (const v of videos) {
    if ((v.likes || 0) >= 10) {
      events.push({
        type: "like",
        ts: (v.id || 0) + 1, // urut sedikit setelah upload
        icon: "❤️",
        text: `Video <i>"${escapeHtml((v.title || "").slice(0, 50))}"</i> dari <b>@${escapeHtml(v.creator || "—")}</b> mencapai <b>${fmtNum(v.likes)}</b> likes`,
        onClick: () => { if (typeof openPlayer === "function") openPlayer(v.id); }
      });
    }
  }

  events.sort((a, b) => b.ts - a.ts);
  const top = events.slice(0, 30);

  if (!top.length) {
    list.innerHTML = `<div style="text-align:center;padding:32px 16px;color:var(--muted)">
      <div style="font-size:36px;opacity:.55;margin-bottom:8px">⏳</div>
      <p style="font-size:13px">Belum ada aktivitas user. Aktivitas akan muncul real-time setelah ada user signup atau upload video.</p>
    </div>`;
    return;
  }

  list.innerHTML = top.map((e, i) => `
    <div class="activity-row ${e.type}" data-act-idx="${i}" title="Klik untuk detail">
      <div class="activity-icon">${e.icon}</div>
      <div class="activity-text">${e.text}</div>
      <small class="activity-time" title="${new Date(e.ts).toLocaleString("id-ID")}">${chatRelTime(e.ts) || relTime(e.ts) || "—"}</small>
    </div>
  `).join("");

  list.querySelectorAll("[data-act-idx]").forEach(el => {
    const idx = Number(el.dataset.actIdx);
    const ev = top[idx];
    if (ev?.onClick) el.addEventListener("click", ev.onClick);
  });
}

function renderAdminTrend(videos) {
  const ID_DAYS_SHORT_LOCAL = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const count = videos.filter(v => {
      const t = v.id || 0; // id = Date.now() saat upload
      return t >= d.getTime() && t < next.getTime();
    }).length;
    // Tambah simulasi engagement biar bar tidak kosong total
    const value = count * 5 + ((d.getDate() * 7) % 12);
    days.push({ label: ID_DAYS_SHORT_LOCAL[d.getDay()], count, value });
  }
  const max = Math.max(...days.map(d => d.value), 1);
  const chart = $("#adminTrendChart");
  if (!chart) return;
  chart.innerHTML = days.map(d => {
    const pct = (d.value / max) * 100;
    return `<div class="rev-bar">
      <span class="bar-value">${d.count > 0 ? d.count : ""}</span>
      <div class="bar-fill" style="height: calc(${pct}% - 24px)"></div>
      <span class="bar-label">${d.label}</span>
    </div>`;
  }).join("");
}

function renderAdminTodaySummary(m, accounts, videos) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const uploadsToday = videos.filter(v => (v.id || 0) >= todayMs).length;
  const usersToday = accounts.filter(a => new Date(a.joinedAt || 0).getTime() >= todayMs).length;
  const totalViewsToday = Math.floor((m.totalViews || 0) * 0.05);
  const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
  const likesToday = Math.floor(totalLikes * 0.08);
  const reportsToday = (getAdminData("mod") || []).filter(x => (x.reportedAt || 0) >= todayMs).length;
  const ticketsToday = (getAdminData("tickets") || []).filter(x => (x.createdAt || 0) >= todayMs).length;

  const setSum = (id, n) => {
    const el = $("#" + id);
    if (!el) return;
    el.textContent = fmtNum(n);
    el.classList.toggle("zero", n === 0);
  };
  setSum("sumUploadsToday", uploadsToday);
  setSum("sumUsersToday", usersToday);
  setSum("sumViewsToday", totalViewsToday);
  setSum("sumLikesToday", likesToday);
  setSum("sumReportsToday", reportsToday);
  setSum("sumTicketsToday", ticketsToday);
}

// =================== ADMIN: AD MANAGER ===================
// Setiap section (running text / banner / pre-roll) mendukung BANYAK item.
// Player memilih satu item per video sesuai mode rotasi (random/sequential),
// atau menampilkan semua sekaligus untuk running text. Pre-roll blob disimpan
// per-id di IndexedDB. Auto-save: tidak ada tombol Simpan global.

const AD_CONFIG_KEY = "playly-ad-config";
const AD_PREROLL_BLOB_PREFIX = "__ad_preroll_";   // + id
const AD_PREROLL_LEGACY_ID  = "__ad_preroll__";   // single-item lama

function adUid() { return "ad_" + Math.random().toString(36).slice(2, 10); }
function prerollBlobId(id) { return AD_PREROLL_BLOB_PREFIX + id; }
function adCap(s) { return s[0].toUpperCase() + s.slice(1); }

function defaultRtItem() {
  return {
    id: adUid(), name: "", enabled: true,
    text: "", position: "bottom", speed: 80,
    textColor: "#ffffff", bgColor: "#000000", bgOpacity: 70,
    fontFamily: "Inter", fontSize: 14, fontWeight: 600,
    italic: false, padding: 8
  };
}
function defaultBnItem() {
  return {
    id: adUid(), name: "", enabled: true,
    imageUrl: "", linkUrl: "",
    position: "bottom-right", showAfterSec: 3, closable: true,
    size: "medium", radius: 12, shadow: true, animation: "fade"
  };
}
function defaultPrItem() {
  return {
    id: adUid(), name: "", enabled: true,
    // mediaType: "video" | "image" — pre-roll bisa video atau gambar
    mediaType: "video",
    videoUrl: "", hasBlob: false,
    imageUrl: "",
    durationSec: 5,           // durasi tampil image (detik); video pakai durasi file-nya
    linkUrl: "",              // klik iklan → buka URL ini di tab baru (opsional)
    skippable: true, skipAfterSec: 5
  };
}

function defaultAdConfig() {
  return {
    runningText: { rotation: "random", items: [] },
    banner:      { rotation: "random", items: [] },
    preroll:     { rotation: "random", items: [] }
  };
}

// Migrasi config lama (1 object per section) → format array.
// Juga isi field baru (font, size, animation, dll) ke item lama via merge default.
function migrateAdConfig(c) {
  function defaultsFor(type) {
    if (type === "rt") return defaultRtItem();
    if (type === "bn") return defaultBnItem();
    return defaultPrItem();
  }
  function fillDefaults(it, type) {
    const def = defaultsFor(type);
    // Default dulu, lalu timpa dengan value yang sudah ada di item.
    // ID asli & nama dipertahankan.
    return { ...def, ...it, id: it.id || def.id };
  }
  function asList(section, type) {
    if (Array.isArray(section?.items)) {
      return {
        rotation: section.rotation || "random",
        items: section.items.map(it => fillDefaults(it, type))
      };
    }
    if (section && typeof section === "object" && "enabled" in section) {
      const hasContent = type === "rt" ? !!section.text
                       : type === "bn" ? !!section.imageUrl
                       : !!(section.videoUrl || section.hasBlob);
      if (hasContent) {
        const base = defaultsFor(type);
        const item = { ...base, ...section, id: base.id, name: section.name || "Iklan #1" };
        return { rotation: "random", items: [item] };
      }
    }
    return { rotation: "random", items: [] };
  }
  return {
    runningText: asList(c?.runningText, "rt"),
    banner:      asList(c?.banner,      "bn"),
    preroll:     asList(c?.preroll,     "pr")
  };
}

function getAdConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(AD_CONFIG_KEY) || "null");
    if (!c) return defaultAdConfig();
    return migrateAdConfig(c);
  } catch { return defaultAdConfig(); }
}

function saveAdConfig(cfg) {
  try {
    localStorage.setItem(AD_CONFIG_KEY, JSON.stringify(cfg));
  } catch (e) {
    toast("⚠ Gagal menyimpan: storage penuh. Hapus banner besar atau pakai URL.", "error");
    throw e;
  }
}

// ----------------------- DEMO AD SEED (jalan sekali per browser) -----------------------
// Mengisi config dengan iklan contoh supaya admin & user bisa langsung lihat
// pre-roll, banner, dan running text di video player. Hanya jalan kalau:
//   1. Belum pernah di-seed (flag localStorage), DAN
//   2. Config saat ini benar-benar kosong di semua section (admin tidak hilang
//      kontrol kalau sudah pernah set ad sendiri).
const AD_SEED_FLAG = "playly-ads-seeded-v1";

// Banner SVG inline — pakai data URI URL-encoded standar (tanpa ;utf8 yang
// non-standard). Reliable di Chrome/Edge/Firefox/Safari.
function svgDataUri(svg) {
  // Hapus whitespace berlebih untuk URL lebih pendek
  const cleaned = svg.trim().replace(/\s+/g, " ").replace(/>\s+</g, "><");
  return "data:image/svg+xml," + encodeURIComponent(cleaned);
}

const DEMO_BANNER_PROMO = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#561C24"/>
      <stop offset="100%" stop-color="#1a0c10"/>
    </linearGradient>
  </defs>
  <rect width="600" height="200" fill="url(#g1)"/>
  <circle cx="540" cy="40" r="80" fill="#c8965a" opacity="0.18"/>
  <circle cx="60" cy="170" r="60" fill="#6D2932" opacity="0.10"/>
  <text x="40" y="70" font-family="Inter, sans-serif" font-size="14" font-weight="700" fill="#c8965a" letter-spacing="3">PROMO SPESIAL</text>
  <text x="40" y="118" font-family="Inter, sans-serif" font-size="40" font-weight="900" fill="#fff">PLAYLY PREMIUM</text>
  <text x="40" y="148" font-family="Inter, sans-serif" font-size="22" font-weight="700" fill="#6D2932">Diskon 50% - Bulan Ini Saja</text>
  <text x="40" y="178" font-family="Inter, sans-serif" font-size="13" fill="#E8D8C4">Klik untuk upgrade</text>
</svg>`);

const DEMO_BANNER_SPONSOR = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="600" height="200" fill="url(#g2)"/>
  <rect x="40" y="40" width="80" height="80" rx="16" fill="#3b82f6"/>
  <text x="80" y="93" font-family="Inter, sans-serif" font-size="36" font-weight="900" fill="#fff" text-anchor="middle">B</text>
  <text x="140" y="78" font-family="Inter, sans-serif" font-size="12" font-weight="700" fill="#93c5fd" letter-spacing="2">SPONSORED</text>
  <text x="140" y="108" font-family="Inter, sans-serif" font-size="26" font-weight="800" fill="#fff">BrandX Studio</text>
  <text x="140" y="135" font-family="Inter, sans-serif" font-size="13" fill="#cbd5e1">Solusi kreatif untuk konten kamu</text>
  <text x="140" y="165" font-family="Inter, sans-serif" font-size="12" fill="#93c5fd">brandx.example.com</text>
</svg>`);

function seedDefaultAds() {
  if (localStorage.getItem(AD_SEED_FLAG)) return;
  const cur = getAdConfig();
  const isEmpty =
    cur.runningText.items.length === 0 &&
    cur.banner.items.length === 0 &&
    cur.preroll.items.length === 0;
  if (!isEmpty) {
    // Admin sudah set sendiri — set flag tapi jangan timpa
    localStorage.setItem(AD_SEED_FLAG, "1");
    return;
  }

  const seeded = {
    runningText: {
      rotation: "random",
      items: [
        { ...defaultRtItem(), name: "Promo Bulanan",
          text: "🎉 Promo Spesial Bulan Ini — Diskon 50% untuk Playly Premium! Klik banner untuk info →",
          position: "bottom", speed: 90, textColor: "#ffffff", bgColor: "#561C24", bgOpacity: 75 },
        { ...defaultRtItem(), name: "Follow Sosmed",
          text: "📲 Follow @playlyofficial di Instagram & TikTok untuk update video viral terbaru!",
          position: "top", speed: 75, textColor: "#1a0c10", bgColor: "#c8965a", bgOpacity: 90 }
      ]
    },
    banner: {
      rotation: "random",
      items: [
        { ...defaultBnItem(), name: "Playly Premium",
          imageUrl: DEMO_BANNER_PROMO, linkUrl: "https://playly.app/premium",
          position: "bottom-right", showAfterSec: 3, closable: true },
        { ...defaultBnItem(), name: "Sponsor BrandX",
          imageUrl: DEMO_BANNER_SPONSOR, linkUrl: "https://brandx.example.com",
          position: "top-right", showAfterSec: 8, closable: true }
      ]
    },
    preroll: {
      rotation: "random",
      items: [
        { ...defaultPrItem(), name: "Sponsor 15 detik",
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          skippable: true, skipAfterSec: 5 },
        { ...defaultPrItem(), name: "Sponsor 15 detik (alt)",
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
          skippable: true, skipAfterSec: 3 }
      ]
    }
  };

  saveAdConfig(seeded);
  localStorage.setItem(AD_SEED_FLAG, "1");
}

// Force-clear ad config sekali per browser supaya admin mulai dari kosong.
// Demo seed data (Promo Bulanan, BrandX, dll) dibersihkan — admin isi manual.
// Flag ikut sync ke Supabase, jadi cukup satu browser run untuk semua device.
const AD_RESET_FLAG = "playly-ad-reset-v20260430";
if (!localStorage.getItem(AD_RESET_FLAG)) {
  localStorage.setItem(AD_CONFIG_KEY, JSON.stringify(defaultAdConfig()));
  localStorage.setItem(AD_RESET_FLAG, "1");
  // Tandai juga seed flag biar seedDefaultAds() future tidak isi ulang
  localStorage.setItem(AD_SEED_FLAG, "1");
}

function adSection(cfg, type) {
  return type === "rt" ? cfg.runningText : type === "bn" ? cfg.banner : cfg.preroll;
}

function adItemHasContent(type, it) {
  if (type === "rt") return !!(it.text && it.text.trim());
  if (type === "bn") return !!it.imageUrl;
  if (type === "pr") {
    if (it.mediaType === "image") return !!it.imageUrl;
    return !!(it.videoUrl || it.hasBlob);
  }
  return false;
}

// File helpers
function readImageFileAsDataURL(file, maxSize = 500 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file"));
    if (file.size > maxSize) {
      const mb = Math.round(maxSize / (1024 * 1024));
      return reject(new Error(`File terlalu besar (max ${mb}MB)`));
    }
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
async function savePrerollItemBlob(id, file) {
  if (file.size > 500 * 1024 * 1024) throw new Error("Video terlalu besar (max 500MB)");
  await saveVideoBlob(prerollBlobId(id), file);
}
async function getPrerollItemBlobUrl(id) {
  const blob = await getVideoBlob(prerollBlobId(id));
  return blob ? URL.createObjectURL(blob) : null;
}
async function deletePrerollBlob(id) {
  try {
    const db = await openVideoDB();
    const tx = db.transaction(VIDEO_STORE, "readwrite");
    tx.objectStore(VIDEO_STORE).delete(prerollBlobId(id));
  } catch {}
}

// ----------- Render -----------
function loadAdManagerForm() {
  if (!$("#adRtList")) return;
  const cfg = getAdConfig();
  if ($("#adRtRotation")) $("#adRtRotation").value = cfg.runningText.rotation;
  if ($("#adBnRotation")) $("#adBnRotation").value = cfg.banner.rotation;
  if ($("#adPrRotation")) $("#adPrRotation").value = cfg.preroll.rotation;
  renderAdItems("rt");
  renderAdItems("bn");
  renderAdItems("pr");
}

function renderAdItems(type) {
  const list = $(`#ad${adCap(type)}List`);
  const empty = $(`#ad${adCap(type)}Empty`);
  const count = $(`#ad${adCap(type)}Count`);
  if (!list) return;
  const cfg = getAdConfig();
  const items = adSection(cfg, type).items;
  list.innerHTML = "";
  if (count) count.textContent = items.length;
  if (!items.length) { if (empty) empty.hidden = false; return; }
  if (empty) empty.hidden = true;
  items.forEach((it, idx) => list.appendChild(renderAdItemCard(type, it, idx)));
}

function renderAdItemCard(type, item, idx) {
  const div = document.createElement("div");
  div.className = "ad-item";
  div.dataset.type = type;
  div.dataset.id = item.id;
  if (type === "pr") div.dataset.mediaType = item.mediaType === "image" ? "image" : "video";
  if (!item.enabled) div.classList.add("disabled");
  const placeholder = type === "rt" ? "Misal: Promo Liburan" : type === "bn" ? "Misal: Banner 18Toto" : "Misal: Pre-roll Sponsor A";
  div.innerHTML = `
    <div class="ad-item-head">
      <button type="button" class="ad-item-toggle" title="Expand">▸</button>
      <span class="ad-item-num">#${idx + 1}</span>
      <input class="ad-item-name" type="text" value="${escapeHtml(item.name || "")}" placeholder="${placeholder}" data-field="name"/>
      <span class="ad-item-summary muted">${adItemSummary(type, item)}</span>
      <label class="ad-toggle ad-toggle-mini" title="${item.enabled ? "Aktif" : "Nonaktif"}">
        <input type="checkbox" class="ad-item-enabled" data-field="enabled" ${item.enabled ? "checked" : ""}/>
        <span class="ad-toggle-track"><span class="ad-toggle-thumb"></span></span>
      </label>
      <button type="button" class="ad-item-del icon-btn-tiny" title="Hapus iklan">🗑</button>
    </div>
    <div class="ad-item-body" hidden>${adItemFormHtml(type, item)}</div>
  `;
  return div;
}

function adItemSummary(type, it) {
  if (type === "rt") {
    const t = (it.text || "").slice(0, 50);
    if (!t) return "<i>belum ada teks</i>";
    return `"${escapeHtml(t)}${it.text.length > 50 ? "…" : ""}" • ${it.position} • ${it.speed}px/dtk`;
  }
  if (type === "bn") {
    if (!it.imageUrl) return "<i>belum ada gambar</i>";
    const src = it.imageUrl.startsWith("data:") ? "📁 file" : "🔗 URL";
    return `${src} • ${it.position} • muncul ${it.showAfterSec}s`;
  }
  if (type === "pr") {
    const isImg = it.mediaType === "image";
    if (isImg) {
      if (!it.imageUrl) return "<i>belum ada gambar</i>";
      const src = it.imageUrl.startsWith("data:") ? "📁 file" : "🔗 URL";
      return `🖼️ ${src}`;
    }
    const linkBadge = it.linkUrl ? " • 🔗 klik" : "";
    if (it.hasBlob) return `🎬 📁 video tersimpan • skip ${it.skipAfterSec}s${linkBadge}`;
    if (it.videoUrl) return `🎬 🔗 URL • skip ${it.skipAfterSec}s${linkBadge}`;
    return "<i>belum ada video</i>";
  }
  return "";
}

// Sync inline-style preview di running text item saat field berubah
function refreshRtPreview(itemEl, id) {
  const cfg = getAdConfig();
  const it = cfg.runningText.items.find(x => x.id === id);
  if (!it) return;
  const box = itemEl.querySelector(".ad-rt-preview-box");
  if (!box) return;
  box.style.background = hexToRgba(it.bgColor || "#000", (it.bgOpacity || 70) / 100);
  box.style.color = it.textColor || "#fff";
  box.style.fontFamily = `${it.fontFamily || "Inter"}, sans-serif`;
  box.style.fontSize = `${it.fontSize || 14}px`;
  box.style.fontWeight = it.fontWeight || 600;
  box.style.fontStyle = it.italic ? "italic" : "normal";
  box.style.padding = `${it.padding != null ? it.padding : 8}px 12px`;
  box.textContent = it.text || "Pesan iklan akan tampil seperti ini.";
}

function adItemFormHtml(type, it) {
  if (type === "rt") {
    const fontFamily = it.fontFamily || "Inter";
    const fontSize = it.fontSize || 14;
    const fontWeight = it.fontWeight || 600;
    const padding = it.padding != null ? it.padding : 8;
    return `
    <section class="ad-section-block">
      <header class="ad-section-block-head">
        <span class="ad-section-block-icon">📝</span>
        <span class="ad-section-block-title">Teks Iklan</span>
      </header>
      <label class="ad-field">
        <input type="text" maxlength="200" value="${escapeHtml(it.text || "")}" data-field="text" placeholder="Pesan iklan yang akan berjalan di player..."/>
        <small class="ad-form-hint">💡 Teks otomatis berjalan terus-menerus sampai video selesai. Cukup tulis sekali — tidak perlu di-copy berulang.</small>
      </label>
    </section>

    <section class="ad-section-block">
      <header class="ad-section-block-head">
        <span class="ad-section-block-icon">🎯</span>
        <span class="ad-section-block-title">Posisi & Gerakan</span>
      </header>
      <div class="ad-form-row cols-3">
        <label class="ad-field">
          <span class="ad-field-label">Posisi</span>
          <select data-field="position">
            <option value="top" ${it.position === "top" ? "selected" : ""}>Atas</option>
            <option value="middle" ${it.position === "middle" ? "selected" : ""}>Tengah</option>
            <option value="bottom" ${it.position === "bottom" ? "selected" : ""}>Bawah</option>
          </select>
        </label>
        <label class="ad-field">
          <span class="ad-field-label">Kecepatan <em data-label="speed">${it.speed} px/dtk</em></span>
          <input type="range" min="20" max="200" value="${it.speed}" data-field="speed"/>
        </label>
        <label class="ad-field">
          <span class="ad-field-label">Tinggi bar <em data-label="padding">${padding}px</em></span>
          <input type="range" min="4" max="24" value="${padding}" data-field="padding"/>
        </label>
      </div>
    </section>

    <section class="ad-section-block">
      <header class="ad-section-block-head">
        <span class="ad-section-block-icon">🎨</span>
        <span class="ad-section-block-title">Warna</span>
      </header>
      <div class="ad-form-row cols-3">
        <label class="ad-field">
          <span class="ad-field-label">Warna teks</span>
          <input type="color" value="${it.textColor}" data-field="textColor"/>
        </label>
        <label class="ad-field">
          <span class="ad-field-label">Warna latar</span>
          <input type="color" value="${it.bgColor}" data-field="bgColor"/>
        </label>
        <label class="ad-field">
          <span class="ad-field-label">Opasitas latar <em data-label="bgOpacity">${it.bgOpacity}%</em></span>
          <input type="range" min="0" max="100" value="${it.bgOpacity}" data-field="bgOpacity"/>
        </label>
      </div>
    </section>

    <section class="ad-section-block">
      <header class="ad-section-block-head">
        <span class="ad-section-block-icon">✏️</span>
        <span class="ad-section-block-title">Tipografi</span>
      </header>
      <div class="ad-form-row cols-4">
        <label class="ad-field">
          <span class="ad-field-label">Font</span>
          <select data-field="fontFamily">
            <option value="Inter" ${fontFamily === "Inter" ? "selected" : ""}>Inter (Default)</option>
            <option value="'Plus Jakarta Sans'" ${fontFamily === "'Plus Jakarta Sans'" ? "selected" : ""}>Plus Jakarta Sans</option>
            <option value="'JetBrains Mono'" ${fontFamily === "'JetBrains Mono'" ? "selected" : ""}>JetBrains Mono</option>
            <option value="Arial, sans-serif" ${fontFamily === "Arial, sans-serif" ? "selected" : ""}>Arial</option>
            <option value="Georgia, serif" ${fontFamily === "Georgia, serif" ? "selected" : ""}>Georgia (Serif)</option>
            <option value="'Times New Roman', serif" ${fontFamily === "'Times New Roman', serif" ? "selected" : ""}>Times New Roman</option>
            <option value="'Courier New', monospace" ${fontFamily === "'Courier New', monospace" ? "selected" : ""}>Courier New</option>
            <option value="'Comic Sans MS', cursive" ${fontFamily === "'Comic Sans MS', cursive" ? "selected" : ""}>Comic Sans</option>
            <option value="Impact, sans-serif" ${fontFamily === "Impact, sans-serif" ? "selected" : ""}>Impact</option>
          </select>
        </label>
        <label class="ad-field">
          <span class="ad-field-label">Ukuran <em data-label="fontSize">${fontSize}px</em></span>
          <input type="range" min="10" max="32" value="${fontSize}" data-field="fontSize"/>
        </label>
        <label class="ad-field">
          <span class="ad-field-label">Tebal</span>
          <select data-field="fontWeight">
            <option value="400" ${fontWeight == 400 ? "selected" : ""}>Normal</option>
            <option value="500" ${fontWeight == 500 ? "selected" : ""}>Medium</option>
            <option value="600" ${fontWeight == 600 ? "selected" : ""}>Semibold</option>
            <option value="700" ${fontWeight == 700 ? "selected" : ""}>Bold</option>
            <option value="800" ${fontWeight == 800 ? "selected" : ""}>Extra Bold</option>
          </select>
        </label>
        <label class="ad-checkbox-label ad-field-checkbox">
          <input type="checkbox" data-field="italic" ${it.italic ? "checked" : ""}/>
          <span>Italic / Miring</span>
        </label>
      </div>
    </section>

    <section class="ad-section-block ad-section-preview">
      <header class="ad-section-block-head">
        <span class="ad-section-block-icon">👁</span>
        <span class="ad-section-block-title">Preview</span>
      </header>
      <div class="ad-rt-preview-box" style="
        background: ${hexToRgba(it.bgColor || "#000", (it.bgOpacity || 70)/100)};
        color: ${it.textColor || "#fff"};
        font-family: ${fontFamily}, sans-serif;
        font-size: ${fontSize}px;
        font-weight: ${fontWeight};
        font-style: ${it.italic ? "italic" : "normal"};
        padding: ${padding}px 12px;
      ">${escapeHtml(it.text || "Pesan iklan akan tampil seperti ini.")}</div>
    </section>
  `;
  }
  if (type === "bn") {
    const previewHtml = it.imageUrl
      ? `<img src="${it.imageUrl}" alt="banner preview"/>`
      : `<span class="muted">Belum ada gambar</span>`;
    const urlVal = it.imageUrl?.startsWith("data:") ? "" : (it.imageUrl || "");
    return `
      <section class="ad-section-block">
        <header class="ad-section-block-head">
          <span class="ad-section-block-icon">🖼️</span>
          <span class="ad-section-block-title">Konten Banner</span>
        </header>
        <div class="ad-upload-row">
          <div class="ad-thumb-preview" data-preview="image">${previewHtml}</div>
          <div class="ad-upload-actions">
            <label class="btn ghost small ad-upload-btn">
              📁 Upload Gambar
              <input type="file" accept="image/*" hidden data-action="upload-image"/>
            </label>
            <button type="button" class="btn ghost small" data-action="clear-image">🗑 Hapus</button>
            <small class="muted-mini">PNG/JPG, maks 500MB.</small>
          </div>
        </div>
        <div class="ad-form-row cols-2">
          <label class="ad-field">
            <span class="ad-field-label">Atau URL gambar</span>
            <input type="url" data-field="imageUrl" value="${escapeHtml(urlVal)}" placeholder="https://example.com/banner.png"/>
          </label>
          <label class="ad-field">
            <span class="ad-field-label">Link saat di-klik <em>(opsional)</em></span>
            <input type="url" data-field="linkUrl" value="${escapeHtml(it.linkUrl || "")}" placeholder="https://example.com/promo"/>
          </label>
        </div>
      </section>

      <section class="ad-section-block">
        <header class="ad-section-block-head">
          <span class="ad-section-block-icon">🎯</span>
          <span class="ad-section-block-title">Posisi & Waktu</span>
        </header>
        <div class="ad-form-row cols-3">
          <label class="ad-field">
            <span class="ad-field-label">Posisi</span>
            <select data-field="position">
              <option value="top-left" ${it.position === "top-left" ? "selected" : ""}>Kiri Atas</option>
              <option value="top-right" ${it.position === "top-right" ? "selected" : ""}>Kanan Atas</option>
              <option value="bottom-left" ${it.position === "bottom-left" ? "selected" : ""}>Kiri Bawah</option>
              <option value="bottom-right" ${it.position === "bottom-right" ? "selected" : ""}>Kanan Bawah</option>
            </select>
          </label>
          <label class="ad-field">
            <span class="ad-field-label">Muncul setelah <em data-label="showAfterSec">${it.showAfterSec} detik</em></span>
            <input type="range" min="0" max="30" value="${it.showAfterSec}" data-field="showAfterSec"/>
          </label>
          <label class="ad-checkbox-label ad-field-checkbox">
            <input type="checkbox" data-field="closable" ${it.closable ? "checked" : ""}/>
            <span>Bisa ditutup user</span>
          </label>
        </div>
      </section>

      <section class="ad-section-block">
        <header class="ad-section-block-head">
          <span class="ad-section-block-icon">✨</span>
          <span class="ad-section-block-title">Tampilan</span>
        </header>
        <div class="ad-form-row cols-4">
          <label class="ad-field">
            <span class="ad-field-label">Ukuran</span>
            <select data-field="size">
              <option value="small" ${(it.size || "medium") === "small" ? "selected" : ""}>Kecil (180px)</option>
              <option value="medium" ${(it.size || "medium") === "medium" ? "selected" : ""}>Sedang (260px)</option>
              <option value="large" ${(it.size || "medium") === "large" ? "selected" : ""}>Besar (340px)</option>
            </select>
          </label>
          <label class="ad-field">
            <span class="ad-field-label">Sudut bulat <em data-label="radius">${it.radius != null ? it.radius : 12}px</em></span>
            <input type="range" min="0" max="32" value="${it.radius != null ? it.radius : 12}" data-field="radius"/>
          </label>
          <label class="ad-field">
            <span class="ad-field-label">Animasi muncul</span>
            <select data-field="animation">
              <option value="fade" ${(it.animation || "fade") === "fade" ? "selected" : ""}>Fade In</option>
              <option value="slide-up" ${it.animation === "slide-up" ? "selected" : ""}>Slide Up</option>
              <option value="slide-side" ${it.animation === "slide-side" ? "selected" : ""}>Slide dari samping</option>
              <option value="zoom" ${it.animation === "zoom" ? "selected" : ""}>Zoom In</option>
              <option value="none" ${it.animation === "none" ? "selected" : ""}>Tanpa animasi</option>
            </select>
          </label>
          <label class="ad-checkbox-label ad-field-checkbox">
            <input type="checkbox" data-field="shadow" ${it.shadow !== false ? "checked" : ""}/>
            <span>Beri bayangan</span>
          </label>
        </div>
      </section>
    `;
  }
  if (type === "pr") {
    const mediaType = it.mediaType === "image" ? "image" : "video";
    const videoPreviewHtml = it.hasBlob
      ? `<span class="ad-preview-tag">✓ Video tersimpan di IndexedDB</span>`
      : it.videoUrl
        ? `<span class="ad-preview-tag">🔗 ${escapeHtml(it.videoUrl.slice(0,60))}${it.videoUrl.length > 60 ? "..." : ""}</span>`
        : `<span class="muted">Belum ada video</span>`;
    const imagePreviewHtml = it.imageUrl
      ? `<img src="${escapeHtml(it.imageUrl)}" alt="preview"/>`
      : `<span class="muted">Belum ada gambar</span>`;
    const radioName = `prMediaType-${it.id}`;
    const durationSec = it.durationSec != null ? it.durationSec : 5;
    return `
      <section class="ad-section-block">
        <header class="ad-section-block-head">
          <span class="ad-section-block-icon">📢</span>
          <span class="ad-section-block-title">Tipe Iklan</span>
        </header>
        <div class="ad-form-row cols-2 ad-pr-mediatype">
          <label class="ad-radio-label">
            <input type="radio" name="${radioName}" value="video" data-field="mediaType" ${mediaType === "video" ? "checked" : ""}/>
            <span>🎬 Video</span>
          </label>
          <label class="ad-radio-label">
            <input type="radio" name="${radioName}" value="image" data-field="mediaType" ${mediaType === "image" ? "checked" : ""}/>
            <span>🖼️ Gambar</span>
          </label>
        </div>
      </section>

      <section class="ad-section-block" data-pr-show="video">
        <header class="ad-section-block-head">
          <span class="ad-section-block-icon">🎬</span>
          <span class="ad-section-block-title">Konten Video</span>
        </header>
        <div class="ad-upload-row">
          <div class="ad-thumb-preview ad-video-preview" data-preview="video">${videoPreviewHtml}</div>
          <div class="ad-upload-actions">
            <label class="btn ghost small ad-upload-btn">
              📁 Upload Video
              <input type="file" accept="video/*" hidden data-action="upload-video"/>
            </label>
            <button type="button" class="btn ghost small" data-action="clear-video">🗑 Hapus</button>
            <small class="muted-mini">MP4/WebM, maks 500MB.</small>
          </div>
        </div>
        <label class="ad-field">
          <span class="ad-field-label">Atau URL video</span>
          <input type="url" data-field="videoUrl" value="${escapeHtml(it.videoUrl || "")}" placeholder="https://example.com/ad.mp4"/>
        </label>
      </section>

      <section class="ad-section-block" data-pr-show="image">
        <header class="ad-section-block-head">
          <span class="ad-section-block-icon">🖼️</span>
          <span class="ad-section-block-title">Konten Gambar</span>
        </header>
        <div class="ad-upload-row">
          <div class="ad-thumb-preview" data-preview="image-pr">${imagePreviewHtml}</div>
          <div class="ad-upload-actions">
            <label class="btn ghost small ad-upload-btn">
              📁 Upload Gambar
              <input type="file" accept="image/*" hidden data-action="upload-image-pr"/>
            </label>
            <button type="button" class="btn ghost small" data-action="clear-image-pr">🗑 Hapus</button>
            <small class="muted-mini">PNG/JPG, maks 500MB.</small>
          </div>
        </div>
        <label class="ad-field">
          <span class="ad-field-label">Atau URL gambar</span>
          <input type="url" data-field="imageUrl" value="${escapeHtml(it.imageUrl || "")}" placeholder="https://example.com/ad.jpg"/>
        </label>
        <label class="ad-field">
          <span class="ad-field-label">Durasi tampil <em data-label="durationSec">${durationSec} detik</em></span>
          <input type="range" min="3" max="60" value="${durationSec}" data-field="durationSec"/>
        </label>
      </section>

      <section class="ad-section-block">
        <header class="ad-section-block-head">
          <span class="ad-section-block-icon">🔗</span>
          <span class="ad-section-block-title">Link Klik</span>
        </header>
        <label class="ad-field">
          <input type="url" data-field="linkUrl" value="${escapeHtml(it.linkUrl || "")}" placeholder="https://example.com/promo (opsional)"/>
          <small class="ad-form-hint">💡 Saat user klik iklan, link ini terbuka di tab baru. Kosongkan kalau tidak butuh klik.</small>
        </label>
      </section>

      <section class="ad-section-block" data-pr-show="video">
        <header class="ad-section-block-head">
          <span class="ad-section-block-icon">⏭</span>
          <span class="ad-section-block-title">Kontrol Skip</span>
        </header>
        <div class="ad-form-row cols-2">
          <label class="ad-checkbox-label ad-field-checkbox">
            <input type="checkbox" data-field="skippable" ${it.skippable ? "checked" : ""}/>
            <span>Bisa di-skip</span>
          </label>
          <label class="ad-field">
            <span class="ad-field-label">Skip aktif setelah <em data-label="skipAfterSec">${it.skipAfterSec} detik</em></span>
            <input type="range" min="0" max="30" value="${it.skipAfterSec}" data-field="skipAfterSec"/>
          </label>
        </div>
      </section>
    `;
  }
  return "";
}

// ----------- Mutators -----------
function patchAdItem(type, id, patch, { rerenderSummary = true } = {}) {
  const cfg = getAdConfig();
  const sec = adSection(cfg, type);
  const it = sec.items.find(x => x.id === id);
  if (!it) return null;
  Object.assign(it, patch);
  saveAdConfig(cfg);
  if (rerenderSummary) {
    const itemEl = document.querySelector(`.ad-item[data-id="${id}"]`);
    const sum = itemEl?.querySelector(".ad-item-summary");
    if (sum) sum.innerHTML = adItemSummary(type, it);
    if (itemEl) itemEl.classList.toggle("disabled", !it.enabled);
  }
  return it;
}

function addAdItem(type) {
  const cfg = getAdConfig();
  const sec = adSection(cfg, type);
  const it = type === "rt" ? defaultRtItem() : type === "bn" ? defaultBnItem() : defaultPrItem();
  it.name = `Iklan #${sec.items.length + 1}`;
  sec.items.push(it);
  saveAdConfig(cfg);
  renderAdItems(type);
  // Auto-expand the new item
  const newEl = document.querySelector(`.ad-item[data-id="${it.id}"]`);
  if (newEl) {
    const body = newEl.querySelector(".ad-item-body");
    if (body) body.hidden = false;
    newEl.classList.add("expanded");
    newEl.querySelector(".ad-item-name")?.focus();
  }
}

async function deleteAdItem(type, id) {
  const cfg = getAdConfig();
  const sec = adSection(cfg, type);
  sec.items = sec.items.filter(x => x.id !== id);
  saveAdConfig(cfg);
  if (type === "pr") await deletePrerollBlob(id);
  renderAdItems(type);
  toast("Iklan dihapus", "");
}

// ----------- Event delegation per list -----------
function bindAdSectionEvents(type) {
  const root = document.querySelector(`.ad-section[data-ad-type="${type}"]`);
  if (!root || root.__bound) return;
  root.__bound = true;

  // Add button
  $(`#ad${adCap(type)}Add`)?.addEventListener("click", () => addAdItem(type));

  // Rotation select
  $(`#ad${adCap(type)}Rotation`)?.addEventListener("change", e => {
    const cfg = getAdConfig();
    adSection(cfg, type).rotation = e.target.value;
    saveAdConfig(cfg);
  });

  const list = $(`#ad${adCap(type)}List`);
  if (!list) return;

  // Click: expand toggle / delete / clear button
  list.addEventListener("click", async e => {
    const itemEl = e.target.closest(".ad-item");
    if (!itemEl) return;
    const id = itemEl.dataset.id;

    if (e.target.closest(".ad-item-toggle") || (e.target.classList.contains("ad-item-summary"))) {
      const body = itemEl.querySelector(".ad-item-body");
      const open = !body.hidden;
      body.hidden = open;
      itemEl.classList.toggle("expanded", !open);
      const tog = itemEl.querySelector(".ad-item-toggle");
      if (tog) tog.textContent = open ? "▸" : "▾";
      return;
    }
    if (e.target.closest(".ad-item-del")) {
      e.preventDefault();
      openConfirm({
        icon: "🗑", iconClass: "danger",
        title: "Hapus iklan ini?",
        desc: "Iklan akan dihapus permanen dari rotasi.",
        btnText: "Hapus", btnClass: "danger",
        onConfirm: () => deleteAdItem(type, id)
      });
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "clear-image") {
      e.preventDefault();
      patchAdItem(type, id, { imageUrl: "" });
      const preview = itemEl.querySelector('[data-preview="image"]');
      if (preview) preview.innerHTML = `<span class="muted">Belum ada gambar</span>`;
      const urlInput = itemEl.querySelector('[data-field="imageUrl"]');
      if (urlInput) urlInput.value = "";
      toast("Banner dihapus", "");
    } else if (action === "clear-video") {
      e.preventDefault();
      patchAdItem(type, id, { videoUrl: "", hasBlob: false });
      await deletePrerollBlob(id);
      const preview = itemEl.querySelector('[data-preview="video"]');
      if (preview) preview.innerHTML = `<span class="muted">Belum ada video</span>`;
      const urlInput = itemEl.querySelector('[data-field="videoUrl"]');
      if (urlInput) urlInput.value = "";
      toast("Video pre-roll dihapus", "");
    } else if (action === "clear-image-pr") {
      e.preventDefault();
      patchAdItem(type, id, { imageUrl: "" });
      const preview = itemEl.querySelector('[data-preview="image-pr"]');
      if (preview) preview.innerHTML = `<span class="muted">Belum ada gambar</span>`;
      const urlInput = itemEl.querySelector('[data-field="imageUrl"]');
      if (urlInput) urlInput.value = "";
      toast("Gambar pre-roll dihapus", "");
    }
  });

  // Field input/change → patch item
  const handleField = e => {
    const t = e.target;
    const field = t.dataset.field;
    if (!field) return;
    const itemEl = t.closest(".ad-item");
    if (!itemEl) return;
    const id = itemEl.dataset.id;
    let value;
    if (t.type === "checkbox") value = t.checked;
    else if (t.type === "range" || t.type === "number") value = Number(t.value);
    else value = t.value;
    if (field !== "name" && typeof value === "string") value = value.trim() || value;
    // Range labels
    const lbl = itemEl.querySelector(`[data-label="${field}"]`);
    if (lbl) {
      if (field === "speed") lbl.textContent = `${value} px/dtk`;
      else if (field === "bgOpacity") lbl.textContent = `${value}%`;
      else if (field === "showAfterSec" || field === "skipAfterSec" || field === "durationSec") lbl.textContent = `${value} detik`;
      else if (field === "fontSize" || field === "padding" || field === "radius") lbl.textContent = `${value}px`;
    }
    patchAdItem(type, id, { [field]: value });
    // Sync data-media-type pada parent supaya CSS toggle section video/image jalan
    if (type === "pr" && field === "mediaType") {
      itemEl.dataset.mediaType = value === "image" ? "image" : "video";
    }
    // Live preview untuk running text
    if (type === "rt") refreshRtPreview(itemEl, id);
  };
  list.addEventListener("input", handleField);
  list.addEventListener("change", handleField);

  // File uploads (banner image / preroll image / preroll video)
  list.addEventListener("change", async e => {
    const action = e.target.dataset.action;
    if (action !== "upload-image" && action !== "upload-image-pr" && action !== "upload-video") return;
    const file = e.target.files?.[0]; if (!file) return;
    const itemEl = e.target.closest(".ad-item");
    const id = itemEl.dataset.id;
    try {
      if (action === "upload-image") {
        const dataUrl = await readImageFileAsDataURL(file);
        patchAdItem(type, id, { imageUrl: dataUrl });
        const preview = itemEl.querySelector('[data-preview="image"]');
        if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="banner preview"/>`;
        const urlInput = itemEl.querySelector('[data-field="imageUrl"]');
        if (urlInput) urlInput.value = "";
        toast(`✓ Banner di-upload (${Math.round(file.size/1024)} KB)`, "success");
      } else if (action === "upload-image-pr") {
        const dataUrl = await readImageFileAsDataURL(file);
        patchAdItem(type, id, { imageUrl: dataUrl });
        const preview = itemEl.querySelector('[data-preview="image-pr"]');
        if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="preroll image preview"/>`;
        const urlInput = itemEl.querySelector('[data-field="imageUrl"]');
        if (urlInput) urlInput.value = "";
        toast(`✓ Gambar pre-roll di-upload (${Math.round(file.size/1024)} KB)`, "success");
      } else {
        await savePrerollItemBlob(id, file);
        patchAdItem(type, id, { hasBlob: true, videoUrl: "" });
        const preview = itemEl.querySelector('[data-preview="video"]');
        if (preview) preview.innerHTML = `<span class="ad-preview-tag">✓ Video tersimpan di IndexedDB</span>`;
        const urlInput = itemEl.querySelector('[data-field="videoUrl"]');
        if (urlInput) urlInput.value = "";
        toast(`✓ Video pre-roll di-upload (${Math.round(file.size/1024)} KB)`, "success");
      }
    } catch (err) {
      toast(`❌ ${err.message}`, "error");
    }
    e.target.value = "";
  });
}

// ----------- Init (idempotent) -----------
(function setupAdManagerEvents() {
  if (window.__adManagerBound) return;
  window.__adManagerBound = true;
  document.addEventListener("DOMContentLoaded", initAdManagerEvents);
  if (document.readyState !== "loading") setTimeout(initAdManagerEvents, 0);
})();

function initAdManagerEvents() {
  if (!$("#adRtList") || window.__adManagerInited) return;
  window.__adManagerInited = true;

  bindAdSectionEvents("rt");
  bindAdSectionEvents("bn");
  bindAdSectionEvents("pr");

  // Header Save button → cuma feedback "tersimpan" + log (auto-save sebenarnya per perubahan)
  $("#adSaveBtn")?.addEventListener("click", () => {
    const cfg = getAdConfig();
    const totals = [
      cfg.runningText.items.filter(i => i.enabled && adItemHasContent("rt", i)).length && `${cfg.runningText.items.length} running text`,
      cfg.banner.items.filter(i => i.enabled && adItemHasContent("bn", i)).length && `${cfg.banner.items.length} banner`,
      cfg.preroll.items.filter(i => i.enabled && adItemHasContent("pr", i)).length && `${cfg.preroll.items.length} pre-roll`
    ].filter(Boolean);
    pushAdminEvent("📢", `Konfigurasi iklan diupdate (${totals.join(", ") || "semua kosong"})`);
    renderAdminLiveFeed?.();
    toast("✓ Konfigurasi iklan tersimpan", "success");
  });

  $("#adResetBtn")?.addEventListener("click", () => {
    openConfirm({
      icon: "↺", iconClass: "warn",
      title: "Reset Semua Iklan?",
      desc: "Semua running text, banner, dan pre-roll akan dihapus. File banner & video yang di-upload juga akan dihapus.",
      btnText: "Reset Semua", btnClass: "danger",
      onConfirm: async () => {
        const cfg = getAdConfig();
        // Hapus semua preroll blob
        for (const it of cfg.preroll.items) await deletePrerollBlob(it.id);
        // Plus legacy blob single-item dari format lama
        try {
          const db = await openVideoDB();
          const tx = db.transaction(VIDEO_STORE, "readwrite");
          tx.objectStore(VIDEO_STORE).delete(AD_PREROLL_LEGACY_ID);
        } catch {}
        saveAdConfig(defaultAdConfig());
        loadAdManagerForm();
        toast("Semua iklan di-reset", "");
      }
    });
  });
}

// =================== PLAYER OVERLAY INJECTION ===================
// Disisipkan ke player saat openPlayer() dipanggil.
// Cleanup otomatis saat modal player ditutup.

// Pilih satu item dari section berdasarkan rotation strategy.
// "all" hanya valid untuk running text (di applyAdOverlays).
function pickAdItemForPlay(section, type) {
  const enabled = section.items.filter(it => it.enabled && adItemHasContent(type, it));
  if (!enabled.length) return null;
  if (section.rotation === "sequential") {
    const seqKey = `playly-ad-seq-${type}`;
    const idx = (Number(localStorage.getItem(seqKey)) || 0) % enabled.length;
    localStorage.setItem(seqKey, String((idx + 1) % enabled.length));
    return enabled[idx];
  }
  return enabled[Math.floor(Math.random() * enabled.length)];
}

async function applyAdOverlays(videoEl) {
  const cfg = getAdConfig();
  const screen = videoEl.closest(".player-screen");
  if (!screen) return;

  // Cleanup overlays lama
  screen.querySelectorAll(".ad-overlay").forEach(el => el.remove());

  // Pre-roll: inject DULU sebelum overlay lain
  const prItem = pickAdItemForPlay(cfg.preroll, "pr");
  if (prItem) {
    const url = prItem.hasBlob ? await getPrerollItemBlobUrl(prItem.id) : prItem.videoUrl;
    if (url) await playPrerollAd(videoEl, url, prItem);
  }

  // Running text — mode "all" tampilkan semua sekaligus, lainnya pilih satu
  if (cfg.runningText.rotation === "all") {
    cfg.runningText.items
      .filter(it => it.enabled && adItemHasContent("rt", it))
      .forEach(it => injectRunningText(screen, it));
  } else {
    const rtItem = pickAdItemForPlay(cfg.runningText, "rt");
    if (rtItem) injectRunningText(screen, rtItem);
  }

  // Banner
  const bnItem = pickAdItemForPlay(cfg.banner, "bn");
  if (bnItem) {
    setTimeout(() => {
      if (state?.currentView !== "player") return;
      injectBanner(screen, bnItem);
    }, (bnItem.showAfterSec || 0) * 1000);
  }
}

function injectRunningText(screen, c) {
  const overlay = document.createElement("div");
  overlay.className = `ad-overlay ad-runtext ad-pos-${c.position}`;
  const bg = hexToRgba(c.bgColor, c.bgOpacity / 100);
  overlay.style.background = bg;
  overlay.style.padding = `${c.padding != null ? c.padding : 8}px 0`;
  // Inline style untuk track (font, ukuran, weight, italic)
  const trackStyle = [
    `color:${c.textColor || "#fff"}`,
    `font-family:${c.fontFamily || "Inter"}, sans-serif`,
    `font-size:${c.fontSize || 14}px`,
    `font-weight:${c.fontWeight || 600}`,
    `font-style:${c.italic ? "italic" : "normal"}`
  ].join(";");
  // Seamless marquee: dua salinan teks identik. Animasi geser track 0→-50% =
  // exactly satu lebar piece, jadi piece kedua menggantikan piece pertama
  // tepat saat loop reset → tidak ada jeda kosong, jalan terus sampai video
  // selesai (overlay di-cleanup saat player ditutup).
  const text = escapeHtml(c.text);
  overlay.innerHTML = `
    <div class="ad-runtext-track" style="${trackStyle}">
      <span class="ad-runtext-piece">${text}</span>
      <span class="ad-runtext-piece" aria-hidden="true">${text}</span>
    </div>`;
  screen.appendChild(overlay);
  const track = overlay.querySelector(".ad-runtext-track");
  const piece = overlay.querySelector(".ad-runtext-piece");
  requestAnimationFrame(() => {
    // Durasi = waktu untuk track menggeser sejauh satu piece (termasuk gap).
    const pieceW = piece.offsetWidth;
    const dur = pieceW / Math.max(20, c.speed);
    track.style.setProperty("--ad-rt-dur", `${dur}s`);
  });
}

function injectBanner(screen, c) {
  const overlay = document.createElement("div");
  const sizeCls = `ad-banner-size-${c.size || "medium"}`;
  const animCls = `ad-banner-anim-${c.animation || "fade"}`;
  const shadowCls = c.shadow !== false ? "ad-banner-shadow" : "";
  overlay.className = `ad-overlay ad-banner ad-pos-${c.position} ${sizeCls} ${animCls} ${shadowCls}`.trim();
  const radius = c.radius != null ? c.radius : 12;
  overlay.style.setProperty("--ad-banner-radius", `${radius}px`);
  const closeBtn = c.closable ? `<button class="ad-banner-close" title="Tutup">✕</button>` : "";
  const linkOpen = c.linkUrl ? `<a href="${c.linkUrl}" target="_blank" rel="noopener">` : "";
  const linkClose = c.linkUrl ? `</a>` : "";
  overlay.innerHTML = `${linkOpen}<img src="${c.imageUrl}" alt="banner"/>${linkClose}${closeBtn}`;
  screen.appendChild(overlay);
  if (c.closable) {
    overlay.querySelector(".ad-banner-close").addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      overlay.remove();
    });
  }
}

function playPrerollAd(videoEl, url, c) {
  return new Promise(resolve => {
    const screen = videoEl.closest(".player-screen");
    if (!screen) return resolve();

    // Simpan src asli
    const origSrc = videoEl.src;
    const origPoster = videoEl.poster;

    // Buat overlay pre-roll
    const overlay = document.createElement("div");
    overlay.className = "ad-overlay ad-preroll";
    overlay.innerHTML = `
      <span class="ad-preroll-label">📢 Iklan</span>
      <button class="ad-preroll-skip" hidden>Lewati ›</button>
    `;
    screen.appendChild(overlay);

    // Mainkan iklan
    videoEl.src = url;
    videoEl.poster = "";
    videoEl.controls = false;
    videoEl.play().catch(() => {});

    const skipBtn = overlay.querySelector(".ad-preroll-skip");
    let countdownTimer = null;

    const cleanup = () => {
      if (countdownTimer) clearInterval(countdownTimer);
      videoEl.removeEventListener("ended", finish);
      videoEl.removeEventListener("error", finish);
      overlay.remove();
      videoEl.controls = true;
      videoEl.src = origSrc;
      videoEl.poster = origPoster;
      // Lanjutkan video utama
      videoEl.play().catch(() => {});
      resolve();
    };

    const finish = () => cleanup();

    videoEl.addEventListener("ended", finish);
    videoEl.addEventListener("error", finish);

    // Skip handling
    if (c.skippable) {
      let remaining = Math.max(0, c.skipAfterSec || 0);
      if (remaining === 0) {
        skipBtn.hidden = false;
        skipBtn.textContent = "Lewati ›";
      } else {
        skipBtn.hidden = false;
        skipBtn.disabled = true;
        skipBtn.textContent = `Lewati dalam ${remaining}…`;
        countdownTimer = setInterval(() => {
          remaining--;
          if (remaining <= 0) {
            skipBtn.disabled = false;
            skipBtn.textContent = "Lewati ›";
            clearInterval(countdownTimer);
          } else {
            skipBtn.textContent = `Lewati dalam ${remaining}…`;
          }
        }, 1000);
      }
      skipBtn.addEventListener("click", () => {
        if (skipBtn.disabled) return;
        finish();
      });
    }
  });
}

function hexToRgba(hex, alpha = 1) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#000000");
  if (!m) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// (Global banner system dihapus — banner hanya muncul di dalam player video,
//  bukan fixed-position di seluruh dashboard. Bersihkan sisa overlay kalau ada
//  dari sesi lama yang ter-cache.)
document.getElementById("globalBannerOverlay")?.remove();

// =================== ADMIN: REVENUE (REAL-TIME) ===================
// Revenue dihitung ulang tiap detik dari getAdminMetrics() — data dasarnya
// (totalViews, accounts) bisa berubah real-time karena cross-tab storage
// events. Counter di-animate smooth, ada earnings-rate live, baseline
// "hari ini" yang persist & reset di midnight, dan activity feed setiap
// kali revenue benar-benar berubah.

// Source-of-truth: array transaksi real {id, ts, amount, type, source}.
// Default kosong — tidak ada data palsu. Akan terisi saat payment integration
// di-pasang dan transaksi sungguh masuk.
const REVENUE_LEDGER_KEY = "playly-revenue-ledger";

function getRevenueLedger() {
  try { return JSON.parse(localStorage.getItem(REVENUE_LEDGER_KEY) || "[]"); }
  catch { return []; }
}

function computeRevenueFromLedger() {
  const ledger = getRevenueLedger();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  let total = 0, today = 0, ads = 0, sub = 0, recent = 0;
  for (const l of ledger) {
    const amt = Number(l.amount) || 0;
    total += amt;
    if (l.ts >= todayStart) today += amt;
    if (l.ts >= fiveMinAgo) recent += amt;
    const tp = (l.type || "").toLowerCase();
    if (tp === "ads") ads += amt;
    else if (tp === "subscription" || tp === "sub") sub += amt;
  }
  return {
    ledger, total, today, ads, sub,
    rate: recent / 5,        // Rp/menit (sum 5 menit terakhir / 5)
    payout: total * 0.35,    // Share kreator (kontrak: 35%)
    isEmpty: ledger.length === 0
  };
}

const revState = {
  buffer: [],            // [{t, total}] — hanya populated saat ada transaksi
  feed: [],              // ledger entries terbaru, max 10
  lastSeenTxnTs: null,   // marker transaksi terakhir yang sudah masuk feed
  tickTimer: null,
  feedTimer: null,
  displayed: { total: 0, today: 0, ads: 0, sub: 0, payout: 0, rate: 0 }
};

function fmtRp(n) {
  return "Rp " + Math.floor(n || 0).toLocaleString("id-ID");
}
function fmtRpShort(n) {
  n = Math.floor(n || 0);
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)}M`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(1)}jt`;
  if (n >= 1e3) return `Rp ${(n / 1e3).toFixed(0)}k`;
  return `Rp ${n}`;
}

// Smooth count-up: animasi nilai displayed → target dalam 600ms.
function animateRevCounter(el, key, target, formatter) {
  if (!el) return;
  const from = revState.displayed[key];
  if (from === target) return;
  const start = performance.now();
  const dur = 600;
  function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
    const val = from + (target - from) * ease;
    el.textContent = formatter(val);
    if (t < 1) requestAnimationFrame(step);
    else {
      revState.displayed[key] = target;
      el.textContent = formatter(target);
    }
  }
  requestAnimationFrame(step);
}

function tickRevenue() {
  if (!$("#revTotal")) return;
  const r = computeRevenueFromLedger();
  const now = Date.now();

  // Buffer chart hanya diisi saat ada transaksi. Kalau ledger kosong, biarkan
  // buffer kosong supaya chart menampilkan empty state, bukan flat-line palsu.
  if (!r.isEmpty) {
    revState.buffer.push({ t: now, total: r.total });
    if (revState.buffer.length > 300) revState.buffer.shift();
  } else if (revState.buffer.length > 0) {
    revState.buffer = [];
  }

  // Detect transaksi baru → push ke activity feed.
  // Initialize lastSeenTxnTs di tick pertama supaya history yang sudah ada
  // tidak ter-replay sebagai "transaksi baru".
  if (revState.lastSeenTxnTs == null) {
    revState.lastSeenTxnTs = r.ledger.length
      ? r.ledger.reduce((m, l) => Math.max(m, l.ts), 0)
      : 0;
  } else {
    const newTxns = r.ledger
      .filter(l => l.ts > revState.lastSeenTxnTs)
      .sort((a, b) => b.ts - a.ts);
    if (newTxns.length) {
      newTxns.forEach(l => revState.feed.unshift({
        t: l.ts, amount: Number(l.amount) || 0, type: l.type, source: l.source
      }));
      if (revState.feed.length > 10) revState.feed.length = 10;
      revState.lastSeenTxnTs = newTxns[0].ts;
      renderRevFeed();
    }
  }

  // Animasi semua KPI
  animateRevCounter($("#revTotal"), "total", r.total, fmtRp);
  animateRevCounter($("#revToday"), "today", r.today, fmtRp);
  animateRevCounter($("#revAds"), "ads", r.ads, fmtRp);
  animateRevCounter($("#revSub"), "sub", r.sub, fmtRp);
  animateRevCounter($("#revPayout"), "payout", r.payout, fmtRp);
  animateRevCounter($("#revRate"), "rate", r.rate, v => `${fmtRp(v)}/menit`);

  // Sub-labels — semua jujur, tidak ada angka mengarang
  $("#revTotalSub") && ($("#revTotalSub").textContent =
    r.isEmpty ? "menunggu transaksi pertama" : `${r.ledger.length} transaksi tercatat`);
  $("#revTodaySub") && ($("#revTodaySub").textContent =
    r.today > 0 ? `+${fmtRp(r.today)} sejak 00:00` : "sejak 00:00");
  $("#revRateSub") && ($("#revRateSub").textContent =
    r.isEmpty ? "menunggu transaksi" :
    r.rate > 0 ? `5 menit terakhir` :
    "tidak ada transaksi 5 menit terakhir");
  $("#revBreakdownSub") && ($("#revBreakdownSub").textContent =
    r.isEmpty ? "Belum ada transaksi tercatat" : `${fmtRp(r.total)} total`);

  updateRevSplit(r);
  drawRevLiveChart();
}

function updateRevSplit(r) {
  const content = $("#revSplitContent");
  const empty = $("#revSplitEmpty");
  if (!content || !empty) return;
  if (r.total <= 0) {
    content.hidden = true;
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  content.hidden = false;
  const adsPct = (r.ads / r.total) * 100;
  const subPct = (r.sub / r.total) * 100;
  const adsEl = $("#revSplitAds"), subEl = $("#revSplitSub");
  if (adsEl) adsEl.style.width = `${adsPct.toFixed(1)}%`;
  if (subEl) subEl.style.width = `${subPct.toFixed(1)}%`;
  const adsLab = $("#revSplitAdsLabel"), subLab = $("#revSplitSubLabel");
  if (adsLab) adsLab.textContent = `Ads ${adsPct.toFixed(0)}%`;
  if (subLab) subLab.textContent = `Subscription ${subPct.toFixed(0)}%`;
}

function drawRevLiveChart() {
  const svg = $("#revLiveChart"); if (!svg) return;
  const empty = $("#revLiveEmpty");
  const liveTick = $("#revLiveTick");
  const buf = revState.buffer;

  // Render hanya kalau ada minimal 2 titik dengan nilai non-zero.
  // Kalau tidak, clear total + tampilkan empty state. Tidak ada flat-line palsu.
  const hasData = buf.length >= 2 && buf.some(b => b.total > 0);
  if (!hasData) {
    svg.innerHTML = "";
    if (empty) empty.hidden = false;
    if (liveTick) liveTick.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;
  if (liveTick) liveTick.hidden = false;

  const W = 700, H = 180, PAD_L = 56, PAD_R = 14, PAD_T = 14, PAD_B = 22;
  const minT = buf[0].t, maxT = buf[buf.length - 1].t;
  const minV = Math.min(...buf.map(b => b.total));
  const maxV = Math.max(...buf.map(b => b.total));
  const range = maxV - minV || Math.max(1, maxV * 0.05);
  const yMin = Math.max(0, minV - range * 0.1);
  const yMax = maxV + range * 0.1;
  const tRange = (maxT - minT) || 1;

  const points = buf.map(b => [
    PAD_L + (b.t - minT) / tRange * (W - PAD_L - PAD_R),
    H - PAD_B - (b.total - yMin) / (yMax - yMin) * (H - PAD_T - PAD_B)
  ]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(" ");
  const area = `${path} L ${points[points.length-1][0]} ${H - PAD_B} L ${points[0][0]} ${H - PAD_B} Z`;

  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const y = PAD_T + (i * (H - PAD_T - PAD_B) / 3);
    const val = yMax - (i * (yMax - yMin) / 3);
    grid += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="rgba(140,150,180,.1)" stroke-dasharray="2,4"/>`;
    grid += `<text x="${PAD_L - 6}" y="${y + 3}" fill="rgba(140,150,180,.6)" font-size="9" text-anchor="end" font-family="Inter">${fmtRpShort(val)}</text>`;
  }

  const lblTimes = [
    { t: minT, label: "-5m", anchor: "start" },
    { t: (minT + maxT) / 2, label: "-2:30", anchor: "middle" },
    { t: maxT, label: "now", anchor: "end" }
  ];
  let xLabels = "";
  lblTimes.forEach(({ t, label, anchor }) => {
    const x = PAD_L + (t - minT) / tRange * (W - PAD_L - PAD_R);
    xLabels += `<text x="${x}" y="${H - PAD_B + 14}" fill="rgba(140,150,180,.6)" font-size="9" text-anchor="${anchor}" font-family="Inter">${label}</text>`;
  });

  const last = points[points.length - 1];
  svg.innerHTML = `
    <defs>
      <linearGradient id="revG" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#561C24"/></linearGradient>
      <linearGradient id="revGFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#10b981" stop-opacity=".3"/><stop offset="100%" stop-color="#10b981" stop-opacity="0"/></linearGradient>
    </defs>
    ${grid}
    <path d="${area}" fill="url(#revGFill)"/>
    <path d="${path}" fill="none" stroke="url(#revG)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="#10b981"><animate attributeName="r" values="4;7;4" dur="1.4s" repeatCount="indefinite"/></circle>
    ${xLabels}
  `;
}

function renderRevFeed() {
  const list = $("#revFeed"); if (!list) return;
  if (!revState.feed.length) {
    list.innerHTML = `<div class="rev-feed-empty"><div class="an-empty-icon">💸</div><p>Belum ada transaksi tercatat. Pembayaran yang masuk akan muncul di sini secara real-time.</p></div>`;
    return;
  }
  list.innerHTML = revState.feed.map(ev => {
    const ago = revFeedRelTime(ev.t);
    const tp = (ev.type || "").toLowerCase();
    const typeLabel = tp === "ads" ? "💰 Ads"
      : tp === "subscription" || tp === "sub" ? "⭐ Subscription"
      : "💸 Revenue";
    const src = ev.source ? ` · ${escapeHtml(String(ev.source))}` : "";
    return `<div class="rev-feed-row">
      <div class="rev-feed-amount">+${fmtRp(ev.amount)}</div>
      <div class="rev-feed-meta">
        <small class="rev-feed-reason">${typeLabel}${src}</small>
        <small class="rev-feed-time">${ago}</small>
      </div>
    </div>`;
  }).join("");
}

function revFeedRelTime(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "baru saja";
  if (sec < 60) return `${sec}d lalu`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m lalu`;
  return `${Math.floor(sec / 3600)}j lalu`;
}

function startRevenueLive() {
  stopRevenueLive();
  // Tick tiap 1 detik
  revState.tickTimer = setInterval(() => {
    if (state?.currentView !== "admin-revenue") {
      stopRevenueLive();
      return;
    }
    tickRevenue();
  }, 1000);
  // Refresh feed timestamps tiap 10 detik (biar "X detik lalu" akurat)
  revState.feedTimer = setInterval(() => {
    if (state?.currentView !== "admin-revenue") return;
    renderRevFeed();
  }, 10000);
}

function stopRevenueLive() {
  if (revState.tickTimer) { clearInterval(revState.tickTimer); revState.tickTimer = null; }
  if (revState.feedTimer) { clearInterval(revState.feedTimer); revState.feedTimer = null; }
}

function renderAdminRevenue() {
  if (!$("#revTotal")) return;
  // Initial paint (tanpa animasi panjang dari 0 → total kalau sudah pernah ada)
  // Tick pertama akan animate dari current displayed (default 0) ke nilai sekarang
  tickRevenue();
  renderRevFeed();
  drawRevLiveChart();
  if (state?.currentView === "admin-revenue") startRevenueLive();
}

// Refresh manual buttons
$("#refreshAdminRevenue")?.addEventListener("click", () => {
  renderAdminRevenue();
  toast("✓ Revenue di-refresh", "success");
});

function startAdminLiveRefresh() {
  stopAdminLiveRefresh();
  adminRefreshTimer = setInterval(() => {
    if (!document.body.dataset.role || document.body.dataset.role !== "admin") return;
    renderAdminKPI();
    renderAdminLiveFeed();
    renderAdminAlerts();
    syncAdminNavBadges();
    syncAdminHeroStats();
    // Refresh insights di dashboard utama
    if (state?.currentView === "admin-dashboard") renderAdminTopInsights();
    // Refresh analytics kalau view aktif (revenue punya tick sendiri)
    if (state?.currentView === "admin-analytics") renderAdminAnalytics();
    if (state?.currentView === "admin-revenue") renderAdminRevenue();
  }, 4000);
}
function stopAdminLiveRefresh() {
  if (adminRefreshTimer) { clearInterval(adminRefreshTimer); adminRefreshTimer = null; }
  if (adminSimTimer) { clearTimeout(adminSimTimer); adminSimTimer = null; }
}

// LIVE toggle: klik untuk pause auto-refresh, klik lagi untuk resume + manual refresh.
(function setupLiveToggle() {
  const btn = document.getElementById("adminLiveToggle");
  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => {
    const isPaused = btn.classList.contains("paused");
    if (isPaused) {
      // Resume + manual refresh
      btn.classList.remove("paused");
      btn.querySelector(".lt-label").textContent = "LIVE";
      startAdminLiveRefresh();
      // Trigger refresh sekarang juga
      try {
        renderAdminLiveFeed();
        renderAdminAlerts();
        renderAdminKPI?.();
        syncAdminNavBadges?.();
        if (typeof renderAdminTopInsights === "function") renderAdminTopInsights();
      } catch {}
      // Flash effect
      btn.classList.add("flash");
      setTimeout(() => btn.classList.remove("flash"), 280);
      toast("✓ Feed di-refresh & live updates aktif", "success");
    } else {
      // Pause
      btn.classList.add("paused");
      btn.querySelector(".lt-label").textContent = "PAUSED";
      stopAdminLiveRefresh();
      toast("⏸ Live updates dijeda", "info");
    }
  });
})();

// Random event simulator DIHAPUS — feed admin cuma terisi dari aksi real
// (admin login, suspend user, approve/remove video, ticket status change, dll.)
function startAdminEventSimulator() {
  // no-op — pakai data real saja
}

// Live sync untuk USER (non-admin): kalau admin mengirim pesan dari tab lain,
// inbox user di tab ini ikut ter-update tanpa reload.
function setupUserMessageSync() {
  if (window.__userMsgSyncBound) return;
  window.__userMsgSyncBound = true;
  // Catat pesan terakhir per-thread supaya toast cuma fire untuk pesan benar-benar baru
  // (bukan thread lama yang masih unread).
  let lastSeenByThread = new Map();
  window.addEventListener("storage", e => {
    if (!user || !e.key || e.key !== `playly-state-${user.username}`) return;
    let fresh; try { fresh = JSON.parse(e.newValue || "null"); } catch { return; }
    if (!fresh) return;
    if (Array.isArray(fresh.messages)) {
      state.messages = fresh.messages;
      if (typeof renderMsgList === "function") renderMsgList();
      // Refresh badge & Pusat Komunikasi kalau admin lagi melihatnya
      if (typeof syncAdminNavBadges === "function") syncAdminNavBadges();
      if (state?.currentView === "admin-comms" && typeof renderAdminComms === "function") {
        renderAdminComms();
      }
      // Refresh kolom Live Chat di Inbox kalau admin lagi melihatnya
      if (state?.currentView === "admin-inbox" && typeof renderAdminInbox === "function") {
        renderAdminInbox();
      }
      // Cek tiap thread unread, fire toast hanya kalau pesan terbaru di thread itu BERBEDA
      // dari yang sudah pernah kita lihat (mencegah spam toast).
      const isAdmin = user.role === "admin";
      for (const m of fresh.messages) {
        if (!m.unread || !Array.isArray(m.history) || !m.history.length) continue;
        const last = m.history[m.history.length - 1];
        if (!last || last.from !== "them") continue;
        const sig = `${m.name}:${m.history.length}:${(last.text || "").slice(0, 60)}`;
        if (lastSeenByThread.get(m.name) === sig) continue;
        lastSeenByThread.set(m.name, sig);
        const label = m.isAdmin ? "Admin" : (isAdmin ? "User" : "Kreator");
        toast(`📨 Pesan baru dari <b>@${escapeHtml(m.name)}</b> (${label})`, "info");
      }
    }
    // Notifikasi dari user lain (like / comment / follow) — sync agar lonceng
    // di topbar dan panel notifikasi langsung update.
    if (Array.isArray(fresh.notifications)) {
      const prevTopId = state.notifications?.[0]?.id;
      state.notifications = fresh.notifications;
      if (typeof renderNotifications === "function") renderNotifications();
      // Toast cuma kalau notifikasi baru benar-benar masuk (id paling atas berubah)
      const newest = fresh.notifications[0];
      if (newest && newest.id !== prevTopId && newest.unread) {
        const plain = String(newest.text || "").replace(/<[^>]*>/g, "");
        toast(`🔔 ${plain}`, "info");
      }
    }
  });
}
setupUserMessageSync();

// Cross-tab sync untuk user non-admin: kalau admin update Ad Manager dari
// tab lain, ad config di tab ini ikut refresh kalau dibutuhkan.
// (Tidak ada lagi global banner — banner hanya muncul di dalam player.)
function setupAdConfigCrossTabSync() {
  if (window.__adConfigSyncBound) return;
  window.__adConfigSyncBound = true;
  window.addEventListener("storage", e => {
    if (e.key !== AD_CONFIG_KEY) return;
    // Bersihkan kalau-kalau ada overlay sisa dari versi lama yang nyangkut.
    document.getElementById("globalBannerOverlay")?.remove();
  });
}
setupAdConfigCrossTabSync();

// Cross-tab sync: when admin acts in one tab, other tabs update too.
function setupAdminCrossTabSync() {
  if (window.__adminSyncBound) return;
  window.__adminSyncBound = true;
  const handleKey = (key) => {
    if (!key || document.body.dataset.role !== "admin") return;
    if (key === ADMIN_KEYS.events) {
      renderAdminLiveFeed();
      if (state?.currentView === "admin-audit") renderAdminAudit();
    }
    if (key === ADMIN_KEYS.mod) { renderAdminModeration(); renderAdminAlerts(); syncAdminNavBadges(); }
    if (key === ADMIN_KEYS.tickets) { renderAdminTickets(); renderAdminInbox(); renderAdminAlerts(); syncAdminNavBadges(); }
    if (key === ADMIN_KEYS.bugs) { renderAdminBugs(); renderAdminInbox(); renderAdminAlerts(); syncAdminNavBadges(); }
    if (key.startsWith("playly-account-") || key.startsWith("playly-state-")) {
      renderAdminKPI(); renderAdminUsers(); renderAdminAlerts();
      if (state?.currentView === "admin-videos") renderAdminVideos();
      else syncAdminNavBadges();
      // Refresh Pusat Komunikasi kalau lagi dibuka — DM atau broadcast log berubah
      if (state?.currentView === "admin-comms") renderAdminComms();
    }
    if (key === "playly-admin-sent" && state?.currentView === "admin-comms") {
      renderAdminComms();
    }
    if (key === REVENUE_LEDGER_KEY && state?.currentView === "admin-revenue") {
      tickRevenue();
    }
  };
  // Cross-tab (browser yang sama)
  window.addEventListener("storage", e => handleKey(e.key));
  // Cross-device: cloud-sync apply data dari Supabase → dispatch event ini
  window.addEventListener("playly:cloud-applied", e => {
    const keys = e.detail?.keys || [];
    keys.forEach(handleKey);
  });
}

// Badge sidebar dimatikan total — user minta menu bersih tanpa indikator
// number/dot di sidebar. Counter aktivitas baru tetap ada di dalam view
// (Inbox, Audit Log, KPI, dll) supaya tidak duplikat dengan sidebar.
function setBadgeMode(el) {
  if (!el) return;
  el.className = el.className.replace(/\bglow-dot\b/g, "").trim();
  el.textContent = "";
  el.style.display = "none";
}

function syncAdminNavBadges() {
  const m = getAdminMetrics();
  // User Management: new users 24h → number; ada akun → dot; kosong → hidden
  setBadgeMode($("#adminUserBadge"), m.newUsers24h, m.accounts.length > 0);
  const mb = $("#adminModBadge"); if (mb) { mb.textContent = m.mod; mb.style.display = m.mod ? "" : "none"; }
  const tb = $("#adminTicketBadge"); if (tb) { tb.textContent = m.tickets; tb.style.display = m.tickets ? "" : "none"; }
  // Inbox: tiket new + bug open → number; ada tiket/bug apapun → dot; kosong → hidden
  const allTickets = getAdminData("tickets") || [];
  const allBugs = getAdminData("bugs") || [];
  const openBugs = allBugs.filter(b => b.status === "open" || !b.status).length;
  setBadgeMode($("#adminInboxBadge"), (m.tickets || 0) + openBugs, allTickets.length + allBugs.length > 0);
  // Content Control: pending videos → number; ada video di platform → dot; kosong → hidden
  setBadgeMode($("#adminVideoBadge"), countAdminPendingVideos(), (m.videos || 0) > 0);
  // Conversation: thread unread → number; ada thread → dot; kosong → hidden
  const threads = Array.isArray(state?.messages) ? state.messages : [];
  const unreadThreads = threads.filter(t => t.unread).length;
  setBadgeMode($("#adminCommsBadge"), unreadThreads, threads.length > 0);
  // Audit Log: event hari ini → number; pernah ada event → dot; kosong → hidden
  const events = getAdminData("events") || [];
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayEvents = events.filter(e => Number(e.ts) >= startOfDay.getTime()).length;
  setBadgeMode($("#adminAuditBadge"), todayEvents, events.length > 0);
}

function setKPI(el, val) {
  if (!el) return;
  if (el.textContent !== val) {
    el.textContent = val;
    el.classList.remove("kpi-flash");
    void el.offsetWidth;
    el.classList.add("kpi-flash");
  }
}

function renderAdminKPI() {
  const m = getAdminMetrics();
  setKPI($("#kpiUsers"), fmtNum(m.accounts.length));
  setKPI($("#kpiVideos"), fmtNum(m.videos.length));
  setKPI($("#kpiViews"), fmtNum(m.totalViews));
  setKPI($("#kpiRevenue"), fmtIDR(m.revenue));

  const trendEls = $$(".admin-kpi-card .kpi-trend");
  const trendTxt = m.newUsers24h > 0 ? `↑ ${m.newUsers24h} baru 24j` : `0 baru 24j`;
  if (trendEls[0]) trendEls[0].textContent = trendTxt;
}

let lastFeedTopId = null;
function renderAdminLiveFeed() {
  const list = $("#adminLiveFeed"); if (!list) return;
  const events = getAdminData("events").slice(0, 10);
  if (!events.length) {
    list.innerHTML = `<li class="feed-empty">
      <span class="feed-empty-icon">📭</span>
      <div>
        <strong>Belum ada aktivitas</strong>
        <small>Aksi admin (suspend, approve, kirim pesan, dll.) akan muncul di sini.</small>
      </div>
    </li>`;
    lastFeedTopId = null;
    return;
  }
  const newTop = events[0].id;
  const isNew = lastFeedTopId !== null && newTop !== lastFeedTopId;
  list.innerHTML = events.map((e, i) => `<li${i === 0 && isNew ? ' class="new-event"' : ""}>
    <span class="feed-ico">${e.ico}</span>
    <span class="feed-text">${e.text}</span>
    <span class="feed-time">${relTime(e.ts)}</span>
  </li>`).join("");
  lastFeedTopId = newTop;
}

function renderAdminAlerts() {
  const wrap = $(".admin-alerts"); if (!wrap) return;
  const m = getAdminMetrics();
  const rows = [
    { cls: "red",   text: `${m.mod} video dilaporkan menunggu review`,        count: m.mod,           view: "admin-videos" },
    { cls: "amber", text: `${m.tickets} pesan baru di Inbox belum ditangani`, count: m.tickets,       view: "admin-inbox" },
    { cls: "blue",  text: `${m.newUsers24h} user baru dalam 24 jam terakhir`, count: m.newUsers24h,   view: "admin-users" },
    { cls: "gray",  text: `${m.bugsCritical} bug severity tinggi di Inbox`,   count: m.bugsCritical,  view: "admin-inbox" }
  ].filter(r => r.count > 0);

  if (!rows.length) {
    wrap.innerHTML = `<li class="alert-empty">
      <span class="alert-empty-icon">✅</span>
      <div>
        <strong>Semua aman</strong>
        <small>Tidak ada moderasi pending, tiket terbuka, atau bug critical.</small>
      </div>
    </li>`;
    return;
  }

  wrap.innerHTML = rows.map(r => `<li class="alert-row ${r.cls}" data-jump="${r.view}" style="cursor:pointer">
    <span>${r.text}</span><b>${r.count}</b>
  </li>`).join("");
}

function renderAdminUsers() {
  const tbody = $("#adminUserTbody"); if (!tbody) return;
  const search = ($("#adminUserSearch")?.value || "").toLowerCase().trim();
  const accounts = getAllAccounts();
  const rows = accounts.map(a => {
    const stateRaw = localStorage.getItem(`playly-state-${a.username}`);
    let videoCount = 0;
    try { videoCount = JSON.parse(stateRaw)?.myVideos?.length || 0; } catch {}
    return {
      name: a.name, username: a.username, email: a.email,
      role: a.role || "user", videos: videoCount,
      joinedAt: (a.joinedAt || "").split("T")[0] || "—",
      status: a.suspended ? "suspended" : "active"
    };
  });

  const filtered = search ? rows.filter(r =>
    r.name.toLowerCase().includes(search) ||
    r.username.toLowerCase().includes(search) ||
    r.email.toLowerCase().includes(search)
  ) : rows;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">${search ? "Tidak ada user yang cocok" : "Belum ada user terdaftar"}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const init = (r.name || r.username).split(" ").map(p => p[0]).slice(0,2).join("").toUpperCase();
    return `<tr data-username="${r.username}">
      <td><div class="user-cell" data-action="detail"><div class="avatar-sm">${init}</div><div><b>${r.name}</b><small style="display:block;color:var(--muted);font-size:11px">@${r.username}</small></div></div></td>
      <td>${r.email}</td>
      <td><span class="role-tag ${r.role}">${r.role.toUpperCase()}</span></td>
      <td>${r.videos}</td>
      <td>${r.joinedAt}</td>
      <td><span class="row-status ${r.status === "active" ? "" : r.status}">${r.status}</span></td>
      <td><div class="row-actions">
        <button title="Kirim Pesan" data-action="message">💬</button>
        <button title="Detail" data-action="detail">👤</button>
        <button title="Hapus Akun" class="danger" data-action="delete">🗑️</button>
      </div></td>
    </tr>`;
  }).join("");

  // Wire up delete account (irreversible — confirm modal)
  tbody.querySelectorAll("[data-action='delete']").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const tr = e.currentTarget.closest("tr");
      deleteUserAccount(tr.dataset.username);
    });
  });
  // Klik baris atau tombol detail untuk buka modal profile
  tbody.querySelectorAll("[data-action='detail']").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const tr = e.currentTarget.closest("tr");
      openUserDetail(tr.dataset.username);
    });
  });
  // Kirim pesan ke user dari row table → buka DM chat biasa, bukan modal template
  tbody.querySelectorAll("[data-action='message']").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const tr = e.currentTarget.closest("tr");
      startChatWithUser(tr.dataset.username);
    });
  });
}

// Hapus akun user — destructive, butuh konfirmasi typed-text. Admin/super-admin
// dilindungi (sama seperti suspend dulu). Cleanup localStorage account + state +
// welcome flag, lalu push event ke audit log + toast.
function deleteUserAccount(username) {
  const accountKey = Object.keys(localStorage).find(k => {
    if (!k.startsWith("playly-account-")) return false;
    try { return JSON.parse(localStorage.getItem(k))?.username === username; } catch { return false; }
  });
  if (!accountKey) return toast("❌ User tidak ditemukan", "error");
  const acc = JSON.parse(localStorage.getItem(accountKey));
  if (isAllowedAdminEmail(acc.email)) {
    return toast("🔒 Akun Admin tidak bisa dihapus dari sini", "warning");
  }
  openConfirm({
    icon: "🗑️", iconClass: "danger",
    title: "Hapus Akun Permanen?",
    desc: `<b style="color:var(--danger)">Tindakan ini tidak bisa dibatalkan.</b><br>Akun <b>@${escapeHtml(username)}</b> beserta seluruh video, pesan, dan data terkait akan dihapus permanen dari platform.`,
    btnText: "🗑️ Hapus Permanen", btnClass: "danger", typeText: "HAPUS",
    onConfirm: () => {
      localStorage.removeItem(accountKey);
      localStorage.removeItem(`playly-state-${username}`);
      localStorage.removeItem(`playly-welcomed-${username}`);
      pushAdminEvent("🗑️", `Akun <b>@${escapeHtml(username)}</b> dihapus permanen`);
      toast(`🗑️ Akun <b>@${escapeHtml(username)}</b> berhasil dihapus`, "success");
      renderAdminUsers();
      renderAdminLiveFeed?.();
      renderAdminKPI?.();
    }
  });
}

// Toggle suspend status — masih dipakai dari modal detail user.
function toggleUserSuspend(username) {
  const accountKey = Object.keys(localStorage).find(k => {
    if (!k.startsWith("playly-account-")) return false;
    try { return JSON.parse(localStorage.getItem(k))?.username === username; } catch { return false; }
  });
  if (!accountKey) return null;
  const acc = JSON.parse(localStorage.getItem(accountKey));
  if (isAllowedAdminEmail(acc.email)) {
    toast("🔒 Akun Admin tidak bisa di-suspend", "warning");
    return acc;
  }
  acc.suspended = !acc.suspended;
  localStorage.setItem(accountKey, JSON.stringify(acc));
  pushAdminEvent(acc.suspended ? "⛔" : "✓", `${acc.suspended ? "Suspended" : "Reactivated"} user <b>@${username}</b>`);
  toast(acc.suspended ? `⛔ User <b>@${username}</b> di-suspend` : `✓ User <b>@${username}</b> diaktifkan`, acc.suspended ? "warning" : "success");
  renderAdminUsers();
  renderAdminLiveFeed();
  return acc;
}

// =================== ADMIN: USER DETAIL MODAL ===================
let currentUserDetail = null;

function openUserDetail(username) {
  const accountKey = Object.keys(localStorage).find(k => {
    if (!k.startsWith("playly-account-")) return false;
    try { return JSON.parse(localStorage.getItem(k))?.username === username; } catch { return false; }
  });
  if (!accountKey) return toast("❌ User tidak ditemukan", "error");
  const acc = JSON.parse(localStorage.getItem(accountKey));
  currentUserDetail = acc;
  fillUserDetailModal(acc);
  $("#adminUserDetailModal").classList.add("show");
}

function fillUserDetailModal(acc) {
  // Header
  const init = (acc.name || acc.username || "U").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const av = $("#audAvatar");
  av.innerHTML = acc.avatar
    ? `<img src="${acc.avatar}" alt=""/>`
    : `<span>${init}</span>`;
  $("#audName").textContent = acc.name || acc.username;
  $("#audUsername").textContent = "@" + acc.username;

  // Role badge
  const role = acc.role || "user";
  const roleBadge = $("#audRoleBadge");
  roleBadge.textContent = role.toUpperCase();
  roleBadge.className = `role-tag ${role}`;

  // Status badge
  const status = acc.suspended ? "suspended" : "active";
  const statusBadge = $("#audStatusBadge");
  statusBadge.textContent = status;
  statusBadge.className = `row-status ${status === "active" ? "" : status}`;

  // Stats
  const stateRaw = localStorage.getItem(`playly-state-${acc.username}`);
  let userState = null;
  try { userState = JSON.parse(stateRaw); } catch {}
  const videos = userState?.myVideos || [];
  const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
  $("#audVideos").textContent = fmtNum(videos.length);
  $("#audFollowing").textContent = fmtNum(userState?.followingCreators?.length || 0);
  $("#audLikes").textContent = fmtNum(totalLikes);
  $("#audJoined").textContent = acc.joinedAt ? relTime(new Date(acc.joinedAt).getTime()) : "—";

  // Info
  $("#audEmail").textContent = acc.email;
  $("#audBio").textContent = acc.bio?.trim() ? acc.bio : "—";
  $("#audJoinedFull").textContent = acc.joinedAt
    ? new Date(acc.joinedAt).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "—";
  $("#audProvider").textContent = acc.provider ? acc.provider.charAt(0).toUpperCase() + acc.provider.slice(1) : "Email/Password";
  $("#audUid").textContent = `playly-${acc.username}`;

  // Social links — only show section if any are set
  const socials = [
    { key: "website", icon: "🌐", label: "Website", href: v => v },
    { key: "twitter", icon: "𝕏", label: "X / Twitter", href: v => `https://x.com/${(v || "").replace("@", "")}` },
    { key: "instagram", icon: "📷", label: "Instagram", href: v => `https://instagram.com/${(v || "").replace("@", "")}` },
    { key: "github", icon: "🐙", label: "GitHub", href: v => `https://github.com/${(v || "").replace("@", "")}` }
  ];
  const linksHtml = socials
    .filter(s => acc[s.key]?.trim())
    .map(s => `<div class="info-row"><span>${s.icon} ${s.label}</span><b><a href="${s.href(acc[s.key])}" target="_blank" rel="noopener" style="color:var(--primary)">${escapeHtml(acc[s.key])}</a></b></div>`)
    .join("");
  const socialSection = $("#audSocialSection");
  if (linksHtml) {
    socialSection.style.display = "";
    $("#audSocialGrid").innerHTML = linksHtml;
  } else {
    socialSection.style.display = "none";
  }

  // Recent videos (top 3 berdasarkan upload terbaru)
  const recent = [...videos].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 3);
  $("#audRecentVideos").innerHTML = recent.length ? recent.map(v => `
    <div class="admin-list-row">
      <span class="rank">🎬</span>
      <div>
        <strong>${escapeHtml(v.title)}</strong>
        <small>${v.duration || "0:00"} • ${v.views || "0"} views</small>
      </div>
      <b>${fmtNum(v.likes || 0)} ♥</b>
    </div>
  `).join("") : `<div style="text-align:center;padding:16px;color:var(--muted);font-size:12px">User belum upload video</div>`;

  // Suspend button label
  const suspendBtn = $("#audSuspendBtn");
  if (acc.suspended) {
    suspendBtn.innerHTML = "✓ Aktifkan Akun";
    suspendBtn.className = "btn success";
  } else {
    suspendBtn.innerHTML = "⛔ Suspend Akun";
    suspendBtn.className = "btn danger";
  }
  // Sembunyikan suspend untuk akun admin (super + admin tambahan)
  suspendBtn.style.display = isAllowedAdminEmail(acc.email) ? "none" : "";
}

$("#audSuspendBtn")?.addEventListener("click", () => {
  if (!currentUserDetail) return;
  const updated = toggleUserSuspend(currentUserDetail.username);
  if (updated) {
    currentUserDetail = updated;
    fillUserDetailModal(updated);
  }
});

$("#audResetPwBtn")?.addEventListener("click", () => {
  if (!currentUserDetail) return;
  if (isAllowedAdminEmail(currentUserDetail.email)) {
    return toast("🔒 Password Admin tidak bisa di-reset dari sini", "warning");
  }
  openConfirm({
    icon: "🔑", iconClass: "warn",
    title: "Reset Password User?",
    desc: `Password <b>@${currentUserDetail.username}</b> akan di-reset ke <code>playly1234</code>. User harus login ulang.`,
    btnText: "Reset Password", btnClass: "primary",
    onConfirm: () => {
      const accKey = `playly-account-${currentUserDetail.email}`;
      const acc = JSON.parse(localStorage.getItem(accKey) || "null");
      if (!acc) return toast("❌ Akun tidak ditemukan", "error");
      acc.password = DEFAULT_RESET_PASSWORD_HASH;
      localStorage.setItem(accKey, JSON.stringify(acc));
      pushAdminEvent("🔑", `Reset password <b>@${currentUserDetail.username}</b>`);
      renderAdminLiveFeed();
      toast(`✓ Password <b>@${currentUserDetail.username}</b> di-reset ke <code>playly1234</code>`, "success");
    }
  });
});

$("#audViewVideosBtn")?.addEventListener("click", () => {
  if (!currentUserDetail) return;
  $("#adminUserDetailModal").classList.remove("show");
  adminVideoState.search = currentUserDetail.username;
  const searchInput = $("#adminVideoSearch"); if (searchInput) searchInput.value = currentUserDetail.username;
  switchView("admin-videos");
});

$("#audMessageBtn")?.addEventListener("click", () => {
  if (!currentUserDetail) return;
  $("#adminUserDetailModal").classList.remove("show");
  // Admin chat 1-on-1 → buka DM biasa di halaman Messages, bukan modal template.
  // Modal template (openAdminSendMsg) cuma dipakai untuk Broadcast (banyak user sekaligus).
  startChatWithUser(currentUserDetail.username);
});

// =================== ADMIN → USER MESSAGING ===================
// Kirim pesan dari admin langsung ke inbox user. Pesan ditulis ke
// `playly-state-{username}.messages` milik penerima sehingga user lihat
// di tab Messages mereka.

const ADMIN_MSG_TEMPLATES = {
  welcome: "Halo! Selamat datang di Playly 🎉 Semoga betah & jangan ragu hubungi support kalau ada kendala ya.",
  warning: "⚠️ Tim moderasi kami menemukan konten yang berpotensi melanggar pedoman komunitas. Tolong dicek kembali video terbaru kamu — terima kasih atas kerjasamanya.",
  update:  "📢 Ada update baru di Playly! Cek halaman Discover untuk fitur terbaru. Stay tuned 🚀",
  suspend: "🚫 Akun kamu sedang dalam peninjauan karena pelanggaran pedoman. Hubungi support kalau merasa ini keliru.",
  custom:  ""
};

let __asmTargets = [];   // array of usernames to deliver to
let __asmIsBroadcast = false;

function openAdminSendMsg({ targets = [], broadcast = false } = {}) {
  if (broadcast) {
    const accounts = getAllAccounts().filter(a => !isAllowedAdminEmail(a.email));
    targets = accounts.map(a => a.username);
  }
  if (!targets.length) {
    return toast("⚠️ Tidak ada user untuk dikirimi pesan", "warning");
  }
  __asmTargets = targets;
  __asmIsBroadcast = broadcast;

  // Render recipient chips
  const list = $("#asmRecipientList");
  if (broadcast) {
    list.innerHTML = `<div class="asm-broadcast-chip">📢 Broadcast ke <b>${targets.length} user</b></div>`;
    $("#asmSubtitle").textContent = `Pesan ini akan dikirim ke seluruh ${targets.length} user terdaftar.`;
  } else {
    list.innerHTML = targets.map(u => {
      const init = u.slice(0, 2).toUpperCase();
      return `<div class="asm-chip"><span class="asm-chip-avatar">${init}</span>@${escapeHtml(u)}</div>`;
    }).join("");
    $("#asmSubtitle").textContent = targets.length === 1
      ? `Pesan akan masuk ke inbox @${targets[0]}.`
      : `Pesan akan dikirim ke ${targets.length} user.`;
  }

  $("#asmBody").value = "";
  updateAsmCharCount();
  $$(".asm-tpl").forEach(b => b.classList.remove("active"));
  $("#adminSendMsgModal").classList.add("show");
  setTimeout(() => $("#asmBody")?.focus(), 80);
}

function updateAsmCharCount() {
  const ta = $("#asmBody"); const c = $("#asmCharCount");
  if (!ta || !c) return;
  c.textContent = `${ta.value.length} / 500`;
}

// Tulis 1 pesan ke inbox `username`. Idempoten per-thread (cari thread by name = admin's username).
function deliverAdminMessage(username, text) {
  const key = `playly-state-${username}`;
  let s;
  try { s = JSON.parse(localStorage.getItem(key)); } catch { s = null; }
  if (!s) {
    // User belum punya state — buat shell minimal supaya pesan tidak hilang
    s = { messages: [] };
  }
  if (!Array.isArray(s.messages)) s.messages = [];

  const senderName = user?.username || "admin";
  const senderInit = (user?.name || senderName).slice(0, 2).toUpperCase();

  let thread = s.messages.find(m => m.name === senderName);
  if (!thread) {
    thread = {
      name: senderName, init: senderInit, isAdmin: true,
      preview: "", time: "baru", ts: Date.now(), unread: false, online: true, history: []
    };
    s.messages.unshift(thread);
  } else {
    // Pastikan thread ditandai sebagai admin & pindahkan ke atas
    thread.isAdmin = true;
    s.messages = [thread, ...s.messages.filter(m => m !== thread)];
  }
  const now = Date.now();
  thread.history.push({ from: "them", text, time: "baru", ts: now, isAdmin: true });
  thread.preview = text.length > 60 ? text.slice(0, 57) + "..." : text;
  thread.time = "baru";
  thread.ts = now;
  thread.unread = true;

  localStorage.setItem(key, JSON.stringify(s));

  // Kalau user yang sedang login adalah penerima (misal admin uji coba di tab sama),
  // refresh in-memory state agar UI live ikut update.
  if (user && user.username === username && Array.isArray(state?.messages)) {
    state.messages = s.messages;
    if (typeof renderMsgList === "function") renderMsgList();
  }
}

// Catat aksi kirim ke log audit admin
function logAdminMessageSent(targets, text) {
  const KEY = "playly-admin-sent";
  let log = [];
  try { log = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
  log.unshift({
    id: Date.now(),
    targets: targets.slice(0, 50),
    targetCount: targets.length,
    text: text.slice(0, 200),
    sentAt: new Date().toISOString(),
    by: user?.username || "admin"
  });
  localStorage.setItem(KEY, JSON.stringify(log.slice(0, 200)));
}

$("#asmBody")?.addEventListener("input", updateAsmCharCount);

$$(".asm-tpl").forEach(btn => {
  btn.addEventListener("click", () => {
    const tpl = btn.dataset.asmTpl;
    $$(".asm-tpl").forEach(b => b.classList.toggle("active", b === btn));
    const content = ADMIN_MSG_TEMPLATES[tpl] ?? "";
    $("#asmBody").value = content;
    updateAsmCharCount();
    $("#asmBody").focus();
  });
});

$("#asmSendBtn")?.addEventListener("click", () => {
  const text = $("#asmBody").value.trim();
  if (!text) return toast("⚠️ Pesan kosong", "warning");
  if (!__asmTargets.length) return;

  __asmTargets.forEach(u => deliverAdminMessage(u, text));
  logAdminMessageSent(__asmTargets, text);

  const n = __asmTargets.length;
  const eventLabel = __asmIsBroadcast
    ? `📢 Broadcast pesan ke <b>${n} user</b>`
    : n === 1
      ? `Kirim pesan ke <b>@${__asmTargets[0]}</b>`
      : `Kirim pesan ke <b>${n} user</b>`;
  pushAdminEvent("📨", eventLabel);
  renderAdminLiveFeed();

  toast(__asmIsBroadcast
    ? `📢 Broadcast terkirim ke <b>${n} user</b>`
    : n === 1
      ? `📨 Pesan terkirim ke <b>@${__asmTargets[0]}</b>`
      : `📨 Pesan terkirim ke <b>${n} user</b>`, "success");

  $("#adminSendMsgModal").classList.remove("show");
  __asmTargets = [];
  __asmIsBroadcast = false;
});

$("#adminBroadcastBtn")?.addEventListener("click", () => {
  openAdminSendMsg({ broadcast: true });
});

// =================== ANALYTICS & MONITORING ===================
// Aggregate metrics dari getPlatformVideos(): total views, watch time,
// bandwidth, traffic harian, top videos. Tidak ada tracking real-time
// karena tidak ada backend — angka diturunkan dari data video yang sungguh
// ada di localStorage agar konsisten & tidak menyesatkan.

const anState = { range: "24h" };

function anParseDuration(d) {
  if (!d) return 0;
  const parts = String(d).split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function anFormatBytes(bytes) {
  if (bytes < 1024) return Math.round(bytes) + " B";
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + " MB";
  if (bytes < 1024 ** 4) return (bytes / 1024 ** 3).toFixed(2) + " GB";
  return (bytes / 1024 ** 4).toFixed(2) + " TB";
}

function anFormatWatchTime(sec) {
  if (sec <= 0) return "0";
  if (sec < 60) return Math.floor(sec) + "s";
  if (sec < 3600) return Math.floor(sec / 60) + "m";
  if (sec < 86400) return (sec / 3600).toFixed(1) + "h";
  if (sec < 604800) return (sec / 86400).toFixed(1) + "d";
  return (sec / 604800).toFixed(1) + "w";
}

function anComputeMetrics() {
  const videos = getPlatformVideos();
  const totalViews = videos.reduce((s, v) => s + (v.viewsNum || 0), 0);
  const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
  // Watch time = views × duration × avg retention (60%)
  const totalWatchSec = videos.reduce((s, v) => s + (v.viewsNum || 0) * anParseDuration(v.duration) * 0.6, 0);
  // Bandwidth = views × duration × avg bitrate (~3.5 Mbps untuk 720p)
  const bandwidthBytes = videos.reduce((s, v) => s + (v.viewsNum || 0) * anParseDuration(v.duration) * (3.5 * 1e6 / 8), 0);
  // Engagement = likes / views (real ratio, no random multiplier)
  const engagementPct = totalViews > 0 ? (totalLikes / totalViews) * 100 : 0;
  return { videos, totalViews, totalLikes, totalWatchSec, bandwidthBytes, engagementPct };
}

function renderAnKPIs() {
  const m = anComputeMetrics();
  setKPI($("#anKpiTotalViews"), fmtNum(m.totalViews));
  $("#anKpiWatchTime") && ($("#anKpiWatchTime").textContent = anFormatWatchTime(m.totalWatchSec));
  $("#anKpiBandwidth") && ($("#anKpiBandwidth").textContent = anFormatBytes(m.bandwidthBytes));
  $("#anKpiEngagement") && ($("#anKpiEngagement").textContent = `${m.engagementPct.toFixed(1)}%`);
  $("#anKpiEngagementSub") && ($("#anKpiEngagementSub").textContent =
    m.totalViews > 0 ? `${fmtNum(m.totalLikes)} likes ÷ ${fmtNum(m.totalViews)} views` : "likes ÷ views");
  $("#anKpiTotalSub") && ($("#anKpiTotalSub").textContent = m.videos.length ? `dari ${m.videos.length} video` : "global");
}

// =================== KPI DETAIL MODAL ===================
// Klik kartu KPI di Analytics / Revenue → modal breakdown.
// Provider mengembalikan { icon, title, desc, value, valueSub, rows[], jump? }.
// rows[] elemen bisa: { type:"row", label, value } | { type:"section", label }
//                   | { type:"bar", label, value, pct }

function _kpiTopVideos(videos, key, fmtVal, limit = 5) {
  return [...videos]
    .filter(v => (v[key] || 0) > 0)
    .sort((a, b) => (b[key] || 0) - (a[key] || 0))
    .slice(0, limit)
    .map(v => ({
      type: "row",
      label: (v.title || "Untitled").slice(0, 48),
      value: fmtVal(v[key] || 0)
    }));
}

const KPI_DETAIL_PROVIDERS = {
  "an-views": () => {
    const m = anComputeMetrics();
    const avg = m.videos.length ? m.totalViews / m.videos.length : 0;
    const rows = [
      { type: "row", label: "Jumlah video aktif", value: fmtNum(m.videos.length) },
      { type: "row", label: "Rata-rata per video", value: fmtNum(Math.round(avg)) },
      { type: "row", label: "Total likes", value: fmtNum(m.totalLikes) },
    ];
    const top = _kpiTopVideos(m.videos, "viewsNum", fmtNum, 5);
    if (top.length) rows.push({ type: "section", label: "Top 5 video by views" }, ...top);
    return {
      icon: "👁️", title: "Total Views", desc: "Akumulasi views dari semua video di platform.",
      value: fmtNum(m.totalViews),
      valueSub: m.videos.length ? `dari ${m.videos.length} video` : "belum ada video",
      rows
    };
  },
  "an-watchtime": () => {
    const m = anComputeMetrics();
    const sec = m.totalWatchSec;
    const avgPerView = m.totalViews > 0 ? sec / m.totalViews : 0;
    const rows = [
      { type: "row", label: "Total (detik)", value: Math.round(sec).toLocaleString("id-ID") + " s" },
      { type: "row", label: "Total (menit)", value: (sec / 60).toFixed(0) + " menit" },
      { type: "row", label: "Total (jam)", value: (sec / 3600).toFixed(1) + " jam" },
      { type: "row", label: "Rata-rata per view", value: avgPerView > 0 ? avgPerView.toFixed(1) + " detik" : "—" },
      { type: "section", label: "Asumsi perhitungan" },
      { type: "row", label: "Avg retention", value: "60% durasi video" },
      { type: "row", label: "Formula", value: "views × durasi × 0.6" }
    ];
    return {
      icon: "⏱️", title: "Total Watch Time", desc: "Estimasi total durasi tonton (views × durasi × retention).",
      value: anFormatWatchTime(sec),
      valueSub: m.totalViews > 0 ? `dari ${fmtNum(m.totalViews)} views` : "belum ada views",
      rows
    };
  },
  "an-bandwidth": () => {
    const m = anComputeMetrics();
    const bytes = m.bandwidthBytes;
    const avgPerVideo = m.videos.length ? bytes / m.videos.length : 0;
    const rows = [
      { type: "row", label: "Total (byte)", value: Math.round(bytes).toLocaleString("id-ID") + " B" },
      { type: "row", label: "Total (MB)", value: (bytes / 1024 ** 2).toFixed(1) + " MB" },
      { type: "row", label: "Total (GB)", value: (bytes / 1024 ** 3).toFixed(2) + " GB" },
      { type: "row", label: "Rata-rata per video", value: anFormatBytes(avgPerVideo) },
      { type: "section", label: "Asumsi perhitungan" },
      { type: "row", label: "Bitrate rata-rata", value: "3.5 Mbps (720p)" },
      { type: "row", label: "Formula", value: "views × durasi × bitrate" }
    ];
    return {
      icon: "📡", title: "Bandwidth Estimasi", desc: "Estimasi konsumsi bandwidth dari semua views.",
      value: anFormatBytes(bytes),
      valueSub: m.videos.length ? `${m.videos.length} video, ${fmtNum(m.totalViews)} views` : "belum ada konsumsi",
      rows
    };
  },
  "an-engagement": () => {
    const m = anComputeMetrics();
    const rate = m.engagementPct;
    const rows = [
      { type: "row", label: "Total likes", value: fmtNum(m.totalLikes) },
      { type: "row", label: "Total views", value: fmtNum(m.totalViews) },
      { type: "row", label: "Rasio (likes / views)", value: rate.toFixed(2) + "%" },
      { type: "section", label: "Benchmark industri" },
      { type: "row", label: "Excellent", value: "≥ 6%" },
      { type: "row", label: "Good", value: "3% – 6%" },
      { type: "row", label: "Average", value: "1% – 3%" }
    ];
    if (m.videos.length) {
      const top = [...m.videos]
        .filter(v => (v.viewsNum || 0) > 0)
        .map(v => ({ ...v, _eng: ((v.likes || 0) / (v.viewsNum || 1)) * 100 }))
        .sort((a, b) => b._eng - a._eng)
        .slice(0, 5)
        .map(v => ({ type: "row", label: (v.title || "Untitled").slice(0, 48), value: v._eng.toFixed(1) + "%" }));
      if (top.length) rows.push({ type: "section", label: "Top 5 video engagement" }, ...top);
    }
    return {
      icon: "❤️", title: "Engagement Rate", desc: "Rasio likes terhadap views — indikator kualitas konten.",
      value: rate.toFixed(1) + "%",
      valueSub: m.totalViews > 0 ? `${fmtNum(m.totalLikes)} likes ÷ ${fmtNum(m.totalViews)} views` : "belum ada data",
      rows
    };
  },
  "rev-total": () => {
    const r = computeRevenueFromLedger();
    const adsPct = r.total > 0 ? (r.ads / r.total) * 100 : 0;
    const subPct = r.total > 0 ? (r.sub / r.total) * 100 : 0;
    const rows = [];
    if (r.isEmpty) {
      rows.push({ type: "row", label: "Status", value: "Belum ada transaksi" });
    } else {
      rows.push(
        { type: "row", label: "Total transaksi", value: r.ledger.length.toLocaleString("id-ID") },
        { type: "section", label: "Breakdown sumber" },
        { type: "bar", label: "Iklan (Ads)", value: fmtRp(r.ads), pct: adsPct },
        { type: "bar", label: "Subscription", value: fmtRp(r.sub), pct: subPct },
        { type: "section", label: "Distribusi" },
        { type: "row", label: "Platform (65%)", value: fmtRp(r.total - r.payout) },
        { type: "row", label: "Creator payout (35%)", value: fmtRp(r.payout) }
      );
    }
    return {
      icon: "💰", title: "Total Revenue", desc: "Akumulasi pendapatan dari ledger transaksi.",
      value: fmtRp(r.total),
      valueSub: r.isEmpty ? "menunggu transaksi pertama" : `${r.ledger.length} transaksi tercatat`,
      rows
    };
  },
  "rev-today": () => {
    const r = computeRevenueFromLedger();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayLedger = r.ledger.filter(l => l.ts >= todayStart);
    const todayAds = todayLedger.filter(l => (l.type || "").toLowerCase() === "ads")
      .reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const todaySub = todayLedger.filter(l => ["sub", "subscription"].includes((l.type || "").toLowerCase()))
      .reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const sharePct = r.total > 0 ? (r.today / r.total) * 100 : 0;
    const adsPct = r.today > 0 ? (todayAds / r.today) * 100 : 0;
    const subPct = r.today > 0 ? (todaySub / r.today) * 100 : 0;
    const rows = [];
    if (r.today <= 0) {
      rows.push({ type: "row", label: "Status", value: "Belum ada transaksi hari ini" });
    } else {
      rows.push(
        { type: "row", label: "Transaksi hari ini", value: todayLedger.length.toLocaleString("id-ID") },
        { type: "row", label: "% dari total revenue", value: sharePct.toFixed(1) + "%" },
        { type: "section", label: "Sumber hari ini" },
        { type: "bar", label: "Iklan", value: fmtRp(todayAds), pct: adsPct },
        { type: "bar", label: "Subscription", value: fmtRp(todaySub), pct: subPct }
      );
    }
    return {
      icon: "📅", title: "Pendapatan Hari Ini", desc: "Akumulasi sejak pukul 00:00 hari ini.",
      value: fmtRp(r.today),
      valueSub: r.today > 0 ? `${todayLedger.length} transaksi sejak 00:00` : "sejak 00:00",
      rows
    };
  },
  "rev-rate": () => {
    const r = computeRevenueFromLedger();
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recent = r.ledger.filter(l => l.ts >= fiveMinAgo);
    const recentSum = recent.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const projHour = r.rate * 60;
    const projDay = r.rate * 60 * 24;
    const rows = [];
    if (r.rate <= 0) {
      rows.push(
        { type: "row", label: "Status", value: "Tidak ada transaksi 5 menit terakhir" },
        { type: "row", label: "Window pengukuran", value: "5 menit terakhir" }
      );
    } else {
      rows.push(
        { type: "row", label: "Transaksi (5 menit terakhir)", value: recent.length.toLocaleString("id-ID") },
        { type: "row", label: "Total (5 menit terakhir)", value: fmtRp(recentSum) },
        { type: "section", label: "Proyeksi (asumsi rate konstan)" },
        { type: "row", label: "Per jam", value: fmtRp(projHour) },
        { type: "row", label: "Per 24 jam", value: fmtRp(projDay) }
      );
    }
    return {
      icon: "⚡", title: "Earnings Rate", desc: "Rata-rata pendapatan per menit dari transaksi 5 menit terakhir.",
      value: `${fmtRp(r.rate)}/menit`,
      valueSub: r.rate > 0 ? "diukur dari 5 menit terakhir" : "menunggu transaksi",
      rows
    };
  },
  "rev-payout": () => {
    const r = computeRevenueFromLedger();
    const platform = r.total - r.payout;
    const platformPct = r.total > 0 ? (platform / r.total) * 100 : 65;
    const payoutPct = r.total > 0 ? (r.payout / r.total) * 100 : 35;
    const rows = [
      { type: "section", label: "Pembagian revenue" },
      { type: "bar", label: "Platform (65%)", value: fmtRp(platform), pct: platformPct },
      { type: "bar", label: "Creator payout (35%)", value: fmtRp(r.payout), pct: payoutPct },
      { type: "section", label: "Skema kontrak" },
      { type: "row", label: "Share kreator", value: "35% dari revenue total" },
      { type: "row", label: "Share platform", value: "65% (operasional + margin)" },
      { type: "row", label: "Basis perhitungan", value: "Revenue ledger × 0.35" }
    ];
    return {
      icon: "🏦", title: "Creator Payouts", desc: "Estimasi payout kreator berdasarkan share 35%.",
      value: fmtRp(r.payout),
      valueSub: r.total > 0 ? `dari total ${fmtRp(r.total)}` : "menunggu revenue",
      rows
    };
  }
};

function openKpiDetail(key) {
  const provider = KPI_DETAIL_PROVIDERS[key];
  const modal = $("#kpiDetailModal");
  if (!provider || !modal) return;
  const data = provider();
  $("#kpiDetailIcon").textContent = data.icon || "📊";
  $("#kpiDetailTitle").textContent = data.title || "—";
  $("#kpiDetailDesc").textContent = data.desc || "";
  $("#kpiDetailValue").textContent = data.value || "—";
  $("#kpiDetailValueSub").textContent = data.valueSub || "";
  const body = $("#kpiDetailBody");
  if (!data.rows || !data.rows.length) {
    body.innerHTML = `<div class="kpi-detail-empty">Belum ada data untuk ditampilkan.</div>`;
  } else {
    body.innerHTML = data.rows.map(r => {
      if (r.type === "section") {
        return `<div class="kpi-detail-section">${escapeHtml(r.label)}</div>`;
      }
      if (r.type === "bar") {
        const pct = Math.max(0, Math.min(100, Number(r.pct) || 0));
        return `<div class="kpi-detail-bar">
          <div class="kpi-bar-row"><span>${escapeHtml(r.label)}</span><b>${escapeHtml(r.value)}</b></div>
          <div class="kpi-bar-track"><div class="kpi-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
        </div>`;
      }
      return `<div class="kpi-detail-row"><span>${escapeHtml(r.label)}</span><b>${escapeHtml(r.value)}</b></div>`;
    }).join("");
  }
  const jumpBtn = $("#kpiDetailJumpBtn");
  if (jumpBtn) {
    if (data.jump) {
      jumpBtn.hidden = false;
      jumpBtn.textContent = data.jumpLabel || "Lihat Selengkapnya";
      jumpBtn.dataset.jump = data.jump;
    } else {
      jumpBtn.hidden = true;
      delete jumpBtn.dataset.jump;
    }
  }
  modal.classList.add("show");
}

document.addEventListener("click", e => {
  const k = e.target.closest("[data-kpi]");
  if (!k) return;
  // Jangan trigger kalau klik berasal dari elemen interaktif di dalam card
  if (e.target.closest("a, button:not([data-close])")) return;
  e.preventDefault();
  openKpiDetail(k.dataset.kpi);
});
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const k = e.target.closest?.("[data-kpi][role='button'], [data-kpi][tabindex]");
  if (!k) return;
  e.preventDefault();
  openKpiDetail(k.dataset.kpi);
});

// ----------- Daily traffic series (deterministic distribution dari real totalViews) -----------
// ============== Real-time view bucket tracking ==============
// Setiap kali totalViews bertambah, delta-nya dicatat ke bucket jam saat ini.
// First-run di-seed dari createdAt video (timestamp asli) supaya chart tidak kosong.
const VIEW_BUCKETS_KEY = "playly:viewBuckets";
const VIEW_LAST_TOTAL_KEY = "playly:viewLastTotal";

function _vbLoad() {
  try { return JSON.parse(localStorage.getItem(VIEW_BUCKETS_KEY) || "{}"); }
  catch { return {}; }
}
function _vbSave(b) {
  try { localStorage.setItem(VIEW_BUCKETS_KEY, JSON.stringify(b)); } catch {}
}
function _vbHourKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}`;
}
function _vbSeedFromVideos(buckets) {
  getPlatformVideos().forEach(v => {
    const ts = v.createdAt || (typeof v.id === "number" && v.id > 1e12 ? v.id : Date.now());
    const k = _vbHourKey(new Date(ts));
    buckets[k] = (buckets[k] || 0) + (v.viewsNum || 0);
  });
}
function tickViewBuckets() {
  const totalNow = getPlatformVideos().reduce((s, v) => s + (v.viewsNum || 0), 0);
  const lastRaw = localStorage.getItem(VIEW_LAST_TOTAL_KEY);
  const buckets = _vbLoad();
  if (lastRaw === null) {
    _vbSeedFromVideos(buckets);
    _vbSave(buckets);
  } else {
    const delta = totalNow - (parseInt(lastRaw, 10) || 0);
    if (delta > 0) {
      const k = _vbHourKey(new Date());
      buckets[k] = (buckets[k] || 0) + delta;
      _vbSave(buckets);
    }
  }
  try { localStorage.setItem(VIEW_LAST_TOTAL_KEY, String(totalNow)); } catch {}
}

function anGenSeries(range /*, totalViews */) {
  tickViewBuckets();
  const buckets = _vbLoad();
  const now = new Date();

  if (range === "24h") {
    const labels = [], values = [];
    const dp = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`;
    for (let h = 0; h < 24; h++) {
      labels.push(`${pad2(h)}:00`);
      values.push(buckets[`${dp}T${pad2(h)}`] || 0);
    }
    return { labels, values };
  }

  const sumDay = (d) => {
    const dp = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
    let s = 0;
    for (let h = 0; h < 24; h++) s += (buckets[`${dp}T${pad2(h)}`] || 0);
    return s;
  };

  if (range === "7d") {
    const labels = [], values = [];
    const dayNames = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      labels.push(dayNames[d.getDay()]);
      values.push(sumDay(d));
    }
    return { labels, values };
  }

  // 30d
  const labels = [], values = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    labels.push(`${d.getDate()}`);
    values.push(sumDay(d));
  }
  return { labels, values };
}

function anRangeLabel(r) {
  return r === "24h" ? "24 jam terakhir" : r === "7d" ? "7 hari terakhir" : "30 hari terakhir";
}

// Common SVG chart drawing helpers
function anDrawAreaChart(svg, values, labels, opts = {}) {
  const W = 700, H = 200, PAD_L = opts.padL ?? 40, PAD_R = 14, PAD_T = 16, PAD_B = 28;
  const max = Math.max(...values, 1) * 1.1;
  const n = values.length;
  const stepX = (W - PAD_L - PAD_R) / Math.max(1, n - 1);
  const points = values.map((v, i) => [PAD_L + i * stepX, H - PAD_B - (v / max) * (H - PAD_T - PAD_B)]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(" ");
  const area = `${path} L ${points[n-1][0]} ${H - PAD_B} L ${points[0][0]} ${H - PAD_B} Z`;
  const fmt = opts.yFmt || (v => fmtNum(Math.round(v)));

  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const y = PAD_T + (i * (H - PAD_T - PAD_B) / 3);
    const val = max - (i * max / 3);
    grid += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="rgba(140,150,180,.1)" stroke-dasharray="2,4"/>`;
    grid += `<text x="${PAD_L - 6}" y="${y + 3}" fill="rgba(140,150,180,.6)" font-size="9" text-anchor="end" font-family="Inter">${fmt(val)}</text>`;
  }
  let xLabels = "";
  const labelStep = n > 14 ? Math.ceil(n / 8) : 1;
  labels.forEach((l, i) => {
    if (i % labelStep !== 0 && i !== n - 1) return;
    xLabels += `<text x="${PAD_L + i * stepX}" y="${H - PAD_B + 16}" fill="rgba(140,150,180,.6)" font-size="10" text-anchor="middle" font-family="Inter">${l}</text>`;
  });
  svg.innerHTML = `
    <defs>
      <linearGradient id="${opts.gradId || 'anG'}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#561C24"/><stop offset="100%" stop-color="#E8D8C4"/></linearGradient>
      <linearGradient id="${opts.gradId || 'anG'}Fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#561C24" stop-opacity=".35"/><stop offset="100%" stop-color="#E8D8C4" stop-opacity="0"/></linearGradient>
    </defs>
    ${grid}
    <path d="${area}" fill="url(#${opts.gradId || 'anG'}Fill)"/>
    <path d="${path}" fill="none" stroke="url(#${opts.gradId || 'anG'})" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${xLabels}
  `;
}

function anDrawBarChart(svg, values, labels, opts = {}) {
  const W = 700, H = 200, PAD_L = opts.padL ?? 50, PAD_R = 14, PAD_T = 16, PAD_B = 28;
  const max = Math.max(...values, 1) * 1.1;
  const n = values.length;
  const stepX = (W - PAD_L - PAD_R) / n;
  const barW = stepX * 0.65;
  const fmt = opts.yFmt || (v => fmtNum(Math.round(v)));

  let bars = "";
  values.forEach((v, i) => {
    const x = PAD_L + i * stepX + (stepX - barW) / 2;
    const h = (v / max) * (H - PAD_T - PAD_B);
    const y = H - PAD_B - h;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="url(#anBwG)" rx="2"/>`;
  });
  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const y = PAD_T + (i * (H - PAD_T - PAD_B) / 3);
    const val = max - (i * max / 3);
    grid += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="rgba(140,150,180,.08)" stroke-dasharray="2,4"/>`;
    grid += `<text x="${PAD_L - 6}" y="${y + 3}" fill="rgba(140,150,180,.6)" font-size="9" text-anchor="end" font-family="Inter">${fmt(val)}</text>`;
  }
  let xLabels = "";
  const labelStep = n > 14 ? Math.ceil(n / 8) : 1;
  labels.forEach((l, i) => {
    if (i % labelStep !== 0 && i !== n - 1) return;
    xLabels += `<text x="${PAD_L + i * stepX + stepX / 2}" y="${H - PAD_B + 16}" fill="rgba(140,150,180,.6)" font-size="10" text-anchor="middle" font-family="Inter">${l}</text>`;
  });
  svg.innerHTML = `
    <defs>
      <linearGradient id="anBwG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#E8D8C4"/><stop offset="100%" stop-color="#561C24"/></linearGradient>
    </defs>
    ${grid}${bars}${xLabels}
  `;
}

function drawAnTrafficChart() {
  const svg = $("#anTrafficChart"); if (!svg) return;
  const empty = $("#anTrafficEmpty");
  const m = anComputeMetrics();
  const series = anGenSeries(anState.range, m.totalViews);
  const total = series.values.reduce((s, v) => s + v, 0);
  $("#anTrafficTotal") && ($("#anTrafficTotal").textContent = `${fmtNum(total)} views`);
  $("#anTrafficSubtitle") && ($("#anTrafficSubtitle").textContent = anRangeLabel(anState.range));

  if (m.totalViews === 0) {
    svg.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  anDrawAreaChart(svg, series.values, series.labels, { gradId: "anTrG" });
}

function drawAnBandwidthChart() {
  const svg = $("#anBwChart"); if (!svg) return;
  const empty = $("#anBwEmpty");
  const m = anComputeMetrics();
  // Bandwidth per range = totalBytes × range_factor (estimasi linier)
  const rangeFactor = { "24h": 1/30, "7d": 7/30, "30d": 1 }[anState.range];
  const totalBwForRange = m.bandwidthBytes * rangeFactor;
  const series = anGenSeries(anState.range, m.totalViews);
  const sumViews = series.values.reduce((s, v) => s + v, 0) || 1;
  // Distribusikan bandwidth proporsional dengan distribusi traffic
  const bwSeries = series.values.map(v => totalBwForRange * v / sumViews);
  $("#anBwTotal") && ($("#anBwTotal").textContent = anFormatBytes(totalBwForRange));
  $("#anBwSubtitle") && ($("#anBwSubtitle").textContent = `Estimasi CDN • ${anRangeLabel(anState.range)}`);

  if (m.totalViews === 0) {
    svg.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  anDrawBarChart(svg, bwSeries, series.labels, { yFmt: anFormatBytes });
}

// ----------- Top videos & creators -----------
function renderAnTopVideos() {
  const allVideos = getPlatformVideos();
  renderAnTopVideosList(allVideos);
  renderAnTopCreatorsList(allVideos);
}

function renderAnTopVideosList(allVideos) {
  const list = $("#anTopList"); if (!list) return;
  const videos = allVideos.slice(0, 10);
  if (!videos.length) {
    list.innerHTML = `<div class="an-empty"><div class="an-empty-icon">🎬</div><h4>Belum ada video</h4><p>Top 10 akan muncul setelah ada video di platform.</p></div>`;
    return;
  }
  const maxViews = Math.max(...videos.map(v => v.viewsNum || 0), 1);
  list.innerHTML = videos.map((v, i) => {
    const pct = ((v.viewsNum || 0) / maxViews) * 100;
    const cat = CATEGORIES.find(c => c.key === v.category);
    return `<div class="an-top-row">
      <span class="an-rank rank-${i + 1}">${i + 1}</span>
      <div class="an-top-thumb"><img src="${v.thumb}" alt=""/></div>
      <div class="an-top-info">
        <strong>${escapeHtml(v.title || "(tanpa judul)")}</strong>
        <small>@${escapeHtml(v.creator || "—")} • ${cat ? cat.emoji + " " + cat.label : "—"} • ${v.duration || "0:00"}</small>
        <div class="an-top-bar"><div class="an-top-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
      </div>
      <div class="an-top-stats">
        <b>${fmtNum(v.viewsNum || 0)}</b><small>views</small>
      </div>
    </div>`;
  }).join("");
}

function renderAnTopCreatorsList(allVideos) {
  const list = $("#anTopCreatorsList"); if (!list) return;
  // Group videos by creator → sum views, count videos & likes
  const grouped = {};
  allVideos.forEach(v => {
    const k = v.creator || "—";
    grouped[k] = grouped[k] || { name: k, videos: 0, views: 0, likes: 0 };
    grouped[k].videos++;
    grouped[k].views += v.viewsNum || 0;
    grouped[k].likes += v.likes || 0;
  });
  const creators = Object.values(grouped).sort((a, b) => b.views - a.views).slice(0, 10);

  if (!creators.length) {
    list.innerHTML = `<div class="an-empty"><div class="an-empty-icon">👤</div><h4>Belum ada kreator</h4><p>Top creators akan muncul setelah ada video.</p></div>`;
    return;
  }
  const maxViews = Math.max(...creators.map(c => c.views), 1);
  list.innerHTML = creators.map((c, i) => {
    const pct = (c.views / maxViews) * 100;
    const init = c.name.slice(0, 2).toUpperCase();
    return `<div class="an-top-row">
      <span class="an-rank rank-${i + 1}">${i + 1}</span>
      <div class="an-top-thumb an-creator-avatar"><span>${escapeHtml(init)}</span></div>
      <div class="an-top-info">
        <strong>@${escapeHtml(c.name)}</strong>
        <small>${c.videos} video • ${fmtNum(c.likes)} likes</small>
        <div class="an-top-bar"><div class="an-top-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
      </div>
      <div class="an-top-stats">
        <b>${fmtNum(c.views)}</b><small>views</small>
      </div>
    </div>`;
  }).join("");
}

// ----------- Master render & lifecycle -----------
function renderAdminAnalytics() {
  renderAnKPIs();
  drawAnTrafficChart();
  drawAnBandwidthChart();
  renderAnTopVideos();
}

(function setupAnalyticsEvents() {
  if (window.__analyticsBound) return;
  window.__analyticsBound = true;
  $("#anRangeSelect")?.addEventListener("change", e => {
    anState.range = e.target.value;
    drawAnTrafficChart();
    drawAnBandwidthChart();
  });
})();

// =================== GLOBAL VIDEO CONTROL ===================
// Aggregates videos from all `playly-state-{username}` records, lets admin
// approve/reject/edit/takedown/delete and bulk-act on them.

const adminVideoState = {
  filter: "all",      // all | pending | published | rejected | takedown
  search: "",
  category: "",
  sort: "newest",
  selectMode: false,  // checkbox column hidden until admin opts in
  selected: new Set() // ids of selected videos
};

// Read all videos across every user's state, tagged with their owner key.
function getAllAdminVideos() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("playly-state-")) continue;
    const username = key.slice("playly-state-".length);
    let s;
    try { s = JSON.parse(localStorage.getItem(key)); } catch { continue; }
    if (!s || !Array.isArray(s.myVideos)) continue;
    s.myVideos.forEach(v => {
      out.push({ ...v, _ownerKey: key, _owner: username });
    });
  }
  return out;
}

// Update a single video by id inside its owner's playly-state record.
function patchAdminVideo(id, patch) {
  const all = getAllAdminVideos();
  const target = all.find(v => v.id === id);
  if (!target) return null;
  const s = JSON.parse(localStorage.getItem(target._ownerKey));
  const idx = (s.myVideos || []).findIndex(v => v.id === id);
  if (idx === -1) return null;
  Object.assign(s.myVideos[idx], patch);
  localStorage.setItem(target._ownerKey, JSON.stringify(s));
  // Also keep current session's in-memory state in sync if it's the logged-in user
  if (user && target._owner === user.username && Array.isArray(state?.myVideos)) {
    const liveIdx = state.myVideos.findIndex(v => v.id === id);
    if (liveIdx !== -1) Object.assign(state.myVideos[liveIdx], patch);
  }
  return s.myVideos[idx];
}

// Force-delete a video across all stores (state + IndexedDB blob).
function deleteAdminVideo(id) {
  const all = getAllAdminVideos();
  const target = all.find(v => v.id === id);
  if (!target) return false;
  const s = JSON.parse(localStorage.getItem(target._ownerKey));
  s.myVideos = (s.myVideos || []).filter(v => v.id !== id);
  localStorage.setItem(target._ownerKey, JSON.stringify(s));
  if (user && target._owner === user.username && Array.isArray(state?.myVideos)) {
    state.myVideos = state.myVideos.filter(v => v.id !== id);
  }
  // Remove blob from IndexedDB (best-effort)
  openVideoDB().then(db => {
    const tx = db.transaction(VIDEO_STORE, "readwrite");
    tx.objectStore(VIDEO_STORE).delete(id);
  }).catch(() => {});
  return true;
}

function countAdminPendingVideos() {
  return getAllAdminVideos().filter(v => (v.adminStatus || "pending") === "pending").length;
}

function getAdminVideoStatus(v) {
  // adminStatus values: pending | published | rejected | takedown
  return v.adminStatus || "pending";
}

function adminVideoStatusBadge(status) {
  const map = {
    pending:   { label: "Pending",   cls: "warn" },
    published: { label: "Published", cls: "ok" },
    rejected:  { label: "Rejected",  cls: "muted" },
    takedown:  { label: "Takedown",  cls: "bad" }
  };
  const m = map[status] || map.pending;
  return `<span class="gv-status ${m.cls}">${m.label}</span>`;
}

function renderAdminVideos() {
  const tbody = $("#adminVideoTbody"); if (!tbody) return;

  // Reflect select mode in DOM (CSS shows/hides the checkbox column).
  const section = $("section[data-view='admin-videos']");
  if (section) section.classList.toggle("gv-select-mode", adminVideoState.selectMode);
  const toggleBtn = $("#adminVideoSelectToggle");
  if (toggleBtn) {
    toggleBtn.classList.toggle("active", adminVideoState.selectMode);
    toggleBtn.textContent = adminVideoState.selectMode ? "✕ Batal Pilih" : "☑ Pilih";
  }

  const all = getAllAdminVideos();

  // Stats (always reflect totals, not filtered set)
  $("#gvStatTotal") && ($("#gvStatTotal").textContent = all.length);
  $("#gvStatPending") && ($("#gvStatPending").textContent = all.filter(v => getAdminVideoStatus(v) === "pending").length);
  $("#gvStatPublished") && ($("#gvStatPublished").textContent = all.filter(v => getAdminVideoStatus(v) === "published").length);
  $("#gvStatTakedown") && ($("#gvStatTakedown").textContent = all.filter(v => getAdminVideoStatus(v) === "takedown").length);

  // Populate category dropdown once with currently used categories
  const catSel = $("#gvCategoryFilter");
  if (catSel && !catSel.dataset.populated) {
    CATEGORIES.forEach(c => {
      const o = document.createElement("option");
      o.value = c.key; o.textContent = `${c.emoji} ${c.label}`;
      catSel.appendChild(o);
    });
    catSel.dataset.populated = "1";
  }

  // Apply filters
  let list = all.slice();
  if (adminVideoState.filter !== "all") {
    list = list.filter(v => getAdminVideoStatus(v) === adminVideoState.filter);
  }
  if (adminVideoState.category) {
    list = list.filter(v => (v.category || "") === adminVideoState.category);
  }
  const q = (adminVideoState.search || "").toLowerCase().trim();
  if (q) {
    list = list.filter(v =>
      (v.title || "").toLowerCase().includes(q) ||
      (v.creator || "").toLowerCase().includes(q) ||
      (v.desc || "").toLowerCase().includes(q) ||
      (v.tags || "").toLowerCase().includes(q)
    );
  }

  // Sort
  const sorters = {
    newest: (a, b) => (b.id || 0) - (a.id || 0),
    oldest: (a, b) => (a.id || 0) - (b.id || 0),
    views:  (a, b) => (b.viewsNum || 0) - (a.viewsNum || 0),
    likes:  (a, b) => (b.likes || 0) - (a.likes || 0),
    title:  (a, b) => (a.title || "").localeCompare(b.title || "")
  };
  list.sort(sorters[adminVideoState.sort] || sorters.newest);

  const empty = $("#gvEmpty");
  if (!list.length) {
    tbody.innerHTML = "";
    if (empty) empty.hidden = false;
  } else {
    if (empty) empty.hidden = true;
    tbody.innerHTML = list.map(v => {
      const status = getAdminVideoStatus(v);
      const cat = CATEGORIES.find(c => c.key === v.category);
      const catLabel = cat ? `${cat.emoji} ${cat.label}` : `<span class="muted">—</span>`;
      const checked = adminVideoState.selected.has(v.id) ? "checked" : "";
      const thumb = v.thumb || "https://picsum.photos/seed/playly/120/72";
      return `<tr data-vid="${v.id}" class="${checked ? "gv-row-selected" : ""}">
        <td class="gv-col-check"><input type="checkbox" class="gv-row-check" ${checked}/></td>
        <td>
          <div class="gv-video-cell" data-gv-act="play" title="Play video">
            <div class="gv-thumb">
              <img src="${thumb}" alt=""/>
              <span class="gv-thumb-play">▶</span>
            </div>
            <div class="gv-video-meta">
              <strong title="${escapeHtml(v.title || "")}">${escapeHtml(v.title || "(tanpa judul)")}</strong>
              <small>${escapeHtml(v.duration || "0:00")} • ${escapeHtml(v.visibility || "public")}</small>
            </div>
          </div>
        </td>
        <td><span class="gv-creator">@${escapeHtml(v.creator || v._owner || "—")}</span></td>
        <td>${catLabel}</td>
        <td>${fmtNum(v.viewsNum || 0)}</td>
        <td>${fmtNum(v.likes || 0)}</td>
        <td>${adminVideoStatusBadge(status)}</td>
        <td><small class="muted">${escapeHtml(v.time || "—")}</small></td>
        <td>
          <div class="row-actions gv-actions">
            ${status === "pending" ? `<button title="Approve" class="gv-act-approve" data-gv-act="approve">✓</button>` : ""}
            ${status === "pending" ? `<button title="Reject" class="gv-act-reject" data-gv-act="reject">✕</button>` : ""}
            ${status !== "published" ? `<button title="Publish" data-gv-act="publish">📢</button>` : ""}
            ${status !== "takedown" ? `<button title="Takedown" class="danger" data-gv-act="takedown">⛔</button>` : `<button title="Restore" data-gv-act="restore">↻</button>`}
            <button title="Edit metadata" data-gv-act="edit">✏️</button>
            <button title="Force delete" class="danger" data-gv-act="delete">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  // Sync bulk bar
  updateGvBulkBar();
  syncAdminNavBadges();
}

function updateGvBulkBar() {
  const bar = $("#gvBulkBar"); if (!bar) return;
  const n = adminVideoState.selected.size;
  bar.hidden = !adminVideoState.selectMode || n === 0;
  const c = $("#gvSelectedCount"); if (c) c.textContent = n;
  const all = $("#gvSelectAll");
  if (all) {
    const rows = $$("#adminVideoTbody .gv-row-check").length;
    all.checked = rows > 0 && n >= rows;
    all.indeterminate = n > 0 && n < rows;
  }
}

function applyGvBulkAction(action) {
  const ids = [...adminVideoState.selected];
  if (!ids.length) return;
  const map = {
    approve:  { patch: { adminStatus: "published" }, icon: "✓",  msg: "di-approve" },
    reject:   { patch: { adminStatus: "rejected"  }, icon: "✕",  msg: "di-reject" },
    publish:  { patch: { adminStatus: "published" }, icon: "📢", msg: "dipublish" },
    takedown: { patch: { adminStatus: "takedown"  }, icon: "⛔", msg: "di-takedown" }
  };
  if (action === "delete") {
    openConfirm({
      icon: "🗑️", iconClass: "danger",
      title: `Hapus ${ids.length} video?`,
      desc: `<b>${ids.length}</b> video akan dihapus permanen dari platform. Aksi ini tidak bisa dibatalkan.`,
      btnText: "Hapus Semua", btnClass: "danger",
      onConfirm: () => {
        ids.forEach(id => deleteAdminVideo(id));
        pushAdminEvent("🗑️", `Force delete <b>${ids.length} video</b> via bulk action`);
        adminVideoState.selected.clear();
        toast(`🗑️ ${ids.length} video dihapus`, "error");
        renderAdminVideos();
        renderAdminLiveFeed();
      }
    });
    return;
  }
  const cfg = map[action]; if (!cfg) return;
  ids.forEach(id => patchAdminVideo(id, cfg.patch));
  pushAdminEvent(cfg.icon, `${ids.length} video ${cfg.msg} via bulk action`);
  adminVideoState.selected.clear();
  toast(`${cfg.icon} ${ids.length} video ${cfg.msg}`, action === "takedown" || action === "reject" ? "warning" : "success");
  renderAdminVideos();
  renderAdminLiveFeed();
}

function applyGvRowAction(id, action) {
  const v = getAllAdminVideos().find(x => x.id === id);
  if (!v) return;
  const titleEsc = escapeHtml(v.title || "(tanpa judul)");
  const simple = {
    approve:  { patch: { adminStatus: "published" }, icon: "✓",  msg: "di-approve",   tone: "success" },
    reject:   { patch: { adminStatus: "rejected"  }, icon: "✕",  msg: "di-reject",    tone: "warning" },
    publish:  { patch: { adminStatus: "published" }, icon: "📢", msg: "dipublish",    tone: "success" },
    takedown: { patch: { adminStatus: "takedown"  }, icon: "⛔", msg: "di-takedown",  tone: "warning" },
    restore:  { patch: { adminStatus: "pending"   }, icon: "↻",  msg: "dikembalikan", tone: "" }
  };
  if (simple[action]) {
    const c = simple[action];
    patchAdminVideo(id, c.patch);
    pushAdminEvent(c.icon, `Video <i>"${titleEsc}"</i> ${c.msg}`);
    toast(`${c.icon} <b>${titleEsc}</b> ${c.msg}`, c.tone);
    renderAdminVideos();
    renderAdminLiveFeed();
    return;
  }
  if (action === "delete") {
    openConfirm({
      icon: "🗑️", iconClass: "danger",
      title: "Force Delete Video?",
      desc: `Video <b>${titleEsc}</b> akan dihapus permanen dari akun <b>@${escapeHtml(v.creator || v._owner)}</b>. Aksi ini tidak bisa dibatalkan.`,
      btnText: "Hapus Permanen", btnClass: "danger",
      onConfirm: () => {
        deleteAdminVideo(id);
        pushAdminEvent("🗑️", `Force delete video <i>"${titleEsc}"</i> dari <b>@${escapeHtml(v.creator || v._owner)}</b>`);
        toast(`🗑️ <b>${titleEsc}</b> dihapus permanen`, "error");
        renderAdminVideos();
        renderAdminLiveFeed();
      }
    });
    return;
  }
  if (action === "edit") {
    openAdminVideoEdit(v);
    return;
  }
  if (action === "play") {
    openPlayer(id);
  }
}

// ----- Edit metadata modal -----
let __aveCurrent = null;

function openAdminVideoEdit(v) {
  __aveCurrent = v;
  const modal = $("#adminVideoEditModal"); if (!modal) return;
  $("#aveTitle").value = v.title || "";
  $("#aveDesc").value = v.desc || "";
  $("#aveTags").value = v.tags || "";
  $("#aveVisibility").value = v.visibility || "public";
  $("#aveCreator").textContent = `@${v.creator || v._owner || "—"}`;
  $("#aveStats").textContent = `${fmtNum(v.viewsNum || 0)} views • ${fmtNum(v.likes || 0)} likes`;
  $("#aveThumb").src = v.thumb || "https://picsum.photos/seed/playly/240/140";

  const catSel = $("#aveCategory");
  catSel.innerHTML = `<option value="">— Tanpa Kategori —</option>` +
    CATEGORIES.map(c => `<option value="${c.key}">${c.emoji} ${c.label}</option>`).join("");
  catSel.value = v.category || "";

  $("#aveSubtitle").innerHTML = `Editing: <b>${escapeHtml(v.title || "(tanpa judul)")}</b>`;
  modal.classList.add("show");
}

$("#aveSaveBtn")?.addEventListener("click", () => {
  if (!__aveCurrent) return;
  const patch = {
    title:      $("#aveTitle").value.trim() || __aveCurrent.title,
    desc:       $("#aveDesc").value.trim(),
    tags:       $("#aveTags").value.trim(),
    category:   $("#aveCategory").value,
    visibility: $("#aveVisibility").value
  };
  patchAdminVideo(__aveCurrent.id, patch);
  pushAdminEvent("✏️", `Metadata video <i>"${escapeHtml(patch.title)}"</i> diupdate`);
  toast(`💾 <b>${escapeHtml(patch.title)}</b> berhasil diupdate`, "success");
  $("#adminVideoEditModal").classList.remove("show");
  __aveCurrent = null;
  renderAdminVideos();
  renderAdminLiveFeed();
});

// ----- Event delegation for the admin-videos view -----
function setupAdminVideoEvents() {
  if (window.__adminVideoEventsBound) return;
  window.__adminVideoEventsBound = true;

  // Tab filter
  document.addEventListener("click", e => {
    const tab = e.target.closest(".gv-tab");
    if (!tab) return;
    $$(".gv-tab").forEach(t => t.classList.toggle("active", t === tab));
    adminVideoState.filter = tab.dataset.gvFilter;
    adminVideoState.selected.clear();
    renderAdminVideos();
  });

  // Search & dropdowns
  $("#adminVideoSearch")?.addEventListener("input", e => {
    adminVideoState.search = e.target.value;
    renderAdminVideos();
  });
  $("#gvCategoryFilter")?.addEventListener("change", e => {
    adminVideoState.category = e.target.value;
    renderAdminVideos();
  });
  $("#gvSortBy")?.addEventListener("change", e => {
    adminVideoState.sort = e.target.value;
    renderAdminVideos();
  });
  // Toggle select mode — checkbox column tampil hanya saat dibutuhkan
  $("#adminVideoSelectToggle")?.addEventListener("click", () => {
    adminVideoState.selectMode = !adminVideoState.selectMode;
    if (!adminVideoState.selectMode) adminVideoState.selected.clear();
    renderAdminVideos();
  });

  // Row + bulk action delegation (lives on tbody, which is stable)
  const tbody = $("#adminVideoTbody");
  if (tbody) {
    tbody.addEventListener("click", e => {
      const actBtn = e.target.closest("[data-gv-act]");
      if (actBtn) {
        e.stopPropagation();
        const id = Number(actBtn.closest("tr").dataset.vid);
        applyGvRowAction(id, actBtn.dataset.gvAct);
        return;
      }
      const check = e.target.closest(".gv-row-check");
      if (check) {
        const id = Number(check.closest("tr").dataset.vid);
        if (check.checked) adminVideoState.selected.add(id);
        else adminVideoState.selected.delete(id);
        check.closest("tr").classList.toggle("gv-row-selected", check.checked);
        updateGvBulkBar();
        return;
      }
    });
  }

  $("#gvSelectAll")?.addEventListener("change", e => {
    const rows = $$("#adminVideoTbody tr");
    if (e.target.checked) {
      rows.forEach(r => adminVideoState.selected.add(Number(r.dataset.vid)));
    } else {
      adminVideoState.selected.clear();
    }
    renderAdminVideos();
  });

  $("#gvClearSel")?.addEventListener("click", () => {
    adminVideoState.selected.clear();
    renderAdminVideos();
  });

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-gv-bulk]");
    if (!b) return;
    applyGvBulkAction(b.dataset.gvBulk);
  });
}
setupAdminVideoEvents();

function renderAdminModeration() {
  const grid = $("#adminModGrid"); if (!grid) return;
  const filter = $(".mod-tab.active")?.dataset.modFilter || "pending";
  const items = getAdminData("mod").filter(m => m.status === filter);

  // Update tab counts
  const all = getAdminData("mod");
  const counts = { pending: all.filter(m => m.status === "pending").length, approved: all.filter(m => m.status === "approved").length, removed: all.filter(m => m.status === "removed").length };
  $$(".mod-tab").forEach(t => {
    const f = t.dataset.modFilter;
    const bEl = t.querySelector("b");
    if (bEl) bEl.textContent = counts[f] || 0;
    else if (counts[f]) t.insertAdjacentHTML("beforeend", `<b>${counts[f]}</b>`);
  });

  if (!items.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--muted)">✓ Tidak ada item ${filter}</div>`;
    return;
  }

  grid.innerHTML = items.map(i => `<div class="mod-card" data-mod-id="${i.id}">
    <div class="mod-thumb">${i.thumb}<span class="mod-flag-pill">${i.flag}</span></div>
    <div class="mod-card-body">
      <h4>${i.title}</h4>
      <small>${i.creator} • ${relTime(i.reportedAt)}</small>
      <div class="mod-reason">⚠️ ${i.reason}</div>
      ${i.status === "pending" ? `<div class="mod-actions">
        <button class="approve" data-mod-action="approve">✓ Approve</button>
        <button class="remove" data-mod-action="remove">✕ Hapus</button>
      </div>` : `<div class="mod-actions"><button data-mod-action="restore">↻ Restore ke Pending</button></div>`}
    </div>
  </div>`).join("");

  grid.querySelectorAll("[data-mod-action]").forEach(b => {
    b.addEventListener("click", e => {
      const id = Number(e.currentTarget.closest(".mod-card").dataset.modId);
      const action = e.currentTarget.dataset.modAction;
      const list = getAdminData("mod");
      const idx = list.findIndex(x => x.id === id);
      if (idx === -1) return;
      const item = list[idx];
      if (action === "approve") { item.status = "approved"; pushAdminEvent("✓", `Video <i>"${item.title}"</i> di-approve`); }
      if (action === "remove") { item.status = "removed"; pushAdminEvent("🗑️", `Video <i>"${item.title}"</i> dihapus`); }
      if (action === "restore") { item.status = "pending"; pushAdminEvent("↻", `Video <i>"${item.title}"</i> dikembalikan ke pending`); }
      saveAdminData("mod", list);
      toast(action === "approve" ? "✓ Video disetujui" : action === "remove" ? "🗑️ Video dihapus" : "↻ Restored", action === "remove" ? "error" : "success");
      renderAdminModeration();
      renderAdminAlerts();
      renderAdminLiveFeed();
      syncAdminNavBadges();
    });
  });
}

// =========== ADMIN: Pusat Komunikasi (admin-comms) ===========
function renderAdminComms() {
  if (!user || user.role !== "admin") return;
  renderCommsKpis();
  renderCommsInbox();
  renderCommsBroadcastLog();
  renderCommsUserList(($("#commsUserSearch")?.value || "").trim().toLowerCase());
}

// Filter aktif untuk inbox: "all" | "unread" | "read"
let __commsInboxFilter = "all";

// Pesan Masuk: flatten semua history dari thread admin → list pesan masuk
// (yang dikirim user ke admin), urut berdasar waktu terbaru.
function renderCommsInbox() {
  const list = $("#commsInboxList");
  if (!list) return;
  const threads = Array.isArray(state?.messages) ? state.messages : [];

  // Kumpulkan semua incoming message (from !== "me") dari semua thread
  const inbox = [];
  threads.forEach((thread, threadIdx) => {
    const history = Array.isArray(thread.history) ? thread.history : [];
    history.forEach((h, msgIdx) => {
      if (!h || h.from === "me") return; // skip pesan keluar (admin → user)
      inbox.push({
        threadIdx, msgIdx,
        senderName: h.from || thread.name || "user",
        senderInit: thread.init || (thread.name || "U").slice(0, 2).toUpperCase(),
        text: String(h.text || ""),
        ts: typeof h.ts === "number" ? h.ts : 0,
        threadUnread: !!thread.unread
      });
    });
  });
  // Urut: terbaru di atas
  inbox.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  // Counter total (sebelum filter)
  const countEl = $("#commsInboxCount");
  if (countEl) countEl.textContent = inbox.length;

  // Apply filter
  let filtered = inbox;
  if (__commsInboxFilter === "unread") filtered = inbox.filter(m => m.threadUnread);
  else if (__commsInboxFilter === "read") filtered = inbox.filter(m => !m.threadUnread);

  if (!filtered.length) {
    const emptyMsg = __commsInboxFilter === "unread"
      ? "Tidak ada pesan yang belum dibaca."
      : __commsInboxFilter === "read"
        ? "Tidak ada pesan yang sudah dibaca."
        : "Belum ada pesan masuk dari user.";
    list.innerHTML = `<div class="comms-empty">
      <div class="comms-empty-icon">📭</div>
      ${emptyMsg}
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(m => {
    const init = escapeHtml(m.senderInit);
    const preview = escapeHtml(m.text.slice(0, 120));
    const time = chatRelTime(m.ts);
    return `<div class="comms-inbox-item ${m.threadUnread ? "unread" : ""}" data-thread-idx="${m.threadIdx}" data-msg-idx="${m.msgIdx}">
      <div class="avatar"><span>${init}</span></div>
      <div class="comms-inbox-info">
        <strong>@${escapeHtml(m.senderName)}</strong>
        <small>${preview}</small>
      </div>
      <div class="comms-inbox-meta">
        ${time ? `<small>${time}</small>` : ""}
        ${m.threadUnread ? `<span class="badge">unread</span>` : ""}
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll("[data-thread-idx]").forEach(el => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.threadIdx);
      if (Number.isNaN(idx) || !state.messages[idx]) return;
      switchView("messages");
      setTimeout(() => openChat(idx), 80);
    });
  });
}

// Bind filter buttons (idempotent)
(function bindInboxFilters() {
  if (window.__inboxFiltersBound) return;
  window.__inboxFiltersBound = true;
  document.addEventListener("click", e => {
    const btn = e.target.closest(".comms-inbox-filter");
    if (!btn) return;
    const f = btn.dataset.inboxFilter || "all";
    __commsInboxFilter = f;
    document.querySelectorAll(".comms-inbox-filter").forEach(b => {
      b.classList.toggle("active", b.dataset.inboxFilter === f);
    });
    renderCommsInbox();
  });
})();

function renderCommsKpis() {
  const threads = Array.isArray(state?.messages) ? state.messages : [];
  const unread = threads.filter(t => t.unread).length;
  let bcCount = 0;
  try { bcCount = (JSON.parse(localStorage.getItem("playly-admin-sent") || "[]") || []).length; } catch {}
  const userCount = getAllAccounts().filter(a => a.role !== "admin").length;

  $("#commsKpiUnread")  && ($("#commsKpiUnread").textContent  = unread);
  $("#commsKpiBroadcasts") && ($("#commsKpiBroadcasts").textContent = bcCount);
  $("#commsKpiUsers") && ($("#commsKpiUsers").textContent = userCount);

  // Sidebar badge — total unread
  const badge = $("#adminCommsBadge");
  if (badge) { badge.textContent = unread; badge.style.display = unread ? "" : "none"; }
}

function renderCommsThreads() {
  const list = $("#commsThreadList"); if (!list) return;
  const threads = Array.isArray(state?.messages) ? state.messages.slice() : [];
  // Sort by ts desc (terbaru di atas), fallback ke posisi asli
  threads.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  if (!threads.length) {
    list.innerHTML = `<div class="comms-empty">
      <div class="comms-empty-icon">💬</div>
      Belum ada conversation. Mulai chat dari panel kanan.
    </div>`;
    return;
  }

  list.innerHTML = threads.map((t, i) => {
    const idx = state.messages.indexOf(t);
    const init = escapeHtml(t.init || (t.name || "U").slice(0, 2).toUpperCase());
    const preview = escapeHtml((t.preview || "—").slice(0, 80));
    const time = chatRelTime(t.ts);
    return `<div class="comms-thread-item" data-comms-thread="${idx}">
      <div class="avatar"><span>${init}</span></div>
      <div class="comms-thread-info">
        <strong>@${escapeHtml(t.name)}</strong>
        <small>${preview}</small>
      </div>
      <div class="comms-thread-meta">
        ${time ? `<small>${time}</small>` : ""}
        ${t.unread ? `<span class="badge">unread</span>` : ""}
      </div>
    </div>`;
  }).join("");

  list.querySelectorAll("[data-comms-thread]").forEach(el => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.commsThread);
      if (Number.isNaN(idx) || !state.messages[idx]) return;
      switchView("messages");
      setTimeout(() => openChat(idx), 80);
    });
  });
}

function renderCommsBroadcastLog() {
  const list = $("#commsBroadcastLog"); if (!list) return;
  let log = [];
  try { log = JSON.parse(localStorage.getItem("playly-admin-sent") || "[]") || []; } catch {}
  if (!log.length) {
    list.innerHTML = `<div class="comms-empty">
      <div class="comms-empty-icon">📢</div>
      Belum ada broadcast yang dikirim.
    </div>`;
    return;
  }
  list.innerHTML = log.slice(0, 30).map(item => {
    const ts = item.sentAt ? new Date(item.sentAt).getTime() : item.id;
    const time = chatRelTime(ts) || "—";
    const targetLabel = item.targetCount > 1
      ? `📢 Broadcast ke <b>${item.targetCount}</b> user`
      : `→ <b>@${escapeHtml((item.targets && item.targets[0]) || "user")}</b>`;
    return `<div class="comms-bc-item">
      <div class="comms-bc-head">
        <span class="comms-bc-target">${targetLabel}</span>
        <span class="comms-bc-time">${time}</span>
      </div>
      <div class="comms-bc-text">${escapeHtml(item.text || "")}</div>
    </div>`;
  }).join("");
}

function renderCommsUserList(query = "") {
  const list = $("#commsUserList"); if (!list) return;
  const myUsername = user?.username;
  const accounts = getAllAccounts()
    .filter(a => a.username !== myUsername)
    .filter(a => !query || (a.name || "").toLowerCase().includes(query) || (a.username || "").toLowerCase().includes(query))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  if (!accounts.length) {
    list.innerHTML = `<div class="comms-empty">
      <div class="comms-empty-icon">👥</div>
      ${query ? "Tidak ada user yang cocok." : "Belum ada user terdaftar."}
    </div>`;
    return;
  }

  list.innerHTML = accounts.slice(0, 50).map(a => {
    const init = (a.name || a.username || "U").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
    const isAdmin = a.role === "admin";
    return `<div class="comms-user-item">
      <div class="avatar"><span>${escapeHtml(init)}</span></div>
      <div class="info">
        <strong>${escapeHtml(a.name || a.username)} ${isAdmin ? '<span class="role-tag admin">ADMIN</span>' : ''}</strong>
        <small>@${escapeHtml(a.username)}</small>
      </div>
      <button data-comms-msg="${escapeHtml(a.username)}">💬 Chat</button>
    </div>`;
  }).join("");

  list.querySelectorAll("[data-comms-msg]").forEach(b => {
    b.addEventListener("click", () => startChatWithUser(b.dataset.commsMsg));
  });
}

// Wire up event handlers (one-time)
$("#commsBroadcastBtn")?.addEventListener("click", () => openAdminSendMsg({ broadcast: true }));
$("#commsBroadcastBtn2")?.addEventListener("click", () => openAdminSendMsg({ broadcast: true }));

// =========== ADMIN: Audit Log (admin-audit) ===========
let __auditFilter = "all";

function getAuditEvents() {
  // Gabungkan event admin (pushAdminEvent) + broadcast log → satu timeline
  const events = (getAdminData("events") || []).map(e => ({
    id: `evt-${e.id}`,
    ico: e.ico || "•",
    text: e.text || "",
    ts: Number(e.ts) || 0
  }));
  let bc = [];
  try { bc = JSON.parse(localStorage.getItem("playly-admin-sent") || "[]") || []; } catch {}
  for (const item of bc) {
    const ts = item.sentAt ? new Date(item.sentAt).getTime() : Number(item.id) || 0;
    const target = item.targetCount > 1
      ? `<b>${item.targetCount} user</b>`
      : `<b>@${escapeHtml((item.targets && item.targets[0]) || "user")}</b>`;
    events.push({
      id: `bc-${item.id || ts}`,
      ico: "📨",
      text: `Broadcast/DM ke ${target}: <i>"${escapeHtml((item.text || "").slice(0, 120))}${(item.text || "").length > 120 ? "..." : ""}"</i>`,
      ts
    });
  }
  events.sort((a, b) => b.ts - a.ts);
  return events;
}

function applyAuditFilter(events, filter) {
  const now = Date.now();
  if (filter === "today") {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    return events.filter(e => e.ts >= startOfDay.getTime());
  }
  if (filter === "week")  return events.filter(e => now - e.ts <= 7 * 86400000);
  if (filter === "month") return events.filter(e => now - e.ts <= 30 * 86400000);
  return events;
}

function renderAuditStats(allEvents) {
  const now = Date.now();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const today = allEvents.filter(e => e.ts >= startOfDay.getTime()).length;
  const week  = allEvents.filter(e => now - e.ts <= 7 * 86400000).length;
  let bcCount = 0;
  try { bcCount = (JSON.parse(localStorage.getItem("playly-admin-sent") || "[]") || []).length; } catch {}

  $("#auditStatToday")      && ($("#auditStatToday").textContent = today);
  $("#auditStatWeek")       && ($("#auditStatWeek").textContent  = week);
  $("#auditStatTotal")      && ($("#auditStatTotal").textContent = allEvents.length);
  $("#auditStatBroadcasts") && ($("#auditStatBroadcasts").textContent = bcCount);

  // Sidebar badge — total aksi hari ini
  const badge = $("#adminAuditBadge");
  if (badge) { badge.textContent = today; badge.style.display = today ? "" : "none"; }
}

function renderAuditTimeline(filter, query) {
  const list = $("#auditTimeline"); if (!list) return;
  const all = getAuditEvents();
  renderAuditStats(all);

  let filtered = applyAuditFilter(all, filter);
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(e => (e.text || "").toLowerCase().includes(q) || (e.ico || "").toLowerCase().includes(q));
  }

  if (!filtered.length) {
    list.innerHTML = `<div class="audit-empty">
      <div class="audit-empty-icon">📋</div>
      <p>${query ? `Tidak ada log yang cocok dengan "<b>${escapeHtml(query)}</b>".` : "Belum ada aksi tercatat di periode ini."}</p>
    </div>`;
    return;
  }

  list.innerHTML = filtered.slice(0, 200).map(e => `
    <div class="audit-row">
      <div class="audit-icon">${e.ico}</div>
      <div class="audit-text">${e.text}</div>
      <small class="audit-time" title="${new Date(e.ts).toLocaleString("id-ID")}">${chatRelTime(e.ts) || "—"}</small>
    </div>
  `).join("");
}

function renderAdminAudit() {
  if (!user || user.role !== "admin") return;
  const search = ($("#auditSearch")?.value || "").trim();
  renderAuditTimeline(__auditFilter, search);
}

// Wire up handlers (one-time)
$$(".audit-filter").forEach(b => {
  b.addEventListener("click", () => {
    $$(".audit-filter").forEach(x => x.classList.toggle("active", x === b));
    __auditFilter = b.dataset.auditFilter || "all";
    renderAdminAudit();
  });
});
$("#auditSearch")?.addEventListener("input", () => renderAdminAudit());

// =================== INBOX (Email + Live Chat + Bug Reports) ===================
function renderAdminInbox() {
  const wrap = $('[data-view="admin-inbox"]');
  if (!wrap) return;

  const tickets = [...getAdminData("tickets")].sort((a, b) => b.createdAt - a.createdAt);
  const bugs = [...getAdminData("bugs")].sort((a, b) => b.createdAt - a.createdAt);
  // Email column = semua tiket dari Email Support modal
  const emailTickets = tickets.filter(t => t.type !== "chat" && t.ch !== "💬");

  // Live Chat column = thread chat real dari state.messages (admin's conversations).
  // Tiap thread: { name, init, unread, history:[{from, text, ts}, ...] }
  const threads = Array.isArray(state?.messages) ? state.messages : [];
  // Buat list dengan latest message + sort terbaru di atas
  const chatItems = threads.map((th, idx) => {
    const hist = Array.isArray(th.history) ? th.history : [];
    const last = hist[hist.length - 1];
    return {
      idx,
      name: th.name || "user",
      init: th.init || (th.name || "U").slice(0, 2).toUpperCase(),
      unread: !!th.unread,
      lastText: last ? String(last.text || "") : "",
      lastFrom: last?.from || "",
      lastTs: typeof last?.ts === "number" ? last.ts : 0
    };
  }).filter(x => x.lastText).sort((a, b) => b.lastTs - a.lastTs);

  // Top stats pill
  $("#inboxStatEmail") && ($("#inboxStatEmail").textContent = emailTickets.length);
  $("#inboxStatChat") && ($("#inboxStatChat").textContent = chatItems.length);
  $("#inboxStatBug") && ($("#inboxStatBug").textContent = bugs.length);

  // Per-column count badge
  $("#inboxEmailCount") && ($("#inboxEmailCount").textContent = emailTickets.length);
  $("#inboxChatCount") && ($("#inboxChatCount").textContent = chatItems.length);
  $("#inboxBugCount") && ($("#inboxBugCount").textContent = bugs.length);

  const ticketLabels = { new: "BARU", progress: "DIPROSES", resolved: "RESOLVED" };

  const renderTicketCard = (t) => {
    const emailRow = (t.fromEmail && t.fromEmail !== "—") ? `<div class="inbox-card-email">✉️ ${escapeHtml(t.fromEmail)}</div>` : "";
    return `<div class="inbox-card status-${t.status || "new"}" data-card-kind="ticket" data-card-id="${t.id}">
      <div class="inbox-card-head">
        <strong>${escapeHtml(t.title || "(tanpa subjek)")}</strong>
        <span class="inbox-card-status ${t.status || "new"}">${ticketLabels[t.status] || (t.status || "new").toUpperCase()}</span>
      </div>
      <div class="inbox-card-from">👤 ${escapeHtml(t.from || "—")}</div>
      ${emailRow}
      <div class="inbox-card-time">${relTime(t.createdAt)}</div>
      <div class="inbox-card-actions">
        <button class="btn primary sm" data-card-action="detail">📖 Detail</button>
        <button class="btn ghost sm" data-card-action="status">↻ Status</button>
      </div>
    </div>`;
  };

  const renderBugCard = (b) => {
    const sevColor = { critical: "danger", high: "danger", medium: "warn", low: "ok" }[b.sev] || "warn";
    return `<div class="inbox-card sev-${b.sev}" data-card-kind="bug" data-card-id="${b.id}">
      <div class="inbox-card-head">
        <strong>${escapeHtml(b.title || "(tanpa judul)")}</strong>
        <span class="inbox-card-sev ${sevColor}">${(b.sev || "medium").toUpperCase()}</span>
      </div>
      <div class="inbox-card-from">👤 ${escapeHtml(b.reporter || "—")}</div>
      <div class="inbox-card-time">${relTime(b.createdAt)} · 🖥️ ${escapeHtml((b.browser || "—").slice(0, 40))}</div>
      <div class="inbox-card-actions">
        <button class="btn primary sm" data-card-action="detail">📖 Detail</button>
        <button class="btn ghost sm" data-card-action="bug-status">↻ ${b.status === "open" ? "Assign" : b.status === "assigned" ? "Close" : "Reopen"}</button>
      </div>
    </div>`;
  };

  const renderChatCard = (c) => {
    const preview = escapeHtml((c.lastText || "").slice(0, 100));
    const time = (typeof chatRelTime === "function" ? chatRelTime(c.lastTs) : relTime(c.lastTs));
    const fromLabel = c.lastFrom === "me" ? `<span class="inbox-card-meta-tag">Kamu:</span> ` : "";
    return `<div class="inbox-card ${c.unread ? "unread" : ""}" data-card-kind="chat" data-card-thread="${c.idx}">
      <div class="inbox-card-head">
        <strong>@${escapeHtml(c.name)}</strong>
        ${c.unread ? `<span class="inbox-card-status new">BARU</span>` : ""}
      </div>
      <div class="inbox-card-chat-preview">${fromLabel}${preview}</div>
      <div class="inbox-card-time">${time || ""}</div>
      <div class="inbox-card-actions">
        <button class="btn primary sm" data-card-action="open-chat">💬 Buka Chat</button>
      </div>
    </div>`;
  };

  const emptyState = (icon, text) => `<div class="inbox-empty"><div class="inbox-empty-icon">${icon}</div><p>${text}</p></div>`;

  const emailEl = $("#inboxEmailList");
  const chatEl = $("#inboxChatList");
  const bugEl = $("#inboxBugList");

  if (emailEl) emailEl.innerHTML = emailTickets.length ? emailTickets.map(renderTicketCard).join("") : emptyState("📧", "Belum ada pesan email masuk.");
  if (chatEl) chatEl.innerHTML = chatItems.length ? chatItems.map(renderChatCard).join("") : emptyState("💬", "Belum ada thread live chat.");
  if (bugEl) bugEl.innerHTML = bugs.length ? bugs.map(renderBugCard).join("") : emptyState("🐛", "Belum ada bug yang dilaporkan.");

  // Event delegation — pasang listener SEKALI di wrap level. Re-render innerHTML
  // tidak menghilangkan listener karena listener-nya di parent yang persistent.
  if (!wrap.__inboxBound) {
    wrap.__inboxBound = true;
    wrap.addEventListener("click", e => {
      const card = e.target.closest(".inbox-card");
      if (!card) return;
      const kind = card.dataset.cardKind;
      const btn = e.target.closest("[data-card-action]");
      const action = btn?.dataset.cardAction;

      // Ticket id (untuk ticket & bug, bukan chat)
      const cardId = Number(card.dataset.cardId);

      // Helper: buka detail modal
      const openDetail = () => {
        if (kind === "ticket") {
          const t = getAdminData("tickets").find(x => x.id === cardId);
          if (t) openInboxDetailModal({ kind: "ticket", item: t });
        } else if (kind === "bug") {
          const b = getAdminData("bugs").find(x => x.id === cardId);
          if (b) openInboxDetailModal({ kind: "bug", item: b });
        }
      };
      const openChatThread = () => {
        const idx = Number(card.dataset.cardThread);
        if (Number.isNaN(idx) || !state?.messages?.[idx]) return;
        switchView("messages");
        setTimeout(() => { if (typeof openChat === "function") openChat(idx); }, 80);
      };

      // Action button click
      if (btn) {
        e.stopPropagation();
        if (action === "detail") return openDetail();
        if (action === "open-chat") return openChatThread();
        if (kind === "ticket" && action === "status") {
          const labels = { new: "BARU", progress: "DIPROSES", resolved: "RESOLVED" };
          const arr = getAdminData("tickets");
          const t = arr.find(x => x.id === cardId); if (!t) return;
          const next = { new: "progress", progress: "resolved", resolved: "new" };
          t.status = next[t.status] || "new";
          saveAdminData("tickets", arr);
          pushAdminEvent("🎫", `Tiket <b>"${t.title}"</b> → ${labels[t.status]}`);
          toast(`🎫 Tiket → <b>${labels[t.status]}</b>`, t.status === "resolved" ? "success" : "");
          renderAdminInbox();
          syncAdminNavBadges?.();
          return;
        }
        if (kind === "bug" && action === "bug-status") {
          const arr = getAdminData("bugs");
          const b = arr.find(x => x.id === cardId); if (!b) return;
          if (b.status === "open") b.status = "assigned";
          else if (b.status === "assigned") b.status = "closed";
          else b.status = "open";
          saveAdminData("bugs", arr);
          pushAdminEvent(b.status === "closed" ? "✓" : (b.status === "assigned" ? "👤" : "↻"),
            `Bug <i>"${b.title}"</i> → ${b.status.toUpperCase()}`);
          toast(`🐛 Bug → <b>${b.status.toUpperCase()}</b>`, b.status === "closed" ? "success" : "");
          renderAdminInbox();
          syncAdminNavBadges?.();
          return;
        }
        return;
      }
      // Klik area card (selain button) → langsung buka detail/chat
      if (kind === "chat") return openChatThread();
      openDetail();
    });
  }
}

// Modal detail untuk ticket email & bug report. Tampilkan full content + aksi
// (Balas via Email untuk ticket, Update Status untuk keduanya). Modal di-inject
// dinamis ke body supaya tidak butuh markup HTML statis.
function openInboxDetailModal({ kind, item }) {
  const ticketLabels = { new: "BARU", progress: "DIPROSES", resolved: "RESOLVED" };
  const bugStatusLabels = { open: "OPEN", assigned: "ASSIGNED", closed: "CLOSED" };
  const isTicket = kind === "ticket";
  const title = item.title || (isTicket ? "(tanpa subjek)" : "(tanpa judul)");
  const body = isTicket ? (item.body || "Tidak ada isi pesan.") : (item.desc || "Tidak ada deskripsi bug.");
  const sender = item.from || item.reporter || "—";
  const senderEmail = item.fromEmail || "";
  const status = isTicket ? (item.status || "new") : (item.status || "open");
  const statusLabel = isTicket ? (ticketLabels[status] || status.toUpperCase()) : (bugStatusLabels[status] || status.toUpperCase());
  const sev = !isTicket ? (item.sev || "medium") : null;
  const browser = !isTicket ? item.browser : null;
  const ts = item.createdAt || Date.now();
  const dateStr = new Date(ts).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });

  const modal = document.createElement("div");
  modal.className = "modal show inbox-detail-modal";
  modal.style.cssText = "z-index:9999";
  modal.innerHTML = `
    <div class="modal-backdrop" data-inbox-close></div>
    <div class="modal-panel" style="max-width:560px;padding:24px">
      <button class="modal-close" data-inbox-close>✕</button>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font-size:22px">${isTicket ? "📧" : "🐛"}</span>
        <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;background:${isTicket ? "linear-gradient(90deg,#6D2932,#C7B7A3)" : (sev === "critical" || sev === "high" ? "#c0392b" : sev === "medium" ? "#d68910" : "#27ae60")};color:#fff;letter-spacing:0.5px">${statusLabel}${sev ? ` · ${sev.toUpperCase()}` : ""}</span>
      </div>
      <h3 style="margin:0 0 14px;font-size:18px">${escapeHtml(title)}</h3>
      <div style="background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px">
          <span style="color:var(--muted)">Dari</span><strong>${escapeHtml(sender)}</strong>
          ${senderEmail ? `<span style="color:var(--muted)">Email</span><a href="mailto:${escapeHtml(senderEmail)}" style="color:var(--primary);text-decoration:none">${escapeHtml(senderEmail)}</a>` : ""}
          <span style="color:var(--muted)">Waktu</span><span>${escapeHtml(dateStr)}</span>
          ${browser ? `<span style="color:var(--muted)">Browser</span><span style="font-size:11.5px;color:var(--muted);word-break:break-all">${escapeHtml(browser)}</span>` : ""}
        </div>
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:18px;max-height:300px;overflow-y:auto">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;font-weight:700">${isTicket ? "Isi Pesan" : "Deskripsi Bug"}</div>
        <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(body)}</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${senderEmail ? `<button class="btn primary" data-inbox-action="reply">📧 Balas via Email</button>` : ""}
        <button class="btn ghost" data-inbox-action="status">↻ ${isTicket ? "Update Status" : (status === "open" ? "Assign" : status === "assigned" ? "Tutup" : "Reopen")}</button>
        <button class="btn ghost" data-inbox-close>Tutup</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", e => {
    if (e.target.closest("[data-inbox-close]")) { modal.remove(); return; }
    const actBtn = e.target.closest("[data-inbox-action]");
    if (!actBtn) return;
    const act = actBtn.dataset.inboxAction;
    if (act === "reply" && senderEmail) {
      const subject = encodeURIComponent(`Re: ${title}`);
      const replyBody = encodeURIComponent(`Halo ${sender},\n\n[Tulis balasan di sini]\n\n— Tim Playly\n\n---\nPesan asli:\n${body}`);
      const params = new URLSearchParams({ view: "cm", fs: "1", to: senderEmail, su: decodeURIComponent(subject), body: decodeURIComponent(replyBody) });
      window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank", "noopener");
      return;
    }
    if (act === "status") {
      if (isTicket) {
        const arr = getAdminData("tickets");
        const t = arr.find(x => x.id === item.id); if (!t) return;
        const next = { new: "progress", progress: "resolved", resolved: "new" };
        t.status = next[t.status] || "new";
        saveAdminData("tickets", arr);
        pushAdminEvent("🎫", `Tiket <b>"${t.title}"</b> → ${ticketLabels[t.status]}`);
        toast(`🎫 Tiket → <b>${ticketLabels[t.status]}</b>`, t.status === "resolved" ? "success" : "");
      } else {
        const arr = getAdminData("bugs");
        const b = arr.find(x => x.id === item.id); if (!b) return;
        if (b.status === "open") b.status = "assigned";
        else if (b.status === "assigned") b.status = "closed";
        else b.status = "open";
        saveAdminData("bugs", arr);
        pushAdminEvent(b.status === "closed" ? "✓" : (b.status === "assigned" ? "👤" : "↻"), `Bug <i>"${b.title}"</i> → ${b.status.toUpperCase()}`);
        toast(`🐛 Bug → <b>${b.status.toUpperCase()}</b>`, b.status === "closed" ? "success" : "");
      }
      modal.remove();
      renderAdminInbox();
      syncAdminNavBadges?.();
    }
  });
}

function renderAdminTickets() {
  const list = $("#adminTicketList"); if (!list) return;
  const tickets = [...getAdminData("tickets")].sort((a, b) => b.createdAt - a.createdAt);
  const labels = { new: "BARU", progress: "DIPROSES", resolved: "RESOLVED" };

  // Update top status pills
  const stats = $(".ticket-stats"); if (stats) {
    const m = getAdminMetrics();
    stats.innerHTML = `
      <span class="status-pill red"><i></i> ${m.tickets} baru</span>
      <span class="status-pill amber"><i></i> ${m.ticketsProgress} in-progress</span>
      <span class="status-pill green"><i></i> ${m.ticketsResolved} resolved</span>`;
  }

  list.innerHTML = tickets.map(t => {
    const bodyHtml = t.body
      ? `<div class="ticket-body" hidden>${escapeHtml(t.body).replace(/\n/g, "<br/>")}</div>`
      : "";
    const fromEmailHtml = t.fromEmail && t.fromEmail !== "—"
      ? `<small class="ticket-email">✉️ ${escapeHtml(t.fromEmail)}</small>`
      : "";
    return `<div class="ticket-item ${t.priority || "normal"}" data-ticket-id="${t.id}">
      <div class="ticket-row-main">
        <div class="ticket-channel">${t.ch || "📧"}</div>
        <div class="ticket-meta">
          <b>${escapeHtml(t.title || "(tanpa subjek)")}</b>
          <div class="ticket-from">${escapeHtml(t.from || "—")}</div>
          ${fromEmailHtml}
          <small>${relTime(t.createdAt)}</small>
        </div>
        <div class="ticket-actions">
          <span class="ticket-status ${t.status}">${labels[t.status] || (t.status || "").toUpperCase()}</span>
          ${t.body ? `<button class="btn ghost sm" data-ticket-action="toggle">📖 Detail</button>` : ""}
          <button class="btn ghost sm" data-ticket-action="status">↻ Status</button>
        </div>
      </div>
      ${bodyHtml}
    </div>`;
  }).join("");

  // Action buttons: toggle body, cycle status
  list.querySelectorAll("[data-ticket-action]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const item = btn.closest(".ticket-item");
      const id = Number(item.dataset.ticketId);
      const action = btn.dataset.ticketAction;
      if (action === "toggle") {
        const body = item.querySelector(".ticket-body");
        if (body) body.hidden = !body.hidden;
        return;
      }
      if (action === "status") {
        const arr = getAdminData("tickets");
        const t = arr.find(x => x.id === id); if (!t) return;
        const next = { new: "progress", progress: "resolved", resolved: "new" };
        t.status = next[t.status] || "new";
        saveAdminData("tickets", arr);
        pushAdminEvent("🎫", `Tiket <b>"${t.title}"</b> → ${labels[t.status]}`);
        toast(`🎫 Tiket → <b>${labels[t.status]}</b>`, t.status === "resolved" ? "success" : "");
        renderAdminTickets();
        renderAdminAlerts();
        renderAdminLiveFeed();
        syncAdminNavBadges();
      }
    });
  });
  // Klik baris (selain tombol) → toggle detail
  list.querySelectorAll(".ticket-item").forEach(item => {
    item.addEventListener("click", e => {
      if (e.target.closest("[data-ticket-action]")) return;
      const body = item.querySelector(".ticket-body");
      if (body) body.hidden = !body.hidden;
    });
  });
}

// One-time admin event wiring (mod tabs, user search) — uses delegation
function setupAdminEvents() {
  if (window.__adminEventsBound) return;
  window.__adminEventsBound = true;

  // Moderation tab filter
  document.addEventListener("click", e => {
    const tab = e.target.closest(".mod-tab");
    if (!tab) return;
    $$(".mod-tab").forEach(t => t.classList.toggle("active", t === tab));
    renderAdminModeration();
  });

  // User search (live filter)
  const search = $("#adminUserSearch");
  if (search) search.addEventListener("input", () => renderAdminUsers());
}

function renderAdminBugs() {
  const list = $("#adminBugList"); if (!list) return;
  const bugs = [...getAdminData("bugs")].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.sev] || 9) - (order[b.sev] || 9) || b.createdAt - a.createdAt;
  });

  list.innerHTML = bugs.map(b => `<div class="bug-item" data-bug-id="${b.id}">
    <div>
      <h4><span class="sev ${b.sev}">${b.sev.toUpperCase()}</span>${b.title} ${b.status === "closed" ? "<small style='color:#10b981;font-weight:600;margin-left:8px'>✓ CLOSED</small>" : b.status === "assigned" ? "<small style='color:#f59e0b;font-weight:600;margin-left:8px'>👤 ASSIGNED</small>" : ""}</h4>
      <p>${b.desc}</p>
      <div class="bug-meta">📌 ${b.reporter} • ${relTime(b.createdAt)} • 🖥️ ${b.browser}</div>
    </div>
    <div class="bug-side">
      <button class="btn ghost sm" data-bug-action="detail">Detail</button>
      ${b.status === "open" ? `<button class="btn primary sm" data-bug-action="assign">Assign</button>` : ""}
      ${b.status === "assigned" ? `<button class="btn primary sm" data-bug-action="close">Close</button>` : ""}
      ${b.status === "closed" ? `<button class="btn ghost sm" data-bug-action="reopen">Reopen</button>` : ""}
    </div>
  </div>`).join("");

  list.querySelectorAll("[data-bug-action]").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = Number(e.currentTarget.closest(".bug-item").dataset.bugId);
      const action = e.currentTarget.dataset.bugAction;
      const arr = getAdminData("bugs");
      const b = arr.find(x => x.id === id); if (!b) return;
      if (action === "detail") return toast(`📋 ${b.title}<br/><small>${b.desc}</small>`);
      if (action === "assign") { b.status = "assigned"; pushAdminEvent("👤", `Bug <i>"${b.title}"</i> di-assign ke moderator`); toast("👤 Bug di-assign", "success"); }
      if (action === "close") { b.status = "closed"; pushAdminEvent("✓", `Bug <i>"${b.title}"</i> di-close`); toast("✓ Bug di-close", "success"); }
      if (action === "reopen") { b.status = "open"; pushAdminEvent("↻", `Bug <i>"${b.title}"</i> di-reopen`); toast("↻ Bug di-reopen"); }
      saveAdminData("bugs", arr);
      renderAdminBugs();
      renderAdminLiveFeed();
    });
  });
}

// ----------------------- VIEW SWITCHING -----------------------
function switchView(name, { fromNav = false } = {}) {
  const homeView = user?.role === "admin" ? "admin-dashboard" : "home";
  if (fromNav && name === state.currentView && name !== homeView) {
    name = state.prevView || homeView;
  }
  // Sidebar "Videos" → langsung ke player view dengan video terbaru.
  // Halaman manajemen "Videos Saya" (data-view="videos") tetap diakses
  // lewat tombol "📁 Kelola Video" di player view.
  // Kalau user belum punya video, fallback ke halaman manajemen (yang
  // sudah punya empty state dengan CTA upload).
  if (fromNav && name === "videos") {
    const latestId = state?.myVideos?.[0]?.id;
    if (latestId) {
      openPlayer(latestId);
      return;
    }
  }
  // Cleanup player kalau user meninggalkan view 'player'
  if (state.currentView === "player" && name !== "player") {
    cleanupPlayerView();
  }
  // Inline players di card juga di-pause supaya tidak terus jalan di background
  if (name !== state.currentView) cleanupAllInlinePlayers();
  if (name !== state.currentView) state.prevView = state.currentView;
  state.currentView = name;
  saveState();

  $$(".view").forEach(v => v.classList.toggle("active", v.dataset.view === name));
  $$(".nav-item, .footer-link[data-view]").forEach(n => n.classList.toggle("active", n.dataset.view === name));

  // Dreams FX hanya aktif di dashboard utama (user / admin).
  document.body.classList.toggle("dreams-on", name === "home" || name === "admin-dashboard");

  const crumb = $("#breadcrumb");
  // Breadcrumb root: pakai "Home" untuk semua role — supaya admin & user dashboard
  // konsisten (sebelumnya admin tampil "Admin" yang membingungkan navigasi).
  const homeLabel = "Home";
  if (name === homeView) {
    crumb.innerHTML = `<a href="#" class="active" data-view="${homeView}">${homeLabel}</a>`;
  } else {
    // Build parent chain: home → ...parents → current
    const chain = [];
    let cur = name;
    const guard = new Set();
    while (VIEW_PARENTS[cur] && !guard.has(cur)) {
      guard.add(cur);
      cur = VIEW_PARENTS[cur];
      chain.unshift(cur);
    }
    const parts = [`<a href="#" data-view="${homeView}">${homeLabel}</a>`];
    for (const v of chain) {
      parts.push(`<span class="sep">/</span><a href="#" data-view="${v}">${VIEW_TITLES[v] || v}</a>`);
    }
    parts.push(`<span class="sep">/</span><a href="#" class="active">${VIEW_TITLES[name] || name}</a>`);
    crumb.innerHTML = parts.join("");
  }
  crumb.querySelectorAll("[data-view]").forEach(a => {
    a.addEventListener("click", e => { e.preventDefault(); switchView(a.dataset.view); });
  });

  if (name === "home") {
    // Refresh konten home tiap kali user navigate ke sini — supaya Featured
    // dan tile lain selalu sinkron dengan upload terbaru / follow / dll.
    renderHomeActivity();
    renderHomeTrending();
    renderHomeStats();
    renderLiveMetrics();
    renderTrendingHome();
    startTrendingAutoRefresh();
    renderCreatorSpotlight();
    renderFeatured();
    renderCreators();
  } else {
    stopTrendingAutoRefresh();
  }
  if (name === "history") renderHistory();
  if (name === "stats") setTimeout(drawChart, 50);
  if (name === "videos") renderVideoGrid();
  if (name === "people") renderPeople();
  if (name === "discover") {
    renderFYP();
    renderTrendingInto("#discoverTrendingList");
    renderSuggestUsers();
    startTrendingAutoRefresh();
  }
  else pauseAllFypVideos?.(); // jeda video FYP saat pindah view
  if (name === "profile") populateProfileForm();
  if (name === "user-profile") renderUserProfile();
  if (name === "settings") {
    populateSettingsPrefs();
    refreshTwoFASettings();
    if (user?.role === "admin") populatePlatformSettings();
  }
  if (name === "admin-revenue") renderAdminRevenue();
  else stopRevenueLive();
  if (name === "admin-videos") { renderAdminVideos(); renderAdminModeration(); }
  if (name === "admin-comms") renderAdminComms();
  if (name === "admin-comms-broadcasts") {
    renderCommsKpis();
    renderCommsBroadcastLog();
  }
  if (name === "admin-audit") renderAdminAudit();
  if (name === "admin-analytics") renderAdminAnalytics();
  if (name === "admin-ads") loadAdManagerForm();
  if (name === "admin-inbox") renderAdminInbox();

  if (window.innerWidth <= 768) $("#sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Beritahu observer scroll-reveal supaya re-scan element baru di view ini
  window.dispatchEvent(new CustomEvent("playly:view-changed", { detail: { view: name } }));
}

$$(".nav-item, .footer-link[data-view]").forEach(n => {
  n.addEventListener("click", e => {
    e.preventDefault();
    switchView(n.dataset.view, { fromNav: true });
  });
});

// ----------------------- BRAND CLICK (Logo → Home / Admin Dashboard) -----------------------
const brandHomeBtn = $("#brandHome");
if (brandHomeBtn) {
  brandHomeBtn.addEventListener("click", () => {
    const homeView = user?.role === "admin" ? "admin-dashboard" : "home";
    const activeView = document.querySelector(".nav-item.active")?.dataset.view;
    if (activeView === homeView) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      switchView(homeView, { fromNav: true });
    }
    brandHomeBtn.classList.remove("brand-pulse");
    void brandHomeBtn.offsetWidth;
    brandHomeBtn.classList.add("brand-pulse");
  });
}

document.addEventListener("click", e => {
  const j = e.target.closest("[data-jump]");
  if (j) { e.preventDefault(); switchView(j.dataset.jump); }
});
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const j = e.target.closest?.("[data-jump][role='button'], [data-jump][tabindex]");
  if (j) { e.preventDefault(); switchView(j.dataset.jump); }
});

// ----------------------- THEME (post-auth) -----------------------
$$("[data-theme-set]").forEach(b => {
  b.addEventListener("click", () => {
    const theme = b.dataset.themeSet;
    document.body.dataset.theme = theme;
    $$("[data-theme-set]").forEach(x => x.classList.toggle("active", x === b));
    localStorage.setItem("playly-theme", theme);
    if (state?.currentView === "stats") setTimeout(drawChart, 50);
    toast(`🎨 Mode <b>${theme === "light" ? "Light" : "Dark"}</b> aktif`, "success");
  });
});

// ----------------------- SIDEBAR -----------------------
function _setSidebar(open) {
  const sb = $("#sidebar");
  if (!sb) return;
  sb.classList.toggle("open", open);
  document.body.classList.toggle("sidebar-open", open);
}
// Event delegation — robust untuk mobile dan element yang mungkin baru ada
// setelah script.js eksekusi. Pakai pointerup supaya respon cepat di HP.
document.addEventListener("click", (e) => {
  const t = e.target;
  // Klik tombol hamburger
  if (t.closest("#toggleSidebar")) {
    e.preventDefault();
    const sb = $("#sidebar");
    _setSidebar(!sb?.classList.contains("open"));
    return;
  }
  // Klik di luar sidebar saat sidebar terbuka di mobile → tutup
  if (document.body.classList.contains("sidebar-open") && window.innerWidth <= 640) {
    if (!t.closest("#sidebar")) _setSidebar(false);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("sidebar-open")) _setSidebar(false);
});
// Tutup sidebar otomatis saat memilih menu di mobile (event delegation)
document.addEventListener("click", (e) => {
  if (window.innerWidth > 640) return;
  if (!document.body.classList.contains("sidebar-open")) return;
  const link = e.target.closest("#sidebar .nav-item, #sidebar [data-route]");
  if (link) _setSidebar(false);
});
// Reset class sidebar-open jika di-resize ke desktop
window.addEventListener("resize", () => {
  if (window.innerWidth > 640 && document.body.classList.contains("sidebar-open")) _setSidebar(false);
});

// ----------------------- COUNT-UP (when value > 0) -----------------------
function countUp(el, target) {
  if (target == null) target = +el.dataset.count;
  if (target === 0) { el.textContent = "0"; return; }
  const dur = 800, t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3))).toLocaleString("id-ID");
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function fmtNum(n) {
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n/1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toLocaleString("id-ID");
}

function renderStatsRow() {
  const row = $("#statsRow");
  if (!row) return;
  const myUploads = state.myVideos.length;
  const myViews = state.myVideos.reduce((s, v) => s + (v.viewsNum || 0), 0);
  const myLikes = state.myVideos.reduce((s, v) => s + (v.likes || 0), 0);
  const following = state.followingCreators.length;

  const cards = [
    { label: "Total Videos", value: myUploads, raw: myUploads, icon: `<rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>`, c1: "#561C24", c2: "#561C24", trend: myUploads > 0 ? "up" : null, trendText: myUploads > 0 ? "video diterbitkan" : "—", spark: "#561C24" },
    { label: "Total Views", value: fmtNum(myViews), raw: myViews, icon: `<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>`, c1: "#E8D8C4", c2: "#561C24", trend: myViews > 0 ? "up" : null, trendText: myViews > 0 ? "views diraih" : "—", spark: "#E8D8C4" },
    { label: "Total Likes", value: fmtNum(myLikes), raw: myLikes, icon: `<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`, c1: "#6D2932", c2: "#561C24", trend: myLikes > 0 ? "up" : null, trendText: myLikes > 0 ? "disukai user" : "—", spark: "#6D2932" },
    { label: "Following", value: following, raw: following, icon: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/><path d="M22 11h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`, c1: "#6D2932", c2: "#E8D8C4", trend: following > 0 ? "up" : null, trendText: following > 0 ? "kreator diikuti" : "—", spark: "#E8D8C4" }
  ];

  row.innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-icon" style="--c1:${c.c1};--c2:${c.c2}"><svg viewBox="0 0 24 24" fill="none">${c.icon}</svg></div>
      <p class="stat-label">${c.label}</p>
      <h3 class="stat-value">${c.value}</h3>
      ${c.trend ? `<div class="stat-trend ${c.trend}"><svg viewBox="0 0 24 24" fill="none"><path d="m6 14 6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>${c.trendText}</div>` : `<div class="stat-trend neutral">${c.trendText}</div>`}
      ${c.raw > 0 ? `<div class="spark"><svg viewBox="0 0 100 30" preserveAspectRatio="none"><polyline fill="none" stroke="${c.spark}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="0,22 14,18 28,20 42,12 56,16 70,8 84,10 100,6"/></svg></div>` : ""}
    </div>
  `).join("");
}

function renderAchievements() {
  const grid = $("#badgeGrid");
  if (!grid) return;

  const myUploads = state.myVideos.length;
  const myViews = state.myVideos.reduce((s, v) => s + (v.viewsNum || 0), 0);
  const myLikes = state.myVideos.reduce((s, v) => s + (v.likes || 0), 0);
  const following = state.followingCreators.length;
  const commentCount = Object.values(state.comments || {}).reduce((s, arr) => s + (arr?.length || 0), 0);
  const watchedCount = state.history.length;

  const list = [
    { emoji: "🎬", name: "1st Upload",    earned: myUploads >= 1 },
    { emoji: "📺", name: "Penonton",      earned: watchedCount >= 1 },
    { emoji: "♥",  name: "10 Likes",      earned: myLikes >= 10 || state.liked.length >= 10 },
    { emoji: "👥", name: "Sosial",        earned: following >= 1 },
    { emoji: "💬", name: "Komentar",      earned: commentCount >= 1 },
    { emoji: "👁", name: "100 Views",     earned: myViews >= 100 },
    { emoji: "🚀", name: "Trending",      earned: myViews >= 1000 }
  ];

  grid.innerHTML = list.map(b => `
    <div class="badge-chip ${b.earned ? 'earned' : ''}" title="${b.name}">
      ${b.emoji}<small>${b.name}</small>
    </div>
  `).join("");

  const earned = list.filter(b => b.earned).length;
  $("#achEarned") && ($("#achEarned").textContent = earned);
  $("#achTotal") && ($("#achTotal").textContent = list.length);
  $("#achBar") && ($("#achBar").style.setProperty("--w", `${(earned / list.length) * 100}%`));
  $("#achSubtitle") && ($("#achSubtitle").textContent = earned === 0
    ? "Mulai upload video pertamamu untuk membuka achievement."
    : `${earned} dari ${list.length} achievement terbuka. Lanjutkan!`);
}

// Patch satu angka di widget home stats. Kasih animasi "bump" cuma kalau
// nilainya BERBEDA dari sebelumnya — supaya user lihat data lagi update.
// Parse "1.234" (id-ID locale, dot as thousand separator) atau "1234" → 1234.
// Return null kalau ada non-digit selain pemisah ribuan (mis. "1.5k", "—").
function _parseLocaleInt(s) {
  if (typeof s !== "string") return null;
  const stripped = s.replace(/\./g, "").replace(/,/g, "").trim();
  if (!/^\d+$/.test(stripped)) return null;
  return parseInt(stripped, 10);
}

// Easing function — ease-out cubic (cepet di awal, melambat di akhir)
function _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function patchHomeStat(selector, newText) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (el.textContent === newText) return;

  // Cancel animation frame yang lagi running di element ini supaya tidak race
  if (el._countAnim) {
    cancelAnimationFrame(el._countAnim);
    el._countAnim = null;
  }

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const fromN = _parseLocaleInt(el.textContent);
  const toN   = _parseLocaleInt(newText);

  // Kalau dua-duanya pure integer & user tidak minta reduce-motion → count-up animate.
  // Kalau ada compact format (1.5k / 2.3M), skip animasi — langsung set + bump.
  if (fromN !== null && toN !== null && fromN !== toN && !reduceMotion) {
    const start = performance.now();
    const dur = Math.min(900, 400 + Math.log10(Math.abs(toN - fromN) + 1) * 200);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const v = Math.round(fromN + (toN - fromN) * _easeOutCubic(t));
      el.textContent = v.toLocaleString("id-ID");
      if (t < 1) {
        el._countAnim = requestAnimationFrame(tick);
      } else {
        el._countAnim = null;
        el.textContent = newText;
      }
    };
    el._countAnim = requestAnimationFrame(tick);
  } else {
    el.textContent = newText;
  }

  // Bump animation (existing) — kasih feedback visual saat angka berubah
  el.classList.remove("hs-bump");
  void el.offsetWidth;
  el.classList.add("hs-bump");
}

// Ticker — update teks "baru saja / X menit lalu" tiap 30 detik.
// Stop kalau widget belum mount (selama login screen).
setInterval(() => {
  const updEl = document.getElementById("hsLastUpdate");
  if (!updEl) return;
  const ts = parseInt(updEl.dataset.ts || "0", 10);
  if (!ts) return;
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) updEl.textContent = "baru saja";
  else if (diff < 60) updEl.textContent = `${diff} detik lalu`;
  else if (diff < 3600) updEl.textContent = `${Math.floor(diff / 60)} menit lalu`;
  else updEl.textContent = `${Math.floor(diff / 3600)} jam lalu`;
}, 30000);

function renderUserStats() {
  const myViews = state.myVideos.reduce((s, v) => s + (v.viewsNum || 0), 0);
  const myUploads = state.myVideos.length;
  const myLikes = state.myVideos.reduce((s, v) => s + (v.likes || 0), 0);
  const following = state.followingCreators.length;

  // Real-time home stats widget — kasih animasi bump kalau angka berubah
  patchHomeStat("#hsVideos", String(myUploads));
  patchHomeStat("#hsViews", fmtNum(myViews));
  patchHomeStat("#hsFollowing", String(following));
  patchHomeStat("#hsLikes", fmtNum(myLikes));
  // Hero card "CREATOR HUB" tiles — sinkronkan dengan home stats
  patchHomeStat("#heroHcVideos", String(myUploads));
  patchHomeStat("#heroHcViews", fmtNum(myViews));
  patchHomeStat("#heroHcLikes", fmtNum(myLikes));
  // Update "last update" indicator → kasih tau widget barusan refresh
  const updEl = document.getElementById("hsLastUpdate");
  if (updEl) {
    updEl.textContent = "baru saja";
    updEl.dataset.ts = String(Date.now());
  }

  renderStatsRow();
  renderAchievements();

  // Quick stats (Videos view)
  $("#qsTotal") && ($("#qsTotal").textContent = myUploads);
  $("#qsViews") && ($("#qsViews").textContent = fmtNum(myViews));
  // Sidebar Videos badge: angka kalau ada upload baru 24 jam, dot kalau punya
  // video tapi tidak ada yang baru, hidden kalau belum punya video apapun.
  const oneDayMs = 86400000;
  const newUploads24h = (state.myVideos || []).filter(v => {
    const t = Number(v.ts || v.uploadedAt || 0);
    return t > 0 && (Date.now() - t) <= oneDayMs;
  }).length;
  setBadgeMode($("#videoCount"), newUploads24h, myUploads > 0);

  // Messages badge: angka kalau ada unread, dot kalau ada thread, hidden kalau kosong
  const unread = state.messages.filter(m => m.unread).length;
  setBadgeMode($("#msgBadge"), unread, state.messages.length > 0);
}

// ----------------------- LIVE CLOCK & GREETING -----------------------
const ID_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const ID_DAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const ID_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ID_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

function pad2(n) { return String(n).padStart(2, "0"); }

function timeOfDayGreeting(h) {
  if (h < 5) return { greet: "Masih begadang", emoji: "🌙" };
  if (h < 11) return { greet: "Selamat pagi", emoji: "☀️" };
  if (h < 15) return { greet: "Selamat siang", emoji: "☕" };
  if (h < 18) return { greet: "Selamat sore", emoji: "🌅" };
  return { greet: "Selamat malam", emoji: "🌙" };
}

function buildHeroSubtitle() {
  if (!user || !state) return "";
  const h = new Date().getHours();
  const { greet, emoji } = timeOfDayGreeting(h);
  const myUploads = state.myVideos.length;
  const following = state.followingCreators.length;

  if (myUploads === 0 && following === 0) {
    return `${greet}! Mulai dengan <b data-jump="upload" style="cursor:pointer; color:var(--primary)">upload video</b> atau <b data-jump="discover" style="cursor:pointer; color:var(--primary)">cari kreator</b> ${emoji}`;
  }
  if (following > 0 && myUploads === 0) {
    return `${greet}! Kamu mengikuti <b>${following}</b> kreator. Yuk upload video pertamamu ${emoji}`;
  }
  if (myUploads > 0 && following === 0) {
    return `${greet}! Kamu sudah punya <b>${myUploads}</b> video. Cari kreator lain di Discover ${emoji}`;
  }
  return `${greet}! <b>${myUploads}</b> video • <b>${following}</b> kreator diikuti ${emoji}`;
}

let liveClockTimer = null;

function tickLiveClock() {
  const now = new Date();
  const day = now.getDay();
  const date = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  const hh = pad2(now.getHours()), mm = pad2(now.getMinutes()), ss = pad2(now.getSeconds());

  // Hero pills (user + admin)
  const heroDate = $("#heroDate");
  if (heroDate) heroDate.textContent = `${ID_DAYS_SHORT[day]}, ${date} ${ID_MONTHS_SHORT[month]} ${year}`;
  const adminHeroDate = $("#adminHeroDate");
  if (adminHeroDate) adminHeroDate.textContent = `${ID_DAYS_SHORT[day]}, ${date} ${ID_MONTHS_SHORT[month]} ${year}`;
  const liveTime = $("#liveTime");
  if (liveTime) liveTime.textContent = `${hh}:${mm}:${ss}`;
  const adminLiveTime = $("#adminLiveTime");
  if (adminLiveTime) adminLiveTime.textContent = `${hh}:${mm}:${ss}`;

  // Hero clock card (user)
  const hcDay = $("#hcDay");
  if (hcDay) hcDay.textContent = ID_DAYS[day].toUpperCase();
  const hcDate = $("#hcDate");
  if (hcDate) hcDate.textContent = pad2(date);
  const hcMonth = $("#hcMonth");
  if (hcMonth) hcMonth.textContent = `${ID_MONTHS[month]} ${year}`;
  const hcTimeBig = $("#hcTimeBig");
  if (hcTimeBig) hcTimeBig.textContent = `${hh}:${mm}`;

  // Hero clock card (admin)
  const adminHcDay = $("#adminHcDay");
  if (adminHcDay) adminHcDay.textContent = ID_DAYS[day].toUpperCase();
  const adminHcDate = $("#adminHcDate");
  if (adminHcDate) adminHcDate.textContent = pad2(date);
  const adminHcMonth = $("#adminHcMonth");
  if (adminHcMonth) adminHcMonth.textContent = `${ID_MONTHS[month]} ${year}`;
  const adminHcTimeBig = $("#adminHcTimeBig");
  if (adminHcTimeBig) adminHcTimeBig.textContent = `${hh}:${mm}`;

  // Greeting (only refresh once per minute since seconds change)
  if (now.getSeconds() === 0 || !$("#heroSubtitle")?.dataset.init) {
    refreshHeroGreeting();
  }
}

function refreshHeroGreeting() {
  if (!user) return;
  const greetEl = $("#heroGreeting");
  if (greetEl) {
    greetEl.innerHTML = `Halo, ${user.name.split(" ")[0]} <span class="wave">👋</span>`;
  }
  const subtitle = $("#heroSubtitle");
  if (subtitle) {
    subtitle.innerHTML = buildHeroSubtitle();
    subtitle.dataset.init = "1";
  }
  // Admin hero greeting (kalau view admin aktif)
  if (user.role === "admin") {
    const adminGreet = $("#adminHeroGreeting");
    if (adminGreet) {
      const firstName = user.name.split(" ")[0];
      adminGreet.innerHTML = `Halo, ${firstName} <span class="wave">⚡</span>`;
    }
    const heroTier = document.getElementById("adminHeroTier");
    if (heroTier) {
      heroTier.textContent = isSuperAdmin(user) ? "SUPER ADMIN" : "ADMIN";
    }
    syncAdminHeroStats();
  }
}

// Update KPI mini di hero card admin (Users / Pending / Tickets — legacy, tetap jaga)
function syncAdminHeroStats() {
  try {
    const m = getAdminMetrics();
    if ($("#adminHcUsers")) $("#adminHcUsers").textContent = fmtNum(m.accounts.length);
    if ($("#adminHcPending")) $("#adminHcPending").textContent = m.mod;
    if ($("#adminHcTickets")) $("#adminHcTickets").textContent = m.tickets;
  } catch {}
  // Update tiles "User baru / Pesan baru / Video baru" — 24 jam terakhir
  syncAdminHeroUpdates();
}

// Hitung user/pesan/video baru dalam 24 jam terakhir buat tile di hero clock.
function syncAdminHeroUpdates() {
  const oneDayAgo = Date.now() - 86400000;
  // User baru — akun yang joinedAt < 24 jam
  let newUsers = 0;
  try {
    newUsers = getAllAccounts().filter(a => {
      if (a.role === "admin") return false;
      const t = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
      return t >= oneDayAgo;
    }).length;
  } catch {}
  // Pesan baru — incoming message dari user di state.messages history yang ts < 24 jam
  let newMessages = 0;
  try {
    const threads = Array.isArray(state?.messages) ? state.messages : [];
    threads.forEach(t => {
      const history = Array.isArray(t.history) ? t.history : [];
      history.forEach(h => {
        if (!h || h.from === "me") return;
        if (typeof h.ts === "number" && h.ts >= oneDayAgo) newMessages++;
      });
    });
  } catch {}
  // Video baru — video.id (timestamp ms) < 24 jam
  let newVideos = 0;
  try {
    newVideos = getPlatformVideos().filter(v => {
      const t = typeof v.id === "number" ? v.id : 0;
      return t >= oneDayAgo;
    }).length;
  } catch {}
  if ($("#adminHcNewUsers")) $("#adminHcNewUsers").textContent = fmtNum(newUsers);
  if ($("#adminHcNewMessages")) $("#adminHcNewMessages").textContent = fmtNum(newMessages);
  if ($("#adminHcNewVideos")) $("#adminHcNewVideos").textContent = fmtNum(newVideos);
}

function startLiveClock() {
  if (liveClockTimer) clearInterval(liveClockTimer);
  tickLiveClock();
  liveClockTimer = setInterval(tickLiveClock, 1000);
}

function stopLiveClock() {
  if (liveClockTimer) { clearInterval(liveClockTimer); liveClockTimer = null; }
}

// ----------------------- VIDEO CARD -----------------------
function videoCardHTML(v) {
  const liked = state.liked.includes(v.id);
  const saved = state.saved.includes(v.id);
  const isOwn = v.creator === user?.username;
  return `
    <div class="video-card" data-vid="${v.id}">
      <div class="thumb">
        <img src="${v.thumb}" alt="${v.title}" loading="lazy"/>
        ${isOwn ? `<button class="delete-btn" data-delete-vid="${v.id}" title="Hapus video">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>` : ""}
        <div class="thumb-overlay">
          <button class="play-btn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
          <span class="duration">${v.duration}</span>
        </div>
      </div>
      <div class="video-info">
        <h4>${v.title}</h4>
        <p><span class="creator">@${v.creator}</span> • ${v.views} views</p>
        <div class="video-actions">
          <button class="va-btn ${liked ? 'liked' : ''}" data-like="${v.id}">
            <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6Z"/></svg>
            ${(v.likes + (liked ? 1 : 0)).toLocaleString("id-ID")}
          </button>
          <button class="va-btn" data-comment="${v.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 1 1-3.4-6.5L21 4l-1.4 3.5A7.97 7.97 0 0 1 21 12Z"/></svg>
            ${(state.comments[v.id]?.length || 0)}
          </button>
          <button class="va-btn" data-save="${v.id}" style="margin-left:auto">
            <svg viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

// Inline-play (Twitter/X style): klik thumbnail → video play di dalam card,
// tanpa pindah ke view "player". Full player view tetap tersedia via tombol
// expand di overlay player atau dari tombol komentar.
const SAMPLE_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

function cleanupAllInlinePlayers() {
  $$(".video-card.inline-playing").forEach(card => closeInlinePlayer(card));
}

function closeInlinePlayer(card) {
  if (!card?.classList?.contains("inline-playing")) return;
  const thumb = card.querySelector(".thumb");
  const video = thumb?.querySelector("video.inline-video");
  if (video) {
    try { video.pause(); } catch {}
    video.removeAttribute("src");
    try { video.load(); } catch {}
  }
  if (thumb && thumb.dataset.originalHtml) {
    thumb.innerHTML = thumb.dataset.originalHtml;
    delete thumb.dataset.originalHtml;
  }
  card.classList.remove("inline-playing");
}

async function playVideoInline(card) {
  const id = +card.dataset.vid;
  const v = findVideo(id);
  if (!v) return;
  const thumb = card.querySelector(".thumb");
  if (!thumb) return;

  // Sudah inline-playing → toggle pause/play
  if (card.classList.contains("inline-playing")) {
    const ve = thumb.querySelector("video.inline-video");
    if (ve) { ve.paused ? ve.play().catch(() => {}) : ve.pause(); }
    return;
  }

  // Tutup card lain yang sedang inline-playing (single-active)
  cleanupAllInlinePlayers();

  // Resolve source dulu sebelum swap UI biar tidak ada flicker kosong
  const resolved = (await resolveVideoSource(v)) || SAMPLE_VIDEO_URL;

  // Simpan thumbnail asli untuk restore saat ditutup
  thumb.dataset.originalHtml = thumb.innerHTML;
  thumb.innerHTML = `
    <video class="inline-video" src="${resolved}" poster="${v.thumb || ""}" controls playsinline preload="metadata"></video>
    <button class="inline-ctrl inline-expand" title="Buka tampilan penuh" aria-label="Buka tampilan penuh">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
    </button>
    <button class="inline-ctrl inline-close" title="Tutup pemutar" aria-label="Tutup pemutar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
  `;
  card.classList.add("inline-playing");

  const videoEl = thumb.querySelector("video.inline-video");
  videoEl.play().catch(() => {});

  thumb.querySelector(".inline-close").addEventListener("click", e => {
    e.stopPropagation();
    closeInlinePlayer(card);
  });
  thumb.querySelector(".inline-expand").addEventListener("click", e => {
    e.stopPropagation();
    closeInlinePlayer(card);
    openPlayer(id);
  });
  // Klik di video element (kecuali kontrol native) jangan trigger card click
  videoEl.addEventListener("click", e => e.stopPropagation());

  // Catat ke history seperti openPlayer
  const existing = state.history.findIndex(h => h.videoId === id && h.group === "Hari ini");
  if (existing >= 0) state.history[existing].time = "baru saja";
  else state.history.unshift({ videoId: id, group: "Hari ini", time: "baru saja", progress: 0 });
  saveState();
}

function bindVideoCards(scope = document) {
  $$(".video-card", scope).forEach(c => {
    c.addEventListener("click", e => {
      if (e.target.closest(".video-actions")) return;
      if (e.target.closest(".inline-ctrl, .inline-video")) return;
      // Klik di area info (title/creator) → buka full player; klik thumb → inline
      if (e.target.closest(".thumb")) {
        playVideoInline(c);
      } else {
        openPlayer(+c.dataset.vid);
      }
    });
  });
  $$("[data-like]", scope).forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    const id = +b.dataset.like;
    const wasLiked = state.liked.includes(id);
    if (wasLiked) { state.liked = state.liked.filter(x => x !== id); toast("👎 Like dibatalkan"); }
    else { state.liked.push(id); toast("❤️ Video disukai", "success"); }
    // Update real likes count pada video creator's state — cloud-sync akan mirror.
    updateVideoStat(id, "likes", wasLiked ? -1 : 1);
    saveState();
    refreshAllVideoGrids();
    renderUserStats();
  }));
  $$("[data-save]", scope).forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    const id = +b.dataset.save;
    if (state.saved.includes(id)) state.saved = state.saved.filter(x => x !== id);
    else { state.saved.push(id); toast("🔖 Disimpan", "success"); }
    saveState();
    refreshAllVideoGrids();
  }));
  $$("[data-comment]", scope).forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    openPlayer(+b.dataset.comment);
    setTimeout(() => $("#commentField")?.focus(), 300);
  }));
}

function refreshAllVideoGrids() {
  renderHomeTrending();
  renderHomeStats();
  renderLiveMetrics();
  renderCreatorSpotlight();
  renderVideoGrid();
  renderDiscoverVideos();
  renderDiscoverHero();
  renderDiscoverCategories();
  renderFeatured();
}

// ----------------------- EMPTY STATE -----------------------
function emptyHTML(icon, title, desc, btnText, btnAction) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <h4>${title}</h4>
      <p>${desc}</p>
      ${btnText ? `<button class="btn primary" data-jump="${btnAction}">${btnText}</button>` : ""}
    </div>
  `;
}

// ----------------------- HOME RENDERERS -----------------------
function renderHomeActivity() {
  const list = $("#homeActivityList");
  if (!list) return;
  if (!state.activities.length) {
    list.innerHTML = emptyHTML("📡", "Belum ada pembaruan", "Aktivitas dari kreator yang kamu ikuti akan muncul di sini. Mulai dengan menemukan kreator favorit!", "Cari Kreator", "discover");
    return;
  }
  list.innerHTML = state.activities.slice(0, 6).map(a => `
    <div class="activity-item">
      <div class="act-icon ${a.type}">${a.icon}</div>
      <div class="act-text">${a.text}</div>
      <div class="act-time">${a.time}</div>
    </div>
  `).join("");
}

function renderHomeTrending() {
  const list = $("#homeTrending");
  if (!list) return;
  const platform = getPlatformVideos();
  // Sort by views desc, tie-break by createdAt desc (recent wins)
  const ranked = [...platform].sort((a, b) => {
    const va = a.viewsNum || 0, vb = b.viewsNum || 0;
    if (vb !== va) return vb - va;
    return (b.createdAt || b.id || 0) - (a.createdAt || a.id || 0);
  }).slice(0, 4);
  if (!ranked.length) {
    list.innerHTML = emptyHTML("🔥", "Belum ada trending",
      "Belum ada video di platform. Jadilah yang pertama upload!",
      "Upload Sekarang", "upload");
    return;
  }
  list.innerHTML = ranked.map(videoCardHTML).join("");
  bindVideoCards(list);
}

function renderHomeStats() {
  const list = $("#homeStatsList");
  if (!list) return;
  const myVideos = state?.myVideos || [];
  const totalVideos = myVideos.length;
  const totalViews = myVideos.reduce((s, v) => s + (v.viewsNum || 0), 0);
  const totalLikes = myVideos.reduce((s, v) => s + (v.likes || 0), 0);
  const username = (user?.username || "").toLowerCase();
  const followers = username && typeof getUserFollowers === "function" ? getUserFollowers(username).length : 0;
  const following = (state?.followingCreators || []).length;

  const rows = [
    { ico: "📺", label: "Video Saya",  val: fmtNum(totalVideos) },
    { ico: "👁️", label: "Total Views", val: fmtNum(totalViews) },
    { ico: "❤️", label: "Total Likes", val: fmtNum(totalLikes) },
    { ico: "👥", label: "Followers",   val: fmtNum(followers) },
    { ico: "✨", label: "Following",   val: fmtNum(following) },
  ];

  list.innerHTML = rows.map(r => `
    <div class="home-stat-row">
      <span class="label"><span class="ico">${r.ico}</span><span>${r.label}</span></span>
      <span class="val">${r.val}</span>
    </div>
  `).join("");
}

/* =========================================================
   HOME — Live Metrics, Quick Actions, Creator Spotlight
   ========================================================= */

// ---- Live Metrics (real-time platform stats) ----
function renderLiveMetrics() {
  const wrap = $("#liveMetrics");
  if (!wrap) return;
  const videos = getPlatformVideos();
  const totalViews = videos.reduce((s, v) => s + (v.viewsNum || 0), 0);
  const totalVideos = videos.length;
  // Total kreator = semua user terdaftar yang punya min. 1 video, plus diri sendiri kalau punya video
  const otherCreators = getPlatformCreators({ activeOnly: true }).length;
  const myHasVideos = (state?.myVideos?.length || 0) > 0 ? 1 : 0;
  const totalCreators = otherCreators + myHasVideos;
  // Upload hari ini = video dengan createdAt < 24 jam yang lalu (atau id sebagai fallback timestamp)
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const todayCount = videos.filter(v => {
    const t = v.createdAt || (typeof v.id === "number" && v.id > 1e12 ? v.id : 0);
    return t && (now - t) < oneDay;
  }).length;

  const targets = { views: totalViews, videos: totalVideos, creators: totalCreators, today: todayCount };
  wrap.querySelectorAll(".metric-card").forEach(card => {
    const key = card.dataset.metric;
    const target = targets[key] || 0;
    const valEl = card.querySelector(".metric-value");
    if (!valEl) return;
    const prev = parseInt(valEl.dataset.target) || 0;
    if (prev === target) return;
    valEl.dataset.target = String(target);
    animateCount(valEl, prev, target, 800);
  });
}

function animateCount(el, from, to, duration = 800) {
  const start = performance.now();
  const fmt = n => fmtNum(Math.round(n));
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const val = from + (to - from) * eased;
    el.textContent = fmt(val);
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = fmt(to);
  }
  requestAnimationFrame(frame);
}

// ---- Quick Actions Bar ----
function bindQuickActions() {
  const copyBtn = $("#qaCopyProfileLink");
  if (copyBtn && !copyBtn.dataset.bound) {
    copyBtn.dataset.bound = "1";
    copyBtn.addEventListener("click", async () => {
      const uname = user?.username || "";
      if (!uname) return toast("⚠️ Username belum tersedia", "warning");
      const url = `${location.origin}${location.pathname}?u=${encodeURIComponent(uname)}`;
      try {
        await navigator.clipboard.writeText(url);
        toast("✓ Link profil disalin", "success");
      } catch {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); toast("✓ Link disalin", "success"); }
        catch { toast("❌ Gagal salin link", "error"); }
        ta.remove();
      }
    });
  }
  const switchBtn = $("#qaSwitchAccount");
  if (switchBtn && !switchBtn.dataset.bound) {
    switchBtn.dataset.bound = "1";
    switchBtn.addEventListener("click", () => {
      if (typeof openSwitchAccount === "function") openSwitchAccount();
    });
  }
}

// ---- Creator Spotlight Slider ----
const csState = { idx: 0, list: [], timer: null };

// =================== TRENDING HARI INI (X-style: judul artikel + hashtag) ===================
// Combo data: (1) hashtag platform-real dari video 48 jam terakhir +
// (2) curated pool topik trending Indonesia (rotasi harian by date hash).
// Karena dashboard ini tidak punya akses Twitter API real, pool curated
// di-rotate per hari supaya konten tetap fresh tiap kunjungan.

const TRENDING_POOL = [
  { category: "Politik", title: "Sidang Tahunan MPR 2026", desc: "Pidato kenegaraan Presiden", posts: "247K", type: "article", hashtag: "Sidang2026" },
  { category: "Hiburan", title: "Konser Bruno Mars Jakarta sold out 2 jam", desc: "Tur Asia Tenggara", posts: "182K", type: "article", hashtag: "BrunoMarsJKT" },
  { category: "Olahraga", title: "Timnas U-23 lolos final Piala Asia", desc: "vs Korea Selatan besok", posts: "543K", type: "article", hashtag: "TimnasDay" },
  { category: "K-Pop", title: "BTS comeback album baru bocor", desc: "Fans heboh di seluruh dunia", posts: "1.2M", type: "video", hashtag: "BTS_Comeback" },
  { category: "Tech", title: "Apple rilis Vision Pro 2 di Indonesia", desc: "Harga mulai 35 juta", posts: "94K", type: "article", hashtag: "VisionPro2" },
  { category: "Viral", title: "#MahasiswaBerkarya trending di TikTok", desc: "Karya kreatif anak bangsa", posts: "78K", type: "video", hashtag: "MahasiswaBerkarya" },
  { category: "Drama", title: "K-drama 'Queen of Tears 2' tayang malam ini", desc: "Sequel paling dinanti", posts: "412K", type: "video", hashtag: "QueenOfTears2" },
  { category: "Politik", title: "Reshuffle kabinet diumumkan minggu ini", desc: "Tiga menteri baru", posts: "165K", type: "article", hashtag: "ReshuffleKabinet" },
  { category: "Ekonomi", title: "Rupiah menguat ke 15.200 per dolar", desc: "Sentimen positif investor asing", posts: "52K", type: "article", hashtag: "RupiahMenguat" },
  { category: "Hiburan", title: "Film 'Pengabdi Setan 3' tembus 5 juta penonton", desc: "Rekor box office Indonesia", posts: "238K", type: "article", hashtag: "PengabdiSetan3" },
  { category: "Olahraga", title: "MotoGP Mandalika 2026 tiket terjual habis", desc: "April mendatang", posts: "67K", type: "article", hashtag: "MandalikaGP" },
  { category: "Lifestyle", title: "Kuliner viral: Es Teh Indonesia versi premium", desc: "Antri sampai 2 jam", posts: "121K", type: "video", hashtag: "EsTehViral" },
  { category: "Tech", title: "Google Pixel 10 launch global", desc: "Kamera AI baru", posts: "89K", type: "article", hashtag: "Pixel10" },
  { category: "K-Pop", title: "Blackpink Lisa solo concert tour", desc: "Jakarta termasuk dalam list", posts: "634K", type: "video", hashtag: "LisaSolo" },
  { category: "Hiburan", title: "Coldplay umumkan tur Asia 2026", desc: "Indonesia jadi salah satu venue", posts: "298K", type: "article", hashtag: "ColdplayAsia" },
  { category: "Viral", title: "Anak SMA buat AI pendeteksi plagiarisme", desc: "Juara olimpiade nasional", posts: "143K", type: "article", hashtag: "AnakIndonesiaJaya" },
  { category: "Olahraga", title: "Persija juara Liga 1 musim 2025/26", desc: "Selisih 2 poin di akhir musim", posts: "189K", type: "article", hashtag: "PersijaJuara" },
  { category: "Tech", title: "OpenAI ChatGPT 6 dirilis hari ini", desc: "Reasoning + agentic capability", posts: "1.5M", type: "article", hashtag: "ChatGPT6" },
  { category: "Drama", title: "Sinetron 'Cinta Setelah Cinta' tamat", desc: "Episode pamungkas malam ini", posts: "76K", type: "video", hashtag: "CintaSetelahCinta" },
  { category: "Hiburan", title: "Raisa rilis lagu duet bareng Tulus", desc: "Album kolaborasi pertama", posts: "108K", type: "video", hashtag: "RaisaTulus" },
  { category: "Politik", title: "RUU Perlindungan Data Pribadi disahkan", desc: "Berlaku efektif 6 bulan ke depan", posts: "84K", type: "article", hashtag: "RUUPDP" },
  { category: "Viral", title: "Tren ngopi pagi #BangunNgopi di X", desc: "Diviralkan barista muda Bandung", posts: "62K", type: "article", hashtag: "BangunNgopi" },
  { category: "K-Pop", title: "NewJeans tampil di MAMA Awards Jakarta", desc: "Disambut 30 ribu penonton", posts: "456K", type: "video", hashtag: "NewJeansJKT" },
  { category: "Lifestyle", title: "Wisata Labuan Bajo masuk top 5 Asia", desc: "Penghargaan TripAdvisor 2026", posts: "55K", type: "article", hashtag: "LabuanBajo" },
  { category: "Olahraga", title: "Greysia/Apriyani comeback ganda putri", desc: "Setelah pensiun 2024 lalu", posts: "47K", type: "article", hashtag: "GreysiaApriyani" }
];

// Hash hari: rotasi stabil per tanggal — 25 entry pool × 10 per hari
function _trendingDailyOffset() {
  const d = new Date();
  // YYYY-MM-DD jadi seed sederhana
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return seed % TRENDING_POOL.length;
}

function _extractHashtagsFromVideo(v) {
  const text = `${v.title || ""} ${v.desc || ""} ${v.tags || ""}`.toLowerCase();
  const tags = [];
  const re = /#([a-z0-9_\-]{2,30})/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!tags.includes(m[1])) tags.push(m[1]);
  }
  if (tags.length === 0 && v.category) {
    tags.push(String(v.category).toLowerCase().replace(/[^a-z0-9]/g, ""));
  }
  return tags.filter(Boolean);
}

// Platform real trends — dari video 48 jam terakhir di platform
function computePlatformTrending(windowMs = 48 * 60 * 60 * 1000) {
  const videos = (typeof getPlatformVideos === "function" ? getPlatformVideos() : []) || [];
  const now = Date.now();
  const recent = videos.filter(v => {
    const ts = v.createdAt || (typeof v.id === "number" && v.id > 1e12 ? v.id : 0);
    return ts && (now - ts) <= windowMs;
  });
  const map = new Map();
  recent.forEach(v => {
    const tags = _extractHashtagsFromVideo(v);
    const views = Number(v.viewsNum || 0);
    tags.forEach(tag => {
      const cur = map.get(tag) || { tag, count: 0, views: 0 };
      cur.count += 1;
      cur.views += views;
      map.set(tag, cur);
    });
  });
  const list = Array.from(map.values()).map(x => ({
    type: "platform-tag",
    category: "Platform Playly",
    title: `#${x.tag}`,
    desc: `${x.count} video baru di platform`,
    posts: (x.views >= 1000 ? `${(x.views / 1000).toFixed(1)}K` : String(x.views)) + " views",
    hashtag: x.tag,
    score: x.count + Math.sqrt(x.views) * 0.3
  }));
  list.sort((a, b) => b.score - a.score);
  return list;
}

// Combined: platform real (priority) + curated daily rotation
function getDailyTrending() {
  const platform = computePlatformTrending();
  const offset = _trendingDailyOffset();
  // Pick 10 dari pool dengan rotasi harian
  const curated = [];
  for (let i = 0; i < 10 && i < TRENDING_POOL.length; i++) {
    curated.push(TRENDING_POOL[(offset + i) % TRENDING_POOL.length]);
  }
  // Platform trends di atas; curated mengisi sampai total 10
  const out = [...platform];
  for (const c of curated) {
    if (out.length >= 10) break;
    if (out.find(x => x.hashtag === c.hashtag)) continue;
    out.push(c);
  }
  return out.slice(0, 10);
}

function renderTrendingInto(targetSelector) {
  const wrap = document.querySelector(targetSelector);
  if (!wrap) return;
  const items = getDailyTrending();
  if (items.length === 0) {
    wrap.innerHTML = `
      <div class="trending-empty">
        <div class="trending-empty-icon">📊</div>
        Belum ada trending hari ini.<br/>
        <small>Konten akan muncul setelah ada aktivitas baru.</small>
      </div>`;
    return;
  }
  wrap.innerHTML = items.map((t, i) => {
    const fire = i === 0 ? "🔥" : (i < 3 ? "⚡" : "");
    const typeIcon = t.type === "video" || t.type === "platform-tag" ? "🎬" : "📰";
    const tag = t.hashtag || (t.title || "").replace(/[^a-z0-9]/gi, "").slice(0, 24);
    return `<button class="trending-item" type="button" data-trending-tag="${escapeHtml(tag)}" title="Filter Discover by ${escapeHtml(tag)}">
      <span class="trending-rank">${i + 1}</span>
      <div class="trending-info">
        <small class="trending-cat">${escapeHtml(t.category || "Trending")} · ${typeIcon}</small>
        <strong>${escapeHtml(t.title || "")} ${fire}</strong>
        <small>${escapeHtml(t.posts || "—")}${t.desc ? ` · ${escapeHtml(t.desc)}` : ""}</small>
      </div>
    </button>`;
  }).join("");
  wrap.querySelectorAll("[data-trending-tag]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.trendingTag;
      if (!tag) return;
      // Buka X (Twitter) search di tab baru — user bisa lihat konten real
      // tentang topik yang trending di luar platform Playly.
      const url = `https://x.com/search?q=${encodeURIComponent("#" + tag)}&src=playly_trending`;
      window.open(url, "_blank", "noopener");
    });
  });
}

function renderTrendingHome() {
  renderTrendingInto("#trendingList");
  renderTrendingInto("#discoverTrendingList");
  // Tag chips di footer trending card (Discover sidebar) — kategori unik dari top items
  const items = getDailyTrending();
  const chipsEl = document.querySelector("#trendingTagChips");
  if (chipsEl) {
    const cats = [];
    items.forEach(t => {
      if (t.category && !cats.includes(t.category)) cats.push(t.category);
    });
    chipsEl.innerHTML = cats.slice(0, 4).map(c => `<span class="trending-chip">${escapeHtml(c)}</span>`).join("");
  }
  const cntLabel = document.querySelector("#trendingCountLabel");
  if (cntLabel) cntLabel.textContent = `(${items.length}) trending`;
}

// =================== SUGGEST USERS (sarankan kreator di Discover sidebar) ===================
function renderSuggestUsers() {
  const wrap = document.querySelector("#suggestUsersList");
  if (!wrap) return;
  let creators = [];
  try {
    creators = (typeof getPlatformCreators === "function" ? getPlatformCreators({ activeOnly: true }) : []) || [];
  } catch { creators = []; }
  // Sort by videoCount/views — kreator yg lebih aktif rank atas; ambil 20 teratas (sisanya bisa di-scroll)
  creators.sort((a, b) => (b.videos || b.videoCount || 0) - (a.videos || a.videoCount || 0));
  const top = creators.slice(0, 20);
  const following = (state?.followingCreators || []).map(x => String(x).toLowerCase());

  if (top.length === 0) {
    wrap.innerHTML = `
      <div class="suggest-empty">
        <div class="suggest-empty-icon">👥</div>
        <p>Belum ada kreator lain</p>
        <small>Kreator akan muncul di sini setelah ada user yang upload video.</small>
      </div>`;
    return;
  }

  const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  wrap.innerHTML = top.map(c => {
    const uname = String(c.name || c.username || "").toLowerCase();
    const display = c.displayName || c.name || c.username || "Kreator";
    const init = (display.split(/\s+/).map(s => s[0]).slice(0, 2).join("") || "U").toUpperCase();
    const isFollowing = following.includes(uname);
    const videoCount = c.videos || c.videoCount || 0;
    // Fresh ring — kreator yang upload < 24 jam dapat ring gradient (Instagram-style).
    const isFresh = c.latestUploadAt && (now - c.latestUploadAt) < FRESH_WINDOW_MS;
    const avatarCls = `suggest-avatar${isFresh ? " fresh" : ""}`;
    return `<div class="suggest-item" data-suggest-uname="${escapeHtml(uname)}">
      <div class="${avatarCls}"${isFresh ? ' title="Baru upload — &lt; 24 jam"' : ""}>${c.avatar ? `<img src="${escapeHtml(c.avatar)}" alt=""/>` : `<span>${escapeHtml(init)}</span>`}</div>
      <div class="suggest-info">
        <strong>${escapeHtml(display)}</strong>
        <small>@${escapeHtml(uname)} · ${videoCount} video</small>
      </div>
      <button class="btn ${isFollowing ? "ghost" : "primary"} sm" data-suggest-action="follow" type="button">
        ${isFollowing ? "✓ Following" : "+ Follow"}
      </button>
    </div>`;
  }).join("");

  wrap.querySelectorAll(".suggest-item").forEach(item => {
    const uname = item.dataset.suggestUname;
    // Klik area card (selain tombol follow) → buka profil kreator
    item.addEventListener("click", e => {
      if (e.target.closest("[data-suggest-action]")) return;
      if (typeof openUserProfile === "function") openUserProfile(uname);
      else { switchView("user-profile"); }
    });
    // Tombol follow
    const followBtn = item.querySelector('[data-suggest-action="follow"]');
    followBtn?.addEventListener("click", e => {
      e.stopPropagation();
      if (!Array.isArray(state.followingCreators)) state.followingCreators = [];
      const idx = state.followingCreators.findIndex(x => String(x).toLowerCase() === uname);
      if (idx >= 0) {
        state.followingCreators.splice(idx, 1);
        toast(`Berhenti follow <b>@${escapeHtml(uname)}</b>`, "info");
      } else {
        state.followingCreators.push(uname);
        toast(`✓ Follow <b>@${escapeHtml(uname)}</b>`, "success");
      }
      saveState();
      renderSuggestUsers();
      if (typeof renderUserStats === "function") renderUserStats();
    });
  });
}

// Wire button "Follow Semua" di Sarankan Kreator card — follow semua kreator yg ditampilkan
document.addEventListener("click", e => {
  const btn = e.target.closest("#suggestFollowAll");
  if (!btn) return;
  e.preventDefault();
  const items = document.querySelectorAll("#suggestUsersList .suggest-item");
  if (!items.length) return;
  if (!Array.isArray(state.followingCreators)) state.followingCreators = [];
  let added = 0;
  items.forEach(it => {
    const uname = (it.dataset.suggestUname || "").toLowerCase();
    if (!uname) return;
    if (!state.followingCreators.some(x => String(x).toLowerCase() === uname)) {
      state.followingCreators.push(uname);
      added++;
    }
  });
  if (added > 0) {
    saveState();
    renderSuggestUsers();
    if (typeof renderUserStats === "function") renderUserStats();
    toast(`✓ Follow <b>${added}</b> kreator sekaligus`, "success");
  } else {
    toast("Sudah follow semua kreator yang disarankan", "info");
  }
});

// "Lihat semua →" di Trending card — buka X.com search top trending hari ini
document.addEventListener("click", e => {
  const link = e.target.closest("[data-trending-more]");
  if (!link) return;
  e.preventDefault();
  window.open("https://x.com/explore/tabs/trending", "_blank", "noopener");
});

// Auto-refresh trending tiap menit — re-evaluasi platform real-time data + rotasi.
let _trendingInterval = null;
function startTrendingAutoRefresh() {
  if (_trendingInterval) return;
  _trendingInterval = setInterval(() => {
    if (state?.currentView === "home" || state?.currentView === "discover") renderTrendingHome();
  }, 60 * 1000);
}
function stopTrendingAutoRefresh() {
  if (_trendingInterval) { clearInterval(_trendingInterval); _trendingInterval = null; }
}

function renderCreatorSpotlight() {
  const stage = $("#creatorSpotlight");
  const track = $("#csTrack");
  const dots = $("#csDots");
  const current = $("#csCurrent");
  const total = $("#csTotal");
  if (!stage || !track) return;

  // Top 5 active creators by total views (real data dari localStorage)
  const creators = getPlatformCreators({ activeOnly: true }).map(c => {
    const stateRaw = localStorage.getItem(`playly-state-${c.name}`);
    let videos = [];
    try { videos = JSON.parse(stateRaw)?.myVideos || []; } catch {}
    const totalViews = videos.reduce((s, v) => s + (v.viewsNum || 0), 0);
    const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
    const followers = (typeof getUserFollowers === "function" ? getUserFollowers(c.name).length : 0);
    const latestVideo = videos[0];
    // Cari avatar dari playly-account-* yang match
    let avatar = null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("playly-account-")) continue;
        const a = JSON.parse(localStorage.getItem(k));
        if (a?.username && String(a.username).toLowerCase() === String(c.name).toLowerCase()) {
          avatar = a.avatar || null;
          break;
        }
      }
    } catch {}
    return { ...c, totalViews, totalLikes, followers, latestVideo, avatar };
  }).sort((a, b) => b.totalViews - a.totalViews).slice(0, 5);

  csState.list = creators;
  csState.idx = 0;

  if (!creators.length) {
    track.innerHTML = `<div class="cs-empty">🌟 Belum ada kreator aktif. Jadilah yang pertama upload video!</div>`;
    if (dots) dots.innerHTML = "";
    if (current) current.textContent = "0";
    if (total) total.textContent = "0";
    csStopAutoplay();
    return;
  }

  if (current) current.textContent = "1";
  if (total) total.textContent = String(creators.length);

  track.innerHTML = creators.map(c => {
    const initials = (c.displayName || c.name || "?").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
    const avatarInner = c.avatar
      ? `<img src="${c.avatar}" alt=""/>`
      : `<span>${escapeHtml(initials)}</span>`;
    const thumb = c.latestVideo?.thumb;
    const thumbInner = thumb
      ? `<div class="cs-thumb" data-vid="${c.latestVideo.id}"><img src="${thumb}" alt=""/></div>`
      : `<div class="cs-thumb cs-thumb-empty"></div>`;
    return `
      <div class="cs-slide" data-creator="${escapeHtml(c.name)}">
        <div class="cs-avatar">${avatarInner}</div>
        <div class="cs-info">
          <h4>${escapeHtml(c.displayName || c.name)}</h4>
          <div class="uname">@${escapeHtml(c.name)}</div>
          <div class="stats">
            <span><b>${fmtNum(c.videoCount)}</b>video</span>
            <span><b>${fmtNum(c.totalViews)}</b>views</span>
            <span><b>${fmtNum(c.followers)}</b>followers</span>
            <span><b>${fmtNum(c.totalLikes)}</b>likes</span>
          </div>
        </div>
        ${thumbInner}
      </div>
    `;
  }).join("");

  if (dots) {
    dots.innerHTML = creators.map((_, i) =>
      `<button class="cs-dot ${i === 0 ? "active" : ""}" data-cs-dot="${i}" aria-label="Slide ${i + 1}"></button>`
    ).join("");
    dots.querySelectorAll("[data-cs-dot]").forEach(d => {
      d.addEventListener("click", () => { csGoTo(parseInt(d.dataset.csDot)); csStartAutoplay(); });
    });
  }

  // Slide click → buka profil kreator; thumb click → langsung play video
  track.querySelectorAll(".cs-slide").forEach(s => {
    const thumb = s.querySelector(".cs-thumb[data-vid]");
    if (thumb) {
      thumb.addEventListener("click", e => {
        e.stopPropagation();
        const vid = parseInt(thumb.dataset.vid);
        if (vid && typeof openPlayer === "function") openPlayer(vid);
      });
    }
    s.addEventListener("click", () => {
      const cname = s.dataset.creator;
      if (cname && typeof openUserProfile === "function") openUserProfile(cname);
    });
  });

  csGoTo(0);
  csStartAutoplay();
}

function csGoTo(idx) {
  const track = $("#csTrack");
  const current = $("#csCurrent");
  if (!track || !csState.list.length) return;
  csState.idx = ((idx % csState.list.length) + csState.list.length) % csState.list.length;
  track.style.transform = `translateX(-${csState.idx * 100}%)`;
  if (current) current.textContent = String(csState.idx + 1);
  $$(".cs-dot").forEach((d, i) => d.classList.toggle("active", i === csState.idx));
}

function csStartAutoplay() {
  csStopAutoplay();
  if (csState.list.length < 2) return;
  csState.timer = setInterval(() => csGoTo(csState.idx + 1), 5000);
}
function csStopAutoplay() {
  if (csState.timer) { clearInterval(csState.timer); csState.timer = null; }
}

function bindCreatorSpotlight() {
  const prev = $("#csPrev"), next = $("#csNext"), wrap = $("#creatorSpotlight");
  if (prev && !prev.dataset.bound) {
    prev.dataset.bound = "1";
    prev.addEventListener("click", () => { csGoTo(csState.idx - 1); csStartAutoplay(); });
  }
  if (next && !next.dataset.bound) {
    next.dataset.bound = "1";
    next.addEventListener("click", () => { csGoTo(csState.idx + 1); csStartAutoplay(); });
  }
  if (wrap && !wrap.dataset.bound) {
    wrap.dataset.bound = "1";
    wrap.addEventListener("mouseenter", csStopAutoplay);
    wrap.addEventListener("mouseleave", csStartAutoplay);
  }
}

// Auto-bind static handler saat DOM siap
bindQuickActions();
bindCreatorSpotlight();

function renderCreators() {
  const list = $("#creatorList");
  if (!list) return;
  // Home "Online Sekarang" — hanya kreator aktif (sudah upload minimal 1 video)
  const creators = getPlatformCreators({ activeOnly: true });
  const onlinePill = list.parentElement.querySelector(".online-pill");

  if (!creators.length) {
    list.innerHTML = `<div style="text-align:center; padding:24px 12px; color:var(--muted); font-size:12.5px">
      <div style="font-size:32px; opacity:.5; margin-bottom:6px">👥</div>
      Belum ada kreator aktif.<br/>Cek <b style="color:var(--primary); cursor:pointer" data-jump="discover">Discover</b> untuk eksplor.
    </div>`;
    if (onlinePill) onlinePill.style.display = "none";
    return;
  }
  if (onlinePill) {
    onlinePill.style.display = "";
    onlinePill.innerHTML = `<i></i> ${creators.filter(c => c.online).length} online`;
  }
  list.innerHTML = creators.slice(0, 6).map(c => `
    <div class="creator-item">
      <div class="avatar">
        <span>${c.init}</span>
        ${c.online ? '<i class="status"></i>' : ''}
      </div>
      <div class="info">
        <strong>@${c.name}</strong>
        <small>${c.subs}</small>
      </div>
      <button class="follow-btn ${state.followingCreators.includes(c.name) ? 'following' : ''}" data-follow="${c.name}">
        ${state.followingCreators.includes(c.name) ? '✓' : '+ Follow'}
      </button>
    </div>
  `).join("");
  $$("[data-follow]", list).forEach(b => b.addEventListener("click", () => toggleFollow(b.dataset.follow)));
}

function toggleFollow(name) {
  const wasFollowing = state.followingCreators.includes(name);
  if (wasFollowing) {
    state.followingCreators = state.followingCreators.filter(x => x !== name);
    toast(`Berhenti mengikuti <b>@${name}</b>`);
  } else {
    state.followingCreators.push(name);
    toast(`✓ Mengikuti <b>@${name}</b>`, "success");
    state.activities.unshift({ type: "follow", text: `Kamu mulai mengikuti <b>@${name}</b>`, time: "baru saja", icon: "👤" });
  }
  saveState();
  // Untuk akun real (terdaftar di platform): mirror relasi ke followers user lain.
  if (findAccountByUsername(name)) {
    setFollowerOnOtherUser(name, !wasFollowing);
    if (!wasFollowing) {
      const initials = (user?.name || user?.username || "U").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
      deliverNotification(name, {
        type: "follow",
        init: initials,
        fromUsername: user.username,
        text: `<b>@${user.username}</b> mulai mengikutimu 👤`
      });
    }
  }
  renderCreators();
  renderDiscoverCreators();
  renderHomeTrending();
  renderHomeStats();
  renderHomeActivity();
  renderActivityList();
  renderUserStats();
  refreshHeroGreeting();
  if (state.currentView === "people") renderPeople();
  if (state.currentView === "user-profile") renderUserProfile();
}

// Tulis/hapus current user di array followers user lain (cross-storage).
// Hanya dipanggil untuk akun real — supaya tidak bikin record state hantu.
function setFollowerOnOtherUser(otherUsername, follow) {
  if (!otherUsername || !user) return;
  const key = `playly-state-${otherUsername}`;
  let s;
  try { s = JSON.parse(localStorage.getItem(key)); } catch { s = null; }
  if (!s) s = {};
  if (!Array.isArray(s.followers)) s.followers = [];
  const me = user.username;
  const has = s.followers.includes(me);
  if (follow && !has) s.followers.push(me);
  if (!follow && has) s.followers = s.followers.filter(x => x !== me);
  try { localStorage.setItem(key, JSON.stringify(s)); } catch {}
  // Sinkron dengan state in-memory kalau kebetulan login sebagai user itu (jarang).
  if (user.username === otherUsername && Array.isArray(state?.followers)) {
    state.followers = s.followers;
  }
}

// Daftar followers user mana pun (pakai state in-memory kalau itu user login).
function getUserFollowers(username) {
  if (!username) return [];
  if (user && user.username === username) return Array.isArray(state?.followers) ? state.followers.slice() : [];
  try {
    const s = JSON.parse(localStorage.getItem(`playly-state-${username}`));
    return Array.isArray(s?.followers) ? s.followers : [];
  } catch { return []; }
}

// Daftar kreator yang diikuti user mana pun.
function getUserFollowing(username) {
  if (!username) return [];
  if (user && user.username === username) return Array.isArray(state?.followingCreators) ? state.followingCreators.slice() : [];
  try {
    const s = JSON.parse(localStorage.getItem(`playly-state-${username}`));
    return Array.isArray(s?.followingCreators) ? s.followingCreators : [];
  } catch { return []; }
}

function renderFeatured() {
  const slot = $("#featuredVideo");
  const card = $("#featuredCard");
  if (!slot || !card) return;

  // Priority 1: video terbaru user sendiri (myVideos sudah unshift saat upload, jadi [0] = terbaru)
  // Priority 2: kalau user belum upload, fallback ke video terpopuler platform
  const ownLatest = state?.myVideos?.[0];
  const platform = getPlatformVideos();
  const v = ownLatest || platform[0];

  // Card SELALU muncul — kalau tidak ada video, tampilkan empty state biar user
  // tahu lokasi tile-nya & ada CTA upload.
  card.style.display = "";

  const heading = card.querySelector(".card-head h3");

  if (!v) {
    if (heading) heading.textContent = "⭐ Video Terbaru Saya";
    slot.innerHTML = `
      <div class="featured-empty">
        <div class="featured-empty-icon">🎬</div>
        <h4>Belum ada video</h4>
        <p>Upload video pertamamu untuk muncul di sini sebagai sorotan utama.</p>
        <button class="btn primary small" data-jump="upload">📤 Upload Sekarang</button>
      </div>
    `;
    return;
  }

  // Update heading sesuai konteks (own = "Video Terbaru Saya", platform = "Featured")
  if (heading) heading.textContent = ownLatest ? "⭐ Video Terbaru Saya" : "⭐ Featured";

  // Real-time relative timestamp
  const ts = v.createdAt || (typeof v.id === "number" && v.id > 1e12 ? v.id : null);
  const timeText = ts ? relTime(ts) : (v.time || "");
  const viewsText = v.views ? `${v.views} views` : (typeof v.viewsNum === "number" ? `${fmtNum(v.viewsNum)} views` : "");
  // Badge "Baru" / "Trending" untuk visual distinction
  const badgeText = ownLatest ? "🆕 Video Baru" : "🔥 Trending";

  slot.innerHTML = `
    <div class="featured-video">
      <div class="thumb">
        <img src="${v.thumb}" alt="${escapeHtml(v.title)}"/>
        <span class="featured-badge">${badgeText}</span>
        <div class="thumb-overlay">
          <button class="play-btn" data-feat-vid="${v.id}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
          <span class="duration">${escapeHtml(v.duration || "0:00")}</span>
        </div>
      </div>
      <div class="featured-info">
        <h4>${escapeHtml(v.title)}</h4>
        <p><b>@${escapeHtml(v.creator)}</b>${viewsText ? " • " + viewsText : ""}${timeText ? " • " + escapeHtml(timeText) : ""}</p>
      </div>
    </div>
  `;
  slot.querySelector("[data-feat-vid]")?.addEventListener("click", e => {
    e.stopPropagation();
    openPlayer(+e.currentTarget.dataset.featVid);
  });
}

// ----------------------- VIDEOS VIEW -----------------------
function syncVideoTabCounts() {
  const all = state.myVideos?.length || 0;
  const up = state.uploadingVideos?.length || 0;
  const tr = state.deletedVideos?.length || 0;
  const setT = (id, n) => { const el = $("#" + id); if (el) el.textContent = n; };
  setT("chipCountAll", all);
  setT("chipCountUploading", up);
  setT("chipCountTrash", tr);
}

function renderVideoGrid() {
  const grid = $("#videoGrid");
  if (!grid) return;
  syncVideoTabCounts();

  // Sembunyikan dropdown "Sort" untuk tab non-Semua (tidak relevan)
  const sortEl = $("#videoSort");
  if (sortEl) sortEl.style.visibility = state.filter === "all" ? "" : "hidden";

  if (state.filter === "uploading") return renderUploadingList(grid);
  if (state.filter === "trash") return renderTrashList(grid);

  // Default: Semua
  grid.classList.remove("trash-grid");
  let list = [...state.myVideos];
  if (state.videoSort === "views") list.sort((a, b) => (b.viewsNum || 0) - (a.viewsNum || 0));
  else if (state.videoSort === "likes") list.sort((a, b) => (b.likes || 0) - (a.likes || 0));

  if (!list.length) {
    grid.innerHTML = emptyHTML("🎬", "Belum ada video",
      "Upload video pertamamu untuk mulai berbagi kreasi ke seluruh dunia.",
      "📤 Upload Video Pertama", "upload");
  } else {
    grid.innerHTML = list.map(videoCardHTML).join("");
    bindVideoCards(grid);
    // Bind delete buttons di tiap card
    $$("[data-delete-vid]", grid).forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      moveVideoToTrash(+b.dataset.deleteVid);
    }));
  }
}

function renderUploadingList(grid) {
  grid.classList.add("trash-grid");
  const list = state.uploadingVideos || [];
  if (!list.length) {
    grid.innerHTML = emptyHTML("⏳", "Tidak ada upload aktif",
      "Video yang sedang diunggah akan muncul di sini dengan progress real-time.",
      "📤 Upload Sekarang", "upload");
    return;
  }
  grid.innerHTML = `<div style="display:flex; flex-direction:column; gap:10px">${list.map(uploadCardHTML).join("")}</div>`;
  $$("[data-cancel-up]", grid).forEach(b => b.addEventListener("click", () => {
    cancelUpload(b.dataset.cancelUp);
  }));
}

function renderTrashList(grid) {
  grid.classList.add("trash-grid");
  const list = state.deletedVideos || [];
  if (!list.length) {
    grid.innerHTML = emptyHTML("🗑️", "Sampah kosong",
      "Video yang kamu hapus akan muncul di sini. Bisa dipulihkan kapan saja.",
      "", "");
    return;
  }
  grid.innerHTML = `<div style="display:flex; flex-direction:column; gap:10px">${list.map(trashCardHTML).join("")}</div>`;
  $$("[data-restore]", grid).forEach(b => b.addEventListener("click", () => restoreVideo(+b.dataset.restore)));
  $$("[data-delete-perm]", grid).forEach(b => b.addEventListener("click", () => permaDeleteVideo(+b.dataset.deletePerm)));
}

function uploadCardHTML(u) {
  return `
    <div class="upload-progress-card" data-up="${u.id}">
      <div class="thumb-mini">${u.thumb ? `<img src="${u.thumb}" alt=""/>` : ""}</div>
      <div class="info">
        <strong>${escapeHtml(u.title)}</strong>
        <small>${u.status === "done" ? "✓ Selesai" : `Mengunggah... ${Math.floor(u.progress || 0)}%`}</small>
        <div class="progress-bar"><i style="width:${Math.floor(u.progress || 0)}%"></i></div>
      </div>
      ${u.status === "uploading" ? `<button class="btn ghost" data-cancel-up="${u.id}">Batal</button>` : ""}
    </div>
  `;
}

function trashCardHTML(v) {
  const ago = v.deletedAt ? relTime(v.deletedAt) : "—";
  return `
    <div class="trash-card" data-vid="${v.id}">
      <div class="thumb-mini"><img src="${v.thumb}" alt=""/></div>
      <div class="info">
        <strong>${escapeHtml(v.title)}</strong>
        <small>Dihapus ${ago} • ${v.duration || "0:00"}</small>
      </div>
      <div class="actions">
        <button class="btn primary" data-restore="${v.id}">↺ Pulihkan</button>
        <button class="btn ghost" data-delete-perm="${v.id}" title="Hapus permanen">🗑️</button>
      </div>
    </div>
  `;
}

// ----------------------- DELETE / RESTORE / PERMA-DELETE -----------------------
function moveVideoToTrash(id) {
  const idx = state.myVideos.findIndex(v => v.id === id);
  if (idx < 0) return;
  const [v] = state.myVideos.splice(idx, 1);
  v.deletedAt = Date.now();
  state.deletedVideos = state.deletedVideos || [];
  state.deletedVideos.unshift(v);
  saveState();
  refreshAllVideoGrids();
  renderUserStats();
  toast(`🗑️ <b>${escapeHtml(v.title)}</b> dipindah ke Sampah`, "warning");
}

function restoreVideo(id) {
  const idx = state.deletedVideos.findIndex(v => v.id === id);
  if (idx < 0) return;
  const [v] = state.deletedVideos.splice(idx, 1);
  delete v.deletedAt;
  state.myVideos.unshift(v);
  saveState();
  refreshAllVideoGrids();
  renderUserStats();
  toast(`✓ <b>${escapeHtml(v.title)}</b> berhasil dipulihkan`, "success");
}

function permaDeleteVideo(id) {
  const idx = state.deletedVideos.findIndex(v => v.id === id);
  if (idx < 0) return;
  const v = state.deletedVideos[idx];
  openConfirm({
    icon: "🗑️", iconClass: "danger",
    title: "Hapus Permanen?",
    desc: `Video <b>${escapeHtml(v.title)}</b> akan dihapus secara permanen dan tidak bisa dipulihkan.`,
    btnText: "Hapus Permanen", btnClass: "danger",
    onConfirm: () => {
      state.deletedVideos.splice(idx, 1);
      saveState();
      // Hapus juga file aslinya dari IndexedDB
      try {
        openVideoDB().then(db => {
          const tx = db.transaction(VIDEO_STORE, "readwrite");
          tx.objectStore(VIDEO_STORE).delete(id);
          tx.oncomplete = () => refreshStorageUsage();
        });
      } catch {}
      refreshAllVideoGrids();
      toast(`🗑️ Video dihapus permanen`, "error");
    }
  });
}

function cancelUpload(uid) {
  state.uploadingVideos = (state.uploadingVideos || []).filter(u => u.id !== uid);
  // tandai supaya tick loop di startUpload berhenti
  if (window.__activeUploads) delete window.__activeUploads[uid];
  saveState();
  renderVideoGrid();
  toast("Upload dibatalkan", "warning");
}

$("#videoSort")?.addEventListener("change", e => { state.videoSort = e.target.value; renderVideoGrid(); });
$$("#filterTabs button").forEach(b => {
  b.addEventListener("click", () => {
    $$("#filterTabs button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    state.filter = b.dataset.filter;
    renderVideoGrid();
  });
});

// ----------------------- HISTORY VIEW -----------------------
function renderHistory() {
  if (!state.history.length) {
    $("#continueList").innerHTML = "";
    $("#historyGroups").innerHTML = `<div class="card">${emptyHTML("🕐", "Riwayat masih kosong", "Video yang kamu tonton akan muncul di sini, dikelompokkan berdasarkan tanggal.", "Discover Video", "discover")}</div>`;
    return;
  }

  const cont = state.history.filter(h => h.progress < 100).slice(0, 6);
  $("#continueList").innerHTML = cont.length ? cont.map(h => {
    const v = findVideo(h.videoId);
    if (!v) return "";
    return `
      <div class="continue-card" data-vid="${v.id}">
        <div class="mini-thumb">
          <img src="${v.thumb}" alt=""/>
          <div class="progress-bar"><i style="width:${h.progress}%"></i></div>
        </div>
        <div class="info">
          <h5>${v.title}</h5>
          <p class="meta">@${v.creator}</p>
          <div class="pct">▶ ${h.progress}% selesai</div>
        </div>
      </div>
    `;
  }).join("") : `<div style="grid-column:1/-1; padding:20px; text-align:center; color:var(--muted); font-size:13px">Tidak ada video yang sedang ditonton.</div>`;

  const groups = {};
  state.history.forEach(h => {
    if (!groups[h.group]) groups[h.group] = [];
    groups[h.group].push(h);
  });

  const groupOrder = ["Hari ini", "Kemarin", "Minggu ini", "Lebih lama"];
  const q = ($("#historySearch")?.value || "").toLowerCase();

  $("#historyGroups").innerHTML = groupOrder.filter(g => groups[g]).map(g => {
    const items = groups[g].filter(h => {
      if (!q) return true;
      const v = findVideo(h.videoId);
      return v && (v.title.toLowerCase().includes(q) || v.creator.toLowerCase().includes(q));
    });
    if (!items.length) return "";
    return `
      <div class="history-group">
        <div class="history-group-title">${g}</div>
        ${items.map(h => {
          const v = findVideo(h.videoId);
          if (!v) return "";
          return `
            <div class="history-item" data-vid="${v.id}">
              <div class="mini-thumb"><img src="${v.thumb}" alt=""/></div>
              <div class="info">
                <h5>${v.title}</h5>
                <div class="meta">@${v.creator} • ${v.views} views • ${h.progress}% ditonton</div>
              </div>
              <div class="time-ago">${h.time}</div>
              <button class="remove-btn" data-rm="${state.history.indexOf(h)}">✕</button>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }).join("") || `<div class="card" style="text-align:center; color:var(--muted); padding:32px">Tidak ada riwayat yang cocok.</div>`;

  $$("#continueList .continue-card, #historyGroups .history-item").forEach(c => {
    c.addEventListener("click", e => {
      if (e.target.closest(".remove-btn")) return;
      openPlayer(+c.dataset.vid);
    });
  });
  $$("[data-rm]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    state.history.splice(+b.dataset.rm, 1);
    saveState();
    renderHistory();
    toast("🗑️ Item dihapus dari riwayat");
  }));
}

$("#historySearch")?.addEventListener("input", () => renderHistory());
$("#clearHistory")?.addEventListener("click", () => {
  if (!state.history.length) return toast("Riwayat sudah kosong");
  if (!confirm("Hapus semua riwayat tonton?")) return;
  state.history = [];
  saveState();
  renderHistory();
  toast("✓ Riwayat dikosongkan", "success");
});

// ----------------------- STATS VIEW -----------------------
const CHART_DATA_DEMO = {
  weekly: { labels: ["Sen","Sel","Rab","Kam","Jum","Sab","Min"], values: [120, 180, 150, 240, 220, 320, 280] },
  monthly: { labels: ["W1","W2","W3","W4"], values: [820, 1240, 980, 1680] },
  yearly: { labels: ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"], values: [3200,2800,4100,3600,5200,4800,6100,5800,7200,6900,8400,9200] }
};

function emptyChartData(range) {
  const ranges = {
    weekly: { labels: ["Sen","Sel","Rab","Kam","Jum","Sab","Min"], values: [0,0,0,0,0,0,0] },
    monthly: { labels: ["W1","W2","W3","W4"], values: [0,0,0,0] },
    yearly: { labels: ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"], values: new Array(12).fill(0) }
  };
  return ranges[range];
}

function drawChart() {
  const svg = $("#lineChart");
  const empty = $("#chartEmpty");
  if (!svg) return;
  const hasData = state.myVideos.length > 0;

  // Subtitle
  const subtitle = $("#chartSubtitle");
  if (subtitle) {
    if (!hasData) subtitle.textContent = "Belum ada data";
    else {
      const labelMap = { weekly: "minggu ini", monthly: "bulan ini", yearly: "tahun ini" };
      subtitle.innerHTML = `Performa ${labelMap[state.chartRange]} <b style="color:var(--success)">+12.4%</b>`;
    }
  }

  if (!hasData) {
    svg.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const data = CHART_DATA_DEMO[state.chartRange];
  const W = 700, H = 200, PAD_L = 36, PAD_R = 16, PAD_T = 16, PAD_B = 28;
  const max = Math.max(...data.values, 100) * 1.1;
  const stepX = (W - PAD_L - PAD_R) / (data.values.length - 1);
  const points = data.values.map((v, i) => [PAD_L + i * stepX, H - PAD_B - (v / max) * (H - PAD_T - PAD_B)]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(" ");
  const area = `${path} L ${points[points.length - 1][0]} ${H - PAD_B} L ${points[0][0]} ${H - PAD_B} Z`;
  const dotFill = getComputedStyle(document.body).getPropertyValue("--bg-elev").trim() || "#11131f";

  let grid = "";
  for (let i = 0; i <= 3; i++) {
    const y = PAD_T + (i * (H - PAD_T - PAD_B) / 3);
    const val = Math.round(max - (i * max / 3));
    grid += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="rgba(140,150,180,.1)" stroke-dasharray="2,4"/>`;
    grid += `<text x="${PAD_L - 6}" y="${y + 3}" fill="rgba(140,150,180,.6)" font-size="9" text-anchor="end" font-family="Inter">${val}</text>`;
  }

  let xLabels = "";
  data.labels.forEach((l, i) => {
    xLabels += `<text x="${PAD_L + i * stepX}" y="${H - PAD_B + 16}" fill="rgba(140,150,180,.6)" font-size="10" text-anchor="middle" font-family="Inter">${l}</text>`;
  });

  let dots = "";
  points.forEach((p, i) => {
    dots += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${dotFill}" stroke="url(#chartG)" stroke-width="2" data-i="${i}" class="chart-dot" style="cursor:pointer;transition:r .2s"/>`;
  });

  svg.innerHTML = `
    <defs>
      <linearGradient id="chartG" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#561C24"/><stop offset="100%" stop-color="#E8D8C4"/></linearGradient>
      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6D2932" stop-opacity=".35"/><stop offset="100%" stop-color="#E8D8C4" stop-opacity="0"/></linearGradient>
    </defs>
    ${grid}
    <path d="${area}" fill="url(#chartFill)"/>
    <path d="${path}" fill="none" stroke="url(#chartG)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    ${xLabels}
  `;

  const tip = $("#chartTip");
  $$(".chart-dot", svg).forEach((d, i) => {
    d.addEventListener("mouseenter", () => {
      d.setAttribute("r", "5");
      const rect = svg.getBoundingClientRect();
      const cx = +d.getAttribute("cx") * (rect.width / W);
      const cy = +d.getAttribute("cy") * (rect.height / H);
      tip.innerHTML = `<small>${data.labels[i]}</small><b>${data.values[i].toLocaleString("id-ID")} views</b>`;
      tip.style.left = `${cx - tip.offsetWidth / 2}px`;
      tip.style.top = `${cy - tip.offsetHeight - 10}px`;
      tip.classList.add("show");
    });
    d.addEventListener("mouseleave", () => { d.setAttribute("r", "3.5"); tip.classList.remove("show"); });
  });
}

$$("#chartTabs button").forEach(b => {
  b.addEventListener("click", () => {
    $$("#chartTabs button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    state.chartRange = b.dataset.range;
    drawChart();
  });
});
$("#statsRange")?.addEventListener("change", e => toast(`📊 Periode: <b>${e.target.options[e.target.selectedIndex].text}</b>`));

function renderTopPerforming() {
  const list = $("#topPerformList");
  const card = $("#topPerfCard");
  if (!list || !card) return;
  if (!state.myVideos.length) {
    // Hide entire card for new user — no clutter
    card.style.display = "none";
    return;
  }
  card.style.display = "";
  const top = [...state.myVideos].sort((a, b) => (b.viewsNum || 0) - (a.viewsNum || 0)).slice(0, 5);
  list.innerHTML = top.map((v, i) => `
    <div class="top-perf-item" data-vid="${v.id}">
      <div class="top-perf-rank ${i === 0 ? 'first' : ''}">#${i + 1}</div>
      <div class="mini-thumb"><img src="${v.thumb}" alt=""/></div>
      <div class="info"><h5>${v.title}</h5><div class="meta">@${v.creator} • ${v.duration}</div></div>
      <div class="views">${v.views}</div>
    </div>
  `).join("");
  $$(".top-perf-item", list).forEach(c => c.addEventListener("click", () => openPlayer(+c.dataset.vid)));
}

// ----------------------- ACTIVITY VIEW -----------------------
function renderActivityList() {
  const list = $("#activityList");
  if (!list) return;
  const filtered = state.actFilter === "all" ? state.activities : state.activities.filter(a => a.type === state.actFilter);
  if (!filtered.length) {
    list.innerHTML = emptyHTML("📡", state.activities.length === 0 ? "Belum ada aktivitas" : "Tidak ada aktivitas di kategori ini",
      state.activities.length === 0 ? "Aktivitas akun seperti like, follow, dan komentar akan muncul di sini." : "Coba ganti filter atau lihat semua.",
      state.activities.length === 0 ? "Discover" : null, "discover");
    return;
  }
  list.innerHTML = filtered.map(a => `
    <div class="activity-item">
      <div class="act-icon ${a.type}">${a.icon}</div>
      <div class="act-text">${a.text}</div>
      <div class="act-time">${a.time}</div>
    </div>
  `).join("");
}
$$("#activityFilters button").forEach(b => {
  b.addEventListener("click", () => {
    $$("#activityFilters button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    state.actFilter = b.dataset.actFilter;
    renderActivityList();
  });
});

// ----------------------- DISCOVER VIEW -----------------------
function renderDiscoverHero() {
  const slot = $("#discoverHeroSlot");
  if (!slot) return;
  const platform = getPlatformVideos();
  if (!platform.length) {
    slot.innerHTML = `
      <div class="card empty-discover-hero">
        <div class="empty-state" style="padding:60px 24px">
          <div class="empty-icon">🎬</div>
          <h4>Discover masih sepi</h4>
          <p>Belum ada video di platform. Jadilah kreator pertama dan mulai bagikan kreasimu!</p>
          <button class="btn primary" data-jump="upload">📤 Upload Video Pertama</button>
        </div>
      </div>
    `;
    return;
  }
  const v = platform[0];
  slot.innerHTML = `
    <div class="card discover-hero">
      <div class="dh-text">
        <span class="dh-badge">🌟 TRENDING</span>
        <h2>${v.title}</h2>
        <p>@${v.creator} • ${v.views} views • ${v.time}</p>
        <button class="btn primary" data-d-hero-play="${v.id}">▶ Tonton Sekarang</button>
      </div>
      <div class="dh-thumb">
        <img src="${v.thumb}" alt=""/>
      </div>
    </div>
  `;
  slot.querySelector("[data-d-hero-play]")?.addEventListener("click", e => openPlayer(+e.currentTarget.dataset.dHeroPlay));
}

const CATEGORIES = [
  { key: "music",         emoji: "🎵", label: "Music",       color: "#ec4899" },
  { key: "gaming",        emoji: "🎮", label: "Gaming",      color: "#561C24" },
  { key: "education",     emoji: "📚", label: "Edukasi",     color: "#3b82f6" },
  { key: "tech",          emoji: "💻", label: "Tech",        color: "#E8D8C4" },
  { key: "vlog",          emoji: "📹", label: "Vlog",        color: "#f59e0b" },
  { key: "entertainment", emoji: "🎬", label: "Hiburan",     color: "#ef4444" },
  { key: "food",          emoji: "🍳", label: "Kuliner",     color: "#eab308" },
  { key: "sports",        emoji: "🏃", label: "Olahraga",    color: "#10b981" },
  { key: "lifestyle",     emoji: "💄", label: "Lifestyle",   color: "#a855f7" },
  { key: "travel",        emoji: "✈️", label: "Travel",      color: "#06b6d4" }
];

function renderDiscoverCategories() {
  const grid = $("#discoverCategories");
  const card = $("#discoverCategoriesCard");
  if (!grid || !card) return;
  const platform = getPlatformVideos();
  if (!platform.length) {
    card.style.display = "none";
    return;
  }
  card.style.display = "";

  // Hitung jumlah video per kategori
  const counts = {};
  CATEGORIES.forEach(c => counts[c.key] = 0);
  platform.forEach(v => { if (counts[v.category] != null) counts[v.category]++; });

  // Hanya tampilkan kategori yang punya minimal 1 video
  const visible = CATEGORIES.filter(c => counts[c.key] > 0);

  if (!visible.length) {
    card.style.display = "none";
    return;
  }

  grid.innerHTML = visible.map(c => `
    <div class="cat-card" data-cat-filter="${c.key}" style="--cc:${c.color}">
      <span>${c.emoji}</span><b>${c.label}</b><small>${counts[c.key]} video</small>
    </div>
  `).join("");
  $$(".cat-card", grid).forEach(c => {
    c.addEventListener("click", () => {
      const cat = c.dataset.catFilter;
      const meta = CATEGORIES.find(x => x.key === cat);
      const filtered = platform.filter(v => v.category === cat);
      const dvGrid = $("#discoverVideos");
      if (!filtered.length) { toast(`Belum ada video di kategori <b>${meta?.label || cat}</b>`); return; }
      dvGrid.innerHTML = filtered.map(videoCardHTML).join("");
      bindVideoCards(dvGrid);
      dvGrid.scrollIntoView({ behavior: "smooth", block: "center" });
      toast(`📂 Kategori: <b>${meta?.emoji || ""} ${meta?.label || cat}</b> (${filtered.length} video)`);
    });
  });
}

function renderDiscoverCreators() {
  const list = $("#discoverCreators");
  const card = $("#discoverCreatorsCard");
  if (!list || !card) return;
  const creators = getPlatformCreators();
  if (!creators.length) {
    card.style.display = "none";
    return;
  }
  card.style.display = "";
  list.innerHTML = creators.map(c => `
    <div class="creator-grid-card">
      <div class="avatar big"><span>${c.init}</span>${c.online ? '<i class="status"></i>' : ''}</div>
      <strong>@${c.name}</strong>
      <small>${c.subs}</small>
      <button class="follow-btn ${state.followingCreators.includes(c.name) ? 'following' : ''}" data-follow-d="${c.name}">
        ${state.followingCreators.includes(c.name) ? '✓ Following' : '+ Follow'}
      </button>
    </div>
  `).join("");
  $$("[data-follow-d]", list).forEach(b => b.addEventListener("click", () => toggleFollow(b.dataset.followD)));
}

function renderDiscoverVideos() {
  const grid = $("#discoverVideos");
  const card = $("#discoverVideosCard");
  if (!grid || !card) return;
  const platform = getPlatformVideos();
  if (!platform.length) {
    card.style.display = "none";
    return;
  }
  card.style.display = "";
  grid.innerHTML = platform.map(videoCardHTML).join("");
  bindVideoCards(grid);
}

// ----------------------- FYP (TikTok-style For You Page) -----------------------
let fypTab = "foryou";
let fypObserver = null;
let fypTagFilter = null;  // null = no filter, string = filter by hashtag (without #)

// Ekstrak semua hashtag dari teks (#word). Lowercase, unique.
function extractHashtags(text) {
  if (!text) return [];
  const m = String(text).match(/#([\p{L}\p{N}_]+)/gu);
  if (!m) return [];
  return [...new Set(m.map(t => t.slice(1).toLowerCase()))];
}

// Render caption dengan hashtag jadi pill yang bisa di-klik.
function linkifyHashtags(text) {
  if (!text) return "";
  return escapeHtml(text).replace(/#([\p{L}\p{N}_]+)/gu, (m, tag) =>
    `<button class="fyp-tag-pill" data-fyp-tag="${escapeHtml(tag.toLowerCase())}">#${escapeHtml(tag)}</button>`
  );
}

function videoMatchesTag(v, tag) {
  if (!tag) return true;
  const t = tag.toLowerCase();
  const haystack = `${v.title || ""} ${v.desc || ""} ${v.category || ""}`.toLowerCase();
  return haystack.includes("#" + t) || haystack.includes(t);
}

let discoverQuery = "";

function getFypVideos() {
  // Discover hanya menampilkan video dari kreator LAIN — bukan video sendiri.
  // User bisa lihat video mereka di "My Library". Discover = explore.
  const me = (user?.username || "").toLowerCase();
  let all = allVideos().filter(v => v.thumb && (v.creator || "").toLowerCase() !== me);
  if (fypTagFilter) {
    all = all.filter(v => videoMatchesTag(v, fypTagFilter));
  }
  if (discoverQuery) {
    const q = discoverQuery.toLowerCase();
    all = all.filter(v =>
      (v.title || "").toLowerCase().includes(q) ||
      (v.creator || "").toLowerCase().includes(q) ||
      (v.desc || "").toLowerCase().includes(q)
    );
  }
  return all;
}

function renderFYP() {
  const feed = $("#fypFeed");
  if (!feed) return;
  syncFypTagBar();
  const videos = getFypVideos();
  renderDiscoverSidebar(); // refresh suggested + trending tiap kali feed re-render

  if (!videos.length) {
    const emptyMsg = discoverQuery
      ? { h: `Tidak ada hasil untuk "${escapeHtml(discoverQuery)}"`, p: "Coba kata kunci lain atau kosongkan kolom pencarian." }
      : fypTagFilter
      ? { h: `Tidak ada video dengan tag #${escapeHtml(fypTagFilter)}`, p: "Coba tag lain atau hapus filter di atas." }
      : { h: "Belum ada video di feed", p: "Upload video pertamamu atau follow kreator lain untuk mengisi feed!" };
    feed.innerHTML = `<div class="fyp-empty"><h3>${emptyMsg.h}</h3><p>${emptyMsg.p}</p></div>`;
    return;
  }

  feed.innerHTML = videos.map(v => fypCardHTML(v)).join("");
  bindFypCards(feed);
  setupFypObserver(feed);
}

// Sidebar Saran Kreator dihapus — fungsi ini sengaja jadi no-op supaya call
// site lama (renderFYP, dll.) tetap aman. Saran kreator masih bisa diakses
// dari halaman "Search User" untuk yang mau eksplor kreator lain.
function renderDiscoverSidebar() { /* no-op */ }

// Search input — filter feed real-time (debounced)
(function initDiscoverSearch() {
  const input = $("#discoverSearch");
  if (!input) return;
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      discoverQuery = input.value.trim();
      renderFYP();
    }, 200);
  });
})();

// Tag filter pill bar di atas feed
function syncFypTagBar() {
  let bar = $("#fypTagBar");
  if (!fypTagFilter) {
    if (bar) bar.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "fypTagBar";
    bar.className = "fyp-tag-bar";
    const topbar = document.querySelector(".fyp-topbar");
    if (topbar) topbar.after(bar);
  }
  bar.innerHTML = `
    <div class="fyp-tag-bar-inner">
      <span class="fyp-tag-bar-label">Filter tag:</span>
      <span class="fyp-tag-bar-tag">#${escapeHtml(fypTagFilter)}</span>
      <button class="fyp-tag-bar-clear" id="fypTagClear" title="Hapus filter">✕ Reset</button>
    </div>
  `;
  $("#fypTagClear")?.addEventListener("click", () => {
    fypTagFilter = null;
    renderFYP();
  });
}

function fypCardHTML(v) {
  const liked = state?.liked?.includes(v.id);
  const saved = state?.saved?.includes(v.id);
  const following = state?.followingCreators?.includes(v.creator);
  const init = (v.creator || "U").split(/[\s_]/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const commentCount = state?.comments?.[v.id]?.length || 0;
  const shareCount = getShareCount(v.id);
  // Real-time relative timestamp — pakai createdAt (atau fallback ke id yang juga Date.now())
  const ts = v.createdAt || (typeof v.id === "number" && v.id > 1e12 ? v.id : null);
  const timeText = ts ? relTime(ts) : (v.time || "");
  return `
    <article class="fyp-card" data-vid="${v.id}">
      <header class="fyp-card-header">
        <button type="button" class="fyp-creator-btn" data-fyp-creator="${escapeHtml(v.creator)}">
          <div class="avatar"><span>${init}</span></div>
          <div class="fyp-creator-meta">
            <strong>@${escapeHtml(v.creator)}</strong>
            <small>${escapeHtml(timeText)}</small>
          </div>
        </button>
        <button class="fyp-follow-btn ${following ? "following" : ""}" data-fyp-follow="${escapeHtml(v.creator)}">${following ? "✓ Following" : "+ Follow"}</button>
      </header>

      <p class="fyp-caption">${linkifyHashtags(v.title)}</p>

      <div class="fyp-video-wrap paused" data-vid="${v.id}">
        <img class="fyp-poster" src="${v.thumb}" alt="${escapeHtml(v.title)}"/>
        <div class="fyp-progress"><i></i></div>
        <button class="fyp-mute-btn" data-fyp-mute title="Mute / Unmute">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-icon-on><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>
        </button>
        <div class="fyp-play-overlay">▶</div>
        <div class="fyp-heart-pop"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6Z"/></svg></div>
      </div>

      <footer class="fyp-actions-row">
        <button class="fyp-action like ${liked ? "active" : ""}" data-fyp-like="${v.id}" title="Suka">
          <svg viewBox="0 0 24 24" fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6Z"/></svg>
          <span data-fyp-like-count="${v.id}">${fmtNum((v.likes || 0) + (liked ? 1 : 0))}</span>
        </button>
        <button class="fyp-action comment" data-fyp-comment="${v.id}" title="Komentar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          <span data-fyp-comment-count="${v.id}">${fmtNum(commentCount)}</span>
        </button>
        <button class="fyp-action share" data-fyp-share="${v.id}" title="Bagikan / Kirim">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-11 11M22 2l-7 20-4-9-9-4 20-7Z"/></svg>
          <span data-fyp-share-count="${v.id}">${fmtNum(shareCount)}</span>
        </button>
        <button class="fyp-action views" data-fyp-views="${v.id}" title="Views">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
          <span data-fyp-views-count="${v.id}">${fmtNum(v.viewsNum || 0)}</span>
        </button>
        <button class="fyp-action save ${saved ? "active" : ""}" data-fyp-save="${v.id}" title="Simpan">
          <svg viewBox="0 0 24 24" fill="${saved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z"/></svg>
        </button>
      </footer>
    </article>
  `;
}

function bindFypCards(scope) {
  // Klik header creator → buka user profile
  $$("[data-fyp-creator]", scope).forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const username = btn.dataset.fypCreator;
      if (username && typeof openUserProfile === "function") openUserProfile(username);
    });
  });
  // Tap video → single-tap play/pause, double-tap → like + heart pop
  $$(".fyp-video-wrap", scope).forEach(w => {
    let tapTimer = null;
    w.addEventListener("click", e => {
      if (e.target.closest("[data-fyp-mute]")) return;
      // Double-tap detection: 2 clicks within 280ms = like
      if (tapTimer) {
        clearTimeout(tapTimer);
        tapTimer = null;
        triggerFypDoubleTapLike(w, e);
        return;
      }
      tapTimer = setTimeout(() => {
        tapTimer = null;
        toggleFypPlay(w);
      }, 280);
    });
  });

  // Hashtag pill → filter feed by tag
  $$("[data-fyp-tag]", scope).forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      e.preventDefault();
      const tag = b.dataset.fypTag;
      fypTagFilter = (fypTagFilter === tag) ? null : tag;
      renderFYP();
      $("#fypFeed")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  // Mute toggle
  $$("[data-fyp-mute]", scope).forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      toggleFypMute();
    });
  });
  // Like
  $$("[data-fyp-like]", scope).forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const id = +b.dataset.fypLike;
      if (!state.liked) state.liked = [];
      const wasLiked = state.liked.includes(id);
      if (wasLiked) {
        state.liked = state.liked.filter(x => x !== id);
        b.classList.remove("active");
      } else {
        state.liked.push(id);
        b.classList.add("active");
        // Heart pop animation
        const icon = b.querySelector(".fyp-action-icon");
        if (icon) {
          icon.classList.remove("fyp-pop");
          void icon.offsetWidth;
          icon.classList.add("fyp-pop");
        }
      }
      saveState();
      const v = findVideo(id);
      if (v) {
        const likedNow = state.liked.includes(id);
        b.querySelector("small").textContent = fmtNum((v.likes || 0) + (likedNow ? 1 : 0));
        b.querySelector("svg").setAttribute("fill", likedNow ? "currentColor" : "none");
        // Notif ke creator saat like baru (bukan unlike, bukan video sendiri)
        if (!wasLiked && v.creator && v.creator !== user.username) {
          const init = (user.name || user.username).split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
          deliverNotification(v.creator, {
            type: "like", videoId: id, init,
            fromUsername: user.username,
            text: `<b>@${user.username}</b> menyukai videomu "<b>${escapeHtml(v.title || "")}</b>" ❤️`
          });
        }
      }
    });
  });
  // Comment → buka player modal di section comment
  $$("[data-fyp-comment]", scope).forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const id = +b.dataset.fypComment;
      pauseAllFypVideos();
      openPlayer(id);
      setTimeout(() => $("#commentField")?.focus(), 300);
    });
  });
  // Share / Kirim → buka share modal (gabungan: kirim ke user + share eksternal)
  $$("[data-fyp-share]", scope).forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const id = +b.dataset.fypShare;
      pauseAllFypVideos();
      openShareModal(id, { focusUsers: true });
    });
  });
  // Save
  $$("[data-fyp-save]", scope).forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const id = +b.dataset.fypSave;
      if (!state.saved) state.saved = [];
      if (state.saved.includes(id)) {
        state.saved = state.saved.filter(x => x !== id);
        b.classList.remove("active");
        b.querySelector("svg").setAttribute("fill", "none");
        toast("Dihapus dari simpanan");
      } else {
        state.saved.push(id);
        b.classList.add("active");
        b.querySelector("svg").setAttribute("fill", "currentColor");
        toast("🔖 Disimpan", "success");
      }
      saveState();
    });
  });
  // Follow
  $$("[data-fyp-follow]", scope).forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const creator = b.dataset.fypFollow;
      if (!state.followingCreators) state.followingCreators = [];
      const wasFollowing = state.followingCreators.includes(creator);
      if (wasFollowing) {
        state.followingCreators = state.followingCreators.filter(c => c !== creator);
        b.classList.remove("following");
        b.textContent = "+ Follow";
      } else {
        state.followingCreators.push(creator);
        b.classList.add("following");
        b.textContent = "✓ Following";
        toast(`✓ Following @${creator}`, "success");
        // Notif ke creator
        if (creator !== user.username) {
          const init = (user.name || user.username).split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
          deliverNotification(creator, {
            type: "follow", init,
            fromUsername: user.username,
            text: `<b>@${user.username}</b> mulai mengikutimu 👤`
          });
        }
      }
      saveState();
    });
  });
}

let fypMuted = true;

function toggleFypMute() {
  fypMuted = !fypMuted;
  $$(".fyp-video-wrap video").forEach(v => v.muted = fypMuted);
  toast(fypMuted ? "🔇 Mute" : "🔊 Unmute");
}

function toggleFypPlay(wrap) {
  let video = wrap.querySelector("video");
  if (!video) {
    // Lazy-create video element on first interaction
    video = createFypVideo(wrap);
  }
  if (video.paused) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
}

async function createFypVideo(wrap) {
  const id = +wrap.dataset.vid;
  const v = findVideo(id);
  if (!v) return null;
  const SAMPLE_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  const src = (await resolveVideoSource(v).catch(() => null)) || SAMPLE_URL;

  const video = document.createElement("video");
  video.src = src;
  video.loop = true;
  video.muted = fypMuted;
  video.playsInline = true;
  video.preload = "auto";
  // Insert before poster (so video is on top, poster fallback)
  wrap.insertBefore(video, wrap.firstChild);

  // Progress bar update
  const progressBar = wrap.querySelector(".fyp-progress > i");
  video.addEventListener("timeupdate", () => {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    if (progressBar) progressBar.style.width = pct + "%";
  });
  video.addEventListener("play", () => { wrap.classList.add("playing"); wrap.classList.remove("paused"); });
  video.addEventListener("pause", () => { wrap.classList.add("paused"); wrap.classList.remove("playing"); });
  return video;
}

function pauseAllFypVideos() {
  $$(".fyp-video-wrap video").forEach(v => v.pause());
}

// ============== DOUBLE-TAP TO LIKE ==============
// Klik dua kali pada video → like (toggle ON, tidak unlike) + animasi heart besar
// di posisi klik. Notifikasi ke creator dikirim seperti like normal.
function triggerFypDoubleTapLike(wrap, evt) {
  const card = wrap.closest(".fyp-card");
  if (!card) return;
  const id = +card.dataset.vid;
  if (!state.liked) state.liked = [];
  const wasLiked = state.liked.includes(id);
  if (!wasLiked) {
    state.liked.push(id);
    saveState();
    // Sync tombol like di sidebar
    const likeBtn = card.querySelector(`[data-fyp-like="${id}"]`);
    if (likeBtn) {
      likeBtn.classList.add("active");
      const v = findVideo(id);
      if (v) {
        likeBtn.querySelector("small").textContent = fmtNum((v.likes || 0) + 1);
        likeBtn.querySelector("svg")?.setAttribute("fill", "currentColor");
      }
      // Kirim notif ke creator
      const v2 = findVideo(id);
      if (v2 && v2.creator && v2.creator !== user.username) {
        const init = (user.name || user.username).split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
        deliverNotification(v2.creator, {
          type: "like", videoId: id, init,
          fromUsername: user.username,
          text: `<b>@${user.username}</b> menyukai videomu "<b>${escapeHtml(v2.title || "")}</b>" ❤️`
        });
      }
    }
  }

  // Animasi heart pop di posisi klik
  const pop = wrap.querySelector(".fyp-heart-pop");
  if (!pop) return;
  const rect = wrap.getBoundingClientRect();
  const x = (evt.clientX || rect.left + rect.width / 2) - rect.left;
  const y = (evt.clientY || rect.top + rect.height / 2) - rect.top;
  pop.style.left = x + "px";
  pop.style.top = y + "px";
  pop.classList.remove("show");
  void pop.offsetWidth;
  pop.classList.add("show");
}

// ============== KEYBOARD NAVIGATION ==============
// Saat di view Discover, ArrowDown/ArrowUp pindah ke video berikutnya/sebelumnya.
// J/K alias jurnalistik (TikTok desktop pakai pola ini juga). M = mute toggle.
document.addEventListener("keydown", e => {
  if (state?.currentView !== "discover") return;
  // Skip kalau user lagi mengetik di input
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
  const feed = $("#fypFeed");
  if (!feed) return;

  if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
    e.preventDefault();
    scrollFypBy(feed, +1);
  } else if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
    e.preventDefault();
    scrollFypBy(feed, -1);
  } else if (e.key === "m" || e.key === "M") {
    e.preventDefault();
    toggleFypMute();
  } else if (e.key === " " || e.key === "Spacebar") {
    // Spasi → toggle play/pause active card
    e.preventDefault();
    const active = getActiveFypCard(feed);
    if (active) toggleFypPlay(active.querySelector(".fyp-video-wrap"));
  } else if (e.key === "l" || e.key === "L") {
    // L → toggle like
    const active = getActiveFypCard(feed);
    const btn = active?.querySelector("[data-fyp-like]");
    if (btn) btn.click();
  }
});

function getActiveFypCard(feed) {
  const cards = [...feed.querySelectorAll(".fyp-card")];
  const feedRect = feed.getBoundingClientRect();
  const center = feedRect.top + feedRect.height / 2;
  return cards.find(c => {
    const r = c.getBoundingClientRect();
    return r.top <= center && r.bottom >= center;
  }) || cards[0];
}

function scrollFypBy(feed, dir) {
  const cards = [...feed.querySelectorAll(".fyp-card")];
  if (!cards.length) return;
  const active = getActiveFypCard(feed);
  const idx = cards.indexOf(active);
  const target = cards[Math.max(0, Math.min(cards.length - 1, idx + dir))];
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ============== SHARE COUNTERS (global, real-time) ==============
const SHARE_COUNT_KEY = "playly-shares";

function getShareCountsMap() {
  try { return JSON.parse(localStorage.getItem(SHARE_COUNT_KEY) || "{}"); }
  catch { return {}; }
}
function getShareCount(videoId) {
  const m = getShareCountsMap();
  return m[videoId] || 0;
}
function incrementShareCount(videoId) {
  const m = getShareCountsMap();
  m[videoId] = (m[videoId] || 0) + 1;
  try { localStorage.setItem(SHARE_COUNT_KEY, JSON.stringify(m)); } catch {}
  // Update semua tampilan FYP yang sedang menunjukkan video ini
  document.querySelectorAll(`[data-fyp-share-count="${videoId}"]`).forEach(el => {
    el.textContent = fmtNum(m[videoId]);
  });
  return m[videoId];
}

// Cross-tab sync share counts
window.addEventListener("storage", e => {
  if (e.key !== SHARE_COUNT_KEY) return;
  const m = getShareCountsMap();
  document.querySelectorAll("[data-fyp-share-count]").forEach(el => {
    const id = +el.dataset.fypShareCount;
    el.textContent = fmtNum(m[id] || 0);
  });
});

// ============== FYP SHARE MODAL ==============
let __shareCurrentVideoId = null;

function openShareModal(videoId, opts = {}) {
  const v = findVideo(videoId);
  if (!v) return;
  __shareCurrentVideoId = videoId;
  $("#shareSubtitle").textContent = `"${v.title}" • @${v.creator}`;
  $("#shareUserSearch").value = "";
  renderShareUsersList("");
  // Reset QR preview tiap kali modal dibuka
  const qrBox = document.getElementById("shareQrBox");
  if (qrBox) qrBox.hidden = true;
  $("#fypShareModal").classList.add("show");
  if (opts.focusUsers) setTimeout(() => $("#shareUserSearch")?.focus(), 80);
}

function closeShareModal() {
  $("#fypShareModal")?.classList.remove("show");
  __shareCurrentVideoId = null;
  const qrBox = document.getElementById("shareQrBox");
  if (qrBox) qrBox.hidden = true;
}

function getShareableUsers(query = "") {
  const q = query.trim().toLowerCase();
  const users = [];
  const seen = new Set();
  // Prioritas: yang sedang chat aktif (recent threads)
  const recents = (state?.messages || [])
    .filter(m => m.name && m.name !== user.username)
    .map(m => ({ username: m.name, name: m.name, init: m.init, source: "recent" }));
  for (const r of recents) { if (!seen.has(r.username)) { users.push(r); seen.add(r.username); } }
  // Followed creators
  for (const c of state?.followingCreators || []) {
    if (seen.has(c)) continue;
    const acc = findAccountByUsername(c);
    users.push({ username: c, name: acc?.name || c, init: (acc?.name || c).slice(0, 2).toUpperCase(), source: "following" });
    seen.add(c);
  }
  // Semua user terdaftar
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("playly-account-")) continue;
    try {
      const a = JSON.parse(localStorage.getItem(k));
      if (!a?.username || a.username === user.username) continue;
      if (seen.has(a.username)) continue;
      users.push({ username: a.username, name: a.name || a.username, init: (a.name || a.username).slice(0, 2).toUpperCase(), source: "all" });
      seen.add(a.username);
    } catch {}
  }
  if (q) {
    return users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      String(u.name).toLowerCase().includes(q)
    );
  }
  return users;
}

function renderShareUsersList(query) {
  const list = $("#shareUsersList");
  if (!list) return;
  const users = getShareableUsers(query);
  if (!users.length) {
    list.innerHTML = `<div class="share-users-empty">${query ? "Tidak ada user yang cocok" : "Belum ada user lain di platform. Ajak temanmu daftar!"}</div>`;
    return;
  }
  list.innerHTML = users.map(u => `
    <button class="share-user" data-share-to="${escapeHtml(u.username)}" title="Kirim ke @${escapeHtml(u.username)}">
      <div class="share-user-avatar"><span>${escapeHtml(u.init)}</span></div>
      <div class="share-user-info">
        <strong>@${escapeHtml(u.username)}</strong>
        <small>${u.source === "recent" ? "💬 Chat aktif" : u.source === "following" ? "✓ Following" : escapeHtml(u.name)}</small>
      </div>
      <span class="share-user-send">Kirim</span>
    </button>
  `).join("");
  list.querySelectorAll("[data-share-to]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.shareTo;
      sendVideoToUser(target, __shareCurrentVideoId);
      btn.classList.add("sent");
      btn.querySelector(".share-user-send").textContent = "✓ Terkirim";
      btn.disabled = true;
    });
  });
}

// Kirim video ke user lain via DM (cross-user persistent storage)
function sendVideoToUser(recipientUsername, videoId, note = "") {
  if (!recipientUsername || !videoId) return;
  const v = findVideo(videoId);
  if (!v) return toast("❌ Video tidak ditemukan", "error");
  if (recipientUsername === user.username) return toast("⚠ Tidak bisa kirim ke diri sendiri", "warning");

  const senderUsername = user.username;
  const senderInit = (user.name || senderUsername).slice(0, 2).toUpperCase();
  const previewText = `📹 ${v.title || "Video"}`;
  const nowTs = Date.now();
  const messageBase = {
    time: "baru saja",
    ts: nowTs,
    videoId,
    videoTitle: v.title || "",
    videoThumb: v.thumb || "",
    videoCreator: v.creator || "",
    videoDuration: v.duration || "",
    text: note || ""
  };

  // 1. Tulis ke state recipient
  const recipKey = `playly-state-${recipientUsername}`;
  let rs;
  try { rs = JSON.parse(localStorage.getItem(recipKey)); } catch { rs = null; }
  if (!rs) rs = { messages: [] };
  if (!Array.isArray(rs.messages)) rs.messages = [];
  let recipThread = rs.messages.find(m => m.name === senderUsername);
  if (!recipThread) {
    recipThread = { name: senderUsername, init: senderInit, preview: "", time: "baru", ts: nowTs, unread: true, online: true, history: [] };
    rs.messages.unshift(recipThread);
  } else {
    rs.messages = [recipThread, ...rs.messages.filter(m => m !== recipThread)];
  }
  recipThread.history.push({ ...messageBase, from: "them" });
  recipThread.preview = previewText;
  recipThread.time = "baru";
  recipThread.ts = nowTs;
  recipThread.unread = true;
  try { localStorage.setItem(recipKey, JSON.stringify(rs)); } catch (e) {
    return toast("⚠ Gagal mengirim — storage penuh", "error");
  }

  // 2. Notifikasi terpisah ke lonceng
  deliverNotification(recipientUsername, {
    type: "video-share",
    init: senderInit,
    videoId,
    fromUsername: senderUsername,
    text: `<b>@${senderUsername}</b> mengirim video "<b>${escapeHtml(v.title || "")}</b>" untukmu 📹`
  });

  // 3. Tulis ke state sender (ke inbox sendiri agar bisa melihat thread)
  if (!Array.isArray(state.messages)) state.messages = [];
  let senderThread = state.messages.find(m => m.name === recipientUsername);
  if (!senderThread) {
    const recipAcc = findAccountByUsername(recipientUsername);
    senderThread = {
      name: recipientUsername,
      init: (recipAcc?.name || recipientUsername).slice(0, 2).toUpperCase(),
      preview: "", time: "baru", ts: nowTs, unread: false, online: false, history: []
    };
    state.messages.unshift(senderThread);
  } else {
    state.messages = [senderThread, ...state.messages.filter(m => m !== senderThread)];
  }
  senderThread.history.push({ ...messageBase, from: "me" });
  senderThread.preview = `Kamu: ${previewText}`;
  senderThread.time = "baru";
  senderThread.ts = nowTs;
  saveState();
  if (typeof renderMsgList === "function") renderMsgList();
  if (state.chatOpen != null && state.messages[state.chatOpen]?.name === recipientUsername && typeof renderChat === "function") {
    renderChat();
  }

  // Increment share counter (real-time, cross-tab)
  incrementShareCount(videoId);

  toast(`✓ Video terkirim ke <b>@${escapeHtml(recipientUsername)}</b>`, "success");
}

// ============== FYP SHARE MODAL — bind events ==============

// Ambil File video buat di-attach via Web Share API atau download langsung.
// Sumber prioritas: IndexedDB (blob lokal) → cloud URL → null.
async function getShareableVideoFile(videoId, videoMeta) {
  try {
    const blob = await getVideoBlob(videoId);
    if (blob) {
      const ext = (blob.type || "video/mp4").split("/")[1]?.split(";")[0] || "mp4";
      const safeTitle = String(videoMeta?.title || "playly-video").replace(/[^\w\s-]/g, "").trim() || "playly-video";
      return new File([blob], `${safeTitle}.${ext}`, { type: blob.type || "video/mp4" });
    }
  } catch {}
  // Fallback: fetch dari URL cloud kalau ada
  const url = videoMeta?.videoUrl;
  if (url && /^https?:/.test(url)) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const ext = (blob.type || "video/mp4").split("/")[1]?.split(";")[0] || "mp4";
      const safeTitle = String(videoMeta?.title || "playly-video").replace(/[^\w\s-]/g, "").trim() || "playly-video";
      return new File([blob], `${safeTitle}.${ext}`, { type: blob.type || "video/mp4" });
    } catch {}
  }
  return null;
}

// Modal download dengan 2 opsi: simpan ke file (Downloads OS) atau simpan di
// aplikasi (IndexedDB lokal — bisa diputar offline tanpa internet).
function openDownloadOptionsModal(v) {
  if (!v) return;
  const modal = document.createElement("div");
  modal.className = "modal show";
  modal.style.cssText = "z-index:9999";
  modal.innerHTML = `
    <div class="modal-backdrop" data-dlmodal-close></div>
    <div class="modal-panel" style="max-width:420px;padding:22px">
      <button class="modal-close" data-dlmodal-close>✕</button>
      <h3 style="margin:0 0 6px;display:flex;align-items:center;gap:8px">📥 Download Video</h3>
      <p class="muted" style="margin:0 0 16px;font-size:13px">Pilih cara menyimpan <b>${escapeHtml(v.title || "video")}</b>.</p>
      <button class="dl-opt" data-dl-opt="file" type="button" style="display:flex;align-items:flex-start;gap:14px;width:100%;padding:14px;background:transparent;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;cursor:pointer;text-align:left;color:var(--text)">
        <span style="font-size:24px;flex-shrink:0">💾</span>
        <span style="flex:1;min-width:0">
          <strong style="display:block;font-size:14px;margin-bottom:2px">Simpan ke File</strong>
          <small style="color:var(--muted);font-size:12px;line-height:1.4">Download video ke folder Downloads di perangkat — bisa dishare/upload ke aplikasi lain.</small>
        </span>
      </button>
      <button class="dl-opt" data-dl-opt="app" type="button" style="display:flex;align-items:flex-start;gap:14px;width:100%;padding:14px;background:transparent;border:1px solid var(--border);border-radius:10px;cursor:pointer;text-align:left;color:var(--text)">
        <span style="font-size:24px;flex-shrink:0">📱</span>
        <span style="flex:1;min-width:0">
          <strong style="display:block;font-size:14px;margin-bottom:2px">Simpan di Aplikasi</strong>
          <small style="color:var(--muted);font-size:12px;line-height:1.4">Simpan ke library Playly di browser ini — bisa diputar offline tanpa internet.</small>
        </span>
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", async e => {
    if (e.target.closest("[data-dlmodal-close]")) { modal.remove(); return; }
    const opt = e.target.closest("[data-dl-opt]");
    if (!opt) return;
    const action = opt.dataset.dlOpt;
    opt.disabled = true;
    opt.style.opacity = "0.5";
    try {
      const file = await getShareableVideoFile(v.id, v);
      if (!file) {
        toast("⚠️ Video tidak tersedia di device ini — coba sambil online dulu", "warning");
        modal.remove();
        return;
      }
      if (action === "file") {
        const a = document.createElement("a");
        const objUrl = URL.createObjectURL(file);
        a.href = objUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 60000);
        toast(`💾 <b>${escapeHtml(v.title)}</b> tersimpan ke folder Downloads`, "success");
      } else if (action === "app") {
        await saveVideoBlob(v.id, file);
        toast(`📱 <b>${escapeHtml(v.title)}</b> tersimpan di aplikasi — bisa diputar offline`, "success");
        if (typeof refreshStorageUsage === "function") refreshStorageUsage();
      }
      if (typeof incrementShareCount === "function") incrementShareCount(v.id);
    } catch (err) {
      console.warn("[download]", err);
      toast("❌ Gagal download video", "error");
    }
    modal.remove();
  });
}

$("#shareUserSearch")?.addEventListener("input", e => renderShareUsersList(e.target.value));

$("#fypShareModal")?.querySelectorAll("[data-share-act]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const act = btn.dataset.shareAct;
    const id = __shareCurrentVideoId;
    const v = id ? findVideo(id) : null;
    if (!v) return;
    // Public share URL — langsung bisa diputar tanpa login.
    // Format `/id/{videoId}` (rewrite Vercel → watch.html?v=).
    const shareUrl = `${location.origin}/id/${id}`;
    const embedUrl = `${shareUrl}/embed`;
    const shareText = `Tonton "${v.title}" by @${v.creator} di Playly`;
    const enc = encodeURIComponent;
    let openExternal = null; // URL eksternal yang akan dibuka di tab baru
    let copyOnly = false;    // platform yang tidak punya web-share URL → copy + buka home
    let externalHomepage = null; // URL home untuk dibuka setelah copy

    if (act === "copy") {
      try {
        await navigator.clipboard.writeText(shareUrl);
        incrementShareCount(id);
        toast("🔗 Link disalin", "success");
      } catch { toast("❌ Gagal salin link", "error"); }
      closeShareModal();
      return;
    }
    if (act === "native") {
      try {
        if (!navigator.share) {
          toast("⚠ Browser tidak mendukung Web Share — pakai opsi lain", "warning");
          closeShareModal();
          return;
        }
        // Coba sertakan file video kalau OS/browser mendukung canShare({ files })
        const file = await getShareableVideoFile(id, v);
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: v.title, text: shareText, url: shareUrl, files: [file] });
        } else {
          await navigator.share({ title: v.title, text: shareText, url: shareUrl });
        }
        incrementShareCount(id);
      } catch {}
      closeShareModal();
      return;
    }
    if (act === "download") {
      try {
        const file = await getShareableVideoFile(id, v);
        if (!file) {
          toast("⚠ Video tidak tersedia di device ini — share link saja", "warning");
          return;
        }
        const a = document.createElement("a");
        const objUrl = URL.createObjectURL(file);
        a.href = objUrl;
        a.download = `${(v.title || "video").replace(/[^\w\s-]/g, "").trim() || "playly-video"}.${(file.type || "video/mp4").split("/")[1]?.split(";")[0] || "mp4"}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 60000);
        toast("📥 Video ter-download — bisa di-attach ke WA/Telegram/IG/dll.", "success");
        incrementShareCount(id);
      } catch (e) {
        console.warn(e);
        toast("❌ Gagal download video", "error");
      }
      return;
    }
    if (act === "report") {
      closeShareModal();
      openConfirm({
        icon: "🚩", iconClass: "warn",
        title: "Laporkan Video?",
        desc: `Video "<b>${escapeHtml(v.title || "")}</b>" akan dilaporkan ke admin untuk ditinjau.`,
        btnText: "Laporkan", btnClass: "danger",
        onConfirm: () => {
          try {
            const KEY = "playly-admin-mod";
            const list = JSON.parse(localStorage.getItem(KEY) || "[]");
            list.unshift({
              id: Date.now(), videoId: id, title: v.title, creator: v.creator,
              reportedBy: user.username, reason: "Dilaporkan dari FYP", at: new Date().toISOString()
            });
            localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
          } catch {}
          toast("🚩 Laporan terkirim ke admin", "success");
        }
      });
      return;
    }

    // Platform dengan web-share URL — langsung ke halaman compose pesan ===
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    switch (act) {
      case "whatsapp":
        // wa.me canonical → buka picker chat lalu prefilled text. Mobile pakai
        // app langsung, desktop buka WhatsApp Web compose.
        openExternal = `https://api.whatsapp.com/send?text=${enc(shareText + " " + shareUrl)}`;
        break;
      case "telegram":
        // t.me/share langsung buka dialog "Forward to" di Telegram
        openExternal = `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(shareText)}`;
        break;
      case "twitter":
        // X intent compose tweet
        openExternal = `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(shareUrl)}`;
        break;
      case "facebook":
        // FB sharer popup
        openExternal = `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}&quote=${enc(shareText)}`;
        break;
      case "messenger":
        // Mobile: deep link `fb-messenger://share` langsung buka compose di app.
        // Desktop: copy link + buka inbox Messenger (Messenger web tidak support
        // share URL untuk arbitrary content).
        if (isMobile) {
          openExternal = `fb-messenger://share?link=${enc(shareUrl)}`;
        } else {
          copyOnly = true;
          externalHomepage = "https://www.messenger.com/";
        }
        break;
      case "instagram":
        // IG tidak punya web-share URL untuk DM. Mobile coba deep link `instagram://`,
        // desktop langsung ke halaman compose DM baru.
        copyOnly = true;
        externalHomepage = isMobile
          ? "instagram://direct/new"
          : "https://www.instagram.com/direct/new/";
        break;
      case "tiktok":
        // TikTok web messages page (langsung ke inbox/compose)
        copyOnly = true;
        externalHomepage = isMobile
          ? "snssdk1233://user/profile/"
          : "https://www.tiktok.com/messages?lang=id-ID";
        break;
    }

    if (copyOnly) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        const targetLabel = act === "instagram"
          ? "Instagram DM (paste link di chat)"
          : act === "tiktok"
            ? "TikTok DM (paste link di chat)"
            : act === "messenger"
              ? "Messenger (paste link di chat)"
              : "halaman tujuan";
        toast(`🔗 Link disalin — buka ${targetLabel}`, "info");
      } catch {
        toast("❌ Gagal salin link otomatis — salin manual", "error");
      }
      if (externalHomepage) window.open(externalHomepage, "_blank", "noopener");
      incrementShareCount(id);
      closeShareModal();
      return;
    }
    if (openExternal) {
      window.open(openExternal, "_blank", "noopener");
      incrementShareCount(id);
      closeShareModal();
    }
  });
});

function setupFypObserver(feed) {
  if (fypObserver) fypObserver.disconnect();
  fypObserver = new IntersectionObserver(entries => {
    entries.forEach(async entry => {
      const wrap = entry.target.querySelector(".fyp-video-wrap");
      if (!wrap) return;
      if (entry.intersectionRatio > 0.6) {
        // Active card — autoplay
        let video = wrap.querySelector("video");
        if (!video) video = await createFypVideo(wrap);
        if (video) {
          video.muted = fypMuted;
          video.play().catch(() => {});
        }
      } else {
        // Out of view — pause & reset
        const video = wrap.querySelector("video");
        if (video && !video.paused) video.pause();
      }
    });
  }, { root: feed, threshold: [0, 0.6, 1] });

  $$(".fyp-card", feed).forEach(c => fypObserver.observe(c));
}

// FYP tab switching
document.addEventListener("click", e => {
  const tab = e.target.closest("[data-fyp-tab]");
  if (!tab) return;
  fypTab = tab.dataset.fypTab;
  $$("[data-fyp-tab]").forEach(t => t.classList.toggle("active", t === tab));
  renderFYP();
});

// ----------------------- PEOPLE VIEW (find other users) -----------------------
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function renderPeople() {
  const grid = $("#peopleGrid");
  if (!grid) return;
  const q = ($("#peopleSearch")?.value || "").trim().toLowerCase();
  const accounts = getAllAccounts()
    .filter(a => a.email !== user?.email)
    .filter(a => !q || (a.name || "").toLowerCase().includes(q) || (a.username || "").toLowerCase().includes(q))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  if (!accounts.length) {
    grid.innerHTML = `<div class="people-empty">${q ? `Tidak ada user yang cocok dengan "<b>${escapeHtml(q)}</b>".` : "Belum ada user lain — ajak teman daftar di Playly!"}</div>`;
    return;
  }

  const myUsername = user?.username;
  grid.innerHTML = accounts.map(a => {
    const init = (a.name || a.username || "U").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
    const isAdmin = a.role === "admin";
    const handle = isAdmin ? "Administrator" : `@${escapeHtml(a.username)}`;
    const isFollowing = state.followingCreators.includes(a.username);
    const theyFollowMe = !isAdmin && !!myUsername && getUserFollowing(a.username).includes(myUsername);
    const followerCount = getUserFollowers(a.username).length;
    return `
      <div class="people-card" data-people-open="${escapeHtml(a.username)}">
        <div class="avatar"><span>${init}</span></div>
        <div class="people-name">${escapeHtml(a.name)} ${isAdmin ? '<span class="role-badge admin">Admin</span>' : ''}${theyFollowMe ? '<span class="follow-back-tag">Mengikutimu</span>' : ''}</div>
        <div class="people-handle">${handle}${!isAdmin ? ` • <span class="people-followers">${followerCount} follower</span>` : ''}</div>
        ${a.bio ? `<p class="people-bio">${escapeHtml(a.bio)}</p>` : ""}
        <div class="people-actions">
          ${isAdmin ? '' : `<button class="btn ${isFollowing ? 'ghost' : 'primary'}" data-people-follow="${escapeHtml(a.username)}">${isFollowing ? '✓ Diikuti' : '+ Follow'}</button>`}
          <button class="btn ${isAdmin ? 'primary' : 'ghost'}" data-people-msg="${escapeHtml(a.username)}">💬 Pesan</button>
        </div>
      </div>
    `;
  }).join("");

  $$("[data-people-msg]", grid).forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      startChatWithUser(b.dataset.peopleMsg);
    });
  });
  $$("[data-people-follow]", grid).forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      toggleFollow(b.dataset.peopleFollow);
    });
  });
  $$("[data-people-open]", grid).forEach(c => {
    c.addEventListener("click", e => {
      if (e.target.closest("button")) return;
      openUserProfile(c.dataset.peopleOpen);
    });
  });
}

function startChatWithUser(username) {
  const acc = getAllAccounts().find(a => a.username === username);
  if (!acc) return toast("❌ User tidak ditemukan", "error");
  const init = (acc.name || acc.username).split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();

  const existing = state.messages.findIndex(m => m.name === username);
  if (existing >= 0) {
    switchView("messages");
    setTimeout(() => openChat(existing), 80);
    return;
  }
  state.messages.unshift({
    name: username, init, preview: "Mulai percakapan...", time: "baru", ts: Date.now(), unread: false, online: false,
    history: []
  });
  saveState();
  renderMsgList();
  switchView("messages");
  setTimeout(() => openChat(0), 80);
}

$("#peopleSearch")?.addEventListener("input", renderPeople);

// ----------------------- MESSAGES VIEW -----------------------
function renderMsgList() {
  const list = $("#msgList");
  if (!list) return;

  if (!state.messages.length) {
    list.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--muted)">
      <div style="font-size:42px; margin-bottom:10px; opacity:.5">💬</div>
      <h4 style="font-family:'Plus Jakarta Sans'; margin-bottom:6px; font-weight:700; color:var(--text)">Belum ada pesan</h4>
      <p style="font-size:12.5px; line-height:1.5">Mulai chat dengan kreator yang kamu ikuti.</p>
    </div>`;
    return;
  }

  let filtered = state.messages;
  if (state.msgFilter === "unread") filtered = filtered.filter(m => m.unread);
  else if (state.msgFilter === "groups") filtered = [];
  const q = ($("#msgSearch")?.value || "").toLowerCase();
  if (q) filtered = filtered.filter(m => m.name.toLowerCase().includes(q) || m.preview.toLowerCase().includes(q));

  if (!filtered.length) {
    list.innerHTML = `<div style="text-align:center; padding:32px 16px; color:var(--muted); font-size:12.5px">${state.msgFilter === "groups" ? "Belum ada grup chat." : "Tidak ditemukan."}</div>`;
    return;
  }

  list.innerHTML = filtered.map(m => {
    const idx = state.messages.indexOf(m);
    const adminBadge = m.isAdmin ? `<span class="msg-admin-badge">ADMIN</span>` : "";
    const timeLabel = chatRelTime(m.ts);
    return `
      <div class="msg-item ${m.unread ? 'unread' : ''} ${m.isAdmin ? 'msg-from-admin' : ''}" data-msg="${idx}">
        <div class="avatar"><span>${m.init}</span>${m.online ? '<i class="status"></i>' : ''}</div>
        <div class="info">
          <div class="top"><strong>@${m.name}</strong>${adminBadge}<span class="time">${timeLabel}</span></div>
          <div class="preview">${m.preview}</div>
        </div>
      </div>
    `;
  }).join("");
  $$("[data-msg]", list).forEach(b => b.addEventListener("click", () => openChat(+b.dataset.msg)));
  renderUserStats();
}

$$(".msg-tabs button").forEach(b => {
  b.addEventListener("click", () => {
    $$(".msg-tabs button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    state.msgFilter = b.dataset.msgFilter;
    renderMsgList();
  });
});
$("#msgSearch")?.addEventListener("input", () => renderMsgList());

function openChat(i) {
  const m = state.messages[i];
  state.chatOpen = i;
  m.unread = false;
  saveState();

  $("#mlChat").innerHTML = `
    <div class="chat-head ${m.isAdmin ? 'chat-head-admin' : ''}">
      <button class="icon-btn mobile-only" id="backToList" style="display:none">←</button>
      <div class="avatar"><span>${m.init}</span><i class="status"></i></div>
      <div style="flex:1; min-width:0"><strong>@${m.name}${m.isAdmin ? ' <span class="msg-admin-badge">ADMIN</span>' : ''}</strong><small>${m.isAdmin ? 'Tim Admin Playly' : (m.online ? 'Online' : 'Offline')}</small></div>
    </div>
    <div class="chat-body" id="chatBody"></div>
    <div class="chat-input">
      <input type="text" id="chatField" placeholder="Tulis pesan..."/>
      <button class="btn primary small" id="chatSend">Kirim</button>
    </div>
  `;
  $(".messages-layout").classList.add("show-chat");

  renderChat();
  $("#chatSend").addEventListener("click", sendChat);
  $("#chatField").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });
  $("#backToList").addEventListener("click", () => $(".messages-layout").classList.remove("show-chat"));

  renderMsgList();
}

// ===== Per-message context menu =====
// Muncul saat user klik salah satu bubble di chat. Pilihan: salin teks,
// hapus pesan untuk saya, hapus pesan untuk semuanya (cuma bubble milik sendiri).
function closeMessageContextMenu() {
  document.getElementById("__msgCtxMenu")?.remove();
  document.removeEventListener("click", __msgCtxOnDocClick, true);
  document.removeEventListener("keydown", __msgCtxOnEsc, true);
}
function __msgCtxOnDocClick(e) {
  if (e.target.closest("#__msgCtxMenu")) return;
  closeMessageContextMenu();
}
function __msgCtxOnEsc(e) {
  if (e.key === "Escape") closeMessageContextMenu();
}

function showMessageContextMenu(bubbleEl, threadIdx, msgIdx) {
  closeMessageContextMenu();
  const m = state.messages[threadIdx];
  const h = m?.history?.[msgIdx];
  if (!h) return;
  const isOwn = h.from === "me";

  const menu = document.createElement("div");
  menu.id = "__msgCtxMenu";
  menu.className = "msg-ctx-menu";

  const items = [];
  if (h.text) {
    items.push(`<button type="button" data-act="copy">📋 Salin teks</button>`);
  }
  items.push(`<button type="button" data-act="del-me">🗑️ Hapus pesan untuk saya</button>`);
  if (isOwn) {
    items.push(`<button type="button" class="danger" data-act="del-all">💥 Hapus pesan untuk semuanya</button>`);
  }
  menu.innerHTML = items.join("");
  document.body.appendChild(menu);

  // Position: di bawah/atas bubble, sejajarkan ke sisi yang lebih masuk akal
  const r = bubbleEl.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = r.bottom + 6;
  if (top + mh > vh - 8) top = Math.max(8, r.top - mh - 6);
  let left = isOwn ? (r.right - mw) : r.left;
  if (left + mw > vw - 8) left = vw - mw - 8;
  if (left < 8) left = 8;
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;

  // Wire actions
  menu.querySelector("[data-act='copy']")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(h.text || "");
      toast("📋 Teks pesan disalin", "success");
    } catch { toast("❌ Gagal salin", "error"); }
    closeMessageContextMenu();
  });
  menu.querySelector("[data-act='del-me']")?.addEventListener("click", () => {
    closeMessageContextMenu();
    confirmDeleteMessageForMe(threadIdx, msgIdx);
  });
  menu.querySelector("[data-act='del-all']")?.addEventListener("click", () => {
    closeMessageContextMenu();
    confirmDeleteMessageForEveryone(threadIdx, msgIdx);
  });

  // Tutup saat klik di luar / tekan Esc
  setTimeout(() => {
    document.addEventListener("click", __msgCtxOnDocClick, true);
    document.addEventListener("keydown", __msgCtxOnEsc, true);
  }, 0);
}

function confirmDeleteMessageForMe(threadIdx, msgIdx) {
  const m = state.messages[threadIdx];
  const h = m?.history?.[msgIdx];
  if (!h) return;
  openConfirm({
    icon: "🗑️", iconClass: "warn",
    title: "Hapus pesan untuk saya?",
    desc: `Pesan ini akan dihapus dari sisi kamu saja. Lawan bicara masih bisa lihat.`,
    btnText: "Hapus", btnClass: "danger",
    onConfirm: () => deleteMessageForMe(threadIdx, msgIdx)
  });
}

function confirmDeleteMessageForEveryone(threadIdx, msgIdx) {
  const m = state.messages[threadIdx];
  const h = m?.history?.[msgIdx];
  if (!h) return;
  openConfirm({
    icon: "💥", iconClass: "danger",
    title: "Hapus pesan untuk semuanya?",
    desc: `Pesan ini akan dihapus dari sisi kamu dan dari sisi <b>@${escapeHtml(m.name)}</b>. Tidak bisa dibatalkan.`,
    btnText: "Hapus untuk semuanya", btnClass: "danger",
    onConfirm: () => deleteMessageForEveryone(threadIdx, msgIdx)
  });
}

function deleteMessageForMe(threadIdx, msgIdx) {
  const m = state.messages[threadIdx];
  if (!m || !Array.isArray(m.history) || !m.history[msgIdx]) return;
  m.history.splice(msgIdx, 1);
  const last = m.history[m.history.length - 1];
  m.preview = last
    ? (last.from === "me" ? "Kamu: " : "") + (last.text || "[Video]")
    : "";
  m.time = last?.time || m.time;
  saveState();
  renderChat();
  renderMsgList();
  toast("🗑️ Pesan dihapus", "success");
}

function deleteMessageForEveryone(threadIdx, msgIdx) {
  const m = state.messages[threadIdx];
  if (!m || !Array.isArray(m.history) || !m.history[msgIdx]) return;
  const target = m.history[msgIdx];

  // 1) Hapus di sisi sendiri
  m.history.splice(msgIdx, 1);
  const last = m.history[m.history.length - 1];
  m.preview = last
    ? (last.from === "me" ? "Kamu: " : "") + (last.text || "[Video]")
    : "";
  m.time = last?.time || m.time;
  saveState();
  renderChat();
  renderMsgList();

  // 2) Hapus di sisi lawan bicara via cloud-sync (write playly-state-{partner})
  const partner = m.name;
  const myUsername = user?.username;
  if (partner && myUsername && partner !== myUsername) {
    const partnerKey = `playly-state-${partner}`;
    let ps;
    try { ps = JSON.parse(localStorage.getItem(partnerKey)); } catch {}
    if (ps && Array.isArray(ps.messages)) {
      const partnerThread = ps.messages.find(t => t.name === myUsername);
      if (partnerThread && Array.isArray(partnerThread.history)) {
        // Match by ts (paling reliable) atau text fallback
        const idx = partnerThread.history.findIndex(h => {
          if (target.ts && h.ts) return h.ts === target.ts;
          return h.from === "them" && h.text === target.text;
        });
        if (idx >= 0) {
          partnerThread.history.splice(idx, 1);
          const plast = partnerThread.history[partnerThread.history.length - 1];
          partnerThread.preview = plast ? (plast.text || "[Video]") : "";
          try { localStorage.setItem(partnerKey, JSON.stringify(ps)); } catch (e) {
            console.warn("[chat] gagal hapus pesan di sisi lawan:", e);
          }
        }
      }
    }
  }
  toast("💥 Pesan dihapus untuk semua", "success");
}

// ===== Hapus chat ==========================================================
// "Untuk saya": cuma hapus thread dari state user yang sedang login.
// "Untuk semuanya": hapus dari state user + state lawan bicara (cross-device
// sync otomatis via cloud-sync hijack pada localStorage.setItem).
function confirmDeleteChatForMe(threadIdx) {
  if (threadIdx == null) return;
  const m = state.messages[threadIdx];
  if (!m) return;
  openConfirm({
    icon: "🗑️",
    iconClass: "warn",
    title: "Hapus chat untuk saya?",
    desc: `Pesan di percakapan dengan <b>@${escapeHtml(m.name)}</b> akan dihapus dari sisi kamu saja. Lawan bicara masih bisa lihat semua pesan di sisi mereka.`,
    btnText: "Hapus",
    btnClass: "danger",
    onConfirm: () => deleteChatForMe(threadIdx)
  });
}

function deleteChatForMe(threadIdx) {
  const m = state.messages[threadIdx];
  if (!m) return;
  const partner = m.name;
  state.messages.splice(threadIdx, 1);
  state.chatOpen = null;
  saveState();
  // Tutup panel chat & balik ke list
  $(".messages-layout")?.classList.remove("show-chat");
  if ($("#mlChat")) {
    $("#mlChat").innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">💬</div>
        <h3>Pilih percakapan</h3>
        <p>Klik kontak di sebelah kiri untuk memulai chat.</p>
      </div>`;
  }
  renderMsgList();
  toast(`🗑️ Chat dengan <b>@${escapeHtml(partner)}</b> dihapus`, "success");
}

function confirmDeleteChatForEveryone(threadIdx) {
  if (threadIdx == null) return;
  const m = state.messages[threadIdx];
  if (!m) return;
  openConfirm({
    icon: "💥",
    iconClass: "danger",
    title: "Hapus chat untuk semuanya?",
    desc: `Seluruh pesan di percakapan dengan <b>@${escapeHtml(m.name)}</b> akan dihapus dari kedua sisi (kamu dan @${escapeHtml(m.name)}). Tindakan ini tidak bisa dibatalkan.`,
    btnText: "Hapus untuk semuanya",
    btnClass: "danger",
    onConfirm: () => deleteChatForEveryone(threadIdx)
  });
}

function deleteChatForEveryone(threadIdx) {
  const m = state.messages[threadIdx];
  if (!m) return;
  const partner = m.name;
  const myUsername = user?.username;

  // 1. Hapus dari state user yang sedang login
  state.messages.splice(threadIdx, 1);
  state.chatOpen = null;
  saveState();

  // 2. Hapus thread di sisi lawan bicara (cross-device via cloud-sync setItem hijack)
  if (myUsername && partner && partner !== myUsername) {
    const partnerKey = `playly-state-${partner}`;
    let ps;
    try { ps = JSON.parse(localStorage.getItem(partnerKey)); } catch { ps = null; }
    if (ps && Array.isArray(ps.messages)) {
      const before = ps.messages.length;
      ps.messages = ps.messages.filter(t => t.name !== myUsername);
      if (ps.messages.length !== before) {
        try { localStorage.setItem(partnerKey, JSON.stringify(ps)); } catch (e) {
          console.warn("[chat] gagal hapus di sisi lawan:", e);
        }
      }
    }
  }

  // Tutup panel chat & balik ke list
  $(".messages-layout")?.classList.remove("show-chat");
  if ($("#mlChat")) {
    $("#mlChat").innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">💬</div>
        <h3>Pilih percakapan</h3>
        <p>Klik kontak di sebelah kiri untuk memulai chat.</p>
      </div>`;
  }
  renderMsgList();
  toast(`💥 Chat dengan <b>@${escapeHtml(partner)}</b> dihapus untuk semua pihak`, "success");
}

function renderChat() {
  if (state.chatOpen == null) return;
  const m = state.messages[state.chatOpen];
  const body = $("#chatBody");
  if (!body) return;
  body.innerHTML = m.history.map(h => {
    const timeLabel = chatRelTime(h.ts);
    const timeMarkup = timeLabel ? `<small>${timeLabel}</small>` : "";
    if (h.videoId) {
      return `
        <div class="bubble ${h.from === 'me' ? 'me' : ''} bubble-video" data-msg-idx="${m.history.indexOf(h)}">
          <button type="button" class="bubble-video-card" data-bubble-vid="${h.videoId}">
            <div class="bubble-video-thumb">
              <img src="${escapeHtml(h.videoThumb || "")}" alt="" onerror="this.style.display='none'"/>
              <span class="bubble-video-play">▶</span>
              ${h.videoDuration ? `<span class="bubble-video-dur">${escapeHtml(h.videoDuration)}</span>` : ""}
            </div>
            <div class="bubble-video-info">
              <strong>${escapeHtml(h.videoTitle || "Video")}</strong>
              <small>@${escapeHtml(h.videoCreator || "")}</small>
            </div>
          </button>
          ${h.text ? `<p class="bubble-video-note">${escapeHtml(h.text)}</p>` : ""}
          ${timeMarkup}
        </div>
      `;
    }
    return `<div class="bubble ${h.from === 'me' ? 'me' : ''} ${h.isAdmin ? 'admin' : ''}" data-msg-idx="${m.history.indexOf(h)}">${h.isAdmin ? '<span class="bubble-admin-tag">ADMIN</span>' : ''}${h.text}${timeMarkup}</div>`;
  }).join("");
  body.querySelectorAll("[data-bubble-vid]").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      openPlayer(+b.dataset.bubbleVid);
    });
  });
  // Klik bubble pesan teks → munculkan context menu (salin / hapus)
  body.querySelectorAll(".bubble[data-msg-idx]").forEach(b => {
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(b.dataset.msgIdx, 10);
      if (Number.isNaN(idx)) return;
      showMessageContextMenu(b, state.chatOpen, idx);
    };
    b.addEventListener("click", handler);
    b.addEventListener("contextmenu", handler);
  });
  body.scrollTop = body.scrollHeight;
}

function sendChat() {
  const txt = $("#chatField")?.value.trim();
  if (!txt || state.chatOpen == null) return;
  const m = state.messages[state.chatOpen];
  const senderIsAdmin = user?.role === "admin";

  // Tulis ke thread lokal (sender side)
  const sentTs = Date.now();
  m.history.push({ from: "me", text: txt, time: "baru", ts: sentTs, isAdmin: senderIsAdmin });
  m.preview = "Kamu: " + txt;
  m.time = "baru";
  m.ts = sentTs;
  $("#chatField").value = "";
  saveState();
  renderChat();
  renderMsgList();

  // Antar pesan ke inbox penerima (real, bukan auto-reply).
  // `m.name` adalah username lawan bicara.
  const recipientUsername = m.name;
  if (recipientUsername && recipientUsername !== user?.username) {
    deliverChatToRecipient(recipientUsername, txt, senderIsAdmin);
  }
}

// Antar pesan dari current user ke inbox penerima.
// Tulis ke `playly-state-{recipient}.messages` — cross-tab/cross-device sync
// otomatis lewat storage event + cloud-sync.
function deliverChatToRecipient(recipientUsername, text, fromAdmin) {
  const key = `playly-state-${recipientUsername}`;
  let s;
  try { s = JSON.parse(localStorage.getItem(key)); } catch { s = null; }
  if (!s) s = { messages: [] };
  if (!Array.isArray(s.messages)) s.messages = [];

  const senderName = user?.username || "user";
  const senderInit = (user?.name || senderName).slice(0, 2).toUpperCase();

  const deliverTs = Date.now();
  let thread = s.messages.find(m => m.name === senderName);
  if (!thread) {
    thread = {
      name: senderName,
      init: senderInit,
      isAdmin: !!fromAdmin,
      preview: "",
      time: "baru",
      ts: deliverTs,
      unread: false,
      online: true,
      history: []
    };
    s.messages.unshift(thread);
  } else {
    thread.isAdmin = !!fromAdmin;
    s.messages = [thread, ...s.messages.filter(t => t !== thread)];
  }
  thread.history.push({ from: "them", text, time: "baru", ts: deliverTs, isAdmin: !!fromAdmin });
  thread.preview = text.length > 60 ? text.slice(0, 57) + "..." : text;
  thread.time = "baru";
  thread.ts = deliverTs;
  thread.unread = true;

  localStorage.setItem(key, JSON.stringify(s));
}

$("#newChat")?.addEventListener("click", () => {
  if (!state.followingCreators.length) {
    toast("⚠️ Follow kreator dulu untuk memulai chat", "warning");
    setTimeout(() => switchView("discover"), 1000);
    return;
  }
  // Create chat with a random followed creator
  const creator = state.followingCreators[0];
  const c = CREATORS.find(x => x.name === creator);
  if (!c) return;
  const existing = state.messages.findIndex(m => m.name === creator);
  if (existing >= 0) return openChat(existing);

  state.messages.unshift({
    name: creator, init: c.init, preview: "Mulai percakapan...", time: "baru", ts: Date.now(), unread: false, online: c.online,
    history: []
  });
  saveState();
  renderMsgList();
  openChat(0);
});

// ----------------------- UPLOAD VIEW -----------------------
const dropzone = $("#dropzone");
const fileInput = $("#fileInput");
const uploadPreview = $("#uploadPreview");
let pendingUpload = null; // { file, thumb (data URL), duration (string), videoUrl (blob URL) }

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDurationSec(sec) {
  if (!isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Bikin thumbnail dari frame video (~detik 1) + ukur durasi.
function generateVideoThumb(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    // JANGAN set crossOrigin untuk blob URL — bisa bikin canvas tainted
    // di iOS Safari sehingga toDataURL throw SecurityError.
    v.src = url;
    let captured = false;
    const cleanup = () => { try { URL.revokeObjectURL(url); } catch {} };

    const tryCapture = () => {
      if (captured) return;
      try {
        const w = 480;
        const ratio = v.videoHeight && v.videoWidth ? v.videoHeight / v.videoWidth : 9 / 16;
        const h = Math.round(w * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(v, 0, 0, w, h);
        const thumb = canvas.toDataURL("image/jpeg", 0.72);
        captured = true;
        const duration = fmtDurationSec(v.duration || 0);
        cleanup();
        resolve({ thumb, duration });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    v.addEventListener("loadedmetadata", () => {
      const target = Math.min(1.0, (v.duration || 1) * 0.1);
      try { v.currentTime = target; }
      catch { /* mobile mungkin block seek — fallback langsung capture */ tryCapture(); }
    }, { once: true });
    v.addEventListener("seeked", tryCapture, { once: true });
    // Fallback untuk mobile yang gak fire 'seeked': capture saat data tersedia
    v.addEventListener("loadeddata", () => {
      // Tunggu dikit biar frame ke-decode
      setTimeout(() => { if (!captured) tryCapture(); }, 400);
    }, { once: true });
    v.addEventListener("error", () => {
      cleanup();
      reject(new Error("Tidak bisa membaca file video"));
    }, { once: true });
    // Timeout 12 detik (lebih panjang untuk mobile lambat)
    setTimeout(() => {
      if (!captured) {
        cleanup();
        reject(new Error("Timeout membaca video"));
      }
    }, 12000);
  });
}

async function handlePickedFile(file) {
  if (!file) return;
  if (!file.type.startsWith("video/")) return toast("⚠️ File harus berupa video", "warning");
  if (file.size > 500 * 1024 * 1024) return toast("⚠️ Maksimal 500 MB", "warning");

  $("#upTitle").value = file.name.replace(/\.[^.]+$/, "");

  // Tampilkan preview placeholder dulu, generate thumbnail di background
  uploadPreview.hidden = false;
  $("#uploadPreviewThumb").src = "";
  $("#uploadPreviewName").textContent = file.name;
  $("#uploadPreviewMeta").textContent = `${fmtBytes(file.size)} • memproses thumbnail...`;
  $("#uploadPreviewDuration").textContent = "—";
  dropzone.classList.add("has-file");

  // Buat blob URL dulu (dipakai untuk playback nanti)
  const videoUrl = URL.createObjectURL(file);
  pendingUpload = { file, thumb: null, duration: "0:00", videoUrl };

  try {
    const { thumb, duration } = await generateVideoThumb(file);
    pendingUpload.thumb = thumb;
    pendingUpload.duration = duration;
    $("#uploadPreviewThumb").src = thumb;
    $("#uploadPreviewMeta").textContent = `${fmtBytes(file.size)} • ${duration}`;
    $("#uploadPreviewDuration").textContent = duration;
  } catch (err) {
    console.warn("Gagal generate thumb:", err);
    // Fallback ke gambar acak
    pendingUpload.thumb = `https://picsum.photos/seed/u${Date.now()}/600/340`;
    $("#uploadPreviewThumb").src = pendingUpload.thumb;
    $("#uploadPreviewMeta").textContent = `${fmtBytes(file.size)} • thumbnail otomatis`;
  }
}

function clearPendingUpload() {
  if (pendingUpload?.videoUrl) URL.revokeObjectURL(pendingUpload.videoUrl);
  pendingUpload = null;
  fileInput.value = "";
  uploadPreview.hidden = true;
  dropzone.classList.remove("has-file");
}

dropzone?.addEventListener("click", e => {
  // Cegah re-trigger kalau klik dari area preview/btn
  if (e.target.closest(".upload-preview")) return;
  fileInput.click();
});
["dragenter", "dragover"].forEach(ev => dropzone?.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("drag"); }));
["dragleave", "drop"].forEach(ev => dropzone?.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("drag"); }));
dropzone?.addEventListener("drop", e => {
  const f = e.dataTransfer.files?.[0];
  if (f) {
    fileInput.files = e.dataTransfer.files;
    handlePickedFile(f);
  }
});
fileInput?.addEventListener("change", () => handlePickedFile(fileInput.files[0]));
$("#uploadPreviewClear")?.addEventListener("click", e => {
  e.preventDefault();
  e.stopPropagation();
  clearPendingUpload();
});

$("#startUpload")?.addEventListener("click", () => {
  if (!pendingUpload || !pendingUpload.file) return toast("⚠️ Pilih video dulu", "warning");
  const title = $("#upTitle").value.trim();
  if (!title) return toast("⚠️ Judul wajib diisi", "warning");
  const visibility = $("#upVis").value;
  const captured = pendingUpload; // freeze
  const desc = $("#upDesc").value || "Video baru saja diunggah.";
  const wrap = $("#uploadProgress"), bar = $("#upBar"), status = $("#upStatus");
  wrap.hidden = false;

  // Tracking entry untuk tab "Sedang Upload"
  const uploadId = "u" + Date.now();
  const uploadEntry = {
    id: uploadId,
    title,
    thumb: captured.thumb,
    progress: 0,
    status: "uploading",
    startedAt: Date.now()
  };
  state.uploadingVideos = state.uploadingVideos || [];
  state.uploadingVideos.unshift(uploadEntry);
  saveState();
  syncVideoTabCounts();

  window.__activeUploads = window.__activeUploads || {};
  window.__activeUploads[uploadId] = true;

  let p = 0;
  const tick = setInterval(() => {
    // Cek kalau upload dibatalkan
    if (!window.__activeUploads[uploadId]) {
      clearInterval(tick);
      wrap.hidden = true; bar.style.width = "0%";
      return;
    }
    p += Math.random() * 12 + 4;
    uploadEntry.progress = Math.min(100, p);
    // Update tampilan tab "Sedang Upload" kalau sedang dilihat
    if (state.filter === "uploading" && state.currentView === "videos") renderVideoGrid();

    if (p >= 100) {
      p = 100; clearInterval(tick);
      delete window.__activeUploads[uploadId];
      uploadEntry.status = "done";
      status.textContent = "✓ Upload selesai!";
      const _now = Date.now();
      const newVid = {
        id: _now, createdAt: _now, title, creator: user.username, category: "", visibility,
        views: "0", viewsNum: 0,
        time: "baru saja", duration: captured.duration || "0:00", likes: 0,
        thumb: captured.thumb || `https://picsum.photos/seed/u${_now}/600/340`,
        videoUrl: captured.videoUrl,
        desc
      };
      state.myVideos.unshift(newVid);
      // Pindahkan dari uploadingVideos
      state.uploadingVideos = state.uploadingVideos.filter(u => u.id !== uploadId);
      state.activities.unshift({ type: "upload", text: `Kamu mengupload <i>${title}</i>`, time: "baru saja", icon: "🎬" });
      saveState();
      // Simpan file aslinya ke IndexedDB supaya tetap bisa diputar setelah reload
      saveVideoBlob(newVid.id, captured.file).then(() => refreshStorageUsage());
      // Cloud sync: upload juga ke Supabase Storage agar bisa diputar di browser lain
      if (window.cloudSync?.uploadVideoBlob) {
        window.cloudSync.uploadVideoBlob(newVid.id, captured.file).then(result => {
          if (result && result.ok && result.url) {
            newVid.videoUrl = result.url;
            saveState();
            toast("☁️ Video tersimpan di cloud — bisa diputar di device lain.", "success");
          } else if (result && !result.ok) {
            // Upload ke cloud gagal — beritahu user, tapi video tetap aman di lokal
            const reason =
              result.message ||
              (result.error === "file_too_large"
                ? "File terlalu besar untuk Supabase Storage."
                : "Upload ke cloud gagal — video disimpan lokal saja.");
            toast(`⚠️ ${reason} Video kamu masih bisa diputar di browser ini.`, "warning");
          }
        }).catch(err => {
          console.warn("[upload] cloud sync exception:", err);
          toast("⚠️ Sync video ke cloud gagal — video disimpan lokal saja.", "warning");
        });
      }
      refreshAllVideoGrids();
      renderUserStats();
      renderActivityList();
      renderHomeActivity();
      renderHomeTrending();
      renderHomeStats();
      renderFeatured(); // Update tile "⭐ Video Terbaru Saya" di Home
      renderTopPerforming();
      renderDiscoverCreators();
      refreshHeroGreeting();
      pendingUpload = null; // jangan revoke videoUrl — masih dipakai newVid
      setTimeout(() => {
        wrap.hidden = true; bar.style.width = "0%";
        $("#upTitle").value = ""; $("#upDesc").value = "";
        uploadPreview.hidden = true;
        dropzone.classList.remove("has-file");
        fileInput.value = "";
        toast(`🎉 <b>${title}</b> berhasil diunggah!`, "success");
        switchView("videos");
      }, 800);
    }
    bar.style.width = p + "%";
    status.textContent = `Mengunggah... ${Math.floor(p)}%`;
  }, 200);
});

// ----------------------- PLAYER MODAL -----------------------
// Render daftar "Diunduh" di sidebar player.
// Source: state.downloaded (array {videoId, ts}). Resolve ke video object via findVideo()
// — kalau video sudah dihapus dari platform, skip (filter out).
function renderDownloadedList(currentId) {
  const listEl = document.querySelector("#downloadedList");
  const cntEl = document.querySelector("#downloadedCount");
  if (!listEl) return;
  const downloaded = Array.isArray(state?.downloaded) ? state.downloaded : [];
  const items = downloaded
    .map(d => ({ ...d, video: typeof findVideo === "function" ? findVideo(d.videoId) : null }))
    .filter(x => x.video);
  if (cntEl) cntEl.textContent = items.length;

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="upnext-empty">
        <div class="upnext-empty-icon">📥</div>
        <p>Belum ada unduhan</p>
        <small>Klik tombol Unduh di bawah video untuk simpan ke daftar ini.</small>
      </div>`;
    return;
  }
  listEl.innerHTML = items.map(({ video: x, videoId }) => `
    <div class="upload-item ${videoId === currentId ? "active" : ""}" data-vid="${videoId}">
      <div class="mini-thumb"><img src="${x.thumb}" alt=""/><span class="duration">${x.duration}</span></div>
      <div class="info"><h5>${escapeHtml(x.title)}</h5><p>@${escapeHtml(x.creator)} • ${x.views} views</p></div>
    </div>
  `).join("");
  listEl.querySelectorAll(".upload-item").forEach(c => {
    c.addEventListener("click", () => {
      const vid = +c.dataset.vid;
      if (vid === currentId) return;
      openPlayer(vid);
    });
  });
}

async function openPlayer(id) {
  const v = findVideo(id);
  if (!v) return;

  // Track view real-time — naik untuk SEMUA viewer (termasuk creator sendiri).
  // Sekali per session per video supaya tidak spam saat reopen di session yang sama.
  {
    const viewKey = `playly-view-${id}-${user?.username || 'anon'}`;
    if (!sessionStorage.getItem(viewKey)) {
      sessionStorage.setItem(viewKey, "1");
      updateVideoStat(id, "viewsNum", 1);
      // Refresh v supaya display di bawah pakai angka terbaru
      Object.assign(v, findVideo(id) || {});
      // Patch counter di FYP card via DOM langsung — JANGAN full re-render,
      // biar timestamp "X hari lalu" di header tidak shift / di-recompute.
      patchVideoCountersInDom(id);
      if (typeof renderUserStats === "function") renderUserStats();
    }
  }

  state.currentVideo = id;
  $("#playerTitle").textContent = v.title;
  $("#playerCreator").textContent = "@" + v.creator;
  $("#playerCreatorInit").textContent = v.creator.slice(0, 2).toUpperCase();
  $("#playerViewCount").textContent = v.views || fmtNum(v.viewsNum || 0);
  $("#playerDesc").textContent = v.desc;
  const liked = state.liked.includes(id);
  const saved = state.saved.includes(id);
  $("#likeCount").textContent = (v.likes || 0).toLocaleString("id-ID");
  $("#likeBtn").classList.toggle("active", liked);
  $("#saveBtn").classList.toggle("active", saved);
  const isOwnVideo = !!user?.username && v.creator === user.username;
  $("#followBtn").hidden = isOwnVideo;
  $("#followBtn").textContent = state.followingCreators.includes(v.creator) ? "✓ Following" : "Follow";

  const videoEl = $("#videoEl");
  videoEl.poster = v.thumb;
  // Resolve src: coba videoUrl yang ada → IDB → fallback ke sample
  const SAMPLE_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  const resolved = await resolveVideoSource(v);
  videoEl.src = resolved || SAMPLE_URL;
  // Reset player toolbar state untuk video baru
  resetPlayerToolbar(videoEl, v);

  renderDownloadedList(id);
  // Sidebar — role-aware:
  //   Admin → tampilkan SEMUA video di platform (untuk moderasi/preview)
  //   User  → hanya video yang user sendiri upload
  const isAdmin = user?.role === "admin";
  const sideList = isAdmin ? allVideos() : (state?.myVideos || []);
  const titleEl = $("#upNextTitle");
  if (titleEl) titleEl.textContent = isAdmin ? "Semua Video" : "Video Saya";
  const cnt = $("#upNextCount");
  if (cnt) cnt.textContent = sideList.length;
  const listEl = $("#upNextList");
  if (sideList.length === 0) {
    listEl.innerHTML = isAdmin
      ? `<div class="upnext-empty">
          <div class="upnext-empty-icon">🎬</div>
          <p>Belum ada video</p>
          <small>Belum ada video yang di-upload user di platform.</small>
        </div>`
      : `<div class="upnext-empty">
          <div class="upnext-empty-icon">🎬</div>
          <p>Belum ada video</p>
          <small>Upload video pertamamu untuk muncul di sini.</small>
          <button class="btn primary small" data-jump="upload" type="button">📤 Upload Sekarang</button>
        </div>`;
  } else {
    listEl.innerHTML = sideList.map(x => `
      <div class="upload-item ${x.id === id ? "active" : ""}" data-vid="${x.id}">
        <div class="mini-thumb"><img src="${x.thumb}" alt=""/><span class="duration">${x.duration}</span></div>
        <div class="info"><h5>${escapeHtml(x.title)}</h5><p>@${escapeHtml(x.creator)} • ${x.views} views</p></div>
        <button class="upload-item-dl" data-dl-vid="${x.id}" title="Download" aria-label="Download" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14"/></svg>
        </button>
      </div>
    `).join("");
    $$("#upNextList .upload-item").forEach(c => c.addEventListener("click", e => {
      if (e.target.closest("[data-dl-vid]")) return;
      const vid = +c.dataset.vid;
      if (vid === id) return;
      openPlayer(vid);
    }));
    $$("#upNextList [data-dl-vid]").forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      const vid = +b.dataset.dlVid;
      const target = sideList.find(x => x.id === vid);
      if (target) openDownloadOptionsModal(target);
    }));
    // Auto-scroll sidebar supaya video aktif terlihat (kalau list panjang)
    const activeEl = $("#upNextList .upload-item.active");
    if (activeEl) activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const existing = state.history.findIndex(h => h.videoId === id && h.group === "Hari ini");
  if (existing >= 0) state.history[existing].time = "baru saja";
  else state.history.unshift({ videoId: id, group: "Hari ini", time: "baru saja", progress: Math.floor(Math.random() * 30) + 10 });
  saveState();

  renderComments(id);
  switchView("player");

  // Inject iklan dari admin Ad Manager (running text, banner, pre-roll).
  // Pre-roll akan di-await di dalamnya — video utama jalan setelah iklan selesai/skip.
  // Tanpa pre-roll, applyAdOverlays return cepat → kita explicit play() supaya
  // user tidak perlu klik tombol play manual setelah membuka video.
  // EXCEPTION: Admin tidak auto-play — admin biasanya preview untuk moderasi,
  // jadi kontrol manual lebih aman (avoid suara mendadak saat browse banyak video).
  await applyAdOverlays(videoEl);
  const shouldAutoplay = user?.role !== "admin";
  if (shouldAutoplay && state?.currentVideo === id && state?.currentView === "player" && videoEl.paused) {
    try { await videoEl.play(); } catch {}
  }
}

// =================== PLAYER TOOLBAR (speed/quality/CC/PiP/FS) ===================

function resetPlayerToolbar(videoEl, vid) {
  // Speed back to 1×
  videoEl.playbackRate = 1;
  $("#speedLabel") && ($("#speedLabel").textContent = "1×");
  $$("[data-speed]").forEach(b => b.classList.toggle("active", parseFloat(b.dataset.speed) === 1));

  // Quality back to Auto
  $("#qualityLabel") && ($("#qualityLabel").textContent = "Auto");
  $$("[data-q]").forEach(b => b.classList.toggle("active", b.dataset.q === "auto"));
  videoEl.style.filter = "";

  // Subtitle off — buang track lama
  videoEl.querySelectorAll("track").forEach(t => t.remove());
  $("#subBtn")?.classList.remove("active");
  videoEl.dataset.subOn = "";

  // Tutup menu
  $("#speedMenu") && ($("#speedMenu").hidden = true);
  $("#qualityMenu") && ($("#qualityMenu").hidden = true);

  // Simpan reference video di element untuk dipakai handler subtitle
  videoEl._currentVid = vid;
}

function setupPlayerToolbar() {
  const v = $("#videoEl");
  if (!v) return;

  // ----- Speed -----
  $("#speedBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    const m = $("#speedMenu");
    m.hidden = !m.hidden;
    $("#qualityMenu").hidden = true;
  });
  $$("[data-speed]").forEach(b => {
    b.addEventListener("click", () => {
      const s = parseFloat(b.dataset.speed);
      v.playbackRate = s;
      $("#speedLabel").textContent = s + "×";
      $$("[data-speed]").forEach(x => x.classList.toggle("active", x === b));
      $("#speedMenu").hidden = true;
      toast(`⚡ Kecepatan: <b>${s}×</b>`, "success");
    });
  });

  // ----- Quality (UI label only — single source, jadi hanya simulasi) -----
  $("#qualityBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    const m = $("#qualityMenu");
    m.hidden = !m.hidden;
    $("#speedMenu").hidden = true;
  });
  $$("[data-q]").forEach(b => {
    b.addEventListener("click", () => {
      const q = b.dataset.q;
      $("#qualityLabel").textContent = q === "auto" ? "Auto" : q;
      $$("[data-q]").forEach(x => x.classList.toggle("active", x === b));
      $("#qualityMenu").hidden = true;
      // Simulasi: pakai blur untuk 360p, tanpa filter untuk yang lebih tinggi
      if (q === "360p") v.style.filter = "blur(.4px)";
      else v.style.filter = "";
      toast(`🎚️ Kualitas: <b>${q === "auto" ? "Auto" : q}</b>`, "success");
    });
  });

  // ----- Subtitle / CC (auto-generate VTT dari deskripsi & judul) -----
  $("#subBtn")?.addEventListener("click", () => {
    const isOn = v.dataset.subOn === "1";
    if (isOn) {
      for (const t of v.textTracks) t.mode = "hidden";
      v.dataset.subOn = "";
      $("#subBtn").classList.remove("active");
      toast("💬 Subtitle <b>OFF</b>", "info");
    } else {
      ensureSubtitleTrack(v);
      // Tunggu track ready, lalu show
      const showTrack = () => { for (const t of v.textTracks) t.mode = "showing"; };
      if (v.textTracks.length) showTrack();
      else v.addEventListener("loadedmetadata", showTrack, { once: true });
      v.dataset.subOn = "1";
      $("#subBtn").classList.add("active");
      toast("💬 Auto-subtitle <b>ON</b>", "success");
    }
  });

  // ----- Picture-in-picture -----
  // Video punya attribute `disablepictureinpicture` permanen (untuk
  // menyembunyikan opsi "Gambar dalam gambar" di menu native browser).
  // Saat user klik tombol PiP di toolbar, kita matikan attribute itu
  // sementara, panggil API, lalu pasang lagi — hasilnya: PiP tetap jalan
  // dari tombol kita tapi menu native tetap bersih.
  $("#pipBtn")?.addEventListener("click", async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        $("#pipBtn").classList.remove("active");
        return;
      }
      if (!document.pictureInPictureEnabled) {
        toast("⚠️ Browser tidak mendukung Picture-in-Picture", "warning");
        return;
      }
      v.disablePictureInPicture = false;
      try {
        await v.requestPictureInPicture();
        $("#pipBtn").classList.add("active");
      } finally {
        // Pasang lagi supaya menu native tetap tidak menampilkan opsi PiP
        v.disablePictureInPicture = true;
      }
    } catch (err) {
      toast(`❌ PiP gagal: ${err.message}`, "error");
    }
  });
  v.addEventListener("leavepictureinpicture", () => $("#pipBtn")?.classList.remove("active"));

  // ----- Download -----
  $("#downloadBtn")?.addEventListener("click", async () => {
    const src = v.currentSrc || v.src;
    if (!src) return toast("❌ Tidak ada video untuk diunduh", "error");
    const titleEl = $("#playerTitle");
    const safeName = (titleEl?.textContent || "video").replace(/[^\w\s.-]+/g, "").trim().slice(0, 80) || "video";
    try {
      // Untuk blob URL atau cross-origin yang allow download, fetch lalu trigger anchor download
      const isBlob = src.startsWith("blob:");
      let url = src, revokeAfter = false;
      if (!isBlob) {
        // Fetch supaya nama file bisa di-set (anchor download tidak override filename utk cross-origin)
        try {
          const r = await fetch(src, { mode: "cors" });
          if (!r.ok) throw new Error("fetch failed");
          const blob = await r.blob();
          url = URL.createObjectURL(blob);
          revokeAfter = true;
        } catch {
          // Fallback: pakai src langsung — browser akan navigasi/download tergantung CORS
        }
      }
      const ext = (src.match(/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i)?.[1] || "mp4").toLowerCase();
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (revokeAfter) setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast(`📥 <b>${escapeHtml(safeName)}</b> sedang diunduh...`, "success");
      // Catat ke daftar "Diunduh" di sidebar player — supaya user bisa
      // re-watch via list tanpa cari ulang dari Discover/feed.
      const curId = state?.currentVideo;
      if (curId) {
        if (!Array.isArray(state.downloaded)) state.downloaded = [];
        // Dedupe: kalau sudah ada, hapus entry lama dulu (move to top)
        state.downloaded = state.downloaded.filter(d => d.videoId !== curId);
        state.downloaded.unshift({ videoId: curId, ts: Date.now() });
        saveState();
        if (typeof renderDownloadedList === "function") renderDownloadedList();
      }
    } catch (err) {
      toast(`❌ Gagal unduh: ${err.message}`, "error");
    }
  });

  // ----- Fullscreen -----
  $("#fsBtn")?.addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      const target = v;
      (target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen)?.call(target);
    }
  });
  document.addEventListener("fullscreenchange", () => {
    $("#fsBtn")?.classList.toggle("active", !!document.fullscreenElement);
  });

  // Tutup menu kalau klik di luar / tekan ESC
  document.addEventListener("click", e => {
    if (!e.target.closest(".ptb-group")) {
      $("#speedMenu") && ($("#speedMenu").hidden = true);
      $("#qualityMenu") && ($("#qualityMenu").hidden = true);
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      $("#speedMenu") && ($("#speedMenu").hidden = true);
      $("#qualityMenu") && ($("#qualityMenu").hidden = true);
    }
  });
}

// Bikin auto-subtitle dari deskripsi+judul, encode ke WebVTT, attach sebagai <track>.
function ensureSubtitleTrack(videoEl) {
  if (videoEl.querySelector("track")) return;
  const vid = videoEl._currentVid || {};
  const text = `${vid.title || ""}. ${vid.desc || ""}`.trim();
  let sentences = text.split(/[.!?]\s+/).map(s => s.trim()).filter(Boolean);
  if (!sentences.length) sentences = ["Auto-subtitle untuk demonstrasi."];
  // Distribusi cue tiap 3 detik, ulang kalau perlu sampai durasi habis
  const totalDur = isFinite(videoEl.duration) && videoEl.duration > 0 ? videoEl.duration : sentences.length * 3;
  const step = 3;
  const pad = t => {
    const m = Math.floor(t / 60), s = Math.floor(t % 60), ms = Math.floor((t % 1) * 1000);
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(ms).padStart(3,"0")}`;
  };
  let vtt = "WEBVTT\n\n";
  let t = 0, i = 0;
  while (t < totalDur) {
    const end = Math.min(t + step, totalDur);
    const line = sentences[i % sentences.length];
    vtt += `${pad(t)} --> ${pad(end)}\n${line}\n\n`;
    t = end;
    i++;
    if (i > 200) break; // safety
  }
  const blob = new Blob([vtt], { type: "text/vtt" });
  const track = document.createElement("track");
  track.kind = "subtitles";
  track.label = "Auto-subtitle (ID)";
  track.srclang = "id";
  track.default = true;
  track.src = URL.createObjectURL(blob);
  videoEl.appendChild(track);
}

setupPlayerToolbar();

function renderComments(id) {
  const comments = getVideoComments(id);
  $("#commentCount").textContent = `${comments.length} Comments`;
  $("#commentList").innerHTML = comments.length ? comments.map((c, i) => `
    <div class="comment">
      <div class="avatar small"><span>${escapeHtml(c.init || "")}</span></div>
      <div class="info">
        <div><strong>@${escapeHtml(c.name)}</strong><span class="time">${escapeHtml(c.time || "")}</span></div>
        <p>${escapeHtml(c.text || "")}</p>
        <div class="reactions"><button data-like-c="${i}">♥ ${c.likes || 0}</button><button>Reply</button></div>
      </div>
    </div>
  `).join("") : `<div style="text-align:center; padding:24px; color:var(--muted); font-size:13px">Belum ada komentar. Jadilah yang pertama!</div>`;
  $$("[data-like-c]").forEach(b => b.addEventListener("click", () => {
    const list = getVideoComments(id);
    const idx = +b.dataset.likeC;
    if (list[idx]) {
      list[idx].likes = (list[idx].likes || 0) + 1;
      setVideoComments(id, list);
      renderComments(id);
    }
  }));
}

$("#commentSend")?.addEventListener("click", sendComment);
$("#commentField")?.addEventListener("keydown", e => { if (e.key === "Enter") sendComment(); });
function sendComment() {
  const txt = $("#commentField").value.trim();
  if (!txt) return;
  const id = state.currentVideo;
  const initials = user.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const list = getVideoComments(id);
  list.unshift({ name: user.username, init: initials, text: txt, time: "baru saja", likes: 0, ts: Date.now() });
  setVideoComments(id, list);
  $("#commentField").value = "";
  renderComments(id);
  // Notifikasi ke pemilik video (kalau bukan komentar di video sendiri)
  const v = findVideo(id);
  if (v && v.creator && v.creator !== user.username) {
    deliverNotification(v.creator, {
      type: "comment", videoId: id,
      init: initials,
      fromUsername: user.username,
      text: `<b>@${user.username}</b> berkomentar di videomu "<b>${escapeHtml(v.title || "")}</b>": "${escapeHtml(txt.length > 80 ? txt.slice(0, 77) + "..." : txt)}"`
    });
  }
  toast("💬 Komentar terkirim", "success");
}

$("#likeBtn")?.addEventListener("click", () => {
  const id = state.currentVideo;
  const wasLiked = state.liked.includes(id);
  if (wasLiked) state.liked = state.liked.filter(x => x !== id);
  else state.liked.push(id);
  // Update real likes count pada video creator's state — cloud-sync akan mirror.
  updateVideoStat(id, "likes", wasLiked ? -1 : 1);
  saveState();
  // Notifikasi ke pemilik video saat like baru (bukan unlike, bukan video sendiri)
  if (!wasLiked) {
    const v = findVideo(id);
    if (v && v.creator && v.creator !== user.username) {
      const initials = (user.name || user.username).split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
      deliverNotification(v.creator, {
        type: "like", videoId: id,
        init: initials,
        fromUsername: user.username,
        text: `<b>@${user.username}</b> menyukai videomu "<b>${escapeHtml(v.title || "")}</b>" ❤️`
      });
    }
  }
  openPlayer(id);
  refreshAllVideoGrids();
  renderUserStats();
});
$("#saveBtn")?.addEventListener("click", () => {
  const id = state.currentVideo;
  if (state.saved.includes(id)) state.saved = state.saved.filter(x => x !== id);
  else { state.saved.push(id); toast("🔖 Disimpan", "success"); }
  saveState();
  $("#saveBtn").classList.toggle("active", state.saved.includes(id));
  refreshAllVideoGrids();
});
$("#shareBtn")?.addEventListener("click", () => {
  if (state.currentVideo == null) return;
  // Reset preview QR (kalau-kalau kebuka dari sesi sebelumnya)
  const qrBox = document.getElementById("shareQrBox");
  if (qrBox) qrBox.hidden = true;
  openShareModal(state.currentVideo);
});
$("#followBtn")?.addEventListener("click", () => {
  const v = findVideo(state.currentVideo);
  if (!v) return;
  const wasFollowing = state.followingCreators.includes(v.creator);
  toggleFollow(v.creator);
  $("#followBtn").textContent = state.followingCreators.includes(v.creator) ? "✓ Following" : "Follow";
  // Notifikasi ke kreator saat user mulai follow (bukan unfollow, bukan diri sendiri)
  if (!wasFollowing && v.creator !== user.username) {
    const initials = (user.name || user.username).split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
    deliverNotification(v.creator, {
      type: "follow",
      init: initials,
      fromUsername: user.username,
      text: `<b>@${user.username}</b> mulai mengikutimu 👤`
    });
  }
});

// ----------------------- CROSS-USER NOTIFICATION DELIVERY -----------------------
// Tulis 1 notifikasi ke state user lain (lewat localStorage). Kalau penerima
// adalah user yang sedang login (test di tab yang sama), langsung sync UI.
function deliverNotification(username, notif) {
  if (!username) return;
  const key = `playly-state-${username}`;
  let s;
  try { s = JSON.parse(localStorage.getItem(key)); } catch { s = null; }
  if (!s) s = { notifications: [] };
  if (!Array.isArray(s.notifications)) s.notifications = [];
  s.notifications.unshift({
    id: Date.now() + Math.random(),
    type: notif.type || "generic",
    text: notif.text || "",
    init: notif.init || "?",
    videoId: notif.videoId,
    fromUsername: notif.fromUsername || null,
    time: "baru saja",
    unread: true
  });
  // Simpan max 100 notifikasi terakhir supaya tidak membengkak
  s.notifications = s.notifications.slice(0, 100);
  try { localStorage.setItem(key, JSON.stringify(s)); } catch {}
  // Kalau receiver = user login sekarang (jarang, tapi tetap aman): sync UI
  if (user && user.username === username && Array.isArray(state?.notifications)) {
    state.notifications = s.notifications;
    renderNotifications?.();
  }
}

// ----------------------- USER PROFILE VIEW (other creator) -----------------------
function getUserVideos(username) {
  if (!username) return [];
  // Video user sendiri (state in-memory paling fresh)
  if (user && user.username === username) {
    return Array.isArray(state?.myVideos) ? state.myVideos.slice() : [];
  }
  try {
    const s = JSON.parse(localStorage.getItem(`playly-state-${username}`));
    return Array.isArray(s?.myVideos) ? s.myVideos : [];
  } catch { return []; }
}

function openUserProfile(username) {
  if (!username) return;
  // Klik profil sendiri → ke editor profil
  if (user && username === user.username) {
    switchView("profile");
    return;
  }
  state._viewingUser = username;
  switchView("user-profile");
}

function renderUserProfile() {
  const username = state?._viewingUser;
  if (!username) return;
  const isMe = !!user && username === user.username;  // ← deteksi own channel
  const acc = findAccountByUsername(username);
  const videos = getUserVideos(username);

  const displayName = acc?.name || username;
  const init = (acc?.name || username).slice(0, 2).toUpperCase();
  const rawBio = acc?.bio?.trim();

  $("#upAvatar").innerHTML = acc?.avatar ? `<img src="${acc.avatar}" alt="${escapeHtml(displayName)}"/>` : `<span>${escapeHtml(init)}</span>`;
  $("#upDisplayName").textContent = displayName;
  $("#upUsername").textContent = "@" + username;
  $("#upSectionUser").textContent = isMe ? "saya" : ("@" + username);

  const bioEl = $("#upBio");
  bioEl.textContent = rawBio || "";
  bioEl.hidden = !rawBio;
  bioEl.classList.remove("clickable-bio");
  bioEl.style.cursor = "";
  bioEl.onclick = null;

  const followerList = getUserFollowers(username);
  const followingList = getUserFollowing(username);
  $("#upStatVideos").textContent = videos.length.toLocaleString("id-ID");
  $("#upStatFollowers") && ($("#upStatFollowers").textContent = followerList.length.toLocaleString("id-ID"));
  $("#upStatFollowing") && ($("#upStatFollowing").textContent = followingList.length.toLocaleString("id-ID"));

  // Action buttons — own channel pakai "Edit Profil + Bagikan", other pakai "Follow + Pesan + Bagikan"
  const followBtn = $("#upFollowBtn");
  const messageBtn = $("#upMessageBtn");
  const editBtn = $("#upEditBtn");
  const followBackTag = $("#upFollowsYou");

  if (isMe) {
    // Hide MENGIKUTIMU badge — gak relevan di own channel
    if (followBackTag) followBackTag.hidden = true;
    if (followBtn) followBtn.hidden = true;
    if (messageBtn) messageBtn.hidden = true;
    if (editBtn) editBtn.hidden = false;
  } else {
    if (followBtn) followBtn.hidden = false;
    if (messageBtn) messageBtn.hidden = false;
    if (editBtn) editBtn.hidden = true;
    // Follow button state
    const isFollowing = state.followingCreators.includes(username);
    const theyFollowMe = !!user && followingList.includes(user.username);
    followBtn.textContent = isFollowing ? "✓ Following" : (theyFollowMe ? "Follow Balik" : "Follow");
    followBtn.classList.toggle("ghost", isFollowing);
    followBtn.classList.toggle("primary", !isFollowing);
    if (followBackTag) followBackTag.hidden = !theyFollowMe;
  }

  // Socials
  const socials = [];
  if (acc?.website)   socials.push(`<a href="${escapeHtml(acc.website)}" target="_blank" rel="noopener">🌐 Website</a>`);
  if (acc?.twitter)   socials.push(`<a href="https://twitter.com/${encodeURIComponent(String(acc.twitter).replace(/^@/, ""))}" target="_blank" rel="noopener">𝕏 ${escapeHtml(acc.twitter)}</a>`);
  if (acc?.instagram) socials.push(`<a href="https://instagram.com/${encodeURIComponent(String(acc.instagram).replace(/^@/, ""))}" target="_blank" rel="noopener">📷 ${escapeHtml(acc.instagram)}</a>`);
  if (acc?.github)    socials.push(`<a href="https://github.com/${encodeURIComponent(acc.github)}" target="_blank" rel="noopener">🐙 ${escapeHtml(acc.github)}</a>`);
  $("#upSocials").innerHTML = socials.join("");

  // Video grid
  const grid = $("#upVideoGrid");
  const empty = $("#upEmpty");
  $("#upVideoCount").textContent = `${videos.length} video`;
  if (!videos.length) {
    grid.innerHTML = "";
    if (empty) empty.hidden = false;
  } else {
    if (empty) empty.hidden = true;
    grid.innerHTML = videos.map(v => `
      <div class="video-card" data-vid="${v.id}">
        <div class="video-thumb"><img src="${v.thumb}" alt=""/></div>
        <div class="video-info">
          <h4>${escapeHtml(v.title || "")}</h4>
          <p>${v.views || 0} views • ${v.time || ""}</p>
        </div>
      </div>
    `).join("");
    grid.querySelectorAll("[data-vid]").forEach(c => {
      c.addEventListener("click", () => openPlayer(+c.dataset.vid));
    });
  }
}

// Click handler untuk avatar/nama kreator di player
$("#playerCreatorLink")?.addEventListener("click", () => {
  const v = findVideo(state.currentVideo);
  if (v?.creator) openUserProfile(v.creator);
});

// Tombol Follow di user-profile view
$("#upFollowBtn")?.addEventListener("click", () => {
  const username = state?._viewingUser;
  if (!username || username === user.username) return;
  toggleFollow(username);
});

$("#upShareBtn")?.addEventListener("click", () => {
  const username = state?._viewingUser;
  if (!username) return;
  navigator.clipboard?.writeText(`https://playly.app/u/${username}`);
  toast("🔗 Link profil disalin", "success");
});

// Tombol "Edit Profil" di own channel → langsung ke editor profil
$("#upEditBtn")?.addEventListener("click", () => switchView("profile"));

$("#upMessageBtn")?.addEventListener("click", () => {
  const username = state?._viewingUser;
  if (!username) return;
  // Cari thread; kalau tidak ada, buat baru
  if (!Array.isArray(state.messages)) state.messages = [];
  let thread = state.messages.find(m => m.name === username);
  if (!thread) {
    const acc = findAccountByUsername(username);
    thread = {
      name: username,
      init: (acc?.name || username).slice(0, 2).toUpperCase(),
      preview: "", time: "baru", ts: Date.now(), unread: false, online: false, history: []
    };
    state.messages.unshift(thread);
    saveState();
  }
  state.chatOpen = username;
  saveState();
  switchView("messages");
});

// Modal close
$$("[data-close]").forEach(b => b.addEventListener("click", e => {
  const m = e.target.closest(".modal");
  if (m) m.classList.remove("show");
}));

// Cleanup player saat user meninggalkan view (back button atau pindah nav).
function cleanupPlayerView() {
  const v = $("#videoEl"); if (!v) return;
  v.pause(); v.removeAttribute("src"); v.load();
  if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
  // Cleanup ad overlays (running text, banner, pre-roll)
  document.querySelectorAll(".player-screen .ad-overlay").forEach(el => el.remove());
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    $$(".modal.show").forEach(m => m.classList.remove("show"));
    $$(".side-panel.open").forEach(p => p.classList.remove("open"));
    $("#profileDropdown")?.classList.remove("open");
  }
});

// ----------------------- NOTIFICATIONS -----------------------
function renderNotifications() {
  const list = $("#notifList");
  if (!list) return;
  if (!state.notifications.length) {
    list.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--muted)">
      <div style="font-size:36px; opacity:.5">🔔</div>
      <h4 style="font-family:'Plus Jakarta Sans'; margin:10px 0 4px; font-weight:700; color:var(--text)">Tidak ada notifikasi</h4>
      <p style="font-size:12.5px">Notifikasi terbaru akan muncul di sini.</p>
    </div>`;
    return;
  }
  list.innerHTML = state.notifications.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}" data-notif-id="${n.id}" style="cursor:pointer">
      <div class="avatar small"><span>${n.init}</span></div>
      <div class="info"><p>${n.text}</p><div class="time">${n.time}</div></div>
    </div>
  `).join("");
  // Klik notifikasi: tandai dibaca + arahkan sesuai jenis (video / profil / pesan).
  list.querySelectorAll(".notif-item").forEach(el => {
    el.addEventListener("click", () => {
      const nid = el.dataset.notifId;
      const n = state.notifications.find(x => String(x.id) === String(nid));
      if (!n) return;
      if (n.unread) { n.unread = false; saveState(); el.classList.remove("unread"); }
      handleNotificationClick(n);
    });
  });
}

// Routing: like/comment/video-share → buka player; follow → buka profil pengirim;
// fallback → buka profil pengirim kalau ada, kalau tidak biarkan saja.
function handleNotificationClick(n) {
  const closePanel = () => $("#notifPanel")?.classList.remove("open");
  if (n.videoId) { closePanel(); openPlayer(+n.videoId); return; }
  const sender = n.fromUsername || extractSenderFromText(n.text);
  if (n.type === "follow") {
    if (sender) { closePanel(); openUserProfile(sender); }
    return;
  }
  if (sender) { closePanel(); openUserProfile(sender); }
}

// Backward-compat: notif lama belum punya fromUsername, ambil dari teks.
function extractSenderFromText(text) {
  if (!text) return null;
  const m = String(text).match(/@([A-Za-z0-9_.-]+)/);
  return m ? m[1] : null;
}
// Event delegation untuk bell + close side panel — robust di mobile
document.addEventListener("click", (e) => {
  const t = e.target;
  // Bell icon → toggle notif panel
  if (t.closest("#openNotif")) {
    e.preventDefault();
    $("#notifPanel")?.classList.toggle("open");
    return;
  }
  // Close button [data-close-sp]
  const closeBtn = t.closest("[data-close-sp]");
  if (closeBtn) {
    e.preventDefault();
    $("#" + closeBtn.dataset.closeSp)?.classList.remove("open");
    return;
  }
});

// ----------------------- GLOBAL SEARCH -----------------------
const searchInput = $("#globalSearch");
const sugg = $("#searchSuggestions");
searchInput.addEventListener("input", e => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { sugg.classList.remove("show"); return; }
  const matches = allVideos().filter(v =>
    v.title.toLowerCase().includes(q) || v.creator.toLowerCase().includes(q) || (v.category || "").includes(q)
  ).slice(0, 6);
  sugg.innerHTML = matches.length
    ? matches.map(v => `<div class="suggestion" data-vid="${v.id}"><img src="${v.thumb}"/><div><strong>${v.title}</strong><small>@${v.creator} • ${v.views} views</small></div></div>`).join("")
    : `<div class="suggestion"><div><strong>Tidak ditemukan</strong><small>Coba kata kunci lain</small></div></div>`;
  $$("[data-vid]", sugg).forEach(s => s.addEventListener("click", () => {
    openPlayer(+s.dataset.vid);
    searchInput.value = ""; sugg.classList.remove("show");
  }));
  sugg.classList.add("show");
});
document.addEventListener("click", e => { if (!e.target.closest(".topbar-search")) sugg.classList.remove("show"); });
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); searchInput.focus(); }
});

$("#sidebarSearch")?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase().trim();
  $$(".nav-item").forEach(n => n.style.display = !q || n.textContent.toLowerCase().includes(q) ? "" : "none");
});

// ----------------------- PROFILE DROPDOWN -----------------------
const dropdown = $("#profileDropdown");

function openDropdown(anchor, fromTop = false) {
  const rect = anchor.getBoundingClientRect();
  if (fromTop) {
    dropdown.style.left = `${rect.right - 260}px`;
    dropdown.style.top = `${rect.bottom + 6}px`;
    dropdown.style.bottom = "auto";
  } else {
    dropdown.style.left = `14px`;
    dropdown.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    dropdown.style.top = "auto";
  }
  dropdown.classList.add("open");
}

$(".profile-more")?.addEventListener("click", e => {
  e.stopPropagation();
  if (dropdown.classList.contains("open")) dropdown.classList.remove("open");
  else openDropdown(e.currentTarget);
});
$("#openProfile")?.addEventListener("click", e => {
  e.stopPropagation();
  if (dropdown.classList.contains("open")) dropdown.classList.remove("open");
  else openDropdown(e.currentTarget, true);
});
document.addEventListener("click", e => {
  if (!e.target.closest("#profileDropdown") && !e.target.closest(".profile-more") && !e.target.closest("#openProfile")) {
    dropdown.classList.remove("open");
  }
});

$$(".pd-item").forEach(b => {
  b.addEventListener("click", () => {
    const action = b.dataset.pdAction;
    dropdown.classList.remove("open");
    if (action === "profile") switchView("profile");
    else if (action === "my-channel") {
      // Buka user-profile view langsung (bypass guard di openUserProfile yang
      // redirect ke "profile" / edit-profil saat username match current user)
      if (user?.username) {
        state._viewingUser = user.username;
        switchView("user-profile");
      }
    }
    else if (action === "settings") switchView("settings");
    else if (action === "theme") {
      const cur = document.body.dataset.theme;
      $(`[data-theme-set='${cur === "dark" ? "light" : "dark"}']`)?.click();
    }
    else if (action === "switch") openSwitchAccount();
    else if (action === "logout") confirmLogout();
    else if (action === "deactivate") confirmDeactivate();
    else if (action === "delete") confirmDelete();
  });
});

// ----------------------- SWITCH ACCOUNT -----------------------
function openSwitchAccount() {
  renderSwitchAccountList();
  $("#switchAccountModal").classList.add("show");
}

function renderSwitchAccountList() {
  const list = $("#switchAccountList");
  if (!list) return;
  // PRIVASI: hanya tampilkan akun yang pernah login di DEVICE ini.
  // Akun user lain (yang ada di cloud) tidak boleh kelihatan.
  const deviceEmails = new Set(getDeviceAccountEmails());
  // Pastikan akun yang sedang login juga ke-track (defensif untuk session lama)
  if (user?.email) {
    addDeviceAccount(user.email);
    deviceEmails.add(String(user.email).toLowerCase());
  }
  const accounts = getAllAccounts()
    .filter(a => a.role !== "admin")
    .filter(a => deviceEmails.has(String(a.email || "").toLowerCase()));
  if (!accounts.length) {
    list.innerHTML = `<div class="switch-empty">Belum ada akun lain di perangkat ini.<br/>Klik <b>Tambah Akun Lain</b> di bawah.</div>`;
    return;
  }
  // Akun yang sedang login muncul paling atas dengan label "Aktif"
  accounts.sort((a, b) => {
    const aIsCur = a.email === user?.email;
    const bIsCur = b.email === user?.email;
    if (aIsCur) return -1;
    if (bIsCur) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });
  list.innerHTML = accounts.map(a => {
    const init = (a.name || a.username || "U").split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
    const isCurrent = a.email === user?.email;
    return `
      <div class="switch-item-wrap" style="position:relative">
        <button class="switch-item ${isCurrent ? "current" : ""}" data-switch-email="${escapeHtml(a.email)}" ${isCurrent ? "disabled" : ""}>
          <div class="avatar"><span>${init}</span></div>
          <div class="si-info">
            <strong>${escapeHtml(a.name || a.username)}</strong>
            <small>@${escapeHtml(a.username)} • ${escapeHtml(a.email)}</small>
          </div>
          <span class="si-badge">${isCurrent ? "Aktif" : "Pakai"}</span>
        </button>
        ${isCurrent ? "" : `<button class="switch-remove" data-remove-email="${escapeHtml(a.email)}" title="Hapus dari daftar perangkat ini" aria-label="Hapus dari daftar" style="position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,0.4);border:1px solid var(--border);color:var(--muted);cursor:pointer;display:grid;place-items:center;font-size:14px;line-height:1;padding:0;z-index:2">×</button>`}
      </div>
    `;
  }).join("");
  $$("[data-switch-email]", list).forEach(b => {
    if (b.disabled) return;
    b.addEventListener("click", () => doSwitchAccount(b.dataset.switchEmail));
  });
  $$("[data-remove-email]", list).forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const email = b.dataset.removeEmail;
      openConfirm({
        icon: "🚪", iconClass: "warn",
        title: "Hapus dari daftar perangkat?",
        desc: `Akun <b>${escapeHtml(email)}</b> akan hilang dari daftar "Pindah Akun" di perangkat ini.<br><br><small style="color:var(--muted)">Akun aslinya tidak terhapus — kamu masih bisa login dengan email + password seperti biasa.</small>`,
        btnText: "Hapus dari Daftar", btnClass: "warn",
        onConfirm: () => {
          removeDeviceAccount(email);
          renderSwitchAccountList();
          toast(`✓ <b>${escapeHtml(email)}</b> dihapus dari daftar perangkat`, "success");
        }
      });
    });
  });
}

function doSwitchAccount(email) {
  const acc = JSON.parse(localStorage.getItem(`playly-account-${email}`) || "null");
  if (!acc) return toast("❌ Akun tidak ditemukan", "error");
  // Simpan state user lama dulu
  saveState();
  // Pindah ke akun baru
  user = {
    name: acc.name, username: acc.username, email: acc.email,
    role: isAllowedAdminEmail(acc.email) ? "admin" : "user",
    joinedAt: acc.joinedAt, bio: acc.bio,
    avatar: acc.avatar, provider: acc.provider
  };
  localStorage.setItem("playly-user", JSON.stringify(user));
  state = loadState(user.username);
  $("#switchAccountModal").classList.remove("show");
  // Refresh seluruh UI
  applyUserToUI();
  applyRoleToUI();
  renderAll();
  switchView(user.role === "admin" ? "admin-dashboard" : "home");
  toast(`✓ Pindah ke akun <b>${escapeHtml(user.name)}</b>`, "success");
}

$("#switchAddNew")?.addEventListener("click", () => {
  $("#switchAccountModal").classList.remove("show");
  // Sama seperti logout, tapi tanpa konfirmasi modal — langsung kembali ke layar login
  saveState();
  stopLiveClock();
  stopAdminLiveRefresh();
  localStorage.removeItem("playly-user");
  user = null;
  state = null;
  delete document.body.dataset.role;
  pickedRole = "user";
  $$("[data-role-set]").forEach(x => x.classList.toggle("active", x.dataset.roleSet === "user"));
  showAuth();
  $$(".auth-form").forEach(f => f.reset());
  switchAuthTab("signin");
  toast("Silakan login dengan akun lain", "info");
});

// ----------------------- CONFIRM MODAL -----------------------
const confirmModal = $("#confirmModal");
const confirmYes = $("#confirmYes");
const confirmInput = $("#confirmInput");
const confirmInputWrap = $("#confirmInputWrap");

function openConfirm({ icon, iconClass, title, desc, btnText, btnClass = "primary", typeText = null, onConfirm }) {
  $("#confirmIcon").textContent = icon;
  $("#confirmIcon").className = "confirm-icon " + (iconClass || "");
  $("#confirmTitle").textContent = title;
  $("#confirmDesc").innerHTML = desc;
  confirmYes.textContent = btnText;
  confirmYes.className = "btn " + btnClass;
  // Alert mode mungkin habis disembunyikan — pastikan tombol Batal kembali tampil
  const cancelBtn = $("#confirmCancel");
  if (cancelBtn) cancelBtn.hidden = false;
  if (typeText) {
    confirmInputWrap.hidden = false;
    $("#confirmTypeText").textContent = typeText;
    confirmInput.value = ""; confirmInput.placeholder = typeText;
    confirmYes.disabled = true;
    confirmInput.oninput = () => { confirmYes.disabled = confirmInput.value.trim() !== typeText; };
  } else {
    confirmInputWrap.hidden = true;
    confirmYes.disabled = false;
  }
  confirmYes.onclick = () => { confirmModal.classList.remove("show"); onConfirm(); };
  confirmModal.classList.add("show");
}

// Popup notifikasi 1-tombol (alert) — pakai modal yang sama, tombol Batal disembunyikan.
function openAlert({ icon = "ℹ️", iconClass = "info", title, desc, btnText = "Mengerti", btnClass = "primary", onClose }) {
  $("#confirmIcon").textContent = icon;
  $("#confirmIcon").className = "confirm-icon " + (iconClass || "");
  $("#confirmTitle").textContent = title;
  $("#confirmDesc").innerHTML = desc;
  confirmYes.textContent = btnText;
  confirmYes.className = "btn " + btnClass;
  confirmInputWrap.hidden = true;
  confirmYes.disabled = false;
  const cancelBtn = $("#confirmCancel");
  if (cancelBtn) cancelBtn.hidden = true;
  confirmYes.onclick = () => {
    confirmModal.classList.remove("show");
    if (cancelBtn) cancelBtn.hidden = false;
    if (typeof onClose === "function") onClose();
  };
  confirmModal.classList.add("show");
}

// ----------------------- LOGOUT / DEACTIVATE / DELETE -----------------------
function doLogout() {
  stopLiveClock();
  stopAdminLiveRefresh();
  localStorage.removeItem("playly-user");
  user = null;
  state = null;
  delete document.body.dataset.role;
  pickedRole = "user";
  $$("[data-role-set]").forEach(x => x.classList.toggle("active", x.dataset.roleSet === "user"));
  showAuth();
  // Reset auth forms
  $$(".auth-form").forEach(f => f.reset());
  switchAuthTab("signin");
}

function confirmLogout() {
  openConfirm({
    icon: "🚪", iconClass: "warn", title: "Logout dari Playly?",
    desc: `Kamu akan keluar dari akun <b>@${user.username}</b>. Data tersimpan dan bisa diakses kembali setelah login.`,
    btnText: "🚪 Logout", btnClass: "warn",
    onConfirm: () => showFullOverlay({
      icon: "👋", title: `Sampai jumpa, ${user.name.split(" ")[0]}!`, desc: "Logging out...",
      duration: 1600, onClose: () => { doLogout(); toast("✓ Berhasil logout.", "success"); }
    })
  });
}

function confirmDeactivate() {
  openConfirm({
    icon: "⏸️", iconClass: "warn", title: "Nonaktifkan Akun?",
    desc: "Profil & video kamu akan <b>disembunyikan sementara</b>. Bisa diaktifkan lagi dengan login ulang. Data tidak akan dihapus.",
    btnText: "⏸️ Nonaktifkan", btnClass: "warn",
    onConfirm: () => showFullOverlay({
      icon: "⏸️", title: "Akun dinonaktifkan", desc: "Login kembali untuk mengaktifkan akun.",
      duration: 2000, onClose: () => { doLogout(); toast("⏸️ Akun dinonaktifkan.", "warning"); }
    })
  });
}

function confirmDelete() {
  openConfirm({
    icon: "🗑️", iconClass: "danger", title: "Hapus Akun Permanen?",
    desc: "<b style='color:var(--danger)'>Tindakan ini tidak bisa dibatalkan.</b><br>Semua video, komentar, dan data akan dihapus permanen.",
    btnText: "🗑️ Hapus Permanen", btnClass: "danger", typeText: "HAPUS AKUN",
    onConfirm: () => showFullOverlay({
      icon: "💔", title: "Akun dihapus", desc: `Selamat tinggal, ${user.name.split(" ")[0]}.`,
      duration: 2200, onClose: () => {
        localStorage.removeItem(`playly-account-${user.email}`);
        localStorage.removeItem(`playly-state-${user.username}`);
        localStorage.removeItem(`playly-welcomed-${user.username}`);
        doLogout();
        toast("🗑️ Akun berhasil dihapus.", "error");
      }
    })
  });
}

function showFullOverlay({ icon, title, desc, duration = 2000, onClose }) {
  $("#foIcon").textContent = icon;
  $("#foTitle").textContent = title;
  $("#foDesc").textContent = desc;
  const overlay = $("#fullOverlay");
  overlay.classList.add("show");
  setTimeout(() => { overlay.classList.remove("show"); onClose && onClose(); }, duration);
}

// ----------------------- HELP PANEL -----------------------
// Filter section berdasarkan role aktif (admin/user) + sembunyikan empty state.
function applyHelpRoleFilter() {
  const role = user?.role === "admin" ? "admin" : "user";
  $$(".help-section").forEach(sec => {
    if (sec.id === "helpEmpty") return;
    const target = sec.dataset.helpRole;
    if (!target || target === "all") { sec.style.display = ""; return; }
    sec.style.display = target === role ? "" : "none";
  });
  const empty = document.getElementById("helpEmpty");
  if (empty) empty.style.display = "none";
}

$("#openHelp")?.addEventListener("click", () => {
  const panel = $("#helpPanel");
  const willOpen = !panel.classList.contains("open");
  panel.classList.toggle("open");
  if (willOpen) {
    // Reset state tiap kali panel dibuka — clear search + restore visibility per role.
    const searchInput = $("#helpSearch");
    if (searchInput) searchInput.value = "";
    $$(".help-section .faq").forEach(f => f.style.display = "");
    applyHelpRoleFilter();
  }
});

$("#helpSearch")?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase().trim();
  const role = user?.role === "admin" ? "admin" : "user";
  let visibleCount = 0;
  $$(".help-section").forEach(sec => {
    if (sec.id === "helpEmpty") return;
    const target = sec.dataset.helpRole;
    const roleMatch = !target || target === "all" || target === role;
    if (!roleMatch) { sec.style.display = "none"; return; }
    if (!q) { sec.style.display = ""; $$(".faq", sec).forEach(f => f.style.display = ""); visibleCount++; return; }
    const matchHeading = sec.querySelector("h4")?.textContent.toLowerCase().includes(q);
    const faqs = $$(".faq", sec);
    let any = false;
    faqs.forEach(f => { const m = f.textContent.toLowerCase().includes(q); f.style.display = m ? "" : "none"; if (m) any = true; });
    const show = matchHeading || any || (!faqs.length && sec.textContent.toLowerCase().includes(q));
    sec.style.display = show ? "" : "none";
    if (show) visibleCount++;
  });
  const empty = document.getElementById("helpEmpty");
  if (empty) empty.style.display = q && visibleCount === 0 ? "" : "none";
});
// Help panel quick-actions — pakai event delegation supaya tidak bergantung
// timing binding (panel selalu ada di DOM, tapi handler kadang tidak match
// kalau script load sebelum render). `closest` cari card terdekat dari
// target klik (handle klik di icon/text di dalam card).
function closeHelpPanel() {
  $("#helpPanel")?.classList.remove("open");
}

// Bangun URL Gmail compose — bypass mailto: handler picker, langsung buka
// Gmail di browser (asumsi user sudah login Gmail).
function gmailComposeUrl({ to, subject, body }) {
  const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

// Modal pemilih admin untuk Live Chat. Tampilkan super admin + semua admin
// tambahan dari allowlist; klik salah satu → mulai chat dengan akun tsb.
function openLiveChatPicker() {
  const admins = getAllAccounts().filter(a => isAllowedAdminEmail(a.email));
  if (admins.length === 0) {
    toast("⚠️ Belum ada admin terdaftar", "warning");
    return;
  }
  // Super admin di atas, admin tambahan urut tanggal join.
  admins.sort((a, b) => {
    const aSup = isOfficialAdminEmail(a.email), bSup = isOfficialAdminEmail(b.email);
    if (aSup && !bSup) return -1;
    if (!aSup && bSup) return 1;
    return (a.joinedAt || "").localeCompare(b.joinedAt || "");
  });

  const modal = document.createElement("div");
  modal.className = "modal show lcp-modal";
  modal.style.cssText = "z-index:9999";
  const itemsHtml = admins.map(a => {
    const isSelf = user && a.username === user.username;
    const isSuper = isOfficialAdminEmail(a.email);
    const init = (a.name || a.username).split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
    const tag = isSuper
      ? `<span style="font-size:9px; padding:2px 7px; background:linear-gradient(90deg,#6D2932,#C7B7A3); color:#fff; border-radius:4px; font-weight:700">SUPER</span>`
      : `<span style="font-size:9px; padding:2px 7px; background:rgba(199,183,163,0.18); color:var(--muted); border-radius:4px; font-weight:700">ADMIN</span>`;
    const avatar = a.avatar
      ? `<img src="${escapeHtml(a.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`
      : `<span>${escapeHtml(init)}</span>`;
    return `
      <button class="lcp-item" data-lcp-username="${escapeHtml(a.username)}" ${isSelf ? "disabled" : ""} style="display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;background:transparent;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;cursor:${isSelf ? "not-allowed" : "pointer"};opacity:${isSelf ? "0.45" : "1"};text-align:left;color:var(--text);transition:background .15s">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:700;flex-shrink:0;overflow:hidden">${avatar}</div>
        <div style="flex:1;min-width:0">
          <strong style="display:flex;align-items:center;gap:6px;font-size:14px">${escapeHtml(a.name || a.username)} ${tag}</strong>
          <small style="color:var(--muted);font-size:12px">@${escapeHtml(a.username)}${isSelf ? " (kamu)" : ""}</small>
        </div>
      </button>
    `;
  }).join("");

  modal.innerHTML = `
    <div class="modal-backdrop" data-lcp-close></div>
    <div class="modal-panel" style="max-width:440px;padding:22px">
      <button class="modal-close" data-lcp-close>✕</button>
      <h3 style="margin:0 0 6px;display:flex;align-items:center;gap:8px">💬 Live Chat dengan Admin</h3>
      <p class="muted" style="margin:0 0 16px;font-size:13px">Pilih admin yang ingin kamu hubungi. Pesan dikirim langsung lewat in-app messaging.</p>
      <div class="lcp-list" style="max-height:60vh;overflow-y:auto">${itemsHtml}</div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", ev => {
    if (ev.target.closest("[data-lcp-close]")) { modal.remove(); return; }
    const item = ev.target.closest("[data-lcp-username]");
    if (!item || item.disabled) return;
    const username = item.dataset.lcpUsername;
    modal.remove();
    closeHelpPanel();
    if (typeof startChatWithUser === "function") {
      startChatWithUser(username);
    } else {
      switchView("messages");
    }
  });
}

// ----------------------- IN-APP SUPPORT COMPOSE -----------------------
// Pesan dari user (Email Support / Lapor Bug) langsung disimpan ke
// localStorage admin (playly-admin-tickets / playly-admin-bugs) supaya
// admin bisa lihat di sidebar Support Tickets / Bug Reports — bukan kirim
// ke Gmail eksternal yang tidak bisa di-akses dari dashboard.
function openSupportCompose({ type, subjectDefault, bodyDefault, title, desc, icon }) {
  const modal = $("#supportComposeModal");
  const form = $("#supportComposeForm");
  if (!modal || !form) return;
  form.reset();
  clearFieldErrors(form);
  form.querySelector('[name="type"]').value = type;
  form.querySelector('[name="subject"]').value = subjectDefault || "";
  form.querySelector('[name="body"]').value = bodyDefault || "";
  $("#supportComposeTitle").textContent = title || "Hubungi Super Admin";
  $("#supportComposeDesc").textContent = desc || "Pesanmu akan langsung masuk ke Inbox admin Playly.";
  $("#supportComposeIcon").textContent = icon || "📧";
  modal.classList.add("show");
  setTimeout(() => form.querySelector('[name="subject"]').focus(), 100);
}
function closeSupportCompose() {
  $("#supportComposeModal")?.classList.remove("show");
}

// Tombol close di modal compose
$("#supportComposeModal")?.addEventListener("click", e => {
  if (e.target.matches("[data-close]")) closeSupportCompose();
});

// Submit handler — simpan ke admin data
$("#supportComposeForm")?.addEventListener("submit", e => {
  e.preventDefault();
  const form = e.target;
  clearFieldErrors(form);
  const fd = new FormData(form);
  const type = String(fd.get("type") || "email");
  const subject = String(fd.get("subject") || "").trim();
  const body = String(fd.get("body") || "").trim();

  let hasError = false;
  if (!subject) { showFieldError(form, "subject", "Subjek wajib diisi"); hasError = true; }
  if (!body) { showFieldError(form, "body", "Pesan wajib diisi"); hasError = true; }
  else if (body.length < 10) { showFieldError(form, "body", "Pesan minimal 10 karakter"); hasError = true; }
  if (hasError) return;

  const fromName = user?.name || user?.username || "Anonymous";
  const fromUsername = user?.username || "anonymous";
  const fromEmail = user?.email || "—";
  const fromLabel = `${fromName} (@${fromUsername})`;

  if (type === "bug") {
    const bugs = getAdminData("bugs");
    bugs.unshift({
      id: Date.now() + Math.random(),
      title: subject,
      desc: body,
      sev: "medium",
      status: "open",
      reporter: fromLabel,
      reporterEmail: fromEmail,
      browser: (navigator.userAgent || "").slice(0, 80),
      page: location.href,
      createdAt: Date.now()
    });
    saveAdminData("bugs", bugs);
    pushAdminEvent("🐛", `Bug report baru dari <b>${fromLabel}</b>`);
    toast("🐛 Laporan bug terkirim ke Inbox admin", "success");
  } else {
    const tickets = getAdminData("tickets");
    tickets.unshift({
      id: Date.now() + Math.random(),
      ch: type === "email" ? "📧" : "💬",
      title: subject,
      body,
      from: fromLabel,
      fromEmail,
      type,
      status: "new",
      priority: "normal",
      createdAt: Date.now()
    });
    saveAdminData("tickets", tickets);
    pushAdminEvent("📧", `Pesan baru di Inbox dari <b>${fromLabel}</b>`);
    toast("📧 Pesan terkirim ke Inbox admin", "success");
  }

  closeSupportCompose();
  closeHelpPanel();
});

document.addEventListener("click", (e) => {
  const card = e.target.closest("#emailSupport, #contactChat, #reportBug");
  if (!card) return;
  e.preventDefault();
  e.stopPropagation();
  if (!user) { toast("⚠️ Login dulu untuk hubungi admin", "warning"); return; }
  const fromName = user?.name || user?.username || "User";
  const username = user?.username || "anonymous";

  if (card.id === "emailSupport") {
    openSupportCompose({
      type: "email",
      icon: "📧",
      title: "Hubungi Super Admin",
      desc: "Pesanmu akan langsung masuk ke Inbox admin Playly.",
      subjectDefault: `Bantuan dari ${fromName}`,
      bodyDefault: `Halo Super Admin,\n\nSaya ${fromName} (@${username}) butuh bantuan terkait:\n\n[Tulis pertanyaan/keluhan di sini]\n\nTerima kasih.`
    });
    return;
  }

  if (card.id === "contactChat") {
    openLiveChatPicker();
    return;
  }

  if (card.id === "reportBug") {
    openSupportCompose({
      type: "bug",
      icon: "🐛",
      title: "Lapor Bug ke Admin",
      desc: "Laporan bug-mu masuk ke Inbox admin Playly.",
      subjectDefault: `Bug: `,
      bodyDefault: `Halo Super Admin,\n\nSaya menemukan bug:\n\n📍 Halaman: ${location.pathname}\n🐛 Deskripsi: [Jelaskan bug-nya]\n🔁 Cara reproduksi: [Langkah-langkahnya]\n\nTerima kasih.`
    });
    return;
  }
});

// ============================================================
// =================== ENTRY POINT ============================
// ============================================================

// Auto-boot dari session yang tersimpan (`playly-user`) supaya reload tidak
// melempar user balik ke halaman login. Tetap aman karena:
//   1. Akun harus masih ada di localStorage — kalau di-hapus, kick ke login.
//   2. URL mode harus cocok: session admin cuma auto-boot di `/admin`,
//      session user cuma auto-boot di `/`. Mencegah session-leak antar URL.
//   3. Role di-rebuild dari allowlist admin — bukan dari `playly-user` raw —
//      jadi manipulasi localStorage tidak bisa promote user → admin.
function tryAutoBoot() {
  const saved = loadUser();
  if (!saved?.email) return false;
  const acc = JSON.parse(localStorage.getItem(`playly-account-${saved.email}`) || "null");
  // Defensive: kalau cloud sync belum selesai propagate `playly-account-...`
  // (mis. user reload di network lambat), pakai data dari `playly-user` sebagai
  // fallback. Tidak langsung kick ke login screen — selama session marker masih
  // ada, anggap user masih login. Cloud sync akan re-populate account data
  // begitu sampai. Bekas akun yang BENAR-BENAR dihapus akan ke-clear via
  // doLogout() saat admin pakai fitur Hapus Akun.
  const accountData = acc || saved;
  if (acc?.suspended) return false; // akun di-suspend → kick
  const isAdminAcc = isAllowedAdminEmail(accountData.email);
  // Admin di URL non-admin (mis. `/`) → tetap di-kick supaya UI admin tidak
  // bocor di view user. User biasa di `/admin` → tidak di-kick lagi (UI auto
  // jadi user view karena role dihitung dari allowlist email).
  if (isAdminAcc && pickedRole !== "admin") return false;
  user = {
    name: accountData.name,
    username: accountData.username,
    email: accountData.email,
    role: isAdminAcc ? "admin" : "user",
    joinedAt: accountData.joinedAt,
    bio: accountData.bio,
    avatar: accountData.avatar,
    provider: accountData.provider
  };
  state = loadState(user.username);
  return true;
}

if (tryAutoBoot()) {
  bootDashboard();
} else {
  localStorage.removeItem("playly-user");
  user = null;
  state = defaultState();
  showAuth();
}

/* ============================================================
   SCROLL REVEAL — fade + slide-up element saat masuk viewport.
   Daftarin element yang mau di-reveal pakai class .reveal-on-scroll;
   observer otomatis nambah .reveal-in begitu intersecting.
   Re-scan tiap kali switch view supaya konten dynamic kena juga.
   ============================================================ */
(function scrollRevealInit() {
  if (typeof IntersectionObserver === "undefined") return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("reveal-in");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

  const scan = () => {
    document.querySelectorAll(".reveal-on-scroll:not(.reveal-in)").forEach(el => io.observe(el));
  };

  // Auto-tag candidate elements yang besar & sering muncul di view scrollable.
  // Lebih aman daripada manual edit HTML — element dynamic (rendered by JS)
  // ikut ke-tag begitu DOM stabil.
  const autoTag = () => {
    const selectors = [
      ".home-stats", ".trending-card:not(.ds-bento-card)",
      ".up-section", ".video-grid",
      ".rev-stream-grid", ".activity-list.large"
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.classList.contains("reveal-on-scroll") && !el.classList.contains("reveal-in")) {
          el.classList.add("reveal-on-scroll");
        }
      });
    });
    scan();
  };

  // Initial scan setelah DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoTag, { once: true });
  } else {
    autoTag();
  }
  // Re-scan saat user pindah view (konten dynamic baru muncul)
  window.addEventListener("playly:view-changed", autoTag);
})();

/* ============================================================
   DREAMS FX — Star/particle field canvas.
   Hidup hanya saat body.dreams-on aktif (yaitu di view "home"
   atau "admin-dashboard"); langsung berhenti & clear saat
   user navigate ke view lain biar nggak buang CPU.
   Warna partikel ngambil dari CSS var --accent (dark) /
   --primary (light) supaya selalu match tema yang dipilih user.
   ============================================================ */
(function dreamsFxInit() {
  const canvas = document.getElementById("dreamsStars");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let particles = [];
  let rafId = null;
  let running = false;

  function hexToRgb(hex) {
    const s = (hex || "").trim().replace(/^#/, "");
    if (s.length === 3) {
      return [parseInt(s[0]+s[0],16), parseInt(s[1]+s[1],16), parseInt(s[2]+s[2],16)];
    }
    const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(s);
    if (!m) return [199, 183, 163]; // fallback: cream
    return [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)];
  }

  function getStarColor() {
    const cs = getComputedStyle(document.body);
    const theme = document.body.dataset.theme === "light" ? "light" : "dark";
    // Dark: pakai cream accent biar partikel pop di latar wine-black.
    // Light: pakai wine primary biar lembut & tetap kebaca di latar krem.
    const v = (theme === "light" ? cs.getPropertyValue("--primary") : cs.getPropertyValue("--accent")) || "";
    return v.trim() || (theme === "light" ? "#6D2932" : "#C7B7A3");
  }
  let starRgb = hexToRgb(getStarColor());

  function makeParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.4 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.06,
      vy: (Math.random() - 0.5) * 0.06,
      a: 0.15 + Math.random() * 0.55,
      ts: 0.4 + Math.random() * 1.6,
      tp: Math.random() * Math.PI * 2,
    };
  }

  function spawn() {
    // density target: ~1 partikel per ~9000px², clamped 60–140
    const target = Math.max(60, Math.min(140, Math.floor((W * H) / 9000)));
    particles = new Array(target).fill(0).map(makeParticle);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    spawn();
  }

  let lastT = 0;
  function frame(t) {
    if (!running) { rafId = null; return; }
    const dt = Math.min(64, t - lastT) / 16.6;
    lastT = t;
    ctx.clearRect(0, 0, W, H);
    const [r, g, b] = starRgb;
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.tp += 0.02 * p.ts * dt;
      if (p.x < -4) p.x = W + 4; else if (p.x > W + 4) p.x = -4;
      if (p.y < -4) p.y = H + 4; else if (p.y > H + 4) p.y = -4;
      const tw = 0.55 + 0.45 * Math.sin(p.tp);
      const alpha = p.a * tw;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.r > 1.4) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${r},${g},${b},${(alpha * 0.18).toFixed(3)})`;
        ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    ctx.clearRect(0, 0, W, H);
  }

  function sync() {
    const on = document.body.classList.contains("dreams-on")
      && !document.body.classList.contains("reduced-motion")
      && !document.hidden;
    if (on) {
      if (W === 0 || H === 0) resize();
      start();
    } else {
      stop();
    }
  }

  const mo = new MutationObserver(muts => {
    let needRecolor = false, needSync = false;
    for (const m of muts) {
      if (m.attributeName === "class") needSync = true;
      if (m.attributeName === "data-theme") { needRecolor = true; needSync = true; }
    }
    if (needRecolor) starRgb = hexToRgb(getStarColor());
    if (needSync) sync();
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme"] });

  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (running) resize(); }, 120);
  });

  document.addEventListener("visibilitychange", sync);

  // Initial sync (bootDashboard sudah panggil switchView yang nge-toggle dreams-on)
  setTimeout(sync, 0);
})();

/* ============================================================
   CARD DETAIL POPUP — admin dashboard
   Klik KPI card / hc-update item → buka modal dengan data
   real (5-10 item terbaru/teratas) + tombol navigate ke
   halaman manajemen lengkap. Empty state kalau belum ada data.
   ============================================================ */
(function cardDetailPopup() {
  const modal = document.getElementById("cardDetailModal");
  if (!modal) return;
  const $cd = sel => modal.querySelector(sel);
  const cdTitle = $cd("#cdTitle");
  const cdSubtitle = $cd("#cdSubtitle");
  const cdIcon = $cd("#cdIcon");
  const cdStat = $cd("#cdStat");
  const cdStatValue = $cd("#cdStatValue");
  const cdStatLabel = $cd("#cdStatLabel");
  const cdBody = $cd("#cdBody");
  const cdFoot = $cd("#cdFoot");

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }
  function rel(ts) {
    if (typeof relTime === "function" && ts) return relTime(ts);
    if (!ts) return "—";
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return "baru saja";
    if (d < 3600) return Math.floor(d/60) + " menit lalu";
    if (d < 86400) return Math.floor(d/3600) + " jam lalu";
    return Math.floor(d/86400) + " hari lalu";
  }
  function num(n) {
    return typeof fmtNum === "function" ? fmtNum(n) : String(n);
  }
  function avatarHtml(account) {
    if (account?.avatar) return `<img src="${esc(account.avatar)}" alt=""/>`;
    const init = (account?.name || account?.username || "?").slice(0, 2).toUpperCase();
    return `<span>${esc(init)}</span>`;
  }
  function thumbHtml(video) {
    if (video?.thumbnail) return `<img src="${esc(video.thumbnail)}" alt=""/>`;
    return `<span>🎬</span>`;
  }
  function emptyHtml(icon, msg) {
    return `<div class="cd-empty"><div class="cd-empty-icon">${icon}</div><p>${esc(msg)}</p></div>`;
  }

  // ---------- DATA HELPERS (defensive) ----------
  function safeAccounts() {
    try { return typeof getAllAccounts === "function" ? getAllAccounts().filter(a => a.role !== "admin") : []; }
    catch { return []; }
  }
  function safeVideos() {
    try { return typeof getPlatformVideos === "function" ? getPlatformVideos() : []; }
    catch { return []; }
  }
  function safeUnreadMessages() {
    // Pesan masuk dari user (from !== 'me') yang belum dibalas — pakai state.messages.
    try {
      const oneDayAgo = Date.now() - 86400000;
      const threads = Array.isArray(state?.messages) ? state.messages : [];
      const out = [];
      for (const t of threads) {
        const history = Array.isArray(t.history) ? t.history : [];
        for (const h of history) {
          if (!h || h.from === "me") continue;
          if (typeof h.ts !== "number" || h.ts < oneDayAgo) continue;
          out.push({ thread: t, msg: h });
        }
      }
      return out.sort((a, b) => b.msg.ts - a.msg.ts);
    } catch { return []; }
  }

  // ---------- RENDERERS ----------
  const RENDERERS = {
    "kpi-users": () => {
      const accts = safeAccounts().sort((a,b) => {
        const ta = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
        const tb = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
        return tb - ta;
      });
      const total = accts.length;
      const newest = accts.slice(0, 8);
      cdIcon.textContent = "👥";
      cdTitle.textContent = "Total Users";
      cdSubtitle.textContent = "User terbaru di platform";
      cdStat.hidden = false;
      cdStatValue.textContent = num(total);
      cdStatLabel.textContent = "user";
      cdBody.innerHTML = newest.length === 0
        ? emptyHtml("👤", "Belum ada user yang signup.")
        : `<div class="cd-section"><div class="cd-section-head"><h4>${newest.length} User Terbaru</h4><span class="cd-section-meta">dari ${num(total)} total</span></div><div class="cd-list">${newest.map(a => `
          <button type="button" class="cd-list-item" data-popup-jump-user="${esc(a.username)}">
            <div class="cd-li-avatar">${avatarHtml(a)}</div>
            <div class="cd-li-text">
              <strong>${esc(a.name || a.username)}</strong>
              <small>@${esc(a.username)}${a.bio ? " · " + esc(a.bio).slice(0, 40) : ""}</small>
            </div>
            <div class="cd-li-meta">${esc(rel(a.joinedAt ? new Date(a.joinedAt).getTime() : 0))}</div>
          </button>`).join("")}</div></div>`;
      cdFoot.innerHTML = `<button type="button" class="btn ghost" data-close>Tutup</button><button type="button" class="btn primary" data-popup-jump="admin-users">Buka User Management</button>`;
    },

    "kpi-videos": () => {
      const vids = safeVideos().slice().sort((a,b) => (b.id||0) - (a.id||0));
      const total = vids.length;
      const newest = vids.slice(0, 6);
      cdIcon.textContent = "🎬";
      cdTitle.textContent = "Total Videos";
      cdSubtitle.textContent = "Video terbaru di platform";
      cdStat.hidden = false;
      cdStatValue.textContent = num(total);
      cdStatLabel.textContent = "video";
      cdBody.innerHTML = newest.length === 0
        ? emptyHtml("🎥", "Belum ada video yang di-upload.")
        : `<div class="cd-section"><div class="cd-section-head"><h4>${newest.length} Video Terbaru</h4><span class="cd-section-meta">dari ${num(total)} total</span></div><div class="cd-list">${newest.map(v => `
          <button type="button" class="cd-list-item" data-popup-jump-video="${esc(v.id)}">
            <div class="cd-li-thumb">${thumbHtml(v)}</div>
            <div class="cd-li-text">
              <strong>${esc(v.title || "(tanpa judul)")}</strong>
              <small>@${esc(v.creator || "—")} · ${num(v.viewsNum||0)} views · ${num(v.likes||0)} likes</small>
            </div>
            <div class="cd-li-meta">${esc(rel(typeof v.id === "number" ? v.id : 0))}</div>
          </button>`).join("")}</div></div>`;
      cdFoot.innerHTML = `<button type="button" class="btn ghost" data-close>Tutup</button><button type="button" class="btn primary" data-popup-jump="admin-videos">Buka Content Control</button>`;
    },

    "kpi-views": () => {
      const vids = safeVideos();
      const totalViews = vids.reduce((s,v) => s + (v.viewsNum||0), 0);
      const top = vids.slice().sort((a,b) => (b.viewsNum||0) - (a.viewsNum||0)).slice(0, 5);
      // Distribusi views per hari (7 hari terakhir) — deterministic dari id timestamp
      const buckets = new Array(7).fill(0);
      const labels = [];
      const today = new Date(); today.setHours(0,0,0,0);
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i*86400000);
        labels.push(["Min","Sen","Sel","Rab","Kam","Jum","Sab"][d.getDay()]);
      }
      const startWindow = today.getTime() - 6*86400000;
      vids.forEach(v => {
        const t = typeof v.id === "number" ? v.id : 0;
        if (t < startWindow) {
          buckets[6] += (v.viewsNum||0); // sebelum window → masuk hari ini sebagai akumulasi
          return;
        }
        const dayOffset = Math.floor((t - startWindow) / 86400000);
        const idx = Math.max(0, Math.min(6, dayOffset));
        buckets[idx] += (v.viewsNum||0);
      });
      const maxBar = Math.max(1, ...buckets);
      cdIcon.textContent = "👁️";
      cdTitle.textContent = "Total Views";
      cdSubtitle.textContent = "Distribusi 7 hari terakhir & top performers";
      cdStat.hidden = false;
      cdStatValue.textContent = num(totalViews);
      cdStatLabel.textContent = "views";
      const barsHtml = `<div class="cd-bars">${buckets.map((b,i) => `
        <div class="cd-bar" title="${esc(labels[i])} · ${num(b)} views">
          <div class="cd-bar-fill" style="height: ${Math.max(4, (b/maxBar)*70)}px"></div>
          <div class="cd-bar-label">${esc(labels[i])}</div>
        </div>`).join("")}</div>`;
      const topHtml = top.length === 0
        ? emptyHtml("📈", "Belum ada views terkumpul.")
        : `<div class="cd-list">${top.map((v, i) => `
          <button type="button" class="cd-list-item" data-popup-jump-video="${esc(v.id)}">
            <div class="cd-li-rank">${i+1}</div>
            <div class="cd-li-text">
              <strong>${esc(v.title || "(tanpa judul)")}</strong>
              <small>@${esc(v.creator || "—")}</small>
            </div>
            <div class="cd-li-meta">${num(v.viewsNum||0)}<small>views</small></div>
          </button>`).join("")}</div>`;
      cdBody.innerHTML = `
        <div class="cd-section">
          <div class="cd-section-head"><h4>7 Hari Terakhir</h4><span class="cd-section-meta">${num(buckets.reduce((a,b)=>a+b,0))} views</span></div>
          ${barsHtml}
        </div>
        <div class="cd-section">
          <div class="cd-section-head"><h4>Top Performers</h4><span class="cd-section-meta">${top.length}/${vids.length} video</span></div>
          ${topHtml}
        </div>`;
      cdFoot.innerHTML = `<button type="button" class="btn ghost" data-close>Tutup</button><button type="button" class="btn primary" data-popup-jump="admin-analytics">Buka Analytics</button>`;
    },

    "hc-users": () => {
      const oneDayAgo = Date.now() - 86400000;
      const accts = safeAccounts().filter(a => {
        const t = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
        return t >= oneDayAgo;
      }).sort((a,b) => (new Date(b.joinedAt).getTime()) - (new Date(a.joinedAt).getTime()));
      cdIcon.textContent = "👤";
      cdTitle.textContent = "User Baru — 24 Jam";
      cdSubtitle.textContent = "Akun yang signup dalam sehari terakhir";
      cdStat.hidden = false;
      cdStatValue.textContent = num(accts.length);
      cdStatLabel.textContent = "user";
      cdBody.innerHTML = accts.length === 0
        ? emptyHtml("🌱", "Belum ada user baru hari ini.")
        : `<div class="cd-list">${accts.map(a => `
          <button type="button" class="cd-list-item" data-popup-jump-user="${esc(a.username)}">
            <div class="cd-li-avatar">${avatarHtml(a)}</div>
            <div class="cd-li-text">
              <strong>${esc(a.name || a.username)}</strong>
              <small>@${esc(a.username)}</small>
            </div>
            <div class="cd-li-meta">${esc(rel(new Date(a.joinedAt).getTime()))}</div>
          </button>`).join("")}</div>`;
      cdFoot.innerHTML = `<button type="button" class="btn ghost" data-close>Tutup</button><button type="button" class="btn primary" data-popup-jump="admin-users">Buka User Management</button>`;
    },

    "hc-messages": () => {
      const items = safeUnreadMessages();
      cdIcon.textContent = "💬";
      cdTitle.textContent = "Pesan Baru — 24 Jam";
      cdSubtitle.textContent = "Pesan masuk dari user (belum dibalas/baru)";
      cdStat.hidden = false;
      cdStatValue.textContent = num(items.length);
      cdStatLabel.textContent = "pesan";
      cdBody.innerHTML = items.length === 0
        ? emptyHtml("📬", "Belum ada pesan baru.")
        : `<div class="cd-list">${items.slice(0, 12).map(({thread, msg}) => `
          <button type="button" class="cd-list-item" data-popup-jump-thread="${esc(thread.id || thread.username || "")}">
            <div class="cd-li-avatar">${thread.avatar ? `<img src="${esc(thread.avatar)}" alt=""/>` : `<span>${esc((thread.name||thread.username||"?").slice(0,2).toUpperCase())}</span>`}</div>
            <div class="cd-li-text">
              <strong>${esc(thread.name || thread.username || "User")}</strong>
              <small>${esc(String(msg.text || msg.body || "(tanpa teks)").slice(0, 60))}</small>
            </div>
            <div class="cd-li-meta">${esc(rel(msg.ts))}</div>
          </button>`).join("")}</div>`;
      cdFoot.innerHTML = `<button type="button" class="btn ghost" data-close>Tutup</button><button type="button" class="btn primary" data-popup-jump="admin-comms">Buka Conversation</button>`;
    },

    "hc-videos": () => {
      const oneDayAgo = Date.now() - 86400000;
      const vids = safeVideos().filter(v => {
        const t = typeof v.id === "number" ? v.id : 0;
        return t >= oneDayAgo;
      }).sort((a,b) => (b.id||0) - (a.id||0));
      cdIcon.textContent = "🎬";
      cdTitle.textContent = "Video Baru — 24 Jam";
      cdSubtitle.textContent = "Video yang baru di-upload dalam sehari terakhir";
      cdStat.hidden = false;
      cdStatValue.textContent = num(vids.length);
      cdStatLabel.textContent = "video";
      cdBody.innerHTML = vids.length === 0
        ? emptyHtml("📹", "Belum ada video baru hari ini.")
        : `<div class="cd-list">${vids.slice(0, 10).map(v => `
          <button type="button" class="cd-list-item" data-popup-jump-video="${esc(v.id)}">
            <div class="cd-li-thumb">${thumbHtml(v)}</div>
            <div class="cd-li-text">
              <strong>${esc(v.title || "(tanpa judul)")}</strong>
              <small>@${esc(v.creator || "—")} · ${num(v.viewsNum||0)} views</small>
            </div>
            <div class="cd-li-meta">${esc(rel(typeof v.id === "number" ? v.id : 0))}</div>
          </button>`).join("")}</div>`;
      cdFoot.innerHTML = `<button type="button" class="btn ghost" data-close>Tutup</button><button type="button" class="btn primary" data-popup-jump="admin-videos">Review Content</button>`;
    },
  };

  function open(type) {
    const r = RENDERERS[type];
    if (!r) return;
    // Reset state
    cdStat.hidden = true;
    r();
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }
  function close() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }

  // Global click handler — [data-popup] trigger
  document.addEventListener("click", e => {
    const trig = e.target.closest("[data-popup]");
    if (trig && modal.contains(trig) === false) {
      e.preventDefault();
      e.stopPropagation();
      open(trig.dataset.popup);
      return;
    }
    // Buttons inside modal
    if (!modal.contains(e.target)) return;
    const jumpView = e.target.closest("[data-popup-jump]");
    if (jumpView) {
      e.preventDefault();
      close();
      if (typeof switchView === "function") switchView(jumpView.dataset.popupJump);
      return;
    }
    const jumpUser = e.target.closest("[data-popup-jump-user]");
    if (jumpUser) {
      e.preventDefault();
      close();
      if (typeof openUserProfile === "function") openUserProfile(jumpUser.dataset.popupJumpUser);
      else if (typeof switchView === "function") switchView("admin-users");
      return;
    }
    const jumpVideo = e.target.closest("[data-popup-jump-video]");
    if (jumpVideo) {
      e.preventDefault();
      close();
      const id = parseInt(jumpVideo.dataset.popupJumpVideo, 10);
      if (typeof openPlayer === "function" && Number.isFinite(id)) openPlayer(id);
      else if (typeof switchView === "function") switchView("admin-videos");
      return;
    }
    const jumpThread = e.target.closest("[data-popup-jump-thread]");
    if (jumpThread) {
      e.preventDefault();
      close();
      if (typeof switchView === "function") switchView("admin-comms");
      return;
    }
  });

  // Keyboard support: Enter/Space pada elemen [data-popup] dengan role/tabindex
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const trig = e.target.closest?.("[data-popup][role='button'], [data-popup][tabindex]");
    if (trig) {
      e.preventDefault();
      open(trig.dataset.popup);
    }
    // Esc tutup modal
    if (e.key === "Escape" && modal.classList.contains("show")) close();
  });
})();