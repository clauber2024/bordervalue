from __future__ import annotations

import json
import re
from html import unescape
from pathlib import Path

import pandas as pd


BASE = Path(__file__).resolve().parent
OFFICIAL = BASE / "outputs" / "official_2026"
FINAL = BASE / "outputs" / "final_border_value_2026"
NCM_JSON = BASE / "dados" / "cache" / "ncm_vigente.json"


def normalize_ncm(series: pd.Series) -> pd.Series:
    return (
        series.astype("string")
        .str.replace(r"\.0$", "", regex=True)
        .str.replace(r"\D", "", regex=True)
        .str.zfill(8)
    )


def clean_text(value: object) -> str:
    text = unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def ncm_descriptions() -> pd.DataFrame:
    data = json.loads(NCM_JSON.read_text(encoding="utf-8"))
    descriptions: dict[str, str] = {}
    for item in data.get("Nomenclaturas", []):
        code = re.sub(r"\D", "", str(item.get("Codigo", "")))
        text = clean_text(item.get("Descricao", ""))
        if code and text:
            descriptions[code] = text

    rows = []
    for code, text in descriptions.items():
        if len(code) != 8:
            continue
        hierarchy = []
        for prefix_len in (2, 4, 6, 8):
            part = descriptions.get(code[:prefix_len])
            if part and part not in hierarchy:
                hierarchy.append(part)
        rows.append(
            {
                "ncm": code,
                "descricao_ncm_oficial": text,
                "descricao_ncm_hierarquica_oficial": " > ".join(hierarchy),
            }
        )
    return pd.DataFrame(rows).drop_duplicates("ncm")


def chapter_family(ncm: str) -> str:
    chapter = int(ncm[:2])
    if chapter in {1, 3, 4, 5}:
        return "primario_animal_pesca"
    if chapter in {6, 7, 8, 9, 10, 12, 14}:
        return "primario_agricola"
    if chapter in {11, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24}:
        return "agroindustrial_alimentos_bebidas_tabaco"
    if chapter in {25, 26, 27}:
        return "extrativo_mineral_energetico"
    if chapter in {28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40}:
        return "insumos_industriais_quimicos_borracha"
    if chapter in {72, 73, 74, 75, 76, 78, 79, 80, 81, 82, 83}:
        return "metais_e_manufaturas"
    if chapter in {84, 85, 86, 87, 88, 89, 90}:
        return "bens_capital_transporte_eletroeletronicos"
    if chapter in {93}:
        return "armas_municoes"
    if chapter in {97}:
        return "objetos_arte_colecao"
    return "outros"


def build_trade() -> pd.DataFrame:
    trade = pd.read_csv(OFFICIAL / "fact_trade.csv", dtype={"ncm": "string"})
    trade["ncm"] = normalize_ncm(trade["ncm"])
    wide = trade.pivot_table(
        index="ncm",
        columns="flow",
        values=["value_usd", "net_weight_kg"],
        aggfunc="sum",
        fill_value=0,
    )
    wide.columns = [f"{metric.lower()}_{flow.lower()}" for metric, flow in wide.columns]
    wide = wide.reset_index()
    for col in ("value_usd_exp", "value_usd_imp", "net_weight_kg_exp", "net_weight_kg_imp"):
        if col not in wide.columns:
            wide[col] = 0
    wide["trade_value_usd"] = wide["value_usd_exp"] + wide["value_usd_imp"]
    wide["trade_balance_usd"] = wide["value_usd_exp"] - wide["value_usd_imp"]
    wide["import_share"] = wide["value_usd_imp"] / wide["trade_value_usd"].where(wide["trade_value_usd"] != 0)
    wide = wide.sort_values("trade_value_usd", ascending=False, kind="stable")
    wide["trade_rank_overall"] = range(1, len(wide) + 1)
    return wide


