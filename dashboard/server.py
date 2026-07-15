from __future__ import annotations

import json
import math
import subprocess
import sys
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pandas as pd


DASHBOARD = Path(__file__).resolve().parent
ROOT = DASHBOARD.parent
TRADE = DASHBOARD / "trade_dashboard.parquet"
EMPLOYMENT = DASHBOARD / "employment_dashboard.parquet"
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
    return finite(value)


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
    data_path = DASHBOARD / "data.json"
    if not data_path.exists():
        return pd.DataFrame()
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    return pd.DataFrame(payload.get("employment_platform_cnae", []))


def read_scope_summary() -> list[dict]:
    data_path = DASHBOARD / "data.json"
    if not data_path.exists():
        return []
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    return payload.get("employment_scope_summary", [])


def read_country_labels() -> dict[str, str]:
    data_path = DASHBOARD / "data.json"
    if not data_path.exists():
        return {}
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    labels = payload.get("options", {}).get("country_labels", [])
    return {
        str(row.get("country_code", "")).zfill(3): str(row.get("country_name") or row.get("country_code") or "")
        for row in labels
    }


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
        DashboardHandler.platform_cnae = read_platform_cnae()
        DashboardHandler.scope_summary = read_scope_summary()
        DashboardHandler.country_labels = read_country_labels()
        set_etl_job(
            running=False,
            status="success",
            finished_at=datetime.now(timezone.utc).isoformat(),
            returncode=0,
            message="Atualizacao concluida e dashboard regenerado.",
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
    platform_cnae = read_platform_cnae()
    scope_summary = read_scope_summary()
    country_labels = read_country_labels()

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
        if parsed.path == "/api/etl/status":
            self.write_json(etl_snapshot())
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
        df = self.trade
        mask = pd.Series(True, index=df.index)
        exact = {
            "period": "period",
            "flow": "flow",
            "cnae": "cnae_class",
            "prodlist": "prodlist_code",
            "status": "mapping_status",
        }
        for param, column in exact.items():
            value = params.get(param, "all")
            if value and value != "all":
                mask &= df[column] == value
        if params.get("ncm"):
            mask &= df["ncm"].astype(str).str.contains(params["ncm"], regex=False)
        if params.get("country"):
            country_term = params["country"].strip()
            country_code_term = country_term.split(" - ", 1)[0].strip()
            country_lower = country_term.casefold()
            code_mask = df["country_code"].astype(str).str.contains(country_code_term, regex=False)
            matched_codes = {
                code
                for code, name in self.country_labels.items()
                if country_lower in name.casefold() or country_code_term == code
            }
            if matched_codes:
                code_mask |= df["country_code"].astype(str).isin(matched_codes)
            mask &= code_mask

        filtered = df.loc[mask]
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
                "sankey_cnae": sankey(filtered, "cnae_class", "CNAE"),
                "sankey_prodlist": sankey(filtered, "prodlist_code", "PRODLIST"),
            },
            "detail": detail,
        }
        self.write_json(payload)

    def handle_employment(self, query: str) -> None:
        params = {k: v[0] for k, v in parse_qs(query).items()}
        df = self.employment
        if df.empty:
            self.write_json(
                {
                    "kpis": {"formal_jobs": 0, "wage_mass": 0, "average_wage": None, "cnaes": 0, "ufs": 0, "municipalities": 0},
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

    def write_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(clean_json_value(payload), ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 8765), DashboardHandler)
    print("Dashboard em http://127.0.0.1:8765")
    server.serve_forever()

if __name__ == "__main__":
    main()
