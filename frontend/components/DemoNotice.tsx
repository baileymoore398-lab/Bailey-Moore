"use client";

import { disableDemo, isDemoMode } from "@/lib/demo";

/**
 * Banner shown whenever a page is rendering bundled SAMPLE data instead of real
 * backend data. Two cases:
 *   1. The user explicitly enabled demo mode → offer an "Exit demo" button.
 *   2. The backend was unreachable (auto-fallback) → explain how to connect it.
 */
export function DemoNotice({
  context = "data",
  sampleRace = false,
}: {
  context?: string;
  sampleRace?: boolean;
}) {
  const userEnabled = isDemoMode();

  // A built-in sample/demo race (e.g. the "See a live demo" race) is always
  // example data by design — never alarm the user about the backend here.
  if (sampleRace) {
    return (
      <div className="mb-6 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
        🎬 <strong>This is a sample race</strong> for demonstration — example
        track and AI report. To see your own, go to{" "}
        <strong>Analyze</strong> and upload a GPX file.
      </div>
    );
  }

  if (userEnabled) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
        <span>
          🎬 <strong>Demo mode.</strong> You&apos;re viewing example {context} —
          not real results. Turn it off to use your own data.
        </span>
        <button
          onClick={() => {
            disableDemo();
            window.location.reload();
          }}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-bg transition hover:bg-accent/90"
        >
          Exit demo
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none">⚠️</span>
        <div>
          <p className="font-semibold text-amber-100">
            Showing sample {context} — couldn&apos;t reach the backend.
          </p>
          <p className="mt-1 text-amber-200/90">
            RouteForge can&apos;t reach its API, so this is example data (a fixed
            track and example AI report) — <strong>not</strong> your real results.
            To get real analysis:
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-amber-200/90">
            <li>
              Deploy the backend (<code>DEPLOY_QUICKSTART.md</code>) and set{" "}
              <code>NEXT_PUBLIC_API_URL</code> in Vercel to its URL.
            </li>
            <li>
              Add your frontend domain to the backend&apos;s{" "}
              <code>CORS_ORIGINS</code>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
