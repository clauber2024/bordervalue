from __future__ import annotations

import html
import json
import math
import re
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parent
INPUTS = ROOT / "inputs" / "official"
CACHE = ROOT / "dados" / "cache"
OUTPUT_DIR = ROOT / "outputs" / "top_partner_growth_2026_h1_vs_2025_h1"

YEARS = (2025, 2026)
MONTHS = {1, 2, 3, 4, 5, 6}
FLOWS = {
    "EXP": INPUTS / "EXP_{year}.csv",
    "IMP": INPUTS / "IMP_{year}.csv",
}
MIN_CURRENT_VALUE_USD = 1_000_000
MIN_BASE_VALUE_USD = 100_000
TOP_COUNTRIES = 5
TOP_PRODUCTS = 5
CANDIDATE_POOL_BY_2026_VALUE = 50


def _fix_mojibake(value: object) -> str:
    text = "" if value is None or pd.isna(value) else str(value)
    if "Ã" in text or "Â" in text:
        try:
            return text.encode("latin1").decode("utf-8")
        except UnicodeError:
            return text
    return text


def _read_trade(path: Path, flow: str, year: int) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        raise FileNotFoundError(f"Arquivo de comércio ausente ou vazio: {path}")

    usecols = ["CO_ANO", "CO_MES", "CO_NCM", "CO_PAIS", "KG_LIQUIDO", "VL_FOB"]
    dtypes = {
        "CO_ANO": "int16",
        "CO_MES": "int8",
        "CO_NCM": "string",
        "CO_PAIS": "string",
        "KG_LIQUIDO": "float64",
        "VL_FOB": "float64",
    }
    chunks: list[pd.DataFrame] = []
    for chunk in pd.read_csv(
        path,
        sep=";",
        usecols=usecols,
        dtype=dtypes,
        chunksize=500_000,
        encoding="utf-8-sig",
    ):
        chunk = chunk.loc[chunk["CO_MES"].isin(MONTHS)].copy()
        if chunk.empty:
            continue
        chunk["CO_NCM"] = chunk["CO_NCM"].astype("string").str.zfill(8)
        chunk["CO_PAIS"] = chunk["CO_PAIS"].astype("string").str.zfill(3)
        grouped = (
            chunk.groupby(["CO_PAIS", "CO_NCM"], as_index=False)
            .agg(value_usd=("VL_FOB", "sum"), net_weight_kg=("KG_LIQUIDO", "sum"))
        )
        chunks.append(grouped)

    if not chunks:
        return pd.DataFrame(
            columns=["year", "flow", "country_code", "ncm", "value_usd", "net_weight_kg"]
        )

    frame = (
        pd.concat(chunks, ignore_index=True)
        .groupby(["CO_PAIS", "CO_NCM"], as_index=False)
        .agg(value_usd=("value_usd", "sum"), net_weight_kg=("net_weight_kg", "sum"))
    )
    frame = frame.rename(columns={"CO_PAIS": "country_code", "CO_NCM": "ncm"})
    frame.insert(0, "flow", flow)
    frame.insert(0, "year", year)
    return frame


def _read_countries() -> pd.DataFrame:
    try:
        countries = pd.read_csv(CACHE / "dim_pais_comex.csv", sep=";", dtype="string", encoding="utf-8-sig")
    except UnicodeDecodeError:
        countries = pd.read_csv(CACHE / "dim_pais_comex.csv", sep=";", dtype="string", encoding="latin1")
    countries["CO_PAIS"] = countries["CO_PAIS"].astype("string").str.zfill(3)
    countries["country_name"] = countries["NO_PAIS"].map(_fix_mojibake)
    countries["country_iso3"] = countries["CO_PAIS_ISOA3"].fillna("")
    return countries[["CO_PAIS", "country_name", "country_iso3"]].rename(columns={"CO_PAIS": "country_code"})


def _read_ncm_descriptions() -> pd.DataFrame:
    raw = json.loads((CACHE / "ncm_vigente.json").read_text(encoding="utf-8"))
    descriptions: dict[str, str] = {}
    for item in raw.get("Nomenclaturas", []):
        code = re.sub(r"\D", "", str(item.get("Codigo", "")))
        if code:
            descriptions[code] = _clean_description(_fix_mojibake(item.get("Descricao", "")))
    rows = []
    for code, description in descriptions.items():
        if len(code) != 8:
            continue
        rows.append({"ncm": code, "product_description": _contextual_ncm_description(code, description, descriptions)})
    return pd.DataFrame(rows).drop_duplicates("ncm")


