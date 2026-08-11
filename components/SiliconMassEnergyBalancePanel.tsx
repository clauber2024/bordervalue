"use client";

import { useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { EnergyContextResponse } from "../types/energy-context";

type StageKey = "si_gm" | "polissilicio" | "wafer" | "modulo";

type Stage = {
  key: StageKey;
  label: string;
  process: string;
  energyIntensity: string;
  brazilCapacity: string;
  chinaConcentration: string;
  note: string;
};

// Process energy intensity (MWh/t or kWh/painel) is physics-driven and does
// not meaningfully change with the plant's country -- what differs is the
// grid carbon intensity powering it. So each stage lists ONE energy figure,
// not a separate Brazil/China number; the Brazil-vs-China contrast that
// matters is capacity (who actually runs this stage today) and, downstream,
// embedded emissions from the >84% renewable SIN grid vs a majority-coal
// grid -- already established elsewhere in this app as the ~6x figure,
// reused here rather than re-derived from an unverified tCO2/MWh factor.
const STAGES: Stage[] = [
  {
    key: "si_gm",
    label: "Quartzito → Si-GM",
    process: "Redução carbotérmica em forno a arco submerso",
    energyIntensity: "10–15 MWh/t",
    brazilCapacity: "Capacidade nacional consolidada — principal ativo de exportação da cadeia.",
    chinaConcentration: "Produção mundial concentrada, majoritariamente em matriz elétrica a carvão.",
    note: "Mesma intensidade elétrica de processo em qualquer país; a diferença real está na matriz que a alimenta — >84% renovável no Brasil.",
  },
  {
    key: "polissilicio",
    label: "Si-GM → Polissilício grau solar",
    process: "Purificação (processo Siemens/FBR)",
    energyIntensity: "100–120 MWh/t",
    brazilCapacity: "Sem planta nacional em operação — potencial não realizado, barreira de CAPEX (US$ 40–100/kg).",
    chinaConcentration: "Capacidade concentrada em Xinjiang e Mongólia Interior, matriz predominantemente a carvão.",
    note: "Maior barreira de capital da cadeia — o gargalo de refino que o diferimento tributário isolado (PADIS) não resolve sozinho.",
  },
  {
    key: "wafer",
    label: "Polissilício → Lingotes (Cz) / Wafers",
    process: "Crescimento de cristal Czochralski + corte (kerf loss)",
    energyIntensity: "20–30 MWh/t",
    brazilCapacity: "Vazio fabril confirmado — 0% de capacidade nacional nesta etapa.",
    chinaConcentration: "Mais de 97% da capacidade mundial de crescimento de lingotes e corte de wafers.",
    note: "Concentração geopolítica mais extrema da cadeia, mesmo com baixo volume comercial em dólares.",
  },
  {
    key: "modulo",
    label: "Célula → Módulo fotovoltaico",
    process: "Encapsulamento e montagem",
    energyIntensity: "15–20 kWh/painel",
    brazilCapacity: "Capacidade de montagem consolidada no Brasil, a partir de células majoritariamente importadas.",
    chinaConcentration: "Módulo pronto importado carrega energia embutida (fóssil) das etapas anteriores da cadeia.",
    note: "Etapa menos eletrointensiva — o adensamento real está em reter as etapas anteriores, não só a montagem final.",
  },
];

const MASS_WATERFALL = [
  { label: "Quartzito", value: "100% (base)" },
  { label: "Silício grau metalúrgico (Si-GM)", value: "≈ 80–85% de rendimento de massa" },
  { label: "Polissilício grau solar", value: "≈ 9N de pureza (não é % de massa retida)" },
  { label: "Wafer (após corte)", value: "≈ 20–30% de perda de massa no corte (kerf loss)" },
  { label: "Módulo fotovoltaico", value: "Produto final encapsulado" },
];

type SiliconMassEnergyBalancePanelProps = {
  energyContext?: EnergyContextResponse;
};

export function SiliconMassEnergyBalancePanel({ energyContext }: SiliconMassEnergyBalancePanelProps) {
  const [activeStage, setActiveStage] = useState<StageKey>("si_gm");
  const stage = STAGES.find((s) => s.key === activeStage) ?? STAGES[0];

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
          está concentrada — etapa a etapa, do quartzo ao módulo.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-white/[0.06] px-4 py-3 sm:px-6">
        {STAGES.map((s) => (
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
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">{stage.chinaConcentration}</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg border border-white/[0.06] bg-zinc-950/45 px-3.5 py-3 text-xs leading-relaxed text-zinc-400">
          {stage.note}
        </p>
      </div>

      <div className="border-t border-white/[0.06] px-4 py-5 sm:px-6">
        <p className="text-sm font-semibold text-white">Balanço de massa (ilustrativo)</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {MASS_WATERFALL.map((step, index) => (
            <div key={step.label} className="flex items-center gap-2">
              <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-zinc-300">
                <span className="block font-semibold text-zinc-100">{step.label}</span>
                <span className="text-[11px] text-zinc-500">{step.value}</span>
              </span>
              {index < MASS_WATERFALL.length - 1 ? <span className="text-zinc-600">→</span> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 border-t border-amber-300/15 bg-amber-400/[0.05] px-4 py-4 text-xs leading-5 text-zinc-400 sm:px-6">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <p>
          <strong className="text-amber-200">Referência técnica de literatura do setor:</strong> as faixas de
          intensidade energética e o balanço de massa acima são parâmetros típicos da manufatura solar
          internacional (Siemens/FBR, Czochralski) — não são extraídos das bases oficiais desta plataforma
          (Comex Stat, PIA, RAIS, BEN/EPE) e não devem ser lidos com a mesma precisão estatística dos demais
          indicadores. Use como contexto de engenharia de processo, não como dado de comércio ou produção
          medido.
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
