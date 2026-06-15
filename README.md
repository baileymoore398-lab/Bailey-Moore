# RouteForge

**AI-powered race analysis for orienteering, mountain-bike orienteering (MTBO),
rogaining, adventure racing, and trail running.**

RouteForge ingests your GPS track (GPX/FIT), the official course/map, and
optional video, then produces an automated analysis: route-choice comparison,
split-by-leg timing, speed and heart-rate context, error detection (parallel
errors, bobbles, hesitations), and shareable map + video replays. The goal is to
turn a raw activity file into the kind of coaching feedback that normally takes
an expert hours to produce.

---

## Architecture

```
                              ┌────────────────────────┐
                              │        Browser         │
                              └───────────┬────────────┘
                                          │ HTTP
                              ┌───────────▼────────────┐
                              │   nginx reverse proxy   │   :8080
                              │   / -> frontend         │
                              │   /api -> backend       │
                              └─────┬──────────────┬────┘
                                    │              │
                       ┌────────────▼───┐    ┌─────▼──────────────┐
                       │   frontend     │    │     backend        │
                       │   Next.js      │    │   FastAPI (uvicorn)│  :8000
                       │   :3000        │    │   REST + auth      │
                       └────────────────┘    └───┬─────────┬──────┘
                                                  │         │
                          ┌───────────────────────┘         │ enqueue
                          │                                  ▼
                   ┌──────▼──────┐   ┌──────────┐    ┌───────────────┐
                   │  Postgres   │   │  Redis    │◄──►│  Celery worker │
                   │  :5432      │   │  :6379    │    │  (analysis,    │
                   └─────────────┘   └──────────┘    │   video render)│
                                                     └───────┬────────┘
                                                             │
                                                     ┌───────▼────────┐
                                                     │ MinIO / S3     │  :9000/:9001
                                                     │ maps, tracks,  │
                                                     │ rendered video │
                                                     └────────────────┘
```

- The **backend** serves the REST API and writes jobs to Redis.
- The **worker** runs the heavy analysis pipeline (georeferencing, route
  matching, image/video processing) using Celery, reading/writing artifacts to
  S3-compatible storage.
- **Postgres** holds users, activities, courses, and analysis results.
- **MinIO** stands in for AWS S3 in local development.

---

## Tech stack

| Layer        | Technology                                                        |
| ------------ | ----------------------------------------------------------------- |
| Frontend     | Next.js 14 (App Router, standalone output), React 18, TailwindCSS, MapLibre GL, Recharts |
| Backend      | FastAPI, Python 3.11, SQLAlchemy + Alembic, Pydantic              |
| Async / jobs | Celery + Redis                                                    |
| Data         | PostgreSQL 16                                                     |
| Storage      | S3-compatible (MinIO locally, AWS S3 in prod)                     |
| Geo / media  | GDAL, OpenCV, FFmpeg                                              |
| AI           | OpenAI API (narrative analysis); optional YOLO map ML weights     |
| Auth         | First-party JWT (optional Clerk)                                  |
| Billing      | Stripe (optional)                                                 |
| Infra        | Docker / docker-compose, nginx, GitHub Actions                    |

---

## Monorepo layout

```
.
├── backend/              # FastAPI + Celery (package root: backend/app)
│   ├── app/              # application code (owned by backend engineers)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── docker-entrypoint.sh
├── frontend/             # Next.js app
│   ├── app/  components/ lib/
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   └── nginx.conf        # reverse proxy config
├── .github/workflows/
│   ├── ci.yml            # lint + test (backend & frontend)
│   └── docker.yml        # build/push images
├── docker-compose.yml    # full local stack
├── .env.example          # all environment variables
├── Makefile              # convenience targets
└── README.md
```

---

## Local quickstart

### Option A — full stack with Docker (recommended)

```bash
cp .env.example .env        # edit values as needed; defaults work for local dev
make up                     # or: docker compose up --build -d
```

Once everything is healthy:

| Service            | URL                              |
| ------------------ | -------------------------------- |
| App (via nginx)    | http://localhost:8080            |
| Frontend (direct)  | http://localhost:3000            |
| Backend API        | http://localhost:8000            |
| Backend docs       | http://localhost:8000/docs       |
| MinIO console      | http://localhost:9001            |
| Postgres           | localhost:5432                   |

