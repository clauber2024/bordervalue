"use client";

import type { ProdutoConceitual } from "../types/border-value";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type NIBMatrixChartProps = {
  data: ProdutoConceitual[];
  capacidadeThreshold?: number;
  deficitThreshold?: number;
  className?: string;
};

type MatrixDatum = ProdutoConceitual & {
  matrixCapacityValue: number;
  matrixTradeMagnitude: number;
  matrixSize: number;
  matrixState: QuadrantLabel;
};

type QuadrantLabel =
  | "Modernizar / Expandir"
  | "Atrair Investimento / Planta Nova"
  | "Zona Segura / Competitiva"
  | "Atenção Estratégica";

type MatrixPointProps = {
  cx?: number;
  cy?: number;
  payload?: MatrixDatum;
};

type NIBTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: MatrixDatum }>;
};

const glass =
  "border border-zinc-800/50 bg-zinc-950/80 shadow-2xl shadow-black/50 backdrop-blur-xl";

const axisTick = {
  fill: "#a1a1aa",
  fontSize: 12,
};

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

const brlLong = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const usdLong = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function NIBMatrixChart({
  data,
  capacidadeThreshold = 30000000,
  deficitThreshold = 100000000,
  className = "",
}: NIBMatrixChartProps) {
  if (!data.length) {
    return (
      <section className={`${glass} rounded-lg p-6 text-sm text-zinc-400 ${className}`}>
        Nenhum produto conceitual disponível para compor a matriz NIB.
      </section>
    );
  }

  const matrixData = data.map((item) => toMatrixDatum(item, capacidadeThreshold, deficitThreshold));

  return (
    <section className={`${glass} overflow-hidden rounded-lg text-zinc-100 ${className}`}>
      <header className="border-b border-zinc-800/50 bg-white/[0.025] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Nova Indústria Brasil
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
              Matriz NIB: capacidade doméstica x exposição comercial
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-[22rem]">
            <MetricPill label="Corte capacidade" value={brlCompact.format(capacidadeThreshold)} />
            <MetricPill label="Corte déficit" value={usdCompact.format(deficitThreshold)} />
          </div>
        </div>
      </header>

      <div className="h-[460px] min-h-[340px] w-full px-2 py-5 sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 38, right: 42, bottom: 48, left: 28 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <ReferenceLine
              x={Math.max(capacidadeThreshold, 1)}
              stroke="#22d3ee"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{ value: "corte de capacidade", fill: "#a5f3fc", fontSize: 11, position: "top" }}
            />
            <ReferenceLine
              y={Math.max(deficitThreshold, 1)}
              stroke="#fbbf24"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{ value: "corte de déficit", fill: "#fde68a", fontSize: 11, position: "right" }}
            />

            <XAxis
              type="number"
              scale="log"
              dataKey="matrixCapacityValue"
              name="Capacidade doméstica"
              domain={["auto", "auto"]}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "rgba(161,161,170,0.36)" }}
              tickFormatter={(value) => brlCompact.format(Number(value))}
              label={{
                value: "Capacidade doméstica (escala logarítmica)",
                position: "insideBottom",
                offset: -28,
                fill: "#d4d4d8",
                fontSize: 12,
              }}
            />
            <YAxis
              type="number"
              scale="log"
              dataKey="matrixTradeMagnitude"
              name="Exposição comercial"
              domain={["auto", "auto"]}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "rgba(161,161,170,0.36)" }}
              tickFormatter={(value) => usdCompact.format(Number(value))}
              label={{
                value: "Magnitude do déficit/superávit em USD (escala logarítmica)",
                angle: -90,
                position: "insideLeft",
                fill: "#d4d4d8",
                fontSize: 12,
              }}
            />
            <ZAxis type="number" dataKey="matrixSize" range={[90, 320]} name="Magnitude estratégica" />
            <Tooltip cursor={{ stroke: "#71717a", strokeDasharray: "3 3" }} content={<NIBTooltip />} />
            <Scatter data={matrixData} name="Produtos conceituais" fill="#22d3ee" shape={<MatrixPoint />} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="border-t border-zinc-800/60 bg-white/[0.025] px-4 py-4 sm:px-6">
        <div className="grid grid-cols-1 gap-3 text-xs lg:grid-cols-3">
          <InterpretationCard
            title="Como ler"
            tone="cyan"
            body="Mais à direita indica maior capacidade doméstica. Mais acima indica maior magnitude comercial, com pontos amarelos para déficit e verdes para superávit."
          />
          <InterpretationCard
            title="Escala logarítmica"
            tone="amber"
            body="A escala logarítmica evita que fluxos bilionários esmaguem produtos menores, preservando a comparação visual entre itens da cadeia."
          />
          <InterpretationCard
            title="Leitura executiva"
            tone="emerald"
            body="O gráfico mostra nomes de produtos e interpretação de risco; códigos técnicos permanecem restritos à gaveta de rastreabilidade."
          />
        </div>

        <TraceabilityPanel
          year={String(getReferenceYear(data))}
          sources={getSourceSummary(data)}
          method="Classificação NIB por cruzamento entre exposição comercial FOB e capacidade doméstica aproximada pelo valor de produção PIA."
          confidence={getConfidenceSummary(data)}
        />
      </div>
    </section>
  );
}

