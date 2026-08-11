"use client";

import { useState } from "react";
import { AlertTriangle, BadgeAlert, ChevronDown, Download } from "lucide-react";
import type { ProdutoConceitual } from "../types/border-value";
import type { SolarInputMetric } from "../types/solar-sovereignty";

type TechnicalDrawerProps = {
  data: ProdutoConceitual[];
  solarInputs?: SolarInputMetric[];
  solarMethodologyVersion?: string;
  className?: string;
};

const glass =
  "border border-white/[0.08] bg-zinc-900/40 shadow-2xl shadow-black/25 backdrop-blur-xl";

export function TechnicalDrawer({ data, solarInputs, solarMethodologyVersion, className = "" }: TechnicalDrawerProps) {
  const hasCrosswalk = Boolean(solarInputs?.length);
  const [activeTab, setActiveTab] = useState<"dicionario" | "comercio">("dicionario");

  const referenceYears = Array.from(new Set(data.map((product) => product.auditoria.reference_year))).sort(
    (left, right) => right - left,
  );
  const methodologies = Array.from(new Set(data.map((product) => product.auditoria.metodologia_versao))).sort();
  const alerts = getMethodologicalAlerts(data);
  const genericNcmCount = data.filter(
    (product) => product.auditoria.ncm_mapping_status === "pendente" || isResidualCode(product.ncm_codigo),
  ).length;

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
              <TraceabilitySummary
                label="Metodologia ativa"
                value={methodologies.join(", ") || "N/D"}
                hint="Versão do motor analítico aplicada ao recorte comercial e industrial"
              />
            </div>
            <CsvButton data={data} />
          </div>

          <div className="space-y-4">
            {hasCrosswalk ? (
              <div className="flex flex-wrap gap-2">
                <DrawerTabButton active={activeTab === "dicionario"} onClick={() => setActiveTab("dicionario")}>
                  Dicionário de insumos &amp; limitações metodológicas
                </DrawerTabButton>
                <DrawerTabButton active={activeTab === "comercio"} onClick={() => setActiveTab("comercio")}>
                  Matriz de comércio exterior (valores FOB)
                </DrawerTabButton>
              </div>
            ) : null}

            {(!hasCrosswalk || activeTab === "dicionario") && solarInputs?.length ? (
              <SolarInputCrosswalk inputs={solarInputs} methodologyVersion={solarMethodologyVersion} />
            ) : null}

            {!hasCrosswalk || activeTab === "comercio" ? (
              <TradeMatrixTable data={data} referenceYears={referenceYears} />
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
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
                {genericNcmCount > 0 ? (
                  <GenericNcmMethodologicalNote affected={genericNcmCount} total={data.length} />
                ) : null}
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

function GenericNcmMethodologicalNote({ affected, total }: { affected: number; total: number }) {
  return (
    <div className="mt-4 border-t border-amber-300/15 pt-4 text-xs">
      <p className="font-bold uppercase tracking-[0.14em] text-amber-200">
        Nota metodológica — NCM não homologado
      </p>
      <div className="mt-3 grid gap-3 text-zinc-400 sm:grid-cols-2">
        <MethodNoteItem
          title="O que significa"
          body={`${affected} de ${total} produtos usam código residual, genérico ou marcador interno. O valor 00000000 não representa uma posição oficial da NCM.`}
        />
        <MethodNoteItem
          title="O que permanece válido"
          body="Importações, exportações, saldo FOB e origens podem ser lidos no nível agregado do produto conceitual, conforme o recorte publicado pela camada comercial."
        />
        <MethodNoteItem
          title="O que não pode ser concluído"
          body="Não é possível atribuir com precisão tarifa, produto NCM específico ou correspondência produtiva CNAE/PRODLIST usando esse marcador residual."
        />
        <MethodNoteItem
          title="Como resolver"
          body="Homologar a cesta de NCMs que compõe cada produto conceitual, registrar vigência e versão do cruzamento e então recalcular a ponte produto–indústria."
        />
      </div>
    </div>
  );
}

function DrawerTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
          : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function TradeMatrixTable({ data, referenceYears }: { data: ProdutoConceitual[]; referenceYears: number[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-emerald-300/15 bg-emerald-400/[0.025]">
      <div className="border-b border-white/[0.08] px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
          Matriz consolidada de comércio exterior (valores FOB)
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          Resultado numérico aplicado às NCMs de cada produto conceitual — importação FOB, déficit comercial,
          fator de proporcionalidade e sigilo estatístico
          {referenceYears.length ? ` (${referenceYears.join(", ")})` : null}.
        </p>
      </div>

      <div className="max-h-[440px] overflow-y-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-zinc-950/95 text-zinc-400 backdrop-blur-xl">
            <tr>
              <AuditHeader>Produto</AuditHeader>
              <AuditHeader>NCM</AuditHeader>
              <AuditHeader>Status da cesta</AuditHeader>
              <AuditHeader>CNAE</AuditHeader>
              <AuditHeader>PRODLIST</AuditHeader>
              <AuditHeader>Importação FOB</AuditHeader>
              <AuditHeader>Déficit</AuditHeader>
              <AuditHeader>Fator alfa</AuditHeader>
              <AuditHeader>Sigilo</AuditHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06] bg-zinc-950/30">
            {data.map((product) => (
              <tr key={product.conceptual_product_id} className="align-top">
                <AuditCell className="min-w-56 font-semibold text-zinc-100">
                  {product.produto_nome}
                </AuditCell>
                <AuditCell>
                  {isResidualCode(product.ncm_codigo)
                    ? <UnvalidatedCode />
                    : <CodeList codes={product.ncm_codigos?.length ? product.ncm_codigos : [product.ncm_codigo]} />}
                </AuditCell>
                <AuditCell><MappingStatus product={product} /></AuditCell>
                <AuditCell>{product.industria.cnae_codigo || "N/D"}</AuditCell>
                <AuditCell>
                  <CodeList codes={product.industria.prodlist_codigos?.length
                    ? product.industria.prodlist_codigos
                    : [product.industria.prodlist_codigo].filter(Boolean)} />
                </AuditCell>
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
    </section>
  );
}

function SolarInputCrosswalk({
  inputs,
  methodologyVersion,
}: {
  inputs: SolarInputMetric[];
  methodologyVersion?: string;
}) {
  const ordered = [...inputs].sort((left, right) =>
    `${left.stage}-${left.label}`.localeCompare(`${right.stage}-${right.label}`, "pt-BR"),
  );

  return (
    <section className="overflow-hidden rounded-lg border border-cyan-300/15 bg-cyan-400/[0.025]">
      <div className="border-b border-white/[0.08] px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
          Cesta AIPNET por insumo
        </p>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <p className="text-sm text-zinc-300">
            {inputs.length} insumos com cesta comercial publicada, incluindo mapeamentos validados e proxies.
          </p>
          {methodologyVersion ? <span className="text-[11px] text-zinc-500">Versão {methodologyVersion}</span> : null}
        </div>
      </div>

      <div className="max-h-[560px] overflow-y-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-950/95 text-zinc-400 backdrop-blur-xl">
            <tr>
              <AuditHeader>Insumo</AuditHeader>
              <AuditHeader>Etapa</AuditHeader>
              <AuditHeader>NCMs da cesta</AuditHeader>
              <AuditHeader>PRODLIST</AuditHeader>
              <AuditHeader>Classificação</AuditHeader>
              <AuditHeader>Limitação</AuditHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06] bg-zinc-950/25">
            {ordered.map((input) => (
              <tr key={input.input_id} className="align-top">
                <AuditCell className="min-w-48 font-semibold text-zinc-100">{input.label}</AuditCell>
                <AuditCell><span className="whitespace-nowrap">{technicalStageLabel(input.stage)}</span></AuditCell>
                <AuditCell><CodeList codes={input.ncm_codes} /></AuditCell>
                <AuditCell><CodeList codes={(input.prodlist_codes ?? []).filter((code) => code !== "NCM_SEM_PONTE")} /></AuditCell>
                <AuditCell><SolarMappingBadge input={input} /></AuditCell>
                <AuditCell className="min-w-64 leading-5 text-zinc-400">
                  {input.data_gap_reason ?? "Cesta específica validada para o recorte comercial publicado."}
                </AuditCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-white/[0.08] px-4 py-3 text-[11px] leading-5 text-zinc-500">
        Insumos estruturais sem classificação comercial exclusiva — como energia elétrica industrial e redutores — permanecem como fonte complementar e não recebem NCM artificial.
      </p>
    </section>
  );
}

function SolarMappingBadge({ input }: { input: SolarInputMetric }) {
  const isValidated = input.measurement_method === "validated";
  return (
    <div className="min-w-24">
      <span className={`inline-flex rounded-md border px-2 py-1 font-semibold ${isValidated
        ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
        : "border-amber-300/20 bg-amber-400/10 text-amber-200"}`}>
        {isValidated ? "Validada" : "Proxy"}
      </span>
      <p className="mt-1 text-[10px] text-zinc-500">Confiança {technicalConfidenceLabel(input.confidence_level)}</p>
    </div>
  );
}

function technicalStageLabel(stage: string) {
  return ({
    extracao: "Base mineral",
    processamento: "Silício metalúrgico",
    refinamento: "Refino solar",
    componentes_avancados: "Lingotes e wafers",
    produto_final: "Células e módulos",
    molecula_principal: "Moléculas energéticas",
    derivados: "Derivados de baixo carbono",
    aplicacoes_finais: "Aplicações finais",
    insumos_tecnologicos: "Insumos tecnológicos",
    materias_primas: "Matérias-primas",
    intermediarios: "Intermediários",
    nitrogenados: "Fertilizantes nitrogenados",
    fosfatados: "Fertilizantes fosfatados",
    potassicos: "Fertilizantes potássicos",
    formulacao: "Formulação",
    insumos: "Insumos",
    conversao: "Conversão",
    biocombustiveis: "Biocombustíveis",
    hidrogenio: "Hidrogênio",
    equipamentos: "Produção de hidrogênio renovável",
    base_mineral: "Base mineral",
    reducao: "Redução",
    aciaria: "Aciaria e ligas",
    transformacao: "Transformação siderúrgica",
    bens_transicao: "Bens da transição",
  } as Record<string, string>)[stage] ?? humanizeTechnicalLabel(stage);
}

function technicalConfidenceLabel(level: SolarInputMetric["confidence_level"]) {
  return ({ alta: "alta", media: "média", baixa: "baixa" } as const)[level];
}

function humanizeTechnicalLabel(value: string) {
  const words = value.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toLocaleUpperCase("pt-BR") + words.slice(1) : "Não informado";
}

function CodeList({ codes }: { codes: string[] }) {
  if (!codes.length || codes.every(isResidualCode)) return <span className="text-zinc-500">N/D</span>;
  return (
    <div className="flex min-w-28 flex-wrap gap-1">
      {codes.filter((code) => !isResidualCode(code)).map((code) => (
        <span key={code} className="whitespace-nowrap rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
          {code}
        </span>
      ))}
    </div>
  );
}

function MappingStatus({ product }: { product: ProdutoConceitual }) {
  const status = product.auditoria.ncm_mapping_status ?? (isResidualCode(product.ncm_codigo) ? "pendente" : "validada");
  const styles = {
    validada: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
    proxy: "border-amber-300/20 bg-amber-400/10 text-amber-200",
    pendente: "border-zinc-600/40 bg-zinc-700/20 text-zinc-300",
  };
  const labels = { validada: "Validada", proxy: "Proxy", pendente: "Pendente" };

  return (
    <div className="min-w-28">
      <span className={`inline-flex rounded-md border px-2 py-1 font-semibold ${styles[status]}`}>
        {labels[status]}
      </span>
      {product.auditoria.ncm_mapping_version ? (
        <p className="mt-1 text-[10px] leading-4 text-zinc-500">{product.auditoria.ncm_mapping_version}</p>
      ) : null}
      {product.auditoria.ncm_mapping_note ? (
        <p className="mt-1 max-w-52 text-[10px] leading-4 text-zinc-500">{product.auditoria.ncm_mapping_note}</p>
      ) : null}
    </div>
  );
}

function MethodNoteItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-white/[0.07] bg-zinc-950/45 px-3 py-3">
      <p className="font-semibold text-zinc-200">{title}</p>
      <p className="mt-1 leading-5">{body}</p>
    </div>
  );
}

function CsvButton({ data }: { data: ProdutoConceitual[] }) {
  const downloadCsv = () => {
    const header = ["Produto", "NCM", "CNAE", "PRODLIST", "Importacao FOB", "Deficit", "Alpha", "Sigilo PIA"];
    const rows = data.map((product) => [
      product.produto_nome,
      isResidualCode(product.ncm_codigo) ? "Nao homologado" : (product.ncm_codigos?.join("|") ?? product.ncm_codigo),
      product.industria.cnae_codigo,
      product.industria.prodlist_codigos?.join("|") ?? product.industria.prodlist_codigo,
      product.comercio.importacao_valor_fob,
      product.comercio.deficit_comercial,
      product.fator_proporcionalidade.fator_alpha,
      product.auditoria.has_sigilo_pia ? "Sim" : "Nao",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "border-value-rastreabilidade.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={downloadCsv}
      className="inline-flex w-fit items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    >
      <Download className="h-3.5 w-3.5" strokeWidth={1.7} />
      Exportar dados consolidados (CSV)
    </button>
  );
}

function UnvalidatedCode() {
  return (
    <span className="inline-flex whitespace-nowrap rounded-md border border-amber-300/20 bg-amber-400/10 px-2 py-1 font-semibold text-amber-200">
      Não homologado
    </span>
  );
}

function isResidualCode(value: string | null | undefined) {
  if (!value) return true;
  const normalized = value.replace(/\D/g, "");
  return !normalized || /^0+$/.test(normalized);
}

function TraceabilitySummary({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-100">{value || "N/D"}</p>
      {hint ? <p className="mt-1 text-[11px] leading-4 text-zinc-500">{hint}</p> : null}
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
    alerts.add("Há cestas classificadas como proxy: seus NCMs são oficiais, mas abrangem usos além da cadeia analisada e não devem ser interpretados como destinação exclusiva.");
  }

  if (data.some((product) => isResidualCode(product.ncm_codigo))) {
    alerts.add("Há códigos NCM residuais ainda sem cesta homologada, o que impede a ponte precisa entre produto e indústria.");
  }

  if (data.some((product) => product.fator_proporcionalidade.fator_alpha < 1)) {
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
