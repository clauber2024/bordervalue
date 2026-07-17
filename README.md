# Border Value — harmonização Brasil

Pipeline reproduzível para articular comércio exterior por NCM de oito dígitos,
PRODLIST-Indústria, classe CNAE e produção doméstica da PIA-Produto.

## Estado atual

- Comex Stat: exportações e importações de janeiro a junho de 2026.
- Correspondência: NCM x PRODLIST-Indústria 2025, CONCLA/IBGE.
- Produção: PIA-Produto 2024, tabela SIDRA 10476, variável “Valor da produção”.
- Empregos: camada opcional RAIS por classe CNAE, ano, UF e município, com
  vínculos formais, massa salarial e salário médio.
- PIB: camada territorial opcional por ano, UF e município, preparada para
  leitura conjunta com emprego e renda no dashboard.
- Rateio analítico: pesos por valor da produção PIA-Produto entre classes CNAE
  associadas à NCM, com fallback igualitário quando a base econômica não é
  completa e positiva.
- Auditoria: NCMs terminadas em 9/90/99, NCMs sem ponte e CNAEs domésticas não alcançadas.

## Produto oficial

O dashboard oficial do projeto é a interface em `dashboard/`.

Essa interface concentra os módulos já concluídos: indicadores Border Value,
RAIS e cartografia municipal, mapa mundial de parceiros comerciais, hidrogênio,
amônia e produtos relacionados à transição. A antiga interface experimental em `src/`
foi removida para evitar dois produtos e dois contratos de dados concorrentes.

## Execução

Use o Python do ambiente com pandas e `pyarrow`. A execução mínima da base oficial é:

```text
python operational_pipeline.py config.official.2026.json
python -m unittest -v
```

As saídas são gravadas em `outputs/official_2026`. Cada tabela é publicada em
CSV e, quando o mecanismo Parquet estiver disponível, também em Parquet. O
`manifest.json` registra fontes, versões, períodos, colunas e quantidade de linhas.

Para a execução completa com RAIS, módulos analíticos finais, dashboard, workbook
e pacote de publicação, use a sequência oficial:

```text
python -m unittest -v
python operational_pipeline.py config.official.2026.json
python operational_pipeline.py config.official.2026.rais.json
python build_final_border_value_outputs.py
python build_comparacao_periodos.py
python build_rankings_recortes.py
python build_sensibilidade_rateio.py
python build_cadeias_minerais_estrategicas.py
python build_combustiveis_transicao.py
python build_tsb_bridge.py
python dashboard/build_dashboard_data.py
node build_final_border_value_workbook.mjs
python prepare_publication_package.py
python dashboard/server.py 8765
```

A carga RAIS completa baixa cerca de 3,6 GB compactados e pode demorar conforme
rede, disco e biblioteca de extração `.7z`. O dashboard local fica disponível em
`http://localhost:8765` enquanto `dashboard/server.py` estiver em execução.
O Node.js permanece necessário apenas para os scripts executivos em `.mjs`, como
`build_final_border_value_workbook.mjs`; a interface oficial não usa Next.js.

## Módulos principais

- `operational_pipeline.py`: monta dimensões, ponte NCM-Prodlist-CNAE, fatos de
  comércio, produção, RAIS opcional, indicadores por CNAE e controles de
  qualidade.
- `build_final_border_value_outputs.py`: consolida a camada final de publicação,
  rankings, indicadores por CNAE/Prodlist, triagem de NCM sem ponte e resumo
  metodológico.
- `build_comparacao_periodos.py`: compara 2024 H1 e 2026 H1 por CNAE e fluxo,
  com série mensal e ranking de variações.
- `build_rankings_recortes.py`: gera rankings e recortes setoriais para leitura
  executiva das prioridades.
- `build_sensibilidade_rateio.py`: testa cenários alternativos de rateio e de
  tratamento de NCM sem ponte.
- `build_cadeias_minerais_estrategicas.py`: cria recortes de cadeias minerais
  estratégicas, drivers por NCM, criticidade e priorização por etapa. Quando
  disponíveis, incorpora os dados abertos ANM/Anuário Mineral Brasileiro como
  camada complementar de produção mineral por substância.
- `build_combustiveis_transicao.py`: organiza hidrogênio, amônia, metanol,
  etanol, combustíveis de aviação e combustíveis marítimos em camadas
  analíticas, drivers NCM e fontes complementares necessárias.
- `dashboard/build_dashboard_data.py` e `dashboard/server.py`: preparam os dados
  do painel e servem a interface local com fluxos mundiais, território RAIS,
  escopo Border Value e produtos relacionados à transição.
- `build_final_border_value_workbook.mjs`: gera a planilha executiva final em
  `outputs/final_border_value_2026`.
