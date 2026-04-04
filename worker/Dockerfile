# Python worker: Redis consumer + PDF/PNG processing (deploy to Render, Fly.io, Railway, etc.)
FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PYTHONUNBUFFERED=1
# Render sets PORT; default 8001 for local / other hosts
EXPOSE 8001

CMD sh -c 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}'
