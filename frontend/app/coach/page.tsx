"use client";

import * as React from "react";
import {
  addCoachNote,
  getAthleteTrends,
  linkAthlete,
  listCoachAthletes,
  listCoachNotes,
} from "@/lib/api";
import type { CoachAthlete, CoachTrends } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/DemoNotice";
import { CoachTrendCharts } from "@/components/CoachTrendCharts";
import { cn } from "@/lib/utils";

interface CoachNote {
  id?: string;
  body?: string;
  created_at?: string | null;
}

function asNotes(res: unknown): CoachNote[] {
  if (Array.isArray(res)) return res as CoachNote[];
  const obj = res as { notes?: CoachNote[] } | null;
  return obj?.notes ?? [];
}

export default function CoachPage() {
  const [athletes, setAthletes] = React.useState<CoachAthlete[]>([]);
  const [demo, setDemo] = React.useState(false);
  const [demoReason, setDemoReason] = React.useState<
    "demo" | "auth" | "offline" | undefined
  >(undefined);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [trends, setTrends] = React.useState<CoachTrends | null>(null);
  const [notes, setNotes] = React.useState<CoachNote[]>([]);
  const [handle, setHandle] = React.useState("");
  const [noteBody, setNoteBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const loadAthletes = React.useCallback(async () => {
    const { data, demo, reason } = await listCoachAthletes();
    setAthletes(data);
    setDemo(demo);
    setDemoReason(reason);
    setSelected((s) => s ?? data[0]?.athlete_id ?? null);
  }, []);

  React.useEffect(() => {
    void loadAthletes();
  }, [loadAthletes]);

  React.useEffect(() => {
    if (!selected) return;
    let active = true;
    void getAthleteTrends(selected).then(({ data }) => {
      if (active) setTrends(data);
    });
    void listCoachNotes(selected).then((res) => {
      if (active) setNotes(asNotes(res));
    });
    return () => {
      active = false;
    };
  }, [selected]);

  const link = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await linkAthlete(handle.trim());
      setHandle("");
      await loadAthletes();
    } catch (err) {
      setError((err as Error).message || "Failed to link athlete");
    } finally {
      setBusy(false);
    }
  };

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !noteBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addCoachNote(selected, noteBody.trim());
      setNoteBody("");
      const res = await listCoachNotes(selected);
      setNotes(asNotes(res));
    } catch (err) {
      setError((err as Error).message || "Failed to add note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page space-y-6 py-8">
      {demo && <DemoNotice context="coach data" reason={demoReason} />}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Coach dashboard
          </h1>
          <p className="text-sm text-muted">
            Track athlete progress and leave coaching notes.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Athlete list + link form */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2 py-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Athletes
              </h2>
              {athletes.length === 0 ? (
                <p className="text-sm text-muted">No linked athletes yet.</p>
              ) : (
                <ul className="space-y-1">
                  {athletes.map((a) => (
                    <li key={a.athlete_id}>
                      <button
                        onClick={() => setSelected(a.athlete_id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                          selected === a.athlete_id
                            ? "bg-bg-elevated text-white"
                            : "text-muted hover:bg-bg-elevated/50 hover:text-white"
                        )}
                      >
                        <span className="min-w-0 truncate">
                          {a.display_name}
                          {a.handle ? (
                            <span className="ml-1 text-xs text-muted">
                              @{a.handle}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-accent">
                          {a.avg_overall.toFixed(0)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 py-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Link athlete
              </h2>
              <form onSubmit={link} className="flex gap-2">
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@handle"
                  className={inputCls}
                />
                <Button type="submit" variant="accent" size="sm" disabled={busy}>
                  Link
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Trends + recommendations + notes */}
        <div className="space-y-6">
          {trends ? (
            <>
              <CoachTrendCharts series={trends.series} />

              <div className="grid gap-5 md:grid-cols-2">
                <Card>
                  <CardContent className="space-y-3 py-5">
                    <h3 className="text-sm font-semibold text-white">
                      Recommendations
                    </h3>
                    {trends.recommendations.length ? (
                      <ul className="space-y-2 text-sm text-muted">
                        {trends.recommendations.map((r, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-accent">›</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">No recommendations.</p>
                    )}
                    {trends.focus_areas.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {trends.focus_areas.map((f) => (
                          <Badge key={f} variant="warning">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-3 py-5">
                    <h3 className="text-sm font-semibold text-white">Notes</h3>
                    <form onSubmit={submitNote} className="space-y-2">
                      <textarea
                        value={noteBody}
                        onChange={(e) => setNoteBody(e.target.value)}
                        placeholder="Add a coaching note…"
                        rows={2}
                        className={cn(inputCls, "resize-none")}
                      />
                      <Button
                        type="submit"
                        variant="accent"
                        size="sm"
                        disabled={busy || !noteBody.trim()}
                      >
                        Add note
                      </Button>
                    </form>
                    <ul className="space-y-2">
                      {notes.length === 0 ? (
                        <li className="text-sm text-muted">No notes yet.</li>
                      ) : (
                        notes.map((n, i) => (
                          <li
                            key={n.id ?? i}
                            className="rounded-lg border border-border bg-bg-soft/60 px-3 py-2 text-sm text-white"
                          >
                            {n.body}
                          </li>
                        ))
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted">
                Select an athlete to view trends.
              </CardContent>
            </Card>
          )}
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm text-white outline-none placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/30";
