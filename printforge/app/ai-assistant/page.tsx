"use client";

import { useState } from "react";

interface Suggestion {
  summary: string;
  materials: { code: string; reason: string }[];
  settings: { wallLoops?: number; infillPct?: number; layerHeightMm?: number };
  manufacturingNotes: string[];
  source: "openai" | "rules";
}

const examples = [
  "I need a stronger bottle cage for rough trails",
  "A flexible phone bumper that grips well",
  "An outdoor bracket that won't fade in the sun",
  "A heat-resistant clip for my car engine bay"
];

export default function AIAssistantPage() {
  const [brief, setBrief] = useState("");
  const [result, setResult] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(text?: string) {
    const b = text ?? brief;
    if (!b.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: b })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">AI Design Assistant</h1>
      <p className="mt-2 text-slate-600">
        Describe what you want to print and get instant material and print-setting recommendations to make it
        stronger, lighter or better.
      </p>

      <div className="card mt-8 p-6">
        <textarea
          className="input"
          rows={3}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="e.g. I need a stronger bottle cage"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button key={ex} onClick={() => { setBrief(ex); ask(ex); }} className="badge bg-slate-100 text-slate-600 hover:bg-slate-200">
              {ex}
            </button>
          ))}
        </div>
        <button onClick={() => ask()} disabled={busy} className="btn-primary mt-4">
          {busy ? "Thinking…" : "Get suggestions"}
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="card mt-6 space-y-5 p-6">
          <p className="text-slate-700">{result.summary}</p>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recommended materials</h3>
            <div className="mt-2 space-y-2">
              {result.materials.map((m) => (
                <div key={m.code} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                  <span className="badge bg-brand-600 text-white">{m.code}</span>
                  <span className="text-sm text-slate-600">{m.reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Suggested print settings</h3>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {result.settings.wallLoops && <li className="badge bg-slate-100 text-slate-700">{result.settings.wallLoops} wall loops</li>}
              {result.settings.infillPct && <li className="badge bg-slate-100 text-slate-700">{result.settings.infillPct}% infill</li>}
              {result.settings.layerHeightMm && <li className="badge bg-slate-100 text-slate-700">{result.settings.layerHeightMm}mm layers</li>}
            </ul>
          </div>

          {result.manufacturingNotes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Manufacturing notes</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {result.manufacturingNotes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-400">
              {result.source === "openai" ? "Powered by OpenAI" : "Powered by PrintForge rules engine"}
            </span>
            <a href="/quote" className="btn-accent">Quote a print</a>
          </div>
        </div>
      )}
    </div>
  );
}
