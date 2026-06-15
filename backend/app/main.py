"""RouteForge FastAPI application entrypoint."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import api_router
from app.config import settings
from app.database import init_db

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.RATE_LIMIT_DEFAULT])

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="AI-powered race analysis for orienteering, MTBO, rogaining, "
    "adventure racing and trail running.",
)
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RateLimitExceeded)
def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})


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
