# Documentação da execução e atualização

Este documento registra a proveniência, as classificações, os parâmetros e o
procedimento de atualização do pipeline **Border Value**. A data de referência
deste registro é **14 de julho de 2026**.

## 1. Escopo e fluxo

O pipeline integra, nesta ordem:

1. comércio exterior do Comex Stat, na granularidade NCM de oito dígitos;
2. correspondência oficial NCM × Prodlist-Indústria da CONCLA/IBGE;
3. produção doméstica da PIA-Produto, consultada no SIDRA/IBGE;
4. emprego formal RAIS, quando configurado;
5. dimensões NCM, Prodlist e CNAE, ponte de correspondência, tabelas fato,
   indicadores Border Value e módulos analíticos de publicação.

A CNAE é derivada dos quatro primeiros dígitos do código Prodlist. O pipeline
não infere correspondências ausentes. Códigos NCM terminados em 9, 90 ou 99 são
marcados para auditoria manual. Quando uma NCM se relaciona a mais de uma CNAE,
o rateio analítico usa como regra preferencial o valor da produção PIA-Produto
por CNAE (`production_value_weighted_cnae`). A divisão igualitária entre CNAEs
distintas (`equal_share_distinct_cnae`) permanece apenas como fallback quando a
base econômica do grupo está ausente, incompleta ou não positiva.

## 2. Fontes oficiais

| Fonte | Conteúdo | Endereço/consulta | Recorte usado |
|---|---|---|---|
| Comex Stat/MDIC | Exportações e importações por NCM-8 | `https://balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm/{EXP|IMP}_{ano}.csv` | janeiro a junho de 2026; fluxos EXP e IMP |
| CONCLA/IBGE | Correspondência NCM × Prodlist-Indústria | `https://concla.ibge.gov.br/images/concla/downloads/5CorrespondenciaNCMxPRODLIST-Industria2025.xlsx` | versão 2025 para ponte NCM; PIA-Produto em PRODLIST 2022 |
| PIA-Produto/SIDRA/IBGE | Valor da produção por produto Prodlist, em mil R$ | API SIDRA v3, agregado 10476, variável 215, classificação 1264, Brasil | 2024 |
| RAIS/MTE | Vínculos formais, massa salarial e remuneração por CNAE, UF e município | `ftp://ftp.mtps.gov.br/pdet/microdados/RAIS/2024/` | RAIS 2024, quando executada a configuração `config.official.2026.rais.json` |

Para a PIA-Produto, o código monta a consulta:

```text
https://servicodados.ibge.gov.br/api/v3/agregados/10476/periodos/2024/variaveis/215?localidades=N1%5Ball%5D&classificacao=1264%5Ball%5D
```

O agregado SIDRA 7752 é usado para os anos 2014–2023; o agregado 10476 é usado
para 2024. O código atualmente aceita apenas o intervalo 2014–2024 para a PIA.

## 3. Versões das classificações

- **NCM:** classificação anual do arquivo detalhado do Comex Stat correspondente
  ao ano solicitado; na execução registrada, NCM 2026.
- **Prodlist-Indústria:** a ponte NCM usa a correspondência PRODLIST-Indústria
  2025. A PIA-Produto 2024 permanece na base PRODLIST declarada pelo SIDRA.
- **CNAE:** classe de quatro dígitos derivada do prefixo do código Prodlist; a
  presença da classe é validada contra o universo observado na PIA-Produto.
- **Correspondência alternativa:** somente deve ser usada de forma explícita em
  configuração versionada; o arquivo, a versão e a justificativa devem ser
  registrados no histórico da execução.

Não substitua versões classificatórias de forma automática em séries históricas.
Mudanças de NCM, PRODLIST ou ponte CONCLA alteram cobertura, vínculos 1:N e
comparabilidade entre anos.

## 4. Parâmetros da execução registrada

Comando lógico da base operacional:

```powershell
python -m unittest -v
python operational_pipeline.py config.official.2026.json
```

Comando lógico da execução completa com RAIS, recortes finais, dashboard,
workbook e pacote publicável:

```powershell
python -m unittest -v
python operational_pipeline.py config.official.2026.json
python operational_pipeline.py config.official.2026.rais.json
python build_final_border_value_outputs.py
python build_comparacao_periodos.py
python build_rankings_recortes.py
python build_sensibilidade_rateio.py
python build_cadeias_minerais_estrategicas.py
python build_combustiveis_transicao.py
python dashboard/build_dashboard_data.py
node build_final_border_value_workbook.mjs
python prepare_publication_package.py
python dashboard/server.py 8765
```

O último comando mantém o dashboard local ativo em `http://localhost:8765`.
A carga RAIS completa usa sete pacotes `.7z` oficiais, baixa cerca de 3,6 GB
compactados e requer `py7zr` no ambiente Python ou `7z` disponível no PATH.

