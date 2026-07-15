"""Analise de sensibilidade da regra de rateio NCM -> CNAE.

Compara o cenario oficial, que usa peso por valor da producao PIA quando
disponivel, com um contrafactual igualitario por CNAE distinta em todas as NCMs
mapeadas. As saidas oficiais nao sao alteradas.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd


BASE_DIR = Path("outputs/official_2026")
OUT_DIR = Path("outputs/sensibilidade_rateio_2026")


def _read_csv(name: str, **kwargs: object) -> pd.DataFrame:
    return pd.read_csv(BASE_DIR / name, **kwargs)


def _safe_divide(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    result = numerator / denominator
    return result.where(denominator.ne(0))


def _classify_unmapped_ncm(ncm: object) -> tuple[str, str]:
    code = str(ncm).replace(".0", "").zfill(8)
    if not code[:2].isdigit():
        return "outros", "lacuna_prodlist_a_validar"

    chapter = int(code[:2])
    heading = code[:4]
    if chapter in {1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14}:
        return "primario_fora_escopo_prodlist", "fora_escopo_prodlist_industria_provavel"
    if chapter in {11, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24}:
        return "agroindustrial_alimentos_bebidas_tabaco", "lacuna_ponte_prodlist_a_validar"
    if chapter in {25, 26, 27}:
        return "extrativo_mineral_energetico", "lacuna_ponte_prodlist_a_validar"
    if chapter in {28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40}:
        return "insumos_industriais_quimicos_borracha", "lacuna_ponte_prodlist_a_validar"
    if chapter in {84, 85, 86, 87, 88, 89, 90}:
        return "bens_capital_transporte_eletroeletronicos", "lacuna_ponte_prodlist_a_validar"
    if chapter == 93:
        return "armas_municoes", "lacuna_ponte_prodlist_a_validar"
    if chapter == 97 or heading in {"9701", "9702", "9703", "9704", "9705", "9706"}:
        return "objetos_arte_colecao", "fora_escopo_prodlist_outros"
    return "outros", "lacuna_prodlist_a_validar"


def apply_unmapped_treatment(allocated: pd.DataFrame, treatment: str) -> pd.DataFrame:
    """Aplica tratamentos analiticos ao bucket NAO_MAPEADO sem mudar a base oficial."""

    result = allocated.copy()
    result["unmapped_treatment"] = treatment
    result["is_unmapped_ncm"] = result["cnae_class"].eq("NAO_MAPEADO")
    if treatment == "manter_nao_mapeado_separado":
        return result
    if treatment == "excluir_nao_mapeado":
        return result.loc[~result["is_unmapped_ncm"]].copy()
    if treatment == "subbucket_nao_mapeado":
        mask = result["is_unmapped_ncm"]
        classified = result.loc[mask, "ncm"].map(_classify_unmapped_ncm)
        result.loc[mask, "familia_nao_mapeado"] = classified.map(lambda item: item[0])
        result.loc[mask, "diagnostico_nao_mapeado"] = classified.map(lambda item: item[1])
        result.loc[mask, "cnae_class"] = (
            "NAO_MAPEADO__" + result.loc[mask, "familia_nao_mapeado"].astype("string")
        )
        return result
    raise ValueError(f"Tratamento desconhecido: {treatment}")


def build_equal_share_bridge(bridge: pd.DataFrame) -> pd.DataFrame:
    """Forca rateio igualitario por CNAE distinta, preservando linhas Prodlist."""

    result = bridge.copy()
    temporal_columns = ["year"] if "year" in result.columns else []
    allocation_keys = [*temporal_columns, "ncm_key"]
    cnae_keys = [*allocation_keys, "cnae_key"]

    cnae_share = result[cnae_keys + ["cnae_class"]].drop_duplicates().copy()
    cnae_share["allocation_weight_cnae"] = (
        1.0 / cnae_share.groupby(allocation_keys)["cnae_key"].transform("nunique")
    )
    result = result.merge(
        cnae_share[cnae_keys + ["allocation_weight_cnae"]],
        on=cnae_keys,
        how="left",
        validate="many_to_one",
    )
    prodlist_count = result.groupby(cnae_keys)["prodlist_key"].transform("count")
    result["allocation_weight"] = result["allocation_weight_cnae"] / prodlist_count
    result["allocation_rule"] = "equal_share_distinct_cnae_forced"
    return result.drop(columns="allocation_weight_cnae")


def allocate_trade(fact_trade: pd.DataFrame, bridge: pd.DataFrame) -> pd.DataFrame:
    bridge_keys = ["ncm_key", *(["year"] if "year" in bridge.columns else [])]
    mapped_keys = bridge[bridge_keys].drop_duplicates()
    mapped = fact_trade.merge(
        bridge[
            [
                *bridge_keys,
                "ncm",
                "prodlist_code",
                "cnae_key",
                "cnae_class",
                "allocation_rule",
                "allocation_basis_status",
                "allocation_weight",
            ]
        ],
        on=bridge_keys,
        how="inner",
        validate="many_to_many",
        suffixes=("", "_bridge"),
    )
    mapped["allocated_value_usd"] = mapped["value_usd"] * mapped["allocation_weight"]
    mapped["allocated_net_weight_kg"] = mapped["net_weight_kg"] * mapped["allocation_weight"]

    unmatched = fact_trade.merge(mapped_keys, on=bridge_keys, how="left", indicator=True)
    unmatched = unmatched.loc[unmatched["_merge"].eq("left_only")].drop(columns="_merge")
    if not unmatched.empty:
        unmatched["prodlist_code"] = "NCM_SEM_PONTE"
        unmatched["cnae_key"] = pd.NA
        unmatched["cnae_class"] = "NAO_MAPEADO"
        unmatched["allocation_rule"] = "unmatched_ncm"
        unmatched["allocation_basis_status"] = "not_mapped"
        unmatched["allocation_weight"] = 1.0
        unmatched["allocated_value_usd"] = unmatched["value_usd"]
        unmatched["allocated_net_weight_kg"] = unmatched["net_weight_kg"]
        mapped = pd.concat([mapped, unmatched], ignore_index=True, sort=False)

    return mapped


def summarize_cnae(
    allocated: pd.DataFrame,
    official_cnae: pd.DataFrame,
    scenario: str,
) -> pd.DataFrame:
    grouped = (
        allocated.groupby(["cnae_class", "flow"], as_index=False, dropna=False)[
            ["allocated_value_usd", "allocated_net_weight_kg"]
        ]
        .sum()
        .pivot(
            index="cnae_class",
            columns="flow",
            values=["allocated_value_usd", "allocated_net_weight_kg"],
        )
    )
    grouped.columns = [f"{flow.lower()}_{measure}" for measure, flow in grouped.columns]
    result = grouped.reset_index()
    rename = {
        "imp_allocated_value_usd": "import_value_usd",
        "exp_allocated_value_usd": "export_value_usd",
        "imp_allocated_net_weight_kg": "import_net_weight_kg",
        "exp_allocated_net_weight_kg": "export_net_weight_kg",
    }
    result = result.rename(columns=rename)
    renamed_columns = list(rename.values())
    for column in renamed_columns:
        if column not in result.columns:
            result[column] = 0.0
    result[renamed_columns] = result[renamed_columns].fillna(0.0)
    result["trade_value_usd"] = result["import_value_usd"] + result["export_value_usd"]
    result["trade_balance_usd"] = result["export_value_usd"] - result["import_value_usd"]

    production_columns = [
        "cnae_class",
        "domestic_production_value_brl_thousand",
        "domestic_production_status",
        "domestic_production_is_confidential",
        "domestic_production_value_usd_comparable",
        "external_dependency_status",
    ]
    result = result.merge(
        official_cnae[production_columns].drop_duplicates("cnae_class"),
        on="cnae_class",
        how="left",
    )
    result["apparent_consumption_value_usd"] = (
        result["domestic_production_value_usd_comparable"]
        + result["import_value_usd"]
        - result["export_value_usd"]
    )
    calculable = (
        result["external_dependency_status"].eq("calculated")
        & result["apparent_consumption_value_usd"].gt(0)
    )
    result["external_dependency_ratio"] = pd.NA
    result.loc[calculable, "external_dependency_ratio"] = _safe_divide(
        result.loc[calculable, "import_value_usd"],
        result.loc[calculable, "apparent_consumption_value_usd"],
    )
    result["scenario"] = scenario
    result["rank_trade_value"] = result["trade_value_usd"].rank(
        method="first", ascending=False
    )
    return result.sort_values(["trade_value_usd", "cnae_class"], ascending=[False, True])


def compare_scenarios(cnae_scenarios: pd.DataFrame) -> pd.DataFrame:
    metrics = [
        "import_value_usd",
        "export_value_usd",
        "trade_value_usd",
        "trade_balance_usd",
        "external_dependency_ratio",
        "rank_trade_value",
    ]
    official = (
        cnae_scenarios.loc[cnae_scenarios["scenario"].eq("oficial_pia_ponderado")]
        .set_index("cnae_class")[metrics]
        .add_suffix("_oficial")
    )
    equal = (
        cnae_scenarios.loc[cnae_scenarios["scenario"].eq("contrafactual_igualitario")]
        .set_index("cnae_class")[metrics]
        .add_suffix("_igualitario")
    )
    result = official.join(equal, how="outer").reset_index()
    for metric in metrics:
        result[f"{metric}_delta_abs"] = (
            result[f"{metric}_igualitario"] - result[f"{metric}_oficial"]
        )
    result["trade_value_delta_pct"] = _safe_divide(
        result["trade_value_usd_delta_abs"], result["trade_value_usd_oficial"]
    )
    result["import_delta_pct"] = _safe_divide(
        result["import_value_usd_delta_abs"], result["import_value_usd_oficial"]
    )
    result["export_delta_pct"] = _safe_divide(
        result["export_value_usd_delta_abs"], result["export_value_usd_oficial"]
    )
    return result.sort_values(
        "trade_value_usd_delta_abs", key=lambda values: values.abs(), ascending=False
    )


def compare_pairs(
    allocated_scenarios: pd.DataFrame,
    bridge: pd.DataFrame,
    equal_bridge: pd.DataFrame,
    ncm_summary: pd.DataFrame,
    cnae_comparison: pd.DataFrame,
    priority_meta: pd.DataFrame,
) -> pd.DataFrame:
    values = (
        allocated_scenarios.groupby(
            ["scenario", "ncm_key", "ncm", "cnae_class"], as_index=False, dropna=False
        )["allocated_value_usd"]
        .sum()
        .pivot(index=["ncm_key", "ncm", "cnae_class"], columns="scenario", values="allocated_value_usd")
        .reset_index()
    )
    for column in ("oficial_pia_ponderado", "contrafactual_igualitario"):
        if column not in values.columns:
            values[column] = 0.0
    values = values.rename(
        columns={
            "oficial_pia_ponderado": "allocated_value_usd_oficial",
            "contrafactual_igualitario": "allocated_value_usd_igualitario",
        }
    )
    values[["allocated_value_usd_oficial", "allocated_value_usd_igualitario"]] = values[
        ["allocated_value_usd_oficial", "allocated_value_usd_igualitario"]
    ].fillna(0.0)
    values["allocated_value_delta_abs"] = (
        values["allocated_value_usd_igualitario"] - values["allocated_value_usd_oficial"]
    )
    values["allocated_value_delta_pct"] = _safe_divide(
        values["allocated_value_delta_abs"], values["allocated_value_usd_oficial"]
    )

    weight_keys = ["ncm_key", "ncm", "cnae_class"]
    official_weights = (
        bridge.groupby(weight_keys, as_index=False)["allocation_weight"]
        .sum()
        .rename(columns={"allocation_weight": "allocation_weight_oficial"})
    )
    equal_weights = (
        equal_bridge.groupby(weight_keys, as_index=False)["allocation_weight"]
        .sum()
        .rename(columns={"allocation_weight": "allocation_weight_igualitario"})
    )
    values = values.merge(official_weights, on=weight_keys, how="left")
    values = values.merge(equal_weights, on=weight_keys, how="left")
    values[["allocation_weight_oficial", "allocation_weight_igualitario"]] = values[
        ["allocation_weight_oficial", "allocation_weight_igualitario"]
    ].fillna(0.0)
    values["allocation_weight_delta_abs"] = (
        values["allocation_weight_igualitario"] - values["allocation_weight_oficial"]
    )

    ncm_columns = [
        "ncm_key",
        "ncm",
        "cnae_count",
        "prodlist_count",
        "official_rules",
        "official_basis_status",
        "trade_value_usd",
        "trade_value_at_risk_usd",
        "max_abs_weight_delta",
    ]
    values = values.merge(ncm_summary[ncm_columns], on=["ncm_key", "ncm"], how="inner")

    cnae_columns = [
        column
        for column in (
            "cnae_class",
            "trade_value_usd_delta_abs",
            "trade_value_delta_pct",
            "rank_trade_value_delta_abs",
        )
        if column in cnae_comparison.columns
    ]
    values = values.merge(cnae_comparison[cnae_columns], on="cnae_class", how="left")
    if len(priority_meta.columns) > 1:
        values = values.merge(priority_meta, on="cnae_class", how="left")

    values["abs_pair_delta_usd"] = values["allocated_value_delta_abs"].abs()
    values["abs_cnae_delta_usd"] = values["trade_value_usd_delta_abs"].abs()
    values["abs_rank_delta"] = values["rank_trade_value_delta_abs"].abs()
    values["review_score"] = (
        values["abs_pair_delta_usd"].fillna(0.0)
        + 0.5 * values["trade_value_at_risk_usd"].fillna(0.0)
        + 0.25 * values["abs_cnae_delta_usd"].fillna(0.0)
    )

    def classify(row: pd.Series) -> str:
        basis = str(row.get("official_basis_status", ""))
        transition = bool(row.get("transition_relevance", False))
        abs_pair = float(row.get("abs_pair_delta_usd") or 0.0)
        at_risk = float(row.get("trade_value_at_risk_usd") or 0.0)
        max_weight_delta = float(row.get("max_abs_weight_delta") or 0.0)
        rank_delta = float(row.get("abs_rank_delta") or 0.0)
        if "published" not in basis:
            return "revisar_base_pia_ou_fallback"
        if abs_pair >= 1_000_000_000 or at_risk >= 500_000_000 or rank_delta >= 20:
            return "revisao_especialista_prioritaria"
        if transition and abs_pair >= 250_000_000:
            return "revisao_especialista_prioritaria"
        if max_weight_delta >= 0.30 and at_risk >= 100_000_000:
            return "validar_peso_pia"
        if abs_pair < 50_000_000 and max_weight_delta < 0.15:
            return "manter_pia_baixa_sensibilidade"
        return "monitorar"

    def action(row: pd.Series) -> str:
        recommendation = row["recommendation"]
        if recommendation == "revisar_base_pia_ou_fallback":
            return "Checar status da PIA e decidir se o fallback igualitario deve substituir o peso oficial."
        if recommendation == "revisao_especialista_prioritaria":
            return "Levar para revisao setorial; nao alterar automaticamente a regra oficial."
        if recommendation == "validar_peso_pia":
            return "Validar se a PIA representa bem a composicao economica da NCM."
        if recommendation == "manter_pia_baixa_sensibilidade":
            return "Manter regra oficial; baixa materialidade no contrafactual."
        return "Monitorar em rodada posterior."

    values["recommendation"] = values.apply(classify, axis=1)
    values["suggested_action"] = values.apply(action, axis=1)

    preferred_columns = [
        "recommendation",
        "suggested_action",
        "ncm",
        "cnae_class",
        "cnae_name",
        "discussion_tier",
        "transition_relevance",
        "allocated_value_usd_oficial",
        "allocated_value_usd_igualitario",
        "allocated_value_delta_abs",
        "allocated_value_delta_pct",
        "allocation_weight_oficial",
        "allocation_weight_igualitario",
        "allocation_weight_delta_abs",
        "trade_value_usd",
        "trade_value_at_risk_usd",
        "max_abs_weight_delta",
        "cnae_count",
        "prodlist_count",
        "official_rules",
        "official_basis_status",
        "trade_value_usd_delta_abs",
        "rank_trade_value_delta_abs",
        "review_score",
    ]
    ordered_columns = [column for column in preferred_columns if column in values.columns]
    return values[ordered_columns + [column for column in values.columns if column not in ordered_columns]].sort_values(
        ["review_score", "abs_pair_delta_usd"], ascending=[False, False]
    )


def compare_weights(bridge: pd.DataFrame, equal_bridge: pd.DataFrame, fact_trade: pd.DataFrame) -> pd.DataFrame:
    keys = ["ncm_key", "ncm", "cnae_class"]
    official = bridge.groupby(keys, as_index=False)["allocation_weight"].sum()
    equal = equal_bridge.groupby(keys, as_index=False)["allocation_weight"].sum()
    compared = official.merge(
        equal,
        on=keys,
        how="outer",
        suffixes=("_oficial", "_igualitario"),
    ).fillna({"allocation_weight_oficial": 0.0, "allocation_weight_igualitario": 0.0})
    compared["allocation_weight_delta_abs"] = (
        compared["allocation_weight_igualitario"] - compared["allocation_weight_oficial"]
    )
    ncm_trade = (
        fact_trade.groupby(["ncm_key", "ncm"], as_index=False)[["value_usd", "net_weight_kg"]]
        .sum()
        .rename(columns={"value_usd": "trade_value_usd", "net_weight_kg": "trade_net_weight_kg"})
    )
    ncm_meta = (
        bridge.groupby(["ncm_key", "ncm"], as_index=False)
        .agg(
            cnae_count=("cnae_class", "nunique"),
            prodlist_count=("prodlist_code", "nunique"),
            official_rules=("allocation_rule", lambda values: "|".join(sorted(set(values)))),
            official_basis_status=("allocation_basis_status", lambda values: "|".join(sorted(set(values.astype("string"))))),
        )
    )
    summary = (
        compared.groupby(["ncm_key", "ncm"], as_index=False)
        .agg(
            max_abs_weight_delta=("allocation_weight_delta_abs", lambda values: values.abs().max()),
            sum_abs_weight_delta=("allocation_weight_delta_abs", lambda values: values.abs().sum()),
        )
        .merge(ncm_meta, on=["ncm_key", "ncm"], how="left")
        .merge(ncm_trade, on=["ncm_key", "ncm"], how="left")
    )
    summary["trade_value_at_risk_usd"] = (
        summary["trade_value_usd"] * summary["sum_abs_weight_delta"] / 2.0
    )
    return summary.loc[summary["cnae_count"].gt(1)].sort_values(
        ["trade_value_at_risk_usd", "trade_value_usd"],
        ascending=[False, False],
    )


def priority_lookup(priority: pd.DataFrame) -> pd.DataFrame:
    if priority.empty or "cnae_class" not in priority.columns:
        return pd.DataFrame(columns=["cnae_class"])
    optional_columns = [
        column
        for column in ("cnae_name", "priority_tier", "discussion_tier", "transition_relevance")
        if column in priority.columns
    ]
    return priority[["cnae_class", *optional_columns]].drop_duplicates("cnae_class")


def markdown_table(frame: pd.DataFrame) -> str:
    if frame.empty:
        return "_Sem registros._"

    def format_value(value: object) -> str:
        if pd.isna(value):
            return ""
        if isinstance(value, float):
            return f"{value:,.4f}"
        return str(value)

    columns = list(frame.columns)
    rows = [[format_value(value) for value in row] for row in frame.itertuples(index=False, name=None)]
    lines = [
        "| " + " | ".join(columns) + " |",
        "| " + " | ".join(["---"] * len(columns)) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(lines)


def write_report(
    comparison: pd.DataFrame,
    ncm_summary: pd.DataFrame,
    pair_review: pd.DataFrame,
    cnae_scenarios: pd.DataFrame,
    allocated_official: pd.DataFrame,
    allocated_equal: pd.DataFrame,
) -> None:
    total_official = allocated_official["allocated_value_usd"].sum()
    total_equal = allocated_equal["allocated_value_usd"].sum()
    affected_trade = ncm_summary["trade_value_usd"].sum()
    changed = comparison.loc[comparison["trade_value_usd_delta_abs"].abs().gt(1e-6)]
    top = comparison.head(15).copy()
    top_ncm = ncm_summary.head(15).copy()
    top_pairs = pair_review.head(30).copy()
    recommendation_counts = pair_review["recommendation"].value_counts().reset_index()
    recommendation_counts.columns = ["recommendation", "pairs"]

    lines = [
        "# Analise de sensibilidade do rateio NCM-CNAE",
        "",
        "## Cenarios",
        "",
        "- `oficial_pia_ponderado`: pesos publicados pelo pipeline oficial.",
        "- `contrafactual_igualitario`: toda NCM mapeada e ligada a mais de uma CNAE e dividida igualmente entre CNAEs distintas; linhas Prodlist dentro da mesma CNAE dividem a cota setorial.",
        "",
        "## Resultado agregado",
        "",
        f"- Total alocado oficial: US$ {total_official:,.0f}.",
        f"- Total alocado contrafactual: US$ {total_equal:,.0f}.",
        f"- Diferenca total de reconciliacao: US$ {total_equal - total_official:,.6f}.",
        f"- NCMs multi-CNAE avaliadas: {len(ncm_summary):,}.",
        f"- Valor comercial associado a NCMs multi-CNAE: US$ {affected_trade:,.0f}.",
        f"- CNAEs com algum deslocamento de valor comercial: {len(changed):,}.",
        "",
        "## Classificacao da pauta CNAE-NCM",
        "",
        markdown_table(recommendation_counts),
        "",
        "## CNAEs mais sensiveis por valor comercial deslocado",
        "",
        markdown_table(top[
            [
                "cnae_class",
                "trade_value_usd_oficial",
                "trade_value_usd_igualitario",
                "trade_value_usd_delta_abs",
                "trade_value_delta_pct",
                "rank_trade_value_oficial",
                "rank_trade_value_igualitario",
            ]
        ]),
        "",
        "## NCMs que mais explicam a sensibilidade",
        "",
        markdown_table(top_ncm[
            [
                "ncm",
                "cnae_count",
                "prodlist_count",
                "trade_value_usd",
                "trade_value_at_risk_usd",
                "max_abs_weight_delta",
                "official_rules",
                "official_basis_status",
            ]
        ]),
        "",
        "## Pauta prioritaria CNAE-NCM",
        "",
        markdown_table(top_pairs[
            [
                "recommendation",
                "ncm",
                "cnae_class",
                "cnae_name",
                "allocated_value_delta_abs",
                "allocation_weight_oficial",
                "allocation_weight_igualitario",
                "trade_value_at_risk_usd",
                "official_basis_status",
            ]
        ]),
        "",
        "## Leitura metodologica",
        "",
        "A diferenca entre os cenarios nao altera o total de comercio alocado; ela redistribui valores entre CNAEs candidatas de uma mesma NCM. Assim, os maiores deltas indicam setores cujo resultado depende mais da escolha entre peso economico PIA e divisao igualitaria.",
        "",
        "Arquivos gerados:",
        "",
        "- `scenario_cnae_indicators.csv`",
        "- `sensitivity_cnae_comparison.csv`",
        "- `affected_ncm_summary.csv`",
        "- `pauta_revisao_cnae_ncm.csv`",
        "- `allocated_trade_scenarios.csv`",
    ]
    (OUT_DIR / "relatorio_sensibilidade_rateio.md").write_text(
        "\n".join(lines), encoding="utf-8"
    )


def build_scenario_matrix(
    allocated_by_rateio: dict[str, pd.DataFrame],
    official_cnae: pd.DataFrame,
    priority_meta: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    treatments = [
        "manter_nao_mapeado_separado",
        "excluir_nao_mapeado",
        "subbucket_nao_mapeado",
    ]
    scenario_frames = []
    allocation_frames = []
    treatment_rows = []

    for rateio_name, allocated in allocated_by_rateio.items():
        for treatment in treatments:
            scenario_name = f"{rateio_name}__{treatment}"
            treated = apply_unmapped_treatment(allocated, treatment)
            treated = treated.assign(
                scenario=scenario_name,
                rateio_scenario=rateio_name,
                unmapped_treatment=treatment,
            )
            allocation_frames.append(treated)
            scenario_frames.append(summarize_cnae(treated, official_cnae, scenario_name))

            unmapped_original = allocated.loc[allocated["cnae_class"].eq("NAO_MAPEADO")]
            treated_total = treated["allocated_value_usd"].sum()
            treatment_rows.append(
                {
                    "scenario": scenario_name,
                    "rateio_scenario": rateio_name,
                    "unmapped_treatment": treatment,
                    "allocated_total_value_usd": treated_total,
                    "unmapped_original_value_usd": unmapped_original["allocated_value_usd"].sum(),
                    "unmapped_original_ncm_count": unmapped_original["ncm"].nunique(),
                    "keeps_total_reconciliation": treatment != "excluir_nao_mapeado",
                }
            )

    scenario_matrix = pd.concat(scenario_frames, ignore_index=True, sort=False)
    allocated_matrix = pd.concat(allocation_frames, ignore_index=True, sort=False)
    treatment_summary = pd.DataFrame(treatment_rows)

    if len(priority_meta.columns) > 1:
        scenario_matrix = scenario_matrix.merge(priority_meta, on="cnae_class", how="left")

    return scenario_matrix, allocated_matrix, treatment_summary


def compare_matrix_to_baseline(scenario_matrix: pd.DataFrame) -> pd.DataFrame:
    baseline_name = "oficial_pia_ponderado__manter_nao_mapeado_separado"
    metrics = [
        "import_value_usd",
        "export_value_usd",
        "trade_value_usd",
        "trade_balance_usd",
        "external_dependency_ratio",
        "rank_trade_value",
    ]
    baseline = (
        scenario_matrix.loc[scenario_matrix["scenario"].eq(baseline_name)]
        .set_index("cnae_class")[metrics]
        .add_suffix("_baseline")
    )
    rows = []
    for scenario_name, frame in scenario_matrix.groupby("scenario", sort=False):
        scenario_values = frame.set_index("cnae_class")[metrics].add_suffix("_scenario")
        compared = baseline.join(scenario_values, how="outer").reset_index()
        compared.insert(0, "scenario", scenario_name)
        compared.insert(1, "baseline_scenario", baseline_name)
        value_metrics = [
            "import_value_usd",
            "export_value_usd",
            "trade_value_usd",
            "trade_balance_usd",
        ]
        for metric in value_metrics:
            compared[f"{metric}_baseline"] = compared[f"{metric}_baseline"].fillna(0.0)
            compared[f"{metric}_scenario"] = compared[f"{metric}_scenario"].fillna(0.0)
        for metric in metrics:
            compared[f"{metric}_delta_abs"] = (
                compared[f"{metric}_scenario"] - compared[f"{metric}_baseline"]
            )
        compared["trade_value_delta_pct"] = _safe_divide(
            compared["trade_value_usd_delta_abs"], compared["trade_value_usd_baseline"]
        )
        rows.append(compared)
    result = pd.concat(rows, ignore_index=True, sort=False)
    result["abs_trade_value_delta_usd"] = result["trade_value_usd_delta_abs"].abs()
    return result.sort_values(
        ["scenario", "abs_trade_value_delta_usd"],
        ascending=[True, False],
        kind="stable",
    )


def summarize_unmapped_subbuckets(allocated_official: pd.DataFrame) -> pd.DataFrame:
    unmapped = allocated_official.loc[allocated_official["cnae_class"].eq("NAO_MAPEADO")].copy()
    if unmapped.empty:
        return pd.DataFrame(
            columns=[
                "familia_nao_mapeado",
                "diagnostico_nao_mapeado",
                "ncm_count",
                "trade_value_usd",
                "trade_share",
            ]
        )
    classified = unmapped["ncm"].map(_classify_unmapped_ncm)
    unmapped["familia_nao_mapeado"] = classified.map(lambda item: item[0])
    unmapped["diagnostico_nao_mapeado"] = classified.map(lambda item: item[1])
    grouped = (
        unmapped.groupby(["familia_nao_mapeado", "diagnostico_nao_mapeado"], as_index=False)
        .agg(
            ncm_count=("ncm", "nunique"),
            trade_value_usd=("allocated_value_usd", "sum"),
            net_weight_kg=("allocated_net_weight_kg", "sum"),
        )
        .sort_values("trade_value_usd", ascending=False, kind="stable")
    )
    grouped["trade_share"] = _safe_divide(
        grouped["trade_value_usd"],
        pd.Series(grouped["trade_value_usd"].sum(), index=grouped.index),
    )
    return grouped


def write_alternative_scenarios_report(
    treatment_summary: pd.DataFrame,
    matrix_comparison: pd.DataFrame,
    unmapped_subbuckets: pd.DataFrame,
) -> None:
    top_by_scenario = (
        matrix_comparison.loc[
            ~matrix_comparison["scenario"].eq("oficial_pia_ponderado__manter_nao_mapeado_separado")
        ]
        .sort_values(["scenario", "abs_trade_value_delta_usd"], ascending=[True, False], kind="stable")
        .groupby("scenario", as_index=False)
        .head(5)
    )
    treatment_view = treatment_summary[
        [
            "scenario",
            "allocated_total_value_usd",
            "unmapped_original_value_usd",
            "unmapped_original_ncm_count",
            "keeps_total_reconciliation",
        ]
    ].copy()
    lines = [
        "# Cenarios alternativos de rateio e itens nao mapeados",
        "",
        "## Matriz de cenarios",
        "",
        "- Rateio `oficial_pia_ponderado`: preserva os pesos da ponte oficial.",
        "- Rateio `contrafactual_igualitario`: divide cada NCM multi-CNAE igualmente entre CNAEs distintas.",
        "- Tratamento `manter_nao_mapeado_separado`: mantem NCMs sem ponte no bucket `NAO_MAPEADO`.",
        "- Tratamento `excluir_nao_mapeado`: remove NCMs sem ponte dos indicadores setoriais; util apenas para leitura de cobertura mapeada.",
        "- Tratamento `subbucket_nao_mapeado`: mantem reconciliacao e abre o bucket em familias metodologicas sem imputar CNAE real.",
        "",
        "## Reconciliacao por cenario",
        "",
        markdown_table(treatment_view),
        "",
        "## Sub-buckets de itens nao mapeados",
        "",
        markdown_table(unmapped_subbuckets.head(20)),
        "",
        "## Maiores deslocamentos contra o oficial",
        "",
        markdown_table(
            top_by_scenario[
                [
                    "scenario",
                    "cnae_class",
                    "trade_value_usd_baseline",
                    "trade_value_usd_scenario",
                    "trade_value_usd_delta_abs",
                    "trade_value_delta_pct",
                ]
            ]
        ),
        "",
        "## Uso recomendado",
        "",
        "Use `manter_nao_mapeado_separado` como base publicavel, pois preserva o total oficial e explicita a lacuna. Use `excluir_nao_mapeado` somente para diagnosticar a parte mapeada da amostra. Use `subbucket_nao_mapeado` para priorizar revisao manual e comunicar a composicao do residuo sem criar alocacao setorial artificial.",
        "",
        "Arquivos gerados:",
        "",
        "- `cenario_matriz_indicadores.csv`",
        "- `cenario_matriz_comparacao.csv`",
        "- `cenario_matriz_alocacoes.csv`",
        "- `cenario_tratamento_nao_mapeado.csv`",
        "- `cenario_nao_mapeado_subbuckets.csv`",
    ]
    (OUT_DIR / "relatorio_cenarios_alternativos.md").write_text(
        "\n".join(lines), encoding="utf-8"
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bridge = _read_csv(
        "bridge_ncm_prodlist_cnae.csv",
        dtype={"ncm": "string", "prodlist_code": "string", "cnae_class": "string"},
    )
    fact_trade = _read_csv("fact_trade.csv", dtype={"ncm": "string"})
    official_cnae = _read_csv("border_value_indicators_cnae.csv", dtype={"cnae_class": "string"})
    priority_path = BASE_DIR / "priorizacao_especialistas_cnae.csv"
    priority = pd.read_csv(priority_path, dtype={"cnae_class": "string"}) if priority_path.exists() else pd.DataFrame()

    equal_bridge = build_equal_share_bridge(bridge)
    allocated_official = allocate_trade(fact_trade, bridge)
    allocated_equal = allocate_trade(fact_trade, equal_bridge)

    cnae_scenarios = pd.concat(
        [
            summarize_cnae(allocated_official, official_cnae, "oficial_pia_ponderado"),
            summarize_cnae(allocated_equal, official_cnae, "contrafactual_igualitario"),
        ],
        ignore_index=True,
        sort=False,
    )
    priority_meta = priority_lookup(priority)
    if len(priority_meta.columns) > 1:
        cnae_scenarios = cnae_scenarios.merge(
            priority_meta,
            on="cnae_class",
            how="left",
        )

    comparison = compare_scenarios(cnae_scenarios)
    if len(priority_meta.columns) > 1:
        comparison = comparison.merge(
            priority_meta,
            on="cnae_class",
            how="left",
        )
        leading = [column for column in priority_meta.columns if column in comparison.columns]
        comparison = comparison[leading + [column for column in comparison.columns if column not in leading]]

    ncm_summary = compare_weights(bridge, equal_bridge, fact_trade)
    allocated_scenarios = pd.concat(
        [
            allocated_official.assign(scenario="oficial_pia_ponderado"),
            allocated_equal.assign(scenario="contrafactual_igualitario"),
        ],
        ignore_index=True,
        sort=False,
    )
    pair_review = compare_pairs(
        allocated_scenarios,
        bridge,
        equal_bridge,
        ncm_summary,
        comparison,
        priority_meta,
    )

    cnae_scenarios.to_csv(OUT_DIR / "scenario_cnae_indicators.csv", index=False)
    comparison.to_csv(OUT_DIR / "sensitivity_cnae_comparison.csv", index=False)
    ncm_summary.to_csv(OUT_DIR / "affected_ncm_summary.csv", index=False)
    pair_review.to_csv(OUT_DIR / "pauta_revisao_cnae_ncm.csv", index=False)
    allocated_scenarios.to_csv(OUT_DIR / "allocated_trade_scenarios.csv", index=False)
    write_report(
        comparison,
        ncm_summary,
        pair_review,
        cnae_scenarios,
        allocated_official,
        allocated_equal,
    )

    scenario_matrix, allocated_matrix, treatment_summary = build_scenario_matrix(
        {
            "oficial_pia_ponderado": allocated_official,
            "contrafactual_igualitario": allocated_equal,
        },
        official_cnae,
        priority_meta,
    )
    matrix_comparison = compare_matrix_to_baseline(scenario_matrix)
    if len(priority_meta.columns) > 1:
        matrix_comparison = matrix_comparison.merge(priority_meta, on="cnae_class", how="left")
    unmapped_subbuckets = summarize_unmapped_subbuckets(allocated_official)

    scenario_matrix.to_csv(OUT_DIR / "cenario_matriz_indicadores.csv", index=False)
    matrix_comparison.to_csv(OUT_DIR / "cenario_matriz_comparacao.csv", index=False)
    allocated_matrix.to_csv(OUT_DIR / "cenario_matriz_alocacoes.csv", index=False)
    treatment_summary.to_csv(OUT_DIR / "cenario_tratamento_nao_mapeado.csv", index=False)
    unmapped_subbuckets.to_csv(OUT_DIR / "cenario_nao_mapeado_subbuckets.csv", index=False)
    write_alternative_scenarios_report(
        treatment_summary,
        matrix_comparison,
        unmapped_subbuckets,
    )


if __name__ == "__main__":
    main()
