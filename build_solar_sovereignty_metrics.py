"""Build auditable sovereignty metrics for the Brazilian solar-PV value chain.

The job streams official Comex Stat CSV files, joins the existing official
NCM-PRODLIST bridge and Published production indicators, and emits JSON/CSV/SQL
artifacts without requiring third-party Python packages.
"""

from __future__ import annotations

import csv
import json
import math
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parent
INPUTS = ROOT / "inputs" / "official"
OUTPUT_DIR = ROOT / "outputs" / "solar_sovereignty_2026"
COUNTRIES_PATH = ROOT / "dados" / "cache" / "dim_pais_comex.csv"
BRIDGE_PATH = ROOT / "outputs" / "official_2026" / "bridge_ncm_prodlist_cnae.csv"
PRODUCTION_PATH = (
    ROOT
    / "outputs"
    / "final_border_value_2026"
    / "border_value_indicadores_finais_cnae_prodlist.csv"
)
TSB_DIR = ROOT / "outputs" / "tsb_bridge_2026"
TSB_NCM_PATH = TSB_DIR / "bridge_tsb_ncm.csv"
TSB_CNAE_PATH = TSB_DIR / "bridge_tsb_cnae_class.csv"
TSB_RAIS_CNAE_PATH = TSB_DIR / "rais_tsb_employment_cnae.csv"
RAIS_FACT_PATH = ROOT / "outputs" / "official_2026_rais" / "fact_employment_rais.csv"
ANM_PATH = ROOT / "outputs" / "final_border_value_2026" / "fact_anm_mineral_production.csv"
ANM_STATUS_PATH = ROOT / "outputs" / "final_border_value_2026" / "fontes_anm_amb_status.csv"
ANM_RAW_PATHS = {
    "bruta": INPUTS / "anm_amb_producao_bruta.csv",
    "beneficiada": INPUTS / "anm_amb_producao_beneficiada.csv",
}

# PRODLIST can support an apparent-consumption denominator only when its
# industrial product is comparable to the conceptual input. High-purity
# silicon and doped semiconductor elements do not isolate solar polysilicon or
# photovoltaic wafers, so those mappings must not be promoted to production.
PRODLIST_COMPARABLE_INPUTS = {
    "quartzo",
    "quartzito",
    "silicio_grau_metalurgico",
    "celulas_fotovoltaicas",
    "modulos_fotovoltaicos",
}


@dataclass(frozen=True)
class SolarInputDefinition:
    input_id: str
    label: str
    stage: str
    ncm_codes: tuple[str, ...]
    measurement_method: str
    confidence_level: str
    data_gap_reason: str | None = None
    global_china_share: float | None = None


