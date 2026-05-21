import { AuthProvider } from './auth-provider';
import { I18nProvider } from './i18n-provider';
import { ThemeProvider } from './theme-provider';

// Server Component wrapper that composes all client-side providers. Layout
// imports this once; pages stay free to be Server Components, with client
// children opting in via hooks.
//
// Order matters: ThemeProvider reads useAuth() (isAdmin) so AuthProvider
// must wrap it. I18nProvider is independent and can sit anywhere.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <I18nProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </I18nProvider>
    </AuthProvider>
  );
}
