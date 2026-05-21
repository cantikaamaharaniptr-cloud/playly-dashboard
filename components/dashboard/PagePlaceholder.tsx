// Shared placeholder component for dashboard pages yang shell-nya udah
// jadi tapi konten realnya belum di-migrate. Setiap page punya icon +
// title + description + list-of-pending-features.
//
// Hapus pemakaian PagePlaceholder per page saat konten real-nya ke-migrate
// (Phase 7b session per session).

export function PagePlaceholder({
  eyebrow,
  title,
  description,
  features,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  features?: readonly string[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-cream-muted">
          {eyebrow}
        </p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold text-cream">
          {icon ? <span className="text-cream-soft">{icon}</span> : null}
          {title}
        </h1>
        <p className="mt-1 text-sm text-cream-soft">{description}</p>
      </header>

      <div className="rounded-[14px] border border-dashed border-cream/20 bg-ink-elev/40 p-8">
        <div className="mx-auto max-w-md text-center">
          <p className="text-sm font-semibold text-cream-soft">
            Halaman ini sedang dimigrasi ke Next.js
          </p>
          <p className="mt-1 text-xs text-cream-muted">
            Shell + routing sudah ready. Konten real akan dibangun di session
            berikutnya sesuai prioritas.
          </p>

          {features && features.length > 0 ? (
            <ul className="mt-5 grid gap-2 text-left">
              {features.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-md bg-ink/40 px-3 py-2 text-xs text-cream-soft"
                >
                  <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cream/30" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Inline stroke icon component for page headers.
export function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
