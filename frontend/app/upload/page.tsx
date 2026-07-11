"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UploadZone, type UploadState } from "@/components/UploadZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  analyzeRace,
  createRace,
  importStravaActivity,
  pasteSplits,
  uploadFile,
  type StravaActivity,
} from "@/lib/api";
import { downscaleImage } from "@/lib/image";
import { TutorialButton } from "@/components/Tutorial";
import { StravaImport } from "@/components/StravaImport";
import type { UploadKind } from "@/lib/types";

interface Slot {
  kind: UploadKind;
  file: File | null;
  state: UploadState;
  error: string | null;
}

const steps = [
  { kind: "map" as const, n: 1, label: "Map", title: "Map photo (optional)", accept: "image/*,.heic,.heif", hint: "JPG, PNG or HEIC of your printed map — optional", required: false },
  { kind: "gps" as const, n: 2, label: "GPS", title: "GPS track", accept: ".gpx,.fit,.tcx,.kml,.kmz,.geojson,.json,.csv", hint: ".gpx, .fit, .tcx, .kml/.kmz, .geojson or .csv", required: true },
  { kind: "splits" as const, n: 3, label: "Splits", title: "Splits (optional)", accept: ".csv,.tsv,.txt,.xml,.spl,.json", hint: ".csv, .tsv, .xml (IOF), .spl or .json from your timing system", required: false },
];

