from __future__ import annotations

import csv
import hashlib
import json
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parent
PACKAGE_DIR = ROOT / "outputs" / "publicacao_border_value_2026"
VERSION_CANDIDATE = "1.0.0-rc.1"
VERSION_CANDIDATE_DATE = "2026-07-16"
ALREADY_COMPRESSED_SUFFIXES = {".7z", ".gz", ".zip", ".xlsx", ".docx", ".pptx", ".parquet"}

SOURCE_GROUPS = {
    "bases/official_2026": ROOT / "outputs" / "official_2026",
    "bases/final_border_value_2026": ROOT / "outputs" / "final_border_value_2026",
    "bases/tsb_bridge_2026": ROOT / "outputs" / "tsb_bridge_2026",
    "bases/nib_territorializacao_2026": ROOT / "outputs" / "nib_territorializacao_2026",
    "bases/top_partner_growth_2026_h1_vs_2025_h1": ROOT / "outputs" / "top_partner_growth_2026_h1_vs_2025_h1",
    "bases/fontes_entrada": ROOT / "inputs" / "official",
}

REPRODUCTION_FILES = [
    "operational_pipeline.py",
    "pipeline_harmonizacao.py",
    "fontes_reais.py",
    "build_final_border_value_outputs.py",
    "build_final_border_value_workbook.mjs",
    "build_comparacao_periodos.py",
    "build_rankings_recortes.py",
    "build_sensibilidade_rateio.py",
    "build_cadeias_minerais_estrategicas.py",
    "build_combustiveis_transicao.py",
    "build_tsb_bridge.py",
    "build_nib_territorializacao.py",
    "build_top_partner_growth_outputs.py",
    "audit_variacao_ncm.py",
    "audit_nao_mapeado_prioritario.py",
    "build_auditoria.mjs",
    "verify_auditoria.mjs",
    "inspect_diagnostico.mjs",
    "config.official.2026.json",
    "config.official.2026.rais.json",
    "config.historical.2024.json",
    "test_operational_pipeline.py",
    "test_pipeline_harmonizacao.py",
    "test_fontes_reais.py",
    "tests/test_tsb_bridge.py",
    "dados/nib/dim_nib_cadeias_cnae.csv",
    "package.json",
    "package-lock.json",
    "README.md",
    "VERSION_CANDIDATE.md",
    "HOMOLOGACAO_TECNICA.md",
    "DOCUMENTACAO_EXECUCAO.md",
]

