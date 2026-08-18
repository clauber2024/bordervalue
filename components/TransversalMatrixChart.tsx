"use client";

import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProdutoConceitual } from "../types/border-value";
import {
  CAPACITY_THRESHOLD_BRL,
  CHAIN_META,
  MONITORED_CHAINS,
  QUADRANT_META,
  RISK_THRESHOLD_USD,
  classifyQuadrant,
  isExtremeBottleneck,
  riskExposure,
  uniqueProductKey,
  type MonitoredChain,
  type QuadrantId,
} from "../lib/transversalMatrix";

type MatrixDatum = {
  product: ProdutoConceitual;
  x: number;
  y: number;
  quadrant: QuadrantId;
  chain: MonitoredChain;
  ordinal: number;
};

type TransversalMatrixChartProps = {
  data: ProdutoConceitual[];
  activeQuadrant: QuadrantId | "todos";
  selectedProductId: string | null;
  onSelectProduct: (id: string | null) => void;
  className?: string;
};

const glass = "border border-white/[0.08] bg-zinc-900/40 shadow-2xl shadow-black/25 backdrop-blur-xl";

const axisTick = { fill: "#a1a1aa", fontSize: 12 };

const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const usdCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function TransversalMatrixChart({
  data,
  activeQuadrant,
  selectedProductId,
  onSelectProduct,
  className = "",
}: TransversalMatrixChartProps) {
  if (!data.length) {
    return (
      <section className={`${glass} rounded-lg p-6 text-sm text-zinc-400 ${className}`}>
        Nenhum insumo carregado para compor a matriz transversal.
      </section>
    );
  }

  const matrixData: MatrixDatum[] = data.map((product, index) => ({
    product,
    x: Math.max(product.industria.valor_producao_pia, 1),
    y: Math.max(riskExposure(product), 1),
    quadrant: classifyQuadrant(product),
    chain: product.cadeia_prioritaria as MonitoredChain,
    ordinal: index + 1,
  }));

  const capacityDomainMax = Math.max(CAPACITY_THRESHOLD_BRL * 3, ...matrixData.map((item) => item.x * 4));
  const riskDomainMax = Math.max(RISK_THRESHOLD_USD * 3, ...matrixData.map((item) => item.y * 4));
  const missingCapacityCount = matrixData.filter((item) => item.product.industria.valor_producao_pia <= 0).length;

  return (
    <section className={`${glass} overflow-hidden rounded-lg text-zinc-100 ${className}`}>
      <header className="border-b border-white/[0.08] bg-white/[0.025] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Matriz NIB Transversal</p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
          Onde atrair, modernizar ou consolidar capacidade produtiva
        </h2>
        <p className="mt-2 text-xs text-zinc-500">
          Direita = mais capacidade doméstica (PIA) · Acima = maior exposição de importações (FOB/déficit)
        </p>
      </header>

      {missingCapacityCount > 0 ? (
        <div className="mx-4 mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-xs sm:mx-6">
          <p className="font-semibold text-amber-200">
            {missingCapacityCount} de {matrixData.length} itens sem valor de produção PIA publicado
          </p>
          <p className="mt-1 leading-5 text-zinc-400">
            Esses itens aparecem junto à origem do eixo horizontal (capacidade não mensurada), o que indica lacuna
            de publicação, não necessariamente ausência de produção nacional. O quadrante &quot;Modernizar / Expandir&quot;
            fica sub-representado enquanto essa cobertura não for homologada.
          </p>
        </div>
      ) : null}

      <div className="mx-4 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] sm:mx-6">
        {MONITORED_CHAINS.map((chain) => (
          <span key={chain} className="inline-flex items-center gap-1.5 text-zinc-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHAIN_META[chain].color }} />
            {CHAIN_META[chain].shortLabel}
          </span>
        ))}
      </div>

      <div className="mx-4 mt-3 grid grid-cols-1 overflow-hidden rounded-lg border border-white/[0.08] text-[10px] font-bold uppercase tracking-[0.12em] sm:mx-6 sm:grid-cols-3">
        <div className="border-b border-red-400/10 bg-red-400/[0.07] px-3 py-2 text-red-300 sm:border-b-0 sm:border-r">
          {QUADRANT_META.atrair.label}
        </div>
        <div className="border-b border-amber-400/10 bg-amber-400/[0.07] px-3 py-2 text-amber-200 sm:border-b-0 sm:border-r">
          {QUADRANT_META.modernizar.label}
        </div>
        <div className="bg-emerald-400/[0.06] px-3 py-2 text-emerald-200">{QUADRANT_META.zona_segura.label}</div>
      </div>

      <div className="relative h-[440px] min-h-[360px] w-full px-2 py-2 sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 30, right: 44, bottom: 60, left: 84 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <ReferenceArea x1={1} x2={CAPACITY_THRESHOLD_BRL} y1={RISK_THRESHOLD_USD} y2={riskDomainMax} fill="#f87171" fillOpacity={0.05} />
            <ReferenceArea x1={CAPACITY_THRESHOLD_BRL} x2={capacityDomainMax} y1={RISK_THRESHOLD_USD} y2={riskDomainMax} fill="#fbbf24" fillOpacity={0.05} />
            <ReferenceArea x1={1} x2={capacityDomainMax} y1={1} y2={RISK_THRESHOLD_USD} fill="#34d399" fillOpacity={0.04} />
            <ReferenceLine x={CAPACITY_THRESHOLD_BRL} stroke="#22d3ee" strokeDasharray="4 4" strokeOpacity={0.55} />
            <ReferenceLine y={RISK_THRESHOLD_USD} stroke="#fbbf24" strokeDasharray="4 4" strokeOpacity={0.55} />

            <XAxis
              type="number"
              scale="log"
              dataKey="x"
              domain={[1, capacityDomainMax]}
              ticks={[1, CAPACITY_THRESHOLD_BRL, capacityDomainMax]}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "rgba(161,161,170,0.36)" }}
              tickMargin={14}
              tickFormatter={(value) => (Number(value) <= 1 ? "Sem PIA" : brlCompact.format(Number(value)))}
              label={{ value: "Capacidade produtiva doméstica (PIA, R$)", position: "insideBottom", offset: -14, fill: "#71717a", fontSize: 11 }}
            />
            <YAxis
              type="number"
              scale="log"
              dataKey="y"
              domain={[1, riskDomainMax]}
              ticks={[1, RISK_THRESHOLD_USD, riskDomainMax]}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "rgba(161,161,170,0.36)" }}
              tickMargin={12}
              tickFormatter={(value) => (Number(value) <= 1 ? "Sem exposição" : usdCompact.format(Number(value)))}
              label={{ value: "Risco de suprimento (FOB/déficit, US$)", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 11 }}
            />
            <Tooltip cursor={{ stroke: "#71717a", strokeDasharray: "3 3" }} content={<MatrixTooltip />} />
            <Scatter
              data={matrixData}
              shape={(props: any) => (
                <MatrixPoint
                  {...props}
                  activeQuadrant={activeQuadrant}
                  selectedProductId={selectedProductId}
                  onSelectProduct={onSelectProduct}
                />
              )}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function MatrixPoint({
  cx = 0,
  cy = 0,
  payload,
  activeQuadrant,
  selectedProductId,
  onSelectProduct,
}: {
  cx?: number;
  cy?: number;
  payload?: MatrixDatum;
  activeQuadrant: QuadrantId | "todos";
  selectedProductId: string | null;
  onSelectProduct: (id: string | null) => void;
}) {
  if (!payload) return null;

  const color = CHAIN_META[payload.chain].color;
  const key = uniqueProductKey(payload.product);
  const isSelected = selectedProductId === key;
  const isDimmed = activeQuadrant !== "todos" && payload.quadrant !== activeQuadrant;

  return (
    <g
      className="cursor-pointer transition-opacity duration-200"
      style={{ opacity: isDimmed ? 0.18 : 1 }}
      role="button"
      aria-label={`Selecionar ${payload.product.produto_nome}`}
      onClick={() => onSelectProduct(isSelected ? null : key)}
    >
      {isSelected ? <circle cx={cx} cy={cy} r={15} fill="none" stroke="#fafafa" strokeWidth={1.5} /> : null}
      <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.9} stroke="#09090b" strokeOpacity={0.5} strokeWidth={1} />
      <text x={cx} y={cy + 3.2} textAnchor="middle" fill="#09090b" fontSize={9} fontWeight={800}>
        {payload.ordinal}
      </text>
    </g>
  );
}

function MatrixTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MatrixDatum }> }) {
  if (!active || !payload?.length) return null;

  const { product, quadrant, chain } = payload[0].payload;

  return (
    <div className="min-w-72 rounded-lg border border-zinc-800/70 bg-zinc-950/95 p-4 text-xs text-zinc-100 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: CHAIN_META[chain].color }}>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHAIN_META[chain].color }} />
        {CHAIN_META[chain].label}
      </div>
      <p className="mt-1 text-sm font-bold tracking-tight text-white">{product.produto_nome}</p>
      <p className="mt-1 text-[11px] font-medium text-cyan-300">{QUADRANT_META[quadrant].label}</p>

      <div className="mt-3 space-y-2">
        <TooltipRow label="Capacidade doméstica (PIA)" value={brlCompact.format(product.industria.valor_producao_pia)} />
        <TooltipRow label="Importações FOB" value={usdCompact.format(product.comercio.importacao_valor_fob)} />
        <TooltipRow label="Origem principal" value={product.comercio.principal_pais_origem || "Não publicado"} />
        <TooltipRow
          label="HHI"
          value={Math.round(product.comercio.hhi_global).toLocaleString("pt-BR")}
          tone={isExtremeBottleneck(product) ? "text-red-300" : undefined}
        />
      </div>
    </div>
  );
}

function TooltipRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-5">
      <span className="text-zinc-500">{label}</span>
      <strong className={`text-right font-semibold ${tone ?? "text-zinc-100"}`}>{value}</strong>
    </div>
  );
}

export default TransversalMatrixChart;
