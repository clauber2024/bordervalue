import type { StrategicProfile } from "../types/solar-sovereignty";

/**
 * Renders an insumo's forward-looking strategic narrative (e.g. powershoring)
 * as its own explicitly-labeled "Tese Estratégica" block -- deliberately
 * agnostic to whatever risk classification (NIB quadrant, sub-NCM masking
 * badge, etc.) is shown alongside it. Never reads or infers from trade
 * numbers itself; it only renders what the backend catalog already computed
 * and labeled as a thesis, so it can sit next to a "Monitorar" status without
 * contradicting it -- the pill on the right makes that distinction explicit
 * for whoever is reading the card, not just for the code.
 */
export function StrategicVectorBadge({ profile }: { profile?: StrategicProfile | null }) {
  if (!profile?.is_powershoring_vector) return null;

  return (
    <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-950/20 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
        <span aria-hidden>⚡</span>
        <span>{profile.label}</span>
        <span className="ml-auto shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
          Tese estratégica
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">{profile.thesis}</p>
    </div>
  );
}

export default StrategicVectorBadge;
