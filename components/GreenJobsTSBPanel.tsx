"use client";

import { BriefcaseBusiness, Info, MapPinned, Scale, WalletCards } from "lucide-react";
import type { SolarGreenJobs } from "../types/solar-sovereignty";

type GreenJobsTSBPanelProps = {
  data: SolarGreenJobs;
  chainName?: string;
};

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function GreenJobsTSBPanel({ data, chainName = "cadeia analisada" }: GreenJobsTSBPanelProps) {
  const maxActivityJobs = Math.max(...data.activities.map((item) => item.formal_jobs), 1);
  const maxStateJobs = Math.max(...data.top_states.map((item) => item.formal_jobs), 1);
  const hasGasActivity = data.activities.some((activity) =>
    activity.sector_names.some((name) => /gás natural|gas natural/i.test(name)),
  );

  return (
    <section className="overflow-hidden rounded-xl border border-emerald-300/15 bg-zinc-950/65 text-zinc-100">
      <header className="border-b border-white/[0.08] bg-emerald-400/[0.035] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          Taxonomia Sustentável Brasileira · RAIS {data.reference_year}
        </p>
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
          <h4 className="text-sm font-semibold text-white">Onde estão os vínculos na cadeia ampliada</h4>
          <p className="mt-1 text-xs text-zinc-500">Atividades nomeadas de forma executiva; códigos permanecem na gaveta técnica.</p>
          <div className="mt-4 space-y-4">
            {data.activities.map((activity) => {
              const label = activity.sector_names[0] ?? "Atividade produtiva associada à TSB";
              return (
                <div key={activity.cnae_class}>
                  <div className="mb-1.5 flex items-end justify-between gap-4 text-xs">
                    <span className="font-medium text-zinc-300">{label}</span>
                    <span className="shrink-0 font-semibold text-emerald-300">{integer.format(activity.formal_jobs)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(activity.formal_jobs / maxActivityJobs * 100, 2)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">Cobertura estatística no recorte TSB: {(activity.exposure_ratio * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</p>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white">Concentração territorial</h4>
          <p className="mt-1 text-xs text-zinc-500">Estados com mais vínculos nas atividades associadas.</p>
          <div className="mt-4 space-y-3">
            {data.top_states.map((state) => (
              <div key={state.uf} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 text-xs">
                <span className="font-bold text-zinc-300">{state.uf}</span>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max(state.formal_jobs / maxStateJobs * 100, 2)}%` }} />
                </div>
                <span className="min-w-14 text-right text-zinc-400">{integer.format(state.formal_jobs)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {hasGasActivity ? (
        <div className="border-t border-purple-300/15 bg-purple-400/[0.05] px-4 py-4 text-xs leading-5 text-zinc-300 sm:px-6">
          <strong className="text-purple-200">Como interpretar o gás:</strong>{" "}
          o CNAE reúne gás natural fóssil, processamento e distribuição de combustíveis gasosos. A presença nessa classe não torna todo o setor sustentável. O alinhamento depende dos critérios técnicos da TSB; a diretriz desta plataforma prioriza biogás e biometano, infraestrutura compatível com sua expansão e redução verificável de emissões.
        </div>
      ) : null}

      <div className="flex gap-3 border-t border-amber-300/15 bg-amber-400/[0.05] px-4 py-4 text-xs leading-5 text-zinc-400 sm:px-6">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <p><strong className="text-amber-200">Nota metodológica:</strong> {data.methodology_note}</p>
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
