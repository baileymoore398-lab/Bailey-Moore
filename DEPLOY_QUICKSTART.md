# RouteForge — Deploy Quickstart (click-by-click)

> ⚠️ **GitHub Pages does NOT work for RouteForge.** Pages only serves static
> HTML, so it just renders this repo's `README.md`. RouteForge needs a Node host
> (frontend) **and** a Python host + database (backend). Use Vercel + Railway as
> below. If you turned Pages on, disable it: repo **Settings → Pages → Source → None**.

You will deploy **two** things and connect them:

```
  Vercel (frontend)  ───────▶  Railway (backend API + worker + Postgres + Redis)
   your app URL                 your api URL
```

Do the **backend first** (you need its URL for the frontend).

---

## STEP 1 — Backend on Railway (~5 min)

1. Go to **https://railway.app** → sign in with GitHub.
2. **New Project → Deploy from GitHub repo →** pick `baileymoore398-lab/Bailey-Moore`.
3. When the service is created, open it → **Settings**:
   - **Root Directory:** set to `backend`
   - (Railway auto-detects `railway.json`, which builds the Dockerfile and runs
     `alembic upgrade head && uvicorn …`, health check `/health`.)
4. Add a database: **New → Database → Add PostgreSQL.** Railway injects `DATABASE_URL`.
5. Add Redis: **New → Database → Add Redis.** Railway injects `REDIS_URL`.
6. Open the **backend service → Variables** and add:
   | Variable | Value |
   |---|---|
   | `ENV` | `production` |
   | `JWT_SECRET` | a long random string — generate with `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
   | `CORS_ORIGINS` | leave blank for now; you'll set it in Step 3 |
   | `CELERY_TASK_ALWAYS_EAGER` | `false` |
   | `DATABASE_URL` | *(auto-set by the Postgres plugin — leave it)* |
   | `REDIS_URL` | *(auto-set by the Redis plugin — leave it)* |

   Optional (features stay off until set): `OPENAI_API_KEY`, `S3_BUCKET` +
   `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `S3_REGION`,
   `STRIPE_SECRET_KEY`.
7. **Add the worker** (for background analysis/video): **New → GitHub Repo →** same
   repo → **Settings → Root Directory = `backend`**, and set **Custom Start Command**:
   `celery -A app.workers.celery_app worker --loglevel=info`. Give it the same
   `DATABASE_URL`/`REDIS_URL`/`ENV` variables.
8. On the API service, open **Settings → Networking → Generate Domain.** Copy the
   URL, e.g. `https://routeforge-api-production.up.railway.app`.
9. Verify: open `https://<that-url>/health` → you should see
   `{"status":"ok","service":"RouteForge","env":"production"}` and
   `https://<that-url>/docs` for the API explorer.

> Prefer **Render** instead? Use `render.yaml`: Render Dashboard → **New →
> Blueprint →** select this repo. It provisions API + worker + Redis + Postgres in
> one step. Fill the `sync:false` secrets in the dashboard. Then continue to Step 2.

---

## STEP 2 — Frontend on Vercel (~3 min)

1. Go to **https://vercel.com** → **Add New → Project →** import
   `baileymoore398-lab/Bailey-Moore`.
2. In the import screen, set **Root Directory = `frontend`** (click *Edit* next to
   Root Directory and choose the `frontend` folder). Framework = **Next.js**
   (auto-detected via `frontend/vercel.json`).
3. Expand **Environment Variables** and add **one**:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | the Railway API URL from Step 1.8 (e.g. `https://routeforge-api-production.up.railway.app`) — **no trailing slash** |
4. Click **Deploy.** When it finishes you get a URL like
   `https://bailey-moore.vercel.app`.

---

## STEP 3 — Connect them (CORS) (~1 min)

1. Copy your Vercel URL from Step 2.4.
2. Back in **Railway → API service → Variables**, set:
   - `CORS_ORIGINS` = your Vercel URL (e.g. `https://bailey-moore.vercel.app`)
3. The API redeploys automatically. (Multiple origins? comma-separate them.)

---

## STEP 4 — Smoke test (~2 min)

Open your Vercel URL and:
1. **Register** an account → you land on the dashboard.
2. **Analyze** → upload a `.gpx` file → **Generate** → view the replay + scores.
3. **Share** a result → open the `/s/<token>` link in a private window (no login).

If registration/analyze fails with a network/CORS error, re-check that
`NEXT_PUBLIC_API_URL` (Vercel) and `CORS_ORIGINS` (Railway) point at each other
with the exact `https://…` URLs and no trailing slash.

---

## Common gotchas
- **You see the README, not the app** → you opened the GitHub Pages URL
  (`*.github.io`). Use the **Vercel** URL instead, and disable Pages.
- **"Environment Variable references Secret which does not exist"** → you're on an
  old `vercel.json`; pull latest (it no longer references secrets) and set
  `NEXT_PUBLIC_API_URL` directly in the Vercel dashboard.
- **Frontend builds but every API call fails** → `CORS_ORIGINS` on the backend
  doesn't include your exact Vercel domain.
- **Backend boots but `/login` is slow the first time** → free-tier Railway/Render
  services cold-start; upgrade the plan to keep them warm.

See `docs/DEPLOYMENT.md` for the full guide and `docs/PRODUCTION_CHECKLIST.md`
before a real public launch.
