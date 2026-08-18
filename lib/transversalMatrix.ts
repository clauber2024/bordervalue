import type { ProdutoConceitual } from "../types/border-value";

export type MonitoredChain = "silicio" | "fertilizantes" | "combustiveis_transicao" | "aco";

export const MONITORED_CHAINS: readonly MonitoredChain[] = [
  "silicio",
  "fertilizantes",
  "combustiveis_transicao",
  "aco",
];

export const CHAIN_META: Record<MonitoredChain, { label: string; shortLabel: string; color: string }> = {
  silicio: { label: "Silício / Solar Fotovoltaica", shortLabel: "Silício/Solar", color: "#fbbf24" },
  fertilizantes: { label: "Fertilizantes Estratégicos", shortLabel: "Fertilizantes", color: "#38bdf8" },
  combustiveis_transicao: { label: "Biocombustíveis / SAF", shortLabel: "Biocombustíveis/SAF", color: "#34d399" },
  aco: { label: "Aço Verde e Materiais Estratégicos", shortLabel: "Aço Verde", color: "#a78bfa" },
};

export type QuadrantId = "atrair" | "modernizar" | "zona_segura";

export const QUADRANT_META: Record<QuadrantId, { label: string; description: string; tone: string }> = {
  atrair: {
    label: "Atrair Investimento",
    description: "Alta dependência externa, produção nacional incipiente ou nula.",
    tone: "border-red-400/25 bg-red-400/10 text-red-200",
  },
  modernizar: {
    label: "Modernizar / Expandir",
    description: "Alta dependência externa, mas já existe base produtiva nacional instalada.",
    tone: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  },
  zona_segura: {
    label: "Zona Segura & Competitiva",
    description: "Baixa dependência externa e produção doméstica consolidada.",
    tone: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  },
};

// Mesmos cortes usados pelo NIBMatrixChart de cada cadeia (components/NIBMatrixChart.tsx) --
// reaproveitados aqui para manter a mesma leitura de "alta capacidade" / "alto risco" ao
// consolidar as 4 cadeias num unico plano, em vez de inventar um novo criterio.
export const CAPACITY_THRESHOLD_BRL = 30_000_000;
export const RISK_THRESHOLD_USD = 100_000_000;
export const HHI_EXTREME_THRESHOLD = 1800;

// O eixo Y consolida exposicao FOB e deficit num unico sinal de risco (o HHI aparece
// separadamente como badge na lista, nao como posicao no eixo -- ver Modulo 2 da spec).
export function riskExposure(item: ProdutoConceitual): number {
  return Math.max(item.comercio.deficit_comercial, item.comercio.importacao_valor_fob, 0);
}

export function classifyQuadrant(item: ProdutoConceitual): QuadrantId {
  const highCapacity = item.industria.valor_producao_pia >= CAPACITY_THRESHOLD_BRL;
  const highRisk = riskExposure(item) >= RISK_THRESHOLD_USD;

  if (highRisk && !highCapacity) return "atrair";
  if (highRisk && highCapacity) return "modernizar";
  return "zona_segura";
}

export function isExtremeBottleneck(item: ProdutoConceitual): boolean {
  return item.comercio.hhi_global > HHI_EXTREME_THRESHOLD;
}

// conceptual_product_id so garante unicidade dentro de uma unica cadeia -- ao consolidar
// as 4 cadeias no mesmo plano, IDs iguais podem colidir entre cadeias diferentes. Toda
// chave de lista, selecao e sincronizacao lista<->grafico usa esta chave composta.
export function uniqueProductKey(item: ProdutoConceitual): string {
  return `${item.cadeia_prioritaria}:${item.conceptual_product_id}`;
}
