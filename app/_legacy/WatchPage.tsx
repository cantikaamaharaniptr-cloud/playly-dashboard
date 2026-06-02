// Public watch page (was watch.html), as a Server Component. Markup verbatim;
// page CSS via watch.css; the standalone player logic via watch-init.js (moved
// verbatim from the old inline <script>). supabase-js loaded from CDN first, in
// the original order.
import { WATCH_MARKUP } from './watch-markup';
import { legacyAsset } from './legacy-asset';

export default function WatchPage() {
  return (
    <>
      <link rel="stylesheet" href={legacyAsset('watch.css')} precedence="high" />
      <link rel="preconnect" href="https://urfkqcdwcvyzctbtbpwv.supabase.co" crossOrigin="" />
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: WATCH_MARKUP }} />
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" />
      <script src={legacyAsset('watch-init.js')} />
    </>
  );
}
