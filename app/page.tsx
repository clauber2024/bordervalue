import { Suspense } from "react";
import MainAnalyticalDashboard from "../components/MainAnalyticalDashboard";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-zinc-950" />}>
      <MainAnalyticalDashboard />
    </Suspense>
  );
}
