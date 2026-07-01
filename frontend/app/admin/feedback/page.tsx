"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  getFeedbackSummary,
  getMe,
  listFeedback,
  type FeedbackRow,
  type FeedbackSummary,
} from "@/lib/api";

export default function AdminFeedbackPage() {
  const [state, setState] = React.useState<
    "loading" | "denied" | "ready" | "error"
  >("loading");
  const [summary, setSummary] = React.useState<FeedbackSummary | null>(null);
  const [rows, setRows] = React.useState<FeedbackRow[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        if (!me.is_superuser) {
          setState("denied");
          return;
        }
        const [s, r] = await Promise.all([getFeedbackSummary(), listFeedback()]);
        setSummary(s);
        setRows(r);
        setState("ready");
      } catch (err) {
        // 401/403 → not signed in or not admin.
        const msg = (err as Error)?.message || "";
        setState(msg.includes("401") || msg.includes("403") ? "denied" : "error");
      }
    })();
  }, []);

  if (state === "loading") {
    return (
      <div className="container-page py-12">
        <div className="h-8 w-56 animate-pulse rounded bg-bg-elevated" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-bg-elevated" />
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="container-page py-16 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 text-2xl font-black">Admins only</h1>
        <p className="mt-2 text-sm text-muted">
          This page is restricted to the RouteForge owner. Sign in with an admin
          account to view AI feedback.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm text-accent hover:underline">
          Sign in →
        </Link>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="container-page py-16 text-center text-muted">
        Couldn&apos;t load feedback — is the backend reachable?
      </div>
    );
  }

  const comments = rows.filter((r) => r.comment);

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-black tracking-tight">AI feedback</h1>
      <p className="mt-2 text-sm text-muted">
        How users rate the AI coach reports. Only you can see this.
      </p>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total ratings" value={summary?.total ?? 0} />
        <Stat label="👍 Helpful" value={summary?.up ?? 0} accent="text-emerald-400" />
        <Stat label="👎 Off" value={summary?.down ?? 0} accent="text-red-300" />
        <Stat
          label="Satisfaction"
          value={
            summary?.satisfaction_pct != null
              ? `${summary.satisfaction_pct}%`
              : "—"
          }
          accent="text-accent"
        />
      </div>

      {/* Comments */}
      <h2 className="mt-10 text-lg font-bold">Comments ({comments.length})</h2>
      <div className="mt-3 space-y-2">
        {comments.length === 0 && (
          <p className="text-sm text-muted">No written comments yet.</p>
        )}
        {comments.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm">{r.rating === "up" ? "👍" : "👎"}</span>
              <p className="flex-1 text-sm text-white/90">{r.comment}</p>
              <span className="shrink-0 text-xs text-muted">
                {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-muted">
              {r.coach_generated_by ? `by ${r.coach_generated_by}` : "coach"}
              {r.overall != null ? ` · overall ${r.overall}` : ""}
              {r.discipline ? ` · ${r.discipline}` : ""}
              {r.analysis_id ? (
                <>
                  {" · "}
                  <Link
                    href={`/races/${r.analysis_id}`}
                    className="text-accent hover:underline"
                  >
                    open race
                  </Link>
                </>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      {/* All ratings */}
      <h2 className="mt-10 text-lg font-bold">Recent ratings ({rows.length})</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-2 pr-3">Rating</th>
              <th className="py-2 pr-3">Source</th>
              <th className="py-2 pr-3">Overall</th>
              <th className="py-2 pr-3">Discipline</th>
              <th className="py-2 pr-3">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="py-2 pr-3">{r.rating === "up" ? "👍" : "👎"}</td>
                <td className="py-2 pr-3 text-muted">{r.coach_generated_by ?? "—"}</td>
                <td className="py-2 pr-3">{r.overall ?? "—"}</td>
                <td className="py-2 pr-3 text-muted">{r.discipline ?? "—"}</td>
                <td className="py-2 pr-3 text-muted">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <div className={`text-2xl font-black ${accent}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted">
        {label}
      </div>
    </Card>
  );
}
