from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dashboard" / "data.json"
TRADE_OUT = ROOT / "dashboard" / "trade_dashboard.parquet"
FINAL = ROOT / "outputs" / "final_border_value_2026"
OFFICIAL = ROOT / "outputs" / "official_2026"
INPUTS = ROOT / "inputs" / "official"


def num(value):
    if pd.isna(value):
        return None
    return float(value)


def text(value):
    if pd.isna(value):
        return ""
    return str(value)


def compact_records(df: pd.DataFrame) -> list[dict]:
    return df.where(pd.notna(df), None).to_dict(orient="records")


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
    manifest_path = OFFICIAL / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    metadata = manifest.get("metadata", {})
    tables = manifest.get("tables", {})
    quality_path = OFFICIAL / "quality_summary.csv"
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
            "evidence": f"{len(quality)} metricas em outputs/official_2026/quality_summary.csv.",
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
        "sources": [
            source_status(INPUTS / "EXP_2026.csv", "Comex Stat exportacoes", "Mensal", "Tecnico de dados", "Comercio exterior", "comex_exp"),
            source_status(INPUTS / "IMP_2026.csv", "Comex Stat importacoes", "Mensal", "Tecnico de dados", "Comercio exterior", "comex_imp"),
            source_status(INPUTS / "ncm_prodlist_2025.xlsx", "Ponte NCM-PRODLIST CONCLA/IBGE", "Quando houver nova tabela", "Tecnico de dados", "Correspondencia", "ncm_prodlist"),
            source_status(INPUTS / "pia_2024_value_production.json", "PIA-Produto valor da producao", "Anual", "Tecnico de dados", "Producao domestica", "pia_produto"),
            source_status(OFFICIAL / "quality_summary.csv", "Resumo automatico de qualidade", "A cada execucao", "Validador tecnico", "Controle", "quality"),
            source_status(OFFICIAL / "manifest.json", "Manifest da execucao oficial", "A cada publicacao", "Responsavel de documentacao", "Metadados", "manifest"),
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


def main() -> None:
    bridge = read_bridge()
    trade = aggregate_trade(bridge)

    indicators_cnae = pd.read_csv(FINAL / "border_value_indicadores_finais_cnae.csv", dtype={"cnae_class": str})
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

    summary = {
        "periods": sorted(trade["period"].unique().tolist()),
        "flows": sorted(trade["flow"].unique().tolist()),
        "statuses": sorted(trade["mapping_status"].unique().tolist()),
        "generated_from": {
            "trade": "inputs/official/EXP_2026.csv; inputs/official/IMP_2026.csv",
            "mapping": "outputs/official_2026/bridge_ncm_prodlist_cnae.csv",
            "indicators": "outputs/final_border_value_2026/border_value_indicadores_finais_*.csv",
        },
    }

    trade.to_parquet(TRADE_OUT, index=False)

    options = {
        "cnaes": sorted(trade["cnae_class"].unique().tolist()),
        "prodlists": sorted(trade["prodlist_code"].unique().tolist()),
        "ncms": sorted(trade["ncm"].unique().tolist()),
        "countries": sorted(trade["country_code"].unique().tolist()),
    }

    payload = {
        "summary": summary,
        "options": options,
        "indicators_cnae": compact_records(indicators_cnae),
        "indicators_prodlist": compact_records(indicators_prod),
        "cnae_labels": compact_records(cnae_labels),
        "prodlist_labels": compact_records(prod_labels),
        "etl": build_etl_metadata(),
    }

    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} and {TRADE_OUT} with {len(trade):,} aggregated trade rows")


if __name__ == "__main__":
    main()
