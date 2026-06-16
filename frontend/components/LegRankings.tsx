"use client";

import type { LegRanking } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

export function LegRankings({ legs }: { legs: LegRanking[] }) {
  if (!legs.length) {
    return (
      <p className="rounded-lg border border-border bg-bg-soft/60 p-4 text-sm text-muted">
        No leg rankings for this course yet.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {legs.map((leg) => (
        <div
          key={leg.leg}
          className="overflow-hidden rounded-xl border border-border bg-bg-card/60"
        >
          <div className="flex items-center justify-between border-b border-border bg-bg-soft px-4 py-2.5">
            <span className="text-sm font-semibold text-white">
              Leg {leg.leg}
              <span className="ml-2 font-normal text-muted">
                {leg.from_control} → {leg.to_control}
              </span>
            </span>
            <span className="font-mono text-xs tabular-nums text-accent">
              best {leg.best_s != null ? formatDuration(leg.best_s) : "—"}
            </span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {leg.rankings.map((r) => (
                <tr key={`${leg.leg}-${r.rank}-${r.name}`}>
                  <td className="w-10 px-4 py-2 font-mono tabular-nums text-muted">
                    {r.rank}
                  </td>
                  <td className="px-4 py-2 font-medium text-white">{r.name}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">
                    {formatDuration(r.time_s)}
                  </td>
                  <td className="w-24 px-4 py-2 text-right font-mono tabular-nums text-accent-hot">
                    {r.behind_s ? `+${formatDuration(r.behind_s)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