def build_bridge_summary() -> pd.DataFrame:
    bridge = pd.read_csv(OFFICIAL / "bridge_ncm_prodlist_cnae.csv", dtype={"ncm": "string", "cnae_class": "string"})
    bridge["ncm"] = normalize_ncm(bridge["ncm"])
    cnae = pd.read_csv(FINAL / "border_value_indicadores_finais_cnae.csv", dtype={"cnae_class": "string"})
    cnae_cols = cnae[["cnae_class", "domestic_production_status", "domestic_production_is_confidential"]].drop_duplicates()
    bridge = bridge.merge(cnae_cols, on="cnae_class", how="left")

    def join_unique(values: pd.Series) -> str:
        items = sorted({str(v) for v in values.dropna() if str(v) and str(v) != "nan"})
        return ";".join(items)

    grouped = (
        bridge.groupby("ncm", as_index=False)
        .agg(
            cnae_set=("cnae_class", join_unique),
            prodlist_set=("prodlist_code", join_unique),
            allocation_rules=("allocation_rule", join_unique),
            allocation_basis_status=("allocation_basis_status", join_unique),
            domestic_production_status_set=("domestic_production_status", join_unique),
            has_confidential_pia=("domestic_production_is_confidential", lambda s: bool(s.fillna(False).astype(bool).any())),
        )
    )
    grouped["has_official_bridge"] = True
    return grouped


def build_transition_summary() -> pd.DataFrame:
    drivers = pd.read_csv(FINAL / "drivers_combustiveis_transicao_ncm.csv", dtype={"ncm": "string"})
    drivers["ncm"] = normalize_ncm(drivers["ncm"])

    def join_unique(values: pd.Series) -> str:
        items = sorted({str(v) for v in values.dropna() if str(v) and str(v) != "nan"})
        return ";".join(items)

    return (
        drivers.groupby("ncm", as_index=False)
        .agg(
            recorte_transicao=("recorte_combustivel", join_unique),
            camada_transicao=("camada_analitica", join_unique),
            papel_transicao=("papel_no_recorte", join_unique),
            valor_transicao_usd=("value_usd", "sum"),
        )
    )


def suggested_decision(row: pd.Series) -> tuple[str, str, str, str, str]:
    family = row["familia_produto"]
    is_unmatched = bool(row["sem_ponte_oficial"])
    is_generic = bool(row["is_generic_code"])
    transition = bool(row["recorte_transicao"])
    description = f"{row['descricao_ncm_hierarquica']}".lower()
    basis_status = f"{row['allocation_basis_status']} {row['domestic_production_status_set']}".lower()

    if is_unmatched and family in {"primario_agricola", "primario_animal_pesca", "objetos_arte_colecao"}:
        return (
            "Excluir",
            "Manter fora da versão pública como item industrial mapeado; preservar linha como NCM_SEM_PONTE auditado.",
            "Código sem ponte oficial e com perfil de produto primário ou fora do escopo PRODLIST-Indústria; não há base defensável para criar CNAE industrial por inferência.",
            "published_exclude_industrial_mapping_keep_audit_metadata",
            "Não aplicável até eventual decisão explícita de ponte; RAIS pode documentar atividade territorial primária separada da camada industrial.",
        )

    if is_unmatched:
        return (
            "Revisar",
            "Submeter a validação CONCLA/IBGE e especialista antes de qualquer publicação setorial.",
            "Código sem ponte oficial, mas com família potencialmente industrial ou ambígua; publicação como indicador industrial exigiria override documentado.",
            "published_hold_pending_manual_bridge_decision",
            "Não aplicável enquanto não houver CNAE candidata; se houver override, calibrar com RAIS quando PIA estiver sigilosa ou ausente.",
        )

    if is_generic and transition:
        return (
            "Ressalva",
            "Publicar apenas com nota de heterogeneidade e sem inferir uso final, rota verde ou baixa emissão pela NCM.",
            "Código genérico usado em recorte de transição; pode misturar produtos, usos finais e rotas tecnológicas distintas.",
            "published_with_transition_scope_warning",
            "Se a PIA da CNAE estiver sigilosa/ausente, usar RAIS por CNAE/município como proxy de calibração do rateio 1:N e manter status metodológico.",
        )

    if is_generic and ("outro" in description or "outra" in description or "outros" in description or "outras" in description):
        return (
            "Ressalva",
            "Publicar com marcação de NCM genérica e exigir validação para conclusões finas por produto.",
            "Apesar de possuir ponte oficial, a descrição residual sugere heterogeneidade; o indicador setorial é utilizável, mas não deve ser lido como produto específico.",
            "published_with_generic_ncm_warning",
            "Se houver PIA sigilosa/ausente no conjunto CNAE, acionar proxy RAIS local como salvaguarda do rateio e registrar limitação.",
        )

    if transition:
        return (
            "Ressalva",
            "Publicar como produto relacionado à transição, mantendo separação entre produto, insumo, equipamento, aplicação e rota.",
            "A NCM está em recorte de transição, mas não certifica intensidade de emissão, origem energética ou elegibilidade ambiental.",
            "published_transition_related_not_green_certified",
            "RAIS deve ser usada para territorializar emprego setorial; se a PIA estiver sigilosa/ausente, proxy RAIS ajuda a calibrar leitura produtiva.",
        )

    if "confidential" in basis_status or "missing" in basis_status or "unavailable" in basis_status:
        return (
            "Ressalva",
            "Publicar indicador comercial/setorial, mas não calcular dependência externa conclusiva sem produção doméstica válida.",
            "A ponte existe, porém a base produtiva tem sigilo, ausência ou incompletude; decisão pública deve diferenciar exposição comercial de dependência real.",
            "published_with_pia_status_warning",
            "Ativar proxy RAIS por CNAE/município para calibrar rateio 1:N e orientar territorialização enquanto PIA estiver protegida.",
        )

    return (
        "Aprovado",
        "Manter na camada Published com metadados normais de ponte, rateio e auditoria.",
        "Código com ponte oficial e sem alerta adicional de sigilo, genericidade ou transição no recorte auditado.",
        "published_standard",
        "RAIS usada como enriquecimento territorial, não como substituto da PIA.",
    )