SOLAR_INPUTS = (
    SolarInputDefinition(
        "quartzo",
        "Quartzo",
        "extracao",
        ("25061000",),
        "validated",
        "alta",
    ),
    SolarInputDefinition(
        "quartzito",
        "Quartzito",
        "extracao",
        ("25062000",),
        "validated",
        "alta",
    ),
    SolarInputDefinition(
        "silicio_grau_metalurgico",
        "Silício grau metalúrgico",
        "processamento",
        ("28046900",),
        "estimated",
        "media",
        "A NCM não separa o uso fotovoltaico dos demais usos do silício.",
    ),
    SolarInputDefinition(
        "polissilicio_solar",
        "Polissilício de grau solar",
        "refinamento",
        ("28046100",),
        "estimated",
        "media",
        "A NCM de silício de alta pureza não identifica exclusivamente o grau solar.",
        0.85,
    ),
    SolarInputDefinition(
        "wafers_fotovoltaicos",
        "Wafers fotovoltaicos",
        "componentes_avancados",
        ("38180010", "38180090"),
        "estimated",
        "baixa",
        "As NCMs de elementos dopados também abrangem aplicações eletrônicas não solares.",
        0.95,
    ),
    SolarInputDefinition(
        "celulas_fotovoltaicas",
        "Células fotovoltaicas",
        "produto_final",
        ("85414210", "85414220", "85414290"),
        "validated",
        "alta",
    ),
    SolarInputDefinition(
        "modulos_fotovoltaicos",
        "Módulos fotovoltaicos",
        "produto_final",
        ("85414300",),
        "validated",
        "alta",
    ),
    SolarInputDefinition(
        "silica_industrial", "Sílica industrial", "extracao", ("25051000",),
        "estimated", "media", "Proxy por areias siliciosas e quartzosas; a NCM não isola o uso solar.",
    ),
    SolarInputDefinition(
        "eletrodos_carbono", "Eletrodos de carbono", "processamento",
        ("38013010", "85451100", "85451910", "85451990"), "estimated", "media",
        "Cesta de pastas e eletrodos de carbono; exige fator de uso na produção de silício.",
    ),
    SolarInputDefinition(
        "hidrogenio_alta_pureza", "Hidrogênio de alta pureza", "refinamento", ("28041000",),
        "estimated", "media", "A NCM de hidrogênio não diferencia pureza nem aplicação solar.",
    ),
    SolarInputDefinition(
        "acido_cloridrico", "Ácido clorídrico", "refinamento", ("28061010", "28061020"),
        "estimated", "media", "O comércio total do produto é usado como proxy da disponibilidade para refino solar.",
    ),
    SolarInputDefinition(
        "cadinhos_quartzo", "Cadinhos de quartzo", "componentes_avancados", ("69032010",),
        "estimated", "baixa", "A classificação de cadinhos não identifica exclusivamente quartzo nem uso fotovoltaico.",
    ),
    SolarInputDefinition(
        "vidro_solar", "Vidro solar", "produto_final", ("70051000", "70071900"),
        "estimated", "baixa", "Proxy por vidro revestido e vidro temperado; não há identificação exclusiva para módulos solares.",
    ),
    SolarInputDefinition(
        "encapsulantes_eva", "Encapsulantes EVA", "produto_final", ("39013010", "39013090"),
        "estimated", "media", "Proxy por copolímeros de etileno e acetato de vinila, sem fator de uso fotovoltaico.",
    ),
    SolarInputDefinition(
        "fitas_cobre", "Fitas de cobre", "produto_final", ("74091100", "74091900"),
        "estimated", "baixa", "Proxy por chapas, folhas e tiras de cobre refinado em rolos e outras formas.",
    ),
    SolarInputDefinition(
        "molduras_aluminio", "Molduras de alumínio", "produto_final",
        ("76041021", "76041029", "76042100", "76042920"), "estimated", "baixa",
        "Proxy por perfis de alumínio; a destinação para módulos não é isolada.",
    ),
)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    definitions_by_ncm = {
        ncm: definition for definition in SOLAR_INPUTS for ncm in definition.ncm_codes
    }
    countries = load_countries()
    trade_rows = aggregate_trade(definitions_by_ncm)
    production = load_domestic_production(definitions_by_ncm)
    payload = build_payload(trade_rows, production, countries, load_mineral_evidence())

    write_json(payload)
    write_summary_csv(payload)
    write_country_csv(payload)
    write_monthly_csv(payload)
    write_sql(payload)

    print(
        json.dumps(
            {
                "inputs": len(payload["inputs"]),
                "trade_rows": sum(item["trade_record_count"] for item in payload["inputs"]),
                "output": str(OUTPUT_DIR),
            },
            ensure_ascii=False,
        )
    )


def aggregate_trade(
    definitions_by_ncm: dict[str, SolarInputDefinition],
) -> dict[tuple[str, int, int, str, str], dict[str, float]]:
    totals: dict[tuple[str, int, int, str, str], dict[str, float]] = defaultdict(
        lambda: {"value_usd": 0.0, "net_weight_kg": 0.0, "records": 0.0}
    )
    for year in (2025, 2026):
        for flow, prefix in (("IMP", "IMP"), ("EXP", "EXP")):
            path = INPUTS / f"{prefix}_{year}.csv"
            with path.open("r", encoding="utf-8-sig", newline="") as handle:
                reader = csv.DictReader(handle, delimiter=";")
                for row in reader:
                    ncm = str(row["CO_NCM"]).zfill(8)
                    definition = definitions_by_ncm.get(ncm)
                    if definition is None:
                        continue
                    key = (
                        definition.input_id,
                        int(row["CO_ANO"]),
                        int(row["CO_MES"]),
                        flow,
                        str(row["CO_PAIS"]).zfill(3),
                    )
                    totals[key]["value_usd"] += number(row.get("VL_FOB"))
                    totals[key]["net_weight_kg"] += number(row.get("KG_LIQUIDO"))
                    totals[key]["records"] += 1
    return totals


