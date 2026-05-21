import { NavIcon, PagePlaceholder } from '@/components/dashboard/PagePlaceholder';

export const metadata = { title: 'Playly — Cari User' };

export default function SearchPage() {
  return (
    <PagePlaceholder
      eyebrow="Komunitas"
      title="Cari User"
      description="Cari kreator lain di Playly untuk follow, DM, atau kolaborasi."
      icon={
        <NavIcon>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" />
        </NavIcon>
      }
      features={[
        'Search bar — query username, nama, atau email',
        'Result card per user: avatar, badge tier, jumlah video & follower',
        'Action: Follow, Pesan (DM), Lihat profil',
        'Saran kreator aktif (hari ini)',
      ]}
    />
  );
}
