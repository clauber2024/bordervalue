from __future__ import annotations

from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
TSB_DIR = BASE_DIR / "dados" / "tsb"
OFFICIAL_RAIS = BASE_DIR / "outputs" / "official_2026_rais"
FINAL = BASE_DIR / "outputs" / "final_border_value_2026"
OUT = BASE_DIR / "outputs" / "tsb_bridge_2026"

EXPOSURE_ORDER = {
    "Sem exposicao TSB direta": 0,
    "Exposicao intermediaria TSB": 1,
    "Alta exposicao TSB": 2,
}


def normalize_code(series: pd.Series, width: int) -> pd.Series:
    return series.astype("string").str.replace(r"\D", "", regex=True).str.zfill(width).str[:width]


def parse_percent(series: pd.Series) -> pd.Series:
    cleaned = (
        series.astype("string")
        .str.replace("%", "", regex=False)
        .str.replace(".", "", regex=False)
        .str.replace(",", ".", regex=False)
    )
    return pd.to_numeric(cleaned, errors="coerce") / 100


def percent_rank(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce").fillna(0)
    if numeric.nunique(dropna=True) <= 1:
        return pd.Series(0.0, index=series.index)
    return numeric.rank(pct=True, method="average")


def add_tsb_platform_alignment_score(indicators: pd.DataFrame, rais_cnae: pd.DataFrame | None = None) -> pd.DataFrame:
    result = indicators.copy()
    if rais_cnae is not None and not rais_cnae.empty and "cnae_class" in rais_cnae.columns:
        rais_metrics = (
            rais_cnae.groupby("cnae_class", as_index=False)
            .agg(
                tsb_rais_formal_jobs=("formal_jobs", "sum"),
                tsb_rais_wage_mass=("wage_mass", "sum"),
            )
        )
        result = result.merge(rais_metrics, on="cnae_class", how="left")
    for column in [
        "tsb_exposicao_scn67_max",
        "priority_score",
        "tsb_rais_formal_jobs",
        "tsb_rais_wage_mass",
        "external_dependency_ratio",
        "trade_value_usd",
    ]:
        if column not in result.columns:
            result[column] = 0.0
        result[column] = pd.to_numeric(result[column], errors="coerce").fillna(0.0)

    result["tsb_exposure_component_score"] = result["tsb_exposicao_scn67_max"].clip(lower=0, upper=1)
    result["border_value_relevance_component_score"] = result["priority_score"].clip(lower=0, upper=1)
    result["rais_scale_component_score"] = pd.concat(
        [percent_rank(result["tsb_rais_formal_jobs"]), percent_rank(result["tsb_rais_wage_mass"])],
        axis=1,
    ).max(axis=1)
    result["external_or_commercial_component_score"] = pd.concat(
        [percent_rank(result["external_dependency_ratio"]), percent_rank(result["trade_value_usd"])],
        axis=1,
    ).max(axis=1)
    result["tsb_platform_alignment_score"] = (
        0.40 * result["tsb_exposure_component_score"]
        + 0.25 * result["border_value_relevance_component_score"]
        + 0.20 * result["rais_scale_component_score"]
        + 0.15 * result["external_or_commercial_component_score"]
    ).round(4)
    result["tsb_platform_alignment_label"] = pd.cut(
        result["tsb_platform_alignment_score"],
        bins=[-0.001, 0.50, 0.70, 1.001],
        labels=["3 - aderencia baixa", "2 - aderencia media", "1 - maior aderencia TSB"],
    ).astype("string")
    return result


def load_tsb_dimensions(tsb_dir: Path = TSB_DIR) -> tuple[pd.DataFrame, pd.DataFrame]:
    cnae5 = pd.read_csv(tsb_dir / "dim_tsb_cnae5.csv", dtype="string")
    scn67 = pd.read_csv(tsb_dir / "dim_scn67_tsb.csv", dtype="string")
    cnae5["cnae5"] = normalize_code(cnae5["cnae5"], 5)
    cnae5["cnae_class"] = cnae5["cnae5"].str[:4]
    scn67["scn67"] = normalize_code(scn67["scn67"], 4)
    scn67["exposicao_tsb_ratio"] = parse_percent(scn67["exposicao_tsb"])
    scn67["exposure_rank"] = scn67["grupo_exposicao"].map(EXPOSURE_ORDER).fillna(0).astype(int)
    return cnae5, scn67


def choose_exposure(group: pd.DataFrame) -> pd.Series:
    ranked = group.sort_values(
        ["exposure_rank", "exposicao_tsb_ratio", "scn67"],
        ascending=[False, False, True],
        kind="stable",
    )
    top = ranked.iloc[0]
    return pd.Series(
        {
            "tsb_associated": True,
            "tsb_cnae5_count": int(group["cnae5"].nunique()),
            "tsb_cnae5_list": ";".join(sorted(group["cnae5"].dropna().unique())),
            "tsb_scn67_list": ";".join(sorted(group["scn67"].dropna().unique())),
            "tsb_setor_scn67_list": ";".join(sorted(group["setor_scn67"].dropna().unique())),
            "tsb_exposicao_scn67_max": top["exposicao_tsb_ratio"],
            "tsb_grupo_exposicao": top["grupo_exposicao"],
            "tsb_leitura_tecnica": top["leitura_tecnica"],
        }
    )


def build_cnae_bridge(cnae5: pd.DataFrame, scn67: pd.DataFrame, dim_cnae: pd.DataFrame) -> pd.DataFrame:
    cnae5 = cnae5.copy()
    cnae5["cnae5"] = normalize_code(cnae5["cnae5"], 5)
    if "cnae_class" not in cnae5.columns:
        cnae5["cnae_class"] = cnae5["cnae5"].str[:4]
    tsb = cnae5.merge(
        scn67[["scn67", "exposicao_tsb_ratio", "grupo_exposicao", "leitura_tecnica", "exposure_rank"]],
        on="scn67",
        how="left",
        validate="many_to_one",
    )
    associated = tsb.groupby("cnae_class", as_index=False).apply(choose_exposure, include_groups=False).reset_index(drop=True)
    cnae = dim_cnae.copy()
    cnae["cnae_class"] = normalize_code(cnae["cnae_class"], 4)
    cnae = cnae.merge(associated, on="cnae_class", how="left", validate="one_to_one")
    cnae["tsb_associated"] = cnae["tsb_associated"].fillna(False).astype(bool)
    cnae["tsb_cnae5_count"] = cnae["tsb_cnae5_count"].fillna(0).astype(int)
    cnae["tsb_grupo_exposicao"] = cnae["tsb_grupo_exposicao"].fillna("Sem exposicao TSB direta")
    cnae["tsb_exposicao_scn67_max"] = cnae["tsb_exposicao_scn67_max"].fillna(0.0)
    return cnae.sort_values("cnae_class", kind="stable")


def build_ncm_bridge(bridge: pd.DataFrame, cnae_bridge: pd.DataFrame) -> pd.DataFrame:
    merged = bridge.merge(
        cnae_bridge[
            [
                "cnae_class",
                "tsb_associated",
                "tsb_cnae5_count",
                "tsb_cnae5_list",
                "tsb_scn67_list",
                "tsb_exposicao_scn67_max",
                "tsb_grupo_exposicao",
            ]
        ],
        on="cnae_class",
        how="left",
        validate="many_to_one",
    )
    merged["tsb_associated"] = merged["tsb_associated"].fillna(False).astype(bool)
    merged["tsb_exposicao_scn67_max"] = merged["tsb_exposicao_scn67_max"].fillna(0.0)
    merged["exposure_rank"] = merged["tsb_grupo_exposicao"].map(EXPOSURE_ORDER).fillna(0).astype(int)

    def summarize(group: pd.DataFrame) -> pd.Series:
        ranked = group.sort_values(
            ["exposure_rank", "tsb_exposicao_scn67_max", "cnae_class", "prodlist_code"],
            ascending=[False, False, True, True],
            kind="stable",
        )
        top = ranked.iloc[0]
        return pd.Series(
            {
                "tsb_associated": bool(group["tsb_associated"].any()),
                "tsb_grupo_exposicao": top["tsb_grupo_exposicao"],
                "tsb_exposicao_scn67_max": top["tsb_exposicao_scn67_max"],
                "cnae_class_list": ";".join(sorted(group["cnae_class"].dropna().unique())),
                "prodlist_code_list": ";".join(sorted(group["prodlist_code"].dropna().unique())),
                "tsb_cnae5_list": ";".join(sorted(set(";".join(group["tsb_cnae5_list"].dropna()).split(";")) - {""})),
                "tsb_scn67_list": ";".join(sorted(set(";".join(group["tsb_scn67_list"].dropna()).split(";")) - {""})),
            }
        )

    return (
        merged.groupby("ncm", as_index=False)
        .apply(summarize, include_groups=False)
        .reset_index(drop=True)
        .sort_values("ncm", kind="stable")
    )


def build_rais_outputs(employment: pd.DataFrame, cnae_bridge: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    rais = employment.merge(
        cnae_bridge[
            [
                "cnae_class",
                "tsb_associated",
                "tsb_grupo_exposicao",
                "tsb_exposicao_scn67_max",
                "tsb_cnae5_list",
                "tsb_scn67_list",
            ]
        ],
        on="cnae_class",
        how="left",
        validate="many_to_one",
    )
    rais["tsb_associated"] = rais["tsb_associated"].fillna(False).astype(bool)
    rais["tsb_grupo_exposicao"] = rais["tsb_grupo_exposicao"].fillna("Sem exposicao TSB direta")
    rais["tsb_exposicao_scn67_max"] = rais["tsb_exposicao_scn67_max"].fillna(0.0)

    cnae_cols = ["year", "cnae_class", "tsb_associated", "tsb_grupo_exposicao", "tsb_exposicao_scn67_max"]
    rais_cnae = (
        rais.groupby(cnae_cols, dropna=False, as_index=False)
        .agg(
            formal_jobs=("formal_jobs", "sum"),
            wage_mass=("wage_mass", "sum"),
            december_wage_mass=("december_wage_mass", "sum"),
        )
        .sort_values(["tsb_associated", "formal_jobs", "cnae_class"], ascending=[False, False, True], kind="stable")
    )

    territory_cols = ["year", "uf", "municipality_code", "tsb_associated", "tsb_grupo_exposicao"]
    rais_territory = (
        rais.groupby(territory_cols, dropna=False, as_index=False)
        .agg(
            formal_jobs=("formal_jobs", "sum"),
            wage_mass=("wage_mass", "sum"),
            cnae_count=("cnae_class", "nunique"),
        )
        .sort_values(["tsb_associated", "formal_jobs"], ascending=[False, False], kind="stable")
    )

    summary = (
        rais.groupby(["year", "tsb_associated", "tsb_grupo_exposicao"], dropna=False, as_index=False)
        .agg(
            formal_jobs=("formal_jobs", "sum"),
            wage_mass=("wage_mass", "sum"),
            cnae_count=("cnae_class", "nunique"),
            municipality_count=("municipality_code", "nunique"),
        )
        .sort_values(["year", "tsb_associated", "formal_jobs"], ascending=[True, False, False], kind="stable")
    )
    return rais_cnae, rais_territory, summary


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    cnae5, scn67 = load_tsb_dimensions()
    dim_cnae = pd.read_csv(OFFICIAL_RAIS / "dim_cnae.csv", dtype={"cnae_class": "string"})
    bridge = pd.read_csv(
        OFFICIAL_RAIS / "bridge_ncm_prodlist_cnae.csv",
        dtype={"ncm": "string", "prodlist_code": "string", "cnae_class": "string"},
    )
    employment = pd.read_csv(
        OFFICIAL_RAIS / "fact_employment_rais.csv",
        dtype={"cnae_class": "string", "uf": "string", "municipality_code": "string"},
    )

    cnae_bridge = build_cnae_bridge(cnae5, scn67, dim_cnae)
    ncm_bridge = build_ncm_bridge(bridge, cnae_bridge)
    rais_cnae, rais_territory, rais_summary = build_rais_outputs(employment, cnae_bridge)

    cnae_bridge.to_csv(OUT / "bridge_tsb_cnae_class.csv", index=False, encoding="utf-8-sig")
    ncm_bridge.to_csv(OUT / "bridge_tsb_ncm.csv", index=False, encoding="utf-8-sig")
    rais_cnae.to_csv(OUT / "rais_tsb_employment_cnae.csv", index=False, encoding="utf-8-sig")
    rais_territory.to_csv(OUT / "rais_tsb_employment_territory.csv", index=False, encoding="utf-8-sig")
    rais_summary.to_csv(OUT / "rais_tsb_employment_summary.csv", index=False, encoding="utf-8-sig")
    scn67.to_csv(OUT / "scn67_tsb_exposure.csv", index=False, encoding="utf-8-sig")

    final_cnae = FINAL / "border_value_indicadores_finais_cnae.csv"
    if final_cnae.exists():
        indicators = pd.read_csv(final_cnae, dtype={"cnae_class": "string"})
        enriched = indicators.merge(
            cnae_bridge.drop(columns=["cnae_key"], errors="ignore"),
            on="cnae_class",
            how="left",
            validate="one_to_one",
        )
        enriched = add_tsb_platform_alignment_score(enriched, rais_cnae)
        enriched.to_csv(OUT / "border_value_indicadores_finais_cnae_tsb.csv", index=False, encoding="utf-8-sig")

    print(f"wrote TSB bridge outputs to {OUT}")


if __name__ == "__main__":
    main()
