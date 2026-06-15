"""Authentication endpoints (email/password + JWT).

Clerk/Auth.js can be layered in front for production SSO; this provides a
first-class native auth path and issues the JWTs the rest of the API consumes.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models import Athlete, Plan, Subscription, User
from app.schemas.schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    db.flush()
    db.add(
        Athlete(
            user_id=user.id,
            display_name=body.full_name or body.email.split("@")[0],
        )
    )
    db.add(Subscription(user_id=user.id, plan=Plan.free.value))
    db.commit()
    token = create_access_token(user.id, {"email": user.email, "role": user.role})
    return TokenResponse(access_token=token, user_id=user.id, email=user.email)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).one_or_none()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    token = create_access_token(user.id, {"email": user.email, "role": user.role})
    return TokenResponse(access_token=token, user_id=user.id, email=user.email)
