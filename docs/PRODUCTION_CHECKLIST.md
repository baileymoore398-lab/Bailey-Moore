# RouteForge — Production Readiness Checklist

## Secrets & config
- [ ] `JWT_SECRET` is a strong random value (≥ 32 bytes), unique per environment.
- [ ] `DATABASE_URL` uses `postgresql+psycopg2://` and points at managed Postgres.
- [ ] `REDIS_URL` uses TLS (`rediss://`) and `CELERY_TASK_ALWAYS_EAGER=false`.
- [ ] `CORS_ORIGINS` lists only your real frontend domains (no `*`).
- [ ] S3 bucket + scoped IAM credentials configured; bucket is **private**.
- [ ] No real secrets committed; `.env` is gitignored.

## Database
- [ ] `alembic upgrade head` runs on deploy (entrypoint / startCommand).
- [ ] Automated backups enabled on the managed Postgres instance.
- [ ] Connection pool sized for expected concurrency.

## Application
- [ ] Health check `/health` wired to the platform's healthcheck.
- [ ] Rate limiting active (`RATE_LIMIT_DEFAULT`); tune per plan if needed.
- [ ] Free-plan quota (`FREE_PLAN_MONTHLY_ANALYSES`) confirmed.
- [ ] Celery worker running and consuming the analysis/video queues.
- [ ] `ffmpeg`, `gdal`, OpenCV present in the backend image (they are, via Dockerfile).

## Security
- [ ] HTTPS enforced end-to-end (provider-managed certs).
- [ ] Passwords hashed with bcrypt (default) — verified.
- [ ] JWT expiry reasonable (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- [ ] Upload size cap enforced (60 MB) and file types validated.
- [ ] Dependency audit run (`pip-audit`, `npm audit`) — see below.
- [ ] Admin endpoints restricted to `admin`/superuser role.

## Observability
- [ ] Structured request logs with request IDs enabled (default).
- [ ] Error tracking wired (Sentry DSN) — *recommended add-on*.
- [ ] Metrics/uptime monitor on `/health`.

## Compliance
- [ ] GDPR export (`GET /api/v1/account/export`) and erasure
      (`DELETE /api/v1/account/me`) verified.
- [ ] Audit log retention policy defined (`audit_logs` table).
- [ ] Privacy policy / ToS linked from the app.

## Verification before launch
- [ ] `pytest` green in CI.
- [ ] `npm run build` + `npm run lint` green in CI.
- [ ] `docker compose config` valid.
- [ ] Manual smoke: register → upload → analyze → view → share.
- [ ] Load test the analyze endpoint at expected peak (see `LOAD_TESTING`).

## Dependency audit
```bash
pip install pip-audit && pip-audit -r backend/requirements.txt
cd frontend && npm audit --production
```
