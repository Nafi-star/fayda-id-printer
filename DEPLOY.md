# Deploy Fayda ID Printer

Guide for running **Fayda ID Card Converter** in production: Next.js on **Vercel**, Python worker on **Render**, plus managed Postgres, Redis, object storage, and email.

**Do not commit secrets.** Use Vercel / Render dashboards and local `.env` / `.env.local` only. A variable worksheet lives in `deployment/production-env.template.txt`.

---

## How the app is split

| Piece | Where it runs | Role |
|--------|----------------|------|
| **Website** | **Vercel** (`frontend/`) | Auth, UI, APIs, DB, presigned uploads, **pushes jobs to Redis** |
| **Worker** | **Render** (`worker/`) | **Pulls jobs from Redis**, converts PDF/image → PNG, uploads result, **calls back** to Vercel to update job status |
| **Postgres** | **Neon** (or any Postgres) | Users, jobs metadata — **`DATABASE_URL` on Vercel only** |
| **Queue** | **Upstash Redis** | **`REDIS_URL` must be identical** on Vercel and Render |
| **Files** | **Cloudflare R2** or **Supabase Storage (S3 API)** | Input PDFs / output PNGs — **`S3_*` identical** on Vercel and Render |

**Important:** **Conversion does not run on Vercel.** If the UI stays on **Queued**, the worker is missing, asleep, or misconfigured — not the upload button.

**Must match exactly (no trailing slash):**

- Vercel **`APP_URL`** = public site URL, e.g. `https://your-project.vercel.app`
- Render **`FRONTEND_BASE_URL`** = **the same string** as `APP_URL`

---

## Before you start

### 1) Confirm the frontend builds

```powershell
cd path\to\fayda-id-printer\frontend
npm ci
npm run build
```

Use **Node 20+**.

### 2) Create one shared worker secret

PowerShell:

```powershell
[guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
```

Save it as **`WORKER_CALLBACK_TOKEN`**. Paste the **same** value on **Vercel** and **Render** (no quotes in the UI). In production, Vercel **must** have this set or callbacks return **401**.

---

## Step 1 — Create cloud accounts & collect values

Sign up and create resources in any order. Keep a private note of URLs and keys.

### Postgres (Neon)

