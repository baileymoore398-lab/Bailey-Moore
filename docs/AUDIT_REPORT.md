# RouteForge — Full Site & Codebase Audit

**Date:** 2026-07-11
**Scope:** Entire repository — backend (FastAPI), frontend (Next.js 14), infrastructure/deploy, dependencies, content & legal.
**Method:** Automated checks (tests, linters, type-check, production build, secret scan, dependency CVE audits) plus four in-depth code reviews (backend security, frontend quality/a11y/SEO, infra/ops, content/legal). Every finding below was verified against source; nothing is speculative.

Size reviewed: ~8,600 LOC backend Python, ~13,100 LOC frontend TS/TSX, 72 API endpoints, 24 pages, 5 migrations.

---

## 0. Executive summary

RouteForge is a genuinely well-built product. The code is clean (no TODO/FIXME debt, no dead links, no injection surface), the tests pass, both apps build, and there are no leaked secrets. Many things that commonly go wrong in a solo-built SaaS are done *right* here: production boot guards, server-side PayPal verification, graceful AI fallback, lazy-loaded heavy deps, substantive NZ-jurisdiction legal pages with working GDPR endpoints.

The issues that matter cluster in three areas:

1. **Access control** — several endpoints don't verify ownership, so one user can read/modify another user's data (races, athletes, events, clubs) or grant themselves paid plans. **Fix before any real user growth.**
2. **Abuse protection** — a rate limiter is configured but never actually wired in, leaving the contact form / password-reset / analysis / video endpoints open to email-bombing and compute-DoS. **Fix before public launch.**
3. **Two "flip the switch" landmines** — enabling memberships today would sell features the backend doesn't enforce; and the default file storage loses all uploads on every redeploy. **Fix before enabling billing / before onboarding paying users.**

None of these block the site being *live and free* today, but they are the gating items for **charging money** and **scaling past a handful of trusted users**.

### Health snapshot (automated checks)

| Check | Result |
|---|---|
| Backend tests (`pytest`) | ✅ 59 passing |
| Backend lint (`ruff`) | ✅ clean |
| Frontend type-check (`tsc --noEmit`) | ✅ clean |
| Frontend lint (`next lint`) | ✅ clean |
| Frontend production build | ✅ succeeds |
| Secret scan (repo) | ✅ no secrets committed |
| Frontend deps (`npm audit`) | ⚠️ 2 critical, 6 high, 2 moderate — all fixable |
| Backend deps (`pip-audit`) | ⚠️ CVEs in python-jose, pillow, starlette, ecdsa |

### Finding counts

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 11 |
| Medium | 20 |
| Low / Info | ~25 |

---

## 1. Critical

### C1 — Rate limiting is configured but never enforced
`backend/app/main.py:25,38` — A `slowapi` limiter and error handler are attached, but **no `SlowAPIMiddleware` is added and no route is decorated**, so `default_limits` do nothing. Every endpoint is effectively unlimited. This is the multiplier behind every abuse finding below (email bombing, compute DoS).
**Fix:** `app.add_middleware(SlowAPIMiddleware)` and decorate sensitive routes; back the limiter with Redis (`storage_uri=REDIS_URL`) so limits work across instances.

### C2 — Dependency vulnerabilities (2 critical, high count) in shipped libraries
Frontend `npm audit`: **`next@14.2.5`** (cache poisoning + image-optimization DoS) and **`jspdf`** (ReDoS/DoS) are both *critical* with fixes available; plus high-severity `dompurify` (XSS), `postcss`, and the eslint/glob/minimatch chain. Backend `pip-audit`: `python-jose` (the JWT library — PYSEC-2024-233/2025-185), `pillow` (multiple 2026 CVEs), `starlette` (several), `ecdsa`.
**Fix:** `npm audit fix` (bump Next to latest 14.2.x patch, jsPDF to 3.x), and pin backend upgrades: `python-jose→3.4.0`, `pillow→≥11`, `starlette→≥0.40`, review `ecdsa`. Re-run the test suite after.

---

## 2. High

### Backend — broken access control (IDOR / authz)
These let one authenticated user reach another user's data or escalate. All are the same root cause: the handler checks *login* but not *ownership*.

