// Root layout for the public player pages (watch + embed). Second root layout
// of the multiple-root-layout setup. These pages are standalone full-screen
// players that ship their own CSS (watch.css / embed.css) — they do NOT use the
// main styles.css / script.js bundle.
import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
