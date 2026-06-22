"use client";

import { useEffect, useState } from "react";

interface Printer {
  id: string;
  name: string;
  brand: string;
  model?: string;
  status: string;
  buildX: number; buildY: number; buildZ: number;
  filamentRemainingG: number;
  successRate: number;
  nextMaintenance?: string;
}

const STATUSES = ["IDLE", "PRINTING", "MAINTENANCE", "OFFLINE"];

export default function PrintersPage() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/printers");
    const json = await res.json();
    setPrinters(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/printers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    load();
  }

  if (loading) return <p className="text-slate-500">Loading fleet…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Printer Management</h1>
      <p className="mt-1 text-slate-500">Bambu Lab · Prusa · Creality · Voron</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {printers.map((p) => (
          <div key={p.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{p.name}</h2>
                <p className="text-xs text-slate-500">{p.brand.replace("_", " ")} {p.model && `· ${p.model}`}</p>
              </div>
              <span className={`badge ${p.status === "PRINTING" ? "bg-green-100 text-green-700" : p.status === "MAINTENANCE" ? "bg-amber-100 text-amber-700" : p.status === "OFFLINE" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                {p.status}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-slate-400">Build</dt><dd>{p.buildX}×{p.buildY}×{p.buildZ}</dd></div>
              <div><dt className="text-slate-400">Filament</dt><dd>{(p.filamentRemainingG / 1000).toFixed(2)} kg</dd></div>
              <div><dt className="text-slate-400">Success</dt><dd>{(p.successRate * 100).toFixed(0)}%</dd></div>
            </dl>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, (p.filamentRemainingG / 1000) * 100)}%` }} />
            </div>

            <div className="mt-4 flex flex-wrap gap-1">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(p.id, s)}
                  className={`badge ${p.status === s ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