def load_countries() -> dict[str, dict[str, str]]:
    # The official Comex country dimension is distributed as Windows-1252,
    # while the transaction extracts are UTF-8.
    with COUNTRIES_PATH.open("r", encoding="cp1252", newline="") as handle:
        return {
            str(row["CO_PAIS"]).zfill(3): {
                "country_name": row["NO_PAIS"],
                "country_iso3": row["CO_PAIS_ISOA3"],
            }
            for row in csv.DictReader(handle, delimiter=";")
        }


def load_domestic_production(
    definitions_by_ncm: dict[str, SolarInputDefinition],
) -> dict[str, dict[str, object]]:
    production_by_prodlist: dict[str, float] = {}
    production_brl_by_prodlist: dict[str, float] = {}
    status_by_prodlist: dict[str, str] = {}
    with PRODUCTION_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            code = row.get("prodlist_code", "")
            production_by_prodlist[code] = max(
                production_by_prodlist.get(code, 0.0),
                number(row.get("domestic_production_value_usd_comparable")),
            )
            production_brl_by_prodlist[code] = max(
                production_brl_by_prodlist.get(code, 0.0),
                number(row.get("production_value_brl_thousand")) * 1000,
            )
            status_by_prodlist[code] = row.get("production_status", "missing")

    mappings: dict[str, dict[str, float]] = defaultdict(dict)
    with BRIDGE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            definition = definitions_by_ncm.get(str(row.get("ncm", "")).zfill(8))
            if definition is None:
                continue
            prodlist = row.get("prodlist_code", "")
            mappings[definition.input_id][prodlist] = max(
                mappings[definition.input_id].get(prodlist, 0.0),
                number(row.get("allocation_weight"), default=1.0),
            )

    result: dict[str, dict[str, object]] = {}
    for definition in SOLAR_INPUTS:
        mapped = mappings.get(definition.input_id, {})
        if definition.input_id not in PRODLIST_COMPARABLE_INPUTS:
            result[definition.input_id] = {
                "value_usd_comparable": None,
                "value_brl": None,
                "prodlist_codes": sorted(mapped),
                "production_statuses": ["not_comparable"] if mapped else [],
            }
            continue
        value = sum(production_by_prodlist.get(code, 0.0) * weight for code, weight in mapped.items())
        value_brl = sum(production_brl_by_prodlist.get(code, 0.0) * weight for code, weight in mapped.items())
        statuses = sorted({status_by_prodlist.get(code, "missing") for code in mapped})
        result[definition.input_id] = {
            "value_usd_comparable": value if value > 0 else None,
            "value_brl": value_brl if value_brl > 0 else None,
            "prodlist_codes": sorted(mapped),
            "production_statuses": statuses,
        }
    return result


def load_mineral_evidence() -> dict[str, object]:
    observations: list[dict[str, object]] = []
    for stage, path in ANM_RAW_PATHS.items():
        if not path.exists():
            continue
        with path.open("r", encoding="cp1252", newline="") as handle:
            for row in csv.DictReader(handle):
                substance = row.get("Substância Mineral", "")
                if "quartzo" not in substance.lower():
                    continue
                quantity_key = (
                    "Quantidade Produção - Minério ROM (t)"
                    if stage == "bruta"
                    else "Quantidade Produção"
                )
                observations.append(
                    {
                        "stage": stage,
                        "year": int(row["Ano base"]),
                        "uf": row.get("UF", ""),
                        "substance": substance,
                        "quantity": decimal_comma(row.get(quantity_key)),
                        "production_value_brl": decimal_comma(row.get("Valor Venda (R$)")),
                    }
                )

    latest_year = max((int(item["year"]) for item in observations), default=None)
    latest = [item for item in observations if item["year"] == latest_year]
    available = bool(latest)
    return {
        "available": available,
        "source": "ANM/AMB - Producao_Bruta.csv e Producao_Beneficiada.csv",
        "source_url": "https://dadosabertos.anm.gov.br/AMB/",
        "reference_year": latest_year,
        "quartz_record_count": len(latest),
        "gross_quantity_t": sum(float(item["quantity"]) for item in latest if item["stage"] == "bruta"),
        "beneficiated_quantity": sum(float(item["quantity"]) for item in latest if item["stage"] == "beneficiada"),
        "production_value_brl": sum(float(item["production_value_brl"]) for item in latest),
        "states": sorted({str(item["uf"]) for item in latest if item["uf"]}),
        "data_gap_reason": None if available else (
            "Não foram encontradas observações de quartzo nos arquivos ANM/AMB locais."
        ),
    }


