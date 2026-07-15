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


CRITICALITY_REFERENCE = [
    {
        "mineral_base": "terras_raras",
        "criticidade_global": "muito_alta",
        "criticality_weight": 1.0,
        "posicao_brasil": "reservas_relevantes_e_agenda_emergente",
        "gargalo_principal": "separacao_refino_ligas_e_imas",
        "fonte_referencia": "IEA Global Critical Minerals Outlook 2024; contexto setorial Brasil",
    },
    {
        "mineral_base": "grafite",
        "criticidade_global": "muito_alta",
        "criticality_weight": 1.0,
        "posicao_brasil": "potencial_mineral_relevante",
        "gargalo_principal": "purificacao_esferizacao_anodos_battery_grade",
        "fonte_referencia": "IEA Global Critical Minerals Outlook 2024; contexto setorial Brasil",
    },
    {
        "mineral_base": "litio",
        "criticidade_global": "muito_alta",
        "criticality_weight": 1.0,
        "posicao_brasil": "producao_e_projetos_em_expansao",
        "gargalo_principal": "quimicos_grau_bateria_catodos_celulas_reciclagem",
        "fonte_referencia": "IEA Global Critical Minerals Outlook 2024; contexto setorial Brasil",
    },
    {
        "mineral_base": "cobalto",
        "criticidade_global": "muito_alta",
        "criticality_weight": 1.0,
        "posicao_brasil": "comercio_observado_baixo_mas_material_critico_global",
        "gargalo_principal": "refino_precursores_catodicos_substituicao_e_reciclagem",
        "fonte_referencia": "IEA Global Critical Minerals Outlook 2024",
    },
    {
        "mineral_base": "cobre",
        "criticidade_global": "alta",
        "criticality_weight": 0.9,
        "posicao_brasil": "base_mineral_e_comercio_relevante",
        "gargalo_principal": "refino_fios_cabos_motores_inversores_equipamentos",
        "fonte_referencia": "IEA Global Critical Minerals Outlook 2024",
    },
    {
        "mineral_base": "niquel",
        "criticidade_global": "alta",
        "criticality_weight": 0.9,
        "posicao_brasil": "base_mineral_relevante",
        "gargalo_principal": "sulfato_de_niquel_precursores_catodicos_ligas",
        "fonte_referencia": "IEA Global Critical Minerals Outlook 2024; contexto setorial Brasil",
    },
    {
        "mineral_base": "niobio",
        "criticidade_global": "alta",
        "criticality_weight": 0.9,
        "posicao_brasil": "especialidade_brasileira_com_posicao_global_forte",
        "gargalo_principal": "aplicacoes_avancadas_baterias_supercondutores_ligas",
        "fonte_referencia": "contexto setorial Brasil; listas internacionais de materiais criticos",
    },
    {
        "mineral_base": "silicio_quartzo",
        "criticidade_global": "alta",
        "criticality_weight": 0.85,
        "posicao_brasil": "base_mineral_e_potencial_industrial",
        "gargalo_principal": "polisilicio_wafers_celulas_modulos_semicondutores",
        "fonte_referencia": "listas internacionais de materiais criticos; contexto setorial Brasil",
    },
    {
        "mineral_base": "ferro",
        "criticidade_global": "media_alta",
        "criticality_weight": 0.75,
        "posicao_brasil": "grande_base_exportadora",
        "gargalo_principal": "aco_verde_h2_ligas_componentes_industriais",
        "fonte_referencia": "contexto setorial Brasil",
    },
    {
        "mineral_base": "bauxita_aluminio",
        "criticidade_global": "media_alta",
        "criticality_weight": 0.75,
        "posicao_brasil": "base_mineral_e_metalurgica_relevante",
        "gargalo_principal": "aluminio_baixo_carbono_extrudados_cabos_componentes",
        "fonte_referencia": "listas internacionais de materiais criticos; contexto setorial Brasil",
    },
    {
        "mineral_base": "manganes",
        "criticidade_global": "media_alta",
        "criticality_weight": 0.75,
        "posicao_brasil": "base_mineral_relevante",
        "gargalo_principal": "manganes_quimico_grau_bateria_ligas",
        "fonte_referencia": "listas internacionais de materiais criticos; contexto setorial Brasil",
    },
    {
        "mineral_base": "fosfato_potassio",
        "criticidade_global": "media_alta",
        "criticality_weight": 0.75,
        "posicao_brasil": "alta_dependencia_importadora_em_fertilizantes",
        "gargalo_principal": "fertilizantes_de_baixo_carbono_e_insumos_agroindustriais",
        "fonte_referencia": "contexto setorial Brasil",
    },
    {
        "mineral_base": "vanadio",
        "criticidade_global": "media",
        "criticality_weight": 0.6,
        "posicao_brasil": "potencial_em_ligas_e_armazenamento",
        "gargalo_principal": "eletrolitos_baterias_fluxo_oxidos_ligas",
        "fonte_referencia": "listas internacionais de materiais criticos",
    },
    {
        "mineral_base": "tantalio_estanho",
        "criticidade_global": "media",
        "criticality_weight": 0.6,
        "posicao_brasil": "base_mineral_relevante_em_eletronica",
        "gargalo_principal": "refino_capacitores_soldas_componentes_rastreabilidade",
        "fonte_referencia": "listas internacionais de materiais criticos; contexto setorial Brasil",
    },
]


