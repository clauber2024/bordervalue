# Versao candidata 1.0.0-rc.1

Data de registro: 2026-07-16

Status: candidata tecnica para homologacao. Este registro nao caracteriza publicacao institucional definitiva.

## Resumo das mudancas

- Consolida o pipeline operacional 2026 com comercio exterior, PIA-Produto, camada opcional RAIS, PIB territorial e controles de qualidade.
- Atualiza os modulos finais de analise: indicadores por CNAE/Prodlist, comparacao de periodos, rankings, sensibilidade de rateio, produtos relacionados a transicao e cadeias minerais estrategicas.
- Atualiza o dashboard oficial em `dashboard/`, incluindo leitura territorial RAIS, mapa municipal, mapa mundial de parceiros comerciais, escopo Border Value e recortes de produtos relacionados a transicao.
- Inclui recorte complementar de crescimento por parceiro comercial, com top 5 paises no comercio de janeiro a junho de 2026 e produtos com maior crescimento frente a janeiro-junho de 2025.
- Registra testes Python e testes de interface do dashboard para apoiar a homologacao.
- Regenera o pacote tecnico com inventario, checksums SHA-256, dicionario de dados, arquivos de reproducao e arquivos compactados.

## Escopo da candidata

- Periodo de comercio: janeiro a junho de 2026.
- Producao domestica: PIA-Produto 2024.
- Emprego formal: RAIS 2024, quando executada a configuracao completa.
- Classificacao principal: NCM 2026, ponte NCM-PRODLIST-Industria 2025 e CNAE derivada do codigo Prodlist.
- Metodo de rateio: peso por valor de producao PIA por CNAE, com fallback igualitario quando a base economica do grupo estiver ausente, incompleta ou nao positiva.
- Recorte complementar de parceiros: comparacao janeiro-junho de 2026 contra janeiro-junho de 2025.

## Criterios de aceite tecnico

- Testes automatizados Python executados sem falha.
- Teste de interface do dashboard executado sem falha.
- Pacote de homologacao regenerado em `outputs/publicacao_border_value_2026`.
- Arquivo completo regenerado em `outputs/publicacao_border_value_2026_completo.zip`.
- Inventario e checksums atualizados em `outputs/publicacao_border_value_2026/metadados`.
