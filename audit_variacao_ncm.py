from __future__ import annotations

from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs" / "final_border_value_2026"
HISTORICAL_DIR = BASE_DIR / "outputs" / "official_2024_comparacao"
CURRENT_DIR = BASE_DIR / "outputs" / "official_2026"

TARGET_CNAES = ["2910", "3011", "2012", "1071", "0710", "0600"]
H1_MONTHS = {1, 2, 3, 4, 5, 6}


def normalize_code(series: pd.Series, width: int) -> pd.Series:
    values = series.astype("string")
    values = values.where(values.isna(), values.str.replace(r"\.0$", "", regex=True))
    return values.where(values.isna(), values.str.zfill(width))


def read_trade(source_dir: Path) -> pd.DataFrame:
    trade = pd.read_csv(source_dir / "fact_trade.csv", dtype={"ncm": "string"})
    trade = trade.loc[trade["month"].isin(H1_MONTHS)].copy()
    trade["ncm"] = normalize_code(trade["ncm"], 8)
    trade["value_usd"] = pd.to_numeric(trade["value_usd"], errors="coerce").fillna(0.0)
    trade["net_weight_kg"] = pd.to_numeric(trade["net_weight_kg"], errors="coerce").fillna(0.0)
    return trade


def read_bridge(source_dir: Path) -> pd.DataFrame:
    bridge = pd.read_csv(source_dir / "bridge_ncm_prodlist_cnae.csv", dtype={"ncm": "string"})
    bridge["ncm"] = normalize_code(bridge["ncm"], 8)
    bridge["cnae_class"] = normalize_code(bridge["cnae_class"], 4)
    bridge["prodlist_code"] = bridge["prodlist_code"].astype("string")
    bridge["allocation_weight"] = pd.to_numeric(bridge["allocation_weight"], errors="coerce").fillna(0.0)
    return bridge


def read_ncm_flags() -> pd.DataFrame:
    current = pd.read_csv(CURRENT_DIR / "dim_ncm.csv", dtype={"ncm": "string"})
    historical = pd.read_csv(HISTORICAL_DIR / "dim_ncm.csv", dtype={"ncm": "string"})
    flags = pd.concat([historical[["ncm", "is_generic_code"]], current[["ncm", "is_generic_code"]]])
    flags["ncm"] = normalize_code(flags["ncm"], 8)
    flags["is_generic_code"] = flags["is_generic_code"].fillna(False).astype(bool)
    return flags.groupby("ncm", as_index=False)["is_generic_code"].max()


def build_allocated_detail(source_dir: Path, period_label: str, bridge_version: str) -> pd.DataFrame:
    trade = read_trade(source_dir)
    bridge = read_bridge(source_dir)
    merged = trade.merge(
        bridge[
            [
                "ncm_key",
                "prodlist_code",
                "cnae_class",
                "allocation_rule",
                "allocation_basis_status",
                "allocation_weight",
            ]
        ],
        on="ncm_key",
        how="left",
    )
    unmatched = merged["cnae_class"].isna()
    merged.loc[unmatched, "cnae_class"] = "NAO_MAPEADO"
    merged.loc[unmatched, "prodlist_code"] = "NCM_SEM_PONTE"
    merged.loc[unmatched, "allocation_rule"] = "unmatched_ncm"
    merged.loc[unmatched, "allocation_basis_status"] = "missing"
    merged.loc[unmatched, "allocation_weight"] = 1.0
    merged["allocated_value_usd"] = merged["value_usd"] * merged["allocation_weight"]
    merged["allocated_net_weight_kg"] = merged["net_weight_kg"] * merged["allocation_weight"]
    merged["mapping_status"] = merged["cnae_class"].eq("NAO_MAPEADO").map(
        {True: "NAO_MAPEADO", False: "MAPEADO"}
    )
    merged["period"] = period_label
    merged["bridge_version"] = bridge_version
    return merged