def priority(row: pd.Series) -> str:
    if row["trade_rank_overall"] <= 50 or row["sem_ponte_rank"] <= 50:
        return "Alta"
    if bool(row["recorte_transicao"]) or row["trade_rank_overall"] <= 250:
        return "Média"
    return "Baixa"


def main() -> None:
    trade = build_trade()
    desc = ncm_descriptions()
    bridge = build_bridge_summary()
    transition = build_transition_summary()

    dim = pd.read_csv(OFFICIAL / "dim_ncm.csv", dtype={"ncm": "string"})
    dim["ncm"] = normalize_ncm(dim["ncm"])
    dim = dim[["ncm", "is_generic_code"]].drop_duplicates("ncm")

    unmatched = pd.read_csv(FINAL / "ncm_sem_ponte_priorizacao.csv", dtype={"ncm": "string"})
    unmatched["ncm"] = normalize_ncm(unmatched["ncm"])
    unmatched = unmatched[["ncm", "rank", "familia_produto", "nao_mapeado_subbucket", "diagnostico_preliminar"]].rename(
        columns={"rank": "sem_ponte_rank"}
    )
    unmatched["sem_ponte_oficial"] = True

    audit = trade.merge(dim, on="ncm", how="left")
    audit = audit.merge(desc, on="ncm", how="left")
    audit = audit.merge(bridge, on="ncm", how="left")
    audit = audit.merge(unmatched, on="ncm", how="left")
    audit = audit.merge(transition, on="ncm", how="left")

    audit["is_generic_code"] = audit["is_generic_code"].fillna(False).astype(bool)
    audit["sem_ponte_oficial"] = audit["sem_ponte_oficial"].fillna(False).astype(bool)
    audit["has_official_bridge"] = audit["has_official_bridge"].fillna(False).astype(bool)
    audit["familia_produto"] = audit["familia_produto"].fillna(audit["ncm"].map(chapter_family))
    audit["nao_mapeado_subbucket"] = audit["nao_mapeado_subbucket"].fillna("")
    audit["diagnostico_preliminar"] = audit["diagnostico_preliminar"].fillna("")
    audit["recorte_transicao"] = audit["recorte_transicao"].fillna("")
    audit["camada_transicao"] = audit["camada_transicao"].fillna("")
    audit["papel_transicao"] = audit["papel_transicao"].fillna("")
    audit["valor_transicao_usd"] = audit["valor_transicao_usd"].fillna(0)
    audit["allocation_rules"] = audit["allocation_rules"].fillna("")
    audit["allocation_basis_status"] = audit["allocation_basis_status"].fillna("")
    audit["domestic_production_status_set"] = audit["domestic_production_status_set"].fillna("")
    audit["has_confidential_pia"] = audit["has_confidential_pia"].fillna(False).astype(bool)
    audit["cnae_set"] = audit["cnae_set"].fillna("NAO_MAPEADO")
    audit["prodlist_set"] = audit["prodlist_set"].fillna("NCM_SEM_PONTE")
    audit["sem_ponte_rank"] = audit["sem_ponte_rank"].fillna(999999).astype(int)
    audit["descricao_ncm"] = audit["descricao_ncm_oficial"].fillna("")
    audit["descricao_ncm_hierarquica"] = audit["descricao_ncm_hierarquica_oficial"].fillna("")

    scoped = audit[audit["sem_ponte_oficial"] | audit["is_generic_code"] | (audit["recorte_transicao"] != "")].copy()
    scoped["prioridade_revisao"] = scoped.apply(priority, axis=1)
    decisions = scoped.apply(suggested_decision, axis=1, result_type="expand")
    decisions.columns = [
        "decisao_sugerida",
        "acao_recomendada",
        "justificativa_sugerida",
        "published_audit_action",
        "salvaguarda_pia_rais",
    ]
    scoped = pd.concat([scoped, decisions], axis=1)

    scoped["tema_auditoria"] = scoped.apply(
        lambda r: ";".join(
            item
            for item, cond in [
                ("sem_ponte_oficial", bool(r["sem_ponte_oficial"])),
                ("ncm_generica_9_90_99", bool(r["is_generic_code"])),
                ("recorte_transicao", bool(r["recorte_transicao"])),
                ("pia_sigilosa_ou_ausente", "confidential" in f"{r['allocation_basis_status']} {r['domestic_production_status_set']}".lower() or "missing" in f"{r['allocation_basis_status']} {r['domestic_production_status_set']}".lower()),
            ]
            if cond
        ),
        axis=1,
    )

    scoped = scoped.sort_values(
        ["prioridade_revisao", "trade_value_usd"],
        ascending=[True, False],
        key=lambda s: s.map({"Alta": 0, "Média": 1, "Baixa": 2}).fillna(s) if s.name == "prioridade_revisao" else s,
        kind="stable",
    ).reset_index(drop=True)
    scoped["audit_id"] = [f"NCM-AUD-{i:04d}" for i in range(1, len(scoped) + 1)]

    columns = [
        "audit_id",
        "prioridade_revisao",
        "tema_auditoria",
        "ncm",
        "descricao_ncm",
        "descricao_ncm_hierarquica",
        "trade_rank_overall",
        "sem_ponte_rank",
        "trade_value_usd",
        "value_usd_imp",
        "value_usd_exp",
        "trade_balance_usd",
        "import_share",
        "is_generic_code",
        "sem_ponte_oficial",
        "has_official_bridge",
        "familia_produto",
        "nao_mapeado_subbucket",
        "diagnostico_preliminar",
        "cnae_set",
        "prodlist_set",
        "allocation_rules",
        "allocation_basis_status",
        "domestic_production_status_set",
        "has_confidential_pia",
        "recorte_transicao",
        "camada_transicao",
        "papel_transicao",
        "valor_transicao_usd",
        "decisao_sugerida",
        "acao_recomendada",
        "justificativa_sugerida",
        "published_audit_action",
        "salvaguarda_pia_rais",
        "decisao_especialista",
        "justificativa_especialista",
        "fonte_complementar",
        "responsavel",
        "data_decisao",
    ]
    for col in columns:
        if col not in scoped.columns:
            scoped[col] = ""
    output_csv = FINAL / "matriz_auditoria_published_ncm.csv"
    scoped[columns].to_csv(output_csv, index=False, encoding="utf-8-sig")

    summary = {
        "linhas_matriz": int(len(scoped)),
        "ncm_sem_ponte": int(scoped["sem_ponte_oficial"].sum()),
        "ncm_genericos": int(scoped["is_generic_code"].sum()),
        "ncm_recorte_transicao": int((scoped["recorte_transicao"] != "").sum()),
        "decisoes_sugeridas": scoped["decisao_sugerida"].value_counts().to_dict(),
        "valor_total_auditado_usd": float(scoped["trade_value_usd"].sum()),
    }
    (FINAL / "matriz_auditoria_published_ncm_resumo.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    by_decision = scoped.groupby("decisao_sugerida", as_index=False).agg(
        ncms=("ncm", "nunique"),
        valor_usd=("trade_value_usd", "sum"),
    )
    by_theme = (
        scoped.assign(
            sem_ponte=scoped["sem_ponte_oficial"].map({True: "sim", False: "nao"}),
            generico=scoped["is_generic_code"].map({True: "sim", False: "nao"}),
            transicao=(scoped["recorte_transicao"] != "").map({True: "sim", False: "nao"}),
        )
        .groupby(["sem_ponte", "generico", "transicao"], as_index=False)
        .agg(ncms=("ncm", "nunique"), valor_usd=("trade_value_usd", "sum"))
        .sort_values("valor_usd", ascending=False)
    )

    def money(v: float) -> str:
        if abs(v) >= 1_000_000_000:
            return f"US$ {v / 1_000_000_000:,.2f} bi"
        return f"US$ {v / 1_000_000:,.1f} mi"

    lines = [
        "# Matriz de auditoria NCM para metadados Published",
        "",
        "Esta matriz transforma a Etapa 4 do plano operacional em uma fila de metadados publicáveis. Ela cobre a união de NCMs sem ponte oficial, NCMs genéricas terminadas em 9/90/99 e NCMs dos recortes de transição energética.",
        "",
        "## Resumo",
        "",
        f"- Linhas na matriz: {summary['linhas_matriz']:,}.",
        f"- NCMs sem ponte oficial incluídas: {summary['ncm_sem_ponte']:,}.",
        f"- NCMs genéricas incluídas: {summary['ncm_genericos']:,}.",
        f"- NCMs em recortes de transição incluídas: {summary['ncm_recorte_transicao']:,}.",
        f"- Valor comercial auditado: {money(summary['valor_total_auditado_usd'])}.",
        "",
        "## Decisões sugeridas",
        "",
        "| Decisão sugerida | NCMs | Valor comercial |",
        "|---|---:|---:|",
    ]
    for _, row in by_decision.sort_values("valor_usd", ascending=False).iterrows():
        lines.append(f"| {row['decisao_sugerida']} | {int(row['ncms']):,} | {money(row['valor_usd'])} |")

    lines.extend(["", "## Combinações de tema", "", "| Sem ponte | Genérico | Transição | NCMs | Valor comercial |", "|---|---|---|---:|---:|"])
    for _, row in by_theme.iterrows():
        lines.append(
            f"| {row['sem_ponte']} | {row['generico']} | {row['transicao']} | {int(row['ncms']):,} | {money(row['valor_usd'])} |"
        )

    top = scoped.head(20)
    lines.extend(
        [
            "",
            "## Primeiros 20 itens para revisão",
            "",
            "| ID | NCM | Prioridade | Temas | Valor | Decisão sugerida | Justificativa curta |",
            "|---|---|---|---|---:|---|---|",
        ]
    )
    for _, row in top.iterrows():
        justification = str(row["justificativa_sugerida"]).replace("|", "/")
        if len(justification) > 180:
            justification = justification[:177] + "..."
        lines.append(
            f"| {row['audit_id']} | {row['ncm']} | {row['prioridade_revisao']} | {row['tema_auditoria']} | {money(row['trade_value_usd'])} | {row['decisao_sugerida']} | {justification} |"
        )

    lines.extend(
        [
            "",
            "## Como fechar o loop Published",
            "",
            "- O especialista preenche `decisao_especialista`, `justificativa_especialista`, `fonte_complementar`, `responsavel` e `data_decisao`.",
            "- A camada Published consome `published_audit_action` para decidir se a NCM entra como indicador padrão, indicador com ressalva, item retido para revisão ou item excluído da publicação industrial.",
            "- `salvaguarda_pia_rais` registra quando a RAIS deve calibrar o rateio 1:N em situações de PIA sigilosa, ausente ou incompleta.",
            "- Nenhum override de ponte deve ser promovido sem fonte oficial ou validação especialista rastreável.",
        ]
    )
    (FINAL / "matriz_auditoria_published_ncm_resumo.md").write_text("\n".join(lines), encoding="utf-8")

    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
