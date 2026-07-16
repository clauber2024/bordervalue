from __future__ import annotations

import json
import re
from html import unescape
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "outputs" / "final_border_value_2026"
SOURCE_DIR = BASE_DIR / "outputs" / "official_2026"
NCM_JSON = BASE_DIR / "dados" / "cache" / "ncm_vigente.json"

LOW_EMISSION_CAVEAT = (
    "A NCM identifica o produto comercial, mas normalmente nao informa rota de "
    "producao, eletricidade usada, captura de carbono ou intensidade de emissoes. "
    "Nao classificar automaticamente como verde, azul ou de baixa emissao sem "
    "fontes complementares de projeto, tecnologia e emissao."
)


COMPLEMENTARY_SOURCE_FIELDS = [
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "projetos_capacidade_produtiva",
        "campo_requerido": "projeto, empresa, localizacao, capacidade_t_ano_ou_MW, tecnologia, fonte_eletrica, status, data_operacao, intensidade_emissoes",
        "uso": "Separar hidrogenio renovavel, eletrolitico, azul, cinza ou outra rota.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "projetos_capacidade_produtiva",
        "campo_requerido": "planta, capacidade_t_ano, origem_do_hidrogenio, captura_de_carbono, destino_fertilizante_ou_energia, intensidade_emissoes",
        "uso": "Distinguir amonia convencional de amonia de baixa emissao.",
    },
    {
        "recorte_combustivel": "metanol_derivados",
        "camada_analitica": "projetos_capacidade_produtiva",
        "campo_requerido": "rota, fonte_de_carbono, hidrogenio_utilizado, biomassa_ou_CO2, capacidade, certificacao, intensidade_emissoes",
        "uso": "Separar metanol convencional, biometanol e e-metanol.",
    },
    {
        "recorte_combustivel": "etanol",
        "camada_analitica": "projetos_capacidade_produtiva",
        "campo_requerido": "materia_prima, safra, usina, capacidade, certificacao, pegada_de_carbono, destino_energetico_industrial",
        "uso": "Conectar producao, comercio, SAF por ATJ e combustiveis sinteticos.",
    },
    {
        "recorte_combustivel": "saf",
        "camada_analitica": "rotas_tecnologicas",
        "campo_requerido": "rota_HEFA_ATJ_FT_eSAF, insumo, certificacao, capacidade, blend, offtake, intensidade_emissoes",
        "uso": "Identificar SAF efetivo, pois NCM de querosene de aviacao nao separa produto fossil e SAF.",
    },
    {
        "recorte_combustivel": "combustiveis_maritimos_baixa_emissao",
        "camada_analitica": "aplicacoes_finais",
        "campo_requerido": "combustivel, navio_ou_terminal, rota, bunkering, certificacao, intensidade_emissoes_well_to_wake",
        "uso": "Separar amonia, metanol, biocombustiveis e combustiveis sinteticos usados em transporte maritimo.",
    },
]


MANDATORY_LAYER_FRAMEWORK = [
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "molecula_principal",
        "como_medir": "NCM 28041000 e fluxos observados no Comex Stat.",
        "observacao": "Produto identificado; rota de producao nao identificada pela NCM.",
    },
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "insumos_materias_primas",
        "como_medir": "NCMs de gas natural/GLP e insumos correlatos; complementar com dados de eletricidade e agua quando aplicavel.",
        "observacao": "Insumo nao define se o hidrogenio final e verde, azul ou cinza.",
    },
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "equipamentos_cadeia",
        "como_medir": "NCMs de eletrolise, compressao, liquefacao, recipientes, cisternas e transporte.",
        "observacao": "Equipamentos podem atender outros gases ou usos industriais.",
    },
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "derivados",
        "como_medir": "Amonia, metanol e fertilizantes associados.",
        "observacao": "Derivado nao herda automaticamente atributo de baixa emissao.",
    },
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "aplicacoes_finais",
        "como_medir": "Fertilizantes, siderurgia, refino e combustiveis sinteticos como mercados de uso.",
        "observacao": "Camada de demanda potencial, nao certificacao ambiental.",
    },
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "projetos_capacidade_produtiva",
        "como_medir": "Base complementar de projetos, capacidade, tecnologia, eletricidade e intensidade de emissoes.",
        "observacao": "Nao mensuravel por NCM.",
    },
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "fluxos_comerciais",
        "como_medir": "Exportacoes, importacoes, saldo, peso liquido e ranking por NCM.",
        "observacao": "Fluxo comercial e por produto, sem cor de hidrogenio.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "molecula_principal",
        "como_medir": "NCMs 28141000 e 28142000.",
        "observacao": "Amonia anidra e em solucao; rota de producao nao identificada pela NCM.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "insumos_materias_primas",
        "como_medir": "Hidrogenio, nitrogenio e hidrocarbonetos usados em rotas de sintese.",
        "observacao": "A rota precisa vir de fonte complementar.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "equipamentos_cadeia",
        "como_medir": "NCMs de compressao, liquefacao, armazenagem e transporte.",
        "observacao": "Equipamentos sao multiproduto e exigem validacao especialista.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "derivados",
        "como_medir": "Fertilizantes nitrogenados e misturas.",
        "observacao": "Inclui derivados relevantes para fertilizantes.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "aplicacoes_finais",
        "como_medir": "Fertilizantes, uso energetico e combustivel maritimo.",
        "observacao": "Uso final energetico precisa de fonte setorial ou projeto.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "projetos_capacidade_produtiva",
        "como_medir": "Base complementar de plantas, capacidade, origem do hidrogenio e intensidade de emissoes.",
        "observacao": "Nao mensuravel por NCM.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "fluxos_comerciais",
        "como_medir": "Exportacoes, importacoes, saldo, peso liquido e ranking por NCM.",
        "observacao": "Fluxo comercial e por produto, sem classificacao verde/azul.",
    },
]


