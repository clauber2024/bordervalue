"""Generate the 4 per-chain methodology PDFs users can download from the
"Fontes e versões" panel (TechnicalDrawer.tsx).

Content is sourced from what's already true of the pipeline -- README.md,
DOCUMENTACAO_EXECUCAO.md, and the live AIPNET catalog/thresholds in
build_solar_sovereignty_metrics.py / build_sector_sovereignty_metrics.py /
components/SovereigntySankeyChart.tsx -- not invented for the document.

Output: public/metodologia/{chain}.pdf, served by Next.js as a static file
at /metodologia/{chain}.pdf.
"""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "public" / "metodologia"
API_BASE = "http://localhost:8001"

number = lambda v: f"{v:,.0f}".replace(",", ".")
usd = lambda v: f"US$ {v:,.0f}".replace(",", ".")


def fetch_chain(chain: str) -> dict:
    with urllib.request.urlopen(f"{API_BASE}/api/networks/sovereignty/inputs?chain={chain}", timeout=30) as r:
        return json.load(r)


STAGE_LABELS = {
    "extracao": "Extração", "processamento": "Processamento", "refinamento": "Refinamento",
    "componentes_avancados": "Componentes avançados", "produto_final": "Produto final",
    "base_mineral": "Base mineral", "reducao": "Redução", "aciaria": "Aciaria",
    "transformacao": "Transformação", "bens_transicao": "Bens da transição",
    "materias_primas": "Matérias-primas", "intermediarios": "Intermediários",
    "nitrogenados": "Nitrogenados", "fosfatados": "Fosfatados", "potassicos": "Potássicos",
    "formulacao": "Formulação", "insumos": "Insumos", "insumos_tecnologicos": "Insumos tecnológicos",
    "equipamentos": "Equipamentos", "molecula_principal": "Molécula principal",
    "derivados": "Derivados", "aplicacoes_finais": "Aplicações finais",
}

