// Legacy index app, rendered as a Next.js Server Component.
//
// The body markup is reproduced verbatim (dangerouslySetInnerHTML) so it is
// byte-identical to the old index.html — styles.css + script.js target these
// exact ids/classes. Scripts are emitted as raw <script> tags in the ORIGINAL
// order (not next/script): script.js registers many DOMContentLoaded listeners
// without readyState guards, so execution order + DOMContentLoaded timing must
// match the original document. As a Server Component these are SSR'd once and
// run on initial load exactly like the legacy page.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { INDEX_MARKUP } from './index-markup';
import { INDEX_PREPAINT } from './index-prepaint';
import { legacyAsset } from './legacy-asset';

// Cache-bust ?v= OTOMATIS dari hash isi file legacy yang DISAJIKAN (min di
// produksi, asli di dev). Berubah sendiri tiap file berubah → browser tak pernah
// nyangkut cache lama (immutable 1thn). Dulu versi MANUAL & sering lupa di-bump
// saat script.js diubah → "perubahan tak muncul" (mis. Beranda nyangkut
// "Memuat..." + jam mati krn tickLiveClock versi lama). Fallback ke string lama
// kalau file tak terbaca (mis. dev sebelum minify). Sejalan dgn STYLES_V di
// app/(site)/layout.tsx.
function assetVersion(file: string, fallback: string): string {
  try {
    const served = process.env.NODE_ENV === 'production'
      ? file.replace(/\.(js|css)$/, '.min.$1')
      : file;
    return createHash('md5')
      .update(readFileSync(path.join(process.cwd(), 'public', 'legacy', served)))
      .digest('hex').slice(0, 12);
  } catch {
    return fallback;
  }
}

const V_MAIN = assetVersion('script.js', '20260627-admin2-gates');
const V_CLOUD_SYNC = assetVersion('cloud-sync.js', '20260627-orphan-leak-fix-v559');
const V_AUTH_BRIDGE = assetVersion('supabase-auth-bridge.js', '20260627-orphan-leak-fix-v559');
const V_PICONS = assetVersion('picons.js', '20260516-settings-ico-v188');
const V_PARTICLES = assetVersion('particles-bg.js', '20260516-particles-v2');

export default function IndexPage() {
  return (
    <>
      {/* Pre-paint admin role detection — must run before the markup paints
          (sets body[data-role] for the FOUC guard). Verbatim from index.html. */}
      <script dangerouslySetInnerHTML={{ __html: INDEX_PREPAINT }} />

      {/* Full legacy body markup, byte-identical. */}
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: INDEX_MARKUP }} />

      {/* Scripts in the exact original order. */}
      <script src={legacyAsset('index-config.js')} />
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" />
      <script src={legacyAsset('cloud-sync.js', V_CLOUD_SYNC)} />
      <script src={legacyAsset('supabase-auth-bridge.js', V_AUTH_BRIDGE)} />
      <script src={legacyAsset('script.js', V_MAIN)} data-playly-main="1" />
      <script src={legacyAsset('picons.js', V_PICONS)} />
      <script src={legacyAsset('particles-bg.js', V_PARTICLES)} />
      <script src={legacyAsset('index-ensure.js')} />
    </>
  );
}
