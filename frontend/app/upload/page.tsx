"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UploadZone, type UploadState } from "@/components/UploadZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { analyzeRace, createRace, uploadFile } from "@/lib/api";
import type { UploadKind } from "@/lib/types";

interface Slot {
  kind: UploadKind;
  file: File | null;
  state: UploadState;
  error: string | null;
}

const steps = [
  { kind: "map" as const, n: 1, label: "Map", title: "Map photo / image", accept: "image/*", hint: "PNG or JPG of your printed map", required: true },
  { kind: "gps" as const, n: 2, label: "GPS", title: "GPS track", accept: ".gpx,.fit,.tcx", hint: ".gpx, .fit or .tcx", required: true },
  { kind: "splits" as const, n: 3, label: "Splits", title: "Splits (optional)", accept: ".csv,.xml", hint: ".csv or .xml from your timing system", required: false },
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

  const setSlot = (kind: UploadKind, patch: Partial<Slot>) =>
    setSlots((s) => ({ ...s, [kind]: { ...s[kind], ...patch } }));

  const onFile = (kind: UploadKind, file: File | null) =>
    setSlot(kind, { file, state: file ? "ready" : "idle", error: null });

  const canGenerate = slots.map.file && slots.gps.file && !generating;

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const race = await createRace(raceName || undefined);

      for (const kind of ["map", "gps", "splits"] as UploadKind[]) {
        const slot = slots[kind];
        if (!slot.file) continue;
        setSlot(kind, { state: "uploading" });
        try {
          await uploadFile(race.id, kind, slot.file);
          setSlot(kind, { state: "done" });
        } catch (e) {
          setSlot(kind, { state: "error", error: (e as Error).message });
          if (kind !== "splits") throw e;
        }
      }

      await analyzeRace(race.id);
      router.push(`/races/${race.id}`);
    } catch (e) {
      // Backend offline: still let the user view the demo analysis.
      setGenError(
        "Could not reach the backend. Showing a demo analysis instead."
      );
      setTimeout(() => router.push(`/races/rc_demo_001`), 1200);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight">Analyze a race</h1>
        <p className="mt-2 text-muted">
          Upload your map and GPS track. Splits are optional but unlock
          leg-by-leg ranking.
        </p>

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
                  disabled={steps[current].required && !slots[steps[current].kind].file}
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
                                : "Not provided"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {genError && (
                <p className="mt-4 text-sm text-amber-300">{genError}</p>
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
