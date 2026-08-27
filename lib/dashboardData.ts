import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConceptualProduct } from "../components/ConceptualProductCard";
import { chainCatalog } from "./chainCatalog";
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
    "Fornecedor principal, mapa mundial e HHI de fornecedores continuam em homologação porque a base consolidada ainda não publica a granularidade por país.",
  ];
  if (unsupportedFilters.length) {
    pilotFlags.push(`Filtros ${unsupportedFilters.join(", ")} exigem a API técnica/parquet para granularidade completa.`);
  }
  if (rankedRows.length > PRODUCT_LIMIT) {
    pilotFlags.push(`Cards limitados aos ${PRODUCT_LIMIT} maiores itens do recorte; KPIs e gráficos agregados usam todos os ${rankedRows.length} registros filtrados.`);
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
        principal_pais_origem: hasPilotFields ? "Origem em homologação" : product.metrics.mainSupplier.country,
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
        metodologia_versao: product.methodology ?? "Camada operacional publicada",
      },
      fator_proporcionalidade: {
        aplicado: false,
        fator_alpha: 1,
        fonte_proxy: "Camada operacional publicada",
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
  const productName = executiveProductName(row, prodlist);

  return {
    id: productId(row),
    name: productName,
    shortDescription: `${stageForCnae(cnae)} com ${dependency}% de dependência externa no recorte oficial disponível.`,
    chain: chainLabelForRow(row, params.get("chain") ?? "all"),
    productionStage: stageForCnae(cnae),
      metrics: {
        imports,
        exports,
        externalDependency: dependency,
        hhi: proxyHhi(row),
        mainSupplier: {
        country: "Piloto: país não publicado na base consolidada",
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
      "Camada operacional publicada",
      "outputs/final_border_value_2026",
      "Comex Stat / PIA-Produto / RAIS",
    ],
    methodology: `Pipeline oficial ${text(readDashboardPayload().etl?.version, "sem versão informada")}. Campos territoriais finos permanecem em homologação nesta experiência executiva.`,
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
  const haystack = searchableText(`${row.prodlist_name ?? ""} ${row.cnae_name ?? ""}`);
  const productName = searchableText(row.prodlist_name);
  const cnae = text(row.cnae_class);

  if (chain === "silicio") {
    if (/exceto\s+celulas?\s+fotovoltaicas?/.test(productName)) return false;
    return (
      /\bquartzo\b|\bquartzitos?\b|\bpolissilicio\b|\bwafers? fotovoltaicos?\b/.test(productName) ||
      /\bcelulas? fotovoltaicas?\b|\bmodulos? fotovoltaicos?\b|\bpaineis? fotovoltaicos?\b/.test(productName) ||
      /^silicio(?:\s|$)/.test(productName)
    );
  }
  if (chain === "aco") {
    // The keyword regex below is intentionally broad -- it has to catch
    // every phrasing of a steel/metallurgy product name -- which makes it a
    // false-positive magnet for products that merely mention "aço"/"ferro"
    // as an incidental material in something unrelated (a ventilator
    // historically named "pulmão de aço", stents "de aço inoxidável",
    // sewing needles "de ferro ou aço"), or hit the bare "bobina"/"tubo...
    // aco" fragments against plastic film, paper cores or wire spools that
    // have nothing to do with steel. Gating on CNAE division 24 (Metalurgia)
    // or 25 (Fabricação de produtos de metal) -- the same codes this chain
    // is already defined by elsewhere (components/SovereigntyTour.tsx cites
    // 2411/2421/2422/2423/2424 and 2512/2599) -- keeps every one of the
    // ~96 genuine matches in the current dataset while dropping every
    // out-of-industry false positive found when auditing this filter
    // (medical devices, plastic film, paper, wire coils, footwear parts,
    // needles, generators, electrical insulator tubes -- CNAE 15/16/17/22/
    // 27/28/29/32).
    const isMetalIndustry = /^2[45]/.test(cnae);
    return isMetalIndustry && /\bacos?\b|sider|ferro-gusa|ferroliga|ferroniquel|ferroniobio|ferrossilicio|bobina|chapa de aco|tubo.*(?:ferro|aco)|vergalh|arame.*aco|parafuso.*(?:ferro|aco)/.test(productName);
  }
  if (chain === "transition-fuels") {
    return /\betanol\b|\bmetanol\b|\bbiometano\b|\bbiogas\b|\bbiodiesel\b|combustivel sustentavel de aviacao|\bsaf\b|querosene.*aviacao|combustivel.*maritimo|amoniaco|amonia|hidrogenio/.test(productName);
  }
  if (chain === "fertilizers") {
    return /fertiliz|adubo|ureia|amonia|fosfat|potass|superfosfat|cloreto de potassio|sulfato de amonio/.test(productName);
  }
  if (chain === "aco_legacy_unreachable") {
    return /a[cÃ§]o|aco|sider|ferro-gusa|ferroliga|ferron[iÃ­]quel|ferron[iÃ³]bio|ferrossil[iÃ­]cio|bobina|chapa de a[cÃ§]o|tubo.*(?:ferro|a[cÃ§]o)|vergalh|arame.*a[cÃ§]o/.test(haystack);
  }

  if (chain === "transition-fuels_legacy_unreachable") return row.transition_relevance === true;
  if (chain === "fertilizers_legacy_unreachable") {
    return cnae.startsWith("201") || /fertiliz|adubo|ureia|am[oô]nia|fosfat|pot[aá]ss/.test(haystack);
  }
  if (chain === "critical-minerals") {
    return /min[eé]rio|mineral|a[cç]o|alum[ií]nio|sil[ií]cio|mangan[eê]s|cobre|l[ií]tio|n[ií]quel/.test(haystack) || /^0[789]/.test(cnae) || /^24/.test(cnae);
  }
  return true;
}

function searchableText(value: unknown) {
  return text(value)
    .replace(/Ã¡|Ã£|Ã¢/g, "a")
    .replace(/Ã©|Ãª/g, "e")
    .replace(/Ã­/g, "i")
    .replace(/Ã³|Ã´|Ãµ/g, "o")
    .replace(/Ãº/g, "u")
    .replace(/Ã§/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

// Query-param spellings that map 1:1 onto a single chainCatalog entry --
// "all" and the "critical-minerals"/aggregate views span more than one
// chain, so they're deliberately left out and fall through to the guess below.
const REQUESTED_CHAIN_CATALOG_ID: Record<string, string> = {
  aco: "aco",
  silicio: "silicio",
  fertilizantes: "fertilizantes",
  fertilizers: "fertilizantes",
  combustiveis_transicao: "combustiveis_transicao",
  "transition-fuels": "combustiveis_transicao",
};

function chainLabelForRow(row: DashboardProdlistRow, requestedChain: string) {
  // When the caller already asked for one specific chain (the normal case --
  // every dashboard screen is "?chain=aco" etc.), that's ground truth: use
  // it instead of re-guessing from the product name. The guess below is
  // reused only for the "all chains" aggregate view, where no single
  // correct answer exists -- and it's a genuinely rough guess: its
  // "critical-minerals" branch matches on the bare word "aço" with no CNAE
  // guard (unlike matchesChain's "aco" branch above), so it was mislabeling
  // every steel product -- including correctly-matched ones -- as "Minerais
  // críticos" even while being displayed on the Aço chain screen.
  const catalogId = REQUESTED_CHAIN_CATALOG_ID[requestedChain];
  const knownChain = catalogId ? chainCatalog.find((chain) => chain.id === catalogId) : undefined;
  if (knownChain) return knownChain.name;

  if (matchesChain(row, "fertilizers")) return "Fertilizantes";
  if (matchesChain(row, "critical-minerals")) return "Minerais críticos";
  if (row.transition_relevance) return "Transição energética";
  return "Base industrial";
}

function stageForCnae(cnae: string) {
  const prefix = Number(cnae.slice(0, 2));
  if (Number.isNaN(prefix)) return "Não mapeado";
  if (prefix <= 9) return "Matéria-prima";
  if (prefix <= 20) return "Insumo";
  if (prefix <= 28) return "Transformação";
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
  if (stage === "Matéria-prima" || stage === "Materia-prima") return "insumo";
  if (stage === "Insumo") return "insumo";
  if (stage === "Transformação" || stage === "Transformacao") return "processamento";
  return "produto_final";
}

function executiveProductName(row: DashboardProdlistRow, prodlist: string) {
  const prodlistName = text(row.prodlist_name);
  if (isExecutiveSentinel(prodlistName) || /^PRODLIST\s+NCM_SEM_PONTE$/i.test(prodlistName)) {
    return executiveFallbackName(row);
  }

  if (prodlistName) return prodlistName;
  if (prodlist === "NCM_SEM_PONTE") return executiveFallbackName(row);
  return `Produto industrial ${prodlist}`;
}

function executiveFallbackName(row: DashboardProdlistRow) {
  const cnaeName = text(row.cnae_name);
  if (cnaeName && !isExecutiveSentinel(cnaeName)) return cnaeName;
  return "Produto não mapeado";
}

function isExecutiveSentinel(value: string) {
  return ["NCM_SEM_PONTE", "NAO_MAPEADO", "00000000"].includes(value.trim().toUpperCase());
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
