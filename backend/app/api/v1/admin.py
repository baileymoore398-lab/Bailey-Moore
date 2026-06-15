"""Admin panel endpoints — restricted to admin/superuser roles."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.database import get_db
from app.models import Analysis, AuditLog, Race, Subscription, User

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])


@router.get("/stats")
def platform_stats(db: Session = Depends(get_db)):
    return {
        "users": db.query(func.count(User.id)).scalar(),
        "races": db.query(func.count(Race.id)).scalar(),
        "analyses": db.query(func.count(Analysis.id)).scalar(),
        "completed_analyses": db.query(func.count(Analysis.id))
        .filter(Analysis.status == "complete")
        .scalar(),
        "by_plan": dict(
            db.query(Subscription.plan, func.count(Subscription.id))
            .group_by(Subscription.plan)
            .all()
        ),
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), limit: int = 100):
    users = db.query(User).order_by(User.created_at.desc()).limit(limit).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.get("/audit")
def audit_log(db: Session = Depends(get_db), limit: int = 100):
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "action": r.action,
            "target_type": r.target_type,
            "target_id": r.target_id,
            "detail": r.detail,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
