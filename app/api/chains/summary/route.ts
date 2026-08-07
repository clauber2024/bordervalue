import { NextResponse } from "next/server";
import { chainCatalog } from "../../../../lib/chainCatalog";
import type { SolarInputMetric, SolarSovereigntyResponse } from "../../../../types/solar-sovereignty";

export type ChainSummary = {
  id: string;
  ok: boolean;
  referencePeriod?: string;
  totalImportsUsd?: number;
  totalExportsUsd?: number;
  avgDependency?: number;
  maxDependency?: number;
  criticalCount?: number;
  inputsCount?: number;
  topBottleneck?: string;
};

export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 4000;

export async function GET() {
  const publishedChains = chainCatalog.filter((chain) => chain.status === "published");
  const summaries = await Promise.all(publishedChains.map((chain) => summarizeChain(chain.id)));
  return NextResponse.json({ chains: summaries });
}

async function summarizeChain(chainId: string): Promise<ChainSummary> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(
      `${apiBaseUrl()}/api/networks/sovereignty/inputs?chain=${encodeURIComponent(chainId)}`,
      { cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal },
    ).finally(() => clearTimeout(timeout));

    if (!response.ok) return { id: chainId, ok: false };

    const payload = (await response.json()) as SolarSovereigntyResponse;
    return { id: chainId, ok: true, ...aggregateInputs(payload) };
  } catch {
    return { id: chainId, ok: false };
  }
}

// Pior caso entre os tres sinais de risco disponiveis, nao um fallback em cadeia: um
// insumo pode ter dependencia de consumo baixa (boa cobertura domestica) e ainda assim
// depender de um unico fornecedor estrangeiro para a fatia que de fato importa (ex:
// Modulos fotovoltaicos, 61,8% de dependencia mas 98,6% das importacoes vindas da China).
// Usar so "external_dependency ?? global_china_share" deixava esse risco invisivel sempre
// que a dependencia de consumo already existia, mesmo que moderada.
function riskSignal(input: SolarInputMetric): number {
  return Math.max(
    input.external_dependency ?? 0,
    input.global_china_share ?? 0,
    input.china_share_brazilian_imports ?? 0,
  );
}

function aggregateInputs(payload: SolarSovereigntyResponse) {
  const inputs = payload.inputs ?? [];
  const dependencyValues = inputs.map(riskSignal);

  const totalImportsUsd = inputs.reduce((sum, input) => sum + (input.imports_value_usd ?? 0), 0);
  const totalExportsUsd = inputs.reduce((sum, input) => sum + (input.exports_value_usd ?? 0), 0);
  const avgDependency = dependencyValues.length
    ? dependencyValues.reduce((sum, value) => sum + value, 0) / dependencyValues.length
    : undefined;
  const maxDependency = dependencyValues.length ? Math.max(...dependencyValues) : undefined;
  const criticalCount = inputs.filter((input) => riskSignal(input) >= 0.75).length;
  const topBottleneck = topRiskInput(inputs)?.label;

  return {
    referencePeriod: payload.reference_period,
    totalImportsUsd,
    totalExportsUsd,
    avgDependency,
    maxDependency,
    criticalCount,
    inputsCount: inputs.length,
    topBottleneck,
  };
}

// Entre os insumos criticos (risco >=75%), o gargalo principal e o de maior exposicao
// financeira real -- sem isso, um fluxo comercial irrisorio (poucos milhares de dolares)
// com HHI alto numa amostra estatisticamente fragil vencia um fluxo de centenas de
// milhoes so por multiplicar dependencia x HHI sem peso de materialidade. Sem nenhum
// insumo critico, cai para o desempate antigo por severidade x concentracao.
function topRiskInput(inputs: SolarInputMetric[]) {
  const critical = inputs.filter((input) => riskSignal(input) >= 0.75);
  if (critical.length) {
    return [...critical].sort(
      (left, right) => (right.imports_value_usd ?? 0) - (left.imports_value_usd ?? 0),
    )[0];
  }

  return [...inputs].sort((left, right) => {
    const leftScore = riskSignal(left) * Math.max(left.supplier_hhi_brazil, 1);
    const rightScore = riskSignal(right) * Math.max(right.supplier_hhi_brazil, 1);
    return rightScore - leftScore;
  })[0];
}

function apiBaseUrl() {
  return (
    process.env.BORDER_VALUE_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BORDER_VALUE_API_BASE_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}
