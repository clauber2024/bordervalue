"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ChevronDown,
  Compass,
  Factory,
  Globe2,
  LineChart,
  Network,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { type AipnetFlow } from "./AipnetFlowChart";
import { AipnetSystemsFlow } from "./AipnetSystemsFlow";
import type { AipnetAnalysisFocus } from "./AipnetSystemsFlow";
import { CarbonFootprintIndustrialBlock } from "./CarbonFootprintIndustrialBlock";
import { ChainSelectionLanding } from "./ChainSelectionLanding";
import { ExecutiveMainHero, type ExecutiveMainKpi, type ExecutiveTopAlert } from "./ExecutiveMainHero";
import { ExecutiveMetadataFooter, type ExecutiveMetadata } from "./ExecutiveMetadataFooter";
import { HeaderTopBar } from "./HeaderTopBar";
import { SiliconStrategicLevers, type SiliconValueAsymmetry } from "./SiliconStrategicLevers";
import { EnergyContextBenPanel } from "./EnergyContextBenPanel";
import { SiliconMassEnergyBalancePanel } from "./SiliconMassEnergyBalancePanel";
import { GreenJobsTSBPanel } from "./GreenJobsTSBPanel";
import { NIBMatrixChart } from "./NIBMatrixChart";
import { ProportionalityToggle } from "./ProportionalityToggle";
import { SovereigntySankeyChart } from "./SovereigntySankeyChart";
import { TechnicalDrawer } from "./TechnicalDrawer";
import { VulnerabilityChart as ExecutiveVulnerabilityChart, type ProductVulnerability, type SovereigntyCoverageGroup } from "./VulnerabilityChart";
import { useBorderValue } from "../hooks/useBorderValue";
import { useEnergyContext } from "../hooks/useEnergyContext";
import { useSolarSovereignty } from "../hooks/useSolarSovereignty";
import { apiRoutes } from "../lib/apiRoutes";
import { chainCatalog } from "../lib/chainCatalog";
import type { ProdutoConceitual } from "../types/border-value";
import type { SolarInputMetric, SolarSovereigntyResponse } from "../types/solar-sovereignty";
import type { ConceptualProduct } from "./ConceptualProductCard";
import type { ChainSummary } from "../app/api/chains/summary/route";

type ViewState = "loading" | "ready" | "error" | "empty";
type ReadingMode = "guided" | "analytical";

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

const SILICON_SOVEREIGNTY_COVERAGE: SovereigntyCoverageGroup[] = [
  {
    stage: "Base mineral",
    items: [
      { name: "Quartzo de alta pureza", status: "observed" },
      { name: "Quartzito", status: "observed" },
      { name: "Sílica industrial", status: "estimated" },
    ],
  },
  {
    stage: "Silício metalúrgico",
    items: [
      { name: "Silício grau metalúrgico", status: "observed" },
      { name: "Carvão vegetal e redutores", status: "external_source" },
      { name: "Eletrodos de carbono", status: "estimated" },
      { name: "Energia elétrica industrial", status: "external_source" },
    ],
  },
  {
    stage: "Refino solar",
    items: [
      { name: "Polissilício de grau solar", status: "critical" },
      { name: "Triclorossilano", status: "unclassified" },
      { name: "Hidrogênio de alta pureza", status: "estimated" },
      { name: "Ácido clorídrico", status: "estimated" },
    ],
  },
  {
    stage: "Lingotes e wafers",
    items: [
      { name: "Wafers fotovoltaicos", status: "critical" },
      { name: "Lingotes monocristalinos", status: "unclassified" },
      { name: "Cadinhos de quartzo", status: "estimated" },
      { name: "Fios diamantados", status: "unclassified" },
    ],
  },
  {
    stage: "Células e módulos",
    items: [
      { name: "Células e módulos fotovoltaicos", status: "observed" },
      { name: "Vidro solar", status: "estimated" },
      { name: "Encapsulantes EVA/POE", status: "estimated" },
      { name: "Pasta de prata", status: "unclassified" },
      { name: "Fitas de cobre", status: "estimated" },
      { name: "Molduras de alumínio", status: "estimated" },
      { name: "Backsheet e caixa de junção", status: "unclassified" },
    ],
  },
];

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const glass = "border border-white/[0.08] bg-zinc-900/40 shadow-2xl backdrop-blur-xl";

