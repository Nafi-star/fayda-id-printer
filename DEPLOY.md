# Deploy Fayda ID Printer

**Rule:** Vercel is only the website. **Conversion runs on Render** (`worker/`). Use **`WORKER_CALLBACK_TOKEN`** on both; **`FRONTEND_BASE_URL` on Render = `APP_URL` on Vercel** (exact URL, **no** trailing `/`).

Worksheet: `deployment/production-env.template.txt` · Never commit secrets.

---

## Easiest fix if jobs stay “Queued” (HTTP direct — no Redis queue)

Vercel can call your Render worker **directly** (no Upstash queue). Set **on Vercel (Production)**:

| Variable | Value |
|----------|--------|
| **`WORKER_HTTP_URL`** | `https://YOUR-SERVICE.onrender.com` — **no** trailing `/` |
| **`WORKER_CALLBACK_TOKEN`** | **Same** as on Render |
| **`S3_*`** | Same as Render (uploads + worker read/write) |

**Where does `WORKER_HTTP_URL` come from?** It is **not** a variable that Render creates for you. It is the **public URL of your worker Web Service** — the same address you use in the browser for `/health`. Find it in the [Render dashboard](https://dashboard.render.com): open your **worker** service → copy the URL at the top (e.g. `https://fayda-worker-xxxx.onrender.com`). Paste that **only into Vercel** as `WORKER_HTTP_URL`. You do **not** add `WORKER_HTTP_URL` on Render.

**Render** still needs the worker running (Docker, `worker/`), same **`S3_*`**, same token. **`REDIS_URL`** is optional for this path (Redis is only used by the old queue consumer).

Redeploy **Vercel** after saving env vars.

**Note:** Vercel **Hobby** limits serverless time (~**10s**). Large PDFs may need **Vercel Pro** (longer limits) or a small test PDF for demos.

---

## Deploy in this order (do not skip checks)

**0 — Build passes (once, on your PC)**  
`cd frontend` → `npm ci` → `npm run build` (Node 20+). Fix errors before cloud deploy.

**1 — Generate a secret**  
PowerShell: `[guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()` → save as **`WORKER_CALLBACK_TOKEN`** (you will paste it in **both** Vercel and Render).

**2 — Neon** → copy **`DATABASE_URL`**.

**3 — Upstash Redis** → copy **`REDIS_URL`** (`rediss://…`).

**4 — Object storage (R2 *or* Supabase S3)**  
Buckets **`fayda-input`** and **`fayda-output`**. Note **`S3_ENDPOINT`**, **`S3_REGION`**, keys, **`S3_FORCE_PATH_STYLE`**: **`false`** for R2, **`true`** for Supabase.  
R2: set bucket **`fayda-input`** CORS → your site origin, methods **GET, PUT, HEAD**, headers **\*** or **Content-Type**.

**5 — Resend** → **`RESEND_API_KEY`**, **`EMAIL_FROM`** (verified domain).

**6 — Vercel: create project**  
Import repo · **Root Directory = `frontend`** · Next.js default.

**7 — Vercel: Environment Variables (Production)** — add everything **except** leave **`APP_URL` blank or temporary** for the first deploy:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon |
| `REDIS_URL` | Upstash, same string you will put on Render |
| `WORKER_CALLBACK_TOKEN` | From step 1 |
| `S3_*` | All six + correct **`S3_FORCE_PATH_STYLE`** |
| `RESEND_API_KEY`, `EMAIL_FROM` | |
| Optional | `ADMIN_EMAIL` / `ADMIN_EMAILS` |

**8 — Vercel: first deploy** → when it succeeds, set **`APP_URL`** = your real URL, e.g. `https://your-name.vercel.app` → **Save** → **Redeploy** Production.

**9 — Render: Web Service**  
Same repo · **Root Directory = `worker`** · **Docker** · Health check **`/health`**.

**10 — Render: Environment** — copy-paste from Vercel for every row:

| Variable | Value |
|----------|--------|
| `REDIS_URL` | **Same as Vercel** |
| `FRONTEND_BASE_URL` | **Same as Vercel `APP_URL`** (copy-paste) |
| `WORKER_CALLBACK_TOKEN` | **Same as Vercel** |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | **Same as Vercel** |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | **Same as Vercel** |

**11 — Check worker** → wait **Live** → browser: `https://YOUR-SERVICE.onrender.com/health` → must show **`"status":"ok"`**.

**12 — Test the site** → log in → upload PDF → **Convert** → wait up to **~1 min** on Render free (cold start). Result should leave **Queued** and finish.

---

## If Convert stays “Queued”

1. **Render → Logs** (errors while you click Convert).  
2. **`FRONTEND_BASE_URL`** must equal **`APP_URL`** (wrong host = callbacks never update the DB).  
3. **`REDIS_URL`** must be **identical** on Vercel and Render.  
4. **`WORKER_CALLBACK_TOKEN`** must be **identical**; empty/wrong on Vercel → **401** on callback.

---

## Architecture (short)

| Part | Host | Needs |
|------|------|--------|
| Site + queue push | Vercel | `DATABASE_URL`, `REDIS_URL`, `S3_*`, `WORKER_CALLBACK_TOKEN`, `APP_URL`, Resend |
| PDF → PNG + callback | Render | Same `REDIS_URL`, `S3_*`, token + **`FRONTEND_BASE_URL` = `APP_URL`** |

Worker does **not** need `DATABASE_URL` for conversion.

---

## After deploy: file cleanup

Old jobs lose S3 files after **24h**; the worker calls Vercel with the same token. Wrong token → cleanup skipped.

---

## Local (quick)

`docker compose up -d redis worker` from repo root → `cd frontend && npm run dev` → same **`WORKER_CALLBACK_TOKEN`** in `frontend/.env.local` as in compose (see `frontend/.env.local.example`).  
Or run the worker on the host: `worker/.env` with `FRONTEND_BASE_URL=http://127.0.0.1:3000` + `pip install` + `uvicorn` (see that example file).

---

## Copy-paste checklist

```
□ npm run build (frontend) OK
□ WORKER_CALLBACK_TOKEN generated → Vercel + Render
□ Neon, Upstash, S3 buckets, Resend ready
□ Vercel: root frontend, env vars, deploy → APP_URL → redeploy
□ Render: root worker, Docker, env = mirror Vercel + FRONTEND_BASE_URL = APP_URL
□ /health on Render returns ok
□ Live site: Convert completes
```

*Pushes to `main` run `npm run build` in CI — keep builds green.*
