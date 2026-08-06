"""Orchestrates the "Atualizar agora" job of the admin panel.

Reuses the existing ETL scripts as-is via subprocess (same approach as the
sibling Atlas Solar Justo project's admin panel) instead of importing/
refactoring them -- they were written as standalone `python script.py` CLI
tools, not as importable libraries.

The step order below was confirmed by tracing every path constant each
script reads (not just the 5 scripts originally assumed to matter):
`build_solar_sovereignty_metrics.py` also reads
`outputs/final_border_value_2026/`, which comes from two scripts that are
easy to miss because `docs/DEPLOY.md` never mentions them --
`build_final_border_value_outputs.py` and `build_cadeias_minerais_estrategicas.py`.
Both had to be added as steps 2-3, ahead of the sovereignty/staging scripts.

RAIS-derived files (`outputs/official_2026_rais/`, `outputs/tsb_bridge_2026/`)
are intentionally NOT regenerated here -- RAIS stays a manual, once-a-year
update (see docs/DEPLOY.md). The scripts below only read the committed
snapshot of those files.

Every raw-input download helper in this codebase (`_input_path` in
`operational_pipeline.py`, `download_if_needed` in
`build_cadeias_minerais_estrategicas.py`) skips downloading when the local
file already exists. Without step 0 below, only the *first* click after a
deploy would fetch fresh Comex/PRODLIST/PIA/ANM data -- every click after
that would silently reuse the same stale cache for the life of the
container.
"""

from __future__ import annotations

import copy
import os
import subprocess
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2

from database.data_access import DEFAULT_DATABASE_DSN


ROOT = Path(__file__).resolve().parent.parent

# Deleted before every run so the download helpers in the scripts below are
# forced to fetch a fresh copy instead of silently reusing a stale cache.
# RAIS archives are deliberately excluded -- RAIS stays manual.
CACHED_DOWNLOADS_TO_CLEAR = (
    ROOT / "inputs" / "official" / "EXP_2026.csv",
    ROOT / "inputs" / "official" / "IMP_2026.csv",
    ROOT / "inputs" / "official" / "ncm_prodlist_2025.xlsx",
    ROOT / "inputs" / "official" / "pia_2024_value_production.json",
    ROOT / "inputs" / "official" / "anm_amb_producao_bruta.csv",
    ROOT / "inputs" / "official" / "anm_amb_producao_beneficiada.csv",
)

PIPELINE_SCRIPTS: tuple[tuple[str, list[str]], ...] = (
    ("Dados de comercio (Comex/PRODLIST/PIA)", ["operational_pipeline.py", "config.official.2026.json"]),
    ("Producao industrial consolidada", ["build_final_border_value_outputs.py"]),
    ("Cadeias minerais estrategicas (ANM)", ["build_cadeias_minerais_estrategicas.py"]),
    ("Metricas de soberania - silicio", ["build_solar_sovereignty_metrics.py"]),
    ("Metricas de soberania - setores", ["build_sector_sovereignty_metrics.py"]),
    ("Camada Published - silicio", ["build_analytical_staging_silicio.py"]),
    ("Camada Published - setores", ["build_analytical_staging_sectors.py"]),
    ("AIPNET - setores", ["build_aipnet_sectors.py"]),
)

# Known output paths of every script above that actually emits SQL meant to
# be applied to Postgres (the two new prerequisite scripts and
# build_sector_sovereignty_metrics.py only emit JSON/CSV reports consumed
# in-process by the scripts that follow them -- nothing to apply here).
SQL_TARGETS: tuple[Path, ...] = (
    ROOT / "outputs" / "solar_sovereignty_2026" / "load_aipnet_input_metrics.sql",
    ROOT / "outputs" / "solar_sovereignty_2026" / "load_aipnet_green_jobs.sql",
    ROOT / "outputs" / "analytical_staging_silicio" / "load_analytical_staging_silicio.sql",
    ROOT / "outputs" / "analytical_staging_sectors" / "load_analytical_staging_aco.sql",
    ROOT / "outputs" / "analytical_staging_sectors" / "load_analytical_staging_combustiveis_transicao.sql",
    ROOT / "outputs" / "analytical_staging_sectors" / "load_analytical_staging_fertilizantes.sql",
    ROOT / "outputs" / "aipnet_sector_fertilizantes" / "load_aipnet_input_metrics.sql",
    ROOT / "outputs" / "aipnet_sector_fertilizantes" / "load_aipnet_green_jobs.sql",
    ROOT / "outputs" / "aipnet_sector_combustiveis_transicao" / "load_aipnet_input_metrics.sql",
    ROOT / "outputs" / "aipnet_sector_combustiveis_transicao" / "load_aipnet_green_jobs.sql",
    ROOT / "outputs" / "aipnet_sector_aco" / "load_aipnet_input_metrics.sql",
    ROOT / "outputs" / "aipnet_sector_aco" / "load_aipnet_green_jobs.sql",
)

MATERIALIZED_VIEWS: tuple[str, ...] = (
    "mv_published_indicators",
    "mv_published_hhi_risk",
    "mv_published_territorial_tsb",
)

SUBPROCESS_TIMEOUT_SECONDS = 600
LOG_TAIL_CHARS = 4000

_STATE_LOCK = threading.Lock()
_STATE: dict[str, Any] = {
    "status": "idle",  # idle | running | success | error
    "started_at": None,
    "finished_at": None,
    "steps": [],
    "error": None,
}


def _database_dsn() -> str:
    return os.getenv("BORDER_VALUE_DATABASE_DSN", DEFAULT_DATABASE_DSN)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _set_state(**updates: Any) -> None:
    with _STATE_LOCK:
        _STATE.update(updates)


