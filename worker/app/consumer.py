import asyncio
import json
import logging

import httpx
from redis.asyncio import Redis

from app.config import settings
from app.processor import process_conversion_job
from app.schemas import ConversionJob

logger = logging.getLogger(__name__)


async def _notify_frontend(payload: dict) -> None:
    url = f"{settings.frontend_base_url}/api/internal/jobs/update"
    headers = {"x-worker-token": settings.worker_callback_token}
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()


async def run_consumer(stop_event: asyncio.Event) -> None:
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    queue_name = settings.queue_name

    logger.info("Worker consumer started. queue=%s", queue_name)

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

            try:
                await _notify_frontend({"jobId": job.job_id, "status": "processing"})
                result = process_conversion_job(job)
                await _notify_frontend(
                    {
                        "jobId": job.job_id,
                        "status": result.status,
                        "outputFileKey": result.output_file_key,
                    }
                )
            except Exception as exc:
                logger.exception("Job failed: %s", job.job_id)
                await _notify_frontend(
                    {
                        "jobId": job.job_id,
                        "status": "failed",
                        "errorMessage": str(exc),
                    }
                )
    finally:
        await redis.close()
