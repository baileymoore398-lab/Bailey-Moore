"""Transactional email (Resend → SMTP → log) with polished, branded HTML.

If no transport is configured, emails are logged rather than sent so local
development and tests never fail. Sending errors are caught and logged — email
delivery must never break the request that triggered it (signup, reset, etc.).

The HTML is built to survive real email clients (Gmail, Apple Mail, Outlook):
table-based layout, inline styles, a bulletproof button, a hidden preheader,
and the brand logo served from the live site so it renders inline.
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.config import settings

logger = logging.getLogger(__name__)

# Brand palette (kept in sync with the site).
_BG = "#080a06"
_CARD = "#11140d"
_BORDER = "#242a1c"
_ACCENT = "#2ecf6e"
_ACCENT_DK = "#1c9e57"
_TEXT = "#e7ebdd"
_MUTE = "#9aa38c"
_FAINT = "#6b7363"


def _logo_lockup() -> str:
    """Brand logo as a pure-CSS badge + wordmark.

    Deliberately avoids an external <img> so it always renders — even in
    clients that block remote images (Gmail, corporate Outlook) — and never
    shows a broken-image placeholder. The green badge with an upward route
    arrow echoes the RouteForge mark.
    """
    return f"""\
<table role="presentation" cellpadding="0" cellspacing="0">
  <tr>
    <td style="vertical-align:middle;padding-right:14px">
      <table role="presentation" cellpadding="0" cellspacing="0"
        style="width:44px;height:44px;background:{_ACCENT_DK};
        background-image:linear-gradient(135deg,#34d977,{_ACCENT_DK});border-radius:12px">
        <tr><td align="center" valign="middle"
          style="width:44px;height:44px;font-size:24px;font-weight:900;color:#ffffff;line-height:44px">&#8599;</td></tr>
      </table>
    </td>
    <td style="vertical-align:middle">
      <span style="font-size:23px;font-weight:800;letter-spacing:-.4px;color:#ffffff">Route<span style="color:{_ACCENT}">Forge</span></span>
    </td>
  </tr>
</table>"""


def _button(label: str, url: str) -> str:
    """A bulletproof, centered CTA button (renders in Outlook too)."""
    return f"""\
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">
  <tr>
    <td align="center" bgcolor="{_ACCENT}" style="border-radius:12px">
      <a href="{url}" target="_blank"
         style="display:inline-block;padding:15px 34px;font-size:16px;font-weight:700;
                color:#06210f;text-decoration:none;border-radius:12px;
                font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        {label}
      </a>
    </td>
  </tr>
</table>"""


def _wrap(
    title: str,
    body_html: str,
    cta_label: str | None = None,
    cta_url: str | None = None,
    preheader: str = "",
    extra_html: str = "",
) -> str:
    """Wrap content in a branded, email-client-safe HTML shell."""
    site = settings.FRONTEND_URL
    cta = f'<tr><td style="padding:6px 0 8px">{_button(cta_label, cta_url)}</td></tr>' if (cta_label and cta_url) else ""
    extra = f'<tr><td style="padding-top:8px">{extra_html}</td></tr>' if extra_html else ""
    # Hidden preheader (preview text) + trailing whitespace to stop clients
    # pulling body copy into the preview line.
    pre = (
        f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;'
        f'mso-hide:all">{preheader}'
        + ("&#8202;&zwnj;" * 60)
        + "</div>"
    )
    return f"""\
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>{title}</title>
</head>
<body style="margin:0;padding:0;background:{_BG};
  font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased">
{pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_BG}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0"
    style="max-width:560px;width:100%">

    <!-- Brand header -->
    <tr><td style="padding:4px 4px 22px">
      {_logo_lockup()}
    </td></tr>

    <!-- Card -->
    <tr><td style="background:{_CARD};border:1px solid {_BORDER};border-radius:18px;overflow:hidden">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:4px;background:{_ACCENT};line-height:4px;font-size:0">&nbsp;</td></tr>
        <tr><td style="padding:34px 36px 6px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-.3px;padding-bottom:14px">{title}</td></tr>
            <tr><td style="font-size:16px;line-height:1.65;color:{_TEXT};padding-bottom:18px">{body_html}</td></tr>
            {cta}
            {extra}
          </table>
        </td></tr>
        <tr><td style="padding:18px 36px 30px">
          <div style="border-top:1px solid {_BORDER};padding-top:18px;font-size:13px;line-height:1.6;color:{_FAINT}">
            RouteForge — AI race analysis for orienteering, MTBO, rogaining &amp; trail running.
          </div>
        </td></tr>
      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:22px 8px 8px;text-align:center">
      <p style="margin:0 0 10px;font-size:13px;color:{_MUTE}">
        <a href="{site}" style="color:{_ACCENT};text-decoration:none;font-weight:600">Home</a>
        &nbsp;·&nbsp;
        <a href="{site}/upload" style="color:{_MUTE};text-decoration:none">Analyse a race</a>
        &nbsp;·&nbsp;
        <a href="{site}/faq" style="color:{_MUTE};text-decoration:none">FAQ</a>
        &nbsp;·&nbsp;
        <a href="{site}/privacy" style="color:{_MUTE};text-decoration:none">Privacy</a>
      </p>
      <p style="margin:0;font-size:12px;color:{_FAINT}">
        You received this email because you have a RouteForge account.<br>
        <a href="{site}" style="color:{_FAINT};text-decoration:underline">routeforge.world</a>
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>"""


def _feature_row(icon: str, title: str, desc: str) -> str:
    return f"""\
<tr>
  <td width="40" style="vertical-align:top;padding:0 14px 16px 0">
    <div style="width:40px;height:40px;background:rgba(46,207,110,0.12);border:1px solid rgba(46,207,110,0.32);
      border-radius:11px;text-align:center;line-height:40px;font-size:19px;color:{_ACCENT}">{icon}</div>
  </td>
  <td style="vertical-align:top;padding-bottom:16px">
    <div style="font-size:15px;font-weight:700;color:#ffffff">{title}</div>
    <div style="font-size:14px;line-height:1.5;color:{_MUTE}">{desc}</div>
  </td>
</tr>"""


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
        "Welcome to <b style=\"color:#ffffff\">RouteForge</b> — your account is ready to go. "
        "Upload your race and we'll break it down leg by leg, show you exactly where "
        "you lost time, and give you a plain-English coaching report on how to get faster."
    )
    features = f"""\
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
  style="margin:6px 0 4px;padding:18px;background:rgba(255,255,255,0.03);
  border:1px solid {_BORDER};border-radius:14px">
  {_feature_row("◎", "Upload or import", "Drag in a GPX/GPS file, connect Strava, or paste your WinSplits.")}
  {_feature_row("◈", "See every leg", "An interactive replay and a time-loss breakdown for each control.")}
  {_feature_row("✦", "Get coached", "Your AI coach turns the numbers into what to actually work on.")}
</table>"""
    html = _wrap(
        "Your account is ready 🎉",
        body,
        "Analyse your first race",
        f"{settings.FRONTEND_URL}/upload",
        preheader="Your RouteForge account is ready — analyse your first race in minutes.",
        extra_html=features,
    )
    text = (
        f"Hi {who},\n\n"
        "Welcome to RouteForge — your account is ready.\n\n"
        "Here's how it works:\n"
        "  1. Upload or import your race (GPX/GPS, Strava, or paste WinSplits)\n"
        "  2. See every leg — interactive replay + time-loss breakdown\n"
        "  3. Get coached — plain-English tips on how to get faster\n\n"
        f"Analyse your first race: {settings.FRONTEND_URL}/upload\n\n"
        "Good luck out there!\n— RouteForge\n"
        f"{settings.FRONTEND_URL}"
    )
    return send_email(to, subject, html, text)


def send_password_reset_email(to: str, token: str) -> bool:
    link = f"{settings.FRONTEND_URL}/forgot-password?token={token}"
    subject = "Reset your RouteForge password"
    body = (
        "We received a request to reset your RouteForge password. "
        "Click the button below to choose a new one — this link expires shortly "
        "for your security.<br><br>"
        "If you didn't request this, you can safely ignore this email; your "
        "password won't change."
    )
    code_box = f"""\
<div style="margin:2px 0 4px;padding:14px 16px;background:rgba(255,255,255,0.03);
  border:1px solid {_BORDER};border-radius:12px">
  <div style="font-size:12px;color:{_FAINT};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">
    Or paste this reset code
  </div>
  <div style="font-size:19px;font-weight:700;color:{_ACCENT};font-family:'SF Mono',Menlo,Consolas,monospace;
    word-break:break-all">{token}</div>
</div>"""
    html = _wrap(
        "Reset your password",
        body,
        "Reset password",
        link,
        preheader="Use this secure link to reset your RouteForge password.",
        extra_html=code_box,
    )
    text = (
        "Reset your RouteForge password using this link:\n"
        f"{link}\n\n"
        f"Or use this reset code: {token}\n\n"
        "This link expires shortly. If you didn't request this, ignore this email.\n\n"
        "— RouteForge\n"
        f"{settings.FRONTEND_URL}"
    )
    return send_email(to, subject, html, text)


def send_password_changed_email(to: str, name: str | None = None) -> bool:
    """Security confirmation sent after a password is successfully changed."""
    who = name or "there"
    subject = "Your RouteForge password was changed"
    body = (
        f"Hi {who},<br><br>"
        "This is a confirmation that the password for your "
        "<b style=\"color:#ffffff\">RouteForge</b> account was just changed. "
        "You can now sign in with your new password."
    )
    warn = f"""\
<div style="margin:2px 0 4px;padding:14px 16px;background:rgba(249,115,22,0.08);
  border:1px solid rgba(249,115,22,0.35);border-radius:12px;font-size:14px;line-height:1.55;color:{_TEXT}">
  <b style="color:#f9a56b">Didn't change it?</b> Your account may be at risk —
  <a href="{settings.FRONTEND_URL}/forgot-password" style="color:{_ACCENT};text-decoration:underline">reset your password</a>
  right away to secure it.
</div>"""
    html = _wrap(
        "Password changed",
        body,
        "Sign in",
        f"{settings.FRONTEND_URL}/login",
        preheader="Your RouteForge password was just changed.",
        extra_html=warn,
    )
    text = (
        f"Hi {who},\n\n"
        "This confirms the password for your RouteForge account was just changed.\n"
        f"Sign in: {settings.FRONTEND_URL}/login\n\n"
        "Didn't change it? Reset your password immediately to secure your account:\n"
        f"{settings.FRONTEND_URL}/forgot-password\n\n"
        "— RouteForge\n"
        f"{settings.FRONTEND_URL}"
    )
    return send_email(to, subject, html, text)
