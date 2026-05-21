// 8 capability modules grid — admin landing section.
// Source: public/legacy/index.html #adminModulesSection (lines 1561-1651).
// Pure Tailwind, no module CSS — cards are static, no animations needed.

import { AdminLandingHead } from './AdminLandingHead';

type ModuleCard = {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tag: string;
  variant?: 'spark' | 'pulse';
  extra?: React.ReactNode;
};

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const MODULES: ModuleCard[] = [
  {
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path d="M12 2 4 6v6c0 5 3.5 8.7 8 10 4.5-1.3 8-5 8-10V6l-8-4Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    title: 'Content Moderation',
    desc: 'Review reports, take down policy violations, restore false flags, and keep the feed safe at scale.',
    tag: 'Real-time queue',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'User Management',
    desc: 'Search every account, inspect activity, suspend or restore, promote moderators, and manage roles.',
    tag: 'Role-based',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
    title: 'Video Management',
    desc: 'Approve or remove uploads, tag featured creators, audit takedown decisions across the catalog.',
    tag: 'Catalog-wide',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: 'Communications',
    desc: 'Direct chat with users, respond to support tickets, and send platform-wide broadcast announcements.',
    tag: 'Inbox + Broadcast',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 4 4 5-5" />
      </svg>
    ),
    title: 'Analytics',
    desc: 'Real-time charts: signups, active users, watch hours, revenue trend, and retention by cohort.',
    tag: 'Live data',
    variant: 'spark',
    extra: (
      <svg
        viewBox="0 0 120 32"
        fill="none"
        aria-hidden="true"
        className="my-1 h-8 w-full text-slate-accent/80"
      >
        <polyline
          points="2,26 14,20 26,22 38,14 50,18 62,8 74,12 86,4 98,10 110,2 118,6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Audit Log',
    desc: 'Every admin action recorded with timestamp, actor, target, and reason. Filter, export, and verify.',
    tag: 'Tamper-evident',
    variant: 'pulse',
    extra: (
      <div
        className="my-1 grid gap-1 font-mono text-[11px] text-slate-accent/70"
        aria-hidden="true"
      >
        <span>[14:02] suspend @user_84</span>
        <span>[14:03] takedown #2841</span>
        <span>[14:05] role admin → mod</span>
      </div>
    ),
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 3v4M8 3v4M2 11h20" />
      </svg>
    ),
    title: 'Ads & Sponsorships',
    desc: 'Configure ad slots, approve advertisers, schedule campaigns, and monitor revenue per impression.',
    tag: 'Yield-aware',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: 'Revenue',
    desc: 'Track Premium subscriptions, ad revenue, and creator payouts. Reconcile balances and exports.',
    tag: 'MRR + Payouts',
  },
];

export function AdminModules() {
  return (
    <section className="w-full px-6 py-14 sm:px-10 sm:py-20 lg:px-20 lg:py-24">
      <AdminLandingHead
        eyebrow="CONTROL CENTER"
        title="Everything you need to run the platform"
        subtitle="Eight integrated modules built for moderation, growth, revenue, and operational visibility."
      />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m, i) => (
          <article
            key={i}
            className="relative flex flex-col gap-2.5 rounded-[14px] border border-slate-accent/15 bg-slate-elev p-5 pt-5.5 transition-colors hover:border-slate-accent/30"
          >
            <div className="grid h-9 w-9 place-items-center rounded-[10px] border border-slate-accent/15 bg-slate-bg/60 text-slate-accent">
              <span className="block h-5 w-5">{m.icon}</span>
            </div>
            <h3 className="m-0 text-[15px] font-bold leading-tight text-white">
              {m.title}
            </h3>
            <p className="m-0 text-[13px] leading-[1.55] text-slate-accent">
              {m.desc}
            </p>
            {m.extra}
            <span
              className={`mt-auto inline-flex items-center gap-1.5 self-start rounded-[6px] border border-slate-accent/20 bg-slate-bg/40 px-2 py-1 text-[10.5px] font-bold uppercase tracking-[1px] ${
                m.variant === 'spark'
                  ? 'text-status-success'
                  : 'text-slate-accent'
              }`}
            >
              {m.variant === 'spark' ? (
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-status-success" />
              ) : null}
              {m.tag}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
