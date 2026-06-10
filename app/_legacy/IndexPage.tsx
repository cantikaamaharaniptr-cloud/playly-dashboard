// Legacy index app, rendered as a Next.js Server Component.
//
// The body markup is reproduced verbatim (dangerouslySetInnerHTML) so it is
// byte-identical to the old index.html — styles.css + script.js target these
// exact ids/classes. Scripts are emitted as raw <script> tags in the ORIGINAL
// order (not next/script): script.js registers many DOMContentLoaded listeners
// without readyState guards, so execution order + DOMContentLoaded timing must
// match the original document. As a Server Component these are SSR'd once and
// run on initial load exactly like the legacy page.
import { INDEX_MARKUP } from './index-markup';
import { INDEX_PREPAINT } from './index-prepaint';
import { legacyAsset } from './legacy-asset';

// Cache-bust versions preserved verbatim from legacy index.html.
const V_MAIN = '20260609-pustaka-v785';
const V_CLOUD = '20260526-audit-user-section-v557';
const V_PICONS = '20260516-settings-ico-v188';
const V_PARTICLES = '20260516-particles-v2';

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
      <script src={legacyAsset('cloud-sync.js', V_CLOUD)} />
      <script src={legacyAsset('supabase-auth-bridge.js', V_CLOUD)} />
      <script src={legacyAsset('script.js', V_MAIN)} data-playly-main="1" />
      <script src={legacyAsset('picons.js', V_PICONS)} />
      <script src={legacyAsset('particles-bg.js', V_PARTICLES)} />
      <script src={legacyAsset('index-ensure.js')} />
    </>
  );
}