def get_status() -> dict[str, Any]:
    """Returns a snapshot of the current/last job state."""

    with _STATE_LOCK:
        return copy.deepcopy(_STATE)


def start_refresh_job() -> dict[str, Any]:
    """Starts the pipeline in a background thread, unless one is already running."""

    with _STATE_LOCK:
        if _STATE["status"] == "running":
            return copy.deepcopy(_STATE)
        _STATE["status"] = "running"
        _STATE["started_at"] = _now()
        _STATE["finished_at"] = None
        _STATE["error"] = None
        _STATE["steps"] = [
            {"name": name, "status": "pending", "log_tail": None}
            for name in _step_labels()
        ]
        snapshot = copy.deepcopy(_STATE)

    thread = threading.Thread(target=_run_pipeline, daemon=True)
    thread.start()
    return snapshot


def _step_labels() -> list[str]:
    return [
        "Limpar cache de downloads",
        *(name for name, _ in PIPELINE_SCRIPTS),
        "Aplicar SQL no banco",
        "Atualizar materialized views",
    ]


def _update_step(name: str, *, status: str, log_tail: str | None = None) -> None:
    with _STATE_LOCK:
        for step in _STATE["steps"]:
            if step["name"] == name:
                step["status"] = status
                if log_tail is not None:
                    step["log_tail"] = log_tail
                break


def _run_pipeline() -> None:
    try:
        _run_cleanup_step()
        for label, script_args in PIPELINE_SCRIPTS:
            _run_script_step(label, script_args)
        _run_sql_apply_step()
        _run_refresh_step()
    except _StepFailure as exc:
        _set_state(status="error", finished_at=_now(), error=str(exc))
        return
    except Exception as exc:  # noqa: BLE001 - surface any unexpected failure to the UI
        _set_state(status="error", finished_at=_now(), error=f"Falha inesperada: {exc}")
        return

    _set_state(status="success", finished_at=_now())


class _StepFailure(RuntimeError):
    """Raised to abort the pipeline after marking the failing step and the rest as skipped."""


def _mark_remaining_skipped(from_label: str) -> None:
    with _STATE_LOCK:
        found = False
        for step in _STATE["steps"]:
            if step["name"] == from_label:
                found = True
                continue
            if found and step["status"] == "pending":
                step["status"] = "skipped"


def _run_cleanup_step() -> None:
    label = "Limpar cache de downloads"
    _update_step(label, status="running")
    removed = []
    for path in CACHED_DOWNLOADS_TO_CLEAR:
        if path.exists():
            path.unlink()
            removed.append(path.name)
    _update_step(label, status="success", log_tail=f"Removidos: {', '.join(removed) or '(nenhum cache presente)'}")


def _run_script_step(label: str, script_args: list[str]) -> None:
    _update_step(label, status="running")
    try:
        result = subprocess.run(
            [sys.executable, *script_args],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        tail = _tail(f"{exc.stdout or ''}\n{exc.stderr or ''}")
        _update_step(label, status="error", log_tail=tail)
        _mark_remaining_skipped(label)
        raise _StepFailure(f"'{label}' excedeu {SUBPROCESS_TIMEOUT_SECONDS}s.") from exc

    tail = _tail(f"{result.stdout}\n{result.stderr}")
    if result.returncode != 0:
        _update_step(label, status="error", log_tail=tail)
        _mark_remaining_skipped(label)
        raise _StepFailure(f"'{label}' falhou (codigo {result.returncode}). {tail[-500:]}")

    _update_step(label, status="success", log_tail=tail)


def _run_sql_apply_step() -> None:
    label = "Aplicar SQL no banco"
    _update_step(label, status="running")
    applied = []
    try:
        conn = psycopg2.connect(_database_dsn())
    except Exception as exc:  # noqa: BLE001
        _update_step(label, status="error", log_tail=str(exc))
        _mark_remaining_skipped(label)
        raise _StepFailure(f"Nao foi possivel conectar ao Postgres: {exc}") from exc

    try:
        with conn:
            with conn.cursor() as cur:
                for sql_path in SQL_TARGETS:
                    if not sql_path.exists():
                        raise _StepFailure(f"Arquivo SQL esperado nao foi gerado: {sql_path}")
                    cur.execute(sql_path.read_text(encoding="utf-8"))
                    applied.append(sql_path.name)
    except _StepFailure:
        _update_step(label, status="error", log_tail=f"Aplicados antes da falha: {', '.join(applied)}")
        _mark_remaining_skipped(label)
        raise
    except Exception as exc:  # noqa: BLE001
        _update_step(label, status="error", log_tail=f"Aplicados antes da falha: {', '.join(applied)}. Erro: {exc}")
        _mark_remaining_skipped(label)
        raise _StepFailure(f"Falha ao aplicar SQL: {exc}") from exc
    finally:
        conn.close()

    _update_step(label, status="success", log_tail=f"Aplicados: {', '.join(applied)}")


def _run_refresh_step() -> None:
    label = "Atualizar materialized views"
    _update_step(label, status="running")
    try:
        conn = psycopg2.connect(_database_dsn())
        try:
            with conn:
                with conn.cursor() as cur:
                    for view in MATERIALIZED_VIEWS:
                        cur.execute(f"REFRESH MATERIALIZED VIEW {view};")
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001
        _update_step(label, status="error", log_tail=str(exc))
        raise _StepFailure(f"Falha ao atualizar materialized views: {exc}") from exc

    _update_step(label, status="success", log_tail=f"Atualizadas: {', '.join(MATERIALIZED_VIEWS)}")


def _tail(text: str, limit: int = LOG_TAIL_CHARS) -> str:
    text = text.strip()
    return text[-limit:] if len(text) > limit else text
