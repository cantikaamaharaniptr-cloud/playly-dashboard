// Restricted access footer — Server Component. Lock icon, heading,
// description with link to creator app, footer nav, copyright.
// Source: public/legacy/index.html #adminFootSection (lines 1965-1986).

export function AdminFoot() {
  return (
    <section className="-mt-14 px-6 pb-12 pt-0 sm:px-10 lg:px-20">
      <div className="mx-auto flex max-w-[720px] flex-col items-center gap-2.5 text-center">
        <div className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-accent">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-[22px] w-[22px]"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="flex flex-col items-center">
          <strong className="mb-2.5 block text-[clamp(20px,2.4vw,28px)] font-extrabold leading-[1.2] tracking-[-0.01em] text-white">
            Restricted access — administrators only
          </strong>
          <p className="m-0 text-sm leading-[1.6] text-slate-accent">
            This panel manages live user data and platform revenue. Sign-in
            attempts are rate-limited and logged. If you don&apos;t have an
            admin account, return to the{' '}
            <a
              href="/"
              className="text-slate-accent underline underline-offset-[3px] hover:text-white"
            >
              creator app
            </a>
            .
          </p>
        </div>
        <nav
          className="mt-2.5 inline-flex items-center gap-3 text-xs"
          aria-label="Footer links"
        >
          <FootLink href="#" action="privacy">
            Privacy
          </FootLink>
          <FootSep />
          <FootLink href="#" action="terms">
            Terms
          </FootLink>
          <FootSep />
          <FootLink href="#" action="status">
            Status
          </FootLink>
          <FootSep />
          <FootLink href="#" action="support">
            Support
          </FootLink>
        </nav>
        <p className="mt-1 text-[11px] tracking-[0.3px] text-white/45">
          © 2026 Playly · v1.0.0 · Crafted with care
        </p>
      </div>
    </section>
  );
}

function FootLink({
  href,
  action,
  children,
}: {
  href: string;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      data-foot-action={action}
      className="font-semibold text-white/75 transition-colors hover:text-white hover:underline"
    >
      {children}
    </a>
  );
}

function FootSep() {
  return (
    <span className="text-[11px] text-white/25" aria-hidden="true">
      ·
    </span>
  );
}
