from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status

from services import admin_pipeline


router = APIRouter(prefix="/api/admin", tags=["Admin"])


def require_admin_secret(x_admin_secret: str | None = Header(default=None)) -> None:
    """Gates every /api/admin/* route behind a service-to-service shared secret.

    This is deliberately not a human login (no password/session here) -- the
    human-facing password lives entirely in the Next.js layer
    (app/api/admin/login/route.ts). ADMIN_TRIGGER_SECRET only proves the
    request came from that trusted Next.js server, not directly from a
    browser hitting the public Railway URL.
    """

    expected = os.environ.get("ADMIN_TRIGGER_SECRET")
    if not expected or not x_admin_secret or not hmac.compare_digest(x_admin_secret, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Segredo de administrador ausente ou invalido.",
        )


@router.post("/refresh", dependencies=[Depends(require_admin_secret)])
def trigger_refresh() -> dict[str, Any]:
    return admin_pipeline.start_refresh_job()


@router.get("/refresh/status", dependencies=[Depends(require_admin_secret)])
def refresh_status() -> dict[str, Any]:
    return admin_pipeline.get_status()
