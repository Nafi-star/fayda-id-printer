import asyncio
import logging

from fastapi import FastAPI

from app.config import settings
from app.consumer import run_consumer
from app.processor import process_conversion_job
from app.schemas import ConversionJob, ConversionResult

app = FastAPI(title=settings.app_name)
logger = logging.getLogger(__name__)
consumer_stop_event = asyncio.Event()
consumer_task: asyncio.Task | None = None


@app.on_event("startup")
async def startup_event() -> None:
    global consumer_task
    logging.basicConfig(level=settings.log_level)
    consumer_task = asyncio.create_task(run_consumer(consumer_stop_event))
    logger.info("Worker startup complete.")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    consumer_stop_event.set()
    if consumer_task:
        await consumer_task
    logger.info("Worker shutdown complete.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env}


@app.post("/convert/test", response_model=ConversionResult)
def convert_test(job: ConversionJob) -> ConversionResult:
    return process_conversion_job(job)
