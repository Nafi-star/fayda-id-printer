# Deploy: Vercel (frontend) + Render (worker)

This guide deploys **Next.js** on [Vercel](https://vercel.com) and the **Python worker** on [Render](https://render.com). Follow the steps **in order**. Do **not** commit `.env` files — paste secrets only in Vercel and Render dashboards.

No cloud deploy is literally impossible to fail (wrong paste, expired keys, typos), but following **§0** and the checklists below prevents **most** repeat failures.

---

## 0 — Before Vercel / Render: prove the build locally

Run this on your PC from the **repository root**. If this fails, fix it **before** touching Vercel — the same command is what CI runs on every push to `main`.

```powershell
cd path\to\fayda-id-printer\frontend
npm ci
npm run build
```

- Use **Node 20+** (matches GitHub Actions and Vercel defaults).
- If `npm ci` errors, run `npm install` once, commit `package-lock.json`, then use `npm ci` again.

**URLs (critical):** Every production URL you paste must be **exact**:

- `https://your-app.vercel.app` — **no** trailing `/`
- Same host for **`APP_URL`** (Vercel) and **`FRONTEND_BASE_URL`** (Render)

**One queue, one secret:** **`REDIS_URL`** and **`WORKER_CALLBACK_TOKEN`** must be **character-for-character identical** on Vercel and Render.

---

## Common deploy failures (quick map)

| What failed | Usual cause |
|-------------|-------------|
| Vercel **Build** red | Wrong **Root Directory** (must be `frontend`), or `npm run build` errors — run **§0**. |
| Vercel **runtime** 500 on login | Missing **`DATABASE_URL`** or wrong Neon string. |
| Upload / convert broken in prod | Missing **`S3_*`** on Vercel, or **CORS** not set on bucket **`fayda-input`** (**§1.3.1**). |
| Job stuck **Queued** | Render worker asleep (free tier), wrong **`REDIS_URL`** on worker, or worker crash — **Render → Logs**. |
| Job finishes but UI never updates | **`FRONTEND_BASE_URL`** ≠ your Vercel URL, or **`WORKER_CALLBACK_TOKEN`** mismatch. |

---

## Conversions & 24-hour retention (same idea as local)

- **Uploaded PDFs and generated PNGs** are removed from storage when a job has been **completed or failed** for **more than 24 hours** (based on `updated_at` in the database).
- The **worker** (Render) calls your Next.js route **`POST /api/internal/cleanup-storage`** automatically: **first run ~2 minutes after the worker starts**, then about **every 45 minutes**. It uses the same **`WORKER_CALLBACK_TOKEN`** as job callbacks.
- After cleanup, the job row is kept for **usage / history counting**, but **`input_file_key`** is set to **`[purged]`** and **`/api/jobs`** **hides** those rows — so they **disappear from the dashboard and history list**. Downloads stop working (files are gone).
- **Production behaves like local** as long as **Render is running**, **`FRONTEND_BASE_URL`** points at your live Vercel URL, and **`WORKER_CALLBACK_TOKEN`** matches Vercel. If the worker never runs, old files are **not** deleted automatically.

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

## One sitting — what to do in order (overview)

| Order | You do | Details |
|------|--------|--------|
| A | **§0** Local `npm run build` in `frontend` | Confirms Vercel will build |
| B | **Step 1** Neon + Upstash + R2/Supabase + **CORS** + Resend + token | Copy every value into a private note |
| C | **Step 2** Vercel: import repo, **Root = `frontend`**, paste **all** env vars, Deploy | Then set **`APP_URL`**, Redeploy |
| D | **Step 3** Render: **Root = `worker`**, Docker, paste env (**same** Redis/S3/token, **`FRONTEND_BASE_URL`** = Vercel URL) | Wait for green deploy |
| E | Vercel: add **`WORKER_BASE_URL`** = Render URL (optional) | Redeploy |
| F | **Step 4** Open site → register → convert → forgot password | If stuck, use **Common deploy failures** table |

**Same as local:** use the **same** `DATABASE_URL`, `REDIS_URL`, `S3_*`, and `WORKER_CALLBACK_TOKEN` you use in `frontend/.env.local` and `worker/.env` — only the URLs change (`APP_URL` / `FRONTEND_BASE_URL` = production Vercel).

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

### 1.3.1 CORS (required for browser → bucket uploads)

Production uploads go **straight to your bucket** with a presigned URL (so Vercel’s small serverless body limit does not apply). You must allow your **Vercel site origin** to **`PUT`** objects into the **input** bucket.

**Cloudflare R2:** Open bucket **`fayda-input`** → **Settings** → **CORS policy** → add:

- **Allowed origins:** `https://your-project.vercel.app` (your real URL; no trailing slash). For quick tests you can use `*`.
- **Allowed methods:** `GET`, `PUT`, `HEAD`
- **Allowed headers:** `*` (or include `Content-Type`)

See [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).

**Supabase:** If browser uploads fail with a network/CORS error, add your Vercel origin in the project’s Storage / API CORS settings (or use the dashboard docs for S3-compatible access).

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
- **Build / Output:** leave defaults (Vercel runs `npm run build` inside `frontend`). Do **not** enable “static export” unless you know you need it.

### 2.2a Render build settings (must match)

- **Root Directory:** **`worker`**
- **Environment:** **Docker**
- **Dockerfile path:** `Dockerfile` (relative to `worker/` — Render uses the file at `worker/Dockerfile` in the repo)

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

### 2.5 Large files on Vercel

With **`S3_*`** set on Vercel, uploads use **presigned PUT** to your bucket (not through the Next.js body), so **full-size Fayda PDFs work** after **CORS** is configured on the input bucket (**§1.3.1**). Without object storage, only small files can use the legacy multipart route (~4.5 MB) — see [Vercel function limits](https://vercel.com/docs/functions/limitations).

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

### 3.5 24-hour cleanup (automatic)

No cron job on Vercel is required. The **worker process** triggers storage cleanup against your Next app. If **`WORKER_CALLBACK_TOKEN`** is wrong, cleanup returns **401** and files will **not** be purged — fix the token and redeploy both sides.

---

## Step 4 — Smoke test

1. Open your **Vercel URL** → register or log in.
2. Upload a Fayda PDF or image → **Convert** (with S3 + CORS, large PDFs are OK).
3. If the job stays **Queued** forever: worker asleep (wait or upgrade), wrong **`REDIS_URL`**, or worker not running — check **Render Logs**.
4. If the job **fails** with auth: **`WORKER_CALLBACK_TOKEN`** mismatch or wrong **`FRONTEND_BASE_URL`**.
5. **Forgot password** → confirm email link uses your real domain (depends on **`APP_URL`** + Resend).

---

## Quick troubleshooting

| Problem | Fix |
|---------|-----|
| Upload fails with a **CORS** / network error | Set **CORS** on **`fayda-input`** for your Vercel URL (**§1.3.1**). |
| Upload fails only without S3 | Add all **`S3_*`** env vars on Vercel, or use files under ~4 MB. |
| Convert stuck on **Queued** | Render sleeping, or **`REDIS_URL`** wrong on worker, or worker crashed — **Logs**. |
| Job fails / 401 in logs | **`WORKER_CALLBACK_TOKEN`** must match; **`FRONTEND_BASE_URL`** must match Vercel exactly. |
| Upload works, worker errors on S3 | **`S3_*`** identical on Vercel and Render; buckets exist; **`S3_FORCE_PATH_STYLE`** correct for R2 vs Supabase. |

---

## Copy-paste template

See **`deployment/production-env.template.txt`** for a single list of variable names.

---

## Local development

You do **not** need Vercel or Render on your machine for daily work. Use Docker Compose and `frontend/.env.local` + `worker/.env` per the project’s `.env.example` files.

**Windows:** Start **`npm run dev`** (Next.js) **before** the worker. Prefer **`FRONTEND_BASE_URL=http://127.0.0.1:3000`** in `worker/.env` (the worker also rewrites `localhost` → `127.0.0.1` for callbacks to avoid IPv6/`::1` connection failures).

---

## End-to-end order (copy checklist)

1. Neon → `DATABASE_URL`  
2. Upstash → `REDIS_URL`  
3. R2 or Supabase buckets + **CORS on `fayda-input`** → all `S3_*`  
4. Resend → `RESEND_API_KEY`, `EMAIL_FROM`  
5. Generate → `WORKER_CALLBACK_TOKEN` (same everywhere)  
6. Vercel: import repo, **Root = `frontend`**, add **all** env vars from **§2.3**, Deploy  
7. Set **`APP_URL`** to live Vercel URL → **Redeploy**  
8. Render: **Web Service**, **Root = `worker`**, Docker, add env (**§3.2**), **`FRONTEND_BASE_URL`** = same host as **`APP_URL`**  
9. Vercel: optional **`WORKER_BASE_URL`** = Render URL → Redeploy  
10. Test: register → upload → convert → forgot password  

---

## Honest note

Hosting providers, DNS, and API keys change. If a deploy fails, open **Vercel Build Logs** or **Render Logs**, search this doc’s **Common deploy failures** table, and fix the one line that is wrong — usually a URL, token, or missing env var.
