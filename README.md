# Fayda ID Printer (Option 2 Architecture)

**Production deployment:** see **[DEPLOY.md](./DEPLOY.md)** (Vercel + Neon + Upstash + **R2 or Supabase Storage** + Fly worker).

This project uses:
- `frontend/`: Next.js + TypeScript web app
- `worker/`: Python FastAPI + background processor for PDF jobs

This setup is designed for a commercial SaaS workflow: user auth, upload, conversion jobs, download, then payments (Tellbirr/CBE integration) on top.

## Step-by-step build plan

### Step 1 - Local prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- S3-compatible storage (MinIO locally, S3/R2 in production)

### Step 2 - Environment setup
1. Copy `.env.example` to `.env` in project root.
2. Fill DB/Redis/storage values.
3. Copy `worker/.env.example` to `worker/.env` and align values.

### Step 3 - Frontend setup
```bash
cd frontend
npm install
npm run dev
```

### Step 4 - Worker setup
```bash
cd worker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### Step 5 - Verify connection
- Visit `http://localhost:3000` for frontend.
- Visit `http://localhost:8001/health` for worker health.
- Worker expects conversion jobs to arrive in Redis queue (next implementation step).

### Step 6 - Build order for full functionality
1. Add authentication and role system in `frontend`.
2. Add upload API and S3 object storage in `frontend`.
3. Save job records in PostgreSQL.
4. Push job payloads to Redis queue.
5. Let worker pull queue, convert PDF, upload outputs, update DB.
6. Show job status + download links in user dashboard.
7. Integrate Tellbirr/CBE payment flow and map successful payments to credits.
8. Add admin dashboard, usage logs, retention policy, alerts.

## What is implemented now
- Initial frontend app and project structure.
- Initial Python worker app with health route and conversion stub.
- Shared env templates and developer instructions.

## Immediate next coding target
Job pipeline is now scaffolded:
- `POST /api/jobs` creates a queued job in PostgreSQL and pushes to Redis.
- Worker consumes from Redis and calls frontend internal update endpoint.
- `GET /api/jobs?userId=...` lists recent jobs for dashboard polling.

## Step 7 - Run and test the pipeline
1. Start infra:
```bash
docker compose up -d
```
2. In project root, copy `.env.example` to `.env`.
3. In `worker`, copy `.env.example` to `.env`.
4. Start worker:
```bash
cd worker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```
5. Start frontend:
```bash
cd frontend
npm install
npm run dev
```
6. Test create job:
```bash
curl -X POST http://localhost:3000/api/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"userId\":\"demo-user\",\"inputFileKey\":\"uploads/demo.pdf\"}"
```
7. Test list jobs:
```bash
curl "http://localhost:3000/api/jobs?userId=demo-user"
```
