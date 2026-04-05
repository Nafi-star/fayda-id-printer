import asyncio
import logging

import httpx
from httpx import Timeout

from app.config import settings
from app.frontend_url import resolved_frontend_base_url

logger = logging.getLogger(__name__)

# Call Vercel/Next cleanup after startup, then on this interval (matches 24h retention policy).
_CLEANUP_INTERVAL_S = 45 * 60
_INITIAL_DELAY_S = 120


async def run_cleanup_scheduler(stop_event: asyncio.Event) -> None:
    """
    POST /api/internal/cleanup-storage on the Next app so files older than 24h are removed
    and jobs are marked purged (same as documented product behavior).
    """
    base = resolved_frontend_base_url()
    url = f"{base}/api/internal/cleanup-storage"
    headers = {"x-worker-token": settings.worker_callback_token}
    timeout = Timeout(120.0, connect=15.0)

    try:
        await asyncio.wait_for(stop_event.wait(), timeout=_INITIAL_DELAY_S)
        return  # stopped before first run
    except asyncio.TimeoutError:
        pass

    while not stop_event.is_set():
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                n = int(data.get("purged") or 0)
                if n > 0:
                    logger.info("storage cleanup: purged %s job file set(s)", n)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("cleanup-storage request failed: %s", exc)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=_CLEANUP_INTERVAL_S)
        except asyncio.TimeoutError:
            continue
