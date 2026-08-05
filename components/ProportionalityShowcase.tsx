"use client";

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Filter, Fuel, Info, Sparkles } from 'lucide-react';

export type ProportionalityScenario = {
  rawValueFob: number;
  factorPercentage: number;
  productTitle: string;
  productSubtitle: string;
  activeLabel: string;
  inactiveLabel: string;
};

const defaultScenario: ProportionalityScenario = {
  rawValueFob: 3313951312,
  factorPercentage: 15.4,
  productTitle: 'Enzimas para Produção de Bioetanol',
  productSubtitle:
    'Importação FOB consolidada de insumos de bioprocessos e biocatalisadores.',
  inactiveLabel: 'Fluxo bruto total da NCM',
  activeLabel: 'Fração alocada à transição sustentável',
};

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

type ProportionalityToggleProps = {
  scenario?: ProportionalityScenario;
};

export const ProportionalityToggle = ({
  scenario = defaultScenario,
}: ProportionalityToggleProps) => {
  const [isRenovaCalcActive, setIsRenovaCalcActive] = useState(false);
  const filteredValueFob =
    scenario.rawValueFob * (scenario.factorPercentage / 100);
  const displayedValue = isRenovaCalcActive
    ? filteredValueFob
    : scenario.rawValueFob;
  const displayedShare = isRenovaCalcActive
    ? scenario.factorPercentage
    : 100;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />

      <div className="relative mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-400">
              <Fuel className="h-3.5 w-3.5" />
              Biocombustíveis & Transição
            </span>
          </div>
          <h3 className="text-xl font-bold leading-tight tracking-normal text-zinc-100">
            {scenario.productTitle}
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">
            {scenario.productSubtitle}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-2">
          <div className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <Filter className="h-3.5 w-3.5" />
            Lente de Uso Final
          </div>
          <button
            type="button"
            onClick={() => setIsRenovaCalcActive((active) => !active)}
            className={`relative flex w-full min-w-64 items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
              isRenovaCalcActive
                ? 'border-emerald-500/30 bg-emerald-500/15'
                : 'border-white/10 bg-zinc-900/80'
            }`}
            aria-pressed={isRenovaCalcActive}
            aria-label="Alternar lente RenovaCalc"
          >
            <span className="pr-4 text-left text-xs font-semibold text-zinc-200">
              RenovaCalc
            </span>
            <span
              className={`relative h-7 w-14 rounded-full p-1 transition-colors ${
                isRenovaCalcActive ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <motion.span
                className="block h-5 w-5 rounded-full bg-white shadow-md"
                animate={{ x: isRenovaCalcActive ? 28 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </span>
          </button>
        </div>
      </div>

      <div className="relative rounded-xl border border-white/5 bg-zinc-950/50 p-5">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="block text-xs font-medium text-zinc-400">
                {isRenovaCalcActive
                  ? scenario.activeLabel
                  : scenario.inactiveLabel}
              </span>
              {isRenovaCalcActive && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  RenovaCalc ativa
                </span>
              )}
            </div>
            <motion.div
              key={displayedValue}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-1 font-mono text-3xl font-extrabold tracking-normal text-zinc-100"
              title={`Valor FOB exato: ${formatExactCurrency(displayedValue)}`}
            >
              {formatCurrency(displayedValue)}
            </motion.div>
          </div>

          <div className="text-left sm:text-right">
            <span className="block text-xs text-zinc-400">
              Fator de Proporcionalidade
            </span>
            <span className="font-mono text-lg font-bold text-emerald-400">
              {displayedShare.toLocaleString('pt-BR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              %
            </span>
          </div>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            initial={false}
            animate={{ width: `${displayedShare}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className={`h-full rounded-full ${
              isRenovaCalcActive
                ? 'bg-gradient-to-r from-emerald-500 to-teal-300'
                : 'bg-gradient-to-r from-zinc-600 to-zinc-500'
            }`}
          />
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Info className="h-3.5 w-3.5" />
          <span title={`Base bruta: ${formatExactCurrency(scenario.rawValueFob)}`}>
            Alterna entre a leitura integral da NCM e a fração atribuível a
            Etanol/SAF.
          </span>
        </div>
      </div>

      <AnimatePresence>
        {isRenovaCalcActive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-300"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div>
              <span className="font-bold">Fator de Proporcionalidade:</span>{' '}
              aplicado para isolar apenas o volume de insumos associado a rotas
              certificadas de etanol avançado e combustíveis sustentáveis de
              aviação.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
