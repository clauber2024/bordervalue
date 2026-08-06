# Mapeamento do que ja existe

Data do inventario: 2026-07-20.

## Sintese executiva

O projeto tem duas camadas bem diferentes convivendo:

1. **Base operacional confiavel**: pipeline Python, outputs oficiais em CSV/Parquet, dashboard tecnico legado e artefatos finais em `outputs/`. Essa camada tem manifestos, controles de qualidade, reconciliacao de totais e testes de dashboard/exportacao.
2. **Prototipo visual/premium**: experiencia Next em `/explorar` e `/tour-soberania`, componentes NIB/HHI/RenovaCalc/Sankey/radar e catalogo conceitual em TypeScript. Essa camada mostra a direcao de produto, mas ainda contem mocks e valores hardcoded.

Conclusao pratica: o dashboard tecnico legado e os outputs oficiais devem ser tratados como a "base confiavel" atual. A experiencia Next deve ser tratada como prototipo visual ate ser ligada diretamente a dados publicados/reconciliados.

## Inventario do BI

### Produto oficial declarado

- `app/page.tsx`: redireciona para `/explorar`.
- `app/explorar/page.tsx`: experiencia principal do Painel Analitico Border Value.
- `README.md`: declara `/explorar` como produto principal e `dashboard/` como painel tecnico legado/auditoria.

### Indicadores existentes

Na experiencia Next `/explorar`:

- Importacoes.
- Exportacoes.
- Dependencia externa media.
- HHI maximo.
- Dependencia por produto/territorio.
- Vulnerabilidade por produto via HHI.
- Serie de comercio por periodo.
- Producao/cobertura por etapa.
- Principal fornecedor e participacao.
- Nivel de confianca por produto.
- Codigos HS, NCM, CNAE e PRODLIST em gaveta tecnica.

No dashboard tecnico legado `dashboard/`:

- Valor comercial total, exportacoes, importacoes e saldo.
- Participacao mapeada.
- Peso liquido.
- Quantidade de CNAEs, PRODLISTs, NCMs e paises.
- Serie mensal por fluxo.
- Composicao do mapeamento.
- Rankings por CNAE, PRODLIST, NCM e pais.
- Mapa mundial de fluxos comerciais.
- Sankey de fluxo, situacao de mapeamento e CNAE/PRODLIST.
- RAIS: vinculos formais, massa salarial, salario medio, UF, municipios, CNAEs.
- PIB territorial quando disponivel.
- TSB: massa salarial, vinculos, salario medio, CNAEs, SCN67, aderencia TSB-BV, multiplicadores.
- Combustiveis de transicao: valor por combustivel, etapa, NCMs, fontes complementares e estrutura hidrogenio/amonia.
- ETL: fontes monitoradas, controles automaticos, calendario e responsaveis.

### Filtros existentes

Na experiencia Next `/explorar`:

- Cadeia.
- Produto/etapa.
- Indicador.
- Periodo.
- Territorio.
- HS.
- NCM.
- CNAE.
- PRODLIST.
- Nivel de confianca.

No dashboard tecnico legado:

- Periodo.
- Fluxo.
- CNAE.
- PRODLIST.
- NCM.
- Pais.
- Situacao do mapeamento.
- UF RAIS.
- Municipio RAIS.
- Escopo RAIS.
- Combustivel.
- Etapa da cadeia.

### Tabelas e bases expostas

Base oficial `outputs/official_2026`:

- `dim_ncm`: 9.160 linhas.
- `dim_prodlist`: 2.901 linhas.
- `dim_cnae`: 277 linhas.
- `bridge_ncm_prodlist_cnae`: 11.036 linhas.
- `fact_trade`: 79.590 linhas.
- `fact_production`: 274 linhas.
- `analytic_trade_cnae`: 3.093 linhas.
- `border_value_indicators_cnae`: 277 linhas.
- `audit_unmatched_ncm`: 395 linhas.
- `audit_generic_ncm`: 1.988 linhas.
- `audit_unmatched_cnae`: 17 linhas.

Base oficial com RAIS `outputs/official_2026_rais`:

