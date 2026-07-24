import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConceptualProduct } from "../components/ConceptualProductCard";
import type { ProdutoConceitual } from "../types/border-value";

type DashboardPayload = {
  summary?: {
    periods?: string[];
    generated_from?: Record<string, string>;
  };
  etl?: {
    version?: string;
    trade_period?: string;
    production_period?: string;
    last_run_utc?: string;
  };
  indicators_prodlist?: DashboardProdlistRow[];
};

type DashboardProdlistRow = {
  cnae_class?: string | null;
  prodlist_code?: string | null;
  prodlist_name?: string | null;
  cnae_name?: string | null;
  export_allocated_value_usd?: number | null;
  import_allocated_value_usd?: number | null;
  export_allocated_net_weight_kg?: number | null;
  import_allocated_net_weight_kg?: number | null;
  trade_value_usd?: number | null;
  trade_balance_usd?: number | null;
  product_external_dependency_ratio?: number | null;
  external_dependency_ratio?: number | null;
  domestic_production_value_usd_comparable?: number | null;
  production_value_brl_thousand?: number | null;
  production_status?: string | null;
  product_dependency_status?: string | null;
  priority_tier?: string | null;
  priority_score?: number | null;
  transition_relevance?: boolean | null;
};

type MonthlyTradeRow = {
  year: string;
  month: string;
  flow: string;
  cnae_class: string;
  prodlist_code: string;
  allocated_value_usd: number;
};

export type DashboardCatalog = {
  products: ConceptualProduct[];
  kpis: {
    totalImports: number;
    totalExports: number;
    avgDependency: number;
    maxHhi: number;
    totalProducts: number;
  };
  dependency: Array<{ product: string; territory: string; value: number; id?: string }>;
  vulnerability: Array<{ product: string; hhi: number; dependency: number; id?: string }>;
  trade: Array<{ period: string; imports: number; exports: number }>;
  production: Array<{ stage: string; value: number; chain?: string }>;
  map: Array<{ territory: string; name: string; value: number; coordinates: [number, number] }>;
  metadata: {
    source: "dashboard_data";
    warning?: string;
    generatedFrom?: Record<string, string>;
    pilotFlags: string[];
    etl?: DashboardPayload["etl"];
  };
};

const ROOT = process.cwd();
const DATA_PATH = join(ROOT, "dashboard", "data.json");
const MONTHLY_TRADE_PATH = join(ROOT, "outputs", "final_border_value_2026", "comercio_alocado_cnae_prodlist_fluxo_periodo.csv");
const PRODUCT_LIMIT = 80;

let cachedPayload: DashboardPayload | null = null;
let cachedMonthlyTrade: MonthlyTradeRow[] | null = null;

export function hasDashboardData() {
  return existsSync(DATA_PATH);
}

export function loadDashboardCatalog(params: URLSearchParams): DashboardCatalog | null {
  if (!hasDashboardData()) return null;

  const payload = readDashboardPayload();
  const rows = payload.indicators_prodlist ?? [];
  if (!rows.length) return null;

  const unsupportedFilters = activeUnsupportedFilters(params);
  const filteredRows = unsupportedFilters.length
    ? []
    : rows
      .filter((row) => hasTrade(row))
      .filter((row) => matchesChain(row, params.get("chain") ?? "all"))
      .filter((row) => matchesProduct(row, params.get("product") ?? "all"))
      .filter((row) => matchesCnae(row, params.get("cnae") ?? "all"))
      .filter((row) => matchesProdlist(row, params.get("prodlist") ?? "all"))
      .filter((row) => matchesFlow(row, params.get("flow") ?? "all"))
      .filter((row) => matchesProductionStatus(row, params.get("mapping_status") ?? params.get("status") ?? "all"))
      .filter((row) => matchesConfidence(row, params.get("confidence") ?? "all"));

  const rankedRows = [...filteredRows].sort((left, right) => sortMetric(right, params) - sortMetric(left, params));
  const products = rankedRows.slice(0, PRODUCT_LIMIT).map((row) => toConceptualProduct(row, params));
  const kpis = buildKpis(filteredRows);

  const pilotFlags = [
    "Fornecedor principal, mapa mundial e HHI de fornecedores continuam piloto nesta experiencia Next porque o JSON oficial publicado nao traz a granularidade por pais.",
  ];
  if (unsupportedFilters.length) {
    pilotFlags.push(`Filtros ${unsupportedFilters.join(", ")} exigem a API tecnica/parquet para granularidade completa.`);
  }
  if (rankedRows.length > PRODUCT_LIMIT) {
    pilotFlags.push(`Cards limitados aos ${PRODUCT_LIMIT} maiores itens do recorte; KPIs e graficos agregados usam todos os ${rankedRows.length} registros filtrados.`);
  }

  return {
    products,
    kpis,
    dependency: products.map((item) => ({
      product: shortName(item.name),
      territory: "PILOTO",
      value: item.metrics.externalDependency,
      id: item.id,
    })),
    vulnerability: products.map((item) => ({
      product: shortName(item.name),
      hhi: item.metrics.hhi,
      dependency: item.metrics.externalDependency,
      id: item.id,
    })),
    trade: buildTradeSeries(filteredRows, params),
    production: buildProductionSeries(filteredRows),
    map: [],
    metadata: {
      source: "dashboard_data",
      warning: pilotFlags.join(" "),
      generatedFrom: payload.summary?.generated_from,
      pilotFlags,
      etl: payload.etl,
    },
  };
}