- `build_tsb_bridge.py`: materializa a Etapa 2 TSB em
  `outputs/tsb_bridge_2026`, preservando CNAE5 do relatorio e conectando a
  classe CNAE de quatro digitos da plataforma a PRODLIST, NCM e RAIS territorial.
- `prepare_publication_package.py`: monta o pacote publicável com bases,
  metadados, dicionário de dados, reprodução e arquivos compactados.

## Ordem segura de carga

1. `dim_ncm`
2. `dim_prodlist`
3. `dim_cnae`
4. `bridge_ncm_prodlist_cnae`
5. `fact_trade`
6. `fact_production`
7. `fact_employment_rais`, quando houver RAIS configurada
8. `fact_gdp`, quando houver PIB configurado
9. `analytic_trade_cnae`
10. `border_value_indicators_cnae`
11. `bridge_tsb_cnae_class` e derivados TSB, apos a base oficial com RAIS

O fato de comércio nunca é ligado diretamente à ponte 1:N. A tabela analítica é
uma camada posterior e reconciliada, evitando dupla contagem.

## Ponte TSB

A ponte TSB e uma camada derivada, executada por `build_tsb_bridge.py`. Ela nao
substitui a correspondencia oficial CONCLA/IBGE: primeiro reduz o CNAE5 do
relatorio TSB para a classe CNAE de quatro digitos usada pela plataforma; depois
propaga esse sinal para PRODLIST e NCM pela ponte `bridge_ncm_prodlist_cnae.csv`
e para emprego formal pela RAIS.

A ponte TSB nao traz camada ocupacional futura nem classificacao de ocupacoes verdes individuais. A
leitura de emprego e setorial, baseada em CNAE/RAIS/SCN67/MIP: ela responde
onde ha emprego em setores expostos a TSB. Uma leitura de ocupacao verde individual
deve ser tratada como expansao metodologica propria, com RAIS aberta por camada ocupacional futura,
dimensao ocupacional especifica e cruzamento CNAE + camada ocupacional futura + municipio.

Principais saidas em `outputs/tsb_bridge_2026`:

- `bridge_tsb_cnae_class.csv`: responde se a classe CNAE esta associada a
  atividade TSB e qual e o grupo de exposicao SCN67.
- `bridge_tsb_ncm.csv`: propaga a classificacao TSB para cada NCM observada na
  plataforma, mantendo listas de CNAE, PRODLIST, CNAE5 e SCN67.
- `rais_tsb_employment_summary.csv`: consolida vinculos RAIS por grupo de
  exposicao TSB.
- `rais_tsb_employment_territory.csv`: mostra onde o emprego formal desses
  setores se concentra por UF e municipio.
- `border_value_indicadores_finais_cnae_tsb.csv`: anexa a classificacao TSB aos
  indicadores finais por CNAE.

## Camada RAIS

A entrada `inputs.rais_employment` é opcional no JSON de configuração. Quando
presente, o pipeline publica `fact_employment_rais.csv` com o grão:

- `year`;
- `uf`;
- `municipality_code`;
- `cnae_class`;
- `formal_jobs`;
- `wage_mass` / `december_wage_mass`;
- `average_wage` / `average_december_wage`;
- `average_monthly_wage`.

O adaptador aceita cabeçalhos já normalizados ou nomes usuais da RAIS, como
`Ano`, `CNAE 2.0 Classe`, `UF`, `Municipio`, `Ind Vínculo Ativo 31/12 - Código`,
`Vl Rem Dezembro Nom` e `Vl Rem Média Nom`. A convenção oficial da plataforma é:
`formal_jobs` conta vínculos ativos em 31/12, `wage_mass` é alias de
`december_wage_mass` e `average_wage` é alias de `average_december_wage`. A
coluna `average_monthly_wage` preserva a remuneração média nominal da RAIS como
variável auxiliar.

Exemplo de bloco de configuração:

