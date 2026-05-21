/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: false,

  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/legacy/index.html' },
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
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
