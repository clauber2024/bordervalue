"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Info, X } from "lucide-react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { ProdutoConceitual } from "../types/border-value";
import type { ProductionRouteClass, SolarInputMetric } from "../types/solar-sovereignty";
import { transitionFuelDestination } from "../lib/transitionFuelTopology";

type Perspective = "imports" | "exports";

type SankeyNodeDatum = {
  id: string;
  name: string;
  kind: "supplier" | "input" | "stage" | "destination" | "product";
  tone: Perspective;
  value?: number;
  rawValue?: number;
  share?: number;
  chokepoint?: boolean;
  lowCarbon?: boolean;
  domesticUse?: boolean;
  criticalImport?: boolean;
  // Which individual solarInputs (by label) roll up into this node's
  // rawValue, tracked at build time by whichever builder created the node
  // -- not recomputed from scratch when the detail panel renders, so there
  // is one source of truth for "what does this number add up to."
  contributions?: { label: string; amount: number }[];
  // Only set on exports-perspective input nodes while the route-coloring
  // lens is on (see buildExportsTopology) -- drives reorderSankeyNodes'
  // vertical grouping so same-colored bands cluster together instead of
  // interleaving with the rest of the column.
  routeClass?: ProductionRouteClass;
};

type SankeyLinkDatum = {
  id: string;
  highlightId: string;
  source: number;
  target: number;
  value: number;
  rawValue: number;
  tone: Perspective;
  alpha: number;
  alphaApplied: boolean;
  supplierName: string;
  productName: string;
  color?: string;
  flowLabel?: string;
  share?: number;
  routeClass?: ProductionRouteClass;
  routeRationale?: string;
  dataGapReason?: string;
  domesticUse?: boolean;
};

type SankeyChartData = {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
  summary?: { totalValue: number; inputCount: number; highlightCount: number; highlightLabel: string };
};

type SankeyLayoutNode = SankeyNodeDatum & {
  x: number;
  y: number;
  dx: number;
  dy: number;
};

type SankeyNodeRenderProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: SankeyLayoutNode;
};

type SankeyLinkRenderProps = {
  sourceX: number;
  targetX: number;
  sourceY: number;
  targetY: number;
  sourceControlX: number;
  targetControlX: number;
  linkWidth: number;
  payload: SankeyLinkDatum & {
    source: SankeyLayoutNode;
    target: SankeyLayoutNode;
  };
};

type SankeyTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload?: SankeyLinkRenderProps | SankeyNodeRenderProps;
  }>;
};

export type SankeyAnalysisFocus = { nodeId: string; stage: string; input?: string };

export type SovereigntySankeyChartProps = {
  data?: ProdutoConceitual[];
  dado?: ProdutoConceitual;
  className?: string;
  height?: number;
  title?: string;
  solarInputs?: SolarInputMetric[];
  chainName?: string;
  onAnalysisFocus?: (focus: SankeyAnalysisFocus) => void;
};

const shell =
  "border border-zinc-800/70 bg-zinc-950/90 shadow-2xl shadow-black/45 backdrop-blur-xl";

const usdCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const usdLong = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function SovereigntySankeyChart({
  data,
  dado,
  className = "",
  height = 460,
  title = "Fluxo comercial por produto conceitual",
  solarInputs = [],
  chainName,
  onAnalysisFocus,
}: SovereigntySankeyChartProps) {
  const [perspective, setPerspective] = useState<Perspective>("imports");
  const [routeColoring, setRouteColoring] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [hoveredFlowId, setHoveredFlowId] = useState<string | null>(null);
  // Legend-click filter (route class) and node/link click-selection are
  // mutually exclusive -- picking one always clears the other, so the two
  // dimming mechanisms never have to be merged/reconciled visually.
  const [selectedRouteClass, setSelectedRouteClass] = useState<ProductionRouteClass | null>(null);
  // Toggle-off (clicking the already-selected node/link again) has to clear
  // hoveredFlowId too, not just selectedFlowId -- activeFlowId falls back to
  // hoveredFlowId when selectedFlowId is null, and the cursor is still
  // sitting on that exact element right after the click that toggled it
  // off, so without this the chart looked "stuck" dimmed: the one element
  // under the cursor stayed highlighted and everything else stayed dark
  // until the mouse physically left it. This is also the shared "reset
  // everything" used by the global "Limpar destaque" button and the detail
  // card's "Fechar" button, so it clears the route-class filter too.
  const clearFlowSelection = useCallback(() => {
    setSelectedFlowId(null);
    setHoveredFlowId(null);
    setSelectedRouteClass(null);
  }, []);
  const handleSelectFlow = useCallback((id: string) => {
    setSelectedRouteClass(null);
    setSelectedFlowId((current) => {
      if (current === id) {
        setHoveredFlowId(null);
        return null;
      }
      return id;
    });
  }, []);
  const handleSelectRouteClass = useCallback((routeClass: ProductionRouteClass) => {
    setSelectedFlowId(null);
    setHoveredFlowId(null);
    setSelectedRouteClass((current) => (current === routeClass ? null : routeClass));
  }, []);
  const products = useMemo(() => (dado ? [dado] : data ?? []), [data, dado]);

  const sankeyData = useMemo<SankeyChartData>(() => {
    if (solarInputs.length) {
      return perspective === "imports"
        // Production-route classification (fóssil/transição/baixo carbono)
        // doesn't add decision-relevant signal for a vulnerability/
        // concentration reading, so Importações always shows severity-by-
        // concentration color -- the toggle only exists on Exportações,
        // where it pairs naturally with the "baixo carbono" framing.
        ? buildImportsTopology(solarInputs, chainName, false)
        : buildExportsTopology(solarInputs, routeColoring);
    }
    return buildProductTopology(products, perspective);
  }, [chainName, perspective, products, routeColoring, solarInputs]);

  const alphaLinks = sankeyData.links.filter((link) => link.alphaApplied && link.alpha < 1).length;
  const summary = sankeyData.summary ?? {
    totalValue: sankeyData.links.reduce((sum, link) => sum + link.rawValue, 0),
    inputCount: products.length,
    highlightCount: alphaLinks,
    highlightLabel: "Fluxos com Alpha",
  };
  const activeFlowId = selectedFlowId ?? hoveredFlowId;
  const selectedNodeFlowId = selectedFlowId?.startsWith("node:") ? selectedFlowId : null;
  // In the route-coloring lens (exports only), mere hovering or clicking a
  // LINK shouldn't dim the rest of the chart -- the color already carries
  // the signal there. Only an explicit NODE click, or the legend's
  // route-class filter below, isolates a subset in that mode; everywhere
  // else any active hover/click dims as usual.
  const opacityFlowId = routeColoring && perspective === "exports" ? selectedNodeFlowId : activeFlowId;
  const focusContext = useMemo(
    () => selectedRouteClass
      ? buildRouteClassFocusContext(selectedRouteClass, sankeyData)
      : buildFocusContext(opacityFlowId, sankeyData),
    [opacityFlowId, sankeyData, selectedRouteClass],
  );
  const filterActive = opacityFlowId !== null || selectedRouteClass !== null;
  // Links rest at a low 0.05 baseline opacity by design (see renderLink)
  // to cut clutter until something is highlighted -- but that defeats the
  // point of the route-coloring lens, whose whole purpose is to show every
  // link's color classification at a glance. Boost the baseline to full
  // opacity there, but only while nothing is actively isolating a subset
  // (a node click or the legend's route-class filter should still dim
  // everything else as normal).
  const routeLensRestingFull = routeColoring && perspective === "exports" && !filterActive;
  // Detail panel below the chart (same pattern as AipnetSystemsFlow's
  // selected-node aside) instead of a clickable element inside the
  // recharts Tooltip -- no precedent in this codebase for interactive
  // content surviving a Tooltip's mouseleave-driven dismissal. Only
  // CLICKED selection opens it (selectedFlowId, not the hover-merged
  // activeFlowId), so hovering around doesn't pop it open/closed.
  const selectedNodeId = selectedFlowId?.startsWith("node:") ? selectedFlowId.slice(5) : null;
  const selectedLinkHighlightId = selectedFlowId?.startsWith("flow:") ? selectedFlowId.slice(5) : null;
  const selectedNodeDatum = selectedNodeId ? sankeyData.nodes.find((node) => node.id === selectedNodeId) ?? null : null;
  const selectedLinkDatum = selectedLinkHighlightId
    ? sankeyData.links.find((link) => link.highlightId === selectedLinkHighlightId) ?? null
    : null;
  // All inputs in a chain response share one reference_period (see
  // build_solar_sovereignty_metrics.py) -- reading it off the first entry
  // is the real value for the whole chain, not a per-node guess.
  const referencePeriod = solarInputs[0]?.reference_period;
  const detailSubject = useMemo(() => {
    if (selectedNodeDatum) {
      const node = selectedNodeDatum;
      const relatedInput = node.kind === "input" ? solarInputs.find((item) => `input:${item.input_id}` === node.id) : undefined;
      const kindLabel = nodeKindLabel(node.kind);
      return {
        key: node.id,
        title: node.name,
        kindLabel,
        amount: node.rawValue ?? 0,
        share: node.share,
        tone: node.tone,
        subjectKind: "node" as const,
        dataSource: dataSourceLabel(node.tone, node.domesticUse),
        glossary: nodeGlossary(node.kind, node.tone, node.id),
        methodology: nodeMethodology(node.kind, node.tone, node.id, node.domesticUse),
        formula: calculationFormula(node.tone, node.domesticUse),
        evidence: evidenceSources(node.tone, node.domesticUse, referencePeriod),
        executiveSummary: routeExecutiveSummary({
          title: node.name, amount: node.rawValue ?? 0, share: node.share, tone: node.tone, kindLabel,
          domesticUse: node.domesticUse, routeClass: relatedInput?.production_route_class,
          chokepoint: node.chokepoint, criticalImport: node.criticalImport, lowCarbon: node.lowCarbon,
        }),
        routeClass: undefined as ProductionRouteClass | undefined,
        routeRationale: undefined as string | undefined,
        dataGapReason: undefined as string | undefined,
        chokepoint: node.chokepoint,
        lowCarbon: node.lowCarbon,
        criticalImport: node.criticalImport,
        domesticUse: node.domesticUse,
        chokepointNote: node.chokepoint
          ? chokepointGlossaryNote(node.kind === "destination" || node.kind === "product")
          : undefined,
        criticalImportNote: node.criticalImport ? CRITICAL_IMPORT_GLOSSARY_NOTE : undefined,
        lowCarbonNote: node.lowCarbon ? LOW_CARBON_GLOSSARY_NOTE : undefined,
        domesticUseNote: node.domesticUse ? DOMESTIC_USE_GLOSSARY_NOTE : undefined,
        focusNodeId: node.id,
        focusStage: resolveFocusStage(node.id, solarInputs),
        focusInput: relatedInput?.label,
        contributions: node.contributions,
      };
    }
    if (selectedLinkDatum) {
      const link = selectedLinkDatum;
      const kindLabel = link.tone === "exports" ? "Ativo" : "Origem";
      const title = link.flowLabel ?? link.productName;
      return {
        key: link.id,
        title,
        kindLabel,
        amount: link.rawValue,
        share: link.share,
        tone: link.tone,
        subjectKind: "route" as const,
        dataSource: dataSourceLabel(link.tone, link.domesticUse),
        glossary: routeGlossary(link.tone),
        methodology: `Valor FOB ${link.tone === "exports" ? "exportado" : "importado"} (ComexStat/MDIC) deste fluxo específico, entre as duas etapas indicadas no título.`,
        formula: calculationFormula(link.tone, link.domesticUse),
        evidence: evidenceSources(link.tone, link.domesticUse, referencePeriod),
        executiveSummary: routeExecutiveSummary({
          title, amount: link.rawValue, share: link.share, tone: link.tone, kindLabel,
          domesticUse: link.domesticUse, routeClass: link.routeClass,
        }),
        routeClass: link.routeClass,
        routeRationale: link.routeRationale,
        dataGapReason: link.dataGapReason,
        chokepoint: undefined as boolean | undefined,
        lowCarbon: undefined as boolean | undefined,
        criticalImport: undefined as boolean | undefined,
        domesticUse: link.domesticUse,
        chokepointNote: undefined as string | undefined,
        criticalImportNote: undefined as string | undefined,
        lowCarbonNote: link.routeClass === "low_carbon_dominant" ? LOW_CARBON_GLOSSARY_NOTE : undefined,
        domesticUseNote: link.domesticUse ? DOMESTIC_USE_GLOSSARY_NOTE : undefined,
        focusNodeId: link.highlightId,
        focusStage: resolveFocusStage(link.highlightId, solarInputs),
        focusInput: link.productName,
        contributions: undefined as SankeyNodeDatum["contributions"],
      };
    }
    return null;
  }, [selectedNodeDatum, selectedLinkDatum, solarInputs, referencePeriod]);
  // Drill-down data behind the two clickable header metric pills -- real
  // input lists, not fabricated: "Insumos mapeados" is every input actually
  // considered for this perspective (exports side pre-filters to
  // exports_value_usd > 0, mirroring buildExportsTopology's own
  // exportableInputs filter so the drawer's count matches the pill's).
  // "Gargalos"/"Rotas" mirrors the same threshold each perspective's
  // topology builder uses for its own chokepoint/lowCarbon flags.
  const [metricsDrawer, setMetricsDrawer] = useState<"mapped" | "highlight" | null>(null);
  const mappedInputsList = useMemo(
    () => perspective === "exports" ? solarInputs.filter((input) => input.exports_value_usd > 0) : solarInputs,
    [perspective, solarInputs],
  );
  const highlightInputsList = useMemo(
    () => perspective === "exports"
      ? mappedInputsList.filter((input) => input.production_route_class === "low_carbon_dominant")
      : mappedInputsList.filter((input) =>
          (input.global_china_share ?? input.china_share_brazilian_imports ?? 0) >= CHOKEPOINT_THRESHOLD
          // global_china_share is a structural figure, not derived from
          // Brazil's own sample -- only gate the Brazil-import-sample-based
          // reading behind the materiality floor, or a real global
          // chokepoint (thin Brazilian trade, real global monopoly) would be
          // wrongly dropped along with actual sample-scale noise.
          && (input.global_china_share !== null || input.imports_value_usd >= SAMPLE_SHIPMENT_THRESHOLD_USD),
        ),
    [perspective, mappedInputsList],
  );
  // Which of the 5 route classes actually have an exported input in this
  // chain -- the "Lente opcional" legend below only shows pills for these,
  // instead of always listing all 5 regardless of whether the active chain
  // touches them.
  const presentRouteClasses = useMemo(
    () => new Set(mappedInputsList.map((input) => input.production_route_class)),
    [mappedInputsList],
  );
  const activeInputCount = sankeyData.nodes.filter((node) => node.kind === "input").length;
  const effectiveHeight = solarInputs.length && activeInputCount
    ? Math.max(height, activeInputCount * 58 + 180)
    : height;
  const isEmpty = !sankeyData.nodes.length || !sankeyData.links.length;
  const emptyMessage = solarInputs.length && perspective === "exports"
    ? "Nenhum insumo desta cadeia registra exportação relevante no período mapeado — a perspectiva de importações continua disponível na pílula ao lado."
    : "Nenhum produto conceitual disponível para compor o fluxo de soberania.";
  const scopeNote = perspective === "exports"
    ? 'Este diagrama ilustra a distribuição da produção doméstica de cada ativo, partindo do insumo ou matéria-prima nacional (coluna à esquerda), passando pelas etapas produtivas confirmadas no Brasil, até o principal país comprador — ou até "Uso Interno / Consumo Doméstico" (cinza) para a parcela que não foi exportada. A espessura das bandas reflete o valor FOB exportado somado à produção retida no país (ComexStat/MDIC + produção comparável PRODLIST); mercados com participação abaixo de 0,1% do total exportado são agrupados em "Outros Mercados".'
    : "Este diagrama ilustra a distribuição da pauta importada e a concentração geográfica de fornecedores por categoria de bem. A espessura das bandas reflete o valor FOB importado, e não uma sequência de transformação industrial doméstica.";

  return (
    <section className={`${shell} relative overflow-hidden rounded-lg text-zinc-100 ${className}`}>
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl transition-colors duration-700 ${
          perspective === "imports" ? "bg-red-600/10" : "bg-emerald-500/10"
        }`}
      />

      <header className="relative border-b border-zinc-800/70 bg-white/[0.025] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              AIPNET / leitura executiva
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
              {title}
            </h2>
          </div>
          <PerspectiveSwitch perspective={perspective} onChange={setPerspective} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <MetricPill label={perspective === "exports" ? "Exportações" : "Importações"} value={usdCompact.format(summary.totalValue)} />
          <MetricPill
            label={perspective === "exports" ? "Ativos nacionais mapeados" : "Insumos mapeados"}
            value={String(summary.inputCount)}
            onClick={mappedInputsList.length ? () => setMetricsDrawer("mapped") : undefined}
          />
          <MetricPill
            label={summary.highlightLabel}
            value={String(summary.highlightCount)}
            onClick={highlightInputsList.length ? () => setMetricsDrawer("highlight") : undefined}
          />
        </div>
      </header>

      <div className="relative px-2 py-5 sm:px-4">
        <div
          className={`mb-4 flex items-start gap-2.5 rounded-lg border p-3 text-xs text-zinc-400 backdrop-blur-md ${
            perspective === "imports" ? "border-red-500/15 bg-red-950/10" : "border-emerald-500/15 bg-emerald-950/10"
          }`}
        >
          <Info className={`mt-0.5 h-4 w-4 shrink-0 ${perspective === "imports" ? "text-red-400" : "text-emerald-400"}`} strokeWidth={1.5} />
          <p className="leading-relaxed">
            <strong className="font-semibold text-zinc-200">Nota de Escopo Comercial (ComexStat/MDIC):</strong> {scopeNote}
          </p>
          {/* Was previously only rendered inside the exports-only "Lente
              opcional" box below, so a selection made on the Importações
              perspective had no visible reset control -- moved here so it
              shows in both perspectives whenever a selection is active. */}
          {selectedFlowId || selectedRouteClass ? (
            <button
              type="button"
              onClick={clearFlowSelection}
              className="ml-auto shrink-0 rounded-lg border border-white/15 bg-zinc-950/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Limpar destaque
            </button>
          ) : null}
        </div>

        {solarInputs.length && perspective === "exports" ? (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Lente opcional</p>
              <p className="mt-1 text-[10px] leading-4 text-zinc-500">
                Classifica cada ativo exportado pela rota produtiva dominante (fóssil, transição, baixo carbono ou
                potencial não realizado), independente da direção do comércio.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // A held click-selection (selectedFlowId) keeps every
                    // OTHER link's isDimmed opacity low regardless of
                    // colorMode -- toggling the lens without clearing it
                    // made the whole new palette look permanently dimmed.
                    setRouteColoring((value) => !value);
                    clearFlowSelection();
                  }}
                  aria-pressed={routeColoring}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                    routeColoring ? "border-violet-300/30 bg-violet-400/10 text-violet-100" : "border-white/10 bg-zinc-950/50 text-zinc-400 hover:text-white"
                  }`}
                >
                  Colorir por rota produtiva
                </button>
              </div>
            </div>
            {routeColoring ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[10px]">
                {(Object.keys(ROUTE_CLASS_LABELS) as ProductionRouteClass[])
                  .filter((routeClass) => presentRouteClasses.has(routeClass))
                  .map((routeClass) => {
                  const isActive = selectedRouteClass === routeClass;
                  const isMuted = selectedRouteClass !== null && !isActive;
                  return (
                    <button
                      key={routeClass}
                      type="button"
                      onClick={() => handleSelectRouteClass(routeClass)}
                      aria-pressed={isActive}
                      title={`Isolar fluxos com rota "${ROUTE_CLASS_LABELS[routeClass]}"`}
                      className={`flex items-center gap-1.5 rounded-full border px-2 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                        isActive
                          ? "border-white/30 bg-white/[0.08] text-white"
                          : isMuted
                            ? "border-transparent text-zinc-600 hover:text-zinc-400"
                            : "border-transparent text-zinc-500 hover:border-white/15 hover:text-zinc-300"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ROUTE_CLASS_COLORS[routeClass] }} />
                      {ROUTE_CLASS_LABELS[routeClass]}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <span className="h-2 w-12 rounded-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-600" />
                exportação parcial → predominância nacional
              </div>
            )}
          </div>
        ) : null}

        <div
          className="w-full overflow-x-auto transition-[height] duration-500 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/40 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-700/70"
          style={{ height: effectiveHeight, scrollbarColor: "rgba(82,82,91,0.4) transparent", scrollbarWidth: "thin" }}
        >
          {/* Fixed min-width keeps node-column spacing (and thus label room)
              constant regardless of viewport, and stable across perspective
              switches, so the crossfade below never triggers a layout jump. */}
          <div className="h-full min-w-[1360px]">
            {/* No AnimatePresence/exit here on purpose: chokepoint and
                low-carbon nodes carry their own repeat:Infinity pulse, and
                those never fire a completion event -- with mode="wait" that
                left the outgoing perspective's exit stuck forever, so both
                Sankeys stayed mounted at once. A key-triggered enter-only
                fade swaps instantly and still feels smooth. */}
              <motion.div
                key={perspective}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="h-full"
              >
                {isEmpty ? (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
                    {emptyMessage}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <Sankey
                      data={sankeyData}
                      dataKey="value"
                      nameKey="name"
                      node={(props: SankeyNodeRenderProps) => renderNode(
                        props,
                        opacityFlowId,
                        filterActive,
                        focusContext.nodeIds,
                        handleSelectFlow,
                        (id) => setHoveredFlowId(id),
                      )}
                      link={(props: SankeyLinkRenderProps) => renderLink(
                        props,
                        opacityFlowId,
                        filterActive,
                        focusContext.highlightIds,
                        routeLensRestingFull,
                        handleSelectFlow,
                        (id) => setHoveredFlowId(id),
                      )}
                      nodePadding={24}
                      nodeWidth={16}
                      linkCurvature={0.55}
                      iterations={48}
                      margin={{ top: 20, right: 320, bottom: 20, left: 20 }}
                      sort={false}
                    >
                      <Tooltip content={<FlowTooltip />} />
                    </Sankey>
                  </ResponsiveContainer>
                )}
              </motion.div>
          </div>
        </div>

        {detailSubject ? (
          <motion.aside
            key={detailSubject.key}
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            transition={{ duration: 0.24 }}
            className="relative mt-4 overflow-hidden rounded-2xl border border-cyan-300/20 bg-zinc-950/75 p-5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 max-w-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  {detailSubject.kindLabel} selecionado(a) · detalhe da rota
                </p>
                <h4 className="mt-1 text-lg font-bold text-white">{detailSubject.title}</h4>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <span className={`font-mono font-semibold ${detailSubject.tone === "exports" ? "text-emerald-300" : "text-cyan-300"}`}>
                    {usdLong.format(detailSubject.amount)}
                  </span>
                  {detailSubject.share !== undefined ? (
                    <span className="text-zinc-500">{percent.format(detailSubject.share)} da rede</span>
                  ) : null}
                </div>
                {/* TOPO: glossário conceitual -- o "o que é", antes de qualquer número. */}
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  {detailSubject.subjectKind === "route" ? "O que esta rota representa?" : "O que este nó representa?"}
                </p>
                <p className="mt-1.5 rounded-md border border-violet-300/15 bg-violet-400/[0.05] px-3 py-2 text-xs leading-relaxed text-zinc-200">
                  {detailSubject.glossary}
                </p>
                {detailSubject.chokepointNote ? (
                  <p className="mt-1.5 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-red-200/90">
                    <span className="font-semibold">⚠ Gargalo de concentração: </span>{detailSubject.chokepointNote}
                  </p>
                ) : null}
                {detailSubject.criticalImportNote ? (
                  <p className="mt-1.5 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-red-200/90">
                    <span className="font-semibold">⚠ Insumo crítico: </span>{detailSubject.criticalImportNote}
                  </p>
                ) : null}
                {detailSubject.lowCarbonNote ? (
                  <p className="mt-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-emerald-200/90">
                    <span className="font-semibold">Baixo carbono: </span>{detailSubject.lowCarbonNote}
                  </p>
                ) : null}
                {detailSubject.domesticUseNote ? (
                  <p className="mt-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
                    <span className="font-semibold text-zinc-300">Uso interno: </span>{detailSubject.domesticUseNote}
                  </p>
                ) : null}

                {/* MEIO: análise executiva (o "quanto") + memória de cálculo (o "como"). */}
                <p className="mt-4 rounded-md border border-cyan-300/15 bg-cyan-400/[0.04] px-3 py-2 text-xs leading-relaxed text-zinc-200">
                  <span className="font-semibold text-cyan-200">Análise executiva: </span>
                  {detailSubject.executiveSummary}
                </p>

                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Memória de cálculo
                </p>
                <p className="mt-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-zinc-400">
                  <span className="font-semibold text-zinc-300">Como este número é calculado: </span>
                  {detailSubject.methodology}
                </p>
                <p className="mt-1.5 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-500">
                  {detailSubject.formula}
                </p>
                {detailSubject.routeRationale ? (
                  <p className="mt-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-zinc-300">
                    {detailSubject.routeRationale}
                  </p>
                ) : null}
                {detailSubject.dataGapReason ? (
                  <p className="mt-1.5 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs leading-relaxed text-amber-200/90">
                    {detailSubject.dataGapReason}
                  </p>
                ) : null}
                {detailSubject.contributions && detailSubject.contributions.length > 1 ? (
                  <div className="mt-4 border-t border-white/[0.06] pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Detalhamento de composição
                    </p>
                    <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                      {[...detailSubject.contributions]
                        .sort((a, b) => b.amount - a.amount)
                        .map((item) => (
                          <li key={item.label} className="flex items-center justify-between gap-3 text-xs text-zinc-300">
                            <span className="truncate">{item.label}</span>
                            <span className="shrink-0 font-mono text-zinc-400">
                              {usdCompact.format(item.amount)} · {percent.format(item.amount / Math.max(detailSubject.amount, 1))}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}

                {/* RODAPÉ: evidências, fontes e recorte temporal completo. */}
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Evidências e fontes oficiais
                </p>
                <ul className="mt-1.5 space-y-1">
                  {detailSubject.evidence.map((source) => (
                    <li key={source} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-300/90">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                      <span>{source}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onAnalysisFocus?.({ nodeId: detailSubject.focusNodeId, stage: detailSubject.focusStage, input: detailSubject.focusInput })}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    Ver diagnóstico desta etapa
                  </button>
                  <button
                    type="button"
                    onClick={clearFlowSelection}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        ) : null}
      </div>

      {metricsDrawer ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMetricsDrawer(null)}
            aria-hidden
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  {metricsDrawer === "mapped"
                    ? perspective === "exports" ? "Ativos nacionais mapeados" : "Insumos mapeados"
                    : summary.highlightLabel}
                </p>
                <h4 className="mt-1 text-lg font-bold text-white">
                  {metricsDrawer === "mapped" ? mappedInputsList.length : highlightInputsList.length} itens
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setMetricsDrawer(null)}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {(metricsDrawer === "mapped" ? mappedInputsList : highlightInputsList)
                .slice()
                .sort((left, right) => {
                  const rightValue = perspective === "exports" ? right.exports_value_usd : right.imports_value_usd;
                  const leftValue = perspective === "exports" ? left.exports_value_usd : left.imports_value_usd;
                  return rightValue - leftValue;
                })
                .map((input) => {
                  const value = perspective === "exports" ? input.exports_value_usd : input.imports_value_usd;
                  const share = value / Math.max(summary.totalValue, 1);
                  const chinaShare = input.global_china_share ?? input.china_share_brazilian_imports;
                  // Below this, a single spot shipment (lab sample, test
                  // batch, one-off reexport) can be the entire recorded
                  // flow -- flag it so the figure doesn't read as active
                  // production/export capacity.
                  const isSampleScale = value > 0 && value < SAMPLE_SHIPMENT_THRESHOLD_USD;
                  return (
                    <div
                      key={input.input_id}
                      className="mb-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{input.label}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-500">{executiveStageLabel(input.stage)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-sm font-semibold text-cyan-200">{usdCompact.format(value)}</p>
                          <p className="text-[11px] text-zinc-500">{percent.format(share)}</p>
                        </div>
                      </div>
                      {isSampleScale ? (
                        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-300/80">
                          Escala de amostra/remessa pontual — não representa capacidade produtiva ativa
                        </p>
                      ) : null}
                      {metricsDrawer === "highlight" ? (
                        perspective === "exports" ? (
                          input.production_route_rationale ? (
                            <p className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] leading-relaxed text-emerald-200/90">
                              {input.production_route_rationale}
                            </p>
                          ) : null
                        ) : (
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2 text-[11px] text-red-200/90">
                            {input.top_supplier?.country_name ? (
                              <span>Principal fornecedor: {input.top_supplier.country_name}</span>
                            ) : null}
                            {chinaShare !== null && chinaShare !== undefined ? (
                              <span className="font-mono">Concentração: {percent.format(chinaShare)}</span>
                            ) : null}
                          </div>
                        )
                      ) : null}
                    </div>
                  );
                })}
              {metricsDrawer === "highlight" && perspective === "exports" ? (
                <p className="mt-1 border-t border-white/[0.08] pt-3 text-[11px] leading-relaxed text-zinc-500">
                  A rota produtiva classifica a produção/fornecimento típico deste ativo, a mesma
                  classificação usada na perspectiva de importações — não a origem específica desta
                  exportação. Ativos como o Silício Grau Metalúrgico não aparecem aqui apesar da matriz
                  elétrica brasileira ser &gt;84% renovável, porque a classificação reflete a produção
                  mundial predominante (concentrada em matriz a carvão); não é uma avaliação da planta
                  brasileira específica que gerou esta exportação.
                </p>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </section>
  );
}

function PerspectiveSwitch({ perspective, onChange }: { perspective: Perspective; onChange: (next: Perspective) => void }) {
  const options: Array<{ key: Perspective; label: string; sublabel: string }> = [
    { key: "imports", label: "Vulnerabilidade e Importações", sublabel: "Soberania" },
    { key: "exports", label: "Inserção e Exportações", sublabel: "Valor Ambiental" },
  ];

  return (
    <div className="relative inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-zinc-950/80 p-1.5 shadow-inner shadow-black/40 backdrop-blur-2xl">
      {options.map((option) => {
        const active = perspective === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={active}
            className={`relative z-10 rounded-xl px-4 py-2.5 text-left text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
              active ? "text-white" : "text-zinc-300 hover:text-white"
            }`}
          >
            {active ? (
              <motion.span
                layoutId="perspective-pill-bg"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className={`absolute inset-0 -z-10 rounded-xl border-2 ${
                  option.key === "imports"
                    ? "border-red-400/80 bg-gradient-to-br from-red-500/60 to-red-600/35 shadow-[0_0_26px_rgba(239,68,68,0.5)]"
                    : "border-emerald-400/80 bg-gradient-to-br from-emerald-500/60 to-emerald-600/35 shadow-[0_0_26px_rgba(16,185,129,0.5)]"
                }`}
              />
            ) : null}
            <span className="relative block leading-tight">
              {option.label}
              <span className="ml-1 font-normal opacity-80">({option.sublabel})</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function renderNode(
  { x, y, width, height, payload }: SankeyNodeRenderProps,
  activeFlowId: string | null,
  filterActive: boolean,
  focusedNodeIds: Set<string>,
  onSelect: (id: string) => void,
  onHover: (id: string | null) => void,
) {
  const isRedFlagged = payload.chokepoint || payload.criticalImport;
  const fill = payload.domesticUse
    ? DOMESTIC_USE_COLOR
    : payload.criticalImport
      ? "#ef4444"
      : nodeFill(payload.kind, payload.tone);
  // Export-perspective destination nodes are real buyer countries (same
  // treatment as import-side suppliers) -- except the ones that aren't a
  // country at all: "Uso Interno" (domesticUse), the long-tail "Outros
  // Mercados" bucket, and the "Destino não informado" fallback.
  const isCountryDestination =
    payload.kind === "destination" &&
    payload.tone === "exports" &&
    !payload.domesticUse &&
    payload.name !== "Outros Mercados" &&
    payload.name !== "Destino não informado";
  const flagPalette = payload.kind === "supplier" || isCountryDestination ? countryFlagPalette(payload.name) : null;
  const gradientId = `country-${safeSvgId(payload.id)}`;
  const labelX = x + width + 10;
  const labelY = y + Math.max(height / 2, 8);
  const labelLines = wrapNodeLabel(payload.name);
  // Every line below the name (kind/share, badge) shifts down to make room
  // when the name wraps to two lines, instead of the second line colliding
  // with them.
  const labelShift = (labelLines.length - 1) * 13;
  const selectionId = `node:${payload.id}`;
  const isSelected = activeFlowId === selectionId;
  const isDimmed = filterActive && !focusedNodeIds.has(payload.id);
  const highlightStroke = isRedFlagged ? "#ef4444" : payload.lowCarbon ? "#10b981" : null;
  const highlightFilter = isRedFlagged
    ? "brightness(1.1) drop-shadow(0 0 12px rgba(239,68,68,0.55))"
    : payload.lowCarbon
      ? "drop-shadow(0 0 12px rgba(16,185,129,0.5))"
      : "drop-shadow(0 8px 18px rgba(0,0,0,0.36))";
  const fillOpacity = payload.kind === "destination" && payload.tone === "exports" ? 0.72 : 0.92;
  // Aço-specific context note: "reducao" is a stage key unique to the aço
  // catalog (ferro_gusa/ferro_esponja/carvao_mineral_coque), so this id
  // check alone safely scopes the badge to that chain's Redução stage node
  // without threading chainName through the generic renderNode signature.
  // Carvão vegetal itself was deliberately kept OUT of the AIPNET input
  // catalog (its NCM 4402 trade is real but ~200x smaller than the fossil
  // reductant and mixes non-siderurgical uses -- see carvao_mineral_coque's
  // rationale), so this is a literature-sourced contextual annotation, not
  // a claim backed by Comex/PIA data like the other badges on this node.
  const showCharcoalContext = payload.id === "stage:reducao" && payload.tone === "exports";
  const badgeAboveCharcoal = payload.chokepoint || payload.criticalImport || payload.lowCarbon;
  // Ferro-gusa is the largest-value item still stuck in the generic
  // "reducao" stage bucket after the EAF/DRI route split above -- its NCM
  // basket mixes coque-fired (BF-BOF) and carvão vegetal (biorredução)
  // pig iron with no tariff-level distinction, so it stays neutral rather
  // than inheriting either route's color. This badge makes that mixed
  // origin explicit on the node itself instead of leaving it implicit.
  const showFerroGusaMixNote = payload.id === "input:ferro_gusa" && payload.tone === "exports";
  const badgeAboveFerroGusa = payload.chokepoint || payload.criticalImport || payload.lowCarbon;

  return (
    <motion.g
      className="cursor-pointer"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: isDimmed ? 0.18 : 1, scale: isSelected ? 1.025 : 1 }}
      transition={{ duration: 0.24 }}
      onMouseEnter={() => onHover(selectionId)}
      onMouseLeave={() => onHover(null)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(selectionId);
      }}
    >
      {flagPalette ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={flagPalette[0]} />
            <stop offset="52%" stopColor={flagPalette[1]} />
            <stop offset="100%" stopColor={flagPalette[2]} />
          </linearGradient>
        </defs>
      ) : null}
      <motion.rect
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 8)}
        rx={5}
        fill={flagPalette ? `url(#${gradientId})` : fill}
        fillOpacity={fillOpacity}
        stroke={highlightStroke ?? fill}
        strokeOpacity={1}
        strokeWidth={isSelected ? 2.8 : 1.6}
        style={{ filter: highlightFilter }}
        animate={
          isRedFlagged
            ? { strokeWidth: [1.8, 3.2, 1.8], opacity: [1, 0.82, 1] }
            : payload.lowCarbon
              ? { opacity: [1, 0.88, 1] }
              : undefined
        }
        transition={
          isRedFlagged
            ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
            : payload.lowCarbon
              ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
              : undefined
        }
      />
      <text x={labelX} fill="#fafafa" fontSize={12} fontWeight={700}>
        {/* Native title tooltip carries the untruncated name too, as a
            fallback -- wrapNodeLabel splits into up to two lines (see
            labelShift above) so even the longest stage/destination names
            (e.g. "Insumos de Base (uso industrial doméstico)") render in
            full instead of getting cut off with an ellipsis. */}
        <title>{payload.name}</title>
        {labelLines.map((line, index) => (
          <tspan key={index} x={labelX} y={labelY - 5 - labelShift + index * 13} dominantBaseline="middle">
            {line}
          </tspan>
        ))}
      </text>
      <text x={labelX} y={labelY + 11 + labelShift} fill="#a1a1aa" fontSize={10} fontWeight={500} dominantBaseline="middle">
        {nodeKindLabel(payload.kind)}
        {payload.share !== undefined ? ` · ${percent.format(payload.share)}` : ""}
      </text>
      {payload.chokepoint ? (
        <text x={labelX} y={labelY + 24 + labelShift} fill="#fca5a5" fontSize={9} fontWeight={700} letterSpacing={0.4}>
          {/* "destination"/"product" nodes never have their own china-share
              figure -- their chokepoint flag is always propagated from an
              upstream stage/input, so the badge must say that, not claim a
              concentration number this node doesn't itself have. */}
          {payload.kind === "destination" || payload.kind === "product"
            ? "⚠ AFETADO POR GARGALO A MONTANTE"
            : "⚠ CONCENTRAÇÃO ≥ 90% CHINA"}
        </text>
      ) : payload.criticalImport ? (
        <text x={labelX} y={labelY + 24 + labelShift} fill="#fca5a5" fontSize={9} fontWeight={700} letterSpacing={0.4}>
          {/* Distinct from the chokepoint badge on purpose: this sink can
              hold stages whose own china-share sits under the 90% badge
              threshold (e.g. Polissilício at 85% global) but still have no
              confirmed domestic production -- "concentração ≥90%" would be
              a number this node doesn't actually have. */}
          ⚠ SEM PRODUÇÃO NACIONAL CONFIRMADA
        </text>
      ) : payload.lowCarbon ? (
        <text x={labelX} y={labelY + 24 + labelShift} fill="#6ee7b7" fontSize={9} fontWeight={700} letterSpacing={0.4}>
          ROTA DE BAIXO CARBONO
        </text>
      ) : null}
      {showCharcoalContext ? (
        <text
          x={labelX}
          y={labelY + (badgeAboveCharcoal ? 37 : 24) + labelShift}
          fill="#86efac"
          fontSize={9}
          fontWeight={700}
          letterSpacing={0.4}
        >
          <title>
            O carvão vegetal de florestas plantadas (biorredução), somado à eletricidade renovável do forno elétrico
            a arco (EAF), substitui o coque mineral importado na etapa de redução -- é essa substituição, não o
            minério bruto em si, que sustenta a leitura de baixo carbono do aço/ferro-gusa brasileiro para o mercado
            europeu (CBAM) e internacional. É produção e consumo domésticos: o comércio exterior de carvão vegetal
            (NCM 4402) é real mas marginal frente ao redutor fóssil importado, então não vira uma métrica AIPNET de
            comércio exterior nesta cesta. Referência de literatura (não medição AIPNET): o mix atual da indústria
            brasileira (carvão vegetal + coque) reduz cerca de 22% do potencial de aquecimento global (GWP) por
            tonelada de ferro-gusa frente ao baseline 100% coque, podendo chegar a ~47% em cenários otimizados
            (Sustainable Production and Consumption, Elsevier, 2023).
          </title>
          🌳 SUBSTITUIÇÃO DOMÉSTICA POR CARVÃO VEGETAL (CONTEXTO)
        </text>
      ) : null}
      {showFerroGusaMixNote ? (
        <text
          x={labelX}
          y={labelY + (badgeAboveFerroGusa ? 37 : 24) + labelShift}
          fill="#a1a1aa"
          fontSize={9}
          fontWeight={700}
          letterSpacing={0.4}
        >
          <title>
            Ferro-Gusa (Rota Mista): a pauta engloba tanto o gusa de usinas integradas a coque (mix IABr ~84%/16% em
            2024 entre associados) quanto o gusa verde de produtores independentes a carvão vegetal (polos de MG, PA
            e MA). Classificação mantida como neutra devido à ausência de distinção tarifária por NCM -- o mix IABr
            não foi extrapolado para o total exportado no Comex Stat porque cobre só usinas associadas, não o
            universo de guseiros independentes a carvão vegetal que respondem por parte relevante da produção
            nacional. O BEN/EPE (2024) inclui esses guseiros independentes, mas mede energia de todo o setor
            Ferro-Gusa e Aço, não isolada à redução: carvão vegetal já é 16,5% do consumo do setor, coque de carvão
            mineral 42,7%.
          </title>
          ◐ ROTA MISTA (COQUE + CARVÃO VEGETAL)
        </text>
      ) : null}
    </motion.g>
  );
}

function renderLink({
  sourceX,
  sourceY,
  sourceControlX,
  targetControlX,
  targetX,
  targetY,
  linkWidth,
  payload,
}: SankeyLinkRenderProps,
  activeFlowId: string | null,
  filterActive: boolean,
  focusedHighlightIds: Set<string>,
  forceFullOpacity: boolean,
  onSelect: (id: string) => void,
  onHover: (id: string | null) => void,
) {
  const strokeWidth = Math.max(linkWidth, 1.4);
  const path = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
  const selectedNodeId = activeFlowId?.startsWith("node:") ? activeFlowId.slice(5) : null;
  const selectedLinkId = activeFlowId?.startsWith("flow:") ? activeFlowId.slice(5) : null;
  // isHighlighted drives the two-state opacity model below: a quiet 0.05
  // resting network (cuts the red/green haze when nothing is selected) that
  // snaps up to 0.8 on the active path, instead of the previous three-tier
  // gradient that kept every idle link visible enough to blur together.
  const isHighlighted = selectedNodeId
    ? payload.source.id === selectedNodeId || payload.target.id === selectedNodeId || focusedHighlightIds.has(payload.highlightId)
    : selectedLinkId === payload.highlightId || focusedHighlightIds.has(payload.highlightId);
  const isDimmed = !forceFullOpacity && filterActive && !isHighlighted;
  const restingOpacity = forceFullOpacity ? 1 : payload.alphaApplied && payload.alpha < 1 ? 0.03 : 0.05;
  // Same lighter-top/darker-bottom vertical gradient technique the
  // country-flag node fills already use (countryFlagPalette below) --
  // gives every band the same "lit from above" sheen instead of a flat
  // single-tone stroke, route-colored or not.
  const baseColor = payload.color ?? (payload.alphaApplied && payload.alpha < 1 ? "#a7f3d0" : "#67e8f9");
  const gradientId = `link-gradient-${safeSvgId(payload.highlightId)}`;

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shadeHexColor(baseColor, 0.32)} />
          <stop offset="55%" stopColor={baseColor} />
          <stop offset="100%" stopColor={shadeHexColor(baseColor, -0.22)} />
        </linearGradient>
      </defs>
      <motion.path
        d={path}
        fill="none"
        stroke={payload.color ?? "#22d3ee"}
        strokeWidth={isHighlighted ? strokeWidth * 1.18 : strokeWidth}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: isHighlighted ? 0.5 : isDimmed ? 0.02 : restingOpacity }}
        transition={{ pathLength: { duration: 0.9, ease: "easeInOut" }, opacity: { duration: 0.2 } }}
        strokeLinecap="butt"
        pointerEvents="none"
      />
      <motion.path
        d={path}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={Math.max(strokeWidth * (isHighlighted ? 0.78 : 0.55), isHighlighted ? 2.4 : 1)}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: 1,
          opacity: isHighlighted ? 0.8 : isDimmed ? 0.03 : restingOpacity,
          strokeWidth: Math.max(strokeWidth * (isHighlighted ? 0.78 : 0.55), isHighlighted ? 2.4 : 1),
        }}
        transition={{ pathLength: { duration: 1.05, ease: "easeInOut" }, opacity: { duration: 0.2 }, strokeWidth: { duration: 0.2 } }}
        strokeLinecap="butt"
        pointerEvents="stroke"
        className="cursor-pointer transition-opacity duration-200"
        onMouseEnter={() => onHover(`flow:${payload.highlightId}`)}
        onMouseLeave={() => onHover(null)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(`flow:${payload.highlightId}`);
        }}
      />
    </g>
  );
}