The backend runs `alembic upgrade head` on startup and a one-shot `minio-init`
container creates the bucket. Tail logs with `make logs` (or `make logs S=backend`).

### Option B — manual dev (services on the host)

Run only the infra in Docker, then run the app processes locally for fast reload.

```bash
# 1. Start just the datastores
docker compose up -d db redis minio minio-init

# 2. Backend (Python 3.11)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Point DATABASE_URL/REDIS_URL at localhost (see note below)
alembic upgrade head
uvicorn app.main:app --reload --port 8000     # or: make backend-dev

# 3. Frontend (in another terminal)
cd frontend
npm ci
npm run dev                                     # or: make frontend-dev
```

> When running the backend on the host, override the connection hosts to
> `localhost` instead of the compose service names, e.g.
> `DATABASE_URL=postgresql+psycopg://routeforge:routeforge@localhost:5432/routeforge`
> and `REDIS_URL=redis://localhost:6379/0`.

You will also need a Celery worker for analysis jobs:

```bash
cd backend && celery -A app.workers.celery_app worker --loglevel=info
```

---

## Environment variables

Copy `.env.example` to `.env`. All values there are safe dummy defaults for
local development — **never commit a real `.env`**.

| Variable | Purpose |
| -------- | ------- |
| `ENV` | `development` / `staging` / `production` / `test` |
| `LOG_LEVEL` | `debug` / `info` / `warning` / `error` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Credentials for the `db` service |
| `POSTGRES_HOST` / `POSTGRES_PORT` | DB host/port (compose service `db`) |
| `DATABASE_URL` | SQLAlchemy/Alembic connection string |
| `REDIS_URL` | Redis connection (cache + general) |
| `CELERY_BROKER_URL` | Celery broker (Redis) |
| `CELERY_RESULT_BACKEND` | Celery result backend (Redis) |
| `S3_ENDPOINT` | S3 API endpoint (MinIO locally) |
| `S3_BUCKET` | Bucket name for artifacts |
| `S3_REGION` | AWS region |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 credentials |
| `S3_PUBLIC_URL` | Public base URL used to build asset links |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Bootstrap creds for local MinIO (compose only) |
| `OPENAI_API_KEY` | LLM access for narrative analysis |
| `JWT_SECRET` | Signs first-party tokens |
| `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Optional Clerk auth |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Optional billing |
| `STRIPE_PRICE_ID_PRO` / `STRIPE_PRICE_ID_TEAM` | Stripe price IDs for plans |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Optional Strava OAuth |
| `GARMIN_CLIENT_ID` / `GARMIN_CLIENT_SECRET` | Optional Garmin OAuth |
| `NEXT_PUBLIC_API_URL` | Backend base URL baked into the frontend bundle |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | Default rate-limit budget |

---

## Database migrations (Alembic)

Migrations live in the backend and run automatically when the backend container
starts. To run them manually:

```bash
make migrate                                  # in the backend container

# or directly on the host:
cd backend && alembic upgrade head            # apply
cd backend && alembic revision --autogenerate -m "add table"   # create
cd backend && alembic downgrade -1            # roll back one
```

---

## Running tests

```bash
make test                  # backend (pytest) + frontend

# individually:
cd backend && pytest -q
cd frontend && npm run lint && npm run build
```

CI (`.github/workflows/ci.yml`) runs the backend suite against a real Postgres +
Redis service container and builds the frontend on every push and pull request.

---

## Production deployment guide

RouteForge is split so each tier can be hosted where it runs best. A common
setup:

### Frontend → Vercel

1. Import the repo into Vercel, set the **root directory** to `frontend/`.
2. Set `NEXT_PUBLIC_API_URL` to your public backend URL (e.g.
   `https://api.routeforge.app`). Because it is a `NEXT_PUBLIC_*` var it is
   baked at build time — redeploy after changing it.
3. Vercel auto-detects Next.js; no extra config needed (standalone output also
   works for self-hosting).

### Backend + worker → Railway / Render / AWS

