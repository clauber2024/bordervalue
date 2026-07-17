from __future__ import annotations

import json
import gzip
import math
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, urlopen

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dashboard" / "data.json"
TRADE_OUT = ROOT / "dashboard" / "trade_dashboard.parquet"
EMPLOYMENT_OUT = ROOT / "dashboard" / "employment_dashboard.parquet"
GDP_OUT = ROOT / "dashboard" / "gdp_dashboard.parquet"
FINAL = ROOT / "outputs" / "final_border_value_2026"
OFFICIAL = ROOT / "outputs" / "official_2026"
OFFICIAL_RAIS = ROOT / "outputs" / "official_2026_rais"
INPUTS = ROOT / "inputs" / "official"
MUNICIPALITY_DIM = ROOT / "dados" / "cache" / "dim_municipio_ibge.csv"
COUNTRY_DIM = ROOT / "dados" / "cache" / "dim_pais_comex.csv"
MUNICIPALITY_GEO_DIR = ROOT / "dashboard" / "geo"
TSB_DIR = ROOT / "dados" / "tsb"
TSB_REFERENCE_FILES = {
    "dim_tsb_cnae5": TSB_DIR / "dim_tsb_cnae5.csv",
    "dim_scn67_tsb": TSB_DIR / "dim_scn67_tsb.csv",
    "multiplicadores_scn67": TSB_DIR / "multiplicadores_scn67.csv",
    "fontes_tsb_robustez": TSB_DIR / "fontes_tsb_robustez.csv",
}
TSB_BRIDGE = ROOT / "outputs" / "tsb_bridge_2026"
TSB_BRIDGE_FILES = {
    "bridge_tsb_cnae_class": TSB_BRIDGE / "bridge_tsb_cnae_class.csv",
    "bridge_tsb_ncm": TSB_BRIDGE / "bridge_tsb_ncm.csv",
    "rais_tsb_employment_cnae": TSB_BRIDGE / "rais_tsb_employment_cnae.csv",
    "rais_tsb_employment_territory": TSB_BRIDGE / "rais_tsb_employment_territory.csv",
    "rais_tsb_employment_summary": TSB_BRIDGE / "rais_tsb_employment_summary.csv",
}
IBGE_MUNICIPALITIES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
COMEX_COUNTRIES_URL = "https://balanca.economia.gov.br/balanca/bd/tabelas/PAIS.csv"
IBGE_MUNICIPALITY_MESH_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/{uf_code}"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
EMPLOYMENT_PLATFORM_CNAE_OUT = OFFICIAL_RAIS / "employment_platform_cnae.csv"
EMPLOYMENT_SCOPE_SUMMARY_OUT = OFFICIAL_RAIS / "employment_scope_summary.csv"
EMPLOYMENT_TERRITORY_CNAE_OUT = OFFICIAL_RAIS / "employment_territory_cnae.csv"
GDP_TERRITORY_OUT = OFFICIAL_RAIS / "gdp_territory.csv"
TRANSITION_FUEL_FILES = {
    "indicators": FINAL / "indicadores_combustiveis_transicao_camada.csv",
    "ncm_drivers": FINAL / "drivers_combustiveis_transicao_ncm.csv",
    "complementary_sources": FINAL / "fontes_complementares_combustiveis_transicao.csv",
    "framework": FINAL / "estrutura_analitica_hidrogenio_amonia.csv",
}

UF_IBGE_CODES = {
    "RO": "11",
    "AC": "12",
    "AM": "13",
    "RR": "14",
    "PA": "15",
    "AP": "16",
    "TO": "17",
    "MA": "21",
    "PI": "22",
    "CE": "23",
    "RN": "24",
    "PB": "25",
    "PE": "26",
    "AL": "27",
    "SE": "28",
    "BA": "29",
    "MG": "31",
    "ES": "32",
    "RJ": "33",
    "SP": "35",
    "PR": "41",
    "SC": "42",
    "RS": "43",
    "MS": "50",
    "MT": "51",
    "GO": "52",
    "DF": "53",
}


def num(value):
    if pd.isna(value):
        return None
    return float(value)


def text(value):
    if pd.isna(value):
        return ""
    return str(value)


def compact_records(df: pd.DataFrame) -> list[dict]:
    records = df.astype(object).where(pd.notna(df), None).to_dict(orient="records")
    return clean_json_value(records)


def read_optional_csv(path: Path, **kwargs) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path, **kwargs)


def read_reference_csv(path: Path, columns: list[str], dtype: str | dict = "string") -> pd.DataFrame:
    frame = read_optional_csv(path, dtype=dtype)
    if frame.empty:
        return pd.DataFrame(columns=columns)
    return frame.reindex(columns=columns)