export function loadDashboardPublishedProducts(chainName: string, params: URLSearchParams): ProdutoConceitual[] | null {
  const catalogParams = new URLSearchParams(params);
  catalogParams.set("chain", chainName);
  const catalog = loadDashboardCatalog(catalogParams);
  if (!catalog) return null;

  return catalog.products.map((product) => {
    const importValue = product.metrics.imports;
    const exportValue = product.metrics.exports;
    const cnae = product.technicalCodes.cnae[0] ?? "0000";
    const prodlist = normalizeCode(product.technicalCodes.prodlist?.[0] ?? "00000000").padEnd(8, "0").slice(0, 8);
    const hasPilotFields = product.metrics.mainSupplier.country.startsWith("Piloto");

    return {
      conceptual_product_id: product.id,
      produto_nome: product.name,
      cadeia_prioritaria: publishedChainForProduct(chainName),
      chain_stage: chainStageForProduct(product.productionStage),
      ncm_codigo: "00000000",
      comercio: {
        importacao_valor_fob: importValue,
        importacao_peso_liquido: 0,
        exportacao_valor_fob: exportValue,
        exportacao_peso_liquido: 0,
        deficit_comercial: importValue - exportValue,
        principal_pais_origem: hasPilotFields ? "Nao publicado no JSON" : product.metrics.mainSupplier.country,
        principal_pais_participacao: product.metrics.mainSupplier.share / 100,
        hhi_global: product.metrics.hhi,
      },
      industria: {
        cnae_codigo: cnae.padStart(4, "0").slice(0, 4),
        prodlist_codigo: prodlist,
        valor_producao_pia: 0,
        consumo_aparente: Math.max(importValue - exportValue, 0),
        dependencia_externa_fracao: product.metrics.externalDependency / 100,
        qtde_vinculos_rais: 0,
        massa_salarial_rais: 0,
      },
      auditoria: {
        reference_year: 2026,
        confidence_level: confidencePt(product.metrics.confidenceLevel),
        is_ncm_generica: true,
        has_sigilo_pia: false,
        metodologia_versao: product.methodology ?? "dashboard/data.json",
      },
      fator_proporcionalidade: {
        aplicado: false,
        fator_alpha: 1,
        fonte_proxy: "Conector local dashboard/data.json",
      },
    };
  });
}

function readDashboardPayload(): DashboardPayload {
  if (cachedPayload) return cachedPayload;
  cachedPayload = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as DashboardPayload;
  return cachedPayload;
}

function readMonthlyTrade(): MonthlyTradeRow[] {
  if (cachedMonthlyTrade) return cachedMonthlyTrade;
  if (!existsSync(MONTHLY_TRADE_PATH)) {
    cachedMonthlyTrade = [];
    return cachedMonthlyTrade;
  }

  const [headerLine, ...lines] = readFileSync(MONTHLY_TRADE_PATH, "utf-8").trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  cachedMonthlyTrade = lines.map((line) => {
    const values = line.split(",");
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    return {
      year: record.year,
      month: record.month,
      flow: record.flow,
      cnae_class: record.cnae_class,
      prodlist_code: record.prodlist_code,
      allocated_value_usd: toNumber(record.allocated_value_usd),
    };
  });
  return cachedMonthlyTrade;
}