FUEL_RULES = [
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "molecula_principal",
        "prefixes": ["28041000"],
        "papel_no_recorte": "Comercio exterior de hidrogenio.",
    },
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "insumos_materias_primas",
        "prefixes": ["271112", "271113", "271129"],
        "papel_no_recorte": "Gas natural e GLP como insumos potenciais para hidrogenio convencional ou com captura.",
    },
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "equipamentos_cadeia",
        "prefixes": ["854330", "841480", "841960", "731100", "761300", "860610", "871631", "890120"],
        "papel_no_recorte": "Eletrolise, compressao, liquefacao, armazenamento e transporte.",
    },
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "derivados",
        "prefixes": ["281410", "281420", "290511", "3102", "3105"],
        "papel_no_recorte": "Amonia, metanol e fertilizantes associados ao uso de hidrogenio.",
    },
    {
        "recorte_combustivel": "hidrogenio",
        "camada_analitica": "aplicacoes_finais",
        "prefixes": ["3102", "3105", "7201", "7203", "7206", "7207", "271019", "382600"],
        "papel_no_recorte": "Fertilizantes, siderurgia, refino e combustiveis sinteticos ou biocombustiveis correlatos.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "molecula_principal",
        "prefixes": ["281410", "281420"],
        "papel_no_recorte": "Amoniaco anidro e amonia em solucao aquosa.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "insumos_materias_primas",
        "prefixes": ["280410", "280430", "271112", "271113", "271129"],
        "papel_no_recorte": "Hidrogenio, nitrogenio e hidrocarbonetos usados na rota convencional ou de baixa emissao.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "equipamentos_cadeia",
        "prefixes": ["841480", "841960", "731100", "761300", "860610", "871631", "890120"],
        "papel_no_recorte": "Compressao, liquefacao, armazenagem e transporte de gases ou liquidos a granel.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "derivados",
        "prefixes": ["310210", "310221", "310229", "310230", "310240", "310250", "310260", "310280", "310290", "3105"],
        "papel_no_recorte": "Fertilizantes nitrogenados e misturas com amonia ou derivados.",
    },
    {
        "recorte_combustivel": "amonia",
        "camada_analitica": "aplicacoes_finais",
        "prefixes": ["3102", "3105", "281410", "281420"],
        "papel_no_recorte": "Insumo para fertilizantes e uso energetico ou combustivel maritimo.",
    },
    {
        "recorte_combustivel": "metanol_derivados",
        "camada_analitica": "molecula_principal",
        "prefixes": ["290511"],
        "papel_no_recorte": "Metanol convencional ou de baixo carbono; a rota nao e identificavel pela NCM.",
    },
    {
        "recorte_combustivel": "metanol_derivados",
        "camada_analitica": "insumos_materias_primas",
        "prefixes": ["271112", "271113", "271129", "280410"],
        "papel_no_recorte": "Gas natural ou hidrogenio como insumos possiveis para metanol.",
    },
    {
        "recorte_combustivel": "metanol_derivados",
        "camada_analitica": "derivados",
        "prefixes": ["291211", "291521", "291531", "291532", "291533", "291539", "29091910", "390710"],
        "papel_no_recorte": "Formaldeido, acido acetico, acetatos, MTBE e resinas associadas.",
    },
    {
        "recorte_combustivel": "metanol_derivados",
        "camada_analitica": "aplicacoes_finais",
        "prefixes": ["290511", "271019", "382600"],
        "papel_no_recorte": "Aplicacoes maritimas e combustiveis sinteticos associados ao metanol.",
    },
    {
        "recorte_combustivel": "etanol",
        "camada_analitica": "molecula_principal",
        "prefixes": ["220710", "220720"],
        "papel_no_recorte": "Producao e comercio de alcool etilico nao desnaturado e desnaturado.",
    },
    {
        "recorte_combustivel": "etanol",
        "camada_analitica": "insumos_materias_primas",
        "prefixes": ["1701", "1005"],
        "papel_no_recorte": "Acucar e milho como materias-primas agroindustriais potenciais.",
    },
    {
        "recorte_combustivel": "etanol",
        "camada_analitica": "aplicacoes_finais",
        "prefixes": ["220710", "220720", "271012", "271019", "382600"],
        "papel_no_recorte": "Uso energetico, industrial, integracao com SAF por ATJ e combustiveis sinteticos.",
    },
    {
        "recorte_combustivel": "saf",
        "camada_analitica": "rotas_tecnologicas",
        "prefixes": ["1507", "1508", "1509", "1510", "1511", "1512", "1513", "1514", "1515", "1516", "1517", "1518", "220710", "220720", "280410", "290511"],
        "papel_no_recorte": "Insumos para HEFA, ATJ, FT/e-SAF e rotas correlatas.",
    },
    {
        "recorte_combustivel": "saf",
        "camada_analitica": "equipamentos_cadeia",
        "prefixes": ["841940", "841950", "841989", "842129", "842139", "847982", "854330"],
        "papel_no_recorte": "Destilacao, troca termica, reatores, filtragem, mistura e eletrolise.",
    },
    {
        "recorte_combustivel": "saf",
        "camada_analitica": "aplicacoes_finais",
        "prefixes": ["27101911"],
        "papel_no_recorte": "Querosene de aviacao; NCM nao separa fossil e SAF.",
    },
    {
        "recorte_combustivel": "combustiveis_maritimos_baixa_emissao",
        "camada_analitica": "molecula_principal",
        "prefixes": ["281410", "281420", "290511", "382600", "271020", "280410"],
        "papel_no_recorte": "Amonia, metanol, biocombustiveis e combustiveis sinteticos derivados de hidrogenio.",
    },
    {
        "recorte_combustivel": "combustiveis_maritimos_baixa_emissao",
        "camada_analitica": "equipamentos_cadeia",
        "prefixes": ["890120", "860610", "871631", "731100", "761300", "841480"],
        "papel_no_recorte": "Navios-tanque, vagões-tanque, cisternas, recipientes e compressao.",
    },
]


