"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  BarChart3,
  Compass,
  Factory,
  Gauge,
  Globe2,
  LineChart,
  Network,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NIBMatrixChart } from "./NIBMatrixChart";
import { ProportionalityToggle } from "./ProportionalityToggle";
import { SovereigntySankeyChart } from "./SovereigntySankeyChart";
import { TechnicalDrawer } from "./TechnicalDrawer";
import { VulnerabilityRadar } from "./VulnerabilityRadar";
import { useBorderValue } from "../hooks/useBorderValue";
import { apiRoutes } from "../lib/apiRoutes";
import type { ProdutoConceitual } from "../types/border-value";
import type { ConceptualProduct } from "./ConceptualProductCard";

type ViewState = "loading" | "ready" | "error" | "empty";

type ApiResponse = {
  products: ConceptualProduct[];
  dependency: Array<{ product: string; territory: string; value: number; id?: string }>;
  vulnerability: Array<{ product: string; hhi: number; dependency: number; id?: string }>;
  trade: Array<{ period: string; imports: number; exports: number }>;
  production: Array<{ stage: string; value: number; chain?: string }>;
  map: Array<{ territory: string; name: string; value: number; coordinates: [number, number] }>;
  kpis?: {
    totalImports: number;
    totalExports: number;
    avgDependency: number;
    maxHhi: number;
    totalProducts: number;
  };
  metadata?: {
    source: "dashboard_data" | "published" | "local_fallback";
    warning?: string;
    pilotFlags?: string[];
  };
};

