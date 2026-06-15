#!/usr/bin/env sh
# RouteForge backend entrypoint.
# Applies database migrations (best-effort) then execs the given command.
# The worker service supplies its own CMD, so it also runs through here — the
# migration is idempotent (alembic no-ops when already at head).
set -e

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[entrypoint] Running alembic migrations..."
  alembic upgrade head || echo "[entrypoint] WARNING: alembic upgrade failed (continuing)"
fi

echo "[entrypoint] Starting: $*"
exec "$@"
