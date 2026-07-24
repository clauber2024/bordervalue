# Ambiente tecnico de homologacao

Este ambiente serve para verificacao tecnica da candidata `1.0.0-rc.1`. Ele nao deve ser descrito como publicacao institucional definitiva.

## Preparacao local

1. Executar os testes automatizados:

```powershell
python -m unittest -v
npm run test:ui
```

2. Regenerar os dados e artefatos, quando necessario:

```powershell
python operational_pipeline.py config.official.2026.json
python operational_pipeline.py config.official.2026.rais.json
python build_final_border_value_outputs.py
python build_comparacao_periodos.py
python build_rankings_recortes.py
python build_sensibilidade_rateio.py
python build_cadeias_minerais_estrategicas.py
python build_combustiveis_transicao.py
python build_top_partner_growth_outputs.py
python build_nib_territorializacao.py
python dashboard/build_dashboard_data.py
node build_final_border_value_workbook.mjs
python prepare_publication_package.py
```

3. Servir o painel tecnico legado de homologacao:

```powershell
npm run homolog:auditoria
```

Endereco local: `http://localhost:8765`.

## Conferencias minimas

- Abrir o painel tecnico legado e confirmar carregamento de indicadores, filtros, mapas e tabelas.
- Conferir `outputs/publicacao_border_value_2026/metadados/inventario_arquivos.csv`.
- Conferir `outputs/publicacao_border_value_2026/metadados/checksums_sha256.csv`.
- Confirmar a presenca do recorte `bases/top_partner_growth_2026_h1_vs_2025_h1` no pacote.
- Conferir `outputs/nib_territorializacao_2026/metodologia_territorializacao_nib.md`.
- Conferir `outputs/nib_territorializacao_2026/resumo_cadeias_nib_territorio.csv`.
- Confirmar a existencia dos arquivos em `outputs/publicacao_border_value_2026/pacotes_zip`.
- Confirmar a existencia de `outputs/publicacao_border_value_2026_completo.zip`.

## Restricoes de uso

- Nao publicar como versao institucional sem aprovacao formal.
- Nao alterar fontes, periodos ou classificacoes sem gerar nova candidata.
- Registrar qualquer diferenca de ambiente, dependencia ou fonte antes de promover a versao.
