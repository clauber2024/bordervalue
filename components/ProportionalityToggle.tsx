"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  CheckCircle2,
  Filter,
  Fuel,
  Info,
  Sparkles,
} from "lucide-react";
import type { ProdutoConceitual } from "../types/border-value";

export type ProportionalityToggleProps = {
  dado: ProdutoConceitual;
  defaultRateado?: boolean;
  onChange?: (isRateado: boolean) => void;
  className?: string;
};

const percent = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const spring = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.82,
} as const;

export function ProportionalityToggle({
  dado,
  defaultRateado = true,
  onChange,
  className = "",
}: ProportionalityToggleProps) {
  const controlId = useId();
  const labelId = `${controlId}-label`;

  const rawImportValueUsd = dado.comercio.importacao_valor_fob;
  const proportionalityFactor = dado.fator_proporcionalidade;
  const factorAlpha = clampShare(proportionalityFactor.fator_alpha);
  const canApplyRateio = proportionalityFactor.aplicado && factorAlpha < 1;
  const [isRateado, setIsRateado] = useState(defaultRateado && canApplyRateio);
  const filteredImportValueUsd = rawImportValueUsd * factorAlpha;
  const displayedValueUsd = isRateado ? filteredImportValueUsd : rawImportValueUsd;
  const displayedShare = isRateado ? factorAlpha * 100 : 100;

  function toggleRateio() {
    if (!canApplyRateio) return;
    setIsRateado((current) => {
      const next = !current;
      onChange?.(next);
      return next;
    });
  }

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-6 text-zinc-100 shadow-2xl backdrop-blur-xl ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

      <div className="relative mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              <Fuel className="h-3.5 w-3.5" />
              Lente de Uso Final (Fator RenovaCalc)
            </span>
            {isRateado ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                <Sparkles className="h-3 w-3" />
                Fator da cadeia ativo
              </span>
            ) : null}
          </div>

          <h3 className="text-xl font-extrabold leading-tight tracking-normal text-white">
            {dado.produto_nome}
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">
            A lente separa a parcela da cesta comercial atribuível ao uso final na cadeia de combustíveis de transição.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start rounded-xl border border-white/10 bg-zinc-950/80 p-2 shadow-inner sm:self-auto">
          <span
            id={labelId}
            className="flex items-center gap-1.5 pl-1 text-xs font-semibold text-zinc-300"
          >
            <Filter className="h-3.5 w-3.5 text-emerald-400" />
            Lente RenovaCalc
          </span>
          <button
            id={controlId}
            type="button"
            role="switch"
            aria-checked={isRateado}
            aria-disabled={!canApplyRateio}
            disabled={!canApplyRateio}
            aria-labelledby={labelId}
            onClick={toggleRateio}
            className={`relative h-7 w-14 rounded-full p-1 outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 ${
              isRateado ? "bg-emerald-500" : "bg-zinc-700"
            }`}
          >
            <motion.span
              aria-hidden="true"
              className="block h-5 w-5 rounded-full bg-white shadow-md"
              animate={{ x: isRateado ? 28 : 0 }}
              transition={spring}
            />
          </button>
        </div>
      </div>

      <div className="relative rounded-xl border border-white/5 bg-zinc-950/60 p-5">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <span className="mb-1 block text-xs font-semibold text-zinc-400">
              {isRateado
                ? "Importação Efetiva Alocada (Cadeia Sustentável)"
                : "Importação FOB Bruta Total (Toda a NCM)"}
            </span>
            <div className="flex flex-wrap items-baseline gap-2">
              <AnimatePresence mode="wait">
                <motion.span
                  key={isRateado ? "rateado" : "bruto"}
                  initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(3px)" }}
                  transition={{ duration: 0.22 }}
                  className="font-mono text-3xl font-extrabold tracking-normal text-zinc-100"
                  title={`Valor FOB exato: ${formatExactCurrency(displayedValueUsd)}`}
                >
                  {formatCurrency(displayedValueUsd)}
                </motion.span>
              </AnimatePresence>
              {isRateado ? (
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-400">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  Isolado para a transição
                </span>
              ) : null}
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Proporção aplicada
            </span>
            <span className="mt-0.5 block font-mono text-xl font-extrabold text-emerald-400">
              {percent.format(displayedShare)}%
            </span>
          </div>
        </div>

        <div className="relative h-3 overflow-hidden rounded-full border border-white/5 bg-zinc-800">
          <motion.div
            initial={false}
            animate={{ width: `${displayedShare}%` }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className={`h-full rounded-full ${
              isRateado
                ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-[0_0_20px_rgba(45,212,191,0.35)]"
                : "bg-gradient-to-r from-zinc-600 to-zinc-500"
            }`}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isRateado ? (
          <motion.div
            key="active-info"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-300"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <p className="text-[11px] leading-relaxed">
              <strong className="font-semibold text-emerald-200">
                Fator de Proporcionalidade Ativo:
              </strong>{" "}
              calculado via dados primários de usinas certificadas ANP/RenovaBio por unidade
              da federação. Isola apenas a fração de biocatalisadores consumida na produção
              de bioetanol e SAF.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="inactive-info"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-[11px] leading-relaxed">
              <strong className="font-semibold text-amber-200">
                {canApplyRateio ? "Visão Bruta NCM Exibida:" : "Fator RenovaCalc ainda não publicado:"}
              </strong>{" "}
              {canApplyRateio
                ? " apresenta o volume alfandegário total sem aplicação da Lente RenovaCalc."
                : " a cesta comercial está disponível, mas não há fator de uso final homologado menor que 100% para este produto. O controle permanece desabilitado para evitar uma falsa alteração do indicador."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-white/10 pt-5 text-xs lg:grid-cols-[0.75fr_1.25fr_1.3fr_0.9fr]">
        <TraceabilityItem label="Ano-base" value={String(dado.auditoria.reference_year)} />
        <TraceabilityItem
          label="Fonte primária"
          value={canApplyRateio ? `${proportionalityFactor.fonte_proxy || "RenovaCalc / ANP"} para o fator de uso final; Comex Stat para o valor FOB bruto.` : "Comex Stat para o valor FOB bruto; fator RenovaCalc pendente de publicação no payload."}
        />
        <TraceabilityItem
          label="Método"
          value={canApplyRateio ? `Fator alpha aplicado ao valor FOB bruto: ${percent.format(factorAlpha * 100)}% do fluxo é atribuído ao mercado real de transição.` : "Nenhum rateio aplicado. A interface preserva o fluxo bruto até a homologação do fator de uso final."}
        />
        <TraceabilityItem
          label="Blindagem"
          value={dado.auditoria.metodologia_versao}
        />
      </div>
    </section>
  );
}

function TraceabilityItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/55 px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 leading-5 text-zinc-300">{value}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  if (value >= 1e9) {
    return `US$ ${(value / 1e9).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} bi`;
  }

  return `US$ ${(value / 1e6).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} mi`;
}

function formatExactCurrency(value: number) {
  return `US$ ${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  })}`;
}

function clampShare(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export default ProportionalityToggle;
