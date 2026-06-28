#!/usr/bin/env sh
# RouteForge backend entrypoint.
#
# Picks web (API) vs worker (Celery) behaviour from the SERVICE_ROLE env var, so
# both Railway/Render services can run the SAME image with NO custom start
# command — the only difference is `SERVICE_ROLE=worker` on the worker service.
#
#   SERVICE_ROLE=web    (default) -> run migrations, then exec the CMD (uvicorn)
#   SERVICE_ROLE=worker           -> exec Celery (skips migrations; the web role
#                                    already applies them)
set -e

if [ "${SERVICE_ROLE:-web}" = "worker" ]; then
  if [ "$#" -gt 0 ] && [ "$1" != "uvicorn" ]; then
    # A non-default command was provided (e.g. docker-compose) — honour it.
    echo "[entrypoint] Starting worker: $*"
    exec "$@"
  fi
  echo "[entrypoint] Starting Celery worker..."
  exec celery -A app.workers.celery_app worker \
    --loglevel="${CELERY_LOGLEVEL:-info}" \
    --concurrency="${CELERY_CONCURRENCY:-2}"
fi

# Web / API role.
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[entrypoint] Running alembic migrations..."
  alembic upgrade head || echo "[entrypoint] WARNING: alembic upgrade failed (continuing)"
fi

echo "[entrypoint] Starting: $*"
exec "$@"
