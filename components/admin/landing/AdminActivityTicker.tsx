// Live activity ticker — admin landing marquee bar. Server Component;
// animation lives in CSS module (no JS state, pure CSS keyframe scroll).
// Source: public/legacy/index.html #adminActivitySection (lines 1523-1559).
//
// Items are static marketing copy (fake "live" activity) — not real data.
// When the admin dashboard reads real moderation logs, this stays on the
// landing page and renders different content via a Server Component fetch.

import styles from './AdminActivityTicker.module.css';

type TickerKind = 'mod' | 'user' | 'vid' | 'rev' | 'comm' | '2fa';

type TickerItem = {
  kind: TickerKind;
  text: React.ReactNode;
};

const ITEMS: readonly TickerItem[] = [
  { kind: 'mod', text: '12 laporan ditinjau dalam jam terakhir' },
  { kind: 'user', text: '@creator44 di-suspend karena pelanggaran ToS' },
  { kind: 'vid', text: 'Video #2841 dihapus · 1 banding tertunda' },
  { kind: 'rev', text: '$4.820 pendapatan iklan hari ini · MRR naik 6,2%' },
  { kind: 'comm', text: 'Broadcast terkirim ke 12.408 kreator' },
  { kind: '2fa', text: '3 sesi admin baru terverifikasi via 2FA' },
];

export function AdminActivityTicker() {
  return (
    <section className="w-full">
      <div className="flex items-stretch overflow-hidden border-y border-slate-accent/20 bg-[rgba(28,40,60,0.85)] backdrop-blur backdrop-saturate-150">
        <span className="inline-flex flex-shrink-0 items-center gap-2 border-r border-slate-accent/16 bg-[rgba(42,58,82,0.92)] px-5 py-3 font-mono text-[11px] font-extrabold tracking-[2px] text-white/90">
          <span
            className={`${styles.dot} h-2 w-2 rounded-full bg-white shadow-[0_0_0_4px_rgba(173,181,189,0.10),0_0_6px_rgba(255,255,255,0.40)]`}
          />
          <b>LIVE</b>
        </span>
        <div className={`${styles.marquee} relative flex-1 overflow-hidden`}>
          <div className={styles.track}>
            <TickerLoop items={ITEMS} />
            {/* Duplicated so the scroll wraps seamlessly at -50% */}
            <TickerLoop items={ITEMS} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TickerLoop({ items }: { items: readonly TickerItem[] }) {
  return (
    <>
      {items.map((item, i) => (
        <span key={i} className="contents">
          <span className="inline-flex items-center gap-2 px-[18px] text-[13px] font-medium text-slate-200/75">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                item.kind === '2fa'
                  ? 'bg-slate-accent/30'
                  : 'bg-slate-accent/60'
              }`}
              aria-hidden="true"
            />
            {item.text}
          </span>
          <span
            className="px-1 font-bold text-slate-accent/30"
            aria-hidden="true"
          >
            ·
          </span>
        </span>
      ))}
    </>
  );
}
