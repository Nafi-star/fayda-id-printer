# Fayda ID Printer — deployment guide

**Stack:** Next.js on **[Vercel](https://vercel.com)** (`frontend/`) · Python worker on **[Render](https://render.com)** (`worker/`) · **[Neon](https://neon.tech)** Postgres · **[Upstash](https://upstash.com)** Redis · **Cloudflare R2** or **Supabase Storage** (S3 API) · **[Resend](https://resend.com)** email.

**Rules:** Never commit secrets. Put them only in **Vercel** and **Render** (and local `.env` / `.env.local`). This repo’s CI runs `npm run build` in `frontend` on every push to `main`.

---

## Contents

1. [Architecture](#1-architecture)  
2. [Before you deploy](#2-before-you-deploy)  
3. [Phase A — Cloud services](#3-phase-a--cloud-services)  
4. [Phase B — Vercel (website)](#4-phase-b--vercel-website)  
5. [Phase C — Render (worker)](#5-phase-c--render-worker)  
6. [Phase D — Verify production](#6-phase-d--verify-production)  
7. [24-hour file retention](#7-24-hour-file-retention)  
8. [Troubleshooting](#8-troubleshooting)  
9. [Local development](#9-local-development)  
10. [Printable checklist](#10-printable-checklist)

---

## 1. Architecture

| Component | Host | Env vars (main) |
|-----------|------|------------------|
| Website, auth, APIs, presign uploads | **Vercel** | `DATABASE_URL`, `REDIS_URL`, `S3_*`, `WORKER_CALLBACK_TOKEN`, `APP_URL`, `RESEND_*`, … |
| PDF → PNG job consumer + cleanup pings | **Render** | Same `REDIS_URL`, `S3_*`, `WORKER_CALLBACK_TOKEN`, plus **`FRONTEND_BASE_URL`** = your Vercel site URL |
| Postgres | **Neon** | `DATABASE_URL` on Vercel only (worker does not need DB for conversion) |
| Job queue | **Upstash Redis** | **`REDIS_URL` must be identical** on Vercel and Render |
| PDF/PNG files | **R2** or **Supabase** | **`S3_*` must be identical** on Vercel and Render |

**Critical:** `https://your-app.vercel.app` — **no trailing slash** — must be the same origin in **`APP_URL`** (Vercel) and **`FRONTEND_BASE_URL`** (Render).

---

## 2. Before you deploy

### 2.1 Prove the frontend build (required)

```powershell
cd C:\path\to\fayda-id-printer\frontend
npm ci
npm run build
```

Use **Node 20+**. If `npm ci` fails, run `npm install` once, commit `package-lock.json`, retry.

### 2.2 Generate one shared secret

PowerShell:

```powershell
[guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
```

Save the output as **`WORKER_CALLBACK_TOKEN`** — paste the **same** string on **Vercel** and **Render** (no quotes in the UI).

---

## 3. Phase A — Cloud services

Complete these in any order; collect values in a private note.

### 3.1 Neon — `DATABASE_URL`

1. [neon.tech](https://neon.tech) → project → copy **connection string** (URI).  
2. `sslmode=require` in the string is fine.

### 3.2 Upstash — `REDIS_URL`

1. [upstash.com](https://upstash.com) → **Redis** database.  
2. Copy the URL that starts with **`rediss://`**.

### 3.3 Object storage — `S3_*` (choose one)

**A) Cloudflare R2**

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → buckets **`fayda-input`**, **`fayda-output`**.  
2. API token → Access Key ID + Secret; **Account ID** → endpoint  
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`  
3. **`S3_FORCE_PATH_STYLE`** = **`false`** on Vercel and Render.

**B) Supabase Storage (S3)**

1. [supabase.com](https://supabase.com) → **Storage** → same bucket names.  
2. Settings → Storage → **S3** keys + endpoint (e.g. `https://<ref>.storage.supabase.co/storage/v1/s3`).  
3. **`S3_FORCE_PATH_STYLE`** = **`true`** on Vercel and Render.

### 3.4 CORS on `fayda-input` (production uploads)

The browser uploads **directly to the bucket** (presigned PUT), so Vercel’s ~4.5 MB body limit does not apply. The bucket must allow your site:

**R2:** Bucket **`fayda-input`** → **Settings** → **CORS** — e.g. allowed origin `https://your-app.vercel.app`, methods **GET, PUT, HEAD**, headers **\***.  
Docs: [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).

**Supabase:** Allow your Vercel origin in Storage / API CORS if PUT from the browser fails.

### 3.5 Resend — `RESEND_API_KEY`, `EMAIL_FROM`

1. [resend.com](https://resend.com) → API key.  
2. Verify a domain → `EMAIL_FROM` like `Fayda <noreply@yourdomain.com>`.

---

## 4. Phase B — Vercel (website)

1. [vercel.com](https://vercel.com) → **Add Project** → import this **GitHub** repo.  
2. **Root Directory:** **`frontend`** (not repo root).  
3. Framework: **Next.js** (default). Do **not** turn on static export unless you know you need it.  
4. **Environment Variables** → **Production** — add:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon URI |
| `REDIS_URL` | Upstash `rediss://…` |
| `WORKER_CALLBACK_TOKEN` | From §2.2 |
| `APP_URL` | Use real URL **after** first deploy: `https://<name>.vercel.app` (no `/` at end) |
| `S3_ENDPOINT` | R2 or Supabase |
| `S3_REGION` | e.g. `auto` (R2) or Supabase region |
| `S3_ACCESS_KEY` | |
| `S3_SECRET_KEY` | |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | `false` (R2) or `true` (Supabase) |
| `RESEND_API_KEY` | |
| `EMAIL_FROM` | Verified domain |

**Optional:** `ADMIN_EMAIL` / `ADMIN_EMAILS` · `WORKER_BASE_URL` (Render URL, after Phase C) · `DISABLE_ADMIN_APPROVAL=true` (open sign-up; not recommended for production).

5. **Deploy**. When it succeeds, set **`APP_URL`** to the exact production URL → **Save** → **Redeploy** production.

---

## 5. Phase C — Render (worker)

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service** → same GitHub repo.  
2. **Root Directory:** **`worker`**  
3. **Environment:** **Docker** (`worker/Dockerfile`).  
4. **Health check path:** `/health` (recommended).  
5. **Environment** tab — add:

| Variable | Value |
|----------|--------|
| `REDIS_URL` | **Same as Vercel** |
| `FRONTEND_BASE_URL` | **Same origin as `APP_URL`** — `https://<name>.vercel.app` |
| `WORKER_CALLBACK_TOKEN` | **Same as Vercel** |
| `S3_ENDPOINT` | **Same as Vercel** |
| `S3_REGION` | **Same as Vercel** |
| `S3_ACCESS_KEY` | **Same as Vercel** |
| `S3_SECRET_KEY` | **Same as Vercel** |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | **Same as Vercel** |

6. **Create Web Service** → wait for **Live**.  
7. Open `https://<service>.onrender.com/health` → JSON `status: ok`.  
8. (Optional) On Vercel add **`WORKER_BASE_URL`** = `https://<service>.onrender.com` → **Redeploy**.

**Note:** Free Render can **sleep**; the first conversion after idle may be slow. Paid instances stay warm.

---

## 6. Phase D — Verify production

| Step | Action |
|------|--------|
| 1 | Open your Vercel URL → register / log in |
| 2 | Upload a Fayda PDF → **Convert** → preview / download |
| 3 | **History** loads past jobs |
| 4 | **Forgot password** → email link opens (needs correct **`APP_URL`** + Resend domain) |

If **Convert** stays **Queued** → Render **Logs** + same `REDIS_URL` + worker not sleeping forever on broken deploy.

---

## 7. 24-hour file retention

- Jobs **completed** or **failed** for **> 24 hours** (by `updated_at`) have their **input/output objects deleted** from S3/R2.  
- The **worker** calls **`POST /api/internal/cleanup-storage`** on your Next app automatically (**~2 minutes** after start, then **~every 45 minutes**), using **`WORKER_CALLBACK_TOKEN`**.  
- Database rows stay (for usage counts); list APIs **hide** purged jobs — they **disappear from dashboard/history**; download stops.  
- If the worker is down or the token mismatches (**401**), cleanup does not run.

---

## 8. Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Vercel build fails | Root = **`frontend`**; fix errors from local **`npm run build`** |
| Login / DB errors | **`DATABASE_URL`** wrong or missing |
| Upload / CORS errors | CORS on **`fayda-input`** for your Vercel origin |
| Large PDF fails without S3 | Set all **`S3_*`**; or see [Vercel limits](https://vercel.com/docs/functions/limitations) for tiny uploads only |
| Stuck **Queued** | Worker asleep, bad **`REDIS_URL`**, or crashed — **Render Logs** |
| Done in worker, UI never updates | **`FRONTEND_BASE_URL`** ≠ Vercel URL, or **`WORKER_CALLBACK_TOKEN`** mismatch |
| S3 errors on worker | **`S3_*`** match Vercel; buckets exist; **`S3_FORCE_PATH_STYLE`** correct |

---

## 9. Local development

Use **Docker Compose** (Postgres, Redis, MinIO if needed) plus:

- `frontend/.env.local`  
- `worker/.env`  

See **`frontend/.env.local.example`** and **`worker/.env.example`**.

**Windows:** Start **`npm run dev`** before the worker. Use **`FRONTEND_BASE_URL=http://127.0.0.1:3000`** in `worker/.env` (the worker maps `localhost` → `127.0.0.1` for HTTP callbacks to avoid IPv6 issues).

---

## 10. Printable checklist

```
□ Neon          → DATABASE_URL
□ Upstash       → REDIS_URL (rediss://)
□ R2 / Supabase → buckets + S3_* + CORS on fayda-input
□ Resend        → RESEND_API_KEY, EMAIL_FROM
□ Secret        → WORKER_CALLBACK_TOKEN (copy to Vercel + Render)
□ Vercel        → Root frontend, all env vars, deploy, APP_URL, redeploy
□ Render        → Root worker, Docker, env = same Redis/S3/token + FRONTEND_BASE_URL
□ Vercel        → optional WORKER_BASE_URL → redeploy
□ Test          → register, convert, history, forgot password
```

**Variable name list:** `deployment/production-env.template.txt`

---

*If a deploy fails, fix one variable at a time using **§8** and provider logs (Vercel Build / Render Logs).*
