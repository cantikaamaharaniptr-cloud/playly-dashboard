/* =========================================================
 * Playly i18n shim — text-node-level live swap.
 *
 * HTML default = English. This module rebuilds Indonesian (and other)
 * variants by swapping known phrase pairs at runtime. Settings →
 * Language dropdown sets `playly:lang` in localStorage; every TextNode
 * under <body> is walked and matched against the dictionary.
 *
 * Limitations: this is a thin proxy, not a real i18n framework. Strings
 * inserted dynamically by script.js (e.g. modal content, dynamic feed)
 * may slip through. Re-run window.applyI18n(lang) after such injects.
 * ========================================================= */
(function () {
  "use strict";

  // Master dictionary: English → { id, ms, ja }.
  // Add entries gradually — only need pairs you want translated.
  const DICT = {
    // Sidebar groups
    "ADMIN PANEL":       { id: "PANEL ADMIN" },
    "ANALYTICS":         { id: "ANALITIK" },
    "OPERATIONS":        { id: "OPERASI" },
    "MAIN":              { id: "UTAMA" },
    "LIBRARY":           { id: "PERPUSTAKAAN" },
    "SOCIAL":            { id: "SOSIAL" },
    "OVERVIEW · KPI":    { id: "RINGKASAN · KPI" },
    "LIVE · REAL-TIME":  { id: "LANGSUNG · REAL-TIME" },
    "RECENT · TODAY":    { id: "TERBARU · HARI INI" },
    "RECENT · HARI INI": { id: "TERBARU · HARI INI" },
    "PERFORMANCE · LEADERBOARD": { id: "PERFORMA · LEADERBOARD" },

    // Sidebar items
    "Dashboard":         { id: "Dashboard" },
    "User Management":   { id: "Manajemen User" },
    "Content Control":   { id: "Kontrol Konten" },
    "Analytics & Monitoring": { id: "Analitik & Monitoring" },
    "Ad Manager":        { id: "Pengatur Iklan" },
    "Inbox":             { id: "Kotak Masuk" },
    "Audit Log":         { id: "Log Audit" },
    "Home":              { id: "Beranda" },
    "Discover":          { id: "Jelajah" },
    "My Library":        { id: "Pustaka Saya" },
    "Upload":            { id: "Unggah" },
    "History":           { id: "Riwayat" },
    "Stats":             { id: "Statistik" },
    "Search User":       { id: "Cari User" },
    "Activity":          { id: "Aktivitas" },
    "Messages":          { id: "Pesan" },

    // Common buttons
    "View all":          { id: "Lihat semua" },
    "Add":               { id: "Tambah" },
    "Save":              { id: "Simpan" },
    "Delete":            { id: "Hapus" },
    "Reset":             { id: "Reset" },
    "Detail":            { id: "Detail" },
    "Status":            { id: "Status" },
    "Close":             { id: "Tutup" },
    "Cancel":            { id: "Batal" },
    "Confirm":           { id: "Konfirmasi" },
    "Search":            { id: "Cari" },
    "Settings":          { id: "Pengaturan" },
    "Help":              { id: "Bantuan" },
    "Logout":            { id: "Keluar" },
    "Sign Out":          { id: "Keluar" },
    "Sign In":           { id: "Masuk" },
    "Sign Up":           { id: "Daftar" },
    "Back":              { id: "Kembali" },
    "Update Status":     { id: "Perbarui Status" },
    "Reply via Email":   { id: "Balas via Email" },
    "Open Chat":         { id: "Buka Chat" },
    "Click":             { id: "Klik" },
    "Sequential":        { id: "Berurutan" },
    "Random":            { id: "Acak" },
    "Active":            { id: "Aktif" },
    "Online":            { id: "Online" },

    // Page heads
    "Platform Settings":  { id: "Pengaturan Platform" },
    "Account Settings":   { id: "Pengaturan Akun" },
    "Admin Notifications":{ id: "Notifikasi Admin" },
    "Admin Security":     { id: "Keamanan Admin" },
    "Language & Region":  { id: "Bahasa & Region" },
    "Language & Notifications": { id: "Bahasa & Notifikasi" },
    "Platform Control":   { id: "Kontrol Platform" },
    "Bug Reports":        { id: "Laporan Bug" },
    "Email Support":      { id: "Dukungan Email" },
    "Live Chat":          { id: "Live Chat" },
    "Inbox Email":        { id: "Email Masuk" },
    "Newly Uploaded Videos": { id: "Video Baru di-upload" },
    "New Users":          { id: "User Baru" },
    "Top Creators":       { id: "Kreator Teratas" },
    "User Live Activity": { id: "Aktivitas User Langsung" },
    "Top Performing Videos":{ id: "Video Berperforma Tinggi" },
    "Total Users":        { id: "Total User" },
    "Total Videos":       { id: "Total Video" },
    "Views This Month":   { id: "View Bulan Ini" },
    "This Month":         { id: "Bulan Ini" },
    "Today":              { id: "Hari Ini" },
    "This Week":          { id: "Minggu Ini" },

    // Settings labels
    "Old Password":       { id: "Password Lama" },
    "New Password":       { id: "Password Baru" },
    "Initial Password":   { id: "Password Awal" },
    "Repeat new password":{ id: "Ulangi password baru" },
    "Change Admin Password": { id: "Ganti Password Admin" },
    "Create New Admin":   { id: "Buat Admin Baru" },
    "Create Admin":       { id: "Buat Admin" },
    "Full Name":          { id: "Nama Lengkap" },
    "Server Timezone":    { id: "Zona Waktu Server" },
    "Open registration":  { id: "Registrasi terbuka" },
    "Upload enabled":     { id: "Upload aktif" },
    "Comments enabled":   { id: "Komentar aktif" },
    "Audit log enabled":  { id: "Audit log aktif" },
    "Confirm destructive actions": { id: "Konfirmasi aksi destruktif" },
    "Auto-logout when idle": { id: "Auto-logout idle" },
    "Never":              { id: "Tidak pernah" },
    "Indonesian":         { id: "Indonesia" },
    "English":            { id: "Inggris" },
    "Malay":              { id: "Melayu" },
    "Language":           { id: "Bahasa" },
    "Bahasa":             { id: "Bahasa" },

    // Empty states
    "No live chat threads yet": { id: "Belum ada thread live chat" },
    "No bugs reported yet":     { id: "Belum ada bug yang dilaporkan" },
    "No incoming emails yet":   { id: "Belum ada pesan email masuk" },
    "No running text yet":      { id: "Belum ada running text" },
    "No banners yet":           { id: "Belum ada banner" },
    "No pre-roll ads yet":      { id: "Belum ada pre-roll" },
    "No bugs reported":         { id: "Tidak ada bug terlapor" },

    // Time
    "just now":           { id: "baru saja" },
    "hours ago":          { id: "jam lalu" },
    "days ago":           { id: "hari lalu" },
    "minutes ago":        { id: "menit lalu" },
    "seconds ago":        { id: "detik lalu" },
    "ROTATION":           { id: "ROTASI" },
    "Hello,":             { id: "Halo," },

    // Hero / chips
    "Active creators":    { id: "Kreator aktif" },
    "Monitoring active":  { id: "Monitoring aktif" },
    "Moderation active":  { id: "Moderasi aktif" },
    "Admin Login":        { id: "Login Admin" },
    "Forgot password":    { id: "Lupa password" },
    "Forgot Password":    { id: "Lupa Password" },
  };

  // Build reverse maps lazily.
  const reverseMaps = {};
  function getReverse(lang) {
    if (reverseMaps[lang]) return reverseMaps[lang];
    const m = new Map();
    for (const en in DICT) {
      const t = DICT[en][lang];
      if (t && t !== en) m.set(en, t);
    }
    reverseMaps[lang] = m;
    return m;
  }

  // Walk all text nodes under root, swap if matches.
  function walkAndSwap(root, fromLang, toLang) {
    if (toLang === "en") return restoreEn(root);
    const map = getReverse(toLang);
    if (!map.size) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (const node of nodes) {
      // Skip script/style/textarea content
      const p = node.parentNode;
      if (!p) continue;
      const tag = p.nodeName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") continue;
      const original = node.nodeValue;
      const trimmed = original && original.trim();
      if (!trimmed) continue;
      // Try whole-string match first
      if (map.has(trimmed)) {
        // Persist original for restore.
        if (!node.__playlyEn) node.__playlyEn = original;
        node.nodeValue = original.replace(trimmed, map.get(trimmed));
        continue;
      }
      // Else partial: replace each phrase if present
      let v = original;
      let changed = false;
      for (const [en, tr] of map.entries()) {
        if (v.includes(en)) { v = v.split(en).join(tr); changed = true; }
      }
      if (changed) {
        if (!node.__playlyEn) node.__playlyEn = original;
        node.nodeValue = v;
      }
    }

    // Also swap placeholder + title attributes (limited set)
    const inputs = root.querySelectorAll("[placeholder], [aria-label], [title]");
    inputs.forEach((el) => {
      ["placeholder", "aria-label", "title"].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (!v) return;
        const orig = el.dataset["i18nEn_" + attr] || v;
        let newV = orig;
        let touched = false;
        for (const [en, tr] of map.entries()) {
          if (newV.includes(en)) { newV = newV.split(en).join(tr); touched = true; }
        }
        if (touched) {
          if (!el.dataset["i18nEn_" + attr]) el.dataset["i18nEn_" + attr] = orig;
          el.setAttribute(attr, newV);
        }
      });
    });
  }

  function restoreEn(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (const node of nodes) {
      if (node.__playlyEn != null) {
        node.nodeValue = node.__playlyEn;
        node.__playlyEn = null;
      }
    }
    const inputs = root.querySelectorAll("[placeholder], [aria-label], [title]");
    inputs.forEach((el) => {
      ["placeholder", "aria-label", "title"].forEach((attr) => {
        const en = el.dataset["i18nEn_" + attr];
        if (en) {
          el.setAttribute(attr, en);
          delete el.dataset["i18nEn_" + attr];
        }
      });
    });
  }

  let currentLang = "en";

  function applyI18n(lang) {
    if (!lang) lang = "en";
    if (lang === currentLang) return;
    // Always restore to English first, then apply target.
    restoreEn(document.body);
    currentLang = "en";
    if (lang !== "en") {
      walkAndSwap(document.body, "en", lang);
      currentLang = lang;
    }
    document.documentElement.setAttribute("lang", lang);
    try { localStorage.setItem("playly:lang", lang); } catch (e) {}
  }

  // Boot: load saved preference, apply on DOMContentLoaded
  function boot() {
    let saved = "en";
    try { saved = localStorage.getItem("playly:lang") || "en"; } catch (e) {}
    if (saved !== "en") applyI18n(saved);
    // Wire to selectors with data-pref="lang"
    document.querySelectorAll('[data-pref="lang"]').forEach((sel) => {
      sel.value = saved;
      sel.addEventListener("change", () => applyI18n(sel.value));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Re-apply translations to newly-mounted nodes (script.js renders feed,
  // tickets, modals dynamically). Throttled via rAF to avoid layout thrash.
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending || currentLang === "en") return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      walkAndSwap(document.body, "en", currentLang);
    });
  });
  function startObserver() {
    if (!document.body) return setTimeout(startObserver, 50);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  startObserver();

  // Expose globally so script.js can re-trigger after dynamic injects
  window.applyI18n = applyI18n;
  window.getCurrentLang = () => currentLang;
})();
