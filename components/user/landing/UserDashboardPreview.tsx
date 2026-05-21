// Dashboard preview — 2 mockup cards (Free vs Premium dashboards).
// Server Component, all static. Source: public/legacy/index.html
// #authPreviewSection (lines 1202-1333).
//
// Visual approximated with Tailwind utilities; not pixel-perfect to
// legacy (many .pm-* CSS classes simplified) but layout & content match.

import { UserLandingHead } from './UserLandingHead';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" {...stroke}>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" {...stroke}>
      <path d="M12 3.5l2.6 5.3 5.8.9-4.2 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L4.6 9.7l5.8-.9z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" {...stroke}>
      <rect x="2.5" y="6" width="13" height="12" rx="2" />
      <path d="M15.5 10l5-2.5v9l-5-2.5z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" {...stroke}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" {...stroke}>
      <path d="M12 2l7 3v6c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V5z" />
      <path d="M9.2 11.8l1.9 1.9 3.7-3.8" />
    </svg>
  );
}

function AdIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" {...stroke}>
      <path d="M3 10v4a1 1 0 0 0 1 1h2l9 5V4L6 9H4a1 1 0 0 0-1 1z" />
      <path d="M18 8a5 5 0 0 1 0 8" />
    </svg>
  );
}

export function UserDashboardPreview() {
  return (
    <section className="w-full px-6 py-14 sm:px-10 sm:py-20 lg:px-20 lg:py-24">
      <UserLandingHead
        eyebrow="PREVIEW"
        title="Your dashboard, your tier"
        subtitle="See exactly what you'll get inside the Playly dashboard depending on your plan."
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
        {/* FREE DASHBOARD */}
        <article className="flex flex-col gap-4 rounded-[18px] border border-cream/15 bg-ink-elev/50 p-5">
          <div className="rounded-[12px] border border-cream/10 bg-ink/60 p-3">
            {/* Mini topbar */}
            <div className="mb-3 flex items-center gap-2 border-b border-cream/10 pb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-2 py-0.5 text-[11px] font-medium text-cream">
                <HomeIcon /> Home
              </span>
              <span className="h-5 flex-1 rounded-md bg-cream/5" />
              <span className="rounded-full bg-cream/10 px-2 py-0.5 text-[11px] font-semibold text-cream-soft">
                Free
              </span>
            </div>
            {/* Hero */}
            <div className="mb-3">
              <strong className="block text-sm text-cream">Hi, Creator</strong>
              <small className="block text-[11px] text-cream-muted">
                Welcome back to your dashboard
              </small>
              <div className="mt-2 flex gap-2">
                <span className="rounded-md bg-wine px-3 py-1 text-[11px] font-semibold text-cream">
                  Upload
                </span>
                <span className="rounded-md border border-cream/20 px-3 py-1 text-[11px] font-semibold text-cream-soft">
                  Discover
                </span>
              </div>
            </div>
            {/* Quota meter */}
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-cream-muted">Videos this month</span>
                <b className="text-cream">42 / 60</b>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-cream/10">
                <i
                  className="block h-full rounded-full bg-wine"
                  style={{ width: '70%' }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-cream-muted">Storage this month</span>
                <b className="text-cream">720 MB / 1 GB</b>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-cream/10">
                <i
                  className="block h-full rounded-full bg-wine"
                  style={{ width: '70%' }}
                />
              </div>
            </div>
            {/* Stat tiles */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              <StatTile icon={<VideoIcon />} value="12" label="Total Videos" />
              <StatTile icon={<EyeIcon />} value="1.2k" label="Views" />
            </div>
            {/* Ad */}
            <div className="mb-2 flex items-center gap-2 rounded-md border border-cream/10 bg-cream/5 px-2 py-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cream-muted">
                <AdIcon /> Sponsored
              </span>
              <span className="text-[11px] text-cream-soft">
                Try Playly Premium → Ad-free experience
              </span>
            </div>
            {/* Upgrade banner */}
            <div className="flex items-center gap-2 rounded-md bg-wine/20 px-2.5 py-2 ring-1 ring-wine/40">
              <StarIcon />
              <span className="text-[11px] text-cream">
                <b>Upgrade to Premium</b> — Unlock unlimited everything
              </span>
            </div>
          </div>
          <h3 className="m-0 text-lg font-bold text-cream">Free dashboard</h3>
          <ul className="m-0 grid gap-1.5 p-0">
            {FREE_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] text-cream-soft">
                <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cream/30" />
                {f}
              </li>
            ))}
          </ul>
        </article>

        {/* PREMIUM DASHBOARD */}
        <article className="flex flex-col gap-4 rounded-[18px] border border-cream/30 bg-gradient-to-br from-wine/15 to-ink-elev/60 p-5 ring-1 ring-cream/10">
          <div className="rounded-[12px] border border-cream/20 bg-ink/60 p-3">
            {/* Mini topbar */}
            <div className="mb-3 flex items-center gap-2 border-b border-cream/10 pb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-2 py-0.5 text-[11px] font-medium text-cream">
                <HomeIcon /> Home
              </span>
              <span className="h-5 flex-1 rounded-md bg-cream/5" />
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-wine to-wine-hover px-2 py-0.5 text-[11px] font-bold text-cream">
                <StarIcon /> Premium
              </span>
            </div>
            {/* Hero */}
            <div className="mb-3">
              <strong className="flex items-center gap-1 text-sm text-cream">
                Hi, Creator <VerifiedIcon />
              </strong>
              <small className="block text-[11px] text-cream-muted">
                Welcome back, Premium member
              </small>
              <div className="mt-2 flex gap-2">
                <span className="rounded-md bg-wine px-3 py-1 text-[11px] font-semibold text-cream">
                  Upload
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-sand-accent/60 bg-sand-accent/15 px-3 py-1 text-[11px] font-semibold text-sand-accent">
                  <StarIcon /> Premium Insights
                </span>
              </div>
            </div>
            {/* Stat tiles */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              <StatTile icon={<VideoIcon />} value="247" label="Total Videos" />
              <StatTile icon={<EyeIcon />} value="89.4k" label="Views" />
            </div>
            {/* Insights widget */}
            <div className="mb-3 rounded-md border border-cream/15 bg-ink-elev/80 p-2.5">
              <div className="mb-2 flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1 font-bold text-cream">
                  <StarIcon /> Premium Insights
                </span>
                <span className="font-bold text-status-success">↗ +12.4%</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-cream-muted">Engagement rate</span>
                  <b className="text-cream">8.2%</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-cream-muted">Avg watch time</span>
                  <b className="text-cream">4m 18s</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-cream-muted">Top region</span>
                  <b className="text-cream">Indonesia</b>
                </div>
              </div>
            </div>
            {/* Premium active banner */}
            <div className="flex items-center gap-2 rounded-md bg-status-success/15 px-2.5 py-2 ring-1 ring-status-success/30">
              <VerifiedIcon />
              <span className="text-[11px] text-cream">
                <b>Premium aktif</b> — semua fitur tanpa batas terbuka
              </span>
            </div>
          </div>
          <h3 className="m-0 text-lg font-bold text-cream">Premium dashboard</h3>
          <ul className="m-0 grid gap-1.5 p-0">
            {PREMIUM_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] text-cream-soft">
                <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sand-accent" />
                {f}
              </li>
            ))}
          </ul>
        </article>
      </div>

      <p className="mx-auto mt-8 max-w-[600px] text-center text-[13px] text-cream-muted">
        Switch any time from your profile menu — your existing videos &amp; followers stay with you.
      </p>
    </section>
  );
}

function StatTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/5 p-2">
      <span className="mb-1 inline-block text-cream-soft">{icon}</span>
      <strong className="block text-base font-bold text-cream">{value}</strong>
      <small className="block text-[10px] text-cream-muted">{label}</small>
    </div>
  );
}

const FREE_FEATURES: React.ReactNode[] = [
  '"Free" tier badge in profile',
  'Monthly quota meter (60 videos / 1 GB)',
  'Sponsored ads visible while watching',
  'Basic analytics (last 7 days only)',
  '"Upgrade" prompts in dropdown & sidebar',
  '720p playback quality',
  'Standard creator badge',
];

const PREMIUM_FEATURES: React.ReactNode[] = [
  '"Premium" verified badge throughout',
  'No quota meter — unlimited',
  'Ad-free — no banners or running text',
  'Full analytics + Premium Insights widget',
  'Quick access: Custom Thumbnails & Premium Insights',
  'Up to 4K playback quality',
  'Priority support button (live chat)',
];
