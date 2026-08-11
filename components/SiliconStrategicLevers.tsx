"use client";

import { ChevronDown, Landmark, Leaf, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { computeCarbonRouteExposure } from "./CarbonFootprintIndustrialBlock";
import type { SolarInputMetric } from "../types/solar-sovereignty";

export type SiliconValueAsymmetry = {
  exportInputLabel: string;
  exportPricePerKg: number;
  importInputLabel: string;
  importPricePerKg: number;
  ratio: number;
};

type SiliconStrategicLeversProps = {
  valueAsymmetry?: SiliconValueAsymmetry;
  solarInputs: SolarInputMetric[];
};

const usdPerKg = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

// Native <details> for the technical footnotes -- same progressive-disclosure
// pattern TechnicalDrawer.tsx already uses, kept collapsed by default so
// level-1 reading stays numeric/scannable per the executive-view audit.
function TechnicalDetail({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <details className="group mt-1">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1 text-[11px] font-semibold uppercase tracking-wide ${accent} marker:hidden`}
      >
        Detalhamento técnico
        <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-zinc-400">
        {children}
      </div>
    </details>
  );
}

export function SiliconStrategicLevers({ valueAsymmetry, solarInputs }: SiliconStrategicLeversProps) {
  const exposure = computeCarbonRouteExposure(solarInputs);
  // Share of imports NOT already on a low-carbon route -- the meaningful
  // contrast against Brazil's own clean Si-GM production. The inverse (share
  // already low-carbon) is misleadingly tiny: Brazil is largely
  // self-sufficient in the low-carbon-tagged raw materials (quartzo etc.),
  // so it barely imports them, which mechanically depresses that slice
  // regardless of how the rest of the chain is produced abroad.
  const nonLowCarbonShare = exposure.length
    ? 1 - (exposure.find((item) => item.routeClass === "low_carbon_dominant")?.share ?? 0)
    : undefined;

  return (
    <section
      aria-label="Alavancas estratégicas da cadeia de silício e solar"
      className="grid grid-cols-1 gap-4 lg:grid-cols-3"
    >
      <article className="flex flex-col gap-2 rounded-2xl border border-amber-500/25 bg-zinc-900/55 p-5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
          <Scale className="h-4 w-4" />
          Assimetria de valor por quilo
        </div>
        {valueAsymmetry ? (
          <>
            <p className="text-2xl font-extrabold text-white">
              {valueAsymmetry.ratio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x
            </p>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                Exporta {valueAsymmetry.exportInputLabel} · {usdPerKg.format(valueAsymmetry.exportPricePerKg)}/kg
              </span>
              <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-red-200">
                Reimporta {valueAsymmetry.importInputLabel} · {usdPerKg.format(valueAsymmetry.importPricePerKg)}/kg
              </span>
            </div>
            <TechnicalDetail accent="text-amber-300/80">
              <p>Fonte: Comex Stat, período selecionado.</p>
              <p>
                Referência de contexto (fora da base de comércio exterior): a redução carbotérmica de
                silício grau metalúrgico consome tipicamente 10–15 MWh por tonelada, segundo a literatura
                técnica do setor.
              </p>
            </TechnicalDetail>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-zinc-300">
            Dados insuficientes de peso líquido no período para calcular o preço por quilo desta cadeia.
          </p>
        )}
      </article>

      <article className="flex flex-col gap-2 rounded-2xl border border-cyan-500/25 bg-zinc-900/55 p-5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
          <Landmark className="h-4 w-4" />
          Alavancagem regulatória — PADIS
        </div>
        <p className="text-sm font-semibold leading-snug text-white">
          Diferimento de IPI/PIS/COFINS cobre processamento e montagem —{" "}
          <span className="text-cyan-200">não cobre o CAPEX do refino</span>.
        </p>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">
            Lei 11.484/2007
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-zinc-300">
            CAPEX US$ 40–100/kg
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-zinc-300">
            100–120 MWh/t
          </span>
        </div>
        <TechnicalDetail accent="text-cyan-300/80">
          <p>
            O PADIS permite diferimento de IPI, PIS e COFINS sobre insumos, máquinas e equipamentos da
            cadeia de semicondutores e displays, incidindo sobre o processamento e a montagem de módulos e
            células — não sobre a barreira física de capital anterior a essa etapa.
          </p>
          <p>
            O refino de polissilício grau solar (processo Siemens/FBR) exige CAPEX da ordem de US$ 40–100/kg
            de capacidade instalada e consumo de 100–120 MWh por tonelada — por isso o diferimento
            tributário do PADIS tende a precisar de instrumentos complementares de crédito estruturado
            (BNDES Finem, Fundo Clima) para viabilizar planta nacional nessa etapa.
          </p>
          <p>
            Referência regulatória e técnica — benefício fiscal federal e parâmetros de CAPEX/energia do
            setor, não derivados das bases de comércio exterior (Comex, PIA, RAIS). Verificar vigência
            atualizada antes de decisão de investimento.
          </p>
        </TechnicalDetail>
      </article>

      <article className="flex flex-col gap-2 rounded-2xl border border-emerald-500/25 bg-zinc-900/55 p-5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
          <Leaf className="h-4 w-4" />
          Prêmio de descarbonização
        </div>
        {nonLowCarbonShare !== undefined ? (
          <>
            <p className="text-2xl font-extrabold text-white">{percent.format(nonLowCarbonShare)}</p>
            <p className="text-xs font-semibold leading-snug text-zinc-200">
              da pauta importada ainda é fóssil/transição, concentrada na China
            </p>
          </>
        ) : null}
        <span className="w-fit rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
          Si-GM nacional: até 6x menos carbono · &gt;84% matriz renovável
        </span>
        <TechnicalDetail accent="text-emerald-300/80">
          <p>
            O Si-GM produzido no Brasil tem pegada de carbono até 6x menor que o refinado na China, graças à
            matriz elétrica nacional (&gt;84% renovável) — argumento direto para atração de capital via
            powershoring e para exposição reduzida ao CBAM europeu.
          </p>
        </TechnicalDetail>
      </article>
    </section>
  );
}

export default SiliconStrategicLevers;
