from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import unittest
from unittest import mock


HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None


class _ImmediateThread:
    """Stand-in for threading.Thread that runs the target synchronously.

    Lets the job-state-machine tests assert on the final state right after
    calling start_refresh_job(), without sleeping/polling for a real
    background thread to finish.
    """

    def __init__(self, target=None, daemon=None) -> None:
        self._target = target

    def start(self) -> None:
        self._target()


@unittest.skipUnless(HAS_FASTAPI, "FastAPI is not installed in this environment")
class RequireAdminSecretTest(unittest.TestCase):
    def setUp(self) -> None:
        from fastapi import HTTPException

        self.HTTPException = HTTPException
        self._env_backup = os.environ.get("ADMIN_TRIGGER_SECRET")

    def tearDown(self) -> None:
        if self._env_backup is None:
            os.environ.pop("ADMIN_TRIGGER_SECRET", None)
        else:
            os.environ["ADMIN_TRIGGER_SECRET"] = self._env_backup

    def test_missing_header_raises_401(self) -> None:
        from routers.admin import require_admin_secret

        os.environ["ADMIN_TRIGGER_SECRET"] = "correct-secret"
        with self.assertRaises(self.HTTPException) as ctx:
            require_admin_secret(None)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_wrong_header_raises_401(self) -> None:
        from routers.admin import require_admin_secret

        os.environ["ADMIN_TRIGGER_SECRET"] = "correct-secret"
        with self.assertRaises(self.HTTPException) as ctx:
            require_admin_secret("wrong-secret")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_correct_header_passes(self) -> None:
        from routers.admin import require_admin_secret

        os.environ["ADMIN_TRIGGER_SECRET"] = "correct-secret"
        require_admin_secret("correct-secret")  # should not raise

    def test_unset_env_raises_401_without_crashing(self) -> None:
        from routers.admin import require_admin_secret

        os.environ.pop("ADMIN_TRIGGER_SECRET", None)
        with self.assertRaises(self.HTTPException) as ctx:
            require_admin_secret("anything")
        self.assertEqual(ctx.exception.status_code, 401)


@unittest.skipUnless(HAS_FASTAPI, "FastAPI is not installed in this environment")
class AdminRoutesTest(unittest.TestCase):
    def setUp(self) -> None:
        from api.main import app

        self.app = app
        os.environ["ADMIN_TRIGGER_SECRET"] = "correct-secret"

    def test_refresh_requires_secret(self) -> None:
        response = asgi_request(self.app, "POST", "/api/admin/refresh")
        self.assertEqual(response["status"], 401)

    def test_refresh_delegates_to_pipeline_with_correct_secret(self) -> None:
        fake_state = {"status": "running", "steps": []}
        with mock.patch("routers.admin.admin_pipeline.start_refresh_job", return_value=fake_state):
            response = asgi_request(
                self.app,
                "POST",
                "/api/admin/refresh",
                headers={"x-admin-secret": "correct-secret"},
            )
        self.assertEqual(response["status"], 200)
        self.assertEqual(response["json"], fake_state)

    def test_status_delegates_to_pipeline_with_correct_secret(self) -> None:
        fake_state = {"status": "idle", "steps": []}
        with mock.patch("routers.admin.admin_pipeline.get_status", return_value=fake_state):
            response = asgi_request(
                self.app,
                "GET",
                "/api/admin/refresh/status",
                headers={"x-admin-secret": "correct-secret"},
            )
        self.assertEqual(response["status"], 200)
        self.assertEqual(response["json"], fake_state)


@unittest.skipUnless(HAS_FASTAPI, "FastAPI is not installed in this environment")
class AdminPipelineJobStateTest(unittest.TestCase):
    """Exercises the orchestration/state-machine logic with fast stand-in
    steps -- never runs the real (multi-minute) scripts or touches Postgres.
    """

    def setUp(self) -> None:
        import services.admin_pipeline as pipeline

        self.pipeline = pipeline
        # Reset shared module-level state between tests.
        pipeline._STATE.update(
            {"status": "idle", "started_at": None, "finished_at": None, "steps": [], "error": None}
        )

    def test_successful_run_reaches_success_with_all_steps_done(self) -> None:
        pipeline = self.pipeline

        def fake_subprocess_run(args, **kwargs):
            return mock.Mock(returncode=0, stdout="ok", stderr="")

        with mock.patch.object(pipeline, "PIPELINE_SCRIPTS", (("Passo de teste", ["noop.py"]),)), \
            mock.patch.object(pipeline, "SQL_TARGETS", ()), \
            mock.patch.object(pipeline, "MATERIALIZED_VIEWS", ()), \
            mock.patch.object(pipeline, "CACHED_DOWNLOADS_TO_CLEAR", ()), \
            mock.patch.object(pipeline.threading, "Thread", _ImmediateThread), \
            mock.patch.object(pipeline.subprocess, "run", side_effect=fake_subprocess_run), \
            mock.patch.object(pipeline.psycopg2, "connect"):
            # psycopg2.connect() is a MagicMock here -- its return value
            # already supports the `with conn:`/`with conn.cursor():`
            # protocol and .close() out of the box, no manual wiring needed.
            pipeline.start_refresh_job()
            state = pipeline.get_status()

        self.assertEqual(state["status"], "success")
        self.assertTrue(all(step["status"] == "success" for step in state["steps"]))

    def test_failing_step_marks_error_and_skips_remaining_steps(self) -> None:
        pipeline = self.pipeline

        def fake_subprocess_run(args, **kwargs):
            return mock.Mock(returncode=1, stdout="", stderr="boom")

        with mock.patch.object(
            pipeline,
            "PIPELINE_SCRIPTS",
            (("Passo que falha", ["fail.py"]), ("Passo que nunca roda", ["never.py"])),
        ), \
            mock.patch.object(pipeline, "SQL_TARGETS", ()), \
            mock.patch.object(pipeline, "MATERIALIZED_VIEWS", ()), \
            mock.patch.object(pipeline, "CACHED_DOWNLOADS_TO_CLEAR", ()), \
            mock.patch.object(pipeline.threading, "Thread", _ImmediateThread), \
            mock.patch.object(pipeline.subprocess, "run", side_effect=fake_subprocess_run):
            pipeline.start_refresh_job()
            state = pipeline.get_status()

        self.assertEqual(state["status"], "error")
        steps_by_name = {step["name"]: step["status"] for step in state["steps"]}
        self.assertEqual(steps_by_name["Passo que falha"], "error")
        self.assertEqual(steps_by_name["Passo que nunca roda"], "skipped")

    def test_second_click_while_running_is_a_no_op(self) -> None:
        pipeline = self.pipeline
        with pipeline._STATE_LOCK:
            pipeline._STATE["status"] = "running"
            pipeline._STATE["steps"] = [{"name": "Em andamento", "status": "running", "log_tail": None}]

        with mock.patch.object(pipeline.threading, "Thread") as thread_cls:
            result = pipeline.start_refresh_job()

        thread_cls.assert_not_called()
        self.assertEqual(result["status"], "running")


def asgi_request(app, method: str, path: str, headers: dict | None = None, query_string: str = "") -> dict:
    async def run_request() -> dict:
        sent = []
        encoded_headers = [
            (key.lower().encode("ascii"), value.encode("ascii"))
            for key, value in (headers or {}).items()
        ]
        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": query_string.encode("ascii"),
            "headers": encoded_headers,
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
            "json": json.loads(body.decode("utf-8")) if body else None,
        }

    return asyncio.run(run_request())


if __name__ == "__main__":
    unittest.main()
