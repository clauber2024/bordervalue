"""Load the "Published" analytical staging tables for the 3 sector chains
that were still missing real data: fertilizantes, combustiveis_transicao
and aco.

`build_sector_sovereignty_metrics.py` already defines a real, audited
conceptual-product catalog (NCM baskets, stages, confidence levels) for
these 3 chains in its `CHAINS` dict, and computes real trade/production/
employment figures per product via the same helpers as the solar pipeline
(`build_solar_sovereignty_metrics.py`, imported here as `core`). But it only
ever persists that as a JSON blob per chain
(outputs/sector_sovereignty_<chain>_2026/sector_input_metrics.json).
Nothing reshapes it into the flat `analytical_comex_staging` /
`analytical_industry_and_employment` tables that
`sql/mv_published_indicators.sql` and `sql/mv_published_hhi_risk.sql` need
-- so the FastAPI "/api/chain/{fertilizantes,combustiveis_transicao,aco}"
endpoints have never had real data to serve. This script closes that gap,
mirroring exactly what `build_analytical_staging_silicio.py` already does
for the silicio chain, generalized to loop over `sector.CHAINS`.

Id collision: `mv_published_indicators` has a UNIQUE index on
conceptual_product_id and groups only by that column (not by chain). Of the
30 input ids across the 3 chains, exactly one collides: "amonia" is defined
independently in both combustiveis_transicao and fertilizantes (same NCM
codes, different stage/proxy factor). Loading both under the bare id would
silently merge their trade totals into a single row and mislabel it under
whichever chain name sorts last. So -- for this one id only -- the rows
loaded into Postgres use chain-qualified ids ("amonia_fertilizantes",
"amonia_combustiveis_transicao") instead of the bare "amonia" used in
`build_sector_sovereignty_metrics.py`'s own JSON output. That script and its
canonical ids are left untouched; the rename only exists in this loader's
Postgres rows.

Usage:
    python build_analytical_staging_sectors.py

Output:
    outputs/analytical_staging_sectors/load_analytical_staging_<chain>.sql
    (one file per chain, CREATE TABLE IF NOT EXISTS safety net + DELETE
    scoped to that chain's conceptual_product_id values + INSERT, ready to
    run with `psql -f`)
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

import build_solar_sovereignty_metrics as core
import build_sector_sovereignty_metrics as sector

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "outputs" / "analytical_staging_sectors"
REFERENCE_YEAR = 2026

# The only conceptual_product_id shared by two chains -- see module
# docstring. Maps (chain_name, bare_input_id) -> id to store in Postgres.
ID_OVERRIDES: dict[tuple[str, str], str] = {
    ("combustiveis_transicao", "amonia"): "amonia_combustiveis_transicao",
    ("fertilizantes", "amonia"): "amonia_fertilizantes",
}


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    summary: dict[str, object] = {}
    for chain_name, config in sector.CHAINS.items():
        definitions = tuple(config["definitions"])
        core.SOLAR_INPUTS = definitions
        core.PRODLIST_COMPARABLE_INPUTS = set(config["comparable"])

        definitions_by_ncm = {
            ncm: definition for definition in definitions for ncm in definition.ncm_codes
        }
        countries = core.load_countries()
        trade_rows, _ncm_totals = core.aggregate_trade(definitions_by_ncm)
        production = core.load_domestic_production(definitions_by_ncm)
        green_jobs = core.load_green_jobs()
        prodlist_cnae = load_prodlist_cnae_codes(definitions_by_ncm)

        comex_rows = build_comex_staging_rows(chain_name, trade_rows, countries)
        industry_rows = build_industry_rows(
            chain_name, definitions, production, green_jobs, prodlist_cnae
        )

        output_sql = OUTPUT_DIR / f"load_analytical_staging_{chain_name}.sql"
        write_sql(chain_name, definitions, comex_rows, industry_rows, output_sql)

        summary[chain_name] = {
            "conceptual_products": len(definitions),
            "comex_staging_rows": len(comex_rows),
            "industry_rows": len(industry_rows),
            "output": str(output_sql),
        }

    print(json.dumps(summary, ensure_ascii=False, indent=2))


def resolve_product_id(chain_name: str, input_id: str) -> str:
    return ID_OVERRIDES.get((chain_name, input_id), input_id)


def build_comex_staging_rows(
    chain_name: str,
    trade_rows: dict[tuple[str, int, int, str, str], dict[str, float]],
    countries: dict[str, dict[str, str]],
) -> list[dict[str, object]]:
    """One row per (input_id, country) merging import and export totals for
    REFERENCE_YEAR. A country that only appears on one side of the flow
    still gets a full row, with the other side left at 0."""

    totals: dict[tuple[str, str], dict[str, float]] = defaultdict(
        lambda: {"import_fob": 0.0, "import_kg": 0.0, "export_fob": 0.0}
    )
    for (input_id, year, _month, flow, country_code), values in trade_rows.items():
        if year != REFERENCE_YEAR:
            continue
        key = (input_id, country_code)
        if flow == "IMP":
            totals[key]["import_fob"] += values["value_usd"]
            totals[key]["import_kg"] += values["net_weight_kg"]
        elif flow == "EXP":
            totals[key]["export_fob"] += values["value_usd"]

    rows = []
    for (input_id, country_code), values in totals.items():
        country_name = countries.get(country_code, {}).get("country_name", "Nao informado")
        rows.append(
            {
                "conceptual_product_id": resolve_product_id(chain_name, input_id),
                "cadeia_prioritaria": chain_name,
                "principal_pais_origem": country_name,
                "importacao_valor_fob": values["import_fob"],
                "importacao_peso_liquido": values["import_kg"],
                "exportacao_valor_fob": values["export_fob"],
            }
        )
    return rows


def load_prodlist_cnae_codes(
    definitions_by_ncm: dict[str, object],
) -> dict[str, dict[str, str]]:
    """Same logic as build_analytical_staging_silicio.py's helper of the
    same name -- first PRODLIST/CNAE code found in the official bridge per
    input_id, representative rather than exhaustive."""

    result: dict[str, dict[str, str]] = {}
    with core.BRIDGE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            definition = definitions_by_ncm.get(str(row.get("ncm", "")).zfill(8))
            if definition is None or definition.input_id in result:
                continue
            result[definition.input_id] = {
                "prodlist_codigo": str(row.get("prodlist_code", "")).zfill(8)[:8],
                "cnae_codigo": str(row.get("cnae_class", "")).zfill(4)[:4],
            }
    return result


def build_industry_rows(
    chain_name: str,
    definitions: tuple,
    production: dict[str, dict[str, object]],
    green_jobs: dict[str, object],
    prodlist_cnae: dict[str, dict[str, str]],
) -> list[dict[str, object]]:
    jobs_by_input: dict[str, float] = defaultdict(float)
    wages_by_input: dict[str, float] = defaultdict(float)
    for activity in green_jobs.get("activities", []):
        input_ids = activity.get("input_ids") or []
        if not input_ids:
            continue
        # Equal-weight split across every input_id this CNAE maps to -- see
        # build_analytical_staging_silicio.py's module docstring, item 2,
        # for why this avoids double-counting when mv_published_indicators
        # sums across products.
        share = 1.0 / len(input_ids)
        for input_id in input_ids:
            jobs_by_input[input_id] += core.number(activity.get("formal_jobs")) * share
            wages_by_input[input_id] += core.number(activity.get("wage_mass_brl")) * share

    rows = []
    for definition in definitions:
        production_record = production.get(definition.input_id, {})
        value_brl = production_record.get("value_brl") or 0.0
        codes = prodlist_cnae.get(definition.input_id, {})
        rows.append(
            {
                "conceptual_product_id": resolve_product_id(chain_name, definition.input_id),
                "produto_nome": definition.label,
                "ncm_codigo": definition.ncm_codes[0] if definition.ncm_codes else "00000000",
                "cnae_codigo": codes.get("cnae_codigo", ""),
                "prodlist_codigo": codes.get("prodlist_codigo", ""),
                "valor_producao_pia": value_brl,
                "proportion_factor": 1.0,
                "qtde_vinculos_rais": jobs_by_input.get(definition.input_id, 0.0),
                "massa_salarial_rais": wages_by_input.get(definition.input_id, 0.0),
            }
        )
    return rows


def write_sql(
    chain_name: str,
    definitions: tuple,
    comex_rows: list[dict[str, object]],
    industry_rows: list[dict[str, object]],
    output_path: Path,
) -> None:
    product_ids = sorted(
        {resolve_product_id(chain_name, definition.input_id) for definition in definitions}
    )
    product_ids_sql = ", ".join(f"'{pid}'" for pid in product_ids)

    statements = [
        f"-- Gerado por build_analytical_staging_sectors.py (cadeia: {chain_name}) -- nao editar a mao.",
        "CREATE TABLE IF NOT EXISTS analytical_comex_staging (",
        "  conceptual_product_id text NOT NULL, cadeia_prioritaria text, principal_pais_origem text,",
        "  importacao_valor_fob numeric NOT NULL DEFAULT 0,",
        "  importacao_peso_liquido numeric NOT NULL DEFAULT 0,",
        "  exportacao_valor_fob numeric NOT NULL DEFAULT 0",
        ");",
        "CREATE TABLE IF NOT EXISTS analytical_industry_and_employment (",
        "  conceptual_product_id text NOT NULL, produto_nome text, ncm_codigo text,",
        "  cnae_codigo text, prodlist_codigo text,",
        "  valor_producao_pia numeric NOT NULL DEFAULT 0,",
        "  proportion_factor numeric NOT NULL DEFAULT 1,",
        "  qtde_vinculos_rais numeric NOT NULL DEFAULT 0,",
        "  massa_salarial_rais numeric NOT NULL DEFAULT 0",
        ");",
        "BEGIN;",
        # Reload semantics: analytical_comex_staging carries cadeia_prioritaria,
        # so deleting by chain (not by the current run's id list) is what
        # actually achieves "this file owns exactly this chain's rows" --
        # deleting by id list only would leave orphaned rows behind any time
        # an input_id is renamed or split (e.g. "superfosfatos" ->
        # "superfosfato_triplo"/"superfosfato_simples"), since the old id
        # never appears in a future run's IN-list and so is never targeted.
        # mv_published_indicators is driven by a LEFT JOIN FROM
        # analytical_comex_staging, so this alone is enough to make orphans
        # disappear from the published API even without touching the second
        # table below.
        f"DELETE FROM analytical_comex_staging WHERE cadeia_prioritaria = '{sql_text(chain_name)}';",
        # analytical_industry_and_employment has no chain column to scope a
        # full delete by, so this still only clears the current run's ids --
        # a renamed/removed id can leave a harmless orphan row here (unused,
        # since nothing joins to it once its analytical_comex_staging row is
        # gone above).
        f"DELETE FROM analytical_industry_and_employment WHERE conceptual_product_id IN ({product_ids_sql});",
    ]

    for row in comex_rows:
        statements.append(
            "INSERT INTO analytical_comex_staging "
            "(conceptual_product_id, cadeia_prioritaria, principal_pais_origem, "
            "importacao_valor_fob, importacao_peso_liquido, exportacao_valor_fob) VALUES ("
            f"'{sql_text(row['conceptual_product_id'])}', "
            f"'{sql_text(row['cadeia_prioritaria'])}', "
            f"'{sql_text(row['principal_pais_origem'])}', "
            f"{sql_number(row['importacao_valor_fob'])}, "
            f"{sql_number(row['importacao_peso_liquido'])}, "
            f"{sql_number(row['exportacao_valor_fob'])});"
        )

    for row in industry_rows:
        statements.append(
            "INSERT INTO analytical_industry_and_employment "
            "(conceptual_product_id, produto_nome, ncm_codigo, cnae_codigo, prodlist_codigo, "
            "valor_producao_pia, proportion_factor, qtde_vinculos_rais, massa_salarial_rais) VALUES ("
            f"'{sql_text(row['conceptual_product_id'])}', "
            f"'{sql_text(row['produto_nome'])}', "
            f"'{sql_text(row['ncm_codigo'])}', "
            f"'{sql_text(row['cnae_codigo'])}', "
            f"'{sql_text(row['prodlist_codigo'])}', "
            f"{sql_number(row['valor_producao_pia'])}, "
            f"{sql_number(row['proportion_factor'])}, "
            f"{sql_number(row['qtde_vinculos_rais'])}, "
            f"{sql_number(row['massa_salarial_rais'])});"
        )

    statements.append("COMMIT;")
    output_path.write_text("\n".join(statements) + "\n", encoding="utf-8")


def sql_text(value: object) -> str:
    return str(value).replace("'", "''")


def sql_number(value: object) -> str:
    return repr(float(value))


if __name__ == "__main__":
    main()
