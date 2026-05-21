// Reusable header for each admin landing section. Mirrors legacy
// .admin-landing-head structure (eyebrow chip + h2 + lead p), centered with
// a max-width matching styles.css :720px.

export function AdminLandingHead({
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
      <span className="mb-3 inline-block rounded border border-slate-accent/30 bg-slate-elev/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[3px] text-slate-accent">
        {eyebrow}
      </span>
      <h2 className="m-0 mb-3 text-[clamp(26px,3.4vw,40px)] font-extrabold leading-[1.18] tracking-[-0.5px] text-white">
        {title}
      </h2>
      {subtitle ? (
        <p className="m-0 text-[15px] leading-[1.6] text-slate-accent">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