1. [neon.tech](https://neon.tech) → create project → copy **connection string** → **`DATABASE_URL`**.

### Redis (Upstash)

1. [upstash.com](https://upstash.com) → **Redis** → copy URL starting with **`rediss://`** → **`REDIS_URL`**.

### Object storage (pick one)

**Option A — Cloudflare R2**

1. [R2](https://dash.cloudflare.com) → buckets **`fayda-input`** and **`fayda-output`**.  
2. API token → access key + secret; endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.  
3. Bucket **`fayda-input`** → **Settings** → **CORS**: allow your site origin (same as `APP_URL`), methods **GET, PUT, HEAD**, headers **\*** or **Content-Type**.  
4. **`S3_FORCE_PATH_STYLE`** = **`false`** on Vercel and Render.

**Option B — Supabase Storage (S3)**

1. [supabase.com](https://supabase.com) → **Storage** → buckets **`fayda-input`**, **`fayda-output`**.  
2. **Project Settings → Storage** → enable **S3**, copy endpoint (e.g. `https://<ref>.storage.supabase.co/storage/v1/s3`), region, access key, secret.  
3. **`S3_FORCE_PATH_STYLE`** = **`true`** on Vercel and Render.  
4. Many dashboards have **no per-bucket CORS UI** — deploy with real **`APP_URL`**, test upload; if the browser blocks **PUT** to `*.storage.supabase.co`, try **Settings → API** allowed origins, or contact Supabase support, or use R2 for explicit CORS. See [Supabase Storage S3](https://supabase.com/docs/guides/storage/s3/authentication). Presigned uploads use **server S3 keys** and do **not** depend on Storage “Policies” for that path.

### Email (Resend)

1. [resend.com](https://resend.com) → API key → **`RESEND_API_KEY`**.  
2. Verify sending domain → **`EMAIL_FROM`** e.g. `Fayda <noreply@yourdomain.com>`.

---

## Step 2 — Deploy the website (Vercel)

1. [vercel.com](https://vercel.com) → **Add Project** → import this repo.  
2. **Root Directory:** **`frontend`** (not the repo root).  
3. Framework: **Next.js** (default).

**Environment variables → Production:**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon URI (`sslmode=require` OK) |
| `REDIS_URL` | Upstash `rediss://…` |
| `WORKER_CALLBACK_TOKEN` | Secret from “Before you start” |
| `APP_URL` | Set **after** first deploy: `https://<your-project>.vercel.app` — **no trailing /** |
| `S3_ENDPOINT` | R2 or Supabase S3 endpoint |
| `S3_REGION` | e.g. `auto` (R2) or Supabase region |
| `S3_ACCESS_KEY` | |
| `S3_SECRET_KEY` | |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | `false` (R2) or `true` (Supabase) |
| `RESEND_API_KEY` | |
| `EMAIL_FROM` | Verified domain |

**Optional:** `ADMIN_EMAIL` / `ADMIN_EMAILS` · `WORKER_BASE_URL` (Render worker URL, for `/api/worker/health`) · `DISABLE_ADMIN_APPROVAL=true` (open sign-up; not recommended for production).

**Deploy**, then set **`APP_URL`** to the real production URL → **Save** → **Redeploy** production.

---

## Step 3 — Deploy the worker (Render)

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service** → same repo.  
2. **Root Directory:** **`worker`**.  
3. **Environment:** **Docker** (`worker/Dockerfile`).  
4. **Health check path:** `/health`.

**Environment variables** (copy from Vercel where noted):

| Variable | Must match |
|----------|------------|
| `REDIS_URL` | **Same as Vercel** |
| `FRONTEND_BASE_URL` | **Same as Vercel `APP_URL`** (character-for-character) |
| `WORKER_CALLBACK_TOKEN` | **Same as Vercel** |
| `S3_ENDPOINT` | **Same as Vercel** |
| `S3_REGION` | **Same as Vercel** |
| `S3_ACCESS_KEY` | **Same as Vercel** |
| `S3_SECRET_KEY` | **Same as Vercel** |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | **Same as Vercel** |

**Create** the service → wait **Live** → open `https://<service>.onrender.com/health` → expect `"status":"ok"`.

**Free tier:** the worker **sleeps**; first conversion after idle can take **~30–60+ seconds**.

**Optional:** set Vercel **`WORKER_BASE_URL`** to the Render URL → redeploy (for health checks from the site).

---

## Step 4 — Verify production

1. Open your Vercel URL → register / log in.  
2. Upload a PDF → **Convert** → preview / download.  
3. **History** shows jobs.  
4. **Forgot password** works if **`APP_URL`** and Resend domain are correct.

If **Convert** stays **Queued** → **Render → Logs** while retrying. Typical causes: wrong **`REDIS_URL`**, **`FRONTEND_BASE_URL`** ≠ **`APP_URL`**, **`WORKER_CALLBACK_TOKEN`** mismatch (**401** to `/api/internal/jobs/update`), or wrong **`S3_*`** on the worker.

---

## File cleanup (24h)

Completed or failed jobs older than **24 hours** have **input/output objects removed** from S3. The worker calls **`POST /api/internal/cleanup-storage`** on Vercel periodically using **`WORKER_CALLBACK_TOKEN`**. If the token is wrong or the worker is down, cleanup does not run.

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| Vercel build fails | Root directory **`frontend`**; run **`npm run build`** locally |
| Login / DB errors | **`DATABASE_URL`** |
| Large upload fails without S3 | Set all **`S3_*`**; see [Vercel limits](https://vercel.com/docs/functions/limitations) |
| Browser upload / CORS | R2: bucket CORS for your origin. Supabase: test first; see Step 1 object storage |
| Stuck **Queued** | Worker Live; same **`REDIS_URL`**; **`FRONTEND_BASE_URL`** = **`APP_URL`**; same token; Render logs |
| Worker done, UI still Queued | Callback **401** → token or URL mismatch |

---

## Local development (converter on your machine)

- **Docker:** `docker compose up -d` (Postgres on host **5433**, Redis **6379** — see `docker-compose.yml`).  
- **Env:** copy `frontend/.env.local.example` → `frontend/.env.local`, `worker/.env.example` → `worker/.env`.  
- **Terminal 1:** `cd frontend && npm run dev`  
- **Terminal 2:** `cd worker`, `pip install -r requirements.txt`, then `python -m uvicorn app.main:app --reload --port 8001`  
- **`WORKER_CALLBACK_TOKEN`** must match in both files. **`FRONTEND_BASE_URL=http://127.0.0.1:3000`** in `worker/.env` on Windows is recommended.

---

## One-page checklist

```
□ Neon          → DATABASE_URL (Vercel only)
□ Upstash       → REDIS_URL (Vercel + Render, identical)
□ R2 or Supabase → buckets fayda-input / fayda-output + S3_* (Vercel + Render, identical)
□ Resend        → RESEND_API_KEY, EMAIL_FROM (Vercel)
□ Secret        → WORKER_CALLBACK_TOKEN (Vercel + Render, identical)
□ Vercel        → Root frontend, env vars, deploy, then APP_URL, redeploy
□ Render        → Root worker, Docker, env vars (FRONTEND_BASE_URL = APP_URL)
□ Test          → register, convert, history, forgot password
```

---

*CI: pushes to `main` run `npm run build` in `frontend`. Fix build errors before relying on deploy.*
