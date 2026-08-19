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
StrategicProfile = core.StrategicProfile
TerritorialContext = core.TerritorialContext
TerritorialIndicator = core.TerritorialIndicator
TerritorialSource = core.TerritorialSource


# Populated only where a source was actually checked (see research trail in
# this session) -- fields left as None below have no verified current value
# and must not be guessed. Attached to ferro_esponja's strategic_profile
# because the DRI/green-hydrogen route it describes is concretely anchored
# in the Porto do Pecém green-hydrogen/green-steel hub, not a generic
# national claim.
TERRITORIAL_CONTEXT_CE = TerritorialContext(
    region_code="CE",
    region_name="Ceará",
    region_level="uf",
    updated_at="2026-08-18",
    industrial_capacity=None,
    solar_potential=TerritorialIndicator(
        value=5.7,
        unit="kWh/m²/dia (irradiação global horizontal, média estadual)",
        source=TerritorialSource(
            institution="INPE/LABREN",
            dataset="Atlas Brasileiro de Energia Solar, 2ª edição",
            url="https://labren.ccst.inpe.br/atlas_2017_CE.html",
            reference_period="2017",
            status="published",
        ),
    ),
    wind_potential=TerritorialIndicator(
        value=10.0,
        unit="m/s (faixa litorânea, ex. Acaraú/Barroquinha; não é média estadual)",
        source=TerritorialSource(
            institution="UFC (Repositório Institucional)",
            dataset="Análise estatística da velocidade de vento do Estado do Ceará",
            url="https://repositorio.ufc.br/bitstream/riufc/56544/1/2008_art_hncamelo.pdf",
            reference_period="2008 (estudo com base em séries INMET)",
            status="published",
        ),
        note="Pontos litorâneos chegam a >10 m/s; áreas serranas (ex. Ubajara) e offshore ficam acima de 8 m/s. Não existe uma média estadual única publicada -- reportar um só número mascararia essa variação.",
    ),
    port_infrastructure=TerritorialIndicator(
        value=20_961_514,
        unit="toneladas movimentadas em 2025 (Porto do Pecém)",
        source=TerritorialSource(
            institution="ANTAQ",
            dataset="Estatístico Aquaviário (divulgado via Governo do Ceará/SDE)",
            url="https://www.ceara.gov.br/2026/02/24/porto-do-pecem-bate-recorde-na-movimentacao-de-conteineres-alcanca-209-milhoes-de-toneladas-e-cresce-7-em-2025/",
            reference_period="2025",
            status="published",
        ),
        note="+7% em relação a 2024; inclui recorde de 706.509 TEUs em contêineres (+27%).",
    ),
    rail_infrastructure=TerritorialIndicator(
        value=609,
        unit="km de malha concessionada (Transnordestina) no Ceará",
        source=TerritorialSource(
            institution="ANTT",
            dataset="Concessão Transnordestina Logística",
            url="https://www.gov.br/antt/pt-br/assuntos/ultimas-noticias/transnordestina-avanca-no-ceara-e-vai-ampliar-mais-101-km-de-sua-rede-em-direcao-ao-porto-do-pecem",
            reference_period="2026",
            status="published",
        ),
        note="Trecho cearense da concessão; expansão de mais 101 km em direção ao Porto do Pecém anunciada, ainda não concluída.",
    ),
    industrial_electricity_consumption=None,
    water_availability=TerritorialIndicator(
        value=40.64,
        unit="% da capacidade acumulada nos reservatórios monitorados (fim de 2025)",
        source=TerritorialSource(
            institution="Cogerh (Companhia de Gestão dos Recursos Hídricos do Ceará)",
            dataset="Boletim de acompanhamento de reservatórios",
            url="https://gcmais.com.br/noticias/2025/12/23/ceara-encerra-o-ano-com-406-da-capacidade-hidrica-acumulada-nos-reservatorios-diz-cogerh/",
            reference_period="dezembro/2025",
            status="published",
        ),
        note="~18,4 bilhões de m³; distribuição desigual -- 37 açudes abaixo de 30% da capacidade enquanto o Cinturão das Águas (91% executado) integra o PISF aos reservatórios estratégicos.",
    ),
    environmental_licensing_lead_time_months=TerritorialIndicator(
        value=6,
        unit="meses (teto regulamentar máximo)",
        source=TerritorialSource(
            institution="SEMACE/COEMA-CE",
            dataset="Resolução COEMA -- prazos de análise por modalidade de licença",
            url="https://www.semace.ce.gov.br/",
            reference_period="vigente em 2026",
            status="published",
        ),
        note="É o teto regulamentar (prazo máximo até deferimento/indeferimento), ressalvados casos com EIA/RIMA ou audiência pública -- não é o prazo médio efetivamente observado, que não foi localizado nesta pesquisa.",
    ),
)


