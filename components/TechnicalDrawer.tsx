"use client";

import { Fragment, useState } from "react";
import { AlertTriangle, BadgeAlert, ChevronDown, Download } from "lucide-react";
import type { ProdutoConceitual } from "../types/border-value";
import type { SolarInputMetric } from "../types/solar-sovereignty";
import { StrategicVectorBadge } from "./StrategicVectorBadge";
import { CodeTooltip } from "./CodeTooltip";

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
                value={methodologies.map(formatMethodologyLabel).join(", ") || "N/D"}
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
                      {formatMethodologyLabel(methodology)}
                    </span>
                  ))}
                </div>
                {methodologies.map((methodology) => {
                  const href = methodologyPdfHref(methodology);
                  return href ? (
                    <a
                      key={`pdf-${methodology}`}
                      href={href}
                      download
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                    >
                      <Download className="h-3.5 w-3.5" strokeWidth={1.7} />
                      Baixar metodologia em PDF ({formatMethodologyLabel(methodology)})
                    </a>
                  ) : null;
                })}
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
                    : <CodeList kind="ncm" codes={product.ncm_codigos?.length ? product.ncm_codigos : [product.ncm_codigo]} />}
                </AuditCell>
                <AuditCell><MappingStatus product={product} /></AuditCell>
                <AuditCell>
                  {product.industria.cnae_codigo
                    ? <CodeTooltip kind="cnae" code={product.industria.cnae_codigo} />
                    : "N/D"}
                </AuditCell>
                <AuditCell>
                  <CodeList kind="prodlist" codes={product.industria.prodlist_codigos?.length
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
  const [expandedInputs, setExpandedInputs] = useState<Set<string>>(new Set());
  const toggleExpanded = (inputId: string) => {
    setExpandedInputs((previous) => {
      const next = new Set(previous);
      if (next.has(inputId)) {
        next.delete(inputId);
      } else {
        next.add(inputId);
      }
      return next;
    });
  };

  return (
    <section className="overflow-hidden rounded-lg border border-cyan-300/15 bg-cyan-400/[0.025]">
      <div className="border-b border-white/[0.08] px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
          Cesta da cadeia por insumo
        </p>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <p className="text-sm text-zinc-300">
            {inputs.length} insumos com cesta comercial publicada, incluindo mapeamentos validados e proxies.
          </p>
          {methodologyVersion ? <span className="text-[11px] text-zinc-500">Versão {formatMethodologyLabel(methodologyVersion)}</span> : null}
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
            {ordered.map((input) => {
              const hasSubNcm = Boolean(input.sub_ncm_masking_level && input.sub_ncm_breakdown?.length);
              const isExpanded = expandedInputs.has(input.input_id);
              return (
                <Fragment key={input.input_id}>
                  <tr className="align-top">
                    <AuditCell className="min-w-48 font-semibold text-zinc-100">{input.label}</AuditCell>
                    <AuditCell><span className="whitespace-nowrap">{technicalStageLabel(input.stage)}</span></AuditCell>
                    <AuditCell><CodeList kind="ncm" codes={input.ncm_codes} /></AuditCell>
                    <AuditCell><CodeList kind="prodlist" codes={(input.prodlist_codes ?? []).filter((code) => code !== "NCM_SEM_PONTE")} /></AuditCell>
                    <AuditCell><SolarMappingBadge input={input} /></AuditCell>
                    <AuditCell className="min-w-64 leading-5 text-zinc-400">
                      {input.data_gap_reason ?? "Cesta específica validada para o recorte comercial publicado."}
                      {hasSubNcm ? (
                        <SubNcmMaskingBadge
                          input={input}
                          expanded={isExpanded}
                          onToggle={() => toggleExpanded(input.input_id)}
                        />
                      ) : null}
                      <StrategicVectorBadge profile={input.strategic_profile} />
                    </AuditCell>
                  </tr>
                  {hasSubNcm && isExpanded ? (
                    <tr>
                      <td colSpan={6} className="bg-zinc-950/50 px-4 py-4">
                        <SubNcmBreakdownTable input={input} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
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

function SubNcmMaskingBadge({
  input,
  expanded,
  onToggle,
}: {
  input: SolarInputMetric;
  expanded: boolean;
  onToggle: () => void;
}) {
  const breakdown = input.sub_ncm_breakdown ?? [];
  if (!breakdown.length) return null;

  const aggregateDirection: "exportador" | "importador" = input.trade_balance_usd >= 0 ? "exportador" : "importador";
  const dominant = [...breakdown].sort((left, right) =>
    aggregateDirection === "exportador"
      ? right.exports_value_usd - left.exports_value_usd
      : right.imports_value_usd - left.imports_value_usd,
  )[0];
  const dominantShare = aggregateDirection === "exportador" ? dominant.share_of_basket_exports : dominant.share_of_basket_imports;
  const opposing = breakdown.filter((item) => item.direction !== aggregateDirection);

  // Nível 1 (ferroligas): a direção do agregado esconde sub-códigos com
  // direção oposta e economicamente relevante -- o diagnóstico agregado
  // pode ser lido de forma invertida. Nível 2 (planos_quente/estruturas_aco):
  // a direção do agregado está correta, só concentra a maior parte do
  // fluxo em um código genérico/residual -- mensagem diferente porque o
  // risco de leitura errada é distinto.
  const message =
    input.sub_ncm_masking_level === 1
      ? `Cesta mascara a direção do agregado — ${formatPercent(dominantShare)} do ${
          aggregateDirection === "exportador" ? "superávit" : "déficit"
        } vem do código ${dominant.ncm_code}, enquanto ${opposing.length} sub-código${opposing.length === 1 ? "" : "s"} ${
          opposing.length === 1 ? "é" : "são"
        } ${aggregateDirection === "exportador" ? "importador" : "exportador"}${opposing.length === 1 ? "" : "es"} líquido${
          opposing.length === 1 ? "" : "s"
        }.`
      : `Cesta heterogênea — ${formatPercent(dominantShare)} da ${
          aggregateDirection === "exportador" ? "exportação" : "importação"
        } concentrada em 1 código (${dominant.ncm_code}).`;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="inline-flex w-full items-start gap-1.5 rounded-md border border-amber-300/20 bg-amber-400/10 px-2 py-1.5 text-left text-[11px] font-semibold leading-4 text-amber-200 transition hover:bg-amber-400/15"
      >
        <span aria-hidden>⚠️</span>
        <span>
          {message}{" "}
          <span className="font-normal text-amber-200/70 underline underline-offset-2">
            {expanded ? "Ocultar detalhamento por sub-NCM" : "Ver detalhamento por sub-NCM"}
          </span>
        </span>
      </button>
    </div>
  );
}

function SubNcmBreakdownTable({ input }: { input: SolarInputMetric }) {
  const breakdown = input.sub_ncm_breakdown ?? [];
  return (
    <div className="overflow-hidden rounded-md border border-white/[0.08]">
      <p className="border-b border-white/[0.08] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
        Detalhamento por sub-NCM — {input.label} ({input.reference_period}, direto do Comex Stat)
      </p>
      <table className="min-w-full border-collapse text-left text-[11px]">
        <thead className="text-zinc-500">
          <tr>
            <AuditHeader>NCM</AuditHeader>
            <AuditHeader>Importação FOB</AuditHeader>
            <AuditHeader>Exportação FOB</AuditHeader>
            <AuditHeader>Saldo</AuditHeader>
            <AuditHeader>% da cesta</AuditHeader>
            <AuditHeader>Direção</AuditHeader>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {breakdown.map((row) => (
            <tr key={row.ncm_code}>
              <AuditCell className="whitespace-nowrap font-mono text-zinc-300">
                <CodeTooltip kind="ncm" code={row.ncm_code} />
              </AuditCell>
              <AuditCell>{formatUsd(row.imports_value_usd)}</AuditCell>
              <AuditCell>{formatUsd(row.exports_value_usd)}</AuditCell>
              <AuditCell className={row.trade_balance_usd >= 0 ? "text-emerald-300" : "text-amber-300"}>
                {formatUsd(row.trade_balance_usd)}
              </AuditCell>
              <AuditCell>
                {formatPercent(row.direction === "exportador" ? row.share_of_basket_exports : row.share_of_basket_imports)}
              </AuditCell>
              <AuditCell>
                <span
                  className={`inline-flex rounded-md border px-1.5 py-0.5 font-semibold ${
                    row.direction === "exportador"
                      ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-300/20 bg-amber-400/10 text-amber-200"
                  }`}
                >
                  {row.direction === "exportador" ? "Exportador" : "Importador"}
                </span>
              </AuditCell>
            </tr>
          ))}
        </tbody>
      </table>
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

function CodeList({ codes, kind }: { codes: string[]; kind: "ncm" | "prodlist" }) {
  if (!codes.length || codes.every(isResidualCode)) return <span className="text-zinc-500">N/D</span>;
  return (
    <div className="flex min-w-28 flex-wrap gap-1">
      {codes.filter((code) => !isResidualCode(code)).map((code) => (
        <span key={code} className="whitespace-nowrap rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
          <CodeTooltip kind={kind} code={code} />
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

// Static, pre-generated PDFs (build_methodology_pdfs.py) in public/metodologia/
// -- one per AIPNET chain, keyed by the exact methodology_version string each
// chain's build_*.py already stamps on its payload (e.g. "1.0.0-aipnet-steel").
const METHODOLOGY_PDF_BY_VERSION: Record<string, string> = {
  "1.0.0-aipnet-steel": "/metodologia/aco.pdf",
  "1.1.0-aipnet-solar": "/metodologia/silicio.pdf",
  "1.0.0-aipnet-fertilizers": "/metodologia/fertilizantes.pdf",
  "1.0.0-aipnet-transition-fuels": "/metodologia/combustiveis_transicao.pdf",
};

// Display-only: the raw version string (e.g. "1.0.0-aipnet-steel") is a
// backend-generated data value used as the lookup key above and stamped by
// build_*.py -- renaming it would mean touching the Python pipeline and the
// stored Postgres data. Reformatting it here for display only keeps that
// pipeline untouched while dropping the "aipnet" jargon from what the user
// actually reads.
const METHODOLOGY_CHAIN_LABEL_BY_SUFFIX: Record<string, string> = {
  steel: "Aço",
  solar: "Silício",
  fertilizers: "Fertilizantes",
  "transition-fuels": "Combustíveis de Transição",
};

function formatMethodologyLabel(version: string): string {
  const match = version.match(/^(\d+\.\d+\.\d+)-aipnet-(.+)$/);
  if (!match) return version;
  const [, versionNumber, suffix] = match;
  const chainLabel = METHODOLOGY_CHAIN_LABEL_BY_SUFFIX[suffix];
  return chainLabel ? `${chainLabel} · v${versionNumber}` : version;
}

function methodologyPdfHref(version: string): string | null {
  return METHODOLOGY_PDF_BY_VERSION[version] ?? null;
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
