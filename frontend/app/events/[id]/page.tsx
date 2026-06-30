"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  analyzeEvent,
  getEvent,
  getEventAnalysis,
  getEventReplay,
  uploadEventGps,
  uploadEventResults,
} from "@/lib/api";
import type {
  EventAnalysis,
  EventDetail,
  EventReplay,
} from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoNotice } from "@/components/DemoNotice";
import { Leaderboard } from "@/components/Leaderboard";
import { LegRankings } from "@/components/LegRankings";
import { formatDistance, formatDuration, formatTimeLoss } from "@/lib/utils";

const MultiReplayMap = dynamic(
  () => import("@/components/MultiReplayMap").then((m) => m.MultiReplayMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[420px] place-items-center rounded-xl border border-border bg-bg-soft/60 text-muted">
        Loading replay…
      </div>
    ),
  }
);

export default function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;
  const [event, setEvent] = React.useState<EventDetail | null>(null);
  const [analysis, setAnalysis] = React.useState<EventAnalysis | null>(null);
  const [demo, setDemo] = React.useState(false);
  const [demoReason, setDemoReason] = React.useState<
    "demo" | "auth" | "offline" | undefined
  >(undefined);
  const [course, setCourse] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    const [ev, an] = await Promise.all([getEvent(id), getEventAnalysis(id)]);
    setEvent(ev.data);
    setAnalysis(an.data);
    setDemo(ev.demo || an.demo);
    setDemoReason(ev.reason || an.reason);
    const courses = Object.keys(an.data.leaderboards);
    setCourse((c) => c ?? courses[0] ?? null);
  }, [id]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const courses = analysis ? Object.keys(analysis.leaderboards) : [];
  const activeCourse = course ?? courses[0] ?? "";

  return (
    <div className="container-page space-y-6 py-8">
      {demo && <DemoNotice context="event data" reason={demoReason} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {event?.name ?? "Event"}
            </h1>
            {event && <StatusBadge status={event.status} />}
          </div>
          {event && (
            <p className="mt-0.5 text-sm text-muted">
              {event.discipline}
              {event.location ? ` · ${event.location}` : ""} ·{" "}
              {event.entry_count} entries · {event.matched_gps} GPS matched
            </p>
          )}
        </div>
      </div>

      {analysis && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Courses" value={analysis.stats.courses} />
          <Stat label="Competitors" value={analysis.stats.competitors} />
          <Stat label="Finishers" value={analysis.stats.finishers} />
          <Stat label="GPS matched" value={analysis.stats.gps_matched} />
        </div>
      )}

      <Tabs defaultValue="leaderboard" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="legs">Leg rankings</TabsTrigger>
            <TabsTrigger value="routes">Route comparison</TabsTrigger>
            <TabsTrigger value="replay">Multi-replay</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
          </TabsList>
          {courses.length > 0 && (
            <CourseSelector
              courses={courses}
              value={activeCourse}
              onChange={setCourse}
            />
          )}
        </div>

        <TabsContent value="leaderboard">
          <Leaderboard rows={analysis?.leaderboards[activeCourse] ?? []} />
        </TabsContent>

        <TabsContent value="legs">
          <LegRankings legs={analysis?.leg_rankings[activeCourse] ?? []} />
        </TabsContent>

        <TabsContent value="routes">
          <RouteComparison
            legs={analysis?.route_comparison[activeCourse] ?? []}
          />
        </TabsContent>

        <TabsContent value="replay">
          <ReplayTab eventId={id} course={activeCourse} />
        </TabsContent>

        <TabsContent value="manage">
          <ManageTab eventId={id} onChanged={refetch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </CardContent>
    </Card>
  );
}

