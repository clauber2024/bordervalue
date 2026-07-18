"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { animate, AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, BadgeCheck, Fuel, HelpCircle, Scale } from "lucide-react";
import type { ProdutoConceitual } from "../types/border-value";

type ProportionalityToggleProps = {
  dado?: ProdutoConceitual;
  importacao_valor_fob?: number;
  fator_alpha?: number;
  produtoNome?: string;
  defaultRateado?: boolean;
  className?: string;
};

const TOOLTIP_TEXT =
  "Fator de Proporcionalidade calculado via dados agrícolas primários das usinas certificadas, expurgando o ruído de importações transversais destinadas a outros setores industriais";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const glass = "border border-white/[0.08] bg-zinc-900/45 shadow-2xl backdrop-blur-xl";

export function ProportionalityToggle({
  dado,
  importacao_valor_fob,
  fator_alpha,
  produtoNome,
  defaultRateado = false,
  className = "",
}: ProportionalityToggleProps) {
  const rawImportValue = importacao_valor_fob ?? dado?.comercio.importacao_valor_fob ?? 100000000;
  const alpha = clampAlpha(fator_alpha ?? dado?.fator_proporcionalidade.fator_alpha ?? 0.62);
  const adjustedValue = rawImportValue * alpha;
  const initialValue = defaultRateado ? adjustedValue : rawImportValue;

  const [isRateado, setIsRateado] = useState(defaultRateado);
  const [animatedValue, setAnimatedValue] = useState(initialValue);
  const animatedValueRef = useRef(initialValue);
  const controlId = useId();
  const controlLabelId = `${controlId}-label`;

  const visibleValue = isRateado ? adjustedValue : rawImportValue;
  const visibleShare = isRateado ? alpha : 1;
  const displayName = produtoNome ?? dado?.produto_nome ?? "Biocombustíveis / SAF";

  useEffect(() => {
    const controls = animate(animatedValueRef.current, visibleValue, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        animatedValueRef.current = latest;
        setAnimatedValue(latest);
      },
    });

    return () => controls.stop();
  }, [visibleValue]);

  const impactDelta = useMemo(() => rawImportValue - adjustedValue, [rawImportValue, adjustedValue]);

  return (
    <section className={`${glass} overflow-visible rounded-lg text-zinc-100 ${className}`}>
      <header className="flex flex-col gap-4 border-b border-white/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
            <Fuel className="h-3.5 w-3.5" strokeWidth={1.5} />
            Controlador reativo
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">{displayName}</h2>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="flex select-none items-center gap-3">
            <span id={controlLabelId} className="max-w-56 text-sm font-semibold leading-5 text-zinc-200 sm:text-right">
              Ativar Lente de Uso Final (RenovaCalc)
            </span>
            <button
              id={controlId}
              type="button"
              role="switch"
              aria-checked={isRateado}
              aria-labelledby={controlLabelId}
              onClick={() => setIsRateado((value) => !value)}
              className={`relative flex h-8 w-16 shrink-0 items-center rounded-full border p-1 outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                isRateado
                  ? "justify-end border-emerald-300/40 bg-emerald-400/25 shadow-[0_0_22px_rgba(52,211,153,0.25)]"
                  : "justify-start border-white/[0.12] bg-white/[0.06]"
              }`}
            >
              <motion.span
                layout
                layoutId={`${controlId}-renovacalc-toggle-thumb`}
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                className={`h-6 w-6 rounded-full shadow-lg ${
                  isRateado ? "bg-emerald-200 shadow-emerald-950/30" : "bg-zinc-200 shadow-black/30"
                }`}
              />
            </button>
          </div>

          <AnimatePresence>
            {isRateado ? (
              <motion.span
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.22 }}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200/30 bg-emerald-300/12 px-3 py-1.5 text-xs font-bold text-emerald-100 shadow-[0_0_26px_rgba(110,231,183,0.22)]"
              >
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-200" strokeWidth={1.7} />
                Lente Ativa: Coeficiente ANP/RenovaBio
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Importação FOB</p>
              <motion.strong
                key={isRateado ? "rateado" : "bruto"}
                initial={{ opacity: 0.55, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28 }}
                className="mt-3 block break-words text-3xl font-black tracking-tight text-white sm:text-4xl"
              >
                {money.format(animatedValue)}
              </motion.strong>
            </div>

            <div className="group relative">
              <button
                type="button"
                aria-label="Ver regra tecnica do fator de proporcionalidade"
                className="rounded-lg border border-white/[0.1] bg-white/[0.05] p-2 text-zinc-300 outline-none transition hover:border-emerald-300/40 hover:text-emerald-200 focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <HelpCircle className="h-4 w-4" strokeWidth={1.6} />
              </button>
              <div
                role="tooltip"
                className="pointer-events-none absolute right-0 top-[calc(100%+0.6rem)] z-20 w-72 rounded-lg border border-emerald-300/20 bg-zinc-950/98 p-3 text-xs leading-5 text-zinc-300 opacity-0 shadow-2xl shadow-black/40 transition group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {TOOLTIP_TEXT}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-4 text-xs font-medium text-zinc-400">
              <span>{isRateado ? "Fluxo lido pela cadeia verde" : "Fluxo comercial bruto"}</span>
              <span className="text-zinc-200">{percent.format(visibleShare * 100)}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-950/80 ring-1 ring-white/[0.08]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 shadow-[0_0_18px_rgba(52,211,153,0.45)]"
                animate={{ width: `${visibleShare * 100}%` }}
                transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
                style={{ width: `${visibleShare * 100}%` }}
              />
            </div>
          </div>
        </article>

        <article className="grid rounded-lg border border-white/[0.08] bg-zinc-950/35 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
              <Scale className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Fator alpha</p>
              <strong className="mt-1 block text-2xl font-black tracking-tight text-white">{percent.format(alpha * 100)}%</strong>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <ImpactRow label="Comercial bruto" value={money.format(rawImportValue)} />
            <ImpactRow label="Uso final rateado" value={money.format(adjustedValue)} tone="emerald" />
            <ImpactRow
              label="Ruído expurgado"
              value={money.format(impactDelta)}
              tone="amber"
              icon={<ArrowDownRight className="h-3.5 w-3.5" strokeWidth={1.6} />}
            />
          </div>
        </article>
      </div>
    </section>
  );
}

function ImpactRow({
  label,
  value,
  tone = "zinc",
  icon,
}: {
  label: string;
  value: string;
  tone?: "zinc" | "emerald" | "amber";
  icon?: ReactNode;
}) {
  const tones = {
    zinc: "text-zinc-100",
    emerald: "text-emerald-200",
    amber: "text-amber-200",
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-white/[0.035] px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        {icon}
        {label}
      </span>
      <strong className={`text-right text-sm font-bold ${tones[tone]}`}>{value}</strong>
    </div>
  );
}

function clampAlpha(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(value, 0), 1);
}
