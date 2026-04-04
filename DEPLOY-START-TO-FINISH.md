# Deploy start to finish (working public website)

Use this as your **only** checklist. Time: about **30–45 minutes** the first time.  
Your code should already be on **GitHub** (e.g. `Nafi-star/fayda-id-printer`).

**Rules**

- Never put passwords or `DATABASE_URL` in git or screenshots you share publicly.
- The **same** secret values go on **both** Render services where noted below.

---

## Step 0 — Before you start

1. Repo is on GitHub and `main` has the latest code (with `render.yaml` in the root).
2. You have a **Render** account: [dashboard.render.com](https://dashboard.render.com) (sign up with GitHub).
3. Optional but recommended: password manager or Notepad file **on your PC only** labeled “Render secrets”.

---

## Step 1 — Neon (Postgres database)

1. Open **[neon.tech](https://neon.tech)** → sign up / log in.
2. **Create project** (any name). Region: **US East** is fine if you use Render **Oregon** or **Virginia** — pick something close to your Render region later.
3. PostgreSQL version: **15** or **16** (both OK).
4. When the project opens, click **Connect** or **Connection details**.
5. Copy the **connection string** that looks like:  
   `postgresql://USER:PASSWORD@ep-xxxxx.neon.tech/neondb?sslmode=require`  
   - Prefer the **pooled** / **pooler** URL if Neon shows two (better for web apps).
6. Paste into your private notes as **`DATABASE_URL`** (you will use this in **Step 5** on Render **twice**: frontend + worker).

**You do not run SQL scripts** for this app — tables are created automatically on first use.

**If you ever leak this URL:** Neon → reset password / rotate credentials → update Render env vars.

---

## Step 2 — Upstash (Redis queue)

1. Open **[upstash.com](https://upstash.com)** → sign up / log in.
2. **Create Redis** database (any name/region).
3. Open the database → copy **Redis URL**.
4. Prefer **`rediss://`** (with **s**) if offered — TLS.
5. Save as **`REDIS_URL`**. You will paste the **same** value on Render for **frontend** and **worker**.

**Why:** “Convert” pushes a job into Redis; the worker reads it. No Redis = conversions never run.

---

## Step 3 — Cloudflare R2 (file storage)

1. Open **[dash.cloudflare.com](https://dash.cloudflare.com)** → log in.
2. Left menu → **R2**. Complete setup if asked (billing method may be required even for free tier).
3. **Create bucket** → name: `fayda-input` → Create.
4. **Create bucket** → name: `fayda-output` → Create.
5. **Manage R2 API Tokens** → **Create API token** with read/write on these buckets (or R2 Admin while learning).
6. Copy **Access Key ID** and **Secret Access Key** (secret shown once — save it).
7. Find **S3 API** endpoint for your account (format like `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).

Write down for Render (same on **frontend** and **worker**):

| Variable | Value |
|----------|--------|
| `S3_ENDPOINT` | Your R2 S3 API URL (https, no bucket name in path) |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY` | Access Key ID |
| `S3_SECRET_KEY` | Secret Access Key |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | `true` |

---

## Step 4 — Shared worker secret

1. Generate a long random string, e.g. PowerShell:  
   `[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")`
2. Save as **`WORKER_CALLBACK_TOKEN`**.
3. You will set the **identical** value on Render for **fayda-frontend** and **fayda-worker**.

---

## Step 5 — Render (host website + worker)

### 5a — Create both services from the repo

1. Go to **[dashboard.render.com](https://dashboard.render.com)**.
2. **New** → **Blueprint**.
3. **Connect** your GitHub account if needed → select repository **`fayda-id-printer`**.
4. Render should detect **`render.yaml`** at the repo root. Confirm **two** services:
   - **`fayda-frontend`** (Node)
   - **`fayda-worker`** (Docker)
5. Click through to create. Render will ask you to fill **environment variables** (many are “set in dashboard” / secret).

### 5b — Environment variables for `fayda-frontend`

Set **exactly** these (values from Steps 1–4):

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon string (Step 1) |
| `REDIS_URL` | Upstash string (Step 2) |
| `S3_ENDPOINT` | Step 3 |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY` | Step 3 |
| `S3_SECRET_KEY` | Step 3 |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | `true` |
| `WORKER_CALLBACK_TOKEN` | Step 4 |
| `ENFORCE_FREE_TRIAL_LIMIT` | `false` |

`NODE_VERSION` / `NODE_ENV` may already be in the blueprint — leave them.

### 5c — Environment variables for `fayda-worker`

Same as frontend for DB, Redis, S3, token:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | **Same** Neon URL as frontend |
| `REDIS_URL` | **Same** as frontend |
| All `S3_*` | **Same** as frontend |
| `WORKER_CALLBACK_TOKEN` | **Same** as frontend |
| `APP_ENV` | `production` (if not already set) |

**`FRONTEND_BASE_URL` (first time):**  
If you don’t have the frontend URL yet, temporarily use `https://example.com` **only** to finish creation — you **must** fix this in Step 6.

### 5d — Wait for deploy

- Wait until **both** services show **Live** (green). First build can take **10–20+ minutes**.
- If a build fails, open **Logs** for that service and fix the error (usually a missing env var or typo).

---

## Step 6 — Point the worker at your real site (required)

1. In Render, open **`fayda-frontend`** → copy the public URL, e.g. `https://fayda-frontend-xxxx.onrender.com`.
2. Open **`fayda-worker`** → **Environment**.
3. Set **`FRONTEND_BASE_URL`** = that URL **exactly**, **no trailing slash**  
   Example: `https://fayda-frontend-xxxx.onrender.com`
4. **Save** → **Manual Deploy** → **Deploy latest commit** for the **worker** only.

**If you skip this:** jobs may stay **Queued** or never show **Done** even if the worker runs.

---

## Step 7 — Prove it works (smoke test)

1. Open `https://<your-frontend>.onrender.com/login` in a **private/incognito** window.
2. **Register** a new account.
3. Go to **Dashboard** → upload a small PDF → **Convert**.
4. Wait until status is **Done** (free tier may **sleep** — first request after idle can take **30–60+ seconds**).
5. **Preview** / **Download PNG**.

**Optional check:** open `https://<your-frontend>.onrender.com/api/worker/health` — should not say the worker is unreachable.

---

## Step 8 — If something fails (quick map)

| Problem | Check |
|---------|--------|
| Frontend **build** fails | Render **Logs** → missing env, typo in `DATABASE_URL` |
| **Register / login** fails | `DATABASE_URL` wrong; Neon project paused |
| Stuck **Queued** | Worker not running; wrong `REDIS_URL`; worker crashed (see worker **Logs**) |
| Job runs but UI never **Done** | **`FRONTEND_BASE_URL`** wrong; **`WORKER_CALLBACK_TOKEN`** mismatch between frontend and worker |
| **Upload** errors | All `S3_*` correct; buckets exist; R2 token has access |
| Very slow first load | Normal on Render **free** (cold start); refresh after ~1 minute |

---

## Step 9 — After deployment (your PC)

- **Do not** commit `.env`, `.env.local`, or Render secrets to GitHub.
- To update the live site: **push to `main`** → on Render, **Deploy latest commit** (or enable auto-deploy).
- **Selling:** this repo does not include payments; you add Stripe (or similar) later. Your live URL can be the free `*.onrender.com` address until you buy a domain.

---

## Copy worksheet

Use **`deploy/RENDER-ENV-CHECKLIST.txt`** in this repo to tick off every variable so nothing is missing.

---

## Local development (separate from cloud)

Your **PC** can still use Docker Postgres (`127.0.0.1:5433`) — see **`SETUP-AND-DEPLOY.md`**.  
**Render always uses Neon** for `DATABASE_URL`, never `localhost`.