def load_green_jobs() -> dict[str, object]:
    ncm_to_inputs = {
        ncm: definition.input_id for definition in SOLAR_INPUTS for ncm in definition.ncm_codes
    }
    cnae_to_inputs: dict[str, set[str]] = defaultdict(set)
    associated_cnaes: set[str] = set()

    with TSB_NCM_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            input_id = ncm_to_inputs.get(str(row.get("ncm", "")).zfill(8))
            if input_id is None or str(row.get("tsb_associated", "")).lower() != "true":
                continue
            for cnae in str(row.get("cnae_class_list", "")).split(";"):
                if cnae:
                    associated_cnaes.add(cnae)
                    cnae_to_inputs[cnae].add(input_id)

    cnae_metadata: dict[str, dict[str, object]] = {}
    with TSB_CNAE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            cnae = str(row.get("cnae_class", ""))
            if cnae not in associated_cnaes:
                continue
            cnae_metadata[cnae] = {
                "sector_names": [item for item in str(row.get("tsb_setor_scn67_list", "")).split(";") if item],
                "exposure_ratio": number(row.get("tsb_exposicao_scn67_max")),
                "exposure_group": row.get("tsb_grupo_exposicao", ""),
                "technical_reading": row.get("tsb_leitura_tecnica", ""),
            }

    activities: list[dict[str, object]] = []
    total_jobs = 0.0
    weighted_jobs = 0.0
    total_wage_mass = 0.0
    with TSB_RAIS_CNAE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            cnae = str(row.get("cnae_class", ""))
            if cnae not in associated_cnaes:
                continue
            jobs = number(row.get("formal_jobs"))
            wage_mass = number(row.get("wage_mass"))
            exposure = number(cnae_metadata.get(cnae, {}).get("exposure_ratio"))
            total_jobs += jobs
            weighted_jobs += jobs * exposure
            total_wage_mass += wage_mass
            activities.append({
                "cnae_class": cnae,
                "sector_names": cnae_metadata.get(cnae, {}).get("sector_names", []),
                "formal_jobs": int(jobs),
                "wage_mass_brl": wage_mass,
                "exposure_ratio": exposure,
                "exposure_group": cnae_metadata.get(cnae, {}).get("exposure_group", ""),
                "technical_reading": cnae_metadata.get(cnae, {}).get("technical_reading", ""),
                "input_ids": sorted(cnae_to_inputs.get(cnae, set())),
            })

    territory: dict[str, dict[str, float]] = defaultdict(lambda: {"formal_jobs": 0.0, "wage_mass_brl": 0.0})
    with RAIS_FACT_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if str(row.get("cnae_class", "")) not in associated_cnaes:
                continue
            uf = str(row.get("uf", "N/D"))
            territory[uf]["formal_jobs"] += number(row.get("formal_jobs"))
            territory[uf]["wage_mass_brl"] += number(row.get("wage_mass"))

    return {
        "reference_year": 2024,
        "formal_jobs_in_tsb_activities": int(total_jobs),
        "exposure_weighted_jobs_estimate": round(weighted_jobs),
        "wage_mass_brl": total_wage_mass,
        "cnae_count": len(associated_cnaes),
        "activities": sorted(activities, key=lambda item: item["formal_jobs"], reverse=True),
        "top_states": [
            {"uf": uf, "formal_jobs": int(values["formal_jobs"]), "wage_mass_brl": values["wage_mass_brl"]}
            for uf, values in sorted(territory.items(), key=lambda item: item[1]["formal_jobs"], reverse=True)[:8]
        ],
        "methodology_note": (
            "A TSB classifica atividades econômicas, não trabalhadores individualmente. "
            "O total associado soma vínculos RAIS nas classes CNAE alcançadas pelas cestas NCM solares e marcadas pela TSB. "
            "A estimativa ponderada multiplica os vínculos pelo maior grau de exposição TSB do setor SCN67 e deve ser lida como proxy, não como certificação ocupacional."
        ),
    }


