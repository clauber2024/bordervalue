"use client";

import React from 'react';
import {
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Factory,
  ShieldCheck,
} from 'lucide-react';

type PolicyQuadrant =
  | 'Atrair IED / Planta Nova'
  | 'Modernizar / Expandir'
  | 'Zona Segura'
  | 'Atenção Estratégica';

export type NIBMatrixItem = {
  id: string;
  name: string;
  category: string;
  ncm: string;
  nibAxis?: string;
  capacity: number;
  tradeDeficit: number;
  apparentDependency?: number;
  policyFocus?:
    | PolicyQuadrant
    | 'Atrair Investimento / Planta Nova'
    | 'Zona Segura / Competitiva';
  strategic?: boolean;
};

export type NIBItem = NIBMatrixItem;

const capacityCut = 50;
const deficitCut = 1000;

const defaultData: NIBMatrixItem[] = [
  {
    id: 'KCL',
    name: 'Cloreto de Potássio',
    category: 'Fertilizantes',
    ncm: '3104.20.90',
    nibAxis: 'Segurança agroindustrial',
    capacity: 15,
    tradeDeficit: 4140,
    apparentDependency: 96,
    strategic: true,
  },
  {
    id: 'URE',
    name: 'Ureia',
    category: 'Fertilizantes',
    ncm: '3102.10.10',
    nibAxis: 'Segurança agroindustrial',
    capacity: 25,
    tradeDeficit: 3050,
    apparentDependency: 89,
    strategic: true,
  },
  {
    id: 'MAP',
    name: 'MAP (Fosfato Monoamônico)',
    category: 'Fertilizantes',
    ncm: '3105.40.20',
    nibAxis: 'Segurança agroindustrial',
    capacity: 35,
    tradeDeficit: 1900,
    apparentDependency: 69,
    strategic: true,
  },
  {
    id: 'SAM',
    name: 'Sulfato de Amônio',
    category: 'Fertilizantes intermediários',
    ncm: '3102.21.00',
    nibAxis: 'Segurança agroindustrial',
    capacity: 60,
    tradeDeficit: 850,
    apparentDependency: 88,
    strategic: true,
  },
  {
    id: 'ENZ',
    name: 'Enzimas para Bioetanol',
    category: 'Bioprocessos',
    ncm: '3507.90.49',
    nibAxis: 'Bioeconomia e descarbonização',
    capacity: 70,
    tradeDeficit: 320,
    apparentDependency: 46,
    strategic: true,
  },
  {
    id: 'TUR',
    name: 'Turbinas Aerogeradoras',
    category: 'Energia limpa',
    ncm: '8502.31.00',
    nibAxis: 'Transição energética',
    capacity: 45,
    tradeDeficit: 450,
    apparentDependency: 58,
    strategic: true,
  },
];

const quadrantStyles: Record<
  PolicyQuadrant,
  {
    fill: string;
    text: string;
    border: string;
    point: string;
    icon: React.ReactNode;
  }
