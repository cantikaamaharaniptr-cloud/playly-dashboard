// Minimal root layout. Next.js App Router requires a root layout, tapi
// site sebenarnya = legacy bundle (public/legacy/*) yang di-serve via
// rewrites di next.config.mjs. Next.js di sini cuma shell tipis +
// host untuk app/api/translate-subtitle (dipanggil legacy script.js).
//
// React dashboard / migration sudah dihapus 2026-05-22 — user pilih
// fokus legacy. Lihat [[project-nextjs-migration]] memory.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Playly. — Video Platform',
  description: 'Playly video platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
