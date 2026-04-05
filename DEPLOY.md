# Deploy: Vercel (frontend) + Render (worker)

This guide deploys **Next.js** on [Vercel](https://vercel.com) and the **Python worker** on [Render](https://render.com). Follow the steps **in order**. Do **not** commit `.env` files — paste secrets only in Vercel and Render dashboards.

---

## What you are building

| Piece | Where | Role |
|--------|--------|------|
| Website & APIs | **Vercel** (`frontend/`) | Pages, auth, upload API, jobs |
| Database | **Neon** | Postgres (`DATABASE_URL`) |
| Job queue | **Upstash** | Redis (`REDIS_URL`) — must be **identical** on Vercel and Render |
| Files (PDF/PNG) | **Cloudflare R2** or **Supabase Storage** | S3-compatible (`S3_*` vars) — **identical** on Vercel and Render |
| PDF → image | **Render** (`worker/`) | Consumes Redis, writes results, calls your Vercel API |
| Email | **Resend** (or SMTP) | Password reset (`RESEND_API_KEY`, `EMAIL_FROM`) |

---

## Step 1 — Supporting services (one-time)

Do these in any order; you need the values before Step 2 and Step 3.

### 1.1 Neon (database)

1. [neon.tech](https://neon.tech) → sign up → **Create project**.
2. Copy the **connection string** (URI). This is **`DATABASE_URL`** (`sslmode=require` is fine).

### 1.2 Upstash (Redis)

1. [upstash.com](https://upstash.com) → **Create database** → **Redis**.
2. Copy the **Redis URL** starting with **`rediss://`**. This is **`REDIS_URL`**.

### 1.3 Object storage (pick **one**)

**Option A — Cloudflare R2**

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → create buckets **`fayda-input`** and **`fayda-output`**.
2. Create **R2 API token** with read/write → note **Access Key ID**, **Secret**, **Account ID**.
3. Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`  
4. Set **`S3_FORCE_PATH_STYLE`** = **`false`** on both Vercel and Render.

**Option B — Supabase Storage (S3 API)**

1. [supabase.com](https://supabase.com) → project → **Storage** → create buckets **`fayda-input`**, **`fayda-output`**.
2. Project **Settings** → Storage → **S3**: generate keys, copy endpoint (e.g. `https://<ref>.storage.supabase.co/storage/v1/s3`).
3. Set **`S3_FORCE_PATH_STYLE`** = **`true`** on both Vercel and Render.

### 1.4 Resend (email)

1. [resend.com](https://resend.com) → **API Keys** → create key → **`RESEND_API_KEY`**.
2. Add/verify a domain → **`EMAIL_FROM`** = e.g. `Fayda <noreply@yourdomain.com>`.

### 1.5 Shared secret (write it down once)

Generate a long random string (PowerShell):

```powershell
[guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
```

This is **`WORKER_CALLBACK_TOKEN`**. You will paste the **same** value on **Vercel** and **Render** — no spaces, no quotes in the dashboard fields.

---

## Step 2 — Vercel (Next.js)

### 2.1 Repository

- Push this repo to **GitHub** (if it is not already).
- In [vercel.com](https://vercel.com) → **Add New → Project** → **Import** the repository.

### 2.2 Build settings

- **Root Directory:** **`frontend`** (click **Edit**, set to `frontend`, not the repo root).
- Framework: **Next.js** (auto).

### 2.3 Environment variables (Production)

Add **each** name exactly as below. Use **your** real values where noted.

**Core**

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon connection string |
| `REDIS_URL` | Upstash `rediss://...` |
| `WORKER_CALLBACK_TOKEN` | Same string as in Step 1.5 |

**URLs**

| Name | Value |
|------|--------|
| `APP_URL` | After first deploy, set to your **exact** site URL: `https://<project>.vercel.app` — **no trailing slash**. Redeploy after changing. |

**Object storage (same block you chose in 1.3)**

| Name | Value |
|------|--------|
| `S3_ENDPOINT` | R2 or Supabase endpoint |
| `S3_REGION` | e.g. `auto` (R2) or region from Supabase |
| `S3_ACCESS_KEY` | From R2 or Supabase S3 keys |
| `S3_SECRET_KEY` | Secret |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | `false` (R2) or `true` (Supabase) |

**Email**

| Name | Value |
|------|--------|
| `RESEND_API_KEY` | From Resend |
| `EMAIL_FROM` | Verified sender, e.g. `Fayda <noreply@yourdomain.com>` |

**Optional**

| Name | Value |
|------|--------|
| `ADMIN_EMAIL` or `ADMIN_EMAILS` | Extra admin emails (comma-separated). Admins in `frontend/src/lib/admin-config.ts` always count. |
| `WORKER_BASE_URL` | After Render is live: `https://<your-service>.onrender.com` (no trailing slash) — helps `/api/worker/health`. |
| `DISABLE_ADMIN_APPROVAL` | `true` only if you want open sign-up without `/admin` approval. |

### 2.4 Deploy

1. Click **Deploy**.
2. When the build finishes, open the **production URL** Vercel shows.
3. Go back to **Settings → Environment Variables** → set **`APP_URL`** to that **exact** URL (https, no trailing slash) → **Save**.
4. **Deployments** → **⋯** on the latest production deployment → **Redeploy**.

### 2.5 Vercel upload limit (important)

Vercel serverless routes accept request bodies only up to about **4.5 MB**. The dashboard enforces a safe limit for production builds. Large PDFs that work on your PC may fail on Vercel — use a **smaller PDF** or a **screenshot under ~4 MB**. See [Vercel function limits](https://vercel.com/docs/functions/limitations).

---

## Step 3 — Render (worker)

### 3.1 Create the web service

1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**.
2. **Connect** your **same GitHub repository**.
3. **Name:** e.g. `fayda-worker`.
4. **Region:** choose one close to Neon/Upstash if possible.
5. **Root Directory:** **`worker`**
6. **Runtime:** **Docker** (Render should detect `worker/Dockerfile`).
7. **Instance type:** Free tier can **sleep** when idle; first job after sleep may be slow. For reliable queue processing, use a **paid** instance that does not spin down.
8. **Health check path:** `/health` (optional but recommended).

### 3.2 Environment variables (Render)

Open **Environment** for this service and add:

| Name | Value |
|------|--------|
| `REDIS_URL` | **Same** as Vercel (`rediss://...`) |
| `FRONTEND_BASE_URL` | **Exact** Vercel production URL, e.g. `https://your-project.vercel.app` — **no trailing slash** |
| `WORKER_CALLBACK_TOKEN` | **Same** as Vercel |
| `S3_ENDPOINT` | **Same** as Vercel |
| `S3_REGION` | **Same** as Vercel |
| `S3_ACCESS_KEY` | **Same** as Vercel |
| `S3_SECRET_KEY` | **Same** as Vercel |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | **Same** as Vercel (`true` or `false`) |

Do **not** rely on a `.env` file inside the image for production — Render injects these at runtime.

### 3.3 Deploy and verify

1. **Create Web Service** and wait until the deploy succeeds.
2. Open **`https://<your-service>.onrender.com/health`** in a browser — you should see JSON like `{"status":"ok",...}`.
3. Copy the service **URL** (no trailing slash).
4. On **Vercel**, add **`WORKER_BASE_URL`** = that URL → **Redeploy** the frontend (optional but useful for health checks).

### 3.4 Logs

In Render → **Logs**: you should see the consumer starting and a line like `callback=https://your-project.vercel.app`. If you see Redis/S3/401 errors, re-check the variables above.

---

## Step 4 — Smoke test

1. Open your **Vercel URL** → register or log in.
2. Upload a **small** PDF or image (under ~4 MB on Vercel) → **Convert**.
3. If the job stays **Queued** forever: worker asleep (wait or upgrade), wrong **`REDIS_URL`**, or worker not running — check **Render Logs**.
4. If the job **fails** with auth: **`WORKER_CALLBACK_TOKEN`** mismatch or wrong **`FRONTEND_BASE_URL`**.
5. **Forgot password** → confirm email link uses your real domain (depends on **`APP_URL`** + Resend).

---

## Quick troubleshooting

| Problem | Fix |
|---------|-----|
| “Something went wrong” / upload fails | File too large for Vercel (~4 MB safe). Use a smaller file. |
| Convert stuck on **Queued** | Render sleeping, or **`REDIS_URL`** wrong on worker, or worker crashed — **Logs**. |
| Job fails / 401 in logs | **`WORKER_CALLBACK_TOKEN`** must match; **`FRONTEND_BASE_URL`** must match Vercel exactly. |
| Upload works, worker errors on S3 | **`S3_*`** identical on Vercel and Render; buckets exist; **`S3_FORCE_PATH_STYLE`** correct for R2 vs Supabase. |

---

## Copy-paste template

See **`deployment/production-env.template.txt`** for a single list of variable names.

---

## Local development

You do **not** need Vercel or Render on your machine for daily work. Use Docker Compose and `frontend/.env.local` + `worker/.env` per the project’s `.env.example` files.