export default function MainAnalyticalDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedChain = searchParams.get("chain")?.trim() || null;
  const selectedChainMetadata = chainCatalog.find((chain) => chain.id === selectedChain);
  const [data, setData] = useState<ApiResponse>(emptyResponse);
  const [status, setStatus] = useState<ViewState>("loading");
  const [error, setError] = useState("");
  const [chainAnalysisFocus, setChainAnalysisFocus] = useState<{ stage: string; input?: string } | null>(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [readingMode, setReadingMode] = useState<ReadingMode>("analytical");
  const [modeFeedback, setModeFeedback] = useState("Cadeia preservada, com painéis adicionais de aprofundamento.");
  const [chainMenuOpen, setChainMenuOpen] = useState(false);
  const chainMenuRef = useRef<HTMLDivElement>(null);
  const diagnosticRef = useRef<HTMLDivElement>(null);
  const sankeyRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const advancedRef = useRef<HTMLElement>(null);
  const nibRef = useRef<HTMLDivElement>(null);
  const { data: technicalProducts = [] } = useBorderValue(selectedChain ?? undefined);
  const { data: solarSovereignty } = useSolarSovereignty(selectedChain);
  const { data: energyContext } = useEnergyContext(selectedChain);
  const [chainSummaries, setChainSummaries] = useState<Record<string, ChainSummary>>({});
  const [chainSummariesLoading, setChainSummariesLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/chains/summary")
      .then((response) => response.json())
      .then((payload: { chains?: ChainSummary[] }) => {
        if (!isMounted) return;
        const byId: Record<string, ChainSummary> = {};
        for (const summary of payload.chains ?? []) byId[summary.id] = summary;
        setChainSummaries(byId);
      })
      .finally(() => {
        if (isMounted) setChainSummariesLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedChain) return;
    setStatus("loading");
    setError("");

    try {
      const response = await fetch(
        apiRoutes.conceptualProducts({ chain: selectedChain }),
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Não foi possível carregar o painel principal.");

      const payload = (await response.json()) as ApiResponse;
      setData(payload);
      setStatus(payload.products.length ? "ready" : "empty");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Erro inesperado ao carregar dados.");
    }
  }, [selectedChain]);

  useEffect(() => {
    if (selectedChain) void loadData();
  }, [loadData]);

  const handleReadingModeChange = useCallback((mode: ReadingMode) => {
    setReadingMode(mode);
    setModeFeedback(mode === "analytical"
      ? "Análises avançadas exibidas. Indo para fluxos, NIB e empregos verdes."
      : "Visão executiva restaurada. Indo para a síntese da cadeia.");

    window.setTimeout(() => {
      const target = mode === "analytical" ? advancedRef.current : overviewRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, []);

  const handleChainSelect = useCallback((chainId: string) => {
    setChainAnalysisFocus(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("chain", chainId);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleClearChain = useCallback(() => {
    setChainAnalysisFocus(null);
    router.push(pathname, { scroll: false });
  }, [pathname, router]);

  const handleQuickChainSwitch = useCallback((chainId: string) => {
    setChainMenuOpen(false);
    handleChainSelect(chainId);
  }, [handleChainSelect]);

  useEffect(() => {
    if (!chainMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (chainMenuRef.current && !chainMenuRef.current.contains(event.target as Node)) {
        setChainMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [chainMenuOpen]);

  const handleAipnetAnalysisFocus = useCallback((focus: AipnetAnalysisFocus) => {
    setCriticalOnly(false);
    setChainAnalysisFocus(focus.nodeId === "all" ? null : { stage: aipnetCoverageStage(focus.nodeId) || focus.stage, input: focus.input });
    requestAnimationFrame(() => diagnosticRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  // Distinct from handleAipnetAnalysisFocus: the "Ver evidências" bridge
  // button sits above the Sankey panel and should surface the flow diagram
  // next (the logical next layer), not jump straight past it to the
  // per-NCM bar chart -- that jump is still correct for node/NCM-level
  // drill-downs, which keep using handleAipnetAnalysisFocus.
  const handleViewFlowEvidence = useCallback(() => {
    requestAnimationFrame(() => sankeyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const handleSelectNcmShortcut = useCallback((inputId: string) => {
    const input = solarSovereignty?.inputs.find((item) => item.input_id === inputId);
    if (!input) return;
    setCriticalOnly(false);
    setChainAnalysisFocus({ stage: sectorStageLabel(input.stage), input: input.label });
    requestAnimationFrame(() => diagnosticRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [solarSovereignty]);

  const handleOpenNibMatrix = useCallback(() => {
    handleReadingModeChange("analytical");
    window.setTimeout(() => nibRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }, [handleReadingModeChange]);

  const metrics = useMemo(() => {
    const totalImports = data.kpis?.totalImports ?? data.products.reduce((acc, item) => acc + item.metrics.imports, 0);
    const totalExports = data.kpis?.totalExports ?? data.products.reduce((acc, item) => acc + item.metrics.exports, 0);
    const avgDependency = data.kpis?.avgDependency ?? (data.products.length
      ? data.products.reduce((acc, item) => acc + item.metrics.externalDependency, 0) / data.products.length
      : 0);
    const maxHhiProduct = data.products.reduce<ConceptualProduct | undefined>(
      (best, item) => (!best || item.metrics.hhi > best.metrics.hhi ? item : best),
      undefined,
    );
    const maxHhi = data.kpis?.maxHhi ?? maxHhiProduct?.metrics.hhi ?? 0;
    const maxHhiProductName = maxHhiProduct?.name.split("(")[0].trim();
    const topRisk = [...data.products].sort(
      (left, right) =>
        right.metrics.externalDependency * right.metrics.hhi -
        left.metrics.externalDependency * left.metrics.hhi,
    )[0];

    return { totalImports, totalExports, avgDependency, maxHhi, maxHhiProductName, topRisk };
  }, [data.kpis, data.products]);
  const premiumProducts = useMemo(
    () => enrichSolarTechnicalProducts(
      technicalProducts
        .filter((product) => !selectedChain || product.cadeia_prioritaria === selectedChain)
        .slice(0, 12),
      selectedChain === "silicio" ? solarSovereignty?.inputs : undefined,
      solarSovereignty?.methodology_version,
      solarSovereignty?.reference_period,
    ),
    [selectedChain, solarSovereignty, technicalProducts],
  );
  const proportionalityProduct = useMemo(
    () => selectProportionalityProduct(premiumProducts),
    [premiumProducts],
  );
  const nibMatrixProducts = useMemo(
    () => solarSovereignty?.inputs.length
      ? buildSolarNibProducts(
          solarSovereignty.inputs,
          solarSovereignty.methodology_version,
          solarSovereignty.reference_period,
          (selectedChain ?? solarSovereignty.chain_name) as ProdutoConceitual["cadeia_prioritaria"],
        )
      : premiumProducts,
    [premiumProducts, selectedChain, solarSovereignty],
  );
  const radarProduct = useMemo(() => selectRadarProduct(premiumProducts), [premiumProducts]);
  const executiveHeroAlert = useMemo(
    () => solarSovereignty?.inputs.length
      ? buildSectorExecutiveHeroAlert(
          solarSovereignty.inputs,
          selectedChainMetadata?.name ?? solarSovereignty.chain_name,
        )
      : buildExecutiveHeroAlert(metrics.topRisk),
    [metrics.topRisk, selectedChainMetadata?.name, solarSovereignty],
  );
  const executiveHeroKpis = useMemo(
    () => buildExecutiveHeroKpis(metrics),
    [metrics],
  );
  const executiveVulnerabilityData = useMemo(
    () => buildExecutiveVulnerabilityData(data.products, selectedChain, solarSovereignty?.inputs),
    [data.products, selectedChain, solarSovereignty?.inputs],
  );
  const siliconValueAsymmetry = useMemo(
    () => selectedChain === "silicio" && solarSovereignty?.inputs.length
      ? buildSiliconValueAsymmetry(solarSovereignty.inputs)
      : undefined,
    [selectedChain, solarSovereignty],
  );
  const sovereigntyCoverage = useMemo(
    () => solarSovereignty?.inputs.length
      ? buildSovereigntyCoverage(solarSovereignty.inputs)
      : selectedChain === "silicio" ? SILICON_SOVEREIGNTY_COVERAGE : undefined,
    [selectedChain, solarSovereignty?.inputs],
  );
  const aipnetFlow = useMemo(
    () => buildAipnetFlow(radarProduct ?? premiumProducts[0]),
    [premiumProducts, radarProduct],
  );
  const executiveMetadata = useMemo(
    () => buildExecutiveMetadata(data.metadata, selectedChain, solarSovereignty),
    [data.metadata, selectedChain, solarSovereignty],
  );

  const headerChainOptions = useMemo(
    () => chainCatalog.filter((chain) => chain.status === "published").map((chain) => ({ id: chain.id, name: chain.name, group: chain.group })),
    [],
  );
  const headerNcmShortcuts = useMemo(() => {
    const inputs = solarSovereignty?.inputs ?? [];
    return [...inputs]
      .sort((left, right) => {
        const leftScore = (left.external_dependency ?? left.global_china_share ?? 0) * Math.max(left.supplier_hhi_brazil, 1);
        const rightScore = (right.external_dependency ?? right.global_china_share ?? 0) * Math.max(right.supplier_hhi_brazil, 1);
        return rightScore - leftScore;
      })
      .slice(0, 6)
      .map((input) => ({
        id: input.input_id,
        code: input.ncm_codes[0] ?? "s/ NCM",
        label: input.label,
        riskLabel: `${formatPercentOneDecimal((input.external_dependency ?? input.global_china_share ?? 0) * 100)} dependência · HHI ${number.format(input.supplier_hhi_brazil)}`,
      }));
  }, [solarSovereignty]);
  const globalSummary = useMemo(() => {
    const ok = Object.values(chainSummaries).filter((summary) => summary.ok);
    if (!ok.length) return null;
    return {
      criticalAlerts: ok.reduce((sum, summary) => sum + (summary.criticalCount ?? 0), 0),
      deficit: ok.reduce((sum, summary) => sum + (summary.totalImportsUsd ?? 0) - (summary.totalExportsUsd ?? 0), 0),
    };
  }, [chainSummaries]);

  const headerAlertCount = selectedChain
    ? executiveVulnerabilityData.filter((item) => item.dependency >= 75).length
    : globalSummary?.criticalAlerts;
  const headerAlertLabel = selectedChain
    ? headerAlertCount !== undefined ? `${headerAlertCount} Insumo${headerAlertCount === 1 ? "" : "s"} em Alerta Crítico` : undefined
    : globalSummary ? `${globalSummary.criticalAlerts} Alertas Críticos` : undefined;
  const headerDeficitLabel = selectedChain
    ? money.format(metrics.totalImports - metrics.totalExports)
    : globalSummary ? money.format(globalSummary.deficit) : undefined;
  const canExportChain = Boolean(selectedChain) && nibMatrixProducts.length > 0;

  const handleExportChain = useCallback(() => {
    if (!selectedChain || !nibMatrixProducts.length) return;
    const header = ["Produto", "NCM", "Importacao FOB (USD)", "Exportacao FOB (USD)", "Dependencia Externa (%)", "HHI"];
    const rows = nibMatrixProducts.map((product) => [
      product.produto_nome,
      product.ncm_codigo,
      product.comercio.importacao_valor_fob.toFixed(2),
      product.comercio.exportacao_valor_fob.toFixed(2),
      (product.industria.dependencia_externa_fracao * 100).toFixed(1),
      Math.round(product.comercio.hhi_global).toString(),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `border-value-${selectedChain}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [nibMatrixProducts, selectedChain]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <HeaderTopBar
        activeChainName={selectedChainMetadata?.name}
        chains={headerChainOptions}
        ncmShortcuts={headerNcmShortcuts}
        onSelectChain={handleChainSelect}
        onSelectNcm={handleSelectNcmShortcut}
        alertCount={headerAlertCount}
        alertLabel={headerAlertLabel}
        deficitLabel={headerDeficitLabel}
        canExport={canExportChain}
        onExport={handleExportChain}
        onOpenNibMatrix={handleOpenNibMatrix}
      />

      {!selectedChain ? (
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
          <ChainSelectionLanding
            onSelect={handleChainSelect}
            chains={chainCatalog}
            summaries={chainSummaries}
            isLoading={chainSummariesLoading}
          />
        </div>
      ) : (
      <div className="mx-auto max-w-[1600px] space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative z-50 rounded-xl border border-cyan-300/25 bg-cyan-400/[0.08] px-4 py-3 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Cadeia selecionada
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="truncate text-base font-bold text-white sm:text-lg">
                {selectedChainMetadata?.name ?? selectedChain}
              </h1>
              {selectedChainMetadata?.group ? (
                <span className="text-xs text-zinc-500">{selectedChainMetadata.group}</span>
              ) : null}
            </div>
          </div>
          <div ref={chainMenuRef} className="relative shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChainMenuOpen((current) => !current)}
              aria-expanded={chainMenuOpen}
              aria-haspopup="listbox"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.09] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Trocar cadeia
              <ChevronDown className={`h-3 w-3 transition-transform ${chainMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {chainMenuOpen ? (
              <div
                role="listbox"
                className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-xl"
              >
                <button
                  type="button"
                  onClick={() => { setChainMenuOpen(false); handleClearChain(); }}
                  className="block w-full border-b border-white/10 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-300"
                >
                  Ver todas as cadeias (painel inicial)
                </button>
                {chainCatalog.filter((chain) => chain.status === "published").map((chain) => (
                  <button
                    key={chain.id}
                    type="button"
                    role="option"
                    aria-selected={chain.id === selectedChain}
                    onClick={() => handleQuickChainSwitch(chain.id)}
                    disabled={chain.id === selectedChain}
                    className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition ${chain.id === selectedChain ? "cursor-default bg-cyan-400/10 text-cyan-100" : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"}`}
                  >
                    <span className="text-xs font-semibold">{chain.name}</span>
                    <span className="text-[10px] text-zinc-500">{chain.group}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        </section>
        <aside className="sticky top-[9.5rem] z-40 -my-4 flex flex-col gap-2 rounded-xl border border-cyan-300/20 bg-zinc-950/90 px-3 py-2.5 shadow-2xl backdrop-blur-xl md:top-[4.75rem] lg:flex-row lg:items-center lg:justify-between" aria-label="Profundidade da análise">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Profundidade</span>
            <button type="button" aria-pressed={readingMode === "guided"} title="Cadeia produtiva e diagnóstico essencial" onClick={() => handleReadingModeChange("guided")} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${readingMode === "guided" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"}`}>Visão executiva</button>
            <button type="button" aria-pressed={readingMode === "analytical"} title="Mantém a cadeia e acrescenta fluxos, NIB e empregos verdes" onClick={() => handleReadingModeChange("analytical")} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${readingMode === "analytical" ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"}`}>Análises avançadas</button>
          </div>
          <p aria-live="polite" className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-cyan-300" /> {modeFeedback}
          </p>
        </aside>
        <StateShell status={status} error={error} onRetry={loadData}>
          <div ref={overviewRef} className="scroll-mt-40 md:scroll-mt-28 space-y-4">
            <ExecutiveMainHero
              alert={executiveHeroAlert}
              kpis={executiveHeroKpis}
              strategicQuestion={selectedChain === "silicio"
                ? "Onde o Brasil possui capacidade e onde está o estrangulamento tecnológico da cadeia solar?"
                : "Onde estão a capacidade nacional e os principais estrangulamentos desta cadeia?"}
            />
            {selectedChain === "silicio" && solarSovereignty?.inputs.length ? (
              <SiliconStrategicLevers
                valueAsymmetry={siliconValueAsymmetry}
                solarInputs={solarSovereignty.inputs}
              />
            ) : null}
          </div>

          <AipnetSystemsFlow
            chainId={selectedChain}
            inputs={solarSovereignty?.inputs}
            onAnalysisFocus={handleAipnetAnalysisFocus}
            onViewFlowEvidence={handleViewFlowEvidence}
          />

          {/* Primary entry panel for the executive read -- was previously
              buried inside the readingMode==="analytical"-gated
              "Aprofundamento analítico" section below, collapsed by
              default, so it needed a mode switch plus a click to even see.
              Moved ahead of the dependency bar chart and opened by
              default; the bar chart is the supporting complement, not the
              lead. */}
          <div ref={sankeyRef} className="scroll-mt-6">
            <ExpandableAnalyticsPanel eyebrow="Soberania & rede" title="Fluxo de soberania por produto" subtitle="Rede de fornecedores, produto e capacidade nacional" defaultOpen>
              <SovereigntySankeyChart
                dado={radarProduct ?? premiumProducts[0]}
                solarInputs={solarSovereignty?.inputs}
                chainName={selectedChainMetadata?.name ?? solarSovereignty?.chain_name}
                height={620}
                title="Fluxo AIPNET por produto conceitual"
                onAnalysisFocus={handleAipnetAnalysisFocus}
              />
            </ExpandableAnalyticsPanel>
          </div>

            <div ref={diagnosticRef} className="scroll-mt-6">
              <ExpandableAnalyticsPanel
                eyebrow="Balança & dependência"
                title="Diagnóstico de soberania industrial"
                subtitle="Dependência externa crítica, balança comercial e cobertura estrutural da cadeia"
                defaultOpen
              >
                <ExecutiveVulnerabilityChart
                  data={executiveVulnerabilityData}
                  coverageGroups={sovereigntyCoverage}
                  chainFocus={chainAnalysisFocus}
                  onClearChainFocus={() => setChainAnalysisFocus(null)}
                  criticalOnly={criticalOnly}
                  onCriticalOnlyChange={(value) => {
                    setCriticalOnly(value);
                    setChainAnalysisFocus(null);
                  }}
                  onCoverageItemSelect={(stage, input) => {
                    setCriticalOnly(false);
                    setChainAnalysisFocus({ stage, input });
                  }}
                />
              </ExpandableAnalyticsPanel>
            </div>

          {readingMode === "analytical" && (premiumProducts.length || selectedChain === "silicio") ? (
            <section ref={advancedRef} className="scroll-mt-40 space-y-5 md:scroll-mt-28">
              <div className="border-l-2 border-cyan-300/60 pl-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  Aprofundamento analítico
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                  Fluxos, priorização industrial e transição justa
                </h2>
              </div>

              {proportionalityProduct && selectedChain === "combustiveis_transicao" ? (
                <ExpandableAnalyticsPanel
                  eyebrow="Metodologia & proporcionalidade"
                  title="Lente RenovaCalc · uso final dos biocombustíveis"
                  subtitle="Separa, dentro da cesta comercial, a parcela efetivamente associada à transição energética"
                  defaultOpen
                >
                  <ProportionalityToggle dado={proportionalityProduct} />
                </ExpandableAnalyticsPanel>
              ) : null}

              {solarSovereignty?.inputs.length ? (
                <ExpandableAnalyticsPanel
                  eyebrow="Meio ambiente & emissões"
                  title="Exposição de carbono da pauta importada"
                  subtitle="Distribuição real por rota produtiva declarada, cruzada com o contexto energético nacional (BEN/EPE)"
                >
                  <CarbonFootprintIndustrialBlock
                    solarInputs={solarSovereignty.inputs}
                    energyContext={energyContext}
                    chainName={selectedChainMetadata?.name ?? solarSovereignty?.chain_name}
                  />
                </ExpandableAnalyticsPanel>
              ) : null}

              {nibMatrixProducts.length ? (
                <div ref={nibRef} className="scroll-mt-40 md:scroll-mt-28">
                  <ExpandableAnalyticsPanel eyebrow="Política industrial" title="Matriz de priorização NIB" subtitle="Posicionamento estratégico dos produtos da cadeia">
                    <NIBMatrixChart data={nibMatrixProducts} />
                  </ExpandableAnalyticsPanel>
                </div>
              ) : null}

              {solarSovereignty?.green_jobs ? (
                <ExpandableAnalyticsPanel
                  eyebrow="Mercado de trabalho"
                  title="Empregos verdes e transição justa"
                  subtitle="Vínculos RAIS em atividades da cadeia associadas à Taxonomia Sustentável Brasileira"
                >
                  <GreenJobsTSBPanel
                    data={solarSovereignty.green_jobs}
                    chainName={selectedChainMetadata?.name ?? "cadeia analisada"}
                    solarInputs={solarSovereignty.inputs}
                  />
                </ExpandableAnalyticsPanel>
              ) : null}

              {selectedChain === "silicio" ? (
                <ExpandableAnalyticsPanel
                  eyebrow="Balanço de processo"
                  title="Balanço de massa e energia por etapa"
                  subtitle="Intensidade energética, capacidade nacional e concentração global — do quartzo ao módulo"
                >
                  <SiliconMassEnergyBalancePanel energyContext={energyContext} />
                </ExpandableAnalyticsPanel>
              ) : energyContext?.blocos.length ? (
                <ExpandableAnalyticsPanel
                  eyebrow="Meio ambiente & energia"
                  title="Contexto Energético Nacional (BEN/EPE)"
                  subtitle="Referência nacional/anual do Balanço Energético Nacional — não cruzada linha a linha com os dados municipais"
                >
                  <EnergyContextBenPanel data={energyContext} />
                </ExpandableAnalyticsPanel>
              ) : null}

            </section>
          ) : null}

          {premiumProducts.length ? (
            <TechnicalDrawer
              data={nibMatrixProducts}
              solarInputs={solarSovereignty?.inputs}
              solarMethodologyVersion={solarSovereignty?.methodology_version}
            />
          ) : null}

          <ExecutiveMetadataFooter metadata={executiveMetadata} />
        </StateShell>
      </div>
      )}
    </main>
  );
}

function ExpandableAnalyticsPanel({
  eyebrow,
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-white/[0.08] bg-zinc-900/30 shadow-xl backdrop-blur-xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</span>
          <span className="mt-1 block text-base font-bold text-white">{title}</span>
          <span className="mt-1 block text-xs font-normal text-zinc-500">{subtitle}</span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/[0.07] p-4 sm:p-5">{children}</div>
    </details>
  );
}

function aipnetCoverageStage(nodeId: string) {
  const stages: Record<string, string> = {
    quartzo_silica_br: "Base mineral",
    silicio_grau_metalurgico_br: "Silício metalúrgico",
    polissilicio_cn: "Refino solar",
    lingotes_silicio_cn: "Lingotes e wafers",
    wafers_fotovoltaicos_cn: "Lingotes e wafers",
    celulas_fotovoltaicas_cn: "Células e módulos",
    modulos_fotovoltaicos_br: "Células e módulos",
    fuel_feedstocks_br: "Insumos e matérias-primas",
    fuel_conversion_br: "Molécula principal",
    fuel_advanced_inputs: "Insumos tecnológicos",
    fuel_final_br: "Aplicações finais",
    fertilizer_resources: "Matérias-primas",
    fertilizer_intermediates: "Intermediários químicos",
    fertilizer_blending_br: "Formulação e mistura",
    fertilizer_use_br: "Formulação e mistura",
    steel_inputs_br: "Base mineral e sucata",
    steel_reduction_br: "Redução",
    steel_alloys_global: "Aciaria e ligas",
    steel_products_br: "Bens da transição",
  };
  return stages[nodeId] ?? "";
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
      className="block rounded-lg border border-white/[0.08] bg-white/[0.04] p-4 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{body}</p>
        </div>
        {current ? (
          <span className="rounded-md border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-200">
            Ativo
          </span>
        ) : null}
      </div>
    </Link>
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
        <h2 className="mt-4 text-xl font-bold tracking-tight text-white">Painel indisponível</h2>
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
          A rota raiz está pronta, mas a API central ainda não retornou produtos para resumir.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

function selectProportionalityProduct(data: ProdutoConceitual[]) {
  return (
    data.find((product) => product.fator_proporcionalidade.fator_alpha < 1) ??
    data.find((product) => product.fator_proporcionalidade.aplicado) ??
    data[0] ??
    null
  );
}

function enrichSolarTechnicalProducts(
  products: ProdutoConceitual[],
  solarInputs?: SolarInputMetric[],
  methodologyVersion?: string,
  referencePeriod?: string,
) {
  if (!solarInputs?.length) return products;

  return products.map((product) => {
    const matches = matchSolarInputs(product.produto_nome, solarInputs);
    if (!matches.length) return product;

    const ncmCodes = Array.from(new Set(matches.flatMap((input) => input.ncm_codes))).sort();
    const prodlistCodes = Array.from(
      new Set(
        matches
          .flatMap((input) => input.prodlist_codes ?? [])
          .filter((code) => code && code !== "NCM_SEM_PONTE"),
      ),
    ).sort();
    const isValidated = matches.every((input) => input.measurement_method === "validated");
    const notes = Array.from(
      new Set(matches.map((input) => input.data_gap_reason).filter((note): note is string => Boolean(note))),
    );

    return {
      ...product,
      ncm_codigo: ncmCodes[0] ?? product.ncm_codigo,
      ncm_codigos: ncmCodes,
      industria: {
        ...product.industria,
        prodlist_codigo: prodlistCodes[0] ?? product.industria.prodlist_codigo,
        prodlist_codigos: prodlistCodes,
        valor_producao_pia: matches.reduce(
          (total, input) => total + (input.domestic_production_value_brl ?? 0),
          0,
        ),
      },
      auditoria: {
        ...product.auditoria,
        is_ncm_generica: !isValidated,
        confidence_level: lowestSolarConfidence(matches),
        metodologia_versao: methodologyVersion ?? product.auditoria.metodologia_versao,
        ncm_mapping_status: isValidated ? "validada" as const : "proxy" as const,
        ncm_mapping_version: [methodologyVersion, referencePeriod].filter(Boolean).join(" · "),
        ncm_mapping_note: notes.join(" ") || undefined,
      },
    };
  });
}

function buildSolarNibProducts(
  inputs: SolarInputMetric[],
  methodologyVersion: string,
  referencePeriod: string,
  chainName: ProdutoConceitual["cadeia_prioritaria"],
): ProdutoConceitual[] {
  return inputs.map((input) => {
    const productionBrl = input.domestic_production_value_brl ?? 0;
    const apparentConsumption = Math.max(
      (input.domestic_production_value_usd_comparable ?? 0) + input.imports_value_usd - input.exports_value_usd,
      0,
    );
    const mappingStatus = input.measurement_method === "validated" ? "validada" as const : "proxy" as const;

    return {
      conceptual_product_id: `aipnet-${chainName}-${input.input_id}`,
      produto_nome: input.label,
      cadeia_prioritaria: chainName,
      chain_stage: solarContractStage(input.stage),
      ncm_codigo: input.ncm_codes[0] ?? "00000000",
      ncm_codigos: input.ncm_codes,
      comercio: {
        importacao_valor_fob: input.imports_value_usd,
        importacao_peso_liquido: input.imports_net_weight_kg,
        exportacao_valor_fob: input.exports_value_usd,
        exportacao_peso_liquido: input.exports_net_weight_kg,
        deficit_comercial: input.imports_value_usd - input.exports_value_usd,
        principal_pais_origem: input.top_supplier?.country_name ?? "Origem não publicada",
        principal_pais_participacao: input.top_supplier?.share ?? 0,
        hhi_global: input.supplier_hhi_brazil,
      },
      industria: {
        cnae_codigo: input.prodlist_codes[0]?.slice(0, 4) ?? "0000",
        prodlist_codigo: input.prodlist_codes[0] ?? "00000000",
        prodlist_codigos: input.prodlist_codes,
        valor_producao_pia: productionBrl,
        consumo_aparente: apparentConsumption,
        // ?? 0 alone would silently read "no defensible denominator" (null)
        // as "0% dependent" -- backwards for CONFIRMED_ZERO_DOMESTIC_PRODUCTION
        // inputs, where null means the opposite: no domestic production to
        // divide against, so external reliance is total.
        dependencia_externa_fracao: CONFIRMED_ZERO_DOMESTIC_PRODUCTION.has(input.input_id)
          ? 1
          : input.external_dependency ?? 0,
        qtde_vinculos_rais: 0,
        massa_salarial_rais: 0,
      },
      auditoria: {
        reference_year: Number(referencePeriod.slice(0, 4)) || 2026,
        confidence_level: input.confidence_level,
        is_ncm_generica: mappingStatus === "proxy",
        has_sigilo_pia: input.production_statuses.includes("confidential"),
        metodologia_versao: methodologyVersion,
        ncm_mapping_status: mappingStatus,
        ncm_mapping_version: `${methodologyVersion} · ${referencePeriod}`,
        ncm_mapping_note: input.data_gap_reason ?? undefined,
      },
      fator_proporcionalidade: {
        aplicado: mappingStatus === "proxy",
        fator_alpha: 1,
        fonte_proxy: mappingStatus === "proxy" ? "Cesta AIPNET de produto relacionado" : "Cesta NCM validada",
      },
    };
  });
}

function solarContractStage(stage: string): ProdutoConceitual["chain_stage"] {
  if (["extracao", "materias_primas", "base_mineral", "insumos"].includes(stage)) return "insumo";
  if (["produto_final", "aplicacoes_finais", "bens_transicao"].includes(stage)) return "produto_final";
  if (["componentes_avancados", "equipamentos"].includes(stage)) return "equipamento";
  return "processamento";
}

function matchSolarInputs(productName: string, inputs: SolarInputMetric[]) {
  const name = normalizeProductName(productName);
  let ids: string[] = [];

  if (/celulas? fotovoltaicas?|modulos? fotovoltaicos?|paineis?/.test(name)) {
    ids = ["celulas_fotovoltaicas", "modulos_fotovoltaicos"];
  } else if (/quartzitos?/.test(name)) {
    ids = ["quartzito"];
  } else if (/\bquartzo\b/.test(name)) {
    ids = ["quartzo"];
  } else if (/polissilicio/.test(name)) {
    ids = ["polissilicio_solar"];
  } else if (/wafers?/.test(name)) {
    ids = ["wafers_fotovoltaicos"];
  } else if (/^silicio(?:\s|$)/.test(name)) {
    ids = ["silicio_grau_metalurgico"];
  }

  const selected = new Set(ids);
  return inputs.filter((input) => selected.has(input.input_id));
}

function lowestSolarConfidence(inputs: SolarInputMetric[]): ProdutoConceitual["auditoria"]["confidence_level"] {
  const rank = { alta: 3, media: 2, baixa: 1 } as const;
  return inputs.reduce<ProdutoConceitual["auditoria"]["confidence_level"]>(
    (lowest, input) => rank[input.confidence_level] < rank[lowest] ? input.confidence_level : lowest,
    "alta",
  );
}

function selectRadarProduct(data: ProdutoConceitual[]) {
  return [...data].sort((left, right) => {
    const leftScore = left.comercio.hhi_global * left.industria.dependencia_externa_fracao;
    const rightScore = right.comercio.hhi_global * right.industria.dependencia_externa_fracao;
    return rightScore - leftScore;
  })[0] ?? null;
}

function buildExecutiveHeroAlert(product?: ConceptualProduct): ExecutiveTopAlert | undefined {
  if (!product) return undefined;

  const dependency = product.metrics.externalDependency;
  const hhi = product.metrics.hhi;
  const supplier = executiveSupplierName(product.metrics.mainSupplier.country);
  const supplierShare = product.metrics.mainSupplier.share;
  const hasPublishedSupplier = supplier !== "Em auditoria" && supplierShare > 0;
  const executiveName = executiveConceptualProductName(product.name, {
    chain: executiveAlertChain(product),
    stage: product.productionStage,
  });

  return {
    productName: executiveName,
    conceptualCategory: executiveName === product.name ? product.productionStage : "Base química estratégica",
    traceabilityLabel: traceabilityLabel(product),
    chain: product.chain,
    dependencyRate: dependency,
    hhi,
    hhiLabel: hhiRiskLabel(hhi),
    topSupplier: supplier,
    supplierShare,
    fobValue: money.format(product.metrics.imports),
    whyThisIsHere: hasPublishedSupplier
      ? `Triagem Automática de Emergência: isolado automaticamente por combinar ${formatPercentOneDecimal(dependency)} de dependência externa com ${formatPercentOneDecimal(supplierShare)} das compras concentradas em ${supplier}.`
      : `Triagem Automática de Emergência: isolado automaticamente por combinar ${formatPercentOneDecimal(dependency)} de dependência externa com HHI ${number.format(hhi)}; os dados de origem fina estão em homologação nas bases de comércio exterior.`,
    impactSummary: vulnerabilityImpact(product, dependency),
    recommendedPolicy: recommendedPolicy(product, dependency, hhi),
  };
}

function buildSectorExecutiveHeroAlert(
  inputs: SolarInputMetric[],
  chainName: string,
): ExecutiveTopAlert | undefined {
  const candidates = inputs.filter((input) => (
    input.imports_value_usd > 0
    && input.external_dependency !== null
  ));

  const input = [...candidates].sort((left, right) => {
    const leftScore = (left.external_dependency ?? 0) * Math.max(left.supplier_hhi_brazil, 1);
    const rightScore = (right.external_dependency ?? 0) * Math.max(right.supplier_hhi_brazil, 1);
    return rightScore - leftScore;
  })[0];

  if (!input) return undefined;

  const dependencyRate = Math.min(100, Math.max(0, (input.external_dependency ?? 0) * 100));
  const supplier = input.top_supplier?.country_name ?? "Origem em auditoria";
  const supplierShare = Math.min(100, Math.max(0, (input.top_supplier?.share ?? 0) * 100));
  const stage = executiveStageLabel(input.stage);
  const hasPublishedSupplier = Boolean(input.top_supplier && supplierShare > 0);

  return {
    productName: input.label,
    conceptualCategory: stage,
    chain: chainName,
    dependencyRate,
    hhi: input.supplier_hhi_brazil,
    hhiLabel: hhiRiskLabel(input.supplier_hhi_brazil),
    topSupplier: supplier,
    supplierShare,
    fobValue: money.format(input.imports_value_usd),
    whyThisIsHere: hasPublishedSupplier
      ? `Selecionado dentro da cesta homologada de ${chainName} por combinar ${formatPercentOneDecimal(dependencyRate)} de dependência externa, HHI ${number.format(input.supplier_hhi_brazil)} e ${formatPercentOneDecimal(supplierShare)} das importações provenientes de ${supplier}.`
      : `Selecionado dentro da cesta homologada de ${chainName} pela combinação de ${formatPercentOneDecimal(dependencyRate)} de dependência externa e HHI ${number.format(input.supplier_hhi_brazil)}. A origem fina permanece em auditoria.`,
    impactSummary: `A concentração externa deste insumo pode restringir a continuidade da etapa de ${stage.toLowerCase()} e elevar custos de investimento na cadeia de ${chainName}.`,
    recommendedPolicy: sectorRecommendedPolicy(chainName, input.label),
  };
}

function executiveStageLabel(stage: string) {
  const labels: Record<string, string> = {
    base_mineral: "Base mineral",
    reducao: "Redução e processamento",
    aciaria: "Aciaria e insumos metalúrgicos",
    transformacao: "Transformação industrial",
    bens_transicao: "Bens para a transição",
    materias_primas: "Matérias-primas",
    intermediarios: "Intermediários industriais",
    formulacao: "Formulação industrial",
    insumos_tecnologicos: "Tecnologias habilitadoras",
    aplicacoes_finais: "Aplicações finais",
  };
  return labels[stage] ?? stage.replaceAll("_", " ");
}

// Cita a missão oficial da Nova Industria Brasil (Decreto no. 11.986/2024,
// MDIC/BNDES) mais aderente a cada cadeia, em vez de um texto generico de
// "diversificar fornecedores" repetido para qualquer insumo. As 6 missoes
// oficiais: 1) Cadeias agroindustriais sustentaveis e digitais para a
// seguranca alimentar, nutricional e energetica; 2) Complexo economico
// industrial da saude; 3) Infraestrutura, saneamento, moradia e mobilidade
// sustentaveis; 4) Transformacao digital da industria; 5) Bioeconomia,
// descarbonizacao e transicao e seguranca energeticas; 6) Tecnologias de
// soberania e defesa nacionais. Fonte: MDIC/ABDI, "Nova Industria Brasil"
// (janelaunica.mdic.gov.br/portal/nova-industria-brasil).
function sectorRecommendedPolicy(chainName: string, inputLabel: string) {
  const context = `${chainName} ${inputLabel}`.toLowerCase();

  if (/quartzo|silício|silicio|polissilício|polissilicio|wafer|fotovoltaic|módulo|modulo|célula|celula/.test(context)) {
    return "Missão 5 da NIB (Bioeconomia, descarbonização e transição e segurança energéticas): diversificar fornecedores e desenvolver capacidade produtiva nacional na cadeia solar fotovoltaica, hoje concentrada na China nas etapas de polissilício e wafers.";
  }
  if (/aço|siderurg|ferro|grafite|ferroliga|laminado|estrutura/.test(context)) {
    return "Missão 3 da NIB (Infraestrutura, saneamento, moradia e mobilidade sustentáveis): diversificar fornecedores de insumos siderúrgicos e desenvolver capacidade nacional em rotas compatíveis com a Missão 5 (descarbonização industrial).";
  }
  if (/fertiliz|amônia|amonia|fosfat|potáss|potass|ureia|rocha fosfática|rocha fosfatica/.test(context)) {
    return "Missão 1 da NIB (Cadeias agroindustriais sustentáveis e digitais para a segurança alimentar, nutricional e energética): ampliar a oferta doméstica de fertilizantes, diversificar origens e reduzir a dependência externa que hoje ameaça a segurança alimentar nacional.";
  }
  if (/combust|saf|biometano|hidrogênio|hidrogenio|eletrolis|etanol|biodiesel|metanol|gás natural|gas natural/.test(context)) {
    return "Missão 5 da NIB (Bioeconomia, descarbonização e transição e segurança energéticas): desenvolver fornecedores nacionais para combustíveis e tecnologias de baixo carbono, condicionando apoio à redução verificável de emissões.";
  }
  return "Direcionamento NIB a homologar: insumo ainda não mapeado explicitamente a uma das 6 missões da Nova Indústria Brasil (MDIC/BNDES).";
}

// Minimum traded weight before trusting a US$/kg figure -- thin flows
// (e.g. polissilicio_solar's 142kg import in 2026-H1) produce noisy,
// unrepresentative prices per kg.
const MIN_WEIGHT_KG_FOR_PRICE = 1000;

function buildSiliconValueAsymmetry(inputs: SolarInputMetric[]): SiliconValueAsymmetry | undefined {
  const exportInput = inputs.find((input) => input.input_id === "silicio_grau_metalurgico");
  // celulas_fotovoltaicas (bare cells), not modulos_fotovoltaicos (assembled
  // modules): modules carry heavy low-value glass/aluminum framing that
  // dilutes US$/kg below raw Si-GM, inverting the intended asymmetry. Cells
  // are the concentrated, high-value-density stage Brazil re-imports, and
  // already the platform's own flagship sovereignty alert for this chain.
  const importInput = inputs.find((input) => input.input_id === "celulas_fotovoltaicas");
  if (!exportInput || !importInput) return undefined;
  if (exportInput.exports_net_weight_kg < MIN_WEIGHT_KG_FOR_PRICE) return undefined;
  if (importInput.imports_net_weight_kg < MIN_WEIGHT_KG_FOR_PRICE) return undefined;

  const exportPricePerKg = exportInput.exports_value_usd / exportInput.exports_net_weight_kg;
  const importPricePerKg = importInput.imports_value_usd / importInput.imports_net_weight_kg;
  if (exportPricePerKg <= 0 || importPricePerKg <= 0) return undefined;

  return {
    exportInputLabel: exportInput.label,
    exportPricePerKg,
    importInputLabel: importInput.label,
    importPricePerKg,
    ratio: importPricePerKg / exportPricePerKg,
  };
}

function csvEscape(value: string) {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function formatPercentOneDecimal(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function traceabilityLabel(product: ConceptualProduct) {
  const firstNcm = product.technicalCodes.ncm[0];
  const firstProdlist = product.technicalCodes.prodlist?.[0];
  const firstCnae = product.technicalCodes.cnae[0];

  if (firstNcm) return `NCM ${firstNcm}`;
  if (firstProdlist) return `Prodlist ${firstProdlist}`;
  if (firstCnae) return `CNAE ${firstCnae}`;
  return "código fiscal em auditoria";
}

function vulnerabilityImpact(product: ConceptualProduct, dependency: number) {
  const context = `${product.name} ${product.chain} ${product.productionStage}`.toLowerCase();

  if (/fotovolta|painel solar|m[oó]dulo solar|c[eé]lula solar|sil[ií]cio|polissil|wafer/.test(context)) {
    return "A dependência de células, wafers e materiais fotovoltaicos importados expõe a montagem nacional a rupturas de fornecimento, variação cambial e concentração tecnológica, podendo elevar o custo e atrasar a expansão da geração solar no Brasil.";
  }

  if (/qu[ií]mic|bioprocess|agro|transi|combust/i.test(context)) {
    return "Insumo biocatalisador sem substituto nacional direto. A interrupção da rota de suprimento compromete a produção de bioetanol de 2ª geração e defensivos de baixa pegada de carbono.";
  }

  if (dependency >= 75) {
    return "Insumo crítico com baixa capacidade doméstica de substituição. Uma ruptura de fornecimento pode interromper etapas industriais nacionais e pressionar custos de investimento produtivo.";
  }

  return "Produto relevante para acompanhamento executivo, com risco material condicionado à concentração de origem e à capacidade doméstica disponível.";
}

function buildExecutiveHeroKpis(metrics: {
  totalImports: number;
  totalExports: number;
  avgDependency: number;
  maxHhi: number;
  maxHhiProductName?: string;
}): ExecutiveMainKpi[] {
  return [
    {
      label: "Importações Totais",
      value: money.format(metrics.totalImports),
      note: "Insumos e bens de capital da pauta",
      icon: <ArrowDownRight className="h-4 w-4 text-emerald-400" />,
    },
    {
      label: "Exportações Totais",
      value: money.format(metrics.totalExports),
      note: metrics.totalExports >= metrics.totalImports ? "Superávit ativo nos agregados" : "Saldo agregado em atenção",
      tone: "success",
      icon: <LineChart className="h-4 w-4 text-sky-400" />,
    },
    {
      label: "Dependência Média",
      value: `${number.format(metrics.avgDependency)}%`,
      note: "Razão importação / consumo aparente",
      tone: "warning",
      icon: <Globe2 className="h-4 w-4 text-amber-400" />,
    },
    {
      label: "Concentração Máxima",
      value: number.format(metrics.maxHhi),
      note: metrics.maxHhi >= 9000 && metrics.maxHhiProductName
        ? `Monopólio: ${metrics.maxHhiProductName}`
        : hhiRiskLabel(metrics.maxHhi),
      tone: "danger",
      icon: <ShieldAlert className="h-4 w-4 text-red-400" />,
    },
  ];
}

// Inputs with no defensible domestic-production denominator at all -- not
// "estimated low", but confirmed no manufacturing capability exists (e.g.
// wafer-to-cell p-n junction fabrication, which Brazil doesn't have). Shared
// between buildExecutiveVulnerabilityData (dependency bar) and
// buildSovereigntyCoverage (structural coverage status dot) so both surfaces
// agree instead of one showing Crítico and the other Observado for the same
// input.
const CONFIRMED_ZERO_DOMESTIC_PRODUCTION = new Set(["celulas_fotovoltaicas"]);

function buildExecutiveVulnerabilityData(
  products: ConceptualProduct[],
  selectedChain: string | null,
  solarInputs?: SolarInputMetric[],
): ProductVulnerability[] {
  const observedProducts: ProductVulnerability[] = [...products]
    .sort(
      (left, right) =>
        right.metrics.externalDependency * right.metrics.hhi -
        left.metrics.externalDependency * left.metrics.hhi,
    )
    .slice(0, 8)
    .map((product) => {
      const executiveName = executiveConceptualProductName(product.name, {
        chain: product.chain,
        stage: product.productionStage,
      });

      return {
        name: executiveName,
        category: product.chain,
        dependency: product.metrics.externalDependency,
        hhi: Math.round(product.metrics.hhi),
        strategic: true,
        executiveName,
        technicalName:
          normalizeProductName(product.name) !== normalizeProductName(executiveName)
            ? product.name
            : undefined,
        evidenceType: "observed",
        chainStage: product.productionStage,
      };
    });

  if (solarInputs?.length) {
    const primaryInputIds = new Set([
      "quartzo", "quartzito", "silicio_grau_metalurgico", "polissilicio_solar",
      "wafers_fotovoltaicos", "celulas_fotovoltaicas", "modulos_fotovoltaicos",
    ]);
    // Comex-derived external_dependency for CONFIRMED_ZERO_DOMESTIC_PRODUCTION
    // inputs either falls back to china_share_brazilian_imports (a supplier-
    // diversification metric that reads as "controlled" purely because
    // imports come from many countries, not because any of it is domestic)
    // or is null outright. Both misrepresent 100% import reliance as a
    // moderate/low risk.
    return solarInputs
      .map((input): ProductVulnerability => {
        const confirmedZeroDomestic = CONFIRMED_ZERO_DOMESTIC_PRODUCTION.has(input.input_id);
        const usesStructuralRisk = !confirmedZeroDomestic && input.external_dependency === null && input.global_china_share !== null;
        const usesImportConcentration = !confirmedZeroDomestic && input.external_dependency === null && input.global_china_share === null;
        return {
          name: input.label,
          category: confirmedZeroDomestic
            ? "Gargalo de soberania confirmado"
            : usesStructuralRisk ? "Gargalo estrutural AIPNET" : sectorStageLabel(input.stage),
          dependency: confirmedZeroDomestic
            ? 100
            : Math.round(Math.min(1, input.external_dependency ?? input.global_china_share ?? input.china_share_brazilian_imports) * 1000) / 10,
          hhi: Math.round(
            usesStructuralRisk
              ? input.global_hhi_floor ?? 0
              : input.supplier_hhi_brazil,
          ),
          strategic: primaryInputIds.has(input.input_id),
          executiveName: input.label,
          evidenceType: usesStructuralRisk ? "aipnet_structural" : "observed",
          evidenceNote: confirmedZeroDomestic
            ? "Sem fabricação nacional confirmada (conversão wafer → junção p-n); o indicador de dependência por origem de fornecedor subestima o risco real porque a pauta importada é diversificada entre países, não porque há produção doméstica."
            : usesStructuralRisk
              ? input.data_gap_reason ?? "Concentração global da etapa produtiva."
              : input.data_gap_reason ?? `Fonte: Comex Stat ${input.reference_period}; indicador comercial observado.`,
          importsValueUsd: input.imports_value_usd,
          exportsValueUsd: input.exports_value_usd,
          importsWeightKg: input.imports_net_weight_kg,
          chinaShare: Math.round((usesStructuralRisk ? input.global_china_share ?? 0 : input.china_share_brazilian_imports) * 1000) / 10,
          topSupplier: input.top_supplier?.country_name,
          confidence: input.confidence_level,
          measurementMethod: usesStructuralRisk ? "structural" : input.measurement_method,
          chainStage: sectorStageLabel(input.stage),
          metricKind: confirmedZeroDomestic
            ? "confirmed_zero_domestic"
            : usesStructuralRisk
              ? "global_concentration"
              : usesImportConcentration
                ? "china_import_share"
                : "external_dependency",
        };
      })
      .sort((left, right) => right.dependency * right.hhi - left.dependency * left.hhi);
  }

  const structuralRisks: ProductVulnerability[] = selectedChain === "silicio"
    ? [
        {
          name: "Polissilício de grau solar",
          category: "Gargalo estrutural AIPNET",
          dependency: 95,
          hhi: 9025,
          strategic: true,
          executiveName: "Polissilício de grau solar",
          evidenceType: "aipnet_structural",
          evidenceNote: "Concentração dominante estimada em 95% na etapa crítica de refino solar.",
        },
        {
          name: "Wafers fotovoltaicos",
          category: "Gargalo estrutural AIPNET",
          dependency: 97,
          hhi: 9409,
          strategic: true,
          executiveName: "Wafers fotovoltaicos",
          evidenceType: "aipnet_structural",
          evidenceNote: "Concentração dominante estimada em 97% na fabricação mundial de wafers.",
        },
      ]
    : [];

  return [...structuralRisks, ...observedProducts]
    .sort((left, right) => right.dependency * right.hhi - left.dependency * left.hhi)
    .slice(0, 8);
}

function sectorStageLabel(stage: string) {
  return ({
    extracao: "Base mineral",
    processamento: "Silício metalúrgico",
    refinamento: "Refino solar",
    componentes_avancados: "Componentes avançados",
    produto_final: "Células e módulos",
    molecula_principal: "Molécula principal",
    derivados: "Derivados",
    aplicacoes_finais: "Aplicações finais",
    insumos: "Insumos e matérias-primas",
    insumos_tecnologicos: "Insumos tecnológicos",
    equipamentos: "Produção de hidrogênio renovável",
    materias_primas: "Matérias-primas",
    intermediarios: "Intermediários químicos",
    nitrogenados: "Fertilizantes nitrogenados",
    potassicos: "Fertilizantes potássicos",
    fosfatados: "Fertilizantes fosfatados",
    formulacao: "Formulação e mistura",
    base_mineral: "Base mineral e sucata",
    reducao: "Redução",
    aciaria: "Aciaria e ligas",
    transformacao: "Transformação siderúrgica",
    bens_transicao: "Bens da transição",
  } as Record<string, string>)[stage] ?? stage;
}

function buildSovereigntyCoverage(inputs: SolarInputMetric[]): SovereigntyCoverageGroup[] {
  const groups = new Map<string, SovereigntyCoverageGroup["items"]>();
  inputs.forEach((input) => {
    const stage = sectorStageLabel(input.stage);
    const items = groups.get(stage) ?? [];
    const confirmedZeroDomestic = CONFIRMED_ZERO_DOMESTIC_PRODUCTION.has(input.input_id);
    const criticalMetric = input.external_dependency ?? input.global_china_share ?? input.china_share_brazilian_imports;
    items.push({
      name: input.label,
      explanation: confirmedZeroDomestic
        ? "Sem fabricação nacional confirmada -- a diversificação de fornecedores não implica produção doméstica."
        : input.data_gap_reason ?? undefined,
      status: confirmedZeroDomestic
        ? "critical"
        : input.global_china_share !== null && input.external_dependency === null
          ? "critical"
          : input.measurement_method === "validated"
            ? criticalMetric >= 0.75 ? "critical" : "observed"
            : input.measurement_method === "estimated" ? "estimated" : "external_source",
    });
    groups.set(stage, items);
  });
  return Array.from(groups, ([stage, items]) => ({ stage, items }));
}

function normalizeProductName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildAipnetFlow(product?: ProdutoConceitual | null): AipnetFlow | null {
  if (!product) return null;

  const supplierShare = Math.max(product.comercio.principal_pais_participacao * 100, 0);
  const dependency = product.industria.dependencia_externa_fracao * 100;
  const hhi = product.comercio.hhi_global;
  const productText = normalizeProductName(
    `${product.produto_nome} ${product.ncm_codigo} ${product.cadeia_prioritaria}`,
  );
  const isSemiconductor =
    /circuitos? integrados?|semicondutor|chipset|processador|8542/.test(productText);
  const riskLevel: AipnetFlow["riskLevel"] =
    dependency >= 75 || hhi >= 5000 ? "Crítico" : dependency >= 35 || hhi >= 1800 ? "Moderado" : "Baixo";
  const supplier = executiveSupplierName(product.comercio.principal_pais_origem);
  const supplierIsAudited = supplier === "Em auditoria" || supplierShare <= 0;
  const totalValueFob = product.comercio.importacao_valor_fob;
  const semiconductorOrigins = [
    { supplier: "Taiwan (TSMC)", share: 54, valueFob: totalValueFob * 0.54 },
    { supplier: "China Popular", share: 28.5, valueFob: totalValueFob * 0.285 },
    { supplier: "Estados Unidos", share: 12, valueFob: totalValueFob * 0.12 },
    { supplier: "Outras Origens", share: 5.5, valueFob: totalValueFob * 0.055 },
  ];
  const semiconductorDestinations = [
    {
      sector: "Inversores Solares & Energia Limpa",
      share: 38,
      valueFob: totalValueFob * 0.38,
      mission: "Missão 5: Bioeconomia & Transição",
    },
    {
      sector: "Automação & Eletroeletrônica",
      share: 34,
      valueFob: totalValueFob * 0.34,
      mission: "Missão 4: Transformação Digital",
    },
    {
      sector: "Sistemas Automotivos & Mobilidade",
      share: 28,
      valueFob: totalValueFob * 0.28,
      mission: "Missão 3: Mobilidade Sustentável",
    },
  ];

  return {
    origins: isSemiconductor
      ? semiconductorOrigins
      : [
          {
            supplier: supplierIsAudited
              ? "Outras Origens"
              : supplier,
            share: supplierShare || 100,
            valueFob: totalValueFob * (supplierShare ? supplierShare / 100 : 1),
            detail: supplierIsAudited
              ? "Origem principal em validação técnica no recorte executivo."
              : "Origem líder calculada a partir do fluxo comercial observado.",
          },
        ],
    destinations: isSemiconductor
      ? semiconductorDestinations
      : [
          {
            sector: "Capacidade produtiva nacional",
            share: 100,
            valueFob: totalValueFob,
            mission: "Mapeamento NIB por cadeia prioritária",
          },
        ],
    product: isSemiconductor
      ? "Semicondutores e Wafers de Processamento"
      : executiveConceptualProductName(product.produto_nome, {
          chain: chainLabel(product.cadeia_prioritaria),
          stage: stageLabel(product.chain_stage),
        }),
    concept: isSemiconductor
      ? "Eletrônicos & Hardware de Transição"
      : `${chainLabel(product.cadeia_prioritaria)} / ${stageLabel(product.chain_stage)}`,
    technicalDescription: isSemiconductor
      ? "Circuitos integrados eletrônicos, processadores e chipsets"
      : product.produto_nome,
    destination: isSemiconductor
      ? "Missão 4 NIB: Edital FINEP/BNDES de subvenção para fortalecimento de Design Houses e Packaging nacional."
      : "Adensamento produtivo nacional orientado por exposição comercial, HHI e capacidade doméstica.",
    destinationLabel: isSemiconductor
      ? "Montagem, Design Houses e Packaging"
      : "Capacidade produtiva nacional",
    totalValueFob,
    riskLevel,
    riskSummary:
      riskLevel === "Crítico"
        ? "Alta exposição externa ou concentração de origem exige priorização executiva."
        : "Fluxo relevante para monitoramento e comparação entre cadeias prioritárias.",
    concentrationNote: isSemiconductor
      ? "82,5% concentrado em Taiwan e China"
      : undefined,
  };
}

function buildExecutiveMetadata(
  metadata?: ApiResponse["metadata"],
  selectedChain?: string | null,
  solar?: SolarSovereigntyResponse,
): ExecutiveMetadata {
  const hasSectorEvidence = Boolean(solar?.inputs.length);
  const productionCoverage = solar?.inputs.filter(
    (input) => input.domestic_production_value_brl !== null,
  ).length ?? 0;
  const proxyCount = solar?.inputs.filter(
    (input) => input.measurement_method === "estimated",
  ).length ?? 0;

  return {
    sources: [
      { name: "Comex Stat", scope: "fluxos FOB de importação e exportação" },
      { name: "IBGE PIA-Produto", scope: "capacidade produtiva doméstica quando publicada" },
      { name: "MTE RAIS", scope: "estrutura setorial e emprego formal" },
      ...(solar?.global_concentration_source ? [{ name: solar.global_concentration_source.institution, scope: `${solar.global_concentration_source.publication} · concentração global especializada` }] : []),
      ...(solar?.complementary_sources ?? []).map((source) => ({ name: source.source, scope: `${source.scope} · ${source.status === "required" ? "integração requerida" : source.status === "published" ? "publicada" : "fonte complementar"}` })),
    ],
    comexPeriod: "Jan-Jun 2026",
    productionPeriod: "2024",
    laborPeriod: "2024",
    quality: [
      {
        variable: "Comércio exterior",
        confidence: "Alta",
        note: "valores FOB consolidados no pipeline oficial",
      },
      {
        variable: "Capacidade produtiva",
        confidence: "Média",
        note: hasSectorEvidence
          ? `${productionCoverage} de ${solar?.inputs.length ?? 0} insumos com produção PIA comparável; demais itens não recebem capacidade artificial`
          : "ponte produto-setor depende da granularidade publicada",
      },
      {
        variable: "Origem e HHI",
        confidence: hasSectorEvidence ? "Alta" : metadata?.source === "dashboard_data" ? "Em auditoria" : "Média",
        note: hasSectorEvidence
          ? "fornecedores e HHI calculados no Comex Stat para cada cesta NCM; aderência exclusiva ao uso setorial depende do status validada/proxy"
          : "campos territoriais finos permanecem em homologação quando não publicados na base consolidada",
      },
    ],
    methodologyNotes: [
      hasSectorEvidence
        ? `Cadeia ${selectedChain ?? solar?.chain_name}: ${solar?.inputs.length ?? 0} insumos comerciais publicados, ${proxyCount} por proxy e metodologia ${solar?.methodology_version ?? "versionada"}.`
        : metadata?.warning ?? "A leitura executiva cruza exposição comercial, dependência externa, concentração e capacidade nacional.",
      hasSectorEvidence
        ? `Emprego: RAIS ${solar?.green_jobs.reference_year ?? 2024} cruzada com atividades associadas à TSB; vínculos ponderados são proxy, não certificação individual de emprego verde.`
        : "Fornecedor principal, mapa mundial e HHI dependem da granularidade territorial publicada.",
      "Códigos tarifários e setoriais ficam restritos à gaveta de rastreabilidade.",
      "Cards executivos priorizam os maiores itens do recorte; KPIs e gráficos agregados preservam o universo filtrado completo.",
      ...(solar?.global_concentration_source?.note ? [solar.global_concentration_source.note] : []),
    ],
  };
}

function hhiRiskLabel(hhi: number) {
  if (hhi >= 9000) return "Monopólio quase absoluto";
  if (hhi >= 2500) return "Alta concentração";
  if (hhi >= 1800) return "Concentração moderada";
  return "Mercado menos concentrado";
}

function recommendedPolicy(product: ConceptualProduct, dependency: number, hhi: number) {
  const context = `${product.name} ${product.chain} ${product.productionStage}`.toLowerCase();

  if (/g[aá]s natural/.test(context)) {
    return "Trava climática NIB: substituir progressivamente o gás fóssil por biometano e, nas rotas químicas, hidrogênio renovável e amônia verde; não recomendar expansão fóssil automática";
  }
  if (/petr[oó]leo|petroqu[ií]m|nafta|carv[aã]o mineral|coque f[oó]ssil/.test(context)) {
    return "Trava climática NIB: priorizar substituição por matérias-primas renováveis, circularidade, eletrificação e rotas industriais de baixo carbono";
  }

  if (/fotovolta|painel solar|m[oó]dulo solar|c[eé]lula solar|sil[ií]cio|polissil|wafer/.test(context)) {
    return "Missão 5 NIB: atração e expansão de capacidade nacional em células e componentes fotovoltaicos, com diversificação de fornecedores, transferência tecnológica e conteúdo local competitivo";
  }

  if (/qu[ií]mic|bioprocess|agro|transi|combust/i.test(context)) {
    return "Missão 1 NIB: edital BNDES/FINEP de subvenção e crédito para instalação de planta química fina nacional";
  }

  if (dependency >= 75 && hhi >= 2500) return "Missão 1 NIB: chamada pública BNDES/FINEP para diversificação de origem e atração de capacidade produtiva doméstica";
  if (dependency >= 75) return "Missão 1 NIB: programa de adensamento produtivo para reduzir dependência externa do insumo";
  if (hhi >= 2500) return "Monitoramento executivo com plano de alternativas de suprimento e validação técnica contínua";
  return "Monitoramento executivo com validação técnica contínua";
}

function executiveAlertChain(product: ConceptualProduct) {
  const context = `${product.name} ${product.chain}`.toLowerCase();
  if (/fotovolta|painel solar|m[oó]dulo solar|c[eé]lula solar|sil[ií]cio|polissil|wafer/.test(context)) {
    return "Sistema solar fotovoltaico";
  }
  return product.chain;
}

function executiveSupplierName(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /json/i.test(trimmed) || /^piloto/i.test(trimmed)) return "Em auditoria";
  return trimmed;
}

function executiveConceptualProductName(
  name: string,
  context: { chain?: string; stage?: string } = {},
) {
  const normalized = name.trim();
  const contextText = `${context.chain ?? ""} ${context.stage ?? ""}`.toLowerCase();

  if (/compostos\s+heteroc[ií]clicos/i.test(normalized)) {
    return "Intermediários Químicos para Bioprocessos e Agroquímica";
  }

  if (/\bn\.e\.?$/i.test(normalized) && /qu[ií]mic|bioprocess|agro|transi/.test(contextText)) {
    return "Intermediários Químicos Estratégicos";
  }

  return normalized;
}

function chainLabel(chain: ProdutoConceitual["cadeia_prioritaria"]) {
  const labels: Record<ProdutoConceitual["cadeia_prioritaria"], string> = {
    fertilizantes: "Fertilizantes",
    combustiveis_transicao: "Combustíveis de transição",
    aco: "Aço",
    silicio: "Silício",
  };
  return labels[chain];
}

function stageLabel(stage: ProdutoConceitual["chain_stage"]) {
  const labels: Record<ProdutoConceitual["chain_stage"], string> = {
    insumo: "Insumo",
    processamento: "Processamento",
    produto_final: "Produto final",
    equipamento: "Equipamento",
  };
  return labels[stage];
}