def _clean_description(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", value)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip(" -.;")
    return text[:1].upper() + text[1:] if text else ""


def _contextual_ncm_description(code: str, description: str, descriptions: dict[str, str]) -> str:
    generic = {"outros", "outras", "outro", "outra"}
    if description.strip().lower() not in generic:
        return description
    for length in (7, 6, 5, 4, 3, 2):
        parent = descriptions.get(code[:length], "")
        if parent and parent.strip().lower() not in generic:
            return f"{description} - {parent}"
    return description


def _category_from_ncm(ncm: str) -> str:
    chapter = int(str(ncm)[:2])
    if 1 <= chapter <= 24:
        return "agro e alimentos"
    if 25 <= chapter <= 27:
        return "minerais e energia"
    if 28 <= chapter <= 38:
        return "químicos e fertilizantes"
    if 39 <= chapter <= 40:
        return "plásticos e borracha"
    if 41 <= chapter <= 43 or 50 <= chapter <= 67:
        return "bens intermediários tradicionais"
    if 44 <= chapter <= 49:
        return "madeira, papel e impressos"
    if 68 <= chapter <= 83:
        return "metais e manufaturas"
    if 84 <= chapter <= 85 or chapter == 90:
        return "máquinas, eletrônicos e precisão"
    if chapter in {86, 87, 88, 89}:
        return "veículos e transporte"
    return "outros bens industrializados"


def _build_comparison(trade: pd.DataFrame) -> pd.DataFrame:
    wide = trade.pivot_table(
        index=["flow", "country_code", "ncm"],
        columns="year",
        values=["value_usd", "net_weight_kg"],
        aggfunc="sum",
        fill_value=0,
    )
    wide.columns = [f"{measure}_{year}" for measure, year in wide.columns]
    result = wide.reset_index()
    for year in YEARS:
        for measure in ["value_usd", "net_weight_kg"]:
            column = f"{measure}_{year}"
            if column not in result:
                result[column] = 0.0
    result["delta_value_usd"] = result["value_usd_2026"] - result["value_usd_2025"]
    result["growth_pct"] = result["delta_value_usd"] / result["value_usd_2025"].where(result["value_usd_2025"].ne(0))
    result["growth_pct"] = result["growth_pct"].replace([math.inf, -math.inf], pd.NA)
    result["category"] = result["ncm"].map(_category_from_ncm)
    return result


def _top_countries(trade: pd.DataFrame, countries: pd.DataFrame) -> pd.DataFrame:
    current = trade.loc[trade["year"].eq(2026)]
    by_country_flow = (
        current.groupby(["country_code", "flow"], as_index=False)
        .agg(value_usd=("value_usd", "sum"))
        .pivot(index="country_code", columns="flow", values="value_usd")
        .fillna(0)
        .reset_index()
    )
    for flow in ["EXP", "IMP"]:
        if flow not in by_country_flow:
            by_country_flow[flow] = 0.0
    by_country_flow["export_value_usd_2026_h1"] = by_country_flow["EXP"]
    by_country_flow["import_value_usd_2026_h1"] = by_country_flow["IMP"]
    by_country_flow["total_trade_usd_2026_h1"] = by_country_flow["EXP"] + by_country_flow["IMP"]
    by_country_flow["balance_usd_2026_h1"] = by_country_flow["EXP"] - by_country_flow["IMP"]
    result = by_country_flow.merge(countries, on="country_code", how="left")
    result["country_name"] = result["country_name"].fillna(result["country_code"])
    return result.sort_values("total_trade_usd_2026_h1", ascending=False).head(TOP_COUNTRIES)


def _rank_products(comparison: pd.DataFrame, top_country_codes: set[str], ncms: pd.DataFrame, countries: pd.DataFrame) -> pd.DataFrame:
    eligible = comparison.loc[
        comparison["country_code"].isin(top_country_codes)
        & comparison["growth_pct"].gt(0)
        & comparison["value_usd_2026"].ge(MIN_CURRENT_VALUE_USD)
        & comparison["value_usd_2025"].ge(MIN_BASE_VALUE_USD)
    ].copy()
    eligible = eligible.sort_values(
        ["country_code", "flow", "value_usd_2026"],
        ascending=[True, True, False],
        kind="stable",
    )
    relevant = eligible.groupby(["country_code", "flow"], as_index=False, group_keys=False).head(CANDIDATE_POOL_BY_2026_VALUE)
    relevant = relevant.sort_values(
        ["country_code", "flow", "growth_pct", "delta_value_usd"],
        ascending=[True, True, False, False],
        kind="stable",
    )
    ranked = relevant.groupby(["country_code", "flow"], as_index=False, group_keys=False).head(TOP_PRODUCTS)
    ranked = ranked.merge(countries, on="country_code", how="left").merge(ncms, on="ncm", how="left")
    ranked["country_name"] = ranked["country_name"].fillna(ranked["country_code"])
    ranked["product_description"] = ranked["product_description"].fillna("NCM " + ranked["ncm"])
    ranked["rank"] = ranked.groupby(["country_code", "flow"])["growth_pct"].rank(method="first", ascending=False).astype(int)
    return ranked.sort_values(["country_name", "flow", "rank"], kind="stable")


def _money_short(value: float) -> str:
    abs_value = abs(value)
    if abs_value >= 1_000_000_000:
        return f"US$ {value / 1_000_000_000:.1f} bi"
    if abs_value >= 1_000_000:
        return f"US$ {value / 1_000_000:.1f} mi"
    return f"US$ {value:,.0f}".replace(",", ".")


def _pct(value: float) -> str:
    return f"+{value * 100:.1f}%".replace(".", ",")


def _summary_for(country: str, rows: pd.DataFrame) -> str:
    exp = rows.loc[rows["flow"].eq("EXP")]
    imp = rows.loc[rows["flow"].eq("IMP")]
    parts = []
    if not exp.empty:
        top = exp.iloc[0]
        cats = exp["category"].value_counts().head(2).index.tolist()
        parts.append(
            f"Nas vendas para {country}, o maior avanço percentual é {top['product_description']} ({_pct(top['growth_pct'])}); predominam {', '.join(cats)}."
        )
    if not imp.empty:
        top = imp.iloc[0]
        cats = imp["category"].value_counts().head(2).index.tolist()
        parts.append(
            f"Nas compras de {country}, o maior avanço percentual é {top['product_description']} ({_pct(top['growth_pct'])}); predominam {', '.join(cats)}."
        )
    return " ".join(parts) if parts else "Sem produtos elegíveis pelos pisos definidos."


def _write_markdown(top_countries: pd.DataFrame, ranked: pd.DataFrame) -> None:
    lines = [
        "# Crescimento por produto nos 5 principais parceiros comerciais",
        "",
        "Comparação: jan-jun/2026 contra jan-jun/2025, em US$ FOB.",
        f"Critério: top {TOP_COUNTRIES} países por comércio total em jan-jun/2026; top {TOP_PRODUCTS} NCMs por variação percentual positiva dentro dos {CANDIDATE_POOL_BY_2026_VALUE} maiores NCMs de 2026 em cada fluxo/país, com piso de {_money_short(MIN_CURRENT_VALUE_USD)} em 2026 e {_money_short(MIN_BASE_VALUE_USD)} em 2025.",
        "",
        "Fonte: MDIC/Comex Stat, arquivos brutos EXP_2025, IMP_2025, EXP_2026 e IMP_2026; descrições NCM do cache oficial vigente no projeto.",
        "",
        "## Países selecionados",
        "",
    ]
    for _, row in top_countries.iterrows():
        lines.append(
            f"- {row['country_name']}: comércio total {_money_short(row['total_trade_usd_2026_h1'])}; exportações {_money_short(row['export_value_usd_2026_h1'])}; importações {_money_short(row['import_value_usd_2026_h1'])}."
        )
    for _, country in top_countries.iterrows():
        country_rows = ranked.loc[ranked["country_code"].eq(country["country_code"])]
        lines.extend(["", f"## {country['country_name']}", "", _summary_for(country["country_name"], country_rows), ""])
        for flow, title in [("EXP", f"Vendas para {country['country_name']}"), ("IMP", f"Compras de {country['country_name']}")]:
            rows = country_rows.loc[country_rows["flow"].eq(flow)]
            lines.extend([f"### {title}", "", "| Produto | NCM | Variação | Valor 2025 | Valor 2026 | Categoria |", "|---|---:|---:|---:|---:|---|"])
            if rows.empty:
                lines.append("| Sem produtos elegíveis |  |  |  |  |  |")
            for _, item in rows.iterrows():
                lines.append(
                    f"| {item['product_description']} | {item['ncm']} | {_pct(item['growth_pct'])} | {_money_short(item['value_usd_2025'])} | {_money_short(item['value_usd_2026'])} | {item['category']} |"
                )
            lines.append("")
    (OUTPUT_DIR / "relatorio_top5_paises.md").write_text("\n".join(lines), encoding="utf-8")


def _render_product_list(rows: pd.DataFrame, flow: str) -> str:
    color = "green" if flow == "EXP" else "red"
    if rows.empty:
        return '<p class="empty">Sem produtos elegíveis pelos pisos definidos.</p>'
    max_growth = max(rows["growth_pct"].max(), 0.01)
    items = []
    for _, row in rows.iterrows():
        radius = 10 + 30 * math.sqrt(float(row["growth_pct"]) / max_growth)
        items.append(
            f"""
            <li>
              <span class="bubble {color}" style="--size:{radius:.1f}px"></span>
              <div class="item-copy">
                <strong>{html.escape(row['product_description'])}</strong>
                <span>NCM {html.escape(row['ncm'])} · {html.escape(row['category'])}</span>
              </div>
              <div class="item-values">
                <strong>{_pct(float(row['growth_pct']))}</strong>
                <span>{_money_short(float(row['value_usd_2026']))}</span>
              </div>
            </li>
            """
        )
    return f"<ol>{''.join(items)}</ol>"


def _write_html(top_countries: pd.DataFrame, ranked: pd.DataFrame) -> None:
    cards = []
    for _, country in top_countries.iterrows():
        rows = ranked.loc[ranked["country_code"].eq(country["country_code"])]
        exports = rows.loc[rows["flow"].eq("EXP")]
        imports = rows.loc[rows["flow"].eq("IMP")]
        cards.append(
            f"""
            <section class="country-card">
              <header>
                <div>
                  <p class="eyebrow">Parceiro comercial</p>
                  <h2>{html.escape(country['country_name'])}</h2>
                </div>
                <div class="trade-total">
                  <span>Comércio total jan-jun/2026</span>
                  <strong>{_money_short(float(country['total_trade_usd_2026_h1']))}</strong>
                </div>
              </header>
              <div class="columns">
                <article>
                  <h3>Vendas para {html.escape(country['country_name'])}</h3>
                  {_render_product_list(exports, "EXP")}
                </article>
                <article>
                  <h3>Compras de {html.escape(country['country_name'])}</h3>
                  {_render_product_list(imports, "IMP")}
                </article>
              </div>
              <p class="message">{html.escape(_summary_for(country['country_name'], rows))}</p>
            </section>
            """
        )

    html_text = f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Crescimento por produto - top 5 países</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f6f3ee;
      --panel: #ffffff;
      --ink: #202124;
      --muted: #666b73;
      --line: #ded8cf;
      --green: #23845b;
      --green-soft: #dceee6;
      --red: #c64b45;
      --red-soft: #f5dedb;
      --accent: #234f67;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: var(--bg);
      color: var(--ink);
    }}
    main {{
      width: min(1180px, calc(100% - 32px));
      margin: 32px auto;
    }}
    .hero {{
      display: grid;
      gap: 14px;
      margin-bottom: 24px;
    }}
    h1 {{
      margin: 0;
      font-size: clamp(28px, 4vw, 46px);
      line-height: 1.05;
      letter-spacing: 0;
    }}
    .subtitle {{
      max-width: 920px;
      margin: 0;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.5;
    }}
    .meta {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }}
    .meta li {{
      border: 1px solid var(--line);
      background: rgba(255,255,255,.55);
      border-radius: 999px;
      padding: 7px 11px;
      color: var(--muted);
      font-size: 13px;
    }}
    .country-card {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 20px;
      margin: 18px 0;
    }}
    .country-card header {{
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 18px;
      border-bottom: 1px solid var(--line);
      padding-bottom: 14px;
      margin-bottom: 16px;
    }}
    .eyebrow {{
      margin: 0 0 4px;
      color: var(--accent);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-weight: 700;
    }}
    h2, h3 {{ margin: 0; letter-spacing: 0; }}
    h2 {{ font-size: 28px; }}
    h3 {{ font-size: 18px; }}
    .trade-total {{
      display: grid;
      gap: 3px;
      text-align: right;
      min-width: 190px;
    }}
    .trade-total span, .item-copy span, .item-values span, .source {{
      color: var(--muted);
      font-size: 13px;
    }}
    .trade-total strong {{ font-size: 20px; }}
    .columns {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }}
    article {{
      min-width: 0;
    }}
    ol {{
      display: grid;
      gap: 10px;
      margin: 14px 0 0;
      padding: 0;
      list-style: none;
    }}
    li {{
      display: grid;
      grid-template-columns: 46px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      min-height: 54px;
    }}
    .bubble {{
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      justify-self: center;
      border: 2px solid currentColor;
    }}
    .bubble.green {{ color: var(--green); background: var(--green-soft); }}
    .bubble.red {{ color: var(--red); background: var(--red-soft); }}
    .item-copy {{
      display: grid;
      gap: 3px;
      min-width: 0;
    }}
    .item-copy strong {{
      overflow-wrap: anywhere;
      line-height: 1.25;
    }}
    .item-values {{
      display: grid;
      gap: 3px;
      text-align: right;
      white-space: nowrap;
    }}
    .item-values strong {{ font-size: 18px; }}
    .message {{
      margin: 18px 0 0;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      line-height: 1.45;
    }}
    .empty {{
      color: var(--muted);
      margin: 14px 0 0;
    }}
    .source {{
      margin-top: 24px;
      line-height: 1.45;
    }}
    @media (max-width: 760px) {{
      main {{ width: min(100% - 20px, 1180px); margin: 18px auto; }}
      .country-card {{ padding: 14px; }}
      .country-card header, .columns {{ display: grid; grid-template-columns: 1fr; }}
      .trade-total {{ text-align: left; }}
      li {{ grid-template-columns: 40px minmax(0, 1fr); }}
      .item-values {{ grid-column: 2; text-align: left; }}
    }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>Crescimento por produto nos 5 principais parceiros comerciais</h1>
      <p class="subtitle">Variação das exportações brasileiras para cada país e das importações brasileiras originárias de cada país, comparando jan-jun/2026 com jan-jun/2025. Os círculos indicam a intensidade do crescimento percentual dentro de cada lista.</p>
      <ul class="meta">
        <li>Ranking de países: comércio total em jan-jun/2026</li>
        <li>Produtos: NCM-8</li>
        <li>Produtos: maior crescimento entre os {CANDIDATE_POOL_BY_2026_VALUE} maiores NCMs de 2026 por fluxo/país</li>
        <li>Piso: {_money_short(MIN_CURRENT_VALUE_USD)} em 2026 e {_money_short(MIN_BASE_VALUE_USD)} em 2025</li>
      </ul>
    </section>
    {''.join(cards)}
    <p class="source">Fonte: MDIC/Comex Stat, dados brutos EXP_2025, IMP_2025, EXP_2026 e IMP_2026; descrições NCM do cache oficial vigente no projeto.</p>
  </main>
</body>
</html>
"""
    (OUTPUT_DIR / "top5_paises_crescimento_produtos.html").write_text(html_text, encoding="utf-8")


def _mind_map_payload(top_countries: pd.DataFrame, ranked: pd.DataFrame) -> list[dict[str, object]]:
    payload: list[dict[str, object]] = []
    for _, country in top_countries.iterrows():
        rows = ranked.loc[ranked["country_code"].eq(country["country_code"])]
        flows: dict[str, list[dict[str, object]]] = {}
        for flow in ["EXP", "IMP"]:
            flow_rows = rows.loc[rows["flow"].eq(flow)].sort_values("rank")
            flows[flow] = [
                {
                    "rank": int(item["rank"]),
                    "ncm": str(item["ncm"]),
                    "product": str(item["product_description"]),
                    "growth_pct": round(float(item["growth_pct"]) * 100, 1),
                    "value_2025": _money_short(float(item["value_usd_2025"])),
                    "value_2026": _money_short(float(item["value_usd_2026"])),
                    "category": str(item["category"]),
                }
                for _, item in flow_rows.iterrows()
            ]
        payload.append(
            {
                "code": str(country["country_code"]),
                "name": str(country["country_name"]),
                "total": _money_short(float(country["total_trade_usd_2026_h1"])),
                "exports": _money_short(float(country["export_value_usd_2026_h1"])),
                "imports": _money_short(float(country["import_value_usd_2026_h1"])),
                "flows": flows,
                "summary": _summary_for(str(country["country_name"]), rows),
            }
        )
    return payload


def _write_mind_map_html(top_countries: pd.DataFrame, ranked: pd.DataFrame) -> None:
    data = json.dumps(_mind_map_payload(top_countries, ranked), ensure_ascii=False)
    html_text = """<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mapa mental - crescimento por produto</title>
  <style>
    :root {
      --bg: #f7f4ef;
      --ink: #202124;
      --muted: #656b73;
      --panel: #fffdf9;
      --line: #d7d0c6;
      --exp: #23845b;
      --exp-soft: #dceee6;
      --imp: #bd4b47;
      --imp-soft: #f4dedb;
      --center: #234f67;
      --center-soft: #d9e7ee;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: var(--ink);
      background: var(--bg);
    }
    main {
      width: min(1220px, calc(100% - 28px));
      margin: 28px auto;
    }
    header {
      display: grid;
      gap: 12px;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0;
      font-size: clamp(28px, 4vw, 46px);
      line-height: 1.05;
      letter-spacing: 0;
    }
    .subtitle {
      max-width: 940px;
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
    }
    .country-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
    }
    button {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      color: var(--ink);
      padding: 8px 12px;
      cursor: pointer;
      font: inherit;
    }
    button[aria-pressed="true"] {
      background: var(--center);
      color: #fff;
      border-color: var(--center);
    }
    .stage {
      position: relative;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      min-height: 520px;
    }
    .branch {
      fill: none;
      stroke: var(--line);
      stroke-width: 2;
    }
    .node rect, .node circle {
      stroke-width: 2;
    }
    .center-node rect {
      fill: var(--center-soft);
      stroke: var(--center);
    }
    .flow-exp rect {
      fill: var(--exp-soft);
      stroke: var(--exp);
    }
    .flow-imp rect {
      fill: var(--imp-soft);
      stroke: var(--imp);
    }
    .leaf-exp circle {
      fill: var(--exp-soft);
      stroke: var(--exp);
    }
    .leaf-imp circle {
      fill: var(--imp-soft);
      stroke: var(--imp);
    }
    text {
      fill: var(--ink);
      font-size: 15px;
    }
    .small {
      fill: var(--muted);
      font-size: 12px;
    }
    .pct {
      font-size: 17px;
      font-weight: 700;
    }
    .leaf {
      cursor: pointer;
    }
    .leaf:focus-visible circle,
    .leaf:hover circle {
      stroke-width: 4;
    }
    .detail {
      margin: 12px 0 0;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      line-height: 1.45;
    }
    .source {
      color: var(--muted);
      font-size: 13px;
      margin-top: 14px;
      line-height: 1.4;
    }
    @media (max-width: 760px) {
      main { width: min(100% - 18px, 1220px); margin: 16px auto; }
      .stage { padding: 6px; }
      svg { min-height: 760px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Mapa mental dos crescimentos por produto</h1>
      <p class="subtitle">Cada país aparece como nó central. Os dois ramos separam exportações brasileiras para o parceiro e importações brasileiras originárias dele; as folhas mostram os produtos com maior crescimento percentual entre os principais NCMs de 2026.</p>
      <div class="country-buttons" id="countryButtons" aria-label="Selecionar país"></div>
    </header>
    <section class="stage" aria-label="Mapa mental por país">
      <svg id="mindMap" viewBox="0 0 1120 640" role="img" aria-labelledby="mapTitle mapDesc">
        <title id="mapTitle">Mapa mental de comércio exterior</title>
        <desc id="mapDesc">Diagrama com país no centro, exportações à esquerda, importações à direita e produtos nas extremidades.</desc>
      </svg>
      <p class="detail" id="detail"></p>
    </section>
    <p class="source">Fonte: MDIC/Comex Stat; comparação jan-jun/2026 contra jan-jun/2025 em US$ FOB. Critério: top 5 países por comércio total; produtos ranqueados por variação percentual positiva dentro dos 50 maiores NCMs de 2026 por fluxo e país.</p>
  </main>
  <script>
    const countries = __DATA__;
    const buttons = document.getElementById("countryButtons");
    const svg = document.getElementById("mindMap");
    const detail = document.getElementById("detail");
    const ns = "http://www.w3.org/2000/svg";
    let selectedCode = countries[0]?.code;

    function el(name, attrs = {}) {
      const node = document.createElementNS(ns, name);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
      return node;
    }

    function wrapText(text, maxChars) {
      const words = String(text).split(/\\s+/);
      const lines = [];
      let line = "";
      words.forEach((word) => {
        const next = line ? `${line} ${word}` : word;
        if (next.length > maxChars && line) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      });
      if (line) lines.push(line);
      return lines.slice(0, 3);
    }

    function addWrappedText(group, text, x, y, maxChars, cls = "") {
      const textNode = el("text", { x, y, "text-anchor": "middle", class: cls });
      wrapText(text, maxChars).forEach((line, index) => {
        const tspan = el("tspan", { x, dy: index === 0 ? 0 : 17 });
        tspan.textContent = line;
        textNode.appendChild(tspan);
      });
      group.appendChild(textNode);
      return textNode;
    }

    function addRoundedNode(group, x, y, width, height, title, subtitle, cls) {
      const node = el("g", { class: `node ${cls}` });
      node.appendChild(el("rect", { x: x - width / 2, y: y - height / 2, width, height, rx: 12 }));
      addWrappedText(node, title, x, y - 8, 28);
      const sub = el("text", { x, y: y + 24, "text-anchor": "middle", class: "small" });
      sub.textContent = subtitle;
      node.appendChild(sub);
      group.appendChild(node);
    }

    function leafRadius(item, maxGrowth) {
      return 24 + 22 * Math.sqrt(Math.max(item.growth_pct, 0) / Math.max(maxGrowth, 1));
    }

    function addLeaf(group, item, x, y, side, flow, maxGrowth) {
      const radius = leafRadius(item, maxGrowth);
      const node = el("g", {
        class: `node leaf leaf-${flow === "EXP" ? "exp" : "imp"}`,
        role: "button",
        "aria-label": `${item.product}, variação ${item.growth_pct}%`,
      });
      node.appendChild(el("circle", { cx: x, cy: y, r: radius }));
      const pct = el("text", { x, y: y + 5, "text-anchor": "middle", class: "pct" });
      pct.textContent = `+${String(item.growth_pct).replace(".", ",")}%`;
      node.appendChild(pct);
      const labelX = side === "left" ? x - radius - 12 : x + radius + 12;
      const anchor = side === "left" ? "end" : "start";
      const label = el("text", { x: labelX, y: y - 14, "text-anchor": anchor });
      wrapText(item.product, 34).forEach((line, index) => {
        const tspan = el("tspan", { x: labelX, dy: index === 0 ? 0 : 17 });
        tspan.textContent = line;
        label.appendChild(tspan);
      });
      node.appendChild(label);
      const meta = el("text", { x: labelX, y: y + 44, "text-anchor": anchor, class: "small" });
      meta.textContent = `NCM ${item.ncm} · ${item.value_2026}`;
      node.appendChild(meta);
      node.addEventListener("click", () => {
        detail.textContent = `${item.product} (${item.ncm}): cresceu +${String(item.growth_pct).replace(".", ",")}% frente a jan-jun/2025, de ${item.value_2025} para ${item.value_2026}. Categoria: ${item.category}.`;
      });
      group.appendChild(node);
    }

    function renderButtons() {
      buttons.innerHTML = "";
      countries.forEach((country) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = country.name;
        button.setAttribute("aria-pressed", country.code === selectedCode ? "true" : "false");
        button.addEventListener("click", () => {
          selectedCode = country.code;
          render();
        });
        buttons.appendChild(button);
      });
    }

    function render() {
      const country = countries.find((item) => item.code === selectedCode) || countries[0];
      renderButtons();
      svg.replaceChildren();
      const root = el("g");
      svg.appendChild(root);
      const isSmall = window.matchMedia("(max-width: 760px)").matches;
      if (isSmall) {
        svg.setAttribute("viewBox", "0 0 760 920");
        renderVertical(root, country);
      } else {
        svg.setAttribute("viewBox", "0 0 1120 640");
        renderHorizontal(root, country);
      }
      detail.textContent = country.summary;
    }

    function renderHorizontal(root, country) {
      const center = { x: 560, y: 320 };
      const leftFlow = { x: 340, y: 320 };
      const rightFlow = { x: 780, y: 320 };
      root.appendChild(el("path", { d: `M ${center.x - 100} ${center.y} C 485 245, 430 245, ${leftFlow.x + 90} ${leftFlow.y}`, class: "branch" }));
      root.appendChild(el("path", { d: `M ${center.x + 100} ${center.y} C 635 245, 690 245, ${rightFlow.x - 90} ${rightFlow.y}`, class: "branch" }));
      addRoundedNode(root, center.x, center.y, 190, 96, country.name, `Total ${country.total}`, "center-node");
      addRoundedNode(root, leftFlow.x, leftFlow.y, 180, 70, "Vendas para", country.exports, "flow-exp");
      addRoundedNode(root, rightFlow.x, rightFlow.y, 180, 70, "Compras de", country.imports, "flow-imp");
      const exp = country.flows.EXP || [];
      const imp = country.flows.IMP || [];
      const expMax = Math.max(...exp.map((item) => item.growth_pct), 1);
      const impMax = Math.max(...imp.map((item) => item.growth_pct), 1);
      const ys = [90, 205, 320, 435, 550];
      exp.forEach((item, index) => {
        const x = 170;
        const y = ys[index] || 90 + index * 110;
        root.appendChild(el("path", { d: `M ${leftFlow.x - 88} ${leftFlow.y} C 265 ${leftFlow.y}, 255 ${y}, ${x + 48} ${y}`, class: "branch" }));
        addLeaf(root, item, x, y, "left", "EXP", expMax);
      });
      imp.forEach((item, index) => {
        const x = 950;
        const y = ys[index] || 90 + index * 110;
        root.appendChild(el("path", { d: `M ${rightFlow.x + 88} ${rightFlow.y} C 855 ${rightFlow.y}, 865 ${y}, ${x - 48} ${y}`, class: "branch" }));
        addLeaf(root, item, x, y, "right", "IMP", impMax);
      });
    }

    function renderVertical(root, country) {
      const center = { x: 380, y: 92 };
      const expFlow = { x: 380, y: 215 };
      const impFlow = { x: 380, y: 565 };
      root.appendChild(el("path", { d: `M ${center.x} ${center.y + 48} C 380 165, 380 175, ${expFlow.x} ${expFlow.y - 38}`, class: "branch" }));
      root.appendChild(el("path", { d: `M ${center.x} ${center.y + 48} C 380 370, 380 415, ${impFlow.x} ${impFlow.y - 38}`, class: "branch" }));
      addRoundedNode(root, center.x, center.y, 200, 88, country.name, `Total ${country.total}`, "center-node");
      addRoundedNode(root, expFlow.x, expFlow.y, 180, 64, "Vendas para", country.exports, "flow-exp");
      addRoundedNode(root, impFlow.x, impFlow.y, 180, 64, "Compras de", country.imports, "flow-imp");
      const exp = country.flows.EXP || [];
      const imp = country.flows.IMP || [];
      const expMax = Math.max(...exp.map((item) => item.growth_pct), 1);
      const impMax = Math.max(...imp.map((item) => item.growth_pct), 1);
      exp.forEach((item, index) => {
        const x = index % 2 === 0 ? 155 : 605;
        const y = 300 + Math.floor(index / 2) * 105;
        root.appendChild(el("path", { d: `M ${expFlow.x} ${expFlow.y + 35} C 380 ${y}, ${x} ${y - 25}, ${x} ${y - 45}`, class: "branch" }));
        addLeaf(root, item, x, y, x < 380 ? "left" : "right", "EXP", expMax);
      });
      imp.forEach((item, index) => {
        const x = index % 2 === 0 ? 155 : 605;
        const y = 650 + Math.floor(index / 2) * 90;
        root.appendChild(el("path", { d: `M ${impFlow.x} ${impFlow.y + 35} C 380 ${y}, ${x} ${y - 25}, ${x} ${y - 45}`, class: "branch" }));
        addLeaf(root, item, x, y, x < 380 ? "left" : "right", "IMP", impMax);
      });
    }

    window.addEventListener("resize", render);
    render();
  </script>
</body>
</html>
"""
    html_text = html_text.replace("__DATA__", data)
    (OUTPUT_DIR / "top5_paises_mapa_mental.html").write_text(html_text, encoding="utf-8")
    (OUTPUT_DIR / "top5_paises_mapa_mental.json").write_text(
        json.dumps(_mind_map_payload(top_countries, ranked), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    frames = []
    for year in YEARS:
        for flow, pattern in FLOWS.items():
            frames.append(_read_trade(Path(str(pattern).format(year=year)), flow, year))
    trade = pd.concat(frames, ignore_index=True)
    countries = _read_countries()
    ncms = _read_ncm_descriptions()

    top_countries = _top_countries(trade, countries)
    comparison = _build_comparison(trade)
    ranked = _rank_products(comparison, set(top_countries["country_code"]), ncms, countries)

    top_countries.to_csv(OUTPUT_DIR / "top5_paises_2026_h1.csv", index=False, encoding="utf-8-sig")
    comparison_top = comparison.loc[comparison["country_code"].isin(set(top_countries["country_code"]))].merge(
        countries, on="country_code", how="left"
    ).merge(ncms, on="ncm", how="left")
    comparison_top.to_csv(OUTPUT_DIR / "comparacao_produtos_top5_paises.csv", index=False, encoding="utf-8-sig")
    ranked.to_csv(OUTPUT_DIR / "rankings_produtos_crescimento_top5_paises.csv", index=False, encoding="utf-8-sig")
    with pd.ExcelWriter(OUTPUT_DIR / "top5_paises_crescimento_produtos.xlsx") as writer:
        top_countries.to_excel(writer, sheet_name="top5_paises", index=False)
        ranked.to_excel(writer, sheet_name="rankings", index=False)
        comparison_top.to_excel(writer, sheet_name="comparacao_produtos", index=False)
    (OUTPUT_DIR / "rankings_produtos_crescimento_top5_paises.json").write_text(
        json.dumps(json.loads(ranked.to_json(orient="records", force_ascii=False)), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    _write_markdown(top_countries, ranked)
    _write_html(top_countries, ranked)
    _write_mind_map_html(top_countries, ranked)


if __name__ == "__main__":
    main()
