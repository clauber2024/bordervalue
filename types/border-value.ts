/**
 * Metadados de auditoria que acompanham cada produto conceitual.
 *
 * Use este bloco para exibir ano de referencia, qualidade do dado e alertas
 * metodologicos nos modulos premium de visualizacao.
 */
export interface MetadadosAuditoria {
  /**
   * Ano-base utilizado na consolidacao estatistica do registro.
   */
  reference_year: number;

  /**
   * Nivel qualitativo de confianca atribuido pela camada de inteligencia.
   */
  confidence_level: 'alta' | 'media' | 'baixa';

  /**
   * Indica se o codigo NCM representa uma categoria generica, residual ou ampla.
   */
  is_ncm_generica: boolean;

  /**
   * Indica se ha restricao de sigilo estatistico nos dados industriais da PIA.
   */
  has_sigilo_pia: boolean;

  /**
   * Versao da metodologia aplicada na geracao dos indicadores.
   */
  metodologia_versao: string;
}

/**
 * Indicadores de fluxo comercial internacional associados ao produto.
 *
 * Use este bloco para graficos de importacao, exportacao, deficit,
 * concentracao de origem e exposicao externa.
 */
export interface FluxoComercial {
  /**
   * Valor FOB total importado no ano de referencia.
   */
  importacao_valor_fob: number;

  /**
   * Peso liquido total importado no ano de referencia.
   */
  importacao_peso_liquido: number;

  /**
   * Valor FOB total exportado no ano de referencia.
   */
  exportacao_valor_fob: number;

  /**
   * Peso liquido total exportado no ano de referencia.
   */
  exportacao_peso_liquido: number;

  /**
   * Importacao menos exportacao em valor FOB.
   *
   * Pode ser negativo quando o produto apresenta superavit comercial.
   */
  deficit_comercial: number;

  /**
   * Pais com maior participacao na origem das importacoes.
   */
  principal_pais_origem: string;

  /**
   * Participacao do principal pais de origem no total importado.
   *
   * Deve ser interpretado como fracao, nao percentual formatado.
   */
  principal_pais_participacao: number;

  /**
   * Indice Herfindahl-Hirschman global de concentracao das origens comerciais.
   */
  hhi_global: number;
}

/**
 * Indicadores da estrutura produtiva domestica vinculada ao produto.
 *
 * Use este bloco para analises de producao nacional, consumo aparente, emprego
 * formal e dependencia externa.
 */
export interface EstruturaDomestica {
  /**
   * Codigo CNAE da atividade economica associada ao produto.
   */
  cnae_codigo: string;

  /**
   * Codigo PRODLIST usado para vincular o produto a producao industrial.
   */
  prodlist_codigo: string;

  /**
   * Valor da producao industrial observado ou estimado pela PIA.
   */
  valor_producao_pia: number;

  /**
   * Consumo aparente calculado para o mercado domestico.
   */
  consumo_aparente: number;

  /**
   * Fracao do consumo aparente atendida por importacoes.
   */
  dependencia_externa_fracao: number;

  /**
   * Quantidade de vinculos formais RAIS associados ao recorte produtivo.
   */
  qtde_vinculos_rais: number;

  /**
   * Massa salarial RAIS associada aos vinculos formais do recorte produtivo.
   */
  massa_salarial_rais: number;
}

/**
 * Produto conceitual consolidado pela plataforma Border Value.
 *
 * Esta e a unidade central para alimentar dashboards, cards estrategicos,
 * rankings setoriais e visualizacoes de cadeia produtiva.
 */
export interface ProdutoConceitual {
  /**
   * Identificador unico e estavel do produto conceitual.
   */
  conceptual_product_id: string;

  /**
   * Nome padronizado do produto para exibicao na interface.
   */
  produto_nome: string;

  /**
   * Cadeia prioritaria a qual o produto pertence.
   */
  cadeia_prioritaria: 'fertilizantes' | 'combustiveis_transicao' | 'aco' | 'silicio';

  /**
   * Posicao do produto na cadeia de valor.
   */
  chain_stage: 'insumo' | 'processamento' | 'produto_final' | 'equipamento';

  /**
   * Codigo NCM principal usado no mapeamento comercial do produto.
   */
  ncm_codigo: string;

  /**
   * Indicadores de comercio exterior vinculados ao produto.
   */
  comercio: FluxoComercial;

  /**
   * Indicadores da estrutura produtiva domestica vinculados ao produto.
   */
  industria: EstruturaDomestica;

  /**
   * Metadados de auditoria, rastreabilidade e qualidade metodologica.
   */
  auditoria: MetadadosAuditoria;

  /**
   * Parametros usados quando o backend aplica fator de proporcionalidade.
   */
  fator_proporcionalidade: {
    /**
     * Indica se o fator de proporcionalidade foi aplicado ao registro.
     */
    aplicado: boolean;

    /**
     * Valor do fator alpha usado para ajustar o indicador proporcionalmente.
     */
    fator_alpha: number;

    /**
     * Fonte, proxy ou criterio usado para estimar o fator de proporcionalidade.
     */
    fonte_proxy: string;
  };
}
