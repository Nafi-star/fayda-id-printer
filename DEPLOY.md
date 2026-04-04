# First-time deployment guide (clear & detailed)

This document is for you if you have **never deployed** a full web app before. Read the **“Big picture”** section first, then follow **Part A → Part B → Part C** in order.

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
| PDF → image worker | **Fly.io** (or Railway/Render) | Must stay **on** 24/7 to process jobs |
| “Forgot password” emails | **Resend** (or Gmail SMTP) | Sends the reset link |

**If the worker is missing or misconfigured:** the site may load, but **Convert** spins forever — because nothing is taking jobs from Redis.

**If R2/S3 is missing or wrong:** upload or download can fail — Vercel and the worker must use the **same** bucket settings.

---

## Before you start — what you need

1. **This project** pushed to **GitHub** (GitLab/Bitbucket also work with Vercel).  
2. A **free account** on: Vercel, Neon, Upstash, **either** Cloudflare (R2) **or** Supabase (Storage only), Fly.io, Resend.  
3. **15–30 minutes** the first time.  
4. Optional: **Fly CLI** installed on your PC for the worker:  
   - [https://fly.io/docs/hands-on/install-flyctl/](https://fly.io/docs/hands-on/install-flyctl/)

**Environment variables:** these are **secret settings** the server reads (like your `.env.local` locally). You paste them into **Vercel → Project → Settings → Environment Variables** and into **Fly** with `fly secrets set`.

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

Both options use the **same S3-style variables** in this app (`S3_ENDPOINT`, keys, buckets). Vercel and the Fly worker must use **identical** values.

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

Set these everywhere (Vercel + Fly):

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

# Part B — Deploy the website on Vercel

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

## B2. Create the Vercel project

1. Go to [https://vercel.com](https://vercel.com) → sign up (often “Continue with GitHub”).  
2. **Add New… → Project** → **Import** your repository.  
3. **Important — Root Directory:** click **Edit** → set to **`frontend`** (not the repo root).  
4. Framework should auto-detect **Next.js**.  
5. Expand **Environment Variables** and add **each** row below (name = left, value = right).

### B3. Environment variables on Vercel (copy names exactly)

**Database & queue**

- `DATABASE_URL` → paste Neon connection string  
- `REDIS_URL` → paste Upstash `rediss://...`  

**Security (same value you will use on Fly later)**

- `WORKER_CALLBACK_TOKEN` → e.g. open PowerShell and run:  
  `[guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()`  
  or any long random string — **copy it somewhere safe**

**Admin & URLs**

- `ADMIN_EMAIL` → the email you will use as site owner / admin (must match the account you register)  
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

6. Click **Deploy**. Wait until it finishes.  
7. Open the **production URL** → fix **`APP_URL`** + redeploy if you used a placeholder.

---

# Part C — Deploy the Python worker on Fly.io

The worker **must** run continuously and must know your **real** Vercel URL.

## C1. Install Fly CLI and log in

On your computer:

```bash
cd path/to/fayda-id-printer/worker
fly auth login
```

## C2. First-time app creation

```bash
fly launch
```

- When asked for app name, you can change **`app = "..."`** in `fly.toml` if the name is taken.  
- You can say **no** to adding Postgres/Redis on Fly (you already use Neon + Upstash).  
- If it asks to deploy now, you can deploy once secrets are set (next step).

## C3. Set secrets on Fly (replace with YOUR values)

Use your **real** Vercel URL (no slash at the end), same **`WORKER_CALLBACK_TOKEN`** as Vercel, same **`REDIS_URL`** and **the same `S3_*` values** as on Vercel.

**Example — Cloudflare R2**

```bash
fly secrets set ^
  REDIS_URL="rediss://YOUR_UPSTASH_URL" ^
  FRONTEND_BASE_URL="https://YOUR-PROJECT.vercel.app" ^
  WORKER_CALLBACK_TOKEN="PASTE_EXACT_SAME_AS_VERCEL" ^
  S3_ENDPOINT="https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com" ^
  S3_REGION="auto" ^
  S3_ACCESS_KEY="..." ^
  S3_SECRET_KEY="..." ^
  S3_BUCKET_INPUT="fayda-input" ^
  S3_BUCKET_OUTPUT="fayda-output" ^
  S3_FORCE_PATH_STYLE="false"
```

**Example — Supabase Storage** (note endpoint and `S3_FORCE_PATH_STYLE=true`)

```bash
fly secrets set ^
  REDIS_URL="rediss://YOUR_UPSTASH_URL" ^
  FRONTEND_BASE_URL="https://YOUR-PROJECT.vercel.app" ^
  WORKER_CALLBACK_TOKEN="PASTE_EXACT_SAME_AS_VERCEL" ^
  S3_ENDPOINT="https://YOUR_PROJECT_REF.storage.supabase.co/storage/v1/s3" ^
  S3_REGION="us-east-1" ^
  S3_ACCESS_KEY="..." ^
  S3_SECRET_KEY="..." ^
  S3_BUCKET_INPUT="fayda-input" ^
  S3_BUCKET_OUTPUT="fayda-output" ^
  S3_FORCE_PATH_STYLE="true"
```

Replace `S3_REGION` with the region shown in your Supabase Storage S3 settings.

*(On Mac/Linux use backslashes `\` at end of lines instead of `^`.)*

## C4. Deploy the worker

```bash
fly deploy
```

## C5. Check that it is alive

```bash
fly logs
```

You want to see something like: worker started, queue name, and **`callback=https://YOUR-PROJECT.vercel.app`**.  
If you see errors about Redis, S3, or connection refused to Vercel, double-check the secrets above.

---

# Part D — Test everything (same as local)

1. Open your **Vercel URL**.  
2. **Register** a test user → if approval is on, they stay **pending**.  
3. **Register / log in** with **`ADMIN_EMAIL`** → open **`/admin`** → **Approve** the test user.  
4. Log in as test user → upload a PDF → **Convert** → wait for preview/download.  
5. **Forgot password** on the test user → check email → open link → set new password → log in.

---

## If something fails

| Symptom | What to check |
|---------|----------------|
| Convert never finishes | Worker running? `fly logs`. Same `REDIS_URL`? Same `WORKER_CALLBACK_TOKEN` on Vercel and Fly? `FRONTEND_BASE_URL` exact Vercel URL? |
| Upload error | All `S3_*` on Vercel correct? Buckets exist? |
| Worker cannot read file | `S3_*` keys, endpoint, `S3_FORCE_PATH_STYLE`, and bucket names **identical** on Vercel and worker |
| Reset email wrong link | `APP_URL` on Vercel = real site URL, then redeploy |
| 401 on job complete | `WORKER_CALLBACK_TOKEN` mismatch between Vercel and worker |

---

## Quick reference table

| Service | Role |
|---------|------|
| Vercel | Next.js website |
| Neon | Postgres database |
| Upstash | Redis queue |
| R2 or Supabase Storage | File storage (S3 API) |
| Fly.io | Python worker |
| Resend | Emails |

All variable names in one place: **`deployment/production-env.template.txt`**.

---

## Local development (reminder)

From the repo: `docker compose up -d`, then `frontend/.env.local` + `worker/.env` as in the `.env.example` files. You do **not** need Vercel/Fly for daily coding on your machine.