- **H1 — Share-link creation doesn't check ownership** `backend/app/api/v1/sharing.py:22-36` — any user can mint a public share link to *any* race/event/athlete by ID, exposing another user's private analysis via the public `resolve_share`.
- **H2 — Self-asserted coach link** `backend/app/api/v1/coach.py:63-79` — `link_athlete` creates an `active` coach→athlete link with no athlete consent, so any user can then read any athlete's scores/metrics/mistakes.
- **H3 — Event mutation unguarded** `backend/app/api/v1/events.py:98,112,125` — `upload_results`, `upload_gps_batch`, `analyze_event` never check `organiser_user_id == user.id`; anyone can overwrite results/GPS and trigger expensive analysis on any event.
- **H4 — Club member-add unguarded** `backend/app/api/v1/clubs.py:59-74` — any user can add athletes to any club; `create_club` also self-promotes the caller to `club_admin`.
- **H5 — Unauthenticated, unmetered video generation** `backend/app/api/v1/files.py:33-59` — `POST /races/{id}/video` has *no auth and no ownership check*; anyone can spawn ffmpeg H.264 renders for any race → CPU/memory DoS + unauthorized use.
- **H6 — Stripe webhook signature optional** `backend/app/api/v1/billing.py:209-230` — when `STRIPE_WEBHOOK_SECRET` is unset the handler `json.loads` the body with **no signature check** and applies plan upgrades; a forged event can grant a paid plan.

**Fix pattern:** add an ownership/authorization check to each handler (reuse the existing `_authorize_race_write` style); reject unsigned Stripe webhooks in production.

### Infra / ops
- **H7 — Uploads are lost on every redeploy** `backend/app/services/storage/store.py:121-127` — storage uses S3 only if AWS creds are set, else silently falls back to `./storage_data` on the **ephemeral** Railway/Render disk. S3 is documented as "optional," so the default prod path **loses all maps, GPS files and videos on each deploy/restart**, with no warning logged.
  **Fix:** require S3 in production (fail-fast like the DB/JWT guards) or at minimum log a loud warning; document S3 as mandatory.
- **H8 — Render web service runs analysis inline** `render.yaml` vs `backend/app/config.py:68` — `CELERY_TASK_ALWAYS_EAGER` defaults to `True` and Render sets it false only on the worker, so on Render the API runs the heavy CV pipeline **inside the HTTP request**, blocking uvicorn while the worker idles.
  **Fix:** set `CELERY_TASK_ALWAYS_EAGER=false` on the web service and flip the code default to `False`.
- **H9 — Failed migrations don't stop startup** `backend/docker-entrypoint.sh:26-29` — `alembic upgrade head || echo "…continuing"` boots the API against a half-migrated schema → runtime 500s instead of a failed deploy.
  **Fix:** remove the `|| echo` fallback so a migration failure aborts startup.
- **H10 — Analyze crashes hard if Redis is down** `backend/app/api/v1/races.py:293-298` — with EAGER=false, `run_analysis_task.delay()` has no try/except; a broker outage propagates a raw 500.
  **Fix:** wrap `.delay()`; fall back to inline or return a clean 503; add broker health to readiness.

### Frontend
- **H11 — Signed-in users always see demo data on their own race & profile** `frontend/app/races/[id]/page.tsx:4-16`, `frontend/app/athletes/me/page.tsx:7-10` — these are async **Server Components** that call the API client, but the JWT lives only in `localStorage` (`lib/auth.ts:14-17` returns `null` server-side) → the server fetch is unauthenticated → 401 → **sample data for every real user and every crawler**.
  **Fix:** fetch these in a Client Component with the token, or move auth to an httpOnly cookie the server can read (the cleaner fix — also addresses the localStorage-XSS note in §4).

---

## 3. Medium