function CourseSelector({
  courses,
  value,
  onChange,
}: {
  courses: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Course</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-bg-soft px-3 py-1.5 text-sm text-white outline-none focus:border-accent/60"
      >
        {courses.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );
}

function RouteComparison({
  legs,
}: {
  legs: EventAnalysis["route_comparison"][string];
}) {
  if (!legs.length) {
    return (
      <p className="rounded-lg border border-border bg-bg-soft/60 p-4 text-sm text-muted">
        No route comparison for this course yet.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {legs.map((leg) => (
        <div
          key={leg.leg}
          className="overflow-hidden rounded-xl border border-border bg-bg-card/60"
        >
          <div className="border-b border-border bg-bg-soft px-4 py-2.5 text-sm font-semibold text-white">
            Leg {leg.leg}
            <span className="ml-2 font-normal text-muted">
              {leg.from_control} → {leg.to_control}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Competitor</th>
                <th className="px-4 py-2 text-right font-medium">Distance</th>
                <th className="px-4 py-2 text-right font-medium">Efficiency</th>
                <th className="px-4 py-2 text-right font-medium">Time loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leg.competitors.map((c, i) => (
                <tr key={`${leg.leg}-${c.name}-${i}`}>
                  <td className="px-4 py-2 font-medium text-white">{c.name}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">
                    {formatDistance(c.distance_m)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">
                    {c.efficiency != null
                      ? `${Math.round(c.efficiency * 100)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-accent-hot">
                    {c.time_loss_s != null
                      ? formatTimeLoss(c.time_loss_s)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function ReplayTab({
  eventId,
  course,
}: {
  eventId: string;
  course: string;
}) {
  const [replay, setReplay] = React.useState<EventReplay | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    void getEventReplay(eventId, course || undefined).then(({ data }) => {
      if (active) {
        setReplay(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [eventId, course]);

  if (loading) {
    return (
      <div className="grid h-full min-h-[420px] place-items-center rounded-xl border border-border bg-bg-soft/60 text-muted">
        Loading replay…
      </div>
    );
  }
  if (!replay || replay.competitors.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-bg-soft/60 p-4 text-sm text-muted">
        No GPS tracks to replay for this course yet.
      </p>
    );
  }
  return <MultiReplayMap competitors={replay.competitors} />;
}

interface GpsMatch {
  filename?: string;
  name?: string;
  matched?: boolean;
  status?: string;
  competitor?: string;
}

function ManageTab({
  eventId,
  onChanged,
}: {
  eventId: string;
  onChanged: () => Promise<void>;
}) {
  const [resultsMsg, setResultsMsg] = React.useState<string | null>(null);
  const [gpsResults, setGpsResults] = React.useState<GpsMatch[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const handleResults = async (file: File | undefined) => {
    if (!file) return;
    setBusy("results");
    setError(null);
    try {
      await uploadEventResults(eventId, file);
      setResultsMsg(`Uploaded ${file.name}`);
      await onChanged();
    } catch (err) {
      setError((err as Error).message || "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const handleGps = async (files: File[]) => {
    if (!files.length) return;
    setBusy("gps");
    setError(null);
    try {
      const res = (await uploadEventGps(eventId, files)) as unknown;
      const matches = Array.isArray(res)
        ? (res as GpsMatch[])
        : ((res as { results?: GpsMatch[] })?.results ?? []);
      setGpsResults(
        matches.length
          ? matches
          : files.map((f) => ({ filename: f.name, status: "uploaded" }))
      );
      await onChanged();
    } catch (err) {
      setError((err as Error).message || "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const analyze = async () => {
    setBusy("analyze");
    setError(null);
    try {
      await analyzeEvent(eventId);
      await onChanged();
    } catch (err) {
      setError((err as Error).message || "Analyze failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* IOF results */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <h3 className="text-sm font-semibold text-white">
            Upload IOF results
          </h3>
          <p className="text-xs text-muted">
            A single IOF XML splits/results file.
          </p>
          <input
            type="file"
            accept=".xml"
            onChange={(e) => handleResults(e.target.files?.[0])}
            className={fileCls}
          />
          {busy === "results" && (
            <p className="text-xs text-muted">Uploading…</p>
          )}
          {resultsMsg && (
            <p className="text-xs text-emerald-300">{resultsMsg}</p>
          )}
        </CardContent>
      </Card>

      {/* GPX batch */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <h3 className="text-sm font-semibold text-white">Upload GPX tracks</h3>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleGps(Array.from(e.dataTransfer.files));
            }}
            className={
              "rounded-xl border border-dashed p-6 text-center text-sm transition " +
              (dragging
                ? "border-accent bg-accent/5 text-white"
                : "border-border text-muted")
            }
          >
            Drag &amp; drop GPX files here, or
            <label className="ml-1 cursor-pointer text-accent underline">
              browse
              <input
                type="file"
                accept=".gpx"
                multiple
                className="hidden"
                onChange={(e) =>
                  handleGps(Array.from(e.target.files ?? []))
                }
              />
            </label>
          </div>
          {busy === "gps" && <p className="text-xs text-muted">Uploading…</p>}
          {gpsResults.length > 0 && (
            <ul className="space-y-1">
              {gpsResults.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-soft/60 px-3 py-1.5 text-xs"
                >
                  <span className="truncate text-white">
                    {r.filename ?? r.name ?? `File ${i + 1}`}
                  </span>
                  <Badge
                    variant={
                      r.matched || r.competitor ? "success" : "muted"
                    }
                  >
                    {r.competitor ?? r.status ?? (r.matched ? "matched" : "unmatched")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Analyze */}
      <Card className="lg:col-span-2">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Analyze event</h3>
            <p className="text-xs text-muted">
              Build leaderboards, leg rankings, and route comparisons from the
              uploaded data.
            </p>
          </div>
          <Button variant="accent" onClick={analyze} disabled={busy === "analyze"}>
            {busy === "analyze" ? "Analyzing…" : "Analyze event"}
          </Button>
        </CardContent>
      </Card>

      {error && <p className="text-xs text-red-300 lg:col-span-2">{error}</p>}
    </div>
  );
}

const fileCls =
  "w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-bg-elevated file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-bg-elevated/80";
