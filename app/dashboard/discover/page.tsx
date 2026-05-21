import { NavIcon, PagePlaceholder } from '@/components/dashboard/PagePlaceholder';

export const metadata = { title: 'Playly — Jelajahi' };

export default function DiscoverPage() {
  return (
    <PagePlaceholder
      eyebrow="Sosial"
      title="Jelajahi"
      description="Feed agregasi video terbaru dari semua kreator di platform."
      icon={
        <NavIcon>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.5 8.5-2 5-5 2 2-5z" />
        </NavIcon>
      }
      features={[
        'Feed video terbaru (timeline kronologis dari follow + global)',
        'Filter by kategori, durasi, region',
        'Trending pill — video paling banyak ditonton 24 jam terakhir',
        'Search bar — query judul/deskripsi/kreator',
      ]}
    />
  );
}
