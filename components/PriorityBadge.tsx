import type { ReactNode } from "react";

type PriorityBadgeProps = {
  label: string;
  icon?: ReactNode;
};

/**
 * Reusable badge for the "violet" token proposed in tailwind.config.ts (Fase 0
 * do Design System do Instituto E+) -- not wired to any real data yet. No
 * chain in lib/chainCatalog.ts carries a ministerial-priority field today, so
 * this only exists as a ready-to-use building block: pass whatever real
 * label a future backend field ends up producing, don't hardcode one here.
 */
export function PriorityBadge({ label, icon }: PriorityBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-line bg-violet-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-text">
      {icon}
      {label}
    </span>
  );
}

export default PriorityBadge;
