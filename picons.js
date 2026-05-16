/* ============================================================
 *  picons.js — Playly minimalist monochrome icon system
 *  ------------------------------------------------------------
 *  Mengganti SEMUA emoji berwarna / "seperti animasi" di seluruh
 *  dashboard user (termasuk yang di-generate JS) menjadi ikon
 *  garis monochrome (currentColor) bergaya minimalis.
 *
 *  - Satu file, satu cache-bust, reversible (hapus 1 <script> = balik).
 *  - Hanya mengganti emoji yang ADA di PICON_MAP (whitelist) →
 *    blast radius terkendali, emoji asing dibiarkan apa adanya.
 *  - SKIP: input/textarea/contenteditable, <script>/<style>/<code>,
 *    konten user (judul video, chat, komentar), bendera bahasa,
 *    dan emoji wajah/reaksi (bukan chrome UI).
 *  - Dipicu saat load, saat `playly:view-changed`, dan via
 *    MutationObserver ringan ber-debounce (hanya proses node baru).
 * ============================================================ */
(function () {
  "use strict";
  if (window.__pIconsInit) return;
  window.__pIconsInit = true;

  /* ---------- 1. Library ikon garis (Lucide/Feather style) ---------- */
  // viewBox 0 0 24 24, stroke=currentColor, fill=none (kecuali dot).
  var P = {
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4M7 4h10M7 20h10"/>',
    message: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
    "bar-chart": '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    "trending-up": '<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
    "trending-down": '<path d="M3 7l6 6 4-4 8 8"/><path d="M17 17h4v-4"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M10 6l9-3v18l-9-3"/><path d="M14 9a4 4 0 0 1 0 6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    heart: '<path d="M12 20s-7-4.3-9.3-9A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 9.3 5C19 15.7 12 20 12 20Z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3"/><path d="M10 14h4M9 20h6M12 14v6"/>',
    medal: '<circle cx="12" cy="14" r="5"/><path d="M9 9 7 3M15 9l2-6M11 14l1-2 1 2-.5 2h-1Z"/>',
    star: '<path d="M12 3l2.6 5.4 5.9.9-4.3 4.1 1 5.9L12 16.6 6.8 19.3l1-5.9L3.5 9.3l5.9-.9Z"/>',
    hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 16.5a1.6 1.6 0 0 1 2.5-2L8 16"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.4 1 2.5h6c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 3Z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7M17 20a6 6 0 0 0-3-5"/>',
    crown: '<path d="M3 7l4 4 5-6 5 6 4-4-2 12H5Z"/><path d="M5 19h14"/>',
    gem: '<path d="M6 4h12l3 5-9 11L3 9Z"/><path d="M3 9h18M9 4 7 9l5 11M15 4l2 5-5 11"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2 2M14 9l2 2"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.6a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 5.7 7.4a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.6V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V7a1.7 1.7 0 0 0 1.6 1H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" transform="translate(0 1) scale(0.92) translate(1 0)"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="M14 6l4 4"/>',
    link: '<path d="M9 15l6-6"/><path d="M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
    "bell-off": '<path d="M9 4.5A6 6 0 0 1 18 9c0 3 .8 4.6 1.4 5.5M6 9c0 5-2 6-2 6h12M10 19a2 2 0 0 0 4 0"/><path d="M3 3l18 18"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6M18 6l2-2"/>',
    zap: '<path d="M13 2 4 14h7l-2 8 9-12h-7Z"/>',
    rocket: '<path d="M5 14c-1 1-1.5 4-1.5 4S6.5 17.5 7.5 16.5M14 5c4-2 7-1 7-1s1 3-1 7c-1.5 3-7 8-7 8l-3-3-3-3s5-5.5 7-8Z"/><circle cx="14.5" cy="9.5" r="1.5"/>',
    flame: '<path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c0-3 2-5 2-8Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18 2 2 0 0 0 1.6-3.2 2 2 0 0 1 1.6-3.2H17a4 4 0 0 0 4-4A9 9 0 0 0 12 3Z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="16" cy="11" r="1"/>',
    clipboard: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V4a3 3 0 0 1 6 0v1M9 5h6"/><path d="M9 11h6M9 15h4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    box: '<path d="M3 8 12 3l9 5v8l-9 5-9-5Z"/><path d="M3 8l9 5 9-5M12 13v10"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    rss: '<path d="M5 19a1 1 0 1 0 .01 0M4 11a9 9 0 0 1 9 9M4 5a15 15 0 0 1 15 15"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
    monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6M12 17v4"/>',
    smartphone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    laptop: '<rect x="5" y="5" width="14" height="11" rx="1"/><path d="M3 20h18"/>',
    "credit-card": '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
    dollar: '<path d="M12 3v18M16 7a4 4 0 0 0-4-3c-2.2 0-4 1.3-4 3.2 0 4.3 8 2.5 8 6.8 0 1.9-1.8 3.2-4 3.2a4 4 0 0 1-4-3"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.7 1.3A3.5 3.5 0 0 1 17 18Z"/>',
    "cloud-rain": '<path d="M7 15a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.7 1.3A3.5 3.5 0 0 1 17 15"/><path d="M8 18l-1 2M12 18l-1 3M16 18l-1 2"/>',
    snowflake: '<path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="M5 12l5 5 9-11"/>',
    "alert-triangle": '<path d="M12 4 2.5 20h19Z"/><path d="M12 10v5M12 18h.01"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    bug: '<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M9 5l2 2M15 5l-2 2M8 11H4M8 15H4M16 11h4M16 15h4M12 7V5"/>',
    gamepad: '<rect x="3" y="8" width="18" height="10" rx="4"/><path d="M8 11v4M6 13h4M15 12h.01M18 14h.01"/>',
    music: '<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 8l12 10M8 16 20 6"/>',
    camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l2-3h4l2 3"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
    moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4 12H1M23 12h-3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    "thumbs-up": '<path d="M8 11v9H4v-9Z"/><path d="M8 11l4-8a2 2 0 0 1 3 2l-1 5h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17 20H8"/>',
    "thumbs-down": '<path d="M8 13V4H4v9Z"/><path d="M8 13l4 8a2 2 0 0 0 3-2l-1-5h5a2 2 0 0 0 2-2.3l-1.2-6A2 2 0 0 0 17 4H8"/>',
    flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
    tag: '<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    bookmark: '<path d="M6 4h12v17l-6-4-6 4Z"/>',
    "id-card": '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 16a3.5 3.5 0 0 1 7 0M14 10h4M14 14h4"/>',
    github: '<path d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6 2.5 5 2.8 5 2.8a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.5 9.2c0 4.6 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V21"/>',
    "file-text": '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    book: '<path d="M5 4h11a2 2 0 0 1 2 2v15H7a2 2 0 0 0-2 2Z"/><path d="M18 6H7"/>',
    refresh: '<path d="M20 8a8 8 0 0 0-14-2L4 9M4 16a8 8 0 0 0 14 2l2-3"/><path d="M4 4v5h5M20 20v-5h-5"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    "skip-forward": '<path d="M6 5l10 7-10 7Z"/><path d="M18 5v14"/>',
    "skip-back": '<path d="M18 5 8 12l10 7Z"/><path d="M6 5v14"/>',
    play: '<path d="M7 5l12 7-12 7Z"/>',
    handshake: '<path d="m11 17 2 2a2 2 0 0 0 3-3l-4-4M9 11 7 9a2 2 0 0 0-3 3l5 5a2 2 0 0 0 3 0"/><path d="M3 12 8 7l4 2 4-4 5 5-3 3"/>',
    ticket: '<path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4Z"/><path d="M14 6v12"/>',
    leaf: '<path d="M5 19c0-8 6-14 15-14 0 9-6 15-15 14Z"/><path d="M5 19c4-6 7-8 11-9"/>',
    dot: '<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18v3H3zM12 9v11M12 9S10 4 7.5 5 9 9 12 9 16.5 6 16.5 5 12 9 12 9"/>',
    sparkles: '<path d="M12 4l1.5 4L18 9.5 13.5 11 12 15l-1.5-4L6 9.5 10.5 8Z"/><path d="M18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>',
    party: '<path d="M4 20l5-13 9 9Z"/><path d="M9 7l1-3M14 5l2-1M17 9l3-1M15 12l2 1"/>',
    pin: '<path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    save: '<path d="M5 4h11l3 3v13H5Z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    plane: '<path d="M10 3.5 21 12l-11 8.5 1.5-7L4 12l7.5-1.5Z"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M6 6c3 2 9 2 12 0M6 18c3-2 9-2 12 0"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/>',
    newspaper: '<path d="M4 5h13v15H5a1 1 0 0 1-1-1Z"/><path d="M17 8h3v10a2 2 0 0 1-2 2M7 9h7M7 13h7M7 17h5"/>',
    utensils: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M16 3c-2 1-3 3-3 6h3Zm0 0v18"/>',
    cookie: '<circle cx="12" cy="12" r="9"/><path d="M9 9h.01M15 10h.01M10 15h.01M15 15h.01M13 12h.01"/>',
    bank: '<path d="M3 9 12 4l9 5H3Z"/><path d="M5 9v8M9 9v8M15 9v8M19 9v8M3 20h18"/>',
    car: '<path d="M5 16 6.5 9h11L19 16M3 16h18v3h-2v-2H5v2H3Z"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>',
    graduation: '<path d="M2 9 12 5l10 4-10 4Z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v5"/>',
    paw: '<circle cx="8" cy="9" r="1.7"/><circle cx="16" cy="9" r="1.7"/><circle cx="5" cy="13" r="1.5"/><circle cx="19" cy="13" r="1.5"/><path d="M12 13c-3 0-5 2.2-5 4.3 0 1.6 1.4 2.2 3 1.6a6 6 0 0 1 4 0c1.6.6 3 0 3-1.6C17 15.2 15 13 12 13Z"/>',
    mask: '<path d="M4 6h16v5a8 8 0 0 1-16 0Z"/><path d="M4 8c-1.2 0-2 1.2-2 3M20 8c1.2 0 2 1.2 2 3"/><path d="M9 10h.01M15 10h.01"/><path d="M9.3 14a3.5 3.5 0 0 0 5.4 0"/>',
    infinity: '<path d="M6.5 8a4 4 0 1 0 0 8c2.5 0 4-2 5.5-4s3-4 5.5-4a4 4 0 1 1 0 8c-2.5 0-4-2-5.5-4S9 8 6.5 8Z"/>'
  };

  /* ---------- 2. Peta emoji → nama ikon ---------- */
  var M = {
    "🎬": "film", "🎥": "film", "🎞": "film", "🎦": "film", "📽": "film", "🎟": "ticket",
    "💬": "message", "🗨": "message", "🗯": "message", "💭": "message",
    "📊": "bar-chart", "📈": "trending-up", "📉": "trending-down",
    "📢": "megaphone", "📣": "megaphone",
    "👁": "eye", "👀": "eye",
    "❤": "heart", "♥": "heart", "💜": "heart", "💖": "heart", "💛": "heart", "💚": "heart",
    "💙": "heart", "🧡": "heart", "🤍": "heart", "🖤": "heart", "💗": "heart", "💓": "heart",
    "💞": "heart", "💕": "heart", "💔": "heart", "💌": "mail",
    "🏆": "trophy", "🥇": "medal", "🥈": "medal", "🥉": "medal", "🎖": "medal", "🏅": "medal",
    "⭐": "star", "🌟": "star", "✨": "sparkles", "💫": "star", "🌠": "star", "★": "star",
    "👋": "hand", "🙌": "hand", "👏": "hand", "🤚": "hand", "✋": "hand",
    "💡": "bulb",
    "📤": "upload", "⬆": "upload", "⏫": "upload", "🔼": "upload",
    "📥": "download", "⬇": "download", "⏬": "download", "🔽": "download",
    "👤": "user", "🙍": "user", "🙎": "user", "🧑": "user", "🙋": "user",
    "👥": "users", "👪": "users",
    "👑": "crown", "💎": "gem",
    "🔒": "lock", "🔐": "lock", "🔏": "lock",
    "🔓": "unlock", "🔑": "key", "🗝": "key",
    "🛡": "shield", "⚙": "settings", "🛠": "settings", "🔧": "settings", "🔨": "settings",
    "🗑": "trash", "🗳": "trash",
    "✏": "edit", "📝": "edit", "🖊": "edit", "🖋": "edit", "✒": "edit",
    "🔗": "link", "⛓": "link",
    "🔔": "bell", "🔕": "bell-off",
    "📅": "calendar", "📆": "calendar", "🗓": "calendar",
    "🕐": "clock", "🕑": "clock", "🕒": "clock", "🕓": "clock", "🕛": "clock",
    "⏰": "clock", "⏲": "clock", "⌚": "clock", "🕰": "clock",
    "⏱": "timer", "⏳": "timer", "⌛": "timer",
    "⚡": "zap", "🚀": "rocket", "🔥": "flame", "🎯": "target", "🎨": "palette",
    "📋": "clipboard", "📌": "pin", "📍": "pin",
    "📂": "folder", "📁": "folder", "🗂": "folder",
    "📦": "box", "📥📤": "box",
    "📧": "mail", "✉": "mail", "📨": "mail", "📩": "mail", "📬": "mail", "📭": "mail",
    "📪": "mail", "📫": "mail", "📮": "mail",
    "📡": "rss", "📶": "rss",
    "🌐": "globe", "🌍": "globe", "🌎": "globe", "🌏": "globe",
    "🔍": "search", "🔎": "search",
    "🏠": "home", "🏡": "home",
    "📺": "monitor", "🖥": "monitor",
    "📱": "smartphone", "📲": "smartphone",
    "💻": "laptop",
    "💳": "credit-card",
    "💰": "dollar", "💵": "dollar", "💴": "dollar", "💶": "dollar", "💷": "dollar",
    "💸": "dollar", "🤑": "dollar", "🪙": "dollar",
    "☁": "cloud", "🌫": "cloud",
    "🌧": "cloud-rain", "🌦": "cloud-rain", "🌨": "cloud-rain", "⛈": "cloud-rain",
    "🌩": "cloud-rain", "⛅": "cloud", "🌤": "cloud", "🌥": "cloud",
    "❄": "snowflake", "☃": "snowflake", "⛄": "snowflake",
    "🚫": "ban", "⛔": "ban", "🙅": "ban",
    "❌": "x", "✖": "x", "✗": "x",
    "✅": "check", "☑": "check", "✔": "check",
    "⚠": "alert-triangle", "🚨": "alert-triangle",
    "❓": "help", "❔": "help", "ℹ": "info",
    "🐛": "bug", "🐞": "bug",
    "🎮": "gamepad", "🕹": "gamepad",
    "🎵": "music", "🎶": "music", "🎼": "music",
    "🎙": "mic", "🎤": "mic",
    "✂": "scissors",
    "📸": "camera", "📷": "camera",
    "🖼": "image", "🎴": "image", "🏞": "image",
    "🌙": "moon", "🌛": "moon", "🌜": "moon", "🌒": "moon", "🌑": "moon", "🌘": "moon",
    "☀": "sun", "🌞": "sun", "🌅": "sun",
    "👍": "thumbs-up", "👎": "thumbs-down",
    "🚩": "flag", "🏁": "flag", "🏷": "tag", "🔖": "bookmark",
    "🪪": "id-card", "🐙": "github",
    "📜": "file-text", "📃": "file-text", "📄": "file-text", "🧾": "file-text",
    "📖": "book", "📚": "book", "📕": "book", "📗": "book", "📘": "book", "📙": "book", "📓": "book",
    "🔄": "refresh", "🔁": "refresh", "🔃": "refresh",
    "⏸": "pause", "⏯": "play", "⏭": "skip-forward", "⏮": "skip-back",
    "▶": "play", "⏵": "play",
    "🤝": "handshake", "🎫": "ticket",
    "🌱": "leaf", "🌿": "leaf", "🍃": "leaf", "🌾": "leaf",
    "🟢": "dot", "🔴": "dot", "🔵": "dot", "🟠": "dot", "🟡": "dot", "🟣": "dot",
    "🟤": "dot", "⚫": "dot", "⚪": "dot", "🔘": "dot",
    "⌨": "keyboard", "🖱": "settings",
    "🎁": "gift", "🎉": "party", "🎊": "party", "🎈": "party", "🎭": "mask",
    "💾": "save", "📹": "film", "📼": "film",
    "🏦": "bank", "🏧": "bank", "🏛": "bank",
    "✈": "plane", "🛫": "plane", "🛬": "plane", "🛩": "plane",
    "⚽": "ball", "🏀": "ball", "🏈": "ball", "⚾": "ball", "🏐": "ball",
    "🎾": "ball", "🏓": "ball", "🥎": "ball", "🎱": "ball",
    "💼": "briefcase", "📰": "newspaper", "🗞": "newspaper",
    "🍳": "utensils", "🍔": "utensils", "🍕": "utensils", "🍴": "utensils",
    "🥘": "utensils", "🍝": "utensils", "🥗": "utensils", "🍜": "utensils",
    "🍪": "cookie", "🍩": "cookie", "🧁": "cookie",
    "🚗": "car", "🚙": "car", "🚕": "car", "🏎": "car",
    "🎓": "graduation", "🧑‍🎓": "graduation",
    "🐾": "paw", "🐶": "paw", "🐱": "paw", "🐕": "paw", "🐈": "paw",
    "♾": "infinity"
  };

  /* ---------- 3. CSS ---------- */
  var st = document.createElement("style");
  st.id = "picons-style";
  st.textContent =
    // Ikon dibuat lebih besar + tebal + ada ukuran minimum supaya
    // tetap jelas walau font induknya kecil (mis. judul section).
    ".picon{display:block;width:1.3em;height:1.3em;min-width:20px;min-height:20px;" +
    "stroke:currentColor;fill:none;stroke-width:2.1;stroke-linecap:round;" +
    "stroke-linejoin:round;overflow:visible}" +
    // vertical-align:middle + align-self:center → ikon SELALU center
    // sejajar teks, baik di baris teks biasa maupun judul flex.
    ".picon-w{display:inline-flex;align-items:center;justify-content:center;" +
    "line-height:0;flex:0 0 auto;vertical-align:middle;align-self:center;" +
    "position:relative;top:-0.02em;margin:0 .05em}" +
    // Judul / header section → ikon sedikit lebih menonjol (tdk berlebihan).
    "h1 .picon,h2 .picon,h3 .picon,h4 .picon,h5 .picon," +
    ".section-title .picon,.sec-title .picon,.card-title .picon,.card-head .picon," +
    ".sec-head .picon,.panel-title .picon,.block-title .picon,[class*='-title'] .picon{" +
    "width:1.45em;height:1.45em;min-width:23px;min-height:23px;stroke-width:2}" +
    // Dot status jangan terlalu besar.
    ".picon-w[data-picon='dot'] .picon{width:.7em;height:.7em;min-width:9px;min-height:9px}" +
    // Konteks teks KECIL (footer link, copy, pill, meta, breadcrumb):
    // floor min 20px kebesaran utk font ~12px → ikon ikut ukuran teks
    // (request user 2026-05-16: "kecilkan & paskan dgn teks"). valign
    // middle tetap (sudah pas).
    ".afs-link .picon,.afs-links .picon,.afs-copy .picon," +
    ".amf-link .picon,.amf-links .picon,.amf-copy .picon," +
    ".auth-mini-footer .picon,.afs-foot .picon,footer .picon," +
    "[class*='footer'] .picon,[class*='-copy'] .picon," +
    "[class*='pill'] .picon,[class*='meta'] .picon,[class*='breadcrumb'] .picon{" +
    "width:1.05em;height:1.05em;min-width:0;min-height:0;stroke-width:2}";
  (document.head || document.documentElement).appendChild(st);

  function svg(name) {
    var body = P[name];
    if (!body) return null;
    return '<svg class="picon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      body + "</svg>";
  }

  /* ---------- 4. Regex semua emoji yang dipetakan ---------- */
  // Urutkan key terpanjang dulu (mis. "📥📤") + izinkan VS16 (FE0F) di belakang.
  var keys = Object.keys(M).sort(function (a, b) { return b.length - a.length; });
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  var RE = new RegExp("(?:" + keys.map(esc).join("|") + ")\\uFE0F?", "gu");

  /* ---------- 5. Zona yang DILEWATI (konten user / input) ---------- */
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, SVG: 1, OPTION: 1, SELECT: 1 };
  var SKIP_SEL =
    "input,textarea,select,[contenteditable],[contenteditable=true]," +
    ".picon-w,.picons-skip,[data-no-picon]," +
    // konten yang diketik user — jangan diutak-atik
    ".message-text,.msg-text,.chat-text,.chat-bubble,.dm-text,.comment-text," +
    ".comment-body,.home-vid-title,.video-title,.vid-title,.uvid-title," +
    ".bio,.user-bio,.profile-bio,.notif-text,[data-user-text]";

  function skip(node) {
    var el = node.parentElement;
    if (!el) return true;
    while (el && el !== document.body) {
      if (SKIP_TAGS[el.tagName]) return true;
      el = el.parentElement;
    }
    var p = node.parentElement;
    try { if (p && p.closest && p.closest(SKIP_SEL)) return true; } catch (e) { }
    return false;
  }

  // Bendera bahasa (regional indicator) — JANGAN diganti.
  var FLAG_RE = /[\u{1F1E6}-\u{1F1FF}]/u;

  /* ---------- 6. Proses 1 subtree ---------- */
  var busy = false;

  // Sebagian render host MENGULANG-prepend emoji judul tiap refresh
  // (mis. h4.top-perf-col-title). Akibatnya ikon hasil konversi
  // menumpuk: [eye][eye][eye] 👁 Judul. Di elemen judul, ikon identik
  // beruntun TIDAK PERNAH disengaja → ciutkan jadi satu.
  var HEAD_SEL =
    'h1,h2,h3,h4,h5,h6,summary,legend,th,dt,figcaption,' +
    '[class*="title"],[class*="-head"],[class*="head-"],' +
    '.sec-title,.card-title,.panel-title,.block-title,.col-title';

  function iconNameFor(ch) {
    return M[(ch || "").replace(/️/g, "")] || M[ch] || null;
  }

  // Dedupe AMAN di judul (host kadang re-prepend emoji tiap refresh →
  // ikon hasil konversi numpuk: [eye][eye] 👁 Judul).
  // Hanya: (a) hapus emoji-mentah yg ikonnya SUDAH ada sbg picon-w di
  // judul itu, (b) ciutkan picon-w identik yg beruntun jadi satu.
  // TIDAK pernah menghapus / menggeser ikon yg BERBEDA → aman utk
  // judul yg memang punya 2 ikon beda (mis. plan-head ⭐+harga,
  // page-head ikon+aksi). Idempotent.
  function normalizeHeads(scope) {
    if (!scope || scope.nodeType !== 1) return;
    var heads = [];
    try {
      if (scope.matches && scope.matches(HEAD_SEL)) heads.push(scope);
      if (scope.querySelectorAll)
        heads = heads.concat([].slice.call(scope.querySelectorAll(HEAD_SEL)));
    } catch (e) { return; }
    for (var h = 0; h < heads.length; h++) {
      var el = heads[h];
      if (!el || el.__pNorming) continue;
      if ((el.textContent || "").length > 120) continue;
      var ws = el.querySelectorAll(".picon-w");
      if (!ws.length) continue;

      el.__pNorming = true;
      try {
        // (a) kumpulkan nama ikon yg sudah hadir
        var present = {};
        for (var k = 0; k < ws.length; k++)
          present[ws[k].getAttribute("data-picon")] = 1;
        // hapus HANYA emoji-mentah yg ikonnya duplikat dgn picon-w yg ada
        var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        var tnodes = [], tt;
        while ((tt = tw.nextNode())) tnodes.push(tt);
        for (var n = 0; n < tnodes.length; n++) {
          var tn = tnodes[n], v = tn.nodeValue || "";
          RE.lastIndex = 0;
          if (!RE.test(v)) continue;
          RE.lastIndex = 0;
          var changed = false;
          v = v.replace(RE, function (mtch) {
            var nm = iconNameFor(mtch);
            if (nm && present[nm]) { changed = true; return ""; }
            return mtch;
          });
          if (changed) tn.nodeValue = v.replace(/\s{2,}/g, " ");
        }
        // (b) ciutkan picon-w identik yg beruntun (abaikan whitespace)
        var prev = null, node = el.firstChild;
        while (node) {
          var nx = node.nextSibling;
          if (node.nodeType === 3 && !/\S/.test(node.nodeValue || "")) {
            /* whitespace: lewati, jangan reset run */
          } else if (node.nodeType === 1 && node.classList &&
            node.classList.contains("picon-w")) {
            var pic = node.getAttribute("data-picon");
            if (prev === pic) {
              var sp = node.previousSibling;
              if (sp && sp.nodeType === 3 && !/\S/.test(sp.nodeValue || ""))
                sp.parentNode.removeChild(sp);
              node.parentNode.removeChild(node);
            } else prev = pic;
          } else prev = null;
          node = nx;
        }
      } finally {
        el.__pNorming = false;
      }
    }
  }

  // Dedupe GLOBAL (bukan cuma judul) — request user 2026-05-16 "FIX BUG:
  // jangan sampai ada ikon banyak di mana pun". Sebagian render/i18n host
  // re-prepend emoji ke elemen NON-judul juga (mis. footer link
  // a.afs-link "🔒 Privasi" dari i18n key settings.privacy="🔒 Privasi"
  // yg di-apply berulang → [lock][lock][lock] menumpuk).
  // Aturan: untuk SETIAP .picon-w, kalau sibling-sebelumnya (lewati
  // whitespace) adalah .picon-w dgn data-picon SAMA → hapus yg ini.
  // → run identik beruntun ciut jadi 1. TIDAK pernah menyentuh ikon
  // BERBEDA atau yg dipisah teks. Aman, idempotent, murah.
  function dedupeIcons(scope) {
    if (!scope || scope.nodeType !== 1) return;
    var list;
    try {
      list = scope.querySelectorAll
        ? [].slice.call(scope.querySelectorAll(".picon-w")) : [];
      if (scope.classList && scope.classList.contains("picon-w"))
        list.push(scope);
    } catch (e) { return; }
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (!w || !w.parentNode) continue;
      var pic = w.getAttribute("data-picon");
      var ps = w.previousSibling;
      while (ps && ps.nodeType === 3 && !/\S/.test(ps.nodeValue || ""))
        ps = ps.previousSibling;
      if (ps && ps.nodeType === 1 && ps.classList &&
        ps.classList.contains("picon-w") &&
        ps.getAttribute("data-picon") === pic) {
        var between = w.previousSibling;
        if (between && between.nodeType === 3 &&
          !/\S/.test(between.nodeValue || ""))
          between.parentNode.removeChild(between);
        w.parentNode.removeChild(w);
      }
    }
  }

  function hydrate(root) {
    if (!root || busy) return;
    if (root.nodeType === 1 && root.classList && root.classList.contains("picon-w")) return;
    busy = true;
    try {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var v = n.nodeValue;
          if (!v || v.length > 4000) return NodeFilter.FILTER_REJECT;
          if (FLAG_RE.test(v)) return NodeFilter.FILTER_REJECT;
          RE.lastIndex = 0;
          if (!RE.test(v)) return NodeFilter.FILTER_REJECT;
          if (skip(n)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var hits = [], cur;
      while ((cur = walker.nextNode())) hits.push(cur);
      for (var i = 0; i < hits.length; i++) {
        var tn = hits[i], txt = tn.nodeValue;
        RE.lastIndex = 0;
        var frag = document.createDocumentFragment();
        var last = 0, m;
        while ((m = RE.exec(txt))) {
          var base = m[0].replace(/️/g, "");
          var name = M[base] || M[m[0]];
          var markup = name && svg(name);
          if (!markup) continue;
          if (m.index > last)
            frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
          var w = document.createElement("span");
          w.className = "picon-w";
          w.setAttribute("data-picon", name);
          w.innerHTML = markup;
          frag.appendChild(w);
          last = m.index + m[0].length;
        }
        if (last === 0) continue;
        if (last < txt.length)
          frag.appendChild(document.createTextNode(txt.slice(last)));
        if (tn.parentNode) tn.parentNode.replaceChild(frag, tn);
      }
      normalizeHeads(root);
      dedupeIcons(root);
    } catch (e) {
      if (window.console) console.warn("[picons] hydrate error", e);
    } finally {
      busy = false;
    }
  }

  /* ---------- 7. Trigger: SINKRON sebelum paint (ANTI-GLITCH) ----------
     Bug yg di-fix (request user 2026-05-16): emoji warna sempat "glitch"
     muncul lalu baru jadi ikon. Penyebab: dulu observer di-debounce
     220ms + requestIdleCallback → ada jeda kelihatan emoji mentah, dan
     update via characterData (textContent) TIDAK pernah ke-observe →
     emoji warna tinggal permanen.
     Fix: MutationObserver callback jalan SEBELUM browser repaint. Kalau
     kita hydrate SINKRON di situ (tanpa setTimeout/idle), emoji mentah
     diganti SVG sebelum frame digambar → user tak pernah lihat warna.
     Plus observe characterData + jaring pengaman full() berkala. */
  function full() { hydrate(document.body); }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", full, { once: true });
  else full();
  window.addEventListener("load", full);

  // Ganti view → konversi penuh segera (sinkron) supaya konten view
  // yg baru render tidak sempat tampil emoji warna.
  window.addEventListener("playly:view-changed", full);
  window.addEventListener("playly:cloud-applied", full);

  // Observer: proses node baru / text yg berubah SINKRON di callback
  // (sebelum paint). Abaikan mutasi dari diri sendiri (busy / .picon-w
  // / text sisa tanpa emoji) → tidak ada loop.
  try {
    var obs = new MutationObserver(function (muts) {
      if (busy) return;
      var roots = [], seen = false;
      for (var i = 0; i < muts.length; i++) {
        var mu = muts[i];
        if (mu.type === "characterData") {
          var tp = mu.target && mu.target.parentElement;
          if (tp) {
            RE.lastIndex = 0;
            if (RE.test(mu.target.nodeValue || "")) { roots.push(tp); seen = true; }
          }
          continue;
        }
        var added = mu.addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 1) {
            if (n.classList && n.classList.contains("picon-w")) continue;
            roots.push(n); seen = true;
          } else if (n.nodeType === 3 && n.parentElement) {
            RE.lastIndex = 0;
            if (RE.test(n.nodeValue || "")) { roots.push(n.parentElement); seen = true; }
          }
        }
      }
      if (!seen) return;
      // SINKRON — sebelum repaint → anti-glitch (no setTimeout/idle).
      for (var k = 0; k < roots.length; k++)
        if (roots[k] && roots[k].isConnected) hydrate(roots[k]);
    });
    obs.observe(document.body, {
      childList: true, subtree: true, characterData: true
    });
  } catch (e) { }

  // Jaring pengaman berkala: normalizeHeads tiap 700ms + full() tiap
  // ~2.1s (tangkap apa pun yg lolos observer, mis. perubahan langka).
  // hydrate murah (TreeWalker + early reject), skip saat hidden/busy.
  var _wd = 0;
  setInterval(function () {
    if (busy || document.hidden) return;
    try { normalizeHeads(document.body); } catch (e) { }
    try { dedupeIcons(document.body); } catch (e) { }
    if ((++_wd % 3) === 0) { try { full(); } catch (e) { } }
  }, 700);

  window.pIconsHydrate = full;
  window.pIcon = function (n) { return svg(n) || ""; };
})();
