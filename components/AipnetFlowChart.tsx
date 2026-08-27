'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Cpu,
  Factory,
  Globe2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

type FlowOrigin = {
  supplier?: string | null;
  share: number;
  valueFob: number;
  detail?: string;
};

type FlowDestination = {
  sector: string;
  share: number;
  valueFob: number;
  mission: string;
};

type FlowRiskLevel = 'Crítico' | 'Moderado' | 'Baixo';

export type AipnetFlow = {
  origins: FlowOrigin[];
  destinations?: FlowDestination[];
  product: string;
  concept: string;
  technicalDescription?: string;
  destination: string;
  destinationLabel?: string;
  totalValueFob: number;
  riskLevel: FlowRiskLevel;
  riskSummary: string;
  concentrationNote?: string;
};

const defaultTotal = 3313951312;

const defaultFlow: AipnetFlow = {
  origins: [
    { supplier: 'Taiwan (TSMC)', share: 54, valueFob: defaultTotal * 0.54 },
    { supplier: 'China Popular', share: 28.5, valueFob: defaultTotal * 0.285 },
    { supplier: 'Estados Unidos', share: 12, valueFob: defaultTotal * 0.12 },
    { supplier: 'Outras Origens', share: 5.5, valueFob: defaultTotal * 0.055 },
  ],
  destinations: [
    {
      sector: 'Inversores Solares & Energia Limpa',
      share: 38,
      valueFob: defaultTotal * 0.38,
      mission: 'Missão 5: Bioeconomia & Transição',
    },
    {
      sector: 'Automação & Eletroeletrônica',
      share: 34,
      valueFob: defaultTotal * 0.34,
      mission: 'Missão 4: Transformação Digital',
    },
    {
      sector: 'Sistemas Automotivos & Mobilidade',
      share: 28,
      valueFob: defaultTotal * 0.28,
      mission: 'Missão 3: Mobilidade Sustentável',
    },
  ],
  product: 'Semicondutores e Wafers de Processamento',
  concept: 'Eletrônicos & Hardware de Transição',
  technicalDescription:
    'Circuitos integrados eletrônicos, processadores e chipsets',
  destination:
    'Missão 4 NIB: Edital FINEP/BNDES de subvenção para fortalecimento de Design Houses e Packaging nacional.',
  destinationLabel: 'Montagem, Design Houses e Packaging',
  totalValueFob: defaultTotal,
  riskLevel: 'Crítico',
  riskSummary: 'Alta concentração externa em componentes sem substituto imediato.',
  concentrationNote: '82,5% concentrado na Ásia',
};

const riskClasses: Record<FlowRiskLevel, string> = {
  Crítico: 'border-red-500/25 bg-red-500/10 text-red-300',
  Moderado: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  Baixo: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
};

const originGradients = [
  'from-blue-500 to-teal-400',
  'from-amber-500 to-yellow-400',
  'from-indigo-500 to-blue-400',
  'from-zinc-600 to-zinc-500',
];

const originStrokeColors = ['#3b82f6', '#f59e0b', '#6366f1', '#71717a'];
const destinationStrokeColors = ['#10b981', '#06b6d4', '#f59e0b'];

const destinationGradients = [
  'from-emerald-500 to-teal-300',
  'from-cyan-500 to-emerald-300',
  'from-amber-500 to-emerald-300',
];

const formatCurrency = (value: number) => {
  if (value >= 1e9) {
    return `US$ ${(value / 1e9).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} bi`;
  }

  return `US$ ${(value / 1e6).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} mi`;
};

const formatExactCurrency = (value: number) =>
  `US$ ${value.toLocaleString('pt-BR', {
    maximumFractionDigits: 0,
  })}`;

const cleanSupplier = (supplier?: string | null) =>
  supplier &&
  !supplier.toLowerCase().includes('json') &&
  !supplier.toLowerCase().includes('auditoria') &&
  !supplier.toLowerCase().includes('homologa')
    ? supplier
    : 'Outras Origens';

type AipnetFlowChartProps = {
  flow?: AipnetFlow;
};

