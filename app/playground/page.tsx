// Phase 2 smoke-test route. Not linked from anywhere — visit /playground
// manually to verify Tailwind tokens, Inter font, and CSS variables work.
// Safe to keep around during migration; remove at Phase 7 cutover.

export const metadata = {
  title: 'Playly — Design Playground',
  robots: { index: false, follow: false },
};

export default function PlaygroundPage() {
  return (
    <main className="min-h-screen p-8 sm:p-12">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-cream-soft/70">
            Phase 2 · Design Foundation
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-cream">
            Playly Token Smoke Test
          </h1>
          <p className="text-cream-soft">
            Halaman ini cuma untuk verifikasi: kalau warna, font, dan radius
            di bawah render benar, foundation Next.js siap dipakai komponen
            beneran di phase berikut.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cream-soft">
            User Dark (default)
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Swatch name="wine" hex="#6D2932" className="bg-wine text-cream" />
            <Swatch name="wine-deep" hex="#561C24" className="bg-wine-deep text-cream" />
            <Swatch name="ink" hex="#1a0c10" className="bg-ink text-cream border border-cream/20" />
            <Swatch name="cream" hex="#E8D8C4" className="bg-cream text-ink" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cream-soft">
            User Light
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Swatch name="wine-light" hex="#842A3B" className="bg-wine-light text-cream" />
            <Swatch name="wine-light-deep" hex="#4A1818" className="bg-wine-light-deep text-cream" />
            <Swatch name="sand" hex="#F5E8C9" className="bg-sand text-wine-light-deep" />
            <Swatch name="sand-accent" hex="#F5DAA7" className="bg-sand-accent text-wine-light-deep" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cream-soft">
            Admin (flat, no FX)
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Swatch name="slate-bg" hex="#212529" className="bg-slate-bg text-white border border-white/20" />
            <Swatch name="slate-elev" hex="#343A40" className="bg-slate-elev text-white" />
            <Swatch name="slate-accent" hex="#ADB5BD" className="bg-slate-accent text-slate-deep" />
            <Swatch name="slate-deep" hex="#1C283C" className="bg-slate-deep text-white" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cream-soft">
            Typography
          </h2>
          <div className="space-y-2 rounded bg-ink-elev p-6 shadow-playly-md">
            <p className="font-sans text-2xl font-bold text-cream">
              Inter Bold — Heading style untuk Playly dashboard
            </p>
            <p className="font-sans text-base text-cream-soft">
              Body teks default. Letter-spacing -0.005em ngikutin legacy.
              Kalau font ini bukan Inter (mis. fallback system), berarti
              next/font/google belum kena.
            </p>
            <p className="font-mono text-sm text-cream-muted">
              JetBrains Mono — buat code/key/timestamp.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cream-soft">
            Radius + Shadow
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-sm bg-ink-elev p-4 text-cream-soft shadow-playly-sm">
              rounded-sm · shadow-sm
            </div>
            <div className="rounded bg-ink-elev p-4 text-cream-soft shadow-playly-md">
              rounded · shadow-md
            </div>
            <div className="rounded-lg bg-ink-elev p-4 text-cream-soft shadow-playly-lg">
              rounded-lg · shadow-lg
            </div>
          </div>
        </section>

        <footer className="border-t border-cream/10 pt-6 text-xs text-cream-muted">
          Built on Next.js 15 · React 19 · Tailwind 3.4 · TypeScript strict.
          Legacy bundle masih live di <code className="font-mono">/legacy/</code>.
        </footer>
      </div>
    </main>
  );
}

function Swatch({ name, hex, className }: { name: string; hex: string; className: string }) {
  return (
    <div className={`rounded p-4 ${className}`}>
      <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
        {name}
      </div>
      <div className="font-mono text-sm">{hex}</div>
    </div>
  );
}
