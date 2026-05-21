// Reusable card wrapper for each settings panel (Akun, Bahasa, dst).
// Server-component friendly — pure layout, no state.

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-cream/15 bg-ink-elev/50 p-6">
      <header className="mb-4">
        <h2 className="m-0 text-base font-bold text-cream">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-cream-soft">{description}</p>
        ) : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function SettingsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-cream-soft">{label}</label>
      {children}
      {hint ? <p className="text-[11px] text-cream-muted">{hint}</p> : null}
    </div>
  );
}
