// Source: public/legacy/index.html — section #adminFaqSection (line 1914-1962).
// Phase 4: copied verbatim in English. When the full i18n dictionary gets
// ported, swap these strings for t('lp.faq.q*') / t('lp.faq.a*') lookups.

export type FaqItem = {
  q: string;
  a: string;
};

export const ADMIN_FAQ: readonly FaqItem[] = [
  {
    q: 'I forgot my admin password — what now?',
    a: "Use the “Forgot password?” link on the sign-in form. A reset link is sent to the registered admin email. Self-serve recovery only works for admin emails on the allowlist; contact a super-admin for accounts not on the list.",
  },
  {
    q: 'Can a regular user become an admin via sign-up?',
    a: 'No. The admin email and username are reserved and the regular sign-up form refuses both. Admin accounts are pre-seeded; new admins are added only by an existing super-admin from the Settings page.',
  },
  {
    q: 'What actions are recorded in the audit log?',
    a: 'Suspend / restore user, takedown / restore video, role changes, adding new admins, broadcast sends, admin logins, and platform setting changes. Each entry shows who acted, when, on what, and the reason given.',
  },
  {
    q: 'How does two-factor authentication work?',
    a: 'Super-admins are required to enroll in TOTP 2FA from Settings. After enrollment, sensitive actions ask for a 6-digit code from your authenticator app. Codes are verified in 30-second windows.',
  },
  {
    q: 'What happens if I take the wrong action?',
    a: 'Most actions are reversible: suspended users can be restored, taken-down videos can be brought back, roles can be reassigned. The audit log keeps the original action and the reversal both, so the full history is intact.',
  },
  {
    q: 'How long does an admin session stay active?',
    a: 'Admin sessions expire after 30 days of inactivity. Sensitive actions (suspend, takedown, role change, payout) require fresh re-authentication if the last verification was over 15 minutes ago. Idle browsers auto-lock after 30 minutes.',
  },
  {
    q: 'How do I add a new admin or moderator?',
    a: "Only super-admins can promote users via Settings → Team Management. Add the user's email, pick the role (Admin or Moderator), and the system sends an invite. New admins must enroll in 2FA before sensitive actions become available.",
  },
  {
    q: "What if there's a suspicious login attempt?",
    a: 'Failed logins are rate-limited per IP and logged. After 5 failures, the account is temporarily locked for 15 minutes. Super-admins receive an email alert for any login from a new device or geography. Use Settings → Security to revoke active sessions.',
  },
  {
    q: 'Is user data encrypted?',
    a: 'Yes. Passwords are hashed with bcrypt (never stored in plaintext). Session tokens and 2FA secrets are encrypted at rest. Data in transit uses TLS 1.3. PII fields (email, name) are encrypted in the database with rotated keys.',
  },
  {
    q: 'How does the payment & payout system work?',
    a: 'Premium subscriptions are processed by an external payment gateway. Admins approve payments in the Premium Queue after verifying proof. Creator payouts run weekly on Mondays based on revenue share. All transactions are logged with reconciliation reports available in Settings → Finance.',
  },
];
