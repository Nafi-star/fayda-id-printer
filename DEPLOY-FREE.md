# Free-tier deployment (full stack)

## Start now (do these in order)

**Repo / CI:** Pushing to `main` runs `.github/workflows/ci.yml` (Next.js production build). Fix failures before relying on Render.

1. **GitHub:** Push this repository to GitHub (see commands below if you have not yet).
2. **Neon:** Create DB → copy `DATABASE_URL` (pooled URL if offered).
3. **Upstash:** Create Redis → copy `REDIS_URL` (use `rediss://` if available).
4. **Cloudflare R2:** Two buckets + S3 API token → fill all `S3_*` fields.
5. **Secret:** Run `openssl rand -hex 32` (or any long random string) → `WORKER_CALLBACK_TOKEN` (same on both Render services).
6. **Render:** Dashboard → **New** → **Blueprint** → connect repo → select `render.yaml` → paste env vars when asked.
7. **After frontend URL exists:** Set `FRONTEND_BASE_URL` on the worker → **Manual Deploy** worker again.
8. **Test:** Open `https://…onrender.com/login` → register → convert a PDF.

**Only you can do in the browser:** Neon, Upstash, R2, and Render account steps — the codebase cannot log in for you. After each Git push, use Render **Manual Deploy → Deploy latest commit** (or enable auto-deploy) so production matches GitHub.

Fill blanks using `deploy/RENDER-ENV-CHECKLIST.txt` as a worksheet (keep secrets out of git).

### Push to GitHub (if the remote is empty or you need a first push)

```bash
git add -A
git commit -m "Add free-tier Render deploy and env checklist"
git push origin main
```

---

This app needs **five pieces** working together, like on your PC:

