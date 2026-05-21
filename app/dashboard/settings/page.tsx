import { NavIcon, PagePlaceholder } from '@/components/dashboard/PagePlaceholder';

export const metadata = { title: 'Playly — Pengaturan' };

export default function SettingsPage() {
  return (
    <PagePlaceholder
      eyebrow="Akun"
      title="Pengaturan"
      description="Atur profil, preferensi, keamanan, dan langganan kamu."
      icon={
        <NavIcon>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.16.66.42.88.74.22.32.33.69.33 1.08 0 .39-.11.76-.33 1.08-.22.32-.52.58-.88.74z" />
        </NavIcon>
      }
      features={[
        'Akun: nama, email, password, hapus akun',
        'Profil: avatar, banner, bio, link sosial',
        'Bahasa & Region: locale picker (8 bahasa)',
        'Langganan: plan Free/Premium, riwayat bayar',
        'Keamanan: 2FA, sesi aktif, lock screen',
        'Buat Admin (super-admin only): tambah role admin/moderator',
      ]}
    />
  );
}
