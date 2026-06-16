"use client";

import * as React from "react";
import { addClubMember, getClubAnalytics } from "@/lib/api";
import type { ClubAnalytics } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/DemoBadge";

export default function ClubDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;
  const [club, setClub] = React.useState<ClubAnalytics | null>(null);
  const [demo, setDemo] = React.useState(false);
  const [handle, setHandle] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const { data, demo } = await getClubAnalytics(id);
    setClub(data);
    setDemo(demo);
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await addClubMember(id, handle.trim());
      setMsg(`Added @${handle.trim()}`);
      setHandle("");
      await load();
    } catch (err) {
      setError((err as Error).message || "Failed to add member");
    } finally {
      setBusy(false);
    }
  };

  const totals = club
    ? [
        { label: "Members", value: String(club.members) },
        { label: "Races", value: String(club.total_races) },
        { label: "Distance", value: `${club.total_distance_km.toFixed(1)} km` },
        { label: "Climb", value: `${Math.round(club.total_climb_m)} m` },
        { label: "Events", value: String(club.events_participated) },
      ]
    : [];

  return (
    <div className="container-page space-y-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {club?.name ?? "Club"}
        </h1>
        <DemoBadge show={demo} />
      </div>

      {club && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {totals.map((t) => (
            <Card key={t.label}>
              <CardContent className="py-4">
                <div className="stat-value">{t.value}</div>
                <div className="stat-label">{t.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="space-y-3 py-5">
            <h2 className="text-sm font-semibold text-white">Member rankings</h2>
            {club && club.rankings.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-bg-soft text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">#</th>
                      <th className="px-4 py-2.5 text-left font-medium">
                        Athlete
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Races
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Distance
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Avg overall
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {club.rankings.map((r) => (
                      <tr
                        key={r.athlete_id}
                        className="transition-colors hover:bg-bg-elevated/40"
                      >
                        <td className="px-4 py-2.5 font-mono tabular-nums text-muted">
                          {r.rank}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-white">
                          {r.display_name}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {r.races}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {r.distance_km.toFixed(1)} km
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-accent">
                          {r.avg_overall.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">No member rankings yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="space-y-3 py-5">
            <h2 className="text-sm font-semibold text-white">Add member</h2>
            <form onSubmit={addMember} className="space-y-2">
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@handle"
                className={inputCls}
              />
              <Button
                type="submit"
                variant="accent"
                className="w-full"
                size="sm"
                disabled={busy}
              >
                {busy ? "Adding…" : "Add member"}
              </Button>
            </form>
            {msg && <p className="text-xs text-emerald-300">{msg}</p>}
            {error && <p className="text-xs text-red-300">{error}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm text-white outline-none placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/30";
