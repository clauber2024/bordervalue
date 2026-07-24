import type { ProdutoConceitual } from "../types/border-value";
import type { QueryParams } from "./apiRoutes";

export type PublishedProduct = ProdutoConceitual & {
  metadata_api?: {
    timestamp_requisicao: string;
    engine_version: string;
  };
};

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 2500;

export const publishedChains = [
  "fertilizantes",
  "combustiveis_transicao",
  "aco",
  "silicio",
] as const;

export async function fetchPublishedChain(
  chainName: string,
  params?: QueryParams | URLSearchParams,
): Promise<PublishedProduct[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const query = toSearchParams(params);
  const queryString = query.toString();

  try {
    const response = await fetch(
      `${publishedApiBaseUrl()}/api/chain/${encodeURIComponent(chainName)}${queryString ? `?${queryString}` : ""}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Published API returned ${response.status} for ${chainName}`);
    }

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      throw new Error(`Published API returned an invalid payload for ${chainName}`);
    }

    return payload as PublishedProduct[];
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPublishedChains(
  chainNames: readonly string[],
  params?: QueryParams | URLSearchParams,
) {
  const responses = await Promise.all(chainNames.map((chainName) => fetchPublishedChain(chainName, params)));
  return responses.flat();
}

function publishedApiBaseUrl() {
  return (
    process.env.BORDER_VALUE_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BORDER_VALUE_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  ).replace(/\/$/, "");
}

function toSearchParams(params?: QueryParams | URLSearchParams) {
  if (!params) return new URLSearchParams();
  if (params instanceof URLSearchParams) return params;

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "" || value === "all") return;
    query.set(key, String(value));
  });
  return query;
}
