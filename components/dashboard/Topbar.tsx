'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { useChrome } from './ChromeContext';

export function Topbar() {
  const { user } = useAuth();
  const { toggleDrawer } = useChrome();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/');
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  const meta = user?.user_metadata as { name?: string } | undefined;
  const display = meta?.name || user?.email || 'User';
  const initial = (display[0] || 'U').toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-cream/10 bg-ink-elev/70 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — visible only on mobile (lg hidden) */}
        <button
          type="button"
          onClick={toggleDrawer}
          aria-label="Toggle menu"
          className="grid h-9 w-9 place-items-center rounded-md text-cream-soft transition-colors hover:bg-cream/5 hover:text-cream lg:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Mobile brand (sidebar hidden on mobile) */}
        <span className="flex items-center gap-2 lg:hidden">
          <svg
            viewBox="0 0 100 100"
            className="h-6 w-6 text-cream"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M 30 6 L 60 6 C 80 6 92 22 92 38 C 92 58 76 70 56 70 L 42 70 L 42 92 C 42 97 38 98 32 98 C 26 98 22 97 22 92 L 22 14 C 22 10 26 6 30 6 Z M 42 22 L 56 22 C 66 22 72 30 72 38 C 72 46 66 54 56 54 L 42 54 Z"
            />
          </svg>
          <span className="text-base font-bold text-cream">Playly.</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Notification bell (placeholder — no real notifs yet) */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-md text-cream-soft transition-colors hover:bg-cream/5 hover:text-cream"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        <div className="hidden flex-col items-end leading-tight sm:flex">
          <span className="text-sm font-semibold text-cream">{display}</span>
          <span className="text-[11px] text-cream-muted">
            {user?.email ?? 'signed in'}
          </span>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-wine/20 text-sm font-bold text-cream">
          {initial}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="hidden rounded-md border border-cream/20 px-3 py-1.5 text-xs font-semibold text-cream-soft transition-colors hover:bg-cream/5 hover:text-cream disabled:opacity-60 sm:inline-flex"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </header>
  );
}
