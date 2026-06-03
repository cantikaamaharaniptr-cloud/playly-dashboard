import type { Metadata } from 'next';
import Link from 'next/link';

// 404 lives INSIDE the (site) route group so it inherits (site)/layout.tsx as its
// root layout (which provides <html>/<body>). A top-level app/not-found.tsx had
// no root layout under the multiple-root-layout setup (no app/layout.tsx) — that
// built in production but made the Next dev server 500 ("not-found.tsx doesn't
// have a root layout") whenever a 404 route was hit. Keeping it in the group
// fixes dev + prod. (Player group's /watch,/embed rarely 404; root-level
// unmatched URLs resolve here.)
export const metadata: Metadata = {
  title: 'Playly. — Halaman tidak ditemukan',
  robots: { index: false, follow: false },
};

const CSS = `
  .nf-wrap { position:fixed; inset:0; z-index:9999; background:#1a0c10; color:#E8D8C4;
    font-family:system-ui,sans-serif; display:grid; place-items:center; text-align:center; padding:24px; }
  .nf-wrap a { color:#C7B7A3; }
  .nf-logo { width:48px; height:48px; border-radius:12px;
    background:linear-gradient(135deg,#6D2932,#C7B7A3); display:grid; place-items:center;
    font-weight:800; color:#1a0c10; margin:0 auto 18px; font-size:22px; }
  .nf-wrap h1 { font-size:20px; margin:0 0 6px; }
  .nf-wrap p { color:#C7B7A3; font-size:14px; margin:0 0 18px; }
  .nf-btn { display:inline-block; padding:10px 18px; border-radius:999px;
    background:linear-gradient(135deg,#6D2932,#C7B7A3); color:#1a0c10;
    font-weight:700; text-decoration:none; }
`;

export default function NotFound() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="nf-wrap">
        <div>
          <div className="nf-logo">P</div>
          <h1>Halaman tidak ditemukan</h1>
          <p>Link mungkin salah atau halaman sudah dipindahkan.</p>
          <Link className="nf-btn" href="/">
            Kembali ke Playly
          </Link>
        </div>
      </div>
    </>
  );
}