```json
"rais_employment": {
  "url": "https://.../rais_2024_cnae_municipio.csv",
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

Se `path` não existir e houver `url` ou `download_url`, o pipeline baixa a fonte
para esse caminho antes de processar. Arquivos já baixados são reaproveitados.
O `path` pode apontar diretamente para `.zip`, `.gz` ou `.7z`. Para `.7z`, use
`py7zr` no ambiente Python ou o executável `7z` no PATH. Quando houver mais de
um arquivo dentro do pacote, informe `archive_member` em `read_options`:

```json
"rais_employment": {
  "url": "https://.../RAIS_VINC_PUB_2024.7z",
  "path": "inputs/official/RAIS_VINC_PUB_2024.7z",
  "read_options": {
    "archive_member": "RAIS_VINC_PUB_2024.txt",
    "sep": ";",
    "encoding": "latin1",
    "dtype": {
      "CNAE 2.0 Classe": "string",
      "Município": "string"
    }
  }
}
```

Quando a RAIS está configurada, `border_value_indicators_cnae.csv` também recebe
`rais_formal_jobs`, `rais_december_wage_mass`, `rais_average_december_wage` e
`rais_average_monthly_wage`, agregados por CNAE. As colunas legadas
`rais_wage_mass` e `rais_average_wage` permanecem como aliases de dezembro.
O `quality_summary.csv` registra linhas RAIS, vínculos, massa salarial e CNAEs
RAIS que não encontraram chave na dimensão derivada da PIA.

O arquivo `config.official.2026.rais.json` já traz a carga completa dos vínculos
RAIS 2024 do FTP oficial do MTE (`ftp://ftp.mtps.gov.br/pdet/microdados/RAIS/2024/`).
Ele usa os sete pacotes `RAIS_VINC_PUB_*.7z`, lê os `.COMT` internos em blocos e
grava as saídas em `outputs/official_2026_rais`. A carga completa baixa cerca de
3,6 GB compactados antes da extração; para smoke test foi validado o pacote
pequeno `RAIS_VINC_PUB_NI.7z`.

Para exibição territorial no dashboard, os códigos municipais da RAIS são
enriquecidos pela dimensão oficial de municípios do IBGE, cacheada em
`dados/cache/dim_municipio_ibge.csv`. A chave de integração usa os seis
primeiros dígitos do código IBGE, compatíveis com o campo municipal da RAIS. O
código especial `999999` é mantido e rotulado como `Município não informado`.
Além do parquet usado pela interface, o build do dashboard publica CSVs
analíticos em `outputs/official_2026_rais`: `employment_territory_cnae.csv`,
`employment_platform_cnae.csv` e `employment_scope_summary.csv`.

No dashboard, a RAIS é classificada por escopo:

- `platform_priority`: CNAEs classificados como `1 - priorizar` nos indicadores finais.
- `platform_scope`: CNAEs industriais presentes nos indicadores da plataforma, mas sem prioridade 1.
- `out_of_platform_scope`: CNAEs RAIS fora do recorte industrial Border Value.

Os setores fora do escopo permanecem disponíveis para controle territorial, mas
não são usados como evidência setorial Border Value sem decisão metodológica
explícita.

O campo `employment_platform_prelim_score` é apenas um ordenador exploratório
para triagem inicial: `0,45 * percentil de vínculos RAIS + 0,35 * priority_score
+ 0,20 * external_dependency_ratio`. Ele não substitui `priority_tier` nem vira
prioridade oficial sem validação metodológica.

## Camada PIB

A entrada `inputs.gdp` é opcional no JSON de configuração. Quando presente, o
pipeline publica `fact_gdp.csv` com o grão:

- `year`;
- `uf`;
- `municipality_code`;
- `gdp_value_brl`;
- `gdp_status`.

O adaptador aceita cabeçalhos já normalizados ou nomes usuais como `Ano`, `UF`,
`Código do Município`, `Município`, `Produto Interno Bruto`, `Produto interno
bruto a preços correntes`, `Valor` e `V`. A camada foi desenhada para PIB
territorial, sobretudo municipal/UF, e não substitui a PIA-Produto setorial usada
no rateio NCM-PRODLIST-CNAE.

Exemplo de bloco de configuração:

```json
"gdp": {
  "path": "inputs/official/pib_municipios_2024.csv",
  "value_multiplier": 1000,
  "read_options": {
    "sep": ";",
    "encoding": "utf-8-sig",
    "dtype": {
      "Código do Município": "string"
    }
  }
}
```

Use `value_multiplier: 1000` quando a fonte publicar PIB em mil reais; omita ou
use `1` quando o arquivo já estiver em reais.

Quando disponível, o build do dashboard publica `gdp_territory.csv` em
`outputs/official_2026_rais` e mostra `PIB territorial` na aba
`Emprego, renda e PIB`, filtrável por UF e município.

## Camada ANM/AMB

O módulo de cadeias minerais estratégicas pode enriquecer a priorização com os
dados abertos da Agência Nacional de Mineração do Anuário Mineral Brasileiro
(AMB). A camada é complementar: ela não substitui a PIA-Produto, não altera a
ponte NCM-Prodlist-CNAE e não corrige NCM sem ponte.

Fontes configuradas no módulo:

- `https://app.anm.gov.br/dadosabertos/AMB/Producao_Bruta.csv`
- `https://app.anm.gov.br/dadosabertos/AMB/Producao_Beneficiada.csv`

Status atual: **pendente**. Os arquivos da pasta pública da ANM não estavam
disponíveis para download na validação operacional mais recente. O adaptador foi
mantido no código, mas a camada não deve ser considerada incorporada à base até
que a fonte volte a responder ou a ANM publique um caminho alternativo oficial.

