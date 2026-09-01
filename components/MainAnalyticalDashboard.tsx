"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  Award,
  CheckCircle2,
  ChevronDown,
  Compass,
  Factory,
  Globe2,
  LineChart,
  Network,
  RefreshCw,
  Scale,
  ShieldAlert,
  Users,
} from "lucide-react";
import { type AipnetFlow } from "./AipnetFlowChart";
import { AipnetSystemsFlow } from "./AipnetSystemsFlow";
import type { AipnetAnalysisFocus } from "./AipnetSystemsFlow";
import { CarbonFootprintIndustrialBlock } from "./CarbonFootprintIndustrialBlock";
import { ChainAnalysesMap, type ChainAnalysesMapItem } from "./ChainAnalysesMap";
import { ChainSelectionLanding } from "./ChainSelectionLanding";
import { ExecutiveMainHero, type ExecutiveMainKpi, type ExecutiveTopAlert } from "./ExecutiveMainHero";
import { ExecutiveMetadataFooter, type ExecutiveMetadata } from "./ExecutiveMetadataFooter";
import { HeaderTopBar } from "./HeaderTopBar";
import { SiliconStrategicLevers } from "./SiliconStrategicLevers";
import { EnergyContextBenPanel } from "./EnergyContextBenPanel";
import { SiliconMassEnergyBalancePanel, MASS_ENERGY_BALANCE_CHAINS } from "./SiliconMassEnergyBalancePanel";
import { GreenJobsTSBPanel } from "./GreenJobsTSBPanel";
import { NIBMatrixChart } from "./NIBMatrixChart";
import { ProportionalityToggle } from "./ProportionalityToggle";
import { SovereigntySankeyChart, SAMPLE_SHIPMENT_THRESHOLD_USD } from "./SovereigntySankeyChart";
import { TechnicalDrawer } from "./TechnicalDrawer";
import { VulnerabilityChart as ExecutiveVulnerabilityChart, type ProductVulnerability, type SovereigntyCoverageGroup } from "./VulnerabilityChart";
import { useBorderValue } from "../hooks/useBorderValue";
import { useEnergyContext } from "../hooks/useEnergyContext";
import { useSolarSovereignty } from "../hooks/useSolarSovereignty";
import { apiRoutes } from "../lib/apiRoutes";
import { chainCatalog } from "../lib/chainCatalog";
import { MONITORED_CHAINS } from "../lib/transversalMatrix";
import { buildValueAsymmetry } from "../lib/valueAsymmetry";
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

// Same format as SiliconStrategicLevers.tsx's usdPerKg -- not imported from
// there since that module doesn't export it, and duplicating one Intl
// formatter is cheaper than adding a new export just for this.
const usdPerKg = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Intl.NumberFormat's compact notation formats exactly zero differently
// across JS engines -- confirmed live: Node (the actual SSR runtime here)
// renders money.format(0) as "US$ 0,0", Chrome/V8 (the client) renders it
// as "US$ 0". Both agree on every non-zero value tested. That mismatch
// between the server-rendered HTML and the first client render is exactly
// what triggers a React hydration warning, so any money value that can
// legitimately be exactly 0 on first render (e.g. headerDeficitLabel below,
// before chain data has loaded) needs to bypass compact notation for that
// one value rather than go through the engine-dependent formatter.
const formatMoneyCompact = (value: number) => (value === 0 ? "US$ 0" : money.format(value));

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const glass = "border border-white/[0.08] bg-zinc-900/40 shadow-2xl backdrop-blur-xl";