def clean_json_value(value):
    if isinstance(value, dict):
        return {key: clean_json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [clean_json_value(item) for item in value]
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if pd.isna(value):
        return None
    if isinstance(value, str):
        return repair_text(value)
    return value


def repair_text(value: str) -> str:
    if not any(marker in value for marker in ("Ã", "Â", "â")):
        return value
    try:
        fixed = value.encode("latin-1").decode("utf-8")
    except UnicodeError:
        return value
    return fixed if fixed else value


def load_municipality_dimension() -> pd.DataFrame:
    if MUNICIPALITY_DIM.exists() and MUNICIPALITY_DIM.stat().st_size:
        dim = pd.read_csv(MUNICIPALITY_DIM, dtype={"municipality_code": "string"})
        dim["municipality_code"] = dim["municipality_code"].astype("string").str.zfill(7).str[:6]
        return dim.drop_duplicates(["municipality_code", "uf"])

    MUNICIPALITY_DIM.parent.mkdir(parents=True, exist_ok=True)
    request = Request(
        IBGE_MUNICIPALITIES_URL,
        headers={"User-Agent": "BorderValue/1.0", "Accept-Encoding": "identity"},
    )
    with urlopen(request, timeout=120) as response:
        raw = response.read()
        if response.headers.get("Content-Encoding", "").lower() == "gzip" or raw.startswith(b"\x1f\x8b"):
            raw = gzip.decompress(raw)
        payload = json.loads(raw.decode("utf-8"))
    rows = []
    for item in payload:
        micro = item.get("microrregiao") or {}
        meso = micro.get("mesorregiao") or {}
        immediate = item.get("regiao-imediata") or {}
        intermediate = immediate.get("regiao-intermediaria") or {}
        uf = meso.get("UF") or intermediate.get("UF") or {}
        region = uf.get("regiao", {})
        rows.append(
            {
                "municipality_code": str(item.get("id", "")).zfill(7)[:6],
                "municipality_name": item.get("nome", ""),
                "uf": uf.get("sigla", ""),
                "uf_name": uf.get("nome", ""),
                "region_code": region.get("id", ""),
                "region_name": region.get("nome", ""),
            }
        )
    dim = pd.DataFrame(rows).sort_values(["uf", "municipality_name"], kind="stable")
    dim.to_csv(MUNICIPALITY_DIM, index=False, encoding="utf-8-sig")
    return dim


def load_country_dimension() -> pd.DataFrame:
    if not COUNTRY_DIM.exists() or COUNTRY_DIM.stat().st_size == 0:
        COUNTRY_DIM.parent.mkdir(parents=True, exist_ok=True)
        request = Request(COMEX_COUNTRIES_URL, headers={"User-Agent": "BorderValue/1.0"})
        with urlopen(request, timeout=120) as response:
            raw = response.read()
            if response.headers.get("Content-Encoding", "").lower() == "gzip" or raw.startswith(b"\x1f\x8b"):
                raw = gzip.decompress(raw)
        COUNTRY_DIM.write_bytes(raw)
    countries = pd.read_csv(COUNTRY_DIM, sep=";", dtype="string", encoding="latin-1")
    countries = countries.rename(
        columns={
            "CO_PAIS": "country_code",
            "CO_PAIS_ISOA3": "country_iso3",
            "NO_PAIS": "country_name",
        }
    )
    countries["country_code"] = countries["country_code"].astype("string").str.zfill(3)
    return countries[["country_code", "country_iso3", "country_name"]].drop_duplicates("country_code")


def cache_municipality_meshes(ufs: list[str]) -> dict[str, str]:
    MUNICIPALITY_GEO_DIR.mkdir(parents=True, exist_ok=True)
    cached = {}
    for uf in sorted(set(ufs)):
        uf_code = UF_IBGE_CODES.get(uf)
        if not uf_code:
            continue
        out = MUNICIPALITY_GEO_DIR / f"municipios_{uf}.geojson"
        if not out.exists() or out.stat().st_size == 0:
            request = Request(
                IBGE_MUNICIPALITY_MESH_URL.format(uf_code=uf_code),
                headers={"User-Agent": "BorderValue/1.0", "Accept-Encoding": "identity"},
            )
            try:
                with urlopen(request, timeout=120) as response:
                    raw = response.read()
                    if response.headers.get("Content-Encoding", "").lower() == "gzip" or raw.startswith(b"\x1f\x8b"):
                        raw = gzip.decompress(raw)
                payload = json.loads(raw.decode("utf-8"))
                for feature in payload.get("features", []):
                    props = feature.setdefault("properties", {})
                    code = str(props.get("codarea", "")).zfill(7)
                    props["municipality_code"] = code[:6]
                    props["ibge_code"] = code
                    props["uf"] = uf
                out.write_text(
                    json.dumps(clean_json_value(payload), ensure_ascii=False, separators=(",", ":"), allow_nan=False),
                    encoding="utf-8",
                )
            except Exception as exc:
                print(f"warning: could not cache municipality mesh for {uf}: {exc}")
                if not out.exists():
                    continue
        cached[uf] = f"geo/{out.name}"
    return cached


def source_status(path: Path, label: str, cadence: str, owner: str, kind: str, update_key: str) -> dict:
    stat = path.stat() if path.exists() else None
    return {
        "label": label,
        "path": str(path.relative_to(ROOT)).replace("\\", "/"),
        "kind": kind,
        "cadence": cadence,
        "owner": owner,
        "status": "Disponivel" if stat else "Ausente",
        "last_modified": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat() if stat else None,
        "size_bytes": stat.st_size if stat else None,
        "update_key": update_key,
    }


def build_etl_metadata() -> dict:
    official = OFFICIAL_RAIS if (OFFICIAL_RAIS / "manifest.json").exists() else OFFICIAL
    manifest_path = official / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    metadata = manifest.get("metadata", {})
    tables = manifest.get("tables", {})
    quality_path = official / "quality_summary.csv"
    quality = pd.read_csv(quality_path) if quality_path.exists() else pd.DataFrame(columns=["metric", "value", "description"])

    controls = [
        {
            "control": "Arquivos obrigatorios",
            "severity": "Critico",
            "status": "OK" if all((INPUTS / f).exists() for f in ["EXP_2026.csv", "IMP_2026.csv", "ncm_prodlist_2025.xlsx"]) else "Bloqueia",
            "evidence": "EXP_2026.csv, IMP_2026.csv e ponte NCM-PRODLIST localizados em inputs/official.",
        },
        {
            "control": "Periodo esperado",
            "severity": "Critico",
            "status": "OK" if metadata.get("trade_period") == "2026-01 a 2026-06" else "Revisar",
            "evidence": metadata.get("trade_period", "Periodo nao identificado no manifest."),
        },
        {
            "control": "Ponte NCM-PRODLIST-CNAE",
            "severity": "Critico",
            "status": "OK" if tables.get("bridge_ncm_prodlist_cnae", {}).get("rows", 0) > 0 else "Bloqueia",
            "evidence": f"{tables.get('bridge_ncm_prodlist_cnae', {}).get('rows', 0):,} linhas na ponte oficial.".replace(",", "."),
        },
        {
            "control": "Resumo de qualidade",
            "severity": "Alerta",
            "status": "OK" if not quality.empty else "Revisar",
            "evidence": f"{len(quality)} metricas em {quality_path.relative_to(ROOT).as_posix()}.",
        },
        {
            "control": "NCM sem ponte",
            "severity": "Alerta",
            "status": "Revisar" if tables.get("audit_unmatched_ncm", {}).get("rows", 0) else "OK",
            "evidence": f"{tables.get('audit_unmatched_ncm', {}).get('rows', 0):,} NCM sem ponte para triagem.".replace(",", "."),
        },
        {
            "control": "CNAE sem PIA",
            "severity": "Alerta",
            "status": "Revisar" if tables.get("audit_unmatched_cnae", {}).get("rows", 0) else "OK",
            "evidence": f"{tables.get('audit_unmatched_cnae', {}).get('rows', 0):,} CNAE sem producao PIA mapeada.".replace(",", "."),
        },
    ]

    return {
        "version": "v2026.06.0",
        "last_run_utc": metadata.get("run_timestamp_utc"),
        "trade_period": metadata.get("trade_period"),
        "production_period": metadata.get("production_period"),
        "allocation_method": metadata.get("allocation_method"),
        "calendar": [
            {"step": "Coleta das fontes", "due": "1o-3o dia util", "owner": "Responsavel tecnico pelos dados"},
            {"step": "Execucao do ETL", "due": "ate 5o dia util", "owner": "Responsavel tecnico pelos dados"},
            {"step": "Validacao e tratamento de alertas", "due": "5o-8o dia util", "owner": "Responsavel de validacao"},
            {"step": "Aprovacao e publicacao", "due": "ate 10o dia util", "owner": "Coordenacao"},
        ],
        "activity_governance": [
            {
                "activity": "RAIS",
                "phase": "Consolidacao, documentacao e testes",
                "note": "Camada ja integrada ao fluxo oficial; tratar como verificacao, rastreabilidade e homologacao.",
            },
            {
                "activity": "Cartografia municipal",
                "phase": "Consolidacao, documentacao e testes",
                "note": "Malhas e dimensoes territoriais devem ser revisadas como suporte ao dashboard, nao como desenvolvimento inicial.",
            },
            {
                "activity": "Mapa mundial",
                "phase": "Consolidacao, documentacao e testes",
                "note": "Visualizacao de parceiros comerciais ja faz parte do produto oficial; foco em validacao e documentacao.",
            },
            {
                "activity": "Integracao",
                "phase": "Consolidacao, documentacao e testes",
                "note": "Integra os modulos existentes; nao abrir como frente inicial separada.",
            },
            {
                "activity": "Automacao",
                "phase": "Consolidacao, documentacao e testes",
                "note": "Rotinas de atualizacao e reproducao entram como endurecimento operacional.",
            },
            {
                "activity": "Hidrogenio e amonia",
                "phase": "Consolidacao, documentacao e testes",
                "note": "Recorte transversal ja estruturado; manter foco em ressalvas metodologicas, fontes complementares e QA.",
            },
        ],
        "sources": [
            source_status(INPUTS / "EXP_2026.csv", "Comex Stat exportacoes", "Mensal", "Tecnico de dados", "Comercio exterior", "comex_exp"),
            source_status(INPUTS / "IMP_2026.csv", "Comex Stat importacoes", "Mensal", "Tecnico de dados", "Comercio exterior", "comex_imp"),
            source_status(INPUTS / "ncm_prodlist_2025.xlsx", "Ponte NCM-PRODLIST CONCLA/IBGE", "Quando houver nova tabela", "Tecnico de dados", "Correspondencia", "ncm_prodlist"),
            source_status(INPUTS / "pia_2024_value_production.json", "PIA-Produto valor da producao", "Anual", "Tecnico de dados", "Producao domestica", "pia_produto"),
            source_status(OFFICIAL_RAIS / "fact_employment_rais.csv", "RAIS vinculos formais", "Anual", "Tecnico de dados", "Emprego formal", "rais"),
            source_status(OFFICIAL_RAIS / "fact_gdp.csv", "PIB territorial", "Anual", "Tecnico de dados", "PIB", "gdp"),
            source_status(TRANSITION_FUEL_FILES["indicators"], "Hidrogenio, amonia e combustiveis da transicao", "A cada revisao metodologica", "Especialista setorial", "Recorte transversal", "transition_fuels"),
            source_status(TSB_REFERENCE_FILES["dim_tsb_cnae5"], "TSB por CNAE5", "A cada revisao metodologica", "Relatorio TSB", "Referencia metodologica", "tsb_reference"),
            source_status(TSB_REFERENCE_FILES["dim_scn67_tsb"], "Exposicao TSB por SCN67", "A cada revisao metodologica", "Relatorio TSB", "Referencia metodologica", "tsb_reference"),
            source_status(TSB_REFERENCE_FILES["multiplicadores_scn67"], "Multiplicadores SCN67", "A cada revisao metodologica", "Relatorio TSB", "Referencia metodologica", "tsb_reference"),
            source_status(TSB_REFERENCE_FILES["fontes_tsb_robustez"], "Fontes e robustez TSB", "A cada revisao metodologica", "Relatorio TSB", "Referencia metodologica", "tsb_reference"),
            source_status(TSB_BRIDGE_FILES["bridge_tsb_cnae_class"], "Ponte TSB-CNAE classe", "A cada revisao metodologica", "Relatorio TSB + plataforma", "Artefato derivado", "tsb_bridge"),
            source_status(TSB_BRIDGE_FILES["bridge_tsb_ncm"], "Ponte TSB-NCM", "A cada revisao metodologica", "Relatorio TSB + plataforma", "Artefato derivado", "tsb_bridge"),
            source_status(TSB_BRIDGE_FILES["rais_tsb_employment_summary"], "RAIS por exposicao TSB", "A cada revisao RAIS/TSB", "Relatorio TSB + RAIS", "Artefato derivado", "tsb_bridge"),
            source_status(official / "quality_summary.csv", "Resumo automatico de qualidade", "A cada execucao", "Validador tecnico", "Controle", "quality"),
            source_status(official / "manifest.json", "Manifest da execucao oficial", "A cada publicacao", "Responsavel de documentacao", "Metadados", "manifest"),
        ],
        "controls": controls,
        "roles": [
            {"role": "Tecnico de dados", "responsibility": "Atualizar fontes, executar scripts e registrar logs."},
            {"role": "Validador tecnico", "responsibility": "Revisar consistencia, alertas e aderencia metodologica."},
            {"role": "Coordenacao", "responsibility": "Aprovar a versao oficial antes da publicacao."},
            {"role": "Documentacao", "responsibility": "Atualizar changelog, manifest, inventario e pacote de publicacao."},
        ],
    }


def mapping_status(row: pd.Series) -> str:
    if pd.isna(row.get("prodlist_code")):
        return "NCM sem ponte"
    if bool(row.get("is_generic_code")):
        return "NCM generico"
    basis = text(row.get("allocation_basis_status"))
    if basis and basis != "published":
        return "Mapeado com base parcial"
    return "Mapeado"


def read_bridge() -> pd.DataFrame:
    bridge = pd.read_csv(OFFICIAL / "bridge_ncm_prodlist_cnae.csv", dtype={"ncm": str, "prodlist_code": str, "cnae_class": str})
    dim_ncm = pd.read_csv(OFFICIAL / "dim_ncm.csv", dtype={"ncm": str})
    bridge = bridge.merge(dim_ncm[["ncm", "is_generic_code"]], on="ncm", how="left")
    bridge["mapping_status"] = bridge.apply(mapping_status, axis=1)
    return bridge[
        [
            "ncm",
            "prodlist_code",
            "cnae_class",
            "allocation_weight",
            "allocation_rule",
            "allocation_basis_status",
            "mapping_status",
        ]
    ]


def aggregate_trade(bridge: pd.DataFrame) -> pd.DataFrame:
    frames = []
    specs = [
        ("EXP", INPUTS / "EXP_2026.csv"),
        ("IMP", INPUTS / "IMP_2026.csv"),
    ]
    dtypes = {"CO_ANO": str, "CO_MES": str, "CO_NCM": str, "CO_PAIS": str, "KG_LIQUIDO": "float64", "VL_FOB": "float64"}
    usecols = ["CO_ANO", "CO_MES", "CO_NCM", "CO_PAIS", "KG_LIQUIDO", "VL_FOB"]

    for flow, path in specs:
        for chunk in pd.read_csv(path, sep=";", quotechar='"', usecols=usecols, dtype=dtypes, chunksize=150_000):
            chunk = chunk.rename(
                columns={
                    "CO_ANO": "year",
                    "CO_MES": "month",
                    "CO_NCM": "ncm",
                    "CO_PAIS": "country_code",
                    "KG_LIQUIDO": "net_weight_kg",
                    "VL_FOB": "value_usd",
                }
            )
            chunk["flow"] = flow
            merged = chunk.merge(bridge, on="ncm", how="left")
            merged["allocation_weight"] = merged["allocation_weight"].fillna(1.0)
            merged["cnae_class"] = merged["cnae_class"].fillna("NAO_MAPEADO")
            merged["prodlist_code"] = merged["prodlist_code"].fillna("NCM_SEM_PONTE")
            merged["allocation_rule"] = merged["allocation_rule"].fillna("unmatched_ncm")
            merged["allocation_basis_status"] = merged["allocation_basis_status"].fillna("missing")
            merged["mapping_status"] = merged["mapping_status"].fillna("NCM sem ponte")
            merged["allocated_value_usd"] = merged["value_usd"] * merged["allocation_weight"]
            merged["allocated_net_weight_kg"] = merged["net_weight_kg"] * merged["allocation_weight"]
            merged["period"] = merged["year"].astype(str) + "-" + merged["month"].astype(int).astype(str).str.zfill(2)
            grouped = (
                merged.groupby(
                    [
                        "period",
                        "year",
                        "month",
                        "flow",
                        "cnae_class",
                        "prodlist_code",
                        "ncm",
                        "country_code",
                        "mapping_status",
                    ],
                    dropna=False,
                    as_index=False,
                )[["allocated_value_usd", "allocated_net_weight_kg"]]
                .sum()
            )
            frames.append(grouped)

    trade = pd.concat(frames, ignore_index=True)
    trade = (
        trade.groupby(
            ["period", "year", "month", "flow", "cnae_class", "prodlist_code", "ncm", "country_code", "mapping_status"],
            as_index=False,
        )[["allocated_value_usd", "allocated_net_weight_kg"]]
        .sum()
    )
    trade["year"] = trade["year"].astype(int)
    trade["month"] = trade["month"].astype(int)
    return trade


def build_employment_platform_cnae(employment: pd.DataFrame, final_cnae: pd.DataFrame) -> pd.DataFrame:
    if employment.empty:
        return pd.DataFrame()

    if "december_wage_mass" not in employment.columns:
        employment["december_wage_mass"] = employment.get("wage_mass", pd.NA)
    if "average_monthly_wage_mass" not in employment.columns:
        employment["average_monthly_wage_mass"] = pd.NA

    employment_cnae = (
        employment.groupby("cnae_class", as_index=False)[
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
    employment_cnae["rais_average_december_wage"] = (
        employment_cnae["rais_december_wage_mass"] / employment_cnae["rais_formal_jobs"]
    )
    employment_cnae["rais_average_monthly_wage"] = (
        employment_cnae["rais_average_monthly_wage_mass"] / employment_cnae["rais_formal_jobs"]
    )
    employment_cnae.loc[
        ~employment_cnae["rais_formal_jobs"].gt(0),
        ["rais_average_december_wage", "rais_average_monthly_wage"],
    ] = pd.NA
    employment_cnae["rais_wage_mass"] = employment_cnae["rais_december_wage_mass"]
    employment_cnae["rais_average_wage"] = employment_cnae["rais_average_december_wage"]

    keep_cols = [
        column
        for column in [
            "cnae_class",
            "cnae_name",
            "priority_tier",
            "transition_relevance",
            "priority_score",
            "trade_value_usd",
            "import_value_usd",
            "export_value_usd",
            "trade_balance_usd",
            "external_dependency_ratio",
            "external_dependency_status",
            "domestic_production_value_brl_thousand",
            "rationale",
        ]
        if column in final_cnae.columns
    ]
    result = employment_cnae.merge(
        final_cnae[keep_cols].drop_duplicates("cnae_class"),
        on="cnae_class",
        how="left",
    )
    has_platform_indicator = result["cnae_name"].notna() if "cnae_name" in result.columns else pd.Series(False, index=result.index)
    has_priority = (
        result["priority_tier"].astype("string").str.startswith("1 - priorizar", na=False)
        if "priority_tier" in result.columns
        else pd.Series(False, index=result.index)
    )
    result["platform_scope_status"] = "out_of_platform_scope"
    result.loc[has_platform_indicator, "platform_scope_status"] = "platform_scope"
    result.loc[has_priority, "platform_scope_status"] = "platform_priority"
    for column in ["priority_score", "trade_value_usd", "external_dependency_ratio"]:
        if column in result.columns:
            result[column] = pd.to_numeric(result[column], errors="coerce")
    jobs_rank = result["rais_formal_jobs"].rank(pct=True)
    priority = result.get("priority_score", pd.Series(0, index=result.index)).fillna(0)
    dependency = result.get("external_dependency_ratio", pd.Series(0, index=result.index)).fillna(0).clip(lower=0, upper=1)
    result["employment_platform_prelim_score"] = (0.45 * jobs_rank) + (0.35 * priority) + (0.20 * dependency)
    result["employment_platform_score"] = result["employment_platform_prelim_score"]
    result["employment_platform_score_status"] = "preliminar_exploratorio"
    result["employment_platform_score_formula"] = (
        "0.45*percentil_vinculos_rais + 0.35*priority_score + 0.20*external_dependency_ratio"
    )
    result["platform_link_status"] = result["priority_tier"].fillna(result["platform_scope_status"])
    return result.sort_values("employment_platform_prelim_score", ascending=False, kind="stable").reset_index(drop=True)


def build_employment_scope_summary(employment_platform: pd.DataFrame) -> pd.DataFrame:
    if employment_platform.empty:
        return pd.DataFrame(columns=["platform_scope_status", "cnae_count", "formal_jobs", "december_wage_mass"])
    summary = (
        employment_platform.groupby("platform_scope_status", as_index=False)[
            ["rais_formal_jobs", "rais_december_wage_mass"]
        ]
        .sum(min_count=1)
        .rename(
            columns={
                "rais_formal_jobs": "formal_jobs",
                "rais_december_wage_mass": "december_wage_mass",
            }
        )
    )
    counts = (
        employment_platform.groupby("platform_scope_status", as_index=False)["cnae_class"]
        .nunique()
        .rename(columns={"cnae_class": "cnae_count"})
    )
    summary = summary.merge(counts, on="platform_scope_status", how="left")
    total_jobs = summary["formal_jobs"].sum()
    total_wage = summary["december_wage_mass"].sum()
    summary["formal_jobs_share"] = summary["formal_jobs"] / total_jobs if total_jobs else 0
    summary["december_wage_mass_share"] = summary["december_wage_mass"] / total_wage if total_wage else 0
    order = {"platform_priority": 0, "platform_scope": 1, "out_of_platform_scope": 2}
    summary["_order"] = summary["platform_scope_status"].map(order).fillna(99)
    return summary.sort_values("_order").drop(columns="_order").reset_index(drop=True)


def first_list_value(value: object) -> str:
    parts = [part for part in str(value or "").split(";") if part]
    return parts[0] if parts else ""


def percent_rank(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce").fillna(0)
    if numeric.nunique(dropna=True) <= 1:
        return pd.Series(0.0, index=series.index)
    return numeric.rank(pct=True, method="average")


def build_tsb_operational_cnae(
    rais_tsb_cnae: pd.DataFrame,
    bridge_tsb_cnae_class: pd.DataFrame,
    final_cnae: pd.DataFrame,
    multiplicadores_scn67: pd.DataFrame,
) -> pd.DataFrame:
    if rais_tsb_cnae.empty:
        return pd.DataFrame()

    result = rais_tsb_cnae.copy()
    for column in ["formal_jobs", "wage_mass", "december_wage_mass", "tsb_exposicao_scn67_max"]:
        if column in result.columns:
            result[column] = pd.to_numeric(result[column], errors="coerce")
    result = result.loc[result.get("tsb_associated", False).astype(bool)].copy()
    if result.empty:
        return result

    bridge_cols = [
        column
        for column in [
            "cnae_class",
            "tsb_cnae5_count",
            "tsb_cnae5_list",
            "tsb_scn67_list",
            "tsb_setor_scn67_list",
            "tsb_leitura_tecnica",
        ]
        if column in bridge_tsb_cnae_class.columns
    ]
    if bridge_cols:
        result = result.merge(
            bridge_tsb_cnae_class[bridge_cols].drop_duplicates("cnae_class"),
            on="cnae_class",
            how="left",
        )

    final_cols = [
        column
        for column in [
            "cnae_class",
            "cnae_name",
            "priority_tier",
            "priority_score",
            "trade_value_usd",
            "import_value_usd",
            "export_value_usd",
            "external_dependency_ratio",
            "external_dependency_status",
            "rationale",
        ]
        if column in final_cnae.columns
    ]
    if final_cols:
        result = result.merge(final_cnae[final_cols].drop_duplicates("cnae_class"), on="cnae_class", how="left")

    multipliers = multiplicadores_scn67.loc[
        multiplicadores_scn67.get("scn67", pd.Series(dtype="string")).notna()
        & multiplicadores_scn67.get("multiplicador_emprego", pd.Series(dtype="float64")).notna()
    ].copy()
    multiplier_by_scn = {}
    if not multipliers.empty:
        multipliers["scn67"] = multipliers["scn67"].astype("string").str.zfill(4)
        multipliers["employment_multiplier"] = multipliers["multiplicador_emprego_tsb"].fillna(
            multipliers["multiplicador_emprego"]
        )
        multiplier_by_scn = multipliers.set_index("scn67")["employment_multiplier"].to_dict()

    def max_multiplier(value: object):
        values = [multiplier_by_scn.get(part) for part in str(value or "").split(";") if part in multiplier_by_scn]
        values = [value for value in values if pd.notna(value)]
        return max(values) if values else pd.NA

    result["primary_scn67"] = result.get("tsb_scn67_list", pd.Series("", index=result.index)).map(first_list_value)
    result["primary_setor_scn67"] = result.get("tsb_setor_scn67_list", pd.Series("", index=result.index)).map(first_list_value)
    result["employment_multiplier_tsb"] = result.get("tsb_scn67_list", pd.Series("", index=result.index)).map(max_multiplier)
    result["priority_border_value"] = result.get("priority_tier", pd.Series("", index=result.index)).fillna("")
    if "tsb_platform_alignment_score" not in result.columns:
        for column in ["tsb_exposicao_scn67_max", "priority_score", "formal_jobs", "wage_mass", "external_dependency_ratio", "trade_value_usd"]:
            if column not in result.columns:
                result[column] = 0.0
            result[column] = pd.to_numeric(result[column], errors="coerce").fillna(0.0)
        result["tsb_exposure_component_score"] = result["tsb_exposicao_scn67_max"].clip(lower=0, upper=1)
        result["border_value_relevance_component_score"] = result["priority_score"].clip(lower=0, upper=1)
        result["rais_scale_component_score"] = pd.concat(
            [percent_rank(result["formal_jobs"]), percent_rank(result["wage_mass"])],
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
    result["wage_mass_share_within_tsb"] = result["wage_mass"] / result["wage_mass"].sum() if result["wage_mass"].sum() else 0
    result["jobs_share_within_tsb"] = result["formal_jobs"] / result["formal_jobs"].sum() if result["formal_jobs"].sum() else 0
    return result.sort_values(["tsb_platform_alignment_score", "wage_mass"], ascending=[False, False], kind="stable").reset_index(drop=True)


def build_tsb_operational_summary(tsb_cnae: pd.DataFrame, rais_tsb_summary: pd.DataFrame) -> dict:
    associated = rais_tsb_summary.loc[rais_tsb_summary.get("tsb_associated", False).astype(bool)].copy()
    total = rais_tsb_summary.copy()
    wage = float(associated["wage_mass"].sum()) if "wage_mass" in associated.columns else 0
    jobs = float(associated["formal_jobs"].sum()) if "formal_jobs" in associated.columns else 0
    total_wage = float(total["wage_mass"].sum()) if "wage_mass" in total.columns else 0
    total_jobs = float(total["formal_jobs"].sum()) if "formal_jobs" in total.columns else 0
    return {
        "formal_jobs_tsb": jobs,
        "wage_mass_tsb": wage,
        "formal_jobs_share_total_rais": jobs / total_jobs if total_jobs else 0,
        "wage_mass_share_total_rais": wage / total_wage if total_wage else 0,
        "report_industrial_wage_share": 0.27078,
        "report_main_cnae_count": 64,
        "report_exposed_industrial_sectors": 15,
        "operational_cnae_count": int(tsb_cnae["cnae_class"].nunique()) if "cnae_class" in tsb_cnae.columns else 0,
        "operational_scn67_count": int(
            tsb_cnae.get("primary_scn67", pd.Series(dtype="string")).replace("", pd.NA).dropna().nunique()
        ),
    }


def main() -> None:
    bridge = read_bridge()
    trade = aggregate_trade(bridge)
    municipality_dim = load_municipality_dimension()
    country_dim = load_country_dimension()

    rais_indicators_path = OFFICIAL_RAIS / "border_value_indicators_cnae.csv"
    indicators_cnae = (
        pd.read_csv(rais_indicators_path, dtype={"cnae_class": str})
        if rais_indicators_path.exists()
        else pd.read_csv(FINAL / "border_value_indicadores_finais_cnae.csv", dtype={"cnae_class": str})
    )
    final_cnae = pd.read_csv(FINAL / "border_value_indicadores_finais_cnae.csv", dtype={"cnae_class": str})
    final_label_cols = [
        column
        for column in ["cnae_class", "cnae_name", "priority_tier", "transition_relevance"]
        if column in final_cnae.columns
    ]
    if "cnae_name" not in indicators_cnae.columns and final_label_cols:
        indicators_cnae = indicators_cnae.merge(
            final_cnae[final_label_cols].drop_duplicates("cnae_class"),
            on="cnae_class",
            how="left",
        )
    indicators_prod = pd.read_csv(
        FINAL / "border_value_indicadores_finais_cnae_prodlist.csv",
        dtype={"cnae_class": str, "prodlist_code": str},
    )

    cnae_labels = (
        indicators_cnae[["cnae_class", "cnae_name", "priority_tier", "transition_relevance"]]
        .drop_duplicates("cnae_class")
        .fillna("")
    )
    prod_labels = (
        indicators_prod[["prodlist_code", "prodlist_name", "cnae_class", "cnae_name"]]
        .drop_duplicates(["prodlist_code", "cnae_class"])
        .fillna("")
    )

    employment_path = OFFICIAL_RAIS / "fact_employment_rais.csv"
    if employment_path.exists():
        employment = pd.read_csv(
            employment_path,
            dtype={"uf": "string", "municipality_code": "string", "cnae_class": "string"},
        )
        for column in [
            "formal_jobs",
            "wage_mass",
            "average_wage",
            "december_wage_mass",
            "average_december_wage",
            "average_monthly_wage",
            "average_monthly_wage_mass",
        ]:
            if column in employment.columns:
                employment[column] = pd.to_numeric(employment[column], errors="coerce")
        employment["municipality_code"] = employment["municipality_code"].astype("string").str.zfill(6)
        employment = employment.merge(
            municipality_dim,
            on=["municipality_code", "uf"],
            how="left",
            validate="many_to_one",
        )
        unknown_municipality = employment["municipality_code"].eq("999999")
        employment.loc[unknown_municipality, "municipality_name"] = employment.loc[
            unknown_municipality, "municipality_name"
        ].fillna("Município não informado")
        employment.loc[unknown_municipality, "uf_name"] = employment.loc[unknown_municipality, "uf_name"].fillna(
            "Não informado"
        )
        employment.loc[unknown_municipality, "region_name"] = employment.loc[
            unknown_municipality, "region_name"
        ].fillna("Não informado")
        employment.to_parquet(EMPLOYMENT_OUT, index=False)
    else:
        employment = pd.DataFrame(
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
                "municipality_name",
                "uf_name",
                "region_name",
            ]
        )
        if EMPLOYMENT_OUT.exists():
            EMPLOYMENT_OUT.unlink()

    gdp_path = OFFICIAL_RAIS / "fact_gdp.csv"
    if gdp_path.exists():
        gdp = pd.read_csv(
            gdp_path,
            dtype={"uf": "string", "municipality_code": "string"},
        )
        if "gdp_value_brl" in gdp.columns:
            gdp["gdp_value_brl"] = pd.to_numeric(gdp["gdp_value_brl"], errors="coerce")
        gdp["municipality_code"] = gdp["municipality_code"].astype("string").str.zfill(6)
        gdp = gdp.merge(
            municipality_dim,
            on=["municipality_code", "uf"],
            how="left",
            validate="many_to_one",
        )
        gdp.to_parquet(GDP_OUT, index=False)
    else:
        gdp = pd.DataFrame(
            columns=[
                "year",
                "uf",
                "municipality_code",
                "gdp_value_brl",
                "gdp_status",
                "municipality_name",
                "uf_name",
                "region_name",
            ]
        )
        if GDP_OUT.exists():
            GDP_OUT.unlink()

    employment_platform = build_employment_platform_cnae(employment, final_cnae)
    employment_scope_summary = build_employment_scope_summary(employment_platform)
    OFFICIAL_RAIS.mkdir(parents=True, exist_ok=True)
    employment_platform.to_csv(EMPLOYMENT_PLATFORM_CNAE_OUT, index=False, encoding="utf-8-sig")
    employment_scope_summary.to_csv(EMPLOYMENT_SCOPE_SUMMARY_OUT, index=False, encoding="utf-8-sig")
    employment.to_csv(EMPLOYMENT_TERRITORY_CNAE_OUT, index=False, encoding="utf-8-sig")
    gdp.to_csv(GDP_TERRITORY_OUT, index=False, encoding="utf-8-sig")

    fuel_indicators = read_optional_csv(TRANSITION_FUEL_FILES["indicators"], dtype={"recorte_combustivel": "string", "camada_analitica": "string"})
    fuel_ncm_drivers = read_optional_csv(TRANSITION_FUEL_FILES["ncm_drivers"], dtype={"recorte_combustivel": "string", "camada_analitica": "string", "ncm": "string"})
    fuel_complementary = read_optional_csv(TRANSITION_FUEL_FILES["complementary_sources"], dtype="string")
    fuel_framework = read_optional_csv(TRANSITION_FUEL_FILES["framework"], dtype="string")
    dim_tsb_cnae5 = read_reference_csv(
        TSB_REFERENCE_FILES["dim_tsb_cnae5"],
        ["cnae5", "descricao_cnae5", "scn67", "setor_scn67", "criterio_classificacao"],
    )
    dim_scn67_tsb = read_reference_csv(
        TSB_REFERENCE_FILES["dim_scn67_tsb"],
        ["scn67", "setor_scn67", "exposicao_tsb", "grupo_exposicao", "leitura_tecnica"],
    )
    multiplicadores_scn67 = read_reference_csv(
        TSB_REFERENCE_FILES["multiplicadores_scn67"],
        [
            "tipo_registro",
            "scn67",
            "setor_scn67",
            "grupo_exposicao",
            "multiplicador_producao",
            "multiplicador_renda",
            "multiplicador_emprego",
            "multiplicador_producao_tsb",
            "multiplicador_renda_tsb",
            "multiplicador_emprego_tsb",
            "observacao",
        ],
        dtype={
            "tipo_registro": "string",
            "scn67": "string",
            "setor_scn67": "string",
            "grupo_exposicao": "string",
            "multiplicador_producao": "float64",
            "multiplicador_renda": "float64",
            "multiplicador_emprego": "float64",
            "multiplicador_producao_tsb": "float64",
            "multiplicador_renda_tsb": "float64",
            "multiplicador_emprego_tsb": "float64",
            "observacao": "string",
        },
    )
    fontes_tsb_robustez = read_reference_csv(
        TSB_REFERENCE_FILES["fontes_tsb_robustez"],
        [
            "tipo_registro",
            "nome",
            "natureza_ou_regra",
            "criterio_classificacao",
            "uso_relatorio",
            "interpretacao",
        ],
    )
    bridge_tsb_cnae_class = read_optional_csv(
        TSB_BRIDGE_FILES["bridge_tsb_cnae_class"],
        dtype={"cnae_class": "string", "tsb_cnae5_list": "string", "tsb_scn67_list": "string"},
    )
    bridge_tsb_ncm = read_optional_csv(
        TSB_BRIDGE_FILES["bridge_tsb_ncm"],
        dtype={"ncm": "string", "cnae_class_list": "string", "prodlist_code_list": "string"},
    )
    rais_tsb_summary = read_optional_csv(TSB_BRIDGE_FILES["rais_tsb_employment_summary"], dtype={"year": "string"})
    rais_tsb_territory = read_optional_csv(
        TSB_BRIDGE_FILES["rais_tsb_employment_territory"],
        dtype={"year": "string", "uf": "string", "municipality_code": "string"},
    )
    rais_tsb_cnae = read_optional_csv(
        TSB_BRIDGE_FILES["rais_tsb_employment_cnae"],
        dtype={"year": "string", "cnae_class": "string"},
    )
    if not bridge_tsb_cnae_class.empty:
        bridge_tsb_cnae_class = bridge_tsb_cnae_class.sort_values(
            ["tsb_associated", "tsb_exposicao_scn67_max", "cnae_class"],
            ascending=[False, False, True],
            kind="stable",
        )
    if not bridge_tsb_ncm.empty:
        bridge_tsb_ncm = bridge_tsb_ncm.sort_values(
            ["tsb_associated", "tsb_exposicao_scn67_max", "ncm"],
            ascending=[False, False, True],
            kind="stable",
        ).head(500)
    if not rais_tsb_territory.empty:
        rais_tsb_territory["municipality_code"] = rais_tsb_territory["municipality_code"].astype("string").str.zfill(6)
        territory_label_cols = ["municipality_code", "uf", "municipality_name", "uf_name", "region_name"]
        rais_tsb_territory = rais_tsb_territory.merge(
            municipality_dim[territory_label_cols].drop_duplicates(["municipality_code", "uf"]),
            on=["municipality_code", "uf"],
            how="left",
        )
        rais_tsb_territory = rais_tsb_territory.sort_values(
            ["tsb_associated", "formal_jobs"],
            ascending=[False, False],
            kind="stable",
        ).head(500)
    tsb_operational_cnae = build_tsb_operational_cnae(
        rais_tsb_cnae,
        bridge_tsb_cnae_class,
        final_cnae,
        multiplicadores_scn67,
    )
    tsb_operational_summary = build_tsb_operational_summary(tsb_operational_cnae, rais_tsb_summary)

    summary = {
        "periods": sorted(trade["period"].unique().tolist()),
        "flows": sorted(trade["flow"].unique().tolist()),
        "statuses": sorted(trade["mapping_status"].unique().tolist()),
        "generated_from": {
            "trade": "inputs/official/EXP_2026.csv; inputs/official/IMP_2026.csv",
            "mapping": "outputs/official_2026/bridge_ncm_prodlist_cnae.csv",
            "indicators": "outputs/final_border_value_2026/border_value_indicadores_finais_*.csv",
            "employment": "outputs/official_2026_rais/fact_employment_rais.csv",
            "gdp": "outputs/official_2026_rais/fact_gdp.csv",
        },
    }

    trade.to_parquet(TRADE_OUT, index=False)

    options = {
        "cnaes": sorted(trade["cnae_class"].unique().tolist()),
        "prodlists": sorted(trade["prodlist_code"].unique().tolist()),
        "ncms": sorted(trade["ncm"].unique().tolist()),
        "countries": sorted(trade["country_code"].unique().tolist()),
        "country_labels": compact_records(
            country_dim.loc[country_dim["country_code"].isin(trade["country_code"].astype("string").unique())]
            .sort_values("country_name", kind="stable")
        ),
        "employment_ufs": sorted([value for value in employment["uf"].dropna().unique().tolist() if value]),
        "employment_municipalities": sorted(
            [value for value in employment["municipality_code"].dropna().unique().tolist() if value]
        ),
        "employment_municipality_labels": compact_records(
            employment[["municipality_code", "municipality_name", "uf"]]
            .dropna(subset=["municipality_code"])
            .drop_duplicates()
            .sort_values(["uf", "municipality_name"], kind="stable")
        ),
        "gdp_ufs": sorted([value for value in gdp["uf"].dropna().unique().tolist() if value]),
        "gdp_municipalities": sorted(
            [value for value in gdp["municipality_code"].dropna().unique().tolist() if value]
        ),
        "municipality_meshes": cache_municipality_meshes(
            [value for value in employment["uf"].dropna().unique().tolist() if value]
        ),
        "transition_fuels": sorted(fuel_indicators["recorte_combustivel"].dropna().unique().tolist()) if not fuel_indicators.empty else [],
        "transition_fuel_layers": sorted(fuel_indicators["camada_analitica"].dropna().unique().tolist()) if not fuel_indicators.empty else [],
    }

    payload = {
        "summary": summary,
        "options": options,
        "indicators_cnae": compact_records(indicators_cnae),
        "indicators_prodlist": compact_records(indicators_prod),
        "employment_platform_cnae": compact_records(employment_platform),
        "employment_scope_summary": compact_records(employment_scope_summary),
        "transition_fuel_indicators": compact_records(fuel_indicators),
        "transition_fuel_ncm_drivers": compact_records(fuel_ncm_drivers),
        "transition_fuel_complementary_sources": compact_records(fuel_complementary),
        "transition_fuel_framework": compact_records(fuel_framework),
        "dim_tsb_cnae5": compact_records(dim_tsb_cnae5),
        "dim_scn67_tsb": compact_records(dim_scn67_tsb),
        "multiplicadores_scn67": compact_records(multiplicadores_scn67),
        "fontes_tsb_robustez": compact_records(fontes_tsb_robustez),
        "bridge_tsb_cnae_class": compact_records(bridge_tsb_cnae_class),
        "bridge_tsb_ncm": compact_records(bridge_tsb_ncm),
        "rais_tsb_employment_summary": compact_records(rais_tsb_summary),
        "rais_tsb_employment_territory": compact_records(rais_tsb_territory),
        "tsb_operational_summary": clean_json_value(tsb_operational_summary),
        "tsb_operational_cnae": compact_records(tsb_operational_cnae),
        "cnae_labels": compact_records(cnae_labels),
        "prodlist_labels": compact_records(prod_labels),
        "etl": build_etl_metadata(),
    }

    OUT.write_text(
        json.dumps(clean_json_value(payload), ensure_ascii=False, separators=(",", ":"), allow_nan=False),
        encoding="utf-8",
    )
    print(
        f"wrote {OUT}, {TRADE_OUT} and {EMPLOYMENT_OUT} with "
        f"{len(trade):,} trade rows, {len(employment):,} employment rows and {len(gdp):,} gdp rows"
    )


if __name__ == "__main__":
    main()
