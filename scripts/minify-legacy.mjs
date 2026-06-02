// Minify the static legacy assets in public/legacy/ into *.min.js / *.min.css.
//
// WHY: public/legacy/* is served STATICALLY by Next.js (no bundling/minify/
// tree-shake). The minified variants are referenced in production via
// app/_legacy/legacy-asset.ts; dev keeps serving the readable originals.
// The *.min.* outputs are gitignored and regenerated on each build (prebuild).
//
// SAFETY: JS is minified with terser WITHOUT name-mangling (mangle:false,
// keep_fnames) — the legacy SPA relies on a cross-file window.* contract
// (openAuthModal, cloudSync, pIcon, particlesBg, PLAYLY_*) that renaming would
// break. The win is comment + whitespace + safe dead-code removal only.
//
// Keep this ALLOWLIST in sync with public/legacy/*.{js,css} when files are added.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify as terserMinify } from 'terser';
import CleanCSS from 'clean-css';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'public', 'legacy');

const JS_FILES = [
  'script.js',
  'cloud-sync.js',
  'supabase-auth-bridge.js',
  'picons.js',
  'particles-bg.js',
  'index-config.js',
  'index-ensure.js',
  'watch-init.js',
  'embed-init.js',
];
const CSS_FILES = ['styles.css', 'watch.css', 'embed.css'];

// terser — conservative: NO mangle, keep function/class names, no unsafe opts.
const TERSER_OPTS = {
  compress: {
    defaults: true,
    drop_debugger: true,
    drop_console: false,
    passes: 1,
    keep_fargs: true,
    pure_getters: false,
  },
  mangle: false,
  keep_fnames: true,
  keep_classnames: true,
  format: { comments: false, beautify: false },
  ecma: 2020,
  sourceMap: false,
};

const outName = (f) => f.replace(/\.(js|css)$/, '.min.$1');
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const pct = (o, m) => (100 - (m / o) * 100).toFixed(1) + '%';

async function minifyJs(file) {
  const src = await readFile(path.join(DIR, file), 'utf8');
  const res = await terserMinify(src, TERSER_OPTS);
  if (res.error) throw res.error;
  if (typeof res.code !== 'string') throw new Error(`terser produced no output for ${file}`);
  await writeFile(path.join(DIR, outName(file)), res.code, 'utf8');
  return { orig: Buffer.byteLength(src), min: Buffer.byteLength(res.code) };
}

// clean-css level 1 = safe (whitespace + comment removal, no risky restructuring).
// Chosen over lightningcss because the 72k-line hand-authored legacy CSS contains
// syntax lightningcss's strict parser rejects; clean-css is lenient and preserves
// all rules (the browser parses this CSS fine in production).
const cssCleaner = new CleanCSS({ level: 1 });
async function minifyCss(file) {
  const src = await readFile(path.join(DIR, file), 'utf8');
  const out = cssCleaner.minify(src);
  if (out.errors && out.errors.length) throw new Error(out.errors.join('; '));
  await writeFile(path.join(DIR, outName(file)), out.styles, 'utf8');
  return { orig: Buffer.byteLength(src), min: Buffer.byteLength(out.styles) };
}

async function main() {
  const rows = [];
  let totalOrig = 0;
  let totalMin = 0;
  let failed = 0;

  for (const f of JS_FILES) {
    try {
      const r = await minifyJs(f);
      rows.push([f, r.orig, r.min]);
      totalOrig += r.orig;
      totalMin += r.min;
    } catch (e) {
      failed++;
      console.error(`✗ JS minify failed: ${f}\n  ${e?.message || e}`);
    }
  }
  for (const f of CSS_FILES) {
    try {
      const r = await minifyCss(f);
      rows.push([f, r.orig, r.min]);
      totalOrig += r.orig;
      totalMin += r.min;
    } catch (e) {
      failed++;
      console.error(`✗ CSS minify failed: ${f}\n  ${e?.message || e}`);
    }
  }

  console.log('\n  minify-legacy — public/legacy/*.{js,css} → *.min.*\n');
  for (const [f, o, m] of rows) {
    console.log(`  ${f.padEnd(26)} ${kb(o).padStart(10)} → ${kb(m).padStart(10)}   −${pct(o, m)}`);
  }
  console.log('  ' + '-'.repeat(64));
  console.log(`  ${'TOTAL'.padEnd(26)} ${kb(totalOrig).padStart(10)} → ${kb(totalMin).padStart(10)}   −${pct(totalOrig, totalMin)}\n`);

  if (failed > 0) {
    console.error(`✗ ${failed} file(s) failed to minify — aborting (build must not ship broken assets).`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
