'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './auth-provider';

export type Role = 'user' | 'admin';
export type Theme = 'dark' | 'light';

const THEME_KEY = 'playly-theme';

type ThemeState = {
  role: Role;
  theme: Theme;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeState>({
  role: 'user',
  theme: 'dark',
  setTheme: () => {},
});

// Path/query-based role detection — port dari legacy script.js (~line 1937),
// diperluas untuk Phase 4 supaya /admin-preview, /admin/*, dan /admin-* (preview
// routes selama migrasi) juga ter-detect sebagai admin.
// Catatan: ini cek path SECARA CLIENT-SIDE. Untuk SSR-safe role detection,
// future migration ke Server Components akan baca route segment via headers().
function detectRoleFromLocation(): Role {
  if (typeof window === 'undefined') return 'user';
  const path = window.location.pathname.toLowerCase();
  const search = new URLSearchParams(window.location.search);
  if (search.get('admin') === '1') return 'admin';
  if (
    path === '/admin' ||
    path.endsWith('/admin') ||
    path.startsWith('/admin/') ||
    path.startsWith('/admin-')
  ) {
    return 'admin';
  }
  return 'user';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin, ready } = useAuth();
  const [theme, setThemeState] = useState<Theme>('dark');
  const [pathRole, setPathRole] = useState<Role>('user');

  useEffect(() => {
    setPathRole(detectRoleFromLocation());
  }, []);

  // Restore preferred theme from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
      }
    } catch {}
  }, []);

  // Final role: path takes precedence (legacy parity), auth as fallback
  const role: Role = pathRole === 'admin' || (ready && isAdmin) ? 'admin' : 'user';

  // Sync to body dataset so legacy CSS rules in styles.css (body[data-role],
  // body[data-theme]) still apply when migrated components reuse legacy CSS.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.dataset.role = role;
    document.body.dataset.theme = theme;
  }, [role, theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {}
  }, []);

  const value = useMemo<ThemeState>(
    () => ({ role, theme, setTheme }),
    [role, theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
