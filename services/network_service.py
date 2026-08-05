"""Business rules for AIPNET global productive-network analysis."""

from __future__ import annotations

from schemas.network import Edge, GraphResponse, NetworkEvidence, Node


SUPPORTED_CHAIN = "silicio"


def build_sovereignty_network(chain: str) -> GraphResponse:
    """Build the institutional sovereignty graph for a supported chain."""

    normalized_chain = chain.strip().lower()
    if normalized_chain != SUPPORTED_CHAIN:
        raise ValueError(f"Unsupported AIPNET chain: {chain}")

    nodes = [
        Node(
            id="quartzo_silica_br",
            label="Quartzo/Sílica",
            stage="extracao",
            country="Brasil",
            is_critical=False,
            related_inputs=["Quartzo de alta pureza", "Sílica industrial"],
            evidence=NetworkEvidence(
                domestic_production_status="confirmed",
                measurement_method="validated",
                confidence_level="alta",
            ),
        ),
        Node(
            id="silicio_grau_metalurgico_br",
            label="Silício Grau Metalúrgico / Si-GM",
            stage="processamento",
            country="Brasil",
            is_critical=False,
            related_inputs=["Carvão vegetal", "Eletrodos de carbono", "Energia elétrica"],
            evidence=NetworkEvidence(
                domestic_production_status="confirmed",
                measurement_method="estimated",
                confidence_level="media",
                data_gap_reason="A produção nacional não está isolada por aplicação fotovoltaica.",
            ),
        ),
        Node(
            id="polissilicio_cn",
            label="Polissilício",
            stage="refinamento",
            country="China",
            is_critical=True,
            related_inputs=["Triclorossilano", "Hidrogênio de alta pureza", "Ácido clorídrico"],
            evidence=NetworkEvidence(
                supplier_hhi=9025,
                china_share=0.95,
                domestic_production_status="unknown",
                measurement_method="structural",
                confidence_level="media",
                data_gap_reason="Sem denominador brasileiro isolado de produção de polissilício solar.",
            ),
        ),
        Node(
            id="wafers_fotovoltaicos_cn",
            label="Wafers Fotovoltaicos",
            stage="componentes_avancados",
            country="China",
            is_critical=True,
            related_inputs=["Lingotes monocristalinos", "Cadinhos de quartzo", "Fios diamantados"],
            evidence=NetworkEvidence(
                supplier_hhi=9025,
                china_share=0.95,
                domestic_production_status="unknown",
                measurement_method="structural",
                confidence_level="media",
                data_gap_reason="Wafers solares não estão isolados no denominador industrial brasileiro.",
            ),
        ),
        Node(
            id="celulas_modulos_pv_br",
            label="Células e Módulos PV",
            stage="produto_final",
            country="Brasil",
            is_critical=False,
            related_inputs=[
                "Vidro solar",
                "Encapsulantes EVA/POE",
                "Pasta de prata",
                "Fitas de cobre",
                "Molduras de alumínio",
                "Backsheet",
                "Caixa de junção",
            ],
            evidence=NetworkEvidence(
                domestic_production_status="confirmed",
                measurement_method="validated",
                confidence_level="media",
                data_gap_reason="Componentes auxiliares ainda exigem fatores de uso fotovoltaico.",
            ),
        ),
    ]
    edges = [
        Edge(source=nodes[0].id, target=nodes[1].id, value=1.0),
        Edge(source=nodes[1].id, target=nodes[2].id, value=1.0),
        Edge(
            source=nodes[2].id,
            target=nodes[3].id,
            value=0.95,
            alert_message=(
                "Alerta HHI Extremo: Monopólio Chinês de 95% na produção global de Wafers"
            ),
        ),
        Edge(
            source=nodes[3].id,
            target=nodes[4].id,
            value=1.0,
            alert_message=(
                "Estrangulamento de Soberania: Alta dependência de importação para "
                "finalização do produto nacional"
            ),
        ),
    ]

    return GraphResponse(chain_name=normalized_chain, nodes=nodes, edges=edges)
