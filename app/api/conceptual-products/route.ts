import { NextRequest, NextResponse } from "next/server";
import {
  chainAliases,
  products,
  supplierCoordinates,
  supplierTerritory,
} from "../../../lib/conceptualCatalog";
import { loadDashboardCatalog } from "../../../lib/dashboardData";
import { fetchPublishedChains, publishedChains } from "../../../lib/publishedApi";
import { toConceptualProduct } from "../../../lib/publishedCatalog";
import type { ConceptualProduct } from "../../../components/ConceptualProductCard";

type ApiResponse = {
  products: ConceptualProduct[];
  dependency: Array<{ product: string; territory: string; value: number; id?: string }>;
  vulnerability: Array<{ product: string; hhi: number; dependency: number; id?: string }>;
  trade: Array<{ period: string; imports: number; exports: number }>;
  production: Array<{ stage: string; value: number; chain?: string }>;
  map: Array<{ territory: string; name: string; value: number; coordinates: [number, number] }>;
  kpis?: {
    totalImports: number;
    totalExports: number;
    avgDependency: number;
    maxHhi: number;
    totalProducts: number;
  };
  metadata: {
    source: "dashboard_data" | "published" | "local_fallback";
    warning?: string;
    generatedFrom?: Record<string, string>;
    pilotFlags?: string[];
  };
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const dashboardCatalog = loadDashboardCatalog(params);

  if (dashboardCatalog) {
    return NextResponse.json(dashboardCatalog);
  }

  const chain = params.get("chain") ?? "all";
  const product = params.get("product") ?? "all";
  const territory = params.get("territory") ?? "all";
  const selectedTerritories = csvValues(territory);
  const confidence = params.get("confidence") ?? "all";
  const hs = clean(params.get("hs"));
  const ncm = clean(params.get("ncm"));
  const cnae = clean(params.get("cnae"));
  const prodlist = clean(params.get("prodlist"));
  const catalog = await loadCatalog(chain, params);

  const visibleProducts = catalog.source === "published" ? catalog.products : catalog.products.filter((item) => {
    if (catalog.source === "local_fallback" && chain !== "all" && item.chain !== (chainAliases[chain] ?? chain)) return false;
    if (product !== "all" && item.id !== product) return false;
    if (confidence !== "all" && item.metrics.confidenceLevel !== confidence) return false;
    if (territory !== "all" && !selectedTerritories.includes(supplierTerritory(item.metrics.mainSupplier.country))) return false;
    if (hs && !containsCode(item.technicalCodes.hs, hs)) return false;
    if (ncm && !containsCode(item.technicalCodes.ncm, ncm)) return false;
    if (cnae && !containsCode(item.technicalCodes.cnae, cnae)) return false;
    if (prodlist && !containsCode(item.technicalCodes.prodlist ?? [], prodlist)) return false;
    return true;
  });

  const response: ApiResponse = {
    products: visibleProducts,
    dependency: visibleProducts.map((item) => ({
      product: shortName(item.name),
      territory: supplierTerritory(item.metrics.mainSupplier.country),
      value: item.metrics.externalDependency,
      id: item.id,
    })),
    vulnerability: visibleProducts.map((item) => ({
      product: shortName(item.name),
      hhi: item.metrics.hhi,
      dependency: item.metrics.externalDependency,
      id: item.id,
    })),
    trade: buildTradeSeries(visibleProducts),
    production: buildProductionSeries(visibleProducts),
    map: visibleProducts.map((item) => ({
      territory: supplierTerritory(item.metrics.mainSupplier.country),
      name: item.metrics.mainSupplier.country,
      value: item.metrics.mainSupplier.share,
      coordinates: supplierCoordinates(item.metrics.mainSupplier.country),
    })),
    metadata: {
      source: catalog.source,
      warning: catalog.warning,
    },
  };

  return NextResponse.json(response);
}

