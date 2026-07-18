from __future__ import annotations

import asyncio
import importlib.util
import json
import unittest


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


if __name__ == "__main__":
    unittest.main()