function toConceptualProduct(row: DashboardProdlistRow, params: URLSearchParams): ConceptualProduct {
  const flow = params.get("flow") ?? "all";
  const imports = flow === "EXP" ? 0 : toNumber(row.import_allocated_value_usd);
  const exports = flow === "IMP" ? 0 : toNumber(row.export_allocated_value_usd);
  const dependency = ratioToPercent(row.product_external_dependency_ratio ?? row.external_dependency_ratio);
  const cnae = text(row.cnae_class, "NAO_MAPEADO");
  const prodlist = text(row.prodlist_code, "NCM_SEM_PONTE");
  const productName = text(row.prodlist_name, row.cnae_name || `PRODLIST ${prodlist}`);

  return {
    id: productId(row),
    name: productName,
    shortDescription: `${stageForCnae(cnae)} com ${dependency}% de dependencia externa no recorte oficial disponivel.`,
    chain: chainLabelForRow(row),
    productionStage: stageForCnae(cnae),
    metrics: {
      imports,
      exports,
      externalDependency: dependency,
      hhi: proxyHhi(row),
      mainSupplier: {
        country: "Piloto: pais nao publicado no JSON",
        share: 0,
      },
      confidenceLevel: confidenceForRow(row),
    },
    technicalCodes: {
      hs: [],
      ncm: [],
      cnae: cnae === "NAO_MAPEADO" ? [] : [cnae],
      prodlist: prodlist === "NCM_SEM_PONTE" ? [] : [prodlist],
    },
    sources: [
      "dashboard/data.json",
      "outputs/final_border_value_2026",
      "Comex Stat / PIA-Produto / RAIS",
    ],
    methodology: `Pipeline oficial ${text(readDashboardPayload().etl?.version, "sem versao informada")}. Campos territoriais finos permanecem piloto nesta experiencia Next.`,
  };
}

function buildKpis(rows: DashboardProdlistRow[]) {
  const totalImports = rows.reduce((acc, row) => acc + toNumber(row.import_allocated_value_usd), 0);
  const totalExports = rows.reduce((acc, row) => acc + toNumber(row.export_allocated_value_usd), 0);
  const dependencies = rows
    .map((row) => row.product_external_dependency_ratio ?? row.external_dependency_ratio)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    totalImports,
    totalExports,
    avgDependency: dependencies.length ? ratioToPercent(dependencies.reduce((acc, value) => acc + value, 0) / dependencies.length) : 0,
    maxHhi: rows.reduce((max, row) => Math.max(max, proxyHhi(row)), 0),
    totalProducts: rows.length,
  };
}

function buildTradeSeries(rows: DashboardProdlistRow[], params: URLSearchParams) {
  const selected = new Set(rows.map((row) => `${text(row.cnae_class)}|${text(row.prodlist_code)}`));
  const flow = params.get("flow") ?? "all";
  const monthly = readMonthlyTrade().filter((row) => selected.has(`${row.cnae_class}|${row.prodlist_code}`));
  const grouped = new Map<string, { period: string; imports: number; exports: number }>();

  monthly.forEach((row) => {
    if (flow !== "all" && row.flow !== flow) return;
    const period = `${row.year}-${row.month.padStart(2, "0")}`;
    const current = grouped.get(period) ?? { period, imports: 0, exports: 0 };
    if (row.flow === "IMP") current.imports += row.allocated_value_usd;
    if (row.flow === "EXP") current.exports += row.allocated_value_usd;
    grouped.set(period, current);
  });

  if (grouped.size) return Array.from(grouped.values()).sort((left, right) => left.period.localeCompare(right.period));

  const totals = buildKpis(rows);
  return [{ period: "2026-H1", imports: totals.totalImports, exports: totals.totalExports }];
}

function buildProductionSeries(rows: DashboardProdlistRow[]) {
  const grouped = new Map<string, number>();
  rows.forEach((row) => {
    const stage = stageForCnae(text(row.cnae_class));
    grouped.set(stage, (grouped.get(stage) ?? 0) + toNumber(row.domestic_production_value_usd_comparable));
  });
  return Array.from(grouped.entries())
    .map(([stage, value]) => ({ stage, value }))
    .sort((left, right) => right.value - left.value);
}

function matchesChain(row: DashboardProdlistRow, chain: string) {
  if (!chain || chain === "all") return true;
  if (chain === "fertilizantes") return matchesChain(row, "fertilizers");
  if (chain === "combustiveis_transicao") return matchesChain(row, "transition-fuels");
  if (chain === "aco" || chain === "silicio") return matchesChain(row, "critical-minerals");
  const haystack = `${row.prodlist_name ?? ""} ${row.cnae_name ?? ""}`.toLowerCase();
  const cnae = text(row.cnae_class);

  if (chain === "transition-fuels") return row.transition_relevance === true;
  if (chain === "fertilizers") {
    return cnae.startsWith("201") || /fertiliz|adubo|ureia|am[oô]nia|fosfat|pot[aá]ss/.test(haystack);
  }
  if (chain === "critical-minerals") {
    return /min[eé]rio|mineral|a[cç]o|alum[ií]nio|sil[ií]cio|mangan[eê]s|cobre|l[ií]tio|n[ií]quel/.test(haystack) || /^0[789]/.test(cnae) || /^24/.test(cnae);
  }
  return true;
}

function matchesProduct(row: DashboardProdlistRow, product: string) {
  return !product || product === "all" || productId(row) === product || normalizeCode(row.prodlist_code) === normalizeCode(product);
}

