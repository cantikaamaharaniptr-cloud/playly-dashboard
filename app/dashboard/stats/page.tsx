import { NavIcon, PagePlaceholder } from '@/components/dashboard/PagePlaceholder';

export const metadata = { title: 'Playly — Statistik' };

export default function StatsPage() {
  return (
    <PagePlaceholder
      eyebrow="Analytics"
      title="Statistik"
      description="Performa konten kamu — views, likes, watch time, engagement."
      icon={
        <NavIcon>
          <path d="M3 17 9 11l4 4 8-8" />
          <path d="M14 7h7v7" />
        </NavIcon>
      }
      features={[
        'Grafik views / likes / shares (last 7/30/90 days)',
        'Watch time + retention curve per video',
        'Top region & demografi (Premium Insights)',
        'Engagement rate + comment count',
        'Pencapaian / badge unlocks',
      ]}
    />
  );
}