TABLE_DESCRIPTIONS = {
    "dim_ncm": "Dimensao de codigos NCM observados no comercio exterior.",
    "dim_prodlist": "Dimensao de produtos PRODLIST-Industria usados na ponte oficial.",
    "dim_cnae": "Dimensao de classes CNAE derivadas da PRODLIST ou observadas na PIA-Produto.",
    "bridge_ncm_prodlist_cnae": "Ponte NCM-PRODLIST-CNAE com pesos de alocacao analitica.",
    "fact_trade": "Fato de comercio exterior por periodo, fluxo e NCM.",
    "fact_production": "Fato de producao domestica por CNAE a partir da PIA-Produto.",
    "analytic_trade_cnae": "Comercio alocado por CNAE apos aplicacao dos pesos da ponte.",
    "border_value_indicators_cnae": "Indicadores Border Value consolidados por CNAE.",
    "quality_summary": "Metricas de controle, cobertura e reconciliacao.",
    "audit_unmatched_ncm": "NCMs presentes no comercio sem ponte oficial para PRODLIST.",
    "audit_generic_ncm": "NCMs com terminacoes genericas que exigem atencao qualitativa.",
    "audit_unmatched_cnae": "Classes CNAE da producao sem alcance pela ponte de comercio.",
    "fact_production_prodlist": "Producao domestica por produto PRODLIST.",
    "comercio_alocado_cnae_prodlist_fluxo_periodo": "Comercio alocado por CNAE, PRODLIST, fluxo e periodo.",
    "border_value_indicadores_finais_cnae": "Indicadores finais consolidados por CNAE para analise publica.",
    "border_value_indicadores_finais_cnae_prodlist": "Indicadores finais por CNAE e PRODLIST.",
    "ncm_sem_ponte_priorizacao": "Priorizacao de NCMs sem ponte para revisao manual.",
    "nao_mapeado_subbuckets": "Agrupamentos auxiliares de itens nao mapeados.",
    "ncm_prodlist_overrides_template": "Template para documentar ajustes manuais NCM-PRODLIST.",
    "rankings_cnae": "Ranking setorial por classe CNAE.",
    "rankings_prodlist": "Ranking por produto PRODLIST.",
    "mudancas_mensais_cnae": "Mudancas mensais relevantes por CNAE.",
    "concentracao_produtos_cnae": "Concentracao de produtos dentro de cada CNAE.",
    "employment_platform_cnae": "RAIS agregada por CNAE com escopo da plataforma e score preliminar emprego-plataforma.",
    "employment_scope_summary": "Resumo RAIS por escopo da plataforma.",
    "employment_territory_cnae": "RAIS por CNAE, UF e municipio para leitura territorial.",
    "fact_gdp": "PIB territorial por ano, UF e municipio.",
    "gdp_territory": "PIB territorial enriquecido com nomes de municipio, UF e regiao.",
    "indicadores_combustiveis_transicao_camada": "Indicadores de produtos relacionados a hidrogenio, amonia, metanol, etanol, combustiveis de aviacao e combustiveis maritimos por etapa da cadeia.",
    "drivers_combustiveis_transicao_ncm": "NCMs observadas por recorte de combustivel e etapa da cadeia.",
    "fontes_complementares_combustiveis_transicao": "Campos complementares requeridos para validar rota, certificacao e intensidade de emissoes.",
    "estrutura_analitica_hidrogenio_amonia": "Camadas obrigatorias para leitura de hidrogenio e amonia.",
    "priorizacao_cadeias_minerais_estrategicas": "Priorizacao de cadeias minerais estrategicas com comercio, criticidade e materialidade ANM quando disponivel.",
    "referencia_criticidade_minerais": "Pesos e justificativas de criticidade por mineral-base.",
    "indicadores_cadeias_minerais_etapa": "Indicadores por cadeia mineral estrategica e etapa da cadeia.",
    "drivers_cadeias_minerais_ncm": "Principais NCMs por cadeia mineral estrategica.",
    "fact_anm_mineral_production": "Camada complementar ANM/AMB de producao mineral por substancia, normalizada para mineral-base.",
    "fontes_anm_amb_status": "Status de acesso, cache e leitura das fontes abertas ANM/AMB.",
    "top5_paises_2026_h1": "Cinco principais paises parceiros no comercio total de janeiro a junho de 2026.",
    "comparacao_produtos_top5_paises": "Comparacao por pais, fluxo e NCM entre janeiro-junho de 2025 e janeiro-junho de 2026.",
    "rankings_produtos_crescimento_top5_paises": "Produtos com maior crescimento percentual entre os principais paises parceiros.",
    "bridge_tsb_cnae_class": "Ponte TSB-CNAE que reduz CNAE5 do relatorio para classe CNAE de quatro digitos da plataforma.",
    "bridge_tsb_ncm": "Ponte TSB-NCM derivada de CNAE classe, PRODLIST e ponte NCM-PRODLIST-CNAE.",
    "rais_tsb_employment_cnae": "Vinculos RAIS por CNAE classificados segundo exposicao TSB.",
    "rais_tsb_employment_territory": "Vinculos RAIS por UF e municipio em setores com e sem exposicao TSB.",
    "rais_tsb_employment_summary": "Resumo de vinculos, massa salarial, CNAEs e municipios por grupo de exposicao TSB.",
    "scn67_tsb_exposure": "Dimensao SCN67 com exposicao TSB numerica e grupo de exposicao.",
    "border_value_indicadores_finais_cnae_tsb": "Indicadores finais por CNAE enriquecidos com classificacao TSB.",
    "dim_nib_cadeias_cnae": "Ponte editavel CNAE-cadeia NIB usada para triagem territorial inspirada no mapeamento DIEESE.",
    "bridge_nib_cnae_class": "Ponte NIB-CNAE classe com missoes e cadeias prioritarias associadas.",
    "bridge_nib_ncm": "Ponte NIB-NCM derivada da ponte oficial NCM-PRODLIST-CNAE e da ponte CNAE-cadeia NIB.",
    "rais_nib_employment_cnae": "Emprego RAIS por CNAE associado a missoes e cadeias prioritarias NIB.",
    "rais_nib_employment_territory": "Emprego RAIS por municipio e cadeia NIB, com tipologia territorial.",
    "resumo_cadeias_nib_territorio": "Resumo por cadeia NIB com emprego, municipios, comercio setorial de referencia e score de prioridade territorial.",
    "top100_municipios_industria_transformacao_rais": "Ranking dos 100 maiores municipios por emprego RAIS na industria de transformacao.",
}

