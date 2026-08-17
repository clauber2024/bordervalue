"""Load the "Published" analytical staging tables for the silicio (solar) chain.

`build_solar_sovereignty_metrics.py` already computes real, audited trade and
production figures per solar input (see SOLAR_INPUTS there), but only ever
persists them as a single jsonb blob per input_id
(outputs/solar_sovereignty_2026/load_aipnet_solar_metrics.sql, consumed by
the AIPNET network endpoint). Nothing in the repo reshapes that data into the
flat `analytical_comex_staging` / `analytical_industry_and_employment` tables
that `sql/mv_published_indicators.sql` and `sql/mv_published_hhi_risk.sql`
need -- so the FastAPI "/api/chain/silicio" endpoint has never had real data
to serve. This script closes that gap for the silicio chain only. The other
3 chains (fertilizantes, combustiveis_transicao, aco) get the same
treatment in `build_analytical_staging_sectors.py`, which reuses this
module's helpers instead of duplicating them.

Two modelling decisions this script makes explicit (there was no prior art
for either in the codebase):

1. `proportion_factor` is always 1.0. `load_domestic_production()` already
   gates which inputs get a comparable production value via
   PRODLIST_COMPARABLE_INPUTS -- non-comparable (proxy) inputs get
   `value_usd_comparable = None` (-> 0 production), so there is nothing left
   for a fractional rateio to discount. Applying 1.0 uniformly does not
   fabricate precision that isn't already gated upstream.
2. RAIS jobs/wages per conceptual product are derived by splitting each
   TSB-associated CNAE's formal_jobs/wage_mass equally across every
   input_id that CNAE maps to (via the NCM->CNAE TSB bridge). This avoids
   double-counting the same CNAE's jobs against multiple inputs when
   mv_published_indicators sums across products, at the cost of being an
   equal-weight approximation rather than a true per-product allocation.
   There was no existing per-product RAIS split to reuse.

Usage:
    python build_analytical_staging_silicio.py

Output:
    outputs/analytical_staging_silicio/load_analytical_staging_silicio.sql
    (CREATE TABLE IF NOT EXISTS safety net + DELETE scoped to this chain's
    conceptual_product_id values + INSERT ... ready to run with `psql -f`)
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import csv

from build_solar_sovereignty_metrics import (
    BRIDGE_PATH,
    SOLAR_INPUTS,
    aggregate_trade,
    load_countries,
    load_domestic_production,
    load_green_jobs,
    number,
)

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "outputs" / "analytical_staging_silicio"
OUTPUT_SQL = OUTPUT_DIR / "load_analytical_staging_silicio.sql"
REFERENCE_YEAR = 2026


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    definitions_by_ncm = {
        ncm: definition for definition in SOLAR_INPUTS for ncm in definition.ncm_codes
    }
    countries = load_countries()
    trade_rows, _ncm_totals = aggregate_trade(definitions_by_ncm)
    production = load_domestic_production(definitions_by_ncm)
    green_jobs = load_green_jobs()
    prodlist_cnae = load_prodlist_cnae_codes(definitions_by_ncm)

    comex_rows = build_comex_staging_rows(trade_rows, countries)
    industry_rows = build_industry_rows(production, green_jobs, prodlist_cnae)

    write_sql(comex_rows, industry_rows)

    print(
        json.dumps(
            {
                "chain": "silicio",
                "conceptual_products": len(SOLAR_INPUTS),
                "comex_staging_rows": len(comex_rows),
                "industry_rows": len(industry_rows),
                "output": str(OUTPUT_SQL),
            },
            ensure_ascii=False,
        )
    )


def build_comex_staging_rows(
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
                "conceptual_product_id": input_id,
                "cadeia_prioritaria": "silicio",
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
    """First PRODLIST/CNAE code found in the official bridge for each
    input's NCM basket -- a conceptual product can span several NCMs (and
    the bridge is itself N:1 in places), so this is a representative code
    for display purposes (Rastreabilidade drawer), not an exhaustive list."""

    result: dict[str, dict[str, str]] = {}
    with BRIDGE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
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
        # Equal-weight split across every input_id this CNAE maps to --
        # see module docstring, item 2.
        share = 1.0 / len(input_ids)
        for input_id in input_ids:
            jobs_by_input[input_id] += number(activity.get("formal_jobs")) * share
            wages_by_input[input_id] += number(activity.get("wage_mass_brl")) * share

    rows = []
    for definition in SOLAR_INPUTS:
        production_record = production.get(definition.input_id, {})
        value_brl = production_record.get("value_brl") or 0.0
        codes = prodlist_cnae.get(definition.input_id, {})
        rows.append(
            {
                "conceptual_product_id": definition.input_id,
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
    comex_rows: list[dict[str, object]],
    industry_rows: list[dict[str, object]],
) -> None:
    product_ids = sorted({definition.input_id for definition in SOLAR_INPUTS})
    product_ids_sql = ", ".join(f"'{pid}'" for pid in product_ids)

    statements = [
        "-- Gerado por build_analytical_staging_silicio.py -- nao editar a mao.",
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
        # Reload semantics: this script owns exactly the silicio conceptual
        # products, so a full delete+insert of just those ids is safe to
        # rerun without touching any other chain's rows once they exist.
        f"DELETE FROM analytical_comex_staging WHERE conceptual_product_id IN ({product_ids_sql});",
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
    OUTPUT_SQL.write_text("\n".join(statements) + "\n", encoding="utf-8")


def sql_text(value: object) -> str:
    return str(value).replace("'", "''")


def sql_number(value: object) -> str:
    return repr(float(value))


if __name__ == "__main__":
    main()