function InterpretationCard({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "cyan" | "amber" | "emerald";
}) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
    amber: "border-amber-300/20 bg-amber-400/10 text-amber-200",
    emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  };

  return (
    <div className={`rounded-lg border px-3 py-3 ${tones[tone]}`}>
      <p className="font-bold uppercase tracking-[0.14em]">{title}</p>
      <p className="mt-2 leading-5 text-zinc-300">{body}</p>
    </div>
  );
}

function TraceabilityPanel({
  year,
  sources,
  method,
  confidence,
}: {
  year: string;
  sources: string;
  method: string;
  confidence: string;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-800/60 pt-4 text-xs lg:grid-cols-[0.8fr_1.4fr_1.4fr_0.9fr]">
      <TraceabilityItem label="Ano-base" value={year} />
      <TraceabilityItem label="Fontes" value={sources} />
      <TraceabilityItem label="Método" value={method} />
      <TraceabilityItem label="Confiança" value={confidence} />
    </div>
  );
}

function TraceabilityItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/55 px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 leading-5 text-zinc-300">{value}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-white/[0.04] px-3 py-2">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </span>
      <strong className="mt-1 block truncate text-sm font-semibold text-zinc-100">{value}</strong>
    </div>
  );
}

function MatrixPoint({ cx = 0, cy = 0, payload }: MatrixPointProps) {
  if (!payload) return null;

  const pointColor = getPointColor(payload);
  const label = getPointLabelLayout(payload);

  return (
    <g>
      <circle cx={cx} cy={cy} r={15} fill={pointColor} fillOpacity={0.12} />
      <circle cx={cx} cy={cy} r={7} fill={pointColor} stroke="#fafafa" strokeOpacity={0.86} strokeWidth={1.4} />
      <line
        x1={cx + 8}
        y1={cy}
        x2={cx + label.x - 5}
        y2={cy + label.y - 5}
        stroke={pointColor}
        strokeOpacity={0.42}
        strokeWidth={1}
      />
      <rect
        x={cx + label.x - 7}
        y={cy + label.y - 19}
        width={label.width}
        height={34}
        rx={6}
        fill="#09090b"
        fillOpacity={0.86}
        stroke={pointColor}
        strokeOpacity={0.3}
      />
      <text x={cx + label.x} y={cy + label.y - 6} fill="#fafafa" fontSize={11} fontWeight={700}>
        {compactLabel(payload.produto_nome)}
      </text>
      <text x={cx + label.x} y={cy + label.y + 9} fill="#a1a1aa" fontSize={10}>
        {payload.matrixState}
      </text>
    </g>
  );
}

function getPointLabelLayout(product: MatrixDatum) {
  const width = Math.min(Math.max(product.produto_nome.length * 6.8, 170), 250);
  const y = product.comercio.deficit_comercial >= 0 ? -22 : 32;
  return { x: 18, y, width };
}

