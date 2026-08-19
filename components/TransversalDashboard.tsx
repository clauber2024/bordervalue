"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useBorderValue } from "../hooks/useBorderValue";
import { TransversalMatrixChart } from "./TransversalMatrixChart";
import { TransversalActionList, type QuadrantFilter } from "./TransversalActionList";
import { MONITORED_CHAINS, CHAIN_META, isExtremeBottleneck, dedupeCrossChainProducts, type DedupedProduct } from "../lib/transversalMatrix";

const usdCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat("pt-BR");

export function TransversalDashboard() {
  const silicio = useBorderValue("silicio");
  const fertilizantes = useBorderValue("fertilizantes");
  const combustiveis = useBorderValue("combustiveis_transicao");
  const aco = useBorderValue("aco");

  const chainResults = [
    { chain: MONITORED_CHAINS[0], ...silicio },
    { chain: MONITORED_CHAINS[1], ...fertilizantes },
    { chain: MONITORED_CHAINS[2], ...combustiveis },
    { chain: MONITORED_CHAINS[3], ...aco },
  ];

  const rawData = useMemo(
    () => chainResults.flatMap((result) => result.data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [silicio.data, fertilizantes.data, combustiveis.data, aco.data],
  );
  // Same NCM basket claimed by more than one chain (e.g. gas natural in
  // fertilizantes and combustiveis_transicao) collapses into a single card
  // here -- both the list/chart and the KPI totals below read this
  // deduplicated set, so nothing double-counts the same trade flow twice.
  const data = useMemo(() => dedupeCrossChainProducts(rawData), [rawData]);

  const isInitialLoading = chainResults.every((result) => result.isLoading && !result.data);
  const loadedChainsCount = chainResults.filter((result) => result.data?.length).length;
  const failedChains = chainResults.filter((result) => result.error);

  const [activeQuadrant, setActiveQuadrant] = useState<QuadrantFilter>("todos");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const kpis = useMemo(() => computeKpis(data), [data]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition hover:text-cyan-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
          Painel Analítico Border Value
        </Link>

        <header className="mt-4 border-b border-zinc-800/70 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Matriz NIB Transversal</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Painel Transversal de Soberania Industrial
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
            Mapeamento consolidado de vulnerabilidades de suprimento aduaneiro, capacidade produtiva nacional (PIA)
            e geração de emprego qualificado (RAIS).
          </p>

          {failedChains.length ? (
            <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-200">
              Falha ao carregar {failedChains.length} de 4 cadeias ({failedChains.map((item) => CHAIN_META[item.chain].shortLabel).join(", ")}).
              Os KPIs e a matriz refletem apenas as cadeias disponíveis.
            </p>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label="Fatura total exposta (FOB)"
              value={usdCompact.format(kpis.totalFob)}
              note={`${data.length} produtos monitorados · ${loadedChainsCount}/4 cadeias carregadas`}
              tone="neutral"
            />
            <KpiCard
              label="Gargalos extremos (HHI > 1.800)"
              value={integer.format(kpis.extremeBottlenecks)}
              note="Insumos com altíssima concentração de origem"
              tone="danger"
            />
            <KpiCard
              label="Empregos mobilizáveis (RAIS)"
              value={integer.format(kpis.totalJobs)}
              note="Postos formais nos elos expostos ao adensamento"
              tone="success"
            />
          </div>
        </header>

        {isInitialLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="h-[520px] animate-pulse rounded-lg border border-zinc-800/70 bg-zinc-900/60" />
            <div className="h-[520px] animate-pulse rounded-lg border border-zinc-800/70 bg-zinc-900/60" />
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <TransversalMatrixChart
              data={data}
              activeQuadrant={activeQuadrant}
              selectedProductId={selectedProductId}
              onSelectProduct={setSelectedProductId}
            />
            <TransversalActionList
              data={data}
              activeQuadrant={activeQuadrant}
              onQuadrantChange={setActiveQuadrant}
              selectedProductId={selectedProductId}
              onSelectProduct={setSelectedProductId}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function computeKpis(data: DedupedProduct[]) {
  return {
    totalFob: data.reduce((sum, item) => sum + item.product.comercio.importacao_valor_fob, 0),
    extremeBottlenecks: data.filter((item) => isExtremeBottleneck(item.product)).length,
    totalJobs: data.reduce((sum, item) => sum + item.product.industria.qtde_vinculos_rais, 0),
  };
}

function KpiCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "neutral" | "danger" | "success";
}) {
  const toneClass = { neutral: "text-zinc-100", danger: "text-red-400", success: "text-emerald-400" }[tone];
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 shadow-2xl backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-extrabold xl:text-3xl ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] font-medium text-zinc-500">{note}</p>
    </article>
  );
}

export default TransversalDashboard;
