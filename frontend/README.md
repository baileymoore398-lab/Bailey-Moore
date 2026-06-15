# RouteForge — Frontend

The web frontend for **RouteForge**, an AI race-analysis SaaS for orienteers
and trail runners. Turn a photo of your map plus a GPS track into deep,
leg-by-leg analysis, mistake detection, performance scores, and an AI coach
report.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with a custom dark athletic theme
- Hand-written, **ShadCN-style** UI primitives (`components/ui/`) — no Radix
  dependency
- **Framer Motion** for animations
- **MapLibre GL** for the interactive replay map
- **Recharts** for profile trend charts

## Getting started

```bash
cd frontend
npm install
cp .env.example .env.local   # optional — set NEXT_PUBLIC_API_URL
npm run dev                  # http://localhost:3000
```

### Scripts

| Script          | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start the dev server              |
| `npm run build` | Production build                  |
| `npm run start` | Serve the production build        |
| `npm run lint`  | Run ESLint (`next lint`)          |

## Backend & demo mode

The app talks to the FastAPI backend at `NEXT_PUBLIC_API_URL`
(default `http://localhost:8000`), appending `/api/v1`. The typed API client
lives in `lib/api.ts` and uses a centralized `request()` fetch wrapper that
throws `ApiError` on network/HTTP failures.

**The UI is fully demoable without a backend.** Read endpoints
(`listRaces`, `getAnalysis`, `getAthlete`) fall back to bundled sample data
(`lib/sampleAnalysis.ts`, `lib/sampleData.ts`) when the API is unreachable, so
the analysis dashboard, map replay, and charts all render standalone. A "Demo
data" badge is shown when fallback data is used.

## Pages

| Route            | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `/`              | Marketing landing page (hero, features, CTA)                   |
| `/upload`        | Stepper upload flow (Map → GPS → Splits → Generate)            |
| `/races`         | Race list with status badges                                   |
| `/races/[id]`    | Analysis dashboard: stat cards, replay map, legs, mistakes, AI coach, scores |
| `/athletes/me`   | Athlete profile with aggregate stats and trend charts          |

## Key components

- `components/ReplayMap.tsx` — MapLibre map with a speed-coloured GPS track,
  control markers, start/finish markers, leg highlighting, and a moving replay
  dot.
- `components/ReplayControls.tsx` — play/pause, 1–8× speed, and a timeline
  slider driven by `requestAnimationFrame` over real track timestamps.
- `components/AnalysisDashboard.tsx` — ties the dashboard together; gracefully
  degrades when controls/splits are missing.
- `components/ui/*` — Button, Card, Badge, Tabs, Progress, Slider primitives.

## Notes

- The map uses OpenStreetMap raster tiles (dark-tinted via the MapLibre style)
  so no API key is required for the demo.