COLUMN_DESCRIPTIONS = {
    "ncm_key": "Chave tecnica da NCM no modelo dimensional.",
    "ncm": "Codigo NCM de oito digitos.",
    "is_generic_code": "Indicador de codigo NCM generico, tipicamente terminado em 9, 90 ou 99.",
    "prodlist_key": "Chave tecnica do produto PRODLIST no modelo dimensional.",
    "prodlist_code": "Codigo PRODLIST-Industria.",
    "cnae_key": "Chave tecnica da classe CNAE no modelo dimensional.",
    "cnae_class": "Classe CNAE de quatro digitos.",
    "allocation_rule": "Regra usada para distribuir uma NCM entre CNAEs candidatas.",
    "allocation_basis_status": "Situacao da base PIA usada no peso de alocacao.",
    "allocation_weight": "Peso aplicado a linha da ponte para alocar comercio.",
    "year": "Ano de referencia.",
    "month": "Mes de referencia.",
    "flow": "Fluxo comercial: EXP para exportacao ou IMP para importacao.",
    "value_usd": "Valor FOB em dolares dos Estados Unidos.",
    "net_weight_kg": "Peso liquido em quilogramas.",
    "production_value": "Valor da producao domestica na unidade original da PIA-Produto.",
    "production_status": "Situacao de publicacao da producao na PIA-Produto.",
    "allocation_status": "Status da alocacao do comercio na etapa analitica.",
    "import_value_usd": "Valor FOB importado em dolares dos Estados Unidos.",
    "export_value_usd": "Valor FOB exportado em dolares dos Estados Unidos.",
    "trade_balance_usd": "Saldo comercial em dolares dos Estados Unidos.",
    "import_net_weight_kg": "Peso liquido importado em quilogramas.",
    "export_net_weight_kg": "Peso liquido exportado em quilogramas.",
    "domestic_production_value_brl_thousand": "Valor da producao domestica em mil reais.",
    "domestic_production_status": "Situacao da producao domestica: publicada, sigilosa, ausente ou indisponivel.",
    "domestic_production_is_confidential": "Indicador de sigilo estatistico na PIA-Produto.",
    "domestic_production_value_usd_comparable": "Producao convertida para US$ por fator explicito documentado.",
    "apparent_consumption_value_usd": "Consumo aparente estimado em US$: producao + importacoes - exportacoes.",
    "external_dependency_ratio": "Razao de dependencia externa: importacoes / consumo aparente.",
    "external_dependency_status": "Status do calculo da dependencia externa.",
    "recorte_combustivel": "Recorte transversal de combustivel da transicao.",
    "camada_analitica": "Etapa da cadeia analisada no recorte de combustiveis.",
    "status_baixa_emissao": "Sinalizacao de que baixa emissao nao e inferivel apenas por NCM.",
    "ressalva_metodologica": "Aviso metodologico sobre limite da classificacao por NCM.",
    "campo_requerido": "Campo de fonte complementar necessario para validar rota, certificacao ou emissao.",
    "cadeia_estrategica": "Recorte de cadeia estrategica da transicao energetica.",
    "mineral_base": "Mineral ou grupo mineral usado como chave analitica transversal.",
    "prioridade_transicao": "Prioridade qualitativa do mineral ou cadeia para tecnologias de transicao.",
    "etapa_cadeia": "Etapa analitica da cadeia: mineral primario, quimico/processado, metal/liga ou componente.",
    "strategic_score": "Score que combina comercio observado, desequilibrio, prioridade, criticidade e materialidade ANM quando disponivel.",
    "anm_materiality_rank": "Percentil de materialidade produtiva ANM/AMB; zero quando a fonte nao esta disponivel ou nao traz valor.",
    "production_stage": "Estagio informado pela ANM/AMB: producao bruta ou beneficiada.",
    "substance": "Substancia mineral como publicada ou normalizada a partir da ANM/AMB.",
    "quantity": "Quantidade de producao mineral na unidade original da ANM/AMB.",
    "unit": "Unidade de medida original da ANM/AMB.",
    "production_value_brl": "Valor de producao mineral em reais, quando publicado pela ANM/AMB.",
    "cache_path": "Caminho local de cache usado para a fonte aberta.",
    "status": "Status de acesso ou leitura da fonte.",
    "formal_jobs": "Vinculos formais ativos em 31/12 na RAIS.",
    "gdp_value_brl": "Produto Interno Bruto territorial em reais.",
    "gdp_status": "Situacao de publicacao do PIB territorial: publicado, sigiloso, ausente ou indisponivel.",
    "platform_scope_status": "Classificacao do CNAE RAIS frente ao escopo da plataforma.",
    "cnae5": "Subclasse CNAE de cinco digitos usada no relatorio TSB.",
    "scn67": "Codigo do setor SCN67 usado na leitura macrosetorial TSB.",
    "setor_scn67": "Nome do setor SCN67.",
    "tsb_associated": "Indica se a classe CNAE ou NCM esta associada a alguma atividade TSB.",
    "tsb_cnae5_count": "Quantidade de CNAE5 TSB vinculadas a classe CNAE.",
    "tsb_cnae5_list": "Lista de CNAE5 TSB vinculadas a classe CNAE ou NCM.",
    "tsb_scn67_list": "Lista de setores SCN67 TSB associados.",
    "tsb_setor_scn67_list": "Lista de nomes dos setores SCN67 associados.",
    "tsb_exposicao_scn67_max": "Maior grau de exposicao TSB observado entre os setores SCN67 associados.",
    "tsb_grupo_exposicao": "Grupo de exposicao TSB: alta, intermediaria ou sem exposicao direta.",
    "tsb_leitura_tecnica": "Leitura tecnica do grupo de exposicao TSB.",
    "cnae_class_list": "Lista de classes CNAE associadas a NCM.",
    "prodlist_code_list": "Lista de codigos PRODLIST associados a NCM.",
    "cnae_count": "Quantidade de classes CNAE distintas no agregado.",
    "municipality_count": "Quantidade de municipios distintos no agregado.",
    "missao_nib": "Missao da Nova Industria Brasil associada a cadeia prioritaria.",
    "cadeia_nib": "Identificador da cadeia prioritaria dentro da missao NIB.",
    "cadeia_nome": "Nome da cadeia prioritaria da Nova Industria Brasil.",
    "nib_chain_id": "Identificador combinado da missao e cadeia NIB.",
    "nib_associated": "Indica se a classe CNAE ou NCM esta associada a alguma cadeia NIB na ponte editavel.",
    "nib_chain_count": "Quantidade de cadeias NIB associadas a classe CNAE.",
    "nib_mission_list": "Lista de missoes NIB associadas.",
    "nib_chain_id_list": "Lista de identificadores de cadeias NIB associadas.",
    "nib_chain_name_list": "Lista de nomes das cadeias NIB associadas.",
    "nib_mapping_status": "Status metodologico da associacao CNAE-cadeia NIB.",
    "nib_mapping_status_list": "Lista de status metodologicos das associacoes NIB.",
    "nib_source_note_list": "Notas de fonte e validacao da ponte NIB.",
    "source_note": "Nota de fonte usada para justificar a classificacao.",
    "total_manufacturing_jobs": "Total de empregos formais no municipio em CNAEs da industria de transformacao.",
    "industrial_city_rank": "Posicao do municipio no ranking nacional de emprego formal na industria de transformacao.",
    "is_top100_industrial_city": "Indica se o municipio esta entre os 100 maiores por emprego na industria de transformacao.",
    "chain_municipality_rank": "Posicao do municipio no ranking de emprego formal dentro da cadeia NIB.",
    "territorial_typology": "Tipologia territorial da cadeia no municipio: regiao industrial madura, polo relevante da cadeia ou territorio emergente/disperso.",
    "mature_city_count": "Quantidade de municipios da cadeia classificados entre os 100 maiores centros industriais.",
    "cnae_reference_trade_value_usd": "Valor de comercio setorial das CNAEs associadas a cadeia; nao representa comercio municipalizado.",
    "cnae_reference_import_value_usd": "Valor importado setorial das CNAEs associadas a cadeia; nao representa importacao municipalizada.",
    "cnae_reference_export_value_usd": "Valor exportado setorial das CNAEs associadas a cadeia; nao representa exportacao municipalizada.",
    "nib_territorial_priority_score": "Score de triagem que combina escala RAIS, comercio setorial de referencia e prioridade Border Value.",
    "metric": "Nome da metrica de controle.",
    "value": "Valor da metrica.",
    "description": "Descricao da metrica ou registro.",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clean_package_dir() -> None:
    if PACKAGE_DIR.exists():
        shutil.rmtree(PACKAGE_DIR)
    for folder in [
        "bases",
        "metadados",
        "dicionario_dados",
        "reproducao",
        "pacotes_zip",
    ]:
        (PACKAGE_DIR / folder).mkdir(parents=True, exist_ok=True)


def copy_tree_files(source: Path, target: Path) -> list[Path]:
    copied: list[Path] = []
    if not source.exists():
        return copied
    for item in source.rglob("*"):
        if not item.is_file():
            continue
        if item.suffix.lower() in {".png", ".webp", ".ndjson", ".log"}:
            continue
        relative = item.relative_to(source)
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, destination)
        copied.append(destination)
    return copied


