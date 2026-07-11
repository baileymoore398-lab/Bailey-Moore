"""RouteForge FastAPI application entrypoint."""
from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.router import api_router
from app.config import settings
from app.core.ratelimit import limiter
from app.database import init_db

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("routeforge")

_docs_enabled = settings.ENV != "production"
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="AI-powered race analysis for orienteering, MTBO, rogaining, "
    "adventure racing and trail running.",
    # Don't expose interactive API docs / schema publicly in production.
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)
app.state.limiter = limiter
# Actually enforce the limits (attaching the limiter alone does nothing).
app.add_middleware(SlowAPIMiddleware)

# CORS. Set CORS_ORIGINS to your frontend URL(s), or "*" to allow any origin
# (handy while wiring up a deployment — auth uses Bearer tokens, not cookies, so
# credentials aren't required). CORS_ORIGIN_REGEX additionally allows matching
# origins, e.g. "https://.*\\.vercel\\.app" to permit all Vercel deployments.
_cors_origins = settings.cors_origins
_allow_all_origins = "*" in _cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all_origins else _cors_origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    # Browsers reject "*" together with credentials; we don't need credentials.
    allow_credentials=not _allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Attach a request id and emit structured access logs with latency."""
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("request_failed id=%s %s %s", request_id, request.method, request.url.path)
        raise
    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request id=%s method=%s path=%s status=%s latency_ms=%.1f",
        request_id, request.method, request.url.path, response.status_code, elapsed_ms,
    )
    return response


@app.exception_handler(RateLimitExceeded)
def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})


@app.exception_handler(Exception)
def _unhandled_error(request: Request, exc: Exception):
    logger.exception("unhandled_error path=%s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.on_event("startup")
def _startup():
    # For SQLite/dev create tables directly; production uses Alembic migrations.
    if settings.DATABASE_URL.startswith("sqlite"):
        init_db()
    logger.info("RouteForge API started in %s mode", settings.ENV)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "service": settings.PROJECT_NAME, "env": settings.ENV}


@app.get("/", tags=["health"])
def root():
    return {"service": settings.PROJECT_NAME, "docs": "/docs", "api": settings.API_V1_PREFIX}


app.include_router(api_router, prefix=settings.API_V1_PREFIX)
