"""Execução operacional do pipeline Border Value.

Aceita CSV, XLSX e Parquet, adapta layouts oficiais do Comex Stat/IBGE e grava
saídas auditáveis. O módulo não baixa dados automaticamente: URLs e versões são
registradas no arquivo de configuração para garantir reprodutibilidade.
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
import subprocess
import tempfile
import zipfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen

import pandas as pd

from pipeline_harmonizacao import (
    ColumnConfig,
    PipelineValidationError,
    allocate_trade_to_cnae,
    build_relational_model,
    normalize_cnae_class,
    tables_as_mapping,
)


LOGGER = logging.getLogger(__name__)


OFFICIAL_SOURCES = {
    "comex_stat": "https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/base-de-dados-bruta",
    "ncm_prodlist": "https://concla.ibge.gov.br/classificacoes/correspondencias/produtos.html",
    "pia_produto": "https://sidra.ibge.gov.br/pesquisa/pia-produto/tabelas",
    "rais": "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/rais",
    "gdp": "https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais.html",
}


@dataclass(frozen=True)
class RunMetadata:
    run_timestamp_utc: str
    config_path: str
    allocation_method: str
    prodlist_version: str
    trade_period: str
    production_period: str
    sources: Mapping[str, str]


SUPPORTED_TABLE_SUFFIXES = {".csv", ".txt", ".comt", ".xlsx", ".xls", ".parquet", ".json"}
ARCHIVE_SUFFIXES = {".zip", ".7z"}
UF_CODE_TO_SIGLA = {
    "11": "RO",
    "12": "AC",
    "13": "AM",
    "14": "RR",
    "15": "PA",
    "16": "AP",
    "17": "TO",
    "21": "MA",
    "22": "PI",
    "23": "CE",
    "24": "RN",
    "25": "PB",
    "26": "PE",
    "27": "AL",
    "28": "SE",
    "29": "BA",
    "31": "MG",
    "32": "ES",
    "33": "RJ",
    "35": "SP",
    "41": "PR",
    "42": "SC",
    "43": "RS",
    "50": "MS",
    "51": "MT",
    "52": "GO",
    "53": "DF",
}


def _select_archive_member(members: Iterable[str], requested: str | None = None) -> str:
    files = sorted(name.replace("\\", "/") for name in members if not name.endswith("/"))
    if requested:
        requested_normalized = requested.replace("\\", "/")
        matches = [
            name
            for name in files
            if name == requested_normalized or name.endswith(f"/{requested_normalized}")
        ]
        if not matches:
            raise PipelineValidationError(
                f"Arquivo compactado não contém o membro solicitado: {requested!r}."
            )
        return matches[0]

    candidates = [
        name for name in files if Path(name).suffix.lower() in SUPPORTED_TABLE_SUFFIXES
    ]
    if not candidates:
        raise PipelineValidationError(
            "Arquivo compactado não contém CSV, TXT, XLSX, XLS, Parquet ou JSON."
        )
    return candidates[0]


def _safe_extracted_path(destination: Path, member: str) -> Path:
    target = (destination / member).resolve()
    destination_resolved = destination.resolve()
    if destination_resolved != target and destination_resolved not in target.parents:
        raise PipelineValidationError(f"Caminho inseguro dentro do arquivo compactado: {member!r}.")
    return target


def _extract_archive(path: Path, options: Mapping[str, Any]) -> Path:
    member = options.get("archive_member")
    destination = path.with_suffix(path.suffix + ".extracted")
    destination.mkdir(parents=True, exist_ok=True)

    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            selected = _select_archive_member(archive.namelist(), member)
            target = _safe_extracted_path(destination, selected)
            if not target.exists() or not target.stat().st_size:
                archive.extract(selected, destination)
            return target

    if path.suffix.lower() == ".7z":
        try:
            import py7zr  # type: ignore
        except ModuleNotFoundError:
            py7zr = None

        if py7zr is not None:
            with py7zr.SevenZipFile(path, mode="r") as archive:
                selected = _select_archive_member(archive.getnames(), member)
                target = _safe_extracted_path(destination, selected)
                if not target.exists() or not target.stat().st_size:
                    archive.extract(path=destination, targets=[selected])
                return target

        executable = shutil.which("7z") or shutil.which("7za") or shutil.which("7zr")
        if executable:
            listing = subprocess.run(
                [executable, "l", "-ba", str(path)],
                check=True,
                capture_output=True,
                text=True,
            )
            members = [line.split()[-1] for line in listing.stdout.splitlines() if line.split()]
            selected = _select_archive_member(members, member)
            target = _safe_extracted_path(destination, selected)
            if not target.exists() or not target.stat().st_size:
                subprocess.run(
                    [executable, "x", str(path), f"-o{destination}", selected, "-y"],
                    check=True,
                    capture_output=True,
                    text=True,
                )
            return target

        raise PipelineValidationError(
            "Para ler .7z, instale py7zr (`python -m pip install py7zr`) ou disponibilize 7z no PATH."
        )

    raise PipelineValidationError(f"Formato compactado não suportado: {path.suffix}.")


def _materialize_table_path(path: Path, options: Mapping[str, Any]) -> Path:
    if path.suffix.lower() in ARCHIVE_SUFFIXES:
        return _extract_archive(path, options)
    return path


def _read_table(path: Path, options: Mapping[str, Any] | None = None) -> pd.DataFrame:
    options = dict(options or {})
    if not path.exists():
        raise FileNotFoundError(f"Arquivo de entrada não encontrado: {path}")
    path = _materialize_table_path(path, options)
    options = {key: value for key, value in options.items() if key != "archive_member"}
    suffix = path.suffix.lower()
    if suffix in {".csv", ".txt", ".comt"}:
        options.setdefault("sep", ";")
        options.setdefault("encoding", "utf-8-sig")
        return pd.read_csv(path, **options)
    if suffix == ".gz":
        options.setdefault("sep", ";")
        options.setdefault("encoding", "utf-8-sig")
        options.setdefault("compression", "gzip")
        return pd.read_csv(path, **options)
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(path, **options)
    if suffix == ".parquet":
        return pd.read_parquet(path, **options)
    if suffix == ".json":
        payload = json.loads(path.read_text(encoding=options.pop("encoding", "utf-8-sig")))
        if isinstance(payload, list) and payload and isinstance(payload[0], dict):
            # A API SIDRA inclui um primeiro registro com os nomes das colunas.
            if payload[0].get("V") == "Valor":
                payload = payload[1:]
        return pd.DataFrame(payload)
    raise PipelineValidationError(
        f"Formato não suportado para {path.name!r}; use CSV, XLSX, XLS ou Parquet."
    )


def _download(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size:
        return destination

    LOGGER.info("Baixando %s", url)
    request = Request(url, headers={"User-Agent": "BorderValue/1.0"})
    with urlopen(request, timeout=300) as response, tempfile.NamedTemporaryFile(
        dir=destination.parent, delete=False
    ) as temporary:
        shutil.copyfileobj(response, temporary)
        temporary_path = Path(temporary.name)
    temporary_path.replace(destination)
    return destination


def _input_path(spec: Mapping[str, Any], base_dir: Path, *, default_name: str) -> Path:
    if "path" in spec:
        path = (base_dir / spec["path"]).resolve()
        if path.exists() or ("url" not in spec and "download_url" not in spec):
            return path

    url = spec.get("url") or spec.get("download_url")
    if not url:
        raise PipelineValidationError("Entrada sem 'path' ou 'url'.")

    if "path" in spec:
        destination = (base_dir / spec["path"]).resolve()
    else:
        url_name = Path(unquote(urlparse(str(url)).path)).name or default_name
        destination = (base_dir / "inputs" / "official" / url_name).resolve()
    return _download(str(url), destination)


def _first_present(columns: Iterable[str], aliases: Iterable[str]) -> str | None:
    lookup = {str(column).strip().casefold(): column for column in columns}
    for alias in aliases:
        match = lookup.get(alias.casefold())
        if match is not None:
            return str(match)
    return None


def _rename_aliases(
    frame: pd.DataFrame,
    aliases: Mapping[str, Iterable[str]],
    *,
    table_name: str,
) -> pd.DataFrame:
    rename: dict[str, str] = {}
    for canonical, candidates in aliases.items():
        found = _first_present(frame.columns, (canonical, *candidates))
        if found is None:
            raise PipelineValidationError(
                f"{table_name} não contém coluna para {canonical!r}. "
                f"Aliases aceitos: {list(candidates)}."
            )
        rename[found] = canonical
    return frame.rename(columns=rename)


def adapt_comex_stat(frame: pd.DataFrame, *, flow: str | None = None) -> pd.DataFrame:
    """Adapta o layout oficial detalhado por NCM do Comex Stat."""

    result = _rename_aliases(
        frame,
        {
            "ncm": ("CO_NCM", "NCM"),
            "year": ("CO_ANO", "ANO"),
            "month": ("CO_MES", "MES", "MÊS"),
            "value_usd": ("VL_FOB", "VALOR_USD", "US$ FOB"),
            "net_weight_kg": ("KG_LIQUIDO", "KG LÍQUIDO", "PESO_LIQUIDO_KG"),
        },
        table_name="Comex Stat",
    )
    if "flow" not in result.columns:
        if not flow:
            raise PipelineValidationError(
                "Informe 'flow' na configuração (EXP ou IMP) quando o arquivo não tiver essa coluna."
            )
        result["flow"] = flow.upper()
    result["flow"] = result["flow"].astype("string").str.upper()
    if not result["flow"].isin(["EXP", "IMP"]).all():
        raise PipelineValidationError("Fluxo do Comex Stat deve ser EXP ou IMP.")
    return result


def adapt_ncm_prodlist(frame: pd.DataFrame) -> pd.DataFrame:
    """Adapta a planilha de correspondência NCM x PRODLIST do CONCLA."""

    result = _rename_aliases(
        frame,
        {
            "ncm": ("CO_NCM", "Código NCM", "NCM 2025", "NCM/IPI", "NCM 2022 (SET/2022)"),
            "prodlist_code": (
                "PRODLIST",
                "PRODLSIT 2025",
                "Código PRODLIST",
                "PRODLIST-Indústria 2025",
                "PRODLIST 2025",
                "PRODLIST-Ind 2022",
            ),
        },
        table_name="Correspondência NCM-PRODLIST",
    )
    digits = result["ncm"].astype("string").str.replace(r"[^0-9]", "", regex=True)
    valid = digits.str.len().eq(8)
    if (~valid).any():
        LOGGER.warning(
            "%d linha(s) da correspondência oficial sem NCM-8 foram descartadas.",
            int((~valid).sum()),
        )
    return result.loc[valid].dropna(subset=["prodlist_code"]).drop_duplicates().reset_index(drop=True)


def adapt_domestic_production(frame: pd.DataFrame) -> pd.DataFrame:
    """Adapta uma extração PIA-Produto/SIDRA ou tabela já normalizada."""

    result = _rename_aliases(
        frame,
        {
            "cnae_class": (
                "Classe de atividade",
                "Classe CNAE",
                "Código da classe de atividade",
                "CNAE",
                "D4N",
            ),
            "production_value": (
                "Valor da produção",
                "Valor da produção (Mil Reais)",
                "Valor",
                "production_value_brl_thousand",
                "V",
            ),
        },
        table_name="PIA-Produto",
    )
    if "year" not in result.columns:
        year_col = _first_present(result.columns, ("Ano", "ANO", "year", "D3N"))
        if year_col:
            result = result.rename(columns={year_col: "year"})
    # Na tabela SIDRA, classes e produtos dividem a mesma dimensão. Mantemos
    # somente linhas de classe (quatro dígitos seguidos de espaço/fim), pois
    # somar produtos e classe produziria dupla contagem.
    raw_class = result["cnae_class"].astype("string").str.strip()
    class_row = raw_class.str.match(r"^\d{4}(?:\s|$)")
    if class_row.any() and (~class_row).any():
        result = result.loc[class_row].copy()
        raw_class = raw_class.loc[class_row]
    result["cnae_class"] = raw_class.str.extract(r"^(\d{4})", expand=False)
    result = result.loc[result["cnae_class"].ne("0000")].copy()
    raw_value = result["production_value"].astype("string").str.strip()
    confidential = raw_value.eq("X")
    not_available = raw_value.isin(["-", "..", "..."])
    if "production_status" not in result.columns:
        result["production_status"] = "published"
    result.loc[confidential, "production_status"] = "confidential"
    result.loc[not_available, "production_status"] = "not_available"
    suppressed = confidential | not_available
    result.loc[suppressed, "production_value"] = pd.NA
    return result


def _to_number(series: pd.Series) -> pd.Series:
    raw = series.astype("string").str.strip()
    comma_decimal = raw.str.contains(",", regex=False, na=False)
    normalized = raw.where(
        ~comma_decimal,
        raw.str.replace(".", "", regex=False).str.replace(",", ".", regex=False),
    )
    return pd.to_numeric(normalized, errors="coerce")


def adapt_rais_employment(frame: pd.DataFrame) -> pd.DataFrame:
    """Adapta uma extração RAIS para a camada de vínculos e remuneração."""

    result = _rename_aliases(
        frame,
        {
            "year": ("Ano", "ANO", "ano", "competencia", "Competência"),
            "cnae_class": (
                "CNAE 2.0 Classe",
                "CNAE 2.0 Classe - Código",
                "CNAE 2.0 Classe - Codigo",
                "CNAE Classe",
                "Classe CNAE",
                "CNAE",
                "cnae",
                "cnae_20_classe",
            ),
        },
        table_name="RAIS",
    )
    formal_jobs_col = _first_present(
        frame.columns,
        (
            "formal_jobs",
            "Vínculo Ativo 31/12",
            "Vinculo Ativo 31/12",
            "Qtd Vínculos Ativos",
            "qtd_vinculos_ativos",
            "vinculos_formais",
        ),
    )
    if formal_jobs_col is not None:
        result["formal_jobs"] = frame[formal_jobs_col]
    active_col = _first_present(
        frame.columns,
        (
            "Ind Vínculo Ativo 31/12 - Código",
            "Ind Vinculo Ativo 31/12 - Codigo",
            "Ind Vínculo Ativo 31/12",
            "Vínculo Ativo 31/12",
            "Vinculo Ativo 31/12",
        ),
    )
    if "formal_jobs" not in result.columns and active_col is not None:
        active = _to_number(frame[active_col]).fillna(0)
        result["formal_jobs"] = active.eq(1).astype("int64")
    if "formal_jobs" not in result.columns:
        raise PipelineValidationError(
            "RAIS precisa conter vínculos formais ou indicador de vínculo ativo em 31/12."
        )
    if "uf" not in result.columns:
        uf_col = _first_present(result.columns, ("UF", "uf", "SG_UF"))
        result["uf"] = result[uf_col] if uf_col else pd.NA
    if "municipality_code" not in result.columns:
        municipality_col = _first_present(
            result.columns,
            (
                "Município",
                "Municipio",
                "Código Município",
                "Codigo Municipio",
                "Município - Código",
                "Municipio - Codigo",
                "Município Trab - Código",
                "Municipio Trab - Codigo",
                "cod_municipio",
                "municipality_code",
            ),
        )
        result["municipality_code"] = result[municipality_col] if municipality_col else pd.NA

    december_wage_col = _first_present(
        result.columns,
        (
            "massa_salarial",
            "Massa Salarial",
            "december_wage_mass",
            "Vl Rem Dezembro Nom",
            "Vl Remun Dezembro Nom",
            "Remuneração Dezembro Nom",
            "Remuneracao Dezembro Nom",
            "wage_mass",
        ),
    )
    avg_wage_col = _first_present(
        result.columns,
        (
            "salario_medio",
            "Salário Médio",
            "Salario Medio",
            "Vl Rem Média Nom",
            "Vl Rem Media Nom",
            "Vl Remun Média Nom",
            "Vl Remun Media Nom",
            "Remuneração Média Nom",
            "Remuneracao Media Nom",
            "average_wage",
        ),
    )
    if december_wage_col is None and avg_wage_col is None:
        raise PipelineValidationError(
            "RAIS precisa conter massa salarial ou salário/remuneração média."
        )
    if december_wage_col is not None:
        result = result.rename(columns={december_wage_col: "december_wage_mass"})
    else:
        result["december_wage_mass"] = pd.NA
    if avg_wage_col is not None:
        result = result.rename(columns={avg_wage_col: "average_monthly_wage"})
    else:
        result["average_monthly_wage"] = pd.NA

    result["year"] = pd.to_numeric(result["year"], errors="raise").astype("int64")
    cnae_digits = (
        result["cnae_class"].astype("string").str.replace(r"[^0-9]", "", regex=True)
    )
    result["cnae_class"] = normalize_cnae_class(cnae_digits.str[:4], field_name="CNAE RAIS")
    result["uf"] = result["uf"].astype("string").str.strip().str.upper()
    result["municipality_code"] = (
        result["municipality_code"]
        .astype("string")
        .str.replace(r"[^0-9]", "", regex=True)
        .where(result["municipality_code"].notna(), pd.NA)
    )
    derived_uf = result["municipality_code"].str[:2].map(UF_CODE_TO_SIGLA)
    result["uf"] = result["uf"].where(result["uf"].notna() & result["uf"].ne(""), derived_uf)
    result["formal_jobs"] = _to_number(result["formal_jobs"])
    result["december_wage_mass"] = _to_number(result["december_wage_mass"])
    result["average_monthly_wage"] = _to_number(result["average_monthly_wage"])
    missing_december_mass = result["december_wage_mass"].isna() & result["average_monthly_wage"].notna()
    result.loc[missing_december_mass, "december_wage_mass"] = (
        result.loc[missing_december_mass, "average_monthly_wage"] * result.loc[missing_december_mass, "formal_jobs"]
    )
    result["average_december_wage"] = result["december_wage_mass"] / result["formal_jobs"]
    result.loc[~result["formal_jobs"].gt(0), "average_december_wage"] = pd.NA
    result["average_monthly_wage_mass"] = (
        result["average_monthly_wage"] * result["formal_jobs"]
    )
    result["wage_mass"] = result["december_wage_mass"]
    result["average_wage"] = result["average_december_wage"]
    return result[
        [
            "year",
            "uf",
            "municipality_code",
            "cnae_class",
            "formal_jobs",
            "wage_mass",
            "average_wage",
            "december_wage_mass",
            "average_december_wage",
            "average_monthly_wage",
            "average_monthly_wage_mass",
        ]
    ].reset_index(drop=True)


def adapt_gdp(frame: pd.DataFrame) -> pd.DataFrame:
    """Adapta uma extração de PIB territorial para ano, UF, município e valor."""

    result = _rename_aliases(
        frame,
        {
            "year": ("Ano", "ANO", "ano", "D1N", "D2N"),
            "gdp_value_brl": (
                "PIB",
                "Produto Interno Bruto",
                "Produto interno bruto a precos correntes",
                "Produto interno bruto a preços correntes",
                "Valor",
                "V",
                "gdp_value_brl",
            ),
        },
        table_name="PIB",
    )
    if "uf" not in result.columns:
        uf_col = _first_present(
            result.columns,
            ("UF", "uf", "Sigla da Unidade da Federação", "Unidade da Federação - Sigla"),
        )
        result["uf"] = result[uf_col] if uf_col else pd.NA
    if "municipality_code" not in result.columns:
        municipality_col = _first_present(
            result.columns,
            (
                "Município",
                "Municipio",
                "Código do Município",
                "Codigo do Municipio",
                "Código Município",
                "Codigo Municipio",
                "municipality_code",
            ),
        )
        result["municipality_code"] = result[municipality_col] if municipality_col else pd.NA
    if "gdp_status" not in result.columns:
        result["gdp_status"] = "published"

    raw_value = result["gdp_value_brl"].astype("string").str.strip()
    unavailable = raw_value.isin(["X", "-", "..", "..."])
    result.loc[unavailable, "gdp_status"] = raw_value.map(
        {"X": "confidential", "-": "not_available", "..": "not_available", "...": "not_available"}
    )
    result.loc[unavailable, "gdp_value_brl"] = pd.NA
    result["year"] = pd.to_numeric(result["year"], errors="raise").astype("int64")
    result["uf"] = result["uf"].astype("string").str.strip().str.upper()
    result["municipality_code"] = (
        result["municipality_code"]
        .astype("string")
        .str.replace(r"[^0-9]", "", regex=True)
        .where(result["municipality_code"].notna(), pd.NA)
    )
    result["municipality_code"] = result["municipality_code"].str.zfill(7).str[:6]
    derived_uf = result["municipality_code"].str[:2].map(UF_CODE_TO_SIGLA)
    result["uf"] = result["uf"].where(result["uf"].notna() & result["uf"].ne(""), derived_uf)
    result["gdp_value_brl"] = _to_number(result["gdp_value_brl"])
    return result[["year", "uf", "municipality_code", "gdp_value_brl", "gdp_status"]].reset_index(drop=True)


def build_fact_gdp(gdp: pd.DataFrame) -> pd.DataFrame:
    group_key = ["year", "uf", "municipality_code"]
    aggregated = (
        gdp.groupby(group_key, as_index=False, dropna=False)["gdp_value_brl"]
        .sum(min_count=1)
        .reset_index(drop=True)
    )
    if "gdp_status" in gdp.columns:
        status_priority = {"confidential": 3, "not_available": 2, "missing": 1, "published": 0}

        def summarize_status(values: pd.Series) -> str:
            statuses = values.astype("string").fillna("missing")
            return max(statuses, key=lambda item: status_priority.get(str(item), 1))

        statuses = (
            gdp.groupby(group_key, as_index=False, dropna=False)["gdp_status"]
            .agg(summarize_status)
        )
        aggregated = aggregated.merge(statuses, on=group_key, how="left", validate="one_to_one")
    else:
        aggregated["gdp_status"] = aggregated["gdp_value_brl"].notna().map({True: "published", False: "missing"})
    return aggregated.sort_values(group_key, kind="stable").reset_index(drop=True)


def build_fact_employment_rais(rais: pd.DataFrame, dim_cnae: pd.DataFrame) -> pd.DataFrame:
    group_key = ["year", "uf", "municipality_code", "cnae_class"]
    measure_cols = [
        column
        for column in ["formal_jobs", "december_wage_mass", "average_monthly_wage_mass"]
        if column in rais.columns
    ]
    aggregated = (
        rais.groupby(group_key, as_index=False, dropna=False)[measure_cols]
        .sum(min_count=1)
        .reset_index(drop=True)
    )
    if "december_wage_mass" not in aggregated.columns:
        aggregated["december_wage_mass"] = pd.NA
    if "average_monthly_wage_mass" not in aggregated.columns:
        aggregated["average_monthly_wage_mass"] = pd.NA
    aggregated["average_december_wage"] = aggregated["december_wage_mass"] / aggregated["formal_jobs"]
    aggregated["average_monthly_wage"] = aggregated["average_monthly_wage_mass"] / aggregated["formal_jobs"]
    aggregated.loc[~aggregated["formal_jobs"].gt(0), ["average_december_wage", "average_monthly_wage"]] = pd.NA
    aggregated["wage_mass"] = aggregated["december_wage_mass"]
    aggregated["average_wage"] = aggregated["average_december_wage"]
    result = aggregated.merge(
        dim_cnae[["cnae_key", "cnae_class"]],
        on="cnae_class",
        how="left",
        validate="many_to_one",
    )
    result["cnae_key"] = result["cnae_key"].astype("Int64")
    return result[
        [
            "year",
            "uf",
            "municipality_code",
            "cnae_key",
            "cnae_class",
            "formal_jobs",
            "wage_mass",
            "average_wage",
            "december_wage_mass",
            "average_december_wage",
            "average_monthly_wage",
            "average_monthly_wage_mass",
        ]
    ].sort_values(["year", "uf", "municipality_code", "cnae_class"], kind="stable")


def summarize_rais_by_cnae(fact_employment_rais: pd.DataFrame) -> pd.DataFrame:
    summary = (
        fact_employment_rais.groupby(["cnae_class"], as_index=False, dropna=False)[
            ["formal_jobs", "december_wage_mass", "average_monthly_wage_mass"]
        ]
        .sum(min_count=1)
        .rename(
            columns={
                "formal_jobs": "rais_formal_jobs",
                "december_wage_mass": "rais_december_wage_mass",
                "average_monthly_wage_mass": "rais_average_monthly_wage_mass",
            }
        )
    )
    summary["rais_average_december_wage"] = (
        summary["rais_december_wage_mass"] / summary["rais_formal_jobs"]
    )
    summary["rais_average_monthly_wage"] = (
        summary["rais_average_monthly_wage_mass"] / summary["rais_formal_jobs"]
    )
    summary.loc[
        ~summary["rais_formal_jobs"].gt(0),
        ["rais_average_december_wage", "rais_average_monthly_wage"],
    ] = pd.NA
    summary["rais_wage_mass"] = summary["rais_december_wage_mass"]
    summary["rais_average_wage"] = summary["rais_average_december_wage"]
    return summary


def _aggregate_rais_parts(parts: Iterable[pd.DataFrame]) -> pd.DataFrame:
    frames = [part for part in parts if not part.empty]
    if not frames:
        return pd.DataFrame(
            columns=[
                "year",
                "uf",
                "municipality_code",
                "cnae_class",
                "formal_jobs",
                "wage_mass",
                "average_wage",
                "december_wage_mass",
                "average_december_wage",
                "average_monthly_wage",
                "average_monthly_wage_mass",
            ]
        )
    combined = pd.concat(frames, ignore_index=True)
    group_key = ["year", "uf", "municipality_code", "cnae_class"]
    measure_cols = [
        column
        for column in ["formal_jobs", "december_wage_mass", "average_monthly_wage_mass"]
        if column in combined.columns
    ]
    result = (
        combined.groupby(group_key, as_index=False, dropna=False)[measure_cols]
        .sum(min_count=1)
        .reset_index(drop=True)
    )
    if "december_wage_mass" not in result.columns:
        result["december_wage_mass"] = pd.NA
    if "average_monthly_wage_mass" not in result.columns:
        result["average_monthly_wage_mass"] = pd.NA
    result["average_december_wage"] = result["december_wage_mass"] / result["formal_jobs"]
    result["average_monthly_wage"] = result["average_monthly_wage_mass"] / result["formal_jobs"]
    result.loc[~result["formal_jobs"].gt(0), ["average_december_wage", "average_monthly_wage"]] = pd.NA
    result["wage_mass"] = result["december_wage_mass"]
    result["average_wage"] = result["average_december_wage"]
    return result


def _read_rais_file(path: Path, options: Mapping[str, Any], *, year: int | None = None) -> pd.DataFrame:
    archive_root = path.with_suffix(path.suffix + ".extracted") if path.suffix.lower() in ARCHIVE_SUFFIXES else None
    try:
        path = _materialize_table_path(path, options)
        read_options = {key: value for key, value in dict(options).items() if key != "archive_member"}
        suffix = path.suffix.lower()
        if suffix in {".csv", ".txt", ".comt", ".gz"}:
            read_options.setdefault("sep", ";")
            read_options.setdefault("encoding", "utf-8-sig")
            if suffix == ".gz":
                read_options.setdefault("compression", "gzip")
            chunksize = int(read_options.pop("chunksize", 250_000))
            parts = []
            for chunk in pd.read_csv(path, chunksize=chunksize, **read_options):
                if "year" not in chunk.columns and year is not None:
                    chunk["year"] = year
                parts.append(adapt_rais_employment(chunk))
            return _aggregate_rais_parts(parts)

        raw = _read_table(path, read_options)
        if "year" not in raw.columns and year is not None:
            raw["year"] = year
        return _aggregate_rais_parts([adapt_rais_employment(raw)])
    finally:
        if archive_root is not None and archive_root.exists():
            shutil.rmtree(archive_root, ignore_errors=True)


def load_rais_employment_input(
    spec: Mapping[str, Any], base_dir: Path, *, default_name: str = "rais_employment.csv"
) -> pd.DataFrame:
    read_options = spec.get("read_options", {})
    if "files" in spec:
        parts = []
        for part_spec in spec["files"]:
            merged_options = {**read_options, **part_spec.get("read_options", {})}
            path = _input_path(
                part_spec,
                base_dir,
                default_name=f"rais_{part_spec.get('year', 'employment')}.csv",
            )
            parts.append(
                _read_rais_file(path, merged_options, year=part_spec.get("year"))
            )
        return _aggregate_rais_parts(parts)

    path = _input_path(spec, base_dir, default_name=default_name)
    return _read_rais_file(path, read_options, year=spec.get("year"))


def load_gdp_input(spec: Mapping[str, Any], base_dir: Path) -> pd.DataFrame:
    read_options = spec.get("read_options", {})
    value_multiplier = float(spec.get("value_multiplier", 1.0))

    def apply_multiplier(frame: pd.DataFrame, part_spec: Mapping[str, Any] | None = None) -> pd.DataFrame:
        multiplier = float((part_spec or {}).get("value_multiplier", value_multiplier))
        result = frame.copy()
        result["gdp_value_brl"] = result["gdp_value_brl"] * multiplier
        return result

    if "files" in spec:
        parts = []
        for part_spec in spec["files"]:
            merged_options = {**read_options, **part_spec.get("read_options", {})}
            path = _input_path(part_spec, base_dir, default_name=f"gdp_{part_spec.get('year', 'territory')}.csv")
            raw = _read_table(path, merged_options)
            if "year" not in raw.columns and part_spec.get("year") is not None:
                raw["year"] = part_spec["year"]
            parts.append(apply_multiplier(adapt_gdp(raw), part_spec))
        return pd.concat(parts, ignore_index=True) if parts else pd.DataFrame()

    path = _input_path(spec, base_dir, default_name="gdp.csv")
    raw = _read_table(path, read_options)
    if "year" not in raw.columns and spec.get("year") is not None:
        raw["year"] = spec["year"]
    return apply_multiplier(adapt_gdp(raw))


def load_inputs(
    config: Mapping[str, Any], base_dir: Path
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame | None, pd.DataFrame | None]:
    inputs = config.get("inputs", {})
    required = ("trade", "ncm_prodlist", "domestic_production")
    missing = [name for name in required if name not in inputs]
    if missing:
        raise PipelineValidationError(f"Configuração sem entradas obrigatórias: {missing}.")

    def load(name: str) -> tuple[pd.DataFrame, Mapping[str, Any]]:
        spec = inputs[name]
        path = _input_path(spec, base_dir, default_name=f"{name}.csv")
        return _read_table(path, spec.get("read_options")), spec

    trade_spec = inputs["trade"]
    if "files" in trade_spec:
        trade_parts = []
        for part_spec in trade_spec["files"]:
            path = _input_path(part_spec, base_dir, default_name=f"{part_spec.get('flow', 'trade')}.csv")
            raw = _read_table(path, part_spec.get("read_options", trade_spec.get("read_options")))
            trade_parts.append(adapt_comex_stat(raw, flow=part_spec.get("flow")))
        trade = pd.concat(trade_parts, ignore_index=True)
    else:
        trade_raw, trade_spec = load("trade")
        trade = adapt_comex_stat(trade_raw, flow=trade_spec.get("flow"))
    mapping_raw, _ = load("ncm_prodlist")
    production_raw, _ = load("domestic_production")
    mapping = adapt_ncm_prodlist(mapping_raw)
    production = adapt_domestic_production(production_raw)
    rais = None
    if "rais_employment" in inputs:
        rais = load_rais_employment_input(inputs["rais_employment"], base_dir)
    gdp = None
    if "gdp" in inputs:
        gdp = load_gdp_input(inputs["gdp"], base_dir)
    return trade, mapping, production, rais, gdp


def _safe_write_parquet(frame: pd.DataFrame, path: Path) -> bool:
    try:
        frame.to_parquet(path, index=False)
        return True
    except (ImportError, ModuleNotFoundError) as exc:
        LOGGER.warning("Parquet não foi gravado (%s); CSV permanece disponível.", exc)
        return False


def build_analytic_trade(model: Any, grain_cols: list[str]) -> pd.DataFrame:
    """Rateia o universo mapeado e preserva o não mapeado em uma linha sem CNAE."""

    measures = ["value_usd", "net_weight_kg"]
    allocated = allocate_trade_to_cnae(
        model.fact_trade,
        model.bridge_ncm_prodlist_cnae,
        measure_cols=measures,
        grain_cols=grain_cols,
    )
    mapped_keys = model.bridge_ncm_prodlist_cnae["ncm_key"].drop_duplicates()
    unmatched = model.fact_trade.loc[~model.fact_trade["ncm_key"].isin(mapped_keys)].copy()
    if not unmatched.empty:
        unmatched = unmatched.groupby(grain_cols, as_index=False, dropna=False)[measures].sum(min_count=1)
        unmatched["cnae_key"] = pd.NA
        unmatched["cnae_class"] = pd.NA
        unmatched = unmatched[[*grain_cols, "cnae_key", "cnae_class", *measures]]
        allocated = pd.concat([allocated, unmatched], ignore_index=True)
    allocated["allocation_status"] = allocated["cnae_key"].notna().map(
        {True: "allocated_cnae", False: "unmatched_ncm"}
    )
    return allocated


def build_border_value_indicators(
    allocated_trade: pd.DataFrame,
    fact_production: pd.DataFrame,
    *,
    production_value_to_trade_value_factor: float | None = None,
    fact_employment_rais: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Constrói indicadores consolidados por CNAE.

    A dependência externa em valor exige comércio e produção na mesma unidade.
    A PIA-Produto oficial está em mil reais, enquanto o Comex Stat está em US$
    FOB; por isso o índice só é calculado quando um fator de conversão explícito
    é informado na configuração.
    """

    comparable_factor = (
        None
        if production_value_to_trade_value_factor is None
        else float(production_value_to_trade_value_factor)
    )
    trade = allocated_trade.loc[allocated_trade["cnae_key"].notna()].copy()
    trade["flow"] = trade["flow"].astype("string").str.upper()
    trade_summary = (
        trade.groupby(["cnae_key", "cnae_class", "flow"], as_index=False, dropna=False)[
            ["value_usd", "net_weight_kg"]
        ]
        .sum(min_count=1)
        .pivot(
            index=["cnae_key", "cnae_class"],
            columns="flow",
            values=["value_usd", "net_weight_kg"],
        )
    )
    trade_summary.columns = [
        f"{'export' if flow == 'EXP' else 'import' if flow == 'IMP' else flow.lower()}_{measure}"
        for measure, flow in trade_summary.columns
    ]
    trade_summary = trade_summary.reset_index()

    for column in (
        "export_value_usd",
        "import_value_usd",
        "export_net_weight_kg",
        "import_net_weight_kg",
    ):
        if column not in trade_summary.columns:
            trade_summary[column] = 0.0
    trade_summary[
        [
            "export_value_usd",
            "import_value_usd",
            "export_net_weight_kg",
            "import_net_weight_kg",
        ]
    ] = trade_summary[
        [
            "export_value_usd",
            "import_value_usd",
            "export_net_weight_kg",
            "import_net_weight_kg",
        ]
    ].fillna(0.0)
    trade_summary["trade_balance_usd"] = (
        trade_summary["export_value_usd"] - trade_summary["import_value_usd"]
    )

    production = (
        fact_production.groupby(["cnae_key", "cnae_class"], as_index=False, dropna=False)[
            "production_value"
        ]
        .sum(min_count=1)
        .rename(columns={"production_value": "domestic_production_value_brl_thousand"})
    )
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

        production_status = (
            fact_production.groupby(["cnae_key", "cnae_class"], as_index=False, dropna=False)[
                "production_status"
            ]
            .agg(summarize_status)
            .rename(columns={"production_status": "domestic_production_status"})
        )
        production = production.merge(
            production_status, on=["cnae_key", "cnae_class"], how="left", validate="one_to_one"
        )
    else:
        production["domestic_production_status"] = production[
            "domestic_production_value_brl_thousand"
        ].notna().map({True: "published", False: "missing"})
    result = production.merge(
        trade_summary, on=["cnae_key", "cnae_class"], how="outer", validate="one_to_one"
    )
    result["cnae_key"] = result["cnae_key"].astype("Int64")
    result["cnae_class"] = result["cnae_class"].astype("string")
    result["domestic_production_status"] = (
        result["domestic_production_status"].astype("string").fillna("missing")
    )
    result["domestic_production_is_confidential"] = result[
        "domestic_production_status"
    ].eq("confidential")
    for column in (
        "export_value_usd",
        "import_value_usd",
        "export_net_weight_kg",
        "import_net_weight_kg",
        "trade_balance_usd",
    ):
        result[column] = result[column].fillna(0.0)

    if comparable_factor is None:
        result["domestic_production_value_usd_comparable"] = pd.NA
        result["apparent_consumption_value_usd"] = pd.NA
        result["external_dependency_ratio"] = pd.NA
        result["external_dependency_status"] = "not_comparable_value_units"
    else:
        result["domestic_production_value_usd_comparable"] = (
            result["domestic_production_value_brl_thousand"] * comparable_factor
        )
        result["apparent_consumption_value_usd"] = (
            result["domestic_production_value_usd_comparable"]
            + result["import_value_usd"]
            - result["export_value_usd"]
        )
        confidential_or_missing = result["domestic_production_status"].isin(
            ["confidential", "not_available", "missing"]
        )
        result.loc[confidential_or_missing, "domestic_production_value_usd_comparable"] = pd.NA
        result.loc[confidential_or_missing, "apparent_consumption_value_usd"] = pd.NA
        positive_consumption = result["apparent_consumption_value_usd"].gt(0)
        result["external_dependency_ratio"] = pd.NA
        result.loc[positive_consumption, "external_dependency_ratio"] = (
            result.loc[positive_consumption, "import_value_usd"]
            / result.loc[positive_consumption, "apparent_consumption_value_usd"]
        )
        result["external_dependency_status"] = positive_consumption.map(
            {True: "calculated", False: "non_positive_apparent_consumption"}
        )
        result.loc[
            result["domestic_production_status"].eq("confidential"),
            "external_dependency_status",
        ] = "not_calculated_confidential_pia"
        result.loc[
            result["domestic_production_status"].isin(["not_available", "missing"]),
            "external_dependency_status",
        ] = "not_calculated_missing_pia"

    if fact_employment_rais is not None:
        rais_summary = summarize_rais_by_cnae(fact_employment_rais)
        result = result.merge(rais_summary, on="cnae_class", how="left", validate="one_to_one")
    else:
        result["rais_formal_jobs"] = pd.NA
        result["rais_wage_mass"] = pd.NA
        result["rais_average_wage"] = pd.NA
        result["rais_december_wage_mass"] = pd.NA
        result["rais_average_december_wage"] = pd.NA
        result["rais_average_monthly_wage"] = pd.NA
        result["rais_average_monthly_wage_mass"] = pd.NA

    ordered_columns = [
        "cnae_key",
        "cnae_class",
        "import_value_usd",
        "export_value_usd",
        "trade_balance_usd",
        "import_net_weight_kg",
        "export_net_weight_kg",
        "domestic_production_value_brl_thousand",
        "domestic_production_status",
        "domestic_production_is_confidential",
        "domestic_production_value_usd_comparable",
        "apparent_consumption_value_usd",
        "external_dependency_ratio",
        "external_dependency_status",
        "rais_formal_jobs",
        "rais_wage_mass",
        "rais_average_wage",
        "rais_december_wage_mass",
        "rais_average_december_wage",
        "rais_average_monthly_wage",
        "rais_average_monthly_wage_mass",
    ]
    return result[ordered_columns].sort_values("cnae_class", kind="stable").reset_index(drop=True)


