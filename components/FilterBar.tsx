"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Check,
  ChevronDown,
  Filter,
  Globe2,
  Layers3,
  Package,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { chains, indicators, periods, productOptionsForChain, territories } from "../lib/conceptualCatalog";

export type FilterState = {
  chain: string;
  product: string;
  indicator: string;
  period: string;
  flow: string;
  territory: string;
  hs: string;
  ncm: string;
  cnae: string;
  prodlist: string;
  country: string;
  mapping_status: string;
  confidence: string;
};

type FilterBarProps = {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  isLoading?: boolean;
};

type FilterKey = keyof FilterState;

const DEFAULT_FILTERS: FilterState = {
  chain: "all",
  product: "all",
  indicator: "externalDependency",
  period: "2026-H1",
  flow: "all",
  territory: "all",
  hs: "",
  ncm: "",
  cnae: "",
  prodlist: "",
  country: "",
  mapping_status: "all",
  confidence: "all",
};

const FILTER_KEYS = Object.keys(DEFAULT_FILTERS) as FilterKey[];
const MULTI_VALUE_KEYS = new Set<FilterKey>(["indicator", "territory"]);

const mainFilters = [
  {
    key: "chain",
    label: "Cadeia",
    icon: Layers3,
    options: chains,
    multi: false,
  },
  {
    key: "product",
    label: "Produto conceitual",
    icon: Package,
    options: productOptionsForChain("all"),
    multi: false,
  },
  {
    key: "indicator",
    label: "Indicador",
    icon: Filter,
    options: indicators,
    multi: true,
  },
  {
    key: "period",
    label: "Período",
    icon: Calendar,
    options: periods,
    multi: false,
  },
  {
    key: "flow",
    label: "Fluxo",
    icon: Filter,
    options: [
      ["all", "Todos"],
      ["IMP", "Importações"],
      ["EXP", "Exportações"],
    ],
    multi: false,
  },
  {
    key: "territory",
    label: "País/parceiro",
    icon: Globe2,
    options: territories,
    multi: true,
  },
] as const;

const technicalFields = [
  { key: "ncm", label: "NCM", placeholder: "Ex: 31021010" },
  { key: "cnae", label: "CNAE", placeholder: "Ex: 2013" },
  { key: "prodlist", label: "PRODLIST", placeholder: "Ex: 2052.2010" },
  { key: "country", label: "País/parceiro", placeholder: "Ex: Canadá" },
] as const;

const flowOptions = [
  ["all", "Todos"],
  ["IMP", "Importações"],
  ["EXP", "Exportações"],
] as const;

const mappingStatusOptions = [
  ["all", "Todos"],
  ["mapeado", "Mapeado"],
  ["ncm_generica", "NCM genérica"],
  ["auditoria_sigilo_pia", "Auditoria: sigilo PIA"],
] as const;

const confidenceOptions = [
  ["all", "Todos"],
  ["high", "Alto"],
  ["medium", "Médio"],
  ["low", "Baixo"],
] as const;

const glass = "backdrop-blur-xl bg-zinc-900/40 border border-white/[0.08] shadow-2xl";

