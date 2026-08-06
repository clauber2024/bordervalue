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

function aggregateInputs(payload: SolarSovereigntyResponse) {
  const inputs = payload.inputs ?? [];
  const dependencyValues = inputs
    .map((input) => input.external_dependency ?? input.global_china_share)
    .filter((value): value is number => value !== null && value !== undefined);

  const totalImportsUsd = inputs.reduce((sum, input) => sum + (input.imports_value_usd ?? 0), 0);
  const totalExportsUsd = inputs.reduce((sum, input) => sum + (input.exports_value_usd ?? 0), 0);
  const avgDependency = dependencyValues.length
    ? dependencyValues.reduce((sum, value) => sum + value, 0) / dependencyValues.length
    : undefined;
  const criticalCount = inputs.filter(
    (input) => (input.external_dependency ?? input.global_china_share ?? 0) >= 0.75,
  ).length;
  const topBottleneck = topRiskInput(inputs)?.label;

  return {
    referencePeriod: payload.reference_period,
    totalImportsUsd,
    totalExportsUsd,
    avgDependency,
    criticalCount,
    inputsCount: inputs.length,
    topBottleneck,
  };
}

function topRiskInput(inputs: SolarInputMetric[]) {
  return [...inputs].sort((left, right) => {
    const leftScore = (left.external_dependency ?? left.global_china_share ?? 0) * Math.max(left.supplier_hhi_brazil, 1);
    const rightScore = (right.external_dependency ?? right.global_china_share ?? 0) * Math.max(right.supplier_hhi_brazil, 1);
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
