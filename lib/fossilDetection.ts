// Products whose trade numbers alone (high deficit, low domestic capacity) would
// read as "attract investment" but whose underlying commodity is fossil -- for
// those, the right recommendation is to substitute/decarbonize the route, never
// to attract investment into expanding fossil production or import volume.
// Name-based detection because production_route_class (already tracked per
// Definition() in the Python catalog) doesn't reach ProdutoConceitual/the
// Published API yet. Same pattern VulnerabilityChart.tsx already uses in
// criticalActionLabel() for the equivalent problem on the per-chain view.
const FOSSIL_NAME_PATTERN = /gas natural|petrole|petroquim|nafta|carvao mineral|coque fossil/;

export function isFossilLinkedName(name: string): boolean {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return FOSSIL_NAME_PATTERN.test(normalized);
}
