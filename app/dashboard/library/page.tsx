import { NavIcon, PagePlaceholder } from '@/components/dashboard/PagePlaceholder';

export const metadata = { title: 'Playly — Pustaka Saya' };

export default function LibraryPage() {
  return (
    <PagePlaceholder
      eyebrow="Pustaka"
      title="Pustaka Saya"
      description="Semua video yang kamu upload, plus status, draft, dan arsip."
      icon={
        <NavIcon>
          <path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4Z" />
          <path d="M8 4v16M20 7v15" />
        </NavIcon>
      }
      features={[
        'Daftar video upload kamu (sorted by tanggal)',
        'Tab: Video Saya / Status Videos / Video Baru / Unduhan',
        'Action kebab menu per video: Edit, Draft, Hapus, Restore',
        'Filter visibility (public / unlisted / private)',
      ]}
    />
  );
}
