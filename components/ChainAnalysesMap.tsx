"use client";

import { useState } from "react";
import { Compass } from "lucide-react";

export type ChainAnalysesMapItem = {
  id: string;
  label: string;
  /** One-line summary of what's in the section, shown as a hover tooltip so people know what they'll find before clicking. */
  description: string;
  /** "essencial" renders always visible on load; "aprofundamento" is collapsed by default and reached via this map. */
  kind: "essencial" | "aprofundamento";
  /** Section only exists in the DOM in "Análises avançadas" -- jump must switch mode first. */
  requiresAnalytical?: boolean;
  /** Mirrors the page's own Macro-módulo 1/2/3 sections, so the map groups items the same way the page itself is organized instead of one flat row. */
  group: "modulo1" | "modulo2" | "modulo3";
};

type ChainAnalysesMapProps = {
  items: ChainAnalysesMapItem[];
  onSelect: (id: string, requiresAnalytical: boolean) => void;
};

const GROUP_LABELS: Record<ChainAnalysesMapItem["group"], string> = {
  modulo1: "Módulo 1 · Soberania e balança",
  modulo2: "Módulo 2 · Política industrial",
  modulo3: "Módulo 3 · Dados primários",
};

const GROUP_ORDER: ChainAnalysesMapItem["group"][] = ["modulo1", "modulo2", "modulo3"];

export function ChainAnalysesMap({ items, onSelect }: ChainAnalysesMapProps) {
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  if (!items.length) return null;

  const groups = GROUP_ORDER
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);

  return (
    <nav
      aria-label="Mapa de análises da cadeia"
      className="border-t border-white/[0.08] pt-2"
    >
      <span className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        <Compass className="h-3.5 w-3.5" />
        Mapa de análises
      </span>
      <div className="flex flex-col gap-2">
        {groups.map(({ group, items: groupItems }) => (
          <div key={group} className="flex flex-wrap items-center gap-2">
            <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              {GROUP_LABELS[group]}
            </span>
            {groupItems.map((item) => (
              <div key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => onSelect(item.id, Boolean(item.requiresAnalytical))}
                  onMouseEnter={() => setActiveTooltipId(item.id)}
                  onMouseLeave={() => setActiveTooltipId((current) => (current === item.id ? null : current))}
                  onFocus={() => setActiveTooltipId(item.id)}
                  onBlur={() => setActiveTooltipId((current) => (current === item.id ? null : current))}
                  aria-describedby={`${item.id}-map-tooltip`}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    item.kind === "essencial"
                      ? "border-emerald-300/20 bg-emerald-400/[0.06] text-emerald-200 hover:border-emerald-300/40 hover:bg-emerald-400/10"
                      : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100"
                  }`}
                >
                  {item.label}
                </button>
                <div
                  id={`${item.id}-map-tooltip`}
                  role="tooltip"
                  data-open={activeTooltipId === item.id}
                  className={`pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-60 -translate-x-1/2 rounded-lg border border-white/10 bg-zinc-950/95 p-2.5 text-left text-[11px] leading-snug text-zinc-300 shadow-2xl backdrop-blur-xl transition-opacity duration-150 ${
                    activeTooltipId === item.id ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {item.description}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

export default ChainAnalysesMap;
