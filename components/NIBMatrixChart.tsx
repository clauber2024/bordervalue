"use client";

import type { ReactNode } from "react";
import type { ProdutoConceitual } from "../types/border-value";
import {
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type NIBMatrixChartProps = {
  data?: ProdutoConceitual[];
  capacidadeThreshold?: number;
  deficitThreshold?: number;
  className?: string;
};

type MatrixDatum = ProdutoConceitual & {
  matrixSize: number;
  matrixState: string;
};

type MatrixPointProps = {
  cx?: number;
  cy?: number;
  payload?: MatrixDatum;
};

type NIBTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: MatrixDatum }>;
};

const etanolSafMock: ProdutoConceitual[] = [
  {
    conceptual_product_id: "prod_anidro",
    produto_nome: "Etanol Anidro",
    cadeia_prioritaria: "combustiveis_transicao",
    chain_stage: "produto_final",
    ncm_codigo: "22071010",
    comercio: {
      importacao_valor_fob: 82000000,
      importacao_peso_liquido: 0,
      exportacao_valor_fob: 1317000000,
      exportacao_peso_liquido: 0,
      deficit_comercial: -1235000000,
      principal_pais_origem: "Não aplicável",
      principal_pais_participacao: 0,
      hhi_global: 0,
    },
    industria: {
      cnae_codigo: "1931",
      prodlist_codigo: "1931.2010",
      valor_producao_pia: 34500000000,
      consumo_aparente: 33265000000,
      dependencia_externa_fracao: 0,
      qtde_vinculos_rais: 0,
      massa_salarial_rais: 0,
    },
    auditoria: {
      reference_year: 2026,
      confidence_level: "alta",
      is_ncm_generica: false,
      has_sigilo_pia: false,
      metodologia_versao: "border-value-nib-etanol-saf-neomille-anp-v1",
    },
    fator_proporcionalidade: {
      aplicado: false,
      fator_alpha: 1,
      fonte_proxy: "ANP / Neomille / PIA-Produto",
    },
  },
  {
    conceptual_product_id: "prod_saf",
    produto_nome: "Bioquerosene de Aviação (SAF)",
    cadeia_prioritaria: "combustiveis_transicao",
    chain_stage: "produto_final",
    ncm_codigo: "38260000",
    comercio: {
      importacao_valor_fob: 195000000,
      importacao_peso_liquido: 0,
      exportacao_valor_fob: 0,
      exportacao_peso_liquido: 0,
      deficit_comercial: 195000000,
      principal_pais_origem: "Não consolidado",
      principal_pais_participacao: 0,
      hhi_global: 0,
    },
    industria: {
      cnae_codigo: "1932",
      prodlist_codigo: "sigilo/planta-nova",
      valor_producao_pia: 0,
      consumo_aparente: 195000000,
      dependencia_externa_fracao: 1,
      qtde_vinculos_rais: 0,
      massa_salarial_rais: 0,
    },
    auditoria: {
      reference_year: 2026,
      confidence_level: "media",
      is_ncm_generica: true,
      has_sigilo_pia: true,
      metodologia_versao: "border-value-nib-etanol-saf-neomille-anp-v1",
    },
    fator_proporcionalidade: {
      aplicado: false,
      fator_alpha: 1,
      fonte_proxy: "ANP / Neomille / leitura de planta nova",
    },
  },
  {
    conceptual_product_id: "prod_amilase",
    produto_nome: "Enzimas Alfa-Amilase (1GM)",
    cadeia_prioritaria: "combustiveis_transicao",
    chain_stage: "insumo",
    ncm_codigo: "35079011",
    comercio: {
      importacao_valor_fob: 282500000,
      importacao_peso_liquido: 0,
      exportacao_valor_fob: 6700000,
      exportacao_peso_liquido: 0,
      deficit_comercial: 275800000,
      principal_pais_origem: "Não consolidado",
      principal_pais_participacao: 0,
      hhi_global: 0,
    },
    industria: {
      cnae_codigo: "2123",
      prodlist_codigo: "2123.2040",
      valor_producao_pia: 31000000,
      consumo_aparente: 306800000,
      dependencia_externa_fracao: 0.9,
      qtde_vinculos_rais: 0,
      massa_salarial_rais: 0,
    },
    auditoria: {
      reference_year: 2026,
      confidence_level: "media",
      is_ncm_generica: false,
      has_sigilo_pia: false,
      metodologia_versao: "border-value-nib-etanol-saf-neomille-anp-v1",
    },
    fator_proporcionalidade: {
      aplicado: true,
      fator_alpha: 1,
      fonte_proxy: "PIA-Produto / PRODLIST enzimas industriais",
    },
  },
];

const glass =
  "border border-white/[0.08] bg-slate-950/90 shadow-2xl shadow-slate-950/60 backdrop-blur-xl";

const axisTick = {
  fill: "#cbd5e1",
  fontSize: 12,
};

