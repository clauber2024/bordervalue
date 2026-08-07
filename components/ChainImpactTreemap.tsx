"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { buildShareColorScale, VIRIDIS_REVERSED_GRADIENT_CSS } from "../lib/colorScale";
import type { ProdutoConceitual } from "../types/border-value";

type ChainImpactTreemapProps = {
  data: ProdutoConceitual[];
  className?: string;
  height?: number;
};

type TreemapDatum = {
  id: string;
  name: string;
  value: number;
  share: number;
  rank: number;
  fill: string;
};

type TreemapContentProps = TreemapDatum & {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  index?: number;
};

type TreemapTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload?: TreemapDatum;
  }>;
};

const shell =
  "border border-zinc-800/70 bg-zinc-950/90 shadow-2xl shadow-black/45 backdrop-blur-xl";

const usdCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const percent = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export function ChainImpactTreemap({
  data,
  className = "",
  height = 380,
}: ChainImpactTreemapProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showInfo, setShowInfo] = useState(true);

  const treemapData = useMemo<TreemapDatum[]>(() => {
    const total = data.reduce((sum, product) => sum + Math.max(product.comercio.importacao_valor_fob, 0), 0);

    const items = data
      .map((product) => {
        const value = Math.max(product.comercio.importacao_valor_fob, 0);

        return {
          id: product.conceptual_product_id,
          name: executiveLabel(product.produto_nome),
          value,
          share: total > 0 ? value / total : 0,
        };
      })
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value);

    const colorScale = buildShareColorScale(items.map((item) => item.share));

    return items.map((item, index) => ({
      ...item,
      rank: index + 1,
      fill: colorScale.colorFor(item.share),
    }));
  }, [data]);

  const totalImports = treemapData.reduce((sum, item) => sum + item.value, 0);

  function selectProduct(productId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("product", productId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (!treemapData.length) {
    return (
      <section className={`${shell} rounded-lg p-6 text-sm text-zinc-400 ${className}`}>
        Nenhum fluxo de importação disponível para a exploração de impacto.
      </section>
    );
  }

  return (
    <section className={`${shell} overflow-hidden rounded-lg text-zinc-100 ${className}`}>
      <header className="border-b border-zinc-800/70 bg-white/[0.025] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Exploração de impacto
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white">
              Peso relativo dos produtos na cadeia
            </h2>
          </div>
          <MetricPill label="Total importado" value={usdCompact.format(totalImports)} />
        </div>
      </header>

      <div className="flex flex-col gap-3 border-b border-zinc-800/70 px-4 py-4 sm:px-6 lg:flex-row lg:items-start">
        <div className="flex-1 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-4 text-xs leading-5 text-zinc-300">
          <p>
            As cores mostram a <strong className="text-zinc-100">participação relativa de valor</strong>{" "}
            de cada produto no total importado da cadeia. Calculamos: (1){" "}
            <strong className="text-zinc-100">share</strong> = valor importado do produto ÷ soma dos
            valores importados de todos os produtos exibidos, (2){" "}
            <strong className="text-zinc-100">cor</strong> = log10(share + 1e-6), recortado entre os
            percentis 5–95 e mapeado numa escala Viridis invertida (amarelo = baixo, roxo = alto). O{" "}
            <strong className="text-zinc-100">rank</strong> é baseado no valor importado (1 = maior)
            {showInfo ? null : "."}
          </p>
          {showInfo ? (
            <p className="mt-2">
              Retângulos maiores concentram mais valor; a cor reforça essa hierarquia mesmo quando dois
              retângulos têm tamanhos parecidos.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setShowInfo((value) => !value)}
            className="mt-2 font-semibold text-emerald-400 hover:text-emerald-300"
          >
            {showInfo ? "Mostrar menos" : "Mostrar mais"}
          </button>
        </div>

        <div className="w-full rounded-lg border border-zinc-800/70 bg-white/[0.03] p-4 text-xs text-zinc-300 lg:w-64">
          <p className="font-semibold text-zinc-100">Cor = participação relativa de valor</p>
          <div className="mt-3 h-2 w-full rounded-full" style={{ background: VIRIDIS_REVERSED_GRADIENT_CSS }} />
          <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
            <span>baixo</span>
            <span>alto</span>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">(P5–P95, log-scaled)</p>
        </div>
      </div>

      <div className="px-2 py-5 sm:px-4">
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapData}
              dataKey="value"
              nameKey="name"
              aspectRatio={4 / 3}
              stroke="rgba(9,9,11,0.86)"
              fill="#22d3ee"
              content={<TreemapTile onSelect={selectProduct} />}
            >
              <Tooltip content={<ImpactTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>

        <p className="mt-4 max-w-3xl text-xs leading-5 text-zinc-400">
          Clique em um retângulo para filtrar a página por produto e compartilhar a leitura pela URL.
        </p>
      </div>
    </section>
  );
}

function TreemapTile({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  id,
  name,
  share,
  fill,
  onSelect,
}: Partial<TreemapContentProps> & { onSelect?: (productId: string) => void }) {
  if (!id || !name || !onSelect) return null;

  const showLabel = width > 92 && height > 46;
  const showShare = width > 118 && height > 70;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Filtrar por ${name}`}
      className="cursor-pointer outline-none"
      onClick={() => onSelect(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(id);
        }
      }}
    >
      <rect
        x={x}
        y={y}
        width={Math.max(width, 0)}
        height={Math.max(height, 0)}
        rx={6}
        fill={fill}
        fillOpacity={0.2}
        stroke={fill}
        strokeOpacity={0.62}
      />
      <rect
        x={x + 3}
        y={y + 3}
        width={Math.max(width - 6, 0)}
        height={Math.max(height - 6, 0)}
        rx={5}
        fill="rgba(255,255,255,0.055)"
      />
      {showLabel ? (
        <>
          <text x={x + 10} y={y + 22} fill="#fafafa" fontSize={12} fontWeight={700}>
            {compactLabel(name, width)}
          </text>
          {showShare ? (
            <text x={x + 10} y={y + 42} fill="#d4d4d8" fontSize={11} fontWeight={500}>
              {percent.format(share * 100)}% do total importado
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

function ImpactTooltip({ active, payload }: TreemapTooltipProps) {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;
  if (!item) return null;

  return (
    <div className="max-w-80 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-100 shadow-xl">
      <p className="font-semibold text-white">{item.name}</p>
      <p className="mt-2 leading-5 text-zinc-300">
        Este valor representa {percent.format(item.share * 100)}% do total importado da cadeia.
      </p>
      <p className="mt-2 text-zinc-500">Valor importado: {usdCompact.format(item.value)}</p>
      <p className="text-zinc-500">Rank: {item.rank}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-fit rounded-lg border border-zinc-800/70 bg-white/[0.04] px-3 py-2 text-xs">
      <span className="block font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</span>
      <strong className="mt-1 block text-sm font-semibold text-zinc-100">{value}</strong>
    </div>
  );
}

function executiveLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "NCM_SEM_PONTE" || trimmed === "NAO_MAPEADO") {
    return "Produto não informado";
  }
  return trimmed;
}

function compactLabel(value: string, width: number) {
  const maxChars = Math.max(Math.floor(width / 7.2), 8);
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(maxChars - 3, 5)).trim()}...`;
}

export default ChainImpactTreemap;
