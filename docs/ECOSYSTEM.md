# RouteForge Ecosystem — Events, Coaching, Clubs, Training & Sharing

This phase extends RouteForge from a single-athlete analysis tool into a
platform for **events, coaches, clubs and teams**. Everything below is additive
— all existing endpoints and data shapes are unchanged, preserving API
compatibility. The interactive OpenAPI docs at `/docs` document every route.

## Architecture additions

```
                         ┌────────────────────────────────────────────┐
   IOF XML results  ───▶ │  events.ingest_results  → EventEntry rows   │
   Bulk GPX/FIT/TCX ───▶ │  events.ingest_gps_batch                    │
                         │     • parse track → Race + GpsTrack         │
                         │     • run_analysis() per competitor         │
                         │     • match filename → competitor (Jaccard) │
                         │  events.build_event_analysis                │
                         │     → leaderboards / leg rankings / route   │
                         │       comparison  (EventAnalysis)           │
                         └───────────────┬────────────────────────────┘
                                         │
   Training GPX  ─▶ training.analytics ──┤  weekly/monthly volume, ACWR
                                         │  load, race-readiness, PBs
   Race analyses ─▶ coaching.analytics ──┤  trend slopes + AI recs
                                         │
                          replay.heatmap ┤  speed / error / density grids
                                         │
                            sharing ─────┘  tokenized public links + OG image
```

New service packages (all deterministic, reusing the core GPS/splits engines):

| Package | Responsibility |
|---|---|
| `services/events/results.py` | Rich IOF XML 3.0 ResultList parser (class, position, status, splits) |
| `services/events/matching.py` | Filename↔competitor matching (Jaccard token overlap, greedy 1:1) |
| `services/events/analytics.py` | Leaderboards, leg-by-leg rankings, route comparison |
| `services/events/ingest.py` | Bulk ingestion orchestration + multi-competitor replay payload |
| `services/training/analytics.py` | Volume, TRIMP load, acute:chronic ratio, race-readiness, PBs |
| `services/coaching/analytics.py` | Athlete trend series (least-squares slopes) + recommendations |
| `services/replay/heatmap.py` | Spatial grid binning for speed/error/density heatmaps |

New tables (migration `0002_ecosystem`): `event_analyses`, `coach_athletes`,
`teams`, `team_memberships`, `coach_notes`, `training_sessions`, `goals`,
`personal_bests`, `share_links`. The `events` / `event_entries` tables gain
descriptive + result columns (folded into the baseline schema).

## API reference (prefix `/api/v1`)

### Events
| Method | Path | Notes |
|---|---|---|
| POST | `/events` | Create an event |
| GET | `/events` | List events (public + own) |
| GET | `/events/{id}` | Get event (id or slug) |
| GET | `/events/{id}/entries?course=` | Competitor entries |
| POST | `/events/{id}/results` | Upload IOF XML results (multipart `file`) |
| POST | `/events/{id}/gps-batch` | Upload many tracks (multipart `files`), auto-match |
| POST | `/events/{id}/analyze` | Build event-wide analysis |
| GET | `/events/{id}/analysis?course=` | Leaderboards / leg rankings / route comparison |
| GET | `/events/{id}/replay?course=` | Synchronized multi-competitor tracks |

### Coach
| Method | Path |
|---|---|
| POST `/coach/athletes` · GET `/coach/athletes` | Link / list coached athletes |
| GET `/coach/athletes/{id}/trends` | Trend series + AI recommendations |
| POST `/coach/notes` · GET `/coach/athletes/{id}/notes` | Coach feedback |
| POST `/coach/teams` · GET `/coach/teams` · POST `/coach/teams/{id}/members` | Teams |

### Clubs
`POST /clubs`, `GET /clubs`, `POST /clubs/{id}/members`,
`GET /clubs/{id}/members`, `GET /clubs/{id}/analytics` (member rankings, totals,
event participation).

### Training
`POST /training/sessions` (upload), `GET /training/sessions`,
`GET /training/analytics` (volume / load / readiness / PBs),
`POST /training/goals`, `GET /training/goals` (auto-progressed).

### Sharing & Replay
`POST /share`, `GET /share/{token}` (public), `GET /share/{token}/og-image.svg`
(social preview). `GET /replay/races/{id}/heatmap?mode=density|speed|error`,
`GET /replay/events/{id}/heatmap?mode=density|speed`.

## Key algorithms

* **Competitor matching** — normalizes filename and competitor name into token
  sets, scores by Jaccard overlap, boosts to 0.9 when every name token is
  present, then assigns greedily 1:1 so each result is claimed once.
* **Training load (ACWR)** — TRIMP-style per-session load (HR fraction × minutes,
  or speed-intensity fallback); acute = last 7 days, chronic = 28-day weekly
  average; ratio classified into detraining / optimal / caution / high-risk.
* **Race readiness** — weighted blend of load-balance (best in the 0.8–1.3 ACWR
  band), recent training volume, and recent navigation form.
* **Coaching trends** — least-squares slope over each metric series flags whether
  navigation, route efficiency, time-loss and error counts are improving or
  regressing, driving concrete recommendations.
* **Heatmaps** — track points (one or many athletes) are binned onto a uniform
  ~12 m lat/lon grid; cells aggregate visit density, mean speed, or time-loss
  near mistakes, normalized to [0,1] intensity for rendering.

## Tests

`tests/test_ecosystem_engines.py` (engine-level numeric assertions) and
`tests/test_ecosystem_api.py` (full event/coach/club/training/share flows via
`TestClient`). Run `pytest` from `backend/`.
