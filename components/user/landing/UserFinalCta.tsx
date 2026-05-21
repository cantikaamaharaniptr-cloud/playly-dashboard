// Final CTA section + mini footer — last section of user auth landing.
// Source: public/legacy/index.html #authFinalctaSection + .auth-mini-footer
// (lines 1471-1502).
//
// Modal trigger buttons (Privasi/Terms/Status/Support) currently no-op.
// When Phase 5+ migrates the info modal, wire these to open it. For now
// they're plain buttons that do nothing — preserves visual parity.

import { UserLandingHead } from './UserLandingHead';

export function UserFinalCta() {
  return (
    <section className="w-full px-6 py-14 sm:px-10 sm:py-20 lg:px-20 lg:py-24">
      <UserLandingHead
        eyebrow="READY TO START?"
        title="Join 12,000+ creators on Playly today"
        subtitle="Start free in under 30 seconds. Upgrade whenever you outgrow it."
      />

      <div className="mx-auto flex max-w-md flex-col items-stretch gap-3">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-wine px-6 py-3.5 text-sm font-bold text-cream shadow-playly-md transition-colors hover:bg-wine-hover"
          data-final-cta="signup"
        >
          <span>Get started free →</span>
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-cream/20 bg-transparent px-6 py-3.5 text-sm font-bold text-cream-soft transition-colors hover:bg-cream/5 hover:text-cream"
          data-final-cta="signin"
        >
          <span>I already have an account</span>
        </button>
      </div>

      <footer
        className="mx-auto mt-10 flex max-w-md flex-col items-center gap-1.5"
        aria-label="Footer"
      >
        <div className="inline-flex items-center gap-3 text-xs">
          <FootLink action="privasi">Privasi</FootLink>
          <FootSep />
          <FootLink action="terms">Terms</FootLink>
          <FootSep />
          <FootLink action="status">Status</FootLink>
          <FootSep />
          <FootLink action="support">Support</FootLink>
        </div>
        <div className="text-[11px] tracking-[0.3px] text-cream-muted">
          © 2026 Playly · v1.0.0 · Crafted with care
        </div>
      </footer>
    </section>
  );
}

function FootLink({
  action,
  children,
}: {
  action: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-amf-open={action}
      className="font-semibold text-cream-soft transition-colors hover:text-cream hover:underline"
    >
      {children}
    </button>
  );
}

function FootSep() {
  return (
    <span className="text-[11px] text-cream/25" aria-hidden="true">
      ·
    </span>
  );
}
