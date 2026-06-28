// Penjaga sintaks CSS legacy — dijalankan di `prebuild` SEBELUM minify.
//
// KENAPA: public/legacy/styles.css = SATU file ~3MB yang diedit banyak sesi
// paralel. Satu '}' hilang atau komentar yang menutup dini ('*/' di tengah
// komentar) DIAM-DIAM merusak build minified — aturan tertelan ke @media yang
// salah atau di-drop, mis. ikon upload jadi RAKSASA di desktop. Bug begini
// LOLOS dari clean-css (ia "memperbaiki" diam-diam) tapi merusak browser.
//
// Penjaga ini meng-GAGAL-kan build kalau ada CSS yang tak seimbang
// (brace/komentar/string) → cegah deploy rusak naik ke produksi.
// Jalankan manual: `npm run check:css`.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'public', 'legacy');
// Samakan dengan CSS_FILES di minify-legacy.mjs
const FILES = ['styles.css', 'watch.css', 'embed.css'];

function lineAt(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}
function ctx(src, idx) {
  const start = src.lastIndexOf('\n', idx - 1) + 1;
  let end = src.indexOf('\n', idx);
  if (end < 0) end = src.length;
  return src.slice(start, end).trim().slice(0, 110);
}

// Pemindai sadar-komentar & sadar-string. Mengembalikan daftar error.
export function checkCss(src) {
  const errors = [];
  let inComment = false, inStr = false, strCh = '', commentStart = -1, strStart = -1;
  const braceStack = []; // posisi tiap '{' yang masih terbuka
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inComment) {
      if (c === '*' && n === '/') { inComment = false; i++; }
      continue;
    }
    if (inStr) {
      // String CSS bisa pakai line-continuation '\' — abaikan newline, hanya
      // tutup saat ketemu kutip pasangan yang tak ter-escape.
      if (c === strCh && src[i - 1] !== '\\') inStr = false;
      continue;
    }
    if (c === '/' && n === '*') { inComment = true; commentStart = i; i++; continue; }
    if (c === '"' || c === "'") { inStr = true; strCh = c; strStart = i; continue; }
    if (c === '*' && n === '/') {
      errors.push({ line: lineAt(src, i), msg: "'*/' nyasar — komentar menutup dini atau tanpa pembuka '/*'", ctx: ctx(src, i) });
      i++; continue;
    }
    if (c === '{') braceStack.push(i);
    else if (c === '}') {
      if (braceStack.length === 0) errors.push({ line: lineAt(src, i), msg: "'}' berlebih — tak ada '{' pasangannya", ctx: ctx(src, i) });
      else braceStack.pop();
    }
  }
  if (inComment) errors.push({ line: lineAt(src, commentStart), msg: "Komentar /* ... */ tak ditutup", ctx: ctx(src, commentStart) });
  if (inStr) errors.push({ line: lineAt(src, strStart), msg: "String (\" atau ') tak ditutup", ctx: ctx(src, strStart) });
  // Sisa '{' yang belum tertutup = '}' hilang → blok ini menelan aturan sesudahnya.
  for (const pos of braceStack) {
    errors.push({ line: lineAt(src, pos), msg: "'{' tak ditutup (kurang '}') — blok ini MENELAN semua aturan sesudahnya", ctx: ctx(src, pos) });
  }
  // urutkan per baris
  errors.sort((a, b) => a.line - b.line);
  return errors;
}

async function main() {
  let total = 0;
  let checked = 0;
  for (const file of FILES) {
    let src;
    try { src = await readFile(path.join(DIR, file), 'utf8'); }
    catch { continue; } // file opsional — lewati kalau tak ada
    checked++;
    const errors = checkCss(src);
    if (errors.length === 0) {
      console.log(`  ✓ ${file} — seimbang`);
    } else {
      total += errors.length;
      console.error(`  ✗ ${file} — ${errors.length} masalah:`);
      for (const e of errors.slice(0, 25)) {
        console.error(`     baris ${e.line}: ${e.msg}`);
        console.error(`        → ${e.ctx}`);
      }
      if (errors.length > 25) console.error(`     ... +${errors.length - 25} lagi`);
    }
  }
  if (total > 0) {
    console.error(`\n❌ check-css GAGAL: ${total} masalah sintaks CSS. Build DIHENTIKAN (cegah deploy rusak).`);
    console.error('   Perbaiki dulu (biasanya tambah/ hapus satu "}" atau betulkan komentar), lalu deploy ulang.');
    process.exit(1);
  }
  console.log(`✓ check-css OK — ${checked} file CSS legacy seimbang (brace/komentar/string).`);
}

// Hanya jalankan main() kalau di-invoke langsung (bukan saat di-import utk tes).
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('check-css error:', e); process.exit(1); });
}