const quadrantLabel = {
  fill: "#e2e8f0",
  fontSize: 11,
  fontWeight: 700,
};

export function NIBMatrixChart({
  data = etanolSafMock,
  capacidadeThreshold = 30000000,
  deficitThreshold = 100000000,
  className = "",
}: NIBMatrixChartProps) {
  const matrixData = data.map((item) => toMatrixDatum(item, capacidadeThreshold, deficitThreshold));
  const xMax = paddedMax(
    Math.max(...matrixData.map((item) => item.industria.valor_producao_pia), capacidadeThreshold * 2),
  );
  const yMin = paddedMin(
    Math.min(...matrixData.map((item) => item.comercio.deficit_comercial), -deficitThreshold),
  );
  const yMax = paddedMax(
    Math.max(...matrixData.map((item) => item.comercio.deficit_comercial), deficitThreshold * 2),
  );

  return (
    <section className={`${glass} overflow-hidden rounded-lg text-slate-100 ${className}`}>
      <header className="border-b border-white/[0.08] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Nova Indústria Brasil
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
              Matriz NIB: capacidade doméstica x saldo comercial
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-[22rem]">
            <MetricPill label="Corte capacidade" value={formatMoney(capacidadeThreshold)} />
            <MetricPill label="Corte déficit" value={formatMoney(deficitThreshold)} />
          </div>
        </div>
      </header>

      <div className="h-[460px] min-h-[340px] w-full px-2 py-5 sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 24, right: 36, bottom: 38, left: 12 }}>
            <CartesianGrid stroke="rgba(226,232,240,0.08)" strokeDasharray="3 3" />

            <ReferenceArea
              x1={0}
              x2={capacidadeThreshold}
              y1={deficitThreshold}
              y2={yMax}
              fill="#f59e0b"
              fillOpacity={0.02}
              stroke="rgba(245,158,11,0.24)"
              strokeDasharray="4 4"
              label={{ value: "Atrair Investimento / Planta Nova", position: "insideTopLeft", ...quadrantLabel }}
            />
            <ReferenceArea
              x1={capacidadeThreshold}
              x2={xMax}
              y1={deficitThreshold}
              y2={yMax}
              fill="#38bdf8"
              fillOpacity={0.02}
              stroke="rgba(56,189,248,0.22)"
              strokeDasharray="4 4"
              label={{ value: "Modernizar / Expandir", position: "insideTopRight", ...quadrantLabel }}
            />
            <ReferenceArea
              x1={0}
              x2={capacidadeThreshold}
              y1={yMin}
              y2={deficitThreshold}
              fill="#a78bfa"
              fillOpacity={0.02}
              stroke="rgba(167,139,250,0.2)"
              strokeDasharray="4 4"
              label={{ value: "Atenção Estratégica", position: "insideBottomLeft", ...quadrantLabel }}
            />
            <ReferenceArea
              x1={capacidadeThreshold}
              x2={xMax}
              y1={yMin}
              y2={deficitThreshold}
              fill="#22c55e"
              fillOpacity={0.02}
              stroke="rgba(34,197,94,0.22)"
              strokeDasharray="4 4"
              label={{ value: "Zona Segura / Competitiva", position: "insideBottomRight", ...quadrantLabel }}
            />

            <XAxis
              type="number"
              dataKey="industria.valor_producao_pia"
              name="Capacidade Doméstica"
              domain={[0, xMax]}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "rgba(203,213,225,0.28)" }}
              tickFormatter={formatMoneyCompact}
              label={{
                value: "Capacidade Doméstica (valor de produção PIA)",
                position: "insideBottom",
                offset: -24,
                fill: "#e2e8f0",
                fontSize: 12,
              }}
            />
            <YAxis
              type="number"
              dataKey="comercio.deficit_comercial"
              name="Saldo Comercial"
              domain={[yMin, yMax]}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "rgba(203,213,225,0.28)" }}
              tickFormatter={formatMoneyCompact}
              label={{
                value: "Saldo Comercial: déficit (+) / superávit (-)",
                angle: -90,
                position: "insideLeft",
                fill: "#e2e8f0",
                fontSize: 12,
              }}
            />
            <ZAxis type="number" dataKey="matrixSize" range={[90, 320]} name="Magnitude estratégica" />
            <Tooltip cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} content={<NIBTooltip />} />
            <Scatter data={matrixData} name="Produtos Etanol/SAF" fill="#22d3ee" shape={<MatrixPoint />} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <strong className="mt-1 block truncate text-sm font-semibold text-slate-100">{value}</strong>
    </div>
  );
}

