"use client";

import { Progress } from "@/components/ui/progress";

interface TrainingLoad {
  acute_load: number;
  chronic_load: number;
  acwr: number;
  zone: string;
}

/** ACWR / training-load indicator with zone-aware colouring. */
export function zoneColor(zone: string, acwr: number): {
  text: string;
  bar: string;
  label: string;
} {
  const z = zone?.toLowerCase();
  if (z === "optimal" || (acwr >= 0.8 && acwr <= 1.3)) {
    return { text: "text-emerald-300", bar: "bg-emerald-400", label: "Optimal" };
  }
  if (z === "detraining" || acwr < 0.8) {
    return { text: "text-blue-300", bar: "bg-blue-400", label: "Undertraining" };
  }
  return { text: "text-amber-300", bar: "bg-amber-400", label: "High risk" };
}

export function LoadIndicator({ load }: { load: TrainingLoad }) {
  const z = zoneColor(load.zone, load.acwr);
  // Map ACWR (typically 0-2) onto a 0-100 scale for the bar.
  const pct = Math.max(0, Math.min(100, (load.acwr / 2) * 100));

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={`text-3xl font-black tabular-nums ${z.text}`}>
          {load.acwr.toFixed(2)}
        </span>
        <span className={`text-xs font-semibold uppercase tracking-wider ${z.text}`}>
          {z.label}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">Acute : Chronic Workload Ratio</p>
      <div className="relative mt-3">
        <Progress value={pct} indicatorClassName={z.bar} />
        {/* optimal band markers 0.8-1.3 */}
        <div
          className="pointer-events-none absolute inset-y-0"
          style={{ left: "40%", width: "25%" }}
        >
          <div className="h-2 rounded-full border border-emerald-400/40 bg-emerald-400/10" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-bg-soft/60 p-3">
          <div className="stat-label">Acute (7d)</div>
          <div className="mt-1 font-bold tabular-nums">{Math.round(load.acute_load)}</div>
        </div>
        <div className="rounded-lg border border-border bg-bg-soft/60 p-3">
          <div className="stat-label">Chronic (28d)</div>
          <div className="mt-1 font-bold tabular-nums">{Math.round(load.chronic_load)}</div>
        </div>
      </div>
    </div>
  );
}