CHAIN_META = {
    "aco": {
        "title": "Aço e Materiais Estratégicos",
        "version": "1.0.0-aipnet-steel",
        "question": "Onde o Brasil já lidera (minério, aço bruto) e onde a siderurgia nacional ainda depende de "
                     "ligas e equipamentos importados?",
        "extra_sources": [
            ("BEN/EPE 2024 (Balanço Energético Nacional)", "Mix de redutor (coque fóssil vs. carvão vegetal) do "
             "setor Ferro-Gusa e Aço em escopo nacional, incluindo guseiros independentes não cobertos pelo IABr."),
            ("IABr 2024 (Instituto Aço Brasil)", "Fatores de emissão por rota de redução (coque fóssil vs. carvão "
             "vegetal), cobrindo usinas associadas ao IABr."),
            ("IBGE PEVS (SIDRA tabela 291)", "Produção da Extração Vegetal e da Silvicultura -- volume e valor da "
             "produção nacional de carvão vegetal, insumo sem código NCM próprio."),
        ],
        "notes": [
            "Ferro-nióbio, ferro-níquel, eletrodos de grafite, materiais refratários e ferroligas remanescentes "
            "estavam consolidados numa única cesta agregada (\"Ferroligas\") nas versões internas anteriores da "
            "modelagem, o que escondia saldos e riscos opostos sob um número só. Foram desmembrados nesta versão "
            "para expor cada sub-código.",
            "Carvão vegetal não tem código NCM próprio -- não cruza fronteira em volume comparável, então os "
            "campos de comércio exterior ficam zerados por desenho, não por ausência de dado real. A métrica vem "
            "do BEN/EPE e do IBGE PEVS, não do Comex Stat.",
        ],
    },
    "silicio": {
        "title": "Silício para Solar e Semicondutores",
        "version": "1.1.0-aipnet-solar",
        "question": "Onde o Brasil possui capacidade e onde está o estrangulamento tecnológico da cadeia solar?",
        "extra_sources": [
            ("IEA / associações setoriais", "Concentração global de capacidade de produção (ex.: >90% da produção "
             "mundial de wafers e polissilício grau solar na China) -- um dado estrutural, complementar à amostra "
             "de comércio exterior brasileira, usado quando a produção nacional é nula ou marginal."),
        ],
        "notes": [
            "O Brasil não refina polissilício grau solar, não cresce lingotes monocristalinos e não fabrica "
            "wafers ou células fotovoltaicas em escala industrial. Essas etapas são rastreadas pela concentração "
            "estrutural global (fonte setorial), não pela amostra de comércio do Brasil, que é pequena ou nula.",
            "A etapa de montagem final (módulos fotovoltaicos) concentra o maior valor de importação da cadeia "
            "inteira -- módulos prontos importados majoritariamente da China superam, em valor, a soma de todos "
            "os componentes de montagem importados separadamente.",
        ],
    },
    "fertilizantes": {
        "title": "Fertilizantes Estratégicos",
        "version": "1.0.0-aipnet-fertilizers",
        "question": "Quais nutrientes e intermediários químicos da cadeia de fertilizantes têm maior exposição "
                     "comercial externa?",
        "extra_sources": [],
        "notes": [
            "A cadeia de fertilizantes é estruturalmente importadora: cloreto de potássio (maior linha de "
            "importação da cadeia, sem produção doméstica de potássio em escala), sulfato de amônio (concentração "
            "de fornecedor único quase total) e os demais nutrientes nitrogenados/fosfatados têm déficit "
            "comercial relevante -- alguns com fornecedor diversificado, outros concentrados.",
            "A etapa de formulação e mistura (NPK), em contraste, tem dependência externa baixa: a granulação e "
            "mistura final são majoritariamente domésticas, mesmo partindo de intermediários importados.",
        ],
    },
    "combustiveis_transicao": {
        "title": "Combustíveis de Transição",
        "version": "1.0.0-aipnet-transition-fuels",
        "question": "Quais insumos importados da cadeia de combustíveis de baixo carbono têm maior dependência "
                     "no diagnóstico comercial?",
        "extra_sources": [
            ("IEA (International Energy Agency)", "Estimativa de concentração global de capacidade de fabricação "
             "de eletrolisadores (~60% na China) -- uma concentração geográfica publicada, não um HHI por "
             "empresa, usada como complemento à amostra brasileira de importação."),
        ],
        "notes": [
            "A NCM identifica moléculas, derivados, insumos, equipamentos e usos correlatos, mas não certifica "
            "rota de produção: não informa se o hidrogênio é renovável, eletrolítico, azul ou cinza, nem se a "
            "amônia, o metanol ou os biocombustíveis usam insumo de baixa emissão. Classificação ambiental exige "
            "bases complementares de projeto, planta, tecnologia e certificação.",
            "Etanol e biodiesel são a única rota da cadeia já consolidada em escala doméstica (agroindústria "
            "nacional, saldo comercial positivo). Hidrogênio, amônia e metanol dependem majoritariamente de "
            "produção ou insumo importado.",
        ],
    },
}

