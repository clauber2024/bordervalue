"use client";

import { Info } from "lucide-react";
import type { EnergyContextResponse } from "../types/energy-context";

type EnergyContextBenPanelProps = {
  data: EnergyContextResponse;
};

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function EnergyContextBenPanel({ data }: EnergyContextBenPanelProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-sky-300/15 bg-zinc-950/65 text-zinc-100">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] bg-sky-400/[0.035] px-4 py-5 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
            Balanço Energético Nacional · EPE · {data.ano_selecionado}
          </p>
          <h3 className="mt-2 text-xl font-bold text-white">Contexto Energético Nacional</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
            Consumo/oferta de energia por fonte no setor do BEN mais próximo desta cadeia, referência nacional da EPE.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-sky-300/30 bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">
          Granularidade nacional/anual
        </span>
      </header>

      <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-2">
        {data.blocos.map((bloco) => {
          const itensOrdenados = [...bloco.itens].sort((a, b) => b.valor - a.valor);
          const maxValor = Math.max(...itensOrdenados.map((item) => item.valor), 1);
          return (
            <div key={bloco.setor_ben}>
              <h4 className="text-sm font-semibold text-white">{titleCase(bloco.setor_ben)}</h4>
              <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                Unidade: {bloco.unidade}
              </p>
              <div className="mt-4 space-y-3">
                {itensOrdenados.map((item) => {
                  const isTotal = item.fonte_energetica.trim().toUpperCase() === "TOTAL";
                  return (
                    <div key={item.fonte_energetica}>
                      <div className="mb-1.5 flex items-end justify-between gap-4 text-xs">
                        <span className={`font-medium ${isTotal ? "text-sky-200" : "text-zinc-300"}`}>
                          {titleCase(item.fonte_energetica)}
                        </span>
                        <span className={`shrink-0 font-semibold ${isTotal ? "text-sky-300" : "text-zinc-400"}`}>
                          {decimal.format(item.valor)}
                        </span>
                      </div>
                      <div className={`h-2 overflow-hidden rounded-full bg-zinc-900 ${isTotal ? "ring-1 ring-sky-300/60" : ""}`}>
                        <div
                          className={`h-full rounded-full ${isTotal ? "bg-sky-300" : "bg-sky-500/70"}`}
                          style={{ width: `${Math.max((item.valor / maxValor) * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 border-t border-amber-300/15 bg-amber-400/[0.05] px-4 py-4 text-xs leading-5 text-zinc-400 sm:px-6">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <p>
          <strong className="text-amber-200">Fonte:</strong> {data.fonte_citacao}. Referência nacional e anual da
          EPE — não é cruzada linha a linha com os dados municipais/NCM desta plataforma; use como contexto
          setorial, não como parte do cálculo de soberania.
        </p>
      </div>
    </section>
  );
}

function titleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/(^|\s|-)\p{L}/gu, (match) => match.toUpperCase());
}

export default EnergyContextBenPanel;
