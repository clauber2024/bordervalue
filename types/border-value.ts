/**
 * Metadados de auditoria que acompanham cada produto conceitual retornado pela API Published.
 *
 * Este bloco deve orientar badges, notas metodologicas, filtros de qualidade e alertas
 * de rastreabilidade nos modulos premium de visualizacao da plataforma Border Value.
 */
export interface MetadadosAuditoria {
  /**
   * Ano-base da fonte estatistica usada no registro.
   *
   * Exemplos esperados: `2026` para Comex e `2024` para PIA/RAIS.
   */
  reference_year: number;

  /**
   * Nivel qualitativo de confianca atribuido pela camada metodologica.
   *
   * Use este campo como escala ordinal para comunicacao visual, sem converter para score numerico
   * a menos que uma regra metodologica explicita seja definida.
   */
  confidence_level: 'alta' | 'media' | 'baixa';

  /**
   * Indica se o codigo NCM e generico, residual ou amplo.
   *
   * A API marca como `true` quando o codigo termina em 9, 90 ou 99.
   */
  is_ncm_generica: boolean;

  /**
   * Indica se o IBGE aplicou sigilo estatistico aos dados industriais da PIA.
   *
   * Quando `true`, interfaces devem evitar sugerir precisao excessiva nos valores industriais.
   */
  has_sigilo_pia: boolean;

  /**
   * Versao da metodologia responsavel pela geracao do registro.
   *
   * Exemplo esperado: `"1.0.0-rc.1"`.
   */
  metodologia_versao: string;
}

/**
 * Indicadores de comercio exterior associados a um produto conceitual.
 *
 * Este bloco alimenta graficos de importacao, exportacao, saldo/deficit comercial,
 * concentracao de origem e exposicao a fornecedores internacionais.
 */
export interface FluxoComercial {
  /**
   * Valor FOB importado, em dolares dos Estados Unidos (USD).
   */
  importacao_valor_fob: number;

  /**
   * Peso liquido importado, em quilogramas (kg).
   */
  importacao_peso_liquido: number;

  /**
   * Valor FOB exportado, em dolares dos Estados Unidos (USD).
   */
  exportacao_valor_fob: number;

  /**
   * Peso liquido exportado, em quilogramas (kg).
   */
  exportacao_peso_liquido: number;

  /**
   * Diferenca entre importacao e exportacao FOB, em dolares dos Estados Unidos (USD).
   *
   * Formula de referencia: `importacao_valor_fob - exportacao_valor_fob`.
   * Valores negativos indicam superavit comercial.
   */
  deficit_comercial: number;

  /**
   * Principal pais de origem das importacoes do produto.
   */
  principal_pais_origem: string;

  /**
   * Participacao do principal pais de origem no total importado.
   *
   * A escala e fracionaria de 0 a 1. Exemplo: `0.724` representa 72,40%.
   */
  principal_pais_participacao: number;

  /**
   * Indice Herfindahl-Hirschman global para concentracao das origens comerciais.
   *
   * A escala esperada vai de 0 a 10000, em que valores maiores indicam maior concentracao.
   */
  hhi_global: number;
}

/**
 * Indicadores da estrutura produtiva domestica vinculada ao produto conceitual.
 *
 * Este bloco apoia leituras de producao nacional, consumo aparente, dependencia externa,
 * emprego formal e massa salarial no elo exposto a TSB.
 */
export interface EstruturaDomestica {
  /**
   * Codigo CNAE associado ao elo produtivo domestico.
   *
   * Deve ser tratado como string para preservar zeros a esquerda. Formato esperado: 4 digitos.
   */
  cnae_codigo: string;

  /**
   * Codigo PRODLIST associado ao produto industrial.
   *
   * Deve ser tratado como string para preservar zeros a esquerda. Formato esperado: 8 digitos.
   */
  prodlist_codigo: string;

  /**
   * Valor da producao industrial segundo PIA, em reais (R$).
   */
  valor_producao_pia: number;

  /**
   * Consumo aparente do produto no mercado domestico, em equivalentes USD.
   */
  consumo_aparente: number;

  /**
   * Parcela do consumo aparente atendida por importacoes.
   *
   * A escala e fracionaria de 0 a 1. Formula de referencia: importacao / consumo aparente.
   */
  dependencia_externa_fracao: number;

  /**
   * Quantidade de vinculos formais RAIS no elo exposto a TSB.
   */
  qtde_vinculos_rais: number;

  /**
   * Massa salarial total RAIS no elo exposto a TSB, em reais (R$).
   */
  massa_salarial_rais: number;
}

/**
 * Unidade analitica principal da API Published para os produtos da Border Value.
 *
 * Use esta interface como contrato estrutural para dashboards, rankings, comparativos,
 * cards estrategicos e visualizacoes de cadeia produtiva. Os nomes dos campos seguem
 * rigorosamente o `snake_case` da API e nao devem ser convertidos para `camelCase`
 * na camada de tipagem.
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
   *
   * Deve ser tratado como string para preservar zeros a esquerda e evitar operacoes numericas
   * indevidas sobre codigos classificatorios.
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
   * Parametros usados quando a API aplica fator de proporcionalidade ao produto conceitual.
   */
  fator_proporcionalidade: {
    /**
     * Indica se o fator de proporcionalidade foi aplicado ao registro.
     */
    aplicado: boolean;

    /**
     * Coeficiente de corte usado no rateio proporcional.
     *
     * Exemplo esperado: `0.284`.
     */
    fator_alpha: number;

    /**
     * Fonte, proxy ou criterio usado para estimar o fator de proporcionalidade.
     *
     * Exemplo esperado: `"RenovaCalc-E1GM / Neomille"`.
     */
    fonte_proxy: string;
  };
}
