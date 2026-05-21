// Plans — 2 plan cards (Free, Premium). Server Component.
// Source: public/legacy/index.html #authPlansSection (lines 1140-1199).

import { UserLandingHead } from './UserLandingHead';

type PlanFeature = string | React.ReactNode;

type Plan = {
  variant: 'free' | 'premium';
  badge: string;
  name: string;
  price: string;
  tagline: string;
  features: PlanFeature[];
  cta: string;
};

const PLANS: Plan[] = [
  {
    variant: 'free',
    badge: 'Most popular',
    name: 'Free',
    price: '$0',
    tagline: 'Perfect for hobbyists & casual creators just getting started.',
    features: [
      <><b>60 video uploads</b> per month</>,
      <><b>1 GB</b> upload storage per month</>,
      <>Standard quality (up to <b>720p</b>)</>,
      <>Basic analytics (<b>last 7 days</b> only)</>,
      <>Manual title, description & subtitle — <b>no AI assist</b></>,
      'Sponsored ads shown on your videos',
      'Standard support (24-48h reply)',
      'Standard creator badge',
    ],
    cta: 'Sign Up Free',
  },
  {
    variant: 'premium',
    badge: 'Recommended',
    name: 'Premium',
    price: '$9',
    tagline: 'For serious creators who want zero limits & extra reach.',
    features: [
      <><b>Unlimited</b> video uploads — no monthly quota</>,
      <><b>Unlimited</b> upload storage</>,
      <>High quality (up to <b>4K</b>)</>,
      <>Full analytics + <b>Premium Insights</b></>,
      <><b>AI Assist</b> — auto title, description & tags</>,
      <><b>AI auto-subtitles</b> from your video audio</>,
      <><b>Ad-free</b> — no banners or running text</>,
      'Priority support (live chat)',
      <>Verified <b>Premium</b> badge</>,
      'Custom thumbnails',
      'Early access to new features',
    ],
    cta: 'Get Premium',
  },
];

export function UserPlans() {
  return (
    <section className="w-full px-6 py-14 sm:px-10 sm:py-20 lg:px-20 lg:py-24">
      <UserLandingHead
        eyebrow="PRICING"
        title="Choose the plan that fits you"
        subtitle="Start free. Upgrade anytime to unlock unlimited everything."
      />

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2">
        {PLANS.map((p) => (
          <article
            key={p.variant}
            className={`relative flex flex-col gap-4 rounded-[18px] border p-7 ${
              p.variant === 'premium'
                ? 'border-cream/30 bg-gradient-to-br from-wine/15 to-ink-elev/70 ring-1 ring-cream/10'
                : 'border-cream/15 bg-ink-elev/50'
            }`}
          >
            {/* Badge */}
            <div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[1px] ${
                  p.variant === 'premium'
                    ? 'bg-sand-accent/20 text-sand-accent'
                    : 'bg-cream/10 text-cream-soft'
                }`}
              >
                {p.variant === 'premium' ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-3 w-3"
                    aria-hidden="true"
                  >
                    <path d="M12 2.6l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9l-5.6 2.9 1.3-6.3-4.8-4.3 6.4-.7z" />
                  </svg>
                ) : null}
                {p.badge}
              </span>
            </div>

            {/* Name + Price */}
            <div>
              <h3 className="m-0 text-2xl font-extrabold text-cream">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <strong className="text-4xl font-extrabold text-cream">{p.price}</strong>
                <span className="text-sm text-cream-muted">/month</span>
              </div>
              <p className="mt-2 m-0 text-[13.5px] leading-[1.55] text-cream-soft">
                {p.tagline}
              </p>
            </div>

            {/* Features */}
            <ul className="m-0 flex flex-1 flex-col gap-2.5 p-0">
              {p.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-cream-soft">
                  <CheckIcon variant={p.variant} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              type="button"
              data-plan-pick={p.variant}
              className={`mt-2 inline-flex items-center justify-center rounded-[12px] px-6 py-3.5 text-sm font-bold transition-colors ${
                p.variant === 'premium'
                  ? 'bg-wine text-cream shadow-playly-md hover:bg-wine-hover'
                  : 'border border-cream/20 bg-transparent text-cream-soft hover:bg-cream/5 hover:text-cream'
              }`}
            >
              {p.cta}
            </button>
          </article>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-[600px] text-center text-[13px] text-cream-muted">
        All plans include: cloud sync, encrypted storage, mobile-friendly playback, and access to community features.
      </p>
    </section>
  );
}

function CheckIcon({ variant }: { variant: 'free' | 'premium' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
        variant === 'premium' ? 'text-sand-accent' : 'text-cream-soft'
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