def compact_set(values: pd.Series) -> str:
    clean = sorted({str(value) for value in values.dropna() if str(value) not in {"", "<NA>", "nan"}})
    return ";".join(clean)


def compact_semicolon_set(values: pd.Series) -> str:
    tokens: set[str] = set()
    for value in values.dropna():
        for token in str(value).split(";"):
            token = token.strip()
            if token and token not in {"<NA>", "nan"}:
                tokens.add(token)
    return ";".join(sorted(tokens))


def build_mapping_summary(source_dir: Path, suffix: str) -> pd.DataFrame:
    bridge = read_bridge(source_dir)
    summary = (
        bridge.groupby("ncm", as_index=False)
        .agg(
            **{
                f"cnae_set_{suffix}": ("cnae_class", compact_set),
                f"prodlist_set_{suffix}": ("prodlist_code", compact_set),
                f"allocation_rule_set_{suffix}": ("allocation_rule", compact_set),
                f"allocation_weight_sum_{suffix}": ("allocation_weight", "sum"),
            }
        )
    )
    summary[f"mapping_status_{suffix}"] = "MAPEADO"
    return summary


def build_period_table(detail: pd.DataFrame, suffix: str) -> pd.DataFrame:
    grouped = (
        detail.groupby(["cnae_class", "flow", "month", "ncm"], as_index=False, dropna=False)
        .agg(
            **{
                f"value_usd_{suffix}": ("allocated_value_usd", "sum"),
                f"net_weight_kg_{suffix}": ("allocated_net_weight_kg", "sum"),
                f"prodlist_set_{suffix}": ("prodlist_code", compact_set),
                f"allocation_rule_set_{suffix}": ("allocation_rule", compact_set),
                f"mapping_status_{suffix}": ("mapping_status", compact_set),
                f"allocation_weight_sum_row_{suffix}": ("allocation_weight", "sum"),
            }
        )
    )
    return grouped


def build_total_trade_by_ncm(historical: pd.DataFrame, current: pd.DataFrame) -> pd.DataFrame:
    def aggregate(frame: pd.DataFrame, suffix: str) -> pd.DataFrame:
        return (
            frame.groupby(["flow", "month", "ncm"], as_index=False)
            .agg(
                **{
                    f"total_ncm_value_usd_{suffix}": ("value_usd", "sum"),
                    f"total_ncm_net_weight_kg_{suffix}": ("net_weight_kg", "sum"),
                }
            )
        )

    return aggregate(historical, "2024h1").merge(
        aggregate(current, "2026h1"), on=["flow", "month", "ncm"], how="outer"
    )


