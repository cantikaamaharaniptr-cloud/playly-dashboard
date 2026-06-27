import type { Metadata } from 'next';
import WatchPage from '@/app/_legacy/WatchPage';
import EmbedPage from '@/app/_legacy/EmbedPage';

// Clean share URLs (previously Vercel rewrites → watch.html / embed.html):
//   /id/:videoId                     → watch
//   /id/:username/:videoId           → watch
//   /id/:videoId/embed               → embed
//   /id/:username/:videoId/embed     → embed
// watch-init.js / embed-init.js parse the videoId + username straight from
// location.pathname, so here we only need to pick the right player shell.
type Params = { slug: string[] };

function isEmbed(slug: string[]): boolean {
  return Array.isArray(slug) && slug[slug.length - 1] === 'embed';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  return isEmbed(slug)
    ? { title: 'Playly Embed', robots: { index: false, follow: false } }
    : {
        title: 'Playly • Tonton Video',
        description: 'Tonton video dari Playly tanpa login.',
        openGraph: { type: 'video.other', siteName: 'Playly', title: 'Playly Video' },
      };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  return isEmbed(slug) ? <EmbedPage /> : <WatchPage />;
}
