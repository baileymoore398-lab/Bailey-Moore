"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Analysis } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScoresRadar } from "@/components/ScoresRadar";
import { ReplayControls } from "@/components/ReplayControls";
import { ShareStudio } from "@/components/ShareStudio";
import { DemoNotice } from "@/components/DemoNotice";
import { downloadReport, downloadReportPdf } from "@/lib/report";
import {
  cn,
  formatDistance,
  formatDuration,
  formatPace,
  formatTimeLoss,
} from "@/lib/utils";

const ReplayMap = dynamic(
  () => import("@/components/ReplayMap").then((m) => m.ReplayMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[380px] place-items-center rounded-xl border border-border bg-bg-soft/60 text-muted">
        Loading map…
      </div>
    ),
  }
);

const severityVariant = {
  high: "danger",
  medium: "warning",
  low: "muted",
} as const;

export function AnalysisDashboard({
  analysis,
  demo,
  sampleRace = false,
}: {
  analysis: Analysis;
  demo: boolean;
  sampleRace?: boolean;
}) {
  const [cursor, setCursor] = React.useState(0);
  const [highlightLeg, setHighlightLeg] = React.useState<number | null>(null);
  const [showAllMistakes, setShowAllMistakes] = React.useState(false);
  const [showCoachDetail, setShowCoachDetail] = React.useState(false);

  // Biggest time-loss first; collapse the list when there are many.
  const MISTAKE_PREVIEW = 3;
  const sortedMistakes = React.useMemo(
    () => [...analysis.mistakes].sort((a, b) => (b.lost_s ?? 0) - (a.lost_s ?? 0)),
    [analysis.mistakes]
  );
  const visibleMistakes = showAllMistakes
    ? sortedMistakes
    : sortedMistakes.slice(0, MISTAKE_PREVIEW);

  const m = analysis.metrics;
  const hasControls = analysis.controls.length > 0;
  const hasLegs = analysis.legs.length > 0;
  const hasSplits = analysis.legs.some((l) => l.rank != null);

  const stats = [
    { label: "Distance", value: formatDistance(m.distance_m) },
    { label: "Time", value: formatDuration(m.duration_s) },
    { label: "Avg pace", value: formatPace(m.avg_pace_min_km) },
    { label: "Climb", value: `${Math.round(m.total_climb_m)} m` },
    { label: "Controls", value: hasControls ? String(analysis.controls.length) : "–" },
    { label: "Mistakes", value: String(analysis.mistakes.length) },
  ];

  return (
    <div className="container-page py-10">
      {demo && <DemoNotice context="race analysis" sampleRace={sampleRace} />}
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/races" className="text-xs text-muted hover:text-white">
            ← All races
          </Link>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            Race analysis
          </h1>
          <p className="mt-1 text-sm text-muted">
            {new Date(analysis.created_at).toLocaleString()} · status{" "}
            <span className="text-white">{analysis.status}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {demo && <Badge variant="warning">Demo data</Badge>}
          <ShareStudio analysis={analysis} />
          <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-center">
            <div className="text-2xl font-black text-accent">
              {analysis.scores.overall}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-accent/80">
              Overall
            </div>
          </div>
        </div>
      </div>

      {/* Confidence banner */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {([
          ["Map", analysis.confidence.map],
          ["OCR", analysis.confidence.ocr],
          ["GPS align", analysis.confidence.gps_alignment],
        ] as const).map(([label, v]) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-soft px-2.5 py-1 text-muted"
          >
            {label} confidence
            <b className={cn(v >= 0.85 ? "text-emerald-300" : v >= 0.7 ? "text-amber-300" : "text-red-300")}>
              {Math.round(v * 100)}%
            </b>
          </span>
        ))}
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className="p-4">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label mt-1">{s.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Map + replay */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Replay</CardTitle>
              <span className="text-xs text-muted">
                Speed-coloured track · {analysis.track.length} points
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-[420px] w-full">
                <ReplayMap
                  track={analysis.track}
                  controls={analysis.controls}
                  cursor={cursor}
                  highlightLeg={highlightLeg}
                  legs={analysis.legs}
                />
              </div>
              {analysis.track.length > 1 && (
                <ReplayControls
                  track={analysis.track}
                  cursor={cursor}
                  setCursor={setCursor}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Scores */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance scores</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoresRadar scores={analysis.scores} />
              <div className="mt-3 space-y-2.5">
                {(
                  [
                    ["Navigation", analysis.scores.navigation],
                    ["Fitness", analysis.scores.fitness],
                    ["Execution", analysis.scores.execution],
                    ["Route choice", analysis.scores.route_choice],
                  ] as const
                ).map(([label, val]) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted">{label}</span>
                      <span className="font-semibold tabular-nums">{val}</span>
                    </div>
                    <Progress
                      value={val}
                      indicatorClassName={
                        val >= 80
                          ? "bg-accent-lime"
                          : val >= 65
                            ? "bg-accent"
                            : "bg-accent-hot"
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Legs + mistakes */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Legs</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {!hasSplits && (
                <div className="mx-5 mb-4 flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
                  <span aria-hidden>🎯</span>
                  <span>
                    <strong>This analysis is more accurate with splits.</strong>{" "}
                    Upload your split times when you analyze a race and RouteForge
                    pins each control to the exact punch time — unlocking leg
                    rankings, % behind, and sharper mistake detection.
                  </span>
                </div>
              )}
              {hasLegs ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                        <th className="px-5 py-2 font-medium">Leg</th>
                        <th className="px-2 py-2 font-medium">Dist</th>
                        <th className="px-2 py-2 font-medium">Time</th>
                        <th className="px-2 py-2 font-medium">Loss</th>
                        {hasSplits && <th className="px-2 py-2 font-medium">Rank</th>}
                        {hasSplits && <th className="px-2 py-2 font-medium">% behind</th>}
                        <th className="px-5 py-2 font-medium">!</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.legs.map((leg) => {
                        const active = highlightLeg === leg.number;
                        return (
                          <tr
                            key={leg.number}
                            onMouseEnter={() => setHighlightLeg(leg.number)}
                            onMouseLeave={() => setHighlightLeg(null)}
                            onClick={() =>
                              setHighlightLeg((h) =>
                                h === leg.number ? null : leg.number
                              )
                            }
                            className={cn(
                              "cursor-pointer border-b border-border/50 transition-colors",
                              active ? "bg-accent/10" : "hover:bg-bg-elevated/60"
                            )}
                          >
                            <td className="px-5 py-2.5 font-mono">
                              {leg.from_control}→{leg.to_control}
                            </td>
                            <td className="px-2 py-2.5 tabular-nums text-muted">
                              {Math.round(leg.distance_m)}m
                            </td>
                            <td className="px-2 py-2.5 font-mono tabular-nums">
                              {formatDuration(leg.time_s)}
                            </td>
                            <td
                              className={cn(
                                "px-2 py-2.5 font-mono tabular-nums",
                                leg.time_loss_s > 20
                                  ? "text-red-300"
                                  : leg.time_loss_s > 5
                                    ? "text-amber-300"
                                    : "text-emerald-300"
                              )}
                            >
                              {formatTimeLoss(leg.time_loss_s)}
                            </td>
                            {hasSplits && (
                              <td className="px-2 py-2.5 tabular-nums">
                                {leg.rank ?? "–"}
                              </td>
                            )}
                            {hasSplits && (
                              <td className="px-2 py-2.5 tabular-nums text-muted">
                                {leg.pct_behind != null
                                  ? `${leg.pct_behind.toFixed(1)}%`
                                  : "–"}
                              </td>
                            )}
                            <td className="px-5 py-2.5">
                              {leg.mistakes.length > 0 && (
                                <span title={leg.mistakes[0].description}>⚠️</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 text-sm text-muted">
                  No leg data — upload splits to unlock leg-by-leg analysis.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Key mistakes */}
        <Card>
          <CardHeader>
            <CardTitle>
              Key mistakes
              {analysis.mistakes.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted">
                  ({analysis.mistakes.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.mistakes.length === 0 ? (
              <p className="text-sm text-muted">
                No significant mistakes detected — clean run!
              </p>
            ) : (
              <>
                {visibleMistakes.map((mk, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-bg-soft/60 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold capitalize">
                        {mk.type.replace(/_/g, " ")}
                      </span>
                      <Badge variant={severityVariant[mk.severity]}>
                        −{mk.lost_s}s
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {mk.leg != null && (
                        <span className="text-accent">Leg {mk.leg}: </span>
                      )}
                      {mk.description}
                    </p>
                  </div>
                ))}
                {analysis.mistakes.length > MISTAKE_PREVIEW && (
                  <button
                    onClick={() => setShowAllMistakes((v) => !v)}
                    className="w-full rounded-lg border border-border bg-bg-soft/40 py-2 text-xs font-semibold text-accent transition hover:bg-bg-soft"
                  >
                    {showAllMistakes
                      ? "Show fewer"
                      : `Show all ${analysis.mistakes.length} mistakes ▾`}
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Coach */}
      <Card className="mt-6 border-accent/25">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">🧠 AI Coach report</CardTitle>
            <p className="mt-1 text-xs text-muted">
              {analysis.coach.generated_by
                ? `Generated by ${
                    analysis.coach.generated_by === "rule_based"
                      ? "the RouteForge coaching engine"
                      : analysis.coach.generated_by
                  }`
                : "Personalised analysis of your race"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => {
                void downloadReportPdf(analysis, "Race analysis").catch(() => {});
              }}
              className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20"
            >
              ⬇ Download PDF
            </button>
            <button
              onClick={() => downloadReport(analysis, "Race analysis")}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted transition hover:text-white"
              title="Download as Markdown"
            >
              .md
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-base leading-relaxed text-white/90">
            {analysis.coach.overview || analysis.coach.summary}
          </p>

          {analysis.coach.focus_areas && analysis.coach.focus_areas.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted">
                Priorities
              </span>
              {analysis.coach.focus_areas.map((f) => (
                <Badge key={f} variant="warning">
                  {f}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <CoachList
              title="Strengths"
              items={analysis.coach.strengths}
              accent="text-emerald-300"
              bullet="✓"
            />
            <CoachList
              title="Weaknesses"
              items={analysis.coach.weaknesses}
              accent="text-amber-300"
              bullet="•"
            />
            <CoachList
              title="Mistakes"
              items={analysis.coach.mistakes}
              accent="text-red-300"
              bullet="⚠"
            />
            <CoachList
              title="Advice"
              items={analysis.coach.advice}
              accent="text-accent"
              bullet="→"
            />
          </div>

          {analysis.coach.training && analysis.coach.training.length > 0 && (
            <>
              <button
                onClick={() => setShowCoachDetail((v) => !v)}
                className="mt-6 w-full rounded-lg border border-border bg-bg-soft/40 py-2.5 text-sm font-semibold text-accent transition hover:bg-bg-soft"
              >
                {showCoachDetail
                  ? "Hide training plan ▴"
                  : "📋 Training plan & detailed breakdown ▾"}
              </button>
              {showCoachDetail && (
                <div className="mt-4 space-y-5 rounded-xl border border-border bg-bg-soft/40 p-5">
                  <CoachList
                    title="Recommended training"
                    items={analysis.coach.training}
                    accent="text-accent"
                    bullet="🏃"
                  />
                  {analysis.coach.summary &&
                    analysis.coach.overview &&
                    analysis.coach.summary !== analysis.coach.overview && (
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                          Summary
                        </h4>
                        <p className="text-sm leading-relaxed text-white/80">
                          {analysis.coach.summary}
                        </p>
                      </div>
                    )}
                  <p className="text-xs text-muted">
                    Want the full report? Use{" "}
                    <span className="text-accent">Download report</span> above to
                    save it (Markdown) with your stats, scores and leg breakdown.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CoachList({
  title,
  items,
  accent,
  bullet,
}: {
  title: string;
  items: string[];
  accent: string;
  bullet: string;
}) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className={cn("text-xs font-semibold uppercase tracking-wider", accent)}>
        {title}
      </h4>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-white/85">
            <span className={accent}>{bullet}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
