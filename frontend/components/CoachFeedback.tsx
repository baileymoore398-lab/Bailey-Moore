"use client";

import * as React from "react";
import { submitFeedback } from "@/lib/api";

/**
 * "How did the AI do?" prompt shown under the analysis. Thumbs up/down with an
 * optional comment. A thumbs-down opens the comment box so we learn what missed.
 */
export function CoachFeedback({ analysisId }: { analysisId: string | null }) {
  const [rating, setRating] = React.useState<"up" | "down" | null>(null);
  const [comment, setComment] = React.useState("");
  const [showComment, setShowComment] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function send(r: "up" | "down", withComment = false) {
    setBusy(true);
    try {
      await submitFeedback(analysisId, r, withComment ? comment : undefined);
      setSent(true);
    } catch {
      // Never block the user on a feedback failure; just close quietly.
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  function pick(r: "up" | "down") {
    setRating(r);
    if (r === "down") {
      // Ask why — that comment is the most useful learning signal.
      setShowComment(true);
    } else {
      setShowComment(true);
    }
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-center text-sm text-accent">
        🙏 Thanks for the feedback — it helps the AI coach get better.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-bg-soft/50 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-white">
          How did the AI coach do?
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => pick("up")}
            aria-pressed={rating === "up"}
            className={
              "rounded-lg border px-3 py-1.5 text-sm font-semibold transition " +
              (rating === "up"
                ? "border-accent bg-accent/20 text-accent"
                : "border-border text-muted hover:text-white")
            }
          >
            👍 Helpful
          </button>
          <button
            onClick={() => pick("down")}
            aria-pressed={rating === "down"}
            className={
              "rounded-lg border px-3 py-1.5 text-sm font-semibold transition " +
              (rating === "down"
                ? "border-red-400/60 bg-red-500/10 text-red-300"
                : "border-border text-muted hover:text-white")
            }
          >
            👎 Off
          </button>
        </div>
      </div>

      {showComment && rating && (
        <div className="mt-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={
              rating === "down"
                ? "What was wrong or missing? (optional, but this is what teaches it)"
                : "What did you find useful? (optional)"
            }
            className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => send(rating)}
              disabled={busy}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:text-white"
            >
              Skip comment
            </button>
            <button
              onClick={() => send(rating, true)}
              disabled={busy}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-bg transition hover:bg-accent/90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