def build_drivers() -> pd.DataFrame:
    historical_trade = read_trade(HISTORICAL_DIR)
    current_trade = read_trade(CURRENT_DIR)
    historical_detail = build_allocated_detail(HISTORICAL_DIR, "2024 H1", "Prodlist 2022")
    current_detail = build_allocated_detail(CURRENT_DIR, "2026 H1", "Prodlist 2025")

    base = build_period_table(historical_detail, "2024h1")
    comparison = build_period_table(current_detail, "2026h1")
    drivers = base.merge(comparison, on=["cnae_class", "flow", "month", "ncm"], how="outer")

    mapping_2024 = build_mapping_summary(HISTORICAL_DIR, "2024")
    mapping_2026 = build_mapping_summary(CURRENT_DIR, "2026")
    flags = read_ncm_flags()
    total_trade = build_total_trade_by_ncm(historical_trade, current_trade)

    drivers = drivers.merge(mapping_2024, on="ncm", how="left").merge(mapping_2026, on="ncm", how="left")
    drivers = drivers.merge(flags, on="ncm", how="left")
    drivers = drivers.merge(total_trade, on=["flow", "month", "ncm"], how="left")

    for column in [
        "value_usd_2024h1",
        "value_usd_2026h1",
        "net_weight_kg_2024h1",
        "net_weight_kg_2026h1",
        "total_ncm_value_usd_2024h1",
        "total_ncm_value_usd_2026h1",
        "total_ncm_net_weight_kg_2024h1",
        "total_ncm_net_weight_kg_2026h1",
    ]:
        drivers[column] = pd.to_numeric(drivers[column], errors="coerce").fillna(0.0)

    for suffix in ["2024h1", "2026h1"]:
        drivers[f"mapping_status_{suffix}"] = drivers[f"mapping_status_{suffix}"].fillna("SEM_COMERCIO_NO_SETOR")
        drivers[f"prodlist_set_{suffix}"] = drivers[f"prodlist_set_{suffix}"].fillna("")
        drivers[f"allocation_rule_set_{suffix}"] = drivers[f"allocation_rule_set_{suffix}"].fillna("")
    for suffix in ["2024", "2026"]:
        drivers[f"mapping_status_{suffix}"] = drivers[f"mapping_status_{suffix}"].fillna("NAO_MAPEADO")
        drivers[f"cnae_set_{suffix}"] = drivers[f"cnae_set_{suffix}"].fillna("NAO_MAPEADO")
        drivers[f"prodlist_set_{suffix}"] = drivers[f"prodlist_set_{suffix}"].fillna("NCM_SEM_PONTE")
        drivers[f"allocation_rule_set_{suffix}"] = drivers[f"allocation_rule_set_{suffix}"].fillna("unmatched_ncm")

    drivers["delta_value_usd"] = drivers["value_usd_2026h1"] - drivers["value_usd_2024h1"]
    drivers["delta_net_weight_kg"] = drivers["net_weight_kg_2026h1"] - drivers["net_weight_kg_2024h1"]
    drivers["delta_total_ncm_value_usd"] = (
        drivers["total_ncm_value_usd_2026h1"] - drivers["total_ncm_value_usd_2024h1"]
    )
    drivers["abs_delta_value_usd"] = drivers["delta_value_usd"].abs()
    drivers["is_target_cnae"] = drivers["cnae_class"].isin(TARGET_CNAES)
    drivers["is_nao_mapeado"] = drivers["cnae_class"].eq("NAO_MAPEADO")
    drivers = drivers.loc[drivers["is_target_cnae"] | drivers["is_nao_mapeado"]].copy()
    drivers = drivers.loc[
        (drivers["value_usd_2024h1"].ne(0)) | (drivers["value_usd_2026h1"].ne(0))
    ].copy()

    drivers["mapping_changed_cnae"] = drivers["cnae_set_2024"].ne(drivers["cnae_set_2026"])
    drivers["mapping_changed_prodlist"] = drivers["prodlist_set_2024"].ne(drivers["prodlist_set_2026"])
    drivers["mapping_changed_status"] = drivers["mapping_status_2024"].ne(drivers["mapping_status_2026"])
    drivers["target_row_status_changed"] = drivers["mapping_status_2024h1"].ne(drivers["mapping_status_2026h1"])
    drivers["possible_prodlist_2022_2025_change"] = (
        drivers["mapping_changed_cnae"]
        | drivers["mapping_changed_prodlist"]
        | drivers["mapping_changed_status"]
        | drivers["target_row_status_changed"]
    )

    reason_columns = [
        ("mapping_changed_status", "status_mapeamento_ncm_mudou"),
        ("mapping_changed_cnae", "conjunto_cnae_mudou"),
        ("mapping_changed_prodlist", "conjunto_prodlist_mudou"),
        ("target_row_status_changed", "presenca_no_setor_ou_bucket_mudou"),
    ]
    drivers["classification_reason"] = ""
    for column, reason in reason_columns:
        drivers.loc[drivers[column], "classification_reason"] += reason + ";"
    drivers["classification_reason"] = drivers["classification_reason"].str.rstrip(";")
    drivers.loc[drivers["classification_reason"].eq(""), "classification_reason"] = "ponte_estavel"

    drivers["interpretacao_variacao"] = "variacao_economica_provavel"
    drivers.loc[drivers["possible_prodlist_2022_2025_change"], "interpretacao_variacao"] = (
        "variacao_possivelmente_metodologica"
    )
    drivers.loc[drivers["is_nao_mapeado"], "interpretacao_variacao"] = (
        "lacuna_classificatoria_prioritaria"
    )
    drivers["audit_scope"] = drivers["cnae_class"].where(drivers["cnae_class"].ne("NAO_MAPEADO"), "NAO_MAPEADO")
    drivers["driver_rank_in_scope"] = (
        drivers.sort_values(["audit_scope", "abs_delta_value_usd"], ascending=[True, False])
        .groupby("audit_scope")
        .cumcount()
        + 1
    )
    drivers["is_generic_code"] = drivers["is_generic_code"].fillna(False).astype(bool)

    output_columns = [
        "audit_scope",
        "driver_rank_in_scope",
        "cnae_class",
        "flow",
        "month",
        "ncm",
        "is_generic_code",
        "value_usd_2024h1",
        "value_usd_2026h1",
        "delta_value_usd",
        "net_weight_kg_2024h1",
        "net_weight_kg_2026h1",
        "delta_net_weight_kg",
        "total_ncm_value_usd_2024h1",
        "total_ncm_value_usd_2026h1",
        "delta_total_ncm_value_usd",
        "mapping_status_2024h1",
        "mapping_status_2026h1",
        "prodlist_set_2024h1",
        "prodlist_set_2026h1",
        "allocation_rule_set_2024h1",
        "allocation_rule_set_2026h1",
        "cnae_set_2024",
        "cnae_set_2026",
        "prodlist_set_2024",
        "prodlist_set_2026",
        "mapping_changed_status",
        "mapping_changed_cnae",
        "mapping_changed_prodlist",
        "target_row_status_changed",
        "possible_prodlist_2022_2025_change",
        "interpretacao_variacao",
        "classification_reason",
    ]
    return drivers[output_columns].sort_values(
        ["audit_scope", "driver_rank_in_scope", "flow", "month", "ncm"], kind="stable"
    )


