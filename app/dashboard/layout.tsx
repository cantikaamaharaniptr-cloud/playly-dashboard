// Dashboard shell — sidebar (desktop sticky + mobile drawer) + topbar
// (hamburger + notif + user). Auth-gated: logged-out users redirect ke /.

import { ChromeProvider } from '@/components/dashboard/ChromeContext';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Topbar } from '@/components/dashboard/Topbar';
import { requireUser } from '@/lib/auth/guard';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser('/');

  return (
    <ChromeProvider>
      <div className="flex min-h-screen bg-ink text-cream">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
            {children}
          </main>
        </div>
      </div>
    </ChromeProvider>
  );
}
