"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Compass,
  Download,
  Grid3x3,
  Network,
  Search,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export type HeaderChainOption = { id: string; name: string; group: string };
export type HeaderNcmShortcut = { id: string; code: string; label: string; riskLabel: string };

export type HeaderTopBarProps = {
  activeChainName?: string;
  chains: HeaderChainOption[];
  ncmShortcuts: HeaderNcmShortcut[];
  onSelectChain: (chainId: string) => void;
  onSelectNcm: (inputId: string) => void;
  alertCount?: number;
  alertLabel?: string;
  deficitLabel?: string;
  deficitIsSurplus?: boolean;
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
  deficitIsSurplus,
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
      <header className="sticky top-[var(--eplus-shell-h)] z-50 w-full border-b border-border/10 bg-surface-0/90 px-4 py-2.5 backdrop-blur-xl sm:px-6 lg:px-8 shadow-2xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-extrabold tracking-wide text-ink-heading sm:text-sm">
                  BORDER VALUE
                </span>
                <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
                  v1.0
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <span className="text-ink-faint">Cadeia:</span>
                <span className="max-w-[140px] truncate font-semibold text-ink-body md:max-w-[240px]">
                  {activeChainName ?? "Nenhuma selecionada"}
                </span>
              </div>
            </div>
          </div>

          <div className="relative hidden max-w-xl flex-1 md:block">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="group flex w-full items-center justify-between rounded-xl border border-border/15 bg-surface-1/60 px-3 py-1.5 text-left text-xs text-ink-muted shadow-inner transition hover:border-border/25"
            >
              <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-ink-faint transition group-hover:text-emerald-400" />
                <span className="font-mono">Pesquisar NCM, insumo crítico ou cadeia...</span>
              </span>
              <kbd className="rounded border border-border/10 bg-surface-0 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              href="/tour-soberania"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/10 bg-border/[0.04] px-3 text-xs font-semibold text-ink-body transition hover:border-emerald-300/25 hover:bg-emerald-400/[0.07] hover:text-ink-heading"
            >
              <Network className="h-3.5 w-3.5 text-emerald-300" />
              <span className="hidden sm:inline">Tour</span>
            </Link>

            <Link
              href="/sobre"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/10 bg-border/[0.04] px-3 text-xs font-semibold text-ink-body transition hover:border-emerald-300/25 hover:bg-emerald-400/[0.07] hover:text-ink-heading"
            >
              <Compass className="h-3.5 w-3.5 text-emerald-300" />
              <span className="hidden sm:inline">Sobre</span>
            </Link>

            <Link
              href="/analise-transversal"
              title="Painel Consolidado de Gargalos e Oportunidades de Adensamento"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-cyan-300/20 bg-cyan-400/[0.06] px-3 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.12] hover:text-ink-heading"
            >
              <Grid3x3 className="h-3.5 w-3.5 text-cyan-300" />
              <span className="hidden sm:inline">Matriz Transversal</span>
            </Link>

            <Link
              href="/powershoring"
              title="Tese de Powershoring: energia renovável barata como vantagem de exportação"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-300/20 bg-emerald-400/[0.06] px-3 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/40 hover:bg-emerald-400/[0.12] hover:text-ink-heading"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-300" />
              <span className="hidden sm:inline">Powershoring</span>
            </Link>

            <div className="hidden items-center gap-2 rounded-xl border border-red-300/20 bg-red-400/10 px-2.5 py-1 font-mono text-xs lg:flex">
              <span className={`h-2 w-2 rounded-full bg-red-500 ${alertCount ? "animate-pulse" : ""}`} />
              <span className="text-ink-muted">Alerta:</span>
              <strong className="text-red-400">{alertLabel ?? "—"}</strong>
            </div>

            <div className="hidden items-center gap-2 rounded-xl border border-border/15 bg-surface-1/60 px-2.5 py-1 font-mono text-xs sm:flex">
              <span className="text-ink-faint">{deficitIsSurplus ? "Superávit:" : "Déficit:"}</span>
              <strong className={deficitIsSurplus ? "text-emerald-400" : "text-amber-400"}>
                {deficitLabel ?? "—"}
              </strong>
            </div>

            <button
              type="button"
              onClick={onOpenNibMatrix}
              className="hidden items-center gap-1.5 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-400 shadow-md transition hover:bg-emerald-400/20 lg:flex"
            >
              <Zap className="h-3.5 w-3.5" />
              Direcionamento NIB
            </button>

            <button
              type="button"
              disabled={!canExport}
              onClick={onExport}
              title={canExport ? "Exportar dados da cadeia ativa em CSV" : "Selecione uma cadeia para exportar"}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-xs font-bold text-zinc-950 shadow-lg transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-border/10 disabled:text-ink-faint disabled:shadow-none"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {isSearchOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-surface-0/80 p-4 pt-20 backdrop-blur-md"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border/10 bg-surface-1 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border/10 p-4">
              <Search className="h-4 w-4 text-emerald-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Digite um código NCM, insumo ou nome da cadeia..."
                className="w-full bg-transparent font-mono text-sm text-ink-body outline-none placeholder-ink-faint"
              />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="rounded border border-border/15 bg-border/10 px-2 py-1 font-mono text-[10px] text-ink-muted"
              >
                ESC
              </button>
            </div>

            <div className="max-h-96 space-y-4 overflow-y-auto p-4">
              {filteredNcms.length ? (
                <div>
                  <span className="mb-2 block font-mono text-[10px] font-bold uppercase text-ink-faint">
                    Insumos críticos na cadeia ativa
                  </span>
                  <div className="space-y-2">
                    {filteredNcms.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => { onSelectNcm(item.id); setIsSearchOpen(false); }}
                        className="flex w-full items-center justify-between rounded-xl border border-border/10 bg-surface-0/60 p-3 text-left transition hover:border-emerald-500/50 hover:bg-border/10"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-amber-400">NCM {item.code}</span>
                            <span className="text-xs font-semibold text-ink-body">{item.label}</span>
                          </div>
                          <span className="font-mono text-[11px] text-ink-muted">{item.riskLabel}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-ink-faint" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {filteredChains.length ? (
                <div>
                  <span className="mb-2 block font-mono text-[10px] font-bold uppercase text-ink-faint">
                    Cadeias produtivas
                  </span>
                  <div className="space-y-2">
                    {filteredChains.map((chain) => (
                      <button
                        type="button"
                        key={chain.id}
                        onClick={() => { onSelectChain(chain.id); setIsSearchOpen(false); }}
                        className="flex w-full items-center justify-between rounded-xl border border-border/10 bg-surface-0/60 p-3 text-left transition hover:border-cyan-500/50 hover:bg-border/10"
                      >
                        <div>
                          <span className="text-xs font-semibold text-ink-body">{chain.name}</span>
                          <span className="block font-mono text-[11px] text-ink-faint">{chain.group}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-ink-faint" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {!filteredNcms.length && !filteredChains.length ? (
                <p className="flex items-center gap-2 py-6 text-center text-xs text-ink-faint">
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