function NIBTooltip({ active, payload }: NIBTooltipProps) {
  if (!active || !payload?.length) return null;

  const product = payload[0].payload;
  const saldoLabel = product.comercio.deficit_comercial < 0 ? "Superávit comercial" : "Déficit comercial";

  return (
    <div className="min-w-72 rounded-lg border border-zinc-800/70 bg-zinc-950/95 p-4 text-xs text-zinc-100 shadow-2xl backdrop-blur-xl">
      <p className="text-sm font-bold tracking-tight text-white">{product.produto_nome}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-300">
        {product.matrixState}
      </p>

      <div className="mt-3 space-y-2.5">
        <TooltipRow
          label="Capacidade doméstica"
          value={brlLong.format(product.industria.valor_producao_pia)}
          tone="cyan"
        />
        <TooltipRow
          label={saldoLabel}
          value={usdLong.format(product.comercio.deficit_comercial)}
          tone={product.comercio.deficit_comercial < 0 ? "emerald" : "amber"}
        />
        <TooltipRow
          label="Importações FOB"
          value={usdLong.format(product.comercio.importacao_valor_fob)}
          tone="zinc"
        />
        <TooltipRow
          label="Exportações FOB"
          value={usdLong.format(product.comercio.exportacao_valor_fob)}
          tone="zinc"
        />
      </div>
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
  tone: "cyan" | "emerald" | "amber" | "zinc";
}) {
  const tones = {
    cyan: "text-cyan-200",
    emerald: "text-emerald-200",
    amber: "text-amber-200",
    zinc: "text-zinc-100",
  };

  return (
    <div className="flex items-center justify-between gap-5">
      <span className="text-zinc-500">{label}</span>
      <strong className={`text-right font-semibold ${tones[tone]}`}>{value}</strong>
    </div>
  );
}

function toMatrixDatum(
  product: ProdutoConceitual,
  capacidadeThreshold: number,
  deficitThreshold: number,
): MatrixDatum {
  const capacity = Math.max(product.industria.valor_producao_pia, 1);
  const tradeMagnitude = Math.max(Math.abs(product.comercio.deficit_comercial), 1);

  return {
    ...product,
    matrixCapacityValue: capacity,
    matrixTradeMagnitude: tradeMagnitude,
    matrixSize: Math.max(tradeMagnitude, capacity, 1),
    matrixState: getMatrixState(product, capacidadeThreshold, deficitThreshold),
  };
}

function getReferenceYear(data: ProdutoConceitual[]) {
  return Math.max(...data.map((item) => item.auditoria.reference_year));
}

function getSourceSummary(data: ProdutoConceitual[]) {
  const alphaSources = Array.from(
    new Set(data.map((item) => item.fator_proporcionalidade.fonte_proxy).filter(Boolean)),
  );

  const base = "Comex Stat; PIA-Produto/PRODLIST; RAIS quando publicado no registro.";
  return alphaSources.length ? `${base} Proxies proporcionais: ${alphaSources.join("; ")}.` : base;
}

function getConfidenceSummary(data: ProdutoConceitual[]) {
  const levels = Array.from(new Set(data.map((item) => item.auditoria.confidence_level)));
  const labels: Record<ProdutoConceitual["auditoria"]["confidence_level"], string> = {
    alta: "alta",
    media: "média",
    baixa: "baixa",
  };

  return levels.map((level) => labels[level]).join(" / ");
}

function getMatrixState(
  product: ProdutoConceitual,
  capacidadeThreshold: number,
  deficitThreshold: number,
): QuadrantLabel {
  const highCapacity = product.industria.valor_producao_pia >= capacidadeThreshold;
  const highDeficit = product.comercio.deficit_comercial >= deficitThreshold;

  if (highDeficit && highCapacity) return "Modernizar / Expandir";
  if (highDeficit && !highCapacity) return "Atrair Investimento / Planta Nova";
  if (!highDeficit && highCapacity) return "Zona Segura / Competitiva";
  return "Atenção Estratégica";
}

function getPointColor(product: MatrixDatum) {
  if (product.comercio.deficit_comercial < 0) return "#34d399";
  if (product.industria.valor_producao_pia === 0) return "#fbbf24";
  return "#38bdf8";
}

function compactLabel(value: string) {
  if (value.length <= 24) return value;
  return `${value.slice(0, 21).trim()}...`;
}

export default NIBMatrixChart;
