/**
 * Metadados de auditoria associados ao dado institucional utilizado pela
 * plataforma Border Value.
 */
export interface MetadadosAuditoria {
  /**
   * Ano de referencia da observacao ou consolidacao estatistica utilizada.
   */
  reference_year: number;

  /**
   * Nivel qualitativo de confianca do dado consolidado apos auditoria.
   */
  confidence_level: 'alta' | 'media' | 'baixa';

  /**
   * Indica se o codigo NCM representa uma categoria generica ou residual.
   */
  is_ncm_generica: boolean;

  /**
   * Indica se ha restricao de sigilo estatistico associada aos dados da PIA.
   */
  has_sigilo_pia: boolean;

  /**
   * Versao da metodologia institucional aplicada na construcao do indicador.
   */
  metodologia_versao: string;
}

/**
 * Indicadores de comercio exterior associados a um produto conceitual.
 */
export interface FluxoComercial {
  /**
   * Valor FOB total das importacoes, na moeda de referencia da base oficial.
   */
  importacao_valor_fob: number;

  /**
   * Peso liquido total das importacoes.
   */
  importacao_peso_liquido: number;

  /**
   * Valor FOB total das exportacoes, na moeda de referencia da base oficial.
   */
  exportacao_valor_fob: number;

  /**
   * Peso liquido total das exportacoes.
   */
  exportacao_peso_liquido: number;

  /**
   * Diferenca entre importacoes e exportacoes em valor FOB.
   */
  deficit_comercial: number;

  /**
   * Principal pais de origem das importacoes do produto.
   */
  principal_pais_origem: string;

  /**
   * Participacao fracionaria do principal pais de origem no fluxo importado.
   */
  principal_pais_participacao: number;

  /**
   * Indice Herfindahl-Hirschman global para concentracao das origens comerciais.
   */
  hhi_global: number;
}

/**
 * Indicadores de estrutura produtiva domestica associados a um produto
 * conceitual.
 */
export interface EstruturaDomestica {
  /**
   * Codigo CNAE vinculado a atividade produtiva domestica predominante.
   */
  cnae_codigo: string;

  /**
   * Codigo PRODLIST associado ao produto industrial domestico correspondente.
   */
  prodlist_codigo: string;

  /**
   * Valor da producao industrial observado na PIA para o recorte mapeado.
   */
  valor_producao_pia: number;

  /**
   * Estimativa de consumo aparente do produto no mercado domestico.
   */
  consumo_aparente: number;

  /**
   * Fracao do consumo aparente atendida por fontes externas.
   */
  dependencia_externa_fracao: number;

  /**
   * Quantidade de vinculos formais RAIS associados a estrutura produtiva.
   */
  qtde_vinculos_rais: number;

  /**
   * Massa salarial RAIS associada aos vinculos formais do recorte produtivo.
   */
  massa_salarial_rais: number;
}

/**
 * Produto analitico agregado pela plataforma Border Value, conectando comercio
 * exterior, industria domestica e metadados de auditoria.
 */
export interface ProdutoConceitual {
  /**
   * Identificador institucional unico do produto conceitual.
   */
  conceptual_product_id: string;

  /**
   * Nome padronizado do produto exibido nas camadas analiticas da plataforma.
   */
  produto_nome: string;

  /**
   * Cadeia prioritaria de politica industrial ou transicao energetica.
   */
  cadeia_prioritaria:
    | 'fertilizantes'
    | 'combustiveis_transicao'
    | 'aco'
    | 'silicio';

  /**
   * Etapa da cadeia de valor em que o produto conceitual se posiciona.
   */
  chain_stage: 'insumo' | 'processamento' | 'produto_final' | 'equipamento';

  /**
   * Codigo NCM principal utilizado no mapeamento do produto conceitual.
   */
  ncm_codigo: string;

  /**
   * Bloco de indicadores de comercio exterior do produto.
   */
  comercio: FluxoComercial;

  /**
   * Bloco de indicadores de estrutura produtiva domestica do produto.
   */
  industria: EstruturaDomestica;

  /**
   * Metadados de auditoria que documentam qualidade, ano e metodologia do dado.
   */
  auditoria: MetadadosAuditoria;

  /**
   * Parametros do fator de proporcionalidade aplicado para compatibilizar
   * proxies produtivas, comerciais ou setoriais.
   */
  fator_proporcionalidade: {
    /**
     * Indica se houve aplicacao efetiva do fator de proporcionalidade.
     */
    aplicado: boolean;

    /**
     * Valor numerico do fator alpha usado no ajuste proporcional.
     */
    fator_alpha: number;

    /**
     * Fonte ou criterio de proxy utilizado para estimar o fator proporcional.
     */
    fonte_proxy: string;
  };
}

/**
 * Payload institucional de referencia usado para orientar os proximos modulos.
 *
 * Observacoes de escala:
 * - `importacao_valor_fob` esta em valor absoluto de USD FOB; neste exemplo,
 *   2.449.195.653 equivale a aproximadamente US$ 2,45 bilhoes.
 * - `principal_pais_participacao` esta em fracao; 0.9982 equivale a 99,82%.
 */
export const produtoConceitualPayloadReferencia = {
  "conceptual_product_id": "fert-kcl-310420",
  "produto_nome": "Cloreto de Potassio",
  "cadeia_prioritaria": "fertilizantes",
  "chain_stage": "insumo",
  "ncm_codigo": "31042090",
  "comercio": {
    "importacao_valor_fob": 2449195653,
    "importacao_peso_liquido": 7297288091,
    "exportacao_valor_fob": 7927187,
    "exportacao_peso_liquido": 15018165,
    "deficit_comercial": 2441268466,
    "principal_pais_origem": "Canada",
    "principal_pais_participacao": 0.9982,
    "hhi_global": 0.9964,
  },
  "industria": {
    "cnae_codigo": "2012",
    "prodlist_codigo": "2012.2060",
    "valor_producao_pia": 1245267982.189208,
    "consumo_aparente": 3686536448.189208,
    "dependencia_externa_fracao": 0.66,
    "qtde_vinculos_rais": 0,
    "massa_salarial_rais": 0,
  },
  "auditoria": {
    "reference_year": 2026,
    "confidence_level": "alta",
    "is_ncm_generica": true,
    "has_sigilo_pia": false,
    "metodologia_versao": "border-value-piloto-fertilizantes-v1",
  },
  "fator_proporcionalidade": {
    "aplicado": true,
    "fator_alpha": 1,
    "fonte_proxy": "PIA-Produto 2024 / PRODLIST 2012.2060",
  },
} satisfies ProdutoConceitual;
