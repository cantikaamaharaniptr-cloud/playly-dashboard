import { NavIcon, PagePlaceholder } from '@/components/dashboard/PagePlaceholder';

export const metadata = { title: 'Playly — Unggah Video' };

export default function UploadPage() {
  return (
    <PagePlaceholder
      eyebrow="Upload"
      title="Unggah Video Baru"
      description="Pilih video file, isi metadata, atur visibility, terus publish."
      icon={
        <NavIcon>
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </NavIcon>
      }
      features={[
        'Drag & drop video file ke upload zone',
        'Info section: judul, deskripsi, kategori, tag (AI-assist Premium)',
        'Frame section: thumbnail picker — auto-generate 3 candidate atau upload custom',
        'AI auto-subtitle (Premium) via Whisper + DeepL translation',
        'Visibility: public / unlisted / private',
        'Quota meter (Free: 60 videos/bulan, 1 GB storage)',
      ]}
    />
  );
}
