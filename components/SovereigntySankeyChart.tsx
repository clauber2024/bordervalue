"use client";

import { useMemo } from "react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { ProdutoConceitual } from "../types/border-value";

type SankeyNodeDatum = {
  id: string;
  name: string;
  kind: "supplier" | "product";
  value?: number;
};

type SankeyLinkDatum = {
  source: number;
  target: number;
  value: number;
  rawValue: number;
  alpha: number;
  alphaApplied: boolean;
  supplierName: string;
  productName: string;
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
}: SovereigntySankeyChartProps) {
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
  }, [products]);

  const totalVisible = sankeyData.links.reduce((sum, link) => sum + link.value, 0);
  const totalRaw = sankeyData.links.reduce((sum, link) => sum + link.rawValue, 0);
  const alphaLinks = sankeyData.links.filter((link) => link.alphaApplied && link.alpha < 1).length;

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
            <MetricPill label="Fluxo exibido" value={usdCompact.format(totalVisible)} />
            <MetricPill label="Fluxo bruto" value={usdCompact.format(totalRaw)} />
            <MetricPill label="Fluxos com Alpha" value={String(alphaLinks)} />
          </div>
        </div>
      </header>

      <div className="px-2 py-5 sm:px-4">
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={sankeyData}
              dataKey="value"
              nameKey="name"
              node={renderNode}
              link={renderLink}
              nodePadding={26}
              nodeWidth={18}
              linkCurvature={0.55}
              iterations={48}
              margin={{ top: 28, right: 156, bottom: 28, left: 24 }}
              sort={false}
            >
              <Tooltip content={<FlowTooltip />} />
            </Sankey>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 px-1 text-xs lg:grid-cols-3">
          <ReadingPill
            label="Direção"
            value="O fluxo vai do principal fornecedor internacional ao produto conceitual analisado."
          />
          <ReadingPill
            label="Espessura"
            value="A largura da banda representa o valor FOB importado. Quando o Alpha está aplicado, a banda encolhe proporcionalmente."
          />
          <ReadingPill
            label="Leitura executiva"
            value="Códigos técnicos foram removidos desta visualização; eles permanecem apenas na gaveta de rastreabilidade."
          />
        </div>
      </div>
    </section>
  );
}

function renderNode({ x, y, width, height, payload }: SankeyNodeRenderProps) {
  const isSupplier = payload.kind === "supplier";
  const fill = isSupplier ? "#38bdf8" : "#34d399";
  const labelX = x + width + 10;
  const labelY = y + Math.max(height / 2, 8);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 8)}
        rx={5}
        fill={fill}
        fillOpacity={0.3}
        stroke={fill}
        strokeOpacity={0.66}
        strokeWidth={1.2}
        filter="drop-shadow(0 8px 18px rgba(0,0,0,0.36))"
      />
      <text x={labelX} y={labelY - 5} fill="#fafafa" fontSize={12} fontWeight={700} dominantBaseline="middle">
        {compactLabel(payload.name)}
      </text>
      <text x={labelX} y={labelY + 11} fill="#a1a1aa" fontSize={10} fontWeight={500} dominantBaseline="middle">
        {isSupplier ? "Principal fornecedor" : "Produto conceitual"}
      </text>
    </g>
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
}: SankeyLinkRenderProps) {
  const strokeWidth = Math.max(linkWidth, 1.4);
  const path = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
  const opacity = payload.alphaApplied && payload.alpha < 1 ? 0.38 : 0.5;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="#22d3ee"
        strokeWidth={strokeWidth}
        strokeOpacity={0.15}
        strokeLinecap="round"
        pointerEvents="none"
      />
      <path
        d={path}
        fill="none"
        stroke={payload.alphaApplied && payload.alpha < 1 ? "#a7f3d0" : "#67e8f9"}
        strokeWidth={Math.max(strokeWidth * 0.55, 1)}
        strokeOpacity={opacity}
        strokeLinecap="round"
        pointerEvents="stroke"
      />
    </g>
  );
}

function FlowTooltip({ active, payload }: SankeyTooltipProps) {
  if (!active || !payload?.length) return null;

  const activePayload = payload[0]?.payload;
  if (!activePayload || !("sourceX" in activePayload)) return null;

  const link = activePayload.payload;
  const reductionCopy = link.alphaApplied
    ? `Alpha aplicado: ${percent.format(link.alpha)} do fluxo bruto aparece na rede.`
    : "Fluxo bruto exibido sem corte proporcional.";

  return (
    <div className="max-w-80 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-100 shadow-xl">
      <p className="font-semibold text-white">{link.productName}</p>
      <p className="mt-1 text-zinc-400">Origem principal: {link.supplierName}</p>
      <div className="mt-3 space-y-2">
        <TooltipRow label="Fluxo exibido" value={usdLong.format(link.value)} tone="emerald" />
        <TooltipRow label="Fluxo bruto" value={usdLong.format(link.rawValue)} tone="cyan" />
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

function TooltipRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "emerald";
}) {
  const toneClass = tone === "cyan" ? "text-cyan-200" : "text-emerald-200";

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
  if (value.length <= 26) return value;
  return `${value.slice(0, 23).trim()}...`;
}

function clampShare(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export default SovereigntySankeyChart;
