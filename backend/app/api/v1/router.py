"""Aggregate all v1 routers under a single APIRouter."""
from fastapi import APIRouter

from app.api.v1 import (
    account,
    admin,
    athletes,
    auth,
    billing,
    clubs,
    coach,
    contact,
    events,
    feedback,
    files,
    integrations,
    races,
    replay,
    sharing,
    training,
)

api_router = APIRouter()
# Core (existing — unchanged paths preserve backward compatibility)
api_router.include_router(auth.router)
api_router.include_router(account.router)
api_router.include_router(races.router)
api_router.include_router(files.router)
api_router.include_router(athletes.router)
api_router.include_router(integrations.router)
api_router.include_router(admin.router)
# Ecosystem expansion
api_router.include_router(events.router)
api_router.include_router(coach.router)
api_router.include_router(clubs.router)
api_router.include_router(training.router)
api_router.include_router(sharing.router)
api_router.include_router(replay.router)
api_router.include_router(billing.router)
api_router.include_router(feedback.router)
api_router.include_router(contact.router)
