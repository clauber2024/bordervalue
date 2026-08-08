"use client";

import useSWR from "swr";
import type { SolarSovereigntyResponse } from "../types/solar-sovereignty";

const fetcher = async (url: string): Promise<SolarSovereigntyResponse> => {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Não foi possível carregar as métricas setoriais de soberania.");
  return response.json() as Promise<SolarSovereigntyResponse>;
};

export function useSolarSovereignty(chain?: string | null) {
  return useSWR<SolarSovereigntyResponse>(
    chain ? `/api/networks/sovereignty/inputs?chain=${encodeURIComponent(chain)}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}
