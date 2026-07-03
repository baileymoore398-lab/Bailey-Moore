"use client";

import * as React from "react";
import {
  getStravaConnectUrl,
  getStravaStatus,
  listStravaActivities,
  type StravaActivity,
  type StravaStatus,
} from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { formatDistance, formatDuration } from "@/lib/utils";

/**
 * "Import from Strava" panel for the GPS step: connect once, then pick a
 * recent activity instead of exporting/uploading a file.
 */
export function StravaImport({
  selected,
  onSelect,
}: {
  selected: StravaActivity | null;
  onSelect: (a: StravaActivity | null) => void;
}) {
  const [status, setStatus] = React.useState<StravaStatus | null>(null);
  const [authed, setAuthed] = React.useState(false);
  const [activities, setActivities] = React.useState<StravaActivity[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [justConnected, setJustConnected] = React.useState<null | "ok" | "fail">(null);

  React.useEffect(() => {
    setAuthed(isAuthenticated());
    // Returning from the OAuth round-trip?
    const q = new URLSearchParams(window.location.search).get("strava");
    if (q === "connected") setJustConnected("ok");
    if (q === "error") setJustConnected("fail");

    if (!isAuthenticated()) return;
    getStravaStatus()
      .then(setStatus)
      .catch(() => setStatus(null)); // backend unreachable → hide panel
  }, []);

  const loadActivities = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { activities } = await listStravaActivities();
      setActivities(activities);
    } catch (e) {
      setError((e as Error).message || "Couldn't load activities");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (status?.connected && activities === null) void loadActivities();
  }, [status, activities, loadActivities]);

  async function connect() {
    setError(null);
    try {
      const { url } = await getStravaConnectUrl();
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message || "Couldn't start Strava connect");
    }
  }

  // Nothing to offer: signed out, or Strava keys not configured on the backend.
  if (!authed || (status && !status.configured)) return null;
  if (!status) {
    return justConnected ? (
      <p className="mt-4 text-xs text-muted">Checking Strava connection…</p>
    ) : null;
  }

  return (
    <div className="mt-5 rounded-xl border border-border bg-bg-soft/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white">
          …or import from Strava
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Powered by Strava
        </span>
      </div>

      {justConnected === "fail" && (
        <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Strava connection failed — please try again.
        </p>
      )}

      {!status.connected ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={connect}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FC4C02] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#e34402]"
          >
            Connect with Strava
          </button>
          <p className="mt-2 text-xs text-muted">
            One-time connection — then pick any activity to analyze, no file
            exporting.
          </p>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span>
              Connected{status.athlete_name ? ` as ${status.athlete_name}` : ""}
              {justConnected === "ok" ? " ✓" : ""}
            </span>
            <button
              type="button"
              onClick={() => void loadActivities()}
              className="font-medium text-accent hover:underline"
            >
              Refresh
            </button>
          </div>

          {loading && <p className="mt-3 text-sm text-muted">Loading activities…</p>}
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

          {activities && activities.length === 0 && (
            <p className="mt-3 text-sm text-muted">No recent activities found.</p>
          )}

          {activities && activities.length > 0 && (
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {activities.map((a) => {
                const active = selected?.id === a.id;
                const disabled = !a.has_gps;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onSelect(active ? null : a)}
                      className={
                        "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition " +
                        (active
                          ? "border-accent bg-accent/10"
                          : disabled
                            ? "cursor-not-allowed border-border/50 opacity-50"
                            : "border-border hover:border-accent/50")
                      }
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-white">
                          {active ? "✓ " : ""}
                          {a.name || "Untitled activity"}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {a.sport_type ?? ""}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {a.start_date
                          ? new Date(a.start_date).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : ""}
                        {a.distance_m ? ` · ${formatDistance(a.distance_m)}` : ""}
                        {a.moving_time_s ? ` · ${formatDuration(a.moving_time_s)}` : ""}
                        {!a.has_gps ? " · no GPS" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