export const AipnetFlowChart = ({
  flow = defaultFlow,
}: AipnetFlowChartProps) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const origins = [...(flow.origins.length ? flow.origins : defaultFlow.origins)].sort(
    (a, b) => b.share - a.share,
  );
  const destinations =
    flow.destinations && flow.destinations.length
      ? flow.destinations
      : defaultFlow.destinations ?? [];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-6 text-zinc-100 shadow-2xl backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
      <div className="absolute -right-20 -top-24 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              <Sparkles className="h-3 w-3" />
              Diagrama de Fluxo da Espinha Dorsal (Sankey de Estado)
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${riskClasses[flow.riskLevel]}`}
            >
              <ShieldAlert className="h-3 w-3" />
              Risco {flow.riskLevel}
            </span>
          </div>
          <h3 className="max-w-4xl text-xl font-extrabold leading-tight tracking-normal text-white">
            Rede de Suprimento: Origens Globais vs. Absorção na Indústria Nacional
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">
            A espessura das barras representa o volume financeiro FOB que trafega na cadeia.
          </p>
        </div>

        <div
          className="shrink-0 rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-2.5 text-right shadow-inner"
          title={`Valor FOB exato: ${formatExactCurrency(flow.totalValueFob)}`}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Fatura Importada Total
          </span>
          <span className="block font-mono text-xl font-extrabold text-zinc-100">
            {formatCurrency(flow.totalValueFob)}
          </span>
          <span className="block text-[9px] text-zinc-500">
            (Exposição Comercial / Jan-Jun 2026)
          </span>
        </div>
      </div>

      <div className="relative grid grid-cols-1 items-center gap-4 overflow-hidden rounded-xl border border-white/5 bg-zinc-950/70 p-6 lg:grid-cols-12">
        <SankeyCurveLayer
          origins={origins}
          destinations={destinations}
          activeOrigin={hoveredNode}
        />

        <div className="relative z-10 space-y-3 lg:col-span-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <Globe2 className="h-4 w-4 text-blue-400" />
              Origem Internacional (Share)
            </span>
            <span className="font-mono text-[10px] text-zinc-500">Comex Stat</span>
          </div>

          {origins.map((origin, index) => {
            const supplier = cleanSupplier(origin.supplier);
            const gradient = originGradients[index % originGradients.length];

            return (
              <motion.div
                key={`${supplier}-${index}`}
                onHoverStart={() => setHoveredNode(supplier)}
                onHoverEnd={() => setHoveredNode(null)}
                animate={{
                  scale: hoveredNode === supplier ? 1.02 : 1,
                  borderColor:
                    hoveredNode === supplier
                      ? 'rgba(255,255,255,0.32)'
                      : 'rgba(255,255,255,0.08)',
                }}
                className="relative cursor-pointer overflow-hidden rounded-xl border bg-zinc-900/60 p-3 transition-colors hover:bg-zinc-800/80"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-bold text-zinc-100">
                    {supplier}
                  </span>
                  <span
                    className="shrink-0 font-mono text-xs font-bold text-emerald-400"
                    title={`Valor FOB exato: ${formatExactCurrency(origin.valueFob)}`}
                  >
                    {formatCurrency(origin.valueFob)}
                  </span>
                </div>
                {origin.detail ? (
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                    {origin.detail}
                  </p>
                ) : null}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(origin.share, 4)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                  />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[9px] text-zinc-400">
                  <span>Participação no suprimento</span>
                  <span>{origin.share.toFixed(1)}%</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center px-2 py-4 lg:col-span-4 lg:py-0">
          <FlowPulse className="mb-3 lg:hidden" />

          <div className="relative w-full rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 p-5 text-center shadow-2xl">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-zinc-950 shadow-lg">
              Nó Central de Vulnerabilidade
            </div>
            <Cpu className="mx-auto mb-2 mt-1 h-7 w-7 text-emerald-400" />
            <h4 className="text-base font-extrabold leading-snug tracking-normal text-white">
              {flow.product}
            </h4>
            <span className="mt-1 block font-mono text-[10px] text-zinc-400">
              {flow.technicalDescription ?? flow.concept}
            </span>
            <div className="my-3 rounded-xl border border-white/5 bg-zinc-950/80 px-3 py-2 font-mono">
              <span className="block text-[10px] uppercase text-zinc-500">
                Fluxo Consolidado
              </span>
              <span className="text-base font-extrabold text-amber-400">
                {formatCurrency(flow.totalValueFob)} FOB
              </span>
            </div>
            <span className="block rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-medium text-red-300">
              Gargalo: {flow.concentrationNote ?? flow.riskSummary}
            </span>
          </div>

          <FlowPulse className="mt-3 lg:hidden" />
        </div>

        <div className="relative z-10 space-y-3 lg:col-span-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <Factory className="h-4 w-4 text-emerald-400" />
              Absorção Industrial no Brasil
            </span>
            <span className="font-mono text-[10px] text-zinc-500">Mapeamento NIB</span>
          </div>

          {destinations.map((destination, index) => {
            const gradient = destinationGradients[index % destinationGradients.length];

            return (
              <div
                key={`${destination.sector}-${index}`}
                className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 backdrop-blur-md transition-colors hover:border-emerald-500/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-bold leading-snug text-zinc-100">
                      {destination.sector}
                    </h5>
                    <span className="mt-0.5 block text-[9px] font-semibold text-amber-400">
                      {destination.mission}
                    </span>
                  </div>
                  <span
                    className="shrink-0 font-mono text-xs font-bold text-zinc-200"
                    title={`Valor FOB exato: ${formatExactCurrency(destination.valueFob)}`}
                  >
                    {formatCurrency(destination.valueFob)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(destination.share, 4)}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                    className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                  />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[9px] text-zinc-400">
                  <span>Fatia do consumo nacional</span>
                  <span>{destination.share.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex w-full items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-semibold text-zinc-100">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Direcionamento Estratégico de Estado
            </span>
            <p className="text-[11px] font-medium leading-snug text-zinc-200">
              {flow.destination}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

function FlowPulse({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative h-1.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-blue-500/35 via-emerald-500/60 to-amber-500/35 ${className}`}
    >
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
        className="h-full w-1/2 bg-white/60 blur-[1px]"
      />
    </div>
  );
}

