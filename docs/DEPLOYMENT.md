# RouteForge — Deployment Guide

RouteForge is a monorepo: a **Next.js frontend** (deploy to Vercel) and a
**FastAPI backend + Celery worker** (deploy to Railway, Render, or AWS) backed by
**managed Postgres**, **managed Redis**, and an **S3 bucket**.

```
Vercel (frontend)  ──HTTPS──▶  Railway/Render/AWS (backend API + worker)
                                   │            │
                              Managed Postgres   Managed Redis
                                   │
                               AWS S3 bucket
```

## 1. Provision data services
1. **Postgres** (Railway/Render/Neon/RDS). Copy its connection string and ensure
   it uses the psycopg2 driver form: `postgresql+psycopg2://USER:PASS@HOST:5432/DB`.
2. **Redis** (Railway/Render/Upstash). Use `rediss://` (TLS) in production.
3. **S3 bucket** + an IAM user with `s3:PutObject/GetObject/DeleteObject`.

## 2. Deploy the backend
Use `.env.production.template` as the variable checklist.

### Option A — Railway (uses `railway.json`)
1. New Project → Deploy from repo. Railway reads `railway.json` (Dockerfile build +
   `alembic upgrade head && uvicorn ...`, healthcheck `/health`).
2. Set the service **root directory** to `backend/` so the Dockerfile context matches.
3. Add a second service for the **worker** with start command
   `celery -A app.workers.celery_app worker --loglevel=info`.
4. Set all env vars from the template. Add the Railway Postgres + Redis plugins
   (they inject `DATABASE_URL`/`REDIS_URL`).

### Option B — Render (uses `render.yaml`)
New → Blueprint → select this repo. `render.yaml` provisions the API web service,
the Celery worker, a Redis instance, and a Postgres database in one step. Fill the
`sync: false` secrets (S3, OpenAI, Stripe, CORS) in the dashboard.

### Option C — AWS
Build `backend/Dockerfile`, push to ECR, run on ECS/Fargate (one service for the
API, one for the worker). Use RDS Postgres + ElastiCache Redis + S3. Run
`alembic upgrade head` as a one-off task on deploy.

Migrations run automatically on container start (entrypoint / startCommand).

## 3. Deploy the frontend (Vercel)
1. Import the repo; set **Root Directory = `frontend`** (or rely on `frontend/vercel.json`).
2. Add env var `NEXT_PUBLIC_API_URL = https://<your-backend-domain>`.
3. Deploy. Next.js builds with standalone output.
4. Add the Vercel domain to the backend's `CORS_ORIGINS`.

## 4. Post-deploy verification
```bash
curl https://<backend>/health                 # {"status":"ok"}
open  https://<backend>/docs                   # OpenAPI UI
open  https://<frontend>/                      # landing page
```
Then run the smoke flow: register → upload GPX → analyze → view dashboard.

## 5. Stripe (optional)
Set `STRIPE_SECRET_KEY`, create products/prices, set `STRIPE_PRICE_PRO/TEAM/CLUB`,
and add a webhook to `https://<backend>/api/v1/billing/webhook` with
`STRIPE_WEBHOOK_SECRET`. Until set, billing endpoints return a clear 503 and the
rest of the app is unaffected.

## 6. Local production-like run
```bash
cp .env.example .env
docker compose up --build       # full stack incl. nginx on :8080
```

See `PRODUCTION_CHECKLIST.md` before going live.
