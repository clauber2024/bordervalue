"use client";

import { useState } from "react";
import type { ProdutoConceitual } from "../types/border-value";
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
  matrixOrdinal: number;
  matrixOffsetX: number;
  matrixOffsetY: number;
  matrixClusterKey: string;
  matrixClusterSize: number;
};

type QuadrantLabel =
  | "Modernizar / Expandir"
  | "Atrair Investimento / Planta Nova"
  | "Zona Segura / Competitiva"
  | "Atenção Estratégica"
  | "Substituir / Descarbonizar";

type MatrixPointProps = {
  cx?: number;
  cy?: number;
  payload?: MatrixDatum;
  expandedCluster?: string | null;
  onToggleCluster?: (clusterKey: string) => void;
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
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  if (!data.length) {
    return (
      <section className={`${glass} rounded-lg p-6 text-sm text-zinc-400 ${className}`}>
        Nenhum produto conceitual disponível para compor a matriz NIB.
      </section>
    );
  }

  const matrixData = addCollisionOffsets(
    data.map((item, index) => toMatrixDatum(item, capacidadeThreshold, deficitThreshold, index + 1)),
    expandedCluster,
  );
  const capacityDomainMax = Math.max(
    capacidadeThreshold * 3,
    ...matrixData.map((item) => item.matrixCapacityValue * 4),
  );
  const deficitDomainMax = Math.max(
    deficitThreshold * 3,
    ...matrixData.map((item) => item.matrixTradeMagnitude * 4),
  );
  const missingCapacityCount = matrixData.filter(
    (item) => item.industria.valor_producao_pia <= 0,
  ).length;
  const hasCapacityCoverage = missingCapacityCount < matrixData.length;
  const proxyCount = matrixData.filter((item) => item.auditoria.ncm_mapping_status === "proxy").length;

  return (
    <section className={`${glass} overflow-hidden rounded-lg text-zinc-100 ${className}`}>
      <header className="border-b border-zinc-800/50 bg-white/[0.025] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Nova Indústria Brasil
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
              {hasCapacityCoverage
                ? "Onde ampliar, atrair ou monitorar capacidade produtiva?"
                : "Cobertura produtiva necessária para orientar a política industrial"}
            </h2>
            <p className="mt-2 text-xs text-zinc-500">
              {hasCapacityCoverage
                ? "Direita = mais capacidade nacional · Acima = maior déficit externo"
                : "O comércio está observado; a capacidade nacional ainda precisa ser homologada."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-[22rem]">
            <MetricPill label="Capacidade produtiva" value={hasCapacityCoverage ? brlCompact.format(capacidadeThreshold) : "Não mensurada"} />
            <MetricPill label="Corte déficit" value={usdCompact.format(deficitThreshold)} />
          </div>
        </div>
      </header>

      {hasCapacityCoverage ? (
        <>
      {proxyCount > 0 ? (
        <div className="mx-4 mt-4 rounded-lg border border-amber-300/15 bg-amber-400/[0.06] px-4 py-3 text-xs text-zinc-400 sm:mx-6">
          <strong className="text-amber-200">{proxyCount} oportunidades em validação por proxy.</strong>{" "}
          Elas entram no posicionamento para revelar possibilidades de atração ou expansão, mas exigem homologação de uso produtivo antes de uma decisão operacional.
        </div>
      ) : null}

      {missingCapacityCount > 0 && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-xs sm:mx-6">
          <p className="font-semibold text-amber-200">
            {missingCapacityCount} de {matrixData.length} itens sem valor de produção PIA publicado
          </p>
          <p className="mt-1 leading-5 text-zinc-400">
            Esses itens aparecem junto à origem do eixo horizontal. Isso indica lacuna de mensuração da capacidade nacional, não necessariamente ausência de produção no Brasil.
          </p>
        </div>
      )}

      <div className="px-4 pt-5 text-xs sm:px-6">
        <p className="font-semibold text-zinc-300">Eixo vertical: déficit comercial anual (US$ FOB/ano)</p>
        <p className="mt-1 text-zinc-500">Quanto mais alto, maior a necessidade de importações.</p>
      </div>

      <div className="mx-4 mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-zinc-800/70 text-[10px] font-bold uppercase tracking-[0.12em] sm:mx-6 sm:grid-cols-4">
        <div className="border-b border-r border-zinc-800/70 bg-red-400/[0.07] px-3 py-2.5 text-red-300 sm:border-b-0">Déficit alto · Atrair</div>
        <div className="border-b border-zinc-800/70 bg-amber-400/[0.07] px-3 py-2.5 text-amber-200 sm:border-b-0 sm:border-r">Déficit alto · Modernizar</div>
        <div className="border-r border-zinc-800/70 bg-sky-400/[0.06] px-3 py-2.5 text-sky-200">Déficit baixo · Monitorar</div>
        <div className="bg-emerald-400/[0.06] px-3 py-2.5 text-emerald-200">Déficit baixo · Competitiva</div>
      </div>

      <div className="relative h-[470px] min-h-[380px] w-full px-2 py-2 sm:px-4">
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex max-w-[13rem] flex-col gap-1.5 rounded-lg border border-zinc-800/70 bg-zinc-950/85 px-3 py-2.5 text-[10.5px] leading-tight text-zinc-300 shadow-lg backdrop-blur-md sm:right-5">
          <MatrixLegend color="#f87171" label="Atrair nova capacidade" />
          <MatrixLegend color="#fbbf24" label="Modernizar e expandir" />
          <MatrixLegend color="#34d399" label="Posição competitiva" />
          <MatrixLegend color="#38bdf8" label="Monitorar" />
          <MatrixLegend color="#c084fc" label="Substituir / descarbonizar" />
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 38, right: 54, bottom: 70, left: 92 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <ReferenceArea x1={1} x2={capacidadeThreshold} y1={deficitThreshold} y2={deficitDomainMax} fill="#f87171" fillOpacity={0.055} />
            <ReferenceArea x1={capacidadeThreshold} x2={capacityDomainMax} y1={deficitThreshold} y2={deficitDomainMax} fill="#fbbf24" fillOpacity={0.055} />
            <ReferenceArea x1={capacidadeThreshold} x2={capacityDomainMax} y1={1} y2={deficitThreshold} fill="#34d399" fillOpacity={0.045} />
            <ReferenceArea x1={1} x2={capacidadeThreshold} y1={1} y2={deficitThreshold} fill="#38bdf8" fillOpacity={0.045} />
            <ReferenceLine
              x={Math.max(capacidadeThreshold, 1)}
              stroke="#22d3ee"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
            <ReferenceLine
              y={Math.max(deficitThreshold, 1)}
              stroke="#fbbf24"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />

            <XAxis
              type="number"
              scale="log"
              dataKey="matrixCapacityValue"
              name="Capacidade doméstica"
              domain={[1, capacityDomainMax]}
              ticks={[1, capacidadeThreshold, capacityDomainMax]}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "rgba(161,161,170,0.36)" }}
              tickMargin={14}
              tickFormatter={(value) => Number(value) <= 1 ? "Sem dado PIA" : brlCompact.format(Number(value))}
            />
            <YAxis
              type="number"
              scale="log"
              dataKey="matrixTradeMagnitude"
              name="Déficit externo"
              domain={[1, deficitDomainMax]}
              ticks={[1, deficitThreshold, deficitDomainMax]}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "rgba(161,161,170,0.36)" }}
              tickMargin={12}
              tickFormatter={(value) => Number(value) <= 1 ? "Sem déficit" : usdCompact.format(Number(value))}
            />
            <ZAxis type="number" dataKey="matrixSize" range={[90, 320]} name="Magnitude estratégica" />
            <Tooltip cursor={{ stroke: "#71717a", strokeDasharray: "3 3" }} content={<NIBTooltip />} />
            <Scatter
              data={matrixData}
              name="Produtos conceituais"
              fill="#22d3ee"
              shape={(
                <MatrixPoint
                  expandedCluster={expandedCluster}
                  onToggleCluster={(clusterKey) => setExpandedCluster((current) => current === clusterKey ? null : clusterKey)}
                />
              )}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="px-4 pb-5 text-center text-xs sm:px-6">
        <p className="font-semibold text-zinc-300">Eixo horizontal: valor anual da produção industrial no Brasil (R$/ano, PIA)</p>
        <p className="mt-1 text-zinc-500">Quanto mais à direita, maior a capacidade produtiva nacional observada.</p>
      </div>
        </>
      ) : (
        <CommercialExposurePanel data={matrixData} />
      )}

      {hasCapacityCoverage && (
      <div className="space-y-2 border-t border-zinc-800/60 px-4 py-4 sm:px-6">
        {matrixData.map((item) => (
          <details key={`${item.produto_nome}-${item.matrixOrdinal}`} className="group overflow-hidden rounded-lg border border-zinc-800/60 bg-white/[0.025]">
            <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-zinc-950" style={{ backgroundColor: getPointColor(item) }}>
                {item.matrixOrdinal}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <p className="break-words text-xs font-semibold leading-5 text-zinc-200">{item.produto_nome}</p>
                  <span className="shrink-0 text-[10px] font-semibold text-cyan-300 group-open:hidden">Ver classificação</span>
                  <span className="hidden shrink-0 text-[10px] font-semibold text-cyan-300 group-open:inline">Ocultar detalhes</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">{formatCapacityPosition(item)} · {formatTradePosition(item)}</p>
              </div>
            </summary>
            <div className="border-t border-white/[0.06] px-4 py-4 sm:pl-14">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ExpandedMetric label="Classificação NIB" value={item.matrixState} />
                <ExpandedMetric label="Importações FOB" value={usdCompact.format(item.comercio.importacao_valor_fob)} />
                <ExpandedMetric label="Exportações FOB" value={usdCompact.format(item.comercio.exportacao_valor_fob)} />
                <ExpandedMetric label="Dependência externa" value={`${(Math.min(item.industria.dependencia_externa_fracao, 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`} />
                <ExpandedMetric label="Concentração das origens (HHI)" value={integerNumber(item.comercio.hhi_global)} />
                <ExpandedMetric label="Principal fornecedor" value={item.comercio.principal_pais_origem || "Não publicado"} />
                <ExpandedMetric label="Confiança" value={confidenceLabel(item.auditoria.confidence_level)} />
                <ExpandedMetric label="Status da cesta" value={item.auditoria.ncm_mapping_status === "proxy" ? "Proxy · requer homologação de uso" : "Validada"} />
              </div>
              <p className="mt-4 rounded-lg border border-white/[0.06] bg-zinc-950/45 px-3 py-2.5 text-xs leading-5 text-zinc-400">
                <strong className="text-zinc-200">Por que recebeu esta classificação?</strong>{" "}{matrixStateExplanation(item)}
              </p>
              {getTransitionGuardrail(item) ? <p className="mt-2 text-xs font-semibold leading-5 text-purple-300">{getTransitionGuardrail(item)}</p> : null}
            </div>
          </details>
        ))}
      </div>
      )}

      <div className="border-t border-zinc-800/60 bg-white/[0.025] px-4 py-4 sm:px-6">
        {hasCapacityCoverage ? (
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2 xl:grid-cols-4">
          <InterpretationCard
            title="Atrair nova capacidade"
            tone="red"
            body="Alto déficit e baixa capacidade nacional. Prioridade para atração de plantas, financiamento e transferência tecnológica."
          />
          <InterpretationCard
            title="Modernizar e expandir"
            tone="amber"
            body="Alto déficit, mas já existe capacidade nacional relevante. Prioridade para expansão, produtividade e substituição competitiva de importações."
          />
          <InterpretationCard
            title="Posição competitiva"
            tone="emerald"
            body="Capacidade nacional acima do corte e déficit controlado ou superávit. Prioridade para consolidar e ampliar mercados."
          />
          <InterpretationCard
            title="Monitorar"
            tone="blue"
            body="Déficit abaixo do corte, mas a capacidade observada ainda é pequena ou incompleta. Exige acompanhamento antes de recomendar investimento."
          />
          <InterpretationCard
            title="Substituir / descarbonizar"
            tone="purple"
            body="A trava climática prevalece sobre o quadrante econômico: insumos fósseis não recebem recomendação automática de expansão."
          />
        </div>
        ) : null}

        <TraceabilityPanel
          year={String(getReferenceYear(data))}
          sources={hasCapacityCoverage ? getSourceSummary(data) : "Comex Stat para importações, exportações e saldo comercial FOB."}
          method={hasCapacityCoverage
            ? "Classificação NIB por cruzamento entre exposição comercial FOB e capacidade doméstica aproximada pelo valor de produção PIA."
            : "Ordenação pela magnitude absoluta do saldo comercial. Não houve classificação de capacidade nem recomendação NIB neste recorte."}
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
  tone: "red" | "amber" | "emerald" | "blue" | "purple";
}) {
  const tones = {
    red: "border-red-300/20 bg-red-400/10 text-red-200",
    amber: "border-amber-300/20 bg-amber-400/10 text-amber-200",
    emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
    blue: "border-sky-300/20 bg-sky-400/10 text-sky-200",
    purple: "border-purple-300/20 bg-purple-400/10 text-purple-200",
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

function MatrixLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function ExpandedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-zinc-950/40 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">{label}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-zinc-300">{value}</p>
    </div>
  );
}

