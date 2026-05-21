// How it works — 6 step grid. Server Component.
// Source: public/legacy/index.html #authHowitSection (lines 1339-1413).

import { UserLandingHead } from './UserLandingHead';

type Step = { icon: string; title: string; desc: string };

const STEPS: Step[] = [
  {
    icon: '✨',
    title: 'Sign up free',
    desc: "Create your account in 30 seconds. Free forever, no credit card needed. Premium upgrade is one click away whenever you're ready.",
  },
  {
    icon: '🎨',
    title: 'Customize your profile',
    desc: 'Add an avatar, banner, bio, and links to your other socials. Build the brand that makes fans remember you.',
  },
  {
    icon: '📤',
    title: 'Upload your video',
    desc: 'Drag & drop any video file. Auto-thumbnail, auto-encode, instant preview. Free up to 1 GB/month, Premium unlimited.',
  },
  {
    icon: '💬',
    title: 'Share & engage',
    desc: 'Share on socials with one click. Reply to comments, DM fans, build your community right inside the dashboard.',
  },
  {
    icon: '📈',
    title: 'Grow with insights',
    desc: 'Track views, likes, watch time, top regions. Premium unlocks advanced engagement metrics & predictive trends.',
  },
  {
    icon: '⭐',
    title: 'Upgrade & monetize',
    desc: 'Unlock 4K, ad-free, custom thumbnails, and priority support with Premium. Earn from your creator badge & verified status.',
  },
];

export function UserHowItWorks() {
  return (
    <section className="w-full px-6 py-14 sm:px-10 sm:py-20 lg:px-20 lg:py-24">
      <UserLandingHead
        eyebrow="HOW IT WORKS"
        title="From signup to growing creator in 6 steps"
        subtitle="No tech skills needed — Playly handles the heavy lifting."
      />
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className="group flex flex-col gap-3 rounded-[14px] border border-cream/15 bg-ink-elev/50 p-6 transition-colors hover:border-cream/30"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-cream/30 bg-ink/60 font-mono text-sm font-bold text-cream-soft">
                {i + 1}
              </div>
              <div className="text-2xl leading-none" aria-hidden="true">
                {s.icon}
              </div>
            </div>
            <div>
              <h3 className="m-0 mb-1.5 text-base font-bold text-cream">
                {s.title}
              </h3>
              <p className="m-0 text-[13px] leading-[1.6] text-cream-soft">
                {s.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
