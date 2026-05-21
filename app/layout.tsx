import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Playly. — Video Platform',
  description: 'Playly video platform dashboard',
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
