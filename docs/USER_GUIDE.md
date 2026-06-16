# RouteForge — User Guide

Welcome! RouteForge turns your GPS track and event results into a full
performance analysis: replay, split timing, route-choice quality, mistake
detection, scores, and AI coaching.

## Getting started
1. **Create an account** at `/register` (or `/login` if you have one).
2. You land on your **Dashboard** — your readiness, training load, and recent races.

## Analyze a race
1. Go to **Analyze** (`/upload`).
2. Upload any of: a **map photo** (phone photo is fine), a **GPS track**
   (GPX/FIT/TCX), and **split times** (IOF XML or WinSplits CSV). A GPS track or
   splits is the minimum.
3. Click **Generate**. You'll be taken to the analysis dashboard.
4. Explore: interactive **replay** (play/pause/speed), per-leg table, **mistakes**,
   **scores** (navigation / fitness / execution / route choice), and the **AI coach**
   report. Toggle **speed / error heatmaps** in the replay.

## Track your training
1. Go to **Training** (`/training`).
2. Upload run/ride GPX files. RouteForge computes distance, climb, pace, heart
   rate, and a **training load**.
3. See weekly/monthly volume, **ACWR** (acute:chronic load) zone, **race-readiness**
   score, personal bests, and set **goals**.

## Events
- Organisers create an event at `/events`, upload **IOF XML results** and a batch
  of competitor **GPX files** (auto-matched by name), then **Analyze**.
- Everyone can view the **leaderboard**, **leg-by-leg rankings**, **route-choice
  comparison**, and a **multi-athlete replay**.

## Coaches & clubs
- **Coaches** (`/coach`): link athletes by handle, view performance trends and
  AI recommendations, leave notes.
- **Clubs** (`/clubs`): manage members and see club-wide rankings and stats.

## Share your runs
- On any analyzed race, create a **share link**. Anyone can open it at `/s/<token>`
  — no account needed — with a social preview image for posting.

## Plans
- **Free**: 3 analyses / month. **Pro**: unlimited + AI coach + video export +
  heatmaps. **Team** / **Club**: coach and club dashboards. See `/pricing`.

## Tips
- Phone photos of paper maps work — RouteForge auto-crops, de-skews, and finds
  control circles. If confidence is low it'll ask you to confirm placement.
- No GIS knowledge required; alignment to your GPS is automatic.
