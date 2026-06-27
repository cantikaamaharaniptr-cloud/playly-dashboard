// Public embed player (was embed.html), as a Server Component. Markup verbatim;
// page CSS via embed.css; standalone logic via embed-init.js (moved verbatim
// from the old inline <script>). supabase-js from CDN first, original order.
import { EMBED_MARKUP } from './embed-markup';
import { legacyAsset } from './legacy-asset';

export default function EmbedPage() {
  return (
    <>
      <link rel="stylesheet" href={legacyAsset('embed.css')} precedence="high" />
      <link rel="preconnect" href="https://urfkqcdwcvyzctbtbpwv.supabase.co" crossOrigin="" />
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: EMBED_MARKUP }} />
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" />
      <script src={legacyAsset('embed-init.js')} />
    </>
  );
}