def build_validation_list(drivers: pd.DataFrame) -> pd.DataFrame:
    priority = drivers.copy()
    priority["validation_priority_score"] = priority["abs_delta_for_priority"] = priority["delta_value_usd"].abs()
    priority.loc[priority["cnae_class"].eq("NAO_MAPEADO"), "validation_priority_score"] += (
        priority["value_usd_2026h1"] * 2
    )
    priority.loc[priority["possible_prodlist_2022_2025_change"], "validation_priority_score"] *= 1.5
    grouped = (
        priority.groupby("ncm", as_index=False)
        .agg(
            audit_scopes=("audit_scope", compact_set),
            is_generic_code=("is_generic_code", "max"),
            value_usd_2024h1=("value_usd_2024h1", "sum"),
            value_usd_2026h1=("value_usd_2026h1", "sum"),
            delta_value_usd=("delta_value_usd", "sum"),
            abs_delta_value_usd=("abs_delta_for_priority", "sum"),
            validation_priority_score=("validation_priority_score", "sum"),
            interpretations=("interpretacao_variacao", compact_semicolon_set),
            classification_reasons=("classification_reason", compact_semicolon_set),
            cnae_set_2024=("cnae_set_2024", compact_semicolon_set),
            cnae_set_2026=("cnae_set_2026", compact_semicolon_set),
            prodlist_set_2024=("prodlist_set_2024", compact_semicolon_set),
            prodlist_set_2026=("prodlist_set_2026", compact_semicolon_set),
        )
        .sort_values("validation_priority_score", ascending=False, kind="stable")
    )
    grouped.insert(0, "validation_rank", range(1, len(grouped) + 1))
    return grouped


def money(value: float) -> str:
    return f"US$ {value / 1_000_000_000:,.2f} bi"


