"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api";

type Result = {
  ok: boolean;
  kind: "ok" | "not-set" | "network" | "http" | "cors";
  detail: string;
  status?: number;
};

export default function DebugPage() {
  const [result, setResult] = React.useState<Result | null>(null);
  const [running, setRunning] = React.useState(false);

  const isLocalhost = API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1");

  const runCheck = React.useCallback(async () => {
    setRunning(true);
    setResult(null);
    const url = `${API_BASE}/health`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        let body = "";
        try {
          body = JSON.stringify(await res.json());
        } catch {
          /* ignore */
        }
        setResult({ ok: true, kind: "ok", detail: body || "200 OK", status: res.status });
      } else {
        setResult({
          ok: false,
          kind: "http",
          status: res.status,
          detail: `Backend replied ${res.status} ${res.statusText}. The server is reachable but the /health route returned an error.`,
        });
      }
    } catch (err) {
      // A failed fetch is either a network failure (down/wrong URL) or a CORS
      // block — the browser reports both as a generic TypeError.
      const msg = (err as Error)?.message || "fetch failed";
      setResult({
        ok: false,
        kind: isLocalhost ? "not-set" : "network",
        detail: msg,
      });
    } finally {
      setRunning(false);
    }
  }, [isLocalhost]);

  React.useEffect(() => {
    runCheck();
  }, [runCheck]);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-black tracking-tight">Backend diagnostics</h1>
        <p className="mt-2 text-sm text-muted">
          This page checks whether your deployed frontend can reach the
          RouteForge API. If the dashboard shows sample data, the answer is
          below.
        </p>

        <Card className="mt-6 p-5">
          <Row label="Configured API URL">
            <code className="break-all text-accent">{API_BASE}</code>
          </Row>
          <Row label="This page's origin">
            <code className="break-all">
              {typeof window !== "undefined" ? window.location.origin : "—"}
            </code>
          </Row>
          <Row label="Health endpoint">
            <code className="break-all">{API_BASE}/health</code>
          </Row>
        </Card>

        <div className="mt-4 flex items-center gap-3">
          <Button variant="accent" onClick={runCheck} disabled={running}>
            {running ? "Checking…" : "Re-run check"}
          </Button>
          {result && (
            <span
              className={
                "text-sm font-semibold " +
                (result.ok ? "text-emerald-400" : "text-red-300")
              }
            >
              {result.ok ? "✓ Backend reachable" : "✗ Backend NOT reachable"}
            </span>
          )}
        </div>

        {result && (
          <Card className="mt-4 p-5">
            <div className="text-sm text-white/90">
              <div className="font-mono text-xs text-muted">
                {result.status ? `HTTP ${result.status} · ` : ""}
                {result.detail}
              </div>
              <div className="mt-4">{explain(result, isLocalhost)}</div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/50 py-2.5 text-sm last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-xs">{children}</span>
    </div>
  );
}

function explain(r: Result, isLocalhost: boolean) {
  if (r.ok) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200">
        <strong>All good.</strong> The frontend can reach the backend. If the
        dashboard still shows sample data, hard-refresh the page (the data is
        fetched fresh each load).
      </div>
    );
  }
  if (r.kind === "not-set" || isLocalhost) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200">
        <strong>NEXT_PUBLIC_API_URL isn&apos;t set for this build.</strong> The
        app is pointing at <code>localhost</code>, which a deployed site can
        never reach. Fix:
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Vercel → Project → Settings → <b>Environment Variables</b>.
          </li>
          <li>
            Add <code>NEXT_PUBLIC_API_URL</code> = your backend URL (e.g.{" "}
            <code>https://routeforge-api-production.up.railway.app</code>).
          </li>
          <li>
            Tick <b>all three</b> environments (Production, Preview,
            Development).
          </li>
          <li>
            <b>Redeploy</b> — <code>NEXT_PUBLIC_*</code> vars are baked in at
            build time, so a redeploy is required.
          </li>
        </ol>
      </div>
    );
  }
  if (r.kind === "network") {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-red-200">
        <strong>The browser couldn&apos;t complete the request.</strong> The API
        URL is set, so this is one of two things:
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>CORS:</b> the backend isn&apos;t allowing this site&apos;s origin.
            On Railway set <code>CORS_ORIGINS</code> to <code>*</code> (or add
            this exact origin), then redeploy.
          </li>
          <li>
            <b>Backend down / wrong URL:</b> open{" "}
            <code className="break-all">{API_BASE}/health</code> directly in a
            new tab. If it doesn&apos;t return{" "}
            <code>{`{"status":"ok"}`}</code>, the backend is asleep, crashed, or
            the URL is wrong — check the Railway service logs.
          </li>
        </ul>
        <p className="mt-2">
          Open your browser&apos;s DevTools → Console: a CORS block names the
          origin explicitly, which distinguishes it from a plain outage.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-red-200">
      <strong>The backend is reachable but errored.</strong> It returned HTTP{" "}
      {r.status}. Check the Railway service logs — the API process is up but the
      health route failed (often a database/Redis connection problem at
      startup).
    </div>
  );
}
