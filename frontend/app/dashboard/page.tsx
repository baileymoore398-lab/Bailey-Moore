"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { ReadinessGauge } from "@/components/ReadinessGauge";
import { LoadIndicator } from "@/components/LoadIndicator";
import { DemoNotice } from "@/components/DemoNotice";
import {
  getAthlete,
  getMe,
  getTrainingAnalytics,
  listRaces,
} from "@/lib/api";
import { getSessionUser, isAuthenticated } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import type {
  AthleteProfile,
  MeResponse,
  Race,
  TrainingAnalytics,
} from "@/lib/types";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.05 },
  }),
};

export default function DashboardPage() {
  const [athlete, setAthlete] = React.useState<AthleteProfile | null>(null);
  const [training, setTraining] = React.useState<TrainingAnalytics | null>(null);
  const [races, setRaces] = React.useState<Race[]>([]);
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [demo, setDemo] = React.useState(false);
  const [demoReason, setDemoReason] = React.useState<
    "demo" | "auth" | "offline" | undefined
  >(undefined);
  const [authed, setAuthed] = React.useState(true);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    setAuthed(isAuthenticated());
    (async () => {
      const [a, t, r] = await Promise.all([
        getAthlete(),
        getTrainingAnalytics(),
        listRaces(),
      ]);
      if (isAuthenticated()) {
        try {
          const m = await getMe();
          if (active) setMe(m);
        } catch {
          /* ignore — fall back to session */
        }
      }
      if (!active) return;
      setAthlete(a.data);
      setTraining(t.data);
      setRaces(r.data);
      setDemo(a.demo || t.demo || r.demo);
      const reasons = [a.reason, t.reason, r.reason];
      setDemoReason(
        reasons.includes("auth")
          ? "auth"
          : reasons.includes("offline")
            ? "offline"
            : reasons.includes("demo")
              ? "demo"
              : undefined
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const greetingName =
    me?.full_name ||
    athlete?.name ||
    getSessionUser()?.email?.split("@")[0] ||
    "athlete";

  if (loading || !athlete || !training) {
    return (
      <div className="container-page py-12">
        <div className="h-8 w-48 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-bg-elevated" />
          ))}
        </div>
      </div>
    );
  }

  const s = athlete.stats;
  const stats = [
    { label: "Races", value: s.races, suffix: "" },
    { label: "Total distance", value: s.total_distance_km, suffix: " km" },
    { label: "Avg score", value: s.avg_overall_score, suffix: "" },
    { label: "Best score", value: s.best_score, suffix: "" },
  ];

  const readiness = training.race_readiness?.readiness ?? 0;

  return (
    <div className="container-page py-10">
      {demo && <DemoNotice context="dashboard" reason={demoReason} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Hi{" "}
            <span className="bg-gradient-to-r from-accent to-accent-lime bg-clip-text text-transparent">
              {greetingName}
            </span>{" "}
            👋
          </h1>
          <p className="mt-1 text-muted">Here&apos;s your performance snapshot.</p>
        </div>
        <div className="flex items-center gap-2">
          {demo && <Badge variant="warning">Demo data</Badge>}
          {!authed && (
            <Link href="/login">
              <Badge variant="accent" className="cursor-pointer">
                Sign in to sync →
              </Badge>
            </Link>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="accent" asChild>
          <Link href="/upload">New analysis</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/training">Upload training</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/events">View events</Link>
        </Button>
        {me?.is_superuser && (
          <Button variant="ghost" asChild>
            <Link href="/admin/feedback">🔒 AI feedback</Link>
          </Button>
        )}
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((st, i) => (
          <motion.div
            key={st.label}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            <Card className="p-4">
              <div className="stat-value">
                <CountUp value={st.value} suffix={st.suffix} />
              </div>
              <div className="stat-label mt-1">{st.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Readiness + load */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Race readiness</CardTitle>
          </CardHeader>
          <CardContent className="grid place-items-center">
            <ReadinessGauge value={readiness} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Training load (ACWR)</CardTitle>
          </CardHeader>
          <CardContent>
            <LoadIndicator load={training.training_load} />
          </CardContent>
        </Card>
      </div>

      {/* Recent races */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent races</CardTitle>
          <Link href="/races" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="px-0">
          {races.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No races yet.</p>
          ) : (
            <ul>
              {races.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/races/${r.id}`}
                    className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-3 transition-colors hover:bg-bg-elevated/40"
                  >
                    <div>
                      <div className="font-medium">{r.name}</div>
                      {r.created_at && (
                        <div className="text-xs text-muted">
                          {formatDate(r.created_at)}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={String(r.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
