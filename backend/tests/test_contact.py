"""Contact form endpoint: owner notification + sender auto-reply."""
from unittest.mock import patch

from app.config import settings


def test_contact_disabled_returns_not_delivered(app_client):
    # No email transport → 200 but delivered=false so the client falls back.
    r = app_client.post(
        "/api/v1/contact",
        json={"name": "Sam", "email": "sam@x.com", "message": "hi"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["delivered"] is False


def test_contact_sends_notification_and_ack(app_client):
    sent = []
    with patch.object(settings, "RESEND_API_KEY", "re_test"), \
         patch("app.api.v1.contact.send_contact_notification_email",
               side_effect=lambda *a, **k: sent.append(("notify", a))), \
         patch("app.api.v1.contact.send_contact_ack_email",
               side_effect=lambda *a, **k: sent.append(("ack", a))):
        r = app_client.post(
            "/api/v1/contact",
            json={"name": "Sam", "email": "sam@x.com", "subject": "Bug",
                  "message": "The replay won't load."},
        )
    assert r.status_code == 200
    assert r.json()["delivered"] is True
    kinds = {k for k, _ in sent}
    assert kinds == {"notify", "ack"}


def test_contact_no_email_skips_ack(app_client):
    """Without a sender email we still notify the owner but send no auto-reply."""
    sent = []
    with patch.object(settings, "RESEND_API_KEY", "re_test"), \
         patch("app.api.v1.contact.send_contact_notification_email",
               side_effect=lambda *a, **k: sent.append("notify")), \
         patch("app.api.v1.contact.send_contact_ack_email",
               side_effect=lambda *a, **k: sent.append("ack")):
        r = app_client.post("/api/v1/contact", json={"message": "anon feedback"})
    assert r.status_code == 200
    assert sent == ["notify"]


def test_contact_rejects_empty_message(app_client):
    r = app_client.post("/api/v1/contact", json={"message": ""})
    assert r.status_code == 422
