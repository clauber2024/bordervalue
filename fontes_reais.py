"""Conectores oficiais para Comex Stat, CONCLA e PIA-Produto/SIDRA.

O módulo baixa/cacheia as fontes brutas, adapta os layouts oficiais para o
contrato de :mod:`pipeline_harmonizacao` e grava o modelo relacional resultante.
"""

from __future__ import annotations

import argparse
import gzip
import json
import logging
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

import pandas as pd

from pipeline_harmonizacao import (
    PipelineValidationError,
    RelationalModel,
    build_relational_model,
    tables_as_mapping,
)


LOGGER = logging.getLogger(__name__)

COMEX_BASE_URL = "https://balanca.economia.gov.br/balanca/bd/comexstat-bd/ncm"
SIDRA_API_BASE = "https://servicodados.ibge.gov.br/api/v3/agregados"
PRODLIST_URLS = {
    2022: (
        "https://concla.ibge.gov.br/images/concla/documentacao/"
        "PRODLIST%20Ind%202022%20x%20NCM%202022.xlsx"
    ),
    2025: (
        "https://concla.ibge.gov.br/images/concla/downloads/"
        "5CorrespondenciaNCMxPRODLIST-Industria2025.xlsx"
    ),
}

COMEX_COLUMNS = {
    "CO_ANO": "year",
    "CO_MES": "month",
    "CO_NCM": "ncm",
    "CO_UNID": "statistical_unit_code",
    "CO_PAIS": "country_code",
    "SG_UF_NCM": "uf",
    "CO_VIA": "customs_mode_code",
    "CO_URF": "customs_office_code",
    "QT_ESTAT": "statistical_quantity",
    "KG_LIQUIDO": "net_weight_kg",
    "VL_FOB": "value_usd",
    "VL_FRETE": "freight_usd",
    "VL_SEGURO": "insurance_usd",
}


@dataclass(frozen=True)
class RealSourceResult:
    """Bases canônicas e modelo produzidos por uma execução."""

    trade: pd.DataFrame
    ncm_prodlist: pd.DataFrame
    domestic_production: pd.DataFrame
    model: RelationalModel


def _download(url: str, destination: Path) -> Path:
    """Baixa com escrita atômica e reutiliza o cache existente."""

    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size:
        return destination

    LOGGER.info("Baixando %s", url)
    request = Request(url, headers={"User-Agent": "BorderValue/1.0"})
    with urlopen(request, timeout=180) as response, tempfile.NamedTemporaryFile(
        dir=destination.parent, delete=False
    ) as temporary:
        shutil.copyfileobj(response, temporary)
        temporary_path = Path(temporary.name)
    temporary_path.replace(destination)
    return destination


def comex_url(year: int, flow: str) -> str:
    """Retorna a URL oficial anual detalhada por NCM."""

    flow_code = flow.strip().upper()
    if flow_code not in {"EXP", "IMP"}:
        raise PipelineValidationError("Fluxo Comex deve ser EXP ou IMP.")
    if year < 1997:
        raise PipelineValidationError("A série detalhada por NCM começa em 1997.")
    return f"{COMEX_BASE_URL}/{flow_code}_{year}.csv"


def adapt_comex_frame(frame: pd.DataFrame, flow: str) -> pd.DataFrame:
    """Adapta um bloco do layout oficial do Comex Stat ao contrato canônico."""

    required = set(COMEX_COLUMNS).difference({"VL_FRETE", "VL_SEGURO"})
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise PipelineValidationError(f"Comex Stat sem colunas obrigatórias: {missing}.")

    result = frame.rename(columns=COMEX_COLUMNS)
    selected = [column for column in COMEX_COLUMNS.values() if column in result.columns]
    result = result[selected].copy()
    result.insert(2, "flow", flow.upper())
    return result


def load_comex_stat(
    years: Iterable[int],
    *,
    flows: Sequence[str] = ("EXP", "IMP"),
    cache_dir: str | Path = "dados/cache/comex",
    chunksize: int = 500_000,
) -> pd.DataFrame:
    """Baixa e lê os CSV anuais reais do Comex Stat em blocos."""

    cache = Path(cache_dir)
    frames: list[pd.DataFrame] = []
    dtype = {
        "CO_NCM": "string",
        "CO_UNID": "string",
        "CO_PAIS": "string",
        "SG_UF_NCM": "string",
        "CO_VIA": "string",
        "CO_URF": "string",
    }
    for year in years:
        for flow in flows:
            code = flow.upper()
            source = _download(comex_url(int(year), code), cache / f"{code}_{year}.csv")
            for chunk in pd.read_csv(
                source, sep=";", dtype=dtype, chunksize=chunksize, low_memory=False
            ):
                frames.append(adapt_comex_frame(chunk, code))
    if not frames:
        raise PipelineValidationError("Nenhum ano/fluxo foi solicitado ao Comex Stat.")
    return pd.concat(frames, ignore_index=True)


