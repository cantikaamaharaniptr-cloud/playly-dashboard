// Left panel for admin sign-in page — chrome silver brand, restricted-access
// pill, ops-focused hero, monitoring ticker, play orb + floating cards.
// Source: public/legacy/index.html .auth-left-admin (lines 704-783).

import styles from './AuthShowcase.module.css';

export function AdminAuthShowcase() {
  return (
    <div className="relative flex flex-col gap-7 overflow-hidden p-8 sm:p-12 lg:p-16">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 flex-shrink-0 place-items-center">
          <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="h-12 w-12"
          >
            <defs>
              <linearGradient id="plyl-au-admin" x1="10%" y1="0%" x2="90%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="30%" stopColor="#FFFFFF" />
                <stop offset="70%" stopColor="#3C5078" />
                <stop offset="100%" stopColor="#1C283C" />
              </linearGradient>
            </defs>
            <path
              fill="url(#plyl-au-admin)"
              fillRule="evenodd"
              d="M 30 6 L 60 6 C 80 6 92 22 92 38 C 92 58 76 70 56 70 L 42 70 L 42 92 C 42 97 38 98 32 98 C 26 98 22 97 22 92 L 22 14 C 22 10 26 6 30 6 Z M 42 22 L 56 22 C 66 22 72 30 72 38 C 72 46 66 54 56 54 L 42 54 Z"
            />
          </svg>
        </div>
        <div>
          <h1 className="m-0 text-3xl font-extrabold leading-none text-white">
            Playly<span className="text-slate-accent">.</span>
          </h1>
          <p className="m-0 text-[10px] font-bold tracking-[2px] text-slate-accent/80">
            ADMIN CONTROL CENTER
          </p>
        </div>
      </div>

      {/* Restricted pill */}
      <div className="inline-flex items-center gap-2 self-start rounded-full border border-status-warning/30 bg-status-warning/10 px-3 py-1.5 text-xs text-status-warning">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-warning opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-status-warning" />
        </span>
        <span className="font-semibold uppercase tracking-wider">
          Administrators Only
        </span>
      </div>

      {/* Hero title + desc */}
      <div>
        <h2 className="m-0 text-[clamp(32px,4.5vw,52px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-white">
          Manage the platform,
          <br />
          <span className="bg-gradient-to-r from-white via-slate-accent to-slate-deep bg-clip-text text-transparent">
            protect the community
          </span>
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-[1.6] text-slate-accent">
          Administrator dashboard for content moderation, real-time analytics,
          user management, ads, and platform revenue.
        </p>
      </div>

      {/* Stats */}
      <div className="grid max-w-md grid-cols-3 gap-4 border-t border-slate-accent/15 pt-6">
        <Stat value="24/7" label="Active monitoring" />
        <Stat value="100%" label="Access control" />
        <Stat value="Real" label="Time analytics" />
      </div>

      {/* Monitoring ticker */}
      <div className="inline-flex items-center gap-2 self-start rounded-md border border-slate-accent/20 bg-slate-elev/40 px-3 py-2 font-mono text-xs">
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-success" />
        </span>
        <span className="font-bold tracking-wider text-slate-accent">MONITORING</span>
        <b className="text-white">12,408</b>
        <span className="text-slate-accent/70">sessions</span>
      </div>

      {/* Animated illustration — shield orb + floating cards */}
      <div className={`${styles.illus} hidden lg:block`} aria-hidden="true">
        <div className={`${styles.card} ${styles.adminCard} ${styles.f1}`}>
          <span>🛡</span>
          <b>Active moderation</b>
        </div>
        <div className={`${styles.card} ${styles.adminCard} ${styles.f2}`}>
          <span>📊</span>
          <b>+12.4% growth</b>
        </div>
        <div className={`${styles.card} ${styles.adminCard} ${styles.f3}`}>
          <span>💰</span>
          <b>Revenue tracker</b>
        </div>
        <div className={`${styles.orb} ${styles.adminOrb}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 4 6v6c0 5 3.5 8.7 8 10 4.5-1.3 8-5 8-10V6l-8-4Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <b className="block text-2xl font-extrabold text-white">{value}</b>
      <span className="block text-[11px] text-slate-accent/70">{label}</span>
    </div>
  );
}