CHAINS: dict[str, dict[str, object]] = {
    "combustiveis_transicao": {
        "version": "1.0.0-aipnet-transition-fuels",
        "definitions": (
            Definition("hidrogenio", "Hidrogênio", "molecula_principal", ("28041000",), "estimated", "media", "A NCM não distingue hidrogênio renovável, azul ou cinza.", None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Mesma base do hidrogênio de alta pureza: rota cinza (reforma a vapor de gás natural) domina globalmente."),
            Definition("amonia", "Amônia", "derivados", ("28141000", "28142000"), "estimated", "media", "A rota e a intensidade de emissões não são identificadas pela NCM.", None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Haber-Bosch via gás natural é a rota de cerca de 98% da amônia mundial (IEA Ammonia Technology Roadmap)."),
            Definition("metanol", "Metanol", "derivados", ("29051100",), "estimated", "media", "A NCM não separa metanol fóssil, biometanol e e-metanol.", None,
                       production_route_class="untapped_potential",
                       production_route_rationale="Rota fóssil (gás natural/carvão) domina hoje; bio-metanol e e-metanol existem tecnicamente mas são marginais no comércio."),
            Definition("etanol", "Etanol", "molecula_principal", ("22071010", "22071090", "22072011", "22072019"), "validated", "alta",
                       production_route_class="low_carbon_dominant",
                       production_route_rationale="Fermentação de cana no Brasil, com cogeração a bagaço -- rota já renovável e consolidada."),
            Definition("biodiesel", "Biodiesel", "molecula_principal", ("38260000",), "validated", "alta",
                       production_route_class="low_carbon_dominant",
                       production_route_rationale="Transesterificação de óleos vegetais/gordura animal -- rota renovável estabelecida."),
            Definition("combustivel_aviacao", "Combustíveis de aviação / proxy SAF", "aplicacoes_finais", ("27101911",), "estimated", "baixa", "A NCM inclui querosene de aviação fóssil e não certifica SAF.", None,
                       production_route_class="untapped_potential",
                       production_route_rationale="Querosene de aviação fóssil domina o comércio; SAF é tecnicamente maduro mas é menos de 1% do volume global e a NCM não certifica a diferença."),
            Definition("gas_natural_biometano", "Gás natural / proxy biometano", "insumos", ("27111100", "27112100"), "estimated", "baixa", "A NCM não separa gás natural fóssil de biometano.", None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Gás natural fóssil domina o volume comercializado; biometano é fração marginal e a NCM não separa."),
            Definition("enzimas", "Enzimas e biocatalisadores", "insumos_tecnologicos", ("35079011", "35079019", "35079021", "35079029", "35079039", "35079049"), "estimated", "baixa", "Cesta multipropósito; exige fator de uso em biocombustíveis.", None,
                       production_route_class="low_carbon_dominant",
                       production_route_rationale="Produção via fermentação microbiana com feedstocks biológicos (açúcares) -- processo biotecnológico, não fóssil."),
            Definition("catalisadores", "Catalisadores preparados", "insumos_tecnologicos", ("38151100", "38151210", "38151220", "38151900", "38159010", "38159099"), "estimated", "baixa", "Catalisadores atendem diversas cadeias químicas.", None,
                       production_route_class="undetermined",
                       production_route_rationale="Cesta multipropósito de síntese química/cerâmica diversa; sem rota energética dominante única defensável com as fontes hoje disponíveis."),
            Definition("eletrolisadores", "Eletrolisadores / proxy de equipamentos", "equipamentos", ("85433010", "85433090"), "estimated", "baixa", "Código multipropósito de máquinas eletrolíticas; requer homologação de uso.", 0.60,
                       production_route_class="undetermined",
                       production_route_rationale="É equipamento habilitador, não uma molécula/energia em si; a fabricação usa eletricidade industrial convencional, sem uma rota de origem que se encaixe nas demais categorias."),
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
        "version": "1.1.0-aipnet-fertilizers",
        "definitions": (
            Definition("gas_natural", "Gás natural", "materias_primas", ("27111100", "27112100"), "estimated", "media", "Uso como matéria-prima de fertilizantes não é isolado.", None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Gás natural como matéria-prima é literalmente fóssil."),
            Definition("rocha_fosfatica", "Rocha fosfática", "materias_primas", ("25101010", "25101090", "25102010", "25102090"), "validated", "alta",
                       production_route_class="low_carbon_dominant",
                       production_route_rationale="Mineração e beneficiamento físico, sem feedstock fóssil relevante."),
            Definition("enxofre", "Enxofre bruto", "materias_primas", ("25030010", "25030090"), "estimated", "media", "Uso como insumo de fertilizantes não é isolado -- a NCM também cobre enxofre destinado a mineração, petroquímica e vulcanização de borracha.", None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="A maior parte do enxofre elementar comercializado é subproduto da dessulfurização de petróleo e gás natural (processo Claus)."),
            Definition("amonia", "Amônia", "intermediarios", ("28141000", "28142000"), "validated", "alta", None, 0.30,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Haber-Bosch via gás natural é a rota dominante mundialmente."),
            Definition("acido_fosforico", "Ácido fosfórico", "intermediarios", ("28092011", "28092019"), "estimated", "media", "Uso como insumo de fertilizantes não é isolado -- a NCM também cobre ácido fosfórico grau alimentício/industrial (bebidas, detergentes, tratamento de água).", None,
                       production_route_class="transition_underway",
                       production_route_rationale="Rocha fosfática (mineral) + ácido sulfúrico (rota úmida); o enxofre do ácido sulfúrico é frequentemente subproduto fóssil, mas o processo em si não depende de combustão direta."),
            Definition("acido_sulfurico", "Ácido sulfúrico", "intermediarios", ("28070010", "28070020"), "estimated", "media", "Uso como insumo de fertilizantes não é isolado -- a NCM também cobre ácido sulfúrico destinado a mineração, metalurgia e baterias.", None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Produzido majoritariamente a partir de enxofre subproduto de petróleo/gás; herda a rota fóssil do enxofre."),
            Definition("ureia", "Ureia fertilizante", "nitrogenados", ("31021010", "31021090"), "validated", "alta",
                       production_route_class="fossil_dominant",
                       production_route_rationale="Sintetizada a partir de amônia + CO2; herda a rota fóssil da amônia."),
            Definition("sulfato_amonio", "Sulfato de amônio", "nitrogenados", ("31022100", "31022910", "31022990"), "validated", "alta",
                       production_route_class="fossil_dominant",
                       production_route_rationale="Produzido a partir de amônia + ácido sulfúrico; herda a rota fóssil da amônia."),
            Definition("nitrato_amonio", "Nitrato de amônio", "nitrogenados", ("31023000",), "estimated", "media", "Uso como fertilizante não é isolado -- o mesmo NCM cobre nitrato de amônio grau explosivo (ANFO), amplamente usado na mineração brasileira.", None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Produzido a partir de amônia + ácido nítrico; herda a rota fóssil da amônia."),
            Definition("uan", "UAN -- solução de ureia e nitrato de amônio", "nitrogenados", ("31028000",), "validated", "alta",
                       production_route_class="fossil_dominant",
                       production_route_rationale="Mistura de ureia e nitrato de amônio em solução; ambos herdam a rota fóssil da amônia."),
            Definition("cloreto_potassio", "Cloreto de potássio", "potassicos", ("31042010", "31042090"), "validated", "alta",
                       production_route_class="low_carbon_dominant",
                       production_route_rationale="Mineração de silvinita/carnalita e evaporação -- extração mineral, sem feedstock fóssil central."),
            Definition("sulfato_potassio", "Sulfato de potássio", "potassicos", ("31043010", "31043090"), "validated", "alta",
                       production_route_class="low_carbon_dominant",
                       production_route_rationale="Mineração e processamento (a partir de cloreto de potássio ou sais duplos) -- extração mineral, sem feedstock fóssil central."),
            Definition("fosfato_diamonico", "Fosfato diamônico (DAP)", "fosfatados", ("31053000",), "validated", "alta",
                       production_route_class="fossil_dominant",
                       production_route_rationale="Ácido fosfórico + amônia; herda a rota fóssil da amônia."),
            Definition("fosfato_monoamonico", "Fosfato monoamônico (MAP)", "fosfatados", ("31054000",), "validated", "alta",
                       production_route_class="fossil_dominant",
                       production_route_rationale="Mesma lógica do DAP: herda a rota fóssil da amônia."),
            Definition("superfosfato_triplo", "Superfosfato triplo (TSP)", "fosfatados", ("31031100",), "validated", "alta", "NCM classifica por teor de P2O5 (35% ou mais em peso), não pelo nome comercial -- na prática corresponde ao superfosfato triplo.", None,
                       production_route_class="transition_underway",
                       production_route_rationale="Rocha fosfática (mineral) + ácido fosfórico concentrado; o enxofre a montante é frequentemente subproduto do refino de petróleo/gás, mas o processo em si não depende de combustão fóssil direta."),
            Definition("superfosfato_simples", "Superfosfato simples (SSP)", "fosfatados", ("31031900",), "validated", "alta", "NCM classifica como categoria residual 'outros' (teor de P2O5 abaixo de 35% em peso), não pelo nome comercial -- na prática agrega o superfosfato simples e o duplo.", None,
                       production_route_class="transition_underway",
                       production_route_rationale="Rocha fosfática (mineral) + ácido sulfúrico; o enxofre é frequentemente subproduto do refino de petróleo/gás, mas o processo em si não depende de combustão fóssil direta."),
            Definition("fertilizantes_npk", "Fertilizantes NPK", "formulacao", ("31052000",), "validated", "alta",
                       production_route_class="fossil_dominant",
                       production_route_rationale="Formulação combina nitrogenados (fósseis via amônia) com fosfatados/potássicos; o componente nitrogenado tende a dominar a pegada."),
        ),
        "comparable": {
            "amonia", "acido_fosforico", "acido_sulfurico",
            "ureia", "sulfato_amonio", "nitrato_amonio", "uan",
            "cloreto_potassio", "sulfato_potassio",
            "fosfato_diamonico", "fosfato_monoamonico", "superfosfato_triplo", "superfosfato_simples",
            "fertilizantes_npk",
        },
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
            Definition("minerio_ferro", "Minério de ferro", "base_mineral", ("26011100", "26011210", "26011220", "26011290"), "validated", "alta",
                       production_route_class="undetermined",
                       production_route_rationale="A extração em si (mineração, beneficiamento físico) não depende de feedstock fóssil, mas a NCM não distingue minério destinado a redução direta/EAF (rota de baixo carbono) do minério granulado/sinter feed genérico que abastece majoritariamente altos-fornos a coque no exterior -- 68% das exportações vão para a China, onde a rota dominante é BF-BOF fóssil. Sem essa distinção por produto, rotular o fluxo de exportação como baixo carbono superestimaria a vantagem ambiental do minério bruto."),
            Definition("sucata_ferrosa", "Sucata ferrosa", "base_mineral", ("72041000", "72042100", "72042900", "72043000", "72044100", "72044900"), "validated", "alta",
                       production_route_class="low_carbon_dominant",
                       production_route_rationale="Reciclagem via forno elétrico a arco (EAF) -- ao contrário de commodities fungíveis globalmente (ex.: silício grau metalúrgico), este é consumo doméstico de eletricidade: a rota roda na matriz elétrica nacional, >84% renovável (BEN/EPE), e usa cerca de 1/8 da energia da rota integrada a coque (IEA Iron and Steel Technology Roadmap 2020 / World Steel Association 2020). Principal alavanca de descarbonização do aço brasileiro."),
            Definition("ferro_gusa", "Ferro-gusa", "reducao", ("72011000", "72012000", "72015000"), "validated", "alta",
                       "O IABr registra, entre usinas associadas, consumo de redutores em 2024 de ~84% coque fóssil (6,7 Mt) e ~16% carvão vegetal (1,3 Mt), com fatores de emissão de 2,2 tCO2e/t e 0,7 tCO2e/t respectivamente -- mas cobre só usinas associadas ao IABr, não os guseiros independentes (polos de MG, PA e MA) que operam majoritariamente a carvão vegetal e respondem por parte relevante da produção nacional. O BEN/EPE (2024) dá uma leitura de escopo nacional mais completa -- inclui esses guseiros independentes -- mas mede outra coisa: energia consumida por todo o setor Ferro-Gusa e Aço (não isolada à etapa de redução), onde carvão vegetal já é 16,5% e coque de carvão mineral 42,7%. Nenhuma das duas fontes isola precisamente o mix de redutor do ferro-gusa especificamente exportado, e a NCM (72011000/72012000/72015000) também não distingue as duas rotas, então o valor exportado permanece agregado, sem separação por rota.",
                       None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Alto-forno a coque/carvão mineral domina a maior parte da produção mundial de aço (World Steel Association) -- classificação reflete a rota mundialmente predominante, não necessariamente o mix real do ferro-gusa brasileiro exportado (ver nota de dados)."),
            Definition("carvao_vegetal", "Carvão vegetal (biorredução)", "reducao", (), "validated", "alta",
                       "Sem código NCM próprio -- produção e consumo são 100% domésticos, não cruza fronteira em volume comparável. Os campos de comércio exterior (importação, exportação, HHI, fornecedor) ficam zerados/não aplicáveis por desenho, não por ausência de dado real: a métrica deste insumo vem do BEN/EPE (Balanço Energético Nacional) e do IBGE PEVS (Produção da Extração Vegetal e da Silvicultura), não do Comex Stat -- ver tese estratégica.", None,
                       production_route_class="low_carbon_dominant",
                       production_route_rationale="Biorredução em alto-forno a carvão vegetal de floresta plantada (eucalipto) -- fator de emissão de 0,7 tCO2e/t contra 2,2 tCO2e/t da rota a coque fóssil (IABr 2024), sem feedstock fóssil na cadeia do redutor.",
                       strategic_profile=StrategicProfile(
                           is_powershoring_vector=True,
                           label="Diferencial Competitivo de Baixo Carbono",
                           thesis=(
                               "Já responde por 16,5% de todo o consumo energético do setor Ferro-Gusa e Aço no "
                               "Brasil -- 2.690,76 mil tep em 2024, atrás apenas do coque de carvão mineral "
                               "(42,7%) e à frente de qualquer outra fonte renovável da matriz do setor (BEN/EPE "
                               "2024). É rota estruturalmente doméstica, viabilizada por floresta plantada em "
                               "escala, sem paralelo global -- não uma oportunidade futura, mas vantagem "
                               "competitiva já em produção. A produção nacional de carvão vegetal (todos os usos) "
                               "somou 6,68 milhões de toneladas e R$ 7,96 bilhões em 2024 (IBGE PEVS) -- não é "
                               "possível isolar dessa base nacional a fatia específica consumida pela siderurgia, "
                               "então os dois números (BEN, por setor consumidor; PEVS, produção nacional total) "
                               "são citados separadamente, sem combiná-los em um valor derivado."
                           ),
                           value_chain_links=("ferro_gusa", "carvao_mineral_coque"),
                       )),
            Definition("ferro_esponja", "Ferro-esponja e redução direta", "reducao", ("72031000", "72039000"), "validated", "alta",
                       "NCM 72039000 ('Outros', capítulo 7203) também cobre, pelo texto tarifário, ferro de pureza mínima 99,94% além de outros produtos ferrosos esponjosos -- a ponte oficial NCM-PRODLIST (2411.2030) trata os dois códigos como o mesmo produto industrial (ferro-esponja/redução direta), mas o texto do capítulo por si só não isola exclusivamente DRI.", None,
                       production_route_class="transition_underway",
                       production_route_rationale="Redução direta tipicamente a gás natural (bem menos intensiva em carbono que o alto-forno a carvão) e é a porta de entrada para a rota DRI-hidrogênio verde ainda emergente.",
                       strategic_profile=StrategicProfile(
                           is_powershoring_vector=True,
                           label="Vetor de Powershoring",
                           thesis=(
                               "O comércio observado deste insumo é hoje irrisório (déficit de ~US$94,7 mil) -- "
                               "isso não é ausência de relevância, é o retrato de uma rota ainda embrionária no "
                               "Brasil. A tese de powershoring não lê o DRI pelo volume passado, mas pelo potencial: "
                               "a rota de redução direta (gás natural hoje, hidrogênio verde na transição) usa a "
                               "matriz elétrica nacional -- majoritariamente renovável -- e o minério de ferro de "
                               "alta gradação que o Brasil já exporta in natura (superávit de US$15,8 bi) para "
                               "produzir ferro pré-reduzido de baixo carbono, substituindo a rota a coque/carvão "
                               "mineral importado (déficit de US$2,1 bi/ano) que hoje domina a siderurgia primária "
                               "nacional. É a ponte entre a abundância mineral e energética do país e a demanda "
                               "global por aço verde -- não uma posição de risco comercial, mas uma janela de "
                               "atração de capital produtivo."
                           ),
                           value_chain_links=("minerio_ferro", "carvao_mineral_coque"),
                           territorial_context=TERRITORIAL_CONTEXT_CE,
                       )),
            Definition("carvao_mineral_coque", "Carvão mineral e coque siderúrgico", "reducao", ("27011100", "27011200", "27011900", "27040011", "27040012", "27040090"), "estimated", "media", "NCM 2701 (hulha) também cobre carvão mineral usado fora da siderurgia (termelétricas, cimento); a cesta não isola o carvão metalúrgico/coque específico do alto-forno.", None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Redutor fóssil importado (majoritariamente Austrália, EUA e Canadá) para o alto-forno a coque -- exposto ao CBAM europeu. Contrasta com o carvão vegetal (biorredução), que é a rota de baixo carbono estruturalmente doméstica do Brasil, mas sem comércio exterior comparável em volume para servir de contraparte direta nesta cesta (ver nota de contexto na Espinha Dorsal)."),
            Definition("ferro_niobio", "Ferro-nióbio", "aciaria", ("72029300",), "validated", "alta", "Produção doméstica (PIA/PRODLIST 2412.2040) está sob sigilo estatístico -- consistente com a CBMM sendo praticamente produtora única no Brasil. Dependência externa e produção comparável não podem ser calculadas; isso reflete concentração de mercado, não ausência de produção.", None,
                       production_route_class="undetermined",
                       production_route_rationale="Redução aluminotérmica de pirocloro em processo dominado pela CBMM (Araxá/MG, ~85-90% da oferta mundial de nióbio) -- ativo de soberania mineral, não um insumo de dependência externa; sem fonte que caracterize a intensidade fóssil/renovável específica do processo aluminotérmico para classificar a rota com confiança."),
            Definition("ferro_niquel", "Ferro-níquel", "aciaria", ("72026000",), "validated", "alta",
                       production_route_class="undetermined",
                       production_route_rationale="Insumo de liga para aço inoxidável, produzido no Brasil via redução pirometalúrgica de laterita (ex.: Vale Onça Puma, Anglo American Barro Alto/Codemin); processo mistura calcinação/secagem e forno elétrico de redução, sem fonte que isole a intensidade fóssil da etapa de calcinação nos produtores brasileiros para classificar a rota com confiança."),
            Definition("ferroligas", "Ferroligas", "aciaria", ("72021100", "72021900", "72022100", "72022900", "72023000", "72024100", "72024900", "72027000", "72028000", "72029100", "72029200", "72029990"), "estimated", "media", "Cesta agrega várias ligas com funções técnicas distintas. Ferro-nióbio (72029300) e ferro-níquel (72026000) foram destacados como Definitions próprias por concentrarem, cada um, a maior parte do superávit da cesta original atrás de um ativo mineral brasileiro específico -- a cesta remanescente ainda mistura ligas com direções de comércio opostas (ver sub_ncm_masking_level).", None,
                       production_route_class="undetermined",
                       production_route_rationale="Cesta agrega ligas com processos distintos (forno elétrico a arco em várias delas); sem rota energética dominante única defensável para a cesta agregada.",
                       sub_ncm_masking_level=1),
            Definition("eletrodos_grafite", "Eletrodos de grafite", "aciaria", ("85451100",), "validated", "alta",
                       production_route_class="fossil_dominant",
                       production_route_rationale="Fabricados a partir de coque de petróleo (needle coke) ou piche de alcatrão de hulha -- feedstock fóssil direto."),
            Definition("materiais_refratarios", "Materiais refratários", "aciaria", (
                           "69021011", "69021018", "69021019", "69021090",
                           "69022010", "69022091", "69022092", "69022093", "69022099",
                           "69029010", "69029020", "69029040", "69029090",
                           "69031011", "69031012", "69031019", "69031030", "69031040", "69031090",
                           "69032010", "69032020", "69032030", "69032090",
                           "69039011", "69039012", "69039019", "69039091", "69039092", "69039099",
                       ), "estimated", "media", "A NCM cobre refratários usados também em cimento, vidro e fundição em geral, não exclusivos da siderurgia.", None,
                       production_route_class="undetermined",
                       production_route_rationale="Cerâmicas técnicas à base de magnésia/alumina/dolomita para revestimento de altos-fornos, EAF e panelas de aciaria -- Brasil tem capacidade doméstica (ex.: RHI Magnesita) mas importa itens de altíssima especificação; sem rota energética dominante única defensável para a cesta agregada."),
            Definition("planos_quente", "Laminados planos a quente", "transformacao", ("72081000", "72082500", "72082610", "72082690", "72082710", "72082790", "72083610", "72083690", "72083700", "72083810", "72083890", "72083910", "72083990"), "validated", "alta",
                       production_route_class="fossil_dominant",
                       production_route_rationale="Herda a rota primária (alto-forno a carvão) e usa fornos de reaquecimento tipicamente a gás natural na laminação.",
                       sub_ncm_masking_level=2),
            Definition("planos_frios", "Laminados planos a frio", "transformacao", ("72091500", "72091600", "72091700", "72091800", "72092500", "72092600", "72092700", "72092800"), "validated", "alta",
                       production_route_class="fossil_dominant",
                       production_route_rationale="Mesma herança do ferro-gusa/planos a quente; a laminação a frio usa mais eletricidade, mas a pegada upstream ainda domina."),
            Definition("acos_eletricos_gno", "Aços elétricos (grão orientado/não orientado)", "transformacao", ("72251100", "72251900", "72261100", "72261900"), "validated", "alta", "A NCM identifica aço ao silício magnético, grão orientado e não orientado, mas não certifica a aplicação final -- motores, transformadores e geradores eólicos competem com outros usos elétricos/eletrônicos genéricos da mesma liga. A variante de largura inferior a 600 mm (7226.11/7226.19) tem ponte PRODLIST dividida entre dois produtos industriais distintos (~52%/~48%), refletindo ambiguidade da própria ponte oficial, não um erro de classificação NCM.", None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Grão orientado exige controle metalúrgico fino tipicamente associado à rota primária integrada (alto-forno a coque); a laminação/recozimento especializados de orientação de grão não alteram a origem fóssil upstream da bobina."),
            Definition("tubos_aco", "Tubos de aço", "bens_transicao", ("73041100", "73041900", "73042910", "73042990", "73043110", "73043190", "73043910", "73043990"), "estimated", "media", "A cesta não isola usos em infraestrutura verde.", None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Herda a rota do aço primário usado na fabricação do tubo."),
            Definition("estruturas_aco", "Estruturas de aço", "bens_transicao", ("73081000", "73082000", "73083000", "73084000", "73089010", "73089090"), "estimated", "media", "Estruturas atendem usos energéticos e não energéticos.", None,
                       production_route_class="fossil_dominant",
                       production_route_rationale="Herda a rota da siderurgia primária usada na fabricação das estruturas.",
                       sub_ncm_masking_level=2),
        ),
        "comparable": {"ferro_gusa", "ferro_esponja", "ferroligas", "ferro_niobio", "ferro_niquel", "eletrodos_grafite", "materiais_refratarios", "planos_quente", "planos_frios", "acos_eletricos_gno", "tubos_aco", "estruturas_aco"},
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
    trade_rows, ncm_totals = core.aggregate_trade(definitions_by_ncm)
    production = core.load_domestic_production(definitions_by_ncm)
    payload = core.build_payload(trade_rows, production, countries, {}, ncm_totals=ncm_totals)
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