def build_payload(
    trade_rows: dict[tuple[str, int, int, str, str], dict[str, float]],
    production: dict[str, dict[str, object]],
    countries: dict[str, dict[str, str]],
    mineral_evidence: dict[str, object],
) -> dict[str, object]:
    inputs: list[dict[str, object]] = []
    for definition in SOLAR_INPUTS:
        rows = [
            (key, values)
            for key, values in trade_rows.items()
            if key[0] == definition.input_id
        ]
        monthly = build_monthly(rows)
        suppliers = build_suppliers(rows, countries)
        imports = sum(values["value_usd"] for key, values in rows if key[3] == "IMP" and key[1] == 2026)
        exports = sum(values["value_usd"] for key, values in rows if key[3] == "EXP" and key[1] == 2026)
        import_weight = sum(values["net_weight_kg"] for key, values in rows if key[3] == "IMP" and key[1] == 2026)
        export_weight = sum(values["net_weight_kg"] for key, values in rows if key[3] == "EXP" and key[1] == 2026)
        production_record = production[definition.input_id]
        domestic = production_record["value_usd_comparable"]
        apparent = max(float(domestic or 0) + imports - exports, 0.0) if domestic is not None else None
        dependency = imports / apparent if apparent and apparent > 0 else None
        china = next((item for item in suppliers if item["country_iso3"] == "CHN"), None)
        hhi = sum(float(item["share"]) ** 2 for item in suppliers) * 10000
        global_hhi_floor = (
            definition.global_china_share**2 * 10000
            if definition.global_china_share is not None
            else None
        )
        inputs.append(
            {
                "input_id": definition.input_id,
                "label": definition.label,
                "stage": definition.stage,
                "ncm_codes": list(definition.ncm_codes),
                "reference_period": "2026-H1",
                "imports_value_usd": imports,
                "exports_value_usd": exports,
                "imports_net_weight_kg": import_weight,
                "exports_net_weight_kg": export_weight,
                "trade_balance_usd": exports - imports,
                "china_share_brazilian_imports": china["share"] if china else 0.0,
                "supplier_hhi_brazil": hhi,
                "top_supplier": suppliers[0] if suppliers else None,
                "suppliers": suppliers,
                "monthly_trade": monthly,
                "domestic_production_value_usd_comparable": domestic,
                "domestic_production_value_brl": production_record["value_brl"],
                "prodlist_codes": production_record["prodlist_codes"],
                "production_statuses": production_record["production_statuses"],
                "external_dependency": dependency,
                "global_china_share": definition.global_china_share,
                "global_hhi_floor": global_hhi_floor,
                "measurement_method": definition.measurement_method,
                "confidence_level": definition.confidence_level,
                "data_gap_reason": definition.data_gap_reason,
                "trade_record_count": int(sum(values["records"] for _, values in rows)),
                "mineral_evidence": mineral_evidence if definition.input_id in {"quartzo", "quartzito"} else None,
            }
        )
    return {
        "chain_name": "silicio",
        "reference_period": "2026-H1",
        "methodology_version": "1.1.0-aipnet-solar",
        "global_concentration_source": {
            "institution": "International Energy Agency (IEA)",
            "publication": "Energy Technology Perspectives 2026 - Supply chain risks and industrial competitiveness",
            "url": "https://www.iea.org/reports/energy-technology-perspectives-2026/supply-chain-risks-and-industrial-competitiveness",
            "note": "A IEA reporta cerca de 85% para a cadeia solar chinesa e 95% para wafers; os percentuais são evidência estrutural global, não dependência aparente brasileira.",
        },
        "mineral_evidence": mineral_evidence,
        "green_jobs": load_green_jobs(),
        "inputs": inputs,
    }


def build_suppliers(
    rows: list[tuple[tuple[str, int, int, str, str], dict[str, float]]],
    countries: dict[str, dict[str, str]],
) -> list[dict[str, object]]:
    values: dict[str, float] = defaultdict(float)
    for key, metrics in rows:
        _, year, _, flow, country = key
        if year == 2026 and flow == "IMP":
            values[country] += metrics["value_usd"]
    total = sum(values.values())
    return [
        {
            "country_code": code,
            "country_name": countries.get(code, {}).get("country_name", "Não informado"),
            "country_iso3": countries.get(code, {}).get("country_iso3", "ZZZ"),
            "value_usd": value,
            "share": value / total if total else 0.0,
        }
        for code, value in sorted(values.items(), key=lambda item: item[1], reverse=True)
    ]