- Mesma estrutura comercial/industrial da base oficial.
- `fact_employment_rais`: 539.123 linhas.
- `employment_territory_cnae.csv`.
- `employment_platform_cnae.csv`.
- `employment_scope_summary.csv`.
- `gdp_territory.csv` existe, mas e praticamente vazio no estado atual.

Camada final `outputs/final_border_value_2026`:

- `border_value_indicadores_finais_cnae.csv`: 277 linhas.
- `border_value_indicadores_finais_cnae_prodlist.csv`: 2.902 linhas.
- `comercio_alocado_cnae_prodlist_fluxo_periodo.csv`: 32.446 linhas.
- `fact_production_prodlist.csv`: 3.489 linhas.
- `ncm_sem_ponte_priorizacao.csv`: 395 linhas.
- `rankings_cnae.csv`, `rankings_prodlist.csv`, `rankings_produtos_consolidados.csv`, `rankings_setoriais_consolidados.csv`.
- `indicadores_combustiveis_transicao_camada.csv`: 22 linhas.
- `drivers_combustiveis_transicao_ncm.csv`: 707 linhas.
- `estrutura_analitica_hidrogenio_amonia.csv`: 14 linhas.
- `indicadores_cadeias_minerais_etapa.csv`: 36 linhas.
- `drivers_cadeias_minerais_ncm.csv`: 522 linhas.
- `priorizacao_cadeias_minerais_estrategicas.csv`: 14 linhas.
- `fact_anm_mineral_production.csv`: 0 linhas; camada ANM/AMB ainda pendente.

Camada NIB territorial `outputs/nib_territorializacao_2026`:

- `bridge_nib_cnae_class.csv`.
- `bridge_nib_ncm.csv`.
- `dim_nib_cadeias_cnae.csv`.
- `rais_nib_employment_cnae.csv`.
- `rais_nib_employment_territory.csv`.
- `resumo_cadeias_nib_territorio.csv`.
- `top100_municipios_industria_transformacao_rais.csv`.

Camada TSB `outputs/tsb_bridge_2026`:

- `border_value_indicadores_finais_cnae_tsb.csv`.
- `bridge_tsb_cnae_class.csv`.
- `bridge_tsb_ncm.csv`.
- `rais_tsb_employment_cnae.csv`.
- `rais_tsb_employment_summary.csv`.
- `rais_tsb_employment_territory.csv`.
- `scn67_tsb_exposure.csv`.

### Exportacoes existentes

No dashboard tecnico legado:

- `/api/export?dataset=trade`: exporta comercio filtrado.
- `/api/export?dataset=employment`: exporta RAIS/PIB filtrado.
- `/api/export?dataset=fuels`: exporta combustiveis filtrados.
- `/api/export?dataset=tsb`: exporta TSB baixo carbono.

Na camada final:

- Workbook executivo `border_value_indicadores_finais_2026.xlsx`.
- Matriz de auditoria `matriz_auditoria_published_ncm.xlsx`.
- Deck preliminar `apresentacao_executiva_border_value_2026_preliminar.pptx`.
- Relatorio tecnico `relatorio_tecnico_border_value_2026_preliminar.docx`.
- Pacote de publicacao em `outputs/publicacao_border_value_2026`.

### Mapas existentes

- Mapa mundial no dashboard tecnico legado, desenhado offline em SVG com coordenadas hardcoded para paises principais.
- Mapas municipais RAIS por UF, usando GeoJSON cacheado em `dashboard/geo/municipios_*.geojson`.
- A experiencia Next usa `react-simple-maps` com `world-atlas` via CDN e pontos de fornecedores em coordenadas locais.

## Inventario dos componentes do motor

### Matriz NIB

- Componente: `components/NIBMatrixChart.tsx`.
- Funcao: cruza capacidade domestica, aproximada por valor de producao PIA, com deficit/saldo comercial.
- Estado atual: possui dataset default `etanolSafMock` embutido. Pode receber `data` externo via props quando usado por `ChainDashboard`.
- Classificacao: prototipo visual por default; potencialmente confiavel quando alimentado por API/base Published.

### HHI

- SQL: `sql/mv_published_hhi_risk.sql` calcula HHI por `conceptual_product_id`.
- Backend: `database/data_access.py` junta `mv_published_indicators` com `mv_published_hhi_risk`.
- Frontend Next: `/explorar` e `lib/conceptualCatalog.ts` usam HHI hardcoded.
- Dashboard legado: usa rankings e mapas a partir de dados alocados, mas nao substitui a materialized view Published de HHI.
- Classificacao: metodo confiavel existe no SQL; exibicao Next ainda e hardcoded.