function buildFocusContext(activeFlowId: string | null, data: SankeyChartData) {
  const nodeIds = new Set<string>();
  const highlightIds = new Set<string>();
  if (!activeFlowId) return { nodeIds, highlightIds };

  if (activeFlowId.startsWith("flow:")) {
    highlightIds.add(activeFlowId.slice(5));
  } else if (activeFlowId.startsWith("node:")) {
    const focusedNodeId = activeFlowId.slice(5);
    nodeIds.add(focusedNodeId);
    data.links.forEach((link) => {
      const sourceId = data.nodes[link.source]?.id;
      const targetId = data.nodes[link.target]?.id;
      if (sourceId === focusedNodeId || targetId === focusedNodeId) highlightIds.add(link.highlightId);
    });
  }

  data.links.forEach((link) => {
    if (!highlightIds.has(link.highlightId)) return;
    const sourceId = data.nodes[link.source]?.id;
    const targetId = data.nodes[link.target]?.id;
    if (sourceId) nodeIds.add(sourceId);
    if (targetId) nodeIds.add(targetId);
  });

  // Complete the selected route through the productive stage to the final system.
  const activeStageIds = new Set(Array.from(nodeIds).filter((id) => id.startsWith("stage:")));
  data.links.forEach((link) => {
    const sourceId = data.nodes[link.source]?.id;
    if (!sourceId || !activeStageIds.has(sourceId)) return;
    highlightIds.add(link.highlightId);
    nodeIds.add(sourceId);
    const targetId = data.nodes[link.target]?.id;
    if (targetId) nodeIds.add(targetId);
  });

  return { nodeIds, highlightIds };
}

// Legend-click filter: unlike buildFocusContext (traces a single selected
// route through the graph), this isolates every link carrying the given
// production_route_class, regardless of where it sits in the topology --
// the legend represents a category, not a path.
function buildRouteClassFocusContext(routeClass: ProductionRouteClass | null, data: SankeyChartData) {
  const nodeIds = new Set<string>();
  const highlightIds = new Set<string>();
  if (!routeClass) return { nodeIds, highlightIds };
  data.links.forEach((link) => {
    if (link.routeClass !== routeClass) return;
    highlightIds.add(link.highlightId);
    const sourceId = data.nodes[link.source]?.id;
    const targetId = data.nodes[link.target]?.id;
    if (sourceId) nodeIds.add(sourceId);
    if (targetId) nodeIds.add(targetId);
  });
  return { nodeIds, highlightIds };
}

