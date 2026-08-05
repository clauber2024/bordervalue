'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Layers,
  ShieldCheck,
} from 'lucide-react';

type DataSource = {
  name: string;
  scope: string;
};

type DataQualityItem = {
  variable: string;
  confidence: 'Alta' | 'Média' | 'Em auditoria';
  note: string;
};

export type ExecutiveMetadata = {
  sources: DataSource[];
  comexPeriod: string;
  productionPeriod: string;
  laborPeriod: string;
  quality: DataQualityItem[];
  methodologyNotes: string[];
};

const defaultMetadata: ExecutiveMetadata = {
  sources: [
    {
      name: 'Comex Stat',
      scope: 'fluxos FOB de importação e exportação',
    },
    {
      name: 'IBGE PIA-Produto',
      scope: 'capacidade produtiva doméstica',
    },
    {
      name: 'MTE RAIS',
      scope: 'estrutura setorial e emprego formal',
    },
  ],
  comexPeriod: 'Jan-Jun 2026',
  productionPeriod: '2024',
  laborPeriod: '2024',
  quality: [
    {
      variable: 'Comércio exterior',
      confidence: 'Alta',
      note: 'valores FOB observados em base oficial consolidada',
    },
    {
      variable: 'Capacidade produtiva',
      confidence: 'Média',
      note: 'estimada por ponte produto-setor a partir da PIA-Produto',
    },
    {
      variable: 'Origem e uso final',
      confidence: 'Em auditoria',
      note: 'rateios revisados quando há múltiplas aplicações industriais',
    },
  ],
  methodologyNotes: [
    'A matriz cruza exposição comercial recente com a última fotografia estrutural disponível de produção industrial.',
    'Produtos sem enquadramento estratégico na transição energética ou no adensamento produtivo são isolados da leitura executiva.',
    'Códigos tarifários e setoriais permanecem preservados na camada de rastreabilidade, sem aparecer como linguagem principal da decisão.',
  ],
};

const confidenceClasses: Record<DataQualityItem['confidence'], string> = {
  Alta: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  Média: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  'Em auditoria': 'border-blue-500/25 bg-blue-500/10 text-blue-300',
};

type ExecutiveMetadataFooterProps = {
  metadata?: ExecutiveMetadata;
};

export const ExecutiveMetadataFooter = ({
  metadata = defaultMetadata,
}: ExecutiveMetadataFooterProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <footer className="mt-8 w-full">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-4 shadow-2xl backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />
        <div className="absolute -right-20 -top-24 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-400">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Bases Oficiais Integradas
                </span>
                <p className="mt-0.5 text-xs font-medium text-zinc-200">
                  {metadata.sources.map((source) => source.name).join(' · ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 pt-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="shrink-0 rounded-xl border border-blue-500/20 bg-blue-500/10 p-2.5 text-blue-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Validade Temporal
                </span>
                <p className="mt-0.5 text-xs font-medium text-zinc-200">
                  Comex {metadata.comexPeriod} · PIA {metadata.productionPeriod}{' '}
                  · RAIS {metadata.laborPeriod}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 pt-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div className="shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Governança Analítica
                </span>
                <p className="mt-0.5 text-xs font-medium text-zinc-200">
                  Escopo, homologação e precisão por variável
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="ml-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-2.5 text-xs font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-zinc-800/80"
            aria-expanded={isExpanded}
          >
            <FileText className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              {isExpanded ? 'Ocultar Auditabilidade' : 'Ver Auditabilidade'}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            )}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-white/10 pt-4 lg:grid-cols-[1fr_1.2fr]">
                <div className="rounded-xl border border-white/5 bg-zinc-950/50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                    <Layers className="h-3.5 w-3.5" />
                    Método e Escopo
                  </div>
                  <div className="space-y-2">
                    {metadata.methodologyNotes.map((note) => (
                      <p
                        key={note}
                        className="text-[11px] leading-relaxed text-zinc-400"
                      >
                        {note}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-zinc-950/50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Precisão por Variável
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {metadata.quality.map((item) => (
                      <div
                        key={item.variable}
                        className="rounded-lg border border-white/5 bg-zinc-900/55 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-zinc-200">
                            {item.variable}
                          </span>
                          <span
                            className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold ${confidenceClasses[item.confidence]}`}
                          >
                            {item.confidence}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-zinc-500">
                          {item.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </footer>
  );
};
