from __future__ import annotations

import asyncio
import importlib.util
import json
import unittest
from unittest import mock


HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None


@unittest.skipUnless(HAS_FASTAPI, "FastAPI is not installed in this environment")
class FastApiContractTest(unittest.TestCase):
    def setUp(self) -> None:
        from api.main import app

        self.app = app

    def test_health_check(self) -> None:
        response = asgi_get(self.app, "/api/health")

        self.assertEqual(response["status"], 200)
        self.assertEqual(response["json"]["status"], "operational")

    def test_query_filters_by_chain(self) -> None:
        response = asgi_get(self.app, "/api/query", "chain=fertilizantes")

        self.assertEqual(response["status"], 200)
        payload = response["json"]
        self.assertEqual(payload["total_records"], 2)
        self.assertTrue(
            all(
                item["cadeia_prioritaria"] == "fertilizantes"
                for item in payload["data"]
            )
        )

    def test_query_rejects_invalid_chain(self) -> None:
        response = asgi_get(self.app, "/api/query", "chain=invalid")

        self.assertEqual(response["status"], 422)

    def test_chain_route_is_mounted_from_published_router(self) -> None:
        from api.main import DATABASE_MOCK

        with mock.patch(
            "routers.api.get_conceptual_products",
            return_value=[DATABASE_MOCK[0]],
        ):
            response = asgi_get(self.app, "/api/chain/fertilizantes")

        self.assertEqual(response["status"], 200)
        self.assertEqual(len(response["json"]), 1)
        self.assertEqual(response["json"][0]["cadeia_prioritaria"], "fertilizantes")
        self.assertIn("metadata_api", response["json"][0])

    def test_graph_route_is_mounted_from_published_router(self) -> None:
        with mock.patch(
            "routers.api.get_sovereignty_graph",
            return_value=sovereignty_graph_payload(),
        ):
            response = asgi_get(self.app, "/api/graph/combustiveis_transicao")

        self.assertEqual(response["status"], 200)
        self.assertEqual(response["json"]["chain_id"], "combustiveis_transicao")
        self.assertEqual(response["json"]["nodes"][0]["tipo"], "pais_origem")
        self.assertEqual(response["json"]["edges"][0]["tipo_fluxo"], "importacao_fob")

    def test_aipnet_silicon_sovereignty_network(self) -> None:
        response = asgi_get(
            self.app,
            "/api/networks/sovereignty",
            "chain=silicio",
        )

        self.assertEqual(response["status"], 200)
        payload = response["json"]
        self.assertEqual(payload["chain_name"], "silicio")
        self.assertEqual(len(payload["nodes"]), 5)
        self.assertEqual(len(payload["edges"]), 4)
        self.assertEqual(
            [edge["source"] for edge in payload["edges"]],
            [node["id"] for node in payload["nodes"][:-1]],
        )
        self.assertEqual(
            [edge["target"] for edge in payload["edges"]],
            [node["id"] for node in payload["nodes"][1:]],
        )
        self.assertTrue(payload["nodes"][2]["is_critical"])
        self.assertTrue(payload["nodes"][3]["is_critical"])
        self.assertIn("Alerta HHI Extremo", payload["edges"][2]["alert_message"])
        self.assertIn("Estrangulamento de Soberania", payload["edges"][3]["alert_message"])

    def test_aipnet_rejects_unsupported_chain(self) -> None:
        response = asgi_get(
            self.app,
            "/api/networks/sovereignty",
            "chain=aco",
        )

        self.assertEqual(response["status"], 404)

    def test_published_graph_builder_derives_topology_from_products(self) -> None:
        from api.main import DATABASE_MOCK
        from database.data_access import build_sovereignty_graph

        graph = build_sovereignty_graph("fertilizantes", [DATABASE_MOCK[0]])

        node_types = {node["tipo"] for node in graph["nodes"]}
        edge_types = {edge["tipo_fluxo"] for edge in graph["edges"]}

        self.assertEqual(graph["chain_id"], "fertilizantes")
        self.assertIn("pais_origem", node_types)
        self.assertIn("insumo_ncm", node_types)
        self.assertIn("elo_industrial_cnae", node_types)
        self.assertIn("produto_final", node_types)
        self.assertEqual(
            edge_types,
            {"importacao_fob", "coeficiente_tecnico", "producao_nacional"},
        )

    def test_sovereignty_graph_accepts_valid_topology(self) -> None:
        from api.main import SovereigntyGraphResponse

        payload = sovereignty_graph_payload()

        graph = SovereigntyGraphResponse(**payload)

        self.assertEqual(graph.chain_id, "combustiveis_transicao")
        self.assertEqual(len(graph.nodes), 2)
        self.assertEqual(len(graph.edges), 1)

    def test_sovereignty_graph_rejects_self_edge(self) -> None:
        from pydantic import ValidationError

        from api.main import SovereigntyGraphResponse

        payload = sovereignty_graph_payload()
        payload["edges"][0]["target"] = payload["edges"][0]["source"]

        with self.assertRaises(ValidationError):
            SovereigntyGraphResponse(**payload)

    def test_sovereignty_graph_rejects_missing_node_reference(self) -> None:
        from pydantic import ValidationError

        from api.main import SovereigntyGraphResponse

        payload = sovereignty_graph_payload()
        payload["edges"][0]["target"] = "no_inexistente"

        with self.assertRaises(ValidationError):
            SovereigntyGraphResponse(**payload)

    def test_sovereignty_graph_rejects_duplicate_ids(self) -> None:
        from pydantic import ValidationError

        from api.main import SovereigntyGraphResponse

        payload = sovereignty_graph_payload()
        payload["nodes"][1]["id"] = payload["nodes"][0]["id"]

        with self.assertRaises(ValidationError):
            SovereigntyGraphResponse(**payload)


def asgi_get(app, path: str, query_string: str = "") -> dict:
    async def run_request() -> dict:
        sent = []
        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": query_string.encode("ascii"),
            "headers": [],
            "server": ("testserver", 80),
            "client": ("testclient", 50000),
        }

        async def receive() -> dict:
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message: dict) -> None:
            sent.append(message)

        await app(scope, receive, send)
        status_message = next(item for item in sent if item["type"] == "http.response.start")
        body = b"".join(
            item.get("body", b"")
            for item in sent
            if item["type"] == "http.response.body"
        )
        return {
            "status": status_message["status"],
            "body": body,
            "json": json.loads(body.decode("utf-8")),
        }

    return asyncio.run(run_request())


def sovereignty_graph_payload() -> dict:
    return {
        "chain_id": "combustiveis_transicao",
        "nodes": [
            {
                "id": "pais_canada",
                "label": "Canada",
                "tipo": "pais_origem",
                "grupo_cadeia": "combustiveis_transicao",
                "metadados_no": {"participacao": 0.365},
            },
            {
                "id": "ncm_31042090",
                "label": "Cloreto de Potassio",
                "tipo": "insumo_ncm",
                "grupo_cadeia": "combustiveis_transicao",
            },
        ],
        "edges": [
            {
                "id_aresta": "canada_31042090_importacao",
                "source": "pais_canada",
                "target": "ncm_31042090",
                "tipo_fluxo": "importacao_fob",
                "peso_financeiro_usd": 4140000000.0,
                "peso_fisico_kg": 9200000000.0,
                "fator_corte_aplicado": 1.0,
                "fonte_auditoria": "Comex Stat",
            }
        ],
    }


if __name__ == "__main__":
    unittest.main()