| Parâmetro | Valor registrado | Observação |
|---|---|---|
| `config.official.2026.json` | base sem RAIS | Grava em `outputs/official_2026` |
| `config.official.2026.rais.json` | base com RAIS 2024 | Grava em `outputs/official_2026_rais` |
| `trade_period` | `2026-01 a 2026-06` | Comex Stat EXP e IMP |
| `production_period` | `2024` | PIA-Produto, valor da produção em mil R$ |
| `employment_period` | `RAIS 2024` | Presente na configuração RAIS |
| `prodlist_version` | `2025 (ponte NCM); PIA-Produto em PRODLIST 2022` | Registrar qualquer alteração |
| `production_value_to_trade_value_factor` | `185,4593903282186` | Conversão de mil R$ para US$ pelo câmbio médio BCB/SGS 1 de 2024 |
| `allocation_method` | `production_value_weighted_cnae_with_equal_fallback` | Peso PIA por CNAE com fallback igualitário |
| leitura RAIS | blocos de 250.000 linhas | Parâmetro da configuração RAIS completa |
| grão do comércio | ano, mês, fluxo, NCM-8 e país parceiro | HS6 não é usado como grão analítico |
| grão da produção | ano, Prodlist, status, CNAE | Valor em mil R$ |
| grão da RAIS | ano, UF, município e CNAE | Vínculos formais e remuneração |

Valores da PIA-Produto marcados como `X`, `-`, `..` ou `...` são tratados como
ausentes, sem imputação automática. O código preserva a causa em
`production_status`, permitindo separar sigilo estatístico de indisponibilidade
operacional.

## 5. Ambiente de referência

Ambiente usado para a verificação de 14/07/2026:

- Python 3.12.13;
- pandas 3.0.1;
- openpyxl 3.1.5.

Para reprodutibilidade estrita, recomenda-se executar com essas versões ou
registrar, no histórico da nova execução, quaisquer diferenças de ambiente.

## 6. Rastreabilidade dos arquivos em cache

Hashes SHA-256 observados em 14/07/2026:

| Arquivo | SHA-256 |
|---|---|
| `dados/cache/comex/EXP_2024.csv` | `9DCDDFCB2089709C6E738F4A7FD1E529E66F1CEAE8C66DCC1550884277548B78` |
| `dados/cache/comex/IMP_2024.csv` | `D0E7CCE0B93D2A6D80F8BF7CF898264DBA8144F25679FF0A5FA669A3CDC505E0` |
| `dados/cache/ncm_prodlist_2022.xlsx` | `98E45505BC401C7DD0E9EB62072641367E103B696918320DB8E290609BA27B32` |

O cache é imutável por convenção: se um arquivo já existe e tem tamanho maior
que zero, ele não é baixado novamente. Para captar uma revisão publicada pela
fonte mantendo auditabilidade, primeiro arquive o arquivo antigo e seu hash;
depois remova apenas o arquivo específico do cache e execute novamente.

## 7. Saídas e controles

O diretório de saída contém:

- `dim_ncm.csv`, `dim_prodlist.csv` e `dim_cnae.csv`;
- `bridge_ncm_prodlist_cnae.csv`;
- `fact_trade.csv` e `fact_production.csv`;
- `manifest.json`, com contagens, valor total de comércio e NCM sem Prodlist;
- `quality_summary.csv`, com cobertura, não mapeados, RAIS quando aplicável e
  reconciliação dos totais de controle.

Na ponte, `allocation_basis_status` indica se a base PIA usada para ponderar o
rateio estava publicada, sigilosa, indisponível ou ausente. Nos indicadores por
CNAE, `domestic_production_status` e `domestic_production_is_confidential`
sinalizam a condição da PIA; quando a produção está sigilosa ou ausente, o valor
comparável, o consumo aparente e a razão de dependência externa não são
calculados.

O manifesto presente no workspace em 14/07/2026 registra 9.469 NCM, 2.950
produtos Prodlist, 277 classes CNAE, 11.042 linhas na ponte, 158.933 linhas no
fato de comércio e 3.489 linhas no fato de produção. O valor FOB total registrado
é US$ 599.915.767.884 e há 553 NCM sem Prodlist.

Antes de aceitar uma atualização, confirme que as diferenças dos totais de
controle no `quality_summary.csv` são zero e analise mudanças relevantes de
cobertura, duplicidades e códigos não mapeados. O relatório não substitui a
auditoria qualitativa dos códigos genéricos.

Os módulos finais publicam em `outputs/final_border_value_2026` indicadores por
CNAE e Prodlist, rankings, comparação 2024 H1 versus 2026 H1, cenários de
sensibilidade de rateio, cadeias minerais estratégicas, recortes de combustíveis
da transição, workbook executivo e relatórios técnicos. O dashboard consome esses
arquivos junto com `outputs/official_2026_rais` para exibir fluxos mundiais,
território RAIS, escopo Border Value e hidrogênio/amônia/combustíveis da
transição.

## 8. Limitações, sigilo e defasagens das fontes

As saídas do Border Value preservam as restrições das fontes oficiais. Elas não
devem ser lidas como base de microdados completa nem como substituto de validação
setorial especializada.

