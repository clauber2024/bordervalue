"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { ProdutoConceitual } from "../types/border-value";
import type { ProductionRouteClass, SolarInputMetric } from "../types/solar-sovereignty";
import { transitionFuelDestination } from "../lib/transitionFuelTopology";

type ColorMode = "balance" | "imports" | "exports" | "route";

type SankeyNodeDatum = {
  id: string;
  name: string;
  kind: "supplier" | "input" | "stage" | "destination" | "product";
  value?: number;
  rawValue?: number;
  share?: number;
};

type SankeyLinkDatum = {
  id: string;
  highlightId: string;
  source: number;
  target: number;
  value: number;
  rawValue: number;
  alpha: number;
  alphaApplied: boolean;
  supplierName: string;
  productName: string;
  exportsValue?: number;
  balance?: number;
  color?: string;
  flowLabel?: string;
  share?: number;
  routeClass?: ProductionRouteClass;
  routeRationale?: string;
  dataGapReason?: string;
};

type SankeyChartData = {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
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

export type SovereigntySankeyChartProps = {
  data?: ProdutoConceitual[];
  dado?: ProdutoConceitual;
  className?: string;
  height?: number;
  title?: string;
  solarInputs?: SolarInputMetric[];
  chainName?: string;
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
}: SovereigntySankeyChartProps) {
  const [colorMode, setColorMode] = useState<ColorMode>("balance");
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [hoveredFlowId, setHoveredFlowId] = useState<string | null>(null);
  const products = useMemo(() => (dado ? [dado] : data ?? []), [data, dado]);

  const sankeyData = useMemo<SankeyChartData>(() => {
    const nodes: SankeyNodeDatum[] = [];
    const links: SankeyLinkDatum[] = [];
    const nodeIndex = new Map<string, number>();

    function ensureNode(id: string, name: string, kind: SankeyNodeDatum["kind"]) {
      const existing = nodeIndex.get(id);
      if (existing !== undefined) return existing;

      const nextIndex = nodes.length;
      nodeIndex.set(id, nextIndex);
      nodes.push({ id, name, kind });
      return nextIndex;
    }

    if (solarInputs.length) {
      const solarImportTotal = solarInputs.reduce((sum, input) => sum + input.imports_value_usd, 0);
      const stageTotals = new Map<string, { index: number; value: number; raw: number; exports: number }>();
      const supplierTotals = new Map<string, number>();
      // Aggregate links (stage/destination/integration) mix several inputs
      // with potentially different production routes -- track raw-value
      // weight per route class so the aggregate can be colored by whichever
      // route dominates the money flowing through it, instead of forcing an
      // arbitrary single input's classification onto the whole bundle.
      const stageRouteWeights = new Map<string, Map<ProductionRouteClass, number>>();
      const chainRouteWeights = new Map<ProductionRouteClass, number>();

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

      const orderedSolarInputs = [...solarInputs].sort((left, right) =>
        (supplierTotals.get(right.top_supplier?.country_name ?? "Origem não informada") ?? 0)
        - (supplierTotals.get(left.top_supplier?.country_name ?? "Origem não informada") ?? 0)
        || right.imports_value_usd - left.imports_value_usd
        || left.label.localeCompare(right.label, "pt-BR"),
      );

      orderedSolarInputs.forEach((input) => {
        const supplierName = resolveSupplierName(input.top_supplier?.country_name ?? "Origem não informada");
        const rawValue = Math.max(input.imports_value_usd, 0);
        const exportsValue = Math.max(input.exports_value_usd, 0);
        const balance = exportsValue - rawValue;
        const value = visualFlowValue(rawValue);
        const source = ensureNode(`supplier:${supplierName}`, supplierName, "supplier");
        const inputNode = ensureNode(`input:${input.input_id}`, input.label, "input");
        const stageName = executiveStageLabel(input.stage);
        const stageNode = ensureNode(`stage:${input.stage}`, stageName, "stage");
        const color = flowColor(colorMode, rawValue, exportsValue, balance, input.production_route_class);
        const share = rawValue / Math.max(solarImportTotal, 1);

        [source, inputNode, stageNode].forEach((index) => {
          nodes[index].rawValue = (nodes[index].rawValue ?? 0) + rawValue;
          nodes[index].share = (nodes[index].rawValue ?? 0) / Math.max(solarImportTotal, 1);
        });

        links.push({
          id: `supplier-input:${input.input_id}`, highlightId: input.input_id,
          source, target: inputNode, value, rawValue, exportsValue, balance, color,
          alpha: 1, alphaApplied: false, supplierName, productName: input.label,
          flowLabel: `${supplierName} → ${input.label}`, share,
          routeClass: input.production_route_class, routeRationale: input.production_route_rationale,
          dataGapReason: input.data_gap_reason ?? undefined,
        });
        links.push({
          id: `input-stage:${input.input_id}`, highlightId: input.input_id,
          source: inputNode, target: stageNode, value, rawValue, exportsValue, balance, color,
          alpha: 1, alphaApplied: false, supplierName, productName: input.label,
          flowLabel: `${input.label} → ${stageName}`, share,
          routeClass: input.production_route_class, routeRationale: input.production_route_rationale,
          dataGapReason: input.data_gap_reason ?? undefined,
        });
        const total = stageTotals.get(input.stage) ?? { index: stageNode, value: 0, raw: 0, exports: 0 };
        total.value += value;
        total.raw += rawValue;
        total.exports += exportsValue;
        stageTotals.set(input.stage, total);

        const stageWeights = stageRouteWeights.get(input.stage) ?? new Map<ProductionRouteClass, number>();
        stageWeights.set(input.production_route_class, (stageWeights.get(input.production_route_class) ?? 0) + rawValue);
        stageRouteWeights.set(input.stage, stageWeights);
        chainRouteWeights.set(input.production_route_class, (chainRouteWeights.get(input.production_route_class) ?? 0) + rawValue);
      });

      // Create the terminal node after every upstream layer so Recharts lays
      // it out as the rightmost destination instead of a visual source.
      const isFertilizerChain = /fertiliz/i.test(chainName ?? "");
      const isTransitionFuelChain = /combustíveis de transição|combustiveis de transicao/i.test(chainName ?? "");
      // Prefer the real end-of-chain product (stage "produto_final", e.g.
      // "Módulos fotovoltaicos") over a generic system label when the data
      // actually names one -- a synthetic "Sistema solar fotovoltaico"
      // fallback isn't the real product the chain produces. Several inputs
      // can share stage "produto_final" (modules, frames, glass, cells all
      // land in "produto_final" for silicio) -- take only the highest-value
      // one instead of joining every label, or the node reads as a run-on
      // string ("Módulos fotovoltaicos / Molduras de alumínio / ...").
      const finalProductInputs = solarInputs
        .filter((input) => input.stage === "produto_final")
        .sort((left, right) => right.imports_value_usd - left.imports_value_usd);
      const realFinalProductName = finalProductInputs[0]?.label ?? null;
      const finalSystemName = isFertilizerChain
        ? "Oferta nacional de fertilizantes"
        : isTransitionFuelChain
          ? "Usos finais dos combustíveis de transição"
          : realFinalProductName ?? chainName ?? "Sistema solar fotovoltaico";
      const finalIndex = ensureNode("product:chain-system", finalSystemName, "product");
      nodes[finalIndex].rawValue = solarImportTotal;
      nodes[finalIndex].share = 1;
      const integrationIndex = isFertilizerChain
        ? ensureNode("integration:fertilizer-production", "Produção e formulação de fertilizantes", "stage")
        : finalIndex;
      if (isFertilizerChain) {
        nodes[integrationIndex].rawValue = solarImportTotal;
        nodes[integrationIndex].share = 1;
      }
      stageTotals.forEach((total, stage) => {
        const balance = total.exports - total.raw;
        const destinationName = isTransitionFuelChain ? transitionFuelDestination(stage) : null;
        const destinationIndex = destinationName
          ? ensureNode(`destination:${stage}`, destinationName, "destination")
          : integrationIndex;
        if (destinationName) {
          nodes[destinationIndex].rawValue = total.raw;
          nodes[destinationIndex].share = total.raw / Math.max(solarImportTotal, 1);
        }
        const stageRoute = dominantRoute(stageRouteWeights.get(stage));
        links.push({
          id: `stage-final:${stage}`, highlightId: `stage:${stage}`,
          source: total.index, target: destinationIndex, value: total.value, rawValue: total.raw,
          exportsValue: total.exports, balance, color: flowColor(colorMode, total.raw, total.exports, balance, stageRoute),
          alpha: 1, alphaApplied: false, supplierName: "Múltiplas origens",
          productName: isFertilizerChain ? "Produção e formulação de fertilizantes" : destinationName ?? finalSystemName,
          flowLabel: `${executiveStageLabel(stage)} → ${isFertilizerChain ? "Produção e formulação" : destinationName ?? finalSystemName}`,
          share: total.raw / Math.max(solarImportTotal, 1),
          routeClass: stageRoute ?? undefined,
        });
        if (destinationName) {
          links.push({
            id: `destination-final:${stage}`, highlightId: `destination:${stage}`,
            source: destinationIndex, target: finalIndex, value: total.value, rawValue: total.raw,
            exportsValue: total.exports, balance, color: flowColor(colorMode, total.raw, total.exports, balance, stageRoute),
            alpha: 1, alphaApplied: false, supplierName: "Múltiplas origens",
            productName: finalSystemName, flowLabel: `${destinationName} → ${finalSystemName}`,
            share: total.raw / Math.max(solarImportTotal, 1),
            routeClass: stageRoute ?? undefined,
          });
        }
      });
      if (isFertilizerChain) {
        const totalExports = solarInputs.reduce((sum, input) => sum + Math.max(input.exports_value_usd, 0), 0);
        const totalBalance = totalExports - solarImportTotal;
        const chainRoute = dominantRoute(chainRouteWeights);
        links.push({
          id: "integration-final:fertilizers", highlightId: "integration:fertilizers",
          source: integrationIndex, target: finalIndex, value: stageTotals.size
            ? Array.from(stageTotals.values()).reduce((sum, total) => sum + total.value, 0)
            : visualFlowValue(solarImportTotal),
          rawValue: solarImportTotal, exportsValue: totalExports, balance: totalBalance,
          color: flowColor(colorMode, solarImportTotal, totalExports, totalBalance, chainRoute),
          alpha: 1, alphaApplied: false, supplierName: "Múltiplas origens",
          productName: finalSystemName,
          flowLabel: `Produção e formulação → ${finalSystemName}`,
          share: 1,
          routeClass: chainRoute ?? undefined,
        });
      }

      return reorderStageNodes({ nodes, links });
    }

    products.forEach((product) => {
      const supplierName = executiveLabel(product.comercio.principal_pais_origem, "Origem não informada");
      const productName = executiveLabel(product.produto_nome, "Produto não informado");
      const alpha = clampShare(product.fator_proporcionalidade.fator_alpha);
      const alphaApplied = product.fator_proporcionalidade.aplicado === true;
      const rawValue = Math.max(product.comercio.importacao_valor_fob, 0);
      const value = Math.max(alphaApplied ? rawValue * alpha : rawValue, 1);

      const source = ensureNode(`supplier:${supplierName}`, supplierName, "supplier");
      const target = ensureNode(`product:${product.conceptual_product_id}`, productName, "product");

      links.push({
        id: `supplier-product:${product.conceptual_product_id}`,
        highlightId: product.conceptual_product_id,
        source,
        target,
        value,
        rawValue,
        alpha,
        alphaApplied,
        supplierName,
        productName,
      });
    });

    return { nodes, links };
  }, [chainName, colorMode, products, solarInputs]);

  const totalVisible = solarInputs.length ? solarInputs.reduce((sum, item) => sum + item.imports_value_usd, 0) : sankeyData.links.reduce((sum, link) => sum + link.value, 0);
  const totalRaw = solarInputs.length ? solarInputs.reduce((sum, item) => sum + item.exports_value_usd, 0) : sankeyData.links.reduce((sum, link) => sum + link.rawValue, 0);
  const alphaLinks = sankeyData.links.filter((link) => link.alphaApplied && link.alpha < 1).length;
  const activeFlowId = selectedFlowId ?? hoveredFlowId;
  const focusContext = useMemo(() => buildFocusContext(activeFlowId, sankeyData), [activeFlowId, sankeyData]);
  const effectiveHeight = solarInputs.length ? Math.max(height, solarInputs.length * 58 + 180) : height;

  if (!sankeyData.nodes.length || !sankeyData.links.length) {
    return (
      <section className={`${shell} rounded-lg p-6 text-sm text-zinc-400 ${className}`}>
        Nenhum produto conceitual disponível para compor o fluxo de soberania.
      </section>
    );
  }

  return (
    <section className={`${shell} overflow-hidden rounded-lg text-zinc-100 ${className}`}>
      <header className="border-b border-zinc-800/70 bg-white/[0.025] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              AIPNET / leitura executiva
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
              {title}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 lg:min-w-[34rem]">
            <MetricPill label={solarInputs.length ? "Importações" : "Fluxo exibido"} value={usdCompact.format(totalVisible)} />
            <MetricPill label={solarInputs.length ? "Exportações" : "Fluxo bruto"} value={usdCompact.format(totalRaw)} />
            <MetricPill label={solarInputs.length ? "Insumos mapeados" : "Fluxos com Alpha"} value={String(solarInputs.length || alphaLinks)} />
          </div>
        </div>
      </header>

      <div className="px-2 py-5 sm:px-4">
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400 backdrop-blur-md">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" strokeWidth={1.5} />
          <p className="leading-relaxed">
            <strong className="font-semibold text-zinc-200">Nota de Escopo Comercial (ComexStat/MDIC):</strong> Este
            diagrama ilustra a distribuição da pauta importada e a concentração geográfica de fornecedores por
            categoria de bem. A espessura das bandas reflete o valor financeiro (FOB) de cada pauta aduaneira, e não
            uma sequência de transformação industrial doméstica.
          </p>
        </div>
        {solarInputs.length ? (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Colorir fluxos por</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <FlowModeButton active={colorMode === "balance"} onClick={() => setColorMode("balance")} description="Compara exportações e importações. Vermelho indica déficit, âmbar indica equilíbrio relativo e verde indica superávit.">Saldo comercial</FlowModeButton>
                <FlowModeButton active={colorMode === "imports"} onClick={() => setColorMode("imports")} description="Destaca em vermelho os caminhos com importações observadas. A largura continua representando o peso visual do valor FOB importado.">Importações</FlowModeButton>
                <FlowModeButton active={colorMode === "exports"} onClick={() => setColorMode("exports")} description="Destaca em verde os caminhos com exportações observadas. Fluxos sem exportação no período permanecem em cinza.">Exportações</FlowModeButton>
                <FlowModeButton active={colorMode === "route"} onClick={() => setColorMode("route")} description="Classifica cada insumo pela rota produtiva dominante hoje: vermelho é rota fóssil, âmbar é transição em curso, verde é rota já de baixo carbono, azul é potencial de descarbonização ainda não realizado no comércio, e cinza é rota indeterminada. Agregados (etapa, uso final) mostram a rota que domina o valor comercializado.">Fonte energética</FlowModeButton>
                {selectedFlowId ? <button type="button" onClick={() => setSelectedFlowId(null)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-white">Limpar destaque</button> : null}
              </div>
            </div>
            {colorMode === "route" ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
                {(Object.keys(ROUTE_CLASS_LABELS) as ProductionRouteClass[]).map((routeClass) => (
                  <span key={routeClass} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ROUTE_CLASS_COLORS[routeClass] }} />
                    {ROUTE_CLASS_LABELS[routeClass]}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] text-zinc-500"><span className="h-2 w-12 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500" /> déficit → superávit</div>
            )}
          </div>
        ) : null}
        <div
          className="w-full overflow-x-auto transition-[height] duration-500 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-700"
          style={{ height: effectiveHeight, scrollbarColor: "#27272a transparent", scrollbarWidth: "thin" }}
        >
          {/* Fixed min-width keeps node-column spacing (and thus label room)
              constant regardless of viewport -- on narrow screens the chart
              scrolls horizontally instead of squeezing columns to the point
              where labels overlap the next stage. */}
          <div className="h-full min-w-[1340px]">
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={sankeyData}
                dataKey="value"
                nameKey="name"
                node={(props: SankeyNodeRenderProps) => renderNode(
                  props,
                  activeFlowId,
                  focusContext.nodeIds,
                  (id) => setSelectedFlowId((current) => current === id ? null : id),
                  (id) => setHoveredFlowId(id),
                )}
                link={(props: SankeyLinkRenderProps) => renderLink(
                  props,
                  activeFlowId,
                  focusContext.highlightIds,
                  (id) => setSelectedFlowId((current) => current === id ? null : id),
                  (id) => setHoveredFlowId(id),
                  colorMode,
                )}
                nodePadding={solarInputs.length ? 24 : 26}
                nodeWidth={solarInputs.length ? 16 : 18}
                linkCurvature={0.55}
                iterations={48}
                margin={{ top: 20, right: 300, bottom: 20, left: 20 }}
                sort={false}
              >
                <Tooltip content={<FlowTooltip />} />
              </Sankey>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 px-1 text-xs md:grid-cols-2 xl:grid-cols-4">
          <ReadingPill
            label="Direção"
            value={solarInputs.length ? "A rede conecta origens, insumos, etapas produtivas e o sistema final da cadeia." : "O fluxo vai do principal fornecedor internacional ao produto conceitual analisado."}
          />
          <ReadingPill
            label="Espessura"
            value={solarInputs.length ? "A largura usa transformação logarítmica do valor FOB importado para tornar fluxos menores visíveis; não deve ser interpretada como proporção linear. O valor real está no tooltip." : "A largura da banda representa o valor FOB importado. Quando o Alpha está aplicado, a banda encolhe proporcionalmente."}
          />
          <ReadingPill
            label="Cor"
            value={
              solarInputs.length
                ? colorMode === "route"
                  ? "A cor classifica a rota produtiva dominante de cada insumo: vermelho é fóssil, âmbar é transição em curso, verde é baixo carbono predominante, azul é potencial de descarbonização não realizado e cinza é rota indeterminada."
                  : "A cor segue o modo ativo. No saldo comercial, vermelho indica déficit, âmbar indica equilíbrio relativo e verde indica superávit."
                : "A cor diferencia os fluxos exibidos e a aplicação do fator de proporcionalidade."
            }
          />
          <ReadingPill
            label="Interação"
            value="Passe o mouse para ver valores e participação. Clique em uma banda ou barra para destacar o caminho; clique novamente ou use Limpar destaque para restaurar a rede."
          />
        </div>
        <p className="mt-3 px-1 text-[10px] leading-4 text-zinc-600">Códigos técnicos permanecem restritos à gaveta de rastreabilidade.</p>
      </div>
    </section>
  );
}

function renderNode(
  { x, y, width, height, payload }: SankeyNodeRenderProps,
  activeFlowId: string | null,
  focusedNodeIds: Set<string>,
  onSelect: (id: string) => void,
  onHover: (id: string | null) => void,
) {
  const fill = payload.kind === "supplier" ? "#38bdf8" : payload.kind === "input" ? "#f59e0b" : payload.kind === "stage" ? "#a78bfa" : payload.kind === "destination" ? "#2dd4bf" : "#34d399";
  const flagPalette = payload.kind === "supplier" ? countryFlagPalette(payload.name) : null;
  const gradientId = `country-${safeSvgId(payload.id)}`;
  const labelX = x + width + 10;
  const labelY = y + Math.max(height / 2, 8);
  const selectionId = `node:${payload.id}`;
  const isSelected = activeFlowId === selectionId;
  const isDimmed = activeFlowId !== null && !focusedNodeIds.has(payload.id);

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
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 8)}
        rx={5}
        fill={flagPalette ? `url(#${gradientId})` : fill}
        fillOpacity={0.92}
        stroke={fill}
        strokeOpacity={1}
        strokeWidth={isSelected ? 2.8 : 1.6}
        filter="drop-shadow(0 8px 18px rgba(0,0,0,0.36))"
      />
      <text x={labelX} y={labelY - 5} fill="#fafafa" fontSize={12} fontWeight={700} dominantBaseline="middle">
        {/* Native title tooltip carries the untruncated name. compactLabel's
            34-char cutoff and the chart's min-width scroll wrapper were
            tuned together (see margin.right below) so even the longest
            stage/destination names don't collide with the next column. */}
        <title>{payload.name}</title>
        {compactLabel(payload.name)}
      </text>
      <text x={labelX} y={labelY + 11} fill="#a1a1aa" fontSize={10} fontWeight={500} dominantBaseline="middle">
        {payload.kind === "supplier" ? "Origem principal" : payload.kind === "input" ? "Insumo" : payload.kind === "stage" ? "Etapa produtiva" : payload.kind === "destination" ? "Uso final" : "Sistema final"}
        {payload.share !== undefined ? ` · ${percent.format(payload.share)}` : ""}
      </text>
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
  focusedHighlightIds: Set<string>,
  onSelect: (id: string) => void,
  onHover: (id: string | null) => void,
  colorMode: ColorMode,
) {
  const strokeWidth = Math.max(linkWidth, 1.4);
  const path = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
  const opacity = payload.alphaApplied && payload.alpha < 1 ? 0.38 : 0.5;
  const selectedNodeId = activeFlowId?.startsWith("node:") ? activeFlowId.slice(5) : null;
  const selectedLinkId = activeFlowId?.startsWith("flow:") ? activeFlowId.slice(5) : null;
  const isSelected = selectedNodeId
    ? payload.source.id === selectedNodeId || payload.target.id === selectedNodeId || focusedHighlightIds.has(payload.highlightId)
    : selectedLinkId === payload.highlightId || focusedHighlightIds.has(payload.highlightId);
  // "Colorir fluxos por" isn't just a palette swap: Importações/Exportações
  // now actually filter -- flows without that kind of movement fade out
  // instead of only turning gray, so the mode reads as a real filter.
  const matchesColorMode =
    colorMode === "balance" ||
    colorMode === "route" ||
    (colorMode === "imports" && payload.rawValue > 0) ||
    (colorMode === "exports" && (payload.exportsValue ?? 0) > 0);
  const isDimmed = (activeFlowId !== null && !isSelected) || !matchesColorMode;

  return (
    <g>
      <motion.path
        d={path}
        fill="none"
        stroke={payload.color ?? "#22d3ee"}
        strokeWidth={isSelected ? strokeWidth * 1.18 : strokeWidth}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: isSelected ? 0.52 : isDimmed ? 0.025 : 0.15 }}
        transition={{ pathLength: { duration: 0.9, ease: "easeInOut" }, opacity: { duration: 0.2 } }}
        strokeLinecap="butt"
        pointerEvents="none"
      />
      <motion.path
        d={path}
        fill="none"
        stroke={payload.color ?? (payload.alphaApplied && payload.alpha < 1 ? "#a7f3d0" : "#67e8f9")}
        strokeWidth={Math.max(strokeWidth * (isSelected ? 0.78 : 0.55), isSelected ? 2.4 : 1)}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: 1,
          opacity: isSelected ? 0.95 : isDimmed ? 0.06 : opacity,
          strokeWidth: Math.max(strokeWidth * (isSelected ? 0.78 : 0.55), isSelected ? 2.4 : 1),
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