const emptyResponse: ApiResponse = {
  products: [],
  dependency: [],
  vulnerability: [],
  trade: [],
  production: [],
  map: [],
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const glass = "border border-white/[0.08] bg-zinc-900/40 shadow-2xl backdrop-blur-xl";

export default function MainAnalyticalDashboard() {
  const [data, setData] = useState<ApiResponse>(emptyResponse);
  const [status, setStatus] = useState<ViewState>("loading");
  const [error, setError] = useState("");
  const { data: technicalProducts = [] } = useBorderValue("combustiveis_transicao");

  const loadData = useCallback(async () => {
    setStatus("loading");
    setError("");

    try {
      const response = await fetch(apiRoutes.conceptualProducts(), { cache: "no-store" });
      if (!response.ok) throw new Error("Nao foi possivel carregar o painel principal.");

      const payload = (await response.json()) as ApiResponse;
      setData(payload);
      setStatus(payload.products.length ? "ready" : "empty");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Erro inesperado ao carregar dados.");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const metrics = useMemo(() => {
    const totalImports = data.kpis?.totalImports ?? data.products.reduce((acc, item) => acc + item.metrics.imports, 0);
    const totalExports = data.kpis?.totalExports ?? data.products.reduce((acc, item) => acc + item.metrics.exports, 0);
    const avgDependency = data.kpis?.avgDependency ?? (data.products.length
      ? data.products.reduce((acc, item) => acc + item.metrics.externalDependency, 0) / data.products.length
      : 0);
    const maxHhi = data.kpis?.maxHhi ?? Math.max(...data.products.map((item) => item.metrics.hhi), 0);
    const topRisk = [...data.products].sort(
      (left, right) =>
        right.metrics.externalDependency * right.metrics.hhi -
        left.metrics.externalDependency * left.metrics.hhi,
    )[0];

    return { totalImports, totalExports, avgDependency, maxHhi, topRisk };
  }, [data.kpis, data.products]);
  const premiumProducts = useMemo(() => technicalProducts.slice(0, 12), [technicalProducts]);
  const proportionalityProduct = useMemo(
    () => selectProportionalityProduct(premiumProducts),
    [premiumProducts],
  );
  const radarProduct = useMemo(() => selectRadarProduct(premiumProducts), [premiumProducts]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-white/[0.08] bg-zinc-950/88 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Border Value
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-white">
              Painel analitico principal
            </h1>
          </div>

          <nav className="flex flex-wrap gap-2 text-sm font-medium">
            <RouteLink href="/explorar" icon={Compass} label="Explorar" />
            <RouteLink href="/tour-soberania" icon={Network} label="Tour" />
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <section className={`${glass} overflow-hidden rounded-lg p-6 sm:p-8`}>
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                <Gauge className="h-4 w-4" strokeWidth={1.6} />
                Visao executiva
              </p>
              <h2 className="mt-4 max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Exposicao produtiva, dependencia externa e capacidade nacional em uma unica entrada.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
                O painel raiz resume sinais de risco e direciona a investigacao: filtros finos ficam em
                `/explorar`, narrativa orientada fica em `/tour-soberania`, e `dashboard/` ou porta
                `8765` permanecem como base tecnica temporaria.
              </p>
            </div>

            <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Principal alerta
              </p>
              <h3 className="mt-3 text-2xl font-bold text-white">
                {metrics.topRisk?.name ?? statusCopy(status).title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {metrics.topRisk
                  ? `${metrics.topRisk.metrics.externalDependency}% de dependencia externa, HHI ${number.format(metrics.topRisk.metrics.hhi)} e fornecedor lider ${metrics.topRisk.metrics.mainSupplier.country}.`
                  : statusCopy(status).body}
              </p>
            </div>
          </div>
        </section>

        <StateShell status={status} error={error} onRetry={loadData}>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={ArrowDownRight} label="Importacoes" value={money.format(metrics.totalImports)} tone="cyan" />
            <KpiCard icon={LineChart} label="Exportacoes" value={money.format(metrics.totalExports)} tone="emerald" />
            <KpiCard icon={Globe2} label="Dependencia media" value={`${number.format(metrics.avgDependency)}%`} tone="amber" />
            <KpiCard icon={ShieldAlert} label="HHI maximo" value={number.format(metrics.maxHhi)} tone="rose" />
          </section>

          {data.metadata?.warning ? (
            <div className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              <strong className="font-semibold">{sourceLabel(data.metadata.source)}.</strong> {data.metadata.warning}
            </div>
          ) : null}

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className={`${glass} rounded-lg p-5`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Rotas da experiencia
              </p>
              <div className="mt-5 space-y-3">
                <RouteCard
                  href="/"
                  title="/"
                  body="Painel analitico principal, com leitura executiva e sinais agregados."
                  current
                />
                <RouteCard
                  href="/explorar"
                  title="/explorar"
                  body="Exploracao por cadeia, produto, territorio e codigos tecnicos."
                />
                <RouteCard
                  href="/tour-soberania"
                  title="/tour-soberania"
                  body="Tour explicativo para apresentar NIB, HHI, RenovaCalc e rede AIPNET."
                />
              </div>
            </div>

            <div className={`${glass} min-h-[360px] rounded-lg p-4 sm:p-6`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    Vulnerabilidade
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-white">Dependencia por produto</h2>
                </div>
                <BarChart3 className="h-5 w-5 text-zinc-500" strokeWidth={1.6} />
              </div>
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={data.dependency} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="product" stroke="#a1a1aa" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke="#a1a1aa" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip suffix="%" />} />
                  <Bar dataKey="value" fill="#22d3ee" fillOpacity={0.76} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {premiumProducts.length ? (
            <section className="space-y-5">
              <div className="border-l-2 border-cyan-300/60 pl-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  Componentes premium
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                  Leitura de soberania produtiva com dados reais
                </h2>
              </div>

              <SovereigntySankeyChart
                dado={radarProduct ?? premiumProducts[0]}
                title="Fluxo AIPNET por produto conceitual"
              />

              {proportionalityProduct ? (
                <ProportionalityToggle dado={proportionalityProduct} />
              ) : null}

              <NIBMatrixChart data={premiumProducts} />

              {radarProduct ? <VulnerabilityRadar dado={radarProduct} /> : null}

              <TechnicalDrawer data={premiumProducts} />
            </section>
          ) : null}
        </StateShell>
      </div>
    </main>
  );
}

function RouteLink({ href, icon: Icon, label }: { href: string; icon: typeof Compass; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 text-zinc-100 transition hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    >
      <Icon className="h-4 w-4" strokeWidth={1.6} />
      {label}
    </Link>
  );
}

function RouteCard({
  href,
  title,
  body,
  current = false,
}: {
  href: string;
  title: string;
  body: string;
  current?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-white/[0.08] bg-white/[0.04] p-4 transition hover:border-cyan-300/30 hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-sm font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{body}</p>
        </div>
        {current ? (
          <span className="rounded-md border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-200">
            atual
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    cyan: "bg-cyan-400/10 text-cyan-300",
    emerald: "bg-emerald-400/10 text-emerald-300",
    amber: "bg-amber-400/10 text-amber-300",
    rose: "bg-rose-400/10 text-rose-300",
  };

  return (
    <article className={`${glass} rounded-lg p-5`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <p className="mt-5 text-sm font-medium text-zinc-400">{label}</p>
      <strong className="mt-1 block text-2xl font-bold tracking-tight text-white">{value}</strong>
    </article>
  );
}

function StateShell({
  status,
  error,
  onRetry,
  children,
}: {
  status: ViewState;
  error: string;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (status === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={`${glass} h-32 animate-pulse rounded-lg`} />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`${glass} rounded-lg p-8 text-center`}>
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-300" strokeWidth={1.5} />
        <h2 className="mt-4 text-xl font-bold tracking-tight text-white">Painel indisponivel</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] px-4 py-2 text-sm font-medium text-white outline-none transition hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className={`${glass} rounded-lg p-8 text-center`}>
        <Factory className="mx-auto h-10 w-10 text-cyan-300" strokeWidth={1.5} />
        <h2 className="mt-4 text-xl font-bold tracking-tight text-white">Sem produtos publicados</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
          A rota raiz esta pronta, mas a API central ainda nao retornou produtos para resumir.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

function ChartTooltip({ active, payload, label, suffix = "" }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-white/[0.08] bg-zinc-950/95 px-3 py-2 text-xs shadow-2xl">
      <p className="font-medium text-zinc-100">{label}</p>
      {payload.map((item: any) => (
        <p key={item.dataKey} className="mt-1 text-zinc-400">
          {item.name}: <span className="text-white">{item.value}{suffix}</span>
        </p>
      ))}
    </div>
  );
}

function statusCopy(status: ViewState) {
  if (status === "loading") {
    return {
      title: "Carregando sinais",
      body: "Aguardando a resposta da API centralizada da experiencia Next.",
    };
  }

  if (status === "empty") {
    return {
      title: "Sem produtos publicados",
      body: "A estrutura de rotas ja esta definida; faltam produtos para compor o resumo.",
    };
  }

  return {
    title: "API indisponivel",
    body: "Nao foi possivel carregar os dados centrais agora.",
  };
}

function sourceLabel(source: NonNullable<ApiResponse["metadata"]>["source"]) {
  if (source === "dashboard_data") return "Dados oficiais do pipeline";
  if (source === "published") return "Camada Published";
  return "Fallback local";
}

function selectProportionalityProduct(data: ProdutoConceitual[]) {
  return (
    data.find((product) => product.fator_proporcionalidade.fator_alpha < 1) ??
    data.find((product) => product.fator_proporcionalidade.aplicado) ??
    data[0] ??
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

