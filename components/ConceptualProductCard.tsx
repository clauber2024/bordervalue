"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  BarChart3,
  ChevronDown,
  CircleAlert,
  Factory,
  FileText,
  Globe2,
  Package,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export interface ConceptualProduct {
  id: string;
  name: string;
  shortDescription: string;
  chain: string;
  productionStage: string;
  metrics: {
    imports: number;
    exports: number;
    externalDependency: number;
    hhi: number;
    mainSupplier: { country: string; share: number };
    confidenceLevel: "high" | "medium" | "low";
  };
  technicalCodes: {
    hs: string[];
    ncm: string[];
    cnae: string[];
    prodlist?: string[];
  };
  sources: string[];
  methodology?: string;
}

type ConceptualProductCardProps = {
  product?: ConceptualProduct;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const glass = "backdrop-blur-xl bg-zinc-900/40 border border-white/[0.08] shadow-2xl";

const confidenceCopy = {
  high: { label: "Alta confiança", className: "bg-emerald-400/10 text-emerald-300 border-emerald-300/20" },
  medium: { label: "Média confiança", className: "bg-amber-400/10 text-amber-300 border-amber-300/20" },
  low: { label: "Baixa confiança", className: "bg-rose-400/10 text-rose-300 border-rose-300/20" },
};

export function ConceptualProductCard({ product, isLoading = false, error, onRetry }: ConceptualProductCardProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (isLoading) return <ConceptualProductCardSkeleton />;
  if (error) return <ConceptualProductCardError error={error} onRetry={onRetry} />;
  if (!product) return <ConceptualProductCardEmpty />;

  const confidence = confidenceCopy[product.metrics.confidenceLevel];

  return (
    <article className={`${glass} overflow-hidden rounded-2xl`}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                <Package className="h-3.5 w-3.5" strokeWidth={1.5} />
                {product.chain}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${confidence.className}`}>
                <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                {confidence.label}
              </span>
            </div>
            <h3 className="mt-4 text-2xl font-bold tracking-tight text-white">{product.name}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{product.shortDescription}</p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 sm:min-w-40">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              <Factory className="h-3.5 w-3.5" strokeWidth={1.5} />
              Etapa
            </p>
            <p className="mt-2 text-sm font-bold text-zinc-100">{product.productionStage}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric icon={TrendingDown} label="Importações" value={money.format(product.metrics.imports)} tone="cyan" />
          <Metric icon={TrendingUp} label="Exportações" value={money.format(product.metrics.exports)} tone="emerald" />
          <Metric icon={Globe2} label="Dependência externa" value={`${product.metrics.externalDependency}%`} tone="amber" />
          <Metric icon={BarChart3} label="HHI" value={product.metrics.hhi.toLocaleString("pt-BR")} tone="rose" />
          <Metric icon={Shield} label="Principal fornecedor" value={product.metrics.mainSupplier.country} tone="cyan" />
          <Metric icon={CircleAlert} label="Participacao" value={`${product.metrics.mainSupplier.share}%`} tone="amber" />
        </div>
      </div>

      <div className="border-t border-white/[0.08] bg-zinc-950/25">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-zinc-200 outline-none transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 sm:px-6"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-300" strokeWidth={1.5} />
            Conteúdo técnico e metodologia
          </span>
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} strokeWidth={1.5} />
        </button>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id={panelId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-5 px-5 pb-6 sm:px-6">
                <div>
                  <h4 className="text-sm font-medium text-zinc-300">Fontes</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.sources.map((source) => (
                      <span key={source} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300">
                        {source}
                      </span>
                    ))}
                  </div>
                </div>

                {product.methodology ? (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-300">Metodologia</h4>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{product.methodology}</p>
                  </div>
                ) : null}

                <p className="rounded-lg border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-xs leading-5 text-cyan-50/85">
                  Códigos técnicos e chaves brutas ficam concentrados na gaveta de rastreabilidade.
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </article>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    cyan: "text-cyan-300 bg-cyan-400/10",
    emerald: "text-emerald-300 bg-emerald-400/10",
    amber: "text-amber-300 bg-amber-400/10",
    rose: "text-rose-300 bg-rose-400/10",
  };
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        </span>
        {label}
      </p>
      <strong className="mt-3 block truncate text-lg font-bold tracking-tight text-white">{value}</strong>
    </div>
  );
}

export function ConceptualProductCardSkeleton() {
  return (
    <article className={`${glass} rounded-2xl p-5 sm:p-6`}>
      <div className="animate-pulse space-y-5">
        <div className="h-6 w-48 rounded-full bg-white/[0.08]" />
        <div className="h-8 w-2/3 rounded-lg bg-white/[0.08]" />
        <div className="h-4 w-full rounded bg-white/[0.06]" />
        <div className="h-4 w-4/5 rounded bg-white/[0.06]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-24 rounded-xl border border-white/[0.08] bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </article>
  );
}

export function ConceptualProductCardError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <article className={`${glass} rounded-2xl p-6 text-center`}>
      <CircleAlert className="mx-auto h-9 w-9 text-amber-300" strokeWidth={1.5} />
      <h3 className="mt-4 text-lg font-bold tracking-tight text-white">Produto indisponível</h3>
      <p className="mt-2 text-sm text-zinc-400">{error}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-lg border border-white/[0.1] bg-white/[0.05] px-4 py-2 text-sm font-medium text-white outline-none transition hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          Recarregar
        </button>
      ) : null}
    </article>
  );
}

export function ConceptualProductCardEmpty() {
  return (
    <article className={`${glass} rounded-2xl p-6 text-center`}>
      <Package className="mx-auto h-9 w-9 text-cyan-300" strokeWidth={1.5} />
      <h3 className="mt-4 text-lg font-bold tracking-tight text-white">Nenhum produto neste recorte</h3>
      <p className="mt-2 text-sm text-zinc-400">Tente ampliar o período ou remover um filtro técnico.</p>
    </article>
  );
}
