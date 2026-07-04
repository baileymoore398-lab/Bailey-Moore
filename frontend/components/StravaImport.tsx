"use client";

import * as React from "react";
import {
  disconnectStrava,
  getStravaConnectUrl,
  getStravaStatus,
  listStravaActivities,
  type StravaActivity,
  type StravaStatus,
} from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { cn, formatDistance, formatDuration } from "@/lib/utils";

/** The Strava chevron mark (official glyph geometry). */
function StravaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}

const SPORT_ICONS: Record<string, string> = {
  Run: "🏃",
  TrailRun: "🏃",
  Ride: "🚴",
  MountainBikeRide: "🚵",
  GravelRide: "🚴",
  Hike: "🥾",
  Walk: "🚶",
  NordicSki: "⛷️",
  BackcountrySki: "⛷️",
  Kayaking: "🛶",
  Swim: "🏊",
};

function sportIcon(sport: string | null): string {
  return (sport && SPORT_ICONS[sport]) || "📍";
}

function formatDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

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

    // Status works signed-out too (so we can prompt sign-in when configured).
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
    if (status?.connected && activities === null && !loading) void loadActivities();
  }, [status, activities, loading, loadActivities]);

  async function connect() {
    setError(null);
    try {
      const { url } = await getStravaConnectUrl();
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message || "Couldn't start Strava connect");
    }
  }

  async function disconnect() {
    try {
      await disconnectStrava();
      setStatus((s) => (s ? { ...s, connected: false, athlete_name: null } : s));
      setActivities(null);
      onSelect(null);
    } catch {
      /* non-fatal */
    }
  }

  // Hide only when the backend says Strava isn't configured (or is unreachable).
  if (status && !status.configured) return null;
  if (!status) {
    return justConnected ? (
      <p className="mt-4 text-xs text-muted">Checking Strava connection…</p>
    ) : null;
  }

  // Signed out: keep the panel visible and explain how to unlock it.
  if (!authed) {
    return (
      <div className="relative mt-5 overflow-hidden rounded-2xl border border-border bg-bg-soft/50">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(252,76,2,0.10),transparent)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FC4C02] text-white">
              <StravaMark className="h-[18px] w-[18px]" />
            </span>
            <div>
              <div className="text-sm font-bold text-white">Import from Strava</div>
              <div className="text-[11px] text-muted">
                Sign in to connect your Strava and skip the file export
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href="/login"
              className="rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-white transition hover:border-accent"
            >
              Sign in
            </a>
            <a
              href="/register"
              className="rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-bg transition hover:bg-accent/90"
            >
              Create account
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-5 overflow-hidden rounded-2xl border border-border bg-bg-soft/50">
      {/* Subtle Strava-orange glow along the top edge. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(252,76,2,0.10),transparent)]" />

      <div className="relative p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FC4C02] text-white">
              <StravaMark className="h-[18px] w-[18px]" />
            </span>
            <div>
              <div className="text-sm font-bold text-white">
                Import from Strava
              </div>
              <div className="text-[11px] text-muted">
                {status.connected
                  ? `Connected${status.athlete_name ? ` as ${status.athlete_name}` : ""}`
                  : "Skip the file export — pull activities straight in"}
              </div>
            </div>
          </div>
          {status.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Connected
            </span>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Powered by Strava
            </span>
          )}
        </div>

        {justConnected === "fail" && (
          <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            Strava connection failed — please try again.
          </p>
        )}

        {/* Disconnected → official-style connect button */}
        {!status.connected && (
          <div className="mt-4">
            <button
              type="button"
              onClick={connect}
              className="group inline-flex items-center gap-2.5 rounded-xl bg-[#FC4C02] px-5 py-3 text-sm font-bold text-white shadow-[0_0_24px_-8px_rgba(252,76,2,0.8)] transition hover:bg-[#e34402] hover:shadow-[0_0_28px_-6px_rgba(252,76,2,0.9)]"
            >
              <StravaMark className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
              Connect with Strava
            </button>
            <p className="mt-2.5 text-xs leading-relaxed text-muted">
              One-time, read-only connection. Nothing is ever posted to your
              Strava.
            </p>
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
          </div>
        )}

        {/* Connected → activity picker */}
        {status.connected && (
          <div className="mt-4">
            {loading && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-[62px] animate-pulse rounded-xl bg-bg-elevated/70"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            )}

            {error && !loading && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}{" "}
                <button
                  type="button"
                  onClick={() => void loadActivities()}
                  className="font-semibold underline"
                >
                  Retry
                </button>
              </div>
            )}

            {activities && activities.length === 0 && !loading && (
              <p className="rounded-lg border border-border bg-bg/40 px-3 py-4 text-center text-sm text-muted">
                No recent activities found — record one and refresh.
              </p>
            )}

            {activities && activities.length > 0 && !loading && (
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {activities.map((a) => {
                  const active = selected?.id === a.id;
                  const disabled = !a.has_gps;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelect(active ? null : a)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all",
                          active
                            ? "border-accent bg-accent/10 shadow-[0_0_20px_-8px_rgba(46,207,110,0.7)]"
                            : disabled
                              ? "cursor-not-allowed border-border/40 opacity-45"
                              : "border-border bg-bg/30 hover:border-accent/50 hover:bg-bg-elevated/40"
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg",
                            active ? "bg-accent/20" : "bg-bg-elevated/80"
                          )}
                        >
                          {sportIcon(a.sport_type)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">
                            {a.name || "Untitled activity"}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {formatDay(a.start_date)}
                            {a.distance_m
                              ? ` · ${formatDistance(a.distance_m)}`
                              : ""}
                            {a.moving_time_s
                              ? ` · ${formatDuration(a.moving_time_s)}`
                              : ""}
                            {disabled ? " · no GPS" : ""}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-black transition",
                            active
                              ? "border-accent bg-accent text-bg"
                              : "border-border text-transparent"
                          )}
                        >
                          ✓
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Footer actions */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
              <span className="font-semibold uppercase tracking-wider">
                Powered by Strava
              </span>
              <span className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void loadActivities()}
                  className="font-medium text-accent hover:underline"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  className="font-medium hover:text-white hover:underline"
                >
                  Disconnect
                </button>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