def clean_description(value: str) -> str:
    text = unescape(str(value))
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_ncm(series: pd.Series) -> pd.Series:
    return series.astype("string").str.replace(r"\.0$", "", regex=True).str.zfill(8)


def read_ncm_descriptions() -> pd.DataFrame:
    data = json.loads(NCM_JSON.read_text(encoding="utf-8"))
    descriptions = {}
    for item in data["Nomenclaturas"]:
        code = str(item.get("Codigo", "")).replace(".", "")
        text = clean_description(item.get("Descricao", ""))
        if code and text:
            descriptions[code] = text
    rows = []
    for code, text in descriptions.items():
        if len(code) != 8:
            continue
        hierarchy = []
        for prefix_len in [2, 4, 6, 8]:
            part = descriptions.get(code[:prefix_len])
            if part and part not in hierarchy:
                hierarchy.append(part)
        rows.append(
            {
                "ncm": code,
                "descricao_ncm": text,
                "descricao_ncm_hierarquica": " > ".join(hierarchy),
            }
        )
    return pd.DataFrame(rows).drop_duplicates("ncm")


def build_seed(ncms: pd.Series) -> pd.DataFrame:
    rows = []
    for ncm in sorted(set(ncms.dropna().astype(str))):
        for rule in FUEL_RULES:
            if any(ncm.startswith(prefix) for prefix in rule["prefixes"]):
                rows.append(
                    {
                        "recorte_combustivel": rule["recorte_combustivel"],
                        "camada_analitica": rule["camada_analitica"],
                        "ncm": ncm,
                        "papel_no_recorte": rule["papel_no_recorte"],
                        "regra_mapeamento": "prefixo_ncm_curado",
                        "status_baixa_emissao": "nao_inferivel_por_ncm",
                        "ressalva_metodologica": LOW_EMISSION_CAVEAT,
                        "fonte_validacao": "seed_codex_para_validacao_especialista",
                    }
                )
    return pd.DataFrame(rows).drop_duplicates(["recorte_combustivel", "camada_analitica", "ncm"])


