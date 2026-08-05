'use client';

import React from 'react';
import {
  AlertOctagon,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

type ExecutiveAlert = {
  title: string;
  description: string;
  action: string;
};

type ExecutiveMetric = {
  label: string;
  value: string;
  note: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  icon?: 'import' | 'export' | 'alert';
};

const defaultAlert: ExecutiveAlert = {
  title: 'Sulfato de Amônio',
  description:
    '98% de dependência externa com fornecimento ultra concentrado (HHI 9.964).',
  action: 'Atrair IED / Planta Nova',
};

const defaultMetrics: ExecutiveMetric[] = [
  {
    label: 'Importações Totais',
    value: 'US$ 142,4 bi',
    note: 'Insumos e bens de capital',
    icon: 'import',
  },
  {
    label: 'Exportações Totais',
    value: 'US$ 184,8 bi',
    note: 'Superávit comercial ativo',
    tone: 'success',
    icon: 'export',
  },
  {
    label: 'Dependência Média',
    value: '25%',
    note: 'Consumo aparente nacional',
    tone: 'warning',
  },
  {
    label: 'Concentração Máxima (HHI)',
    value: '10.000',
    note: 'Risco: Monopólio Absoluto de Origem',
    tone: 'danger',
    icon: 'alert',
  },
];

const toneClasses = {
  neutral: {
    value: 'text-zinc-100',
    note: 'text-zinc-500',
    badge: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
  },
  success: {
    value: 'text-zinc-100',
    note: 'text-emerald-400/90',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  warning: {
    value: 'text-zinc-100',
    note: 'text-zinc-500',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  danger: {
    value: 'text-red-400',
    note: 'text-red-300/80',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
};

const metricIcon = (metric: ExecutiveMetric) => {
  if (metric.icon === 'import') {
    return <ArrowDownLeft className="h-4 w-4 text-emerald-400" />;
  }

  if (metric.icon === 'export') {
    return <ArrowUpRight className="h-4 w-4 text-blue-400" />;
  }

  if (metric.icon === 'alert') {
    return <AlertOctagon className="h-4 w-4 text-red-400" />;
  }

  const tone = metric.tone ?? 'neutral';

  if (tone === 'warning' || tone === 'danger') {
    return (
      <span
        className={`rounded border px-2 py-0.5 text-xs font-medium ${toneClasses[tone].badge}`}
      >
        {tone === 'danger' ? 'Crítico' : 'Atenção'}
      </span>
    );
  }

  return null;
};

type ExecutiveHeroProps = {
  alert?: ExecutiveAlert;
  metrics?: ExecutiveMetric[];
};

export const ExecutiveHero = ({
  alert = defaultAlert,
  metrics = defaultMetrics,
}: ExecutiveHeroProps) => {
  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur-xl lg:col-span-2">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />

          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Painel de Decisão de Estado
          </span>
          <h1 className="mt-2 max-w-4xl text-3xl font-extrabold leading-tight tracking-normal text-zinc-100 md:text-4xl">
            Exposição Comercial e Soberania de Insumos da Transição Energética
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Diagnóstico agregado de vulnerabilidade de suprimento, dependência
            externa e concentração de origem para direcionamento de políticas
            de industrialização e crédito de desenvolvimento.
          </p>
        </div>

        <aside className="group relative flex min-h-56 flex-col justify-between overflow-hidden rounded-2xl border border-red-500/30 bg-red-500/10 p-6 shadow-2xl backdrop-blur-xl">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-red-500/10 blur-2xl transition-all group-hover:bg-red-500/20" />
          <div className="relative">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400">
              <ShieldAlert className="h-4 w-4 animate-pulse" />
              Alerta Máximo de Suprimento
            </div>
            <h2 className="text-lg font-bold text-zinc-100">{alert.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">
              {alert.description}
            </p>
          </div>
          <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-red-500/20 pt-3 text-xs">
            <span className="font-medium text-red-300">Ação Recomendada</span>
            <span className="rounded bg-red-500/30 px-2 py-1 text-right font-bold text-white">
              {alert.action}
            </span>
          </div>
        </aside>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const tone = metric.tone ?? 'neutral';

          return (
            <article
              key={metric.label}
              className="rounded-xl border border-white/10 bg-zinc-900/40 p-5 shadow-xl backdrop-blur-xl"
            >
              <div className="flex items-center justify-between gap-3 text-xs font-medium text-zinc-400">
                <span>{metric.label}</span>
                {metricIcon(metric)}
              </div>
              <div
                className={`mt-2 font-mono text-2xl font-bold ${toneClasses[tone].value}`}
              >
                {metric.value}
              </div>
              <span
                className={`mt-1 block text-[11px] font-medium ${toneClasses[tone].note}`}
              >
                {metric.note}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
};
