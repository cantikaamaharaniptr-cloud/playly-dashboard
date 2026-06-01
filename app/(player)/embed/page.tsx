import type { Metadata } from 'next';
import EmbedPage from '@/app/_legacy/EmbedPage';

export const metadata: Metadata = {
  title: 'Playly Embed',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <EmbedPage />;
}
