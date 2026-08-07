"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Compass,
  Download,
  Search,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";

export type HeaderChainOption = { id: string; name: string; group: string };
export type HeaderNcmShortcut = { id: string; code: string; label: string; riskLabel: string };
export type ReadingMode = "guided" | "analytical";

export type HeaderTopBarProps = {
  activeChainName?: string;
  chains: HeaderChainOption[];
  ncmShortcuts: HeaderNcmShortcut[];
  onSelectChain: (chainId: string) => void;
  onSelectNcm: (inputId: string) => void;
  alertCount?: number;
  alertLabel?: string;
  deficitLabel?: string;
  referencePeriod: string;
  readingMode: ReadingMode;
  onReadingModeChange: (mode: ReadingMode) => void;
  canExport: boolean;
  onExport: () => void;
  onOpenNibMatrix: () => void;
};

export function HeaderTopBar({
  activeChainName,
  chains,
  ncmShortcuts,
  onSelectChain,
  onSelectNcm,
  alertCount,
  alertLabel,
  deficitLabel,
  referencePeriod,
  readingMode,
  onReadingModeChange,
  canExport,
  onExport,
  onOpenNibMatrix,
}: HeaderTopBarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
      }
      if (event.key === "Escape") setIsSearchOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isSearchOpen) inputRef.current?.focus();
    else setSearchValue("");
  }, [isSearchOpen]);

  const normalizedQuery = searchValue.trim().toLocaleLowerCase("pt-BR");
  const filteredChains = useMemo(
    () => (!normalizedQuery ? chains : chains.filter((chain) => `${chain.name} ${chain.group}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery))),
    [chains, normalizedQuery],
  );
  const filteredNcms = useMemo(
    () => (!normalizedQuery ? ncmShortcuts : ncmShortcuts.filter((item) => `${item.code} ${item.label}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery))),
    [ncmShortcuts, normalizedQuery],
  );

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/88 px-4 py-2.5 backdrop-blur-xl sm:px-6 lg:px-8 shadow-2xl">
        <div className="mx-auto flex max-w-none items-center justify-between gap-4">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-extrabold tracking-wide text-white sm:text-sm">
                  BORDER VALUE
                </span>
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
                  v1.0
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span className="text-zinc-500">Cadeia:</span>
                <span className="max-w-[140px] truncate font-semibold text-zinc-200 md:max-w-[240px]">
                  {activeChainName ?? "Nenhuma selecionada"}
                </span>
              </div>
            </div>
          </div>

          <div className="relative hidden max-w-xl flex-1 md:block">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="group flex w-full items-center justify-between rounded-xl border border-zinc-800/90 bg-zinc-900/60 px-3 py-1.5 text-left text-xs text-zinc-400 shadow-inner transition hover:border-zinc-700"
            >
              <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-zinc-500 transition group-hover:text-emerald-400" />
                <span className="font-mono">Pesquisar NCM, insumo crítico ou cadeia...</span>
              </span>
              <kbd className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              href="/sobre"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-zinc-300 transition hover:border-emerald-300/25 hover:bg-emerald-400/[0.07] hover:text-white"
            >
              <Compass className="h-3.5 w-3.5 text-emerald-300" />
              <span className="hidden sm:inline">Sobre</span>
            </Link>

            <div className="hidden items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/30 px-2.5 py-1 font-mono text-xs lg:flex">
              <span className={`h-2 w-2 rounded-full bg-red-500 ${alertCount ? "animate-pulse" : ""}`} />
              <span className="text-zinc-400">Alerta:</span>
              <strong className="text-red-400">{alertLabel ?? "—"}</strong>
            </div>

            <div className="hidden items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-2.5 py-1 font-mono text-xs sm:flex">
              <span className="text-zinc-500">Déficit:</span>
              <strong className="text-amber-400">{deficitLabel ?? "—"}</strong>
            </div>

            <div className="hidden items-center gap-1.5 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-1 font-mono text-xs text-zinc-400 2xl:flex">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span>{referencePeriod}</span>
            </div>

            <div className="hidden items-center rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-0.5 text-[11px] font-semibold sm:flex">
              <button
                type="button"
                onClick={() => onReadingModeChange("guided")}
                className={`rounded-lg px-2.5 py-1 transition ${readingMode === "guided" ? "bg-emerald-400/10 text-emerald-300" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Executiva
              </button>
              <button
                type="button"
                onClick={() => onReadingModeChange("analytical")}
                className={`rounded-lg px-2.5 py-1 transition ${readingMode === "analytical" ? "bg-cyan-400/10 text-cyan-200" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Avançada
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenNibMatrix}
              className="hidden items-center gap-1.5 rounded-xl border border-emerald-800/80 bg-emerald-950/80 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-400 shadow-md transition hover:bg-emerald-900 lg:flex"
            >
              <Zap className="h-3.5 w-3.5" />
              Direcionamento NIB
            </button>

            <button
              type="button"
              disabled={!canExport}
              onClick={onExport}
              title={canExport ? "Exportar dados da cadeia ativa em CSV" : "Selecione uma cadeia para exportar"}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-xs font-bold text-zinc-950 shadow-lg transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>
        </div>
      </header>

      {isSearchOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-zinc-950/80 p-4 pt-20 backdrop-blur-md"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-zinc-800 p-4">
              <Search className="h-4 w-4 text-emerald-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Digite um código NCM, insumo ou nome da cadeia..."
                className="w-full bg-transparent font-mono text-sm text-zinc-100 outline-none placeholder-zinc-500"
              />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-[10px] text-zinc-400"
              >
                ESC
              </button>
            </div>

            <div className="max-h-96 space-y-4 overflow-y-auto p-4">
              {filteredNcms.length ? (
                <div>
                  <span className="mb-2 block font-mono text-[10px] font-bold uppercase text-zinc-500">
                    Insumos críticos na cadeia ativa
                  </span>
                  <div className="space-y-2">
                    {filteredNcms.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => { onSelectNcm(item.id); setIsSearchOpen(false); }}
                        className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-left transition hover:border-emerald-500/50 hover:bg-zinc-800"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-amber-400">NCM {item.code}</span>
                            <span className="text-xs font-semibold text-zinc-200">{item.label}</span>
                          </div>
                          <span className="font-mono text-[11px] text-zinc-400">{item.riskLabel}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-zinc-500" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {filteredChains.length ? (
                <div>
                  <span className="mb-2 block font-mono text-[10px] font-bold uppercase text-zinc-500">
                    Cadeias produtivas
                  </span>
                  <div className="space-y-2">
                    {filteredChains.map((chain) => (
                      <button
                        type="button"
                        key={chain.id}
                        onClick={() => { onSelectChain(chain.id); setIsSearchOpen(false); }}
                        className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-left transition hover:border-cyan-500/50 hover:bg-zinc-800"
                      >
                        <div>
                          <span className="text-xs font-semibold text-zinc-200">{chain.name}</span>
                          <span className="block font-mono text-[11px] text-zinc-500">{chain.group}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-zinc-500" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {!filteredNcms.length && !filteredChains.length ? (
                <p className="flex items-center gap-2 py-6 text-center text-xs text-zinc-500">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Nenhum resultado para &quot;{searchValue}&quot;.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
