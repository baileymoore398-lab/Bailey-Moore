"use client";

import type { LeaderboardRow } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (!rows.length) {
    return (
      <p className="rounded-lg border border-border bg-bg-soft/60 p-4 text-sm text-muted">
        No leaderboard data for this course yet.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-bg-soft text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Pos</th>
            <th className="px-4 py-2.5 text-left font-medium">Name</th>
            <th className="px-4 py-2.5 text-right font-medium">Time</th>
            <th className="px-4 py-2.5 text-right font-medium">+Behind</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr
              key={`${r.name}-${i}`}
              className={cn(
                "transition-colors hover:bg-bg-elevated/40",
                r.position === 1 && "bg-accent/5"
              )}
            >
              <td className="px-4 py-2.5 font-mono tabular-nums text-muted">
                {r.position ?? "—"}
              </td>
              <td className="px-4 py-2.5 font-medium text-white">{r.name}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                {r.total_time_s != null ? (
                  formatDuration(r.total_time_s)
                ) : (
                  <span className="uppercase text-muted">{r.status}</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-accent-hot">
                {r.behind_s ? `+${formatDuration(r.behind_s)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