def _read_mapping(source: Path) -> pd.DataFrame:
    suffix = source.suffix.lower()
    if suffix in {".xlsx", ".xls", ".ods"}:
        return pd.read_excel(source, dtype="string")
    if suffix == ".csv":
        return pd.read_csv(source, sep=None, engine="python", dtype="string")
    raise PipelineValidationError(f"Formato não suportado para o De–Para: {suffix}.")


def adapt_ncm_prodlist_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Detecta as duas colunas oficiais e devolve NCM e Prodlist canônicas."""

    def normalized(value: object) -> str:
        return re.sub(r"[^A-Z0-9]", "", str(value).upper())

    prodlist_candidates = [c for c in frame.columns if "PRODLIST" in normalized(c)]
    ncm_candidates = [c for c in frame.columns if normalized(c).startswith("NCM")]
    if not prodlist_candidates or not ncm_candidates:
        raise PipelineValidationError(
            "Não foi possível identificar as colunas PRODLIST e NCM no De–Para."
        )

    result = frame[[ncm_candidates[0], prodlist_candidates[0]]].rename(
        columns={ncm_candidates[0]: "ncm", prodlist_candidates[0]: "prodlist_code"}
    )
    result = result.dropna(how="any").astype("string")
    # A planilha oficial 2022 contém duas células literais "Vazio" na coluna
    # NCM. Elas representam ausência de correspondência, não um código fiscal.
    valid_ncm = result["ncm"].str.replace(r"[^0-9]", "", regex=True).str.len().eq(8)
    if (~valid_ncm).any():
        LOGGER.warning(
            "%d linha(s) do De–Para sem NCM-8 foram descartadas.", int((~valid_ncm).sum())
        )
    result = result.loc[valid_ncm]
    return result.drop_duplicates().reset_index(drop=True)


def load_ncm_prodlist(
    *,
    version: int = 2022,
    source: str | Path | None = None,
    cache_dir: str | Path = "dados/cache",
) -> pd.DataFrame:
    """Carrega o De–Para oficial CONCLA, ou um arquivo explicitamente fornecido."""

    if source is None:
        if version not in PRODLIST_URLS:
            raise PipelineValidationError(
                f"Sem URL oficial configurada para Prodlist {version}; informe --mapping-source."
            )
        path = _download(
            PRODLIST_URLS[version], Path(cache_dir) / f"ncm_prodlist_{version}.xlsx"
        )
    else:
        source_text = str(source)
        if source_text.startswith(("http://", "https://")):
            suffix = Path(source_text.split("?", 1)[0]).suffix or ".xlsx"
            path = _download(source_text, Path(cache_dir) / f"ncm_prodlist_{version}{suffix}")
        else:
            path = Path(source)
            if not path.exists():
                raise PipelineValidationError(f"Arquivo De–Para inexistente: {path}.")
    return adapt_ncm_prodlist_frame(_read_mapping(path))


def _pia_table(year: int) -> int:
    if 2014 <= year <= 2023:
        return 7752
    if year == 2024:
        return 10476
    raise PipelineValidationError(
        f"Ano {year} fora das séries PIA-Produto integradas (2014–2024)."
    )


def pia_api_url(year: int, *, variable: int = 215) -> str:
    """Monta a consulta oficial do valor da produção no SIDRA (mil R$)."""

    query = urlencode(
        {"localidades": "N1[all]", "classificacao": "1264[all]"}, quote_via=quote
    )
    return (
        f"{SIDRA_API_BASE}/{_pia_table(year)}/periodos/{year}/"
        f"variaveis/{variable}?{query}"
    )


def adapt_pia_response(payload: list[dict], year: int) -> pd.DataFrame:
    """Converte a resposta hierárquica do SIDRA em produtos Prodlist."""

    rows: list[dict] = []
    for variable in payload:
        for result in variable.get("resultados", []):
            classifications = result.get("classificacoes", [])
            if not classifications:
                continue
            category = classifications[0].get("categoria", {})
            label = next(iter(category.values()), "")
            match = re.match(r"^(\d{4}\.\d{4})\s+(.*)$", label)
            if not match:  # exclui total e linhas agregadas de classe CNAE
                continue
            raw_value = result.get("series", [{}])[0].get("serie", {}).get(str(year))
            numeric = pd.to_numeric(raw_value, errors="coerce")
            status = (
                "published"
                if pd.notna(numeric)
                else "confidential"
                if raw_value == "X"
                else "not_available"
            )
            prodlist_code, description = match.groups()
            rows.append(
                {
                    "year": year,
                    "prodlist_code": prodlist_code,
                    "cnae_class": prodlist_code[:4],
                    "product_description": description,
                    "production_value_thousand_brl": numeric,
                    "production_status": status,
                }
            )
    if not rows:
        raise PipelineValidationError("A resposta SIDRA não contém produtos Prodlist.")
    return pd.DataFrame(rows)


def load_domestic_production(years: Iterable[int]) -> pd.DataFrame:
    """Consulta a PIA-Produto real e preserva sigilo/indisponibilidade."""

    frames: list[pd.DataFrame] = []
    for year in years:
        request = Request(pia_api_url(int(year)), headers={"User-Agent": "BorderValue/1.0"})
        with urlopen(request, timeout=180) as response:
            body = response.read()
            if response.headers.get("Content-Encoding", "").lower() == "gzip":
                body = gzip.decompress(body)
            payload = json.loads(body.decode("utf-8-sig"))
        frames.append(adapt_pia_response(payload, int(year)))
    if not frames:
        raise PipelineValidationError("Nenhum ano foi solicitado à PIA-Produto.")
    return pd.concat(frames, ignore_index=True)


def connect_real_sources(
    years: Sequence[int],
    *,
    flows: Sequence[str] = ("EXP", "IMP"),
    prodlist_version: int = 2022,
    mapping_source: str | Path | None = None,
    cache_dir: str | Path = "dados/cache",
) -> RealSourceResult:
    """Executa as três conexões e constrói o modelo harmonizado."""

    cache = Path(cache_dir)
    trade = load_comex_stat(years, flows=flows, cache_dir=cache / "comex")
    mapping = load_ncm_prodlist(
        version=prodlist_version, source=mapping_source, cache_dir=cache
    )
    production = load_domestic_production(years)
    model = build_relational_model(
        trade,
        mapping,
        production,
        trade_grain_cols=["year", "month", "flow"],
        production_measure_cols=["production_value_thousand_brl"],
        production_grain_cols=["year", "prodlist_code", "production_status"],
    )
    return RealSourceResult(trade, mapping, production, model)


def _safe_ratio(numerator: float | int, denominator: float | int) -> float:
    """Calcula uma proporção sem produzir NaN/inf em cargas vazias."""

    return float(numerator / denominator) if denominator else 0.0


def build_quality_report(result: RealSourceResult) -> dict[str, object]:
    """Produz indicadores auditáveis de qualidade e reconciliação da carga."""

    model = result.model
    trade = result.trade.copy()
    production = result.domestic_production.copy()
    bridge = model.bridge_ncm_prodlist_cnae
    if "year" in bridge.columns and "year" in trade.columns:
        mapped_ncm = pd.MultiIndex.from_frame(bridge[["year", "ncm"]].drop_duplicates())
        trade_mapped = pd.MultiIndex.from_frame(trade[["year", "ncm"]]).isin(mapped_ncm)
    else:
        mapped_ncm = set(bridge["ncm"].dropna().unique())
        trade_mapped = trade["ncm"].isin(mapped_ncm)

    if "year" in bridge.columns and "year" in production.columns:
        mapped_cnae = pd.MultiIndex.from_frame(
            bridge[["year", "cnae_class"]].dropna().drop_duplicates()
        )
        production_mapped = pd.MultiIndex.from_frame(
            production[["year", "cnae_class"]]
        ).isin(mapped_cnae)
    else:
        mapped_cnae = set(bridge["cnae_class"].dropna().unique())
        production_mapped = production["cnae_class"].isin(mapped_cnae)

    annual_ncm = "year" in bridge.columns and "year" in trade.columns
    ncm_count_columns = ["year", "ncm"] if annual_ncm else ["ncm"]
    total_ncm = int(trade[ncm_count_columns].drop_duplicates().shape[0])
    mapped_ncm_count = int(
        trade.loc[trade_mapped, ncm_count_columns].drop_duplicates().shape[0]
    )
    total_trade_value = float(trade["value_usd"].sum())
    mapped_trade_value = float(trade.loc[trade_mapped, "value_usd"].sum())
    total_trade_weight = float(trade["net_weight_kg"].sum())
    mapped_trade_weight = float(trade.loc[trade_mapped, "net_weight_kg"].sum())

    annual_cnae = "year" in bridge.columns and "year" in production.columns
    cnae_count_columns = ["year", "cnae_class"] if annual_cnae else ["cnae_class"]
    total_cnae = int(production[cnae_count_columns].drop_duplicates().shape[0])
    mapped_cnae_count = int(
        production.loc[production_mapped, cnae_count_columns].drop_duplicates().shape[0]
    )
    production_measure = "production_value_thousand_brl"
    total_production_value = float(production[production_measure].sum())
    mapped_production_value = float(
        production.loc[production_mapped, production_measure].sum()
    )

    fact_trade_value = float(model.fact_trade["value_usd"].sum())
    fact_trade_weight = float(model.fact_trade["net_weight_kg"].sum())
    fact_production_value = float(model.fact_production[production_measure].sum())

    trade_grain = [
        column for column in ("year", "month", "flow", "ncm")
        if column in model.fact_trade.columns
    ]
    production_grain = [
        column for column in
        ("year", "prodlist_code", "production_status", "cnae_class")
        if column in model.fact_production.columns
    ]

    return {
        "coverage": {
            "ncm": {
                "total": total_ncm,
                "mapped": mapped_ncm_count,
                "rate": _safe_ratio(mapped_ncm_count, total_ncm),
            },
            "trade_value_usd": {
                "total": total_trade_value,
                "mapped": mapped_trade_value,
                "rate": _safe_ratio(mapped_trade_value, total_trade_value),
            },
            "domestic_cnae": {
                "total": total_cnae,
                "mapped": mapped_cnae_count,
                "rate": _safe_ratio(mapped_cnae_count, total_cnae),
            },
            "production_value_thousand_brl": {
                "total": total_production_value,
                "mapped": mapped_production_value,
                "rate": _safe_ratio(mapped_production_value, total_production_value),
            },
        },
        "unmapped": {
            "ncm_count": total_ncm - mapped_ncm_count,
            "trade_value_usd": total_trade_value - mapped_trade_value,
            "net_weight_kg": total_trade_weight - mapped_trade_weight,
            "domestic_cnae_count": total_cnae - mapped_cnae_count,
            "production_value_thousand_brl": (
                total_production_value - mapped_production_value
            ),
        },
        "duplicates": {
            "trade_exact_rows": int(result.trade.duplicated().sum()),
            "ncm_prodlist_exact_rows": int(result.ncm_prodlist.duplicated().sum()),
            "ncm_prodlist_pairs": int(
                result.ncm_prodlist.duplicated(["ncm", "prodlist_code"]).sum()
            ),
            "domestic_production_exact_rows": int(
                result.domestic_production.duplicated().sum()
            ),
            "bridge_exact_rows": int(model.bridge_ncm_prodlist_cnae.duplicated().sum()),
            "fact_trade_grain_rows": int(
                model.fact_trade.duplicated(trade_grain).sum() if trade_grain else 0
            ),
            "fact_production_grain_rows": int(
                model.fact_production.duplicated(production_grain).sum()
                if production_grain else 0
            ),
        },
        "control_totals": {
            "trade_value_usd": {
                "source": total_trade_value,
                "fact": fact_trade_value,
                "difference": fact_trade_value - total_trade_value,
            },
            "net_weight_kg": {
                "source": total_trade_weight,
                "fact": fact_trade_weight,
                "difference": fact_trade_weight - total_trade_weight,
            },
            "production_value_thousand_brl": {
                "source": total_production_value,
                "fact": fact_production_value,
                "difference": fact_production_value - total_production_value,
            },
        },
    }


def write_result(result: RealSourceResult, output_dir: str | Path) -> None:
    """Grava tabelas, manifesto resumido e relatório detalhado de qualidade."""

    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    tables = tables_as_mapping(result.model)
    for name, frame in tables.items():
        frame.to_csv(output / f"{name}.csv", sep=";", index=False, encoding="utf-8-sig")
    quality_report = build_quality_report(result)
    manifest = {
        "rows": {name: len(frame) for name, frame in tables.items()},
        "trade_value_usd": float(result.model.fact_trade["value_usd"].sum()),
        "ncm_without_prodlist": quality_report["unmapped"]["ncm_count"],
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output / "relatorio_qualidade.json").write_text(
        json.dumps(quality_report, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Conecta e harmoniza as bases oficiais.")
    parser.add_argument("--years", nargs="+", type=int, required=True)
    parser.add_argument("--flows", nargs="+", default=["EXP", "IMP"])
    parser.add_argument("--prodlist-version", type=int, default=2022)
    parser.add_argument("--mapping-source")
    parser.add_argument("--cache-dir", default="dados/cache")
    parser.add_argument("--output-dir", default="dados/processados")
    args = parser.parse_args(argv)

    result = connect_real_sources(
        args.years,
        flows=args.flows,
        prodlist_version=args.prodlist_version,
        mapping_source=args.mapping_source,
        cache_dir=args.cache_dir,
    )
    write_result(result, args.output_dir)
    LOGGER.info("Carga concluída em %s", args.output_dir)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    raise SystemExit(main())
