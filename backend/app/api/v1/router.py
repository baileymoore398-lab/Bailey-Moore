"""Aggregate all v1 routers under a single APIRouter."""
from fastapi import APIRouter

from app.api.v1 import admin, athletes, auth, files, integrations, races

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(races.router)
api_router.include_router(files.router)
api_router.include_router(athletes.router)
api_router.include_router(integrations.router)
api_router.include_router(admin.router)