### Backend security
- **M1 — Public read of any race/analysis by ID** `races.py:97-99,306-311`, `replay.py:17,35`, `events.py:76,137,158` — `GET /races/{id}`, `/analysis`, heatmaps and event fetches are anonymous and ignore ownership / `is_public`. Intended for share links, but there's no share-token gate → direct IDOR read of all races/events.
- **M2 — Anonymous club member/analytics disclosure** `clubs.py:77,91` — member handles, per-athlete distances and scores exposed without auth.
- **M3 — PayPal subscription replay / no uniqueness** `billing.py:100-152`, `models/subscription.py:30` — `paypal_confirm` doesn't check the subscription isn't already bound to another user (no unique constraint), doesn't match subscriber to user, and skips the plan-ID check when a tier's plan ID is unset.
- **M4 — Reset token reusable for 1h; password change doesn't revoke sessions** `security.py:51-67`, `account.py:109-128` — no one-time/`jti` semantics; 7-day access tokens survive a password change (stateless JWT); `is_active` not checked on reset.
- **M5 — No upload size cap on training/event uploads** `training.py:54`, `events.py:104,120` — read entire files into memory (races cap at 60 MB; these don't) → memory-exhaustion DoS.
- **M6 — KMZ/ZIP decompression bomb** `services/gps/parser.py:221-234,301` — `zf.read()` with no decompressed-size limit; a small zip can inflate to GBs.
- **M7 — XML entity-expansion DoS** `services/gps/parser.py:51,86,180` — stdlib `ElementTree` on GPX/TCX/KML/IOF-XML (no external-entity XXE, but internal entity-expansion DoS). Use `defusedxml`.
- **M8 — Email-bomb via contact form / password reset** `contact.py:47-53`, `account.py:80` — unauthenticated, unthrottled (see C1); sends mail to attacker-supplied addresses → email bomb + burns Resend/SMTP quota.

### Backend — GDPR completeness
- **M9 — Export incomplete** `account.py:131-157` — omits AnalysisFeedback, IntegrationToken (Strava), Subscription/billing IDs, AuditLog, CoachNote, memberships, ShareLink, event entries.
- **M10 — Erasure incomplete** `account.py:160-180` — leaves **Strava OAuth tokens** (most serious), feedback, coach links/notes, club/team memberships, share links, audit logs, and dangling owned clubs/events. A "permanently deleted" user still has live Strava tokens stored.
  **Fix:** delete integration tokens, feedback, coach links, memberships, share links; anonymize or delete owned clubs/events; state an explicit audit-log retention policy.

### Infra / ops
- **M11 — Migrations use `create_all` from live metadata** `alembic/versions/0001…0004` read current models rather than declaring explicit columns → a new column on an *existing* table is created on fresh DBs but **never ALTERed onto prod** unless hand-written (as 0005 was). Latent prod-crash pattern.
  **Fix:** autogenerate explicit `op.add_column`/`op.create_table`; add a CI `alembic upgrade head` + drift check.
- **M12 — `ADMIN_EMAILS` defaults to a real hardcoded address** `config.py:81` — anyone who registers `route.forge.official@gmail.com` on the deployed instance becomes admin; not documented in env templates.
  **Fix:** default to `""`, document, require explicit set in prod.
- **M13 — Local file server has no authz** `files.py:20-30` — `GET /api/v1/files/{key}` serves any storage key (predictable paths) with no auth; in local-fallback prod (H7) this exposes all uploads/videos.
- **M14 — Shallow health check** `main.py:95-97` — `/health` returns ok unconditionally; platform can't detect DB/Redis outages. Add a readiness probe doing `SELECT 1` + Redis ping.
- **M15 — No error tracking (Sentry)** — unhandled errors only log locally; on ephemeral hosts, stack traces vanish and there's no alerting.
- **M16 — `.env.example` drift** — documents dead vars (`RATE_LIMIT_REQUESTS/WINDOW` [app reads `RATE_LIMIT_DEFAULT`], `STRIPE_PRICE_*`, `GARMIN_*`, `CLERK_*`) and omits real ones (`ADMIN_EMAILS`, `OPENAI_MODEL`, `FREE_PLAN_MONTHLY_ANALYSES`, `CORS_ORIGIN_REGEX`, `CELERY_*`). Operators tuning documented knobs get no effect.
- **M17 — No `.dockerignore`** — `COPY . .` with no ignore file embeds `.git`, `node_modules`, local `.env`, `*.db` into images on local/manual builds (bloat + secret-leak vector).

### Frontend
- **M18 — Client-rendered marketing pages share one title/description** — `pricing`, `contact`, `login`, `register` are `"use client"` (can't export `metadata`) yet are in the sitemap → duplicate `<title>` across key pages. Split into a Server wrapper + client child.
- **M19 — Form labels not associated** — 28 `<label>` elements, 0 `htmlFor` in the codebase; screen readers won't announce field names. Add matching `htmlFor`/`id`.
- **M20 — Tutorial modal lacks focus trap / dialog roles** `components/Tutorial.tsx:168-179` — has Escape + scroll-lock, but no `role="dialog"`/`aria-modal`, no focus trap, no focus restore; keyboard/AT users tab behind it.
- **M21 — recharts imported statically** in 4 chart components — heavy (~100 kB+) and eager in dashboard/coach/athlete/training bundles. `next/dynamic(..., { ssr:false })` them.

### Content / legal
- **M22 — Paid-tier features aren't actually enforced** `billing.py:26-35` vs code — heatmaps (`replay.py:18,36`) and video export (`files.py:34`) are ungated; no athlete cap, coach/club/sharing gating exists. Only the free 5-analyses quota is real (and disabled until `memberships_live`). Enabling billing today sells differentiators the backend doesn't restrict.
  **Fix before enabling memberships:** add plan checks or rewrite the pricing copy to match reality.
- **M23 — Strava (and Formspree) undisclosed in Privacy Policy** — the app stores Strava OAuth tokens and imports Strava activity data, and the contact form falls back to Formspree; neither third party is named in the policy. Add them to the collection + processor lists.
- **M24 — Default email `From:` is `onboarding@resend.dev`** `config.py:194-197` — when `EMAIL_FROM` is unset, mail sends from Resend's shared test sender (no SPF/DKIM alignment to routeforge.world → poor deliverability, off-brand). Require `EMAIL_FROM=no-reply@routeforge.world` in prod.

---

## 4. Low / Info (grouped)

- **Client-side JWT in `localStorage`** (`lib/auth.ts`) — XSS-exfiltratable; moving to an httpOnly cookie also fixes H11.
- **Config-leaking error message to end users** `frontend/app/upload/page.tsx:113-118` — shows "NEXT_PUBLIC_API_URL isn't set… CORS_ORIGINS…" to athletes. Replace with a friendly message; keep detail in logs.
- **`FRONTEND_URL` default is `localhost:3000`** `config.py:165` while email footer text hard-codes "routeforge.world" — set default to the real domain so email links aren't localhost.
- **Contact/admin address is a Gmail account** — off-brand for the legal "controller"; use `hello@routeforge.world`.
- **Privacy §2 "last four digits of card"** — inaccurate for PayPal; soften wording; say "processor(s)".
- **No physical postal address in email footer** — CAN-SPAM/CASL best practice.
- **SEO nits** — no per-page `canonical`; `/admin` & `/debug` crawlable (add to robots disallow); only FAQ has JSON-LD (add Organization/WebSite schema); PWA `start_url:"/dashboard"` (auth-gated) → prefer `/`.
- **a11y nits** — decorative emoji without `aria-hidden` in a few spots; Framer Motion animations don't check `useReducedMotion()` (CSS ones do); verify notice text hits 4.5:1 contrast.
- **Info-leak in error text** — `integrations.py:156,179`, `billing.py:127,225` echo upstream exception text to clients.
- **Docker** — runtime stage ships `libgdal-dev` (dev headers unneeded at runtime); no frontend `HEALTHCHECK`.
- **CI gaps** — pytest/ruff steps are self-skipping (a broken discovery goes green); no frontend `tsc --noEmit` or tests in CI; no migration drift check.
- **Postgres backups** — a manual checklist item, not automated; no `pg_dump`/PITR job in repo.
- **Dead assets** — several `public/logo-*.jpg/svg` appear unused (UI renders inline `LogoMark`).
- **`next.config` images** allow any host (`hostname:"**"`) — low impact today (no `next/image` raster use).

---

## 5. What's done well (positives)

**Security & correctness**
- No injection surface anywhere: 100% SQLAlchemy ORM, no `os.system`/`eval`/`exec`, ffmpeg invoked with a fixed argv + stdin piping (no arg injection), no SSRF (all httpx hosts hardcoded), OG-image SVG escapes user input.
- Production fail-fast guards: refuses to boot with SQLite-in-prod or a weak/default/short `JWT_SECRET` (`database.py:18-45`).
- Path traversal blocked in local storage via `resolve()` + root-prefix check.
- bcrypt password hashing with proper 72-byte handling; account-enumeration-safe password reset; a security "password changed" confirmation email.
- **PayPal upgrades verified server-side** (status must be ACTIVE/APPROVED and plan_id must match) — the browser is not trusted.
- Docs/OpenAPI disabled in production; generic 500s that don't leak stack traces; request-ID structured access logs.
- No secrets committed; no secrets in `NEXT_PUBLIC_*`; all external links `rel="noopener noreferrer"`; only static `dangerouslySetInnerHTML` (JSON-LD).

**Architecture & ops**
- Clean migration chain (0001→0005), all model tables covered, idempotent column guard.
- Multi-stage Docker images, non-root users, pinned bases, no compiler/secrets in runtime image.
- **Graceful AI degradation** — rule-based coach fallback means OpenAI outages/quota never break analysis.
- Celery memory-tuned for the heavy CV stack; `pool_pre_ping` on the DB; robust config normalization (`postgres://` rewrite, blank→None, CORS-as-string).
- CI runs against real Postgres + Redis containers with native GDAL/FFmpeg.

**Frontend & product**
- Heaviest deps (ffmpeg.wasm, maplibre, jspdf) all lazy-loaded — disciplined initial bundle.
- Excellent demo/offline UX that classifies `demo` / `auth` (401) / `offline` and never wrongly blames the backend.
- Typed API layer with retry+backoff and FastAPI error normalization; loading/empty states throughout; friendly 404.
- No TODO/FIXME debt; no broken internal links; consistent file-format lists across pages.

**Legal & content**
- Substantive legal pages: NZ governing law + Privacy Act 2020 + GDPR bases, AI-output disclaimers, and subscription/refund/cancellation terms that match the PayPal reality.
- **GDPR export + erasure genuinely implemented and reachable from Settings** — policy claims backed by working endpoints (even if completeness needs the M9/M10 fixes).
- Landing/FAQ claims all map to real backend capabilities — no invented metrics or fake trust logos.

---

## 6. Prioritized remediation roadmap

**Now (before public launch / any real users beyond trusted testers)**
1. Wire up rate limiting (C1) — unlocks protection for the email-bomb / DoS paths.
2. Add ownership checks to sharing, coach-link, event mutations, club member-add, and `/races/{id}/video` (H1–H5); reject unsigned Stripe webhooks (H6).
3. `npm audit fix` + backend CVE bumps (C2), then re-run tests.
4. Require S3 in production so uploads survive redeploys (H7); stop swallowing failed migrations (H9).

**Before charging money (enabling `MEMBERSHIPS_ENABLED`)**
5. Enforce paid-tier features or rewrite pricing copy (M22).
6. PayPal subscription uniqueness/replay protection (M3).
7. Fix the Render EAGER default (H8) and the Redis-down analyze crash (H10).

**Before scaling / for polish**
8. Fix H11 (Server-Component JWT) — ideally by moving auth to an httpOnly cookie, which also hardens the client-side token.
9. Complete GDPR export/erasure, especially deleting Strava tokens (M9/M10).
10. Disclose Strava + Formspree in Privacy; move contact + email `From:` onto routeforge.world (M23/M24).
11. Add decompression-bomb + XML protections and upload caps (M5–M7); deepen `/health`, add Sentry (M14/M15); harden CI (typecheck, unconditional tests, migration drift).
12. Frontend polish: split marketing-page metadata, associate form labels, harden the Tutorial modal, lazy-load recharts (M18–M21).

---

*Generated by an automated multi-agent audit plus verified hard checks (tests, linters, build, secret scan, dependency CVE audits). Findings were confirmed against source; line numbers reference the repository at the audited commit.*

---

## 7. Remediation status (2026-07-11)

The findings above were then fixed. Summary of what changed:

**Critical** — both resolved.
- C1 rate limiting: `SlowAPIMiddleware` wired app-wide + tight per-endpoint throttles (contact 5/h, reset 5/h, analyze 30/h, video 10/h); Redis-backed in prod via `RATE_LIMIT_STORAGE_URI`.
- C2 dependencies: fastapi 0.115 / starlette 0.41, python-jose 3.4, pillow 11.3, jsPDF 4.2.1, next 14.2.33. *Remaining:* Next's newer DoS advisories need a Next 16 major upgrade (React 19) — tracked as a separate migration, not done here.

**High** — resolved: H1 share ownership, H2 coach consent (pending + accept flow), H3 event-mutation authz, H4 club member-add authz, H5 video auth+authz, H6 Stripe unsigned-webhook rejection, H7 loud prod storage-fallback warning, H8/D1 Render EAGER fix, H9 fail-closed migrations, H10 broker-down inline fallback, H11 races/athlete pages now client-fetch with the token.

**Medium** — resolved: M1 private-by-default reads, M2 club-read auth, M3 PayPal anti-replay + required plan match, M5 upload caps, M6 zip-bomb cap, M7 defusedxml, M9/M10 GDPR export+erasure completeness (incl. Strava tokens), M11 (CI drift check recommended in docs), M12/D2 empty ADMIN_EMAILS default, M14 deep health check, M15 optional Sentry, M16 `.env` reconcile, M17 `.dockerignore`, M18 per-page metadata, M19 (labels — partial), M20 Tutorial focus trap/dialog roles, M21 recharts lazy-load, M22 video+heatmap plan gating, M23 Strava/Formspree disclosure, M24 (FRONTEND_URL default + documented sender).

**Deliberately deferred** (documented, not fixed): Next 16 major upgrade; moving the JWT from localStorage to an httpOnly cookie (architectural); the remaining softer paid-tier gates (team athlete cap, coach/club dashboards); adding a physical postal address / routeforge.world mailbox to emails (needs your details); `M4` session-revocation-on-password-change (stateless-JWT tradeoff).

All backend tests pass (64), ruff clean, frontend typecheck + lint clean, production build succeeds.