def build_outputs() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    trade = pd.read_csv(SOURCE_DIR / "fact_trade.csv", dtype={"ncm": "string"})
    trade["ncm"] = normalize_ncm(trade["ncm"])
    descriptions = read_ncm_descriptions()
    seed = build_seed(descriptions["ncm"]).merge(descriptions, on="ncm", how="left")

    detail = trade.merge(seed, on="ncm", how="inner")
    detail["value_usd"] = pd.to_numeric(detail["value_usd"], errors="coerce").fillna(0.0)
    detail["net_weight_kg"] = pd.to_numeric(detail["net_weight_kg"], errors="coerce").fillna(0.0)

    ncm_detail = (
        detail.groupby(
            [
                "recorte_combustivel",
                "camada_analitica",
                "ncm",
                "descricao_ncm_hierarquica",
                "papel_no_recorte",
                "flow",
            ],
            as_index=False,
            dropna=False,
        )
        .agg(value_usd=("value_usd", "sum"), net_weight_kg=("net_weight_kg", "sum"))
        .sort_values(["recorte_combustivel", "camada_analitica", "value_usd"], ascending=[True, True, False], kind="stable")
    )

    flow = (
        detail.groupby(["recorte_combustivel", "camada_analitica", "flow"], as_index=False)
        .agg(value_usd=("value_usd", "sum"), net_weight_kg=("net_weight_kg", "sum"), ncm_count=("ncm", "nunique"))
    )
    indicators = (
        flow.pivot_table(
            index=["recorte_combustivel", "camada_analitica"],
            columns="flow",
            values=["value_usd", "net_weight_kg", "ncm_count"],
            aggfunc="sum",
            fill_value=0,
        )
        .reset_index()
    )
    indicators.columns = [
        "_".join([str(part) for part in col if part]) if isinstance(col, tuple) else str(col)
        for col in indicators.columns
    ]
    for column in ["value_usd_EXP", "value_usd_IMP", "net_weight_kg_EXP", "net_weight_kg_IMP", "ncm_count_EXP", "ncm_count_IMP"]:
        if column not in indicators:
            indicators[column] = 0
    indicators = indicators.rename(
        columns={
            "value_usd_EXP": "export_value_usd",
            "value_usd_IMP": "import_value_usd",
            "net_weight_kg_EXP": "export_net_weight_kg",
            "net_weight_kg_IMP": "import_net_weight_kg",
            "ncm_count_EXP": "export_ncm_count",
            "ncm_count_IMP": "import_ncm_count",
        }
    )
    indicators["trade_value_usd"] = indicators["export_value_usd"] + indicators["import_value_usd"]
    indicators["trade_balance_usd"] = indicators["export_value_usd"] - indicators["import_value_usd"]
    indicators["import_share_trade"] = indicators["import_value_usd"] / indicators["trade_value_usd"].where(indicators["trade_value_usd"].ne(0))
    unique_ncms = (
        detail.groupby(["recorte_combustivel", "camada_analitica"], as_index=False)
        .agg(unique_ncm_count=("ncm", "nunique"))
    )
    indicators = indicators.merge(unique_ncms, on=["recorte_combustivel", "camada_analitica"], how="left")
    indicators["unique_ncm_count"] = indicators["unique_ncm_count"].fillna(0).astype(int)
    indicators["status_baixa_emissao"] = "nao_inferivel_por_ncm"
    indicators["ressalva_metodologica"] = LOW_EMISSION_CAVEAT
    indicators = indicators.sort_values("trade_value_usd", ascending=False, kind="stable")

    complementary = pd.DataFrame(COMPLEMENTARY_SOURCE_FIELDS)
    framework = pd.DataFrame(MANDATORY_LAYER_FRAMEWORK)
    return seed, indicators, ncm_detail, complementary, framework


