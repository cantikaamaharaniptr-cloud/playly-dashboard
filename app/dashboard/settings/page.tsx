// Settings page. Phase 7b session 3: 4 functional sections.
// Future sessions: Profil (avatar+banner+bio), Langganan, 2FA, Buat Admin.

import { AccountForm } from '@/components/dashboard/settings/AccountForm';
import { LanguagePicker } from '@/components/dashboard/settings/LanguagePicker';
import { SecurityCard } from '@/components/dashboard/settings/SecurityCard';
import { ThemeToggle } from '@/components/dashboard/settings/ThemeToggle';

export const metadata = { title: 'Playly — Pengaturan' };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-cream-muted">
          Akun
        </p>
        <h1 className="mt-1 text-3xl font-bold text-cream">Pengaturan</h1>
        <p className="mt-1 text-sm text-cream-soft">
          Kelola info akun, bahasa, tampilan, dan keamanan.
        </p>
      </header>

      <AccountForm />
      <LanguagePicker />
      <ThemeToggle />
      <SecurityCard />
    </div>
  );
}
