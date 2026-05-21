// FAQ section — Server Component, native <details> for accordion behavior.
// Phase 4 first slice. Source: public/legacy/index.html #adminFaqSection.

import { ADMIN_FAQ } from '@/lib/admin/faq-data';
import { AdminLandingHead } from './AdminLandingHead';
import styles from './AdminFaq.module.css';

export function AdminFaq() {
  return (
    <section className="w-full px-6 py-14 sm:px-10 sm:py-20 lg:px-20 lg:py-24">
      <AdminLandingHead
        eyebrow="FAQ"
        title="Admin questions, answered"
        subtitle="The most common questions from new platform administrators."
      />
      <div className="mx-auto grid max-w-[880px] gap-2.5">
        {ADMIN_FAQ.map((item, i) => (
          <details
            key={i}
            className={`${styles.item} group rounded-xl border border-slate-accent/15 bg-slate-elev/30 px-[18px] py-[14px] transition-colors hover:border-slate-accent/30 [&[open]]:border-slate-accent/30 [&[open]]:bg-slate-elev/45`}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-[14.5px] font-bold text-white">
              {item.q}
            </summary>
            <p className="mb-1 mt-3 text-[13.5px] leading-[1.65] text-slate-accent">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
