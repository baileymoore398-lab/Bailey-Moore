"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoNotice } from "@/components/DemoNotice";
import { UploadZone, type UploadState } from "@/components/UploadZone";
import { VolumeBars, SpeedHrChart } from "@/components/VolumeCharts";
import { LoadIndicator } from "@/components/LoadIndicator";
import { GoalsPanel } from "@/components/GoalsPanel";
import {
  getTrainingAnalytics,
  listGoals,
  uploadTrainingSession,
} from "@/lib/api";
import type { TrainingAnalytics } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const pbLabels: Record<string, string> = {
  longest_run: "Longest run",
  fastest_avg_speed: "Fastest avg speed",
  biggest_climb: "Biggest climb",
};

export default function TrainingPage() {
  const [analytics, setAnalytics] = React.useState<TrainingAnalytics | null>(
    null
  );
  const [goals, setGoals] = React.useState<Record<string, unknown>[]>([]);
  const [demo, setDemo] = React.useState(false);
  const [demoReason, setDemoReason] = React.useState<
    "demo" | "auth" | "offline" | undefined
  >(undefined);
  const [loading, setLoading] = React.useState(true);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploadState, setUploadState] = React.useState<UploadState>("idle");
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const [a, g] = await Promise.all([getTrainingAnalytics(), listGoals()]);
    setAnalytics(a.data);
    setGoals(g.data as Record<string, unknown>[]);
    setDemo(a.demo);
    setDemoReason(a.reason);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleFile(f: File | null) {
    setFile(f);
    if (!f) {
      setUploadState("idle");
      return;
    }
    setUploadState("uploading");
    setUploadError(null);
    try {
      await uploadTrainingSession(f);
      setUploadState("done");
      await load();
    } catch (err) {
      setUploadState("error");
      setUploadError((err as Error).message || "Upload failed");
    }
  }

  if (loading || !analytics) {
    return (
      <div className="container-page py-12">
        <div className="h-8 w-48 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-bg-elevated" />
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      {demo && <DemoNotice context="training data" reason={demoReason} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Training</span>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Training Centre</h1>
          <p className="mt-1 text-muted">
            {analytics.session_count} sessions logged
          </p>
        </div>
      </div>

      {/* Upload */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Upload a training session</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadZone
            label="Drop a GPX / FIT / TCX file"
            hint=".gpx, .fit or .tcx from your watch"
            accept=".gpx,.fit,.tcx"
            file={file}
            state={uploadState}
            error={uploadError}
            onFile={handleFile}
          />
        </CardContent>
      </Card>

      {/* Volume charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly volume</CardTitle>
          </CardHeader>
          <CardContent>
            <VolumeBars data={analytics.weekly_volume} bucketKey="week" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly volume</CardTitle>
          </CardHeader>
          <CardContent>
            <VolumeBars data={analytics.monthly_volume} bucketKey="month" />
          </CardContent>
        </Card>
      </div>

      {/* Speed/HR + load */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Speed & heart rate trends</CardTitle>
          </CardHeader>
          <CardContent>
            <SpeedHrChart data={analytics.speed_hr_trends} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Training load</CardTitle>
          </CardHeader>
          <CardContent>
            <LoadIndicator load={analytics.training_load} />
          </CardContent>
        </Card>
      </div>

      {/* Personal bests */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Personal bests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {analytics.personal_bests.map((pb) => (
              <div
                key={pb.category}
                className="card-lift rounded-xl border border-border bg-bg-soft/50 p-4"
              >
                <div className="stat-label">
                  {pbLabels[pb.category] || pb.category.replace(/_/g, " ")}
                </div>
                <div className="mt-1 stat-value">
                  {pb.value} <span className="text-base text-muted">{pb.unit}</span>
                </div>
                {pb.date && (
                  <div className="mt-1 text-xs text-muted">
                    {formatDate(pb.date)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <GoalsPanel initialGoals={goals} />
        </CardContent>
      </Card>
    </div>
  );
}
