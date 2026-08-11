"use client";

import { ROUTE_CLASS_COLORS, ROUTE_CLASS_LABELS } from "./SovereigntySankeyChart";
import type { EnergyContextResponse } from "../types/energy-context";
import type { ProductionRouteClass, SolarInputMetric } from "../types/solar-sovereignty";

export type CarbonRouteExposure = {
  routeClass: ProductionRouteClass;
  importsValueUsd: number;
  share: number;
};

// Real distribution of the imported pauta by declared production route,
// weighted by imports_value_usd -- not a static claim. Routes with zero
// import value for this chain are dropped instead of shown as "0%".
export function computeCarbonRouteExposure(inputs: SolarInputMetric[]): CarbonRouteExposure[] {
  const totals = new Map<ProductionRouteClass, number>();
  let totalImports = 0;
  inputs.forEach((input) => {
    const value = Math.max(input.imports_value_usd, 0);
    totals.set(input.production_route_class, (totals.get(input.production_route_class) ?? 0) + value);
    totalImports += value;
  });
  return (Object.keys(ROUTE_CLASS_LABELS) as ProductionRouteClass[])
    .map((routeClass) => ({
      routeClass,
      importsValueUsd: totals.get(routeClass) ?? 0,
      share: totalImports > 0 ? (totals.get(routeClass) ?? 0) / totalImports : 0,
    }))
    .filter((item) => item.importsValueUsd > 0)
    .sort((a, b) => b.importsValueUsd - a.importsValueUsd);
}

const usdCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export type CarbonFootprintIndustrialBlockProps = {
  solarInputs?: SolarInputMetric[];
  energyContext?: EnergyContextResponse;
  chainName?: string;
};

