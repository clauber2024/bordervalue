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
  categoryNote?: string;
};

type SiliconStrategicLeversProps = {
  // Kept generic (not "silicio-only" despite the file/component name, which
  // predates this covering all 4 published chains -- see the historical
  // aipnet_solar_* rename for the same kind of leftover name).
  chainId?: string | null;
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

// Regulatory-lever card content, branched per chain like
// sectorRecommendedPolicy() in MainAnalyticalDashboard.tsx -- real, citable
// federal mechanisms only. Aço has no equivalent specific fiscal regime
// (verified via search: only generic sector "needs more incentive" coverage,
// no named law/decree comparable to PADIS/REIQ/RenovaBio), so it gets an
// honest descriptive card instead of an invented one.
function RegulatoryLeverCard({ chainId }: { chainId?: string | null }) {
  if (chainId === "fertilizantes") {
    return (
      <article className="flex flex-col gap-2 rounded-2xl border border-cyan-500/25 bg-zinc-900/55 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
          <Landmark className="h-4 w-4" />
          Alavancagem regulatória — REIQ
        </div>
        <p className="text-sm font-semibold leading-snug text-white">
          Isenção de PIS/COFINS sobre insumos petroquímicos —{" "}
          <span className="text-cyan-200">com crédito adicional para nova capacidade de fertilizante a gás natural</span>.
        </p>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">
            Decreto federal, reinstituído em 2023
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-zinc-300">
            Contrapartida: manter nível de emprego e créditos de GEE
          </span>
        </div>
        <TechnicalDetail accent="text-cyan-300/80">
          <p>
            O Regime Especial da Indústria Química (REIQ), criado em 2013 e reinstituído por decreto federal
            em agosto de 2023, isenta PIS e COFINS na compra dos principais insumos da petroquímica de
            primeira e segunda geração — reduzindo o diferencial de custo frente a concorrentes
            internacionais.
          </p>
          <p>
            O decreto de 2023 previu especificamente crédito adicional para empresas que ampliarem
            capacidade produtiva ou instalarem novas plantas de fertilizantes nitrogenados a partir de gás
            natural — a rota que domina a amônia e a ureia consumidas no Brasil. Em contrapartida, as
            empresas precisam manter o nível de emprego e adquirir créditos de redução de GEE verificada.
          </p>
          <p>
            Referência regulatória — benefício fiscal federal, não derivado das bases de comércio exterior
            (Comex, PIA, RAIS). Verificar vigência atualizada antes de decisão de investimento.
          </p>
        </TechnicalDetail>
      </article>
    );
  }

  if (chainId === "combustiveis_transicao") {
    return (
      <article className="flex flex-col gap-2 rounded-2xl border border-cyan-500/25 bg-zinc-900/55 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
          <Landmark className="h-4 w-4" />
          Alavancagem regulatória — RenovaBio
        </div>
        <p className="text-sm font-semibold leading-snug text-white">
          Mercado de crédito de descarbonização (CBIO) —{" "}
          <span className="text-cyan-200">remunera o produtor pela intensidade de carbono, não pelo volume</span>.
        </p>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">
            Lei 13.576/2017
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-zinc-300">
            CBIO negociado em bolsa
          </span>
        </div>
        <TechnicalDetail accent="text-cyan-300/80">
          <p>
            A Política Nacional de Biocombustíveis (RenovaBio, Lei 13.576/2017) fixa metas nacionais de
            redução de emissões para a matriz de combustíveis, divididas em obrigações anuais por
            distribuidor. Cada produtor de biocombustível emite CBIOs (Créditos de Descarbonização) na
            venda, com o volume calibrado pela análise de ciclo de vida do combustível frente ao fóssil que
            substitui.
          </p>
          <p>
            Distribuidoras compram CBIOs — ativo financeiro negociado em bolsa — para cumprir sua meta
            anual, criando demanda paga diretamente pela intensidade de carbono do produtor, não apenas pelo
            volume vendido. É um mecanismo de mercado, diferente do diferimento tributário direto do PADIS,
            mas com o mesmo papel de alavanca federal para a rota de baixo carbono.
          </p>
          <p>
            Referência regulatória — instrumento federal de mercado, não derivado das bases de comércio
            exterior (Comex, PIA, RAIS). Verificar meta e preço de CBIO vigentes antes de decisão de
            investimento.
          </p>
        </TechnicalDetail>
      </article>
    );
  }

  if (chainId === "aco") {
    return (
      <article className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-zinc-900/55 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
          <Landmark className="h-4 w-4" />
          Contexto regulatório
        </div>
        <p className="text-sm font-semibold leading-snug text-white">
          Sem regime fiscal federal específico —{" "}
          <span className="text-zinc-300">diferente de silício (PADIS), fertilizantes (REIQ) e combustíveis (RenovaBio)</span>.
        </p>
        <TechnicalDetail accent="text-zinc-300/80">
          <p>
            Ao contrário das outras 3 cadeias prioritárias, a siderurgia brasileira não conta hoje com um
            regime fiscal federal específico e nomeado para a rota de descarbonização (aço verde/redução a
            hidrogênio). A cobertura disponível é de análises setoriais (ex. Global Energy Monitor, Aço
            Verde Brasil) discutindo a necessidade de incentivo, sem um instrumento legal concreto
            equivalente ao PADIS/REIQ/RenovaBio já em vigor.
          </p>
          <p>
            Referência de contexto — não é benefício fiscal vigente, e não deriva das bases de comércio
            exterior (Comex, PIA, RAIS). Reavaliar se um regime específico for instituído.
          </p>
        </TechnicalDetail>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-cyan-500/25 bg-zinc-900/55 p-6 shadow-xl backdrop-blur-xl">
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
  );
}

export function SiliconStrategicLevers({ chainId, valueAsymmetry, solarInputs }: SiliconStrategicLeversProps) {
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
      aria-label="Alavancas estratégicas da cadeia"
      className="grid grid-cols-1 gap-4 lg:grid-cols-3"
    >
      <article className="flex flex-col gap-2 rounded-2xl border border-amber-500/25 bg-zinc-900/55 p-6 shadow-xl backdrop-blur-xl">
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
            {valueAsymmetry.categoryNote ? (
              <p className="text-[11px] leading-relaxed text-zinc-400">{valueAsymmetry.categoryNote}</p>
            ) : null}
            <TechnicalDetail accent="text-amber-300/80">
              <p>Fonte: Comex Stat, período selecionado.</p>
              {chainId === "silicio" ? (
                <p>
                  Referência de contexto (fora da base de comércio exterior): a redução carbotérmica de
                  silício grau metalúrgico consome tipicamente 10–15 MWh por tonelada, segundo a literatura
                  técnica do setor.
                </p>
              ) : null}
            </TechnicalDetail>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-zinc-300">
            Dados insuficientes de peso líquido no período para calcular o preço por quilo desta cadeia.
          </p>
        )}
      </article>

      <RegulatoryLeverCard chainId={chainId} />

      <article className="flex flex-col gap-2 rounded-2xl border border-emerald-500/25 bg-zinc-900/55 p-6 shadow-xl backdrop-blur-xl">
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
          {chainId === "silicio"
            ? "Si-GM nacional: até 6x menos carbono · >84% matriz renovável"
            : ">84% matriz elétrica nacional renovável (BEN/EPE)"}
        </span>
        <TechnicalDetail accent="text-emerald-300/80">
          {chainId === "silicio" ? (
            <p>
              O Si-GM produzido no Brasil tem pegada de carbono até 6x menor que o refinado na China, graças à
              matriz elétrica nacional (&gt;84% renovável) — argumento direto para atração de capital via
              powershoring e para exposição reduzida ao CBAM europeu.
            </p>
          ) : (
            <p>
              A produção nacional nas etapas de baixo carbono desta cadeia se beneficia da matriz elétrica
              brasileira (&gt;84% renovável, BEN/EPE) — uma vantagem estrutural frente a rotas produzidas em
              matrizes mais intensivas em carbono, ainda que a intensidade de carbono específica de cada
              etapa desta cadeia não esteja quantificada nas bases oficiais da plataforma.
            </p>
          )}
        </TechnicalDetail>
      </article>
    </section>
  );
}

export default SiliconStrategicLevers;
