import type { StrategicProfile, TerritorialContext, TerritorialIndicator } from "../types/solar-sovereignty";

const TERRITORIAL_INDICATOR_LABELS: Record<string, string> = {
  industrial_capacity: "Massa crítica industrial",
  solar_potential: "Potencial solar",
  wind_potential: "Potencial eólico",
  port_infrastructure: "Infraestrutura portuária",
  rail_infrastructure: "Infraestrutura ferroviária",
  industrial_electricity_consumption: "Consumo elétrico industrial",
  water_availability: "Disponibilidade hídrica",
  environmental_licensing_lead_time_months: "Prazo de licenciamento ambiental",
};

const REGION_LEVEL_LABELS: Record<TerritorialContext["region_level"], string> = {
  uf: "UF",
  polo: "Polo industrial",
  municipio: "Município",
};

function formatIndicatorValue(indicator: TerritorialIndicator) {
  const formattedValue = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(indicator.value as number);
  return `${formattedValue} ${indicator.unit}`.trim();
}

/**
 * Renders the populated TerritorialIndicator entries of a TerritorialContext,
 * each with its mandatory source citation -- never a bare number. Indicators
 * with a null value (declared but not yet ingested) are silently skipped
 * instead of rendering a fake placeholder, and the whole block disappears if
 * nothing has been ingested yet.
 */
function TerritorialContextDetails({ context }: { context: TerritorialContext }) {
  const entries = (Object.entries(context) as Array<[string, unknown]>).filter(
    (entry): entry is [string, TerritorialIndicator] =>
      entry[0] in TERRITORIAL_INDICATOR_LABELS &&
      Boolean(entry[1]) &&
      (entry[1] as TerritorialIndicator).value !== null
  );

  if (entries.length === 0) return null;

  return (
    <div className="mt-2 border-t border-emerald-500/20 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/80">
        Contexto territorial -- {context.region_name} ({REGION_LEVEL_LABELS[context.region_level]})
      </p>
      <ul className="mt-1.5 space-y-1">
        {entries.map(([key, indicator]) => (
          <li key={key} className="text-[11px] leading-relaxed text-zinc-400">
            <span className="text-zinc-300">{TERRITORIAL_INDICATOR_LABELS[key]}:</span> {formatIndicatorValue(indicator)}
            <span className="text-zinc-500"> -- {indicator.source.institution}, {indicator.source.dataset}</span>
            {indicator.note ? <span className="text-zinc-500"> ({indicator.note})</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Renders an insumo's forward-looking strategic narrative (e.g. powershoring)
 * as its own explicitly-labeled "Tese Estratégica" block -- deliberately
 * agnostic to whatever risk classification (NIB quadrant, sub-NCM masking
 * badge, etc.) is shown alongside it. Never reads or infers from trade
 * numbers itself; it only renders what the backend catalog already computed
 * and labeled as a thesis, so it can sit next to a "Monitorar" status without
 * contradicting it -- the pill on the right makes that distinction explicit
 * for whoever is reading the card, not just for the code. When the profile
 * carries a territorial_context, its populated indicators render as
 * supporting evidence underneath the thesis -- never as a replacement for it.
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
      {profile.territorial_context ? <TerritorialContextDetails context={profile.territorial_context} /> : null}
    </div>
  );
}

export default StrategicVectorBadge;
