# Local setup (converter works) + production deploy

## Part 1 — Run the full app on your PC (Windows)

You need **three things running at once**: Docker (DB + Redis + optional MinIO), **Next.js**, and the **Python worker**.

### Step 1 — Install (one-time)

- **Docker Desktop** for Windows (start it before the next step).
- **Node.js 20+** and **Python 3.11+** with a venv for the worker.

### Step 2 — Start databases (every time after reboot)

In PowerShell, from the **project root** (`fayda-id-printer`):

```powershell
cd C:\Users\hp\Documents\fayda-id-printer
docker compose up -d
```

Wait until Postgres, Redis, and MinIO are up. Check:

```powershell
docker compose ps
```

All listed services should be **Running**.

### Step 3 — Environment files (one-time, then edit if needed)

1. **Frontend** — copy the example:

   ```powershell
   copy frontend\.env.local.example frontend\.env.local
   ```

2. **Worker** — copy the example:

   ```powershell
   copy worker\.env.example worker\.env
   ```

3. Open **`frontend/.env.local`** and **`worker/.env`** and set the **same** value for **`WORKER_CALLBACK_TOKEN`** (any long random string is fine; defaults in the examples already match if you don’t change them).

4. **`DATABASE_URL`** must use **`127.0.0.1`** and port **`5433`** (as in the examples) so it matches Docker.

5. **`REDIS_URL`** should be **`redis://127.0.0.1:6379/0`** on both sides (frontend + worker).

6. **MinIO (optional)** — For the simplest local run, **leave all `S3_*` lines commented out** in both files. Then uploads go to the folder **`storage/`** at the repo root (Next and worker both use that).  
   If you **uncomment** `S3_*` in **both** files, start MinIO with `docker compose up -d` and use `minioadmin` / `minioadmin` as in `docker-compose.yml`.

### Step 4 — Terminal A: Next.js

```powershell
cd C:\Users\hp\Documents\fayda-id-printer\frontend
npm install
npm run dev
```

Leave it running. Site: **http://127.0.0.1:3000**

### Step 5 — Terminal B: Worker

```powershell
cd C:\Users\hp\Documents\fayda-id-printer\worker
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8001
```

Leave it running.

### Step 6 — Quick checks

- Open **http://127.0.0.1:3000/api/worker/health** — should say the worker is OK (not 502).
- Register, upload a PDF, **Convert**. Status should move from **Queued** to **Done**.

### If the converter still fails

| Symptom | Fix |
|--------|-----|
| `ECONNREFUSED` port **5433** | `docker compose up -d postgres` |
| Error about **queue** / **503** / Redis | `docker compose up -d redis` and check `REDIS_URL` |
| Stuck **Queued** forever | Worker terminal not running or wrong `REDIS_URL` |
| Worker log: **Connect** error to port **3000** | Next.js not running; set `FRONTEND_BASE_URL=http://127.0.0.1:3000` in `worker/.env` |
| **401** on callback | `WORKER_CALLBACK_TOKEN` must match in `frontend/.env.local` and `worker/.env` |

---

## Part 2 — Deploy a public link (free tier)

Use the same architecture in the cloud: **Postgres + Redis + object storage + Next.js + worker**.

**Detailed checklist:** read **`DEPLOY-FREE.md`** in this repo.

**Short path:**

1. **Neon** — Postgres → `DATABASE_URL` (use on Render **frontend** and **worker**).
2. **Upstash** — Redis → `REDIS_URL` (both services).
3. **Cloudflare R2** — two buckets + S3 API keys → all `S3_*` vars (both services).
4. Generate **`WORKER_CALLBACK_TOKEN`** — same on both services.
5. **Render** — **New → Blueprint** → repo → **`render.yaml`** → paste secrets.
6. When the **frontend** URL exists, set **`FRONTEND_BASE_URL`** on the **worker** to that URL (no trailing slash) → redeploy **worker**.

Worksheet: **`deploy/RENDER-ENV-CHECKLIST.txt`**.

---

## Files to trust

| File | Purpose |
|------|---------|
| `SETUP-AND-DEPLOY.md` | This page — local + deploy overview |
| `DEPLOY-FREE.md` | Step-by-step cloud (Neon / Upstash / R2 / Render) |
| `frontend/.env.local.example` | Template for local Next.js |
| `worker/.env.example` | Template for local worker |
| `render.yaml` | Render Blueprint (two services) |
