"use client";

import { AlertTriangle, BadgeAlert, ChevronDown, Download } from "lucide-react";
import type { ProdutoConceitual } from "../types/border-value";

type TechnicalDrawerProps = {
  data: ProdutoConceitual[];
  className?: string;
};

const glass =
  "border border-white/[0.08] bg-zinc-900/40 shadow-2xl shadow-black/25 backdrop-blur-xl";

export function TechnicalDrawer({ data, className = "" }: TechnicalDrawerProps) {
  const referenceYears = Array.from(new Set(data.map((product) => product.auditoria.reference_year))).sort(
    (left, right) => right - left,
  );
  const methodologies = Array.from(new Set(data.map((product) => product.auditoria.metodologia_versao))).sort();
  const alerts = getMethodologicalAlerts(data);

  return (
    <section id="technical-traceability" className={`scroll-mt-8 pb-8 ${className}`}>
      <details className={`group rounded-lg ${glass}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Rastreabilidade e Detalhe Técnico
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-white">
              Cruzamentos NCM, CNAE, PRODLIST e alertas metodológicos
            </h2>
          </div>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-zinc-400 transition group-open:rotate-180"
            strokeWidth={1.7}
          />
        </summary>

        <div className="border-t border-white/[0.08] px-4 pb-5 pt-4 sm:px-5">
          <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-3 text-sm text-zinc-300 sm:grid-cols-3">
              <TraceabilitySummary label="Produtos rastreados" value={String(data.length)} />
              <TraceabilitySummary label="Anos de referência" value={referenceYears.join(", ")} />
              <TraceabilitySummary label="Metodologias" value={String(methodologies.length)} />
            </div>
            <FakeCsvButton />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="overflow-hidden rounded-lg border border-white/[0.08]">
              <div className="max-h-[440px] overflow-auto">
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-zinc-950/95 text-zinc-400 backdrop-blur-xl">
                    <tr>
                      <AuditHeader>Produto</AuditHeader>
                      <AuditHeader>NCM</AuditHeader>
                      <AuditHeader>CNAE</AuditHeader>
                      <AuditHeader>PRODLIST</AuditHeader>
                      <AuditHeader>Importação FOB</AuditHeader>
                      <AuditHeader>Déficit</AuditHeader>
                      <AuditHeader>Alpha</AuditHeader>
                      <AuditHeader>Sigilo</AuditHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] bg-zinc-950/30">
                    {data.map((product) => (
                      <tr key={product.conceptual_product_id} className="align-top">
                        <AuditCell className="min-w-56 font-semibold text-zinc-100">
                          {product.produto_nome}
                        </AuditCell>
                        <AuditCell>{product.ncm_codigo || "N/D"}</AuditCell>
                        <AuditCell>{product.industria.cnae_codigo || "N/D"}</AuditCell>
                        <AuditCell>{product.industria.prodlist_codigo || "N/D"}</AuditCell>
                        <AuditCell>{formatUsd(product.comercio.importacao_valor_fob)}</AuditCell>
                        <AuditCell>{formatUsd(product.comercio.deficit_comercial)}</AuditCell>
                        <AuditCell>{formatPercent(product.fator_proporcionalidade.fator_alpha)}</AuditCell>
                        <AuditCell>
                          {product.auditoria.has_sigilo_pia ? <SigiloBadge /> : <span className="text-zinc-500">Aberto</span>}
                        </AuditCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <section className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.7} />
                  Alertas metodológicos
                </p>
                <div className="mt-3 space-y-2">
                  {alerts.length ? (
                    alerts.map((alert) => (
                      <p key={alert} className="rounded-md border border-amber-300/15 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-50/85">
                        {alert}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-zinc-400">
                      Nenhum alerta metodológico adicional para o recorte carregado.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Fontes e versões
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                  {methodologies.map((methodology) => (
                    <span key={methodology} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
                      {methodology}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

function FakeCsvButton() {
  return (
    <button
      type="button"
      onClick={() => undefined}
      className="inline-flex w-fit items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    >
      <Download className="h-3.5 w-3.5" strokeWidth={1.7} />
      Exportar dados consolidados (CSV)
    </button>
  );
}

function TraceabilitySummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-100">{value || "N/D"}</p>
    </div>
  );
}

function AuditHeader({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-3 font-semibold">{children}</th>;
}

function AuditCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-3 text-zinc-300 ${className}`}>{children}</td>;
}

function SigiloBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/25 bg-amber-400/10 px-2 py-1 font-semibold text-amber-200">
      <BadgeAlert className="h-3.5 w-3.5" strokeWidth={1.7} />
      PIA
    </span>
  );
}

function getMethodologicalAlerts(data: ProdutoConceitual[]) {
  const alerts = new Set<string>();

  if (data.some((product) => product.auditoria.has_sigilo_pia)) {
    alerts.add("Há registros com sigilo estatístico PIA; valores industriais devem ser lidos como proxy de rastreabilidade.");
  }

  if (data.some((product) => product.auditoria.is_ncm_generica)) {
    alerts.add("Há códigos NCM genéricos ou residuais no recorte, o que reduz a granularidade da ponte produto-indústria.");
  }

  if (data.some((product) => product.fator_proporcionalidade.aplicado || product.fator_proporcionalidade.fator_alpha < 1)) {
    alerts.add("Parte dos fluxos usa fator de proporcionalidade Alpha informado pelo backend para isolar o uso final relevante.");
  }

  if (data.some((product) => product.auditoria.confidence_level === "baixa")) {
    alerts.add("Há produtos com confiança baixa; recomenda-se validar os cruzamentos antes de decisão operacional.");
  }

  return Array.from(alerts);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export default TechnicalDrawer;
