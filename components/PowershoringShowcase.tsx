"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, ChevronDown, Factory, Layers3, Sparkles, Zap } from "lucide-react";
import { StrategicVectorBadge } from "./StrategicVectorBadge";
import { ROUTE_CLASS_COLORS, ROUTE_CLASS_LABELS } from "./SovereigntySankeyChart";
import { computeCarbonRouteExposure } from "./CarbonFootprintIndustrialBlock";
import { regulatoryLeverSummary, type RegulatoryLeverSummary, type SiliconValueAsymmetry } from "./SiliconStrategicLevers";
import { buildValueAsymmetry } from "../lib/valueAsymmetry";
import { useSolarSovereignty } from "../hooks/useSolarSovereignty";
import { CHAIN_META, MONITORED_CHAINS, type MonitoredChain } from "../lib/transversalMatrix";
import type { SolarInputMetric } from "../types/solar-sovereignty";

const usdCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

type FlaggedInput = { chain: MonitoredChain; input: SolarInputMetric };

// Same NCM basket can be the real commercial flow behind two conceptual
// products in two different chains (e.g. amônia is tracked both as a
// fertilizante intermediário and as a combustível-de-transição derivado) --
// mirrors dedupeCrossChainProducts()'s ncmBasketKey in
// lib/transversalMatrix.ts, adapted to SolarInputMetric's shape. Left
// un-deduplicated, this page shows the identical imports/exports figure
// twice as if they were two independent flows.
type FlaggedGroup = { key: string; primaryChain: MonitoredChain; entries: FlaggedInput[] };

const CHAIN_ORDER_INDEX = new Map(MONITORED_CHAINS.map((chain, index) => [chain, index]));

function ncmBasketKey(input: SolarInputMetric): string {
  return (input.ncm_codes.length ? input.ncm_codes : [input.input_id]).slice().sort().join("|");
}

function groupCrossChainDuplicates(flagged: FlaggedInput[]): FlaggedGroup[] {
  const buckets = new Map<string, FlaggedInput[]>();
  flagged.forEach((item) => {
    const key = ncmBasketKey(item.input);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  });
  return Array.from(buckets.entries()).map(([key, entries]) => {
    // Deterministic primary chain (same MONITORED_CHAINS tie-break as
    // dedupeCrossChainProducts) so the merged card always lands in the same
    // chain's section across re-renders instead of flickering.
    const sorted = entries.slice().sort(
      (a, b) => (CHAIN_ORDER_INDEX.get(a.chain) ?? 0) - (CHAIN_ORDER_INDEX.get(b.chain) ?? 0),
    );
    return { key, primaryChain: sorted[0].chain, entries: sorted };
  });
}

type ChainSynthesis = {
  chain: MonitoredChain;
  vectorCount: number;
  valueAsymmetry?: SiliconValueAsymmetry;
  regulatoryLever: RegulatoryLeverSummary;
  nonLowCarbonShare?: number;
};

/**
 * Aggregates every insumo across the 4 published chains whose
 * strategic_profile.is_powershoring_vector is true -- no hardcoded roster.
 * A chain with no flagged insumo today simply contributes nothing; if the
 * backend flags a new one later (e.g. silício), it appears here without a
 * frontend change.
 */
