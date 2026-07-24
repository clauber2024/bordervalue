from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import threading
from io import StringIO
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pandas as pd

from filter_engine import filter_trade


DASHBOARD = Path(__file__).resolve().parent
ROOT = DASHBOARD.parent
TRADE = DASHBOARD / "trade_dashboard.parquet"
EMPLOYMENT = DASHBOARD / "employment_dashboard.parquet"
GDP = DASHBOARD / "gdp_dashboard.parquet"
DATA_JSON = DASHBOARD / "data.json"
PIPELINE = ROOT / "operational_pipeline.py"
CONFIG = ROOT / "config.official.2026.json"
RAIS_CONFIG = ROOT / "config.official.2026.rais.json"
BUILD_DASHBOARD = DASHBOARD / "build_dashboard_data.py"

ETL_LOCK = threading.Lock()
ETL_JOB = {
    "running": False,
    "status": "idle",
    "source": None,
    "started_at": None,
    "finished_at": None,
    "returncode": None,
    "message": "Nenhuma atualizacao em execucao.",
    "log": "",
}


def finite(value):
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if pd.isna(value):
        return None
    return value


def clean_json_value(value):
    if isinstance(value, dict):
        return {key: clean_json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [clean_json_value(item) for item in value]
    if isinstance(value, str):
        return repair_text(value)
    return finite(value)


def repair_text(value: str) -> str:
    if not any(marker in value for marker in ("Ã", "Â", "â")):
        return value
    try:
        fixed = value.encode("latin-1").decode("utf-8")
    except UnicodeError:
        return value
    return fixed if fixed else value


def json_records(frame: pd.DataFrame) -> list[dict]:
    return [
        {key: finite(value) for key, value in row.items()}
        for row in frame.to_dict(orient="records")
    ]


def grouped(df: pd.DataFrame, key: str, limit: int | None = None, labels: dict[str, str] | None = None) -> list[dict]:
    if df.empty:
        return []
    out = (
        df.groupby(key, as_index=False)[["allocated_value_usd", "allocated_net_weight_kg"]]
        .sum()
        .sort_values("allocated_value_usd", ascending=False)
    )
    if limit:
        out = out.head(limit)
    return [
        {
            "key": finite(row[key]),
            "label": labels.get(str(row[key]), finite(row[key])) if labels else finite(row[key]),
            "value": finite(row["allocated_value_usd"]),
            "weight": finite(row["allocated_net_weight_kg"]),
        }
        for _, row in out.iterrows()
    ]


def grouped_employment(df: pd.DataFrame, key: str, limit: int | None = None) -> list[dict]:
    if df.empty:
        return []
    wage_col = "december_wage_mass" if "december_wage_mass" in df.columns else "wage_mass"
    labels = {}
    if key == "municipality_code" and "municipality_name" in df.columns:
        labels = (
            df[[key, "municipality_name", "uf"]]
            .dropna(subset=[key])
            .drop_duplicates(key)
            .assign(label=lambda frame: frame["municipality_name"].fillna("") + " (" + frame["uf"].fillna("") + ")")
            .set_index(key)["label"]
            .to_dict()
        )
    out = (
        df.groupby(key, as_index=False)[["formal_jobs", wage_col]]
        .sum()
        .sort_values("formal_jobs", ascending=False)
    )
    out["average_wage"] = out[wage_col] / out["formal_jobs"]
    out.loc[~out["formal_jobs"].gt(0), "average_wage"] = pd.NA
    if limit:
        out = out.head(limit)
    return [
        {
            "key": finite(row[key]),
            "label": labels.get(row[key], finite(row[key])) if key == "municipality_code" else finite(row[key]),
            "value": finite(row["formal_jobs"]),
            "wage_mass": finite(row[wage_col]),
            "average_wage": finite(row["average_wage"]),
        }
        for _, row in out.iterrows()
    ]


def read_platform_cnae() -> pd.DataFrame:
    data_path = DATA_JSON
    if not data_path.exists():
        return pd.DataFrame()
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    return pd.DataFrame(payload.get("employment_platform_cnae", []))


def read_scope_summary() -> list[dict]:
    data_path = DATA_JSON
    if not data_path.exists():
        return []
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    return payload.get("employment_scope_summary", [])


def read_country_labels() -> dict[str, str]:
    data_path = DATA_JSON
    if not data_path.exists():
        return {}
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    labels = payload.get("options", {}).get("country_labels", [])
    return {
        str(row.get("country_code", "")).zfill(3): str(row.get("country_name") or row.get("country_code") or "")
        for row in labels
    }


def read_country_metadata() -> dict[str, dict]:
    data_path = DATA_JSON
    if not data_path.exists():
        return {}
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    labels = payload.get("options", {}).get("country_labels", [])
    return {
        str(row.get("country_code", "")).zfill(3): {
            "name": str(row.get("country_name") or row.get("country_code") or ""),
            "iso3": str(row.get("country_iso3") or "").upper(),
        }
        for row in labels
    }


def world_flows(df: pd.DataFrame, country_metadata: dict[str, dict]) -> list[dict]:
    if df.empty:
        return []
    grouped_trade = (
        df.groupby(["country_code", "flow"], as_index=False)[["allocated_value_usd", "allocated_net_weight_kg"]]
        .sum()
    )
    rows = []
    for code_value, part in grouped_trade.groupby("country_code", sort=False):
        code = str(code_value).zfill(3)
        meta = country_metadata.get(code, {})
        by_flow = part.set_index("flow")
        exp = float(by_flow.at["EXP", "allocated_value_usd"]) if "EXP" in by_flow.index else 0
        imp = float(by_flow.at["IMP", "allocated_value_usd"]) if "IMP" in by_flow.index else 0
        weight_exp = float(by_flow.at["EXP", "allocated_net_weight_kg"]) if "EXP" in by_flow.index else 0
        weight_imp = float(by_flow.at["IMP", "allocated_net_weight_kg"]) if "IMP" in by_flow.index else 0
        rows.append(
            {
                "country_code": code,
                "country_iso3": meta.get("iso3", ""),
                "country_name": meta.get("name", code),
                "exports": finite(exp),
                "imports": finite(imp),
                "balance": finite(exp - imp),
                "total": finite(exp + imp),
                "weight": finite(weight_exp + weight_imp),
            }
        )
    return sorted(rows, key=lambda item: item["total"] or 0, reverse=True)


def read_dashboard_table(name: str) -> pd.DataFrame:
    if not DATA_JSON.exists():
        return pd.DataFrame()
    payload = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    value = payload.get(name, [])
    if isinstance(value, dict):
        return pd.DataFrame([value])
    return pd.DataFrame(value)


def grouped_fuel(df: pd.DataFrame, key: str, value_col: str = "trade_value_usd", limit: int | None = None) -> list[dict]:
    if df.empty or key not in df.columns:
        return []
    out = (
        df.groupby(key, as_index=False)[value_col]
        .sum(min_count=1)
        .sort_values(value_col, ascending=False, kind="stable")
    )
    if limit:
        out = out.head(limit)
    return [{"key": finite(row[key]), "label": finite(row[key]), "value": finite(row[value_col])} for _, row in out.iterrows()]


def grouped_tsb(df: pd.DataFrame, key: str, value_col: str = "formal_jobs", limit: int | None = None) -> list[dict]:
    if df.empty or key not in df.columns:
        return []
    out = (
        df.groupby(key, dropna=False, as_index=False)[value_col]
        .sum(min_count=1)
        .sort_values(value_col, ascending=False, kind="stable")
    )
    if limit:
        out = out.head(limit)
    return [{"key": finite(row[key]), "label": finite(row[key]), "value": finite(row[value_col])} for _, row in out.iterrows()]


def sankey(df: pd.DataFrame, target_col: str, target_label: str, limit: int = 12) -> dict:
    if df.empty:
        return {"nodes": [], "links": []}

    totals = df.groupby(target_col, as_index=False)["allocated_value_usd"].sum().sort_values("allocated_value_usd", ascending=False)
    keep = set(totals.head(limit)[target_col].astype(str))
    target = df[target_col].astype(str).where(df[target_col].astype(str).isin(keep), f"Outros {target_label}")
    work = df.assign(_target=target)

    links = []
    for _, row in work.groupby(["flow", "mapping_status"], as_index=False)["allocated_value_usd"].sum().iterrows():
        links.append(
            {
                "source": f"flow:{row['flow']}",
                "target": f"status:{row['mapping_status']}",
                "value": finite(row["allocated_value_usd"]),
            }
        )
    for _, row in work.groupby(["mapping_status", "_target"], as_index=False)["allocated_value_usd"].sum().iterrows():
        links.append(
            {
                "source": f"status:{row['mapping_status']}",
                "target": f"target:{row['_target']}",
                "value": finite(row["allocated_value_usd"]),
            }
        )

    nodes = []
    seen = set()
    labels = {}
    for link in links:
        labels[link["source"]] = link["source"].split(":", 1)[1]
        labels[link["target"]] = link["target"].split(":", 1)[1]
    for link in links:
        for key in (link["source"], link["target"]):
            if key not in seen:
                seen.add(key)
                nodes.append({"id": key, "label": labels[key]})
    return {"nodes": nodes, "links": links}


def etl_snapshot() -> dict:
    with ETL_LOCK:
        return dict(ETL_JOB)


def set_etl_job(**updates) -> None:
    with ETL_LOCK:
        ETL_JOB.update(updates)


def read_employment() -> pd.DataFrame:
    return pd.read_parquet(EMPLOYMENT) if EMPLOYMENT.exists() else pd.DataFrame()


def read_gdp() -> pd.DataFrame:
    return pd.read_parquet(GDP) if GDP.exists() else pd.DataFrame()


def run_update(source: str) -> None:
    started = datetime.now(timezone.utc).isoformat()
    set_etl_job(
        running=True,
        status="running",
        source=source,
        started_at=started,
        finished_at=None,
        returncode=None,
        message="Atualizacao oficial em andamento.",
        log="",
    )
    config = RAIS_CONFIG if source == "rais" and RAIS_CONFIG.exists() else CONFIG
    commands = [[sys.executable, str(PIPELINE), str(config)], [sys.executable, str(BUILD_DASHBOARD)]]
    logs = []
    try:
        for command in commands:
            result = subprocess.run(command, cwd=str(ROOT), capture_output=True, text=True, timeout=60 * 60)
            logs.append(f"$ {' '.join(command)}\n{result.stdout}\n{result.stderr}".strip())
            if result.returncode != 0:
                set_etl_job(
                    running=False,
                    status="failed",
                    finished_at=datetime.now(timezone.utc).isoformat(),
                    returncode=result.returncode,
                    message="Atualizacao falhou. Verifique o log.",
                    log="\n\n".join(logs)[-8000:],
                )
                return
        DashboardHandler.trade = pd.read_parquet(TRADE)
        DashboardHandler.employment = read_employment()
        DashboardHandler.gdp = read_gdp()
        DashboardHandler.platform_cnae = read_platform_cnae()
        DashboardHandler.scope_summary = read_scope_summary()
        DashboardHandler.country_labels = read_country_labels()
        DashboardHandler.country_metadata = read_country_metadata()
        DashboardHandler.fuel_indicators = read_dashboard_table("transition_fuel_indicators")
        DashboardHandler.fuel_ncm_drivers = read_dashboard_table("transition_fuel_ncm_drivers")
        DashboardHandler.fuel_complementary_sources = read_dashboard_table("transition_fuel_complementary_sources")
        DashboardHandler.fuel_framework = read_dashboard_table("transition_fuel_framework")
        DashboardHandler.tsb_cnae = read_dashboard_table("tsb_operational_cnae")
        DashboardHandler.tsb_territory = read_dashboard_table("rais_tsb_employment_territory")
        DashboardHandler.tsb_summary = read_dashboard_table("tsb_operational_summary")
        set_etl_job(
            running=False,
            status="success",
            finished_at=datetime.now(timezone.utc).isoformat(),
            returncode=0,
            message="Atualizacao concluida e painel tecnico legado regenerado.",
            log="\n\n".join(logs)[-8000:],
        )
    except Exception as exc:
        set_etl_job(
            running=False,
            status="failed",
            finished_at=datetime.now(timezone.utc).isoformat(),
            returncode=None,
            message=f"Atualizacao falhou: {exc}",
            log="\n\n".join(logs)[-8000:],
        )


class DashboardHandler(SimpleHTTPRequestHandler):
    trade = pd.read_parquet(TRADE)
    employment = pd.read_parquet(EMPLOYMENT) if EMPLOYMENT.exists() else pd.DataFrame()
    gdp = pd.read_parquet(GDP) if GDP.exists() else pd.DataFrame()
    platform_cnae = read_platform_cnae()
    scope_summary = read_scope_summary()
    country_labels = read_country_labels()
    country_metadata = read_country_metadata()
    fuel_indicators = read_dashboard_table("transition_fuel_indicators")
    fuel_ncm_drivers = read_dashboard_table("transition_fuel_ncm_drivers")
    fuel_complementary_sources = read_dashboard_table("transition_fuel_complementary_sources")
    fuel_framework = read_dashboard_table("transition_fuel_framework")
    tsb_cnae = read_dashboard_table("tsb_operational_cnae")
    tsb_territory = read_dashboard_table("rais_tsb_employment_territory")
    tsb_summary = read_dashboard_table("tsb_operational_summary")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DASHBOARD), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/query":
            self.handle_query(parsed.query)
            return
        if parsed.path == "/api/employment":
            self.handle_employment(parsed.query)
            return
        if parsed.path == "/api/fuels":
            self.handle_fuels(parsed.query)
            return
        if parsed.path == "/api/tsb":
            self.handle_tsb(parsed.query)
            return
        if parsed.path == "/api/etl/status":
            self.write_json(etl_snapshot())
            return
        if parsed.path == "/api/export":
            self.handle_export(parsed.query)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/etl/run":
            self.handle_etl_run(parsed.query)
            return
        self.send_error(404)

    def handle_etl_run(self, query: str) -> None:
        params = {k: v[0] for k, v in parse_qs(query).items()}
        source = params.get("source", "manual")
        with ETL_LOCK:
            if ETL_JOB["running"]:
                self.write_json(dict(ETL_JOB), status=409)
                return
            ETL_JOB.update(
                running=True,
                status="queued",
                source=source,
                started_at=datetime.now(timezone.utc).isoformat(),
                finished_at=None,
                returncode=None,
                message="Atualizacao enfileirada.",
                log="",
            )
        threading.Thread(target=run_update, args=(source,), daemon=True).start()
        self.write_json(etl_snapshot(), status=202)

    def handle_query(self, query: str) -> None:
        params = {k: v[0] for k, v in parse_qs(query).items()}
        filtered = self.filtered_trade(params)
        exp = filtered.loc[filtered["flow"] == "EXP", "allocated_value_usd"].sum()
        imp = filtered.loc[filtered["flow"] == "IMP", "allocated_value_usd"].sum()
        total = exp + imp
        mapped = filtered.loc[filtered["mapping_status"] != "NCM sem ponte", "allocated_value_usd"].sum()

        detail_cols = ["period", "flow", "cnae_class", "prodlist_code", "ncm", "country_code", "mapping_status", "allocated_value_usd"]
        top_detail = filtered.sort_values("allocated_value_usd", ascending=False).head(200)[detail_cols]
        detail = json_records(top_detail)

        payload = {
            "kpis": {
                "total": finite(total),
                "exports": finite(exp),
                "imports": finite(imp),
                "balance": finite(exp - imp),
                "mapped_share": finite(mapped / total) if total else 0,
                "weight": finite(filtered["allocated_net_weight_kg"].sum()),
                "cnaes": int(filtered["cnae_class"].nunique()),
                "prodlists": int(filtered["prodlist_code"].nunique()),
                "ncms": int(filtered["ncm"].nunique()),
                "countries": int(filtered["country_code"].nunique()),
            },
            "groups": {
                "monthly": grouped(filtered.assign(period_flow=filtered["period"] + " " + filtered["flow"]), "period_flow"),
                "status": grouped(filtered, "mapping_status"),
                "cnae": grouped(filtered, "cnae_class", 40),
                "prodlist": grouped(filtered, "prodlist_code", 40),
                "ncm": grouped(filtered, "ncm", 40),
                "country": grouped(filtered, "country_code", 40, self.country_labels),
                "world_map": world_flows(filtered, self.country_metadata),
                "sankey_cnae": sankey(filtered, "cnae_class", "CNAE"),
                "sankey_prodlist": sankey(filtered, "prodlist_code", "PRODLIST"),
            },
            "detail": detail,
        }
        self.write_json(payload)

    def filtered_trade(self, params: dict[str, str]) -> pd.DataFrame:
        return filter_trade(self.trade, params, country_labels=self.country_labels)

    def handle_fuels(self, query: str) -> None:
        params = {k: v[0] for k, v in parse_qs(query).items()}
        indicators = self.fuel_indicators.copy()
        drivers = self.fuel_ncm_drivers.copy()
        complementary = self.fuel_complementary_sources.copy()
        framework = self.fuel_framework.copy()
        exact = {
            "fuel": "recorte_combustivel",
            "layer": "camada_analitica",
        }
        for param, column in exact.items():
            value = params.get(param, "all")
            if value and value != "all":
                if column in indicators.columns:
                    indicators = indicators.loc[indicators[column].astype(str) == value]
                if column in drivers.columns:
                    drivers = drivers.loc[drivers[column].astype(str) == value]
                if column in complementary.columns:
                    complementary = complementary.loc[complementary[column].astype(str) == value]
                if column in framework.columns:
                    framework = framework.loc[framework[column].astype(str) == value]
        ncm_term = params.get("ncm", "").strip()
        ncm_filtered = False
        if ncm_term and "ncm" in drivers.columns:
            drivers = drivers.loc[drivers["ncm"].astype(str).str.contains(ncm_term, regex=False)]
            ncm_filtered = True
        if ncm_filtered:
            total = float(drivers["value_usd"].sum()) if "value_usd" in drivers.columns else 0
            exports = float(drivers.loc[drivers["flow"] == "EXP", "value_usd"].sum()) if "flow" in drivers.columns else 0
            imports = float(drivers.loc[drivers["flow"] == "IMP", "value_usd"].sum()) if "flow" in drivers.columns else 0
        else:
            total = float(indicators["trade_value_usd"].sum()) if "trade_value_usd" in indicators.columns else 0
            exports = float(indicators["export_value_usd"].sum()) if "export_value_usd" in indicators.columns else 0
            imports = float(indicators["import_value_usd"].sum()) if "import_value_usd" in indicators.columns else 0
        unique_ncms = int(drivers["ncm"].nunique()) if "ncm" in drivers.columns else 0
        payload = {
            "kpis": {
                "total": finite(total),
                "exports": finite(exports),
                "imports": finite(imports),
                "balance": finite(exports - imports),
                "fuels": int(indicators["recorte_combustivel"].nunique()) if "recorte_combustivel" in indicators.columns else 0,
                "layers": int(indicators["camada_analitica"].nunique()) if "camada_analitica" in indicators.columns else 0,
                "ncms": unique_ncms,
                "classification_status": "preliminar_nao_inferivel_por_ncm",
            },
            "groups": {
                "fuel": grouped_fuel(indicators, "recorte_combustivel"),
                "layer": grouped_fuel(indicators, "camada_analitica"),
                "ncm": grouped_fuel(drivers, "ncm", "value_usd", 30),
            },
            "indicators": json_records(indicators.sort_values("trade_value_usd", ascending=False).head(200)) if not indicators.empty else [],
            "drivers": json_records(drivers.sort_values("value_usd", ascending=False).head(200)) if not drivers.empty else [],
            "complementary_sources": json_records(complementary.head(100)) if not complementary.empty else [],
            "framework": json_records(framework.head(100)) if not framework.empty else [],
        }
        self.write_json(payload)

    def handle_employment(self, query: str) -> None:
        params = {k: v[0] for k, v in parse_qs(query).items()}
        df = self.employment
        gdp = self.gdp
        if df.empty:
            gdp_value = float(gdp["gdp_value_brl"].sum()) if not gdp.empty and "gdp_value_brl" in gdp.columns else 0
            self.write_json(
                {
                    "kpis": {"formal_jobs": 0, "wage_mass": 0, "average_wage": None, "gdp_value_brl": finite(gdp_value), "cnaes": 0, "ufs": 0, "municipalities": 0},
                    "groups": {"cnae": [], "uf": [], "municipality": []},
                    "detail": [],
                }
            )
            return
        mask = pd.Series(True, index=df.index)
        exact = {
            "cnae": "cnae_class",
            "uf": "uf",
            "municipality": "municipality_code",
        }
        for param, column in exact.items():
            value = params.get(param, "all")
            if value and value != "all":
                mask &= df[column].fillna("").astype(str) == value
        filtered = df.loc[mask]
        gdp_filtered = gdp.copy()
        if not gdp_filtered.empty:
            if params.get("uf", "all") != "all" and "uf" in gdp_filtered.columns:
                gdp_filtered = gdp_filtered.loc[gdp_filtered["uf"].fillna("").astype(str) == params["uf"]]
            if params.get("municipality", "all") != "all" and "municipality_code" in gdp_filtered.columns:
                gdp_filtered = gdp_filtered.loc[gdp_filtered["municipality_code"].fillna("").astype(str) == params["municipality"]]
        platform = self.platform_cnae
        scope_filter = params.get("scope", "all")
        if not platform.empty and "cnae_class" in platform.columns:
            cnae_filter = params.get("cnae", "all")
            if cnae_filter and cnae_filter != "all":
                platform = platform.loc[platform["cnae_class"].astype(str) == cnae_filter]
            else:
                keep_cnaes = set(filtered["cnae_class"].dropna().astype(str).unique())
                platform = platform.loc[platform["cnae_class"].astype(str).isin(keep_cnaes)]
            if scope_filter and scope_filter != "all" and "platform_scope_status" in platform.columns:
                platform = platform.loc[platform["platform_scope_status"].astype(str) == scope_filter]
                allowed_cnaes = set(platform["cnae_class"].dropna().astype(str).unique())
                filtered = filtered.loc[filtered["cnae_class"].astype(str).isin(allowed_cnaes)]
            platform_detail = json_records(platform.head(80))
        else:
            platform_detail = []
            if scope_filter and scope_filter != "all":
                filtered = filtered.iloc[0:0]
        jobs = filtered["formal_jobs"].sum()
        wage_col = "december_wage_mass" if "december_wage_mass" in filtered.columns else "wage_mass"
        wage_mass = filtered[wage_col].sum()
        average_wage = wage_mass / jobs if jobs else None
        gdp_value = (
            gdp_filtered["gdp_value_brl"].sum(min_count=1)
            if not gdp_filtered.empty and "gdp_value_brl" in gdp_filtered.columns
            else pd.NA
        )
        detail_cols = [
            column
            for column in [
                "year",
                "uf",
                "municipality_code",
                "municipality_name",
                "cnae_class",
                "formal_jobs",
                "wage_mass",
                "average_wage",
                "december_wage_mass",
                "average_december_wage",
                "average_monthly_wage",
            ]
            if column in filtered.columns
        ]
        top_detail = filtered.sort_values("formal_jobs", ascending=False).head(200)[detail_cols]
        detail = json_records(top_detail)
        payload = {
            "kpis": {
                "formal_jobs": finite(jobs),
                "wage_mass": finite(wage_mass),
                "average_wage": finite(average_wage),
                "gdp_value_brl": finite(gdp_value),
                "cnaes": int(filtered["cnae_class"].nunique()),
                "ufs": int(filtered["uf"].nunique()),
                "municipalities": int(filtered["municipality_code"].nunique()),
            },
            "groups": {
                "cnae": grouped_employment(filtered, "cnae_class", 40),
                "uf": grouped_employment(filtered, "uf", 40),
                "municipality": grouped_employment(filtered, "municipality_code", 40),
                "municipality_map": grouped_employment(filtered, "municipality_code"),
            },
            "detail": detail,
            "platform_cnae": platform_detail,
            "scope_summary": self.scope_summary,
        }
        self.write_json(payload)

    def handle_tsb(self, query: str) -> None:
        params = {k: v[0] for k, v in parse_qs(query).items()}
        cnae = self.tsb_cnae.copy()
        territory = self.tsb_territory.copy()
        if not territory.empty and "tsb_associated" in territory.columns:
            territory = territory.loc[territory["tsb_associated"].astype(bool)]

        cnae_filter = params.get("cnae", "all")
        if cnae_filter and cnae_filter != "all" and not cnae.empty:
            cnae = cnae.loc[cnae["cnae_class"].astype(str) == cnae_filter]
        if params.get("uf", "all") != "all" and not territory.empty and "uf" in territory.columns:
            territory = territory.loc[territory["uf"].fillna("").astype(str) == params["uf"]]
        if params.get("municipality", "all") != "all" and not territory.empty and "municipality_code" in territory.columns:
            territory = territory.loc[territory["municipality_code"].fillna("").astype(str) == params["municipality"]]

        jobs = float(cnae["formal_jobs"].sum()) if "formal_jobs" in cnae.columns else 0
        wage = float(cnae["wage_mass"].sum()) if "wage_mass" in cnae.columns else 0
        summary = self.tsb_summary.iloc[0].to_dict() if not self.tsb_summary.empty else {}

        scn_rows = []
        if not cnae.empty and "primary_scn67" in cnae.columns:
            scn = (
                cnae.groupby(["primary_scn67", "primary_setor_scn67"], dropna=False, as_index=False)[
                    ["formal_jobs", "wage_mass", "trade_value_usd"]
                ]
                .sum(min_count=1)
                .sort_values("formal_jobs", ascending=False, kind="stable")
                .head(40)
            )
            scn_rows = json_records(scn)

        comparison_cols = [
            column
            for column in [
                "cnae_class",
                "cnae_name",
                "primary_scn67",
                "primary_setor_scn67",
                "tsb_platform_alignment_score",
                "tsb_platform_alignment_label",
                "priority_border_value",
                "tsb_grupo_exposicao",
                "tsb_exposicao_scn67_max",
                "external_dependency_ratio",
                "trade_value_usd",
                "wage_mass",
                "formal_jobs",
                "employment_multiplier_tsb",
            ]
            if column in cnae.columns
        ]
        if comparison_cols:
            comparison_sort_cols = [column for column in ["tsb_platform_alignment_score", "wage_mass", "trade_value_usd"] if column in cnae.columns]
            comparison = cnae.sort_values(
                comparison_sort_cols,
                ascending=[False] * len(comparison_sort_cols),
                kind="stable",
            ).head(80)[comparison_cols]
        else:
            comparison = pd.DataFrame()
        territory_detail = (
            territory.sort_values("formal_jobs", ascending=False, kind="stable").head(120)
            if not territory.empty and "formal_jobs" in territory.columns
            else territory.head(120)
        )
        payload = {
            "kpis": {
                "formal_jobs": finite(jobs),
                "wage_mass": finite(wage),
                "average_wage": finite(wage / jobs) if jobs else None,
                "cnaes": int(cnae["cnae_class"].nunique()) if "cnae_class" in cnae.columns else 0,
                "scn67": int(cnae["primary_scn67"].replace("", pd.NA).dropna().nunique()) if "primary_scn67" in cnae.columns else 0,
                "territory_jobs": finite(float(territory["formal_jobs"].sum())) if "formal_jobs" in territory.columns else 0,
                "report_industrial_wage_share": finite(summary.get("report_industrial_wage_share", 0.27078)),
                "report_main_cnae_count": finite(summary.get("report_main_cnae_count", 64)),
                "report_exposed_industrial_sectors": finite(summary.get("report_exposed_industrial_sectors", 15)),
            },
            "groups": {
                "cnae": grouped_tsb(cnae, "cnae_class", "formal_jobs", 30),
                "scn67": [{"key": row.get("primary_scn67"), "label": row.get("primary_setor_scn67") or row.get("primary_scn67"), "value": row.get("formal_jobs")} for row in scn_rows],
                "uf": grouped_tsb(territory, "uf", "formal_jobs", 27),
                "municipality": grouped_tsb(territory, "municipality_code", "formal_jobs", 40),
                "exposure": grouped_tsb(cnae, "tsb_grupo_exposicao", "formal_jobs", 10),
            },
            "comparison": json_records(comparison),
            "territory": json_records(territory_detail),
            "scn67": scn_rows,
        }
        self.write_json(payload)

    def handle_export(self, query: str) -> None:
        params = {k: v[0] for k, v in parse_qs(query).items()}
        dataset = params.get("dataset", "trade")
        if dataset == "trade":
            frame = self.filtered_trade(params).sort_values("allocated_value_usd", ascending=False).head(5000)
            filename = "border_value_comercio_filtrado.csv"
        elif dataset == "employment":
            frame = self.filtered_employment(params).sort_values("formal_jobs", ascending=False).head(5000)
            filename = "border_value_rais_pib_filtrado.csv"
        elif dataset == "fuels":
            _, drivers = self.filtered_fuels(params)
            frame = drivers.sort_values("value_usd", ascending=False).head(5000) if not drivers.empty else drivers
            filename = "border_value_combustiveis_filtrado.csv"
        elif dataset == "tsb":
            frame = self.tsb_cnae.sort_values("wage_mass", ascending=False).head(5000)
            filename = "border_value_tsb_baixo_carbono.csv"
        else:
            self.send_error(400, "Dataset de exportacao invalido.")
            return
        self.write_csv(frame, filename)

    def filtered_employment(self, params: dict[str, str]) -> pd.DataFrame:
        df = self.employment
        if df.empty:
            return df
        mask = pd.Series(True, index=df.index)
        exact = {
            "cnae": "cnae_class",
            "uf": "uf",
            "municipality": "municipality_code",
        }
        for param, column in exact.items():
            value = params.get(param, "all")
            if value and value != "all":
                mask &= df[column].fillna("").astype(str) == value
        return df.loc[mask]

    def filtered_fuels(self, params: dict[str, str]) -> tuple[pd.DataFrame, pd.DataFrame]:
        indicators = self.fuel_indicators.copy()
        drivers = self.fuel_ncm_drivers.copy()
        exact = {
            "fuel": "recorte_combustivel",
            "layer": "camada_analitica",
        }
        for param, column in exact.items():
            value = params.get(param, "all")
            if value and value != "all":
                if column in indicators.columns:
                    indicators = indicators.loc[indicators[column].astype(str) == value]
                if column in drivers.columns:
                    drivers = drivers.loc[drivers[column].astype(str) == value]
        ncm_term = params.get("ncm", "").strip()
        if ncm_term and "ncm" in drivers.columns:
            drivers = drivers.loc[drivers["ncm"].astype(str).str.contains(ncm_term, regex=False)]
        return indicators, drivers

    def write_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(clean_json_value(payload), ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def write_csv(self, frame: pd.DataFrame, filename: str) -> None:
        output = StringIO()
        frame.to_csv(output, index=False)
        body = output.getvalue().encode("utf-8-sig")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    port = int(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BORDER_VALUE_DASHBOARD_PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), DashboardHandler)
    print(f"Painel tecnico legado em http://127.0.0.1:{port}")
    server.serve_forever()

if __name__ == "__main__":
    main()
