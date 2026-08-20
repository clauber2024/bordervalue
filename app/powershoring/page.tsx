"use client";

import dynamic from "next/dynamic";

const PowershoringShowcase = dynamic(
  () => import("../../components/PowershoringShowcase").then((mod) => mod.default),
  { ssr: false, loading: () => <PageSkeleton /> },
);

export default function PowershoringPage() {
  return <PowershoringShowcase />;
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="h-64 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/60" />
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/60" />
          <div className="h-72 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-900/60" />
        </div>
      </div>
    </div>
  );
}
