"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { EnergyContextResponse } from "../types/energy-context";

type StageKey = "si_gm" | "polissilicio" | "wafer" | "modulo" | "bf_bof" | "eaf" | "amonia" | "ureia";

type Stage = {
  key: StageKey;
  label: string;
  process: string;
  energyIntensity: string;
  brazilCapacity: string;
  chinaConcentration: string;
  concentrationBadge: string;
  concentrationBadgeTone: "risk" | "neutral";
  note: string;
};

type WaterfallStep = { label: string; value: string; note?: string; stage: StageKey | null };

// Process energy intensity (MWh/t or kWh/painel) is physics-driven and does
// not meaningfully change with the plant's country -- what differs is the
// grid carbon intensity powering it. So each stage lists ONE energy figure,
// not a separate Brazil/China number; the Brazil-vs-China contrast that
// matters is capacity (who actually runs this stage today) and, downstream,
// embedded emissions from the >84% renewable SIN grid vs a majority-coal
// grid -- already established elsewhere in this app as the ~6x figure,
// reused here rather than re-derived from an unverified tCO2/MWh factor.
const SILICON_STAGES: Stage[] = [
  {
    key: "si_gm",
    label: "Quartzito → Si-GM",
    process: "Redução carbotérmica em forno a arco submerso",
    energyIntensity: "10–15 MWh/t",
    brazilCapacity: "Capacidade nacional consolidada — principal ativo de exportação da cadeia.",
    chinaConcentration: "Produção mundial concentrada, majoritariamente em matriz elétrica a carvão.",
    concentrationBadge: "Produção distribuída — Brasil entre os principais exportadores",
    concentrationBadgeTone: "neutral",
    note: "Mesma intensidade elétrica de processo em qualquer país; a diferença real está na matriz que a alimenta — >84% renovável no Brasil.",
  },
  {
    key: "polissilicio",
    label: "Si-GM → Polissilício grau solar",
    process: "Purificação (processo Siemens/FBR)",
    energyIntensity: "100–120 MWh/t",
    brazilCapacity: "Sem planta nacional em operação — potencial não realizado, barreira de CAPEX (US$ 40–100/kg).",
    chinaConcentration: "Capacidade concentrada em Xinjiang e Mongólia Interior, matriz predominantemente a carvão.",
    concentrationBadge: "~75–90% da capacidade mundial na Ásia (China)",
    concentrationBadgeTone: "risk",
    note: "Maior barreira de capital da cadeia — o gargalo de refino que o diferimento tributário isolado (PADIS) não resolve sozinho.",
  },
  {
    key: "wafer",
    label: "Polissilício → Lingotes (Cz) / Wafers",
    process: "Crescimento de cristal Czochralski + corte (kerf loss)",
    energyIntensity: "20–30 MWh/t",
    brazilCapacity: "Vazio fabril confirmado — 0% de capacidade nacional nesta etapa.",
    chinaConcentration: "Mais de 97% da capacidade mundial de crescimento de lingotes e corte de wafers.",
    concentrationBadge: ">97% da capacidade mundial na China",
    concentrationBadgeTone: "risk",
    note: "Concentração geopolítica mais extrema da cadeia, mesmo com baixo volume comercial em dólares.",
  },
  {
    key: "modulo",
    label: "Célula → Módulo fotovoltaico",
    process: "Encapsulamento e montagem",
    energyIntensity: "15–20 kWh/painel",
    brazilCapacity: "Capacidade de montagem consolidada no Brasil, a partir de células majoritariamente importadas.",
    chinaConcentration: "Módulo pronto importado carrega energia embutida (fóssil) das etapas anteriores da cadeia.",
    concentrationBadge: "Concentração é upstream — não na etapa de montagem",
    concentrationBadgeTone: "neutral",
    note: "Etapa menos eletrointensiva — o adensamento real está em reter as etapas anteriores, não só a montagem final.",
  },
];

const SILICON_MASS_WATERFALL: WaterfallStep[] = [
  { label: "Quartzito", value: "100% (base)", stage: null },
  { label: "Silício grau metalúrgico (Si-GM)", value: "≈ 80–85% de rendimento de massa", stage: "si_gm" },
  {
    label: "Polissilício grau solar",
    value: "≈ 99,9999999% (9N) de pureza",
    note: "não é % de massa retida",
    stage: "polissilicio",
  },
  { label: "Wafer (após corte)", value: "≈ 20–30% de perda de massa no corte (kerf loss)", stage: "wafer" },
  { label: "Módulo fotovoltaico", value: "Produto final encapsulado", stage: "modulo" },
];

