// Dashboard Preview — fake admin console frame with mini topbar, KPI row,
// chart, audit feed, and moderation queue. Static (no real data, no
// animation — legacy KPI count-up animation skipped at this phase).
// Source: public/legacy/index.html #adminPreviewSection (lines 1655-1801).

import { AdminLandingHead } from './AdminLandingHead';

type Kpi = { label: string; value: string; trend: string; up: boolean };

const KPIS: Kpi[] = [
  { label: 'Active Users', value: '12,408', trend: '+6.2%', up: true },
  { label: 'Reports Today', value: '42', trend: '+3', up: true },
  { label: 'Revenue (MTD)', value: '$48,230', trend: '+12.4%', up: true },
  { label: 'Avg Watch (h)', value: '84', trend: '-1.2%', up: false },
];

type LogRow = {
  time: string;
  badge: string;
  badgeKind: 'warn' | 'danger' | 'info' | 'success';
  target: string;
};

const LOG: LogRow[] = [
  { time: '14:02', badge: 'SUSPEND', badgeKind: 'warn', target: '@user_84 · ToS violation' },
  { time: '14:03', badge: 'TAKEDOWN', badgeKind: 'danger', target: 'video #2841' },
  { time: '14:05', badge: 'ROLE', badgeKind: 'info', target: '@mod22 → admin' },
  { time: '14:08', badge: 'RESTORE', badgeKind: 'success', target: 'video #2799' },
  { time: '14:11', badge: 'VERIFY', badgeKind: 'info', target: 'verified · admin@playly' },
];

const BADGE_CLASS: Record<LogRow['badgeKind'], string> = {
  warn: 'bg-status-warning/20 text-status-warning',
  danger: 'bg-status-danger/20 text-status-danger',
  info: 'bg-slate-accent/20 text-slate-accent',
  success: 'bg-status-success/20 text-status-success',
};

type QueueItem = {
  title: string;
  meta: string;
  cta: string;
  ctaKind: 'warn' | 'success';
};

const QUEUE: QueueItem[] = [
  {
    title: '"Highlight reel — Match 42"',
    meta: '@aria.creates · 3 reports · age:gore',
    cta: 'Review',
    ctaKind: 'warn',
  },
  {
    title: '"Tutorial: Smooth transitions"',
    meta: '@mayalive · 1 report · false-flag',
    cta: 'Approve',
    ctaKind: 'success',
  },
  {
    title: '"Late-night gaming session"',
    meta: '@rizkyplay · 2 reports · low-quality',
    cta: 'Approve',
    ctaKind: 'success',
  },
];

