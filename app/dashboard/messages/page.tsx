import { NavIcon, PagePlaceholder } from '@/components/dashboard/PagePlaceholder';

export const metadata = { title: 'Playly — Obrolan Langsung' };

export default function MessagesPage() {
  return (
    <PagePlaceholder
      eyebrow="Sosial"
      title="Obrolan Langsung"
      description="Direct messages dengan kreator lain. Real-time, gaya Instagram."
      icon={
        <NavIcon>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </NavIcon>
      }
      features={[
        'Inbox: thread DM dengan kreator yang kamu chat',
        'Real-time message via Supabase Realtime',
        'Compose: kirim text, emoji, link video',
        'Broadcast (admin only): kirim pesan ke semua user',
        'Notif unread badge di topbar',
      ]}
    />
  );
}