| Piece | Free option |
|--------|-------------|
| Postgres | [Neon](https://neon.tech) (free tier) |
| Redis queue | [Upstash](https://upstash.com) Redis (free tier) |
| File storage (S3) | [Cloudflare R2](https://developers.cloudflare.com/r2/) (free allowance) |
| Next.js (UI + APIs) | [Render](https://render.com) Web Service — **free** (`*.onrender.com`) |
| Python worker | Render Web Service (Docker) — **free** (`*.onrender.com`) |

**Why Render for the website (not only Vercel)?**  
On Vercel’s free plan, API routes have a **small request body limit** (~4.5 MB). PDF uploads can exceed that. Render’s Node service is more forgiving for file uploads.

**Free tier honesty:** Render free apps **sleep after ~15 minutes** without traffic. The first visit after sleep can take **30–60+ seconds** to wake. The **worker** also sleeps — queued jobs may wait until the worker wakes (opening its URL or a free uptime ping helps). For a serious business later, a small paid plan removes sleep.

---

## 1) Neon (database)

1. Sign up at [neon.tech](https://neon.tech).
2. Create a project → copy the **connection string** (use the **pooled** / “transaction” URL if Neon offers it — better for serverless-style connections).
3. It should look like: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
4. Save this as **`DATABASE_URL`** (you will paste it into Render twice: frontend + worker).

---

## 2) Upstash (Redis)

1. Sign up at [upstash.com](https://upstash.com).
2. Create a **Redis** database.
3. Copy the **Redis URL**. Prefer **`rediss://`** (TLS) if shown.
4. Save as **`REDIS_URL`** (frontend + worker on Render).

---

## 3) Cloudflare R2 (S3-compatible storage)

1. In Cloudflare Dashboard → **R2** → enable billing (often **$0** within free tier limits; you may need a card on file).
2. Create two buckets, e.g. `fayda-input` and `fayda-output`.
3. Create **R2 API tokens** (S3-compatible access key + secret).
4. Note the **S3 API endpoint**, e.g. `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
5. Set these everywhere you deploy the app (frontend + worker):

| Variable | Example |
|----------|---------|
| `S3_ENDPOINT` | `https://xxxx.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY` | R2 access key id |
| `S3_SECRET_KEY` | R2 secret |
| `S3_BUCKET_INPUT` | `fayda-input` |
| `S3_BUCKET_OUTPUT` | `fayda-output` |
| `S3_FORCE_PATH_STYLE` | `true` |

**Do not** commit keys to git. Only paste into Render **Environment** (or your host’s env UI).

---

## 4) Shared secret (worker ↔ Next.js)

Generate a long random string (password manager or):

```bash
# Linux/macOS/WSL
openssl rand -hex 32
```

Use the **same** value in:

- **`WORKER_CALLBACK_TOKEN`** (Next.js / Render frontend)
- **`WORKER_CALLBACK_TOKEN`** (worker)

The worker sends it as header `x-worker-token` to `/api/internal/jobs/update`.

---

## 5) Deploy on Render (blueprint)

1. Push this repo to **GitHub** (or GitLab / Bitbucket).
2. In Render: **New** → **Blueprint** → connect the repo → select `render.yaml`.
3. Render will propose two services: `fayda-frontend` and `fayda-worker`.
4. When prompted, set **all** `sync: false` variables (Neon, Upstash, R2, token).

### Order that avoids mistakes

1. **Deploy `fayda-frontend` first** (or both, but you need the URL next).
2. Copy the frontend URL, e.g. `https://fayda-frontend.onrender.com`.
3. On **`fayda-worker`**, set:

   **`FRONTEND_BASE_URL`** = `https://fayda-frontend.onrender.com`  
   (no trailing slash)

4. Redeploy the worker if it already failed callbacks.

### Frontend env checklist (`fayda-frontend`)

- `DATABASE_URL`
- `REDIS_URL`
- `S3_*` (all six + `S3_FORCE_PATH_STYLE`)
- `WORKER_CALLBACK_TOKEN`
- Optional: `ENFORCE_FREE_TRIAL_LIMIT` = `false` (default behavior is already unlimited unless you set enforcement)

### Worker env checklist (`fayda-worker`)

- `DATABASE_URL` (same as frontend)
- `REDIS_URL` (same)
- `FRONTEND_BASE_URL` (your Render frontend URL)
- `WORKER_CALLBACK_TOKEN` (same as frontend)
- Same `S3_*` as frontend

---

## 6) Smoke test (same as local)

1. Open `https://<your-frontend>.onrender.com/login`
2. Register → **Dashboard**
3. Upload a PDF → **Convert** → wait for **Done** → **Preview** / **Download PNG**

If status stays **Queued**:

- Worker logs on Render (errors / crash)
- Wrong `REDIS_URL` or worker not running
- `FRONTEND_BASE_URL` wrong → job runs but DB never updates to `completed`

### Local Windows: `httpx.ConnectError` / jobs never finish

1. **Start Next.js first:** in `frontend`, run `npm run dev` (default port **3000**).
2. In **`worker/.env`**, set `FRONTEND_BASE_URL=http://127.0.0.1:3000` (not `localhost` if your machine resolves it oddly).
3. **`WORKER_CALLBACK_TOKEN`** must be **identical** in `worker/.env` and `frontend/.env.local`.
4. Restart the worker after changing `.env`.

The worker **retries** callbacks and still runs conversion even if the first “processing” ping fails.

---

## 7) Optional: reduce “sleep” pain (free)

Use a free uptime monitor (e.g. UptimeRobot, cron-job.org) to request:

- Frontend: `https://…onrender.com/login` every 10–15 minutes  
- Worker: `https://…onrender.com/health` every 10–15 minutes  

This does **not** guarantee zero sleep on all free tiers but helps.

---

## Local vs production

- **Local:** Docker Compose Postgres/Redis/MinIO + `npm run dev` + worker uvicorn.
- **Production (this guide):** Neon + Upstash + R2 + two Render services.

The code already uses **S3 when `S3_*` is set**; otherwise it falls back to `./storage` (fine only on one machine).

---

## Repo files added for you

- `render.yaml` — Render Blueprint for frontend + worker  
- `worker/Dockerfile` — worker image for Render Docker runtime  
- `DEPLOY-FREE.md` — this guide  

Frontend `db` / `redis` clients are **lazy-initialized** so `next build` is less likely to require secrets at compile time; runtime still **requires** env vars on the server.
