// One-shot bulk strip emoji prefix from i18n translation values.
// Run: node scripts/strip-i18n-emoji.mjs
import fs from 'fs';
const path = 'public/legacy/script.js';
let c = fs.readFileSync(path, 'utf8');
const before = c.length;

const keys = [
  'settings.notifications',
  'settings.appearance',
  'settings.privacy',
  'settings.language',
  'settings.security',
  'twofa.title',
];

// Match: "key": <ws> "<emoji+possibly-VS16>< optional-space >TEXT"
// Allow Unicode emoji ranges: Misc Symbols, Dingbats, Misc Tech (⏱),
// Misc Symbols and Pictographs, Supplemental Symbols, etc.
const emojiClass = '[\\u{2300}-\\u{27FF}\\u{1F300}-\\u{1FAFF}\\u{1F900}-\\u{1F9FF}]';

keys.forEach((k) => {
  const keyEsc = k.replace(/\./g, '\\.');
  const re = new RegExp(`("${keyEsc}":\\s+")${emojiClass}+\\uFE0F?\\s*`, 'gu');
  c = c.replace(re, '$1');
});

fs.writeFileSync(path, c);
console.log(`Stripped ${before - c.length} bytes (${keys.length} keys × N langs).`);
