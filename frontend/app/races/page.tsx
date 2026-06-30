"use client";

import * as React from "react";
import Link from "next/link";
import { listRaces } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/DemoNotice";
import { formatDate } from "@/lib/utils";
import type { Race } from "@/lib/types";

export default function RacesPage() {
  const [races, setRaces] = React.useState<Race[]>([]);
  const [demo, setDemo] = React.useState(false);
  const [demoReason, setDemoReason] = React.useState<
    "demo" | "auth" | "offline" | undefined
  >(undefined);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      // Fetched client-side so the auth token (stored in the browser) is sent —
      // a server component can't read it, and would always 401 → demo.
      const { data, demo, reason } = await listRaces();
      if (!active) return;
      setRaces(data);
      setDemo(demo);
      setDemoReason(reason);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="container-page py-12">
      {demo && <DemoNotice context="races" reason={demoReason} />}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Races</h1>
          <p className="mt-2 text-muted">
            {loading
              ? "Loading…"
              : `${races.length} race${races.length === 1 ? "" : "s"} analyzed.`}
          </p>
        </div>
        <Button variant="accent" asChild>
          <Link href="/upload">New analysis</Link>
        </Button>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-bg-elevated" />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {races.map((race) => {
            const isReady = race.status === "ready";
            const inner = (
              <Card className="h-full p-5 transition-colors hover:border-accent/40">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold leading-snug">
                    {race.name || "Untitled race"}
                  </h3>
                  <StatusBadge status={String(race.status)} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {formatDate(race.created_at)}
                </p>
                <div className="mt-4 flex h-24 items-center justify-center rounded-lg border border-border bg-bg-soft/60 text-3xl">
                  {isReady ? "🗺️" : race.status === "failed" ? "⚠️" : "⏳"}
                </div>
                <div className="mt-4 text-sm">
                  {isReady ? (
                    <span className="font-medium text-accent">
                      View analysis →
                    </span>
                  ) : (
                    <span className="text-muted capitalize">{race.status}…</span>
                  )}
                </div>
              </Card>
            );
            return isReady ? (
              <Link key={race.id} href={`/races/${race.id}`}>
                {inner}
              </Link>
            ) : (
              <div key={race.id} className="cursor-default opacity-90">
                {inner}
              </div>
            );
          })}
        </div>
      )}

      {!loading && races.length === 0 && (
        <Card className="mt-8 p-12 text-center">
          <p className="text-muted">No races yet.</p>
          <Button variant="accent" className="mt-4" asChild>
            <Link href="/upload">Analyze your first race</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
