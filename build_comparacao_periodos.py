from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs" / "final_border_value_2026"
HISTORICAL_DIR = BASE_DIR / "outputs" / "official_2024_comparacao"
CURRENT_DIR = BASE_DIR / "outputs" / "official_2026"


def _safe_divide(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    result = numerator / denominator.where(denominator.ne(0))
    return result.replace([float("inf"), float("-inf")], pd.NA)


def _normalize_cnae(series: pd.Series) -> pd.Series:
    values = series.astype("string")
    return values.where(values.isna(), values.str.replace(r"\.0$", "", regex=True).str.zfill(4))


def _read_analytic(source_dir: Path, period_label: str, *, months: set[int] | None = None) -> pd.DataFrame:
    frame = pd.read_csv(source_dir / "analytic_trade_cnae.csv", dtype={"cnae_class": "string"})
    if months is not None:
        frame = frame.loc[frame["month"].isin(months)].copy()
    frame["period_label"] = period_label
    frame["cnae_class"] = _normalize_cnae(frame["cnae_class"])
    frame.loc[frame["allocation_status"].eq("unmatched_ncm"), "cnae_class"] = "NAO_MAPEADO"
    frame["trade_value_usd"] = pd.to_numeric(frame["value_usd"], errors="coerce").fillna(0)
    frame["net_weight_kg"] = pd.to_numeric(frame["net_weight_kg"], errors="coerce").fillna(0)
    return frame


def _build_monthly_series(historical: pd.DataFrame, current: pd.DataFrame) -> pd.DataFrame:
    series = pd.concat([historical, current], ignore_index=True)
    result = (
        series.groupby(["period_label", "year", "month", "flow", "cnae_class"], as_index=False, dropna=False)
        .agg(
            trade_value_usd=("trade_value_usd", "sum"),
            net_weight_kg=("net_weight_kg", "sum"),
        )
        .sort_values(["cnae_class", "flow", "year", "month"], kind="stable")
    )
    result["previous_observed_value_usd"] = result.groupby(["cnae_class", "flow"])["trade_value_usd"].shift(1)
    result["observed_change_value_usd"] = result["trade_value_usd"] - result["previous_observed_value_usd"]
    result["observed_change_pct"] = _safe_divide(
        result["observed_change_value_usd"], result["previous_observed_value_usd"]
    )
    return result


def _aggregate_period(frame: pd.DataFrame, label: str) -> pd.DataFrame:
    summary = (
        frame.groupby(["cnae_class", "flow"], as_index=False, dropna=False)
        .agg(
            trade_value_usd=("trade_value_usd", "sum"),
            net_weight_kg=("net_weight_kg", "sum"),
        )
        .pivot(index="cnae_class", columns="flow", values=["trade_value_usd", "net_weight_kg"])
    )
    summary.columns = [
        f"{label}_{'export' if flow == 'EXP' else 'import' if flow == 'IMP' else str(flow).lower()}_{measure}"
        for measure, flow in summary.columns
    ]
    result = summary.reset_index()
    for column in [
        f"{label}_export_trade_value_usd",
        f"{label}_import_trade_value_usd",
        f"{label}_export_net_weight_kg",
        f"{label}_import_net_weight_kg",
    ]:
        if column not in result:
            result[column] = 0.0
        result[column] = result[column].fillna(0.0)
    result[f"{label}_total_trade_value_usd"] = (
        result[f"{label}_export_trade_value_usd"] + result[f"{label}_import_trade_value_usd"]
    )
    result[f"{label}_trade_balance_usd"] = (
        result[f"{label}_export_trade_value_usd"] - result[f"{label}_import_trade_value_usd"]
    )
    return result


def _build_period_comparison(historical_h1: pd.DataFrame, current: pd.DataFrame) -> pd.DataFrame:
    base = _aggregate_period(historical_h1, "base_2024_h1")
    comparison = _aggregate_period(current, "comparison_2026_h1")
    result = base.merge(comparison, on="cnae_class", how="outer").fillna(0)
    result["delta_total_trade_value_usd"] = (
        result["comparison_2026_h1_total_trade_value_usd"] - result["base_2024_h1_total_trade_value_usd"]
    )
    result["delta_import_trade_value_usd"] = (
        result["comparison_2026_h1_import_trade_value_usd"] - result["base_2024_h1_import_trade_value_usd"]
    )
    result["delta_export_trade_value_usd"] = (
        result["comparison_2026_h1_export_trade_value_usd"] - result["base_2024_h1_export_trade_value_usd"]
    )
    result["delta_trade_balance_usd"] = (
        result["comparison_2026_h1_trade_balance_usd"] - result["base_2024_h1_trade_balance_usd"]
    )
    result["delta_total_trade_pct"] = _safe_divide(
        result["delta_total_trade_value_usd"], result["base_2024_h1_total_trade_value_usd"]
    )
    result["delta_import_pct"] = _safe_divide(
        result["delta_import_trade_value_usd"], result["base_2024_h1_import_trade_value_usd"]
    )
    result["delta_export_pct"] = _safe_divide(
        result["delta_export_trade_value_usd"], result["base_2024_h1_export_trade_value_usd"]
    )
    result["comparison_type"] = "2026 H1 contra 2024 H1"
    return result.sort_values("delta_total_trade_value_usd", ascending=False, kind="stable")


def _build_ranked_changes(comparison: pd.DataFrame) -> pd.DataFrame:
    mapped = comparison.loc[comparison["cnae_class"].ne("NAO_MAPEADO")].copy()
    frames = []
    specs = {
        "maior_alta_valor_comercial": ("delta_total_trade_value_usd", False),
        "maior_queda_valor_comercial": ("delta_total_trade_value_usd", True),
        "maior_alta_importacoes": ("delta_import_trade_value_usd", False),
        "maior_alta_exportacoes": ("delta_export_trade_value_usd", False),
        "maior_deterioracao_saldo": ("delta_trade_balance_usd", True),
        "maior_melhora_saldo": ("delta_trade_balance_usd", False),
    }
    for ranking, (column, ascending) in specs.items():
        part = mapped.sort_values(column, ascending=ascending, kind="stable").head(25).copy()
        part.insert(0, "rank", range(1, len(part) + 1))
        part.insert(0, "ranking", ranking)
        frames.append(part)
    return pd.concat(frames, ignore_index=True)


def _write_markdown(comparison: pd.DataFrame, ranked: pd.DataFrame, monthly: pd.DataFrame) -> None:
    mapped = comparison.loc[comparison["cnae_class"].ne("NAO_MAPEADO")].copy()
    totals = comparison.sum(numeric_only=True)
    top_up = ranked.loc[ranked["ranking"].eq("maior_alta_valor_comercial")].head(5)
    top_down = ranked.loc[ranked["ranking"].eq("maior_queda_valor_comercial")].head(5)
    latest_month = monthly[["year", "month"]].drop_duplicates().sort_values(["year", "month"]).tail(1)
    lines = [
        "# Comparacao de resultados entre periodos",
        "",
        "Comparacao principal: janeiro a junho de 2026 contra janeiro a junho de 2024. "
        "A serie mensal historica preserva tambem julho a dezembro de 2024 para contexto.",
        "",
        "## Totais comparados",
        "",
        f"- Base 2024 H1: US$ {totals['base_2024_h1_total_trade_value_usd']:,.0f}.",
        f"- Comparacao 2026 H1: US$ {totals['comparison_2026_h1_total_trade_value_usd']:,.0f}.",
        f"- Variacao absoluta: US$ {totals['delta_total_trade_value_usd']:,.0f}.",
        f"- Variacao relativa: {totals['delta_total_trade_value_usd'] / totals['base_2024_h1_total_trade_value_usd']:.2%}.",
        f"- CNAEs mapeadas na comparacao: {mapped['cnae_class'].nunique():,}.",
        "",
        "## Maiores altas",
        "",
    ]
    for _, row in top_up.iterrows():
        lines.append(
            f"- {row['cnae_class']}: +US$ {row['delta_total_trade_value_usd']:,.0f} "
            f"({row['delta_total_trade_pct']:.2%})."
        )
    lines.extend(["", "## Maiores quedas", ""])
    for _, row in top_down.iterrows():
        lines.append(
            f"- {row['cnae_class']}: US$ {row['delta_total_trade_value_usd']:,.0f} "
            f"({row['delta_total_trade_pct']:.2%})."
        )
    if not latest_month.empty:
        row = latest_month.iloc[0]
        lines.extend(
            [
                "",
                "## Serie historica",
                "",
                f"- Ultimo ponto observado na serie mensal: {int(row['year'])}-{int(row['month']):02d}.",
                "- Use `serie_historica_mensal_cnae_fluxo.csv` para comparar trajetorias mensais por CNAE e fluxo.",
            ]
        )
    lines.extend(
        [
            "",
            "## Observacoes metodologicas",
            "",
            "- A comparacao usa 2024 H1 para manter a mesma janela mensal de 2026 H1.",
            "- A base historica 2024 usa Prodlist 2022; a base corrente 2026 usa a ponte NCM-Prodlist 2025 registrada no pipeline.",
            "- Mudancas de classificacao NCM/Prodlist podem explicar parte das variacoes setoriais e devem ser auditadas nas maiores diferencas.",
        ]
    )
    (OUTPUT_DIR / "comparacao_periodos_2024_2026.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    required = [
        HISTORICAL_DIR / "analytic_trade_cnae.csv",
        CURRENT_DIR / "analytic_trade_cnae.csv",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(
            "Execute antes o pipeline operacional para as bases faltantes: " + ", ".join(missing)
        )

    historical_full = _read_analytic(HISTORICAL_DIR, "2024")
    historical_h1 = _read_analytic(HISTORICAL_DIR, "2024 H1", months={1, 2, 3, 4, 5, 6})
    current = _read_analytic(CURRENT_DIR, "2026 H1")

    monthly = _build_monthly_series(historical_full, current)
    comparison = _build_period_comparison(historical_h1, current)
    ranked = _build_ranked_changes(comparison)

    csv_options = {"index": False, "encoding": "utf-8-sig"}
    monthly.to_csv(OUTPUT_DIR / "serie_historica_mensal_cnae_fluxo.csv", **csv_options)
    comparison.to_csv(OUTPUT_DIR / "comparacao_periodos_cnae_2024h1_2026h1.csv", **csv_options)
    ranked.to_csv(OUTPUT_DIR / "rankings_variacao_periodos_cnae.csv", **csv_options)
    _write_markdown(comparison, ranked, monthly)

    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    files = manifest.setdefault("files", {})
    files.update(
        {
            "serie_historica_mensal_cnae_fluxo.csv": len(monthly),
            "comparacao_periodos_cnae_2024h1_2026h1.csv": len(comparison),
            "rankings_variacao_periodos_cnae.csv": len(ranked),
            "comparacao_periodos_2024_2026.md": None,
        }
    )
    manifest["period_comparison"] = {
        "base_period": "2024-01 a 2024-06",
        "comparison_period": "2026-01 a 2026-06",
        "historical_series_context": "2024-01 a 2024-12 e 2026-01 a 2026-06",
        "historical_source_dir": str(HISTORICAL_DIR.relative_to(BASE_DIR)),
        "current_source_dir": str(CURRENT_DIR.relative_to(BASE_DIR)),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