> = {
  'Atrair IED / Planta Nova': {
    fill: '#ef4444',
    text: 'text-red-300',
    border: 'border-red-500/25 bg-red-500/10',
    point: '#ef4444',
    icon: <Building2 className="h-3.5 w-3.5" />,
  },
  'Modernizar / Expandir': {
    fill: '#f59e0b',
    text: 'text-amber-300',
    border: 'border-amber-500/25 bg-amber-500/10',
    point: '#f59e0b',
    icon: <Factory className="h-3.5 w-3.5" />,
  },
  'Zona Segura': {
    fill: '#3b82f6',
    text: 'text-blue-300',
    border: 'border-blue-500/25 bg-blue-500/10',
    point: '#3b82f6',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  'Atenção Estratégica': {
    fill: '#a1a1aa',
    text: 'text-zinc-300',
    border: 'border-zinc-500/25 bg-zinc-500/10',
    point: '#a1a1aa',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
};

const formatDeficit = (value: number) =>
  value >= 1000
    ? `US$ ${(value / 1000).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} bi`
    : `US$ ${value.toLocaleString('pt-BR', {
        maximumFractionDigits: 0,
      })} mi`;

const inferQuadrant = (item: NIBMatrixItem): PolicyQuadrant => {
  if (
    item.policyFocus === 'Atrair Investimento / Planta Nova' ||
    item.policyFocus === 'Atrair IED / Planta Nova'
  ) {
    return 'Atrair IED / Planta Nova';
  }

  if (item.policyFocus === 'Zona Segura / Competitiva') {
    return 'Zona Segura';
  }

  if (
    item.policyFocus === 'Modernizar / Expandir' ||
    item.policyFocus === 'Zona Segura' ||
    item.policyFocus === 'Atenção Estratégica'
  ) {
    return item.policyFocus;
  }

  if (item.capacity < capacityCut && item.tradeDeficit >= deficitCut) {
    return 'Atrair IED / Planta Nova';
  }

  if (item.capacity >= capacityCut && item.tradeDeficit >= deficitCut) {
    return 'Modernizar / Expandir';
  }

  if (item.capacity >= capacityCut && item.tradeDeficit < deficitCut) {
    return 'Zona Segura';
  }

  return 'Atenção Estratégica';
};

const MatrixTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) {
    return null;
  }

  const item: NIBMatrixItem = payload[0].payload;
  const quadrant = inferQuadrant(item);
  const style = quadrantStyles[quadrant];

  return (
    <div className="max-w-xs rounded-xl border border-white/10 bg-zinc-950/95 p-4 text-zinc-100 shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          {item.category}
        </span>
        <span className="font-mono text-[10px] text-zinc-500">{item.ncm}</span>
      </div>

      <p className="mb-1 text-sm font-bold text-white">{item.name}</p>
      {item.nibAxis && (
        <p className="text-[11px] leading-relaxed text-zinc-400">
          {item.nibAxis}
        </p>
      )}

      <div className="my-3 space-y-1.5 rounded-lg border border-white/5 bg-zinc-900/60 p-2.5 text-xs text-zinc-300">
        <div className="flex justify-between gap-5">
          <span className="text-zinc-400">Capacidade doméstica (PIA)</span>
          <span className="font-mono font-semibold text-emerald-400">
            {item.capacity}%
          </span>
        </div>
        <div className="flex justify-between gap-5">
          <span className="text-zinc-400">Déficit comercial (Comex)</span>
          <span className="font-mono font-semibold text-red-300">
            {formatDeficit(item.tradeDeficit)}
          </span>
        </div>
        {typeof item.apparentDependency === 'number' && (
          <div className="flex justify-between gap-5">
            <span className="text-zinc-400">Dependência aparente</span>
            <span className="font-mono font-semibold text-zinc-100">
              {item.apparentDependency}%
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-white/10 pt-2 text-[11px] font-medium text-zinc-300">
        <span className={style.text}>{style.icon}</span>
        <span>
          Quadrante: <strong className={style.text}>{quadrant}</strong>
        </span>
      </div>
    </div>
  );
};

type NIBMatrixChartProps = {
  data?: NIBMatrixItem[];
};

export const NIBMatrixChart = ({ data = defaultData }: NIBMatrixChartProps) => {
  const strategicData = data
    .filter((item) => item.strategic !== false)
    .map((item) => ({
      ...item,
      apparentDependency: item.apparentDependency ?? 100,
    }));
  const priorities = strategicData
    .filter((item) => inferQuadrant(item) === 'Atrair IED / Planta Nova')
    .sort((a, b) => b.tradeDeficit - a.tradeDeficit)
    .slice(0, 3);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

      <div className="relative mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Nova Indústria Brasil
            </span>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Adensamento Produtivo
            </span>
          </div>
          <h2 className="max-w-3xl text-xl font-bold leading-tight tracking-normal text-zinc-100">
            Matriz NIB: Capacidade Produtiva Doméstica x Déficit Comercial
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-400">
            O eixo X cruza a pontuação PIA de capacidade produtiva doméstica com
            o déficit de importação do Comex Stat no eixo Y.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(quadrantStyles) as PolicyQuadrant[]).map((quadrant) => {
            const style = quadrantStyles[quadrant];

            return (
              <div
                key={quadrant}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] ${style.border} ${style.text}`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: style.point }}
                />
                <span>{quadrant}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative h-[430px] rounded-xl border border-white/5 bg-zinc-950/45 p-4">
          <div className="mb-2 flex items-center justify-between gap-3 px-1 text-[11px] text-zinc-500">
            <span>Baixa capacidade à esquerda, alta capacidade à direita</span>
            <span>Déficit estratégico acima de US$ 1 bi</span>
          </div>

          <ResponsiveContainer width="100%" height="92%">
            <ScatterChart margin={{ top: 20, right: 28, bottom: 22, left: 8 }}>
              <ReferenceArea
                x1={0}
                x2={capacityCut}
                y1={deficitCut}
                y2={4500}
                fill={quadrantStyles['Atrair IED / Planta Nova'].fill}
                fillOpacity={0.07}
                stroke={quadrantStyles['Atrair IED / Planta Nova'].fill}
                strokeOpacity={0.18}
              />
              <ReferenceArea
                x1={capacityCut}
                x2={100}
                y1={deficitCut}
                y2={4500}
                fill={quadrantStyles['Modernizar / Expandir'].fill}
                fillOpacity={0.07}
                stroke={quadrantStyles['Modernizar / Expandir'].fill}
                strokeOpacity={0.18}
              />
              <ReferenceArea
                x1={capacityCut}
                x2={100}
                y1={0}
                y2={deficitCut}
                fill={quadrantStyles['Zona Segura'].fill}
                fillOpacity={0.07}
                stroke={quadrantStyles['Zona Segura'].fill}
                strokeOpacity={0.18}
              />
              <ReferenceArea
                x1={0}
                x2={capacityCut}
                y1={0}
                y2={deficitCut}
                fill={quadrantStyles['Atenção Estratégica'].fill}
                fillOpacity={0.05}
                stroke={quadrantStyles['Atenção Estratégica'].fill}
                strokeOpacity={0.14}
              />

              <CartesianGrid
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="3 3"
              />
              <ReferenceLine
                x={capacityCut}
                stroke="#71717a"
                strokeDasharray="4 4"
              />
              <ReferenceLine
                y={deficitCut}
                stroke="#71717a"
                strokeDasharray="4 4"
              />

              <XAxis
                type="number"
                dataKey="capacity"
                domain={[0, 100]}
                unit="%"
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#27272a' }}
              />
              <YAxis
                type="number"
                dataKey="tradeDeficit"
                domain={[0, 4500]}
                width={72}
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  `US$ ${(Number(value) / 1000).toLocaleString('pt-BR', {
                    maximumFractionDigits: 1,
                  })} bi`
                }
              />
              <ZAxis
                type="number"
                dataKey="apparentDependency"
                range={[100, 260]}
              />
              <Tooltip
                content={<MatrixTooltip />}
                cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
              />

              <Scatter data={strategicData}>
                {strategicData.map((entry) => {
                  const quadrant = inferQuadrant(entry);

                  return (
                    <Cell
                      key={entry.id}
                      fill={quadrantStyles[quadrant].point}
                      fillOpacity={0.88}
                      stroke="#ffffff"
                      strokeOpacity={0.9}
                      strokeWidth={1.5}
                    />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute left-8 top-16 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300">
            Atrair IED / Planta Nova
          </div>
          <div className="pointer-events-none absolute right-8 top-16 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            Modernizar / Expandir
          </div>
          <div className="pointer-events-none absolute bottom-16 right-8 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-300">
            Zona Segura
          </div>
          <div className="pointer-events-none absolute bottom-16 left-8 rounded border border-zinc-500/20 bg-zinc-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
            Atenção Estratégica
          </div>
        </div>

        <aside className="rounded-xl border border-white/10 bg-zinc-950/45 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red-300">
            <ArrowUpRight className="h-4 w-4" />
            Prioridade Imediata
          </div>
          <div className="space-y-3">
            {priorities.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-red-500/15 bg-red-500/10 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold leading-snug text-zinc-100">
                      {item.name}
                    </h3>
                    <p className="mt-1 font-mono text-[11px] leading-relaxed text-zinc-500">
                      NCM {item.ncm}
                    </p>
                  </div>
                  <span className="shrink-0 rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-red-300">
                    {item.capacity}%
                  </span>
                </div>
                <div className="mt-2 text-xs font-medium text-red-200">
                  Déficit de {formatDeficit(item.tradeDeficit)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-zinc-500">
            A matriz organiza instrumentos da NIB conforme lacuna produtiva
            doméstica e pressão comercial externa.
          </div>
        </aside>
      </div>
    </section>
  );
};