def build_quality_tables(model: Any, allocated: pd.DataFrame) -> Mapping[str, pd.DataFrame]:
    bridge = model.bridge_ncm_prodlist_cnae
    mapped_ncm = set(bridge["ncm_key"].unique())
    unmatched_ncm = model.dim_ncm.loc[~model.dim_ncm["ncm_key"].isin(mapped_ncm)].copy()
    generic_ncm = model.dim_ncm.loc[model.dim_ncm["is_generic_code"]].copy()
    reached_cnae = set(bridge["cnae_key"].unique())
    unmatched_cnae = model.dim_cnae.loc[~model.dim_cnae["cnae_key"].isin(reached_cnae)].copy()
    total_ncm = int(model.dim_ncm["ncm_key"].nunique())
    mapped_count = total_ncm - len(unmatched_ncm)
    metrics: list[tuple[str, object, str]] = [
        ("trade_rows", len(model.fact_trade), "linhas no fato de comércio"),
        ("production_rows", len(model.fact_production), "linhas no fato de produção"),
        ("distinct_ncm", total_ncm, "NCMs distintas no comércio"),
        ("mapped_ncm", mapped_count, "NCMs com vínculo PRODLIST/CNAE"),
        ("ncm_coverage_rate", mapped_count / total_ncm if total_ncm else 1.0, "cobertura por quantidade"),
        ("unmatched_ncm", len(unmatched_ncm), "NCMs sem vínculo"),
        ("generic_ncm", len(generic_ncm), "NCMs final 9/90/99"),
        ("unmatched_domestic_cnae", len(unmatched_cnae), "CNAEs domésticas não alcançadas"),
    ]
    for measure in ("value_usd", "net_weight_kg"):
        source = model.fact_trade[measure].sum(min_count=1)
        after = allocated[measure].sum(min_count=1)
        metrics.extend(
            [
                (f"trade_total_{measure}", source, "total de controle na origem"),
                (f"allocated_total_{measure}", after, "total após rateio, incluindo não mapeados"),
                (f"allocation_difference_{measure}", after - source, "deve ser zero"),
            ]
        )
    return {
        "quality_summary": pd.DataFrame(metrics, columns=["metric", "value", "description"]),
        "audit_unmatched_ncm": unmatched_ncm.reset_index(drop=True),
        "audit_generic_ncm": generic_ncm.reset_index(drop=True),
        "audit_unmatched_cnae": unmatched_cnae.reset_index(drop=True),
    }


