const VIRIDIS_REVERSED_HEX = [
  "#fde725",
  "#b5de2b",
  "#6ece58",
  "#35b779",
  "#1f9e89",
  "#26828e",
  "#31688e",
  "#3e4989",
  "#482878",
  "#440154",
] as const;

const VIRIDIS_REVERSED_STOPS: Array<[number, number, number]> = VIRIDIS_REVERSED_HEX.map((hex) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
});

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function reversedViridis(t: number): string {
  const clamped = Math.min(Math.max(t, 0), 1);
  const scaled = clamped * (VIRIDIS_REVERSED_STOPS.length - 1);
  const index = Math.min(Math.floor(scaled), VIRIDIS_REVERSED_STOPS.length - 2);
  const localT = scaled - index;
  const [r1, g1, b1] = VIRIDIS_REVERSED_STOPS[index];
  const [r2, g2, b2] = VIRIDIS_REVERSED_STOPS[index + 1];

  const r = Math.round(lerp(r1, r2, localT));
  const g = Math.round(lerp(g1, g2, localT));
  const b = Math.round(lerp(b1, b2, localT));
  return `rgb(${r}, ${g}, ${b})`;
}

export const VIRIDIS_REVERSED_GRADIENT_CSS = `linear-gradient(90deg, ${VIRIDIS_REVERSED_HEX.join(", ")})`;

function quantile(sortedAscending: number[], q: number): number {
  if (!sortedAscending.length) return 0;
  const pos = (sortedAscending.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedAscending[base + 1];
  return next !== undefined ? sortedAscending[base] + rest * (next - sortedAscending[base]) : sortedAscending[base];
}

const SHARE_EPSILON = 1e-6;

export type ShareColorScale = {
  domain: [number, number];
  colorFor: (share: number) => string;
};

/**
 * Colors a value by its share of a total: log10(share + eps), clipped to the
 * P5-P95 range of the domain, mapped onto a reversed Viridis scale (yellow =
 * low, purple = high). Mirrors the "relative value share" coloring used in
 * the trade treemap reference.
 */
export function buildShareColorScale(shares: number[]): ShareColorScale {
  const logValues = shares
    .map((share) => Math.log10(Math.max(share, 0) + SHARE_EPSILON))
    .sort((a, b) => a - b);

  const p5 = quantile(logValues, 0.05);
  const p95 = quantile(logValues, 0.95);
  const span = p95 - p5;

  return {
    domain: [p5, p95],
    colorFor(share: number) {
      const logValue = Math.log10(Math.max(share, 0) + SHARE_EPSILON);
      const t = span > 0 ? (logValue - p5) / span : 0.5;
      return reversedViridis(t);
    },
  };
}
