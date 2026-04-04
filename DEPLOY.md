# First-time deployment guide (clear & detailed)

Read **“Big picture”** once. Then use **either** the path below for **“Vercel already deployed”** (most people finishing production) **or** the **full checklist** if you are starting from zero.

---

## Frontend already on Vercel — what to do next (your path)

Assume **Next.js is live** on Vercel (**Root Directory** should be **`frontend`**). The site can load and still be **incomplete** until the backing services and worker match this guide.

Do these **in order**:

| # | What you do |
|---|-------------|
| **1** | **Cloud services (Part A):** If you have not already, create **Neon**, **Upstash Redis**, **R2 or Supabase Storage**, and **Resend** (or SMTP). You need working **`DATABASE_URL`**, **`REDIS_URL`**, all **`S3_*`**, and email vars. |
| **2** | **Sync Vercel env (Part B3):** In **Vercel → your project → Settings → Environment Variables**, confirm **every** variable in **B3** is set for **Production** (and Preview if you use it). Pay special attention to **`APP_URL`** = your real site URL (https, **no** trailing slash) — then **Redeploy** after changes. |
| **3** | **One shared secret:** **`WORKER_CALLBACK_TOKEN`** must be the **same** on Vercel and on the worker. If the worker is not deployed yet, generate a long random string now, set it on Vercel, redeploy, then use the same value in Part C. |
| **4** | **Deploy the worker (Part C):** On **Railway**, **Render**, or **Fly**, deploy from the **`worker/`** folder (Dockerfile). Set **`FRONTEND_BASE_URL`** to your **exact** Vercel production URL. Copy **`REDIS_URL`**, **`S3_*`**, and **`WORKER_CALLBACK_TOKEN`** from Vercel. |
| **5** | **Optional on Vercel:** After the worker has a URL, add **`WORKER_BASE_URL`** = worker’s `https://…` (helps **`/api/worker/health`**; conversions can work without it). **Redeploy** Vercel. |
| **6** | **Git in sync:** Push code changes to the **same GitHub repo** Vercel is connected to so production stays up to date (**Part B1**). |
| **7** | **Test (Part D):** Register, **Convert** a PDF, **Forgot password**. If **Convert** hangs, the worker or Redis/S3/token/URL mismatch is almost always the cause — see **“If something fails”** at the end. |

---

## Full checklist (starting from zero)

Use this if you have **not** put the site on Vercel yet.

| Step | Section | What you do |
|------|---------|-------------|
| 1 | **Part A** | Create **Neon**, **Upstash**, **R2 or Supabase**, **Resend**. Copy values for Vercel + worker. |
| 2 | **Part B** | GitHub → Vercel import, **Root Directory = `frontend`**, **B3** env vars, deploy, fix **`APP_URL`**, redeploy. |
| 3 | **`WORKER_CALLBACK_TOKEN`** | Same value on Vercel and worker (see Part C). |
| 4 | **Part C** | Deploy worker (**Railway** / **Render** / **Fly**). |
| 5 | **Optional** | **`WORKER_BASE_URL`** on Vercel. |
| 6 | **Part D** | End-to-end tests. |

**If Convert spins forever:** the worker is not running, cannot reach Redis, or **`WORKER_CALLBACK_TOKEN`** / **`FRONTEND_BASE_URL`** do not match Vercel. Use your host’s **logs** (see Part C) and the table at the end of this file.

**Payment methods:** Some providers (including **Fly.io**, **Railway**, **Render**, **Cloudflare**) ask for a **card on file** even when you stay on a free tier. If one host insists on billing you do not want, try another option in Part C or a small **VPS** where you run Docker yourself.

---

## Big picture — why you need more than one website

Your app is **not** a single program. On your computer you run:

1. **Next.js** (the website people see)  
2. **PostgreSQL** (database: users, logins, jobs)  
3. **Redis** (a short waiting line for “convert this PDF” jobs)  
4. **A Python worker** (actually reads the PDF, makes the PNG)  
5. **Disk or cloud storage** (where the PDF and PNG files live)

