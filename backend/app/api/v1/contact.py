"""Contact form: notify the site owner and auto-reply to the sender.

Both emails are branded and sent only when an email transport is configured.
The endpoint reports whether it actually delivered so the frontend can fall
back to Formspree / a mailto link when email isn't set up.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, EmailStr, Field

from app.config import settings
from app.core.email import (
    send_contact_ack_email,
    send_contact_notification_email,
)
from app.core.ratelimit import rate_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/contact", tags=["contact"])


class ContactMessage(BaseModel):
    name: str = Field(default="", max_length=120)
    email: EmailStr | None = None
    subject: str = Field(default="", max_length=160)
    message: str = Field(min_length=1, max_length=5000)


@router.post("", dependencies=[Depends(rate_limit(5, 3600, "contact"))])
def submit_contact(body: ContactMessage, background: BackgroundTasks):
    """Accept a contact-form message.

    Returns ``delivered`` = whether emails were dispatched. When email isn't
    configured we still return 200 with ``delivered: false`` so the client can
    fall back to its existing Formspree/mailto path — the message is logged.
    """
    if not settings.email_enabled:
        logger.info(
            "[contact — email disabled] from=%s <%s> subject=%s\n%s",
            body.name, body.email, body.subject, body.message,
        )
        return {"ok": True, "delivered": False}

    # Notify the owner (with the sender as Reply-To).
    background.add_task(
        send_contact_notification_email,
        body.name, str(body.email) if body.email else None, body.subject, body.message,
    )
    # Auto-reply to the sender, if they gave an address.
    if body.email:
        background.add_task(send_contact_ack_email, str(body.email), body.name)

    return {"ok": True, "delivered": True}
