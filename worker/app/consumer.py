import asyncio
import json
import logging

import httpx
from httpx import Timeout
from redis.asyncio import Redis

from app.config import settings
from app.processor import process_conversion_job
from app.schemas import ConversionJob

logger = logging.getLogger(__name__)

# Callback flakiness (Next.js not up yet, Windows localhost, brief network blips).
_RETRYABLE_NOTIFY = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    httpx.RemoteProtocolError,
)


async def _notify_frontend(payload: dict, *, attempts: int = 5) -> bool:
    """
    POST job status to Next.js. Retries on connection issues.
    Returns True if Next acknowledged (2xx), False otherwise.
    """
    base = settings.frontend_base_url.rstrip("/")
    url = f"{base}/api/internal/jobs/update"
    headers = {"x-worker-token": settings.worker_callback_token}
    last_err: BaseException | None = None

    # Short timeouts: a hung callback should not block the consumer for half a minute per attempt.
    _http_timeout = Timeout(12.0, connect=4.0)

    for i in range(attempts):
        try:
            async with httpx.AsyncClient(timeout=_http_timeout) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
            return True
        except _RETRYABLE_NOTIFY as exc:
            last_err = exc
            delay = min(2.0, 0.4 * (2**i))
            logger.warning(
                "Callback retry %s/%s for job=%s: %s",
                i + 1,
                attempts,
                payload.get("jobId"),
                exc,
            )
            await asyncio.sleep(delay)
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Callback HTTP %s for job=%s: %s",
                exc.response.status_code,
                payload.get("jobId"),
                exc.response.text[:500],
            )
            return False

    logger.error(
        "Callback unreachable after %s attempts (job=%s url=%s): %s",
        attempts,
        payload.get("jobId"),
        url,
        last_err,
    )
    return False


async def _notify_failed_safe(job_id: str, message: str) -> None:
    await _notify_frontend(
        {"jobId": job_id, "status": "failed", "errorMessage": message},
        attempts=5,
    )


async def run_consumer(stop_event: asyncio.Event) -> None:
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    queue_name = settings.queue_name

    base = settings.frontend_base_url.rstrip("/")
    logger.info("Worker consumer started. queue=%s callback=%s", queue_name, base)

    try:
        while not stop_event.is_set():
            item = await redis.blpop(queue_name, timeout=3)
            if not item:
                continue

            _, raw_payload = item
            try:
                payload = json.loads(raw_payload)
                job = ConversionJob.model_validate(payload)
            except Exception:
                logger.exception("Invalid queue payload.")
                continue

            # Do not abort the job if "processing" ping fails (Next may still be starting).
            if not await _notify_frontend(
                {"jobId": job.job_id, "status": "processing"},
                attempts=4,
            ):
                logger.warning(
                    "Skipped processing callback for job=%s — still converting. "
                    "If this repeats, start Next.js and set FRONTEND_BASE_URL (try http://127.0.0.1:3000 on Windows).",
                    job.job_id,
                )

            try:
                result = await asyncio.to_thread(process_conversion_job, job)
            except Exception as exc:
                logger.exception("Job failed: %s", job.job_id)
                await _notify_failed_safe(job.job_id, str(exc))
                continue

            ok = await _notify_frontend(
                {
                    "jobId": job.job_id,
                    "status": result.status,
                    "outputFileKey": result.output_file_key,
                },
                attempts=8,
            )
            if not ok:
                logger.error(
                    "Job %s finished in worker but DB was not updated — "
                    "check Next.js is running and FRONTEND_BASE_URL / WORKER_CALLBACK_TOKEN match.",
                    job.job_id,
                )
    finally:
        await redis.close()
