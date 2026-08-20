'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Database,
  Flag,
  Layers3,
  Info,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { countryToIso2, isoToFlagEmoji } from '../lib/countryFlags';

export type ExecutiveTopAlert = {
  productName: string;
  conceptualCategory: string;
  traceabilityLabel?: string;
  chain: string;
  dependencyRate: number;
  hhi: number;
  hhiLabel: string;
  topSupplier: string;
  supplierShare: number;
  fobValue: string;
  whyThisIsHere?: string;
  impactSummary: string;
  recommendedPolicy: string;
};

export type GaugeBand = { upTo: number; color: string };

export type ExecutiveMainKpi = {
  label: string;
  value: string;
  note: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
  /** Optional radial gauge (manômetro) for KPIs on a fixed, bounded scale
   * (e.g. HHI 0-10.000) -- bands must be sorted ascending by `upTo`, and the
   * last band's `upTo` should equal `max`. Purely additive: KPIs without a
   * `gauge` keep rendering as a plain number, same as before. */
  gauge?: { value: number; max: number; bands: GaugeBand[] };
};

type ExecutiveMainHeroProps = {
  alert?: ExecutiveTopAlert;
  kpis?: ExecutiveMainKpi[];
  strategicQuestion?: string;
};

const defaultAlert: ExecutiveTopAlert = {
  productName: 'Intermediários Químicos para Bioprocessos',
  conceptualCategory: 'Base química estratégica',
  traceabilityLabel: 'NCM 2933.99.99',
  chain: 'Transição Energética e Bioprocessos',
  dependencyRate: 98.0,
  hhi: 9286,
  hhiLabel: 'Monopólio Quase Absoluto',
  topSupplier: 'China',
  supplierShare: 96.3,
  fobValue: 'US$ 847 mi',
  whyThisIsHere:
    'Triagem Automática de Emergência: item isolado pelo sistema por apresentar o maior risco combinado de dependência e monopólio geopolítico no recorte atual.',
  impactSummary:
    'Insumo biocatalisador sem substituto nacional direto. Risco de paralisação nas cadeias de bioetanol de 2ª geração e defensivos sustentáveis.',
  recommendedPolicy:
    'Missão 1 NIB: chamada pública BNDES/FINEP para atração de IED e planta química fina nacional',
};

const defaultKpis: ExecutiveMainKpi[] = [
  {
    label: 'Importações Totais',
    value: 'US$ 142,4 bi',
    note: 'Insumos e bens de capital da pauta',
    icon: <ArrowDownLeft className="h-4 w-4 text-emerald-400" />,
  },
  {
    label: 'Exportações Totais',
    value: 'US$ 184,8 bi',
    note: 'Superávit ativo nos agregados',
    tone: 'success',
    icon: <ArrowUpRight className="h-4 w-4 text-sky-400" />,
  },
  {
    label: 'Dependência Média',
    value: '25,0%',
    note: 'Razão Importação / Consumo Aparente',
    tone: 'warning',
    icon: <Activity className="h-4 w-4 text-amber-400" />,
  },
  {
    label: 'Concentração Máxima',
    value: '9.964',
    note: 'Risco: Monopólio de Origem',
    tone: 'danger',
    icon: <AlertOctagon className="h-4 w-4 text-red-400" />,
  },
];

const toneClasses = {
  neutral: {
    value: 'text-zinc-100',
    note: 'text-zinc-400',
    badge: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-300',
  },
  success: {
    value: 'text-zinc-100',
    note: 'text-emerald-400',
    badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  },
  warning: {
    value: 'text-zinc-100',
    note: 'text-amber-300',
    badge: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  },
  danger: {
    value: 'text-red-400',
    note: 'text-red-300/90',
    badge: 'border-red-500/20 bg-red-500/10 text-red-300',
  },
};

const formatPercentage = (value: number) =>
  value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

const formatHhi = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

const colorForGaugeValue = (value: number, bands: GaugeBand[]) =>
  (bands.find((band) => value <= band.upTo) ?? bands[bands.length - 1]).color;

// Semi-circle gauge geometry: angle 180deg = left (min) sweeping clockwise
// over the top to angle 0deg = right (max), needle pivot at bottom-center.
// Standard math convention (0deg = right, 90deg = up) with the y-flip SVG
// needs, so this traces left -> top -> right as the value climbs.
const polarPoint = (cx: number, cy: number, r: number, angleDeg: number) => {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy - r * Math.sin(angleRad) };
};

