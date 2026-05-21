// Dashboard home — Beranda. Phase 7b session 2: stats grid + CTA + empty
// state. Data masih placeholder zeros (clean-slate Supabase). Future
// session: real queries dari videos table + follower count + watch hours.

import Link from 'next/link';
import { getUser } from '@/lib/auth/guard';

export const metadata = { title: 'Playly — Beranda' };

export default async function DashboardHome() {
  const user = await getUser();
  const display =
    (user?.user_metadata as { name?: string } | undefined)?.name ||
    user?.email?.split('@')[0] ||
    'Creator';

  return (
    <div className="space-y-8">
      {/* Hero greeting */}
      <header>
        <p className="text-xs uppercase tracking-widest text-cream-muted">
          Beranda
        </p>
        <h1 className="mt-1 text-3xl font-bold text-cream">
          Hi, {display} 👋
        </h1>
        <p className="mt-1 text-sm text-cream-soft">
          Welcome back to your Playly dashboard.
        </p>
      </header>

      {/* Stats grid — clean-slate, all 0 sampai pertama upload */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Video"
          value="0"
          hint="Belum ada video"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2.5" y="6" width="13" height="12" rx="2" />
              <path d="M15.5 10l5-2.5v9l-5-2.5z" />
            </svg>
          }
        />
        <StatCard
          label="Tontonan"
          value="0"
          hint="Bulan ini"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
        />
        <StatCard
          label="Pengikut"
          value="0"
          hint="Belum ada pengikut"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
          }
        />
      </section>

      {/* Primary CTA */}
      <section className="rounded-[16px] border border-cream/15 bg-gradient-to-br from-wine/20 to-ink-elev/60 p-6 ring-1 ring-cream/5 sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="m-0 text-xl font-bold text-cream">
              Mulai dari upload pertama kamu
            </h2>
            <p className="mt-1 text-sm text-cream-soft">
              Drag & drop video file, isi metadata, terus publish dalam &lt;1 menit.
            </p>
          </div>
          <Link
            href="/dashboard/upload"
            className="inline-flex items-center gap-2 rounded-[12px] bg-wine px-5 py-3 text-sm font-bold text-cream shadow-playly-md transition-colors hover:bg-wine-hover"
          >
            <span>Unggah Video</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Empty state — ranking & recent */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EmptyCard
          title="Peringkat Kreator"
          description="Top kreator minggu ini muncul di sini. Belum ada data karena platform baru launch."
          href="/dashboard/discover"
          ctaLabel="Lihat semua kreator"
        />
        <EmptyCard
          title="Video Terbaru"
          description="Video baru dari kreator yang kamu ikuti tampil di sini. Mulai dengan follow kreator dulu."
          href="/dashboard/search"
          ctaLabel="Cari kreator"
        />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-[14px] border border-cream/15 bg-ink-elev/50 p-4">
      <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[10px] border border-cream/15 bg-ink/60 text-cream-soft">
        <span className="block h-5 w-5">{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[1px] text-cream-muted">
          {label}
        </div>
        <div className="font-mono text-2xl font-bold leading-none text-cream">
          {value}
        </div>
        <div className="mt-0.5 text-[11px] text-cream-muted">{hint}</div>
      </div>
    </div>
  );
}

function EmptyCard({
  title,
  description,
  href,
  ctaLabel,
}: {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-[14px] border border-dashed border-cream/15 bg-ink-elev/30 p-6">
      <h3 className="m-0 text-base font-bold text-cream">{title}</h3>
      <p className="mt-1.5 text-xs leading-[1.55] text-cream-soft">
        {description}
      </p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cream hover:underline"
      >
        {ctaLabel}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
