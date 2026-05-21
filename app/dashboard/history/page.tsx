import { NavIcon, PagePlaceholder } from '@/components/dashboard/PagePlaceholder';

export const metadata = { title: 'Playly — Riwayat' };

export default function HistoryPage() {
  return (
    <PagePlaceholder
      eyebrow="Aktivitas"
      title="Riwayat"
      description="Catatan aktivitas kamu di Playly — tontonan, pembelian, pencarian."
      icon={
        <NavIcon>
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
          <path d="M12 7v5l3 2" />
        </NavIcon>
      }
      features={[
        'Tab: Aktivitas (semua action terbaru)',
        'Tab: Pembelian (premium subscription, top-up, payout history)',
        'Tab: Search User (akun yang pernah kamu cari)',
        'Tab: Search Video (judul video yang pernah kamu cari)',
        'Tab: Riwayat Tontonan + Lanjutkan Tontonan',
      ]}
    />
  );
}
