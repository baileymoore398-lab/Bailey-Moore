"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createGoal, listGoals } from "@/lib/api";

type Goal = Record<string, unknown>;

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function progressFor(g: Goal): number {
  const explicit = num(g.progress_pct, NaN);
  if (isFinite(explicit)) return Math.max(0, Math.min(100, explicit));
  const target = num(g.target_value);
  const current = num(g.current_value);
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

export function GoalsPanel({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = React.useState<Goal[]>(initialGoals);
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [metric, setMetric] = React.useState("distance_km");
  const [target, setTarget] = React.useState("");
  const [period, setPeriod] = React.useState("month");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    const res = await listGoals();
    setGoals(res.data as Goal[]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createGoal({
        title,
        metric,
        target_value: Number(target),
        period,
      });
      setTitle("");
      setTarget("");
      setOpen(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message || "Could not create goal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Track your training targets.</p>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "New goal"}
        </Button>
      </div>

      {open && (
        <form
          onSubmit={handleCreate}
          className="mb-5 grid gap-3 rounded-xl border border-border bg-bg-soft/60 p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 200 km this month"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Metric</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="distance_km">Distance (km)</option>
              <option value="duration_h">Duration (h)</option>
              <option value="climb_m">Climb (m)</option>
              <option value="sessions">Sessions</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Target</label>
            <input
              required
              type="number"
              min="0"
              step="any"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="200"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="season">Season</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="accent" disabled={saving} className="w-full">
              {saving ? "Saving…" : "Create goal"}
            </Button>
          </div>
          {error && (
            <p className="sm:col-span-2 text-xs text-red-300">{error}</p>
          )}
        </form>
      )}

      {goals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-bg-soft/40 px-4 py-8 text-center text-sm text-muted">
          No goals yet. Create one to start tracking.
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g, i) => {
            const pct = progressFor(g);
            const status = str(g.status, "active");
            return (
              <li
                key={str(g.id, String(i))}
                className="rounded-xl border border-border bg-bg-soft/50 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{str(g.title, "Goal")}</span>
                  <Badge variant={status === "completed" ? "success" : "accent"}>
                    {status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>
                    {num(g.current_value).toFixed(1)} / {num(g.target_value).toFixed(1)}{" "}
                    {str(g.metric).replace("_", " ")}
                  </span>
                  <span className="font-semibold text-accent tabular-nums">
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <Progress className="mt-2" value={pct} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