1. Deploy the `backend/` Dockerfile as **two** services from the same image:
   - **API**: default `CMD` (uvicorn). Expose port 8000 behind the platform's
     load balancer / TLS.
   - **Worker**: override the command to
     `celery -A app.workers.celery_app worker --loglevel=info` and set
     `RUN_MIGRATIONS=0` so only the API service runs migrations.
2. Run migrations as a one-off release step (`alembic upgrade head`) or let the
   API container do it on boot.
3. On AWS, the equivalent is ECS/Fargate tasks (one for API, one for worker)
   behind an ALB, or App Runner for the API.

### Managed Postgres

Use a managed Postgres 16 (Railway, RDS, Neon, Supabase). Set `DATABASE_URL`
to the provider's connection string (keep the `postgresql+psycopg://` driver
prefix). Enable automated backups.

### Object storage → AWS S3

Create a private S3 bucket. Set `S3_ENDPOINT` to the AWS endpoint (or leave the
provider default), `S3_BUCKET`, `S3_REGION`, and IAM `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` with least-privilege access to that bucket. Set
`S3_PUBLIC_URL` to the CDN/public base if you serve artifacts directly.

### Redis

Use a managed Redis (Upstash, ElastiCache, Railway). Point `REDIS_URL`,
`CELERY_BROKER_URL`, and `CELERY_RESULT_BACKEND` at it (separate logical DBs
where supported).

### Setting secrets

Never ship a real `.env`. Configure secrets through each platform's secret
manager (Vercel env vars, Railway variables, AWS Secrets Manager / SSM). At
minimum set a strong `JWT_SECRET`
(`python -c "import secrets; print(secrets.token_urlsafe(48))"`), real
`OPENAI_API_KEY`, S3 credentials, and `CORS_ORIGINS` matching your production
domains.

---

## Event, coach, club & training ecosystem

Beyond single-athlete analysis, RouteForge supports whole **events, coaches,
clubs and teams**. See [`docs/ECOSYSTEM.md`](docs/ECOSYSTEM.md) for the full
architecture and API reference. Highlights:

- **Events** — upload IOF XML results + bulk GPX/FIT/TCX, automatic competitor
  matching, event-wide analysis (leaderboards, leg-by-leg rankings, route-choice
  comparison), synchronized multi-competitor replay, and public event pages.
- **Coach dashboard** — manage athletes & teams, performance/route-efficiency/
  time-loss/navigation trends, coach notes, and AI coaching recommendations.
- **Club dashboard** — members, club-wide analytics, event participation,
  rankings and statistics.
- **Training analytics** — weekly/monthly volume, climbing/speed/HR trends,
  TRIMP training load with acute:chronic ratio, race-readiness scoring, personal
  bests and goal tracking.
- **Public sharing & advanced replay** — tokenized share links, embeddable
  replays, social-media OG previews, and speed/error/density heatmaps.

## Project status / what's implemented

This repository's **infrastructure, deployment, and CI scaffolding is complete**
(compose stack, Dockerfiles, nginx proxy, CI/build workflows). For the
application itself:

- ✅ **Core analysis pipeline is functional** — GPS ingestion, course/route
  matching, split timing, and the narrative summary work end-to-end with the
  default configuration.
- ✅ **Event / coach / club / training ecosystem is functional** — bulk event
  ingestion, competitor matching, event analytics, multi-replay, training load &
  readiness, coaching trends, club analytics, and public sharing all run with
  the default configuration (see `docs/ECOSYSTEM.md`, covered by automated tests).
- ⚙️ **YOLO map ML weights** — automated map/control-feature detection requires
  trained model weights to be provided (not bundled; see `*.pt`/`*.onnx` in
  `.gitignore`). Without them the pipeline falls back to manual georeferencing.
- ⚙️ **Video render farm** — video replay rendering works for single jobs via
  the Celery worker; scaling to a dedicated render fleet requires additional
  worker capacity and storage configuration.
- ⚙️ **Billing** — Stripe integration is wired but inert until real
  `STRIPE_*` keys and price IDs are configured.

Treat the optional integrations (Clerk, Stripe, Strava, Garmin) as opt-in: the
platform runs without them, and each activates once its env vars are populated.