export function PowershoringShowcase() {
  const silicio = useSolarSovereignty("silicio");
  const fertilizantes = useSolarSovereignty("fertilizantes");
  const combustiveis = useSolarSovereignty("combustiveis_transicao");
  const aco = useSolarSovereignty("aco");

  const chainResults: Array<{ chain: MonitoredChain } & ReturnType<typeof useSolarSovereignty>> = [
    { chain: MONITORED_CHAINS[0], ...silicio },
    { chain: MONITORED_CHAINS[1], ...fertilizantes },
    { chain: MONITORED_CHAINS[2], ...combustiveis },
    { chain: MONITORED_CHAINS[3], ...aco },
  ];

  const isInitialLoading = chainResults.every((result) => result.isLoading && !result.data);
  const loadedChainsCount = chainResults.filter((result) => result.data).length;
  const failedChains = chainResults.filter((result) => result.error);

  // Resolves value_chain_links ids (e.g. "ferro_gusa") against the labels
  // already published for that same chain, instead of hardcoding a second
  // copy of every insumo name here.
  const inputLabelById = useMemo(() => {
    const map = new Map<string, string>();
    chainResults.forEach((result) => {
      result.data?.inputs.forEach((input) => map.set(input.input_id, input.label));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silicio.data, fertilizantes.data, combustiveis.data, aco.data]);

  const flagged: FlaggedInput[] = useMemo(
    () =>
      chainResults.flatMap((result) =>
        (result.data?.inputs ?? [])
          .filter((input) => input.strategic_profile?.is_powershoring_vector)
          .map((input) => ({ chain: result.chain, input })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [silicio.data, fertilizantes.data, combustiveis.data, aco.data],
  );

  const groups = useMemo(() => groupCrossChainDuplicates(flagged), [flagged]);
  const mergedGroupCount = groups.filter((group) => group.entries.length > 1).length;

  const groupsByChain = useMemo(() => {
    const map = new Map<MonitoredChain, FlaggedGroup[]>();
    MONITORED_CHAINS.forEach((chain) => map.set(chain, []));
    groups.forEach((group) => map.get(group.primaryChain)?.push(group));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const chainsRepresented = new Set(flagged.map((item) => item.chain)).size;
  const linksCount = new Set(flagged.flatMap((item) => item.input.strategic_profile?.value_chain_links ?? [])).size;

  // Chain-level synthesis -- the same "Alavancas estratégicas" numbers each
  // chain page already computes (components/SiliconStrategicLevers.tsx),
  // reused here so the reader gets the cross-chain comparison this page is
  // supposed to be about *before* the insumo-by-insumo cards, instead of
  // jumping straight from methodology to a flat list.
  const chainSynthesis: ChainSynthesis[] = useMemo(
    () =>
      chainResults
        .filter((result) => result.data)
        .map((result) => {
          const inputs = result.data!.inputs;
          const exposure = computeCarbonRouteExposure(inputs);
          const nonLowCarbonShare = exposure.length
            ? 1 - (exposure.find((item) => item.routeClass === "low_carbon_dominant")?.share ?? 0)
            : undefined;
          return {
            chain: result.chain,
            vectorCount: inputs.filter((input) => input.strategic_profile?.is_powershoring_vector).length,
            valueAsymmetry: buildValueAsymmetry(result.chain, inputs),
            regulatoryLever: regulatoryLeverSummary(result.chain),
            nonLowCarbonShare,
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [silicio.data, fertilizantes.data, combustiveis.data, aco.data],
  );

  // Every insumo across the 4 chains, flagged or not -- so the cards above
  // are auditable against the full set instead of reading as an arbitrary
  // pick. Recomputed live from the same fetch, never a frozen snapshot.
  const allInputs: FlaggedInput[] = useMemo(
    () =>
      chainResults.flatMap((result) =>
        (result.data?.inputs ?? []).map((input) => ({ chain: result.chain, input })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [silicio.data, fertilizantes.data, combustiveis.data, aco.data],
  );
  const auditRows = [...allInputs].sort((a, b) => {
    const aFlagged = a.input.strategic_profile?.is_powershoring_vector ? 0 : 1;
    const bFlagged = b.input.strategic_profile?.is_powershoring_vector ? 0 : 1;
    if (aFlagged !== bFlagged) return aFlagged - bFlagged;
    if (a.chain !== b.chain) return a.chain.localeCompare(b.chain);
    return a.input.label.localeCompare(b.input.label, "pt-BR");
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition hover:text-emerald-200"
        >
          <ArrowUpRight className="h-3.5 w-3.5 rotate-[225deg]" strokeWidth={1.8} />
          Painel Analítico Border Value
        </Link>

        <header className="relative mt-4 overflow-hidden rounded-2xl border border-emerald-300/15 bg-zinc-900/55 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              <Zap className="h-3 w-3" />
              Tese Estratégica
            </span>

            <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Powershoring: energia renovável barata como vantagem de exportação
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
              A matriz elétrica brasileira é mais de 84% renovável (BEN/EPE) -- uma vantagem estrutural que rotas
              industriais eletrointensivas em outros países não têm. Esta página reúne, das 4 cadeias já publicadas
              na plataforma, todo insumo que a metodologia classificou como um vetor real dessa tese -- não uma
              lista fixa, mas o que os dados de cada cadeia sustentam hoje.
            </p>

            {failedChains.length ? (
              <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-200">
                Falha ao carregar {failedChains.length} de {MONITORED_CHAINS.length} cadeias (
                {failedChains.map((item) => CHAIN_META[item.chain].shortLabel).join(", ")}). Os números abaixo
                refletem apenas as cadeias disponíveis.
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/15 bg-zinc-950/60 p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Insumos com vetor identificado
                </div>
                <p className="font-mono text-lg font-extrabold text-zinc-100">{groups.length}</p>
                <p className="text-[11px] text-zinc-400">
                  {loadedChainsCount}/{MONITORED_CHAINS.length} cadeias carregadas
                  {mergedGroupCount ? ` · ${mergedGroupCount} conta${mergedGroupCount === 1 ? "" : "m"} para 2 cadeias` : ""}
                </p>
              </div>
              <div className="rounded-xl border border-white/15 bg-zinc-950/60 p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  <Factory className="h-3.5 w-3.5" />
                  Cadeias com vetor mapeado
                </div>
                <p className="font-mono text-lg font-extrabold text-zinc-100">
                  {chainsRepresented} de {MONITORED_CHAINS.length}
                </p>
                <p className="text-[11px] text-zinc-400">cadeias publicadas</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-zinc-950/60 p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  <Layers3 className="h-3.5 w-3.5" />
                  Elos de cadeia de valor conectados
                </div>
                <p className="font-mono text-lg font-extrabold text-zinc-100">{linksCount}</p>
                <p className="text-[11px] text-zinc-400">insumos citados como contraparte</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 shadow-xl backdrop-blur-xl sm:p-7">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
            O que conta como vetor de powershoring aqui
          </h2>
          <p className="mt-2 text-xs font-semibold text-zinc-400">Um insumo entra nesta leitura quando os três critérios batem:</p>
          <ol className="mt-3 space-y-2">
            {[
              "A etapa evita ou substitui um insumo/processo fóssil por eletricidade limpa, biomassa renovável (redutor) ou combustível renovável (biometano) -- não apenas \"de origem mineral\" ou \"sem combustão direta\".",
              "A rota hoje dominante no mundo -- ou a rota fóssil equivalente -- roda numa matriz suja: carvão, coque ou gás natural fóssil.",
              "O Brasil tem, ou pode ter em prazo razoável, capacidade doméstica de fazer essa etapa com energia, redutor ou combustível renovável -- matriz elétrica >84% renovável (BEN/EPE), carvão vegetal de floresta plantada, ou biometano com mandato federal (Decreto nº 12.614/2025).",
            ].map((text, index) => (
              <li key={index} className="flex gap-3 text-sm leading-relaxed text-zinc-300">
                <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-emerald-400">{index + 1}</span>
                {text}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            Isso deixa de fora insumos "limpos por padrão" mas sem alavanca real -- mineração de rocha fosfática ou
            cloreto de potássio, por exemplo, já são <code className="text-zinc-400">low_carbon_dominant</code> no
            dado, mas não porque o Brasil tenha uma vantagem a explorar: é que a etapa em si mal consome energia.
          </p>
          <div className="mt-4 border-t border-dashed border-white/10 pt-4">
            <p className="text-xs leading-relaxed text-amber-200/90">
              <strong className="text-zinc-100">Vantagem é de carbono, não necessariamente de preço.</strong> A
              tarifa industrial do Ceará está 2,0% acima da média nacional (R$ 779,4/MWh, CNI -- Perfil da Indústria
              nos Estados, 2021) -- o argumento de powershoring não é "eletricidade brasileira é barata", é
              "eletricidade brasileira é limpa", o que pesa em exposição ao CBAM europeu e em contratos de PPA
              renovável dedicados, não no preço de tarifa genérica.
            </p>
          </div>
        </section>

        {chainSynthesis.length ? (
          <section className="mt-8 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 shadow-xl backdrop-blur-xl sm:p-7">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
              Como cada cadeia sustenta a tese, lado a lado
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-500">
              Mesmos números que já aparecem no painel "Powershoring & regulação" de cada cadeia -- reunidos aqui
              para comparação direta, antes do detalhe insumo a insumo abaixo.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08]">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-zinc-950/60">
                    <th className="px-3 py-2 text-left font-mono font-medium uppercase tracking-wide text-zinc-500">Cadeia</th>
                    <th className="px-3 py-2 text-left font-mono font-medium uppercase tracking-wide text-zinc-500">Vetores mapeados</th>
                    <th className="px-3 py-2 text-left font-mono font-medium uppercase tracking-wide text-zinc-500">Assimetria de valor</th>
                    <th className="px-3 py-2 text-left font-mono font-medium uppercase tracking-wide text-zinc-500">Alavanca regulatória</th>
                    <th className="px-3 py-2 text-left font-mono font-medium uppercase tracking-wide text-zinc-500">Ainda fóssil/transição na pauta</th>
                  </tr>
                </thead>
                <tbody>
                  {chainSynthesis.map((row) => {
                    const meta = CHAIN_META[row.chain];
                    return (
                      <tr key={row.chain} className="border-b border-white/[0.04] last:border-0">
                        <td className="px-3 py-2">
                          <span
                            className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                            style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}1A`, color: meta.color }}
                          >
                            {meta.shortLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-white">{row.vectorCount}</td>
                        <td className="px-3 py-2 text-zinc-300">
                          {row.valueAsymmetry
                            ? `${row.valueAsymmetry.ratio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`
                            : <span className="text-zinc-600">--</span>}
                        </td>
                        <td className="px-3 py-2">
                          {row.regulatoryLever.hasRegime ? (
                            <span className="text-zinc-300">{row.regulatoryLever.regime}</span>
                          ) : (
                            <span className="text-zinc-600">{row.regulatoryLever.regime}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-zinc-300">
                          {row.nonLowCarbonShare !== undefined ? percent.format(row.nonLowCarbonShare) : <span className="text-zinc-600">--</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {isInitialLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-72 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/60" />
            <div className="h-72 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/60" />
          </div>
        ) : groups.length ? (
          MONITORED_CHAINS.map((chain) => {
            const chainGroups = groupsByChain.get(chain) ?? [];
            if (!chainGroups.length) return null;
            const meta = CHAIN_META[chain];
            return (
              <section key={chain} className="mt-10">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">{meta.label}</h2>
                  <span className="text-xs text-zinc-500">
                    {chainGroups.length} vetor{chainGroups.length === 1 ? "" : "es"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {chainGroups.map((group) => (
                    <PowershoringCard key={group.key} group={group} inputLabelById={inputLabelById} />
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <p className="mt-8 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 text-sm text-zinc-300">
            Nenhum insumo das cadeias carregadas está classificado como vetor de powershoring no momento.
          </p>
        )}

        {auditRows.length ? (
          <details className="group mt-12 rounded-2xl border border-white/[0.08] bg-zinc-900/30 shadow-xl backdrop-blur-xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 transition hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-sm font-bold uppercase tracking-wider text-zinc-300">
                  Apêndice -- todos os insumos auditados, cadeia a cadeia
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                  Classificação de rota e leitura de powershoring de cada insumo publicado nas {loadedChainsCount}{" "}
                  cadeia{loadedChainsCount === 1 ? "" : "s"} carregada{loadedChainsCount === 1 ? "" : "s"}, incluindo
                  os que não são vetor -- referência de auditoria, não leitura principal.
                </span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="border-t border-white/[0.07] p-4 sm:p-5">
              <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-zinc-950/60">
                      <th className="px-3 py-2 text-left font-mono font-medium uppercase tracking-wide text-zinc-500">Insumo</th>
                      <th className="px-3 py-2 text-left font-mono font-medium uppercase tracking-wide text-zinc-500">Cadeia</th>
                      <th className="px-3 py-2 text-left font-mono font-medium uppercase tracking-wide text-zinc-500">Rota (dado)</th>
                      <th className="px-3 py-2 text-left font-mono font-medium uppercase tracking-wide text-zinc-500">Vetor de powershoring</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.map(({ chain, input }) => {
                      const isFlagged = Boolean(input.strategic_profile?.is_powershoring_vector);
                      const routeColor = ROUTE_CLASS_COLORS[input.production_route_class];
                      return (
                        <tr key={`${chain}-${input.input_id}`} className="border-b border-white/[0.04] last:border-0">
                          <td className={`px-3 py-2 ${isFlagged ? "font-semibold text-white" : "text-zinc-300"}`}>{input.label}</td>
                          <td className="px-3 py-2 text-zinc-400">{CHAIN_META[chain].shortLabel}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5 text-zinc-400">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: routeColor }} />
                              {ROUTE_CLASS_LABELS[input.production_route_class]}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {isFlagged ? (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Sim
                              </span>
                            ) : (
                              <span className="text-zinc-600">--</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        ) : null}

        <p className="mt-8 text-[11px] leading-relaxed text-zinc-500">
          Metodologia: um insumo entra nesta página quando seu <code className="text-zinc-400">strategic_profile.is_powershoring_vector</code>{" "}
          é verdadeiro na base publicada da cadeia -- classificação decorrente de rota produtiva de baixo carbono
          verificável, dissociada da leitura de risco/dependência (matriz NIB) exibida no painel principal. Cards que
          somam a mesma base comercial (NCM) em mais de uma cadeia aparecem uma única vez, na cadeia que consta
          primeiro na lista de cadeias monitoradas. Fonte de cada tese e de cada indicador territorial citada dentro
          do respectivo card.
        </p>
      </div>
    </div>
  );
}

function PowershoringCard({
  group,
  inputLabelById,
}: {
  group: FlaggedGroup;
  inputLabelById: Map<string, string>;
}) {
  const primary = group.entries[0].input;
  const isShared = group.entries.length > 1;
  const links = Array.from(
    new Set(group.entries.flatMap(({ input }) => input.strategic_profile?.value_chain_links ?? [])),
  );

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {group.entries.map(({ chain }) => {
            const meta = CHAIN_META[chain];
            return (
              <span
                key={chain}
                className="rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
                style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}1A`, color: meta.color }}
              >
                {meta.shortLabel}
              </span>
            );
          })}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{primary.stage}</span>
      </div>

      <h2 className="text-xl font-bold leading-snug text-white">{primary.label}</h2>

      {isShared ? (
        <p className="-mt-2 text-[11px] leading-relaxed text-amber-200/80">
          Mesma base comercial (NCM) contada nas {group.entries.length} cadeias acima -- os números abaixo não se
          somam em dobro.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <TradeStat label="Importações" value={usdCompact.format(primary.imports_value_usd)} />
        <TradeStat label="Exportações" value={usdCompact.format(primary.exports_value_usd)} />
        <TradeStat
          label="Saldo"
          value={usdCompact.format(primary.trade_balance_usd)}
          tone={primary.trade_balance_usd >= 0 ? "success" : "warning"}
        />
      </div>

      {links.length ? (
        <div className="flex flex-wrap gap-1.5">
          {links.map((linkId) => (
            <span
              key={linkId}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-zinc-300"
            >
              {inputLabelById.get(linkId) ?? linkId}
            </span>
          ))}
        </div>
      ) : null}

      {/* Thesis paragraphs collapsed by default -- same content already lives,
          fully expanded, inside each chain's own NIB Matrix / Dados primários
          panels (StrategicVectorBadge). Here it's supporting detail behind
          the trade stats above, not the first thing to read. */}
      <details className="group/thesis rounded-md border border-emerald-500/20 bg-emerald-950/10">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-300 [&::-webkit-details-marker]:hidden">
          <span aria-hidden>⚡</span>
          Ver tese estratégica{isShared ? ` (${group.entries.length} leituras)` : ""}
          <ChevronDown className="ml-auto h-3.5 w-3.5 transition group-open/thesis:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-emerald-500/10 px-3 pb-3 pt-2">
          {group.entries.map(({ chain, input }) => (
            <div key={chain}>
              {isShared ? (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {CHAIN_META[chain].shortLabel}
                </p>
              ) : null}
              <StrategicVectorBadge profile={input.strategic_profile} />
            </div>
          ))}
        </div>
      </details>

      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5">
        {group.entries.map(({ chain }) => (
          <Link
            key={chain}
            href={`/?chain=${chain}#tour-powershoring`}
            className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-emerald-300 transition hover:text-emerald-200"
          >
            Ver cadeia {CHAIN_META[chain].shortLabel} completa
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>
    </article>
  );
}

function TradeStat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const toneClass = tone === "success" ? "text-emerald-300" : tone === "warning" ? "text-amber-300" : "text-zinc-200";
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-950/50 px-2.5 py-2">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      <span className={`font-mono text-sm font-bold ${toneClass}`}>{value}</span>
    </div>
  );
}

export default PowershoringShowcase;
