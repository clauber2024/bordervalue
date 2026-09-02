"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronRight, Compass } from "lucide-react";
import { EPLUS_SHELL_HEIGHT_PX } from "../lib/eplusShell";

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

/** Roughly matches the page's own scroll-mt-40 (160px) sticky-header offset, plus a small
 * margin, plus the sticky institutional band above the header (EPLUS_SHELL_HEIGHT_PX). */
const SCROLLSPY_OFFSET_PX = 170 + EPLUS_SHELL_HEIGHT_PX;

export function ChainAnalysesMap({ items, onSelect }: ChainAnalysesMapProps) {
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Scrollspy: exactly one pill -- whichever section is currently at the top of the
  // viewport -- gets the active highlight, instead of a static per-type color.
  useEffect(() => {
    if (!items.length) return;

    const updateActiveSection = () => {
      const currentItems = itemsRef.current;
      let current: string | null = currentItems[0]?.id ?? null;
      for (const item of currentItems) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= SCROLLSPY_OFFSET_PX) {
          current = item.id;
        }
      }
      setActiveSectionId(current);
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateActiveSection();
        ticking = false;
      });
    };

    updateActiveSection();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);

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
      <div className="grid grid-cols-[minmax(140px,auto)_1fr] items-start gap-x-3 gap-y-2.5 sm:grid-cols-[180px_1fr]">
        {groups.map(({ group, items: groupItems }) => (
          <Fragment key={group}>
            <span className="pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              {GROUP_LABELS[group]}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {groupItems.map((item) => {
                const isActive = activeSectionId === item.id;
                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() => onSelect(item.id, Boolean(item.requiresAnalytical))}
                      onMouseEnter={() => setActiveTooltipId(item.id)}
                      onMouseLeave={() => setActiveTooltipId((current) => (current === item.id ? null : current))}
                      onFocus={() => setActiveTooltipId(item.id)}
                      onBlur={() => setActiveTooltipId((current) => (current === item.id ? null : current))}
                      aria-describedby={`${item.id}-map-tooltip`}
                      aria-current={isActive ? "location" : undefined}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                          : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100"
                      }`}
                    >
                      {item.kind === "aprofundamento" ? (
                        <ChevronRight className="h-3 w-3 shrink-0 text-zinc-500" />
                      ) : null}
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
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>
    </nav>
  );
}

export default ChainAnalysesMap;