export function FilterBar({ filters, isLoading = false }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const drawerTitleId = useId();
  const drawerId = useId();

  const currentFilters = useMemo<FilterState>(() => {
    const next = { ...DEFAULT_FILTERS, ...filters };
    FILTER_KEYS.forEach((key) => {
      const value = searchParams.get(key);
      next[key] = value === null ? DEFAULT_FILTERS[key] : value;
    });
    return next;
  }, [filters, searchParams]);

  const productOptions = useMemo(() => productOptionsForChain(currentFilters.chain), [currentFilters.chain]);

  const replaceUrl = useCallback(
    (patch: Partial<FilterState>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(patch).forEach(([rawKey, rawValue]) => {
        const key = rawKey as FilterKey;
        const fallback = DEFAULT_FILTERS[key];
        const value = normalizeFilterValue(rawValue ?? "", key);

        if (!value || value === fallback) params.delete(key);
        else params.set(key, value);
      });

      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearAllFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    if (!open) return;

    const frame = requestAnimationFrame(() => firstFieldRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    const validProduct = productOptions.some(([value]) => value === currentFilters.product);
    if (!validProduct) replaceUrl({ product: "all" });
  }, [currentFilters.product, productOptions, replaceUrl]);

  const chips = useMemo(() => buildActiveChips(currentFilters, productOptions), [currentFilters, productOptions]);
  const hasSearchParams = searchParams.toString().length > 0;

  return (
    <>
      <header className="sticky top-[var(--eplus-shell-h)] z-40 border-b border-white/[0.08] bg-zinc-950/82 px-4 py-3 text-zinc-100 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-300">
              Painel Analítico Border Value
            </p>
            <h1 className="mt-1 text-lg font-bold tracking-tight text-white">Explorar cadeias e produtos</h1>
          </div>

          <div className="flex flex-1 flex-col gap-3 xl:max-w-5xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
                {mainFilters.map((item) =>
                  item.multi ? (
                    <MultiSelectControl
                      key={item.key}
                      label={item.label}
                      icon={item.icon}
                      value={currentFilters[item.key]}
                      options={item.options}
                      disabled={isLoading}
                      onChange={(value) => replaceUrl({ [item.key]: value } as Partial<FilterState>)}
                    />
                  ) : (
                    <SelectControl
                      key={item.key}
                      label={item.label}
                      icon={item.icon}
                      value={currentFilters[item.key]}
                      options={item.key === "product" ? productOptions : item.options}
                      disabled={isLoading}
                      onChange={(value) => {
                        if (item.key === "chain") {
                          replaceUrl({ chain: value, product: "all", territory: "all" });
                          return;
                        }
                        replaceUrl({ [item.key]: value } as Partial<FilterState>);
                      }}
                    />
                  ),
                )}
              </div>
              <div className="flex gap-2">
                <button
                  ref={triggerRef}
                  id={`${drawerId}-trigger`}
                  type="button"
                  onClick={() => setOpen(true)}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.05] px-4 text-sm font-medium text-white outline-none transition hover:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-cyan-300 lg:flex-none"
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  aria-controls={drawerId}
                >
                  <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
                  Filtros avançados
                </button>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  disabled={isLoading || !hasSearchParams}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-medium text-zinc-100 outline-none transition hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-45 lg:flex-none"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                  Limpar filtros
                </button>
              </div>
            </div>

            {chips.length ? (
              <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3" aria-label="Filtros ativos">
                {chips.map((chip) => (
                  <button
                    key={`${chip.key}-${chip.value}`}
                    type="button"
                    onClick={() => replaceUrl(removeChip(currentFilters, chip.key, chip.value))}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-100 outline-none transition hover:bg-cyan-400/16 focus-visible:ring-2 focus-visible:ring-cyan-300"
                    aria-label={`Remover filtro ${chip.label}`}
                  >
                    <span className="truncate">{chip.label}</span>
                    <X className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div id={drawerId} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={drawerTitleId}>
            <motion.button
              type="button"
              aria-label="Fechar filtros avançados"
              className="absolute inset-0 cursor-default bg-black/60"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.aside
              className={`${glass} absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl p-5 md:bottom-0 md:left-auto md:top-0 md:h-full md:max-h-none md:w-[420px] md:rounded-l-2xl md:rounded-tr-none md:p-6`}
              initial={{ y: "100%", x: 0 }}
              animate={{ y: 0, x: 0 }}
              exit={{ y: "100%", x: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 260 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id={drawerTitleId} className="text-xl font-bold tracking-tight text-white">
                    Filtros avançados
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Use códigos e critérios técnicos apenas quando precisar auditar ou reproduzir um recorte.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/[0.1] bg-white/[0.05] p-2 text-zinc-200 outline-none transition hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-cyan-300"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                {technicalFields.map((field, index) => (
                  <label key={field.key} className="block">
                    <span className="text-sm font-medium text-zinc-300">{field.label}</span>
                    <input
                      ref={index === 0 ? firstFieldRef : undefined}
                      value={currentFilters[field.key]}
                      onChange={(event) => replaceUrl({ [field.key]: event.target.value } as Partial<FilterState>)}
                      placeholder={field.placeholder}
                      className="mt-2 h-11 w-full rounded-lg border border-white/[0.1] bg-zinc-950/60 px-3 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20"
                    />
                  </label>
                ))}

                <label className="block">
                  <span className="text-sm font-medium text-zinc-300">Status de mapeamento</span>
                  <select
                    value={currentFilters.mapping_status}
                    onChange={(event) => replaceUrl({ mapping_status: event.target.value })}
                    className="mt-2 h-11 w-full appearance-none rounded-lg border border-white/[0.1] bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20"
                  >
                    {mappingStatusOptions.map(([value, label]) => (
                      <option key={value} value={value} className="bg-zinc-950 text-zinc-100">
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-zinc-300">Nível de confiança/auditoria</span>
                  <select
                    value={currentFilters.confidence}
                    onChange={(event) => replaceUrl({ confidence: event.target.value })}
                    className="mt-2 h-11 w-full appearance-none rounded-lg border border-white/[0.1] bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20"
                  >
                    {confidenceOptions.map(([value, label]) => (
                      <option key={value} value={value} className="bg-zinc-950 text-zinc-100">
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      replaceUrl({
                        hs: "",
                        ncm: "",
                        cnae: "",
                        prodlist: "",
                        country: "",
                        mapping_status: "all",
                        confidence: "all",
                      })
                    }
                    className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-100 outline-none transition hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    Limpar técnicos
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-zinc-950 outline-none transition hover:bg-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-100"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function SelectControl({
  label,
  icon: Icon,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  icon: typeof Filter;
  value: string;
  options: readonly (readonly [string, string])[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 pr-9 text-sm font-medium text-zinc-100 outline-none transition hover:bg-white/[0.08] focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-wait disabled:opacity-60"
        >
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue} className="bg-zinc-950 text-zinc-100">
              {optionLabel}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-zinc-500" strokeWidth={1.5} />
      </span>
    </label>
  );
}

function MultiSelectControl({
  label,
  icon: Icon,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  icon: typeof Filter;
  value: string;
  options: readonly (readonly [string, string])[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const controlId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = csvToArray(value);
  const selectedLabels = selected
    .filter((item) => item !== "all")
    .map((item) => labelForValue(options, item))
    .filter(Boolean);
  const displayValue = selectedLabels.length ? selectedLabels.join(", ") : "Todos";

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleOption = (optionValue: string) => {
    if (optionValue === "all") {
      onChange("all");
      setOpen(false);
      return;
    }

    const withoutAll = selected.filter((item) => item !== "all");
    const next = withoutAll.includes(optionValue)
      ? withoutAll.filter((item) => item !== optionValue)
      : [...withoutAll, optionValue];

    onChange(next.length ? next.join(",") : "all");
  };

  return (
    <div ref={wrapperRef} className="relative">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 text-left text-sm font-medium text-zinc-100 outline-none transition hover:bg-white/[0.08] focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-wait disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={controlId}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`} strokeWidth={1.5} />
      </button>

      {open ? (
        <div
          id={controlId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[60] max-h-72 overflow-y-auto rounded-lg border border-white/[0.1] bg-zinc-950/98 p-1 shadow-2xl"
        >
          {options.map(([optionValue, optionLabel]) => {
            const active = optionValue === "all" ? selected.includes("all") : selected.includes(optionValue);
            return (
              <button
                key={optionValue}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => toggleOption(optionValue)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm text-zinc-100 outline-none transition hover:bg-white/[0.08] focus-visible:bg-white/[0.08]"
              >
                <span className="truncate">{optionLabel}</span>
                {active ? <Check className="h-4 w-4 shrink-0 text-cyan-300" strokeWidth={1.7} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function buildActiveChips(filters: FilterState, productOptions: readonly (readonly [string, string])[]) {
  return FILTER_KEYS.flatMap((key) => {
    const value = filters[key];
    if (!value || value === DEFAULT_FILTERS[key]) return [];

    const values = MULTI_VALUE_KEYS.has(key) ? csvToArray(value).filter((item) => item !== "all") : [value];
    return values.map((item) => ({
      key,
      value: item,
      label: chipLabel(key, item, productOptions),
    }));
  });
}

function removeChip(filters: FilterState, key: FilterKey, value: string): Partial<FilterState> {
  if (!MULTI_VALUE_KEYS.has(key)) return { [key]: DEFAULT_FILTERS[key] } as Partial<FilterState>;

  const next = csvToArray(filters[key]).filter((item) => item !== value && item !== "all");
  return { [key]: next.length ? next.join(",") : DEFAULT_FILTERS[key] } as Partial<FilterState>;
}

function chipLabel(key: FilterKey, value: string, productOptions: readonly (readonly [string, string])[]) {
  const dictionaries: Partial<Record<FilterKey, readonly (readonly [string, string])[]>> = {
    chain: chains,
    product: productOptions,
    indicator: indicators,
    period: periods,
    flow: flowOptions,
    territory: territories,
    mapping_status: mappingStatusOptions,
    confidence: confidenceOptions,
  };

  const label = dictionaries[key] ? labelForValue(dictionaries[key] ?? [], value) : value;
  const prefixes: Partial<Record<FilterKey, string>> = {
    hs: "HS",
    ncm: "NCM",
    cnae: "CNAE",
    prodlist: "PRODLIST",
    country: "Parceiro",
  };

  return prefixes[key] ? `${prefixes[key]}: ${label}` : label;
}

function labelForValue(options: readonly (readonly [string, string])[], value: string) {
  return options.find(([optionValue]) => optionValue === value)?.[1] ?? value;
}

function normalizeFilterValue(value: string, key: FilterKey) {
  if (!MULTI_VALUE_KEYS.has(key)) return value.trim();

  const uniqueValues = Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  if (!uniqueValues.length || uniqueValues.includes("all")) return "all";
  return uniqueValues.join(",");
}

function csvToArray(value: string) {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return values.length ? values : ["all"];
}
