from __future__ import annotations

import json
import re
from html import unescape
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
SOURCE_DIR = BASE_DIR / "outputs" / "official_2026"
OUTPUT_DIR = BASE_DIR / "outputs" / "final_border_value_2026"
NCM_JSON = BASE_DIR / "dados" / "cache" / "ncm_vigente.json"


def _read_csv(name: str, **kwargs) -> pd.DataFrame:
    return pd.read_csv(SOURCE_DIR / name, **kwargs)


def _safe_divide(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    result = numerator / denominator.where(denominator.gt(0))
    return result.replace([float("inf"), float("-inf")], pd.NA)


def _clean_text(series: pd.Series) -> pd.Series:
    replacements = {
        "exposi??o": "exposição",
        "transi??o": "transição",
        "energ?tica": "energética",
        "depend?ncia": "dependência",
        "orienta??o": "orientação",
        "produ??o": "produção",
        "importa??o": "importação",
        "exporta??o": "exportação",
    }
    result = series.astype("string")
    for bad, good in replacements.items():
        result = result.str.replace(bad, good, regex=False)
    return result


def _clean_description(value: str) -> str:
    text = unescape(str(value))
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _read_ncm_descriptions() -> pd.DataFrame:
    if not NCM_JSON.exists():
        return pd.DataFrame(columns=["ncm", "descricao_ncm", "descricao_ncm_hierarquica"])
    data = json.loads(NCM_JSON.read_text(encoding="utf-8"))
    descriptions = {}
    for item in data.get("Nomenclaturas", []):
        code = str(item.get("Codigo", "")).replace(".", "")
        text = _clean_description(item.get("Descricao", ""))
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


def _classify_unmapped_ncm(ncm: str) -> tuple[str, str, str, str]:
    chapter = int(str(ncm)[:2])
    heading = str(ncm)[:4]
    if chapter in {1, 3, 4, 5}:
        return (
            "primario_animal_pesca",
            "primario_fora_escopo_prodlist",
            "fora_escopo_prodlist_industria_provavel",
            "validar se deve ir para CNAE agropecuaria/pesca ou permanecer fora do industrial",
        )
    if chapter in {6, 7, 8, 9, 10, 12, 14}:
        return (
            "primario_agricola",
            "primario_fora_escopo_prodlist",
            "fora_escopo_prodlist_industria_provavel",
            "validar se deve ir para CNAE agropecuaria ou permanecer fora do industrial",
        )
    if chapter in {11, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24}:
        return (
            "agroindustrial_alimentos_bebidas_tabaco",
            "lacuna_prodlist_a_validar",
            "lacuna_ponte_prodlist_a_validar",
            "verificar Prodlist equivalente ou se o item e insumo primario sem transformacao",
        )
    if chapter in {25, 26, 27}:
        return (
            "extrativo_mineral_energetico",
            "lacuna_prodlist_a_validar",
            "lacuna_ponte_prodlist_a_validar",
            "validar se deve mapear para industria extrativa ou ficar fora da Prodlist",
        )
    if chapter in {28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40}:
        return (
            "insumos_industriais_quimicos_borracha",
            "lacuna_prodlist_a_validar",
            "lacuna_ponte_prodlist_a_validar",
            "procurar correspondencia Prodlist 2025 antes de manter em NAO_MAPEADO",
        )
    if chapter in {84, 85, 86, 87, 88, 89, 90}:
        return (
            "bens_capital_transporte_eletroeletronicos",
            "lacuna_prodlist_a_validar",
            "lacuna_ponte_prodlist_a_validar",
            "alta probabilidade de ponte industrial esperada; revisar de-para e vigencia NCM",
        )
    if chapter == 93:
        return (
            "armas_municoes",
            "lacuna_prodlist_a_validar",
            "lacuna_ponte_prodlist_a_validar",
            "verificar ausencia por confidencialidade, escopo ou lacuna da correspondencia oficial",
        )
    if chapter == 97 or heading in {"9701", "9702", "9703", "9704", "9705", "9706"}:
        return (
            "objetos_arte_colecao",
            "fora_escopo_prodlist_outros",
            "fora_escopo_prodlist_industria_provavel",
            "manter separado de indicadores industriais salvo decisao metodologica explicita",
        )
    return (
        "outros",
        "lacuna_prodlist_a_validar",
        "lacuna_ponte_prodlist_a_validar",
        "validar manualmente contra correspondencia oficial CONCLA/IBGE",
    )


def _percent_rank(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce").fillna(0)
    if numeric.nunique(dropna=True) <= 1:
        return pd.Series(0.0, index=series.index)
    return numeric.rank(pct=True, method="average")


def _production_conversion_factor() -> float:
    config = json.loads((BASE_DIR / "config.official.2026.json").read_text(encoding="utf-8"))
    return float(config["settings"]["production_value_to_trade_value_factor"])


def build_prodlist_production() -> pd.DataFrame:
    raw = pd.DataFrame(
        json.loads((BASE_DIR / "inputs" / "official" / "pia_2024_value_production.json").read_text(encoding="utf-8"))[
            1:
        ]
    )
    result = pd.DataFrame()
    result["year"] = pd.to_numeric(raw["D3N"], errors="coerce").astype("Int64")
    result["prodlist_code"] = raw["D4N"].astype("string").str.extract(r"^(\d{4}\.\d{4})", expand=False)
    result["cnae_class"] = result["prodlist_code"].astype("string").str.slice(0, 4)
    result["prodlist_name"] = (
        raw["D4N"].astype("string").str.replace(r"^\d{4}\.\d{4}\s*", "", regex=True).str.strip()
    )
    raw_value = raw["V"].astype("string").str.strip()
    result["production_status"] = "published"
    result.loc[raw_value.eq("X"), "production_status"] = "confidential"
    result.loc[raw_value.isin(["-", "..", "..."]), "production_status"] = "not_available"
    result["production_value_brl_thousand"] = pd.to_numeric(raw_value, errors="coerce")
    result = result.loc[result["prodlist_code"].notna()].copy()
    return result.sort_values(["cnae_class", "prodlist_code"], kind="stable").reset_index(drop=True)


def build_allocated_product_trade() -> pd.DataFrame:
    trade = _read_csv("fact_trade.csv", dtype={"ncm": "string"})
    bridge = _read_csv(
        "bridge_ncm_prodlist_cnae.csv",
        dtype={"ncm": "string", "prodlist_code": "string", "cnae_class": "string"},
    )
    allocated = trade.merge(
        bridge[
            [
                "ncm_key",
                "ncm",
                "prodlist_key",
                "prodlist_code",
                "cnae_key",
                "cnae_class",
                "allocation_rule",
                "allocation_basis_status",
                "allocation_weight",
            ]
        ],
        on=["ncm_key", "ncm"],
        how="left",
        validate="many_to_many",
    )
    unmatched = allocated["prodlist_code"].isna()
    allocated.loc[unmatched, "prodlist_key"] = pd.NA
    allocated.loc[unmatched, "prodlist_code"] = "NCM_SEM_PONTE"
    allocated.loc[unmatched, "cnae_key"] = pd.NA
    allocated.loc[unmatched, "cnae_class"] = "NAO_MAPEADO"
    allocated.loc[unmatched, "allocation_rule"] = "unmatched_ncm"
    allocated.loc[unmatched, "allocation_basis_status"] = "not_mapped"
    allocated.loc[unmatched, "allocation_weight"] = 1.0
    allocated["allocated_value_usd"] = allocated["value_usd"] * allocated["allocation_weight"]
    allocated["allocated_net_weight_kg"] = allocated["net_weight_kg"] * allocated["allocation_weight"]
    return allocated[
        [
            "year",
            "month",
            "flow",
            "ncm",
            "prodlist_code",
            "cnae_class",
            "allocated_value_usd",
            "allocated_net_weight_kg",
            "allocation_rule",
            "allocation_basis_status",
            "allocation_weight",
        ]
    ].sort_values(["year", "month", "flow", "cnae_class", "prodlist_code", "ncm"], kind="stable")


def enrich_cnae_indicators() -> pd.DataFrame:
    indicators = _read_csv("border_value_indicators_cnae.csv", dtype={"cnae_class": "string"})
    priority = _read_csv("priorizacao_especialistas_cnae.csv", dtype={"cnae_class": "string"})
    priority = priority[
        [
            "cnae_class",
            "cnae_name",
            "transition_relevance",
            "rationale",
        ]
    ].drop_duplicates("cnae_class")
    result = indicators.merge(priority, on="cnae_class", how="left")
    result["cnae_name"] = result["cnae_name"].fillna("")
    result["rationale"] = _clean_text(result["rationale"]).fillna("")
    result["transition_relevance"] = result["transition_relevance"].fillna(False).astype(bool)
    result["trade_value_usd"] = result["import_value_usd"] + result["export_value_usd"]
    result["import_share_trade"] = _safe_divide(result["import_value_usd"], result["trade_value_usd"])
    result["export_share_trade"] = _safe_divide(result["export_value_usd"], result["trade_value_usd"])
    result["import_penetration_ratio"] = result["external_dependency_ratio"]
    result["export_orientation_ratio"] = _safe_divide(
        result["export_value_usd"], result["domestic_production_value_usd_comparable"]
    )
    result["economic_relevance_score"] = _percent_rank(result["trade_value_usd"])
    result["external_vulnerability_score"] = pd.concat(
        [
            _percent_rank(result["import_value_usd"]),
            _percent_rank(result["import_penetration_ratio"].fillna(0)),
        ],
        axis=1,
    ).max(axis=1)
    result["transition_score"] = result["transition_relevance"].map({True: 1.0, False: 0.0})
    result["priority_score"] = (
        0.4 * result["economic_relevance_score"]
        + 0.4 * result["external_vulnerability_score"]
        + 0.2 * result["transition_score"]
    )
    result["priority_tier"] = pd.cut(
        result["priority_score"],
        bins=[-0.001, 0.50, 0.70, 1.001],
        labels=["3 - monitorar", "2 - aprofundar", "1 - priorizar"],
    ).astype("string")
    return result.sort_values(["priority_score", "trade_value_usd"], ascending=[False, False], kind="stable")


def build_product_indicators(
    allocated: pd.DataFrame,
    cnae: pd.DataFrame,
    prodlist_production: pd.DataFrame,
) -> pd.DataFrame:
    grouped = (
        allocated.groupby(["cnae_class", "prodlist_code", "flow"], as_index=False, dropna=False)[
            ["allocated_value_usd", "allocated_net_weight_kg"]
        ]
        .sum(min_count=1)
        .pivot(
            index=["cnae_class", "prodlist_code"],
            columns="flow",
            values=["allocated_value_usd", "allocated_net_weight_kg"],
        )
    )
    grouped.columns = [
        f"{'export' if flow == 'EXP' else 'import' if flow == 'IMP' else str(flow).lower()}_{measure}"
        for measure, flow in grouped.columns
    ]
    result = grouped.reset_index()
    for column in (
        "export_allocated_value_usd",
        "import_allocated_value_usd",
        "export_allocated_net_weight_kg",
        "import_allocated_net_weight_kg",
    ):
        if column not in result.columns:
            result[column] = 0.0
        result[column] = result[column].fillna(0.0)
    result["trade_value_usd"] = result["import_allocated_value_usd"] + result["export_allocated_value_usd"]
    result["trade_balance_usd"] = result["export_allocated_value_usd"] - result["import_allocated_value_usd"]
    result["import_share_trade"] = _safe_divide(result["import_allocated_value_usd"], result["trade_value_usd"])
    result["export_share_trade"] = _safe_divide(result["export_allocated_value_usd"], result["trade_value_usd"])
    product_production = prodlist_production[
        [
            "prodlist_code",
            "prodlist_name",
            "production_value_brl_thousand",
            "production_status",
        ]
    ].drop_duplicates("prodlist_code")
    result = result.merge(product_production, on="prodlist_code", how="left", validate="many_to_one")
    result["production_status"] = result["production_status"].astype("string").fillna("missing")
    factor = _production_conversion_factor()
    result["domestic_production_value_usd_comparable"] = result["production_value_brl_thousand"] * factor
    confidential_or_missing = result["production_status"].isin(["confidential", "not_available", "missing"])
    result.loc[confidential_or_missing, "domestic_production_value_usd_comparable"] = pd.NA
    result["apparent_consumption_value_usd"] = (
        result["domestic_production_value_usd_comparable"]
        + result["import_allocated_value_usd"]
        - result["export_allocated_value_usd"]
    )
    result.loc[confidential_or_missing, "apparent_consumption_value_usd"] = pd.NA
    positive_consumption = result["apparent_consumption_value_usd"].gt(0)
    result["product_external_dependency_ratio"] = pd.NA
    result.loc[positive_consumption, "product_external_dependency_ratio"] = (
        result.loc[positive_consumption, "import_allocated_value_usd"]
        / result.loc[positive_consumption, "apparent_consumption_value_usd"]
    )
    result["product_import_penetration_ratio"] = result["product_external_dependency_ratio"]
    result["product_export_orientation_ratio"] = _safe_divide(
        result["export_allocated_value_usd"], result["domestic_production_value_usd_comparable"]
    )
    result["product_dependency_status"] = positive_consumption.map(
        {True: "calculated", False: "non_positive_apparent_consumption"}
    )
    result.loc[result["production_status"].eq("confidential"), "product_dependency_status"] = (
        "not_calculated_confidential_pia"
    )
    result.loc[result["production_status"].isin(["not_available", "missing"]), "product_dependency_status"] = (
        "not_calculated_missing_pia"
    )
    result.loc[result["cnae_class"].eq("NAO_MAPEADO"), "product_dependency_status"] = (
        "not_calculated_unmapped_ncm"
    )
    cnae_lookup = cnae[
        [
            "cnae_class",
            "cnae_name",
            "priority_score",
            "priority_tier",
            "transition_relevance",
            "external_dependency_ratio",
            "import_penetration_ratio",
            "export_orientation_ratio",
        ]
    ]
    result = result.merge(cnae_lookup, on="cnae_class", how="left")
    return result.sort_values(["trade_value_usd", "cnae_class"], ascending=[False, True], kind="stable")


def build_unmatched_ncm_audit(allocated: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    dim_ncm = _read_csv("dim_ncm.csv", dtype={"ncm": "string"})
    dim_ncm["ncm"] = dim_ncm["ncm"].astype("string").str.replace(r"\.0$", "", regex=True).str.zfill(8)
    unmatched = allocated.loc[allocated["cnae_class"].eq("NAO_MAPEADO")].copy()
    grouped = (
        unmatched.groupby(["ncm", "flow"], as_index=False)[["allocated_value_usd", "allocated_net_weight_kg"]]
        .sum(min_count=1)
        .pivot(index="ncm", columns="flow", values=["allocated_value_usd", "allocated_net_weight_kg"])
    )
    grouped.columns = [
        f"{'export' if flow == 'EXP' else 'import' if flow == 'IMP' else str(flow).lower()}_{measure}"
        for measure, flow in grouped.columns
    ]
    result = grouped.reset_index()
    for column in (
        "export_allocated_value_usd",
        "import_allocated_value_usd",
        "export_allocated_net_weight_kg",
        "import_allocated_net_weight_kg",
    ):
        if column not in result.columns:
            result[column] = 0.0
        result[column] = result[column].fillna(0.0)
    result["trade_value_usd"] = result["import_allocated_value_usd"] + result["export_allocated_value_usd"]
    result["trade_balance_usd"] = result["export_allocated_value_usd"] - result["import_allocated_value_usd"]
    result["ncm"] = result["ncm"].astype("string").str.replace(r"\.0$", "", regex=True).str.zfill(8)
    result = result.merge(dim_ncm[["ncm", "is_generic_code"]], on="ncm", how="left", validate="one_to_one")
    descriptions = _read_ncm_descriptions()
    result = result.merge(descriptions, on="ncm", how="left")
    result["capitulo_ncm"] = result["ncm"].astype("string").str.slice(0, 2)
    result["posicao_ncm"] = result["ncm"].astype("string").str.slice(0, 4)
    classified = result["ncm"].map(_classify_unmapped_ncm)
    result["familia_produto"] = classified.map(lambda item: item[0])
    result["nao_mapeado_subbucket"] = classified.map(lambda item: item[1])
    result["diagnostico_preliminar"] = classified.map(lambda item: item[2])
    result["acao_recomendada"] = classified.map(lambda item: item[3])
    result = result.sort_values("trade_value_usd", ascending=False, kind="stable").reset_index(drop=True)
    result["bucket_share_2026h1"] = _safe_divide(result["trade_value_usd"], pd.Series(result["trade_value_usd"].sum(), index=result.index))
    result["bucket_share_acumulado_2026h1"] = result["bucket_share_2026h1"].cumsum()
    result.insert(0, "rank", range(1, len(result) + 1))
    subbuckets = (
        result.groupby(["nao_mapeado_subbucket", "diagnostico_preliminar", "familia_produto"], as_index=False)
        .agg(
            ncm_count=("ncm", "nunique"),
            generic_ncm_count=("is_generic_code", "sum"),
            export_value_usd=("export_allocated_value_usd", "sum"),
            import_value_usd=("import_allocated_value_usd", "sum"),
            trade_value_usd=("trade_value_usd", "sum"),
            trade_balance_usd=("trade_balance_usd", "sum"),
        )
        .sort_values("trade_value_usd", ascending=False, kind="stable")
    )
    subbuckets["bucket_share_2026h1"] = _safe_divide(
        subbuckets["trade_value_usd"],
        pd.Series(subbuckets["trade_value_usd"].sum(), index=subbuckets.index),
    )
    template = result.head(200).copy()
    for column in (
        "prodlist_code_sugerido",
        "cnae_class_sugerida",
        "justificativa",
        "fonte",
        "responsavel",
        "data_revisao",
    ):
        template[column] = ""
    return result, template, subbuckets


def build_period_flow_indicators(allocated: pd.DataFrame) -> pd.DataFrame:
    result = (
        allocated.groupby(["year", "month", "flow", "cnae_class", "prodlist_code"], as_index=False, dropna=False)[
            ["allocated_value_usd", "allocated_net_weight_kg"]
        ]
        .sum(min_count=1)
        .sort_values(["year", "month", "flow", "allocated_value_usd"], ascending=[True, True, True, False])
    )
    totals = result.groupby(["year", "month", "flow"], as_index=False)["allocated_value_usd"].sum()
    totals = totals.rename(columns={"allocated_value_usd": "period_flow_total_value_usd"})
    result = result.merge(totals, on=["year", "month", "flow"], how="left", validate="many_to_one")
    result["period_flow_share"] = _safe_divide(result["allocated_value_usd"], result["period_flow_total_value_usd"])
    return result


def build_rankings(cnae: pd.DataFrame, products: pd.DataFrame, period_flow: pd.DataFrame) -> dict[str, pd.DataFrame]:
    ranking_specs = {
        "maior_valor_comercial": ("trade_value_usd", False),
        "maiores_importacoes": ("import_value_usd", False),
        "maiores_exportacoes": ("export_value_usd", False),
        "maior_deficit": ("trade_balance_usd", True),
        "maior_superavit": ("trade_balance_usd", False),
        "maior_dependencia_externa": ("external_dependency_ratio", False),
        "maior_orientacao_exportadora": ("export_orientation_ratio", False),
        "setores_prioritarios": ("priority_score", False),
    }
    cnae_rankings = []
    for name, (column, ascending) in ranking_specs.items():
        frame = cnae.loc[cnae[column].notna()].sort_values(column, ascending=ascending, kind="stable").head(25)
        frame = frame.copy()
        frame.insert(0, "rank", range(1, len(frame) + 1))
        frame.insert(0, "ranking", name)
        cnae_rankings.append(frame)
    product_rankings = []
    product_specs = {
        "produtos_maior_valor": ("trade_value_usd", False),
        "produtos_maiores_importacoes": ("import_allocated_value_usd", False),
        "produtos_maiores_exportacoes": ("export_allocated_value_usd", False),
        "produtos_maior_deficit": ("trade_balance_usd", True),
        "produtos_maior_superavit": ("trade_balance_usd", False),
        "produtos_maior_dependencia_externa": ("product_external_dependency_ratio", False),
        "produtos_maior_orientacao_exportadora": ("product_export_orientation_ratio", False),
    }
    for name, (column, ascending) in product_specs.items():
        frame = products.sort_values(column, ascending=ascending, kind="stable").head(25).copy()
        frame.insert(0, "rank", range(1, len(frame) + 1))
        frame.insert(0, "ranking", name)
        product_rankings.append(frame)

    cnae_period = (
        period_flow.groupby(["year", "month", "cnae_class"], as_index=False)["allocated_value_usd"]
        .sum(min_count=1)
        .sort_values(["cnae_class", "year", "month"], kind="stable")
    )
    cnae_period["previous_month_value_usd"] = cnae_period.groupby("cnae_class")["allocated_value_usd"].shift(1)
    cnae_period["monthly_change_value_usd"] = (
        cnae_period["allocated_value_usd"] - cnae_period["previous_month_value_usd"]
    )
    cnae_period["monthly_change_pct"] = _safe_divide(
        cnae_period["monthly_change_value_usd"], cnae_period["previous_month_value_usd"]
    )
    latest_month = cnae_period[["year", "month"]].drop_duplicates().sort_values(["year", "month"]).tail(1)
    latest = cnae_period.merge(latest_month, on=["year", "month"], how="inner")
    latest_changes = latest.sort_values("monthly_change_value_usd", ascending=False, kind="stable").head(25)

    concentration = (
        products.groupby("cnae_class", as_index=False)
        .agg(
            top_product_value_usd=("trade_value_usd", "max"),
            product_count=("prodlist_code", "nunique"),
            sector_product_trade_value_usd=("trade_value_usd", "sum"),
        )
    )
    concentration["top_product_concentration_ratio"] = _safe_divide(
        concentration["top_product_value_usd"],
        concentration["sector_product_trade_value_usd"],
    )
    concentration = concentration.merge(
        cnae[["cnae_class", "cnae_name", "priority_score", "priority_tier"]],
        on="cnae_class",
        how="left",
    ).sort_values("top_product_concentration_ratio", ascending=False, kind="stable")

    return {
        "rankings_cnae": pd.concat(cnae_rankings, ignore_index=True),
        "rankings_prodlist": pd.concat(product_rankings, ignore_index=True),
        "mudancas_mensais_cnae": latest_changes,
        "concentracao_produtos_cnae": concentration,
    }


def write_summary(
    cnae: pd.DataFrame,
    products: pd.DataFrame,
    unmatched_ncm: pd.DataFrame,
    unmatched_subbuckets: pd.DataFrame,
    rankings: dict[str, pd.DataFrame],
) -> None:
    quality = _read_csv("quality_summary.csv")
    quality_map = dict(zip(quality["metric"], quality["value"]))
    top_priority = rankings["rankings_cnae"].query("ranking == 'setores_prioritarios'").head(10)
    lines = [
        "# Indicadores finais Border Value 2026",
        "",
        "Recorte de comércio: Comex Stat janeiro a junho de 2026. Produção doméstica: PIA-Produto 2024.",
        "",
        "## Indicadores calculados",
        "",
        "- Dependência externa e penetração das importações: importações / (produção doméstica comparável + importações - exportações).",
        "- Orientação exportadora: exportações / produção doméstica comparável.",
        "- Saldo comercial: exportações - importações.",
        "- Prioridade setorial: 40% relevância econômica, 40% vulnerabilidade externa e 20% relevância para transição energética.",
        "",
        "## Controles",
        "",
        f"- Valor de comércio reconciliado: US$ {quality_map.get('allocated_total_value_usd', 0):,.0f}.",
        f"- Diferença de alocação em valor: US$ {quality_map.get('allocation_difference_value_usd', 0):,.0f}.",
        f"- Cobertura de NCM por quantidade: {quality_map.get('ncm_coverage_rate', 0):.2%}.",
        "",
        "## Dez setores prioritários",
        "",
    ]
    for _, row in top_priority.iterrows():
        lines.append(
            f"- {row['cnae_class']} {row.get('cnae_name', '')}: score {row['priority_score']:.3f}, "
            f"comércio US$ {row['trade_value_usd']:,.0f}, dependência {row.get('external_dependency_ratio', pd.NA):.2%}."
        )
    lines.extend(
        [
            "",
            "## Produto",
            "",
            "Os recortes por Prodlist usam o comércio alocado pela ponte NCM-Prodlist-CNAE. "
            "Quando a produção PIA-Produto por Prodlist está publicada, a tabela de produto calcula "
            "consumo aparente, dependência externa, penetração das importações e orientação exportadora.",
            f"- Produtos com dependência externa calculada: {(products['product_dependency_status'] == 'calculated').sum():,}.",
            f"- Produtos sem cálculo por sigilo, ausência, NCM sem ponte ou consumo não positivo: {(products['product_dependency_status'] != 'calculated').sum():,}.",
            "",
            "## Limitações, sigilo e defasagens",
            "",
            "- A PIA-Produto preserva sigilo estatístico: valores marcados como `X` não são imputados, redistribuídos nem reidentificados.",
            "- Marcadores `-`, `..`, `...` ou ausência de linha na PIA são tratados como produção indisponível ou ausente, separados do sigilo estatístico.",
            "- Indicadores de consumo aparente, dependência externa, penetração das importações e orientação exportadora só são calculados quando há produção doméstica comparável e denominador válido.",
            "- O recorte combina comércio Comex Stat de janeiro a junho de 2026 com produção PIA-Produto 2024; essa defasagem temporal deve acompanhar a interpretação dos resultados.",
            "- Mudanças de versão NCM/Prodlist/CONCLA podem gerar NCM sem ponte ou alterar vínculos setoriais; códigos novos, extintos e genéricos exigem auditoria antes de uso decisório.",
            "- A ponte NCM-Prodlist-CNAE pode ser 1:N. Nesses casos, a distribuição por CNAE é uma alocação analítica baseada na regra documentada, ainda que os totais permaneçam reconciliados.",
            "",
            "## NCM sem ponte",
            "",
            f"- NCM sem ponte priorizadas para auditoria: {len(unmatched_ncm):,}.",
            f"- Valor total sem ponte: US$ {unmatched_ncm['trade_value_usd'].sum():,.0f}.",
            "- Use `ncm_prodlist_overrides_template.csv` para registrar correspondências manuais defensáveis.",
            "",
        ]
    )
    lines.extend(
        [
            "- O bucket NAO_MAPEADO foi separado em sub-buckets para distinguir comercio primario fora do escopo da Prodlist-Indústria de lacunas reais de ponte.",
        ]
    )
    for _, row in unmatched_subbuckets.groupby("nao_mapeado_subbucket", as_index=False)["trade_value_usd"].sum().iterrows():
        lines.append(f"- {row['nao_mapeado_subbucket']}: US$ {row['trade_value_usd']:,.0f}.")
    (OUTPUT_DIR / "resumo_metodologico.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    allocated = build_allocated_product_trade()
    prodlist_production = build_prodlist_production()
    cnae = enrich_cnae_indicators()
    products = build_product_indicators(allocated, cnae, prodlist_production)
    period_flow = build_period_flow_indicators(allocated)
    unmatched_ncm, override_template, unmatched_subbuckets = build_unmatched_ncm_audit(allocated)
    rankings = build_rankings(cnae, products, period_flow)

    outputs = {
        "fact_production_prodlist.csv": prodlist_production,
        "comercio_alocado_cnae_prodlist_fluxo_periodo.csv": period_flow,
        "border_value_indicadores_finais_cnae.csv": cnae,
        "border_value_indicadores_finais_cnae_prodlist.csv": products,
        "ncm_sem_ponte_priorizacao.csv": unmatched_ncm,
        "nao_mapeado_subbuckets.csv": unmatched_subbuckets,
        "ncm_prodlist_overrides_template.csv": override_template,
        **{f"{name}.csv": frame for name, frame in rankings.items()},
    }
    for file_name, frame in outputs.items():
        frame.to_csv(OUTPUT_DIR / file_name, index=False, encoding="utf-8-sig")
    write_summary(cnae, products, unmatched_ncm, unmatched_subbuckets, rankings)
    manifest = {
        "source_dir": str(SOURCE_DIR.relative_to(BASE_DIR)),
        "output_dir": str(OUTPUT_DIR.relative_to(BASE_DIR)),
        "files": {name: len(frame) for name, frame in outputs.items()},
    }
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