const valueToAngle = (value: number, max: number) => 180 - (Math.min(Math.max(value, 0), max) / max) * 180;

function RadialGauge({ value, max, bands, size = 104 }: { value: number; max: number; bands: GaugeBand[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2 + 4;
  const r = size / 2 - 12;
  const strokeWidth = 9;

  const segments = bands.map((band, index) => {
    const prevUpTo = index === 0 ? 0 : bands[index - 1].upTo;
    const startAngle = valueToAngle(prevUpTo, max);
    const endAngle = valueToAngle(band.upTo, max);
    const start = polarPoint(cx, cy, r, startAngle);
    const end = polarPoint(cx, cy, r, endAngle);
    return { key: band.upTo, color: band.color, d: `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}` };
  });

  // Tapered needle (triangle from a narrow base at the pivot to a point at
  // the tip) instead of a plain line, closer to a real speedometer pointer.
  const needleAngle = valueToAngle(value, max);
  const needleLength = r - strokeWidth / 2 - 2;
  const needleTip = polarPoint(cx, cy, needleLength, needleAngle);
  const needleBaseHalfWidth = 3.2;
  const needleBase1 = polarPoint(cx, cy, needleBaseHalfWidth, needleAngle + 90);
  const needleBase2 = polarPoint(cx, cy, needleBaseHalfWidth, needleAngle - 90);

  return (
    <svg viewBox={`0 0 ${size} ${size / 2 + 16}`} width={size} height={size / 2 + 16} aria-hidden="true">
      {segments.map((segment) => (
        <path
          key={segment.key}
          d={segment.d}
          fill="none"
          stroke={segment.color}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          opacity={0.85}
        />
      ))}
      <polygon
        points={`${needleBase1.x},${needleBase1.y} ${needleTip.x},${needleTip.y} ${needleBase2.x},${needleBase2.y}`}
        fill="#e4e4e7"
      />
      <circle cx={cx} cy={cy} r={4.5} fill="#e4e4e7" />
    </svg>
  );
}

// Mirrors the HHI severity bands in buildExecutiveHeroKpis
// (components/MainAnalyticalDashboard.tsx) -- keep both in sync so the same
// HHI value never renders a different color zone in the two places it's
// gauged.
const HHI_GAUGE_BANDS: GaugeBand[] = [
  { upTo: 1800, color: '#34d399' },
  { upTo: 2500, color: '#a3e635' },
  { upTo: 9000, color: '#fb923c' },
  { upTo: 10000, color: '#f87171' },
];

// Balance beam that physically tips toward whichever side is heavier --
// domestic production (left, emerald) vs. imports (right, red) -- instead of
// a static scale icon that says nothing about the actual dependency number.
// 50% dependency = level beam; the tilt (and which pan visually outweighs
// the other) scales linearly from there toward either extreme.
function DependencyScale({ percentage, size = 40 }: { percentage: number; size?: number }) {
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const tilt = ((clamped - 50) / 50) * 20;
  const height = Math.round(size * 0.62);
  const cx = size / 2;
  const cy = height * 0.32;
  const armX = size * 0.13;
  const panR = size * 0.09;

  return (
    <svg viewBox={`0 0 ${size} ${height}`} width={size} height={height} aria-hidden="true">
      <polygon
        points={`${cx},${cy - 1} ${cx - size * 0.08},${cy + size * 0.14} ${cx + size * 0.08},${cy + size * 0.14}`}
        fill="#52525b"
      />
      <g transform={`rotate(${tilt} ${cx} ${cy})`}>
        <line x1={armX} y1={cy} x2={size - armX} y2={cy} stroke="#a1a1aa" strokeWidth={1.4} />
        <line x1={armX} y1={cy} x2={armX} y2={cy + size * 0.22} stroke="#71717a" strokeWidth={1} />
        <circle cx={armX} cy={cy + size * 0.22 + panR * 0.4} r={panR} fill="#34d399" fillOpacity={0.9} />
        <line x1={size - armX} y1={cy} x2={size - armX} y2={cy + size * 0.22} stroke="#71717a" strokeWidth={1} />
        <circle cx={size - armX} cy={cy + size * 0.22 + panR * 0.4} r={panR} fill="#f87171" fillOpacity={0.9} />
      </g>
    </svg>
  );
}

export const ExecutiveMainHero = ({
  alert = defaultAlert,
  kpis = defaultKpis,
  strategicQuestion = 'Onde o Brasil lidera e onde estão os principais estrangulamentos tecnológicos desta cadeia?',
}: ExecutiveMainHeroProps) => {
  const hasAuditedSupplier =
    alert.topSupplier !== 'Em auditoria' && alert.supplierShare > 0;
  const supplierIso2 = hasAuditedSupplier ? countryToIso2(alert.topSupplier) : null;
  const supplierTitle = hasAuditedSupplier ? alert.topSupplier : 'Em homologação';
  const supplierSubtitle = hasAuditedSupplier
    ? `${formatPercentage(alert.supplierShare)}% do total`
    : 'Validação Comex Stat';
  const whyThisIsHere =
    alert.whyThisIsHere ??
    'Triagem Automática de Emergência: item priorizado pela combinação mais crítica de dependência externa e concentração de origem.';

  return (
    <section className="w-full space-y-6">
      <div className="flex flex-col gap-4">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/15 bg-zinc-900/55 p-6 shadow-2xl backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                <Sparkles className="h-3 w-3" />
                Plataforma Analítica de Estado
              </span>
              <span className="rounded border border-white/5 bg-zinc-950/40 px-2 py-0.5 font-mono text-xs text-zinc-400">
                Border Value v1.0.0-rc.1
              </span>
            </div>

            <h1 className="max-w-4xl text-3xl font-extrabold leading-tight tracking-normal text-zinc-100 lg:text-4xl">
              Soberania Produtiva e Exposição Comercial da Transição Verde
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Diagnóstico estratégico de vulnerabilidade de suprimento,
              dependência externa e concentração geopolítica de insumos críticos
              para orientar a política industrial brasileira.
            </p>

            <div className="mt-5 flex max-w-4xl items-start gap-3 rounded-xl border border-emerald-300/15 bg-zinc-950/50 px-4 py-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <p className="text-sm font-semibold leading-6 text-zinc-200">
                <span className="text-zinc-400">Pergunta de Estado:</span>{' '}
                {strategicQuestion}
              </p>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-zinc-950/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <Database className="h-3.5 w-3.5" />
                Cobertura
              </div>
              <p className="font-mono text-lg font-extrabold text-zinc-100">
                2.902
              </p>
              <p className="text-[11px] text-zinc-400">registros filtrados</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-zinc-950/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                <Layers3 className="h-3.5 w-3.5" />
                Recorte
              </div>
              <p className="font-mono text-lg font-extrabold text-zinc-100">
                Jan-Jun 2026
              </p>
              <p className="text-[11px] text-zinc-400">comércio exterior</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-zinc-950/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Bases
              </div>
              <p className="font-mono text-lg font-extrabold text-zinc-100">
                3
              </p>
              <p className="text-[11px] text-zinc-400">Comex, PIA e RAIS</p>
            </div>
          </div>

        </div>

        <motion.aside
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-950/30 via-zinc-900/70 to-zinc-950/90 p-5 shadow-2xl shadow-red-950/25 backdrop-blur-xl md:p-6"
        >
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-500/20 blur-3xl transition-colors group-hover:bg-red-500/30" />

          <div className="relative">
            <div className="mb-4 flex flex-col justify-between gap-3 border-b border-red-500/20 pb-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-red-300">
                  <ShieldAlert className="h-3.5 w-3.5 animate-pulse" />
                  Alerta Máximo de Soberania
                </span>
                <span className="hidden text-[11px] font-medium text-zinc-400 md:inline">
                  Prioridade de Ação Nacional: Substituição de Importações e Fortalecimento de Etapas Críticas
                </span>
              </div>
              <div className="w-fit rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-1 text-xs font-semibold text-zinc-400">
                Fatura Anual de Importação:{' '}
                <strong className="font-mono text-amber-400">{alert.fobValue}</strong>
                <span className="text-zinc-400"> (Exposição Comercial)</span>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-300/90">
                Cadeia: {alert.chain}
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                Produto conceitual
              </p>
              <h2 className="mt-1 text-xl font-bold leading-snug text-zinc-100">
                {alert.productName}
              </h2>
              <p className="font-mono text-xs font-medium text-zinc-400">
                Rastreabilidade: {alert.traceabilityLabel ?? alert.conceptualCategory}
              </p>
            </div>

            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-white/5 bg-zinc-950/60 p-3 text-xs text-zinc-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p className="leading-relaxed">
                <strong className="text-emerald-400">
                  Critério de Priorização Institucional:
                </strong>{' '}
                {whyThisIsHere}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-red-500/20 bg-zinc-950/70 p-3 text-center">
              <div>
                <span className="block text-[10px] font-semibold uppercase text-zinc-400">
                  Dependência externa
                </span>
                <div className="mt-1 flex items-center justify-center">
                  <DependencyScale percentage={alert.dependencyRate} />
                </div>
                <span className="block font-mono text-base font-extrabold text-red-400">
                  {formatPercentage(alert.dependencyRate)}%
                </span>
                <span className="block text-[9px] text-red-300/80">
                  Produção local residual
                </span>
              </div>
              <div className="border-x border-white/10 px-1">
                <span className="block text-[10px] font-semibold uppercase text-zinc-400">
                  Índice HHI
                </span>
                <div className="mt-1 flex items-center justify-center">
                  <RadialGauge value={alert.hhi} max={10000} bands={HHI_GAUGE_BANDS} size={56} />
                </div>
                <span className="block font-mono text-base font-extrabold text-red-400">
                  {formatHhi(alert.hhi)}
                </span>
                <span className="block truncate text-[9px] text-red-300/80">
                  {alert.hhiLabel}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase text-zinc-400">
                  Principal País Origem
                </span>
                <div className="mt-1.5 flex items-center justify-center">
                  {hasAuditedSupplier && supplierIso2 ? (
                    <span className="text-2xl leading-none" role="img" aria-label={`Bandeira: ${alert.topSupplier}`}>
                      {isoToFlagEmoji(supplierIso2)}
                    </span>
                  ) : (
                    <Flag className="h-4 w-4 text-zinc-500" strokeWidth={1.8} />
                  )}
                </div>
                <span className="mt-1 block truncate text-xs font-bold text-amber-200">
                  {supplierTitle}
                </span>
                <span className="mt-0.5 block text-[9px] font-semibold text-zinc-300">
                  {supplierSubtitle}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-white/5 bg-zinc-900/40 p-3 text-xs leading-relaxed text-zinc-300">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-300">
                <AlertTriangle className="h-3 w-3 text-red-400" />
                Impacto de Vulnerabilidade Comercial
              </span>
              {alert.impactSummary}
            </div>
          </div>

          <div className="relative mt-4 border-t border-red-500/20 pt-3">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Direcionamento de Política Pública (NIB)
            </span>
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs font-semibold text-zinc-100">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span className="leading-snug">{alert.recommendedPolicy}</span>
            </div>
          </div>
        </motion.aside>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-6">
        {kpis.map((kpi) => {
          const tone = kpi.tone ?? 'neutral';

          return (
            <article
              key={kpi.label}
              className="relative overflow-hidden rounded-2xl border border-white/15 bg-zinc-900/55 p-5 shadow-xl backdrop-blur-xl xl:p-6"
            >
              <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <span>{kpi.label}</span>
                {kpi.icon ?? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
              </div>
              {kpi.gauge ? (
                <div className="mt-1 flex flex-col items-center">
                  <RadialGauge value={kpi.gauge.value} max={kpi.gauge.max} bands={kpi.gauge.bands} />
                  <div
                    className="mt-1 font-mono text-xl font-extrabold"
                    style={{ color: colorForGaugeValue(kpi.gauge.value, kpi.gauge.bands) }}
                  >
                    {kpi.value}
                  </div>
                </div>
              ) : (
                <div
                  className={`mt-2 font-mono text-2xl font-extrabold xl:text-3xl ${toneClasses[tone].value}`}
                >
                  {kpi.value}
                </div>
              )}
              <span
                className={`mt-1 block text-[11px] font-medium ${kpi.gauge ? "text-center" : ""} ${kpi.gauge ? "" : toneClasses[tone].note}`}
                style={kpi.gauge ? { color: colorForGaugeValue(kpi.gauge.value, kpi.gauge.bands) } : undefined}
              >
                {kpi.note}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
};
