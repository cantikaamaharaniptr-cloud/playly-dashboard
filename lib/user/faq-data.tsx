// Source: public/legacy/index.html — section #authFaqSection (line 1418-1466).
// Phase 5: copied verbatim. Mix EN+ID (matches legacy bilingual content).
// When full i18n dict porting happens, swap for t() lookups.

export type UserFaqItem = { q: string; a: React.ReactNode };

export const USER_FAQ: readonly UserFaqItem[] = [
  {
    q: 'Can I switch between Free and Premium anytime?',
    a: 'Yes! Upgrade to Premium any time from the profile menu. Your videos, followers, and stats stay the same. Downgrade back to Free is also available — you keep all uploaded content.',
  },
  {
    q: 'What happens if I hit the Free upload limit?',
    a: "You'll see a friendly prompt suggesting Premium when you reach 60 videos or 1 GB this month. Existing videos stay live forever — no auto-deletion. The quota simply resets on the 1st of next month.",
  },
  {
    q: 'Are my videos really stored privately?',
    a: 'All uploads are encrypted at rest and in transit. We never share or sell your data. You control visibility (public, unlisted, private) per video.',
  },
  {
    q: 'Do Premium subscribers see ads while watching?',
    a: "No. Premium accounts get a 100% ad-free viewing experience — no banners, no pre-rolls, no running text. You can also use Premium to watch other creators' content without sponsored interruptions.",
  },
  {
    q: "What's the cancellation policy?",
    a: 'Cancel any time, no questions asked. Premium remains active until the end of the current billing period, then auto-converts to Free. No hidden fees.',
  },
  {
    q: 'Is Playly available on mobile?',
    a: 'Yes — the dashboard is fully responsive and works smoothly on phones, tablets, laptops, and desktops. Native iOS & Android apps coming soon.',
  },
  {
    q: 'Bisakah saya edit atau hapus video setelah di-upload?',
    a: (
      <>
        Bisa. Buka <b>Pustaka Saya</b> → klik menu titik tiga (⋯) di setiap
        video kamu — pilih <b>Edit</b> (judul, deskripsi, kategori, visibilitas),
        simpan ke <b>Draft</b>, atau <b>Hapus</b> (masuk ke Sampah dan bisa
        dipulihkan). Kalau video melanggar ToS, admin bisa takedown — kamu
        dapat notifikasi dan bisa banding.
      </>
    ),
  },
  {
    q: 'Bagaimana cara kerja follow, DM, dan pesan?',
    a: (
      <>
        Klik tombol <b>Ikuti</b> di profil kreator untuk mengikuti — feed
        Jelajahi langsung tampilkan video terbaru mereka. DM gaya Instagram:
        klik <b>Pesan</b> di profil kreator atau buka tab <b>Pesan</b> di
        sidebar. Admin juga bisa kirim broadcast ke seluruh user. Semua pesan
        real-time, bukan auto-reply.
      </>
    ),
  },
  {
    q: 'Bagaimana sistem streak & metrik engagement bekerja?',
    a: (
      <>
        <b>Streak</b> naik tiap hari kamu aktif (upload video, komentar, atau
        menonton minimal 1 video). Streak putus kalau lewat satu hari — badge
        streak otomatis hilang saat angka 0. Statistik kamu tampil di kartu
        hero (Video / Tontonan / Pengikut), plus chart lengkap di halaman{' '}
        <b>Statistik</b>.
      </>
    ),
  },
  {
    q: 'Bisakah saya download video untuk ditonton offline?',
    a: (
      <>
        Bisa. Buka video → klik tombol <b>Download</b> di bawah player. Pilih
        kualitas sendiri (480p/720p/1080p/4K — 4K khusus Premium). File
        tersimpan di tab <b>Unduhan</b> di Pustaka Saya, bisa diputar tanpa
        internet. Konten kreator yang di-private atau unlisted tidak bisa
        di-download.
      </>
    ),
  },
];
