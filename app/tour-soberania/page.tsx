"use client";

import dynamic from "next/dynamic";

const ChainDashboard = dynamic(
  () => import("../../components/ChainDashboard").then((mod) => mod.ChainDashboard),
  { ssr: false, loading: () => <PanelSkeleton tall /> },
);

const SovereigntyTour = dynamic(
  () => import("../../components/SovereigntyTour").then((mod) => mod.default),
  { ssr: false },
);

export default function TourSoberaniaPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-5 border-b border-zinc-800/70 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Modo guiado / onboarding
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Onboarding de soberania produtiva
            </h1>
            <p className="mt-4 text-sm leading-6 text-zinc-400 sm:text-base">
              Jornada orientada para o onboarding técnico com foco em matriz NIB,
              concentração HHI, proporcionalidade RenovaCalc e grafo AIPNET.
            </p>
          </div>

          <SovereigntyTour defaultOpen className="w-fit" />
        </header>

        <ChainDashboard chainName="combustiveis_transicao" defaultAlphaEnabled />
      </div>
    </main>
  );
}

function PanelSkeleton({ compact = false, tall = false }: { compact?: boolean; tall?: boolean }) {
  const height = compact ? "h-72" : tall ? "h-[640px]" : "h-[520px]";

  return (
    <div
      className={`${height} animate-pulse rounded-lg border border-zinc-800/70 bg-zinc-900/60 shadow-2xl shadow-black/30`}
    />
  );
}
