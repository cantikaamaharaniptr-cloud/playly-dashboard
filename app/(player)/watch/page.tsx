import type { Metadata } from 'next';
import WatchPage from '@/app/_legacy/WatchPage';

// Static defaults; watch-init.js updates document.title + og live once the
// video metadata is resolved client-side.
export const metadata: Metadata = {
  title: 'Playly • Tonton Video',
  description: 'Tonton video dari Playly tanpa login.',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'video.other',
    siteName: 'Playly',
    title: 'Playly Video',
    description: 'Tonton video di Playly',
  },
};

export default function Page() {
  return <WatchPage />;
}
