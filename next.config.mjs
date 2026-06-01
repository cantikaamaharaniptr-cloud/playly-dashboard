/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: false,

  // 2026-06-01: the legacy HTML bundle (public/legacy/*.html) was converted to
  // native Next.js routes — there are no .html files anymore, so the old
  // beforeFiles rewrites to /legacy/*.html are gone. Routes now served by the
  // App Router:
  //   /  /login  /signup  /admin          → app/(site)         (styles.css + script.js)
  //   /watch  /embed                        → app/(player)
  //   /id/:videoId  /id/:user/:videoId      → app/(player)/id/[...slug]  (watch)
  //   /id/:videoId/embed  /id/:u/:v/embed   → app/(player)/id/[...slug]  (embed)
  // The legacy JS/CSS assets (script.js, styles.css, picons.js, particles-bg.js,
  // cloud-sync.js, supabase-auth-bridge.js, *.css) still live in public/legacy/
  // and are referenced verbatim by the pages above.

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/legacy/:path*.(js|css)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
