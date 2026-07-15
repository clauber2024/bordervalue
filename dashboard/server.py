from __future__ import annotations

import json
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
PIPELINE = ROOT / "operational_pipeline.py"
CONFIG = ROOT / "config.official.2026.json"
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
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def grouped(df: pd.DataFrame, key: str, limit: int | None = None) -> list[dict]:
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
            "value": finite(row["allocated_value_usd"]),
            "weight": finite(row["allocated_net_weight_kg"]),
        }
        for _, row in out.iterrows()
    ]


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
    commands = [
        [sys.executable, str(PIPELINE), str(CONFIG)],
        [sys.executable, str(BUILD_DASHBOARD)],
    ]
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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DASHBOARD), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/query":
            self.handle_query(parsed.query)
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
            mask &= df["country_code"].astype(str).str.contains(params["country"], regex=False)

        filtered = df.loc[mask]
        exp = filtered.loc[filtered["flow"] == "EXP", "allocated_value_usd"].sum()
        imp = filtered.loc[filtered["flow"] == "IMP", "allocated_value_usd"].sum()
        total = exp + imp
        mapped = filtered.loc[filtered["mapping_status"] != "NCM sem ponte", "allocated_value_usd"].sum()

        detail_cols = ["period", "flow", "cnae_class", "prodlist_code", "ncm", "country_code", "mapping_status", "allocated_value_usd"]
        top_detail = filtered.sort_values("allocated_value_usd", ascending=False).head(200)[detail_cols]
        detail = top_detail.where(pd.notna(top_detail), None).to_dict(orient="records")

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
                "country": grouped(filtered, "country_code", 40),
                "sankey_cnae": sankey(filtered, "cnae_class", "CNAE"),
                "sankey_prodlist": sankey(filtered, "prodlist_code", "PRODLIST"),
            },
            "detail": detail,
        }
        self.write_json(payload)

    def write_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
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
