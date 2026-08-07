"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Database,
  Filter,
  GitCompareArrows,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { ChainCatalogItem } from "../lib/chainCatalog";
import type { ChainSummary } from "../app/api/chains/summary/route";

type ChainSelectionLandingProps = {
  onSelect: (chainId: string) => void;
  chains: readonly ChainCatalogItem[];
  summaries: Record<string, ChainSummary>;
  isLoading: boolean;
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

type RiskStatus = "critical" | "warning" | "safe" | "unknown";

type RiskPresentation = {
  status: RiskStatus;
  label: string;
  style: string;
  badgeText?: string;
};

const UNKNOWN_RISK: RiskPresentation = {
  status: "unknown",
  label: "Métricas em Atualização",
  style: "bg-zinc-900 text-zinc-500 border-zinc-800",
};

// Classifica pelo pico de risco (maior dependência entre os insumos + contagem de itens
// criticos), nao pela media da cadeia: uma media baixa pode esconder um unico insumo com
// dependencia extrema (ex: Wafers fotovoltaicos a 97%) e sinalizar seguranca industrial
// que nao existe.
function riskPresentation(summary?: ChainSummary): RiskPresentation {
  if (!summary?.ok) return UNKNOWN_RISK;

  const criticalCount = summary.criticalCount ?? 0;
  const maxDependency = summary.maxDependency ?? 0;
  const avgDependency = summary.avgDependency ?? 0;

  if (criticalCount > 0 || maxDependency >= 0.75) {
    return {
      status: "critical",
      label: "Exposição Crítica",
      style: "bg-red-950/70 text-red-300 border-red-800/60 shadow-[0_0_15px_rgba(239,68,68,0.15)]",
      badgeText: criticalCount > 0 ? `${criticalCount} insumo${criticalCount > 1 ? "s" : ""} em alerta crítico` : undefined,
    };
  }

  if (maxDependency >= 0.5 || avgDependency >= 0.4) {
    return {
      status: "warning",
      label: "Atenção de Suprimento",
      style: "bg-amber-950/70 text-amber-300 border-amber-800/60",
      badgeText: "Risco moderado de importação",
    };
  }

  return {
    status: "safe",
    label: "Exposição Controlada",
    style: "bg-emerald-950/70 text-emerald-300 border-emerald-800/60",
    badgeText: "Suprimento predominantemente doméstico",
  };
}

export function ChainSelectionLanding({ onSelect, chains, summaries, isLoading }: ChainSelectionLandingProps) {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");

  const groups = useMemo(() => Array.from(new Set(chains.map((chain) => chain.group))), [chains]);

  const visibleChains = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return chains.filter((chain) => {
      if (activeGroup !== "all" && chain.group !== activeGroup) return false;
      if (!normalizedQuery) return true;
      return `${chain.name} ${chain.group} ${chain.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery);
    });
  }, [activeGroup, chains, query]);

  const macro = useMemo(() => {
    const ok = Object.values(summaries).filter((summary) => summary.ok);
    if (!ok.length) return null;
    return {
      inputsTriaged: ok.reduce((sum, summary) => sum + (summary.inputsCount ?? 0), 0),
      deficit: ok.reduce(
        (sum, summary) => sum + (summary.totalImportsUsd ?? 0) - (summary.totalExportsUsd ?? 0),
        0,
      ),
      criticalAlerts: ok.reduce((sum, summary) => sum + (summary.criticalCount ?? 0), 0),
    };
  }, [summaries]);

  return (
    <section className="mx-auto max-w-none py-8 sm:py-12">
      <div className="mx-auto max-w-3xl text-center">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          <Sparkles className="h-4 w-4" /> Border Value Intelligence · Painel de Estado
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Qual cadeia produtiva você quer analisar?
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
          Selecione uma cadeia da transição energética para revelar riscos, dependências externas e oportunidades de industrialização verde.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MacroStat label="Cadeias Mapeadas" value={`${chains.length || "—"}`} />
          <MacroStat label="Insumos Triados" value={macro ? number.format(macro.inputsTriaged) : "—"} tone="text-cyan-300" />
          <MacroStat label="Déficit Agregado" value={macro ? money.format(macro.deficit) : "—"} tone="text-amber-400" />
          <MacroStat label="Alertas Críticos" value={macro ? number.format(macro.criticalAlerts) : "—"} tone="text-red-400" />
        </div>

        <nav aria-label="Recursos gerais da plataforma" className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/explorar"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-cyan-300/25 hover:bg-cyan-400/[0.07] hover:text-white"
          >
            <GitCompareArrows className="h-3.5 w-3.5 text-cyan-300" />
            Comparar cadeias
          </Link>
          <Link
            href="/tour-soberania"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-emerald-300/25 hover:bg-emerald-400/[0.07] hover:text-white"
          >
            <BookOpen className="h-3.5 w-3.5 text-emerald-300" />
            Entender NIB &amp; TSB
          </Link>
        </nav>
      </div>

      <div className="mx-auto mt-10 flex max-w-5xl flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-3 backdrop-blur-xl sm:flex-row sm:justify-between">
        <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <FilterPill label="Todas as Cadeias" active={activeGroup === "all"} onClick={() => setActiveGroup("all")} />
          {groups.map((group) => (
            <FilterPill key={group} label={group} active={activeGroup === group} onClick={() => setActiveGroup(group)} />
          ))}
        </div>

        <label className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <span className="sr-only">Filtrar cadeias por nome ou insumo</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar por insumo, mineral ou produto..."
            className="h-9 w-full rounded-xl border border-zinc-800 bg-zinc-950/80 pl-9 pr-3 font-mono text-xs text-zinc-200 placeholder-zinc-500 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
          />
        </label>
      </div>

      {isLoading ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-2xl border border-white/5 bg-zinc-900/40" />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleChains.map((chain) => (
            <ChainCard key={chain.id} chain={chain} summary={summaries[chain.id]} onSelect={onSelect} />
          ))}
          {!visibleChains.length ? (
            <p className="col-span-full py-10 text-center text-sm text-zinc-500">
              Nenhuma cadeia encontrada para este filtro.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function MacroStat({ label, value, tone = "text-zinc-100" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 backdrop-blur-md">
      <span className="block font-mono text-[10px] uppercase text-zinc-500">{label}</span>
      <span className={`font-mono text-lg font-bold ${tone}`}>{value}</span>
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border border-zinc-700 bg-zinc-800 text-emerald-400 shadow-md"
          : "border border-transparent text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function ChainCard({
  chain,
  summary,
  onSelect,
}: {
  chain: ChainCatalogItem;
  summary?: ChainSummary;
  onSelect: (chainId: string) => void;
}) {
  const isPublished = chain.status === "published";
  const risk = isPublished ? riskPresentation(summary) : UNKNOWN_RISK;

  return (
    <div
      className={`group flex flex-col justify-between rounded-2xl border p-5 backdrop-blur-xl transition ${
        isPublished
          ? `border-white/[0.08] bg-zinc-900/40 shadow-xl ${
              risk.status === "critical" ? "hover:border-red-500/50 hover:shadow-[0_0_25px_rgba(239,68,68,0.12)]" : "hover:border-cyan-400/30 hover:bg-cyan-400/[0.04]"
            }`
          : "border-zinc-900 bg-zinc-950/40 opacity-60"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
            {chain.group}
          </span>
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${isPublished ? risk.style : "border-zinc-800 bg-zinc-900 text-zinc-500"}`}>
            {isPublished ? risk.label : "Em Homologação"}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Database className={`h-4 w-4 ${isPublished ? "text-cyan-300" : "text-zinc-600"}`} />
          <h3 className="text-base font-bold text-white transition group-hover:text-cyan-300">{chain.name}</h3>
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-400">{chain.description}</p>
      </div>

      <div className="mt-5">
        {isPublished && summary?.ok ? (
          <div className="mb-4 space-y-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 font-mono text-[11px]">
            <div className="flex items-center justify-between text-zinc-400">
              <span>Insumos monitorados:</span>
              <strong className="text-zinc-200">{summary.inputsCount} itens</strong>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>Exposição comercial:</span>
              <strong className="text-amber-400">{money.format(summary.totalImportsUsd ?? 0)}</strong>
            </div>
            {summary.topBottleneck ? (
              <div className="truncate border-t border-zinc-900 pt-1.5 text-zinc-400">
                <span className="text-zinc-500">Gargalo:</span> {summary.topBottleneck}
              </div>
            ) : null}
            {risk.status === "critical" && risk.badgeText ? (
              <div className="text-red-400">{risk.badgeText}</div>
            ) : null}
          </div>
        ) : isPublished ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 font-mono text-[11px] text-zinc-500">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            Métricas setoriais indisponíveis no momento
          </div>
        ) : null}

        {isPublished ? (
          <button
            type="button"
            onClick={() => onSelect(chain.id)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-emerald-400 transition hover:border-emerald-400 hover:bg-emerald-500 hover:text-zinc-950"
          >
            Abrir Análise de Estado
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-zinc-900 bg-zinc-950 px-4 py-2.5 text-center font-mono text-xs text-zinc-600"
          >
            Base em Mapeamento
          </button>
        )}
      </div>
    </div>
  );
}
