"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";

type StepStatus = "pending" | "running" | "success" | "error" | "skipped";

type Step = {
  name: string;
  status: StepStatus;
  log_tail: string | null;
};

type JobState = {
  status: "idle" | "running" | "success" | "error";
  started_at: string | null;
  finished_at: string | null;
  steps: Step[];
  error: string | null;
};

const STEP_LABELS: Record<StepStatus, string> = {
  pending: "Aguardando",
  running: "Executando...",
  success: "Concluido",
  error: "Falhou",
  skipped: "Pulado",
};

const STEP_COLORS: Record<StepStatus, string> = {
  pending: "text-zinc-500",
  running: "text-amber-400",
  success: "text-emerald-400",
  error: "text-red-400",
  skipped: "text-zinc-600",
};

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((res) => res.json());

export default function AdminPage() {
  const router = useRouter();
  const { data, mutate } = useSWR<JobState>("/api/admin/status", fetcher, {
    refreshInterval: (latest) => (latest?.status === "running" ? 2000 : 0),
  });

  const running = data?.status === "running";

  async function handleRefreshClick() {
    await fetch("/api/admin/refresh", { method: "POST" });
    mutate();
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Painel Admin - Border Value</h1>
          <button onClick={handleLogout} className="text-sm text-zinc-400 hover:text-zinc-200">
            Sair
          </button>
        </div>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-zinc-100">Atualizacao de dados publicados</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Roda Comex/PRODLIST/PIA, producao industrial, ANM e as 4 cadeias prioritarias, e
                aplica no banco. RAIS continua manual (ver docs/DEPLOY.md).
              </p>
            </div>
            <button
              onClick={handleRefreshClick}
              disabled={running}
              className="whitespace-nowrap rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? "Atualizando..." : "Atualizar agora"}
            </button>
          </div>

          {data?.finished_at && (
            <p className="mb-3 text-xs text-zinc-500">
              Ultima execucao: {new Date(data.finished_at).toLocaleString("pt-BR")} -{" "}
              <span className={data.status === "success" ? "text-emerald-400" : "text-red-400"}>
                {data.status === "success" ? "sucesso" : "erro"}
              </span>
            </p>
          )}

          {data?.error && (
            <p className="mb-3 rounded border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300">
              {data.error}
            </p>
          )}

          {data && data.steps.length > 0 && (
            <ol className="space-y-1.5">
              {data.steps.map((step) => (
                <li key={step.name} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{step.name}</span>
                  <span className={STEP_COLORS[step.status]}>{STEP_LABELS[step.status]}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
