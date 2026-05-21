// Left panel of the 2-column auth screen: brand, hero, live pill, stats,
// + animated play orb with floating notification cards (legacy parity).
// Source: public/legacy/index.html .auth-left (lines 383-444).

import styles from './AuthShowcase.module.css';

export function AuthShowcase() {
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
              <linearGradient id="plyl-au" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6D2932" />
                <stop offset="45%" stopColor="#C7B7A3" />
                <stop offset="100%" stopColor="#E8D8C4" />
              </linearGradient>
            </defs>
            <path
              fill="url(#plyl-au)"
              fillRule="evenodd"
              d="M 30 6 L 60 6 C 80 6 92 22 92 38 C 92 58 76 70 56 70 L 42 70 L 42 92 C 42 97 38 98 32 98 C 26 98 22 97 22 92 L 22 14 C 22 10 26 6 30 6 Z M 42 22 L 56 22 C 66 22 72 30 72 38 C 72 46 66 54 56 54 L 42 54 Z"
            />
          </svg>
        </div>
        <div>
          <h1 className="m-0 text-3xl font-extrabold leading-none text-cream">
            Playly<span className="text-wine">.</span>
          </h1>
          <p className="m-0 text-[10px] font-bold tracking-[2px] text-cream-muted">
            VIDEO PLATFORM
          </p>
        </div>
      </div>

      {/* Live pill */}
      <div className="inline-flex items-center gap-2 self-start rounded-full border border-cream/15 bg-ink-elev/70 px-3 py-1.5 text-xs text-cream-soft">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-status-success" />
        </span>
        <span>Live now — 12,408 creators online</span>
      </div>

      {/* Hero title + desc */}
      <div>
        <h2 className="m-0 text-[clamp(32px,4.5vw,52px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-cream">
          Share your creation,
          <br />
          <span className="bg-gradient-to-r from-wine via-cream-soft to-cream bg-clip-text text-transparent">
            touch the world
          </span>
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-[1.6] text-cream-soft">
          Modern video platform for creators. Upload, watch, and connect with
          millions of amazing fellow creators.
        </p>
      </div>

      {/* Stats */}
      <div className="grid max-w-md grid-cols-3 gap-4 border-t border-cream/10 pt-6">
        <Stat value="12k+" label="Active creators" />
        <Stat value="2.4M" label="Videos" />
        <Stat value="89M" label="Views/month" />
      </div>

      {/* Animated illustration — play orb + floating cards */}
      <div className={`${styles.illus} hidden lg:block`} aria-hidden="true">
        <div className={`${styles.card} ${styles.f1}`}>
          <span>▶</span>
          <b>Trending now</b>
        </div>
        <div className={`${styles.card} ${styles.f2}`}>
          <span>♥</span>
          <b>+1.2k likes</b>
        </div>
        <div className={`${styles.card} ${styles.f3}`}>
          <span>👁</span>
          <b>24.8k views</b>
        </div>
        <div className={styles.orb}>
          <svg viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <b className="block text-2xl font-extrabold text-cream">{value}</b>
      <span className="block text-[11px] text-cream-muted">{label}</span>
    </div>
  );
}