// Tints (positive) or shades (negative) a #rrggbb color toward white/black
// by `percent` (0-1). Used to build the same lighter-to-darker vertical
// gradient the country-flag node fills already use (see countryFlagPalette
// below), so link bands share that "lit from above" texture instead of a
// flat single-tone stroke.
function shadeHexColor(hex: string, percent: number): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const target = percent < 0 ? 0 : 255;
  const p = Math.min(Math.abs(percent), 1);
  const channel = (shift: number) => {
    const value = (num >> shift) & 0xff;
    return Math.round((target - value) * p) + value;
  };
  const r = channel(16);
  const g = channel(8);
  const b = channel(0);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function safeSvgId(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function countryFlagPalette(countryName: string): [string, string, string] {
  const country = countryName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  if (country.includes("china")) return ["#de2910", "#ffde00", "#de2910"];
  if (country.includes("estados unidos") || country.includes("united states")) return ["#3c3b6e", "#ffffff", "#b22234"];
  if (country.includes("alemanha") || country.includes("germany")) return ["#18181b", "#dd0000", "#ffce00"];
  if (country.includes("espanha") || country.includes("spain")) return ["#aa151b", "#f1bf00", "#aa151b"];
  if (country.includes("taiwan")) return ["#000095", "#ffffff", "#fe0000"];
  if (country.includes("argentina")) return ["#74acdf", "#ffffff", "#74acdf"];
  if (country.includes("brasil") || country.includes("brazil")) return ["#009b3a", "#ffdf00", "#002776"];
  if (country.includes("japao") || country.includes("japan")) return ["#ffffff", "#bc002d", "#ffffff"];
  if (country.includes("coreia") || country.includes("korea")) return ["#ffffff", "#cd2e3a", "#0047a0"];
  if (country.includes("italia") || country.includes("italy")) return ["#009246", "#ffffff", "#ce2b37"];
  if (country.includes("franca") || country.includes("france")) return ["#0055a4", "#ffffff", "#ef4135"];
  if (country.includes("canada")) return ["#d80621", "#ffffff", "#d80621"];
  if (country.includes("marrocos") || country.includes("morocco")) return ["#c1272d", "#006233", "#c1272d"];
  if (country.includes("russia")) return ["#ffffff", "#0039a6", "#d52b1e"];
  if (country.includes("nigeria")) return ["#008751", "#ffffff", "#008751"];
  if (country.includes("bolivia")) return ["#d52b1e", "#f9e300", "#007934"];
  if (country.includes("trinidad") || country.includes("tobago")) return ["#da1a35", "#ffffff", "#000000"];
  if (country.includes("peru")) return ["#d91023", "#ffffff", "#d91023"];
  if (country.includes("mexico")) return ["#006847", "#ffffff", "#ce1126"];
  if (country.includes("chile")) return ["#0039a3", "#ffffff", "#d52b1e"];
  if (country.includes("paraguai") || country.includes("paraguay")) return ["#d52b1e", "#ffffff", "#0038a8"];
  if (country.includes("uruguai") || country.includes("uruguay")) return ["#0038a8", "#ffffff", "#0038a8"];
  if (country.includes("colombia")) return ["#fcd116", "#003893", "#ce1126"];
  if (country.includes("singapura") || country.includes("singapore")) return ["#ed2939", "#ffffff", "#ffffff"];
  if (country.includes("india")) return ["#ff9933", "#ffffff", "#138808"];
  if (country.includes("holanda") || country.includes("paises baixos") || country.includes("netherlands")) return ["#ae1c28", "#ffffff", "#21468b"];
  if (country.includes("portugal")) return ["#006600", "#006600", "#ff0000"];
  if (country.includes("reino unido") || country.includes("united kingdom")) return ["#012169", "#ffffff", "#c8102e"];
  return ["#0e7490", "#67e8f9", "#155e75"];
}

function FlowTooltip({ active, payload }: SankeyTooltipProps) {
  if (!active || !payload?.length) return null;

  const activePayload = payload[0]?.payload;
  if (!activePayload) return null;

  if (!("sourceX" in activePayload)) {
    const node = activePayload.payload;
    if (!node) return null;
    return (
      <div className="max-w-72 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-100 shadow-xl">
        <p className="font-semibold text-white">{node.name}</p>
        <p className="mt-1 text-zinc-500">{nodeKindLabel(node.kind)}</p>
        {node.rawValue !== undefined ? (
          <div className="mt-3">
            <TooltipRow
              label={node.domesticUse ? "Uso interno" : node.tone === "exports" ? "Exportações" : "Importações"}
              value={usdLong.format(node.rawValue)}
              tone={node.domesticUse ? "neutral" : node.tone === "exports" ? "emerald" : "cyan"}
            />
          </div>
        ) : null}
        {node.share !== undefined ? <div className="mt-2"><TooltipRow label="Participação" value={percent.format(node.share)} tone={node.domesticUse ? "neutral" : "emerald"} /></div> : null}
        {node.chokepoint ? (
          <p className="mt-3 rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-2 leading-5 text-red-200">
            {node.kind === "destination" || node.kind === "product"
              ? "Depende de uma etapa a montante com concentração ≥ 90% de origem chinesa — este nó em si não tem essa concentração própria."
              : "Concentração ≥ 90% de origem chinesa neste elo."}
          </p>
        ) : null}
        {node.criticalImport ? (
          <p className="mt-3 rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-2 leading-5 text-red-200">
            Sem produção nacional confirmada nesta etapa — 100% dependente de fornecimento estrangeiro, mesmo quando a concentração por país fica abaixo de 90%.
          </p>
        ) : null}
        {node.lowCarbon ? (
          <p className="mt-3 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2 leading-5 text-emerald-200">
            Rota produtiva de baixo carbono predominante.
          </p>
        ) : null}
        {node.domesticUse ? (
          <p className="mt-3 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 leading-5 text-zinc-300">
            Parcela da produção doméstica que não foi exportada (produção comparável menos exportações do período). Não é um país comprador.
          </p>
        ) : null}
        <p className="mt-3 text-[10px] text-zinc-600">Fonte: {dataSourceLabel(node.tone, node.domesticUse)}</p>
      </div>
    );
  }

  const link = activePayload.payload;
  const reductionCopy = link.alphaApplied
    ? `Alpha aplicado: ${percent.format(link.alpha)} do fluxo bruto aparece na rede.`
    : "Fluxo bruto exibido sem corte proporcional.";

  return (
    <div className="max-w-80 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-100 shadow-xl">
      <p className="font-semibold text-white">{link.flowLabel ?? link.productName}</p>
      <p className="mt-1 text-zinc-400">{link.tone === "exports" ? "Ativo" : "Origem"}: {link.supplierName}</p>
      <div className="mt-3 space-y-2">
        <TooltipRow
          label={link.domesticUse ? "Uso interno" : link.tone === "exports" ? "Exportações" : "Importações"}
          value={usdLong.format(link.rawValue)}
          tone={link.domesticUse ? "neutral" : link.tone === "exports" ? "emerald" : "cyan"}
        />
        {link.share !== undefined ? <TooltipRow label="Participação" value={percent.format(link.share)} tone={link.domesticUse ? "neutral" : "emerald"} /> : null}
        {link.domesticUse ? (
          <p className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 leading-5 text-zinc-300">
            Ficou no Brasil em vez de ser exportado — não é um fluxo comercial internacional.
          </p>
        ) : null}
        {link.routeClass ? (
          <div className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 leading-5">
            <p className="flex items-center gap-1.5 font-semibold text-zinc-200">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ROUTE_CLASS_COLORS[link.routeClass] }} />
              {ROUTE_CLASS_LABELS[link.routeClass]}
            </p>
            {link.routeRationale ? <p className="mt-1 text-zinc-400">{link.routeRationale}</p> : null}
          </div>
        ) : null}
        {link.dataGapReason ? (
          <div className="flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-2 leading-5 text-amber-200/90">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" strokeWidth={1.5} />
            <p>{link.dataGapReason}</p>
          </div>
        ) : null}
        <p className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 leading-5 text-zinc-300">
          {reductionCopy}
        </p>
        <p className="text-[10px] text-zinc-600">Fonte: {dataSourceLabel(link.tone, link.domesticUse)}</p>
      </div>
    </div>
  );
}

function MetricPill({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const content = (
    <>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <strong className="mt-1 block truncate text-sm font-semibold text-zinc-100">{value}</strong>
    </>
  );
  if (!onClick) {
    return (
      <div className="rounded-lg border border-zinc-800/70 bg-white/[0.04] px-3 py-2">
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-zinc-800/70 bg-white/[0.04] px-3 py-2 text-left transition hover:border-cyan-300/30 hover:bg-cyan-400/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    >
      {content}
    </button>
  );
}

function TooltipRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "neutral";
}) {
  const toneClass = tone === "cyan" ? "text-cyan-200" : tone === "neutral" ? "text-zinc-300" : "text-emerald-200";

  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
      <span className="text-zinc-500">{label}</span>
      <strong className={`text-right font-semibold leading-5 ${toneClass}`}>{value}</strong>
    </div>
  );
}

function executiveLabel(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "NCM_SEM_PONTE" || trimmed === "NAO_MAPEADO") return fallback;
  return trimmed;
}

// SVG <text> can't reflow on its own, so long node names (e.g. "Insumos de
// Base (uso industrial doméstico)") need to be split into <tspan> lines
// manually. A character-count heuristic, not real text measurement --
// consistent with this file's existing tradeoffs -- tuned against the
// node label's 12px bold font and the chart's margin.right (see the
// <Sankey> element). Only wraps to two lines; a label that still overflows
// the second line gets an ellipsis there instead of a third line, to keep
// node rows from growing unbounded.
function wrapNodeLabel(value: string): string[] {
  const maxCharsPerLine = 30;
  if (value.length <= maxCharsPerLine) return [value];
  const words = value.split(" ");
  let firstLine = "";
  let splitIndex = 0;
  for (; splitIndex < words.length; splitIndex += 1) {
    const candidate = firstLine ? `${firstLine} ${words[splitIndex]}` : words[splitIndex];
    if (candidate.length > maxCharsPerLine && firstLine) break;
    firstLine = candidate;
  }
  let secondLine = words.slice(splitIndex).join(" ");
  if (!secondLine) return [firstLine];
  if (secondLine.length > maxCharsPerLine) {
    secondLine = `${secondLine.slice(0, maxCharsPerLine - 1).trim()}...`;
  }
  return [firstLine, secondLine];
}