### RenovaCalc / proporcionalidade

- Componente: `components/ProportionalityToggle.tsx`.
- Funcao: alterna valor bruto e valor rateado por `fator_alpha`.
- Estado atual: default hardcoded com `fator_alpha = 0,284` e fonte `RenovaCalc-E1GM / Neomille`.
- `ChainDashboard` aplica o fator quando o produto vem da API.
- Classificacao: prototipo visual por default; regra aplicavel quando o fator vier da camada Published.

### Rateio setorial via MIP/IBGE (fertilizantes, aco, silicio)

- Escopo: `analytical_industry_and_employment.proportion_factor`, gravado por `build_analytical_staging_sectors.py` (fertilizantes, aco) e `build_analytical_staging_silicio.py` (silicio).
- Estado atual: `proportion_factor` e sempre `1.0` nas 3 cadeias -- sem rateio algum. O proprio comentario do script documenta a decisao: "there is nothing left to allocate" (producao) e "equal-weight approximation rather than a true per-product allocation" (RAIS). Ou seja, todo o valor de producao (PIA) e vinculos (RAIS) do CNAE mapeado sao atribuidos integralmente a cada produto conceitual daquele CNAE, mesmo quando o CNAE cobre mais de um produto da cadeia.
- `database/data_access.py:455` retorna `"Matriz Insumo-Produto IBGE"` como `fonte_proxy` default quando `aplicado=False` -- e um rotulo, nao um valor calculado. Nenhum arquivo do IBGE e lido em lugar nenhum do pipeline hoje.
- Investigacao da fonte, parte 1 -- dado oficial IBGE (2026-08-06): ao contrario do RenovaCalc/RenovaBio, o dado oficial puro nao da caminho limpo para ligar o rotulo a um valor real:
  - A Matriz de Insumo-Produto completa (com coeficientes tecnicos Aij, granularidade Nivel 67 atividades x 127 produtos -- unico nivel fino o suficiente para separar, por exemplo, fertilizantes de "quimicos" em geral, ou aco de "metalurgia" em geral) e publicada em ciclo quinquenal irregular. Ultima edicao: **2015** (11 anos de defasagem em relacao ao ano-base 2026 do projeto).
  - A Tabela de Recursos e Usos (TRU) do SCN, publicada anualmente e mais atual (edicao 2023, arquivos `12_tab*_2023.xls` no FTP do IBGE), so existe no **Nivel 12** -- agregacao setorial grosseira demais para o rateio produto-a-produto que o projeto precisa.
  - Sem corte estadual/municipal oficial em nenhuma das duas versoes.
  - Precisaria, alem disso, de crosswalk CNAE -> atividade MIP (existe correspondencia oficial do IBGE, mas nunca foi construida no projeto).
