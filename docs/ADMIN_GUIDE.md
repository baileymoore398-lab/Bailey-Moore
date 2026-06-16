# RouteForge — Admin Guide

## Roles
- `athlete` — default; owns races, training, profile.
- `coach` — auto-granted when a user links their first athlete; access to
  `/api/v1/coach/*`.
- `club_admin` — auto-granted when a user creates a club; access to club tools.
- `admin` / superuser — platform administration (`/api/v1/admin/*`).

Promote a user to admin (one-off, via DB):
```sql
UPDATE users SET role='admin', is_superuser=true WHERE email='you@example.com';
```

## Admin API
All require a bearer token for an admin user.
| Endpoint | Purpose |
|---|---|
| `GET /api/v1/admin/stats` | Platform counts (users, races, analyses, by-plan) |
| `GET /api/v1/admin/users` | List users |
| `GET /api/v1/admin/audit` | Audit log (auth events, password resets, GDPR ops) |

## Common operations
- **Seed demo data:** `python -m app.seed` (creates `demo@routeforge.app` / `demodemo1`).
- **Run migrations:** `alembic upgrade head` (auto on deploy).
- **Reset a user password:** issue `POST /api/v1/account/password-reset/request`
  (in production the token is emailed; integrate an email provider).
- **GDPR erasure on request:** the user self-serves via `DELETE /account/me`, or an
  admin can run the equivalent deletion in the DB.

## Billing administration
- Plans are defined in `app/api/v1/billing.py` (`PLANS`).
- Stripe price IDs come from `STRIPE_PRICE_PRO/TEAM/CLUB` env vars.
- Webhook endpoint: `POST /api/v1/billing/webhook` (set `STRIPE_WEBHOOK_SECRET`).
- Plan/usage is stored in the `subscriptions` table; quota resets monthly by
  `period_label`.

## Monitoring
- Logs are structured (`request id=… method=… path=… status=… latency_ms=…`).
- Health: `GET /health`. Wire to your uptime monitor.
- Add a Sentry DSN for error tracking (recommended).

## Storage
- Artifacts (maps, tracks, rendered video) live in S3 under
  `maps/`, `gps/`, `splits/`, `training/`, `videos/`, `events/` prefixes.
- Without S3 configured, the backend falls back to local disk (`storage_data/`,
  dev only).
