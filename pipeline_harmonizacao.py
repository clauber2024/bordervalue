"""Pipeline de harmonização Comex Stat -> NCM -> Prodlist -> CNAE.

Princípios implementados:

1. A granularidade fiscal do comércio exterior é sempre a NCM de 8 dígitos.
2. A CNAE é obtida exclusivamente pela ponte NCM -> Prodlist Indústria e pelos
   quatro primeiros dígitos numéricos do código Prodlist.
3. NCMs terminadas em 9, 90 ou 99 são sinalizadas para auditoria humana.
4. Dimensões e pontes são construídas antes de qualquer tabela fato.

O módulo não tenta resolver lacunas de correspondência com IA generativa.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

import pandas as pd


LOGGER = logging.getLogger(__name__)


class PipelineValidationError(ValueError):
    """Indica uma violação de contrato ou de regra de negócio do pipeline."""


@dataclass(frozen=True)
class ColumnConfig:
    """Mapeamento dos nomes físicos das colunas de entrada."""

    trade_ncm: str = "ncm"
    mapping_ncm: str = "ncm"
    mapping_prodlist: str = "prodlist_code"
    production_cnae: str = "cnae_class"


@dataclass(frozen=True)
class RelationalModel:
    """Tabelas do modelo, separadas entre estrutura qualitativa e fatos."""

    dim_ncm: pd.DataFrame
    dim_prodlist: pd.DataFrame
    dim_cnae: pd.DataFrame
    bridge_ncm_prodlist_cnae: pd.DataFrame
    fact_trade: pd.DataFrame
    fact_production: pd.DataFrame


EQUAL_ALLOCATION_RULE = "equal_share_distinct_cnae"
PRODUCTION_VALUE_ALLOCATION_RULE = "production_value_weighted_cnae"


def _require_columns(df: pd.DataFrame, columns: Iterable[str], table: str) -> None:
    missing = sorted(set(columns).difference(df.columns))
    if missing:
        raise PipelineValidationError(
            f"Tabela {table!r} não contém as colunas obrigatórias: {missing}."
        )


def _normalize_digit_code(
    series: pd.Series,
    *,
    width: int,
    field_name: str,
    exact_width: bool = True,
) -> pd.Series:
    """Normaliza códigos sem converter para número e sem perder zeros à esquerda.

    Pontuação comum em arquivos de referência é removida. Valores originalmente
    numéricos são aceitos e completados à esquerda. Códigos textuais com tamanho
    incorreto são rejeitados, pois completá-los poderia inventar uma classificação.
    """

    if series.isna().any():
        rows = series.index[series.isna()].tolist()[:10]
        raise PipelineValidationError(
            f"{field_name} possui valores nulos; primeiras linhas: {rows}."
        )

    raw = series.astype("string").str.strip()
    # Remove o sufixo criado por planilhas apenas de números como 1234567.0.
    # Em códigos pontuados legítimos (por exemplo, NCM 2701.19.00), o ".00"
    # faz parte do código e não pode ser descartado.
    spreadsheet_number = raw.str.fullmatch(r"[0-9]+\.0+")
    raw = raw.where(~spreadsheet_number, raw.str.replace(r"\.0+$", "", regex=True))
    normalized = raw.str.replace(r"[^0-9]", "", regex=True)

    empty = normalized.eq("")
    if empty.any():
        rows = series.index[empty].tolist()[:10]
        raise PipelineValidationError(
            f"{field_name} possui códigos sem dígitos; primeiras linhas: {rows}."
        )

    # Planilhas frequentemente inferem NCM como inteiro e removem zero inicial.
    numeric_input = raw.str.fullmatch(r"[0-9]+")
    can_pad = numeric_input & normalized.str.len().le(width)
    normalized = normalized.where(~can_pad, normalized.str.zfill(width))

    invalid = normalized.str.len().ne(width) if exact_width else normalized.str.len().lt(width)
    if invalid.any():
        examples = raw[invalid].drop_duplicates().head(10).tolist()
        comparator = "exatamente" if exact_width else "ao menos"
        raise PipelineValidationError(
            f"{field_name} deve ter {comparator} {width} dígitos; exemplos inválidos: "
            f"{examples}."
        )

    return normalized.astype("string")


def normalize_ncm(series: pd.Series, *, field_name: str = "NCM") -> pd.Series:
    """Retorna NCM canônica com exatamente oito dígitos."""

    return _normalize_digit_code(
        series, width=8, field_name=field_name, exact_width=True
    )


def normalize_cnae_class(
    series: pd.Series, *, field_name: str = "classe CNAE"
) -> pd.Series:
    """Retorna a classe CNAE canônica com quatro dígitos."""

    return _normalize_digit_code(
        series, width=4, field_name=field_name, exact_width=True
    )


def flag_generic_ncm(
    df: pd.DataFrame,
    *,
    ncm_col: str = "ncm",
    logger: logging.Logger = LOGGER,
) -> pd.DataFrame:
    """Adiciona ``is_generic_code`` e registra aviso para auditoria CONCLA.

    A regra explicita os três sufixos aprovados (9, 90 e 99), mesmo havendo
    sobreposição lógica entre 9 e 99.
    """

    _require_columns(df, [ncm_col], "NCM")
    result = df.copy()
    result[ncm_col] = normalize_ncm(result[ncm_col], field_name=ncm_col)
    result["is_generic_code"] = result[ncm_col].str.endswith(("9", "90", "99"))

    contaminated = result.loc[result["is_generic_code"], ncm_col].drop_duplicates()
    if not contaminated.empty:
        logger.warning(
            "%d código(s) NCM com final 9/90/99 exigem auditoria qualitativa "
            "manual na base de Subclasses do CONCLA (IBGE). Não utilizar IA "
            "generativa para inferir correspondências fiscais. Amostra: %s",
            len(contaminated),
            contaminated.head(10).tolist(),
        )

    return result


def build_ncm_prodlist_cnae_crosswalk(
    ncm_reference: pd.DataFrame,
    ncm_prodlist: pd.DataFrame,
    domestic_production: pd.DataFrame,
    *,
    columns: ColumnConfig = ColumnConfig(),
    logger: logging.Logger = LOGGER,
) -> pd.DataFrame:
    """Constrói a relação qualitativa NCM -> Prodlist -> CNAE.

    O primeiro ``merge`` é NCM com o De-Para da Prodlist. A classe CNAE é então
    derivada dos quatro primeiros dígitos do código Prodlist e validada por um
    relacionamento exato com as classes presentes na produção doméstica.

    A saída contém relações únicas e indicadores de cobertura. NCMs sem Prodlist
    e Prodlist sem CNAE doméstica são preservadas para permitir diagnóstico.
    """

    _require_columns(ncm_reference, [columns.trade_ncm], "referência NCM")
    _require_columns(
        ncm_prodlist,
        [columns.mapping_ncm, columns.mapping_prodlist],
        "De-Para NCM-Prodlist",
    )
    _require_columns(
        domestic_production, [columns.production_cnae], "produção doméstica"
    )

    year_aware = "year" in ncm_prodlist.columns
    if year_aware and "year" not in ncm_reference.columns:
        raise PipelineValidationError(
            "De-Para anual exige a coluna 'year' na referência NCM."
        )

    ncm_columns = [columns.trade_ncm, *( ["year"] if year_aware else [])]
    ncm = ncm_reference[ncm_columns].copy()
    ncm = ncm.rename(columns={columns.trade_ncm: "ncm"})
    ncm["ncm"] = normalize_ncm(ncm["ncm"])
    ncm = ncm.drop_duplicates()

    mapping_columns = [
        columns.mapping_ncm,
        columns.mapping_prodlist,
        *( ["year"] if year_aware else []),
    ]
    mapping = ncm_prodlist[mapping_columns].copy()
    mapping = mapping.rename(
        columns={columns.mapping_ncm: "ncm", columns.mapping_prodlist: "prodlist_code"}
    )
    mapping["ncm"] = normalize_ncm(mapping["ncm"], field_name=columns.mapping_ncm)
    if mapping["prodlist_code"].isna().any():
        raise PipelineValidationError("O De-Para contém código Prodlist nulo.")
    mapping["prodlist_code"] = mapping["prodlist_code"].astype("string").str.strip()
    mapping["prodlist_digits"] = mapping["prodlist_code"].str.replace(
        r"[^0-9]", "", regex=True
    )
    invalid_prodlist = mapping["prodlist_digits"].str.len().lt(4)
    if invalid_prodlist.any():
        examples = mapping.loc[invalid_prodlist, "prodlist_code"].head(10).tolist()
        raise PipelineValidationError(
            "Código Prodlist precisa conter ao menos quatro dígitos; "
            f"exemplos inválidos: {examples}."
        )

    # Regra metodológica: os quatro primeiros dígitos são a classe CNAE exata.
    mapping["cnae_class"] = mapping["prodlist_digits"].str[:4]
    mapping = mapping.drop(columns="prodlist_digits").drop_duplicates()

    cnae_year_aware = year_aware and "year" in domestic_production.columns
    cnae_columns = [
        columns.production_cnae,
        *( ["year"] if cnae_year_aware else []),
    ]
    cnae = domestic_production[cnae_columns].copy()
    cnae = cnae.rename(columns={columns.production_cnae: "cnae_class"})
    cnae["cnae_class"] = normalize_cnae_class(cnae["cnae_class"])
    cnae = cnae.drop_duplicates().assign(has_domestic_production=True)

    mapping_keys = ["ncm", *( ["year"] if year_aware else [])]
    cnae_keys = ["cnae_class", *( ["year"] if cnae_year_aware else [])]
    crosswalk = ncm.merge(
        mapping, on=mapping_keys, how="left", validate="one_to_many"
    )
    crosswalk = crosswalk.merge(
        cnae, on=cnae_keys, how="left", validate="many_to_one"
    )
    crosswalk["has_prodlist_match"] = crosswalk["prodlist_code"].notna()
    crosswalk["has_cnae_match"] = (
        crosswalk["has_domestic_production"].fillna(False).astype(bool)
    )
    crosswalk = crosswalk.drop(columns="has_domestic_production")
    crosswalk = flag_generic_ncm(crosswalk, logger=logger)

    missing_prodlist = crosswalk.loc[~crosswalk["has_prodlist_match"], "ncm"].nunique()
    missing_cnae = crosswalk.loc[
        crosswalk["has_prodlist_match"] & ~crosswalk["has_cnae_match"],
        "prodlist_code",
    ].nunique()
    if missing_prodlist:
        logger.warning("%d NCM(s) sem correspondência na Prodlist.", missing_prodlist)
    if missing_cnae:
        logger.warning(
            "%d código(s) Prodlist derivaram classe CNAE ausente da produção doméstica.",
            missing_cnae,
        )

    return crosswalk.drop_duplicates().reset_index(drop=True)


def aggregate_trade_by_ncm(
    trade: pd.DataFrame,
    *,
    ncm_col: str = "ncm",
    measure_cols: Sequence[str] = ("value_usd", "net_weight_kg"),
    grain_cols: Sequence[str] = (),
) -> pd.DataFrame:
    """Agrega comércio usando NCM-8, nunca HS6, como chave de produto.

    ``grain_cols`` pode conter dimensões como ano, fluxo, país parceiro ou UF.
    Incluir ``hs6`` nesse parâmetro é uma violação explícita da nova regra.
    """

    forbidden = {column for column in grain_cols if column.lower() == "hs6"}
    if forbidden:
        raise PipelineValidationError(
            "HS6 não pode compor a chave de agrupamento do comércio brasileiro; "
            "use NCM de oito dígitos."
        )

    required = [ncm_col, *grain_cols, *measure_cols]
    _require_columns(trade, required, "Comex Stat")
    result = trade[required].copy()
    result[ncm_col] = normalize_ncm(result[ncm_col], field_name=ncm_col)

    for measure in measure_cols:
        result[measure] = pd.to_numeric(result[measure], errors="coerce")
        invalid = result[measure].isna() & trade[measure].notna()
        if invalid.any():
            examples = trade.loc[invalid, measure].head(10).tolist()
            raise PipelineValidationError(
                f"Medida {measure!r} contém valores não numéricos: {examples}."
            )

    group_key = [*grain_cols, ncm_col]
    return (
        result.groupby(group_key, as_index=False, dropna=False)[list(measure_cols)]
        .sum(min_count=1)
        .reset_index(drop=True)
    )


def allocate_trade_to_cnae(
    fact_trade: pd.DataFrame,
    bridge_ncm_prodlist_cnae: pd.DataFrame,
    *,
    measure_cols: Sequence[str] = ("value_usd", "net_weight_kg"),
    grain_cols: Sequence[str] = (),
) -> pd.DataFrame:
    """Rateia comércio NCM 1:N antes de agregar resultados por CNAE.

    Os pesos vêm da ponte NCM-Prodlist-CNAE. A regra preferencial usa valor de
    produção PIA por CNAE; quando essa base não é completa e positiva, a ponte
    registra fallback igualitário. NCMs sem CNAE correspondente ficam fora do
    resultado e continuam visíveis no fato de comércio para tratamento explícito
    de cobertura.
    """

    year_aware = "year" in bridge_ncm_prodlist_cnae.columns
    if year_aware and "year" not in fact_trade.columns:
        raise PipelineValidationError(
            "Ponte anual exige a coluna 'year' no fato de comércio."
        )
    required_fact = list(dict.fromkeys(["ncm_key", *grain_cols, *measure_cols, *( ["year"] if year_aware else [])]))
    required_bridge = ["ncm_key", "cnae_key", "cnae_class", "allocation_weight", *( ["year"] if year_aware else [])]
    _require_columns(fact_trade, required_fact, "fato de comércio")
    _require_columns(bridge_ncm_prodlist_cnae, required_bridge, "ponte NCM-CNAE")

    bridge_keys = ["ncm_key", *( ["year"] if year_aware else [])]
    weight_sums = bridge_ncm_prodlist_cnae.groupby(bridge_keys)[
        "allocation_weight"
    ].sum()
    if not weight_sums.empty and not weight_sums.sub(1.0).abs().le(1e-12).all():
        raise PipelineValidationError(
            "Os pesos de rateio devem somar 1 por NCM e ano, quando aplicável."
        )

    allocated = fact_trade[required_fact].merge(
        bridge_ncm_prodlist_cnae[required_bridge],
        on=bridge_keys,
        how="inner",
        validate="many_to_many",
    )
    for measure in measure_cols:
        allocated[measure] = allocated[measure] * allocated["allocation_weight"]

    group_key = list(dict.fromkeys([*grain_cols, *( ["year"] if year_aware else []), "cnae_key", "cnae_class"]))
    return (
        allocated.groupby(group_key, as_index=False, dropna=False)[list(measure_cols)]
        .sum(min_count=1)
        .reset_index(drop=True)
    )


def _dimension_with_surrogate_key(
    frame: pd.DataFrame, natural_keys: Sequence[str], surrogate_key: str
) -> pd.DataFrame:
    dim = (
        frame.loc[:, list(natural_keys)]
        .dropna(subset=list(natural_keys))
        .drop_duplicates()
        .sort_values(list(natural_keys), kind="stable")
        .reset_index(drop=True)
    )
    dim.insert(0, surrogate_key, pd.RangeIndex(1, len(dim) + 1, dtype="int64"))
    return dim


def _production_value_basis_by_cnae(
    domestic_production: pd.DataFrame,
    *,
    columns: ColumnConfig,
    year_aware: bool,
) -> pd.DataFrame | None:
    """Retorna base economica observada por CNAE para ponderar o rateio."""

    value_column = None
    for candidate in ("production_value", "production_value_thousand_brl"):
        if candidate in domestic_production.columns:
            value_column = candidate
            break
    if value_column is None:
        return None

    basis_columns = [columns.production_cnae, value_column]
    has_status = "production_status" in domestic_production.columns
    if has_status:
        basis_columns.append("production_status")
    if year_aware and "year" in domestic_production.columns:
        basis_columns.append("year")

    basis = domestic_production[basis_columns].copy()
    basis = basis.rename(
        columns={columns.production_cnae: "cnae_class", value_column: "production_value"}
    )
    basis["cnae_class"] = normalize_cnae_class(basis["cnae_class"])
    basis["production_value"] = pd.to_numeric(
        basis["production_value"], errors="coerce"
    )
    group_key = ["cnae_class", *(["year"] if "year" in basis.columns else [])]
    observed_basis = (
        basis.loc[basis["production_value"].notna() & basis["production_value"].gt(0)]
        .groupby(group_key, as_index=False, dropna=False)["production_value"]
        .sum(min_count=1)
        .rename(columns={"production_value": "allocation_basis_value"})
    )
    if has_status:
        status_priority = {
            "confidential": 3,
            "not_available": 2,
            "missing": 1,
            "published": 0,
        }

        def summarize_status(values: pd.Series) -> str:
            statuses = values.astype("string").fillna("missing")
            return max(statuses, key=lambda item: status_priority.get(str(item), 1))

        status_basis = (
            basis.groupby(group_key, as_index=False, dropna=False)["production_status"]
            .agg(summarize_status)
            .rename(columns={"production_status": "allocation_basis_status"})
        )
        return status_basis.merge(observed_basis, on=group_key, how="left")

    if observed_basis.empty:
        return None
    observed_basis["allocation_basis_status"] = "published"
    return observed_basis


def _assign_allocation_weights(
    bridge: pd.DataFrame,
    domestic_production: pd.DataFrame,
    *,
    columns: ColumnConfig,
    year_aware: bool,
) -> pd.DataFrame:
    """Atribui peso por CNAE com base na PIA, preservando fallback igualitario."""

    result = bridge.copy()
    temporal_columns = ["year"] if year_aware else []
    allocation_keys = [*temporal_columns, "ncm_key"]
    cnae_keys = [*allocation_keys, "cnae_key"]

    cnae_share = result[cnae_keys + ["cnae_class"]].drop_duplicates().copy()
    cnae_share["allocation_rule"] = EQUAL_ALLOCATION_RULE
    cnae_share["cnae_allocation_weight"] = (
        1.0 / cnae_share.groupby(allocation_keys)["cnae_key"].transform("nunique")
    )

    basis = _production_value_basis_by_cnae(
        domestic_production, columns=columns, year_aware=year_aware
    )
    if basis is not None:
        basis_join_keys = ["cnae_class", *(["year"] if "year" in basis.columns else [])]
        weighted = cnae_share.merge(
            basis, on=basis_join_keys, how="left", validate="many_to_one"
        )
        weighted["allocation_basis_status"] = (
            weighted["allocation_basis_status"].astype("string").fillna("missing")
        )
        basis_sum = weighted.groupby(allocation_keys)[
            "allocation_basis_value"
        ].transform("sum")
        complete_basis = weighted.groupby(allocation_keys)[
            "allocation_basis_value"
        ].transform(lambda values: values.notna().all())
        use_weighted = complete_basis & basis_sum.gt(0)
        weighted.loc[use_weighted, "cnae_allocation_weight"] = (
            weighted.loc[use_weighted, "allocation_basis_value"]
            / basis_sum.loc[use_weighted]
        )
        weighted.loc[use_weighted, "allocation_rule"] = (
            PRODUCTION_VALUE_ALLOCATION_RULE
        )
        cnae_share = weighted.drop(columns="allocation_basis_value")
    else:
        cnae_share["allocation_basis_status"] = "missing"

    result = result.merge(
        cnae_share[
            cnae_keys
            + ["cnae_allocation_weight", "allocation_rule", "allocation_basis_status"]
        ],
        on=cnae_keys,
        how="left",
        validate="many_to_one",
    )
    prodlist_count_within_cnae = result.groupby(cnae_keys)["prodlist_key"].transform(
        "count"
    )
    result["allocation_weight"] = (
        result["cnae_allocation_weight"] / prodlist_count_within_cnae
    )
    return result.drop(columns="cnae_allocation_weight")


def build_relational_model(
    trade: pd.DataFrame,
    ncm_prodlist: pd.DataFrame,
    domestic_production: pd.DataFrame,
    *,
    columns: ColumnConfig = ColumnConfig(),
    trade_measure_cols: Sequence[str] = ("value_usd", "net_weight_kg"),
    trade_grain_cols: Sequence[str] = (),
    production_measure_cols: Sequence[str] = (),
    production_grain_cols: Sequence[str] = (),
    logger: logging.Logger = LOGGER,
) -> RelationalModel:
    """Monta primeiro dimensões/pontes e somente depois injeta os fatos.

    A tabela ponte evita multiplicar valores de comércio quando uma NCM possui
    mais de uma correspondência Prodlist. O fato de comércio referencia apenas
    ``dim_ncm``; análises por CNAE devem explicitar a regra de rateio em uma camada
    analítica posterior.
    """

    _require_columns(trade, [columns.trade_ncm], "Comex Stat")
    mapping_year_aware = "year" in ncm_prodlist.columns
    if mapping_year_aware and "year" not in trade.columns:
        raise PipelineValidationError(
            "De-Para anual exige a coluna 'year' no comércio."
        )
    trade_reference_columns = [
        columns.trade_ncm,
        *( ["year"] if mapping_year_aware else []),
    ]
    trade_ncm_reference = trade[trade_reference_columns].drop_duplicates()

    # FASE 1 — estrutura qualitativa completa, sem medidas quantitativas.
    crosswalk = build_ncm_prodlist_cnae_crosswalk(
        trade_ncm_reference,
        ncm_prodlist,
        domestic_production,
        columns=columns,
        logger=logger,
    )

    dim_ncm = _dimension_with_surrogate_key(crosswalk, ["ncm"], "ncm_key")
    generic_by_ncm = crosswalk.groupby("ncm", as_index=False)["is_generic_code"].max()
    dim_ncm = dim_ncm.merge(generic_by_ncm, on="ncm", how="left", validate="one_to_one")

    dim_prodlist = _dimension_with_surrogate_key(
        crosswalk, ["prodlist_code", "cnae_class"], "prodlist_key"
    )
    # A dimensão CNAE representa o universo da produção doméstica, inclusive
    # classes ainda não alcançadas pelo De-Para. Isso preserva fatos legítimos e
    # deixa a lacuna de correspondência visível, sem inventar vínculo fiscal.
    production_cnae_dimension = domestic_production[[columns.production_cnae]].copy()
    production_cnae_dimension[columns.production_cnae] = normalize_cnae_class(
        production_cnae_dimension[columns.production_cnae],
        field_name=columns.production_cnae,
    )
    production_cnae_dimension = production_cnae_dimension.rename(
        columns={columns.production_cnae: "cnae_class"}
    )
    cnae_universe = pd.concat(
        [crosswalk[["cnae_class"]], production_cnae_dimension], ignore_index=True
    )
    dim_cnae = _dimension_with_surrogate_key(
        cnae_universe, ["cnae_class"], "cnae_key"
    )

    temporal_columns = ["year"] if mapping_year_aware else []
    bridge = crosswalk.loc[
        crosswalk["has_prodlist_match"],
        [*temporal_columns, "ncm", "prodlist_code", "cnae_class"],
    ].drop_duplicates()
    bridge = bridge.merge(dim_ncm[["ncm_key", "ncm"]], on="ncm", validate="many_to_one")
    bridge = bridge.merge(
        dim_prodlist[["prodlist_key", "prodlist_code", "cnae_class"]],
        on=["prodlist_code", "cnae_class"],
        validate="many_to_one",
    )
    bridge = bridge.merge(
        dim_cnae[["cnae_key", "cnae_class"]], on="cnae_class", validate="many_to_one"
    )
    bridge = bridge[
        [*temporal_columns, "ncm_key", "prodlist_key", "cnae_key", "ncm", "prodlist_code", "cnae_class"]
    ].reset_index(drop=True)
    bridge = _assign_allocation_weights(
        bridge,
        domestic_production,
        columns=columns,
        year_aware=mapping_year_aware,
    )

    # FASE 2 — fatos quantitativos, executada somente após a estrutura existir.
    grouped_trade = aggregate_trade_by_ncm(
        trade,
        ncm_col=columns.trade_ncm,
        measure_cols=trade_measure_cols,
        grain_cols=trade_grain_cols,
    ).rename(columns={columns.trade_ncm: "ncm"})
    fact_trade = grouped_trade.merge(
        dim_ncm[["ncm_key", "ncm"]], on="ncm", how="left", validate="many_to_one"
    )
    if fact_trade["ncm_key"].isna().any():
        raise PipelineValidationError("Fato de comércio contém NCM fora da dimensão.")
    fact_trade["ncm_key"] = fact_trade["ncm_key"].astype("int64")

    production_required = [
        columns.production_cnae,
        *production_grain_cols,
        *production_measure_cols,
    ]
    _require_columns(domestic_production, production_required, "produção doméstica")
    production_attribute_cols = [
        column
        for column in ("production_status",)
        if column in domestic_production.columns and column not in production_required
    ]
    fact_production = domestic_production[
        [*production_required, *production_attribute_cols]
    ].copy()
    fact_production[columns.production_cnae] = normalize_cnae_class(
        fact_production[columns.production_cnae], field_name=columns.production_cnae
    )
    for measure in production_measure_cols:
        fact_production[measure] = pd.to_numeric(
            fact_production[measure], errors="raise"
        )
    production_group_key = [*production_grain_cols, columns.production_cnae]
    aggregated_status = None
    if "production_status" in fact_production.columns:
        status_priority = {
            "confidential": 3,
            "not_available": 2,
            "missing": 1,
            "published": 0,
        }

        def summarize_status(values: pd.Series) -> str:
            statuses = values.astype("string").fillna("missing")
            return max(statuses, key=lambda item: status_priority.get(str(item), 1))

        aggregated_status = (
            fact_production.groupby(production_group_key, as_index=False, dropna=False)[
                "production_status"
            ].agg(summarize_status)
        )
    if production_measure_cols:
        fact_production = fact_production.groupby(
            production_group_key, as_index=False, dropna=False
        )[list(production_measure_cols)].sum(min_count=1)
    else:
        fact_production = fact_production[production_group_key].drop_duplicates()
    if aggregated_status is not None and "production_status" not in production_group_key:
        fact_production = fact_production.merge(
            aggregated_status, on=production_group_key, how="left", validate="one_to_one"
        )
    fact_production = fact_production.rename(
        columns={columns.production_cnae: "cnae_class"}
    ).merge(dim_cnae, on="cnae_class", how="left", validate="many_to_one")

    if fact_production["cnae_key"].isna().any():
        raise PipelineValidationError(
            "Fato de produção contém CNAE fora da dimensão; a carga estrutural "
            "não foi concluída corretamente."
        )
    fact_production["cnae_key"] = fact_production["cnae_key"].astype("int64")

    return RelationalModel(
        dim_ncm=dim_ncm,
        dim_prodlist=dim_prodlist,
        dim_cnae=dim_cnae,
        bridge_ncm_prodlist_cnae=bridge,
        fact_trade=fact_trade,
        fact_production=fact_production,
    )


def tables_as_mapping(model: RelationalModel) -> Mapping[str, pd.DataFrame]:
    """Expõe a ordem segura de carga: dimensões, ponte e, por último, fatos."""

    return {
        "dim_ncm": model.dim_ncm,
        "dim_prodlist": model.dim_prodlist,
        "dim_cnae": model.dim_cnae,
        "bridge_ncm_prodlist_cnae": model.bridge_ncm_prodlist_cnae,
        "fact_trade": model.fact_trade,
        "fact_production": model.fact_production,
    }


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    LOGGER.info(
        "Módulo carregado. Importe build_relational_model e forneça os DataFrames."
    )