function matchesCnae(row: DashboardProdlistRow, cnae: string) {
  return !cnae || cnae === "all" || text(row.cnae_class).includes(cnae.trim());
}

function matchesProdlist(row: DashboardProdlistRow, prodlist: string) {
  return !prodlist || prodlist === "all" || normalizeCode(row.prodlist_code).includes(normalizeCode(prodlist));
}

function matchesFlow(row: DashboardProdlistRow, flow: string) {
  if (!flow || flow === "all") return true;
  if (flow === "IMP") return toNumber(row.import_allocated_value_usd) > 0;
  if (flow === "EXP") return toNumber(row.export_allocated_value_usd) > 0;
  return true;
}

function matchesProductionStatus(row: DashboardProdlistRow, status: string) {
  if (!status || status === "all") return true;
  const normalized = status.toLowerCase();
  if (normalized === "mapeado") return row.production_status === "published";
  if (normalized === "auditoria_sigilo_pia") return row.production_status === "confidential";
  if (normalized === "ncm_generica") return false;
  return true;
}

function matchesConfidence(row: DashboardProdlistRow, confidence: string) {
  return !confidence || confidence === "all" || confidenceForRow(row) === confidence;
}

function activeUnsupportedFilters(params: URLSearchParams) {
  return ["ncm", "hs", "country", "territory"]
    .filter((key) => {
      const value = params.get(key);
      return value && value !== "all";
    })
    .map((key) => key.toUpperCase());
}

function hasTrade(row: DashboardProdlistRow) {
  return toNumber(row.trade_value_usd) > 0 || toNumber(row.import_allocated_value_usd) > 0 || toNumber(row.export_allocated_value_usd) > 0;
}

function sortMetric(row: DashboardProdlistRow, params: URLSearchParams) {
  const flow = params.get("flow") ?? "all";
  if (flow === "IMP") return toNumber(row.import_allocated_value_usd);
  if (flow === "EXP") return toNumber(row.export_allocated_value_usd);
  return toNumber(row.trade_value_usd);
}

function productId(row: DashboardProdlistRow) {
  return `prod_${normalizeCode(row.prodlist_code || row.cnae_class || "nao_mapeado").toLowerCase()}`;
}

function chainLabelForRow(row: DashboardProdlistRow) {
  if (matchesChain(row, "fertilizers")) return "Fertilizantes";
  if (matchesChain(row, "critical-minerals")) return "Minerais criticos";
  if (row.transition_relevance) return "Transicao energetica";
  return "Base industrial";
}

function stageForCnae(cnae: string) {
  const prefix = Number(cnae.slice(0, 2));
  if (Number.isNaN(prefix)) return "Nao mapeado";
  if (prefix <= 9) return "Materia-prima";
  if (prefix <= 20) return "Insumo";
  if (prefix <= 28) return "Transformacao";
  return "Equipamento e uso final";
}

function confidenceForRow(row: DashboardProdlistRow): ConceptualProduct["metrics"]["confidenceLevel"] {
  if (row.production_status === "published" && row.product_dependency_status === "calculated") return "high";
  if (row.production_status === "confidential") return "medium";
  return "low";
}

function publishedChainForProduct(chainName: string): ProdutoConceitual["cadeia_prioritaria"] {
  if (chainName === "combustiveis_transicao" || chainName === "transition-fuels") return "combustiveis_transicao";
  if (chainName === "aco") return "aco";
  if (chainName === "silicio" || chainName === "critical-minerals") return "silicio";
  return "fertilizantes";
}

function chainStageForProduct(stage: string): ProdutoConceitual["chain_stage"] {
  if (stage === "Materia-prima") return "insumo";
  if (stage === "Insumo") return "insumo";
  if (stage === "Transformacao") return "processamento";
  return "produto_final";
}

function confidencePt(confidence: ConceptualProduct["metrics"]["confidenceLevel"]): ProdutoConceitual["auditoria"]["confidence_level"] {
  if (confidence === "high") return "alta";
  if (confidence === "medium") return "media";
  return "baixa";
}

function proxyHhi(row: DashboardProdlistRow) {
  const importShare = toNumber(row.import_allocated_value_usd) / Math.max(toNumber(row.trade_value_usd), 1);
  return Math.round(Math.min(10000, Math.max(0, importShare * importShare * 10000)));
}

function ratioToPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(Math.min(Math.max(value, 0), 1) * 100);
}

function normalizeCode(value: string | null | undefined) {
  return text(value).replace(/[^a-zA-Z0-9]/g, "");
}

function shortName(name: string) {
  return name.split(/\s+/).slice(0, 3).join(" ");
}

function text(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const output = String(value).trim();
  return output || fallback;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