- Investigacao da fonte, parte 2 -- literatura academica (2026-08-06): a academia brasileira ja resolveu (parcialmente) esse exato problema, em duas frentes:
  - **Atualizacao temporal**: familia de algoritmos RAS/GRAS/RAWS (biproportional scaling) reequilibra a matriz 2015 nivel-fino usando as TRUs anuais como vetor de controle, gerando series estimadas sem perder granularidade setorial. Metodo de referencia: Guilhoto & Sesso Filho (2005, 2010). O [NEREUS/USP publica pronto e gratuito](https://www.usp.br/nereus/?dados=sistema-de-matrizes-de-insumo-produto-brasil-2010-2017) o resultado disso: series **nivel 68 setores**, anos **2010-2018**, xlsx, sem cadastro -- reduz a defasagem de 11 para ~8 anos mantendo o nivel de detalhe que a TRU nivel 12 nao tem.
  - **Regionalizacao**: IPEA construiu uma Matriz Insumo-Produto Inter-Regional (MIP-ir, ano-base 2018) usando microdados de Nota Fiscal Eletronica (NF-e) para desagregar fluxos entre estados, cruzados com TRU/Contas Regionais/POF -- resultado: 27 UFs x 68 atividades. NEREUS tambem publica matrizes inter-regionais por estado na mesma linhagem metodologica.
  - Residual que nenhuma das duas frentes resolve: nem NEREUS nem IPEA chegam a 2026 (best case e 2018) nem a nivel municipal (best case e UF); e sao reconstrucoes academicas, nao dado oficial IBGE -- precisariam ser citadas como metodologia de terceiros, com premissas proprias, nao como "fonte IBGE".
- Classificacao: **limitacao conhecida, com mitigacao academica disponivel mas parcial** -- melhor que "sem solucao pronta": existe fonte de terceiros (NEREUS, nivel 68, ate 2018) que já bate a granularidade que falta na TRU anual do IBGE, mas ainda com defasagem residual (2018 vs. 2026) e sem corte municipal. Diferente do RenovaCalc (dado primario oficial, atual, plant-level), aqui o melhor caminho realista e uma reconstrucao academica de terceiros, nao o proprio IBGE. Ate decisao em contrario, tratar `proportion_factor=1.0` como aproximacao documentada, nao como bug pendente de fix trivial.

### Sankey AIPNET

- Componente: `components/SovereigntySankeyChart.tsx`.
- Funcao: grafo pais de origem -> insumo NCM -> elo CNAE -> produto final -> uso final.
- Estado atual: `pilotTopology` e `etanolAnidroOpenTopology` estao hardcoded.
- O modelo Pydantic de grafo existe em `api/main.py`, com validacao de topologia, mas nao ha endpoint operacional de grafo publicado.
- Classificacao: prototipo visual/narrativo.

### Radar de vulnerabilidade

- Componente: `components/VulnerabilityRadar.tsx`.
- Funcao: combina HHI, participacao do principal fornecedor e dependencia externa/consumo aparente.
- Estado atual: default hardcoded para enzimas alfa-amilase e etanol anidro.
- Classificacao: prototipo visual por default; pode ficar confiavel quando receber `ProdutoConceitual` da API.

## Dados reais, mockados e hardcoded

### Dados reais / derivados de fonte oficial

- `inputs/official/EXP_2026.csv` e `IMP_2026.csv`: Comex Stat 2026.
- `inputs/official/ncm_prodlist_2025.xlsx`: ponte NCM-PRODLIST CONCLA/IBGE.
- `inputs/official/pia_2024_value_production.json`: PIA-Produto 2024.
- `inputs/official/RAIS_VINC_PUB_*.7z`: microdados RAIS 2024.
- `dados/cache/dim_municipio_ibge.csv`: dimensao municipal IBGE cacheada.
- `dados/cache/dim_pais_comex.csv`: dimensao de paises Comex cacheada.
- `dados/tsb/*.csv` e `EV1_Relatorio_Final_vf.docx`: referencias metodologicas TSB.
- `dados/nib/dim_nib_cadeias_cnae.csv`: ponte editavel NIB-CNAE.
- `outputs/official_2026*`, `outputs/final_border_value_2026`, `outputs/tsb_bridge_2026`, `outputs/nib_territorializacao_2026`: outputs derivados dos scripts.

### Dados mockados

- `app/explorar/page.tsx`: `MOCK_RESPONSE` usado em desenvolvimento quando a API falha.
- `api/main.py`: `DATABASE_MOCK` alimenta `/api/query`.
- `components/NIBMatrixChart.tsx`: `etanolSafMock`.
- `components/VulnerabilityRadar.tsx`: `alfaAmilaseCriticalMock` e `etanolAnidroDomesticMock`.
- `components/SovereigntySankeyChart.tsx`: `pilotTopology` e topologia aberta de etanol anidro.
- `components/ProportionalityToggle.tsx`: valores default de importacao bruta e fator RenovaCalc.

### Dados hardcoded

- `lib/conceptualCatalog.ts`: catalogo completo de produtos conceituais, metricas, codigos, fontes e coordenadas de fornecedores.
- `app/api/conceptual-products/route.ts`: gera serie temporal e cobertura de producao por formulas internas sobre o catalogo local.
- `dashboard/app.js`: coordenadas `WORLD_POINTS` para mapa mundial.
- `dashboard/app.js`: `LOW_CARBON_AVERAGE_MULTIPLIERS` para simulador TSB.
- Textos narrativos dos tours de soberania em `components/SovereigntyTour.tsx` e `components/SovereigntyTourExtended.tsx`.

## Base confiavel

Tratar como base confiavel atual:

- Pipeline `operational_pipeline.py` e scripts de build finais.
- Configuracoes `config.official.2026.json` e `config.official.2026.rais.json`.
- `outputs/official_2026` e `outputs/official_2026_rais`.
- `outputs/final_border_value_2026`, com ressalva para camadas explicitamente pendentes, como ANM/AMB.
- `outputs/tsb_bridge_2026` e `outputs/nib_territorializacao_2026`, como camadas derivadas/metodologicas.
- Dashboard tecnico legado `dashboard/`, especialmente `build_dashboard_data.py`, `server.py`, `data.json`, parquet e endpoints de exportacao.
- Testes `tests/dashboard-ui.test.mjs`, `test_operational_pipeline.py`, `test_pipeline_harmonizacao.py`, `tests/test_tsb_bridge.py`, `tests/test_sql_logic.py`.

Evidencias de confiabilidade:

- `quality_summary.csv` mostra reconciliacao do comercio com diferenca zero:
  - total original: US$ 327.188.208.526.
  - total alocado: US$ 327.188.208.526.
  - diferenca: 0.
- Cobertura NCM por quantidade: 95,6878%.
- 395 NCMs sem ponte permanecem auditaveis, nao imputadas.
- Sigilo/ausencia PIA sao preservados e sinalizados, sem imputacao automatica.
- RAIS tem 539.123 linhas agregadas na versao oficial com emprego.

## Prototipo visual

Tratar como prototipo visual ate nova integracao:

- `/explorar`, porque depende de `lib/conceptualCatalog.ts` e cai para `MOCK_RESPONSE` em desenvolvimento.
- `/api/conceptual-products`, porque consulta catalogo TypeScript local, nao os CSVs/Parquet/Published.
- `/tour-soberania`, porque renderiza componentes com defaults hardcoded.
- `NIBMatrixChart`, `VulnerabilityRadar`, `ProportionalityToggle` e `SovereigntySankeyChart` quando usados sem `data`/`topology` vindo de fonte publicada.
- `api/main.py` `/api/query`, porque usa `DATABASE_MOCK`.

## Lacunas de integracao

- `routers/api.py` define `/api/chain/{chain_name}` usando `database/data_access.py`, mas `api/main.py` nao inclui esse router no estado atual.
- `ChainDashboard` chama `/api/chain/{chainName}`, mas nao ha rota Next equivalente em `app/api/chain`.
- A camada Published por PostgreSQL esta desenhada em SQL e Python, mas nao aparece conectada ao app principal FastAPI.
- A experiencia Next ainda nao consome `outputs/final_border_value_2026` nem `dashboard/data.json`.
- A topologia AIPNET ainda nao tem endpoint real; o modelo existe, mas a visualizacao usa topologias hardcoded.
- ANM/AMB consta como camada complementar pendente, com `fact_anm_mineral_production.csv` sem linhas.
- Rateio setorial (fertilizantes/aco/silicio) via MIP/IBGE nao tem fonte pronta para substituir `proportion_factor=1.0` -- ver "Rateio setorial via MIP/IBGE" acima; diferente do RenovaCalc, aqui a lacuna e estrutural (fonte defasada ou grosseira), nao so de engenharia.

## Proxima decisao recomendada

1. Congelar `outputs/official_2026_rais` + `outputs/final_border_value_2026` como base de verdade da versao atual.
2. Escolher um caminho unico para alimentar o Next:
   - API Published/PostgreSQL, usando `routers/api.py` e materialized views; ou
   - API local sobre CSV/Parquet finais, reaproveitando a logica do dashboard tecnico.
3. Remover ou rotular visualmente os mocks em `/explorar` e `/tour-soberania`.
4. Criar contrato real para produtos conceituais e AIPNET, separando:
   - metrica oficial;
   - proxy metodologico;
   - narrativa de demonstracao;
   - dado pendente.
5. Manter o dashboard tecnico legado como ferramenta de auditoria ate a experiencia Next reproduzir filtros, exportacoes e rastreabilidade equivalentes.
