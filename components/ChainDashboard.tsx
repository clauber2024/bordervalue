"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BadgeAlert,
  BriefcaseBusiness,
  ChevronDown,
  DatabaseZap,
  Factory,
  Globe2,
  LineChart,
  RefreshCw,
  ShieldAlert,
  Sigma,
} from "lucide-react";
import { ChainImpactTreemap } from "./ChainImpactTreemap";
import { NIBMatrixChart } from "./NIBMatrixChart";
import { ProportionalityToggle } from "./ProportionalityToggle";
import { TechnicalDrawer } from "./TechnicalDrawer";
import { VulnerabilityRadar } from "./VulnerabilityRadar";
import { useBorderValue } from "../hooks/useBorderValue";
import type { BorderValueApiError } from "../hooks/useBorderValue";
import type { ProdutoConceitual } from "../types/border-value";

export type ChainDashboardProps = {
  chainName: string;
  defaultAlphaEnabled?: boolean;
  className?: string;
};

export function ChainDashboard({
  chainName,
  defaultAlphaEnabled = false,
  className = "",
}: ChainDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedChain = searchParams.get("chain") ?? chainName;
  const { data, error, isLoading, isValidating, mutate } = useBorderValue(selectedChain);
  const [isAlphaEnabled, setIsAlphaEnabled] = useState(defaultAlphaEnabled);

  const chartData = useMemo(
    () => applyAlphaView(data ?? [], isAlphaEnabled),
    [data, isAlphaEnabled],
  );
  const proportionalityProduct = useMemo(
    () => selectProportionalityProduct(chartData),
    [chartData],
  );
  const radarProduct = useMemo(
    () => selectRadarProduct(chartData),
    [chartData],
  );
  const executiveKpis = useMemo(() => getExecutiveKpis(chartData), [chartData]);
  const hasSigiloPia = data?.some((product) => product.auditoria.has_sigilo_pia) ?? false;
  const handleChainChange = (nextChain: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("chain", nextChain);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (isLoading) {
    return <ChainDashboardSkeleton className={className} />;
  }

  if (error) {
    return (
      <section className={`rounded-lg border border-red-400/30 bg-red-950/20 p-5 text-red-50 ${className}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" strokeWidth={1.8} />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-300">
              Falha na carga da cadeia
            </p>
            <h2 className="mt-2 text-lg font-bold text-white">{error.userMessage}</h2>
            <ErrorDetails error={error} />
            <button
              type="button"
              onClick={() => void mutate()}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-300/25 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={1.7} />
              Tentar novamente
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!chartData.length) {
    return (
      <section className={`rounded-lg border border-zinc-800/70 bg-zinc-950/80 p-6 text-zinc-100 ${className}`}>
        <p className="text-sm text-zinc-400">Nenhum produto publicado para esta cadeia.</p>
      </section>
    );
  }

  return (
    <section className={`space-y-6 text-zinc-100 ${className}`}>
      {hasSigiloPia ? <TransparencyNotice /> : null}

      <div className="flex flex-col gap-3 border-b border-zinc-800/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            <DatabaseZap className="h-4 w-4" strokeWidth={1.6} />
            API Published
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Painel da cadeia {formatChainName(selectedChain)}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <label className="flex items-center gap-2 rounded-md border border-zinc-800/80 bg-white/[0.04] px-2.5 py-1.5 text-zinc-300">
            <span className="font-semibold text-zinc-500">Cadeia</span>
            <select
              value={selectedChain}
              onChange={(event) => handleChainChange(event.target.value)}
              className="bg-transparent text-xs font-semibold text-zinc-100 outline-none"
              aria-label="Selecionar cadeia produtiva"
            >
              {CHAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-zinc-950 text-zinc-100">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span className="rounded-md border border-zinc-800/70 bg-white/[0.04] px-2.5 py-1">
            {chartData.length} produtos
          </span>
          {isValidating ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-200">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={1.7} />
              Atualizando
            </span>
          ) : null}
        </div>
      </div>

      <ExecutiveKpiGrid kpis={executiveKpis} />

      {proportionalityProduct ? (
        <section id="proportionality-toggle" className="scroll-mt-8">
          <ProportionalityToggle
            dado={proportionalityProduct}
            defaultRateado={defaultAlphaEnabled}
            onChange={setIsAlphaEnabled}
          />
        </section>
      ) : null}

      <section id="nib-matrix" className="scroll-mt-8">
        <NIBMatrixChart data={chartData} />
      </section>

      {radarProduct ? (
        <section id="vulnerability-radar" className="scroll-mt-8">
          <VulnerabilityRadar dado={radarProduct} />
        </section>
      ) : null}

      <ImpactExplorationPanel data={chartData} />

      <TechnicalDrawer data={chartData} />
    </section>
  );
}

function ChainDashboardSkeleton({ className = "" }: { className?: string }) {
  return (
    <section className={`space-y-5 ${className}`} aria-label="Carregando dados da cadeia">
      <div className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="h-3 w-36 animate-pulse rounded-full bg-cyan-200/20" />
        <div className="mt-4 h-8 w-full max-w-xl animate-pulse rounded-md bg-white/10" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded-md bg-white/[0.07]" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-lg border border-white/10 bg-zinc-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl" />
        <div className="h-80 animate-pulse rounded-lg border border-white/10 bg-zinc-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl" />
      </div>
      <div className="h-[520px] animate-pulse rounded-lg border border-white/10 bg-zinc-950/70 shadow-2xl shadow-black/30 backdrop-blur-xl" />
    </section>
  );
}

function TransparencyNotice() {
  return (
    <div className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-4 py-4 text-amber-50 shadow-lg shadow-amber-950/20">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" strokeWidth={1.7} />
        <p className="text-sm font-semibold leading-6">
          Nota de Transparência: Dados produtivos protegidos por Sigilo Estatístico (IBGE)
        </p>
      </div>
    </div>
  );
}

function ErrorDetails({ error }: { error: BorderValueApiError }) {
  return (
    <p className="mt-2 text-sm leading-6 text-red-100/75">
      Status {error.status} em {error.endpoint}
    </p>
  );
}

function ExecutiveKpiGrid({ kpis }: { kpis: ExecutiveKpi[] }) {
  return (
    <section aria-label="KPIs executivos da cadeia" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;

        return (
          <article
            key={kpi.label}
            className={`relative overflow-hidden rounded-lg border bg-zinc-900/40 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl ${
              kpi.hasSigilo
                ? "border-amber-300/25 ring-1 ring-amber-300/10"
                : "border-white/[0.08]"
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-px ${kpi.accent}`} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {kpi.label}
                </p>
                <p className="mt-3 text-2xl font-bold tracking-tight text-white">
                  {kpi.value}
                </p>
              </div>
              <span className={`rounded-md border p-2 ${kpi.iconTone}`}>
                <Icon className="h-4 w-4" strokeWidth={1.7} />
              </span>
            </div>
            <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2">
              <p className="text-xs leading-5 text-zinc-400">{kpi.detail}</p>
              {kpi.hasSigilo ? <SigiloBadge /> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function SigiloBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-200">
      <BadgeAlert className="h-3.5 w-3.5" strokeWidth={1.7} />
      Sigilo PIA
    </span>
  );
}

function ImpactExplorationPanel({ data }: { data: ProdutoConceitual[] }) {
  return (
    <section id="impact-exploration" className="scroll-mt-8">
      <details className="group overflow-hidden rounded-lg border border-zinc-800/70 bg-zinc-950/90 shadow-2xl shadow-black/45 backdrop-blur-xl">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-5 marker:hidden sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Exploração de Impacto
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white">
              Abrir composição relativa por produto
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Visão complementar para drill-down. Mantida recolhida para preservar a leitura inicial da matriz NIB e do radar.
            </p>
          </div>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-zinc-400 transition group-open:rotate-180"
            strokeWidth={1.7}
          />
        </summary>
        <div className="border-t border-zinc-800/70 p-4 sm:p-6">
          <ChainImpactTreemap data={data} />
        </div>
      </details>
    </section>
  );
}

function applyAlphaView(data: ProdutoConceitual[], isAlphaEnabled: boolean) {
  return data.map((product) => applyAlphaToProduct(product, isAlphaEnabled));
}

function applyAlphaToProduct(product: ProdutoConceitual, isAlphaEnabled: boolean): ProdutoConceitual {
  const alpha = clampShare(product.fator_proporcionalidade.fator_alpha);
  const canApplyAlpha = product.fator_proporcionalidade.aplicado && alpha < 1;

  if (!canApplyAlpha) {
    return product;
  }

  if (!isAlphaEnabled) {
    return {
      ...product,
      fator_proporcionalidade: {
        ...product.fator_proporcionalidade,
        aplicado: false,
      },
    };
  }

  const rawImport = product.comercio.importacao_valor_fob;
  const adjustedImport = rawImport * alpha;
  const adjustedDeficit = adjustedImport - product.comercio.exportacao_valor_fob;
  const adjustedConsumption = Math.max(
    product.industria.consumo_aparente - rawImport + adjustedImport,
    0,
  );

  return {
    ...product,
    comercio: {
      ...product.comercio,
      importacao_valor_fob: adjustedImport,
      deficit_comercial: adjustedDeficit,
    },
    industria: {
      ...product.industria,
      consumo_aparente: adjustedConsumption,
      dependencia_externa_fracao: adjustedConsumption > 0 ? adjustedImport / adjustedConsumption : 0,
    },
    fator_proporcionalidade: {
      ...product.fator_proporcionalidade,
      aplicado: true,
      fator_alpha: alpha,
    },
  };
}

function selectProportionalityProduct(data: ProdutoConceitual[]) {
  return (
    data.find((product) => product.fator_proporcionalidade.fator_alpha < 1) ??
    data.find((product) => product.fator_proporcionalidade.aplicado) ??
    null
  );
}

function selectRadarProduct(data: ProdutoConceitual[]) {
  return [...data].sort((left, right) => {
    const leftScore = left.comercio.hhi_global * left.industria.dependencia_externa_fracao;
    const rightScore = right.comercio.hhi_global * right.industria.dependencia_externa_fracao;
    return rightScore - leftScore;
  })[0] ?? null;
}

function clampShare(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function getExecutiveKpis(data: ProdutoConceitual[]): ExecutiveKpi[] {
  const totalDeficit = data.reduce((sum, product) => sum + product.comercio.deficit_comercial, 0);
  const averageDependency = data.length
    ? data.reduce((sum, product) => sum + product.industria.dependencia_externa_fracao, 0) / data.length
    : 0;
  const topHhiProduct = [...data].sort((left, right) => right.comercio.hhi_global - left.comercio.hhi_global)[0];
  const totalJobs = data.reduce((sum, product) => sum + product.industria.qtde_vinculos_rais, 0);
  const hasSigilo = data.some((product) => product.auditoria.has_sigilo_pia);

  return [
    {
      label: "Déficit Comercial Total",
      value: formatUsd(totalDeficit),
      detail: totalDeficit >= 0 ? "Importações acima das exportações" : "Saldo comercial superavitário",
      hasSigilo,
      icon: LineChart,
      iconTone: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
      accent: "bg-cyan-300/80",
    },
    {
      label: "Dependência Externa Média",
      value: `${formatPercent(averageDependency)}%`,
      detail: "Média simples dos produtos publicados",
      hasSigilo,
      icon: Globe2,
      iconTone: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
      accent: "bg-emerald-300/80",
    },
    {
      label: "Maior HHI de Concentração",
      value: formatInteger(topHhiProduct?.comercio.hhi_global ?? 0),
      detail: topHhiProduct?.produto_nome ?? "Sem produto publicado",
      hasSigilo: topHhiProduct?.auditoria.has_sigilo_pia ?? false,
      icon: Sigma,
      iconTone: "border-rose-300/20 bg-rose-400/10 text-rose-200",
      accent: "bg-rose-300/80",
    },
    {
      label: "Empregos associados (RAIS)",
      value: formatInteger(totalJobs),
      detail: "Vínculos formais no elo produtivo exposto",
      hasSigilo,
      icon: BriefcaseBusiness,
      iconTone: "border-amber-300/20 bg-amber-400/10 text-amber-200",
      accent: "bg-amber-300/80",
    },
  ];
}

function formatChainName(chainName: string) {
  const labels: Record<string, string> = {
    combustiveis_transicao: "Combustíveis de transição",
    fertilizantes: "Fertilizantes",
    aco: "Aço",
    silicio: "Silício",
  };

  return labels[chainName] ?? chainName.replace(/[_-]/g, " ");
}

function formatUsd(value: number) {
  return usdCompact.format(value);
}

function formatPercent(value: number) {
  return percentNumber.format(value * 100);
}

function formatInteger(value: number) {
  return integer.format(Math.round(value));
}

type ExecutiveKpi = {
  label: string;
  value: string;
  detail: string;
  hasSigilo: boolean;
  icon: typeof Factory;
  iconTone: string;
  accent: string;
};

const CHAIN_OPTIONS = [
  { value: "combustiveis_transicao", label: "Combustíveis de transição" },
  { value: "fertilizantes", label: "Fertilizantes" },
  { value: "aco", label: "Aço" },
  { value: "silicio", label: "Silício" },
] as const;

const usdCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentNumber = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

export default ChainDashboard;

