"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, Factory, Layers3, Sparkles, Zap } from "lucide-react";
import { StrategicVectorBadge } from "./StrategicVectorBadge";
import { ROUTE_CLASS_COLORS, ROUTE_CLASS_LABELS } from "./SovereigntySankeyChart";
import { useSolarSovereignty } from "../hooks/useSolarSovereignty";
import { CHAIN_META, MONITORED_CHAINS, type MonitoredChain } from "../lib/transversalMatrix";
import type { SolarInputMetric } from "../types/solar-sovereignty";

const usdCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

type FlaggedInput = { chain: MonitoredChain; input: SolarInputMetric };

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

  const chainsRepresented = new Set(flagged.map((item) => item.chain)).size;
  const linksCount = new Set(flagged.flatMap((item) => item.input.strategic_profile?.value_chain_links ?? [])).size;

  // Every insumo across the 4 chains, flagged or not -- so the 14 cards above
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
                <p className="font-mono text-lg font-extrabold text-zinc-100">{flagged.length}</p>
                <p className="text-[11px] text-zinc-400">
                  {loadedChainsCount}/{MONITORED_CHAINS.length} cadeias carregadas
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

        {isInitialLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-72 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/60" />
            <div className="h-72 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/60" />
          </div>
        ) : flagged.length ? (
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {flagged.map(({ chain, input }) => (
              <PowershoringCard
                key={`${chain}-${input.input_id}`}
                chain={chain}
                input={input}
                inputLabelById={inputLabelById}
              />
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 text-sm text-zinc-300">
            Nenhum insumo das cadeias carregadas está classificado como vetor de powershoring no momento.
          </p>
        )}

        {auditRows.length ? (
          <section className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
              Apêndice -- todos os insumos auditados, cadeia a cadeia
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-500">
              Classificação de rota (<code className="text-zinc-400">production_route_class</code>) e leitura de
              powershoring de cada insumo publicado nas {loadedChainsCount} cadeia
              {loadedChainsCount === 1 ? "" : "s"} carregada{loadedChainsCount === 1 ? "" : "s"}, incluindo os que
              não são vetor -- calculado ao vivo a partir do mesmo dado dos cards acima, não uma lista fixa.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08]">
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
          </section>
        ) : null}

        <p className="mt-8 text-[11px] leading-relaxed text-zinc-500">
          Metodologia: um insumo entra nesta página quando seu <code className="text-zinc-400">strategic_profile.is_powershoring_vector</code>{" "}
          é verdadeiro na base publicada da cadeia -- classificação decorrente de rota produtiva de baixo carbono
          verificável, dissociada da leitura de risco/dependência (matriz NIB) exibida no painel principal. Fonte de
          cada tese e de cada indicador territorial citada dentro do respectivo card.
        </p>
      </div>
    </div>
  );
}

function PowershoringCard({
  chain,
  input,
  inputLabelById,
}: {
  chain: MonitoredChain;
  input: SolarInputMetric;
  inputLabelById: Map<string, string>;
}) {
  const meta = CHAIN_META[chain];
  const links = input.strategic_profile?.value_chain_links ?? [];

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}1A`, color: meta.color }}
        >
          {meta.shortLabel}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{input.stage}</span>
      </div>

      <h2 className="text-xl font-bold leading-snug text-white">{input.label}</h2>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <TradeStat label="Importações" value={usdCompact.format(input.imports_value_usd)} />
        <TradeStat label="Exportações" value={usdCompact.format(input.exports_value_usd)} />
        <TradeStat
          label="Saldo"
          value={usdCompact.format(input.trade_balance_usd)}
          tone={input.trade_balance_usd >= 0 ? "success" : "warning"}
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

      <StrategicVectorBadge profile={input.strategic_profile} />

      <Link
        href={`/?chain=${chain}`}
        className="mt-auto inline-flex w-fit items-center gap-1 text-xs font-semibold text-emerald-300 transition hover:text-emerald-200"
      >
        Ver cadeia {meta.shortLabel} completa
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
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
