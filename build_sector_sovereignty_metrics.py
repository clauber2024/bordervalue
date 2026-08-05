"""Generate auditable input-level sovereignty datasets for published non-solar chains.

The job reuses the official Comex, CONCLA NCM-PRODLIST, PIA, TSB and RAIS
loaders from the solar pipeline. Environmental attributes that NCM cannot
identify remain explicitly marked as proxies or complementary-source gaps.
"""

from __future__ import annotations

import json
from pathlib import Path

import build_solar_sovereignty_metrics as core


ROOT = Path(__file__).resolve().parent
Definition = core.SolarInputDefinition


CHAINS: dict[str, dict[str, object]] = {
    "combustiveis_transicao": {
        "version": "1.0.0-aipnet-transition-fuels",
        "definitions": (
            Definition("hidrogenio", "Hidrogênio", "molecula_principal", ("28041000",), "estimated", "media", "A NCM não distingue hidrogênio renovável, azul ou cinza.", None),
            Definition("amonia", "Amônia", "derivados", ("28141000", "28142000"), "estimated", "media", "A rota e a intensidade de emissões não são identificadas pela NCM.", None),
            Definition("metanol", "Metanol", "derivados", ("29051100",), "estimated", "media", "A NCM não separa metanol fóssil, biometanol e e-metanol.", None),
            Definition("etanol", "Etanol", "molecula_principal", ("22071010", "22071090", "22072010", "22072019"), "validated", "alta"),
            Definition("biodiesel", "Biodiesel", "molecula_principal", ("38260000",), "validated", "alta"),
            Definition("combustivel_aviacao", "Combustíveis de aviação / proxy SAF", "aplicacoes_finais", ("27101911",), "estimated", "baixa", "A NCM inclui querosene de aviação fóssil e não certifica SAF.", None),
            Definition("gas_natural_biometano", "Gás natural / proxy biometano", "insumos", ("27111100", "27112100"), "estimated", "baixa", "A NCM não separa gás natural fóssil de biometano.", None),
            Definition("enzimas", "Enzimas e biocatalisadores", "insumos_tecnologicos", ("35079011", "35079019", "35079021", "35079029", "35079039", "35079049"), "estimated", "baixa", "Cesta multipropósito; exige fator de uso em biocombustíveis.", None),
            Definition("catalisadores", "Catalisadores preparados", "insumos_tecnologicos", ("38151100", "38151210", "38151220", "38151900", "38159010", "38159090"), "estimated", "baixa", "Catalisadores atendem diversas cadeias químicas.", None),
            Definition("eletrolisadores", "Eletrolisadores / proxy de equipamentos", "equipamentos", ("85433000",), "estimated", "baixa", "Código multipropósito de máquinas eletrolíticas; requer homologação de uso.", 0.60),
        ),
        "comparable": {"etanol", "biodiesel", "metanol", "amonia"},
        "global_source": {
            "institution": "International Energy Agency (IEA)",
            "publication": "Global Hydrogen Review 2025",
            "url": "https://www.iea.org/reports/global-hydrogen-review-2025/executive-summary",
            "note": "A IEA informa cerca de 60% da capacidade mundial de fabricação de eletrolisadores na China. A evidência não classifica a origem ambiental das moléculas comercializadas.",
        },
        "complementary_sources": [
            {"source": "ANP/RenovaBio", "scope": "usinas, rotas, CBIO e intensidade de carbono", "status": "required"},
            {"source": "ANAC/CORSIA", "scope": "certificação, blend e rota de SAF", "status": "required"},
            {"source": "EPE/MME", "scope": "projetos, capacidade e matriz elétrica", "status": "complementary"},
            {"source": "IEA Global Hydrogen Review 2025", "scope": "capacidade global de eletrolisadores", "status": "published"},
        ],
    },
    "fertilizantes": {
        "version": "1.0.0-aipnet-fertilizers",
        "definitions": (
            Definition("gas_natural", "Gás natural", "materias_primas", ("27111100", "27112100"), "estimated", "media", "Uso como matéria-prima de fertilizantes não é isolado.", None),
            Definition("rocha_fosfatica", "Rocha fosfática", "materias_primas", ("25101010", "25101090", "25102010", "25102090"), "validated", "alta"),
            Definition("amonia", "Amônia", "intermediarios", ("28141000", "28142000"), "validated", "alta", None, 0.30),
            Definition("ureia", "Ureia fertilizante", "nitrogenados", ("31021010", "31021090"), "validated", "alta"),
            Definition("sulfato_amonio", "Sulfato de amônio", "nitrogenados", ("31022100", "31022910", "31022990"), "validated", "alta"),
            Definition("cloreto_potassio", "Cloreto de potássio", "potassicos", ("31042010", "31042090"), "validated", "alta"),
            Definition("fosfato_diamonico", "Fosfato diamônico (DAP)", "fosfatados", ("31053010", "31053090"), "validated", "alta"),
            Definition("fosfato_monoamonico", "Fosfato monoamônico (MAP)", "fosfatados", ("31054000",), "validated", "alta"),
            Definition("superfosfatos", "Superfosfatos", "fosfatados", ("31031100", "31031900"), "validated", "alta"),
            Definition("fertilizantes_npk", "Fertilizantes NPK", "formulacao", ("31052000",), "validated", "alta"),
        ),
        "comparable": {"amonia", "ureia", "sulfato_amonio", "cloreto_potassio", "fosfato_diamonico", "fosfato_monoamonico", "superfosfatos", "fertilizantes_npk"},
        "global_source": {
            "institution": "FAO / USGS / IEA",
            "publication": "FAOSTAT Fertilizers 2025; USGS MCS 2025; IEA Ammonia Technology Roadmap",
            "url": "https://www.fao.org/statistics/highlights-archive/highlights-detail/inorganic-fertilizers-2002-2023/",
            "note": "FAO cobre produção e comércio por nutriente; USGS cobre potássio e fosfato; IEA estima a China em 30% da produção global de amônia. Percentuais não são intercambiáveis entre produtos.",
        },
        "complementary_sources": [
            {"source": "FAOSTAT", "scope": "produção, uso e comércio mundial por nutriente", "status": "published"},
            {"source": "USGS Mineral Commodity Summaries 2025", "scope": "potássio e rocha fosfática", "status": "published"},
            {"source": "ANM/AMB", "scope": "produção mineral brasileira", "status": "complementary"},
            {"source": "ANDA", "scope": "entregas, importações e produção doméstica", "status": "required"},
        ],
    },
    "aco": {
        "version": "1.0.0-aipnet-steel",
        "definitions": (
            Definition("minerio_ferro", "Minério de ferro", "base_mineral", ("26011100", "26011200"), "validated", "alta"),
            Definition("sucata_ferrosa", "Sucata ferrosa", "base_mineral", ("72041000", "72042100", "72042900", "72043000", "72044100", "72044900"), "validated", "alta"),
            Definition("ferro_gusa", "Ferro-gusa", "reducao", ("72011000", "72012000", "72015000"), "validated", "alta"),
            Definition("ferro_esponja", "Ferro-esponja e redução direta", "reducao", ("72031000",), "validated", "alta"),
            Definition("ferroligas", "Ferroligas", "aciaria", ("72021100", "72021900", "72022100", "72022900", "72023000", "72024100", "72024900", "72026000", "72027000", "72028000", "72029100", "72029200", "72029300", "72029990"), "estimated", "media", "Cesta agrega várias ligas com funções técnicas distintas.", None),
            Definition("eletrodos_grafite", "Eletrodos de grafite", "aciaria", ("85451100",), "validated", "alta"),
            Definition("planos_quente", "Laminados planos a quente", "transformacao", ("72081000", "72082500", "72082610", "72082690", "72082710", "72082790", "72083610", "72083690", "72083700", "72083810", "72083890", "72083910", "72083990"), "validated", "alta"),
            Definition("planos_frios", "Laminados planos a frio", "transformacao", ("72091500", "72091600", "72091700", "72091800", "72092500", "72092600", "72092700", "72092800"), "validated", "alta"),
            Definition("tubos_aco", "Tubos de aço", "bens_transicao", ("73041100", "73041900", "73042110", "73042190", "73042910", "73042990", "73043110", "73043190", "73043910", "73043990"), "estimated", "media", "A cesta não isola usos em infraestrutura verde.", None),
            Definition("estruturas_aco", "Estruturas de aço", "bens_transicao", ("73081000", "73082000", "73083000", "73084000", "73089010", "73089090"), "estimated", "media", "Estruturas atendem usos energéticos e não energéticos.", None),
        ),
        "comparable": {"ferro_gusa", "ferro_esponja", "ferroligas", "eletrodos_grafite", "planos_quente", "planos_frios", "tubos_aco", "estruturas_aco"},
        "global_source": {
            "institution": "World Steel Association",
            "publication": "World Steel in Figures 2025",
            "url": "https://worldsteel.org/data/world-steel-in-figures/world-steel-in-figures-2025/",
            "note": "A China produziu 989 Mt de um total mundial de 1.837,7 Mt de aço bruto em 2024 (aprox. 53,8%). A participação não descreve cada liga ou produto transformado.",
        },
        "complementary_sources": [
            {"source": "World Steel Association", "scope": "produção global, rotas e distribuição geográfica", "status": "published"},
            {"source": "Instituto Aço Brasil", "scope": "produção, capacidade e utilização doméstica", "status": "required"},
            {"source": "ANM/AMB", "scope": "minério de ferro e produção mineral", "status": "complementary"},
            {"source": "IEA Iron and Steel Technology Roadmap", "scope": "rotas de descarbonização e tecnologias", "status": "complementary"},
        ],
    },
}