function SankeyCurveLayer({
  origins,
  destinations,
  activeOrigin,
}: {
  origins: FlowOrigin[];
  destinations: FlowDestination[];
  activeOrigin: string | null;
}) {
  const originRows = distributeRows(origins.length, 86, 354);
  const destinationRows = distributeRows(destinations.length, 104, 336);
  const centerY = 220;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full lg:block"
      viewBox="0 0 1200 440"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="aipnet-flow-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {origins.map((origin, index) => {
        const supplier = cleanSupplier(origin.supplier);
        const isActive = !activeOrigin || activeOrigin === supplier;
        const color = originStrokeColors[index % originStrokeColors.length];
        const strokeWidth = Math.max(5, Math.min(28, origin.share * 0.42));
        const path = `M 320 ${originRows[index]} C 430 ${originRows[index]}, 450 ${centerY}, 548 ${centerY}`;

        return (
          <g key={`origin-path-${supplier}-${index}`}>
            <motion.path
              d={path}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              opacity={isActive ? 0.34 : 0.09}
              filter="url(#aipnet-flow-glow)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
            <motion.path
              d={path}
              fill="none"
              stroke="#ffffff"
              strokeLinecap="round"
              strokeWidth={Math.max(2, strokeWidth * 0.16)}
              opacity={isActive ? 0.35 : 0}
              strokeDasharray="12 32"
              animate={{ strokeDashoffset: [44, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
            />
          </g>
        );
      })}

      {destinations.map((destination, index) => {
        const color = destinationStrokeColors[index % destinationStrokeColors.length];
        const strokeWidth = Math.max(6, Math.min(24, destination.share * 0.48));
        const path = `M 652 ${centerY} C 750 ${centerY}, 770 ${destinationRows[index]}, 880 ${destinationRows[index]}`;

        return (
          <g key={`destination-path-${destination.sector}-${index}`}>
            <motion.path
              d={path}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              opacity={0.3}
              filter="url(#aipnet-flow-glow)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
            />
            <motion.path
              d={path}
              fill="none"
              stroke="#ffffff"
              strokeLinecap="round"
              strokeWidth={Math.max(2, strokeWidth * 0.16)}
              opacity={0.28}
              strokeDasharray="12 34"
              animate={{ strokeDashoffset: [46, 0] }}
              transition={{ repeat: Infinity, duration: 1.9, ease: 'linear' }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function distributeRows(count: number, start: number, end: number) {
  if (count <= 1) return [220];

  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    return start + (end - start) * ratio;
  });
}
