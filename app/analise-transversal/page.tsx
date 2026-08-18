"use client";

import dynamic from "next/dynamic";

const TransversalDashboard = dynamic(
  () => import("../../components/TransversalDashboard").then((mod) => mod.TransversalDashboard),
  { ssr: false, loading: () => <PageSkeleton /> },
);

export default function AnaliseTransversalPage() {
  return <TransversalDashboard />;
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="h-64 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/60" />
        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="h-[520px] animate-pulse rounded-lg border border-zinc-800/70 bg-zinc-900/60" />
          <div className="h-[520px] animate-pulse rounded-lg border border-zinc-800/70 bg-zinc-900/60" />
        </div>
      </div>
    </div>
  );
}
