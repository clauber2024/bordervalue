// Mirrors routers/api.py's EnergyContextResponse. Sourced from the
// Balanço Energético Nacional (BEN, EPE) -- a national/annual reference,
// never cross-referenced row-by-row with the municipal Published data.
// See build_energy_context_ben.py for the extraction/mapping rationale.

export type EnergyContextItem = {
  fonte_energetica: string;
  valor: number;
};

export type EnergyContextBlock = {
  setor_ben: string;
  unidade: string;
  itens: EnergyContextItem[];
};

export type EnergyContextResponse = {
  chain_name: string;
  granularidade: "nacional_anual";
  fonte_citacao: string;
  ano_selecionado: number;
  anos_disponiveis: number[];
  blocos: EnergyContextBlock[];
};
