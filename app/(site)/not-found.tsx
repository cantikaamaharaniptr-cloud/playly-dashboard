import type { Metadata } from 'next';
import Link from 'next/link';

// Per-route-group 404 for the main app. With the multiple-root-layout setup
// (no app/layout.tsx, separate (site)/(player) root layouts), Next.js requires
// not-found to live INSIDE a route group so it inherits that group's root
// layout — a root app/not-found.tsx errors ("doesn't have a root layout") and
// poisons the .next cache. This file renders inside (site)/layout's <html>/<body>
// (which already loads styles.css), so it only provides the content.
export const metadata: Metadata = {
  title: 'Playly. — Halaman tidak ditemukan',
  robots: { index: false, follow: false },
};

const CSS = `
  .nf-wrap { background:#1a0c10; color:#E8D8C4; font-family:system-ui,sans-serif;
    display:grid; place-items:center; min-height:100vh; margin:0; text-align:center; padding:24px; }
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