function MatrixPoint({ cx = 0, cy = 0, payload }: MatrixPointProps) {
  if (!payload) return null;

  const isExporter = payload.comercio.deficit_comercial < 0;
  const pointColor = isExporter ? "#34d399" : payload.industria.valor_producao_pia === 0 ? "#fbbf24" : "#38bdf8";

  return (
    <g>
      <circle cx={cx} cy={cy} r={13} fill={pointColor} fillOpacity={0.13} />
      <circle cx={cx} cy={cy} r={7} fill={pointColor} stroke="#f8fafc" strokeOpacity={0.84} strokeWidth={1.4} />
      <text x={cx + 13} y={cy - 10} fill="#f8fafc" fontSize={11} fontWeight={700}>
        {payload.produto_nome}
      </text>
      <text x={cx + 13} y={cy + 6} fill="#94a3b8" fontSize={10}>
        {payload.matrixState}
      </text>
    </g>
  );
}

function NIBTooltip({ active, payload }: NIBTooltipProps) {
  if (!active || !payload?.length) return null;

  const product = payload[0].payload;
  const saldoLabel = product.comercio.deficit_comercial < 0 ? "Superávit comercial" : "Déficit comercial";

  return (
    <div className="min-w-72 rounded-lg border border-white/[0.1] bg-slate-950/95 p-4 text-xs text-slate-100 shadow-2xl backdrop-blur-xl">
      <p className="text-sm font-bold tracking-tight text-white">{product.produto_nome}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-300">
        {product.matrixState}
      </p>

      <div className="mt-3 space-y-2.5">
        <TooltipRow label="Capacidade doméstica" value={formatMoney(product.industria.valor_producao_pia)} tone="cyan" />
        <TooltipRow label={saldoLabel} value={formatMoney(product.comercio.deficit_comercial)} tone={product.comercio.deficit_comercial < 0 ? "emerald" : "amber"} />
        <TooltipRow label="Importacoes FOB" value={formatMoney(product.comercio.importacao_valor_fob)} tone="slate" />
        <TooltipRow label="Exportacoes FOB" value={formatMoney(product.comercio.exportacao_valor_fob)} tone="slate" />
      </div>

      <div className="mt-3 border-t border-white/[0.08] pt-3">
        <TechnicalCode>NCM {product.ncm_codigo}</TechnicalCode>
        {product.auditoria.has_sigilo_pia ? <TechnicalCode>PIA com sigilo</TechnicalCode> : null}
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
  tone: "cyan" | "emerald" | "amber" | "slate";
}) {
  const tones = {
    cyan: "text-cyan-200",
    emerald: "text-emerald-200",
    amber: "text-amber-200",
    slate: "text-slate-100",
  };

  return (
    <div className="flex items-center justify-between gap-5">
      <span className="text-slate-500">{label}</span>
      <strong className={`text-right font-semibold ${tones[tone]}`}>{value}</strong>
    </div>
  );
}

function TechnicalCode({ children }: { children: ReactNode }) {
  return (
    <span className="mr-1.5 inline-flex rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-slate-600">
      {children}
    </span>
  );
}

function toMatrixDatum(
  product: ProdutoConceitual,
  capacidadeThreshold: number,
  deficitThreshold: number,
): MatrixDatum {
  return {
    ...product,
    matrixSize: Math.max(
      Math.abs(product.comercio.deficit_comercial),
      product.industria.valor_producao_pia,
      1,
    ),
    matrixState: getMatrixState(product, capacidadeThreshold, deficitThreshold),
  };
}

function getMatrixState(
  product: ProdutoConceitual,
  capacidadeThreshold: number,
  deficitThreshold: number,
) {
  const highCapacity = product.industria.valor_producao_pia >= capacidadeThreshold;
  const highDeficit = product.comercio.deficit_comercial >= deficitThreshold;

  if (highDeficit && highCapacity) return "Modernizar / Expandir";
  if (highDeficit && !highCapacity) return "Atrair Investimento / Planta Nova";
  if (!highDeficit && highCapacity) return "Zona Segura / Competitiva";
  return "Atenção Estratégica";
}

function paddedMax(value: number) {
  const padded = value * 1.18;
  const step = scaleStep(padded);
  return Math.ceil(padded / step) * step;
}

function paddedMin(value: number) {
  const padded = value * 1.18;
  const step = scaleStep(Math.abs(padded));
  return Math.floor(padded / step) * step;
}

function scaleStep(value: number) {
  if (value >= 10000000000) return 5000000000;
  if (value >= 1000000000) return 500000000;
  if (value >= 100000000) return 50000000;
  return 10000000;
}

function formatMoney(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1000000000) return `${sign}R$ ${formatDecimal(abs / 1000000000)} Bilhões`;
  if (abs >= 1000000) return `${sign}R$ ${formatDecimal(abs / 1000000)} Milhões`;
  if (abs >= 1000) return `${sign}R$ ${formatDecimal(abs / 1000)} Mil`;
  return `${sign}R$ ${formatDecimal(abs)}`;
}

function formatMoneyCompact(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1000000000) return `${sign}R$ ${formatDecimal(abs / 1000000000)} bi`;
  if (abs >= 1000000) return `${sign}R$ ${formatDecimal(abs / 1000000)} mi`;
  return `${sign}R$ ${formatDecimal(abs)}`;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Math.abs(value) >= 10 ? 0 : 1,
  }).format(value);
}
