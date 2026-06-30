"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveShare } from "@/lib/api";
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatTimeLoss,
} from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/types";

type ShareData = Record<string, unknown> & { type?: string };

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function SharePage({ token }: { token: string }) {
  const [data, setData] = React.useState<ShareData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const res = (await resolveShare(token)) as ShareData;
        setData(res);
      } catch (err) {
        setError((err as Error).message || "This shared link is unavailable.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-bg text-white">
      <div className="container-page py-10">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" aria-label="RouteForge home">
            <Logo size="md" />
          </Link>
          <Badge variant="muted">Shared</Badge>
        </header>

        {loading && (
          <div className="h-64 animate-pulse rounded-xl bg-bg-elevated" />
        )}

        {!loading && error && (
          <Card className="p-8 text-center">
            <div className="text-3xl">🔗</div>
            <p className="mt-3 text-muted">{error}</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm text-accent hover:underline"
            >
              Go to RouteForge →
            </Link>
          </Card>
        )}

        {!loading && data && !error && <ShareContent data={data} />}
      </div>
    </div>
  );
}

function ShareContent({ data }: { data: ShareData }) {
  const type = str(data.type);
  if (type === "event") return <EventShare data={data} />;
  if (type === "race") return <RaceShare data={data} />;
  // Fallback: try to infer.
  if (data.leaderboards) return <EventShare data={data} />;
  return <RaceShare data={data} />;
}

function RaceShare({ data }: { data: ShareData }) {
  const metrics = (data.metrics as Record<string, unknown>) || {};
  const scores = (data.scores as Record<string, unknown>) || {};
  const legs = Array.isArray(data.legs)
    ? (data.legs as Record<string, unknown>[])
    : [];
  const mistakes = Array.isArray(data.mistakes)
    ? (data.mistakes as Record<string, unknown>[])
    : [];
  const name = str(data.name) || str(data.race_name) || "Race analysis";

  const stats = [
    { label: "Distance", value: formatDistance(num(metrics.distance_m)) },
    { label: "Time", value: formatDuration(num(metrics.duration_s)) },
    { label: "Avg pace", value: formatPace(num(metrics.avg_pace_min_km)) },
    { label: "Climb", value: `${Math.round(num(metrics.total_climb_m))} m` },
  ];

  const scoreItems = [
    { label: "Overall", value: num(scores.overall) },
    { label: "Navigation", value: num(scores.navigation) },
    { label: "Fitness", value: num(scores.fitness) },
    { label: "Execution", value: num(scores.execution) },
    { label: "Route choice", value: num(scores.route_choice) },
  ];

  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight">{name}</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {scoreItems.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black tabular-nums text-accent">
                  {s.value || "–"}
                </div>
                <div className="stat-label mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {legs.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Legs</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-5 py-2 font-medium">Leg</th>
                    <th className="px-2 py-2 font-medium">From → To</th>
                    <th className="px-2 py-2 font-medium">Time</th>
                    <th className="px-5 py-2 font-medium">Lost</th>
                  </tr>
                </thead>
                <tbody>
                  {legs.map((leg, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-5 py-2.5 font-medium">
                        {num(leg.number, i + 1)}
                      </td>
                      <td className="px-2 py-2.5 text-muted">
                        {str(leg.from_control, "?")} → {str(leg.to_control, "?")}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {formatDuration(num(leg.time_s))}
                      </td>
                      <td className="px-5 py-2.5 tabular-nums text-amber-300">
                        {formatTimeLoss(num(leg.time_loss_s))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {mistakes.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Mistakes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {mistakes.map((m, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-bg-soft/50 px-4 py-2.5 text-sm"
                >
                  <span>{str(m.description, str(m.type, "Mistake"))}</span>
                  <span className="shrink-0 text-amber-300 tabular-nums">
                    {formatTimeLoss(num(m.lost_s))}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        Analyzed with{" "}
        <Link href="/" className="text-accent hover:underline">
          RouteForge
        </Link>
      </p>
    </div>
  );
}

function EventShare({ data }: { data: ShareData }) {
  const name = str(data.name) || "Event leaderboard";
  const leaderboards =
    (data.leaderboards as Record<string, LeaderboardRow[]>) || {};
  const courses = Object.keys(leaderboards);

  return (
    <div>
      <h1 className="text-3xl font-black tracking-tight">{name}</h1>

      {courses.length === 0 && (
        <Card className="mt-6 p-8 text-center text-muted">
          No leaderboard data available.
        </Card>
      )}

      {courses.map((course) => (
        <Card key={course} className="mt-6">
          <CardHeader>
            <CardTitle>{course}</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-5 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Time</th>
                    <th className="px-5 py-2 font-medium">Behind</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboards[course].map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-5 py-2.5 font-semibold tabular-nums text-accent">
                        {row.position ?? "–"}
                      </td>
                      <td className="px-2 py-2.5 font-medium">{row.name}</td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {row.total_time_s != null
                          ? formatDuration(row.total_time_s)
                          : row.status}
                      </td>
                      <td className="px-5 py-2.5 tabular-nums text-amber-300">
                        {row.behind_s != null && row.behind_s > 0
                          ? `+${formatDuration(row.behind_s)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      <p className="mt-8 text-center text-sm text-muted">
        Hosted with{" "}
        <Link href="/" className="text-accent hover:underline">
          RouteForge
        </Link>
      </p>
    </div>
  );
}