function clampShare(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function visualFlowValue(value: number) {
  return Math.max(Math.pow(Math.log10(value + 10), 3), 1);
}

// Records that `amount` of `label` (a specific solarInputs entry) rolls up
// into node `index`, merging into an existing entry for the same label
// instead of duplicating it (e.g. a supplier node accumulates one entry
// per distinct input, not one per link that touches it).
function addContribution(nodes: SankeyNodeDatum[], index: number, label: string, amount: number) {
  if (amount <= 0) return;
  const list = nodes[index].contributions ?? (nodes[index].contributions = []);
  const existing = list.find((item) => item.label === label);
  if (existing) {
    existing.amount += amount;
  } else {
    list.push({ label, amount });
  }
}

function executiveStageLabel(stage: string) {
  return ({
    extracao: "Base mineral",
    processamento: "Silício metalúrgico",
    refinamento: "Refino solar",
    componentes_avancados: "Componentes avançados",
    produto_final: "Células e módulos",
    molecula_principal: "Moléculas energéticas",
    derivados: "Derivados de baixo carbono",
    aplicacoes_finais: "Combustíveis finais",
    insumos: "Matérias-primas energéticas",
    insumos_tecnologicos: "Insumos tecnológicos",
    equipamentos: "Produção de hidrogênio renovável",
    materias_primas: "Matérias-primas",
    intermediarios: "Intermediários",
    nitrogenados: "Fertilizantes nitrogenados",
    fosfatados: "Fertilizantes fosfatados",
    potassicos: "Fertilizantes potássicos",
    formulacao: "Formulação",
    base_mineral: "Base mineral",
    reducao: "Redução",
    aciaria: "Aciaria e ligas",
    transformacao: "Transformação siderúrgica",
    bens_transicao: "Bens da transição",
  } as Record<string, string>)[stage] ?? stage;
}

function nodeKindLabel(kind: SankeyNodeDatum["kind"]) {
  switch (kind) {
    case "supplier":
      return "Origem principal";
    case "input":
      return "Insumo";
    case "stage":
      return "Etapa produtiva";
    case "destination":
      return "Destino";
    case "product":
      return "Sistema final";
    default:
      return "";
  }
}

// Explains WHAT the node kind is, in plain language -- the card's opening
// "glossary" block, read before any number. Aggregate sinks and Uso
// Interno get their own real definition since "Destino" alone doesn't say
// much for them; everything else gets a definition for its node kind.
function nodeGlossary(kind: SankeyNodeDatum["kind"], tone: Perspective, nodeId: string | undefined): string {
  if (nodeId === "destination:insumos-de-base") {
    return 'Matérias-primas e insumos de aplicação industrial ampla e transversal — servem à cadeia produtiva geral do país, não apenas a esta cadeia específica. Reúne tanto etapas com atividade produtiva real confirmada no Brasil (extração/processamento) quanto insumos sem concentração global de fornecimento identificada, ou seja, sem sinal de risco de monopólio apurado.';
  }
  if (nodeId === "destination:insumos-criticos") {
    return "Insumos essenciais para esta cadeia sem nenhuma capacidade produtiva instalada no Brasil — dependem inteiramente de fornecimento estrangeiro. Este nó reúne esse risco de dependência externa com a herança de uma concentração de fornecimento identificada globalmente para esses insumos, mesmo quando a concentração específica nas importações brasileiras não ultrapassa o limiar de 90% usado no alerta de gargalo.";
  }
  if (nodeId === "destination:uso-interno") {
    return "Representa a parcela da produção nacional que ficou no Brasil para uso ou consumo interno em vez de ser exportada — não é um país comprador.";
  }
  switch (kind) {
    case "supplier":
      return "Identifica o principal país de origem de um insumo ou grupo de insumos desta cadeia, segundo os registros de importação (ComexStat/MDIC).";
    case "input":
      return "Representa um insumo, material ou componente específico rastreado nesta cadeia, a partir dos códigos NCM mapeados para ele.";
    case "stage":
      return "Agrupa os insumos que passam por uma atividade produtiva real confirmada em território brasileiro (ex.: extração, processamento). Etapas sem produção doméstica comprovada não recebem este nó — o fluxo vai direto do insumo ao seu destino.";
    case "destination":
      return tone === "exports"
        ? "Representa um mercado comprador (país de destino) confirmado nos registros de exportação desta cadeia."
        : "Agrupa insumos roteados para esta aplicação doméstica, conforme o mapeamento desta cadeia.";
    case "product":
      return "Agrupa a oferta de produtos acabados desta cadeia, prontos para uso ou instalação — o último elo antes do consumidor final.";
    default:
      return "";
  }
}

// Same purpose as nodeGlossary but for a selected ROUTE (link) -- a route
// has no "kind" of its own, so this is one sentence per perspective
// instead of a branch per node kind.
function routeGlossary(tone: Perspective): string {
  return tone === "exports"
    ? 'Uma rota representa o fluxo de valor de um ativo nacional até seu destino — do beneficiamento no Brasil até o mercado comprador (ou o "Uso Interno") indicado no título, com base nos registros de exportação do período.'
    : "Uma rota representa o fluxo de valor de um insumo entre duas etapas desta cadeia — da origem estrangeira até o destino no Brasil indicado no título, com base nos registros de importação do período.";
}

// Expanded, plain-language readings of each risk/route badge -- the short
// labels already shown on the node itself (renderNode) stay short by
// design; this is where the "why it matters" goes. Chokepoint has two
// readings because destination/product nodes never carry their own
// concentration figure -- see the matching comment in renderNode.
function chokepointGlossaryNote(isPropagated: boolean): string {
  return isPropagated
    ? "Este nó não tem concentração própria: ele recebe insumos de uma etapa a montante com concentração ≥ 90% de origem chinesa. Uma disputa comercial, sanção ou colapso logístico nesse fornecedor dominante se propagaria até aqui."
    : "Concentração de fornecimento ≥ 90% de origem chinesa: quase toda a oferta vem de um único país, criando risco de descontinuidade de suprimento em caso de disputa comercial, sanção ou colapso logístico do fornecedor dominante.";
}

const CRITICAL_IMPORT_GLOSSARY_NOTE = "Sem produção nacional confirmada nesta etapa: 100% da demanda depende de fornecimento estrangeiro, mesmo quando nenhum país isolado ultrapassa 90% de participação — não há capacidade instalada no Brasil para substituir essas importações no curto prazo.";

const LOW_CARBON_GLOSSARY_NOTE = "Rota produtiva de baixo carbono predominante: a produção ou fornecimento predominante deste ativo usa processos ou matriz energética de menor intensidade de carbono, segundo a classificação de rota produtiva desta cadeia.";

const DOMESTIC_USE_GLOSSARY_NOTE = "Esta parcela da produção nacional foi absorvida pelo mercado interno em vez de exportada — não representa um país comprador, e sim consumo/uso doméstico do próprio ativo.";

// Explains HOW the number on the node was calculated -- not just where it
// came from (dataSourceLabel already covers that). The two aggregate sinks
// (insumos-de-base / insumos-criticos) get their exact real routing rule
// spelled out since they're the ones that fan in multiple NCMs/insumos;
// everything else gets a generic sentence for its node kind.
function nodeMethodology(
  kind: SankeyNodeDatum["kind"],
  tone: Perspective,
  nodeId: string | undefined,
  domesticUse?: boolean,
): string {
  const verb = tone === "exports" ? "exportado" : "importado";
  if (nodeId === "destination:insumos-de-base") {
    return 'Soma do valor FOB importado (ComexStat/MDIC) das NCMs classificadas sob o grupo de insumos de base: etapas de extração/processamento com atividade doméstica confirmada, mais insumos de estágios posteriores sem concentração global de fornecimento identificada (ver "Detalhamento de composição" abaixo).';
  }
  if (nodeId === "destination:insumos-criticos") {
    return "Soma do valor FOB importado (ComexStat/MDIC) das NCMs classificadas como insumos críticos: concentração global de fornecimento identificada e sem produção nacional confirmada nesta etapa.";
  }
  if (domesticUse) {
    return "Produção nacional comparável (PRODLIST/IBGE) que não foi exportada no período — produção total do insumo menos o valor exportado (ComexStat/MDIC) de cada um.";
  }
  switch (kind) {
    case "supplier":
      return `Soma do valor FOB ${verb} (ComexStat/MDIC) de todos os insumos desta cadeia cujo principal país de origem é este.`;
    case "input":
      return `Valor FOB ${verb} (ComexStat/MDIC) deste insumo específico no período mapeado.`;
    case "stage":
      return `Soma do valor FOB ${verb} (ComexStat/MDIC) dos insumos desta cadeia classificados nesta etapa produtiva.`;
    case "destination":
      return tone === "exports"
        ? "Soma do valor exportado (ComexStat/MDIC) desta cadeia cujo principal país comprador é este destino."
        : "Soma do valor FOB importado (ComexStat/MDIC) roteado para este agrupamento (ver \"Detalhamento de composição\" abaixo).";
    case "product":
      return `Soma do valor FOB ${verb} (ComexStat/MDIC) dos insumos que chegam à etapa final desta cadeia.`;
    default:
      return "";
  }
}

// Real, structurally-derivable attribution, not invented per node: every
// import/export flow in this Sankey traces back to Comex Stat/MDIC customs
// records; "Uso Interno" additionally draws on domestic_production_value_
// usd_comparable, which comes from the PRODLIST bridge (see
// PRODLIST_COMPARABLE_INPUTS in build_solar_sovereignty_metrics.py) joined
// against IBGE/MDIC production indicators -- not a separate, unlinked claim.
function dataSourceLabel(tone: Perspective, domesticUse?: boolean): string {
  if (domesticUse) return "PRODLIST/IBGE (produção) + ComexStat/MDIC (exportações)";
  return tone === "exports" ? "ComexStat/MDIC (exportações)" : "ComexStat/MDIC (importações)";
}

// The literal expression behind the number, distinct from the plain-
// language methodology sentence above -- "how it's calculated" as a formula,
// not prose. Exports carry an optional PRODLIST term because domestic-use
// nodes/links genuinely add a second source into the same total; imports
// never do (no domestic-retention concept on that side).
function calculationFormula(tone: Perspective, domesticUse?: boolean): string {
  const verb = tone === "exports" ? "exportado" : "importado";
  const base = `Valor FOB ${verb} (ComexStat/MDIC)`;
  const numerator = tone === "exports"
    ? `${base} + parcela retida no mercado interno (PRODLIST/IBGE, quando aplicável)`
    : base;
  return domesticUse
    ? `Produção total comparável (PRODLIST/IBGE) − valor FOB exportado (ComexStat/MDIC) = parcela retida`
    : `${numerator} ÷ total da rede na perspectiva selecionada = participação (%) exibida acima`;
}

// Same "YYYY-Hn" -> "Mês-Mês YYYY" convention already used by
// ChainSelectionLanding's formatPeriod -- kept as a local copy since this
// file has no shared formatting module, but must render the same real
// value (e.g. build_solar_sovereignty_metrics.py's "2026-H1"), not a
// separate invented date range. Falls back to the raw string for any
// period that doesn't match the H1/H2 convention (e.g. a bare year),
// rather than hiding or guessing at it.
function formatReferencePeriod(referencePeriod: string): string {
  const match = /^(\d{4})-H([12])$/.exec(referencePeriod);
  if (!match) return referencePeriod;
  const [, year, half] = match;
  return half === "1" ? `Jan-Jun ${year}` : `Jul-Dez ${year}`;
}

// Which official bases were actually consulted for THIS figure, as a list
// instead of one packed sentence -- same underlying facts as
// dataSourceLabel, just broken out per source so each can carry its own
// scope note in the UI. Each source line also carries the exact extraction
// window it was pulled from -- omitted (not guessed) when the chain's
// response didn't provide one.
function evidenceSources(tone: Perspective, domesticUse?: boolean, referencePeriod?: string): string[] {
  const periodTag = referencePeriod ? ` [Recorte: ${formatReferencePeriod(referencePeriod)}]` : "";
  const sources = [
    (tone === "exports"
      ? "ComexStat/MDIC — fluxo de exportação declarado (valor FOB, por NCM)"
      : "ComexStat/MDIC — fluxo de importação declarado (valor FOB, por NCM)") + periodTag,
  ];
  if (domesticUse) {
    sources.push(`PRODLIST/IBGE — produção industrial comparável (capacidade nacional declarada)${periodTag}`);
  }
  return sources;
}

// Interpretive paragraph synthesizing the flags/fields already computed for
// this node or link into one sentence-level reading -- no field here is
// invented for the summary; every clause gates on a real value already
// present on the subject (amount, share, tone, routeClass, chokepoint,
// criticalImport, lowCarbon, domesticUse).
function routeExecutiveSummary(subject: {
  title: string;
  amount: number;
  share?: number;
  tone: Perspective;
  kindLabel: string;
  domesticUse?: boolean;
  routeClass?: ProductionRouteClass;
  chokepoint?: boolean;
  criticalImport?: boolean;
  lowCarbon?: boolean;
}): string {
  const shareText = subject.share !== undefined
    ? ` (${percent.format(subject.share)} da rede na perspectiva selecionada)`
    : "";
  let sentence = `"${subject.title}" moveu ${usdCompact.format(subject.amount)}${shareText} no período mapeado pelo comércio exterior brasileiro.`;

  if (subject.domesticUse) {
    sentence += " Esta parcela ficou retida no mercado interno em vez de ser exportada — não representa um comprador estrangeiro confirmado.";
  } else if (subject.tone === "exports") {
    sentence += " Representa produção nacional colocada em mercado comprador confirmado pelos registros de comércio exterior.";
  } else {
    sentence += ` Representa dependência de fornecimento externo para ${subject.kindLabel.toLowerCase()}.`;
  }

  if (subject.chokepoint) {
    sentence += " Este fluxo está associado a uma concentração de fornecimento ≥ 90% de origem chinesa.";
  }
  if (subject.criticalImport) {
    sentence += " Não há produção nacional confirmada para este insumo nesta etapa.";
  }
  if (subject.lowCarbon || subject.routeClass === "low_carbon_dominant") {
    sentence += " Rota produtiva de baixo carbono predominante confirmada para este ativo.";
  }
  return sentence;
}

// Resolves a Sankey node id or link highlightId back to the display stage
// label MainAnalyticalDashboard's onAnalysisFocus handler expects (matches
// sectorStageLabel there field-for-field) -- so clicking a Sankey node/link
// and clicking an AipnetSystemsFlow node land on the same filtered view.
function resolveFocusStage(rawId: string, solarInputs: SolarInputMetric[]): string {
  // route:eaf/route:dri are aço-specific export-topology overrides (see
  // EXPORT_ROUTE_NODE_OVERRIDES) that don't correspond to a real
  // input.stage value, so they fall outside the generic stage-key
  // resolution below -- both are part of the reduction/aciaria macro-stage.
  if (rawId === "route:eaf" || rawId === "route:dri" || rawId.startsWith("export-stage:route:")) {
    return executiveStageLabel("reducao");
  }
  const stageKey = rawId.startsWith("stage:")
    ? rawId.slice(6)
    : rawId.startsWith("export-stage:")
      ? rawId.slice(13)
      : null;
  if (stageKey) return executiveStageLabel(stageKey);
  const inputId = rawId.startsWith("input:") ? rawId.slice(6) : rawId;
  const input = solarInputs.find((item) => item.input_id === inputId);
  return input ? executiveStageLabel(input.stage) : "";
}

function nodeFill(kind: SankeyNodeDatum["kind"], tone: Perspective) {
  if (tone === "imports") {
    if (kind === "supplier") return "#38bdf8";
    if (kind === "input") return "#f59e0b";
    if (kind === "stage") return "#a78bfa";
    if (kind === "destination") return "#f97316";
    return "#ef4444";
  }
  if (kind === "input") return "#34d399";
  if (kind === "stage") return "#10b981";
  if (kind === "destination") return "#2dd4bf";
  return "#34d399";
}

// Physical/economic sequence of each chain's production stages, keyed by the
// raw `stage` value from the input data. Recharts' Sankey (with sort={false})
// stacks same-column nodes in array order, and stage nodes get created in
// whichever order their first (highest-value) input is processed -- not in
// production sequence. Unknown stages sort last instead of erroring.
const STAGE_PHYSICAL_ORDER: Record<string, number> = {
  // Silicio
  extracao: 1, processamento: 2, refinamento: 3, componentes_avancados: 4, produto_final: 5,
  // Aco
  base_mineral: 1, reducao: 2, aciaria: 3, transformacao: 4, bens_transicao: 5,
  // Fertilizantes
  materias_primas: 1, intermediarios: 2, nitrogenados: 2, fosfatados: 2, potassicos: 2, formulacao: 3,
  // Combustiveis de transicao
  insumos: 1, molecula_principal: 2, derivados: 2, insumos_tecnologicos: 2, equipamentos: 2, aplicacoes_finais: 3,
};

function stagePhysicalOrder(nodeId: string): number {
  const key = nodeId.startsWith("stage:") ? nodeId.slice(6) : "";
  return STAGE_PHYSICAL_ORDER[key] ?? 99;
}

// Recharts (sort={false}) stacks same-column nodes in array order, so this
// reindexes each column once at the end of a topology build: "stage" nodes
// keep the physical production sequence (extração before refino before
// produto final -- STAGE_PHYSICAL_ORDER), every other kind sorts by value
// descending so the largest flows in each column line up straight across
// the network instead of criss-crossing through smaller ones drawn first.
function reorderSankeyNodes(data: SankeyChartData): SankeyChartData {
  const slotsByKind = new Map<SankeyNodeDatum["kind"], { node: SankeyNodeDatum; index: number }[]>();
  data.nodes.forEach((node, index) => {
    const list = slotsByKind.get(node.kind) ?? [];
    list.push({ node, index });
    slotsByKind.set(node.kind, list);
  });

  const newNodes = [...data.nodes];
  slotsByKind.forEach((slots, kind) => {
    if (slots.length < 2) return;
    const ordered = [...slots]
      .sort((a, b) => {
        if (kind === "stage") return stagePhysicalOrder(a.node.id) - stagePhysicalOrder(b.node.id);
        const routeRankA = a.node.routeClass ? ROUTE_CLASS_RANK[a.node.routeClass] : -1;
        const routeRankB = b.node.routeClass ? ROUTE_CLASS_RANK[b.node.routeClass] : -1;
        if (routeRankA !== routeRankB) return routeRankA - routeRankB;
        return (b.node.rawValue ?? 0) - (a.node.rawValue ?? 0);
      })
      .map(({ node }) => node);
    slots.forEach(({ index: slot }, i) => {
      newNodes[slot] = ordered[i];
    });
  });

  const idByOldIndex = data.nodes.map((node) => node.id);
  const newIndexById = new Map(newNodes.map((node, index) => [node.id, index]));

  const links = data.links.map((link) => ({
    ...link,
    source: newIndexById.get(idByOldIndex[link.source]) ?? link.source,
    target: newIndexById.get(idByOldIndex[link.target]) ?? link.target,
  }));

  return { nodes: newNodes, links, summary: data.summary };
}

// Recharts derives each link's React key from `link-${source}-${target}-
// ${value}` (see recharts' Sankey renderLinks) -- so two DISTINCT link
// entries that happen to connect the same node PAIR collide into duplicate
// keys and log "two children with the same key" (React can't tell them
// apart, and only renders one). This happens whenever several small inputs
// collapse into the same long-tail bucket node (e.g. "Outros Insumos" /
// "Outros Fornecedores") AND also land on the same downstream sink via a
// tier-bypass branch (critical/final import routing, or the exports
// destination/"Uso Interno" bypass) -- each collapsed input still pushes
// its own link instead of being folded into the one edge that visually
// represents that node pair, unlike the stageTotals/stageDestinationTotals
// aggregations elsewhere in these builders, which already merge correctly.
// Run once at the very end so every builder gets this guarantee regardless
// of which branch produced the parallel links, instead of hunting down and
// hand-aggregating every bypass site individually.
function mergeParallelLinks(links: SankeyLinkDatum[]): SankeyLinkDatum[] {
  const groups = new Map<string, SankeyLinkDatum[]>();
  links.forEach((link) => {
    const key = `${link.source}:${link.target}`;
    const group = groups.get(key);
    if (group) group.push(link);
    else groups.set(key, [link]);
  });

  return Array.from(groups.entries()).map(([key, group]) => {
    if (group.length === 1) return group[0];
    const [first] = group;
    return {
      ...first,
      id: `merged:${key}`,
      highlightId: `merged:${key}`,
      value: group.reduce((sum, link) => sum + link.value, 0),
      rawValue: group.reduce((sum, link) => sum + link.rawValue, 0),
      share: group.reduce((sum, link) => sum + (link.share ?? 0), 0),
      alphaApplied: group.some((link) => link.alphaApplied),
      alpha: Math.min(...group.map((link) => link.alpha)),
    };
  });
}

// Threshold (share of imports / global capacity concentrated in China) above
// which a node/link is flagged as a sovereignty chokepoint and gets the
// pulsing red treatment in the Imports perspective.
const CHOKEPOINT_THRESHOLD = 0.9;

// Below this USD value, a single spot shipment (lab sample, test batch,
// one-off reexport) can be the entire recorded trade flow for an input in
// the period -- flagged in the metrics drawer so it doesn't read as active
// production/export capacity. Exported so other "biggest exposure"/"only
// bottleneck" selections (AipnetSystemsFlow's topExposure,
// MainAnalyticalDashboard's maxHhiProduct/headerNcmShortcuts) apply the same
// floor instead of letting a sample-scale flow win a ranking by percentage
// alone -- e.g. ferro-esponja's 83.5% "China share" comes from a $3,559
// total import base, ferro-gusa's 96.5% "only >=90% chokepoint" comes from a
// $37.5k spot shipment.
export const SAMPLE_SHIPMENT_THRESHOLD_USD = 100_000;

// Physical order (see STAGE_PHYSICAL_ORDER) up to which a stage has
// confirmed real domestic activity worth drawing as its own "Etapa
// produtiva" node -- extração/processamento only. Shared between imports
// and exports so a stage like "Refino solar" (no domestic refining
// capacity in either direction of trade) doesn't get a real-looking
// intermediate node on one perspective and correctly skip it on the other.
const BASE_MATERIAL_STAGE_ORDER_THRESHOLD = 2;

function importAccentColor(chinaShare: number) {
  if (chinaShare >= CHOKEPOINT_THRESHOLD) return "#ef4444";
  if (chinaShare >= 0.7) return "#f97316";
  return "#f59e0b";
}

function exportAccentColor(isLowCarbon: boolean) {
  return isLowCarbon ? "#10b981" : "#34d399";
}

// Neutral, deliberately not emerald/turquoise: "Uso Interno" isn't a real
// trading partner, so it shouldn't visually read as one alongside actual
// buyer countries even though it now shares the same width/share scale.
const DOMESTIC_USE_COLOR = "#71717a";

// Exported so other components (e.g. CarbonFootprintIndustrialBlock) reuse
// the same color/label dictionary instead of hardcoding a second copy that
// can drift out of sync with this one.
export const ROUTE_CLASS_COLORS: Record<ProductionRouteClass, string> = {
  fossil_dominant: "#f87171",
  transition_underway: "#f59e0b",
  low_carbon_dominant: "#34d399",
  untapped_potential: "#38bdf8",
  undetermined: "#71717a",
};

export const ROUTE_CLASS_LABELS: Record<ProductionRouteClass, string> = {
  fossil_dominant: "Fóssil dominante",
  transition_underway: "Transição em curso",
  low_carbon_dominant: "Baixo carbono predominante",
  untapped_potential: "Potencial não realizado",
  undetermined: "Rota indeterminada",
};

// Vertical grouping key for reorderSankeyNodes when the route-coloring lens
// is on: same-category nodes sort together (matching this fixed legend
// order) instead of being interleaved by raw value alone, so same-colored
// bands land close to each other instead of crossing all over the chart.
const ROUTE_CLASS_RANK: Record<ProductionRouteClass, number> = Object.fromEntries(
  (Object.keys(ROUTE_CLASS_LABELS) as ProductionRouteClass[]).map((key, index) => [key, index]),
) as Record<ProductionRouteClass, number>;

function routeClassColor(routeClass?: ProductionRouteClass | null): string {
  return routeClass ? ROUTE_CLASS_COLORS[routeClass] : ROUTE_CLASS_COLORS.undetermined;
}

function dominantRoute(weights: Map<ProductionRouteClass, number> | undefined): ProductionRouteClass | null {
  if (!weights || !weights.size) return null;
  let best: ProductionRouteClass | null = null;
  let bestValue = -Infinity;
  weights.forEach((value, key) => {
    if (value > bestValue) {
      bestValue = value;
      best = key;
    }
  });
  return best;
}

function dominantRouteFromInputs(inputs: SolarInputMetric[], stage?: string): ProductionRouteClass | null {
  const scoped = stage ? inputs.filter((input) => input.stage === stage) : inputs;
  const weights = new Map<ProductionRouteClass, number>();
  scoped.forEach((input) => {
    const weight = Math.max(input.imports_value_usd, input.exports_value_usd, 1);
    weights.set(input.production_route_class, (weights.get(input.production_route_class) ?? 0) + weight);
  });
  return dominantRoute(weights);
}

// Perspectiva A -- "Vulnerabilidade e Importações": País de origem -> insumo
// crítico -> etapa/aplicação industrial no Brasil. Largura e cor sempre
// ancoradas em imports_value_usd; nunca mistura dado de exportação na mesma
// topologia (ver Nota de Escopo Comercial exibida ao usuário).
function buildImportsTopology(
  solarInputs: SolarInputMetric[],
  chainName: string | undefined,
  routeColoring: boolean,
): SankeyChartData {
  const nodes: SankeyNodeDatum[] = [];
  const links: SankeyLinkDatum[] = [];
  const nodeIndex = new Map<string, number>();

  function ensureNode(id: string, name: string, kind: SankeyNodeDatum["kind"]) {
    const existing = nodeIndex.get(id);
    if (existing !== undefined) return existing;
    const nextIndex = nodes.length;
    nodeIndex.set(id, nextIndex);
    nodes.push({ id, name, kind, tone: "imports" });
    return nextIndex;
  }

  const solarImportTotal = solarInputs.reduce((sum, input) => sum + input.imports_value_usd, 0);
  const stageTotals = new Map<string, { index: number; value: number; raw: number; chokepoint: boolean }>();
  const supplierTotals = new Map<string, number>();

  solarInputs.forEach((input) => {
    const supplierName = input.top_supplier?.country_name ?? "Origem não informada";
    supplierTotals.set(supplierName, (supplierTotals.get(supplierName) ?? 0) + Math.max(input.imports_value_usd, 0));
  });

  // Suppliers whose combined share is under 0.1% of the chain's total imports add
  // visual noise as standalone nodes without adding decision-relevant signal --
  // collapse them into a single "Outros Fornecedores" node instead.
  const LONG_TAIL_SHARE_THRESHOLD = 0.001;
  const OTHER_SUPPLIERS_LABEL = "Outros Fornecedores";
  const longTailSuppliers = new Set(
    [...supplierTotals.entries()]
      .filter(([, value]) => value / Math.max(solarImportTotal, 1) < LONG_TAIL_SHARE_THRESHOLD)
      .map(([name]) => name),
  );
  const resolveSupplierName = (name: string) => (longTailSuppliers.has(name) ? OTHER_SUPPLIERS_LABEL : name);

  // Inputs under 0.5% of the chain's total imports AND carrying no
  // chokepoint signal collapse into a single "Outros Insumos" node --
  // but a real concentration risk (e.g. Wafers at a small dollar amount
  // but 97% China) must never disappear into that bucket just because its
  // FOB value is small. Severity, not dollar size, is what this tool
  // exists to surface, so chokepoint inputs are always exempt regardless
  // of value.
  const INPUT_LONG_TAIL_SHARE_THRESHOLD = 0.005;
  const OTHER_INPUTS_LABEL = "Outros Insumos";
  const collapsibleInputIds = new Set(
    solarInputs
      .filter((input) => {
        const chinaShare = input.global_china_share ?? input.china_share_brazilian_imports ?? 0;
        if (chinaShare >= CHOKEPOINT_THRESHOLD) return false;
        const share = Math.max(input.imports_value_usd, 0) / Math.max(solarImportTotal, 1);
        return share < INPUT_LONG_TAIL_SHARE_THRESHOLD;
      })
      .map((input) => input.input_id),
  );

  const orderedSolarInputs = [...solarInputs].sort((left, right) =>
    (supplierTotals.get(right.top_supplier?.country_name ?? "Origem não informada") ?? 0)
    - (supplierTotals.get(left.top_supplier?.country_name ?? "Origem não informada") ?? 0)
    || right.imports_value_usd - left.imports_value_usd
    || left.label.localeCompare(right.label, "pt-BR"),
  );

  // Terminal-group setup lives here, before the per-input loop, so the loop
  // can decide -- per input -- whether to route through a "stage" node at
  // all. Generic (non-fertilizer, non-transition-fuel) chains only keep
  // that hop for the Base tier (extração/processamento, e.g. Quartzo/
  // Si-GM), where there's a real physical activity in Brazil to show. For
  // Critical and Final tier inputs (Wafers, Módulos, Polissilício...) the
  // item enters the country already finished or as a raw chokepoint
  // commodity -- routing it through a node labeled "Etapa produtiva" would
  // draw a domestic processing step that doesn't exist, so those go
  // straight from the imported input to their real destination bucket.
  const isFertilizerChain = /fertiliz/i.test(chainName ?? "");
  const isTransitionFuelChain = /combustíveis de transição|combustiveis de transicao/i.test(chainName ?? "");
  const isSteelChain = /aço|aco e materiais/i.test(chainName ?? "");
  // Prefer the real end-of-chain product (stage "produto_final", e.g.
  // "Módulos fotovoltaicos") over a generic system label when the data
  // actually names one -- a synthetic "Sistema solar fotovoltaico"
  // fallback isn't the real product the chain produces. Several inputs
  // can share stage "produto_final" (modules, frames, glass, cells all
  // land in "produto_final" for silicio) -- take only the highest-value
  // one instead of joining every label.
  const finalProductInputs = solarInputs
    .filter((input) => input.stage === "produto_final")
    .sort((left, right) => right.imports_value_usd - left.imports_value_usd);
  const realFinalProductName = finalProductInputs[0]?.label ?? null;
  const finalSystemName = isFertilizerChain
    ? "Oferta nacional de fertilizantes"
    : isTransitionFuelChain
      ? "Usos finais dos combustíveis de transição"
      : realFinalProductName ?? chainName ?? "Sistema solar fotovoltaico";
  // Generic (non-fertilizer, non-transition-fuel) chains route each INPUT
  // (not each whole stage) into one of three terminal groups -- confirmed
  // against the silicio chain's own data:
  //   - Base (order <= 2, extração/processamento, e.g. "Base mineral",
  //     "Silício metalúrgico"): genuinely domestic-capable raw material.
  //     Also catches inputs from later stages that have no sourced global
  //     concentration figure (e.g. Hidrogênio de alta pureza, Ácido
  //     clorídrico -- generic industrial chemicals whose NCM basket isn't
  //     solar-exclusive, see SOLAR_INPUTS in
  //     build_solar_sovereignty_metrics.py) -- these are support material
  //     for a process, not a verified monopoly risk.
  //   - Critical imports (middle stages, but only inputs that DO carry a
  //     sourced global_china_share, e.g. Polissilício at 0.85 -- just
  //     under the 0.9 chokepoint badge threshold -- and Wafers at 0.95):
  //     no confirmed domestic capacity for that specific input.
  //   - Final (the last stage present, e.g. "produto_final"/"Módulos
  //     fotovoltaicos"): the only tier that reaches the finished-system
  //     node -- this is genuinely the assembled/final good.
  // Routing whole stages together previously let a stage's dominant
  // chokepoint input (e.g. Wafers) drag along its low-risk neighbors (a
  // support chemical with a different-country supplier) into the same
  // "critical" framing, and let Base/Critical inputs reach the same
  // terminal node as the finished system, implying domestic integration
  // ("Brasil refina e aplica em módulos") that isn't real.
  const isGenericChain = !isFertilizerChain && !isTransitionFuelChain;
  // Renamed from "Insumos de Base" -- for aço, this sink is populated
  // exclusively by aciaria-stage alloys/components (ferro-nióbio, eletrodos
  // de grafite, refratários, ferroligas remanescentes), not raw base
  // materials -- those already have their own real "Base mineral" stage
  // node. Calling both "base" sets them side by side in the diagram, implying
  // the same category, when this one's only defining trait is the absence
  // of a confirmed >=90% concentration signal, not being a raw commodity.
  const BASE_MATERIAL_LABEL = "Insumos de Processo (sem concentração crítica confirmada)";
  const CRITICAL_IMPORT_LABEL = "Insumos Críticos Importados (sem produção nacional)";
  const maxStageOrder = Math.max(0, ...solarInputs.map((input) => stagePhysicalOrder(`stage:${input.stage}`)));
  const importRoutingTier = (input: SolarInputMetric): "base" | "critical" | "final" => {
    const order = stagePhysicalOrder(`stage:${input.stage}`);
    if (order <= BASE_MATERIAL_STAGE_ORDER_THRESHOLD) return "base";
    if (order >= maxStageOrder) return "final";
    // Aço's "transformação" stage (laminados a quente/frio) is a near-
    // finished commercial steel product, not a base material feeding
    // further domestic steel processing -- unlike silício's order-3/4
    // support chemicals (ácido clorídrico, hidrogênio de alta pureza), which
    // genuinely are inputs consumed mid-process, not the product itself.
    // Without this, e.g. laminados imported from Coreia do Sul land in
    // "Insumos de Base (uso industrial doméstico)" alongside minério de
    // ferro, implying they're raw material Brazil further transforms, when
    // they're actually the (semi-)finished good.
    if (isSteelChain && order === maxStageOrder - 1) return "final";
    return input.global_china_share !== null ? "critical" : "base";
  };

  const finishedSystemRawValue = isGenericChain
    ? solarInputs
        .filter((input) => importRoutingTier(input) === "final")
        .reduce((sum, input) => sum + Math.max(input.imports_value_usd, 0), 0)
    : solarImportTotal;
  const finalIndex = ensureNode("product:chain-system", finalSystemName, "product");
  nodes[finalIndex].rawValue = finishedSystemRawValue;
  nodes[finalIndex].share = finishedSystemRawValue / Math.max(solarImportTotal, 1);
  const integrationIndex = isFertilizerChain
    ? ensureNode("integration:fertilizer-production", "Produção e formulação de fertilizantes", "stage")
    : finalIndex;
  if (isFertilizerChain) {
    nodes[integrationIndex].rawValue = solarImportTotal;
    nodes[integrationIndex].share = 1;
    solarInputs.forEach((input) => {
      addContribution(nodes, integrationIndex, input.label, Math.max(input.imports_value_usd, 0));
      addContribution(nodes, finalIndex, input.label, Math.max(input.imports_value_usd, 0));
    });
  } else if (!isGenericChain) {
    // Transition-fuel chains: finalIndex == finishedSystemRawValue == solarImportTotal
    // directly (no separate integration hop), so the finished-system node's
    // composition is simply every input in the chain.
    solarInputs.forEach((input) =>
      addContribution(nodes, finalIndex, input.label, Math.max(input.imports_value_usd, 0)));
  }

  let chokepointInputCount = 0;

  orderedSolarInputs.forEach((input) => {
    const supplierName = resolveSupplierName(input.top_supplier?.country_name ?? "Origem não informada");
    const rawValue = Math.max(input.imports_value_usd, 0);
    const chinaShare = input.global_china_share ?? input.china_share_brazilian_imports ?? 0;
    // global_china_share is a real structural figure (e.g. "China holds 97%
    // of world wafer capacity") that legitimately overrides materiality --
    // that risk is real even if Brazil's own purchases are tiny or zero
    // right now. But when it's null, chinaShare above has fallen back to
    // china_share_brazilian_imports, which is just Brazil's own measured
    // sample -- and an unqualified sample can be a single one-off shipment
    // (e.g. ferro_gusa's 96.9% China share here comes from a $42,318 total
    // import base, a rounding error next to the chain's ~US$2bi in
    // carvão mineral e coque). Without the materiality floor in that
    // fallback case, a stage node overwhelmingly fed by one country (here,
    // ~70% of the chain's import value from the US) can still inherit a
    // "≥90% China" badge from an unrelated, statistically meaningless
    // shipment buried in the same stage -- exactly the same materiality
    // problem isSupplierChokepoint below already guards against, just not
    // yet applied to the input/stage/sink badge.
    const isChokepoint = input.global_china_share !== null && input.global_china_share !== undefined
      ? chinaShare >= CHOKEPOINT_THRESHOLD
      : chinaShare >= CHOKEPOINT_THRESHOLD && rawValue >= SAMPLE_SHIPMENT_THRESHOLD_USD;
    // global_china_share is a structural figure independent of who Brazil
    // actually bought from (e.g. Wafers can be ~97% China-concentrated
    // globally while Brazil's own customs record a different top_supplier,
    // like a reseller) -- badging that SUPPLIER node with "China" risk
    // would mislabel whichever country Brazil's data actually names. The
    // supplier node only earns the badge from Brazil's own measured
    // concentration (china_share_brazilian_imports), which is China's
    // share specifically -- if that alone crosses the threshold,
    // top_supplier is China by construction, no name string-matching
    // needed. The input/stage/sink nodes still use the broader
    // (global-preferring) isChokepoint, since the input itself can be a
    // genuine monopoly risk even when Brazil's tiny import sample doesn't
    // show it -- now gated by the same materiality floor whenever that
    // broader reading is itself just Brazil's own small sample.
    // Unlike isChokepoint above, this has no global_china_share fallback --
    // it's entirely Brazil's own import sample, so it needs the materiality
    // floor directly (e.g. ferro-esponja's 83.5% China share comes from a
    // $3,559 total import base for the whole half-year).
    const isSupplierChokepoint = (input.china_share_brazilian_imports ?? 0) >= CHOKEPOINT_THRESHOLD
      && rawValue >= SAMPLE_SHIPMENT_THRESHOLD_USD;
    if (isChokepoint) chokepointInputCount += 1;
    const value = visualFlowValue(rawValue);
    const source = ensureNode(`supplier:${supplierName}`, supplierName, "supplier");
    const inputNode = collapsibleInputIds.has(input.input_id)
      ? ensureNode("input:outros-insumos", OTHER_INPUTS_LABEL, "input")
      : ensureNode(`input:${input.input_id}`, input.label, "input");
    const color = routeColoring ? routeClassColor(input.production_route_class) : importAccentColor(chinaShare);
    const share = rawValue / Math.max(solarImportTotal, 1);

    nodes[source].rawValue = (nodes[source].rawValue ?? 0) + rawValue;
    nodes[source].share = (nodes[source].rawValue ?? 0) / Math.max(solarImportTotal, 1);
    if (isSupplierChokepoint) nodes[source].chokepoint = true;
    addContribution(nodes, source, input.label, rawValue);
    nodes[inputNode].rawValue = (nodes[inputNode].rawValue ?? 0) + rawValue;
    nodes[inputNode].share = (nodes[inputNode].rawValue ?? 0) / Math.max(solarImportTotal, 1);
    if (isChokepoint) nodes[inputNode].chokepoint = true;
    addContribution(nodes, inputNode, input.label, rawValue);

    links.push({
      id: `supplier-input:${input.input_id}`, highlightId: input.input_id,
      source, target: inputNode, value, rawValue, tone: "imports", color,
      alpha: 1, alphaApplied: false, supplierName, productName: input.label,
      flowLabel: `${supplierName} → ${input.label}`, share,
      routeClass: input.production_route_class, routeRationale: input.production_route_rationale,
      dataGapReason: input.data_gap_reason ?? undefined,
    });

    const tier = isGenericChain ? importRoutingTier(input) : "base";
    // Whether an input gets an "Etapa produtiva" hop is a SEPARATE question
    // from which sink it routes to (tier). tier only asks "is this a
    // verified monopoly risk" -- an input can fail that check (diversified
    // suppliers, e.g. Hidrogênio de alta pureza, Ácido clorídrico) and
    // still have zero confirmed domestic processing. Brazil does not
    // refine solar-grade polysilicon at any scale, so routing those
    // support chemicals through a node labeled "Refino solar" would keep
    // implying a fabrication step that doesn't exist, just under the
    // "safe" tier instead of the "critical" one. Only physical order <= 2
    // (extração/processamento -- confirmed real activity, see the exports
    // perspective's domestic_production_value_usd_comparable for
    // Quartzo/Si-GM) earns the stage hop; everything past it -- critical
    // or not -- flows straight from input to its tier's sink.
    const hasRealDomesticStage = isGenericChain
      ? stagePhysicalOrder(`stage:${input.stage}`) <= BASE_MATERIAL_STAGE_ORDER_THRESHOLD
      : true;

    if (!hasRealDomesticStage) {
      const targetIndex = tier === "final"
        ? finalIndex
        : tier === "critical"
          ? ensureNode("destination:insumos-criticos", CRITICAL_IMPORT_LABEL, "destination")
          : ensureNode("destination:insumos-de-base", BASE_MATERIAL_LABEL, "destination");
      const targetName = tier === "final" ? finalSystemName : tier === "critical" ? CRITICAL_IMPORT_LABEL : BASE_MATERIAL_LABEL;
      if (tier !== "final") {
        nodes[targetIndex].rawValue = (nodes[targetIndex].rawValue ?? 0) + rawValue;
        nodes[targetIndex].share = (nodes[targetIndex].rawValue ?? 0) / Math.max(solarImportTotal, 1);
        if (isChokepoint) nodes[targetIndex].chokepoint = true;
        if (tier === "critical") nodes[targetIndex].criticalImport = true;
      }
      addContribution(nodes, targetIndex, input.label, rawValue);
      links.push({
        id: `input-final:${input.input_id}`, highlightId: input.input_id,
        source: inputNode, target: targetIndex, value, rawValue, tone: "imports", color,
        alpha: 1, alphaApplied: false, supplierName, productName: targetName,
        flowLabel: `${input.label} → ${targetName}`, share,
        routeClass: input.production_route_class, routeRationale: input.production_route_rationale,
        dataGapReason: input.data_gap_reason ?? undefined,
      });
      return;
    }

    // Real domestic stage (order <= 2, or non-generic chains): keep the
    // "etapa produtiva" hop -- there's genuine physical activity in Brazil.
    const stageName = executiveStageLabel(input.stage);
    const stageNode = ensureNode(`stage:${input.stage}`, stageName, "stage");
    nodes[stageNode].rawValue = (nodes[stageNode].rawValue ?? 0) + rawValue;
    nodes[stageNode].share = (nodes[stageNode].rawValue ?? 0) / Math.max(solarImportTotal, 1);
    if (isChokepoint) nodes[stageNode].chokepoint = true;
    addContribution(nodes, stageNode, input.label, rawValue);

    links.push({
      id: `input-stage:${input.input_id}`, highlightId: input.input_id,
      source: inputNode, target: stageNode, value, rawValue, tone: "imports", color,
      alpha: 1, alphaApplied: false, supplierName, productName: input.label,
      flowLabel: `${input.label} → ${stageName}`, share,
      routeClass: input.production_route_class, routeRationale: input.production_route_rationale,
      dataGapReason: input.data_gap_reason ?? undefined,
    });

    const total = stageTotals.get(input.stage) ?? { index: stageNode, value: 0, raw: 0, chokepoint: false };
    total.value += value;
    total.raw += rawValue;
    total.chokepoint = total.chokepoint || isChokepoint;
    stageTotals.set(input.stage, total);
  });

  // Whatever reaches here went through a real stage hop -- transition-fuel
  // and fertilizer stages (unchanged), or a generic chain's Base tier only
  // (Critical/Final now bypass the stage node entirely, see the loop
  // above), so this no longer needs to fan a single stage across tiers.
  stageTotals.forEach((total, stage) => {
    const destinationName = isTransitionFuelChain ? transitionFuelDestination(stage) : null;
    const destinationIndex = destinationName
      ? ensureNode(`destination:${stage}`, destinationName, "destination")
      : isFertilizerChain
        ? integrationIndex
        : ensureNode("destination:insumos-de-base", BASE_MATERIAL_LABEL, "destination");
    if (destinationName || !isFertilizerChain) {
      nodes[destinationIndex].rawValue = (nodes[destinationIndex].rawValue ?? 0) + total.raw;
      nodes[destinationIndex].share = (nodes[destinationIndex].rawValue ?? 0) / Math.max(solarImportTotal, 1);
      if (total.chokepoint) nodes[destinationIndex].chokepoint = true;
      solarInputs
        .filter((input) => input.stage === stage)
        .forEach((input) => addContribution(nodes, destinationIndex, input.label, Math.max(input.imports_value_usd, 0)));
    } else if (total.chokepoint) {
      nodes[integrationIndex].chokepoint = true;
    }
    const stageColor = routeColoring
      ? routeClassColor(dominantRouteFromInputs(solarInputs, stage))
      : total.chokepoint ? "#ef4444" : "#f59e0b";
    const targetName = isFertilizerChain
      ? "Produção e formulação de fertilizantes"
      : destinationName ?? BASE_MATERIAL_LABEL;
    links.push({
      id: `stage-final:${stage}`, highlightId: `stage:${stage}`,
      source: total.index, target: destinationIndex, value: total.value, rawValue: total.raw,
      tone: "imports", color: stageColor,
      alpha: 1, alphaApplied: false, supplierName: "Múltiplas origens",
      productName: targetName,
      flowLabel: `${executiveStageLabel(stage)} → ${targetName}`,
      share: total.raw / Math.max(solarImportTotal, 1),
    });
    if (destinationName) {
      links.push({
        id: `destination-final:${stage}`, highlightId: `destination:${stage}`,
        source: destinationIndex, target: finalIndex, value: total.value, rawValue: total.raw,
        tone: "imports", color: stageColor,
        alpha: 1, alphaApplied: false, supplierName: "Múltiplas origens",
        productName: finalSystemName, flowLabel: `${destinationName} → ${finalSystemName}`,
        share: total.raw / Math.max(solarImportTotal, 1),
      });
    }
  });

  const finalIndexChokepoint = isGenericChain
    ? solarInputs.some((input) => {
        if (importRoutingTier(input) !== "final") return false;
        const chinaShare = input.global_china_share ?? input.china_share_brazilian_imports ?? 0;
        return chinaShare >= CHOKEPOINT_THRESHOLD;
      })
    : [...stageTotals.values()].some((total) => total.chokepoint);
  if (finalIndexChokepoint) {
    nodes[finalIndex].chokepoint = true;
  }

  if (isFertilizerChain) {
    const chainRoute = dominantRouteFromInputs(solarInputs);
    links.push({
      id: "integration-final:fertilizers", highlightId: "integration:fertilizers",
      source: integrationIndex, target: finalIndex,
      value: stageTotals.size ? Array.from(stageTotals.values()).reduce((sum, total) => sum + total.value, 0) : visualFlowValue(solarImportTotal),
      rawValue: solarImportTotal,
      tone: "imports",
      color: routeColoring ? routeClassColor(chainRoute) : "#f59e0b",
      alpha: 1, alphaApplied: false, supplierName: "Múltiplas origens",
      productName: finalSystemName,
      flowLabel: `Produção e formulação → ${finalSystemName}`,
      share: 1,
    });
  }

  const summary = {
    totalValue: solarImportTotal,
    inputCount: solarInputs.length,
    highlightCount: chokepointInputCount,
    highlightLabel: "Gargalos ≥ 90% China",
  };

  const reordered = reorderSankeyNodes({ nodes, links });
  return { ...reordered, links: mergeParallelLinks(reordered.links), summary };
}

// Perspectiva B -- "Inserção e Exportações": ativo nacional (matéria-prima /
// beneficiamento no Brasil) -> etapa de beneficiamento doméstico -> destino
// comercial agregado. Sem camada de "supplier" (não existe país de origem
// para um ativo brasileiro exportado) e sem quebra por país de destino --
// essa informação não existe na base de dados disponível (ver plano/nota de
// escopo). Largura e cor sempre ancoradas em exports_value_usd.
function buildExportsTopology(
  solarInputs: SolarInputMetric[],
  routeColoring: boolean,
): SankeyChartData {
  const nodes: SankeyNodeDatum[] = [];
  const links: SankeyLinkDatum[] = [];
  const nodeIndex = new Map<string, number>();

  function ensureNode(id: string, name: string, kind: SankeyNodeDatum["kind"]) {
    const existing = nodeIndex.get(id);
    if (existing !== undefined) return existing;
    const nextIndex = nodes.length;
    nodeIndex.set(id, nextIndex);
    nodes.push({ id, name, kind, tone: "exports" });
    return nextIndex;
  }

  const exportableInputs = solarInputs.filter((input) => input.exports_value_usd > 0);
  if (!exportableInputs.length) {
    return { nodes: [], links: [] };
  }

  const totalExports = exportableInputs.reduce((sum, input) => sum + input.exports_value_usd, 0);
  const orderedInputs = [...exportableInputs].sort((left, right) => right.exports_value_usd - left.exports_value_usd);

  // Domestic use (what stayed in Brazil instead of being exported) only
  // exists when the input has a PRODLIST-comparable production figure (see
  // PRODLIST_COMPARABLE_INPUTS in build_solar_sovereignty_metrics.py).
  // Inputs without one (e.g. Wafers, ~100% imported) get no "Uso Interno"
  // split -- omitted rather than fabricated.
  const domesticUseByInput = new Map<string, number>();
  exportableInputs.forEach((input) => {
    if (input.domestic_production_value_usd_comparable === null) return;
    const domesticUse = Math.max(input.domestic_production_value_usd_comparable - input.exports_value_usd, 0);
    if (domesticUse > 0) domesticUseByInput.set(input.input_id, domesticUse);
  });

  // Once "Uso Interno" competes with real export destinations for the same
  // stage's output, width/share need to scale against each input's full
  // domestic production (exported + what stayed home) -- otherwise "Uso
  // Interno" would dwarf every country against an inconsistent yardstick.
  // The "Exportações" header metric (summary.totalValue below) still reads
  // off totalExports alone; only the node/link geometry uses this basis.
  const totalProductionBasis = exportableInputs.reduce(
    (sum, input) => sum + input.exports_value_usd + (domesticUseByInput.get(input.input_id) ?? 0),
    0,
  );

  // Mirrors the imports side's input collapse: exportable inputs under 0.5%
  // of the production basis AND without a low-carbon-advantage signal
  // collapse into "Outros Insumos" -- but a real low-carbon input (the
  // "Valor Ambiental" story this perspective exists to tell, e.g. Si-GM)
  // is always exempt regardless of how small its dollar value is.
  // Aço-specific: sucata_ferrosa and ferro_esponja have an unambiguous
  // process route just from what the product physically IS -- scrap can
  // only feed an electric arc furnace, and DRI (redução direta) is a
  // distinct process by definition -- unlike ferro_gusa/minerio_ferro,
  // whose shared NCM basket can't distinguish BF-BOF (coque) from
  // biorredução (carvão vegetal) output (see carvao_mineral_coque's
  // rationale). These input_ids only exist in the aço catalog, so no
  // chainName check is needed to scope this safely to that chain alone.
  // Declared before the long-tail collapse below because that collapse
  // filter needs to exempt these two -- folding ferro_esponja's (real but
  // tiny, $181 in the current cut) DRI-attributed flow into the anonymous
  // "Outros Insumos" bucket would erase the one thing that route split
  // exists to show.
  const EXPORT_ROUTE_NODE_OVERRIDES: Record<string, { id: string; label: string }> = {
    sucata_ferrosa: { id: "route:eaf", label: "Aciaria Elétrica (EAF)" },
    ferro_esponja: { id: "route:dri", label: "Redução Direta (DRI)" },
    // minerio_ferro is the one input that genuinely skips Brazilian
    // industry (in-natura ore export, no domestic reduction/lamination
    // step) -- but letting it jump straight from column 1 to column 3
    // made its long link visually cross behind/through the tall
    // "Aciaria e Laminação" box in the middle column, reading as a phantom
    // connection to a process it never touches. Anchoring it on its own
    // clearly-labeled neutral node keeps every link on the same strict
    // 3-column depth (no skips) without claiming any processing happened --
    // it's a rendering/legibility fix, not a new production claim.
    minerio_ferro: { id: "route:in-natura", label: "Exportação In Natura (sem processamento)" },
  };
  const EXPORT_INPUT_LONG_TAIL_SHARE_THRESHOLD = 0.005;
  const OTHER_EXPORT_INPUTS_LABEL = "Outros Insumos";
  const collapsibleExportInputIds = new Set(
    exportableInputs
      .filter((input) => {
        if (input.production_route_class === "low_carbon_dominant") return false;
        if (EXPORT_ROUTE_NODE_OVERRIDES[input.input_id]) return false;
        const raw = input.exports_value_usd + (domesticUseByInput.get(input.input_id) ?? 0);
        const share = raw / Math.max(totalProductionBasis, 1);
        return share < EXPORT_INPUT_LONG_TAIL_SHARE_THRESHOLD;
      })
      .map((input) => input.input_id),
  );

  // Mirrors the long-tail collapse on the imports/supplier side: destination
  // countries under 0.1% of the chain's total exports become a single
  // "Outros Mercados" node instead of visual noise. Falls back to a generic
  // label when an input has no top_destination (e.g. no EXP rows reached
  // 2026 for it even though exports_value_usd > 0 from an earlier period).
  const destinationTotals = new Map<string, number>();
  exportableInputs.forEach((input) => {
    const destName = input.top_destination?.country_name ?? "Destino não informado";
    destinationTotals.set(destName, (destinationTotals.get(destName) ?? 0) + Math.max(input.exports_value_usd, 0));
  });
  const LONG_TAIL_SHARE_THRESHOLD = 0.001;
  const OTHER_MARKETS_LABEL = "Outros Mercados";
  const DOMESTIC_USE_LABEL = "Uso Interno / Consumo Doméstico";
  const longTailDestinations = new Set(
    [...destinationTotals.entries()]
      .filter(([, value]) => value / Math.max(totalExports, 1) < LONG_TAIL_SHARE_THRESHOLD)
      .map(([name]) => name),
  );
  const resolveDestinationName = (name: string) => (longTailDestinations.has(name) ? OTHER_MARKETS_LABEL : name);

  const stageTotals = new Map<string, { index: number; value: number; raw: number; lowCarbon: boolean }>();
  let lowCarbonCount = 0;

  // Laminados/tubos/estruturas are genuinely domestically rolled/fabricated
  // from Brazilian crude steel (unlike silício's polissilício/wafers, which
  // this same generic bypass was originally built for -- those really do
  // skip Brazil entirely). Letting them jump straight to destination hid
  // the one real domestic processing step they DO pass through. Ferroligas/
  // eletrodos_grafite/materiais_refratarios are the same story one stage
  // earlier -- inputs consumed AT the aciaria step, not raw commodities
  // that bypass Brazilian industry. Golden rule for this chain's exports
  // topology: only minério de ferro bruto (routed to route:in-natura above)
  // is a real in-natura commodity Brazil ships without processing --
  // everything else must land on a process node. But none of these NCM
  // baskets, like ferro_gusa's, distinguish EAF-recycled from BF-BOF-coke
  // steel, so there's no tariff-level way to attribute a route split. They
  // all join ferro_gusa in the same neutral "reducao" group/node rather
  // than getting a fabricated EAF/BF-BOF fraction.
  const EXPORT_FORCE_MISTA_STAGE_INPUT_IDS = new Set([
    // acos_eletricos_gno: "transformacao" stage like planos_quente/planos_frios
    // right above -- same rolled-from-Brazilian-crude-steel story, so same
    // forced hop. Its export value alone (US$10.9mi) looks long-tail, but
    // rawValue below is exports + domestic use, and its domestic production
    // (US$2.67bi comparable) makes its real share of the basis 7.3% --
    // nowhere near the 0.5% collapse threshold, so it was never going to
    // reach collapsibleExportInputIds either. Must be forced explicitly.
    "planos_quente", "planos_frios", "tubos_aco", "estruturas_aco", "acos_eletricos_gno",
    // ferro_niobio and ferro_niquel used to be part of the "ferroligas"
    // basket and were covered by this set through it; splitting them into
    // their own Definitions (each is a distinct Brazilian mineral-processing
    // strength, not import risk) left them un-listed here, so they fell
    // through to hasRealDomesticStage=false below and jumped straight from
    // input to destination country, skipping the aciaria node entirely.
    // Same golden rule as ferroligas: they're consumed AT the aciaria step,
    // not raw commodities that bypass Brazilian industry.
    "ferroligas", "ferro_niobio", "ferro_niquel", "eletrodos_grafite", "materiais_refratarios",
  ]);
  const exportStageGroupKey = (input: SolarInputMetric) =>
    EXPORT_ROUTE_NODE_OVERRIDES[input.input_id]?.id
    ?? (EXPORT_FORCE_MISTA_STAGE_INPUT_IDS.has(input.input_id) || collapsibleExportInputIds.has(input.input_id)
      ? "reducao"
      : input.stage);
  const exportStageGroupLabel = (key: string) =>
    key === "route:eaf" ? "Aciaria Elétrica (EAF)"
      : key === "route:dri" ? "Redução Direta (DRI)"
        : key === "route:in-natura" ? "Exportação In Natura (sem processamento)"
          : key === "reducao" ? "Aciaria e Laminação (Rota Mista)"
            : executiveStageLabel(key);

  orderedInputs.forEach((input) => {
    const domesticUse = domesticUseByInput.get(input.input_id) ?? 0;
    const exportsRaw = Math.max(input.exports_value_usd, 0);
    const rawValue = exportsRaw + domesticUse;
    const isLowCarbon = input.production_route_class === "low_carbon_dominant";
    if (isLowCarbon) lowCarbonCount += 1;
    const inputNode = collapsibleExportInputIds.has(input.input_id)
      ? ensureNode("input:outros-insumos", OTHER_EXPORT_INPUTS_LABEL, "input")
      : ensureNode(`input:${input.input_id}`, input.label, "input");
    const color = routeColoring ? routeClassColor(input.production_route_class) : exportAccentColor(isLowCarbon);
    const share = rawValue / Math.max(totalProductionBasis, 1);

    nodes[inputNode].rawValue = (nodes[inputNode].rawValue ?? 0) + rawValue;
    nodes[inputNode].share = (nodes[inputNode].rawValue ?? 0) / Math.max(totalProductionBasis, 1);
    if (isLowCarbon) nodes[inputNode].lowCarbon = true;
    // Only tag while the lens is actually on -- reorderSankeyNodes only
    // groups by this when it's present, so the default (uncolored) layout
    // stays exactly as it was.
    if (routeColoring) nodes[inputNode].routeClass = input.production_route_class;
    addContribution(nodes, inputNode, input.label, rawValue);

    // Same rule as the imports side: only extração/processamento (order <=
    // BASE_MATERIAL_STAGE_ORDER_THRESHOLD) have confirmed real domestic
    // activity worth an "Etapa produtiva" node. Brazil doesn't refine
    // solar-grade polysilicon or slice wafers at any scale, so a residual
    // Polissilício/Wafers export (re-export/trading-company volume, not
    // domestic output) skipping straight to its destination country
    // instead of through a fake "Refino solar" hop.
    // Inputs folded into "Outros Insumos" all share ONE input node
    // (ensureNode("input:outros-insumos", ...) below), so they must also
    // share one routing depth -- otherwise that single node would emit
    // links into two different columns at once (some straight to a
    // destination, others through a stage/route node), which produced the
    // "looping" artifact through Aciaria e Laminação. Everything currently
    // collapsed here (carvão mineral e coque, eletrodos_grafite,
    // materiais_refratarios) already belongs in the "reducao"/Rota Mista
    // group per EXPORT_FORCE_MISTA_STAGE_INPUT_IDS above, so routing them
    // there uniformly satisfies both constraints at once instead of
    // fighting each other.
    const hasRealDomesticStage = stagePhysicalOrder(`stage:${input.stage}`) <= BASE_MATERIAL_STAGE_ORDER_THRESHOLD
      || EXPORT_FORCE_MISTA_STAGE_INPUT_IDS.has(input.input_id)
      || collapsibleExportInputIds.has(input.input_id);

    if (!hasRealDomesticStage) {
      if (exportsRaw > 0) {
        const destName = resolveDestinationName(input.top_destination?.country_name ?? "Destino não informado");
        const destinationIndex = ensureNode(`destination:${destName}`, destName, "destination");
        nodes[destinationIndex].rawValue = (nodes[destinationIndex].rawValue ?? 0) + exportsRaw;
        nodes[destinationIndex].share = (nodes[destinationIndex].rawValue ?? 0) / Math.max(totalProductionBasis, 1);
        if (isLowCarbon) nodes[destinationIndex].lowCarbon = true;
        addContribution(nodes, destinationIndex, input.label, exportsRaw);
        links.push({
          id: `export-input-final:${input.input_id}`, highlightId: input.input_id,
          source: inputNode, target: destinationIndex, value: visualFlowValue(exportsRaw), rawValue: exportsRaw,
          tone: "exports", color,
          alpha: 1, alphaApplied: false, supplierName: "Produção nacional (Brasil)", productName: destName,
          flowLabel: `${input.label} → ${destName}`, share: exportsRaw / Math.max(totalProductionBasis, 1),
          routeClass: input.production_route_class, routeRationale: input.production_route_rationale,
          dataGapReason: input.data_gap_reason ?? undefined,
        });
      }
      if (domesticUse > 0) {
        const usoInternoIndex = ensureNode("destination:uso-interno", DOMESTIC_USE_LABEL, "destination");
        nodes[usoInternoIndex].rawValue = (nodes[usoInternoIndex].rawValue ?? 0) + domesticUse;
        nodes[usoInternoIndex].share = (nodes[usoInternoIndex].rawValue ?? 0) / Math.max(totalProductionBasis, 1);
        nodes[usoInternoIndex].domesticUse = true;
        if (isLowCarbon) nodes[usoInternoIndex].lowCarbon = true;
        addContribution(nodes, usoInternoIndex, input.label, domesticUse);
        links.push({
          id: `export-input-final:${input.input_id}:uso-interno`, highlightId: input.input_id,
          source: inputNode, target: usoInternoIndex, value: visualFlowValue(domesticUse), rawValue: domesticUse,
          tone: "exports", color: DOMESTIC_USE_COLOR,
          alpha: 1, alphaApplied: false, supplierName: "Produção nacional (Brasil)", productName: DOMESTIC_USE_LABEL,
          flowLabel: `${input.label} → ${DOMESTIC_USE_LABEL}`, share: domesticUse / Math.max(totalProductionBasis, 1),
          domesticUse: true,
        });
      }
      return;
    }

    const value = visualFlowValue(rawValue);
    const stageGroupKey = exportStageGroupKey(input);
    const stageName = exportStageGroupLabel(stageGroupKey);
    const stageNode = ensureNode(
      EXPORT_ROUTE_NODE_OVERRIDES[input.input_id]?.id ?? `stage:${stageGroupKey}`,
      stageName,
      "stage",
    );
    nodes[stageNode].rawValue = (nodes[stageNode].rawValue ?? 0) + rawValue;
    nodes[stageNode].share = (nodes[stageNode].rawValue ?? 0) / Math.max(totalProductionBasis, 1);
    if (isLowCarbon) nodes[stageNode].lowCarbon = true;
    addContribution(nodes, stageNode, input.label, rawValue);

    links.push({
      id: `export-input-stage:${input.input_id}`, highlightId: input.input_id,
      source: inputNode, target: stageNode, value, rawValue, tone: "exports", color,
      alpha: 1, alphaApplied: false, supplierName: "Produção nacional (Brasil)", productName: input.label,
      flowLabel: `${input.label} → ${stageName}`, share,
      routeClass: input.production_route_class, routeRationale: input.production_route_rationale,
      dataGapReason: input.data_gap_reason ?? undefined,
    });

    const total = stageTotals.get(stageGroupKey) ?? { index: stageNode, value: 0, raw: 0, lowCarbon: false };
    total.value += value;
    total.raw += rawValue;
    total.lowCarbon = total.lowCarbon || isLowCarbon;
    stageTotals.set(stageGroupKey, total);
  });

  // Terminal layer: real per-destination-country nodes, mirroring the
  // supplier (origin-country) layer on the imports side -- no synthetic
  // "world market" node sits on top of them, same as the imports topology
  // doesn't sit a "world supply" node below its supplier layer. A stage can
  // fan out to more than one destination when its inputs' top buyers differ
  // (e.g. Quartzo and Si-GM selling to different countries), so this groups
  // by destination within each stage instead of a single stage-wide edge.
  // "Uso Interno" is folded into the same fan-out as one more destination,
  // not a separate branch before the stage -- beneficiation happens
  // domestically either way, the split only matters at the very end.
  stageTotals.forEach((total, stage) => {
    const stageGroupInputs = exportableInputs.filter((input) => exportStageGroupKey(input) === stage);
    const stageColor = routeColoring
      ? routeClassColor(dominantRouteFromInputs(stageGroupInputs))
      : exportAccentColor(total.lowCarbon);
    const stageDestinationTotals = new Map<string, number>();
    stageGroupInputs
      .forEach((input) => {
        const destName = resolveDestinationName(input.top_destination?.country_name ?? "Destino não informado");
        stageDestinationTotals.set(destName, (stageDestinationTotals.get(destName) ?? 0) + Math.max(input.exports_value_usd, 0));
        const destinationIndex = ensureNode(`destination:${destName}`, destName, "destination");
        addContribution(nodes, destinationIndex, input.label, Math.max(input.exports_value_usd, 0));
        const domesticUse = domesticUseByInput.get(input.input_id) ?? 0;
        if (domesticUse > 0) {
          stageDestinationTotals.set(DOMESTIC_USE_LABEL, (stageDestinationTotals.get(DOMESTIC_USE_LABEL) ?? 0) + domesticUse);
          const usoInternoIndex = ensureNode("destination:uso-interno", DOMESTIC_USE_LABEL, "destination");
          addContribution(nodes, usoInternoIndex, input.label, domesticUse);
        }
      });

    stageDestinationTotals.forEach((destRaw, destName) => {
      const isDomesticUse = destName === DOMESTIC_USE_LABEL;
      const destinationIndex = ensureNode(
        isDomesticUse ? "destination:uso-interno" : `destination:${destName}`,
        destName,
        "destination",
      );
      nodes[destinationIndex].rawValue = (nodes[destinationIndex].rawValue ?? 0) + destRaw;
      nodes[destinationIndex].share = (nodes[destinationIndex].rawValue ?? 0) / Math.max(totalProductionBasis, 1);
      if (total.lowCarbon) nodes[destinationIndex].lowCarbon = true;
      if (isDomesticUse) nodes[destinationIndex].domesticUse = true;
      links.push({
        id: `export-stage-destination:${stage}:${destName}`, highlightId: `export-stage:${stage}`,
        source: total.index, target: destinationIndex, value: visualFlowValue(destRaw), rawValue: destRaw,
        tone: "exports", color: isDomesticUse ? DOMESTIC_USE_COLOR : stageColor,
        alpha: 1, alphaApplied: false, supplierName: "Produção nacional (Brasil)",
        productName: destName,
        flowLabel: `${exportStageGroupLabel(stage)} → ${destName}`,
        share: destRaw / Math.max(totalProductionBasis, 1),
        domesticUse: isDomesticUse,
      });
    });
  });

  const summary = {
    totalValue: totalExports,
    inputCount: exportableInputs.length,
    highlightCount: lowCarbonCount,
    highlightLabel: "Rotas de baixo carbono",
  };

  const reordered = reorderSankeyNodes({ nodes, links });
  return { ...reordered, links: mergeParallelLinks(reordered.links), summary };
}

// Fallback usado apenas quando a página ainda não carregou `solarInputs`
// (loading/vazio) e só há o produto conceitual avulso -- mantém um único
// vínculo supplier/ativo -> produto, escolhendo FOB de importação ou
// exportação conforme a perspectiva ativa, sem tentar reconstituir a
// topologia completa (baixo uso real, ver plano).
function buildProductTopology(products: ProdutoConceitual[], perspective: Perspective): SankeyChartData {
  const nodes: SankeyNodeDatum[] = [];
  const links: SankeyLinkDatum[] = [];
  const nodeIndex = new Map<string, number>();

  function ensureNode(id: string, name: string, kind: SankeyNodeDatum["kind"]) {
    const existing = nodeIndex.get(id);
    if (existing !== undefined) return existing;
    const nextIndex = nodes.length;
    nodeIndex.set(id, nextIndex);
    nodes.push({ id, name, kind, tone: perspective });
    return nextIndex;
  }

  products.forEach((product) => {
    const supplierName = executiveLabel(product.comercio.principal_pais_origem, "Origem não informada");
    const productName = executiveLabel(product.produto_nome, "Produto não informado");
    const alpha = clampShare(product.fator_proporcionalidade.fator_alpha);
    const alphaApplied = product.fator_proporcionalidade.aplicado === true;
    const rawValue = Math.max(
      perspective === "exports" ? product.comercio.exportacao_valor_fob : product.comercio.importacao_valor_fob,
      0,
    );
    const value = Math.max(alphaApplied ? rawValue * alpha : rawValue, 1);

    const source = ensureNode(`supplier:${supplierName}`, supplierName, perspective === "exports" ? "input" : "supplier");
    const target = ensureNode(`product:${product.conceptual_product_id}`, productName, "product");

    links.push({
      id: `supplier-product:${product.conceptual_product_id}`,
      highlightId: product.conceptual_product_id,
      source, target, value, rawValue, tone: perspective,
      color: perspective === "exports" ? exportAccentColor(false) : importAccentColor(0),
      alpha, alphaApplied, supplierName, productName,
      flowLabel: `${supplierName} → ${productName}`,
    });
  });

  return { nodes, links };
}

export default SovereigntySankeyChart;