- **Sigilo estatístico:** valores da PIA-Produto publicados como `X` são
  confidenciais. O pipeline não tenta reidentificar, imputar ou reconstruir esses
  valores. A produção fica ausente nas tabelas analíticas e os indicadores que
  dependem dela permanecem sem cálculo.
- **Indisponibilidade não confidencial:** marcadores `-`, `..`, `...` e ausência
  de linha no SIDRA são registrados como indisponibilidade ou ausência, separados
  do sigilo estatístico. Esses casos também bloqueiam consumo aparente,
  dependência externa, penetração das importações e orientação exportadora.
- **Defasagem temporal:** a execução oficial de 2026 combina comércio Comex Stat
  de janeiro a junho de 2026 com produção doméstica PIA-Produto 2024. Essa
  diferença decorre do calendário de publicação das fontes e deve acompanhar
  qualquer leitura dos indicadores comparáveis.
- **Defasagem classificatória:** NCM, PRODLIST-Indústria e correspondências
  CONCLA podem ter vigências distintas. NCM novas, extintas, genéricas ou sem
  ponte não devem ser alocadas automaticamente sem fonte oficial ou justificativa
  manual registrada.
- **Limitação da ponte 1:N:** quando uma NCM se vincula a múltiplas CNAEs, a
  alocação por valor de produção PIA ou por rateio igualitário é uma aproximação
  analítica. Os totais são reconciliados, mas a distribuição setorial pode exigir
  revisão por especialistas.
- **Comparabilidade:** comparações entre anos só são defensáveis quando o
  relatório registra período de comércio, ano da PIA, versão NCM, versão
  Prodlist, regra CNAE, fonte da correspondência e tratamento dos códigos não
  mapeados.
- **Hidrogênio e amônia:** NCMs de molécula, derivado, insumo, equipamento ou
  aplicação final não identificam rota de produção, eletricidade usada, captura
  de carbono, origem do hidrogênio ou intensidade de emissões. Classificações
  como verde, renovável, azul ou baixa emissão exigem bases complementares de
  projetos, plantas, capacidade, certificação e emissões.
- **Combustíveis da transição:** SAF, metanol, etanol e combustíveis marítimos
  são recortes preliminares. Códigos comerciais podem misturar produto fóssil e
  renovável, uso energético e uso industrial; os módulos registram drivers e
  campos complementares, mas não inferem atributo ambiental somente pela NCM.

## 9. Procedimento de atualização

RAIS, cartografia municipal, mapa mundial, integração, automação, hidrogênio e
amônia devem ser classificados apenas como consolidação, documentação e testes.
Eles não devem aparecer na pauta de desenvolvimento inicial de novas atividades.

1. Defina o ano-base e confirme no SIDRA qual tabela e qual versão Prodlist são
   declaradas para esse ano.
2. Se o ano não estiver coberto por `_pia_table`, atualize essa regra somente
   após validar o novo agregado, variável, classificação e unidade de medida.
3. Confirme a URL da correspondência oficial. Para uma versão nova, adicione-a a
   `PRODLIST_URLS` ou forneça `--mapping-source` explicitamente.
4. Preserve os arquivos e hashes da execução anterior. Limpe somente os arquivos
   de cache das fontes que precisam ser atualizadas.
5. Atualize RAIS quando ela entrar no recorte, incluindo ano, URLs dos pacotes,
   opções de leitura e período documentado.
6. Execute `python -m unittest -v`; todos os testes devem passar.
7. Execute a carga operacional e, quando aplicável, a carga RAIS com todos os
   parâmetros declarados em configuração versionada.
8. Reprocesse módulos finais, dashboard, workbook e pacote de publicação.
9. Calcule e registre os hashes SHA-256 das novas fontes em cache.
10. Compare `manifest.json`, `quality_summary.csv` e artefatos finais com a
    execução anterior.
11. Revise manualmente NCM genéricas, lacunas NCM–Prodlist, Prodlist sem CNAE e
    classificações preliminares de combustíveis da transição.
12. Registre data/hora, ambiente, comando, fontes, hashes, justificativas e
    responsável pela aprovação.

Exemplo da execução oficial 2026:

```powershell
python -m unittest -v
python operational_pipeline.py config.official.2026.json
python operational_pipeline.py config.official.2026.rais.json
python build_final_border_value_outputs.py
python build_combustiveis_transicao.py
Get-FileHash inputs/official/EXP_2026.csv,inputs/official/IMP_2026.csv,inputs/official/ncm_prodlist_2025.xlsx -Algorithm SHA256
```

## 10. Modelo de registro de nova execução

Copie e preencha este bloco a cada atualização:

```text
Data/hora:
Responsável:
Objetivo/ano-base:
Comando completo:
Python / pandas / openpyxl:
Versão NCM:
Versão Prodlist:
Versão/regra CNAE:
Tabela, variável e classificação SIDRA:
Arquivos de origem e hashes SHA-256:
Contagens do manifest:
Cobertura e totais de controle:
Exceções e auditorias manuais:
Resultado dos testes:
Aprovação:
```
