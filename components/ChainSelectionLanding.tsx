"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Database, GitCompareArrows, Search, Sparkles } from "lucide-react";
import type { ChainCatalogItem } from "../lib/chainCatalog";

type ChainSelectionLandingProps = {
  onSelect: (chainId: string) => void;
};

export function ChainSelectionLanding({ onSelect }: ChainSelectionLandingProps) {
  const [chains, setChains] = useState<ChainCatalogItem[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    void fetch("/api/chains")
      .then((response) => response.json())
      .then((payload: { chains?: ChainCatalogItem[] }) => {
        if (isMounted) setChains(payload.chains ?? []);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const visibleChains = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return chains;
    return chains.filter((chain) =>
      `${chain.name} ${chain.group} ${chain.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery),
    );
  }, [chains, query]);

  const groups = useMemo(
    () => Array.from(new Set(visibleChains.filter((chain) => chain.status === "published").map((chain) => chain.group))),
    [visibleChains],
  );
  const developmentChains = visibleChains.filter((chain) => chain.status === "development");

  return (
    <section className="mx-auto max-w-6xl py-8 sm:py-14">
      <div className="mx-auto max-w-3xl text-center">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          <Sparkles className="h-4 w-4" /> Border Value Intelligence
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Qual cadeia produtiva você quer analisar?
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
          Selecione uma cadeia da transição energética para revelar riscos, dependências externas e oportunidades de industrialização verde.
        </p>
        <label className="relative mx-auto mt-8 block max-w-2xl">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
          <span className="sr-only">Buscar cadeia produtiva</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar solar, hidrogênio, baterias, redes..."
            className="h-12 w-full rounded-xl border border-white/10 bg-zinc-900/55 pl-12 pr-4 text-sm text-white shadow-2xl outline-none backdrop-blur-xl placeholder:text-zinc-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
          />
        </label>
        <nav aria-label="Recursos gerais da plataforma" className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/explorar"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-cyan-300/25 hover:bg-cyan-400/[0.07] hover:text-white"
          >
            <GitCompareArrows className="h-3.5 w-3.5 text-cyan-300" />
            Comparar cadeias
          </Link>
          <Link
            href="/tour-soberania"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-emerald-300/25 hover:bg-emerald-400/[0.07] hover:text-white"
          >
            <BookOpen className="h-3.5 w-3.5 text-emerald-300" />
            Entender NIB &amp; TSB
          </Link>
        </nav>
      </div>

      {isLoading ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl border border-white/5 bg-zinc-900/40" />)}
        </div>
      ) : (
        <div className="mt-12 space-y-10">
          {groups.map((group) => (
            <div key={group}>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{group}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleChains.filter((chain) => chain.group === group && chain.status === "published").map((chain) => {
                  const isPublished = chain.status === "published";
                  return (
                    <button
                      type="button"
                      key={chain.id}
                      disabled={!isPublished}
                      onClick={() => onSelect(chain.id)}
                      className="group flex min-h-40 flex-col rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 text-left shadow-xl backdrop-blur-xl transition enabled:hover:-translate-y-1 enabled:hover:border-cyan-400/30 enabled:hover:bg-cyan-400/[0.06] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Database className={`h-5 w-5 ${isPublished ? "text-cyan-300" : "text-zinc-600"}`} />
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${isPublished ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-zinc-700 bg-zinc-800/70 text-zinc-500"}`}>
                          {isPublished ? "Publicada" : "Em desenvolvimento"}
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-bold text-white">{chain.name}</h3>
                      <p className="mt-2 flex-1 text-xs leading-5 text-zinc-400">{chain.description}</p>
                      {isPublished ? <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-cyan-300">Abrir análise <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {developmentChains.length ? (
            <details key={query ? "searching" : "idle"} open={Boolean(query)} className="rounded-2xl border border-white/[0.07] bg-zinc-900/25 p-5">
              <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                Expansão do catálogo <span className="ml-2 text-xs font-normal text-zinc-500">{developmentChains.length} cadeias em desenvolvimento</span>
              </summary>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {developmentChains.map((chain) => (
                  <div key={chain.id} className="rounded-xl border border-white/[0.06] bg-zinc-950/35 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{chain.group}</p>
                    <h3 className="mt-2 text-sm font-semibold text-zinc-300">{chain.name}</h3>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">{chain.description}</p>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </section>
  );
}
