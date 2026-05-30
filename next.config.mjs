/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: false,

  async rewrites() {
    return {
      beforeFiles: [
        // Reverted 2026-05-21: user prefer legacy landing (auth-mode + landing
        // sections sudah di-setup dengan visual + animasi yang nggak ke-rebuild
        // di Next.js version). React landing & admin pages di app/page.tsx +
        // app/admin/page.tsx jadi dead code sementara — sengaja dibiarkan untuk
        // future restore atau referensi.
        //
        // Next.js dashboard tetap accessible:
        //   /dashboard, /dashboard/*  (Supabase auth-gated)
        //   /auth/reset               (forgot password destination)
        //   /api/translate-subtitle   (DeepL proxy)
        { source: '/', destination: '/legacy/index.html' },
        { source: '/login', destination: '/legacy/index.html' },
        { source: '/signup', destination: '/legacy/index.html' },
        { source: '/admin', destination: '/legacy/index.html' },
        { source: '/watch', destination: '/legacy/watch.html' },
        { source: '/embed', destination: '/legacy/embed.html' },
        { source: '/id/:videoId/embed', destination: '/legacy/embed.html?v=:videoId' },
        { source: '/id/:videoId', destination: '/legacy/watch.html?v=:videoId' },
        { source: '/id/:username/:videoId/embed', destination: '/legacy/embed.html?v=:videoId&u=:username' },
        { source: '/id/:username/:videoId', destination: '/legacy/watch.html?v=:videoId&u=:username' },
      ],
    };
  },

  async headers() {
    // Dev mode: hindari cache 1-tahun supaya tiap edit script.js/styles.css
    // langsung kelihatan tanpa user perlu Ctrl+Shift+R berulang kali.
    // Prod tetep pake immutable (file legacy versi statis).
    const isDev = process.env.NODE_ENV !== 'production';
    const legacyJsCss = isDev
      ? 'no-store, must-revalidate'
      : 'public, max-age=31536000, immutable';
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/legacy/:path*.html',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/legacy/:path*.(js|css)',
        headers: [
          { key: 'Cache-Control', value: legacyJsCss },
        ],
      },
    ];
  },
};

export default nextConfig;
