import json
from pathlib import Path

import pandas as pd


BASE = Path("outputs/final_border_value_2026")


def money_m(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"US$ {value / 1_000_000:,.1f} mi"


def pct(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"{value * 100:,.1f}%"


def num(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"{value:,.0f}"


def read_csv(name: str) -> pd.DataFrame:
    return pd.read_csv(BASE / name)


def normalize_cnae_code(series: pd.Series) -> pd.Series:
    return series.astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(4)


def clean_text(series: pd.Series) -> pd.Series:
    replacements = {
        "exposi??o": "exposição",
        "transi??o": "transição",
        "energ?tica": "energética",
        "depend?ncia": "dependência",
        "orienta??o": "orientação",
        "produ??o": "produção",
        "importa??o": "importação",
        "exporta??o": "exportação",
    }
    result = series.astype("string")
    for bad, good in replacements.items():
        result = result.str.replace(bad, good, regex=False)
    return result


def top_from_ranking(df: pd.DataFrame, ranking: str, n: int = 10) -> pd.DataFrame:
    return df[df["ranking"].eq(ranking)].sort_values("rank").head(n).copy()


def table_md(df: pd.DataFrame, columns: list[str], labels: dict[str, str]) -> str:
    if df.empty:
        return "_Sem registros._\n"
    out = df[columns].rename(columns=labels).copy()
    out = out.fillna("-").astype(str)
    headers = list(out.columns)
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]
    for _, row in out.iterrows():
        values = [str(row[col]).replace("|", "\\|") for col in headers]
        lines.append("| " + " | ".join(values) + " |")
    return "\n".join(lines) + "\n"


def main() -> None:
    cnae = read_csv("border_value_indicadores_finais_cnae.csv")
    rankings = read_csv("rankings_cnae.csv")
    products = read_csv("rankings_prodlist.csv")
    product_detail = read_csv("border_value_indicadores_finais_cnae_prodlist.csv")
    changes = read_csv("mudancas_mensais_cnae.csv")
    concentration = read_csv("concentracao_produtos_cnae.csv")

    for df in [cnae, rankings, changes, concentration]:
        df["cnae_class"] = normalize_cnae_code(df["cnae_class"])
    for df in [products, product_detail]:
        df["cnae_class"] = df["cnae_class"].where(
            df["cnae_class"].eq("NAO_MAPEADO"),
            normalize_cnae_code(df["cnae_class"]),
        )
    for df in [cnae, rankings, products, product_detail, concentration]:
        for column in ["cnae_name", "prodlist_name", "rationale"]:
            if column in df.columns:
                df[column] = clean_text(df[column]).fillna("")

    cnae["trade_balance_abs_usd"] = cnae["trade_balance_usd"].abs()
    cnae["is_deficit"] = cnae["trade_balance_usd"] < 0
    cnae["is_surplus"] = cnae["trade_balance_usd"] > 0

    tier_summary = (
        cnae.groupby("priority_tier", dropna=False)
        .agg(
            setores=("cnae_class", "nunique"),
            valor_comercial_usd=("trade_value_usd", "sum"),
            importacoes_usd=("import_value_usd", "sum"),
            exportacoes_usd=("export_value_usd", "sum"),
            saldo_usd=("trade_balance_usd", "sum"),
            dependencia_media=("external_dependency_ratio", "mean"),
        )
        .reset_index()
        .sort_values("valor_comercial_usd", ascending=False)
    )

    transition_summary = (
        cnae.groupby("transition_relevance", dropna=False)
        .agg(
            setores=("cnae_class", "nunique"),
            valor_comercial_usd=("trade_value_usd", "sum"),
            importacoes_usd=("import_value_usd", "sum"),
            exportacoes_usd=("export_value_usd", "sum"),
            saldo_usd=("trade_balance_usd", "sum"),
            dependencia_media=("external_dependency_ratio", "mean"),
        )
        .reset_index()
        .sort_values("valor_comercial_usd", ascending=False)
    )

    high_concentration = concentration[
        (concentration["product_count"] >= 2)
        & (concentration["sector_product_trade_value_usd"] >= 50_000_000)
    ].sort_values(
        ["top_product_concentration_ratio", "sector_product_trade_value_usd"],
        ascending=[False, False],
    )
    top_product_by_cnae = (
        product_detail[product_detail["cnae_class"].ne("NAO_MAPEADO")]
        .sort_values(["cnae_class", "trade_value_usd"], ascending=[True, False])
        .drop_duplicates("cnae_class")[
            ["cnae_class", "prodlist_code", "prodlist_name", "trade_value_usd"]
        ]
        .rename(
            columns={
                "prodlist_code": "top_prodlist_code",
                "prodlist_name": "top_prodlist_name",
                "trade_value_usd": "top_prodlist_trade_value_usd",
            }
        )
    )
    high_concentration = high_concentration.merge(top_product_by_cnae, on="cnae_class", how="left")

    relevant_changes = changes.merge(
        cnae[["cnae_class", "cnae_name", "priority_tier", "transition_relevance"]],
        on="cnae_class",
        how="left",
    ).sort_values("monthly_change_value_usd", ascending=False)

    ranking_frames = []
    ranking_map = {
        "maior_valor_comercial": "Maior valor comercial",
        "maiores_importacoes": "Maiores importações",
        "maiores_exportacoes": "Maiores exportações",
        "maior_deficit": "Maiores déficits",
        "maior_superavit": "Maiores superávits",
        "maior_dependencia_externa": "Maior dependência externa",
        "setores_prioritarios": "Setores prioritários",
    }
    for ranking, label in ranking_map.items():
        part = top_from_ranking(rankings, ranking, 10)
        part.insert(0, "recorte", label)
        ranking_frames.append(part)
    ranking_consolidated = pd.concat(ranking_frames, ignore_index=True)

    product_frames = []
    product_map = {
        "produtos_maior_valor": "Produtos com maior valor comercial",
        "produtos_maiores_importacoes": "Produtos com maiores importações",
        "produtos_maior_deficit": "Produtos com maior déficit",
        "produtos_maior_dependencia_externa": "Produtos com maior dependência externa",
    }
    for ranking, label in product_map.items():
        part = top_from_ranking(products[products["cnae_class"].ne("NAO_MAPEADO")], ranking, 10)
        part.insert(0, "recorte", label)
        product_frames.append(part)
    product_consolidated = pd.concat(product_frames, ignore_index=True)
    unmapped_products = products[products["cnae_class"].eq("NAO_MAPEADO")].sort_values(
        "trade_value_usd", ascending=False
    )

    recortes = pd.concat(
        [
            tier_summary.assign(recorte="Resumo por tier de prioridade"),
            transition_summary.assign(recorte="Resumo por relevância para transição"),
        ],
        ignore_index=True,
        sort=False,
    )

    csv_options = {"index": False, "encoding": "utf-8-sig"}
    ranking_consolidated.to_csv(BASE / "rankings_setoriais_consolidados.csv", **csv_options)
    product_consolidated.to_csv(BASE / "rankings_produtos_consolidados.csv", **csv_options)
    unmapped_products.to_csv(BASE / "produtos_nao_mapeados.csv", **csv_options)
    high_concentration.head(50).to_csv(BASE / "concentracao_setorial_relevante.csv", **csv_options)
    relevant_changes.to_csv(BASE / "mudancas_mensais_setoriais_relevantes.csv", **csv_options)
    recortes.to_csv(BASE / "recortes_setoriais_resumo.csv", **csv_options)

    total_trade = cnae["trade_value_usd"].sum()
    top5_trade = cnae.nlargest(5, "trade_value_usd")["trade_value_usd"].sum()
    top10_trade = cnae.nlargest(10, "trade_value_usd")["trade_value_usd"].sum()
    priority1 = cnae[cnae["priority_tier"].eq("1 - priorizar")]
    transition = cnae[cnae["transition_relevance"].eq(True)]
    unmapped_product = products[
        (products["ranking"].eq("produtos_maior_valor"))
        & (products["cnae_class"].eq("NAO_MAPEADO"))
    ].head(1)

    md_lines = [
        "# Rankings e recortes setoriais - Border Value 2026",
        "",
        "Base: saídas finais em `outputs/final_border_value_2026`, com comércio Comex Stat de janeiro a junho de 2026 e produção PIA-Produto 2024.",
        "",
        "## Leitura executiva",
        "",
        f"- Valor comercial setorial alocado: {money_m(total_trade)}.",
        f"- As 5 maiores classes concentram {pct(top5_trade / total_trade)} do valor comercial; as 10 maiores concentram {pct(top10_trade / total_trade)}.",
        f"- Tier `1 - priorizar`: {len(priority1)} classes, {money_m(priority1['trade_value_usd'].sum())} em valor comercial e saldo de {money_m(priority1['trade_balance_usd'].sum())}.",
        f"- Classes marcadas como relevantes para transição energética: {len(transition)} classes, {money_m(transition['trade_value_usd'].sum())} em valor comercial.",
    ]
    if not unmapped_product.empty:
        row = unmapped_product.iloc[0]
        md_lines.append(
            f"- Alerta metodológico: NCMs sem ponte somam {money_m(row['trade_value_usd'])} no ranking de produtos, fora de CNAEs mapeadas."
        )

    labels_cnae = {
        "rank": "#",
        "cnae_class": "CNAE",
        "cnae_name": "Setor",
        "trade_value_usd": "Valor comercial",
        "import_value_usd": "Importações",
        "export_value_usd": "Exportações",
        "trade_balance_usd": "Saldo",
        "external_dependency_ratio": "Dependência externa",
        "priority_tier": "Prioridade",
    }

    def cnae_display(df: pd.DataFrame) -> pd.DataFrame:
        out = df.copy()
        for col in ["trade_value_usd", "import_value_usd", "export_value_usd", "trade_balance_usd"]:
            out[col] = out[col].map(money_m)
        out["external_dependency_ratio"] = out["external_dependency_ratio"].map(pct)
        return out

    sections = [
        ("## Maiores valores comerciais", "maior_valor_comercial"),
        ("## Maiores importações", "maiores_importacoes"),
        ("## Maiores déficits comerciais", "maior_deficit"),
        ("## Maior dependência externa calculada", "maior_dependencia_externa"),
        ("## Setores prioritários", "setores_prioritarios"),
    ]
    for title, ranking in sections:
        md_lines.extend(["", title, ""])
        df = cnae_display(top_from_ranking(rankings, ranking, 10))
        cols = [
            "rank",
            "cnae_class",
            "cnae_name",
            "trade_value_usd",
            "import_value_usd",
            "export_value_usd",
            "trade_balance_usd",
            "external_dependency_ratio",
            "priority_tier",
        ]
        md_lines.append(table_md(df, cols, labels_cnae))

    conc_display = high_concentration.head(15).copy()
    conc_display["sector_product_trade_value_usd"] = conc_display["sector_product_trade_value_usd"].map(money_m)
    conc_display["top_product_value_usd"] = conc_display["top_product_value_usd"].map(money_m)
    conc_display["top_product_concentration_ratio"] = conc_display["top_product_concentration_ratio"].map(pct)
    md_lines.extend(["", "## Concentração em poucos produtos", ""])
    md_lines.append(
        table_md(
            conc_display,
            [
                "cnae_class",
                "cnae_name",
                "product_count",
                "top_prodlist_code",
                "top_prodlist_name",
                "sector_product_trade_value_usd",
                "top_product_value_usd",
                "top_product_concentration_ratio",
                "priority_tier",
            ],
            {
                "cnae_class": "CNAE",
                "cnae_name": "Setor",
                "product_count": "Produtos",
                "top_prodlist_code": "Principal produto",
                "top_prodlist_name": "Nome do produto",
                "sector_product_trade_value_usd": "Valor setorial",
                "top_product_value_usd": "Maior produto",
                "top_product_concentration_ratio": "Concentração",
                "priority_tier": "Prioridade",
            },
        )
    )

    change_display = relevant_changes.head(15).copy()
    change_display["allocated_value_usd"] = change_display["allocated_value_usd"].map(money_m)
    change_display["previous_month_value_usd"] = change_display["previous_month_value_usd"].map(money_m)
    change_display["monthly_change_value_usd"] = change_display["monthly_change_value_usd"].map(money_m)
    change_display["monthly_change_pct"] = change_display["monthly_change_pct"].map(pct)
    md_lines.extend(["", "## Mudanças mensais relevantes", ""])
    md_lines.append(
        table_md(
            change_display,
            [
                "year",
                "month",
                "cnae_class",
                "cnae_name",
                "previous_month_value_usd",
                "allocated_value_usd",
                "monthly_change_value_usd",
                "monthly_change_pct",
                "priority_tier",
            ],
            {
                "year": "Ano",
                "month": "Mês",
                "cnae_class": "CNAE",
                "cnae_name": "Setor",
                "previous_month_value_usd": "Mês anterior",
                "allocated_value_usd": "Mês atual",
                "monthly_change_value_usd": "Variação",
                "monthly_change_pct": "Variação %",
                "priority_tier": "Prioridade",
            },
        )
    )

    tier_display = tier_summary.copy()
    for col in ["valor_comercial_usd", "importacoes_usd", "exportacoes_usd", "saldo_usd"]:
        tier_display[col] = tier_display[col].map(money_m)
    tier_display["dependencia_media"] = tier_display["dependencia_media"].map(pct)
    md_lines.extend(["", "## Recorte por tier de prioridade", ""])
    md_lines.append(
        table_md(
            tier_display,
            [
                "priority_tier",
                "setores",
                "valor_comercial_usd",
                "importacoes_usd",
                "exportacoes_usd",
                "saldo_usd",
                "dependencia_media",
            ],
            {
                "priority_tier": "Tier",
                "setores": "Setores",
                "valor_comercial_usd": "Valor comercial",
                "importacoes_usd": "Importações",
                "exportacoes_usd": "Exportações",
                "saldo_usd": "Saldo",
                "dependencia_media": "Dependência média",
            },
        )
    )

    md_lines.extend(
        [
            "",
            "## Arquivos gerados",
            "",
            "- `rankings_setoriais_consolidados.csv`",
            "- `rankings_produtos_consolidados.csv`",
            "- `produtos_nao_mapeados.csv`",
            "- `concentracao_setorial_relevante.csv`",
            "- `mudancas_mensais_setoriais_relevantes.csv`",
            "- `recortes_setoriais_resumo.csv`",
        ]
    )

    (BASE / "rankings_e_recortes_setoriais_2026.md").write_text(
        "\n".join(md_lines) + "\n", encoding="utf-8"
    )

    manifest_path = BASE / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        manifest = {"output_dir": str(BASE), "files": {}}
    manifest.setdefault("files", {}).update(
        {
            "rankings_setoriais_consolidados.csv": len(ranking_consolidated),
            "rankings_produtos_consolidados.csv": len(product_consolidated),
            "produtos_nao_mapeados.csv": len(unmapped_products),
            "concentracao_setorial_relevante.csv": min(len(high_concentration), 50),
            "mudancas_mensais_setoriais_relevantes.csv": len(relevant_changes),
            "recortes_setoriais_resumo.csv": len(recortes),
            "rankings_e_recortes_setoriais_2026.md": None,
        }
    )
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
