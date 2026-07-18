from __future__ import annotations

from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
NIB_DIR = BASE_DIR / "dados" / "nib"
OFFICIAL_RAIS = BASE_DIR / "outputs" / "official_2026_rais"
FINAL = BASE_DIR / "outputs" / "final_border_value_2026"
OUT = BASE_DIR / "outputs" / "nib_territorializacao_2026"


def normalize_code(series: pd.Series, width: int) -> pd.Series:
    return series.astype("string").str.replace(r"\D", "", regex=True).str.zfill(width).str[:width]


def percent_rank(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce").fillna(0)
    if numeric.nunique(dropna=True) <= 1:
        return pd.Series(0.0, index=series.index)
    return numeric.rank(pct=True, method="average")


def join_unique(values: pd.Series) -> str:
    return ";".join(sorted({str(value) for value in values.dropna() if str(value).strip()}))


def load_nib_bridge() -> pd.DataFrame:
    bridge = pd.read_csv(NIB_DIR / "dim_nib_cadeias_cnae.csv", dtype="string")
    bridge["cnae_class"] = normalize_code(bridge["cnae_class"], 4)
    bridge["nib_chain_id"] = bridge["missao_nib"].astype("string") + " " + bridge["cadeia_nib"].astype("string")
    return bridge.drop_duplicates(["nib_chain_id", "cnae_class"]).sort_values(
        ["missao_nib", "cadeia_nib", "cnae_class"], kind="stable"
    )


def build_cnae_bridge(nib: pd.DataFrame, dim_cnae: pd.DataFrame) -> pd.DataFrame:
    cnae = dim_cnae.copy()
    cnae["cnae_class"] = normalize_code(cnae["cnae_class"], 4)
    mapped = nib.groupby("cnae_class", as_index=False).agg(
        nib_associated=("nib_chain_id", lambda x: True),
        nib_mission_list=("missao_nib", join_unique),
        nib_chain_id_list=("nib_chain_id", join_unique),
        nib_chain_name_list=("cadeia_nome", join_unique),
        nib_mapping_status_list=("nib_mapping_status", join_unique),
        nib_source_note_list=("source_note", join_unique),
        nib_chain_count=("nib_chain_id", "nunique"),
    )
    result = cnae.merge(mapped, on="cnae_class", how="left", validate="one_to_one")
    result["nib_associated"] = result["nib_associated"].fillna(False).astype(bool)
    result["nib_chain_count"] = result["nib_chain_count"].fillna(0).astype(int)
    for column in [
        "nib_mission_list",
        "nib_chain_id_list",
        "nib_chain_name_list",
        "nib_mapping_status_list",
        "nib_source_note_list",
    ]:
        result[column] = result[column].fillna("")
    return result.sort_values("cnae_class", kind="stable")


def build_ncm_bridge(official_bridge: pd.DataFrame, cnae_bridge: pd.DataFrame) -> pd.DataFrame:
    merged = official_bridge.merge(
        cnae_bridge[
            [
                "cnae_class",
                "nib_associated",
                "nib_chain_count",
                "nib_mission_list",
                "nib_chain_id_list",
                "nib_chain_name_list",
                "nib_mapping_status_list",
            ]
        ],
        on="cnae_class",
        how="left",
        validate="many_to_one",
    )
    merged["nib_associated"] = merged["nib_associated"].fillna(False).astype(bool)
    merged["nib_chain_count"] = merged["nib_chain_count"].fillna(0).astype(int)
    return (
        merged.groupby("ncm", as_index=False)
        .agg(
            nib_associated=("nib_associated", "any"),
            nib_chain_count=("nib_chain_count", "sum"),
            nib_mission_list=("nib_mission_list", join_unique),
            nib_chain_id_list=("nib_chain_id_list", join_unique),
            nib_chain_name_list=("nib_chain_name_list", join_unique),
            cnae_class_list=("cnae_class", join_unique),
            prodlist_code_list=("prodlist_code", join_unique),
        )
        .sort_values("ncm", kind="stable")
    )


def territory_typology(row: pd.Series) -> str:
    if bool(row["is_top100_industrial_city"]):
        return "regiao_industrial_madura"
    if float(row["chain_municipality_rank"]) <= 15:
        return "polo_relevante_da_cadeia"
    return "territorio_emergente_ou_disperso"


def build_rais_outputs(
    employment_territory: pd.DataFrame,
    nib: pd.DataFrame,
    indicators: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    employment = employment_territory.copy()
    employment["cnae_class"] = normalize_code(employment["cnae_class"], 4)
    employment["formal_jobs"] = pd.to_numeric(employment["formal_jobs"], errors="coerce").fillna(0)
    employment["wage_mass"] = pd.to_numeric(employment["wage_mass"], errors="coerce").fillna(0)

    manufacturing = employment[employment["cnae_class"].between("1000", "3399")].copy()
    top100 = (
        manufacturing.groupby(["year", "uf", "municipality_code", "municipality_name"], as_index=False)
        .agg(total_manufacturing_jobs=("formal_jobs", "sum"))
        .sort_values(["year", "total_manufacturing_jobs"], ascending=[True, False], kind="stable")
    )
    top100["industrial_city_rank"] = top100.groupby("year")["total_manufacturing_jobs"].rank(
        method="first", ascending=False
    )
    top100["is_top100_industrial_city"] = top100["industrial_city_rank"].le(100)

    rais_nib = employment.merge(
        nib[
            [
                "missao_nib",
                "cadeia_nib",
                "nib_chain_id",
                "cadeia_nome",
                "cnae_class",
                "nib_mapping_status",
            ]
        ],
        on="cnae_class",
        how="inner",
        validate="many_to_many",
    )
    indicator_columns = [
        "cnae_class",
        "trade_value_usd",
        "import_value_usd",
        "export_value_usd",
        "external_dependency_ratio",
        "priority_score",
        "priority_tier",
    ]
    rais_nib = rais_nib.merge(
        indicators[indicator_columns],
        on="cnae_class",
        how="left",
        validate="many_to_one",
    )
    rais_nib = rais_nib.merge(
        top100[
            [
                "year",
                "uf",
                "municipality_code",
                "total_manufacturing_jobs",
                "industrial_city_rank",
                "is_top100_industrial_city",
            ]
        ],
        on=["year", "uf", "municipality_code"],
        how="left",
        validate="many_to_one",
    )
    rais_nib["is_top100_industrial_city"] = rais_nib["is_top100_industrial_city"].fillna(False).astype(bool)

    cnae_cols = [
        "year",
        "missao_nib",
        "cadeia_nib",
        "nib_chain_id",
        "cadeia_nome",
        "cnae_class",
        "nib_mapping_status",
    ]
    rais_cnae = (
        rais_nib.groupby(cnae_cols, dropna=False, as_index=False)
        .agg(
            formal_jobs=("formal_jobs", "sum"),
            wage_mass=("wage_mass", "sum"),
            municipality_count=("municipality_code", "nunique"),
            trade_value_usd=("trade_value_usd", "max"),
            import_value_usd=("import_value_usd", "max"),
            export_value_usd=("export_value_usd", "max"),
            external_dependency_ratio=("external_dependency_ratio", "max"),
            priority_score=("priority_score", "max"),
            priority_tier=("priority_tier", "first"),
        )
        .sort_values(["formal_jobs", "trade_value_usd"], ascending=[False, False], kind="stable")
    )

    territory_cols = [
        "year",
        "region_name",
        "uf",
        "uf_name",
        "municipality_code",
        "municipality_name",
        "missao_nib",
        "cadeia_nib",
        "nib_chain_id",
        "cadeia_nome",
    ]
    rais_territory = (
        rais_nib.groupby(territory_cols, dropna=False, as_index=False)
        .agg(
            formal_jobs=("formal_jobs", "sum"),
            wage_mass=("wage_mass", "sum"),
            cnae_count=("cnae_class", "nunique"),
            cnae_class_list=("cnae_class", join_unique),
            cnae_reference_trade_value_usd=("trade_value_usd", "sum"),
            cnae_reference_import_value_usd=("import_value_usd", "sum"),
            cnae_reference_export_value_usd=("export_value_usd", "sum"),
            priority_score_max=("priority_score", "max"),
            total_manufacturing_jobs=("total_manufacturing_jobs", "max"),
            industrial_city_rank=("industrial_city_rank", "min"),
            is_top100_industrial_city=("is_top100_industrial_city", "max"),
        )
        .sort_values(["formal_jobs", "cnae_reference_trade_value_usd"], ascending=[False, False], kind="stable")
    )
    rais_territory["chain_municipality_rank"] = rais_territory.groupby(
        ["year", "nib_chain_id"]
    )["formal_jobs"].rank(method="first", ascending=False)
    rais_territory["territorial_typology"] = rais_territory.apply(territory_typology, axis=1)

    summary_jobs = (
        rais_territory.groupby(["year", "missao_nib", "cadeia_nib", "nib_chain_id", "cadeia_nome"], as_index=False)
        .agg(
            formal_jobs=("formal_jobs", "sum"),
            wage_mass=("wage_mass", "sum"),
            municipality_count=("municipality_code", "nunique"),
            mature_city_count=("is_top100_industrial_city", "sum"),
            priority_score_max=("priority_score_max", "max"),
        )
    )
    summary_trade = (
        rais_cnae.groupby(["year", "missao_nib", "cadeia_nib", "nib_chain_id", "cadeia_nome"], as_index=False)
        .agg(
            cnae_reference_trade_value_usd=("trade_value_usd", "sum"),
            cnae_reference_import_value_usd=("import_value_usd", "sum"),
            cnae_reference_export_value_usd=("export_value_usd", "sum"),
        )
    )
    summary = summary_jobs.merge(
        summary_trade,
        on=["year", "missao_nib", "cadeia_nib", "nib_chain_id", "cadeia_nome"],
        how="left",
        validate="one_to_one",
    ).sort_values(["formal_jobs", "cnae_reference_trade_value_usd"], ascending=[False, False], kind="stable")
    summary["rais_scale_score"] = percent_rank(summary["formal_jobs"])
    summary["border_value_trade_score"] = percent_rank(summary["cnae_reference_trade_value_usd"])
    summary["nib_territorial_priority_score"] = (
        0.45 * summary["rais_scale_score"]
        + 0.35 * summary["border_value_trade_score"]
        + 0.20 * pd.to_numeric(summary["priority_score_max"], errors="coerce").fillna(0)
    ).round(4)

    top100_public = top100.loc[top100["is_top100_industrial_city"]].copy()
    return rais_cnae, rais_territory, summary, top100_public


def write_methodology_note() -> None:
    note = """# Territorializacao das cadeias prioritarias NIB

Esta camada incorpora uma leitura metodologica inspirada no mapeamento do DIEESE
de julho de 2025 sobre cadeias produtivas prioritarias da Nova Industria Brasil
nos territorios. O objetivo e cruzar a base Border Value com uma ponte editavel
CNAE-cadeia NIB e com a RAIS territorial, permitindo identificar municipios e
cadeias com base produtiva formal.

## Como interpretar

- A ponte `dados/nib/dim_nib_cadeias_cnae.csv` e uma semente de trabalho para
  validacao especialista. Ela nao substitui a correspondencia oficial
  NCM-PRODLIST-CONCLA/IBGE.
- A classificacao territorial usa a RAIS 2024 disponivel no pipeline. Municipios
  entre os 100 maiores por emprego na industria de transformacao sao marcados
  como `regiao_industrial_madura`, em dialogo com o criterio do DIEESE.
- Municipios fora do top 100, mas entre os 15 maiores empregadores de uma cadeia
  NIB especifica, sao marcados como `polo_relevante_da_cadeia`.
- Os demais municipios com emprego formal nas CNAEs mapeadas sao marcados como
  `territorio_emergente_ou_disperso`.

## Limites

As cadeias NIB podem conter servicos, elos a montante, tecnologias, rotas de
producao e produtos que nao sao identificaveis apenas por CNAE ou NCM. Portanto,
os resultados devem ser lidos como triagem territorial para politica industrial,
nao como inventario completo de cada cadeia.
"""
    (OUT / "metodologia_territorializacao_nib.md").write_text(note, encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    nib = load_nib_bridge()
    dim_cnae = pd.read_csv(OFFICIAL_RAIS / "dim_cnae.csv", dtype={"cnae_class": "string"})
    official_bridge = pd.read_csv(
        OFFICIAL_RAIS / "bridge_ncm_prodlist_cnae.csv",
        dtype={"ncm": "string", "prodlist_code": "string", "cnae_class": "string"},
    )
    employment_territory = pd.read_csv(
        OFFICIAL_RAIS / "employment_territory_cnae.csv",
        dtype={"cnae_class": "string", "uf": "string", "municipality_code": "string"},
    )
    indicators = pd.read_csv(FINAL / "border_value_indicadores_finais_cnae.csv", dtype={"cnae_class": "string"})

    cnae_bridge = build_cnae_bridge(nib, dim_cnae)
    ncm_bridge = build_ncm_bridge(official_bridge, cnae_bridge)
    rais_cnae, rais_territory, summary, top100 = build_rais_outputs(employment_territory, nib, indicators)

    nib.to_csv(OUT / "dim_nib_cadeias_cnae.csv", index=False, encoding="utf-8-sig")
    cnae_bridge.to_csv(OUT / "bridge_nib_cnae_class.csv", index=False, encoding="utf-8-sig")
    ncm_bridge.to_csv(OUT / "bridge_nib_ncm.csv", index=False, encoding="utf-8-sig")
    rais_cnae.to_csv(OUT / "rais_nib_employment_cnae.csv", index=False, encoding="utf-8-sig")
    rais_territory.to_csv(OUT / "rais_nib_employment_territory.csv", index=False, encoding="utf-8-sig")
    summary.to_csv(OUT / "resumo_cadeias_nib_territorio.csv", index=False, encoding="utf-8-sig")
    top100.to_csv(OUT / "top100_municipios_industria_transformacao_rais.csv", index=False, encoding="utf-8-sig")
    write_methodology_note()

    print(f"wrote NIB territorializacao outputs to {OUT}")


if __name__ == "__main__":
    main()