def money(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"US$ {value / 1_000_000:,.1f} mi"


def write_report(seed: pd.DataFrame, indicators: pd.DataFrame, ncm_detail: pd.DataFrame, complementary: pd.DataFrame, framework: pd.DataFrame) -> None:
    lines = [
        "# Recortes de combustiveis da transicao",
        "",
        "Camada analitica transversal ao mapeamento Prodlist/CNAE. A seed usa NCMs e prefixos curados para organizar comercio exterior, equipamentos, insumos, derivados e aplicacoes finais. Ela nao altera a ponte oficial CONCLA/IBGE.",
        "",
        "## Ressalva central",
        "",
        LOW_EMISSION_CAVEAT,
        "",
        "## Recortes preparados",
        "",
        "| Recorte | Camada | Valor comercial | Importacoes | Exportacoes | Saldo | NCMs observadas |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for _, row in indicators.iterrows():
        lines.append(
            f"| {row['recorte_combustivel']} | {row['camada_analitica']} | "
            f"{money(row['trade_value_usd'])} | {money(row['import_value_usd'])} | "
            f"{money(row['export_value_usd'])} | {money(row['trade_balance_usd'])} | {int(row['unique_ncm_count'])} |"
        )

    lines.extend(["", "## Hidrogenio e amonia: camadas obrigatorias", ""])
    for fuel in ["hidrogenio", "amonia"]:
        lines.append(f"### {fuel}")
        subset = framework[framework["recorte_combustivel"].eq(fuel)]
        for _, row in subset.iterrows():
            count = seed[
                seed["recorte_combustivel"].eq(fuel)
                & seed["camada_analitica"].eq(row["camada_analitica"])
            ]["ncm"].nunique()
            suffix = f" ({count} NCMs na seed)" if count else ""
            lines.append(f"- {row['camada_analitica']}: {row['como_medir']}{suffix}.")
        lines.append("")

    lines.extend(["## Principais NCMs observadas por recorte", ""])
    for fuel in indicators["recorte_combustivel"].drop_duplicates().tolist():
        lines.append(f"### {fuel}")
        subset = ncm_detail[ncm_detail["recorte_combustivel"].eq(fuel)].sort_values("value_usd", ascending=False).head(8)
        if subset.empty:
            lines.append("- Sem comercio observado no periodo.")
        for _, row in subset.iterrows():
            lines.append(
                f"- {row['flow']} NCM {row['ncm']}: {money(row['value_usd'])}; "
                f"{row['camada_analitica']}; {row['descricao_ncm_hierarquica']}."
            )
        lines.append("")

    lines.extend(["## Fontes complementares necessarias", ""])
    for _, row in complementary.iterrows():
        lines.append(
            f"- {row['recorte_combustivel']} / {row['camada_analitica']}: "
            f"{row['campo_requerido']}."
        )

    lines.extend(
        [
            "",
            "## Arquivos gerados",
            "",
            "- `recortes_combustiveis_transicao_seed.csv`",
            "- `indicadores_combustiveis_transicao_camada.csv`",
            "- `drivers_combustiveis_transicao_ncm.csv`",
            "- `fontes_complementares_combustiveis_transicao.csv`",
            "- `estrutura_analitica_hidrogenio_amonia.csv`",
            "- `relatorio_recortes_combustiveis_transicao.md`",
        ]
    )
    (OUTPUT_DIR / "relatorio_recortes_combustiveis_transicao.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    seed, indicators, ncm_detail, complementary, framework = build_outputs()
    csv_options = {"index": False, "encoding": "utf-8-sig"}
    seed.to_csv(OUTPUT_DIR / "recortes_combustiveis_transicao_seed.csv", **csv_options)
    indicators.to_csv(OUTPUT_DIR / "indicadores_combustiveis_transicao_camada.csv", **csv_options)
    ncm_detail.to_csv(OUTPUT_DIR / "drivers_combustiveis_transicao_ncm.csv", **csv_options)
    complementary.to_csv(OUTPUT_DIR / "fontes_complementares_combustiveis_transicao.csv", **csv_options)
    framework.to_csv(OUTPUT_DIR / "estrutura_analitica_hidrogenio_amonia.csv", **csv_options)
    write_report(seed, indicators, ncm_detail, complementary, framework)

    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"files": {}}
    manifest.setdefault("files", {}).update(
        {
            "recortes_combustiveis_transicao_seed.csv": len(seed),
            "indicadores_combustiveis_transicao_camada.csv": len(indicators),
            "drivers_combustiveis_transicao_ncm.csv": len(ncm_detail),
            "fontes_complementares_combustiveis_transicao.csv": len(complementary),
            "estrutura_analitica_hidrogenio_amonia.csv": len(framework),
            "relatorio_recortes_combustiveis_transicao.md": None,
        }
    )
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
