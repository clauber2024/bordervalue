"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, HelpCircle } from "lucide-react";

type ProportionalityToggleProps = {
  defaultRateado?: boolean;
  onChange?: (isRateado: boolean) => void;
  className?: string;
};

const RAW_IMPORT_VALUE_USD = 280_000_000;
const RENOVACALC_ALPHA = 0.284;
const CHAIN_IMPORT_VALUE_USD = RAW_IMPORT_VALUE_USD * RENOVACALC_ALPHA;

const AUDIT_TOOLTIP =
  "Coeficiente de proporcionalidade calibrado em 0.2840 (28,4%) via balanço de massa e consumo primário da Usina Neomille (Certificação RenovaBio E1GM)";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const spring = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.8,
} as const;

export function ProportionalityToggle({
  defaultRateado = false,
  onChange,
  className = "",
}: ProportionalityToggleProps) {
  const [isRateado, setIsRateado] = useState(defaultRateado);
  const controlId = useId();
  const labelId = `${controlId}-label`;
  const tooltipId = `${controlId}-audit-tooltip`;

  const activeValue = isRateado ? CHAIN_IMPORT_VALUE_USD : RAW_IMPORT_VALUE_USD;
  const progressShare = isRateado ? RENOVACALC_ALPHA : 1;

  const statusCopy = useMemo(
    () =>
      isRateado
        ? "Volume financeiro estrito da cadeia de biocombustível de baixo carbono"
        : "Volume importado bruto da NCM de enzimas",
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
      className={`rounded-lg border border-white/[0.08] bg-zinc-950/75 p-5 text-zinc-100 shadow-2xl shadow-black/35 backdrop-blur-xl ${className}`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Lente RenovaCalc</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-white">NCM de Enzimas</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">{statusCopy}</p>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-3 sm:items-end">
          <div className="flex items-center gap-3">
            <span id={labelId} className="max-w-64 text-sm font-semibold leading-5 text-zinc-200 sm:text-right">
              Ativar Lente de Uso Final (Fator RenovaCalc)
            </span>

            <button
              id={controlId}
              type="button"
              role="switch"
              aria-checked={isRateado}
              aria-labelledby={labelId}
              onClick={toggleRateio}
              className={`relative h-8 w-16 shrink-0 rounded-full border p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                isRateado
                  ? "border-emerald-400/60 bg-emerald-400/25"
                  : "border-white/[0.12] bg-white/[0.06]"
              }`}
            >
              <motion.span
                aria-hidden="true"
                className={`block h-6 w-6 rounded-full shadow-lg ${
                  isRateado ? "bg-emerald-400 shadow-emerald-950/30" : "bg-zinc-200 shadow-black/30"
                }`}
                animate={{ x: isRateado ? 32 : 0 }}
                transition={spring}
              />
            </button>
          </div>

          <AnimatePresence>
            {isRateado ? (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                  <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Fator Alpha Ativo
                </span>

                <span className="group relative inline-flex">
                  <button
                    type="button"
                    aria-describedby={tooltipId}
                    aria-label="Detalhes da auditoria do fator alpha"
                    className="rounded-full p-1 text-emerald-400 outline-none transition hover:bg-emerald-400/10 focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <HelpCircle className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                  <span
                    id={tooltipId}
                    role="tooltip"
                    className="pointer-events-none absolute right-0 top-[calc(100%+0.55rem)] z-20 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-emerald-400/25 bg-zinc-950 px-3 py-2.5 text-xs leading-5 text-zinc-200 opacity-0 shadow-2xl shadow-black/45 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    {AUDIT_TOOLTIP}
                  </span>
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Importação FOB</p>
            <AnimatePresence mode="wait">
              <motion.strong
                key={isRateado ? "rateado" : "bruto"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24 }}
                className="mt-2 block text-3xl font-black tracking-tight text-white sm:text-4xl"
              >
                {money.format(activeValue)}
              </motion.strong>
            </AnimatePresence>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Cobertura aplicada</p>
            <p className="mt-2 text-lg font-bold text-zinc-100">{percent.format(progressShare * 100)}%</p>
          </div>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.45)]"
            initial={false}
            animate={{ width: `${progressShare * 100}%` }}
            transition={spring}
          />
        </div>
      </div>
    </section>
  );
}

export default ProportionalityToggle;
