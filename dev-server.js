// Minimal static server with vercel.json rewrites — replacement for `vercel dev`
// when offline / not logged in. Run: node dev-server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = 8080;
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.vtt':  'text/vtt; charset=utf-8',
};

// vercel.json rewrites — order matters
const rewrites = [
  { re: /^\/id\/([^/]+)\/embed\/?$/,         to: (m) => `/embed.html?v=${m[1]}` },
  { re: /^\/id\/([^/]+)\/([^/]+)\/embed\/?$/,to: (m) => `/embed.html?v=${m[2]}&u=${m[1]}` },
  { re: /^\/id\/([^/]+)\/([^/]+)\/?$/,       to: (m) => `/watch.html?v=${m[2]}&u=${m[1]}` },
  { re: /^\/id\/([^/]+)\/?$/,                to: (m) => `/watch.html?v=${m[1]}` },
  { re: /^\/admin\/?$/,                      to: () => `/index.html` },
  { re: /^\/watch\/?$/,                      to: () => `/watch.html` },
  { re: /^\/embed\/?$/,                      to: () => `/embed.html` },
];

function applyRewrites(pathname) {
  for (const r of rewrites) {
    const m = pathname.match(r.re);
    if (m) return r.to(m);
  }
  return null;
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsed.pathname || '/');
  const originalQuery = parsed.search || '';

  // Block /api/* with a friendly note (we don't run edge functions here)
  if (pathname.startsWith('/api/')) {
    return send(res, 503, { 'Content-Type': 'application/json' },
      JSON.stringify({ error: 'API endpoints not available in local static dev. Deploy to Vercel.' }));
  }

  // Apply rewrites
  const rewritten = applyRewrites(pathname);
  let finalPath = pathname;
  let extraQuery = '';
  if (rewritten) {
    const [p, q] = rewritten.split('?');
    finalPath = p;
    extraQuery = q ? (originalQuery ? '&' + q : '?' + q) : '';
  }

  // Default doc
  if (finalPath === '/' || finalPath.endsWith('/')) finalPath += 'index.html';

  // Resolve to file
  const safePath = path.normalize(finalPath).replace(/^([\\/])+/, '');
  const filePath = path.join(ROOT, safePath);
  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, { 'Content-Type': 'text/plain' }, 'Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Fallback to 404.html
      const notFound = path.join(ROOT, '404.html');
      fs.readFile(notFound, (e, buf) => {
        if (e) return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
        send(res, 404, { 'Content-Type': 'text/html; charset=utf-8' }, buf);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const headers = {
      'Content-Type': type,
      'Content-Length': stat.size,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
    if (ext === '.js' || ext === '.css') {
      headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
    }
    fs.createReadStream(filePath).pipe(res.writeHead(200, headers));
  });
}).listen(PORT, HOST, () => {
  console.log(`Playly dev server: http://${HOST}:${PORT}`);
  console.log(`  - Dashboard (user): http://${HOST}:${PORT}/`);
  console.log(`  - Admin login:      http://${HOST}:${PORT}/admin`);
  console.log(`  - Watch page:       http://${HOST}:${PORT}/watch`);
});
