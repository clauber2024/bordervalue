"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Globe2,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { FilterBar, type FilterState } from "../../components/FilterBar";
import { ConceptualProductCard, type ConceptualProduct } from "../../components/ConceptualProductCard";
import { apiRoutes } from "../../lib/apiRoutes";

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

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const EMPTY_RESPONSE: ApiResponse = {
  products: [],
  dependency: [],
  vulnerability: [],
  trade: [],
  production: [],
  map: [],
};

const DEFAULT_FILTERS: FilterState = {
  chain: "all",
  product: "all",
  indicator: "externalDependency",
  period: "2026-H1",
  flow: "all",
  territory: "all",
  hs: "",
  ncm: "",
  cnae: "",
  prodlist: "",
  country: "",
  mapping_status: "all",
  confidence: "all",
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const glass = "backdrop-blur-xl bg-zinc-900/40 border border-white/[0.08] shadow-2xl";

export default function ChainExplorerPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ChainExplorerClient />
    </Suspense>
  );
}

function ChainExplorerClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ApiResponse>(EMPTY_RESPONSE);
  const [status, setStatus] = useState<ViewState>("loading");
  const [error, setError] = useState<string>("");

  const filters = useMemo<FilterState>(() => {
    const next = { ...DEFAULT_FILTERS };
    Object.keys(DEFAULT_FILTERS).forEach((key) => {
      const value = searchParams.get(key);
      if (value) next[key as keyof FilterState] = value;
    });
    return next;
  }, [searchParams]);

  const updateFilters = useCallback(
    (patch: Partial<FilterState>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        const fallback = DEFAULT_FILTERS[key as keyof FilterState];
        if (!value || value === fallback) params.delete(key);
        else params.set(key, value);
      });
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const loadData = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch(apiRoutes.conceptualProducts(filters), {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Nao foi possivel carregar os indicadores da cadeia.");
      const payload = (await response.json()) as ApiResponse;
      setData(payload);
      setStatus(payload.products.length ? "ready" : "empty");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao carregar dados.");
      setStatus("error");
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const topProduct = data.products[0];
  const totalImports = data.kpis?.totalImports ?? data.products.reduce((acc, item) => acc + item.metrics.imports, 0);
  const totalExports = data.kpis?.totalExports ?? data.products.reduce((acc, item) => acc + item.metrics.exports, 0);
  const avgDependency = data.kpis?.avgDependency ?? (data.products.length
    ? data.products.reduce((acc, item) => acc + item.metrics.externalDependency, 0) / data.products.length
    : 0);
  const maxHhi = data.kpis?.maxHhi ?? Math.max(...data.products.map((item) => item.metrics.hhi), 0);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 [--accent:#22c55e] [--neutral:#22d3ee] [--surface:rgba(24,24,27,0.4)]">
      <FilterBar filters={filters} onChange={updateFilters} isLoading={status === "loading"} />

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-10 sm:px-6 lg:px-8">
        <section className={`${glass} overflow-hidden rounded-2xl p-6 sm:p-8`}>
          <div className="max-w-4xl">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
              Painel Analítico Border Value
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Onde a cadeia brasileira esta mais exposta?
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
              {topProduct
                ? `${topProduct.name} concentra a principal leitura de dependencia: ${topProduct.metrics.externalDependency}% de dependencia externa, com ${topProduct.metrics.mainSupplier.country} respondendo por ${topProduct.metrics.mainSupplier.share}% do fornecimento.`
                : "Escolha uma cadeia, produto ou territorio para revelar dependencia, concentracao e capacidade produtiva nacional."}
            </p>
          </div>
        </section>

        <StateShell status={status} error={error} onRetry={loadData}>
          <section className="space-y-6">
            <Question
              title="Quais sinais executivos merecem atencao imediata?"
              subtitle="Indicadores agregados dos produtos conceituais filtrados, sem expor codigos tecnicos na primeira leitura."
            />
            {data.metadata?.warning ? <DataNotice metadata={data.metadata} /> : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard icon={ArrowDownRight} label="Importacoes" value={money.format(totalImports)} tone="cyan" />
              <KpiCard icon={ArrowUpRight} label="Exportacoes" value={money.format(totalExports)} tone="emerald" />
              <KpiCard icon={Activity} label="Dependencia media" value={`${number.format(avgDependency)}%`} tone="amber" />
              <KpiCard icon={ShieldCheck} label="HHI maximo" value={number.format(maxHhi)} tone="rose" />
            </div>
          </section>

          <section className="space-y-6">
            <Question
              title="Quais produtos explicam o risco da cadeia?"
              subtitle="Cards conceituais priorizam linguagem de negocio; codigos, fontes e metodologia ficam na gaveta tecnica."
            />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {data.products.map((product) => (
                <ConceptualProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <Question
              title="De quais territorios o Brasil mais depende?"
              subtitle="Clique em um fornecedor para aplicar o territorio como filtro global e atualizar a URL compartilhavel."
            />
            <div className={`${glass} rounded-2xl p-4 sm:p-6`}>
              <ChainMap
                data={data.map}
                activeTerritory={filters.territory}
                onSelect={(territory) => updateFilters({ territory: toggleCsvValue(filters.territory, territory) })}
              />
            </div>
          </section>

          <section className="space-y-6">
            <Question
              title="Onde dependencia e concentracao se combinam?"
              subtitle="Os graficos tambem funcionam como seletores: clicar em barras ou pontos filtra produto e territorio."
            />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <DependencyChart data={data.dependency} onSelect={(row) => updateFilters({ product: row.id ?? row.product, territory: row.territory })} />
              <VulnerabilityChart data={data.vulnerability} onSelect={(row) => updateFilters({ product: row.id ?? row.product })} />
            </div>
          </section>

          <section className="space-y-6">
            <Question
              title="O comercio exterior esta ampliando a exposicao?"
              subtitle="Serie de importacoes e exportacoes por periodo, com leitura direta de saldo e escala comercial."
            />
            <GlassPanel className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trade} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="imports" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="exports" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="period" stroke="#a1a1aa" tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" tickLine={false} axisLine={false} tickFormatter={(value) => money.format(Number(value))} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="imports" stroke="#22d3ee" fill="url(#imports)" strokeWidth={2} />
                  <Area type="monotone" dataKey="exports" stroke="#22c55e" fill="url(#exports)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </GlassPanel>
          </section>

          <section className="space-y-6 pb-16">
            <Question
              title="A producao nacional cobre quais etapas?"
              subtitle="Leitura sintese por etapa produtiva para orientar investigacao setorial e validacao especialista."
            />
            <GlassPanel className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.production} layout="vertical" margin={{ top: 12, right: 24, left: 12, bottom: 8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" stroke="#a1a1aa" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="stage" width={120} stroke="#a1a1aa" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {data.production.map((entry) => (
                      <Cell key={entry.stage} fill="#22c55e" fillOpacity={0.72} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </GlassPanel>
          </section>
        </StateShell>
      </div>
    </main>
  );
}

function PageFallback() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className={`${glass} h-28 animate-pulse rounded-2xl`} />
        <LoadingNarrative />
      </div>
    </main>
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
  children: ReactNode;
}) {
  if (status === "loading") return <LoadingNarrative />;
  if (status === "error") {
    return (
      <div className={`${glass} rounded-2xl p-8 text-center`}>
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-300" strokeWidth={1.5} />
        <h2 className="mt-4 text-xl font-bold tracking-tight text-white">Nao conseguimos carregar esta leitura.</h2>
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
      <div className={`${glass} rounded-2xl p-8 text-center`}>
        <PackageSearch className="mx-auto h-10 w-10 text-cyan-300" strokeWidth={1.5} />
        <h2 className="mt-4 text-xl font-bold tracking-tight text-white">Nenhum produto encontrado.</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
          Nenhum produto encontrado para este territorio. Tente ampliar o periodo ou remover filtros tecnicos.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function LoadingNarrative() {
  return (
    <div className="space-y-16">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={`${glass} h-32 animate-pulse rounded-2xl`} />
        ))}
      </div>
      <div className={`${glass} h-80 animate-pulse rounded-2xl`} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className={`${glass} h-96 animate-pulse rounded-2xl`} />
        <div className={`${glass} h-96 animate-pulse rounded-2xl`} />
      </div>
    </div>
  );
}

function Question({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{subtitle}</p>
    </div>
  );
}

function DataNotice({ metadata }: { metadata: NonNullable<ApiResponse["metadata"]> }) {
  const sourceLabel = metadata.source === "dashboard_data"
    ? "Dados oficiais do pipeline"
    : metadata.source === "published"
      ? "Camada Published"
      : "Fallback local";

  return (
    <div className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
      <strong className="font-semibold">{sourceLabel}.</strong> {metadata.warning}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    cyan: "text-cyan-300 bg-cyan-400/10",
    emerald: "text-emerald-300 bg-emerald-400/10",
    amber: "text-amber-300 bg-amber-400/10",
    rose: "text-rose-300 bg-rose-400/10",
  };
  return (
    <article className={`${glass} rounded-2xl p-5`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <p className="mt-5 text-sm font-medium text-zinc-400">{label}</p>
      <strong className="mt-1 block text-2xl font-bold tracking-tight text-white">{value}</strong>
    </article>
  );
}

function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${glass} rounded-2xl p-4 sm:p-6 ${className}`}>{children}</div>;
}

function ChainMap({
  data,
  activeTerritory,
  onSelect,
}: {
  data: ApiResponse["map"];
  activeTerritory: string;
  onSelect: (territory: string) => void;
}) {
  if (!data.length) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-center text-sm text-zinc-400">
        Sem territorios para o recorte atual.
      </div>
    );
  }

  return (
    <ComposableMap projectionConfig={{ scale: 145 }} className="h-[420px] w-full">
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill="rgba(63,63,70,0.44)"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={0.5}
              style={{ default: { outline: "none" }, hover: { outline: "none", fill: "rgba(34,211,238,0.18)" } }}
            />
          ))
        }
      </Geographies>
      {data.map((item) => {
        const active = csvValues(activeTerritory).includes(item.territory);
        return (
          <Marker key={item.territory} coordinates={item.coordinates}>
            <g
              role="button"
              tabIndex={0}
              aria-label={`Filtrar por ${item.name}`}
              onClick={() => onSelect(item.territory)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(item.territory);
                }
              }}
              className="group cursor-pointer outline-none"
            >
              <circle r={active ? 13 : 9} fill={active ? "#22c55e" : "#22d3ee"} opacity={0.78} />
              <text y={-16} textAnchor="middle" className="fill-zinc-100 text-[10px] font-medium opacity-0 group-hover:opacity-100">
                {item.name}
              </text>
            </g>
          </Marker>
        );
      })}
    </ComposableMap>
  );
}

function csvValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item !== "all");
}

function toggleCsvValue(currentValue: string, nextValue: string) {
  const currentValues = csvValues(currentValue);
  const nextValues = currentValues.includes(nextValue)
    ? currentValues.filter((value) => value !== nextValue)
    : [...currentValues, nextValue];

  return nextValues.length ? nextValues.join(",") : "all";
}

function DependencyChart({
  data,
  onSelect,
}: {
  data: ApiResponse["dependency"];
  onSelect: (row: ApiResponse["dependency"][number]) => void;
}) {
  return (
    <GlassPanel className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 28, left: 18, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} stroke="#a1a1aa" tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="product" width={90} stroke="#a1a1aa" tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip suffix="%" />} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} onClick={onSelect} cursor="pointer" fill="#22d3ee" fillOpacity={0.75} />
        </BarChart>
      </ResponsiveContainer>
    </GlassPanel>
  );
}

function VulnerabilityChart({
  data,
  onSelect,
}: {
  data: ApiResponse["vulnerability"];
  onSelect: (row: ApiResponse["vulnerability"][number]) => void;
}) {
  return (
    <GlassPanel className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="product" stroke="#a1a1aa" tickLine={false} axisLine={false} />
          <YAxis stroke="#a1a1aa" tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="hhi" radius={[8, 8, 0, 0]} onClick={onSelect} cursor="pointer" fill="#22c55e" fillOpacity={0.76} />
        </BarChart>
      </ResponsiveContainer>
    </GlassPanel>
  );
}

function ChartTooltip({ active, payload, label, suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.08] bg-zinc-950/95 px-3 py-2 text-xs shadow-2xl">
      <p className="font-medium text-zinc-100">{label}</p>
      {payload.map((item: any) => (
        <p key={item.dataKey} className="mt-1 text-zinc-400">
          {item.name}: <span className="text-white">{typeof item.value === "number" && item.value > 10000 ? money.format(item.value) : item.value}{suffix}</span>
        </p>
      ))}
    </div>
  );
}
