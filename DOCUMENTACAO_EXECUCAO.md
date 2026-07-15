# Documentação da execução e atualização

Este documento registra a proveniência, as classificações, os parâmetros e o
procedimento de atualização do pipeline **Border Value**. A data de referência
deste registro é **14 de julho de 2026**.

## 1. Escopo e fluxo

O pipeline integra, nesta ordem:

1. comércio exterior do Comex Stat, na granularidade NCM de oito dígitos;
2. correspondência oficial NCM × Prodlist-Indústria da CONCLA/IBGE;
3. produção doméstica da PIA-Produto, consultada no SIDRA/IBGE;
4. dimensões NCM, Prodlist e CNAE, ponte de correspondência e tabelas fato.

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
| Comex Stat/MDIC | Exportações e importações anuais por NCM-8 | `https://balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm/{EXP|IMP}_{ano}.csv` | 2024; fluxos EXP e IMP |
| CONCLA/IBGE | Correspondência NCM × Prodlist-Indústria | `https://concla.ibge.gov.br/images/concla/documentacao/PRODLIST%20Ind%202022%20x%20NCM%202022.xlsx` | versão 2022 |
| PIA-Produto/SIDRA/IBGE | Valor da produção por produto Prodlist, em mil R$ | API SIDRA v3, agregado 10476, variável 215, classificação 1264, Brasil | 2024 |

Para a PIA-Produto, o código monta a consulta:

```text
https://servicodados.ibge.gov.br/api/v3/agregados/10476/periodos/2024/variaveis/215?localidades=N1%5Ball%5D&classificacao=1264%5Ball%5D
```

O agregado SIDRA 7752 é usado para os anos 2014–2023; o agregado 10476 é usado
para 2024. O código atualmente aceita apenas o intervalo 2014–2024 para a PIA.

## 3. Versões das classificações

- **NCM:** classificação anual do arquivo detalhado do Comex Stat correspondente
  ao ano solicitado; na execução registrada, NCM 2024.
- **Prodlist-Indústria:** versão 2022. Essa versão é usada para 2024 porque é a
  versão declarada na tabela SIDRA 10476.
- **CNAE:** classe de quatro dígitos derivada do prefixo do código Prodlist 2022;
  a presença da classe é validada contra o universo observado na PIA-Produto.
- **Correspondência alternativa:** somente deve ser usada de forma explícita com
  `--mapping-source`; o arquivo e sua versão devem ser registrados no histórico
  da execução.

O código também contém a URL oficial da correspondência Prodlist 2025. Ela não
deve substituir automaticamente a versão 2022 em uma série de 2024, pois isso
alteraria a base classificatória e poderia quebrar a comparabilidade.

## 4. Parâmetros da execução registrada

Comando lógico:

```powershell
python fontes_reais.py --years 2024 --flows EXP IMP --prodlist-version 2022 --cache-dir dados/cache --output-dir dados/processados
```

Os valores de `--flows`, `--prodlist-version`, `--cache-dir` e `--output-dir`
acima coincidem com os padrões do programa. `--years` é obrigatório.

| Parâmetro | Valor registrado | Observação |
|---|---|---|
| `--years` | `2024` | Um ou mais anos, separados por espaço |
| `--flows` | `EXP IMP` | Valores aceitos: EXP e IMP |
| `--prodlist-version` | `2022` | Há URL embutida para 2022 e 2025 |
| `--mapping-source` | não informado | Usa a URL oficial configurada |
| `--cache-dir` | `dados/cache` | Arquivos existentes e não vazios são reutilizados |
| `--output-dir` | `dados/processados` | Diretório sobrescrito arquivo a arquivo |
| leitura Comex | blocos de 500.000 linhas | Parâmetro interno `chunksize` |
| grão do comércio | ano, mês, fluxo, NCM-8 | HS6 é explicitamente proibido |
| grão da produção | ano, Prodlist, status, CNAE | Valor em mil R$ |

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
- `relatorio_qualidade.json`, gerado pelo código atual, com cobertura, não
  mapeados, duplicidades e reconciliação dos totais de controle.

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
controle no `relatorio_qualidade.json` são zero e analise mudanças relevantes de
cobertura, duplicidades e códigos não mapeados. O relatório não substitui a
auditoria qualitativa dos códigos genéricos.

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

## 9. Procedimento de atualização

1. Defina o ano-base e confirme no SIDRA qual tabela e qual versão Prodlist são
   declaradas para esse ano.
2. Se o ano não estiver coberto por `_pia_table`, atualize essa regra somente
   após validar o novo agregado, variável, classificação e unidade de medida.
3. Confirme a URL da correspondência oficial. Para uma versão nova, adicione-a a
   `PRODLIST_URLS` ou forneça `--mapping-source` explicitamente.
4. Preserve os arquivos e hashes da execução anterior. Limpe somente os arquivos
   de cache das fontes que precisam ser atualizadas.
5. Execute `python -m unittest -v`; todos os testes devem passar.
6. Execute a carga com todos os parâmetros declarados, mesmo quando coincidirem
   com os padrões, para que o comando seja autoexplicativo.
7. Calcule e registre os hashes SHA-256 das novas fontes em cache.
8. Compare `manifest.json` e `relatorio_qualidade.json` com a execução anterior.
9. Revise manualmente NCM genéricas, lacunas NCM–Prodlist e Prodlist sem CNAE.
10. Registre data/hora, ambiente, comando, fontes, hashes, justificativas e
    responsável pela aprovação.

Exemplo para 2024:

```powershell
python -m unittest -v
python fontes_reais.py --years 2024 --flows EXP IMP --prodlist-version 2022 --cache-dir dados/cache --output-dir dados/processados
Get-FileHash dados/cache/comex/EXP_2024.csv,dados/cache/comex/IMP_2024.csv,dados/cache/ncm_prodlist_2022.xlsx -Algorithm SHA256
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
