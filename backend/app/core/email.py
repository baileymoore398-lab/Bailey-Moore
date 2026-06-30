"""Transactional email (SMTP) with a safe log-only fallback.

If no SMTP host is configured, emails are logged rather than sent so local
development and tests never fail. Sending errors are caught and logged — email
delivery must never break the request that triggered it (signup, reset, etc.).
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.config import settings

logger = logging.getLogger(__name__)

_ACCENT = "#2ecf6e"


def _wrap(title: str, body_html: str, cta_label: str | None = None, cta_url: str | None = None) -> str:
    """Wrap content in a simple branded HTML shell."""
    cta = ""
    if cta_label and cta_url:
        cta = (
            f'<tr><td style="padding:8px 0 24px">'
            f'<a href="{cta_url}" style="display:inline-block;background:{_ACCENT};'
            f'color:#0c0e0a;text-decoration:none;font-weight:700;padding:12px 22px;'
            f'border-radius:10px;font-size:15px">{cta_label}</a></td></tr>'
        )
    return f"""\
<!doctype html><html><body style="margin:0;background:#0c0e0a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0e0a;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#11140d;border:1px solid #2c3322;border-radius:16px;padding:32px">
<tr><td style="padding-bottom:20px">
<span style="font-size:22px;font-weight:800;color:#ffffff">Route<span style="color:{_ACCENT}">Forge</span></span>
</td></tr>
<tr><td style="font-size:20px;font-weight:800;color:#ffffff;padding-bottom:12px">{title}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#c9cdbf;padding-bottom:16px">{body_html}</td></tr>
{cta}
<tr><td style="border-top:1px solid #2c3322;padding-top:16px;font-size:12px;color:#6b7363">
RouteForge — AI race analysis for orienteers &amp; trail runners.
</td></tr>
</table>
</td></tr>
</table>
</body></html>"""


def _send_via_resend(to: str, subject: str, html: str, text: str) -> bool:
    """Send via the Resend HTTP API. Returns True on a 2xx response."""
    import httpx

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={
                "from": formataddr((settings.EMAIL_FROM_NAME, settings.email_from_addr)),
                "to": [to],
                "subject": subject,
                "html": html,
                "text": text,
            },
            timeout=20,
        )
        if resp.status_code // 100 == 2:
            logger.info("Sent email to %s via Resend: %s", to, subject)
            return True
        logger.error("Resend returned %s for %s: %s", resp.status_code, to, resp.text[:300])
        return False
    except Exception:  # noqa: BLE001 — never propagate email errors
        logger.exception("Failed to send email via Resend to %s", to)
        return False


def send_email(to: str, subject: str, html: str, text: str) -> bool:
    """Send one email via the configured transport (Resend → SMTP → log)."""
    if not settings.email_enabled:
        logger.info("[email disabled] to=%s | subject=%s\n%s", to, subject, text)
        return False
    if settings.RESEND_API_KEY:
        return _send_via_resend(to, subject, html, text)
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.EMAIL_FROM_NAME, settings.email_from_addr))
    msg["To"] = to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
            server.ehlo()
            if settings.SMTP_STARTTLS:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("Sent email to %s: %s", to, subject)
        return True
    except Exception:  # noqa: BLE001 — never propagate email errors
        logger.exception("Failed to send email to %s", to)
        return False


def send_welcome_email(to: str, name: str | None) -> bool:
    who = name or "there"
    subject = "Welcome to RouteForge 🧭"
    body = (
        f"Hi {who},<br><br>"
        "Thanks for joining <b>RouteForge</b> — your account is ready. "
        "Upload a photo of your map and a GPS track and we'll break your race "
        "down leg by leg, find where you lost time, and give you a coaching "
        "report on how to get faster.<br><br>"
        "Good luck out there!"
    )
    html = _wrap("Your account is ready", body, "Analyze a race", f"{settings.FRONTEND_URL}/upload")
    text = (
        f"Hi {who},\n\nThanks for joining RouteForge — your account is ready.\n"
        f"Get started: {settings.FRONTEND_URL}/upload\n\n— RouteForge"
    )
    return send_email(to, subject, html, text)


def send_password_reset_email(to: str, token: str) -> bool:
    link = f"{settings.FRONTEND_URL}/forgot-password?token={token}"
    subject = "Reset your RouteForge password"
    body = (
        "We received a request to reset your RouteForge password. "
        "Click the button below to choose a new one. This link will expire "
        "shortly.<br><br>"
        "If you didn't request this, you can safely ignore this email — your "
        "password won't change.<br><br>"
        f'<span style="font-size:13px;color:#6b7363">Or paste this reset code: '
        f'<b style="color:#c9cdbf">{token}</b></span>'
    )
    html = _wrap("Reset your password", body, "Reset password", link)
    text = (
        "Reset your RouteForge password using this link:\n"
        f"{link}\n\nOr use this reset code: {token}\n\n"
        "If you didn't request this, ignore this email.\n\n— RouteForge"
    )
    return send_email(to, subject, html, text)