GENERIC_SOURCES = [
    ("Comex Stat / MDIC", "Exportações e importações por NCM de 8 dígitos, valor FOB e peso líquido.",
     "Jan-Jun 2026"),
    ("CONCLA / IBGE", "Correspondência oficial NCM x PRODLIST-Indústria, usada para ligar cada NCM à sua classe "
     "industrial.", "PRODLIST-Indústria 2025 (ponte); PIA-Produto na base PRODLIST 2022"),
    ("IBGE PIA-Produto (SIDRA)", "Valor da produção doméstica por produto PRODLIST, em mil R$.", "2024"),
    ("MTE RAIS", "Vínculos formais, massa salarial e remuneração por classe CNAE, UF e município.", "2024"),
]


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("CoverTitle", fontSize=26, leading=32, textColor=colors.HexColor("#0f172a"),
                               fontName="Helvetica-Bold", spaceAfter=6))
    styles.add(ParagraphStyle("CoverSubtitle", fontSize=15, leading=20, textColor=colors.HexColor("#475569"),
                               fontName="Helvetica", spaceAfter=4))
    styles.add(ParagraphStyle("CoverMeta", fontSize=10, leading=14, textColor=colors.HexColor("#64748b")))
    styles.add(ParagraphStyle("H1", fontSize=15, leading=19, textColor=colors.HexColor("#0f172a"),
                               fontName="Helvetica-Bold", spaceBefore=18, spaceAfter=8))
    styles.add(ParagraphStyle("H2", fontSize=11.5, leading=15, textColor=colors.HexColor("#1e293b"),
                               fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4))
    styles.add(ParagraphStyle("Body", fontSize=9.5, leading=14, textColor=colors.HexColor("#1e293b"),
                               spaceAfter=6))
    styles.add(ParagraphStyle("BodySmall", fontSize=8.5, leading=12.5, textColor=colors.HexColor("#475569")))
    styles.add(ParagraphStyle("TableCell", fontSize=8, leading=11, textColor=colors.HexColor("#1e293b")))
    styles.add(ParagraphStyle("TableHeader", fontSize=8, leading=11, textColor=colors.white,
                               fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle("Caption", fontSize=8, leading=11, textColor=colors.HexColor("#64748b"),
                               fontName="Helvetica-Oblique", spaceAfter=8))
    return styles


ACCENT = colors.HexColor("#0891b2")
HEADER_BG = colors.HexColor("#0f172a")
ROW_ALT = colors.HexColor("#f1f5f9")


def build_pdf(chain: str) -> Path:
    meta = CHAIN_META[chain]
    data = fetch_chain(chain)
    inputs = sorted(data["inputs"], key=lambda i: (STAGE_LABELS.get(i["stage"], i["stage"]), i["label"]))
    reference_period = data.get("reference_period", "2026-H1")

    styles = build_styles()
    out_path = OUTPUT_DIR / f"{chain}.pdf"
    doc = SimpleDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=2.2 * cm, rightMargin=2.2 * cm, topMargin=2.2 * cm, bottomMargin=2 * cm,
        title=f"Metodologia AIPNET · {meta['title']}", author="Border Value",
    )

    story = []

    # -- Cover -----------------------------------------------------------
    story.append(Spacer(1, 2 * cm))
    story.append(Paragraph("BORDER VALUE · AIPNET", ParagraphStyle(
        "Kicker", fontSize=10, textColor=ACCENT, fontName="Helvetica-Bold", spaceAfter=14)))
    story.append(Paragraph("Metodologia e Fontes de Dados", styles["CoverTitle"]))
    story.append(Paragraph(meta["title"], styles["CoverSubtitle"]))
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph(
        f"Versão da metodologia: <b>{meta['version']}</b><br/>"
        f"Recorte de comércio exterior: <b>{reference_period}</b><br/>"
        f"Insumos rastreados nesta cadeia: <b>{len(inputs)}</b>",
        styles["CoverMeta"]))
    story.append(Spacer(1, 1.2 * cm))
    story.append(Paragraph(f"<i>Pergunta de Estado que esta cadeia responde:</i><br/>“{meta['question']}”",
                            styles["Body"]))
    story.append(PageBreak())

    # -- O que é --------------------------------------------------------
    story.append(Paragraph("1. O que é a Plataforma Border Value / AIPNET", styles["H1"]))
    story.append(Paragraph(
        "O Border Value é um pipeline reprodutível que articula comércio exterior brasileiro (NCM de oito "
        "dígitos), a correspondência oficial NCM x PRODLIST-Indústria da CONCLA/IBGE, produção doméstica "
        "(PIA-Produto/IBGE) e emprego formal (RAIS/MTE) em uma única base analítica por classe CNAE. O AIPNET "
        "(Análise de Insumos e Produtos para a Nova Indústria) é a camada de diagnóstico de soberania produtiva "
        "construída sobre essa base: para cada cadeia prioritária da transição energética, identifica os "
        "insumos comercializados internacionalmente, calcula dependência externa e concentração de fornecedor, "
        "e sinaliza onde a produção nacional já é forte e onde há exposição a um número pequeno de países "
        "fornecedores.", styles["Body"]))
    story.append(Paragraph(
        "Este documento descreve as fontes, fórmulas e limites metodológicos usados especificamente na cadeia "
        f"<b>{meta['title']}</b>. A leitura executiva completa, com os números desta cadeia, fica na plataforma "
        "web; este PDF é a referência técnica de como esses números foram calculados.", styles["Body"]))

    # -- Fontes oficiais --------------------------------------------------
    story.append(Paragraph("2. Bases de dados oficiais utilizadas", styles["H1"]))
    src_rows = [[Paragraph("Fonte", styles["TableHeader"]), Paragraph("Conteúdo", styles["TableHeader"]),
                 Paragraph("Recorte", styles["TableHeader"])]]
    for name, desc, period in GENERIC_SOURCES:
        src_rows.append([Paragraph(f"<b>{name}</b>", styles["TableCell"]), Paragraph(desc, styles["TableCell"]),
                          Paragraph(period, styles["TableCell"])])
    for name, desc in meta["extra_sources"]:
        src_rows.append([Paragraph(f"<b>{name}</b>", styles["TableCell"]), Paragraph(desc, styles["TableCell"]),
                          Paragraph("--", styles["TableCell"])])
    src_table = Table(src_rows, colWidths=[4.3 * cm, 8.5 * cm, 3.4 * cm], repeatRows=1)
    src_table.setStyle(_table_style())
    story.append(src_table)
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "Fontes gerais (Comex Stat, CONCLA, PIA-Produto, RAIS) são comuns às 4 cadeias AIPNET. Fontes "
        "complementares são específicas desta cadeia, usadas onde a amostra de comércio exterior do Brasil é "
        "pequena, nula ou não isola a informação necessária (ex.: mix de rota produtiva, concentração global de "
        "capacidade).", styles["Caption"]))

    # -- Metodologia de cálculo -------------------------------------------
    story.append(Paragraph("3. Metodologia de cálculo", styles["H1"]))

    story.append(Paragraph("Dependência externa", styles["H2"]))
    story.append(Paragraph(
        "dependência externa = importações / (produção doméstica comparável + importações − exportações)",
        ParagraphStyle("Formula", fontName="Courier", fontSize=9, textColor=colors.HexColor("#0f172a"),
                        backColor=colors.HexColor("#f1f5f9"), borderPadding=6, spaceAfter=6)))
    story.append(Paragraph(
        "O denominador é o consumo aparente. Quando a produção doméstica está sob sigilo estatístico da "
        "PIA-Produto (marcador “X”) ou indisponível, o indicador não é calculado por estimativa -- "
        "fica marcado como não calculado, preservando a distinção entre “sigilo” e “dado "
        "ausente”.", styles["Body"]))

    story.append(Paragraph("Concentração de fornecedor (HHI)", styles["H2"]))
    story.append(Paragraph(
        "O Índice Herfindahl-Hirschman (HHI) soma o quadrado da participação percentual de cada país fornecedor "
        "nas importações do insumo. Varia de próximo de 0 (mercado fragmentado) a 10.000 (monopólio absoluto de "
        "um único fornecedor). Faixas de leitura usadas na plataforma:", styles["Body"]))
    hhi_rows = [
        [Paragraph("Faixa HHI", styles["TableHeader"]), Paragraph("Leitura", styles["TableHeader"])],
        [Paragraph("< 2.500", styles["TableCell"]), Paragraph("Risco controlado -- fornecedor diversificado",
                                                                styles["TableCell"])],
        [Paragraph("2.500 -- 5.000", styles["TableCell"]), Paragraph("Risco moderado", styles["TableCell"])],
        [Paragraph("5.000 -- 8.000", styles["TableCell"]), Paragraph("Risco moderado-alto", styles["TableCell"])],
        [Paragraph("≥ 8.000", styles["TableCell"]), Paragraph("Alto risco -- concentração próxima de "
                                                                    "monopólio", styles["TableCell"])],
    ]
    hhi_table = Table(hhi_rows, colWidths=[4 * cm, 12.2 * cm], repeatRows=1)
    hhi_table.setStyle(_table_style())
    story.append(hhi_table)
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("Limiar de concentração crítica (“chokepoint”)", styles["H2"]))
    story.append(Paragraph(
        "Um insumo é sinalizado como concentração crítica quando um único país responde por ≥ 90% das "
        "importações brasileiras desse insumo. Quando essa leitura vem apenas da amostra de importação do "
        "Brasil (não de uma participação global publicada por fonte setorial), ela só é considerada válida se a "
        "base de importação for igual ou superior a US$ 100 mil no período -- um piso de materialidade que "
        "evita que um único carregamento pequeno e estatisticamente irrelevante dispare um alerta de "
        "concentração sem significado real.", styles["Body"]))

    story.append(Paragraph("Rateio NCM → CNAE", styles["H2"]))
    story.append(Paragraph(
        "Quando uma NCM se vincula a mais de uma classe CNAE, o peso preferencial é o valor da produção "
        "observado na PIA-Produto para as CNAEs candidatas (<i>production_value_weighted_cnae</i>). Se a base "
        "econômica do grupo estiver ausente, incompleta ou não positiva, a NCM é dividida igualmente entre as "
        "CNAEs distintas (<i>equal_share_distinct_cnae</i>), como regra de reserva.", styles["Body"]))

    story.append(PageBreak())

    # -- Catálogo de insumos ----------------------------------------------
    story.append(Paragraph("4. Catálogo de insumos rastreados nesta cadeia", styles["H1"]))
    story.append(Paragraph(
        f"{len(inputs)} insumos comerciais, organizados por etapa produtiva. “Confiança” reflete o "
        "método de medição: <b>validada</b> (cesta de NCM mapeada e conferida), <b>estimada</b> (proxy, cesta "
        "aproximada ou multiuso).", styles["Body"]))
    cat_rows = [[Paragraph(h, styles["TableHeader"]) for h in
                 ["Insumo", "Etapa", "NCM", "Confiança"]]]
    for item in inputs:
        ncm_text = ", ".join(item["ncm_codes"]) if item["ncm_codes"] else "sem NCM próprio"
        cat_rows.append([
            Paragraph(item["label"], styles["TableCell"]),
            Paragraph(STAGE_LABELS.get(item["stage"], item["stage"]), styles["TableCell"]),
            Paragraph(ncm_text, ParagraphStyle("Mono", parent=styles["TableCell"], fontName="Courier", fontSize=7)),
            Paragraph(item["confidence_level"], styles["TableCell"]),
        ])
    cat_table = Table(cat_rows, colWidths=[4.5 * cm, 3 * cm, 6 * cm, 2.7 * cm], repeatRows=1)
    cat_table.setStyle(_table_style())
    story.append(cat_table)

    # -- Limitações --------------------------------------------------------
    story.append(Paragraph("5. Limitações e ressalvas conhecidas", styles["H1"]))
    story.append(Paragraph("Específicas desta cadeia", styles["H2"]))
    story.append(ListFlowable(
        [ListItem(Paragraph(note, styles["Body"]), leftIndent=10) for note in meta["notes"]],
        bulletType="bullet", start="•",
    ))
    story.append(Paragraph("Gerais do pipeline Border Value", styles["H2"]))
    general_limits = [
        "Sigilo estatístico da PIA-Produto: valores publicados como “X” são confidenciais. O pipeline "
        "não imputa, redistribui nem tenta reidentificar esses valores.",
        "Defasagem temporal entre fontes: o recorte de comércio exterior (2026) é combinado com produção "
        "doméstica PIA-Produto de 2024, a última oficialmente publicada -- as razões de dependência devem ser "
        "lidas como aproximação analítica, não medição contemporânea perfeita do mesmo período.",
        "Defasagem classificatória: NCM, PRODLIST-Indústria e correspondências CONCLA são publicadas em versões "
        "próprias; mudanças de versão podem alterar vínculos NCM-Prodlist-CNAE entre atualizações.",
        "Cobertura da ponte 1:N: quando uma NCM possui múltiplas CNAEs possíveis, o resultado depende da regra "
        "de rateio documentada na Seção 3 e deve ser interpretado como alocação analítica, não medição direta.",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(note, styles["Body"]), leftIndent=10) for note in general_limits],
        bulletType="bullet", start="•",
    ))

    # -- Rodapé de proveniência -------------------------------------------
    story.append(Spacer(1, 0.8 * cm))
    story.append(KeepTogether([
        Paragraph("6. Proveniência deste documento", styles["H1"]),
        Paragraph(
            f"Gerado a partir dos dados publicados da plataforma Border Value para a cadeia {meta['title']} "
            f"(metodologia {meta['version']}, recorte {reference_period}). Documento estático: reflete o estado "
            "da metodologia no momento da geração e deve ser substituído a cada atualização relevante da "
            "cadeia. Para os números vivos e atualizados, consulte a plataforma web.", styles["BodySmall"]),
    ]))

    doc.build(story)
    return out_path


def _table_style() -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for chain in CHAIN_META:
        path = build_pdf(chain)
        print(f"{chain}: {path} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
