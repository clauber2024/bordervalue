# Border Value — harmonização Brasil

Pipeline reproduzível para articular comércio exterior por NCM de oito dígitos,
PRODLIST-Indústria, classe CNAE e produção doméstica da PIA-Produto.

## Estado atual

- Comex Stat: exportações e importações de janeiro a junho de 2026.
- Correspondência: NCM x PRODLIST-Indústria 2025, CONCLA/IBGE.
- Produção: PIA-Produto 2024, tabela SIDRA 10476, variável “Valor da produção”.
- Empregos: camada opcional RAIS por classe CNAE, ano, UF e município, com
  vínculos formais, massa salarial e salário médio.
- Rateio analítico: pesos por valor da produção PIA-Produto entre classes CNAE
  associadas à NCM, com fallback igualitário quando a base econômica não é
  completa e positiva.
- Auditoria: NCMs terminadas em 9/90/99, NCMs sem ponte e CNAEs domésticas não alcançadas.

## Execução

Use o Python do ambiente com pandas e execute:

```text
python operational_pipeline.py config.official.2026.json
python -m unittest -v
```

As saídas são gravadas em `outputs/official_2026`. Cada tabela é publicada em
CSV e, quando o mecanismo Parquet estiver disponível, também em Parquet. O
`manifest.json` registra fontes, versões, períodos, colunas e quantidade de linhas.

## Ordem segura de carga

1. `dim_ncm`
2. `dim_prodlist`
3. `dim_cnae`
4. `bridge_ncm_prodlist_cnae`
5. `fact_trade`
6. `fact_production`
7. `fact_employment_rais`, quando houver RAIS configurada
8. `analytic_trade_cnae`
9. `border_value_indicators_cnae`

O fato de comércio nunca é ligado diretamente à ponte 1:N. A tabela analítica é
uma camada posterior e reconciliada, evitando dupla contagem.

## Camada RAIS

A entrada `inputs.rais_employment` é opcional no JSON de configuração. Quando
presente, o pipeline publica `fact_employment_rais.csv` com o grão:

- `year`;
- `uf`;
- `municipality_code`;
- `cnae_class`;
- `formal_jobs`;
- `wage_mass`;
- `average_wage`.

O adaptador aceita cabeçalhos já normalizados ou nomes usuais da RAIS, como
`Ano`, `CNAE 2.0 Classe`, `UF`, `Municipio`, `Vinculo Ativo 31/12`, `Massa
Salarial` e `Salario Medio`. Se a massa salarial não vier pronta, ela é
calculada como `vínculos formais * salário médio`; se o salário médio não vier
pronto, ele é calculado como `massa salarial / vínculos formais`.

Exemplo de bloco de configuração:

```json
"rais_employment": {
  "path": "inputs/official/rais_2024_cnae_municipio.csv",
  "read_options": {
    "sep": ";",
    "encoding": "utf-8-sig",
    "dtype": {
      "CNAE 2.0 Classe": "string",
      "Municipio": "string"
    }
  }
}
```

Quando a RAIS está configurada, `border_value_indicators_cnae.csv` também recebe
`rais_formal_jobs`, `rais_wage_mass` e `rais_average_wage`, agregados por CNAE.
O `quality_summary.csv` registra linhas RAIS, vínculos, massa salarial e CNAEs
RAIS que não encontraram chave na dimensão derivada da PIA.

## Indicadores Border Value

A tabela `border_value_indicators_cnae.csv` consolida, por classe CNAE:

- importações e exportações FOB em US$;
- saldo comercial em US$;
- peso líquido importado e exportado;
- valor da produção doméstica da PIA-Produto em mil R$;
- consumo aparente e dependência externa, quando houver fator explícito de
  conversão da produção para a unidade monetária do comércio.

Como o Comex Stat está em US$ FOB e a PIA-Produto está em mil R$, o indicador
`external_dependency_ratio` exige um fator explícito de conversão. A configuração
oficial atual usa o câmbio médio BCB/SGS série 1 de 2024, igual a 5,392016 R$/US$,
com fator `1000 / 5,392016 = 185,4593903282186`, pois a PIA está em mil R$. A
fórmula usada é:

```text
dependência externa = importações / (produção doméstica + importações - exportações)
```

Valores da PIA-Produto sob sigilo estatístico (`X`) ou indisponíveis (`-`, `..`,
`...`) não recebem imputação automática. Eles são carregados como ausentes e
sinalizados em `domestic_production_status` e
`domestic_production_is_confidential`. Nesses casos, os campos comparáveis em US$,
o consumo aparente e `external_dependency_ratio` permanecem vazios; a coluna
`external_dependency_status` registra `not_calculated_confidential_pia` ou
`not_calculated_missing_pia`.

