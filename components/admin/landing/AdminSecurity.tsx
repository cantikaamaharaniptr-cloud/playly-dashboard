// Security & Access — 6 numbered cards.
// Source: public/legacy/index.html #adminSecuritySection (lines 1803-1843).

import { AdminLandingHead } from './AdminLandingHead';

type SecurityCard = { num: string; title: string; desc: string };

const CARDS: SecurityCard[] = [
  {
    num: '01',
    title: 'Pre-seeded admin accounts',
    desc: 'Admin credentials are provisioned, never created via public sign-up. Regular sign-up cannot reach the admin panel.',
  },
  {
    num: '02',
    title: 'Two-factor authentication',
    desc: 'TOTP-based 2FA is required for super-admin actions. Codes verified in 30-second windows; lockout on repeated failures.',
  },
  {
    num: '03',
    title: 'Role-based permissions',
    desc: 'Super-admin, admin, and moderator scopes with strict boundaries. Sensitive panels require the higher role.',
  },
  {
    num: '04',
    title: 'Tamper-evident audit log',
    desc: 'Every suspend, takedown, role change, broadcast, and login is timestamped and attributed. Exportable for review.',
  },
  {
    num: '05',
    title: 'Session lockout',
    desc: 'Failed login attempts trigger a temporary cooldown. Repeated failures escalate to a longer lock with notification.',
  },
  {
    num: '06',
    title: 'Encrypted at rest & in transit',
    desc: 'All admin sessions, audit entries, and user data are encrypted. No plaintext secrets ever leave the platform.',
  },
];

export function AdminSecurity() {
  return (
    <section className="w-full px-6 py-14 sm:px-10 sm:py-20 lg:px-20 lg:py-24">
      <AdminLandingHead
        eyebrow="SECURITY & ACCESS"
        title="Built for trust, monitored end-to-end"
        subtitle="Admin access is restricted, every action is logged, and elevated changes require an extra step."
      />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <div
            key={c.num}
            className="rounded-[14px] border border-slate-accent/15 bg-slate-elev/60 p-6 transition-colors hover:border-slate-accent/30"
          >
            <div className="mb-3 font-mono text-[26px] font-bold leading-none text-slate-accent/60">
              {c.num}
            </div>
            <h3 className="m-0 mb-2 text-base font-bold text-white">
              {c.title}
            </h3>
            <p className="m-0 text-[13px] leading-[1.6] text-slate-accent">
              {c.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