export function CarbonFootprintIndustrialBlock({
  solarInputs = [],
  energyContext,
  chainName,
}: CarbonFootprintIndustrialBlockProps) {
  const exposure = computeCarbonRouteExposure(solarInputs);

  if (!exposure.length) {
    return (
      <section className="w-full rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 text-sm text-zinc-400 backdrop-blur-xl">
        Nenhum insumo com rota produtiva classificada disponível para {chainName ?? "esta cadeia"}.
      </section>
    );
  }

  const fossilExposure = exposure.find((item) => item.routeClass === "fossil_dominant");
  const transitionExposure = exposure.find((item) => item.routeClass === "transition_underway");
  const lowCarbonExposure = exposure.find((item) => item.routeClass === "low_carbon_dominant");
  const lowCarbonInputs = solarInputs
    .filter((input) => input.production_route_class === "low_carbon_dominant")
    .sort((left, right) => right.imports_value_usd - left.imports_value_usd);

  // Top-value input driving each share -- quoting its own
  // production_route_rationale keeps the claim chain-specific and sourced,
  // instead of a blanket "China/carvão" line that wouldn't hold for every
  // chain this component renders for (aço, fertilizantes, etc.). This is
  // also why "transição em curso" isn't relabeled to something
  // silicio-specific like "China/Carvão": the same route class covers very
  // different rationale text (and countries) across chains, so the fix is
  // surfacing that chain's own quoted rationale, not renaming the class.
  const fossilLeadInput = [...solarInputs]
    .filter((input) => input.production_route_class === "fossil_dominant")
    .sort((left, right) => right.imports_value_usd - left.imports_value_usd)[0];
  const transitionLeadInput = [...solarInputs]
    .filter((input) => input.production_route_class === "transition_underway")
    .sort((left, right) => right.imports_value_usd - left.imports_value_usd)[0];

  // silicio is the only chain currently mapped to a BEN block in
  // build_energy_context_ben.py (ENERGIA SOLAR FOTOVOLTAICA / GWh); other
  // chains may return no blocos at all, so this whole section is optional.
  const benBlock = energyContext?.blocos[0];
  const benItem = benBlock?.itens[0];

  return (
    <section className="w-full space-y-6 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 text-zinc-100 backdrop-blur-xl md:p-8">
      <div className="space-y-1 border-b border-white/[0.06] pb-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
          <span>Sustentabilidade e Neoindustrialização Verde</span>
        </div>
        <h3 className="text-xl font-bold tracking-tight text-white">
          Exposição de Carbono da Pauta Importada
        </h3>
        <p className="text-xs text-zinc-400 md:text-sm">
          Distribuição real do valor importado desta cadeia por rota produtiva declarada (não estimativa de
          emissões) — ver "Insumos e componentes relacionados" no diagnóstico de soberania para a metodologia por
          insumo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl border border-red-900/30 bg-zinc-950/60 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span>Exposição a rota fóssil dominante</span>
          </div>
          {fossilExposure ? (
            <>
              <p className="text-2xl font-bold text-white">{percent.format(fossilExposure.share)}</p>
              <p className="text-xs leading-relaxed text-zinc-300">
                da pauta importada desta cadeia ({usdCompact.format(fossilExposure.importsValueUsd)}) vem de insumos
                classificados com rota produtiva fóssil dominante.
              </p>
              {fossilLeadInput?.production_route_rationale ? (
                <p className="border-t border-white/[0.06] pt-2 text-[11px] italic leading-relaxed text-zinc-400">
                  "{fossilLeadInput.production_route_rationale}" — {fossilLeadInput.label}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs leading-relaxed text-zinc-300">
              Nenhum insumo desta cadeia está classificado com rota fóssil dominante no período.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-amber-900/30 bg-zinc-950/60 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Rota em transição — carrega intensidade a montante</span>
          </div>
          {transitionExposure ? (
            <>
              <p className="text-2xl font-bold text-white">{percent.format(transitionExposure.share)}</p>
              <p className="text-xs leading-relaxed text-zinc-300">
                da pauta importada ({usdCompact.format(transitionExposure.importsValueUsd)}) vem de insumos cuja
                etapa final é menos eletrointensiva, mas cuja cadeia a montante ainda herda a matriz elétrica —
                predominantemente a carvão — dos países fornecedores.
              </p>
              {transitionLeadInput?.production_route_rationale ? (
                <p className="border-t border-white/[0.06] pt-2 text-[11px] italic leading-relaxed text-zinc-400">
                  "{transitionLeadInput.production_route_rationale}" — {transitionLeadInput.label}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs leading-relaxed text-zinc-300">
              Nenhum insumo desta cadeia está classificado com rota em transição no período.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-emerald-900/30 bg-zinc-950/60 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Insumos já em rota de baixo carbono</span>
          </div>
          {lowCarbonExposure && lowCarbonInputs.length ? (
            <>
              <p className="text-2xl font-bold text-white">{percent.format(lowCarbonExposure.share)}</p>
              <p className="text-xs leading-relaxed text-zinc-300">
                da pauta importada ({usdCompact.format(lowCarbonExposure.importsValueUsd)}) já é suprida por{" "}
                {lowCarbonInputs.map((input) => input.label).join(", ")}, com rota produtiva de baixo carbono
                predominante confirmada.
              </p>
              {lowCarbonInputs[0].production_route_rationale ? (
                <p className="border-t border-white/[0.06] pt-2 text-[11px] italic leading-relaxed text-zinc-400">
                  "{lowCarbonInputs[0].production_route_rationale}" — {lowCarbonInputs[0].label}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs leading-relaxed text-zinc-300">
              Nenhum insumo desta cadeia está classificado com rota de baixo carbono predominante no período —
              oportunidade de adensamento ainda não capturada na pauta importada.
            </p>
          )}
          {benItem ? (
            <p className="border-t border-white/[0.06] pt-2 text-[11px] leading-relaxed text-zinc-400">
              Contexto nacional (BEN/EPE, {energyContext?.ano_selecionado}): {benBlock?.setor_ben} —{" "}
              {benItem.fonte_energetica} de {benItem.valor.toLocaleString("pt-BR")} {benBlock?.unidade}.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
          Distribuição real por rota produtiva declarada
        </span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(ROUTE_CLASS_LABELS) as ProductionRouteClass[]).map((routeClass) => {
            const item = exposure.find((entry) => entry.routeClass === routeClass);
            const color = ROUTE_CLASS_COLORS[routeClass];
            return (
              <div
                key={routeClass}
                className="flex flex-col justify-between gap-2 rounded-xl border p-3"
                style={{ borderColor: `${color}4D`, backgroundColor: `${color}1A`, color }}
              >
                <span className="text-xs font-bold tracking-wide">{ROUTE_CLASS_LABELS[routeClass]}</span>
                <span className="text-[11px] leading-snug opacity-80">
                  {item ? `${percent.format(item.share)} da pauta (${usdCompact.format(item.importsValueUsd)})` : "Sem insumos nesta rota"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default CarbonFootprintIndustrialBlock;