export default function UploadPage() {
  const router = useRouter();
  const [raceName, setRaceName] = React.useState("");
  const [current, setCurrent] = React.useState(0);
  const [slots, setSlots] = React.useState<Record<UploadKind, Slot>>({
    map: { kind: "map", file: null, state: "idle", error: null },
    gps: { kind: "gps", file: null, state: "idle", error: null },
    splits: { kind: "splits", file: null, state: "idle", error: null },
  });
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);
  const [splitsPaste, setSplitsPaste] = React.useState("");
  const [stravaActivity, setStravaActivity] = React.useState<StravaActivity | null>(null);

  const setSlot = (kind: UploadKind, patch: Partial<Slot>) =>
    setSlots((s) => ({ ...s, [kind]: { ...s[kind], ...patch } }));

  const onFile = (kind: UploadKind, file: File | null) =>
    setSlot(kind, { file, state: file ? "ready" : "idle", error: null });

  // A GPS source is the only hard requirement (file upload OR a Strava
  // activity); map + splits are optional.
  const hasGpsSource = Boolean(slots.gps.file || stravaActivity);
  const canGenerate = hasGpsSource && !generating;

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      // Fall back to the Strava activity name so imported races are labelled.
      const race = await createRace(
        raceName || stravaActivity?.name || undefined
      );

      // GPS from Strava (when no file was uploaded).
      if (!slots.gps.file && stravaActivity) {
        setSlot("gps", { state: "uploading" });
        try {
          await importStravaActivity(race.id, stravaActivity.id);
          setSlot("gps", { state: "done" });
        } catch (e) {
          setSlot("gps", { state: "error", error: (e as Error).message });
          throw e;
        }
      }

      for (const kind of ["map", "gps", "splits"] as UploadKind[]) {
        const slot = slots[kind];
        if (!slot.file) continue;
        setSlot(kind, { state: "uploading" });
        try {
          // Shrink large map photos so the upload doesn't time out.
          const toSend =
            kind === "map" ? await downscaleImage(slot.file) : slot.file;
          await uploadFile(race.id, kind, toSend);
          setSlot(kind, { state: "done" });
        } catch (e) {
          setSlot(kind, { state: "error", error: (e as Error).message });
          if (kind !== "splits") throw e;
        }
      }

      // Pasted splits (e.g. from WinSplits) — used when no splits file was given.
      if (!slots.splits.file && splitsPaste.trim()) {
        try {
          await pasteSplits(race.id, splitsPaste);
        } catch {
          /* splits are optional — ignore and analyze without them */
        }
      }

      await analyzeRace(race.id);
      router.push(`/races/${race.id}`);
    } catch (e) {
      // Show a friendly message to users; keep the technical detail in the
      // console for whoever's debugging the deployment.
      const msg = (e as Error)?.message || "";
      if (msg) console.error("Analyze failed:", msg);
      setGenError(
        "We couldn't analyse your race just now — nothing was saved. Please " +
          "check your connection and try again in a moment. If it keeps " +
          "happening, let us know via the Contact page."
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">New analysis</span>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Analyze a race</h1>
            <p className="mt-2 text-muted">
              Upload your map and GPS track. Splits are optional but unlock
              leg-by-leg ranking.
            </p>
          </div>
          <TutorialButton
            label="❔ How it works"
            className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20"
          />
        </div>

        {/* Stepper */}
        <div className="mt-8 flex items-center">
          {[...steps, { n: 4, label: "Generate" }].map((s, i, arr) => {
            const done = i < current;
            const active = i === current;
            return (
              <React.Fragment key={s.label}>
                <button
                  onClick={() => i < steps.length && setCurrent(i)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full border text-sm font-bold transition",
                      active
                        ? "border-accent bg-accent text-bg"
                        : done
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                          : "border-border bg-bg-soft text-muted"
                    )}
                  >
                    {done ? "✓" : s.n}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      active ? "text-white" : "text-muted"
                    )}
                  >
                    {s.label}
                  </span>
                </button>
                {i < arr.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 flex-1 rounded",
                      i < current ? "bg-emerald-500/60" : "bg-border"
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <Card className="mt-8 p-6">
          {current < steps.length ? (
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
            >
              {current === 0 && (
                <div className="mb-5">
                  <label className="mb-1.5 block text-sm font-medium text-muted">
                    Race name (optional)
                  </label>
                  <input
                    value={raceName}
                    onChange={(e) => setRaceName(e.target.value)}
                    placeholder="e.g. Fløyen Forest Sprint"
                    className="w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
              )}
              <UploadZone
                label={steps[current].title}
                hint={steps[current].hint}
                accept={steps[current].accept}
                file={slots[steps[current].kind].file}
                state={slots[steps[current].kind].state}
                error={slots[steps[current].kind].error}
                onFile={(f) => onFile(steps[current].kind, f)}
              />
              {steps[current].kind === "gps" && (
                <StravaImport
                  selected={stravaActivity}
                  onSelect={setStravaActivity}
                />
              )}
              {steps[current].kind === "splits" && (
                <>
                  <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                    <span aria-hidden>🎯</span>
                    <span>
                      <strong>More accurate with splits.</strong> Adding your
                      split times pins each control to the exact moment you
                      punched it — so control placement, leg-by-leg timing and
                      mistake detection are far more precise. Optional, but worth
                      it if you have them.
                    </span>
                  </div>
                  {!slots.splits.file && (
                    <div className="mt-4">
                      <label className="mb-1.5 block text-sm font-medium text-muted">
                        …or paste from WinSplits
                      </label>
                      <textarea
                        value={splitsPaste}
                        onChange={(e) => setSplitsPaste(e.target.value)}
                        rows={3}
                        placeholder="On WinSplits Online, select your row (name + times), copy it, and paste here. We'll read your cumulative splits automatically."
                        className="w-full resize-none rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                      {splitsPaste.trim() && (
                        <p className="mt-1.5 text-xs text-accent">
                          ✓ Splits pasted — they&apos;ll be used when you generate.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
              <div className="mt-6 flex justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                  disabled={current === 0}
                >
                  Back
                </Button>
                <Button
                  variant="accent"
                  onClick={() => setCurrent((c) => c + 1)}
                  disabled={
                    steps[current].required &&
                    !slots[steps[current].kind].file &&
                    !(steps[current].kind === "gps" && stravaActivity)
                  }
                >
                  {steps[current].required ? "Continue" : "Skip / Continue"}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <h2 className="text-xl font-bold">Generate analysis</h2>
              <p className="mt-1 text-sm text-muted">
                Review your files, then run the AI pipeline.
              </p>
              <div className="mt-6 space-y-2 text-left">
                {steps.map((s) => {
                  const slot = slots[s.kind];
                  return (
                    <div
                      key={s.kind}
                      className="flex items-center justify-between rounded-lg border border-border bg-bg-soft/60 px-4 py-3 text-sm"
                    >
                      <span className="font-medium">{s.title}</span>
                      <span
                        className={cn(
                          "text-xs",
                          slot.file ? "text-accent" : "text-muted",
                          slot.state === "done" && "text-emerald-300",
                          slot.state === "error" && "text-red-300"
                        )}
                      >
                        {slot.state === "done"
                          ? "Uploaded ✓"
                          : slot.state === "uploading"
                            ? "Uploading…"
                            : slot.state === "error"
                              ? "Failed"
                              : slot.file
                                ? slot.file.name
                                : s.kind === "gps" && stravaActivity
                                  ? `Strava: ${stravaActivity.name || "activity"}`
                                  : s.kind === "splits" && splitsPaste.trim()
                                    ? "Pasted splits ✓"
                                    : "Not provided"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {genError && (
                <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-200">
                  {genError}
                </div>
              )}
              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setCurrent(steps.length - 1)}>
                  Back
                </Button>
                <Button
                  variant="accent"
                  size="lg"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                >
                  {generating ? "Generating…" : "Generate Analysis"}
                </Button>
              </div>
            </motion.div>
          )}
        </Card>
      </div>
    </div>
  );
}
