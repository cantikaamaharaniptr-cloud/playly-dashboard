// Daily Workflow — 8 step items in vertical/staggered list.
// Source: public/legacy/index.html #adminWorkflowSection (lines 1845-1911).

import { AdminLandingHead } from './AdminLandingHead';

type Step = { title: string; desc: string };

const STEPS: Step[] = [
  {
    title: 'Detect',
    desc: 'Reports, ticket queue, anomaly chart, and inbox surface what needs attention right now.',
  },
  {
    title: 'Triage',
    desc: 'Sort incoming items by severity — critical vs routine — and tag with priority labels for batch handling.',
  },
  {
    title: 'Investigate',
    desc: 'Open the user or video, see full context: history, prior reports, related accounts, watch time.',
  },
  {
    title: 'Coordinate',
    desc: 'Assign to the right team, tag a teammate, or escalate to super-admin via internal thread.',
  },
  {
    title: 'Act',
    desc: 'Suspend, restore, takedown, reply, broadcast — single click with a required reason field.',
  },
  {
    title: 'Communicate',
    desc: "Reply users, send broadcasts, or update the public status page when there's an active incident.",
  },
  {
    title: 'Verify',
    desc: 'Action lands in the audit log instantly. Filter by actor, target, or date for compliance review.',
  },
  {
    title: 'Report',
    desc: 'Daily summary, export logs for the shift hand-off, and surface trends for next-day planning.',
  },
];

export function AdminWorkflow() {
  return (
    <section className="w-full px-6 py-14 sm:px-10 sm:py-20 lg:px-20 lg:py-24">
      <AdminLandingHead
        eyebrow="DAILY WORKFLOW"
        title="From signal to action in eight steps"
        subtitle="The admin dashboard is built around the operational loop you actually run, not abstract dashboards."
      />
      <ol className="mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li
            key={i}
            className="flex gap-4 rounded-[14px] border border-slate-accent/15 bg-slate-elev/50 p-5 transition-colors hover:border-slate-accent/30"
          >
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-slate-accent/30 bg-slate-bg/60 font-mono text-sm font-bold text-slate-accent">
              {i + 1}
            </div>
            <div>
              <h3 className="m-0 mb-1 text-[15px] font-bold text-white">
                {s.title}
              </h3>
              <p className="m-0 text-[13px] leading-[1.55] text-slate-accent">
                {s.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