def execute_pipeline(config_path: str | Path) -> Path:
    config_path = Path(config_path).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    trade, mapping, production, rais, gdp = load_inputs(config, config_path.parent)

    settings = config.get("settings", {})
    trade_grain = settings.get("trade_grain_cols", ["year", "month", "flow"])
    default_production_grain = ["year"] if "year" in production else []
    if "production_status" in production.columns:
        default_production_grain = [*default_production_grain, "production_status"]
    production_grain = settings.get("production_grain_cols", default_production_grain)
    model = build_relational_model(
        trade,
        mapping,
        production,
        columns=ColumnConfig(),
        trade_grain_cols=trade_grain,
        production_grain_cols=production_grain,
        production_measure_cols=["production_value"],
    )
    allocated = build_analytic_trade(model, trade_grain)
    fact_employment_rais = (
        build_fact_employment_rais(rais, model.dim_cnae) if rais is not None else None
    )
    fact_gdp = build_fact_gdp(gdp) if gdp is not None else None
    conversion_factor = settings.get("production_value_to_trade_value_factor")
    indicators = build_border_value_indicators(
        allocated,
        model.fact_production,
        production_value_to_trade_value_factor=conversion_factor,
        fact_employment_rais=fact_employment_rais,
    )
    quality = build_quality_tables(model, allocated)

    output_dir = (config_path.parent / config.get("output_dir", "outputs/latest")).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    all_tables = {
        **tables_as_mapping(model),
        "analytic_trade_cnae": allocated,
        "border_value_indicators_cnae": indicators,
        **quality,
    }
    if fact_employment_rais is not None:
        all_tables["fact_employment_rais"] = fact_employment_rais
        quality_summary = all_tables["quality_summary"]
        rais_metrics = pd.DataFrame(
            [
                (
                    "rais_rows",
                    len(fact_employment_rais),
                    "linhas no fato territorial RAIS",
                ),
                (
                    "rais_formal_jobs",
                    fact_employment_rais["formal_jobs"].sum(min_count=1),
                    "vínculos formais RAIS após agregação",
                ),
                (
                    "rais_wage_mass",
                    fact_employment_rais["wage_mass"].sum(min_count=1),
                    "massa salarial RAIS de dezembro após agregação",
                ),
                (
                    "rais_average_monthly_wage_mass",
                    fact_employment_rais["average_monthly_wage_mass"].sum(min_count=1),
                    "massa de remuneração média nominal RAIS após agregação",
                ),
                (
                    "rais_unmatched_cnae",
                    int(fact_employment_rais["cnae_key"].isna().sum()),
                    "linhas RAIS com CNAE fora da dimensão PIA",
                ),
            ],
            columns=["metric", "value", "description"],
        )
        all_tables["quality_summary"] = pd.concat(
            [quality_summary, rais_metrics], ignore_index=True
        )
    if fact_gdp is not None:
        all_tables["fact_gdp"] = fact_gdp
        gdp_metrics = pd.DataFrame(
            [
                ("gdp_rows", len(fact_gdp), "linhas no fato territorial de PIB"),
                ("gdp_value_brl", fact_gdp["gdp_value_brl"].sum(min_count=1), "PIB territorial agregado em reais"),
            ],
            columns=["metric", "value", "description"],
        )
        all_tables["quality_summary"] = pd.concat(
            [all_tables["quality_summary"], gdp_metrics], ignore_index=True
        )
    manifest_tables: dict[str, dict[str, Any]] = {}
    for name, frame in all_tables.items():
        csv_path = output_dir / f"{name}.csv"
        frame.to_csv(csv_path, index=False, encoding="utf-8-sig")
        parquet_written = _safe_write_parquet(frame, output_dir / f"{name}.parquet")
        manifest_tables[name] = {
            "rows": len(frame),
            "columns": list(frame.columns),
            "csv": csv_path.name,
            "parquet": f"{name}.parquet" if parquet_written else None,
        }

    metadata = RunMetadata(
        run_timestamp_utc=datetime.now(timezone.utc).isoformat(),
        config_path=str(config_path),
        allocation_method=str(settings.get("allocation_method", "production_value_weighted_cnae")),
        prodlist_version=str(settings.get("prodlist_version", "não informada")),
        trade_period=str(settings.get("trade_period", "não informado")),
        production_period=str(settings.get("production_period", "não informado")),
        sources={**OFFICIAL_SOURCES, **config.get("sources", {})},
    )
    manifest = {"metadata": asdict(metadata), "tables": manifest_tables}
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    LOGGER.info("Pipeline concluído em %s", output_dir)
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Executa o pipeline Border Value.")
    parser.add_argument("config", help="Caminho para o arquivo JSON de configuração.")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    execute_pipeline(args.config)


if __name__ == "__main__":
    main()
