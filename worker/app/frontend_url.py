"""Resolve FRONTEND_BASE_URL for outbound HTTP from the worker (callbacks, cleanup)."""

from urllib.parse import urlparse, urlunparse

from app.config import settings


def resolved_frontend_base_url() -> str:
    """
    Next.js often listens on 127.0.0.1 while 'localhost' resolves to ::1 on Windows;
    httpx then fails to connect. Production https URLs are unchanged.
    """
    raw = settings.frontend_base_url.rstrip("/")
    p = urlparse(raw)
    if (p.hostname or "").lower() != "localhost":
        return raw
    port = f":{p.port}" if p.port else ""
    netloc = f"127.0.0.1{port}"
    return urlunparse((p.scheme, netloc, p.path or "", p.params, p.query, p.fragment))