CHAIN_RULES = [
    {
        "cadeia_estrategica": "ferro_aco_verde",
        "mineral_base": "ferro",
        "prioridade_transicao": "alta",
        "prefixes": ["2601", "7201", "7203", "7204", "7205", "7206", "7207"],
        "upstream_prefixes": ["2601"],
        "downstream_prefixes": ["7201", "7203", "7204", "7205", "7206", "7207"],
        "tecnologias_transicao": "aco verde; eolica; solar; redes; veiculos; infraestrutura",
        "direcao_adensamento": "pelotizacao, reducao direta, H2 verde, aços especiais, componentes para energia e mobilidade",
        "racional": "Grande base exportadora mineral; oportunidade esta em descarbonizar e sofisticar a siderurgia.",
    },
    {
        "cadeia_estrategica": "cobre_eletrificacao",
        "mineral_base": "cobre",
        "prioridade_transicao": "alta",
        "prefixes": ["2603", "7401", "7402", "7403", "7404", "7405", "7406", "7407", "7408", "7409", "7410", "7411", "7412", "7413"],
        "upstream_prefixes": ["2603"],
        "downstream_prefixes": ["7401", "7402", "7403", "7404", "7405", "7406", "7407", "7408", "7409", "7410", "7411", "7412", "7413"],
        "tecnologias_transicao": "redes eletricas; motores; inversores; eolica; solar; veiculos eletricos",
        "direcao_adensamento": "refino, fios, cabos, barramentos, motores, inversores e equipamentos eletricos",
        "racional": "Cobre e insumo sistemico da eletrificacao e tem alto valor nos elos transformados.",
    },
    {
        "cadeia_estrategica": "litio_baterias",
        "mineral_base": "litio",
        "prioridade_transicao": "alta",
        "prefixes": ["25309010", "282520", "28273960", "28332920", "28342940", "28369100", "28453000", "850760"],
        "upstream_prefixes": ["25309010"],
        "downstream_prefixes": ["282520", "28273960", "28332920", "28342940", "28369100", "28453000", "850760"],
        "tecnologias_transicao": "baterias; armazenamento estacionario; veiculos eletricos",
        "direcao_adensamento": "carbonato/hidroxido grau bateria, materiais catodicos, celulas, packs e reciclagem",
        "racional": "Mineral central para baterias; capturar valor exige processamento quimico e elos industriais.",
    },
    {
        "cadeia_estrategica": "niquel_baterias_ligas",
        "mineral_base": "niquel",
        "prioridade_transicao": "alta",
        "prefixes": ["2604", "7501", "7502", "7503", "7504", "7505", "7506", "7507", "7508", "282540", "282735", "283324"],
        "upstream_prefixes": ["2604"],
        "downstream_prefixes": ["7501", "7502", "7503", "7504", "7505", "7506", "7507", "7508", "282540", "282735", "283324"],
        "tecnologias_transicao": "baterias NMC/NCA; aco inox; ligas; hidrogenio",
        "direcao_adensamento": "sulfato de niquel, precursores de catodo, ligas especiais e reciclagem",
        "racional": "Relevante para baterias de alta densidade e ligas industriais.",
    },
    {
        "cadeia_estrategica": "cobalto_baterias",
        "mineral_base": "cobalto",
        "prioridade_transicao": "alta",
        "prefixes": ["2605", "2822", "28352920", "8105"],
        "upstream_prefixes": ["2605"],
        "downstream_prefixes": ["2822", "28352920", "8105"],
        "tecnologias_transicao": "baterias NMC/NCA; superligas; catalisadores; reciclagem",
        "direcao_adensamento": "refino, sais de cobalto, precursores catodicos, reciclagem e substituicao tecnologica",
        "racional": "Material critico global para baterias; comercio brasileiro observado e baixo, mas a cadeia deve ser monitorada.",
    },
    {
        "cadeia_estrategica": "grafite_baterias",
        "mineral_base": "grafite",
        "prioridade_transicao": "alta",
        "prefixes": ["2504", "380110", "380120", "380130", "380190"],
        "upstream_prefixes": ["2504"],
        "downstream_prefixes": ["380110", "380120", "380130", "380190"],
        "tecnologias_transicao": "anodos de baterias; armazenamento; refratarios; materiais avancados",
        "direcao_adensamento": "grafite purificada/esferica, anodos, materiais de carbono e reciclagem",
        "racional": "Gargalo global relevante em anodos de baterias; Brasil tem potencial mineral.",
    },
    {
        "cadeia_estrategica": "terras_raras_imas",
        "mineral_base": "terras_raras",
        "prioridade_transicao": "alta",
        "prefixes": ["25309030", "280530", "284690", "850511", "850519"],
        "upstream_prefixes": ["25309030"],
        "downstream_prefixes": ["280530", "284690", "850511", "850519"],
        "tecnologias_transicao": "imas permanentes; aerogeradores; veiculos eletricos; motores; defesa; eletronica",
        "direcao_adensamento": "separacao, oxidos, metais, ligas magneticas e fabricacao de imas",
        "racional": "Reservas relevantes; gargalo esta em separacao/refino e imas de NdPr/Dy/Tb.",
    },
    {
        "cadeia_estrategica": "niobio_materiais_avancados",
        "mineral_base": "niobio",
        "prioridade_transicao": "alta",
        "prefixes": ["261590", "720293", "811292", "811299"],
        "upstream_prefixes": ["261590"],
        "downstream_prefixes": ["720293", "811292", "811299"],
        "tecnologias_transicao": "acos avancados; baterias com niobio; supercondutores; infraestrutura leve",
        "direcao_adensamento": "ligas especiais, materiais para baterias, supercondutores e aplicacoes de alto desempenho",
        "racional": "Especialidade brasileira; prioridade e diversificar aplicacoes alem do ferroniobio.",
    },
    {
        "cadeia_estrategica": "silicio_solar_semicondutores",
        "mineral_base": "silicio_quartzo",
        "prioridade_transicao": "alta",
        "prefixes": ["250510", "250610", "280461", "280469", "284920", "854141", "854142", "854143", "854149"],
        "upstream_prefixes": ["250510", "250610"],
        "downstream_prefixes": ["280461", "280469", "284920", "854141", "854142", "854143", "854149"],
        "tecnologias_transicao": "solar fotovoltaica; semicondutores; eletronica de potencia",
        "direcao_adensamento": "silicio metalurgico, polisilicio, wafers, celulas, modulos e semicondutores",
        "racional": "Cadeia exemplar de salto de complexidade entre mineral, energia limpa e tecnologia.",
    },
    {
        "cadeia_estrategica": "manganes_baterias_aco",
        "mineral_base": "manganes",
        "prioridade_transicao": "media_alta",
        "prefixes": ["2602", "282010", "282090", "28352960", "720211", "720219", "720230"],
        "upstream_prefixes": ["2602"],
        "downstream_prefixes": ["282010", "282090", "28352960", "720211", "720219", "720230"],
        "tecnologias_transicao": "baterias LMFP/NMC; aco; ligas",
        "direcao_adensamento": "manganes quimico grau bateria, precursores, ligas e aços especiais",
        "racional": "Pode ganhar relevancia com quimicas de bateria mais intensivas em manganes.",
    },
    {
        "cadeia_estrategica": "aluminio_bauxita_eletrificacao",
        "mineral_base": "bauxita_aluminio",
        "prioridade_transicao": "media_alta",
        "prefixes": ["2606", "281820", "281830", "7601", "7602", "7603", "7604", "7605", "7606", "7607", "7608", "7609"],
        "upstream_prefixes": ["2606"],
        "downstream_prefixes": ["281820", "281830", "7601", "7602", "7603", "7604", "7605", "7606", "7607", "7608", "7609"],
        "tecnologias_transicao": "cabos; redes; solar; eolica; veiculos leves",
        "direcao_adensamento": "alumina, aluminio baixo carbono, extrudados, cabos e componentes estruturais",
        "racional": "Material intensivo em energia; competitividade depende de energia limpa e elos transformados.",
    },
    {
        "cadeia_estrategica": "fosfato_potassio_fertilizantes",
        "mineral_base": "fosfato_potassio",
        "prioridade_transicao": "media_alta",
        "prefixes": ["251010", "251020", "280920", "281410", "281420", "2835", "3103", "3104", "3105"],
        "upstream_prefixes": ["251010", "251020"],
        "downstream_prefixes": ["280920", "281410", "281420", "2835", "3103", "3104", "3105"],
        "tecnologias_transicao": "seguranca alimentar; bioenergia; agroindustria; fertilizantes de baixo carbono",
        "direcao_adensamento": "fertilizantes, nitrogenados verdes, fosfatados, potassicos e insumos para bioeconomia",
        "racional": "Critico para resiliencia agroindustrial e bioenergia, mesmo nao sendo mineral de bateria.",
    },
    {
        "cadeia_estrategica": "vanadio_armazenamento_aco",
        "mineral_base": "vanadio",
        "prioridade_transicao": "media",
        "prefixes": ["261590", "282530", "720292"],
        "upstream_prefixes": ["261590"],
        "downstream_prefixes": ["282530", "720292"],
        "tecnologias_transicao": "baterias de fluxo; armazenamento estacionario; aços especiais",
        "direcao_adensamento": "eletrólitos para baterias de fluxo, oxidos e ligas especiais",
        "racional": "Opcao relevante para armazenamento estacionario e aços de alto desempenho.",
    },
    {
        "cadeia_estrategica": "tantalio_estanho_eletronica",
        "mineral_base": "tantalio_estanho",
        "prioridade_transicao": "media",
        "prefixes": ["2609", "261590", "28499020", "8001", "8002", "8003", "8007", "8103"],
        "upstream_prefixes": ["2609", "261590"],
        "downstream_prefixes": ["28499020", "8001", "8002", "8003", "8007", "8103"],
        "tecnologias_transicao": "eletronica; soldas; capacitores; equipamentos de potencia",
        "direcao_adensamento": "refino, capacitores, soldas, componentes eletronicos e rastreabilidade",
        "racional": "Base para eletronica e equipamentos; importante em complexidade tecnologica.",
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
        rows.append({"ncm": code, "descricao_ncm": text, "descricao_ncm_hierarquica": " > ".join(hierarchy)})
    return pd.DataFrame(rows).drop_duplicates("ncm")


def match_stage(ncm: str, rule: dict) -> str:
    if any(ncm.startswith(prefix) for prefix in rule["upstream_prefixes"]):
        return "mineral_primario"
    if any(ncm.startswith(prefix) for prefix in rule["downstream_prefixes"]):
        if ncm.startswith(("850", "854")):
            return "componente_bem_final"
        if ncm.startswith(("720", "740", "750", "760", "800", "810", "811")):
            return "metal_liga_semimanufaturado"
        return "quimico_material_processado"
    return "elo_relacionado"


def build_seed(trade_ncms: pd.Series) -> pd.DataFrame:
    rows = []
    for ncm in sorted(set(trade_ncms.dropna().astype(str))):
        for rule in CHAIN_RULES:
            if any(ncm.startswith(prefix) for prefix in rule["prefixes"]):
                row = {key: rule[key] for key in [
                    "cadeia_estrategica",
                    "mineral_base",
                    "prioridade_transicao",
                    "tecnologias_transicao",
                    "direcao_adensamento",
                    "racional",
                ]}
                row["ncm"] = ncm
                row["etapa_cadeia"] = match_stage(ncm, rule)
                row["regra_mapeamento"] = "prefixo_ncm_curado"
                row["fonte_validacao"] = "seed_codex_para_validacao_especialista"
                rows.append(row)
    return pd.DataFrame(rows).drop_duplicates(["ncm", "cadeia_estrategica"])


def build_outputs() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    trade = pd.read_csv(SOURCE_DIR / "fact_trade.csv", dtype={"ncm": "string"})
    trade["ncm"] = normalize_ncm(trade["ncm"])
    descriptions = read_ncm_descriptions()
    seed = build_seed(trade["ncm"]).merge(descriptions, on="ncm", how="left")
    criticality = pd.DataFrame(CRITICALITY_REFERENCE)

    detail = trade.merge(seed, on="ncm", how="inner")
    detail["value_usd"] = pd.to_numeric(detail["value_usd"], errors="coerce").fillna(0.0)
    detail["net_weight_kg"] = pd.to_numeric(detail["net_weight_kg"], errors="coerce").fillna(0.0)

    ncm_detail = (
        detail.groupby(
            [
                "cadeia_estrategica",
                "mineral_base",
                "prioridade_transicao",
                "etapa_cadeia",
                "ncm",
                "descricao_ncm_hierarquica",
                "flow",
            ],
            as_index=False,
            dropna=False,
        )
        .agg(value_usd=("value_usd", "sum"), net_weight_kg=("net_weight_kg", "sum"))
        .sort_values(["cadeia_estrategica", "value_usd"], ascending=[True, False], kind="stable")
    )

    flow = (
        detail.groupby(["cadeia_estrategica", "mineral_base", "prioridade_transicao", "etapa_cadeia", "flow"], as_index=False)
        .agg(value_usd=("value_usd", "sum"), net_weight_kg=("net_weight_kg", "sum"), ncm_count=("ncm", "nunique"))
    )
    indicators = (
        flow.pivot_table(
            index=["cadeia_estrategica", "mineral_base", "prioridade_transicao", "etapa_cadeia"],
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
    indicators["export_share_trade"] = indicators["export_value_usd"] / indicators["trade_value_usd"].where(indicators["trade_value_usd"].ne(0))
    indicators = indicators.sort_values("trade_value_usd", ascending=False, kind="stable")

    chain = (
        indicators.groupby(["cadeia_estrategica", "mineral_base", "prioridade_transicao"], as_index=False)
        .agg(
            export_value_usd=("export_value_usd", "sum"),
            import_value_usd=("import_value_usd", "sum"),
            trade_value_usd=("trade_value_usd", "sum"),
            trade_balance_usd=("trade_balance_usd", "sum"),
        )
    )
    stage_pivot = indicators.pivot_table(
        index="cadeia_estrategica",
        columns="etapa_cadeia",
        values="trade_value_usd",
        aggfunc="sum",
        fill_value=0,
    ).reset_index()
    chain = chain.merge(stage_pivot, on="cadeia_estrategica", how="left")
    for column in ["mineral_primario", "quimico_material_processado", "metal_liga_semimanufaturado", "componente_bem_final"]:
        if column not in chain:
            chain[column] = 0.0
    chain["primary_share_trade"] = chain["mineral_primario"] / chain["trade_value_usd"].where(chain["trade_value_usd"].ne(0))
    chain["processed_downstream_share_trade"] = (
        chain["quimico_material_processado"] + chain["metal_liga_semimanufaturado"] + chain["componente_bem_final"]
    ) / chain["trade_value_usd"].where(chain["trade_value_usd"].ne(0))
    priority_weight = chain["prioridade_transicao"].map({"alta": 1.0, "media_alta": 0.75, "media": 0.5}).fillna(0.25)
    trade_rank = chain["trade_value_usd"].rank(pct=True)
    imbalance_rank = chain["trade_balance_usd"].abs().rank(pct=True)
    chain["priority_score"] = (0.45 * trade_rank + 0.25 * imbalance_rank + 0.30 * priority_weight).round(4)
    chain = chain.merge(criticality, on="mineral_base", how="left")
    chain["criticality_weight"] = chain["criticality_weight"].fillna(0.5)
    chain["strategic_score"] = (
        0.30 * trade_rank
        + 0.20 * imbalance_rank
        + 0.20 * priority_weight
        + 0.30 * chain["criticality_weight"]
    ).round(4)
    chain = chain.merge(
        seed[["cadeia_estrategica", "tecnologias_transicao", "direcao_adensamento", "racional"]].drop_duplicates("cadeia_estrategica"),
        on="cadeia_estrategica",
        how="left",
    )
    chain = chain.sort_values("strategic_score", ascending=False, kind="stable")
    chain.insert(0, "rank", range(1, len(chain) + 1))
    return seed, indicators, ncm_detail, chain, criticality


def money(value: float) -> str:
    return f"US$ {value / 1_000_000_000:,.2f} bi"


def write_report(chain: pd.DataFrame, ncm_detail: pd.DataFrame) -> None:
    lines = [
        "# Cadeias minerais estrategicas para transicao",
        "",
        "Camada analitica transversal ao mapeamento Prodlist/CNAE. A seed usa regras por NCM/prefixo e deve ser validada por especialistas; ela nao altera a ponte oficial CONCLA/IBGE.",
        "",
        "## Priorizacao",
        "",
        "| Rank | Cadeia | Score estratégico | Valor comercial | Saldo | Primario | Processado/jusante | Direcao de adensamento |",
        "| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for _, row in chain.head(12).iterrows():
        lines.append(
            f"| {int(row['rank'])} | {row['cadeia_estrategica']} | {row['strategic_score']:.3f} | "
            f"{money(row['trade_value_usd'])} | "
            f"{money(row['trade_balance_usd'])} | {row['primary_share_trade']:.1%} | "
            f"{row['processed_downstream_share_trade']:.1%} | {row['direcao_adensamento']} |"
        )
    lines.extend(["", "## Principais NCMs por cadeia", ""])
    for chain_name in chain["cadeia_estrategica"].head(10):
        subset = ncm_detail.loc[ncm_detail["cadeia_estrategica"].eq(chain_name)].sort_values("value_usd", ascending=False).head(5)
        lines.append(f"### {chain_name}")
        for _, row in subset.iterrows():
            lines.append(
                f"- {row['flow']} NCM {row['ncm']}: {money(row['value_usd'])}; "
                f"{row['etapa_cadeia']}; {row['descricao_ncm_hierarquica']}."
            )
        lines.append("")
    lines.extend(
        [
            "## Nota metodologica",
            "",
            "- `priority_score` combina valor comercial observado, desequilibrio comercial e prioridade de transicao.",
            "- `strategic_score` adiciona peso de criticidade global para nao invisibilizar terras raras, grafite e cobalto quando o comercio observado ainda e baixo.",
            "",
            "## Uso recomendado",
            "",
            "- Usar como modulo de oportunidade produtiva e complexidade economica, nao como correcao de NAO_MAPEADO.",
            "- Validar NCMs e etapas com geologia, industria e CONCLA/IBGE antes de usar em decisao publica.",
            "- Combinar valor comercial, dependencia de importacoes, saldo e posicao na cadeia para priorizar politica industrial.",
        ]
    )
    (OUTPUT_DIR / "relatorio_cadeias_minerais_estrategicas.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    seed, indicators, ncm_detail, chain, criticality = build_outputs()
    csv_options = {"index": False, "encoding": "utf-8-sig"}
    criticality.to_csv(OUTPUT_DIR / "referencia_criticidade_minerais.csv", **csv_options)
    seed.to_csv(OUTPUT_DIR / "ncm_cadeia_estrategica_minerais_seed.csv", **csv_options)
    indicators.to_csv(OUTPUT_DIR / "indicadores_cadeias_minerais_etapa.csv", **csv_options)
    ncm_detail.to_csv(OUTPUT_DIR / "drivers_cadeias_minerais_ncm.csv", **csv_options)
    chain.to_csv(OUTPUT_DIR / "priorizacao_cadeias_minerais_estrategicas.csv", **csv_options)
    write_report(chain, ncm_detail)
    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"files": {}}
    manifest.setdefault("files", {}).update(
        {
            "referencia_criticidade_minerais.csv": len(criticality),
            "ncm_cadeia_estrategica_minerais_seed.csv": len(seed),
            "indicadores_cadeias_minerais_etapa.csv": len(indicators),
            "drivers_cadeias_minerais_ncm.csv": len(ncm_detail),
            "priorizacao_cadeias_minerais_estrategicas.csv": len(chain),
            "relatorio_cadeias_minerais_estrategicas.md": None,
        }
    )
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
