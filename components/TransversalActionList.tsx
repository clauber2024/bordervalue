"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileSearch, X } from "lucide-react";
import type { ProdutoConceitual } from "../types/border-value";
import { describeCode } from "./CodeTooltip";
import {
  CHAIN_META,
  QUADRANT_META,
  actionLabelFor,
  classifyQuadrant,
  isExtremeBottleneck,
  riskExposure,
  uniqueProductKey,
  type DedupedProduct,
  type MonitoredChain,
  type QuadrantId,
} from "../lib/transversalMatrix";

export type QuadrantFilter = QuadrantId | "todos";

type TransversalActionListProps = {
  data: DedupedProduct[];
  activeQuadrant: QuadrantFilter;
  onQuadrantChange: (quadrant: QuadrantFilter) => void;
  selectedProductId: string | null;
  onSelectProduct: (id: string | null) => void;
  className?: string;
};

const glass = "border border-white/[0.08] bg-zinc-900/40 shadow-2xl shadow-black/25 backdrop-blur-xl";

const usdCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const TABS: Array<{ id: QuadrantFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "atrair", label: QUADRANT_META.atrair.label },
  { id: "modernizar", label: QUADRANT_META.modernizar.label },
  { id: "zona_segura", label: QUADRANT_META.zona_segura.label },
];

export function TransversalActionList({
  data,
  activeQuadrant,
  onQuadrantChange,
  selectedProductId,
  onSelectProduct,
  className = "",
}: TransversalActionListProps) {
  const [codesProductId, setCodesProductId] = useState<string | null>(null);

  const visibleItems = useMemo(() => {
    const withQuadrant = data.map((entry) => ({ entry, quadrant: classifyQuadrant(entry.product) }));
    const filtered = activeQuadrant === "todos" ? withQuadrant : withQuadrant.filter((item) => item.quadrant === activeQuadrant);
    return filtered.sort((left, right) => riskExposure(right.entry.product) - riskExposure(left.entry.product));
  }, [data, activeQuadrant]);

  const codesEntry = codesProductId ? data.find((entry) => uniqueProductKey(entry.product) === codesProductId) : undefined;
  const codesProduct = codesEntry?.product;

  return (
    <section className={`${glass} flex flex-col overflow-hidden rounded-lg text-zinc-100 ${className}`}>
      <header className="border-b border-white/[0.08] bg-white/[0.025] px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Lista de Ação Rápida</p>
        <h2 className="mt-1 text-base font-bold tracking-tight text-white">Filtrar por quadrante</h2>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-white/[0.08] px-4 py-3 sm:px-5">
        {TABS.map((tab) => {
          const active = activeQuadrant === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onQuadrantChange(tab.id)}
              aria-pressed={active}
              className={`relative rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="transversal-tab-highlight"
                  className="absolute inset-0 rounded-full border border-cyan-300/40 bg-cyan-400/10"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              ) : null}
              <span className="relative">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="max-h-[520px] flex-1 overflow-y-auto p-3 sm:p-4">
        {!visibleItems.length ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-zinc-500">
            Nenhum insumo neste quadrante.
          </p>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div className="space-y-2.5" layout>
              {visibleItems.map(({ entry, quadrant }) => {
                const key = uniqueProductKey(entry.product);
                return (
                  <ActionListItem
                    key={key}
                    product={entry.product}
                    chains={entry.chains}
                    quadrant={quadrant}
                    isSelected={selectedProductId === key}
                    onSelect={() => onSelectProduct(selectedProductId === key ? null : key)}
                    onOpenCodes={() => setCodesProductId(key)}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {codesProduct ? <CodeAuditModal product={codesProduct} onClose={() => setCodesProductId(null)} /> : null}
      </AnimatePresence>
    </section>
  );
}

function ActionListItem({
  product,
  chains,
  quadrant,
  isSelected,
  onSelect,
  onOpenCodes,
}: {
  product: ProdutoConceitual;
  chains: MonitoredChain[];
  quadrant: QuadrantId;
  isSelected: boolean;
  onSelect: () => void;
  onOpenCodes: () => void;
}) {
  const extreme = isExtremeBottleneck(product);
  const action = actionLabelFor(product, quadrant);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      onClick={onSelect}
      role="button"
      className={`cursor-pointer rounded-lg border px-3 py-3 transition ${
        isSelected ? "border-cyan-300/50 bg-cyan-400/[0.06]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {chains.map((chain) => (
              <span
                key={chain}
                className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: CHAIN_META[chain].color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHAIN_META[chain].color }} />
                {CHAIN_META[chain].shortLabel}
              </span>
            ))}
          </div>
          <p className="mt-1 break-words text-sm font-semibold leading-5 text-zinc-100">{product.produto_nome}</p>
          {chains.length > 1 ? (
            <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">Mesma cesta NCM contada nas {chains.length} cadeias acima -- 1 fluxo, não {chains.length}.</p>
          ) : null}
          <span className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${action.tone}`} title={action.description}>
            {action.label}
          </span>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenCodes();
          }}
          title="Ver códigos fiscais (NCM/CNAE) para auditoria técnica"
          className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 transition hover:border-cyan-300/40 hover:text-cyan-200"
        >
          <FileSearch className="h-3.5 w-3.5" strokeWidth={1.7} />
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-zinc-300">
          {usdCompact.format(product.comercio.importacao_valor_fob)} FOB/ano
        </span>
        <span className="text-zinc-500">{product.comercio.principal_pais_origem || "Origem não publicada"}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono font-semibold ${
            extreme ? "animate-pulse border-red-400/50 bg-red-500/20 text-red-200" : "border-white/10 bg-white/[0.03] text-zinc-400"
          }`}
        >
          HHI {Math.round(product.comercio.hhi_global).toLocaleString("pt-BR")}
        </span>
      </div>
    </motion.div>
  );
}

