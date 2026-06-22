"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Material {
  id: string;
  code: string;
  name: string;
  description?: string;
  strengthRating: number;
  pricePerKgNzd: number;
}

interface QuoteResponse {
  quoteId?: string;
  analysis: { volumeCm3: number; bbox: { x: number; y: number; z: number }; triangles: number; exact: boolean };
  material: { code: string; name: string };
  quote: {
    weightGrams: number;
    printMinutes: number;
    supportRequired: boolean;
    total: number;
    breakdown: { label: string; amount: number }[];
  };
}

const money = (n: number) => `$${n.toFixed(2)}`;
const fmtTime = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

export default function QuotePage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [materialCode, setMaterialCode] = useState("PLA");
  const [infill, setInfill] = useState(20);
  const [layerHeight, setLayerHeight] = useState(0.2);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteResponse | null>(null);
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    fetch("/api/materials")
      .then((r) => r.json())
      .then((j) => setMaterials(j.data ?? []))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Please choose a model file (STL, OBJ, STEP or 3MF).");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("materialCode", materialCode);
      fd.append("infill", String(infill));
      fd.append("layerHeight", String(layerHeight));
      fd.append("quantity", String(quantity));
      const res = await fetch("/api/quote", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Quote failed");
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function order() {
    if (!result?.quoteId) return;
    setOrdering(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: result.quoteId })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Order failed");
      window.location.href = `/orders/${json.data.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order failed");
    } finally {
      setOrdering(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">Instant Quote</h1>
      <p className="mt-2 text-slate-600">
        Upload an STL, OBJ, STEP or 3MF file. We analyse the geometry and price it instantly.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Form */}
        <form onSubmit={submit} className="card space-y-5 p-6">
          <div>
            <label className="label">Model file</label>
            <input
              type="file"
              accept=".stl,.obj,.step,.stp,.3mf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="input"
            />
            <p className="mt-1 text-xs text-slate-500">Max 60MB. STL gives an exact volume; other formats are estimated and confirmed by our team.</p>
          </div>

          <div>
            <label className="label">Material</label>
            <select className="input" value={materialCode} onChange={(e) => setMaterialCode(e.target.value)}>
              {materials.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name} — ${m.pricePerKgNzd}/kg · strength {m.strengthRating}/5
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Infill</label>
              <select className="input" value={infill} onChange={(e) => setInfill(Number(e.target.value))}>
                {[10, 15, 20, 30, 40, 60, 100].map((v) => (
                  <option key={v} value={v}>{v}%</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Layer</label>
              <select className="input" value={layerHeight} onChange={(e) => setLayerHeight(Number(e.target.value))}>
                {[0.12, 0.16, 0.2, 0.28].map((v) => (
                  <option key={v} value={v}>{v}mm</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Qty</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="input"
              />
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Analysing model…" : "Calculate quote"}
          </button>
        </form>

        {/* Result */}
        <div className="card p-6">
          {!result ? (
            <div className="grid h-full place-items-center text-center text-slate-400">
              <div>
                <div className="text-5xl">📦</div>
                <p className="mt-3 text-sm">Your instant quote will appear here.</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Your quote</h2>
                {!result.analysis.exact && (
                  <span className="badge bg-amber-100 text-amber-800">Estimated volume</span>
                )}
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Material" value={result.material.name} />
                <Row label="Volume" value={`${result.analysis.volumeCm3} cm³`} />
                <Row label="Bounding box" value={`${result.analysis.bbox.x} × ${result.analysis.bbox.y} × ${result.analysis.bbox.z} mm`} />
                <Row label="Weight" value={`${result.quote.weightGrams} g`} />
                <Row label="Print time" value={fmtTime(result.quote.printMinutes)} />
                <Row label="Supports" value={result.quote.supportRequired ? "Required" : "Not required"} />
              </dl>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-700">Cost breakdown</h3>
                <dl className="mt-2 space-y-1 text-sm">
                  {result.quote.breakdown.map((b) => (
                    <Row key={b.label} label={b.label} value={money(b.amount)} />
                  ))}
                </dl>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="font-semibold">Total (incl. GST)</span>
                  <span className="text-xl font-bold text-brand-700">{money(result.quote.total)}</span>
                </div>
              </div>

              <button onClick={order} disabled={ordering || !result.quoteId} className="btn-accent mt-5 w-full">
                {ordering ? "Creating order…" : "Order this print"}
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">
                Need design help first? <Link href="/ai-assistant" className="text-brand-700 underline">Ask the AI assistant</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