// Steel and nitrogen-fertilizer stages below are a route COMPARISON (two
// alternative ways to make the same output), not a single linear chain like
// silicio's quartzo-to-module -- so there's no defensible mass-yield
// waterfall to show for them (steelmaking/Haber-Bosch are chemical
// conversions, not a physical-yield cascade), and MASS_WATERFALL_BY_CHAIN
// below only has an entry for silicio. combustiveis_transicao isn't included
// at all: it covers structurally unrelated molecules (H2, ethanol,
// biodiesel, methanol) with no single defensible stage sequence, so that
// chain intentionally keeps using the generic EnergyContextBenPanel instead
// of a fabricated one here.
const ACO_STAGES: Stage[] = [
  {
    key: "bf_bof",
    label: "Minério + coque → Aço bruto (rota integrada, BF-BOF)",
    process: "Redução em alto-forno a coque + conversão a oxigênio",
    energyIntensity: "16–18 GJ/t aço bruto",
    brazilCapacity: "Rota dominante no parque siderúrgico nacional, com minério de ferro majoritariamente doméstico.",
    chinaConcentration: "Rota também dominante mundialmente; a China responde por cerca de 53,8% do aço bruto mundial.",
    concentrationBadge: "~54% do aço bruto mundial produzido na China",
    concentrationBadgeTone: "risk",
    note: "Rota mais intensiva em carbono da cadeia -- o coque metalúrgico como redutor é a origem fóssil dominante do aço primário.",
  },
  {
    key: "eaf",
    label: "Sucata → Aço bruto (rota elétrica, EAF)",
    process: "Refusão elétrica de sucata ferrosa em forno a arco",
    energyIntensity: "2,1–2,4 GJ/t aço bruto",
    brazilCapacity: "Rota em expansão, aproveitando sucata ferrosa doméstica e a matriz elétrica nacional majoritariamente renovável.",
    chinaConcentration: "Rota historicamente minoritária na matriz mundial, dominada pela rota integrada a carvão.",
    concentrationBadge: "≈1/8 da intensidade energética da rota integrada",
    concentrationBadgeTone: "neutral",
    note: "A alavanca de descarbonização mais direta hoje disponível para a siderurgia -- cerca de 1/8 da energia da rota a coque.",
  },
];

const FERTILIZANTES_STAGES: Stage[] = [
  {
    key: "amonia",
    label: "Gás natural → Amônia (Haber-Bosch)",
    process: "Reforma a vapor de metano + síntese Haber-Bosch",
    energyIntensity: "28–41 GJ/t amônia",
    brazilCapacity: "Capacidade doméstica pequena frente ao consumo -- a maior parte da amônia consumida no Brasil é importada.",
    chinaConcentration: "China concentra cerca de 30% da produção mundial de amônia.",
    concentrationBadge: "~30% da produção mundial de amônia na China",
    concentrationBadgeTone: "risk",
    note: "Faixa entre a melhor tecnologia disponível a gás natural (28 GJ/t) e a média mundial atual (41 GJ/t) -- cerca de 70% da amônia mundial ainda usa a rota a gás natural.",
  },
  {
    key: "ureia",
    label: "Amônia → Ureia",
    process: "Síntese de ureia a partir de amônia e CO2",
    energyIntensity: "≈ 22–25 GJ/t ureia (produção integrada, já incluindo a amônia como insumo)",
    brazilCapacity: "Produção nacional parcial -- o Brasil ainda importa a maior parte da ureia consumida.",
    chinaConcentration: "Concentração de capacidade menos extrema que a da amônia, com múltiplos polos produtores globais.",
    concentrationBadge: "Concentração global menos extrema que a da amônia",
    concentrationBadgeTone: "neutral",
    note: "Herda a rota fóssil da amônia -- a ureia não tem hoje uma rota de baixo carbono comercialmente madura.",
  },
];

const STAGES_BY_CHAIN: Record<string, Stage[]> = {
  silicio: SILICON_STAGES,
  aco: ACO_STAGES,
  fertilizantes: FERTILIZANTES_STAGES,
};

const MASS_WATERFALL_BY_CHAIN: Record<string, WaterfallStep[] | undefined> = {
  silicio: SILICON_MASS_WATERFALL,
};

const SOURCE_NOTE_BY_CHAIN: Record<string, string> = {
  silicio:
    "as faixas de intensidade energética e o balanço de massa acima são parâmetros típicos da manufatura solar internacional (Siemens/FBR, Czochralski)",
  aco:
    "as faixas de intensidade energética das rotas BF-BOF e EAF acima seguem o IEA Iron and Steel Technology Roadmap (2020) e o World Steel Association (2020); a concentração da China é do World Steel in Figures 2025",
  fertilizantes:
    "as faixas de intensidade energética de amônia e ureia acima seguem o IEA Ammonia Technology Roadmap (2021) e literatura de engenharia de processo para a síntese integrada de ureia",
};

// Chains with real, sourced stage content for this panel -- checked by
// MainAnalyticalDashboard.tsx to decide between this panel and the generic
// EnergyContextBenPanel fallback.
export const MASS_ENERGY_BALANCE_CHAINS = new Set(Object.keys(STAGES_BY_CHAIN));

