// Browser Supabase client. Use in Client Components only.
// Server Components / Route Handlers / Server Actions must use lib/supabase/server.ts.

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
