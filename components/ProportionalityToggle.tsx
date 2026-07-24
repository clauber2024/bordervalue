"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, HelpCircle } from "lucide-react";
import type { ProdutoConceitual } from "../types/border-value";

export type ProportionalityToggleProps = {
  dado: ProdutoConceitual;
  defaultRateado?: boolean;
  onChange?: (isRateado: boolean) => void;
  className?: string;
};

const integer = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const spring = {
  type: "spring",
  stiffness: 430,
  damping: 32,
  mass: 0.82,
} as const;

export function ProportionalityToggle({
  dado,
  defaultRateado = false,
  onChange,
  className = "",
}: ProportionalityToggleProps) {
  const [isRateado, setIsRateado] = useState(defaultRateado);
  const controlId = useId();
  const labelId = `${controlId}-label`;
  const tooltipId = `${controlId}-audit-tooltip`;
  const thumbLayoutId = `${controlId}-thumb`;

  const rawImportValueUsd = dado.comercio.importacao_valor_fob;
  const proportionalityFactor = dado.fator_proporcionalidade;

  const factorAlpha = clampShare(proportionalityFactor.fator_alpha);
  const displayedValueUsd = isRateado ? rawImportValueUsd * factorAlpha : rawImportValueUsd;
  const progressShare = isRateado ? factorAlpha : 1;
  const productName = dado.produto_nome;

  const statusCopy = useMemo(
    () =>
      isRateado
        ? "Fração financeira isolada para usinas de bioenergia pelo fator de proporcionalidade."
        : "Valor bruto consolidado das importações de enzimas no Comex Stat.",
    [isRateado],
  );

  function toggleRateio() {
    setIsRateado((current) => {
      const next = !current;
      onChange?.(next);
      return next;
    });
  }

  return (
    <section
      className={`overflow-visible rounded-lg border border-zinc-800/80 bg-zinc-950/90 p-5 text-zinc-100 shadow-2xl shadow-black/45 ring-1 ring-white/[0.03] backdrop-blur-xl ${className}`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-zinc-800 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-zinc-300">
              Produto conceitual
            </span>
            <span className="rounded-md border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              RenovaCalc
            </span>
          </div>
          <h2 className="mt-3 break-words text-xl font-bold tracking-tight text-white sm:text-2xl">
            {productName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{statusCopy}</p>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-3 sm:items-end">
          <div className="flex items-center gap-3">
            <span id={labelId} className="max-w-64 text-sm font-semibold leading-5 text-zinc-200 sm:text-right">
              Lente de Uso Final (Fator RenovaCalc)
            </span>

            <button
              id={controlId}
              type="button"
              role="switch"
              aria-checked={isRateado}
              aria-labelledby={labelId}
              onClick={toggleRateio}
              className={`relative flex h-8 w-16 shrink-0 items-center rounded-full border p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                isRateado
                  ? "justify-end border-emerald-400/70 bg-emerald-400/25"
                  : "justify-start border-white/[0.12] bg-white/[0.06]"
              }`}
            >
              <motion.span
                layout
                layoutId={thumbLayoutId}
                aria-hidden="true"
                transition={spring}
                className={`block h-6 w-6 rounded-full shadow-lg ${
                  isRateado ? "bg-emerald-400 shadow-emerald-950/40" : "bg-zinc-200 shadow-black/35"
                }`}
              />
            </button>
          </div>

          <AnimatePresence>
            {isRateado ? (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className="relative flex items-center gap-2"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                  <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Fator Alpha Ativo
                </span>

                <span className="group relative inline-flex">
                  <button
                    type="button"
                    aria-describedby={tooltipId}
                    aria-label="Detalhes de auditoria do fator alpha"
                    className="rounded-full p-1 text-emerald-400 outline-none transition hover:bg-emerald-400/10 focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <HelpCircle className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                  <span
                    id={tooltipId}
                    role="tooltip"
                    className="pointer-events-none absolute right-0 top-[calc(100%+0.55rem)] z-30 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-emerald-400/25 bg-zinc-950 px-3 py-2.5 text-xs leading-5 text-zinc-200 opacity-0 shadow-2xl shadow-black/50 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    Fator alpha informado pelo backend: {percent.format(factorAlpha * 100)}%.
                    Fonte/proxy: {proportionalityFactor.fonte_proxy}.
                  </span>
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-7 rounded-lg border border-zinc-800/75 bg-white/[0.035] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Importação FOB
            </p>
            <AnimatePresence mode="wait">
              <motion.strong
                key={isRateado ? "rateado" : "bruto"}
                initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(3px)" }}
                transition={{ duration: 0.22 }}
                className="mt-2 block break-words text-3xl font-black tracking-tight text-white sm:text-4xl"
              >
                {formatUsd(displayedValueUsd)}
              </motion.strong>
            </AnimatePresence>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Cobertura aplicada
            </p>
            <p className="mt-2 text-lg font-bold text-zinc-100">
              {percent.format(progressShare * 100)}%
            </p>
          </div>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.48)]"
            initial={false}
            animate={{ width: `${progressShare * 100}%` }}
            transition={spring}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-zinc-800/70 pt-5 text-xs lg:grid-cols-[0.8fr_1.4fr_1.4fr_0.9fr]">
        <TraceabilityItem label="Ano-base" value={String(dado.auditoria.reference_year)} />
        <TraceabilityItem
          label="Fontes"
          value={`Comex Stat para valor bruto; ${proportionalityFactor.fonte_proxy} para fator proporcional.`}
        />
        <TraceabilityItem
          label="Método"
          value={`Fator alpha aplicado ao valor FOB bruto: ${percent.format(factorAlpha * 100)}% do fluxo é atribuído ao uso final do piloto.`}
        />
        <TraceabilityItem
          label="Auditoria"
          value={dado.auditoria.metodologia_versao}
        />
      </div>
    </section>
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

function formatUsd(value: number) {
  return `US$ ${integer.format(Math.round(value))}`;
}

function clampShare(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export default ProportionalityToggle;
