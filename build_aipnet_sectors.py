"""Generate the same AIPNET input-metrics + green-jobs SQL that
build_solar_sovereignty_metrics.py produces for silicio, for the 3 other
published chains (fertilizantes, combustiveis_transicao, aco).

This was never built for these chains in the original Codex session (only
the silicio brief asked for the AIPNET module) -- extending it is new
work, not a regression fix. Reuses build_solar_sovereignty_metrics.py's
generic build_payload()/write_sql()/write_green_jobs_sql() (now accept a
chain_name and output_dir instead of being silicio-hardcoded) and
build_sector_sovereignty_metrics.py's per-chain NCM/PRODLIST catalog and
global_source citation, via the same "swap core.SOLAR_INPUTS" pattern
already used by build_analytical_staging_sectors.py.

Usage:
    python build_aipnet_sectors.py

Output, per chain:
    outputs/aipnet_sector_<chain>/load_aipnet_input_metrics.sql
    outputs/aipnet_sector_<chain>/load_aipnet_green_jobs.sql
"""

from __future__ import annotations

import json
from pathlib import Path

import build_solar_sovereignty_metrics as core
import build_sector_sovereignty_metrics as sector

ROOT = Path(__file__).resolve().parent


def main() -> None:
    summary: dict[str, object] = {}
    for chain_name, config in sector.CHAINS.items():
        definitions = tuple(config["definitions"])
        core.SOLAR_INPUTS = definitions
        core.PRODLIST_COMPARABLE_INPUTS = set(config["comparable"])

        output_dir = ROOT / "outputs" / f"aipnet_sector_{chain_name}"
        output_dir.mkdir(parents=True, exist_ok=True)

        definitions_by_ncm = {
            ncm: definition for definition in definitions for ncm in definition.ncm_codes
        }
        countries = core.load_countries()
        trade_rows = core.aggregate_trade(definitions_by_ncm)
        production = core.load_domestic_production(definitions_by_ncm)

        payload = core.build_payload(
            trade_rows,
            production,
            countries,
            mineral_evidence={"available": False, "source": None, "reference_year": None},
            chain_name=chain_name,
            global_concentration_source=config.get("global_source"),
            mineral_evidence_input_ids=frozenset(),
        )

        core.write_sql(payload, output_dir)
        core.write_green_jobs_sql(payload, output_dir)

        summary[chain_name] = {
            "inputs": len(payload["inputs"]),
            "formal_jobs_in_tsb_activities": payload["green_jobs"]["formal_jobs_in_tsb_activities"],
            "output": str(output_dir),
        }

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
