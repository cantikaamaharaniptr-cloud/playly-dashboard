// Reusable section header for user landing — mirrors AdminLandingHead but
// uses user-side cream/wine palette (eyebrow chip in cream-soft over ink).

export function UserLandingHead({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto mb-9 max-w-[720px] text-center">
      <span className="mb-3 inline-block rounded border border-cream/20 bg-ink-elev/50 px-3 py-1 text-[11px] font-bold uppercase tracking-[3px] text-cream-soft">
        {eyebrow}
      </span>
      <h2 className="m-0 mb-3 text-[clamp(26px,3.4vw,40px)] font-extrabold leading-[1.18] tracking-[-0.5px] text-cream">
        {title}
      </h2>
      {subtitle ? (
        <p className="m-0 text-[15px] leading-[1.6] text-cream-soft">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
