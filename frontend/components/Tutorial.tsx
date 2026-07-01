"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Step {
  icon: string;
  title: string;
  action: string; // what to do
  why: string; // why it matters
}

const STEPS: Step[] = [
  {
    icon: "🧭",
    title: "Welcome to RouteForge",
    action:
      "RouteForge turns a photo of your map, your GPS track, and your split times into a deep, leg-by-leg breakdown of your race.",
    why: "Instead of guessing where you lost time, you get hard numbers, an interactive replay, and an AI coach that tells you exactly what to fix.",
  },
  {
    icon: "📈",
    title: "1. Upload your GPS track",
    action:
      "Go to Analyze and upload your run as a GPX, FIT, or TCX file — export it from your watch app or Strava.",
    why: "The GPS track is the backbone of everything: it gives your exact route, speed, distance, and climb, second by second.",
  },
  {
    icon: "🗺️",
    title: "2. Add a map photo (optional)",
    action: "Snap or scan your printed orienteering map and upload it.",
    why: "We line the map up with your GPS so your route is drawn on the real course — perfect for spotting where a different choice would have been faster.",
  },
  {
    icon: "🎯",
    title: "3. Add split times (recommended)",
    action:
      "If you have them, upload the splits file (CSV or XML) from the event's timing system.",
    why: "Splits pin each control to the exact moment you punched it, so your leg times, rankings, and mistake detection become far more accurate.",
  },
  {
    icon: "⚙️",
    title: "4. Generate the analysis",
    action: "Press Generate. RouteForge runs the pipeline and opens your race.",
    why: "In seconds it computes your metrics, detects navigation mistakes, scores your performance, and writes a coaching report.",
  },
  {
    icon: "▶️",
    title: "5. Watch the replay",
    action:
      "Press play on the map and use the speed-coloured track and the legend (slow → fast).",
    why: "Seeing yourself move reveals where you slowed, hesitated, or drifted off-line — the exact moments that cost you time.",
  },
  {
    icon: "🧠",
    title: "6. Read the AI Coach report",
    action:
      "Open the AI Coach card, expand the detailed breakdown, and download it as a PDF.",
    why: "It turns the data into plain-English strengths, weaknesses, and concrete drills, so you know what to actually train next.",
  },
  {
    icon: "📲",
    title: "7. Share your race",
    action:
      "Use the Share button to create a branded photo or an animated replay video.",
    why: "Show off your run or course on Instagram, TikTok, or with your club — straight from your analysis.",
  },
  {
    icon: "👤",
    title: "8. Create a free account",
    action: "Sign up to save your races and unlock your dashboard and training tools.",
    why: "Your history, performance trends, and race-readiness build up over time once you're signed in.",
  },
];

const SEEN_KEY = "rf-tutorial-seen";

function markTutorialSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage unavailable — no-op */
  }
}

export function TutorialButton({
  className,
  label = "Tutorial",
  autoOpen = false,
}: {
  className?: string;
  label?: string;
  /** Open automatically the first time a visitor ever loads the app. */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  // First-visit auto-open. Runs once on mount; the localStorage flag ensures
  // returning visitors are never interrupted again.
  React.useEffect(() => {
    if (!autoOpen) return;
    let seen = true;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage blocked — treat as seen so we don't nag */
    }
    if (!seen) {
      setOpen(true);
      markTutorialSeen();
    }
  }, [autoOpen]);

  const show = () => {
    markTutorialSeen();
    setOpen(true);
  };

  return (
    <>
      <button
        onClick={show}
        className={
          className ??
          "rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-accent"
        }
      >
        {label}
      </button>
      {open && <TutorialModal onClose={() => setOpen(false)} />}
    </>
  );
}

function TutorialModal({ onClose }: { onClose: () => void }) {
  const [i, setI] = React.useState(0);
  const step = STEPS[i];
  const isFirst = i === 0;
  const isLast = i === STEPS.length - 1;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && i < STEPS.length - 1) setI((v) => v + 1);
      if (e.key === "ArrowLeft" && i > 0) setI((v) => v - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            How RouteForge works · {i + 1}/{STEPS.length}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-muted transition hover:text-white"
            aria-label="Close tutorial"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-7">
          <div className="text-5xl">{step.icon}</div>
          <h2 className="mt-4 text-2xl font-black tracking-tight">{step.title}</h2>

          <div className="mt-5 space-y-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-accent">
                What to do
              </div>
              <p className="mt-1 text-sm leading-relaxed text-white/90">
                {step.action}
              </p>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted">
                Why it matters
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {step.why}
              </p>
            </div>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pb-4">
          {STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Go to step ${idx + 1}`}
              className={
                "h-1.5 rounded-full transition-all " +
                (idx === i ? "w-5 bg-accent" : "w-1.5 bg-border hover:bg-muted")
              }
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-4">
          <button
            onClick={onClose}
            className="text-sm font-medium text-muted transition hover:text-white"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" onClick={() => setI((v) => v - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button variant="accent" asChild>
                <Link href="/upload" onClick={onClose}>
                  Analyze a race →
                </Link>
              </Button>
            ) : (
              <Button variant="accent" onClick={() => setI((v) => v + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