export function AdminPreviewConsole() {
  return (
    <section className="w-full px-6 py-14 sm:px-10 sm:py-20 lg:px-20 lg:py-24">
      <AdminLandingHead
        eyebrow="PREVIEW"
        title="Inside the dashboard"
        subtitle="A glimpse of what platform admins actually see — real-time KPIs, live audit feed, and the moderation queue."
      />

      <div className="mx-auto max-w-5xl overflow-hidden rounded-[18px] border border-slate-accent/20 bg-slate-bg shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        {/* Mini topbar */}
        <div className="flex items-center justify-between border-b border-slate-accent/15 bg-gradient-to-b from-[rgba(22,32,47,0.96)] to-[rgba(13,20,31,0.97)] px-4 py-2.5">
          <span className="inline-flex items-center gap-2 text-white">
            <svg
              viewBox="0 0 100 100"
              className="h-5 w-5"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M 30 6 L 60 6 C 80 6 92 22 92 38 C 92 58 76 70 56 70 L 42 70 L 42 92 C 42 97 38 98 32 98 C 26 98 22 97 22 92 L 22 14 C 22 10 26 6 30 6 Z M 42 22 L 56 22 C 66 22 72 30 72 38 C 72 46 66 54 56 54 L 42 54 Z"
              />
            </svg>
            <b className="font-bold">Playly</b>
            <span className="rounded-sm bg-slate-accent/20 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-slate-accent">
              ADMIN
            </span>
          </span>
          <span className="hidden gap-1 text-xs sm:inline-flex">
            <PreviewNavItem active>Dashboard</PreviewNavItem>
            <PreviewNavItem>Users</PreviewNavItem>
            <PreviewNavItem>Videos</PreviewNavItem>
            <PreviewNavItem>Audit</PreviewNavItem>
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-white/80">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-accent/20 font-bold text-slate-accent">
              A
            </span>
            <span className="hidden sm:inline">Admin</span>
          </span>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {KPIS.map((k) => (
              <div
                key={k.label}
                className="rounded-[10px] border border-slate-accent/15 bg-slate-elev/60 p-3.5"
              >
                <div className="text-[11px] uppercase tracking-[1px] text-slate-accent/70">
                  {k.label}
                </div>
                <div className="my-1 font-mono text-xl font-bold text-white">
                  {k.value}
                </div>
                <div
                  className={`text-[11px] font-bold ${k.up ? 'text-status-success' : 'text-status-danger'}`}
                >
                  {k.trend}
                </div>
              </div>
            ))}
          </div>

          {/* Chart + audit feed */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr]">
            {/* Chart card */}
            <div className="rounded-[10px] border border-slate-accent/15 bg-slate-elev/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <strong className="text-sm text-white">
                  Active Users · Last 7 Days
                </strong>
                <LiveTag />
              </div>
              <svg
                viewBox="0 0 400 130"
                preserveAspectRatio="none"
                className="block h-[120px] w-full"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="apfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(220,211,169,.45)" />
                    <stop offset="100%" stopColor="rgba(220,211,169,0)" />
                  </linearGradient>
                </defs>
                <polygon
                  points="0,90 50,80 100,82 150,55 200,65 250,38 300,48 350,22 400,30 400,130 0,130"
                  fill="url(#apfGrad)"
                />
                <polyline
                  points="0,90 50,80 100,82 150,55 200,65 250,38 300,48 350,22 400,30"
                  fill="none"
                  stroke="#DCD3A9"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="400" cy="30" r="4" fill="#DCD3A9" />
              </svg>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-accent/60">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>

            {/* Audit feed card */}
            <div className="rounded-[10px] border border-slate-accent/15 bg-slate-elev/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <strong className="text-sm text-white">Audit Feed</strong>
                <LiveTag />
              </div>
              <div className="grid gap-1.5">
                {LOG.map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <span className="font-mono text-[10px] text-slate-accent/60">
                      {row.time}
                    </span>
                    <span
                      className={`rounded-sm px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.5px] ${BADGE_CLASS[row.badgeKind]}`}
                    >
                      {row.badge}
                    </span>
                    <span className="truncate text-slate-accent">
                      {row.target}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Moderation queue */}
          <div className="rounded-[10px] border border-slate-accent/15 bg-slate-elev/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <strong className="text-sm text-white">
                Moderation Queue · 8 pending
              </strong>
              <span className="font-mono text-[11px] text-slate-accent/70">
                Avg response: 4m 12s
              </span>
            </div>
            <div className="grid gap-2">
              {QUEUE.map((q, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md border border-slate-accent/10 bg-slate-bg/50 px-3 py-2"
                >
                  <span
                    className={`h-10 w-12 flex-shrink-0 rounded bg-gradient-to-br ${
                      i === 0
                        ? 'from-slate-accent/40 to-slate-deep'
                        : i === 1
                          ? 'from-status-success/40 to-slate-deep'
                          : 'from-slate-khaki/40 to-slate-deep'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-[13px] text-white">
                      {q.title}
                    </strong>
                    <small className="block truncate text-[11px] text-slate-accent">
                      {q.meta}
                    </small>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-[0.5px] ${
                      q.ctaKind === 'warn'
                        ? 'bg-status-warning/20 text-status-warning'
                        : 'bg-status-success/20 text-status-success'
                    }`}
                  >
                    {q.cta}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewNavItem({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded-md px-2.5 py-1 ${
        active ? 'bg-slate-accent/20 text-white' : 'text-slate-accent/70'
      }`}
    >
      {children}
    </span>
  );
}

function LiveTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-status-success/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[1px] text-status-success">
      <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-status-success" />
      LIVE
    </span>
  );
}