function integerNumber(value: number) {
  return Math.round(value).toLocaleString("pt-BR");
}

function confidenceLabel(value: ProdutoConceitual["auditoria"]["confidence_level"]) {
  return ({ alta: "Alta", media: "Média", baixa: "Baixa" } as const)[value];
}

function matrixStateExplanation(item: MatrixDatum) {
  if (getTransitionGuardrail(item)) {
    return "A trava climática substitui a recomendação puramente econômica: a prioridade é reduzir o uso fóssil e desenvolver alternativas de baixo carbono.";
  }
  if (item.industria.valor_producao_pia <= 0) {
    return "O comércio exterior está observado, mas a capacidade produtiva não possui valor PIA publicado. A posição é indicativa e não comprova ausência de produção nacional.";
  }
  if (item.matrixState === "Atrair Investimento / Planta Nova") {
    return "O déficit supera o corte de política industrial e a capacidade nacional observada permanece abaixo do corte.";
  }
  if (item.matrixState === "Modernizar / Expandir") {
    return "O déficit supera o corte, mas já existe capacidade produtiva nacional relevante que pode ser modernizada ou ampliada.";
  }
  if (item.matrixState === "Zona Segura / Competitiva") {
    return "A capacidade nacional está acima do corte e o déficit está controlado ou há superávit comercial.";
  }
  return "O déficit está abaixo do corte, mas a capacidade observada ainda recomenda acompanhamento antes de uma intervenção industrial.";
}

