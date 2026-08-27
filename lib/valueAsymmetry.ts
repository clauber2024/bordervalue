import type { SiliconValueAsymmetry } from "../components/SiliconStrategicLevers";
import type { SolarInputMetric } from "../types/solar-sovereignty";

// Minimum traded weight before trusting a US$/kg figure -- thin flows
// (e.g. polissilicio_solar's 142kg import in 2026-H1) produce noisy,
// unrepresentative prices per kg.
const MIN_WEIGHT_KG_FOR_PRICE = 1000;

// Export/import input_id pair for the "Assimetria de valor por quilo" card,
// picked per chain from the real price-per-kg ratio (verified against
// Comex Stat, not guessed) -- see build_sector_sovereignty_metrics.py for
// the underlying input_ids. Not every chain has a clean "raw material
// Brazil exports vs. its own processed good Brazil reimports" pair the way
// silicio and aco do; combustiveis_transicao's pair below is a different
// kind of asymmetry (finished low-carbon fuel export vs. imported enabling
// technology), flagged via categoryNote so the card doesn't imply the same
// same-chain raw-to-processed story it isn't.
export const VALUE_ASYMMETRY_PAIRS: Record<string, { exportId: string; importId: string; categoryNote?: string }> = {
  silicio: { exportId: "silicio_grau_metalurgico", importId: "celulas_fotovoltaicas" },
  aco: { exportId: "minerio_ferro", importId: "tubos_aco" },
  fertilizantes: { exportId: "rocha_fosfatica", importId: "fosfato_monoamonico" },
  combustiveis_transicao: {
    exportId: "etanol",
    importId: "eletrolisadores",
    categoryNote: "Aqui a assimetria é entre um combustível pronto que o Brasil já exporta em escala e a tecnologia habilitadora (eletrolisadores) que a rota de hidrogênio ainda importa -- não matéria-prima crua vs. produto processado da mesma cadeia, como em silício ou aço.",
  },
};

// Shared by MainAnalyticalDashboard.tsx (per-chain deep-dive) and
// PowershoringShowcase.tsx (cross-chain synthesis) so both read the exact
// same ratio for a given chain instead of two independently-computed numbers.
export function buildValueAsymmetry(chainId: string, inputs: SolarInputMetric[]): SiliconValueAsymmetry | undefined {
  const pair = VALUE_ASYMMETRY_PAIRS[chainId];
  if (!pair) return undefined;
  const exportInput = inputs.find((input) => input.input_id === pair.exportId);
  const importInput = inputs.find((input) => input.input_id === pair.importId);
  if (!exportInput || !importInput) return undefined;
  if (exportInput.exports_net_weight_kg < MIN_WEIGHT_KG_FOR_PRICE) return undefined;
  if (importInput.imports_net_weight_kg < MIN_WEIGHT_KG_FOR_PRICE) return undefined;

  const exportPricePerKg = exportInput.exports_value_usd / exportInput.exports_net_weight_kg;
  const importPricePerKg = importInput.imports_value_usd / importInput.imports_net_weight_kg;
  if (exportPricePerKg <= 0 || importPricePerKg <= 0) return undefined;

  return {
    exportInputLabel: exportInput.label,
    exportPricePerKg,
    exportNcm: exportInput.ncm_codes[0],
    importInputLabel: importInput.label,
    importPricePerKg,
    importNcm: importInput.ncm_codes[0],
    ratio: importPricePerKg / exportPricePerKg,
    categoryNote: pair.categoryNote,
  };
}
