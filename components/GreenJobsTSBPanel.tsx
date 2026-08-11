"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, Info, MapPinned, Scale, WalletCards, X } from "lucide-react";
import type { SolarGreenJobs, SolarInputMetric } from "../types/solar-sovereignty";

type GreenJobsTSBPanelProps = {
  data: SolarGreenJobs;
  chainName?: string;
  solarInputs?: SolarInputMetric[];
};

type Selection = { kind: "activity"; cnae: string } | { kind: "state"; uf: string } | null;

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function GreenJobsTSBPanel({ data, chainName = "cadeia analisada", solarInputs = [] }: GreenJobsTSBPanelProps) {
  const [selection, setSelection] = useState<Selection>(null);
  const [showTsbInfo, setShowTsbInfo] = useState(false);

  const inputLabelById = useMemo(
    () => new Map(solarInputs.map((input) => [input.input_id, input.label])),
    [solarInputs],
  );
  // sector_names[0] is the CNAE *class* description (4-digit, broad --
  // "Fabricação de químicos orgânicos e inorgânicos, resinas e elastômeros"
  // covers several distinct classes at once), so multiple activities in the
  // same broad chemistry family render identical labels unless the specific
  // input(s) tied to that CNAE row are appended.
  const activityLabel = (activity: SolarGreenJobs["activities"][number]) => {
    const base = activity.sector_names[0] ?? "Atividade produtiva associada à TSB";
    const inputNames = activity.input_ids.map((id) => inputLabelById.get(id)).filter((v): v is string => Boolean(v));
    return inputNames.length ? `${base} — ${inputNames.join(", ")}` : base;
  };

  const maxActivityJobs = Math.max(...data.activities.map((item) => item.formal_jobs), 1);
  const maxStateJobs = Math.max(...data.top_states.map((item) => item.formal_jobs), 1);
  const hasGasActivity = data.activities.some((activity) =>
    activity.sector_names.some((name) => /gás natural|gas natural/i.test(name)),
  );

  // activity <-> state cross-tab: both sides come from the same associated
  // CNAEs x RAIS rows (see load_green_jobs() in build_solar_sovereignty_metrics.py),
  // not fabricated in the frontend. Older cached payloads may not have it yet.
  const stateJobsByActivity = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const activity of data.activities) {
      map.set(activity.cnae_class, new Map((activity.state_jobs ?? []).map((s) => [s.uf, s.formal_jobs])));
    }
    return map;
  }, [data.activities]);

  const activityJobsByState = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const state of data.top_states) {
      map.set(state.uf, new Map((state.activity_jobs ?? []).map((a) => [a.cnae_class, a.formal_jobs])));
    }
    return map;
  }, [data.top_states]);

  const hasCrossData = data.activities.some((activity) => (activity.state_jobs?.length ?? 0) > 0);

  const selectedActivity = selection?.kind === "activity" ? selection.cnae : null;
  const selectedState = selection?.kind === "state" ? selection.uf : null;
  const selectedActivityMatch = selectedActivity
    ? data.activities.find((a) => a.cnae_class === selectedActivity)
    : undefined;
  const selectedActivityLabel = selectedActivity
    ? (selectedActivityMatch ? activityLabel(selectedActivityMatch) : selectedActivity)
    : null;

  return (
    <section className="overflow-hidden rounded-xl border border-emerald-300/15 bg-zinc-950/65 text-zinc-100">
      <header className="relative border-b border-white/[0.08] bg-emerald-400/[0.035] px-4 py-5 sm:px-6">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Taxonomia Sustentável Brasileira · RAIS {data.reference_year}
          </p>
          <button
            type="button"
            onClick={() => setShowTsbInfo((value) => !value)}
            aria-expanded={showTsbInfo}
            aria-label="O que é a TSB?"
            className="rounded-full p-0.5 text-emerald-300/70 transition hover:bg-emerald-400/10 hover:text-emerald-200"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        {showTsbInfo ? (
          <div className="mt-2 max-w-2xl rounded-lg border border-emerald-300/20 bg-zinc-950/80 p-3 text-[11px] leading-relaxed text-zinc-300">
            <strong className="text-emerald-200">O que é a TSB?</strong> A Taxonomia Sustentável Brasileira,
            coordenada pelo Ministério da Fazenda em articulação interministerial, é o sistema oficial de
            classificação do país para identificar atividades econômicas, ativos e projetos com impactos
            socioambientais positivos. Aqui, ela cruza os códigos CNAE das cadeias produtivas para filtrar
            postos de trabalho associados a atividades de baixo carbono e transição justa.
          </div>
        ) : null}
        <h3 className="mt-2 text-xl font-bold text-white">Emprego formal associado à {chainName}</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
          Vínculos existentes em atividades econômicas alcançadas pela cesta de insumos e cobertas pela análise TSB. Cobertura estatística não equivale a alinhamento sustentável.
        </p>
      </header>

      <div className="grid gap-3 px-4 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        <GreenJobsKpi icon={BriefcaseBusiness} label="Vínculos em CNAEs cobertos" value={integer.format(data.formal_jobs_in_tsb_activities)} note="Total RAIS no universo estatístico analisado" />
        <GreenJobsKpi icon={Scale} label="Estimativa ponderada" value={integer.format(data.exposure_weighted_jobs_estimate)} note="Proxy de cobertura, não certificação sustentável" />
        <GreenJobsKpi icon={WalletCards} label="Massa salarial de referência" value={currency.format(data.wage_mass_brl)} note="Agregação RAIS do recorte" />
        <GreenJobsKpi icon={MapPinned} label="Atividades abrangidas" value={integer.format(data.cnae_count)} note="Classes econômicas únicas, sem dupla contagem" />
      </div>

      <div className="grid gap-6 border-t border-white/[0.08] px-4 py-5 sm:px-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Onde estão os vínculos na cadeia ampliada</h4>
              <p className="mt-1 text-xs text-zinc-500">
                {hasCrossData
                  ? "Clique numa atividade para destacar os estados com vínculos nela."
                  : "Atividades nomeadas de forma executiva; códigos permanecem na gaveta técnica."}
              </p>
            </div>
            {selectedState ? (
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-400/20"
              >
                {selectedState}
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
          <div className="mt-4 space-y-4">
            {data.activities.map((activity) => {
              const label = activityLabel(activity);
              const isSelected = activity.cnae_class === selectedActivity;
              const jobsInSelectedState = selectedState
                ? stateJobsByActivity.get(activity.cnae_class)?.get(selectedState) ?? 0
                : null;
              const isDimmed = hasCrossData && selectedState !== null && !isSelected && jobsInSelectedState === 0;
              const displayedJobs = selectedState !== null ? jobsInSelectedState ?? 0 : activity.formal_jobs;
              return (
                <button
                  type="button"
                  key={activity.cnae_class}
                  onClick={() =>
                    hasCrossData &&
                    setSelection(isSelected ? null : { kind: "activity", cnae: activity.cnae_class })
                  }
                  aria-pressed={isSelected}
                  className={`block w-full text-left transition-opacity ${isDimmed ? "opacity-30" : "opacity-100"} ${hasCrossData ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="mb-1.5 flex items-end justify-between gap-4 text-xs">
                    <span className={`font-medium ${isSelected ? "text-emerald-200" : "text-zinc-300"}`}>{label}</span>
                    <span className="shrink-0 font-semibold text-emerald-300">{integer.format(displayedJobs)}</span>
                  </div>
                  <div className={`h-2 overflow-hidden rounded-full bg-zinc-900 ${isSelected ? "ring-1 ring-emerald-300/60" : ""}`}>
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${Math.max((displayedJobs / maxActivityJobs) * 100, 2)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">Cobertura estatística no recorte TSB: {(activity.exposure_ratio * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Concentração territorial</h4>
              <p className="mt-1 text-xs text-zinc-500">
                {hasCrossData
                  ? "Clique num estado para destacar as atividades com vínculos nele."
                  : "Estados com mais vínculos nas atividades associadas."}
              </p>
            </div>
            {selectedActivityLabel ? (
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-400/20"
              >
                {selectedActivityLabel}
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {data.top_states.map((state) => {
              const isSelected = state.uf === selectedState;
              const jobsInSelectedActivity = selectedActivity
                ? activityJobsByState.get(state.uf)?.get(selectedActivity) ?? 0
                : null;
              const isDimmed = hasCrossData && selectedActivity !== null && !isSelected && jobsInSelectedActivity === 0;
              const displayedJobs = selectedActivity !== null ? jobsInSelectedActivity ?? 0 : state.formal_jobs;
              return (
                <button
                  type="button"
                  key={state.uf}
                  onClick={() =>
                    hasCrossData && setSelection(isSelected ? null : { kind: "state", uf: state.uf })
                  }
                  aria-pressed={isSelected}
                  className={`grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 text-left text-xs transition-opacity ${isDimmed ? "opacity-30" : "opacity-100"} ${hasCrossData ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span className={`font-bold ${isSelected ? "text-cyan-200" : "text-zinc-300"}`}>{state.uf}</span>
                  <div className={`h-2 overflow-hidden rounded-full bg-zinc-900 ${isSelected ? "ring-1 ring-cyan-300/60" : ""}`}>
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: `${Math.max((displayedJobs / maxStateJobs) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="min-w-14 text-right text-zinc-400">{integer.format(displayedJobs)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {hasGasActivity ? (
        <div className="border-t border-purple-300/15 bg-purple-400/[0.05] px-4 py-4 text-xs leading-5 text-zinc-300 sm:px-6">
          <strong className="text-purple-200">Como interpretar o gás:</strong>{" "}
          o CNAE reúne gás natural fóssil, processamento e distribuição de combustíveis gasosos. A presença nessa classe não torna todo o setor sustentável. O alinhamento depende dos critérios técnicos da TSB; a diretriz desta plataforma prioriza biogás e biometano, infraestrutura compatível com sua expansão e redução verificável de emissões.
        </div>
      ) : null}

      <div className="space-y-2 border-t border-amber-300/15 bg-amber-400/[0.05] px-4 py-4 text-xs leading-5 text-zinc-400 sm:px-6">
        <div className="flex items-center gap-2 font-semibold text-amber-300">
          <Info className="h-4 w-4 shrink-0" />
          <span>Nota metodológica e escopo de emprego verde (TSB)</span>
        </div>
        <p>
          <strong className="text-amber-200">Enquadramento TSB:</strong> {data.methodology_note}
        </p>
        <p>
          <strong className="text-amber-200">Ponderação por exposição setorial:</strong> as classes CNAE cobrem
          indústrias amplas (ex.: fundição de metais, química). A estimativa ponderada aplica o fator de
          exposição de cada atividade à cadeia analisada para aproximar a parcela de vínculos diretamente
          vinculada aos insumos desta cadeia, em vez de contar a classe inteira.
        </p>
      </div>
    </section>
  );
}

function GreenJobsKpi({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-emerald-300"><Icon className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</span></div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-zinc-500">{note}</p>
    </div>
  );
}

export default GreenJobsTSBPanel;
