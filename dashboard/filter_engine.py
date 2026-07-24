from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Sequence

import pandas as pd


ALL_VALUES = {"", "all", "todos", "todas"}

CONFIDENCE_ALIASES = {
    "high": "alta",
    "alta": "alta",
    "medium": "media",
    "medio": "media",
    "media": "media",
    "low": "baixa",
    "baixo": "baixa",
    "baixa": "baixa",
}


@dataclass(frozen=True)
class FilterSpec:
    param: str
    columns: tuple[str, ...]
    mode: str = "exact"
    aliases: Mapping[str, str] | None = None


TRADE_FILTERS: tuple[FilterSpec, ...] = (
    FilterSpec("period", ("period", "reference_period")),
    FilterSpec("flow", ("flow", "tipo_fluxo")),
    FilterSpec("chain", ("cadeia_prioritaria", "chain", "cadeia", "chain_id")),
    FilterSpec("conceptual_product", ("conceptual_product_id", "produto_conceitual_id", "product_id")),
    FilterSpec("product", ("conceptual_product_id", "produto_conceitual_id", "product_id")),
    FilterSpec("ncm", ("ncm", "ncm_codigo", "ncm_code"), "contains"),
    FilterSpec("cnae", ("cnae_class", "cnae_codigo", "cnae_code")),
    FilterSpec("prodlist", ("prodlist_code", "prodlist_codigo", "prodlist")),
    FilterSpec("country", ("country_code", "country_iso3", "principal_pais_origem", "pais_parceiro", "partner_country"), "country"),
    FilterSpec("partner", ("country_code", "country_iso3", "principal_pais_origem", "pais_parceiro", "partner_country"), "country"),
    FilterSpec("mapping_status", ("mapping_status", "status_mapeamento")),
    FilterSpec("status", ("mapping_status", "status_mapeamento")),
    FilterSpec("confidence", ("confidence_level", "nivel_confianca", "audit_confidence"), "exact", CONFIDENCE_ALIASES),
    FilterSpec("audit_confidence", ("confidence_level", "nivel_confianca", "audit_confidence"), "exact", CONFIDENCE_ALIASES),
)


def filter_trade(
    frame: pd.DataFrame,
    params: Mapping[str, str],
    *,
    country_labels: Mapping[str, str] | None = None,
) -> pd.DataFrame:
    """Apply all BI trade/product filters in the analytical engine layer."""

    return apply_filters(frame, params, TRADE_FILTERS, country_labels=country_labels)


def apply_filters(
    frame: pd.DataFrame,
    params: Mapping[str, str],
    specs: Sequence[FilterSpec],
    *,
    country_labels: Mapping[str, str] | None = None,
) -> pd.DataFrame:
    if frame.empty:
        return frame

    mask = pd.Series(True, index=frame.index)
    for spec in specs:
        value = _normalized_param(params, spec)
        if _is_all(value):
            continue

        column = _first_existing_column(frame, spec.columns)
        if column is None:
            continue

        if spec.mode == "contains":
            mask &= _contains(frame[column], value)
        elif spec.mode == "country":
            mask &= _country_mask(frame[column], value, country_labels or {})
        else:
            mask &= _equals(frame[column], _alias_value(value, spec.aliases))

    return frame.loc[mask]


def _normalized_param(params: Mapping[str, str], spec: FilterSpec) -> str:
    raw_value = params.get(spec.param, "")
    if raw_value is None:
        return ""
    return str(raw_value).strip()


def _is_all(value: str) -> bool:
    return value.casefold() in ALL_VALUES


def _first_existing_column(frame: pd.DataFrame, columns: Sequence[str]) -> str | None:
    for column in columns:
        if column in frame.columns:
            return column
    return None


def _alias_value(value: str, aliases: Mapping[str, str] | None) -> str:
    if not aliases:
        return value
    return aliases.get(value.casefold(), value)


def _equals(series: pd.Series, value: str) -> pd.Series:
    return series.fillna("").astype(str).str.casefold() == value.casefold()


def _contains(series: pd.Series, value: str) -> pd.Series:
    return series.fillna("").astype(str).str.casefold().str.contains(value.casefold(), regex=False)


def _country_mask(series: pd.Series, value: str, country_labels: Mapping[str, str]) -> pd.Series:
    term = value.split(" - ", 1)[0].strip()
    folded_value = value.casefold()
    folded_term = term.casefold()
    text = series.fillna("").astype(str)

    mask = text.str.casefold().str.contains(folded_term, regex=False)
    matched_codes = {
        str(code).zfill(3)
        for code, name in country_labels.items()
        if folded_value in str(name).casefold() or folded_term == str(code).zfill(3).casefold()
    }
    if matched_codes:
        mask |= text.str.zfill(3).isin(matched_codes)
    return mask
