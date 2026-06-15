# =============================================================================
# RouteForge backend — FastAPI + Celery
# Multi-stage: a `builder` compiles wheels, `runtime` stays lean.
# Heavy native deps (OpenCV / GDAL / FFmpeg) are required by the analysis
# pipeline (map georeferencing, image processing, video render).
# =============================================================================

# ---- builder ----------------------------------------------------------------
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Build-time toolchain + GDAL headers so packages compile against them.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gdal-bin \
        libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# GDAL python bindings need these to find the right headers.
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal \
    C_INCLUDE_PATH=/usr/include/gdal

WORKDIR /wheels
COPY requirements.txt .
RUN pip wheel --wheel-dir=/wheels -r requirements.txt

# ---- runtime ----------------------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Runtime-only native libraries.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        ffmpeg \
        gdal-bin \
        libgdal-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install from prebuilt wheels (no compiler in the final image).
COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# Non-root user.
RUN groupadd --system app && useradd --system --gid app --create-home app
WORKDIR /app

# Application code (package root is backend/app -> /app/app).
COPY --chown=app:app . /app

# Entrypoint runs migrations then starts the API. The worker service overrides
# the CMD in docker-compose, so it skips the entrypoint migration.
COPY --chown=app:app docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER app
EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
