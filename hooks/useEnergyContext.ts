"use client";

import useSWR from "swr";
import type { EnergyContextResponse } from "../types/energy-context";

const fetcher = async (url: string): Promise<EnergyContextResponse> => {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Não foi possível carregar o contexto energético nacional (BEN/EPE).");
  return response.json() as Promise<EnergyContextResponse>;
};

export function useEnergyContext(chain?: string | null) {
  return useSWR<EnergyContextResponse>(
    chain ? `/api/energy-context/${encodeURIComponent(chain)}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}
