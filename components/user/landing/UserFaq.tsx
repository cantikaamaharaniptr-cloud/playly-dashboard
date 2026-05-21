// User landing FAQ — 10 Q&A accordion. Server Component.
// Source: public/legacy/index.html #authFaqSection (lines 1418-1466).

import { USER_FAQ } from '@/lib/user/faq-data';
import { UserLandingHead } from './UserLandingHead';
import styles from './UserFaq.module.css';

export function UserFaq() {
  return (
    <section className="w-full px-6 py-14 sm:px-10 sm:py-20 lg:px-20 lg:py-24">
      <UserLandingHead
        eyebrow="FAQ"
        title="Questions? We've got answers"
        subtitle="Everything you need to know about Free vs Premium — answered."
      />
      <div className="mx-auto grid max-w-[880px] gap-2.5">
        {USER_FAQ.map((item, i) => (
          <details
            key={i}
            className={`${styles.item} group rounded-xl border border-cream/15 bg-ink-elev/50 px-[18px] py-[14px] transition-colors hover:border-cream/30 [&[open]]:border-cream/30 [&[open]]:bg-ink-elev/70`}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-[14.5px] font-bold text-cream">
              {item.q}
            </summary>
            <p className="mb-1 mt-3 text-[13.5px] leading-[1.65] text-cream-soft">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
