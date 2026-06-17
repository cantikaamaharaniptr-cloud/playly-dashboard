// Root layout for the main app (landing + user/admin dashboard).
//
// This is one of several "root layouts" (multiple-root-layout setup — there is
// no app/layout.tsx). It reproduces the <head> + <body> that the legacy
// index.html declared, so styles.css + script.js keep matching exactly. The
// page body markup itself lives in app/_legacy/IndexPage.tsx (rendered verbatim
// from the extracted legacy markup) — no .html file involved.
import type { Metadata, Viewport } from 'next';
import { legacyAsset } from '@/app/_legacy/legacy-asset';

// Cache-bust version preserved verbatim from legacy index.html.
const STYLES_V = '20260617-emoji27-beranda2';

// FOUC guard (verbatim from index.html <head>): hide admin-only DOM on non-admin
// views before styles.css finishes loading, so admin UI never flashes.
const FOUC_CSS = `body:not([data-role="admin"]) .admin-only,
body:not([data-role="admin"]) [data-admin-only],
body:not([data-role="admin"]) #adminHeroCard,
body:not([data-role="admin"]) [data-view="admin-dashboard"],
body:not([data-role="admin"]) [data-view="admin-users"],
body:not([data-role="admin"]) [data-view="admin-videos"],
body:not([data-role="admin"]) [data-view="admin-reports"],
body:not([data-role="admin"]) [data-view="admin-payments"],
body:not([data-role="admin"]) [data-view="admin-broadcast"],
body:not([data-role="admin"]) [data-view="admin-settings"],
body:not([data-role="admin"]) [data-view="admin-player"] {
  display: none !important;
  visibility: hidden !important;
}`;

export const metadata: Metadata = {
  title: 'Playly. — Video Platform',
  description: 'Playly video platform',
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231a0c10'/%3E%3Cpath d='M12 9v14l11-7z' fill='%23E7D7C4'/%3E%3C/svg%3E",
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'format-detection': 'telephone=no',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1a0c10',
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body data-theme="dark" className="auth-mode" suppressHydrationWarning>
        {/* React 19 hoists these <link>/<style> resources into <head>. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap"
          precedence="high"
        />
        <link rel="stylesheet" href={legacyAsset('styles.css', STYLES_V)} precedence="high" />
        <style href="playly-fouc-guard" precedence="high">
          {FOUC_CSS}
        </style>
        {children}
      </body>
    </html>
  );
}
