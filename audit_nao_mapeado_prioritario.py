from __future__ import annotations

import json
import re
from pathlib import Path
from html import unescape

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs" / "final_border_value_2026"
NCM_JSON = BASE_DIR / "dados" / "cache" / "ncm_vigente.json"


def normalize_ncm(series: pd.Series) -> pd.Series:
    values = series.astype("string").str.replace(r"\.0$", "", regex=True)
    return values.str.replace(".", "", regex=False).str.zfill(8)


def read_ncm_descriptions() -> pd.DataFrame:
    data = json.loads(NCM_JSON.read_text(encoding="utf-8"))
    descriptions: dict[str, str] = {}
    for item in data["Nomenclaturas"]:
        code = str(item.get("Codigo", "")).replace(".", "")
        text = clean_description(item.get("Descricao", ""))
        if code and text:
            descriptions[code] = text

    rows = []
    for code, text in descriptions.items():
        if len(code) != 8:
            continue
        hierarchy = []
        for prefix_len in [2, 4, 6, 8]:
            part = descriptions.get(code[:prefix_len])
            if part and part not in hierarchy:
                hierarchy.append(part)
        rows.append(
            {
                "ncm": code,
                "descricao_ncm": text,
                "descricao_ncm_hierarquica": " > ".join(hierarchy),
            }
        )
    return pd.DataFrame(rows).drop_duplicates("ncm")


def clean_description(value: str) -> str:
    text = unescape(str(value))
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def classify_chapter(ncm: str) -> tuple[str, str, str]:
    chapter = int(ncm[:2])
    heading = ncm[:4]
    if chapter in {1, 3, 4, 5}:
        return (
            "primario_animal_pesca",
            "fora_escopo_prodlist_industria_provavel",
            "validar_com_CONCLA_se_deve_ir_para_CNAE_agropecuaria_pesca_ou_permanecer_fora_do_industrial",
        )
    if chapter in {6, 7, 8, 9, 10, 12, 14}:
        return (
            "primario_agricola",
            "fora_escopo_prodlist_industria_provavel",
            "validar_com_CONCLA_se_deve_ir_para_CNAE_agropecuaria_ou_permanecer_fora_do_industrial",
        )
    if chapter in {11, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24}:
        return (
            "agroindustrial_alimentos_bebidas_tabaco",
            "lacuna_ponte_prodlist_a_validar",
            "verificar_se_existe_prodlist_industria_equivalente_ou_se_o_item_e_insumo_primario_sem_transformacao",
        )
    if chapter in {25, 26, 27}:
        return (
            "extrativo_mineral_energetico",
            "lacuna_ponte_prodlist_a_validar",
            "validar_com_CONCLA_IBGE_se_o_item_deve_mapear_para_industria_extrativa_ou_ficar_fora_da_prodlist",
        )
    if chapter in {28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40}:
        return (
            "insumos_industriais_quimicos_borracha",
            "lacuna_ponte_prodlist_a_validar",
            "procurar correspondencia Prodlist 2025 antes de manter em NAO_MAPEADO",
        )
    if chapter in {84, 85, 86, 87, 88, 89, 90}:
        return (
            "bens_capital_transporte_eletroeletronicos",
            "lacuna_ponte_prodlist_a_validar",
            "alta probabilidade de ponte industrial esperada; revisar de-para e vigencia NCM",
        )
    if chapter in {93}:
        return (
            "armas_municoes",
            "lacuna_ponte_prodlist_a_validar",
            "verificar ausencia por confidencialidade, escopo ou lacuna da correspondencia oficial",
        )
    if chapter in {97}:
        return (
            "objetos_arte_colecao",
            "fora_escopo_prodlist_industria_provavel",
            "manter separado de indicadores industriais salvo decisao metodologica explicita",
        )
    if heading in {"9701", "9702", "9703", "9704", "9705", "9706"}:
        return (
            "objetos_arte_colecao",
            "fora_escopo_prodlist_industria_provavel",
            "manter separado de indicadores industriais salvo decisao metodologica explicita",
        )
    return (
        "outros",
        "lacuna_ponte_prodlist_a_validar",
        "validar manualmente contra correspondencia oficial CONCLA/IBGE",
    )