export default function MainAnalyticalDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedChain = searchParams.get("chain")?.trim() || null;
  const selectedChainMetadata = chainCatalog.find((chain) => chain.id === selectedChain);
  // IA-overload pilot (see components/MainAnalyticalDashboard.tsx history):
  // validated on Aço, then Silício, now rolled out to all 4 published
  // chains. Kept as an explicit, named flag (rather than inlining
  // Boolean(selectedChain) at every call site) so every branch it gates
  // stays easy to find and, if ever needed, partially roll back.
  const isIaPilotChain = selectedChain === "aco" || selectedChain === "silicio" || selectedChain === "fertilizantes" || selectedChain === "combustiveis_transicao";
  const [data, setData] = useState<ApiResponse>(emptyResponse);
  const [status, setStatus] = useState<ViewState>("loading");
  const [error, setError] = useState("");
  const [chainAnalysisFocus, setChainAnalysisFocus] = useState<{ stage: string; input?: string } | null>(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [readingMode, setReadingMode] = useState<ReadingMode>(isIaPilotChain ? "guided" : "analytical");
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

  // "Trocar cadeia" navigates client-side without remounting this component,
  // so the readingMode useState default above only applies on first load --
  // without this, switching chains carries whichever mode you were in on
  // the *previous* chain (e.g. leaving Aço in "guided" would wrongly hide
  // Silício's Macro-módulo 2, which still expects "analytical" by default).
  // Only resets on an actual chain change, so it never fights a manual
  // toggle click within the same chain.
  const previousChainRef = useRef(selectedChain);
  useEffect(() => {
    if (previousChainRef.current === selectedChain) return;
    previousChainRef.current = selectedChain;
    setReadingMode(isIaPilotChain ? "guided" : "analytical");
  }, [selectedChain, isIaPilotChain]);

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

  // /tour-soberania pins ?chain=aco via its own EnsureTourChain effect (the
  // guided tour only covers the aço chain so far -- generalizing it is
  // future work). Pushing a different chain to that same pathname just gets
  // immediately reverted by that effect, so "Trocar cadeia" silently no-ops
  // there. Route those switches to the unlocked general dashboard ("/")
  // instead; on any other page this is a no-op (target === pathname).
  const chainSwitchTarget = pathname === "/tour-soberania" ? "/" : pathname;

  const handleChainSelect = useCallback((chainId: string) => {
    setChainAnalysisFocus(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("chain", chainId);
    router.push(`${chainSwitchTarget}?${params.toString()}`, { scroll: false });
  }, [chainSwitchTarget, router, searchParams]);

  const handleClearChain = useCallback(() => {
    setChainAnalysisFocus(null);
    router.push(chainSwitchTarget, { scroll: false });
  }, [chainSwitchTarget, router]);

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

  // Powers the "Mapa de análises" nav (IA-overload pilot, Aço only): jumps to
  // any section by id, force-opening its <details> the same way
  // SovereigntyTour already does (components/SovereigntyTour.tsx) -- reusing
  // that proven lookup instead of wiring a new ref per collapsible panel.
  const handleJumpToSection = useCallback((sectionId: string, requiresAnalytical: boolean) => {
    const jump = () => {
      const target = document.getElementById(sectionId);
      if (!target) return;
      const detailsTarget = target.closest("details") ?? target.querySelector("details");
      if (detailsTarget instanceof HTMLDetailsElement && !detailsTarget.open) {
        detailsTarget.open = true;
      }
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (requiresAnalytical && readingMode !== "analytical") {
      setReadingMode("analytical");
      setModeFeedback("Análises avançadas exibidas para abrir a seção selecionada.");
      window.setTimeout(jump, 120);
    } else {
      jump();
    }
  }, [readingMode]);

  const metrics = useMemo(() => {
    const totalImports = data.kpis?.totalImports ?? data.products.reduce((acc, item) => acc + item.metrics.imports, 0);
    const totalExports = data.kpis?.totalExports ?? data.products.reduce((acc, item) => acc + item.metrics.exports, 0);
    const avgDependency = data.kpis?.avgDependency ?? (data.products.length
      ? data.products.reduce((acc, item) => acc + item.metrics.externalDependency, 0) / data.products.length
      : 0);
    // Picking by raw HHI alone surfaces thin-flow noise as a false "monopólio"
    // alert: e.g. minério de ferro (Brazil's #1 export, 0% external
    // dependency) can score hhi≈9976 purely from a handful of import
    // transactions worth a few million dollars against an $11bi+ export
    // base -- a concentration number with no bearing on actual supply risk.
    // Weighting by dependency (same formula topRisk already uses below)
    // keeps this KPI about real import vulnerability, not export dominance.
    // A materiality floor is also needed on top of the weighting: e.g. ferro-
    // esponja/tubos de aço can show 100% dependency purely because their
    // import base is a handful of thousand dollars with no domestic
    // production data point to divide by -- not a meaningful signal. Falls
    // back to the unfiltered list if every product is below the floor
    // (small chains) rather than picking nothing.
    const materialProducts = data.products.filter((item) => item.metrics.imports >= SAMPLE_SHIPMENT_THRESHOLD_USD);
    const hhiCandidates = materialProducts.length ? materialProducts : data.products;
    const maxHhiProduct = hhiCandidates.reduce<ConceptualProduct | undefined>(
      (best, item) => {
        const itemScore = item.metrics.externalDependency * item.metrics.hhi;
        const bestScore = best ? best.metrics.externalDependency * best.metrics.hhi : -1;
        return !best || itemScore > bestScore ? item : best;
      },
      undefined,
    );
    const maxHhi = data.kpis?.maxHhi ?? maxHhiProduct?.metrics.hhi ?? 0;
    const maxHhiProductName = maxHhiProduct?.name.split("(")[0].trim();
    const topRisk = [...hhiCandidates].sort(
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
  const executiveHeroKpis = useMemo(() => {
    const allKpis = buildExecutiveHeroKpis(metrics);
    // IA-overload pilot (Aço only): Dependência Média and Concentração
    // Máxima move next to the Vulnerability chart below instead of
    // competing for attention in the always-visible Hero -- see the stats
    // row rendered above ExecutiveVulnerabilityChart.
    return isIaPilotChain ? allKpis.slice(0, 2) : allKpis;
  }, [isIaPilotChain, metrics]);
  // IA-overload pilot (Aço only): powers the "Resumo executivo" key-message
  // strip -- the input with the largest trade surplus, standing in for
  // "onde o Brasil já lidera" (e.g. minério de ferro).
  const sovereigntyLeaderInput = useMemo(() => {
    if (!isIaPilotChain || !solarSovereignty?.inputs.length) return undefined;
    return [...solarSovereignty.inputs].sort((left, right) => right.trade_balance_usd - left.trade_balance_usd)[0];
  }, [isIaPilotChain, solarSovereignty]);
  const executiveVulnerabilityData = useMemo(
    () => buildExecutiveVulnerabilityData(data.products, selectedChain, solarSovereignty?.inputs),
    [data.products, selectedChain, solarSovereignty?.inputs],
  );
  // IA-overload pilot: "Dependência média" and "Concentração máxima" need to
  // agree with the bars right below them -- metrics.avgDependency/maxHhi are
  // computed from data.products (the broader, uncurated conceptual-products
  // catalog), a different universe than the 16 curated inputs the chart
  // actually renders when solarSovereignty is available. Deriving both stats
  // from executiveVulnerabilityData instead means they can never again cite
  // an item (e.g. "Escadas de ferro e aço") that isn't even one of the bars.
  const curatedVulnerabilityStats = useMemo(() => {
    if (!isIaPilotChain || !executiveVulnerabilityData.length) return undefined;
    const avgDependency = executiveVulnerabilityData.reduce((sum, item) => sum + item.dependency, 0) / executiveVulnerabilityData.length;
    // Same materiality floor as the dependency fix above, applied to HHI:
    // an import base under SAMPLE_SHIPMENT_THRESHOLD_USD can swing supplier
    // concentration to a "perfect monopoly" 10.000 on one or two shipments
    // (e.g. ferro-níquel: US$2.624 imported against a US$655mi export
    // surplus) -- real for that tiny sliver, meaningless as "the chain's
    // most concentrated input." Excluded from the contest, not zeroed, so a
    // genuinely material item never loses to one that only looks extreme
    // because almost nothing was imported.
    const materialCandidates = executiveVulnerabilityData.filter(
      (item) => (item.importsValueUsd ?? 0) >= SAMPLE_SHIPMENT_THRESHOLD_USD,
    );
    const maxHhiItem = (materialCandidates.length ? materialCandidates : executiveVulnerabilityData)
      .reduce((best, item) => (item.hhi > best.hhi ? item : best));
    return {
      avgDependency,
      maxHhi: maxHhiItem.hhi,
      maxHhiProductName: maxHhiItem.executiveName ?? maxHhiItem.name,
    };
  }, [executiveVulnerabilityData, isIaPilotChain]);
  const chainValueAsymmetry = useMemo(
    () => selectedChain && solarSovereignty?.inputs.length
      ? buildValueAsymmetry(selectedChain, solarSovereignty.inputs)
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
    // external_dependency is a trade-balance ratio (imports / apparent consumption) and can
    // exceed 1 when apparent consumption is deflated by exports (e.g. re-export dynamics) --
    // clamp to [0,1] here the same way every other consumer of this field already does,
    // so neither the ranking score nor the displayed percentage shows a nonsensical >100% value.
    const clampedDependency = (input: (typeof inputs)[number]) =>
      Math.min(1, Math.max(0, input.external_dependency ?? input.global_china_share ?? 0));
    // external_dependency is derived from Brazil's own trade sample and can
    // be a near-meaningless extreme when that sample is tiny (e.g. ferro-
    // esponja's 83.5% "China share" comes from a $3,559 total import base
    // for the half-year); global_china_share is a structural figure that
    // doesn't have this problem, so only gate the former behind the floor.
    return [...inputs]
      .filter((input) => input.external_dependency === null || input.imports_value_usd >= SAMPLE_SHIPMENT_THRESHOLD_USD)
      .sort((left, right) => {
        const leftScore = clampedDependency(left) * Math.max(left.supplier_hhi_brazil, 1);
        const rightScore = clampedDependency(right) * Math.max(right.supplier_hhi_brazil, 1);
        return rightScore - leftScore;
      })
      .slice(0, 6)
      .map((input) => ({
        id: input.input_id,
        code: input.ncm_codes[0] ?? "s/ NCM",
        label: input.label,
        riskLabel: `${formatPercentOneDecimal(clampedDependency(input) * 100)} dependência · HHI ${number.format(input.supplier_hhi_brazil)}`,
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
  const headerDeficitRaw = selectedChain
    ? metrics.totalImports - metrics.totalExports
    : globalSummary?.deficit;
  const headerDeficitIsSurplus = headerDeficitRaw !== undefined && headerDeficitRaw < 0;
  const headerDeficitLabel = headerDeficitRaw !== undefined ? formatMoneyCompact(Math.abs(headerDeficitRaw)) : undefined;
  const canExportChain = Boolean(selectedChain) && nibMatrixProducts.length > 0;

  // Entries mirror exactly the sections SovereigntyTour already knows how to
  // target (components/SovereigntyTour.tsx) and the same conditions that
  // decide whether each section renders below -- so the map never links to
  // something that doesn't actually exist for this chain/data state.
  const analysesMapItems = useMemo<ChainAnalysesMapItem[]>(() => {
    if (!isIaPilotChain) return [];
    const items: ChainAnalysesMapItem[] = [
      {
        id: "tour-hero",
        label: "Resumo executivo",
        description: "A cadeia inteira em poucos números: maior gargalo, onde o Brasil lidera e o veredito geral de risco.",
        kind: "essencial",
        group: "modulo1",
      },
    ];
    if (solarSovereignty?.inputs.length) {
      items.push({
        id: "tour-powershoring",
        label: "Powershoring & regulação",
        description: "Assimetria de valor entre o que a cadeia exporta e reimporta, regime regulatório e prêmio de descarbonização.",
        kind: "aprofundamento",
        group: "modulo1",
      });
    }
    items.push(
      {
        id: "tour-aipnet-backbone",
        label: "Espinha dorsal da cadeia",
        description: "O fluxo completo, etapa a etapa -- da matéria-prima ao produto final -- com onde o Brasil já lidera e onde ainda depende de importação.",
        kind: "aprofundamento",
        group: "modulo1",
      },
      {
        id: "tour-sankey",
        label: "Fluxo de soberania (rede)",
        description: "Rede de fornecedores por produto: para onde vai o valor importado e o quanto está concentrado geograficamente.",
        kind: "aprofundamento",
        group: "modulo1",
      },
      {
        id: "tour-vulnerability",
        label: "Diagnóstico de vulnerabilidade",
        description: "Dependência externa de cada insumo mapeado, lado a lado, com o limiar de risco crítico (75%) marcado.",
        kind: "essencial",
        group: "modulo1",
      },
    );
    if (nibMatrixProducts.length) {
      items.push({
        id: "tour-nib-matrix",
        label: "Matriz de priorização NIB",
        description: "Cruza dependência externa com capacidade doméstica para indicar se a política industrial deve monitorar, modernizar ou expandir cada insumo.",
        kind: "aprofundamento",
        requiresAnalytical: true,
        group: "modulo2",
      });
    }
    if (selectedChain && MASS_ENERGY_BALANCE_CHAINS.has(selectedChain)) {
      items.push({
        id: "tour-mass-energy",
        label: "Balanço de massa e energia",
        description: "Intensidade energética e concentração global de produção, etapa a etapa da rota produtiva.",
        kind: "aprofundamento",
        requiresAnalytical: true,
        group: "modulo2",
      });
    }
    if (solarSovereignty?.inputs.length) {
      items.push({
        id: "tour-carbon",
        label: "Exposição de carbono",
        description: "Quanto da pauta importada vem de rota fóssil, cruzado com o quão renovável já é a matriz elétrica nacional.",
        kind: "aprofundamento",
        requiresAnalytical: true,
        group: "modulo2",
      });
    }
    if (solarSovereignty?.green_jobs) {
      items.push({
        id: "tour-green-jobs",
        label: "Empregos verdes",
        description: "Vínculos formais (RAIS) em atividades da cadeia associadas à Taxonomia Sustentável Brasileira.",
        kind: "aprofundamento",
        requiresAnalytical: true,
        group: "modulo2",
      });
    }
    if (premiumProducts.length) {
      items.push({
        id: "tour-technical-drawer",
        label: "Dados primários (NCM/CNAE)",
        description: "Rastreabilidade completa: cruzamentos de NCM, CNAE e PRODLIST por produto, com ressalvas metodológicas.",
        kind: "aprofundamento",
        group: "modulo3",
      });
    }
    return items;
  }, [isIaPilotChain, nibMatrixProducts.length, premiumProducts.length, selectedChain, solarSovereignty?.green_jobs, solarSovereignty?.inputs.length]);

  // Lets an external link (e.g. PowershoringShowcase's "Ver cadeia completa")
  // land directly on a section instead of the generic hero -- native browser
  // hash-scroll can't work here since the target section only exists in the
  // DOM once solarSovereignty finishes loading. Fires once per navigation.
  const hashJumpDoneRef = useRef(false);
  useEffect(() => {
    if (hashJumpDoneRef.current || status !== "ready") return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    hashJumpDoneRef.current = true;
    const item = analysesMapItems.find((entry) => entry.id === hash);
    // Re-issued a few times over ~1.2s: switching reading mode and/or opening
    // the target <details> can push layout further (charts and analytical
    // panels still mounting), which a single scrollIntoView right after
    // navigation can't account for since it fires before that settles.
    [150, 400, 800, 1200].forEach((delay) => {
      window.setTimeout(() => {
        if (delay === 150) {
          handleJumpToSection(hash, Boolean(item?.requiresAnalytical));
        } else {
          document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, delay);
    });
  }, [status, analysesMapItems, handleJumpToSection]);

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
        deficitIsSurplus={headerDeficitIsSurplus}
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
        <aside className="sticky top-[calc(9.5rem+var(--eplus-shell-h))] z-40 -my-4 flex flex-col gap-2 rounded-xl border border-cyan-300/20 bg-zinc-950/90 px-3 py-2.5 shadow-2xl backdrop-blur-xl md:top-[calc(4.75rem+var(--eplus-shell-h))]" aria-label="Profundidade da análise">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Profundidade</span>
              <button type="button" aria-pressed={readingMode === "guided"} title="Cadeia produtiva e diagnóstico essencial" onClick={() => handleReadingModeChange("guided")} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${readingMode === "guided" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"}`}>Visão executiva</button>
              <button type="button" aria-pressed={readingMode === "analytical"} title="Mantém a cadeia e acrescenta fluxos, NIB e empregos verdes" onClick={() => handleReadingModeChange("analytical")} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${readingMode === "analytical" ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"}`}>Análises avançadas</button>
            </div>
            <p aria-live="polite" className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-cyan-300" /> {modeFeedback}
            </p>
          </div>
          {isIaPilotChain ? (
            <ChainAnalysesMap
              items={analysesMapItems}
              onSelect={handleJumpToSection}
            />
          ) : null}
        </aside>
        <StateShell status={status} error={error} onRetry={loadData}>
          <div id="tour-hero" ref={overviewRef} className="scroll-mt-[calc(10rem+var(--eplus-shell-h))] md:scroll-mt-[calc(8rem+var(--eplus-shell-h))] space-y-4">
            <ExecutiveMainHero
              alert={executiveHeroAlert}
              kpis={isIaPilotChain ? [] : executiveHeroKpis}
              strategicQuestion={chainStrategicQuestion(selectedChain)}
              beforeAlert={
                isIaPilotChain && executiveHeroAlert && sovereigntyLeaderInput ? (
                  <div className="rounded-2xl border border-white/15 bg-zinc-900/40 p-5 shadow-xl backdrop-blur-xl" aria-label="Resumo executivo">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                      <Compass className="h-3.5 w-3.5" />
                      Resumo executivo
                    </span>
                    {chainScopeSummary(selectedChain) ? (
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                        {chainScopeSummary(selectedChain)}
                      </p>
                    ) : null}
                    {/* "Maior gargalo" deliberately left out -- the alert card
                        right below already tells that exact story (same
                        product, same numbers) in full depth. Repeating it
                        here as a one-line summary read as pure duplication
                        rather than a preview. */}
                    {/* One unified grid for all summary cards -- previously
                        split into a 4-col row (stats) and a separate 2-col
                        row (teasers) below a divider, which gave the two
                        rows different individual card widths (321px vs
                        654px) even though each row was internally symmetric.
                        A single grid-cols-3 keeps every card, across both
                        rows, exactly the same size. */}
                    {/* Reading order follows column position, not just list
                        order: with grid-cols-3 filling row-major, item N and
                        N+3 land in the same column. Row 1 leads with the
                        strategic verdicts (where Brazil leads, overall risk)
                        before the raw financial totals; Importações/
                        Exportações both land in column 3 (positions 3 and 6)
                        so the two trade totals still stack in the same
                        column even though they're no longer first. */}
                    {/* Single visual language for all 6 cards -- previously
                        emerald/cyan/amber/neutral mixed with no semantic
                        meaning behind the color choice (e.g. "Veredito
                        geral" reporting good news was cyan, not green; the
                        neutral-vs-tinted split didn't track anything either).
                        One neutral frame, one accent (cyan, matching the
                        section's own eyebrow above) for every icon/label. */}
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                          <Award className="h-3.5 w-3.5" />
                          {sovereigntyLeaderInput.trade_balance_usd > 0 ? "Onde o Brasil lidera" : "Menor exposição da cadeia"}
                        </span>
                        {/* Some chains (e.g. fertilizantes: all 17 mapped
                            inputs run a deficit) have no genuine export
                            leader -- claiming "soberania plena, superávit"
                            for the least-bad item would just be wrong.
                            Reframe as "smallest gap" instead of hiding the
                            card (which would break the 6-card grid). */}
                        <p className="mt-2 text-sm leading-snug text-zinc-200">
                          {sovereigntyLeaderInput.trade_balance_usd > 0 ? (
                            <>
                              <strong className="font-semibold text-white">{sovereigntyLeaderInput.label}</strong> — soberania plena, superávit de {formatMoneyCompact(sovereigntyLeaderInput.trade_balance_usd)}.
                            </>
                          ) : (
                            <>
                              <strong className="font-semibold text-white">{sovereigntyLeaderInput.label}</strong> — menor déficit da cadeia ({formatMoneyCompact(Math.abs(sovereigntyLeaderInput.trade_balance_usd))}); nenhum insumo mapeado tem saldo positivo hoje.
                            </>
                          )}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Veredito geral
                        </span>
                        <p className="mt-2 text-sm leading-snug text-zinc-200">
                          <strong className="font-semibold text-white">{headerAlertCount ?? 0} de {solarSovereignty?.inputs.length}</strong> insumos mapeados cruzam hoje o limiar real de dependência crítica (75%).
                        </p>
                      </div>
                      {executiveHeroKpis[0] ? (
                        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">{executiveHeroKpis[0].label}</span>
                          <div className="mt-1 font-mono text-2xl font-extrabold text-zinc-100">{executiveHeroKpis[0].value}</div>
                          <span className="mt-0.5 block text-[11px] text-zinc-400">{executiveHeroKpis[0].note}</span>
                        </div>
                      ) : null}
                      {/* Teaser cards, same compact language as the stat cards
                          above -- the full ValueAsymmetryCard (pills + NCM
                          footnote + collapsible detail) stays in the
                          Powershoring panel itself. */}
                      {chainValueAsymmetry ? (
                        <button
                          type="button"
                          onClick={() => handleJumpToSection("tour-powershoring", false)}
                          className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-400/10"
                        >
                          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                            <Scale className="h-3.5 w-3.5" /> Assimetria de valor por quilo
                          </span>
                          <p className="mt-2 text-2xl font-extrabold text-white">
                            {chainValueAsymmetry.ratio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x
                          </p>
                          <p className="mt-1 text-[11px] leading-snug text-zinc-400">
                            Exporta {chainValueAsymmetry.exportInputLabel} · {usdPerKg.format(chainValueAsymmetry.exportPricePerKg)}/kg — Reimporta {chainValueAsymmetry.importInputLabel} · {usdPerKg.format(chainValueAsymmetry.importPricePerKg)}/kg
                          </p>
                        </button>
                      ) : null}
                      {solarSovereignty.green_jobs ? (
                        <button
                          type="button"
                          onClick={() => handleJumpToSection("tour-green-jobs", true)}
                          className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-400/10"
                        >
                          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                            <Users className="h-3.5 w-3.5" /> Empregos verdes
                          </span>
                          <p className="mt-2 text-2xl font-extrabold text-white">
                            {number.format(solarSovereignty.green_jobs.formal_jobs_in_tsb_activities)}
                          </p>
                          <p className="mt-1 text-[11px] leading-snug text-zinc-400">vínculos formais RAIS na cadeia</p>
                        </button>
                      ) : null}
                      {executiveHeroKpis[1] ? (
                        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">{executiveHeroKpis[1].label}</span>
                          <div className="mt-1 font-mono text-2xl font-extrabold text-zinc-100">{executiveHeroKpis[1].value}</div>
                          <span className="mt-0.5 block text-[11px] text-zinc-400">{executiveHeroKpis[1].note}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : undefined
              }
            />
            {solarSovereignty?.inputs.length ? (
              <div id="tour-powershoring" className="scroll-mt-[calc(10rem+var(--eplus-shell-h))] md:scroll-mt-[calc(8rem+var(--eplus-shell-h))]">
                {isIaPilotChain ? (
                  <ExpandableAnalyticsPanel
                    eyebrow="Powershoring & regulação"
                    title="Alavancas estratégicas da cadeia"
                    subtitle="Assimetria de valor exportado/reimportado, contexto regulatório e prêmio de descarbonização — aprofundamento opcional"
                  >
                    <SiliconStrategicLevers
                      chainId={selectedChain}
                      valueAsymmetry={chainValueAsymmetry}
                      solarInputs={solarSovereignty.inputs}
                    />
                  </ExpandableAnalyticsPanel>
                ) : (
                  <SiliconStrategicLevers
                    chainId={selectedChain}
                    valueAsymmetry={chainValueAsymmetry}
                    solarInputs={solarSovereignty.inputs}
                  />
                )}
              </div>
            ) : null}
          </div>

          <div id="tour-aipnet-backbone" className="scroll-mt-[calc(10rem+var(--eplus-shell-h))] md:scroll-mt-[calc(8rem+var(--eplus-shell-h))]">
            {isIaPilotChain ? (
              <ExpandableAnalyticsPanel
                eyebrow="Espinha Dorsal · Geopolítica de estado"
                title="Espinha dorsal de transformação da cadeia"
                subtitle="Etapas produtivas, gargalos e onde o Brasil já lidera — aprofundamento opcional"
              >
                <AipnetSystemsFlow
                  chainId={selectedChain}
                  inputs={solarSovereignty?.inputs}
                  onAnalysisFocus={handleAipnetAnalysisFocus}
                  onViewFlowEvidence={handleViewFlowEvidence}
                />
              </ExpandableAnalyticsPanel>
            ) : (
              <AipnetSystemsFlow
                chainId={selectedChain}
                inputs={solarSovereignty?.inputs}
                onAnalysisFocus={handleAipnetAnalysisFocus}
                onViewFlowEvidence={handleViewFlowEvidence}
              />
            )}
          </div>

          {/* Primary entry panel for the executive read -- was previously
              buried inside the readingMode==="analytical"-gated
              "Aprofundamento analítico" section below, collapsed by
              default, so it needed a mode switch plus a click to even see.
              Moved ahead of the dependency bar chart and opened by
              default; the bar chart is the supporting complement, not the
              lead. */}
          <MacroModuleHeader
            eyebrow="Macro-módulo 1 · ComexStat & PIA"
            title="Diagnóstico de soberania e balança"
            accent="cyan"
          />
          <div id="tour-sankey" ref={sankeyRef} className="scroll-mt-[calc(1.5rem+var(--eplus-shell-h))]">
            <ExpandableAnalyticsPanel eyebrow="Soberania & rede" title="Fluxo de soberania por produto" subtitle="Rede de fornecedores, produto e capacidade nacional" defaultOpen={!isIaPilotChain}>
              <SovereigntySankeyChart
                dado={radarProduct ?? premiumProducts[0]}
                solarInputs={solarSovereignty?.inputs}
                chainName={selectedChainMetadata?.name ?? solarSovereignty?.chain_name}
                height={620}
                title="Fluxo da cadeia por produto conceitual"
                onAnalysisFocus={handleAipnetAnalysisFocus}
              />
            </ExpandableAnalyticsPanel>
          </div>

            <div id="tour-vulnerability" ref={diagnosticRef} className="scroll-mt-[calc(10rem+var(--eplus-shell-h))] md:scroll-mt-[calc(8rem+var(--eplus-shell-h))]">
              <ExpandableAnalyticsPanel
                eyebrow="Balança & dependência"
                title="Diagnóstico de soberania industrial"
                subtitle="Dependência externa crítica, balança comercial e cobertura estrutural da cadeia"
                defaultOpen
              >
                {isIaPilotChain && curatedVulnerabilityStats ? (
                  <div className="mb-4 flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[160px] rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2.5">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Dependência média</span>
                      <span className="mt-1 block font-mono text-lg font-extrabold text-amber-300">{number.format(curatedVulnerabilityStats.avgDependency)}%</span>
                      <span className="block text-[10px] text-zinc-500">Razão importação / consumo aparente, cadeia inteira</span>
                    </div>
                    <div className="flex-1 min-w-[160px] rounded-xl border border-white/10 bg-zinc-950/50 px-3 py-2.5">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Concentração máxima (HHI)</span>
                      <span className="mt-1 block font-mono text-lg font-extrabold text-red-400">{number.format(curatedVulnerabilityStats.maxHhi)}</span>
                      <span className="block truncate text-[10px] text-zinc-500">{curatedVulnerabilityStats.maxHhiProductName}</span>
                    </div>
                  </div>
                ) : null}
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
            <section ref={advancedRef} className="scroll-mt-[calc(10rem+var(--eplus-shell-h))] space-y-5 md:scroll-mt-[calc(8rem+var(--eplus-shell-h))]">
              <MacroModuleHeader
                eyebrow="Macro-módulo 2 · NIB & TSB"
                title="Sustentabilidade e política industrial"
                accent="emerald"
              />

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
                  id="tour-carbon"
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
                <div ref={nibRef} className="scroll-mt-[calc(10rem+var(--eplus-shell-h))] md:scroll-mt-[calc(8rem+var(--eplus-shell-h))]">
                  <ExpandableAnalyticsPanel eyebrow="Política industrial" title="Matriz de priorização NIB" subtitle="Posicionamento estratégico dos produtos da cadeia">
                    <NIBMatrixChart data={nibMatrixProducts} chartAnchorId="tour-nib-matrix" />
                  </ExpandableAnalyticsPanel>
                </div>
              ) : null}

              {solarSovereignty?.green_jobs ? (
                <ExpandableAnalyticsPanel
                  id="tour-green-jobs"
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

              {selectedChain && MASS_ENERGY_BALANCE_CHAINS.has(selectedChain) ? (
                <ExpandableAnalyticsPanel
                  id="tour-mass-energy"
                  eyebrow="Balanço de processo"
                  title="Balanço de massa e energia por etapa"
                  subtitle="Intensidade energética, capacidade nacional e concentração global — etapa a etapa da cadeia"
                >
                  <SiliconMassEnergyBalancePanel chainId={selectedChain} energyContext={energyContext} />
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
            <div id="tour-technical-drawer" className="scroll-mt-[calc(10rem+var(--eplus-shell-h))] space-y-5 pb-32 md:scroll-mt-[calc(8rem+var(--eplus-shell-h))]">
              <MacroModuleHeader
                eyebrow="Macro-módulo 3 · NCM & CNAE"
                title="Dados primários e governança"
                accent="amber"
              />
              <TechnicalDrawer
                data={nibMatrixProducts}
                solarInputs={solarSovereignty?.inputs}
                solarMethodologyVersion={solarSovereignty?.methodology_version}
              />
            </div>
          ) : null}

          <ExecutiveMetadataFooter metadata={executiveMetadata} />
        </StateShell>
      </div>
      )}
    </main>
  );
}

function ExpandableAnalyticsPanel({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details id={id} open={defaultOpen} className="group scroll-mt-[calc(10rem+var(--eplus-shell-h))] rounded-2xl border border-white/[0.08] bg-zinc-900/30 shadow-xl backdrop-blur-xl md:scroll-mt-[calc(8rem+var(--eplus-shell-h))]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</span>
          <span className="mt-1 block text-base font-bold text-white">{title}</span>
          <span className="mt-1 block text-xs font-normal text-zinc-400">{subtitle}</span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/[0.07] p-4 sm:p-5">{children}</div>
    </details>
  );
}

const MACRO_MODULE_ACCENTS = {
  cyan: "border-cyan-300/60 text-cyan-300",
  emerald: "border-emerald-300/60 text-emerald-300",
  amber: "border-amber-300/60 text-amber-300",
} as const;

function MacroModuleHeader({
  eyebrow,
  title,
  accent,
}: {
  eyebrow: string;
  title: string;
  accent: keyof typeof MACRO_MODULE_ACCENTS;
}) {
  const [borderColor, textColor] = MACRO_MODULE_ACCENTS[accent].split(" ");
  return (
    <div className={`border-l-2 ${borderColor} pl-4`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${textColor}`}>{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h2>
    </div>
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
    steel_inputs_br: "Minério de ferro e carvão mineral",
    steel_scrap_br: "Sucata ferrosa",
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
      strategic_profile: input.strategic_profile,
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
        fonte_proxy: mappingStatus === "proxy" ? "Cesta da cadeia de produto relacionado" : "Cesta NCM validada",
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

// external_dependency (imports / apparent consumption) can exceed 1 when
// apparent consumption is deflated by exports -- for heavily export-dominant
// inputs, exports can almost exactly offset production+imports, collapsing
// the denominator near zero and sending the ratio to absurd multiples (e.g.
// ferroligas hit 354x). Clamp to [0,1] the same way headerNcmShortcuts above
// already does, so a broken denominator can't outscore a genuinely critical,
// high-HHI item just by being numerically huge.
function clampedSectorDependency(input: SolarInputMetric): number {
  return Math.min(1, Math.max(0, input.external_dependency ?? 0));
}

function buildSectorExecutiveHeroAlert(
  inputs: SolarInputMetric[],
  chainName: string,
): ExecutiveTopAlert | undefined {
  const candidates = inputs.filter((input) => (
    input.imports_value_usd > 0
    && input.external_dependency !== null
    && input.imports_value_usd >= SAMPLE_SHIPMENT_THRESHOLD_USD
  ));

  const input = [...candidates].sort((left, right) => {
    const leftScore = clampedSectorDependency(left) * Math.max(left.supplier_hhi_brazil, 1);
    const rightScore = clampedSectorDependency(right) * Math.max(right.supplier_hhi_brazil, 1);
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
  // Insumos que sustentam especificamente a rota de descarbonização do aço
  // (eletrodos de grafite -> forno elétrico a arco; ferro-esponja/redução
  // direta -> pré-requisito da rota DRI-hidrogênio) são insumo crítico de
  // processo para a própria transição energética da siderurgia, não uso
  // final em infraestrutura -- cabem na Missão 5, não na 3.
  if (/grafite|esponja|redução direta|reducao direta/.test(context)) {
    return "Missão 5 da NIB (Bioeconomia, descarbonização e transição e segurança energéticas): garantir insumo crítico de processo para a rota de descarbonização siderúrgica (forno elétrico a arco/redução direta) -- sua interrupção força a volta à rota primária a coque, de maior pegada de carbono e mais exposta ao CBAM.";
  }
  if (/aço|siderurg|ferro|ferroliga|laminado|estrutura/.test(context)) {
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

// Executive framing question per chain -- same "real citation over generic
// boilerplate" principle as sectorRecommendedPolicy() above, just for the
// hero question instead of the NIB policy line.
function chainStrategicQuestion(chainId: string | null) {
  switch (chainId) {
    case "silicio":
      return "Onde o Brasil possui capacidade e onde está o estrangulamento tecnológico da cadeia solar?";
    case "aco":
      return "Onde o Brasil já lidera (minério, aço bruto) e onde a siderurgia nacional ainda depende de ligas e equipamentos importados?";
    case "fertilizantes":
      return "Onde a produção nacional de fertilizantes se sustenta e onde a segurança alimentar do país ainda depende de nutrientes importados?";
    case "combustiveis_transicao":
      return "Onde o Brasil já exporta combustíveis de baixo carbono em escala e onde a próxima rota (hidrogênio, e-combustíveis) ainda depende de tecnologia importada?";
    default:
      return "Onde estão a capacidade nacional e os principais estrangulamentos desta cadeia?";
  }
}

// IA-overload pilot: what the chain covers and where its boundary sits --
// stage names mirror exactly the espinha dorsal (AipnetSystemsFlow) and the
// exclusion note names the one case each chain's own narrative already
// flags as "produção/energia, não comércio exterior" (aço) or explicitly
// out of scope (silício's parallel system components). Only written for
// the two chains the pilot has reached so far.
function chainScopeSummary(chainId: string | null): string | undefined {
  switch (chainId) {
    case "aco":
      return "A cadeia de Aço e Materiais Estratégicos cobre da carga primária ao produto de transição: minério de ferro e carvão mineral/coque na base, sucata ferrosa como insumo reciclado, ferro-gusa e ferroligas na redução e aciaria, até laminados, tubos, estruturas e aços elétricos no uso final -- 16 insumos mapeados com dados de comércio exterior (Comex Stat), produção industrial (PIA) e emprego formal (RAIS). Fica de fora: produtos de consumo final feitos de aço (utensílios, ferragens) e etapas sem comércio exterior próprio, como o carvão vegetal da biorredução, que entra só como dado de produção/energia.";
    case "silicio":
      return "A cadeia de Silício e Solar Fotovoltaica cobre da extração ao produto final: quartzo e sílica na base mineral, silício grau metalúrgico e polissilício no processamento e refino, lingotes e wafers nos componentes avançados, até células e módulos fotovoltaicos -- 16 insumos mapeados com dados de comércio exterior (Comex Stat), produção industrial (PIA) e emprego formal (RAIS). Fica de fora: os demais componentes do sistema solar completo (inversores, vidros, cabos) e outras cadeias renováveis (eólica, baterias), tratadas à parte.";
    case "fertilizantes":
      return "A cadeia de Fertilizantes Estratégicos cobre da matéria-prima ao uso agropecuário: gás natural e rocha fosfática na base, amônia, ureia, sulfato de amônio, fosfatos (DAP/MAP) e cloreto de potássio nos intermediários químicos, até a formulação NPK -- 17 insumos mapeados com dados de comércio exterior (Comex Stat), produção industrial (PIA) e emprego formal (RAIS). Fica de fora: a aplicação em campo em si (fora do escopo de comércio exterior) e formulações de uso muito específico não cobertas pela cesta NCM mapeada.";
    case "combustiveis_transicao":
      return "A cadeia de Combustíveis de Transição cobre do insumo à aplicação final: gás natural, etanol e biodiesel na base doméstica, hidrogênio/amônia/metanol como moléculas importadas, eletrolisadores e catalisadores como tecnologia habilitadora, até combustíveis de aviação (SAF) no uso final -- 10 insumos mapeados com dados de comércio exterior (Comex Stat), produção industrial (PIA) e emprego formal (RAIS). Fica de fora: rotas ainda sem maturidade comercial (ex. e-combustíveis em escala) e o hidrogênio verde propriamente dito, cujo comércio exterior observado hoje é quase inexistente.";
    default:
      return undefined;
  }
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
      // Same bands as hhiRiskLabel above, so the gauge's color zones never
      // contradict the note text sitting right under it.
      gauge: {
        value: metrics.maxHhi,
        max: 10000,
        bands: [
          { upTo: 1800, color: "#34d399" },
          { upTo: 2500, color: "#a3e635" },
          { upTo: 9000, color: "#fb923c" },
          { upTo: 10000, color: "#f87171" },
        ],
      },
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
  // The 4 monitored/curated chains (MONITORED_CHAINS) have a hand-vetted
  // insumo catalog -- solarInputs, built from the same 15-16-item list the
  // NIB matrix and Powershoring aggregator use. When that fails to load
  // (e.g. the Published API is unreachable), falling back to this raw
  // PRODLIST-derived `products` list is wrong for these chains specifically:
  // PRODLIST/NCM chapter 73 ("obras de ferro fundido, ferro ou aço") covers
  // finished consumer/industrial articles (panelas, pias, escadas, correntes,
  // grampos) right alongside real production insumos, with no field to tell
  // them apart -- every item here reports the same stage ("Transformação").
  // Confirmed live: aço's raw fallback surfaced "Escadas de ferro e aço" and
  // "Paletes... para movimentação de carga" as top-risk insumos. Showing the
  // honest "dados indisponíveis" empty state (VulnerabilityChart's own
  // fallback below) beats silently mixing insumos with kitchenware.
  const isCuratedChain = MONITORED_CHAINS.includes(selectedChain as (typeof MONITORED_CHAINS)[number]);
  const observedProducts: ProductVulnerability[] = isCuratedChain ? [] : [...products]
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
        // china_share_brazilian_imports is a share OF WHATEVER GOT IMPORTED --
        // with no external_dependency/global_china_share to fall back to
        // instead, a tiny import base (e.g. ferro-esponja: US$99.930, one
        // cent under this same threshold used elsewhere for materiality --
        // see SAMPLE_SHIPMENT_THRESHOLD_USD's other call sites) can swing
        // that share to 75%+ on a handful of shipments, reading as a crossed
        // "critical dependency" threshold in both the header alert count and
        // this chart's own bars when it's actually statistical noise, not a
        // real supply signal. Below the floor, there's no reliable
        // dependency indicator at all -- report 0 rather than the noisy
        // share, consistent with how immaterial samples are already
        // excluded elsewhere (e.g. headerNcmShortcuts above).
        const importConcentrationIsImmaterial = usesImportConcentration && input.imports_value_usd < SAMPLE_SHIPMENT_THRESHOLD_USD;
        return {
          name: input.label,
          category: confirmedZeroDomestic
            ? "Gargalo de soberania confirmado"
            : usesStructuralRisk ? "Gargalo estrutural" : sectorStageLabel(input.stage),
          dependency: confirmedZeroDomestic
            ? 100
            : importConcentrationIsImmaterial
              ? 0
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
            : importConcentrationIsImmaterial
              // The materiality caveat explains why the number reads 0%; it
              // shouldn't crowd out whatever chain-specific analysis
              // data_gap_reason already had for this input (e.g. ferro-
              // esponja's NCM/PRODLIST bridge note) -- show both instead of
              // replacing one with the other.
              ? [
                  `Amostra de importação irrisória (US$ ${Math.round(input.imports_value_usd).toLocaleString("pt-BR")} no período) para atribuir concentração de fornecedor com confiança -- sem indicador de dependência confiável.`,
                  input.data_gap_reason,
                ].filter(Boolean).join(" ")
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
          category: "Gargalo estrutural",
          dependency: 95,
          hhi: 9025,
          strategic: true,
          executiveName: "Polissilício de grau solar",
          evidenceType: "aipnet_structural",
          evidenceNote: "Concentração dominante estimada em 95% na etapa crítica de refino solar.",
        },
        {
          name: "Wafers fotovoltaicos",
          category: "Gargalo estrutural",
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