Quando o download direto voltar a estar disponível, ou quando os arquivos forem
colocados em `inputs/official/anm_amb_producao_bruta.csv` e
`inputs/official/anm_amb_producao_beneficiada.csv`, o build publica:

- `fact_anm_mineral_production.csv`: produção ANM/AMB normalizada por ano,
  substância, UF/município quando houver, estágio bruto/beneficiado e
  `mineral_base`;
- `fontes_anm_amb_status.csv`: status de acesso, cache e leitura das fontes;
- campos `anm_*` em `priorizacao_cadeias_minerais_estrategicas.csv`, incluindo
  `anm_materiality_rank`, usado como componente opcional do `strategic_score`.

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

RAIS, cartografia municipal, mapa mundial, integração, automação, hidrogênio e
amônia não são tratados como atividades de desenvolvimento inicial. Esses temas
entram somente em consolidação, documentação e testes dos módulos já incorporados
ao produto oficial.

- Analisar os resultados com especialistas setoriais, começando pelas CNAEs de
  maior valor comercial ou relevância para a transição energética. A pauta
  inicial está em `outputs/official_2026/priorizacao_especialistas_cnae.md` e a
  base completa em `outputs/official_2026/priorizacao_especialistas_cnae.csv`.
- Validar, com fontes setoriais complementares, quais fluxos de hidrogênio,
  amônia, metanol, etanol, combustíveis de aviação e combustíveis marítimos podem ser classificados
  como renováveis, verdes, azuis ou de baixa emissão. A NCM organiza o produto,
  mas não certifica rota tecnológica nem intensidade de emissões.
- Retomar a camada ANM/AMB quando `Producao_Bruta.csv` e
  `Producao_Beneficiada.csv` estiverem novamente disponíveis em fonte oficial,
  validando layout, granularidade, unidades e compatibilidade com os
  `mineral_base` das cadeias minerais estratégicas.

## Atualização anual

1. Baixar ou atualizar os arquivos detalhados por NCM do Comex Stat para os anos
   e fluxos desejados.
2. Baixar a correspondência NCM x PRODLIST compatível com a nomenclatura vigente
   e registrar a versão usada.
3. Extrair a PIA-Produto pelo SIDRA, confirmar tabela, variável, unidade e versão
   PRODLIST declarada.
4. Atualizar caminhos, períodos, URLs, fator cambial e notas metodológicas no
   JSON de configuração.
5. Quando houver RAIS, atualizar o ano, os pacotes regionais, as opções de leitura
   e a documentação do período de emprego formal.
6. Executar os testes, a base oficial e a base RAIS, conferindo `manifest.json` e
   `quality_summary.csv`.
7. Regerar as camadas finais, recortes setoriais, produtos relacionados à transição,
   dashboard, workbook e pacote de publicação.
8. Registrar hashes, ambiente, data de execução, diferenças de cobertura e
   auditorias manuais relevantes.

## Fontes oficiais

- Comex Stat: https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/base-de-dados-bruta
- Correspondências CONCLA: https://concla.ibge.gov.br/classificacoes/correspondencias/produtos.html
- PIA-Produto: https://sidra.ibge.gov.br/pesquisa/pia-produto/tabelas
- ANM/Anuário Mineral Brasileiro: https://www.gov.br/anm/pt-br/assuntos/economia-mineral/publicacoes/anuario-mineral/anuario-mineral-brasileiro
- Dados abertos ANM/AMB: https://app.anm.gov.br/dadosabertos/AMB/

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
- **ANM/AMB:** a produção mineral da ANM é usada como evidência complementar de
  materialidade por substância mineral. Ela não é comparável diretamente à
  PIA-Produto sem harmonização adicional, pois tem grão, conceito e unidade
  próprios.
- **Hidrogênio e amônia:** a NCM identifica moléculas, derivados, insumos,
  equipamentos e usos correlatos, mas não informa se o hidrogênio é renovável,
  eletrolítico, azul, cinza ou outra rota. Também não informa se a amônia usa
  hidrogênio de baixa emissão, captura de carbono ou eletricidade renovável.
  Qualquer classificação ambiental exige bases complementares de projetos,
  plantas, capacidade, tecnologia, certificação, origem do hidrogênio e
  intensidade de emissões.
- **Produtos relacionados à transição:** metanol, etanol, combustíveis de aviação e combustíveis marítimos
  são recortes transversais preliminares. Alguns códigos misturam produto fóssil
  e renovável ou usos industriais e energéticos; por isso os módulos indicam
  drivers comerciais e campos complementares requeridos, sem inferir atributo de
  baixa emissão apenas pela NCM.