def build_triage() -> pd.DataFrame:
    unmatched = pd.read_csv(OUTPUT_DIR / "ncm_sem_ponte_priorizacao.csv", dtype={"ncm": "string"})
    unmatched["ncm"] = normalize_ncm(unmatched["ncm"])
    triage = unmatched.copy()
    if "descricao_ncm" not in triage.columns or "descricao_ncm_hierarquica" not in triage.columns:
        descriptions = read_ncm_descriptions()
        triage = triage.merge(descriptions, on="ncm", how="left")
    triage["capitulo_ncm"] = triage["ncm"].str[:2]
    triage["posicao_ncm"] = triage["ncm"].str[:4]
    classified = triage["ncm"].map(classify_chapter)
    triage["familia_produto"] = classified.map(lambda item: item[0])
    triage["diagnostico_preliminar"] = classified.map(lambda item: item[1])
    triage["acao_recomendada"] = classified.map(lambda item: item[2])
    triage["bucket_share_2026h1"] = triage["trade_value_usd"] / triage["trade_value_usd"].sum()
    triage = triage.sort_values("trade_value_usd", ascending=False, kind="stable").reset_index(drop=True)
    triage["bucket_share_acumulado_2026h1"] = triage["bucket_share_2026h1"].cumsum()
    triage["triage_rank"] = triage.index + 1

    validation = pd.read_csv(OUTPUT_DIR / "ncm_validacao_manual_concla.csv", dtype={"ncm": "string"})
    validation["ncm"] = normalize_ncm(validation["ncm"])
    validation = validation[
        [
            "ncm",
            "classification_reasons",
            "cnae_set_2024",
            "cnae_set_2026",
            "prodlist_set_2024",
            "prodlist_set_2026",
        ]
    ]
    triage = triage.merge(validation, on="ncm", how="left")
    triage["classification_reasons"] = triage["classification_reasons"].fillna("sem_ponte_2026")
    triage["cnae_set_2024"] = triage["cnae_set_2024"].fillna("NAO_MAPEADO")
    triage["cnae_set_2026"] = triage["cnae_set_2026"].fillna("NAO_MAPEADO")
    triage["prodlist_set_2024"] = triage["prodlist_set_2024"].fillna("NCM_SEM_PONTE")
    triage["prodlist_set_2026"] = triage["prodlist_set_2026"].fillna("NCM_SEM_PONTE")

    columns = [
        "triage_rank",
        "rank",
        "ncm",
        "descricao_ncm",
        "descricao_ncm_hierarquica",
        "capitulo_ncm",
        "posicao_ncm",
        "familia_produto",
        "diagnostico_preliminar",
        "acao_recomendada",
        "export_allocated_value_usd",
        "import_allocated_value_usd",
        "trade_value_usd",
        "trade_balance_usd",
        "bucket_share_2026h1",
        "bucket_share_acumulado_2026h1",
        "is_generic_code",
        "classification_reasons",
        "cnae_set_2024",
        "cnae_set_2026",
        "prodlist_set_2024",
        "prodlist_set_2026",
    ]
    return triage[columns]


def write_report(triage: pd.DataFrame) -> None:
    total = triage["trade_value_usd"].sum()
    top5 = triage.head(5)
    top10_share = triage.head(10)["trade_value_usd"].sum() / total
    diagnosis = (
        triage.groupby("diagnostico_preliminar", as_index=False)
        .agg(ncms=("ncm", "nunique"), valor_2026h1=("trade_value_usd", "sum"))
        .sort_values("valor_2026h1", ascending=False)
    )
    family = (
        triage.groupby("familia_produto", as_index=False)
        .agg(ncms=("ncm", "nunique"), valor_2026h1=("trade_value_usd", "sum"))
        .sort_values("valor_2026h1", ascending=False)
    )

    def money(value: float) -> str:
        return f"US$ {value / 1_000_000_000:,.2f} bi"

    lines = [
        "# Triagem prioritaria do NAO_MAPEADO",
        "",
        f"Bucket auditado: {money(total)} em 2026 H1.",
        f"Os 10 maiores NCMs concentram {top10_share:.1%} do valor sem ponte.",
        "",
        "## Diagnostico",
        "",
        "| Diagnostico preliminar | NCMs | Valor 2026 H1 | Participacao |",
        "| --- | ---: | ---: | ---: |",
    ]
    for _, row in diagnosis.iterrows():
        lines.append(
            f"| {row['diagnostico_preliminar']} | {int(row['ncms'])} | "
            f"{money(row['valor_2026h1'])} | {row['valor_2026h1'] / total:.1%} |"
        )

    lines.extend(["", "## Familias de produto", "", "| Familia | NCMs | Valor 2026 H1 | Participacao |", "| --- | ---: | ---: | ---: |"])
    for _, row in family.iterrows():
        lines.append(
            f"| {row['familia_produto']} | {int(row['ncms'])} | "
            f"{money(row['valor_2026h1'])} | {row['valor_2026h1'] / total:.1%} |"
        )

    lines.extend(
        [
            "",
            "## Primeiros casos para CONCLA/especialistas",
            "",
            "| Rank | NCM | Descricao | Valor 2026 H1 | Share acum. | Diagnostico | Acao |",
            "| ---: | --- | --- | ---: | ---: | --- | --- |",
        ]
    )
    for _, row in top5.iterrows():
        lines.append(
            f"| {int(row['triage_rank'])} | {row['ncm']} | {row['descricao_ncm_hierarquica']} | "
            f"{money(row['trade_value_usd'])} | {row['bucket_share_acumulado_2026h1']:.1%} | "
            f"{row['diagnostico_preliminar']} | {row['acao_recomendada']} |"
        )

    lines.extend(
        [
            "",
            "## Recomendacao metodologica",
            "",
            "- Nao preencher `prodlist_code_sugerido` por inferencia. A ponte deve vir de fonte CONCLA/IBGE ou validacao documentada.",
            "- Separar explicitamente comercio primario fora da Prodlist-Indústria de lacunas reais de ponte industrial.",
            "- Para indicadores industriais, reportar `NAO_MAPEADO` em sub-buckets: primario fora de escopo, lacuna Prodlist a validar e outros.",
            "- Revisar primeiro soja, cafe, milho, trigo e bovinos: eles explicam a maior parte do valor sem ponte.",
        ]
    )
    (OUTPUT_DIR / "relatorio_triagem_nao_mapeado.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    triage = build_triage()
    triage.to_csv(OUTPUT_DIR / "nao_mapeado_triagem_prioritaria.csv", index=False, encoding="utf-8-sig")
    write_report(triage)


if __name__ == "__main__":
    main()