function CommercialExposurePanel({ data }: { data: MatrixDatum[] }) {
  const orderedData = [...data].sort(
    (a, b) => Math.abs(b.comercio.deficit_comercial) - Math.abs(a.comercio.deficit_comercial),
  );
  const maximumMagnitude = Math.max(
    ...orderedData.map((item) => Math.abs(item.comercio.deficit_comercial)),
    1,
  );

  return (
    <div className="m-4 overflow-hidden rounded-xl border border-zinc-800/70 bg-white/[0.02] sm:m-6">
      <div className="border-b border-zinc-800/60 px-4 py-4 sm:px-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Leitura disponível: exposição comercial</p>
        <h3 className="mt-2 text-lg font-semibold text-white">Déficit e superávit por produto</h3>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          A largura compara o saldo comercial em US$ FOB. A classificação de capacidade permanece suspensa até a homologação PIA/PRODLIST.
        </p>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-5">
        {orderedData.map((item) => {
          const isSurplus = item.comercio.deficit_comercial < 0;
          const magnitude = Math.abs(item.comercio.deficit_comercial);
          const width = Math.max((magnitude / maximumMagnitude) * 100, 1.5);

          return (
            <div key={`${item.produto_nome}-${item.matrixOrdinal}`}>
              <div className="mb-2 flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="font-semibold text-zinc-200">{item.produto_nome}</span>
                <span className={isSurplus ? "shrink-0 text-emerald-300" : "shrink-0 text-red-300"}>
                  {usdCompact.format(magnitude)} de {isSurplus ? "superávit" : "déficit"}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-900">
                <div
                  className={`h-full rounded-full ${isSurplus ? "bg-emerald-400" : "bg-red-400"}`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-xs text-zinc-400 sm:px-5">
        <strong className="text-amber-200">Lacuna produtiva:</strong> nenhum item deste recorte possui valor PIA publicado; isso não significa produção nacional igual a zero.
      </div>
    </div>
  );
}

function MatrixPoint({ cx = 0, cy = 0, payload, expandedCluster, onToggleCluster }: MatrixPointProps) {
  if (!payload) return null;

  const pointColor = getPointColor(payload);
  const isCluster = payload.matrixClusterSize > 1;
  const isExpanded = expandedCluster === payload.matrixClusterKey;

  return (
    <g
      transform={`translate(${payload.matrixOffsetX} ${payload.matrixOffsetY})`}
      className={isCluster ? "cursor-pointer" : undefined}
      role={isCluster ? "button" : undefined}
      aria-label={isCluster ? `${isExpanded ? "Recolher" : "Abrir"} grupo com ${payload.matrixClusterSize} itens` : undefined}
      onClick={(event) => {
        if (!isCluster) return;
        event.stopPropagation();
        onToggleCluster?.(payload.matrixClusterKey);
      }}
    >
      <circle cx={cx} cy={cy} r={15} fill={pointColor} fillOpacity={0.16} />
      {isCluster && !isExpanded ? (
        <circle cx={cx} cy={cy} r={17} fill="none" stroke={pointColor} strokeDasharray="2 3" strokeOpacity={0.7} />
      ) : null}
      <circle cx={cx} cy={cy} r={10} fill={pointColor} stroke="#fafafa" strokeOpacity={0.86} strokeWidth={1.4} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fill="#09090b" fontSize={10} fontWeight={800}>
        {payload.matrixOrdinal}
      </text>
    </g>
  );
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
  matrixOrdinal: number,
): MatrixDatum {
  const capacity = Math.max(product.industria.valor_producao_pia, 1);
  const tradeMagnitude = Math.max(product.comercio.deficit_comercial, 1);

  return {
    ...product,
    matrixCapacityValue: capacity,
    matrixTradeMagnitude: tradeMagnitude,
    matrixSize: Math.max(tradeMagnitude, capacity, 1),
    matrixState: getMatrixState(product, capacidadeThreshold, deficitThreshold),
    matrixOrdinal,
    matrixOffsetX: 0,
    matrixOffsetY: 0,
    matrixClusterKey: "",
    matrixClusterSize: 1,
  };
}

function addCollisionOffsets(data: MatrixDatum[], expandedCluster: string | null) {
  const groups = new Map<string, MatrixDatum[]>();
  data.forEach((item) => {
    // Agrupa também valores próximos que ficam indistinguíveis na escala logarítmica.
    const capacityBand = Math.round(Math.log10(Math.max(item.matrixCapacityValue, 1)) * 4);
    const tradeBand = Math.round(Math.log10(Math.max(item.matrixTradeMagnitude, 1)) * 4);
    const key = item.matrixCapacityValue <= 1
      ? "capacidade-pendente"
      : item.matrixTradeMagnitude <= 1
        ? `sem-deficit:${capacityBand}`
        : `${capacityBand}:${tradeBand}`;
    item.matrixClusterKey = key;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  groups.forEach((items) => {
    if (items.length === 1) return;

    const isExpanded = expandedCluster === items[0].matrixClusterKey;

    items.forEach((item, index) => {
      item.matrixClusterSize = items.length;
      if (!isExpanded) {
        item.matrixOffsetX = 0;
        item.matrixOffsetY = 0;
        return;
      }

      const column = index % 4;
      const row = Math.floor(index / 4);
      const nearLeftEdge = item.matrixCapacityValue <= 1;
      const nearBottomEdge = item.matrixTradeMagnitude <= 1;
      const horizontalDirection = nearLeftEdge ? 1 : (column % 2 === 0 ? -1 : 1);
      const verticalDirection = nearBottomEdge ? -1 : (row % 2 === 0 ? -1 : 1);
      const horizontalStep = nearLeftEdge ? column : Math.ceil((column + 1) / 2);

      // A nuvem cresce para dentro nos limites e alterna os lados no miolo.
      item.matrixOffsetX = horizontalDirection * (8 + horizontalStep * 48);
      item.matrixOffsetY = verticalDirection * (12 + Math.floor(row / 2) * 44);
    });
  });

  return data;
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
  const missingCapacityCount = data.filter(
    (item) => item.industria.valor_producao_pia <= 0,
  ).length;
  if (missingCapacityCount > 0) {
    return `comercial validada; capacidade limitada (${missingCapacityCount}/${data.length} sem PIA)`;
  }

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
  if (getTransitionGuardrail(product)) return "Substituir / Descarbonizar";
  const highCapacity = product.industria.valor_producao_pia >= capacidadeThreshold;
  const highDeficit = product.comercio.deficit_comercial >= deficitThreshold;

  if (highDeficit && highCapacity) return "Modernizar / Expandir";
  if (highDeficit && !highCapacity) return "Atrair Investimento / Planta Nova";
  if (!highDeficit && highCapacity) return "Zona Segura / Competitiva";
  return "Atenção Estratégica";
}

function getPointColor(product: MatrixDatum) {
  if (product.matrixState === "Substituir / Descarbonizar") return "#c084fc";
  if (product.matrixState === "Atrair Investimento / Planta Nova") return "#f87171";
  if (product.matrixState === "Modernizar / Expandir") return "#fbbf24";
  if (product.matrixState === "Zona Segura / Competitiva") return "#34d399";
  return "#38bdf8";
}

function getTransitionGuardrail(product: Pick<ProdutoConceitual, "produto_nome">) {
  const name = product.produto_nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/gas natural/.test(name)) {
    return "Diretriz de transição: substituir gás fóssil por biometano e, nas rotas químicas, hidrogênio renovável e amônia verde.";
  }
  if (/metanol/.test(name)) {
    return "Diretriz de transição: substituir metanol fóssil por bio-metanol (resíduos/biomassa) ou e-metanol (CO₂ capturado + hidrogênio renovável), rotas mapeadas pela IRENA/Methanol Institute (Innovation Outlook: Renewable Methanol, 2021).";
  }
  if (/nafta/.test(name)) {
    return "Diretriz de transição: substituir nafta petroquímica por bionafta/nafta renovável (coproduto do HVO, óleos e gorduras) como matéria-prima de plásticos e químicos de base (IEA, The Future of Petrochemicals, 2018).";
  }
  if (/plastic|resina|polimero|polímero/.test(name)) {
    return "Diretriz de transição: substituir plástico/resina virgem por reciclagem mecânica e química (pirólise/despolimerização) e conteúdo reciclado certificado (IEA, The Future of Petrochemicals, 2018).";
  }
  if (/petrole|petroquim|oleo combustivel/.test(name)) {
    return "Diretriz de transição: priorizar matérias-primas renováveis (bionafta, reciclagem química), circularidade e eletrificação dos processos (IEA, The Future of Petrochemicals, 2018).";
  }
  if (/carvao mineral|coque fossil/.test(name)) {
    return "Diretriz de transição: priorizar eletrificação, hidrogênio renovável e redutores de baixo carbono.";
  }
  return null;
}

function formatTradePosition(product: MatrixDatum) {
  if (product.comercio.deficit_comercial < 0) {
    return `${usdCompact.format(Math.abs(product.comercio.deficit_comercial))} de superávit`;
  }
  return `${usdCompact.format(product.comercio.deficit_comercial)} de déficit`;
}

function formatCapacityPosition(product: MatrixDatum) {
  if (product.industria.valor_producao_pia <= 0) {
    return "produção PIA não publicada";
  }
  return `${brlCompact.format(product.industria.valor_producao_pia)} de produção`;
}

export default NIBMatrixChart;
