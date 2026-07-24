import type { ConceptualProduct } from "../components/ConceptualProductCard";
import type { ProdutoConceitual } from "../types/border-value";

const chainLabels: Record<ProdutoConceitual["cadeia_prioritaria"], string> = {
  fertilizantes: "Fertilizantes",
  combustiveis_transicao: "Combustiveis de transicao",
  aco: "Minerais criticos",
  silicio: "Minerais criticos",
};

const stageLabels: Record<ProdutoConceitual["chain_stage"], string> = {
  insumo: "Insumo",
  processamento: "Processamento",
  produto_final: "Produto final",
  equipamento: "Equipamento",
};

const confidenceLevels: Record<
  ProdutoConceitual["auditoria"]["confidence_level"],
  ConceptualProduct["metrics"]["confidenceLevel"]
> = {
  alta: "high",
  media: "medium",
  baixa: "low",
};

export function toConceptualProduct(product: ProdutoConceitual): ConceptualProduct {
  return {
    id: product.conceptual_product_id,
    name: product.produto_nome,
    shortDescription: buildDescription(product),
    chain: chainLabels[product.cadeia_prioritaria],
    productionStage: stageLabels[product.chain_stage],
    metrics: {
      imports: product.comercio.importacao_valor_fob,
      exports: product.comercio.exportacao_valor_fob,
      externalDependency: toPercent(product.industria.dependencia_externa_fracao),
      hhi: Math.round(product.comercio.hhi_global),
      mainSupplier: {
        country: product.comercio.principal_pais_origem,
        share: toPercent(product.comercio.principal_pais_participacao),
      },
      confidenceLevel: confidenceLevels[product.auditoria.confidence_level],
    },
    technicalCodes: {
      hs: product.ncm_codigo ? [product.ncm_codigo.slice(0, 6)] : [],
      ncm: product.ncm_codigo ? [product.ncm_codigo] : [],
      cnae: product.industria.cnae_codigo ? [product.industria.cnae_codigo] : [],
      prodlist: product.industria.prodlist_codigo && product.industria.prodlist_codigo !== "00000000"
        ? [product.industria.prodlist_codigo]
        : [],
    },
    sources: [
      `API Published ${product.auditoria.reference_year}`,
      "Comex Stat / PIA-Produto / RAIS",
    ],
    methodology: product.auditoria.metodologia_versao,
  };
}

function buildDescription(product: ProdutoConceitual) {
  const dependency = toPercent(product.industria.dependencia_externa_fracao);
  const supplier = product.comercio.principal_pais_origem.trim() || "fornecedor nao informado";

  return `${stageLabels[product.chain_stage]} com ${dependency}% de dependencia externa e principal origem em ${supplier}.`;
}

function toPercent(value: number) {
  return Math.round(Math.min(Math.max(value, 0), 1) * 100);
}
