"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MainAnalyticalDashboard = dynamic(
  () => import("../../components/MainAnalyticalDashboard"),
  { ssr: false, loading: () => <PanelSkeleton tall /> },
);

const SovereigntyTour = dynamic(
  () => import("../../components/SovereigntyTour").then((mod) => mod.default),
  { ssr: false },
);

// Onboarding guiado, cadeia aço e materiais estratégicos por enquanto --
// generalizar para outras cadeias é trabalho futuro, feito uma vez que este
// roteiro esteja validado em produção.
const TOUR_CHAIN = "aco";

// useSearchParams() opts the page into client-side rendering and requires
// its own Suspense boundary (https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout)
// -- isolated here so it doesn't force the whole page through the fallback.
function EnsureTourChain() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("chain") !== TOUR_CHAIN) {
      router.replace(`${pathname}?chain=${TOUR_CHAIN}`);
    }
  }, [pathname, router, searchParams]);

  return null;
}

export default function TourSoberaniaPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Suspense fallback={null}>
        <EnsureTourChain />
      </Suspense>
      <div className="px-4 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col gap-5 border-b border-zinc-800/70 pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Modo guiado / onboarding
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Onboarding de soberania produtiva
              </h1>
              <p className="mt-4 text-sm leading-6 text-zinc-400 sm:text-base">
                Jornada guiada pela cadeia de Aço e Materiais Estratégicos: espinha dorsal
                produtiva, concentração de fornecedores (HHI), balanço de massa e energia,
                matriz NIB e empregos verdes.
              </p>
            </div>

            <SovereigntyTour defaultOpen className="w-fit" />
          </header>
        </div>
      </div>

      <MainAnalyticalDashboard />
    </div>
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