function CodeAuditModal({ product, onClose }: { product: ProdutoConceitual; onClose: () => void }) {
  const ncmCodes = product.ncm_codigos?.length ? product.ncm_codigos : [product.ncm_codigo];
  const cnaeCode = product.industria.cnae_codigo;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Códigos fiscais de ${product.produto_nome}`}
        className={`${glass} w-full max-w-md rounded-lg p-5`}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Auditoria técnica</p>
            <h3 className="mt-1 text-sm font-bold text-white">{product.produto_nome}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-zinc-300 transition hover:bg-white/[0.09]"
          >
            <X className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div>
            <p className="font-semibold uppercase tracking-[0.14em] text-zinc-500">NCM</p>
            <div className="mt-1.5 space-y-1.5">
              {ncmCodes.map((code) => (
                <CodeRow key={code} kind="ncm" code={code} />
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.14em] text-zinc-500">CNAE</p>
            <div className="mt-1.5">
              {cnaeCode ? <CodeRow kind="cnae" code={cnaeCode} /> : <p className="text-zinc-500">Não publicado</p>}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CodeRow({ kind, code }: { kind: "ncm" | "cnae"; code: string }) {
  if (isResidualCode(code)) {
    return (
      <div className="rounded-md border border-amber-300/20 bg-amber-400/10 px-2.5 py-2">
        <span className="font-semibold text-amber-200">Não homologado</span>
        <p className="mt-0.5 leading-4 text-zinc-400">Código residual/genérico, sem cesta específica publicada ainda.</p>
      </div>
    );
  }

  const description = describeCode(kind, code);
  return (
    <div className="rounded-md border border-white/[0.08] bg-zinc-950/50 px-2.5 py-2">
      <span className="font-mono text-zinc-100">{code}</span>
      <p className="mt-0.5 leading-4 text-zinc-400">{description ?? "Descrição não catalogada."}</p>
    </div>
  );
}

function isResidualCode(value: string | null | undefined) {
  if (!value) return true;
  const normalized = value.replace(/\D/g, "");
  return !normalized || /^0+$/.test(normalized);
}

export default TransversalActionList;