On **Vercel**, you only host the **Next.js** part. Vercel does **not** run the Python worker and does **not** share a folder with that worker. So in production you:

| Piece | Where it usually lives | What it’s for |
|--------|-------------------------|---------------|
| Website (Next.js) | **Vercel** | Pages, login, upload API, admin |
| Database | **Neon** (or similar) | Same as local Postgres |
| Queue | **Upstash Redis** | Same as local Redis |
| Files (PDF/PNG) | **Cloudflare R2** or **Supabase Storage** (S3 API) | Same idea as local `storage/` or MinIO |
| PDF → image worker | **Railway**, **Render**, or **Fly.io** (see Part C) | Must stay **running** to drain the Redis queue (avoid “sleeping” free tiers for the worker if jobs stall) |
| “Forgot password” emails | **Resend** (or Gmail SMTP) | Sends the reset link |

**If the worker is missing or misconfigured:** the site may load, but **Convert** spins forever — because nothing is taking jobs from Redis.

**If R2/S3 is missing or wrong:** upload or download can fail — Vercel and the worker must use the **same** bucket settings.

---

## Before you start — what you need

1. **This project** on **GitHub** (or the same Git host Vercel uses) — **required** so Vercel can build; keep pushing **`main`** (or your production branch) after changes.  
2. Accounts: **Vercel** (already done if the frontend is live), **Neon**, **Upstash**, **either** Cloudflare (R2) **or** Supabase (Storage), **Resend** (or SMTP), and **one** worker host from Part C (**Railway**, **Render**, or **Fly.io**).  
3. **Time:** ~15–20 min if Vercel is already deployed and you only add services + worker; longer if you start from scratch.  
4. **Fly.io only:** install the **Fly CLI** on your PC if you choose Fly: [Install flyctl](https://fly.io/docs/hands-on/install-flyctl/). Railway and Render use their websites (CLI optional).

**Environment variables:** these are **secret settings** the server reads (like your `.env.local` locally). You paste them into **Vercel → Project → Settings → Environment Variables** and into your worker service using that platform’s **Variables / Secrets** UI (or `fly secrets set` on Fly).

**`WORKER_CALLBACK_TOKEN`:** one long random password **you invent** (e.g. 40+ letters/numbers). It must be **exactly the same** on Vercel and on the worker. The worker proves to your website “it’s really me” when a job finishes.

---

# Part A — Create the cloud services (do in order)

## A1. Neon — PostgreSQL database

1. Open [https://neon.tech](https://neon.tech) and sign up.  
2. **Create project** → choose a region close to you → create.  
3. Find **Connection string** (URI). It looks like:  
   `postgresql://user:pass@ep-something.region.aws.neon.tech/neondb?sslmode=require`  
4. **Copy the whole string.** This is **`DATABASE_URL`**.  
   - Keep it secret. Never commit it to Git.

---

## A2. Upstash — Redis (job queue)

1. Open [https://upstash.com](https://upstash.com) and sign up.  
2. **Create database** → type **Redis** → pick a region (often same as Neon).  
3. After creation, open the database → copy the **REST URL** is not what we need; copy the **Redis URL** that starts with **`rediss://`** (TLS).  
4. That full URL is **`REDIS_URL`**.  
5. Use the **same** URL later on Vercel **and** on the worker.

---

## A3. File storage (PDFs and PNGs) — pick **one**

Both options use the **same S3-style variables** in this app (`S3_ENDPOINT`, keys, buckets). Vercel and the **worker** must use **identical** values.

### Choose Supabase Storage if…

You want to avoid Cloudflare / a card on file, and you are OK with the **free tier** (about **1 GB** total file storage and per-file limits — check [Supabase Storage limits](https://supabase.com/docs/guides/storage/uploads/file-limits)). Fine for starting out; upgrade when you sell at volume.

### Choose Cloudflare R2 if…

You want a larger **free storage allowance** (10 GB-month on Standard) and are OK creating a Cloudflare account (they may ask for a payment method even on the free tier).

---

### A3a. Supabase Storage (S3-compatible API)

1. Sign up at [https://supabase.com](https://supabase.com) → **New project** (you can use Supabase **only** for Storage; your app can keep **Neon** for `DATABASE_URL`).  
2. Wait until the project is ready. In the left sidebar open **Storage**.  
3. **New bucket** → name **`fayda-input`** → create (default **private** is OK).  
4. **New bucket** → name **`fayda-output`** → create.  
5. Open **Project Settings** (gear) → **Storage** (or **Storage → S3 connection** depending on UI). Find the **S3** section:  
   - **Endpoint** — use the **storage** hostname, not the main API URL. It looks like:  
     `https://<project-ref>.storage.supabase.co/storage/v1/s3`  
     ([Supabase S3 auth docs](https://supabase.com/docs/guides/storage/s3/authentication))  
   - **Region** — copy the value shown (e.g. `us-east-1`).  
6. **Generate new S3 access keys** (Access Key ID + Secret Access Key). Copy both once; the secret is shown only at creation.

Set these everywhere (Vercel + worker):

| Name | Value |
|------|--------|
| `S3_ENDPOINT` | `https://<project-ref>.storage.supabase.co/storage/v1/s3` |
| `S3_REGION` | Your project region from the dashboard |
| `S3_ACCESS_KEY` | Supabase S3 access key id |
| `S3_SECRET_KEY` | Supabase S3 secret |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | **`true`** (required for Supabase S3) |

The app may try to auto-create buckets; on Supabase you already created them manually — that is fine.

---

### A3b. Cloudflare R2

Think of R2 as a hard drive in the cloud that both Vercel and the worker can access using the same login.

1. Sign in at [https://dash.cloudflare.com](https://dash.cloudflare.com).  
2. Go to **R2** in the sidebar.  
3. **Create bucket** → name **`fayda-input`**.  
4. **Create bucket** → name **`fayda-output`**.  
5. Note **Account ID** and S3 API **endpoint**:  
   `https://<YOUR_ACCOUNT_ID>.r2.cloudflarestorage.com`  
6. **Manage R2 API Tokens** → **Create API token** → read/write on those buckets → copy **Access Key ID** and **Secret Access Key**.

| Name | Typical value |
|------|----------------|
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY` | (from token) |
| `S3_SECRET_KEY` | (from token) |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | `false` |

---

## A4. Resend — password reset emails

1. Sign up at [https://resend.com](https://resend.com).  
2. **API Keys** → create a key → copy it → this is **`RESEND_API_KEY`**.  
3. **Domains** → add and verify your domain (DNS records they give you).  
4. **`EMAIL_FROM`** must use that domain, e.g. `Fayda ID <noreply@yourdomain.com>`.  
   - Until the domain is verified, Resend may only allow test sending; follow their docs.

*(Alternative: Gmail + app password — see `frontend/.env.local.example`.)*

---

# Part B — Vercel (new deploy or update existing)

If the frontend is **already** on Vercel, skip **B2** and go straight to **B3**: open **Settings → Environment Variables**, verify every variable, set **`APP_URL`** to your live URL, then **Deployments → … → Redeploy** production. Push new commits via **B1** when you change the app code.

## B1. Put code on GitHub (full steps)

### If you already cloned from GitHub

Your PC folder is linked to a remote called **`origin`**. From the **repository root** (the folder that contains `frontend/` and `worker/`):

```powershell
cd C:\Users\hp\Documents\fayda-id-printer
git status
git add -A
git commit -m "Describe your changes, e.g. deployment docs and admin features"
git push origin main
```

- If Git asks you to log in, use **GitHub → Settings → Developer settings → Personal access tokens** and sign in with the token when prompted (HTTPS), or install [GitHub CLI](https://cli.github.com/) and run `gh auth login`.  
- Never commit secrets: **`frontend/.env.local`** and **`worker/.env`** are listed in `.gitignore`.

### If this folder is not on GitHub yet

1. Open [https://github.com/new](https://github.com/new).  
2. Repository name: e.g. `fayda-id-printer` → **Create repository** (no README if you already have code locally).  
3. In PowerShell, from your project folder:

```powershell
cd C:\path\to\fayda-id-printer
git init
git branch -M main
git add -A
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Replace `YOUR_USERNAME` / `YOUR_REPO` with your GitHub username and repo name. Use the URL GitHub shows after you create the empty repo.

## B2. Create the Vercel project (skip if the project already exists)

1. Go to [https://vercel.com](https://vercel.com) → sign up (often “Continue with GitHub”).  
2. **Add New… → Project** → **Import** your repository.  
3. **Important — Root Directory:** click **Edit** → set to **`frontend`** (not the repo root).  
4. Framework should auto-detect **Next.js**.  
5. Expand **Environment Variables** and add **each** row from **B3** (or add them later under **Settings → Environment Variables** and redeploy).

### B3. Environment variables on Vercel (copy names exactly)

**If the site is already deployed:** use this as a **checklist**. Missing **`REDIS_URL`**, **`S3_*`**, or a wrong **`APP_URL`** is a common reason uploads, login, or **Convert** fail. After any change here, trigger a **production redeploy**.

**Database & queue**

- `DATABASE_URL` → paste Neon connection string  
- `REDIS_URL` → paste Upstash `rediss://...`  

**Security (same value you will set on the worker in Part C)**

- `WORKER_CALLBACK_TOKEN` → e.g. open PowerShell and run:  
  `[guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()`  
  or any long random string — **copy it somewhere safe**

**Admin & URLs**

- `ADMIN_EMAIL` → optional extra admin (comma-separated list in **`ADMIN_EMAILS`** if you need several). Addresses in **`frontend/src/lib/admin-config.ts`** (`ADMIN_EMAILS_FROM_CONFIG`) are **always** admins too — use the same email you will register.  
- `APP_URL` → for the **first** deploy, use a placeholder like `https://placeholder.vercel.app` — **after** the first successful deploy, Vercel shows your real URL (e.g. `https://fayda-xxx.vercel.app`). Then go back to **Settings → Environment Variables**, set **`APP_URL`** to that **exact** URL (https, **no** trailing slash), save, and **Redeploy** so password reset links are correct.

**Object storage (S3-compatible — same set for R2 or Supabase)**

- `S3_ENDPOINT` — R2: `https://…r2.cloudflarestorage.com` · Supabase: `https://<ref>.storage.supabase.co/storage/v1/s3`  
- `S3_REGION` — R2: `auto` · Supabase: copy from project Storage / S3 settings  
- `S3_ACCESS_KEY`  
- `S3_SECRET_KEY`  
- `S3_BUCKET_INPUT` → `fayda-input`  
- `S3_BUCKET_OUTPUT` → `fayda-output`  
- `S3_FORCE_PATH_STYLE` → **`true`** for Supabase · **`false`** for R2  

**Email**

- `RESEND_API_KEY`  
- `EMAIL_FROM` → e.g. `Fayda <noreply@yourdomain.com>`  

**Optional**

- `DISABLE_ADMIN_APPROVAL` → only set to `true` if you want everyone to log in without admin approval (not recommended for selling access).

**After the worker has a public URL (Part C):** optionally add **`WORKER_BASE_URL`** → `https://your-worker-host...` (no trailing slash) so the site can probe **`/health`** on the worker. Conversions still work via Redis if you skip this.

**New Vercel project only:** click **Deploy**, wait for it to finish, then set **`APP_URL`** to the real URL Vercel shows and **redeploy** if you used a placeholder first.

**Existing Vercel project:** **Deployments** tab → open the latest production deployment menu → **Redeploy** whenever you change environment variables or want to pick up the latest Git commit.

---

# Part C — Deploy the Python worker (Railway, Render, or Fly.io)

The worker is a **Docker** app in the **`worker/`** folder (`worker/Dockerfile`). It must:

- Connect to **the same** **`REDIS_URL`** as Vercel (Upstash).  
- Use **the same** **`S3_*`** values as Vercel.  
- Call your Next.js app at **`FRONTEND_BASE_URL`** (your real Vercel URL, **no** trailing slash) with header **`x-worker-token`** = **`WORKER_CALLBACK_TOKEN`** (same string as on Vercel).

**`PORT`:** Render and Railway set **`PORT`** automatically. The Dockerfile already uses **`${PORT:-8001}`** — no extra config needed.

Pick **one** host below.

---

## C0 — Worker environment variables (every platform)

Add these in the worker service’s **Environment / Variables** UI (or Fly secrets). Names must match exactly.

| Variable | Value |
|----------|--------|
| `REDIS_URL` | Same Upstash URL as on Vercel (`rediss://…`) |
| `FRONTEND_BASE_URL` | `https://your-project.vercel.app` (exact production URL, no `/` at end) |
| `WORKER_CALLBACK_TOKEN` | Same long random string as on Vercel |
| `S3_ENDPOINT` | Same as Vercel |
| `S3_REGION` | Same as Vercel |
| `S3_ACCESS_KEY` | Same as Vercel |
| `S3_SECRET_KEY` | Same as Vercel |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | `true` (Supabase) or `false` (R2) — same as Vercel |

Optional: `LOG_LEVEL=INFO` — fine to omit.

After deploy, open **`https://<your-worker-host>/health`** in a browser; you should see JSON like `{"status":"ok",...}`.

---

## C1 — Railway (no Fly CLI required)

1. Sign up at [railway.app](https://railway.app) (often “Login with GitHub”).  
2. **New project** → **Deploy from GitHub repo** → select this repository.  
3. Railway may create a service from the whole repo. Open the service **Settings** and set **Root Directory** to **`worker`** (so the build uses `worker/Dockerfile`).  
4. **Variables** tab → add every row from **C0** above.  
5. **Settings → Networking / Generate domain** (or equivalent) so the service gets a public **`https://…up.railway.app`** URL.  
6. Trigger a **deploy** and watch **Deploy Logs** until the container stays healthy.  
7. Copy the public URL → optionally set **`WORKER_BASE_URL`** on Vercel to that URL (see Part B).

[Railway docs — Deploying a Dockerfile](https://docs.railway.com/guides/dockerfiles)

---

## C2 — Render (no Fly CLI required)

1. Sign up at [render.com](https://render.com).  
2. **New +** → **Web Service** → connect this GitHub repository.  
3. **Root Directory:** `worker`  
4. **Runtime:** **Docker** (Render should detect `Dockerfile`).  
5. **Instance type:** choose a plan that stays **awake** if you can — a sleeping free web service may **not** process the queue reliably.  
6. **Environment** → add all variables from **C0**.  
7. **Health check path:** `/health` (optional but recommended).  
8. **Create Web Service**, wait for deploy, then copy the **`https://…onrender.com`** URL → optional **`WORKER_BASE_URL`** on Vercel.

[Render docs — Docker deploy](https://render.com/docs/docker)

---

## C3 — Fly.io (CLI)

Use this if you are fine with Fly’s signup/billing flow.

### C3a. Install CLI and log in

```powershell
cd C:\path\to\fayda-id-printer\worker
fly auth login
```

### C3b. First-time app creation

```powershell
fly launch
```

- You can change **`app = "..."`** in `fly.toml` if the name is taken.  
- Say **no** to adding Postgres/Redis on Fly (you use Neon + Upstash).  
- You can deploy after secrets are set.

### C3c. Set secrets (PowerShell line continuation uses `` ` `` or put one variable per line)

Use your **real** Vercel URL and the same values as **C0**.

**Example — Cloudflare R2**

```powershell
fly secrets set `
  REDIS_URL="rediss://YOUR_UPSTASH_URL" `
  FRONTEND_BASE_URL="https://YOUR-PROJECT.vercel.app" `
  WORKER_CALLBACK_TOKEN="PASTE_EXACT_SAME_AS_VERCEL" `
  S3_ENDPOINT="https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com" `
  S3_REGION="auto" `
  S3_ACCESS_KEY="..." `
  S3_SECRET_KEY="..." `
  S3_BUCKET_INPUT="fayda-input" `
  S3_BUCKET_OUTPUT="fayda-output" `
  S3_FORCE_PATH_STYLE="false"
```

**Example — Supabase Storage**

```powershell
fly secrets set `
  REDIS_URL="rediss://YOUR_UPSTASH_URL" `
  FRONTEND_BASE_URL="https://YOUR-PROJECT.vercel.app" `
  WORKER_CALLBACK_TOKEN="PASTE_EXACT_SAME_AS_VERCEL" `
  S3_ENDPOINT="https://YOUR_PROJECT_REF.storage.supabase.co/storage/v1/s3" `
  S3_REGION="us-east-1" `
  S3_ACCESS_KEY="..." `
  S3_SECRET_KEY="..." `
  S3_BUCKET_INPUT="fayda-input" `
  S3_BUCKET_OUTPUT="fayda-output" `
  S3_FORCE_PATH_STYLE="true"
```

*(On **cmd.exe** you can use `^` at the end of each line instead of `` ` ``.)*

### C3d. Deploy and logs

```powershell
fly deploy
fly logs
```

You want to see the worker running and callbacks targeting your Vercel URL. Fly assigns **`https://<app>.fly.dev`** — you can set **`WORKER_BASE_URL`** on Vercel to that URL if you use the health route.

---

## C4 — After the worker is live

1. Confirm **`GET https://<worker-host>/health`** returns OK.  
2. On Vercel, confirm **`WORKER_CALLBACK_TOKEN`**, **`REDIS_URL`**, and all **`S3_*`** match the worker.  
3. Optional: set **`WORKER_BASE_URL`** on Vercel to the worker’s public URL.  
4. Redeploy Vercel if you changed variables.  
5. Run **Part D** tests.

---

# Part D — Test everything (same as local)

1. Open your **live site** (your Vercel production URL or custom domain).  
2. **Register** a test user → if approval is on, they stay **pending** until an admin approves them.  
3. **Register / log in** with an email that is in **`ADMIN_EMAILS_FROM_CONFIG`** in `frontend/src/lib/admin-config.ts` **or** listed in **`ADMIN_EMAIL` / `ADMIN_EMAILS`** on Vercel → open **`/admin`** → **Approve** the test user if they are still pending.  
4. Log in as the test user → upload a PDF → **Convert** → wait for preview/download.  
5. **Forgot password** on the test user → check email → open link → set new password → log in.

---

## If something fails

| Symptom | What to check |
|---------|----------------|
| Convert never finishes | Worker **deployed** and **not sleeping**? **Logs** on Railway / Render / Fly. Same **`REDIS_URL`** on Vercel and worker? Same **`WORKER_CALLBACK_TOKEN`**? **`FRONTEND_BASE_URL`** = exact Vercel URL (https, no trailing slash)? |
| Upload error | All **`S3_*`** on Vercel correct? Buckets exist? |
| Worker cannot read file | **`S3_*`** keys, endpoint, **`S3_FORCE_PATH_STYLE`**, and bucket names **identical** on Vercel and worker |
| Reset email wrong link | **`APP_URL`** on Vercel = real site URL, then redeploy |
| 401 on job complete | **`WORKER_CALLBACK_TOKEN`** mismatch between Vercel and worker |
| Cannot open `/admin` | Your login email must be in **`ADMIN_EMAILS_FROM_CONFIG`** and/or **`ADMIN_EMAIL` / `ADMIN_EMAILS`** on Vercel |

---

## Quick reference table

| Service | Role |
|---------|------|
| Vercel | Next.js website |
| Neon | Postgres database |
| Upstash | Redis queue |
| R2 or Supabase Storage | File storage (S3 API) |
| Railway, Render, or Fly.io | Python worker (Docker) |
| Resend | Emails |

All variable names in one place: **`deployment/production-env.template.txt`**.

---

## Local development (reminder)

From the repo: `docker compose up -d`, then `frontend/.env.local` + `worker/.env` as in the `.env.example` files. You do **not** need Vercel or a cloud worker for daily coding on your machine.