def build_monthly(
    rows: list[tuple[tuple[str, int, int, str, str], dict[str, float]]],
) -> list[dict[str, object]]:
    monthly: dict[tuple[int, int, str], dict[str, float]] = defaultdict(
        lambda: {"value_usd": 0.0, "net_weight_kg": 0.0}
    )
    for key, metrics in rows:
        _, year, month, flow, _ = key
        monthly[(year, month, flow)]["value_usd"] += metrics["value_usd"]
        monthly[(year, month, flow)]["net_weight_kg"] += metrics["net_weight_kg"]
    return [
        {
            "period": f"{year}-{month:02d}",
            "flow": flow,
            **metrics,
        }
        for (year, month, flow), metrics in sorted(monthly.items())
    ]


def write_json(payload: dict[str, object]) -> None:
    (OUTPUT_DIR / "solar_input_metrics.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def write_summary_csv(payload: dict[str, object]) -> None:
    fields = [
        "input_id", "label", "stage", "reference_period", "imports_value_usd",
        "exports_value_usd", "imports_net_weight_kg", "exports_net_weight_kg",
        "trade_balance_usd", "china_share_brazilian_imports", "supplier_hhi_brazil",
        "domestic_production_value_usd_comparable", "external_dependency",
        "global_china_share", "global_hhi_floor", "measurement_method",
        "confidence_level", "data_gap_reason",
    ]
    write_rows(OUTPUT_DIR / "solar_input_summary.csv", fields, payload["inputs"])


def write_country_csv(payload: dict[str, object]) -> None:
    rows = []
    for item in payload["inputs"]:
        rows.extend({"input_id": item["input_id"], **supplier} for supplier in item["suppliers"])
    write_rows(
        OUTPUT_DIR / "solar_input_suppliers_2026_h1.csv",
        ["input_id", "country_code", "country_name", "country_iso3", "value_usd", "share"],
        rows,
    )


def write_monthly_csv(payload: dict[str, object]) -> None:
    rows = []
    for item in payload["inputs"]:
        rows.extend({"input_id": item["input_id"], **period} for period in item["monthly_trade"])
    write_rows(
        OUTPUT_DIR / "solar_input_monthly_trade.csv",
        ["input_id", "period", "flow", "value_usd", "net_weight_kg"],
        rows,
    )


def write_rows(path: Path, fields: list[str], rows: Iterable[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_sql(payload: dict[str, object]) -> None:
    statements = [
        "CREATE TABLE IF NOT EXISTS aipnet_solar_input_metrics (",
        "  input_id text PRIMARY KEY, label text NOT NULL, stage text NOT NULL,",
        "  reference_period text NOT NULL, metrics jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()",
        ");",
    ]
    for item in payload["inputs"]:
        serialized = json.dumps(item, ensure_ascii=False).replace("'", "''")
        statements.append(
            "INSERT INTO aipnet_solar_input_metrics (input_id, label, stage, reference_period, metrics) "
            f"VALUES ('{item['input_id']}', '{sql_text(item['label'])}', '{sql_text(item['stage'])}', "
            f"'{sql_text(item['reference_period'])}', '{serialized}'::jsonb) "
            "ON CONFLICT (input_id) DO UPDATE SET label=EXCLUDED.label, stage=EXCLUDED.stage, "
            "reference_period=EXCLUDED.reference_period, metrics=EXCLUDED.metrics, updated_at=now();"
        )
    (OUTPUT_DIR / "load_aipnet_solar_metrics.sql").write_text("\n".join(statements) + "\n", encoding="utf-8")


def number(value: object, default: float = 0.0) -> float:
    try:
        parsed = float(value or 0)
        return parsed if math.isfinite(parsed) else default
    except (TypeError, ValueError):
        return default


def decimal_comma(value: object) -> float:
    text = str(value or "").strip().replace(".", "").replace(",", ".")
    return number(text)


def sql_text(value: object) -> str:
    return str(value).replace("'", "''")


if __name__ == "__main__":
    main()