type SiliconMassEnergyBalancePanelProps = {
  chainId?: string | null;
  energyContext?: EnergyContextResponse;
};

export function SiliconMassEnergyBalancePanel({ chainId, energyContext }: SiliconMassEnergyBalancePanelProps) {
  const stages = (chainId && STAGES_BY_CHAIN[chainId]) || SILICON_STAGES;
  const massWaterfall = (chainId && MASS_WATERFALL_BY_CHAIN[chainId]) || undefined;
  const sourceNote = (chainId && SOURCE_NOTE_BY_CHAIN[chainId]) || SOURCE_NOTE_BY_CHAIN.silicio;
  const [activeStage, setActiveStage] = useState<StageKey>(stages[0].key);
  // Reset to the first tab when the chain changes -- otherwise a stage key
  // from the previous chain's StageKey space (e.g. "polissilicio") could be
  // left selected against a chain that doesn't have it.
  useEffect(() => setActiveStage(stages[0].key), [chainId]); // eslint-disable-line react-hooks/exhaustive-deps
  const stage = stages.find((s) => s.key === activeStage) ?? stages[0];

  const benBlock = energyContext?.blocos[0];
  const benTotal = benBlock?.itens.find((item) => item.fonte_energetica.trim().toUpperCase().startsWith("CONSUMO"));

  return (
    <section className="overflow-hidden rounded-xl border border-sky-300/15 bg-zinc-950/65 text-zinc-100">
      <header className="border-b border-white/[0.08] bg-sky-400/[0.035] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
          Balanço comparativo de massa e energia · Brasil vs. concentração global
        </p>
        <h3 className="mt-2 text-xl font-bold text-white">Intensidade energética por etapa da cadeia</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
          Onde a energia de processo é consumida, quem tem capacidade nacional hoje, e onde a produção mundial
          está concentrada — etapa a etapa (ou rota a rota) da cadeia.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-white/[0.06] px-4 py-3 sm:px-6">
        {stages.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveStage(s.key)}
            aria-pressed={s.key === activeStage}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              s.key === activeStage
                ? "border-sky-300/40 bg-sky-400/10 text-sky-200"
                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-5 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Processo</p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">{stage.process}</p>
            <p className="mt-3 font-mono text-lg font-bold text-sky-300">{stage.energyIntensity}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-zinc-900/50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Brasil</p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">{stage.brazilCapacity}</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-zinc-900/50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Concentração global</p>
            <span
              className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                stage.concentrationBadgeTone === "risk"
                  ? "border-red-400/30 bg-red-400/10 text-red-300"
                  : "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"
              }`}
            >
              {stage.concentrationBadge}
            </span>
            <p className="mt-2 text-sm leading-relaxed text-zinc-200">{stage.chinaConcentration}</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg border border-white/[0.06] bg-zinc-950/45 px-3.5 py-3 text-xs leading-relaxed text-zinc-400">
          {stage.note}
        </p>
      </div>

      {massWaterfall ? (
        <div className="border-t border-white/[0.06] px-4 py-5 sm:px-6">
          <p className="text-sm font-semibold text-white">Balanço de massa (ilustrativo)</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {massWaterfall.map((step, index) => {
              const isActive = step.stage === activeStage;
              return (
                <div key={step.label} className="flex items-center gap-2">
                  <span
                    className={`rounded-lg border px-3 py-2 text-zinc-300 transition ${
                      isActive
                        ? "border-sky-300/70 bg-sky-400/10 shadow-[0_0_0_1px_rgba(56,189,248,0.45),0_0_14px_rgba(56,189,248,0.35)]"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <span className={`block font-semibold ${isActive ? "text-sky-200" : "text-zinc-100"}`}>
                      {step.label}
                    </span>
                    <span className="text-[11px] text-zinc-500">{step.value}</span>
                    {step.note ? <span className="block text-[10px] text-zinc-600">{step.note}</span> : null}
                  </span>
                  {index < massWaterfall.length - 1 ? <span className="text-zinc-600">→</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex gap-3 border-t border-amber-300/15 bg-amber-400/[0.05] px-4 py-4 text-xs leading-5 text-zinc-400 sm:px-6">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <p>
          <strong className="text-amber-200">Referência técnica de literatura do setor:</strong> {sourceNote} —
          não são extraídos das bases oficiais desta plataforma (Comex Stat, PIA, RAIS, BEN/EPE) e não devem
          ser lidos com a mesma precisão estatística dos demais indicadores. Use como contexto de engenharia
          de processo, não como dado de comércio ou produção medido.
          {benTotal ? (
            <>
              {" "}Para referência oficial, o BEN/EPE {energyContext?.ano_selecionado} registra{" "}
              {benTotal.valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} {benBlock?.unidade} de{" "}
              {benBlock?.setor_ben.toLowerCase()} no balanço nacional.
            </>
          ) : null}
        </p>
      </div>
    </section>
  );
}

export default SiliconMassEnergyBalancePanel;