def copy_reproduction_files() -> list[Path]:
    copied: list[Path] = []
    target = PACKAGE_DIR / "reproducao"
    for rel in REPRODUCTION_FILES:
        source = ROOT / rel
        if not source.exists():
            continue
        destination = target / rel
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied.append(destination)
    return copied


def count_csv_rows(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return max(sum(1 for _ in handle) - 1, 0)


def inspect_csv(path: Path) -> tuple[list[str], dict[str, str], dict[str, int]]:
    sample = pd.read_csv(path, nrows=10000, low_memory=False)
    columns = list(sample.columns)
    dtypes = {column: str(dtype) for column, dtype in sample.dtypes.items()}
    non_null = {column: int(sample[column].notna().sum()) for column in columns}
    return columns, dtypes, non_null


def table_name_from_path(path: Path) -> str:
    return path.stem


def build_data_dictionary() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for path in sorted((PACKAGE_DIR / "bases").rglob("*.csv")):
        table_name = table_name_from_path(path)
        columns, dtypes, non_null = inspect_csv(path)
        row_count = count_csv_rows(path)
        for order, column in enumerate(columns, start=1):
            rows.append(
                {
                    "arquivo": str(path.relative_to(PACKAGE_DIR)).replace("\\", "/"),
                    "tabela": table_name,
                    "descricao_tabela": TABLE_DESCRIPTIONS.get(table_name, ""),
                    "ordem_coluna": order,
                    "coluna": column,
                    "tipo_inferido_amostra": dtypes.get(column, ""),
                    "linhas": row_count,
                    "nao_nulos_amostra_ate_10000": non_null.get(column, 0),
                    "descricao_coluna": COLUMN_DESCRIPTIONS.get(column, ""),
                }
            )
    return rows


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_markdown_dictionary(rows: list[dict[str, object]]) -> None:
    target = PACKAGE_DIR / "dicionario_dados" / "dicionario_dados.md"
    grouped: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        grouped.setdefault(str(row["arquivo"]), []).append(row)
    lines = [
        "# Dicionario de dados",
        "",
        "Dicionario gerado automaticamente a partir dos arquivos CSV incluidos em `bases/`.",
        "Os tipos sao inferidos por amostra de ate 10.000 linhas; use os CSV como fonte normativa.",
        "",
    ]
    for arquivo, table_rows in grouped.items():
        first = table_rows[0]
        lines.extend(
            [
                f"## {arquivo}",
                "",
                f"- Tabela: `{first['tabela']}`",
                f"- Linhas: {first['linhas']}",
                f"- Descricao: {first['descricao_tabela'] or 'Nao informada.'}",
                "",
                "| Ordem | Coluna | Tipo inferido | Descricao |",
                "|---:|---|---|---|",
            ]
        )
        for row in table_rows:
            description = str(row["descricao_coluna"]).replace("|", "\\|") or "Nao informada."
            lines.append(
                f"| {row['ordem_coluna']} | `{row['coluna']}` | `{row['tipo_inferido_amostra']}` | {description} |"
            )
        lines.append("")
    target.write_text("\n".join(lines), encoding="utf-8")


def build_checksums() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for path in sorted(PACKAGE_DIR.rglob("*")):
        if not path.is_file() or "pacotes_zip" in path.parts:
            continue
        rows.append(
            {
                "arquivo": str(path.relative_to(PACKAGE_DIR)).replace("\\", "/"),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
        )
    return rows


def category_for_file(relative_file: str) -> str:
    if relative_file.startswith("bases/"):
        return "base"
    if relative_file.startswith("metadados/"):
        return "metadado"
    if relative_file.startswith("dicionario_dados/"):
        return "dicionario"
    if relative_file.startswith("reproducao/"):
        return "reproducao"
    return "raiz"


def write_inventory(checksums: list[dict[str, object]]) -> None:
    rows = []
    for row in checksums:
        arquivo = str(row["arquivo"])
        rows.append(
            {
                "arquivo": arquivo,
                "categoria": category_for_file(arquivo),
                "extensao": Path(arquivo).suffix.lower(),
                "bytes": row["bytes"],
                "sha256": row["sha256"],
            }
        )
    write_csv(
        PACKAGE_DIR / "metadados" / "inventario_arquivos.csv",
        rows,
        ["arquivo", "categoria", "extensao", "bytes", "sha256"],
    )


def write_metadata(copied_files: list[Path], dictionary_rows: list[dict[str, object]]) -> None:
    metadata_dir = PACKAGE_DIR / "metadados"
    now = datetime.now(timezone.utc).isoformat()
    source_manifest = ROOT / "outputs" / "official_2026" / "manifest.json"
    final_manifest = ROOT / "outputs" / "final_border_value_2026" / "manifest.json"
    if source_manifest.exists():
        shutil.copy2(source_manifest, metadata_dir / "manifest_official_2026.json")
    if final_manifest.exists():
        shutil.copy2(final_manifest, metadata_dir / "manifest_final_border_value_2026.json")

    package_manifest = {
        "package_name": "publicacao_border_value_2026",
        "version_candidate": VERSION_CANDIDATE,
        "version_candidate_date": VERSION_CANDIDATE_DATE,
        "release_status": "candidata tecnica para homologacao; nao caracteriza publicacao institucional definitiva",
        "created_at_utc": now,
        "source_workspace": str(ROOT),
        "scope": {
            "trade_period": "2026-01 a 2026-06",
            "production_period": "2024",
            "prodlist_version": "2025 (ponte NCM); PIA-Produto em PRODLIST 2022",
            "allocation_method": "production_value_weighted_cnae_with_equal_fallback",
        },
        "folders": {
            "bases": "Bases de entrada e saidas publicaveis em CSV, Parquet, XLSX, DOCX e PPTX.",
            "metadados": "Manifestos, fontes, checksums e inventario do pacote.",
            "dicionario_dados": "Dicionario de dados em CSV e Markdown.",
            "reproducao": "Scripts, configuracoes, testes e documentacao para reproduzir a execucao.",
            "pacotes_zip": "Arquivos compactados por bloco e pacote completo.",
        },
        "file_count": len(copied_files),
        "dictionary_rows": len(dictionary_rows),
    }
    (metadata_dir / "package_manifest.json").write_text(
        json.dumps(package_manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    fonte_lines = [
        "# Fontes e metodos",
        "",
        "Este pacote consolida os arquivos de publicacao do projeto Border Value 2026.",
        "",
        f"Versao candidata: `{VERSION_CANDIDATE}`, registrada em {VERSION_CANDIDATE_DATE}.",
        "Status: ambiente tecnico de homologacao, ainda sem caracterizacao como publicacao institucional definitiva.",
        "",
        "## Escopo",
        "",
        "- Comercio exterior: Comex Stat, janeiro a junho de 2026, fluxos EXP e IMP.",
        "- Ponte NCM-PRODLIST: correspondencia oficial CONCLA/IBGE para PRODLIST-Industria 2025.",
        "- Producao domestica: PIA-Produto 2024, valor da producao em mil R$.",
        "- Emprego formal: RAIS 2024 por CNAE, UF e municipio, quando disponivel no pacote.",
        "- Mapas: fluxos mundiais por pais parceiro e leitura territorial RAIS municipal no dashboard.",
        "- Produtos relacionados a transicao: hidrogenio, amonia, metanol, etanol, combustiveis de aviacao e combustiveis maritimos, sem inferir atributo ambiental apenas pela NCM.",
        "- TSB: ponte derivada CNAE5-CNAE classe-PRODLIST-NCM-RAIS, preservando a diferenca de granularidade entre relatorio e plataforma.",
        "- NIB territorial: ponte editavel CNAE-cadeia NIB inspirada no mapeamento DIEESE, com RAIS municipal e comercio apenas como referencia setorial da cadeia.",
        "- Parceiros comerciais: top 5 paises de janeiro a junho de 2026 e produtos com maior crescimento frente a janeiro-junho de 2025.",
        "- Governanca de atividades: RAIS, cartografia, mapa mundial, integracao, automacao, hidrogenio e amonia entram somente em consolidacao, documentacao e testes.",
        "- Conversao monetaria: fator documentado em `config.official.2026.json`.",
        "- Rateio: pesos por valor de producao por CNAE, com fallback igualitario quando necessario.",
        "",
        "## Como reproduzir",
        "",
        "Execute a partir da raiz do projeto:",
        "",
        "```powershell",
        "python -m unittest -v",
        "python operational_pipeline.py config.official.2026.json",
        "python build_final_border_value_outputs.py",
        "python build_combustiveis_transicao.py",
        "python build_tsb_bridge.py",
        "python build_nib_territorializacao.py",
        "python build_top_partner_growth_outputs.py",
        "node build_final_border_value_workbook.mjs",
        "python prepare_publication_package.py",
        "```",
        "",
        "Consulte `reproducao/README.md` e `reproducao/DOCUMENTACAO_EXECUCAO.md` para detalhes metodologicos.",
    ]
    (metadata_dir / "fontes_e_metodos.md").write_text("\n".join(fonte_lines), encoding="utf-8")


def zip_folder(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                compression = (
                    zipfile.ZIP_STORED
                    if path.suffix.lower() in ALREADY_COMPRESSED_SUFFIXES
                    else zipfile.ZIP_DEFLATED
                )
                archive.write(path, path.relative_to(source), compress_type=compression)


def write_readme() -> None:
    lines = [
        "# Pacote de publicacao - Border Value 2026",
        "",
        f"Versao candidata `{VERSION_CANDIDATE}`, registrada em {VERSION_CANDIDATE_DATE}.",
        "",
        "Conteudo preparado para homologacao tecnica e reproducao dos resultados. Este pacote ainda nao caracteriza publicacao institucional definitiva.",
        "",
        "## Estrutura",
        "",
        "- `bases/`: bases de entrada oficiais e saidas publicaveis do pipeline.",
        "- `metadados/`: manifestos, inventario, checksums SHA-256 e notas de fontes/metodo.",
        "- `dicionario_dados/`: dicionario em CSV e Markdown para todas as bases CSV publicadas.",
        "- `reproducao/`: scripts, configuracoes, testes e documentacao de execucao.",
        "- `pacotes_zip/`: compactacoes por bloco e pacote completo.",
        "",
        "## Verificacao",
        "",
        "Use `metadados/checksums_sha256.csv` para conferir integridade dos arquivos.",
        "O arquivo `metadados/package_manifest.json` registra escopo, periodo, metodo de rateio e data de geracao.",
        "Consulte `reproducao/VERSION_CANDIDATE.md` e `reproducao/HOMOLOGACAO_TECNICA.md` para o resumo da candidata e o ambiente de homologacao.",
    ]
    (PACKAGE_DIR / "README_PUBLICACAO.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    clean_package_dir()
    copied: list[Path] = []
    for target_rel, source in SOURCE_GROUPS.items():
        copied.extend(copy_tree_files(source, PACKAGE_DIR / target_rel))
    copied.extend(copy_reproduction_files())

    dictionary_rows = build_data_dictionary()
    dictionary_fields = [
        "arquivo",
        "tabela",
        "descricao_tabela",
        "ordem_coluna",
        "coluna",
        "tipo_inferido_amostra",
        "linhas",
        "nao_nulos_amostra_ate_10000",
        "descricao_coluna",
    ]
    write_csv(PACKAGE_DIR / "dicionario_dados" / "dicionario_dados.csv", dictionary_rows, dictionary_fields)
    write_markdown_dictionary(dictionary_rows)
    write_metadata(copied, dictionary_rows)
    write_readme()

    checksums = build_checksums()
    write_csv(PACKAGE_DIR / "metadados" / "checksums_sha256.csv", checksums, ["arquivo", "bytes", "sha256"])
    (PACKAGE_DIR / "metadados" / "checksums_sha256.json").write_text(
        json.dumps(checksums, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    write_inventory(checksums)

    zip_folder(PACKAGE_DIR / "bases", PACKAGE_DIR / "pacotes_zip" / "bases_publicacao_border_value_2026.zip")
    zip_folder(PACKAGE_DIR / "metadados", PACKAGE_DIR / "pacotes_zip" / "metadados_border_value_2026.zip")
    zip_folder(PACKAGE_DIR / "dicionario_dados", PACKAGE_DIR / "pacotes_zip" / "dicionario_dados_border_value_2026.zip")
    zip_folder(PACKAGE_DIR / "reproducao", PACKAGE_DIR / "pacotes_zip" / "reproducao_border_value_2026.zip")
    zip_folder(PACKAGE_DIR, ROOT / "outputs" / "publicacao_border_value_2026_completo.zip")

    print(f"Pacote criado em: {PACKAGE_DIR}")
    print(f"Arquivos copiados: {len(copied)}")
    print(f"Linhas no dicionario: {len(dictionary_rows)}")


if __name__ == "__main__":
    main()
