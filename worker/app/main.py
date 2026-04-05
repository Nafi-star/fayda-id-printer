import asyncio
import logging

from fastapi import Depends, FastAPI, Header, HTTPException

from app.cleanup_scheduler import run_cleanup_scheduler
from app.config import settings
from app.consumer import run_consumer
from app.processor import process_conversion_job
from app.schemas import ConversionJob, ConversionResult

app = FastAPI(title=settings.app_name)
logger = logging.getLogger(__name__)
consumer_stop_event = asyncio.Event()
consumer_task: asyncio.Task | None = None
cleanup_scheduler_task: asyncio.Task | None = None


@app.on_event("startup")
async def startup_event() -> None:
    global consumer_task, cleanup_scheduler_task
    logging.basicConfig(level=settings.log_level)
    consumer_task = asyncio.create_task(run_consumer(consumer_stop_event))
    cleanup_scheduler_task = asyncio.create_task(run_cleanup_scheduler(consumer_stop_event))
    logger.info("Worker startup complete.")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    consumer_stop_event.set()
    if cleanup_scheduler_task:
        cleanup_scheduler_task.cancel()
        try:
            await cleanup_scheduler_task
        except asyncio.CancelledError:
            pass
    if consumer_task:
        await consumer_task
    logger.info("Worker shutdown complete.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env}


def _verify_worker_token(x_worker_token: str | None = Header(None, alias="x-worker-token")) -> None:
    """Same secret as Vercel WORKER_CALLBACK_TOKEN — required for /convert/test (called by Next.js HTTP fallback)."""
    if not x_worker_token or x_worker_token != settings.worker_callback_token:
        raise HTTPException(status_code=401, detail="Invalid or missing x-worker-token")


@app.post("/convert/test", response_model=ConversionResult)
def convert_test(job: ConversionJob, _: None = Depends(_verify_worker_token)) -> ConversionResult:
    return process_conversion_job(job)