def build_chain(chain_name: str, config: dict[str, object]) -> dict[str, object]:
    definitions = tuple(config["definitions"])
    core.SOLAR_INPUTS = definitions
    core.PRODLIST_COMPARABLE_INPUTS = set(config["comparable"])
    definitions_by_ncm = {ncm: definition for definition in definitions for ncm in definition.ncm_codes}
    countries = core.load_countries()
    trade_rows = core.aggregate_trade(definitions_by_ncm)
    production = core.load_domestic_production(definitions_by_ncm)
    payload = core.build_payload(trade_rows, production, countries, {})
    payload.update({
        "chain_name": chain_name,
        "methodology_version": config["version"],
        "global_concentration_source": config["global_source"],
        "complementary_sources": config["complementary_sources"],
        "mineral_evidence": None,
    })
    payload["green_jobs"]["methodology_note"] = (
        "A TSB classifica atividades econômicas, não trabalhadores individualmente. "
        f"O total associado soma vínculos RAIS nas classes CNAE alcançadas pela cesta NCM da cadeia {chain_name}. "
        "A estimativa ponderada aplica a exposição TSB do setor SCN67 e deve ser lida como proxy, não como certificação ocupacional."
    )
    return payload


def main() -> None:
    summary: dict[str, object] = {}
    for chain_name, config in CHAINS.items():
        payload = build_chain(chain_name, config)
        output_dir = ROOT / "outputs" / f"sector_sovereignty_{chain_name}_2026"
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "sector_input_metrics.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        summary[chain_name] = {
            "inputs": len(payload["inputs"]),
            "mapped_prodlist": sum(bool(item["prodlist_codes"]) for item in payload["inputs"]),
            "tsb_cnae": payload["green_jobs"]["cnae_count"],
            "output": str(output_dir),
        }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
