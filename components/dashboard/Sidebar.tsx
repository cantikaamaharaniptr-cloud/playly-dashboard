'use client';

// Dashboard sidebar — nav items per i18n key. Section labels + items
// di-port dari legacy public/legacy/script.js I18N constant.
// Phase 7b polish: desktop sticky aside + mobile drawer (slide-in,
// overlay, auto-close on route change/escape).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/components/providers/i18n-provider';
import { useChrome } from './ChromeContext';

type NavItem = {
  href: string;
  i18nKey: string;
  fallback: string;
  icon: React.ReactNode;
};

type NavSection = {
  i18nKey: string;
  fallback: string;
  items: NavItem[];
};

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const SECTIONS: NavSection[] = [
  {
    i18nKey: 'section.main',
    fallback: 'UTAMA',
    items: [
      {
        href: '/dashboard',
        i18nKey: 'nav.home',
        fallback: 'Beranda',
        icon: (
          <svg viewBox="0 0 24 24" {...stroke}>
            <path d="M3 10.5 12 4l9 6.5" />
            <path d="M5 9.5V20h14V9.5" />
          </svg>
        ),
      },
      {
        href: '/dashboard/discover',
        i18nKey: 'nav.discover',
        fallback: 'Jelajahi',
        icon: (
          <svg viewBox="0 0 24 24" {...stroke}>
            <circle cx="12" cy="12" r="9" />
            <path d="m15.5 8.5-2 5-5 2 2-5z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/library',
        i18nKey: 'nav.library',
        fallback: 'Pustaka Saya',
        icon: (
          <svg viewBox="0 0 24 24" {...stroke}>
            <path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4Z" />
            <path d="M8 4v16M20 7v15" />
          </svg>
        ),
      },
      {
        href: '/dashboard/upload',
        i18nKey: 'nav.upload',
        fallback: 'Unggah',
        icon: (
          <svg viewBox="0 0 24 24" {...stroke}>
            <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        ),
      },
    ],
  },
  {
    i18nKey: 'section.library',
    fallback: 'PUSTAKA',
    items: [
      {
        href: '/dashboard/history',
        i18nKey: 'nav.history',
        fallback: 'Riwayat',
        icon: (
          <svg viewBox="0 0 24 24" {...stroke}>
            <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
            <path d="M12 7v5l3 2" />
          </svg>
        ),
      },
      {
        href: '/dashboard/stats',
        i18nKey: 'nav.stats',
        fallback: 'Statistik',
        icon: (
          <svg viewBox="0 0 24 24" {...stroke}>
            <path d="M3 17 9 11l4 4 8-8" />
            <path d="M14 7h7v7" />
          </svg>
        ),
      },
    ],
  },
  {
    i18nKey: 'section.social',
    fallback: 'SOSIAL',
    items: [
      {
        href: '/dashboard/search',
        i18nKey: 'nav.search',
        fallback: 'Cari User',
        icon: (
          <svg viewBox="0 0 24 24" {...stroke}>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        ),
      },
      {
        href: '/dashboard/messages',
        i18nKey: 'nav.messages',
        fallback: 'Obrolan langsung',
        icon: (
          <svg viewBox="0 0 24 24" {...stroke}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
      {
        href: '/dashboard/settings',
        i18nKey: 'nav.settings',
        fallback: 'Pengaturan',
        icon: (
          <svg viewBox="0 0 24 24" {...stroke}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.16.66.42.88.74.22.32.33.69.33 1.08 0 .39-.11.76-.33 1.08-.22.32-.52.58-.88.74z" />
          </svg>
        ),
      },
    ],
  },
];

export function Sidebar() {
  const { drawerOpen, closeDrawer } = useChrome();

  return (
    <>
      {/* Desktop: sticky aside, hidden mobile */}
      <aside className="hidden w-60 flex-shrink-0 border-r border-cream/10 bg-ink-elev/40 lg:block">
        <div className="sticky top-0 flex h-screen flex-col gap-1 overflow-y-auto p-4">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile: drawer overlay */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!drawerOpen}
      >
        {/* Backdrop */}
        <button
          type="button"
          aria-label="Close menu"
          onClick={closeDrawer}
          className={`absolute inset-0 cursor-default bg-ink/70 backdrop-blur-sm transition-opacity duration-200 ${
            drawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* Drawer panel */}
        <aside
          className={`relative h-full w-72 max-w-[85%] flex-shrink-0 border-r border-cream/10 bg-ink-elev shadow-playly-lg transition-transform duration-200 ease-out ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col gap-1 overflow-y-auto p-4">
            <SidebarContent onLinkClick={closeDrawer} />
          </div>
        </aside>
      </div>
    </>
  );
}

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void } = {}) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <>
      {/* Brand */}
      <Link
        href="/dashboard"
        onClick={onLinkClick}
        className="mb-4 flex items-center gap-2 px-2"
      >
        <svg
          viewBox="0 0 100 100"
          className="h-7 w-7 text-cream"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M 30 6 L 60 6 C 80 6 92 22 92 38 C 92 58 76 70 56 70 L 42 70 L 42 92 C 42 97 38 98 32 98 C 26 98 22 97 22 92 L 22 14 C 22 10 26 6 30 6 Z M 42 22 L 56 22 C 66 22 72 30 72 38 C 72 46 66 54 56 54 L 42 54 Z"
          />
        </svg>
        <span className="text-xl font-extrabold text-cream">
          Playly<span className="text-wine">.</span>
        </span>
      </Link>

      {SECTIONS.map((section) => (
        <div key={section.i18nKey} className="mt-3 first:mt-0">
          <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[1.5px] text-cream-muted">
            {t(section.i18nKey, section.fallback)}
          </div>
          {section.items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onLinkClick}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-wine/15 text-cream'
                    : 'text-cream-soft hover:bg-cream/5 hover:text-cream'
                }`}
              >
                <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>
                <span className="truncate">
                  {t(item.i18nKey, item.fallback)}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