## Regra de rateio

Quando uma NCM se vincula a mais de uma classe CNAE, o pipeline usa como peso
preferencial o valor da produção observado na PIA-Produto para as CNAEs
candidatas. Se a base econômica do grupo estiver ausente, incompleta ou não
positiva, a NCM é dividida igualmente entre as CNAEs distintas. Quando houver
mais de uma Prodlist na mesma CNAE, a cota dessa CNAE é repartida igualmente
entre essas linhas para evitar que a quantidade de produtos altere o peso
setorial. A coluna `allocation_rule` na ponte registra qual regra foi aplicada.
A coluna `allocation_basis_status` indica se a base PIA usada no peso estava
publicada, sigilosa, indisponível ou ausente.

## Controles de qualidade

O arquivo `quality_summary.csv` reconcilia os totais antes e depois do rateio. As
filas `audit_*.csv` constituem a lista de trabalho para auditoria qualitativa. Os
códigos genéricos não são resolvidos automaticamente nem com IA generativa.

## Pendências

- Analisar os resultados com especialistas setoriais, começando pelas CNAEs de
  maior valor comercial ou relevância para a transição energética. A pauta
  inicial está em `outputs/official_2026/priorizacao_especialistas_cnae.md` e a
  base completa em `outputs/official_2026/priorizacao_especialistas_cnae.csv`.
- Criar a primeira camada de mapas da plataforma com visualização mundial dos
  fluxos de importação e exportação por país parceiro (`CO_PAIS`), incluindo
  interação de origem-destino/de-para e alternativa de sobrevoo animado dos
  fluxos no mapa. O primeiro recorte deve incluir explicitamente etanol,
  produção de etanol, SAF, combustível marítimo, metanol e derivados, combinando
  dados oficiais com o levantamento manual já realizado.
- Estruturar a camada cartográfica Brasil para RAIS e demais bases territoriais,
  com mapas por UF e município integrados por CNAE. Detalhar posteriormente as
  referências de desenho e navegação inspiradas em plataformas como SEEG,
  MapBiomas e mapas de zonas.

## Atualização anual

1. Baixar os arquivos anuais detalhados por NCM do Comex Stat.
2. Baixar a correspondência NCM x PRODLIST compatível com a nomenclatura vigente.
3. Extrair a PIA-Produto pelo SIDRA e registrar o ano/versão da PRODLIST.
4. Atualizar caminhos, períodos e URLs no JSON de configuração.
5. Executar testes, pipeline e conferir as reconciliações no relatório de qualidade.

## Fontes oficiais

- Comex Stat: https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/base-de-dados-bruta
- Correspondências CONCLA: https://concla.ibge.gov.br/classificacoes/correspondencias/produtos.html
- PIA-Produto: https://sidra.ibge.gov.br/pesquisa/pia-produto/tabelas

## Limitações metodológicas

- **Sigilo estatístico da PIA-Produto:** valores publicados como `X` são tratados
  como confidenciais. O pipeline não imputa, redistribui nem tenta reidentificar
  esses valores. Indicadores que dependem de produção doméstica comparável ficam
  sem cálculo e são sinalizados por `domestic_production_status`,
  `domestic_production_is_confidential`, `external_dependency_status` ou
  `product_dependency_status`.
- **Indisponibilidade operacional da PIA:** marcadores `-`, `..`, `...` ou
  ausência de linha são preservados como produção ausente. Esses casos são
  distintos do sigilo estatístico e também impedem cálculo de consumo aparente,
  dependência externa, penetração das importações e orientação exportadora.
- **Defasagem temporal entre fontes:** o recorte atual combina comércio Comex
  Stat de janeiro a junho de 2026 com produção PIA-Produto 2024, que é a última
  produção doméstica oficial incorporada ao pipeline. As razões de dependência e
  orientação exportadora devem ser lidas como aproximações analíticas, não como
  medição contemporânea perfeita do mesmo período.
- **Defasagem classificatória:** a NCM, a PRODLIST-Indústria e as
  correspondências CONCLA são publicadas em versões próprias. Mudanças de versão
  podem criar NCM sem ponte, alterar vínculos NCM-Prodlist-CNAE ou afetar
  comparações entre anos; toda atualização deve registrar a versão usada e
  revisar códigos novos, extintos ou genéricos.
- **Cobertura e ponte 1:N:** NCM sem correspondência oficial permanecem como
  não mapeadas para preservar a reconciliação com os totais do Comex Stat. Quando
  uma NCM possui múltiplas CNAEs possíveis, o resultado depende da regra de
  rateio documentada e deve ser interpretado como alocação analítica.
