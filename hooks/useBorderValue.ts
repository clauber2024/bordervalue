"use client";

import useSWR from "swr";
import type { KeyedMutator } from "swr";
import { apiRoutes } from "../lib/apiRoutes";
import type { ProdutoConceitual } from "../types/border-value";

export type BorderValueApiError = Error & {
  status: number;
  statusText: string;
  endpoint: string;
  chainName: string;
  detail?: unknown;
  userMessage: string;
};

export type UseBorderValueResult = {
  data?: ProdutoConceitual[];
  error?: BorderValueApiError;
  isLoading: boolean;
  isValidating: boolean;
  mutate: KeyedMutator<ProdutoConceitual[]>;
};

type ApiErrorPayload = {
  detail?: unknown;
  message?: string;
  error?: string;
};

const swrOptions = {
  revalidateOnFocus: false,
  keepPreviousData: true,
};

export function useBorderValue(chainName?: string): UseBorderValueResult {
  const normalizedChainName = chainName?.trim();
  const endpoint = normalizedChainName
    ? apiRoutes.chain(normalizedChainName)
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    ProdutoConceitual[],
    BorderValueApiError
  >(
    endpoint ? [endpoint, normalizedChainName] : null,
    ([url, currentChainName]: [string, string]) =>
      fetchBorderValue(url, currentChainName),
    swrOptions,
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}

async function fetchBorderValue(endpoint: string, chainName: string) {
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await toBorderValueError(response, endpoint, chainName);
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw createBorderValueError({
      status: 500,
      statusText: "Invalid API payload",
      endpoint,
      chainName,
      detail: payload,
      message: "A API retornou um payload inesperado para esta cadeia.",
    });
  }

  return payload as ProdutoConceitual[];
}

async function toBorderValueError(
  response: Response,
  endpoint: string,
  chainName: string,
): Promise<BorderValueApiError> {
  const payload = await parseErrorPayload(response);
  const detail = payload?.detail ?? payload?.message ?? payload?.error;

  return createBorderValueError({
    status: response.status,
    statusText: response.statusText,
    endpoint,
    chainName,
    detail,
    message: getUserMessage(response.status, detail),
  });
}

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload | undefined> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return undefined;
  }
}

function createBorderValueError({
  status,
  statusText,
  endpoint,
  chainName,
  detail,
  message,
}: {
  status: number;
  statusText: string;
  endpoint: string;
  chainName: string;
  detail?: unknown;
  message: string;
}): BorderValueApiError {
  const error = new Error(message) as BorderValueApiError;
  error.name = "BorderValueApiError";
  error.status = status;
  error.statusText = statusText;
  error.endpoint = endpoint;
  error.chainName = chainName;
  error.detail = detail;
  error.userMessage = message;
  return error;
}

function getUserMessage(status: number, detail: unknown) {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (status === 404) {
    return "Cadeia inexistente ou sem dados publicados.";
  }

  if (status >= 500) {
    return "Falha ao carregar os dados consolidados da cadeia.";
  }

  return "Nao foi possivel carregar os dados da cadeia.";
}