def top_lines(frame: pd.DataFrame, scope: str, n: int = 6) -> list[str]:
    subset = frame.loc[frame["audit_scope"].eq(scope)].head(n)
    lines = []
    for _, row in subset.iterrows():
        sign = "+" if row["delta_value_usd"] >= 0 else ""
        lines.append(
            f"- {scope} {row['flow']} m{int(row['month']):02d} NCM {row['ncm']}: "
            f"{sign}{money(row['delta_value_usd'])}; {row['interpretacao_variacao']} "
            f"({row['classification_reason']})."
        )
    return lines


def write_report(drivers: pd.DataFrame, validation: pd.DataFrame) -> None:
    totals = (
        drivers.groupby(["audit_scope", "interpretacao_variacao"], as_index=False)
        .agg(delta_value_usd=("delta_value_usd", "sum"), value_usd_2026h1=("value_usd_2026h1", "sum"))
        .sort_values(["audit_scope", "value_usd_2026h1"], ascending=[True, False])
    )
    nao = drivers.loc[drivers["audit_scope"].eq("NAO_MAPEADO")]
    nao_total = nao["value_usd_2026h1"].sum()
    lines = [
        "# Auditoria de drivers NCM por periodo",
        "",
        "Comparacao: janeiro-junho de 2026 contra janeiro-junho de 2024, por fluxo, mes, NCM e status de mapeamento.",
        "",
        "## Leitura executiva",
        "",
        f"- O bucket NAO_MAPEADO soma {money(nao_total)} em 2026 H1 nos registros auditados.",
        "- A classificacao e heuristica: ponte NCM-Prodlist/CNAE estavel sugere variacao economica provavel; mudanca de status, CNAE ou Prodlist entre 2022 e 2025 sugere efeito possivelmente metodologico.",
        "- NCMs em NAO_MAPEADO devem ser tratados como lacuna classificatoria prioritaria, mesmo quando a variacao parece economica.",
        "",
        "## Resumo por escopo e interpretacao",
        "",
        "| Escopo | Interpretacao | Valor 2026 H1 | Delta 2026H1-2024H1 |",
        "| --- | --- | ---: | ---: |",
    ]
    for _, row in totals.iterrows():
        lines.append(
            f"| {row['audit_scope']} | {row['interpretacao_variacao']} | "
            f"{money(row['value_usd_2026h1'])} | {money(row['delta_value_usd'])} |"
        )

    lines.extend(["", "## Principais drivers", ""])
    for scope in TARGET_CNAES + ["NAO_MAPEADO"]:
        lines.append(f"### {scope}")
        lines.extend(top_lines(drivers, scope, 6) or ["- Sem registro relevante."])
        lines.append("")

    lines.extend(
        [
            "## NCMs para validacao manual",
            "",
            "Priorizar os NCMs abaixo com especialistas/CONCLA, sobretudo os sem ponte e os que mudaram conjunto CNAE/Prodlist entre as pontes.",
            "",
            "| Rank | NCM | Escopos | Valor 2026 H1 | Delta | Motivos |",
            "| ---: | --- | --- | ---: | ---: | --- |",
        ]
    )
    for _, row in validation.head(25).iterrows():
        lines.append(
            f"| {int(row['validation_rank'])} | {row['ncm']} | {row['audit_scopes']} | "
            f"{money(row['value_usd_2026h1'])} | {money(row['delta_value_usd'])} | "
            f"{row['classification_reasons']} |"
        )

    (OUTPUT_DIR / "relatorio_auditoria_variacao_ncm.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    drivers = build_drivers()
    validation = build_validation_list(drivers)
    csv_options = {"index": False, "encoding": "utf-8-sig"}
    drivers.to_csv(OUTPUT_DIR / "drivers_variacao_periodos_ncm.csv", **csv_options)
    validation.to_csv(OUTPUT_DIR / "ncm_validacao_manual_concla.csv", **csv_options)
    write_report(drivers, validation)


if __name__ == "__main__":
    main()