function safeSvgId(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "-");
}

function countryFlagPalette(countryName: string): [string, string, string] {
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
        <p className="mt-1 text-zinc-500">{node.kind === "supplier" ? "Origem" : node.kind === "input" ? "Insumo" : node.kind === "stage" ? "Etapa produtiva" : node.kind === "destination" ? "Uso final" : "Sistema final"}</p>
        {node.rawValue !== undefined ? <div className="mt-3"><TooltipRow label="Importações" value={usdLong.format(node.rawValue)} tone="cyan" /></div> : null}
        {node.share !== undefined ? <div className="mt-2"><TooltipRow label="Participação" value={percent.format(node.share)} tone="emerald" /></div> : null}
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
      <p className="mt-1 text-zinc-400">Origem: {link.supplierName}</p>
      <div className="mt-3 space-y-2">
        <TooltipRow label="Importações" value={usdLong.format(link.rawValue)} tone="cyan" />
        <TooltipRow label="Exportações" value={usdLong.format(link.exportsValue ?? 0)} tone="emerald" />
        {link.balance !== undefined ? <TooltipRow label="Saldo" value={signedUsd(link.balance)} tone={link.balance >= 0 ? "emerald" : "red"} /> : null}
        {link.share !== undefined ? <TooltipRow label="Participação" value={percent.format(link.share)} tone="emerald" /> : null}
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
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-white/[0.04] px-3 py-2">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <strong className="mt-1 block truncate text-sm font-semibold text-zinc-100">{value}</strong>
    </div>
  );
}

function ReadingPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-white/[0.035] px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-300">{label}</p>
      <p className="mt-2 leading-5 text-zinc-300">{value}</p>
    </div>
  );
}

function FlowModeButton({ active, onClick, children, description }: { active: boolean; onClick: () => void; children: string; description: string }) {
  return (
    <span className="group/mode relative">
      <button type="button" onClick={onClick} aria-label={`${children}. ${description}`} className={`rounded-lg border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${active ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-zinc-950/50 text-zinc-400 hover:text-white"}`}>{children}</button>
      <span role="tooltip" className="pointer-events-none absolute left-0 top-[calc(100%+0.5rem)] z-50 hidden w-72 rounded-xl border border-white/10 bg-zinc-950/95 p-3 text-[11px] font-normal leading-5 text-zinc-300 shadow-2xl backdrop-blur-xl group-hover/mode:block group-focus-within/mode:block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-cyan-300">{children}</span>
        {description}
      </span>
    </span>
  );
}

function TooltipRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "red";
}) {
  const toneClass = tone === "cyan" ? "text-cyan-200" : tone === "red" ? "text-red-300" : "text-emerald-200";

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

function compactLabel(value: string) {
  if (value.length <= 34) return value;
  return `${value.slice(0, 31).trim()}...`;
}

function clampShare(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function visualFlowValue(value: number) {
  return Math.max(Math.pow(Math.log10(value + 10), 3), 1);
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

// Physical/economic sequence of each chain's production stages, keyed by the
// raw `stage` value from the input data. Recharts' Sankey (with sort={false})
// stacks same-column nodes in array order, and stage nodes get created in
// whichever order their first (highest-supplier-value) input is processed --
// not in production sequence. Unknown stages sort last instead of erroring.
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

function reorderStageNodes(data: SankeyChartData): SankeyChartData {
  const stageSlots = data.nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.kind === "stage");
  if (stageSlots.length < 2) return data;

  const orderedStageNodes = [...stageSlots]
    .sort((a, b) => stagePhysicalOrder(a.node.id) - stagePhysicalOrder(b.node.id))
    .map(({ node }) => node);

  const newNodes = [...data.nodes];
  stageSlots.forEach(({ index: slot }, i) => {
    newNodes[slot] = orderedStageNodes[i];
  });

  const idByOldIndex = data.nodes.map((node) => node.id);
  const newIndexById = new Map(newNodes.map((node, index) => [node.id, index]));

  const links = data.links.map((link) => ({
    ...link,
    source: newIndexById.get(idByOldIndex[link.source]) ?? link.source,
    target: newIndexById.get(idByOldIndex[link.target]) ?? link.target,
  }));

  return { nodes: newNodes, links };
}

function flowColor(
  mode: ColorMode,
  imports: number,
  exports: number,
  balance: number,
  routeClass?: ProductionRouteClass | null,
) {
  if (mode === "route") return routeClassColor(routeClass);
  if (mode === "imports") return imports > 0 ? "#f87171" : "#52525b";
  if (mode === "exports") return exports > 0 ? "#34d399" : "#52525b";
  const ratio = balance / Math.max(imports + exports, 1);
  return ratio < -0.25 ? "#ef4444" : ratio > 0.25 ? "#22c55e" : "#f59e0b";
}

const ROUTE_CLASS_COLORS: Record<ProductionRouteClass, string> = {
  fossil_dominant: "#f87171",
  transition_underway: "#f59e0b",
  low_carbon_dominant: "#34d399",
  untapped_potential: "#38bdf8",
  undetermined: "#71717a",
};

const ROUTE_CLASS_LABELS: Record<ProductionRouteClass, string> = {
  fossil_dominant: "Fóssil dominante",
  transition_underway: "Transição em curso",
  low_carbon_dominant: "Baixo carbono predominante",
  untapped_potential: "Potencial não realizado",
  undetermined: "Rota indeterminada",
};

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

function signedUsd(value: number) {
  return `${value >= 0 ? "+" : "-"}${usdLong.format(Math.abs(value))}`;
}

export default SovereigntySankeyChart;