async function loadCatalog(chain: string, params: URLSearchParams): Promise<{
  products: ConceptualProduct[];
  source: ApiResponse["metadata"]["source"];
  warning?: string;
}> {
  const chains = publishedChainsFor(chain);

  if (!chains.length) {
    return {
      products,
      source: "local_fallback",
      warning: "Cadeia ainda sem equivalente Published publicado para esta experiência.",
    };
  }

  try {
    const publishedProducts = await fetchPublishedChains(chains, buildPublishedParams(params));

    if (!publishedProducts.length) {
      return {
        products: [],
        source: "published",
      };
    }

    return {
      products: publishedProducts.map(toConceptualProduct),
      source: "published",
    };
  } catch {
    return {
      products,
      source: "local_fallback",
      warning: "API Published indisponível; usando catálogo local de contingência.",
    };
  }
}

function publishedChainsFor(chain: string): readonly string[] {
  const mapping: Record<string, readonly string[]> = {
    all: publishedChains,
    fertilizers: ["fertilizantes"],
    "transition-fuels": ["combustiveis_transicao"],
    "critical-minerals": ["aco", "silicio"],
    fertilizantes: ["fertilizantes"],
    combustiveis_transicao: ["combustiveis_transicao"],
    aco: ["aco"],
    silicio: ["silicio"],
  };

  return mapping[chain] ?? [];
}

function buildPublishedParams(params: URLSearchParams) {
  const publishedParams = new URLSearchParams();
  [
    "period",
    "flow",
    "product",
    "ncm",
    "cnae",
    "prodlist",
    "country",
    "mapping_status",
    "status",
    "confidence",
    "audit_confidence",
  ].forEach((key) => {
    const value = params.get(key);
    if (value && value !== "all") publishedParams.set(key, value);
  });

  const territory = params.get("territory");
  const partner = territory && territory !== "all" ? countryNameForTerritory(territory) : "";
  if (partner) publishedParams.set("partner", partner);
  return publishedParams;
}

function countryNameForTerritory(value: string) {
  const territories = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (territories.length !== 1) return "";

  const territoryToCountry: Record<string, string> = {
    RU: "Russia",
    TT: "Trinidad and Tobago",
    CL: "Chile",
    CN: "China",
    BR: "Brazil",
    CA: "Canada",
    US: "United States",
  };
  return territoryToCountry[territories[0]] ?? "";
}

function buildTradeSeries(visibleProducts: ConceptualProduct[]) {
  const imports = visibleProducts.reduce((acc, item) => acc + item.metrics.imports, 0);
  const exports = visibleProducts.reduce((acc, item) => acc + item.metrics.exports, 0);

  return [
    { period: "2025-Q3", imports: imports * 0.32, exports: exports * 0.28 },
    { period: "2025-Q4", imports: imports * 0.36, exports: exports * 0.31 },
    { period: "2026-Q1", imports: imports * 0.44, exports: exports * 0.34 },
    { period: "2026-Q2", imports: imports * 0.56, exports: exports * 0.39 },
  ];
}

function buildProductionSeries(visibleProducts: ConceptualProduct[]) {
  const dependency = visibleProducts.length
    ? visibleProducts.reduce((acc, item) => acc + item.metrics.externalDependency, 0) / visibleProducts.length
    : 0;
  const baseCoverage = Math.max(12, 100 - dependency);

  return [
    { stage: "Matéria-prima", value: Math.round(baseCoverage * 0.75) },
    { stage: "Insumo", value: Math.round(baseCoverage * 0.92) },
    { stage: "Transformação", value: Math.round(baseCoverage * 1.12) },
    { stage: "Uso final", value: Math.round(baseCoverage * 0.86) },
  ];
}

function shortName(name: string) {
  return name.split(" ")[0];
}

function clean(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function csvValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function containsCode(values: string[], query: string) {
  return values.some((value) => value.toLowerCase().includes(query));
}
