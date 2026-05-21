// Playly translation dictionary — starter port dari public/legacy/script.js.
// Hanya nav + section labels yg di-port di Phase 3. Sisanya (page titles,
// modals, settings, dst) di-append saat masing-masing page dimigrate.
//
// Legacy struktur: 8 locale (en, id, ms, ja, ar, zh, ko, es). Phase 3 hanya
// load en + id; bahasa lain di-append saat ada user yang switch ke locale itu.
//
// Source: public/legacy/script.js line 3738 (I18N constant).

export const SUPPORTED_LOCALES = ['id', 'en', 'ms', 'ja', 'ar', 'zh', 'ko', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'id';

export type Dict = Record<string, string>;

export const TRANSLATIONS: Partial<Record<Locale, Dict>> = {
  en: {
    'section.main': 'MAIN',
    'section.library': 'LIBRARY',
    'section.social': 'SOCIAL',
    'nav.home': 'Home',
    'nav.discover': 'Discover',
    'nav.library': 'My Library',
    'nav.upload': 'Upload',
    'nav.history': 'History',
    'nav.stats': 'Rating Scale',
    'nav.search': 'Search User',
    'nav.activity': 'Activity',
    'nav.messages': 'Live chat',
    'nav.settings': 'Settings',
    'nav.help': 'Help',
  },
  id: {
    'section.main': 'UTAMA',
    'section.library': 'PUSTAKA',
    'section.social': 'SOSIAL',
    'nav.home': 'Beranda',
    'nav.discover': 'Jelajahi',
    'nav.library': 'Pustaka Saya',
    'nav.upload': 'Unggah',
    'nav.history': 'Riwayat',
    'nav.stats': 'Statistik',
    'nav.search': 'Cari User',
    'nav.activity': 'Aktivitas',
    'nav.messages': 'Obrolan langsung',
    'nav.settings': 'Pengaturan',
    'nav.help': 'Bantuan',
  },
};
