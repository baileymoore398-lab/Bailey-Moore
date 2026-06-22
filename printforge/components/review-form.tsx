"use client";

import { useState } from "react";

export function ReviewForm({ productId }: { productId: string }) {
  const [rating, setRating] = useState(5);
  const [printQuality, setPrintQuality] = useState(5);
  const [designQuality, setDesignQuality] = useState(5);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, printQuality, designQuality, authorName, body })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit review");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">Thanks for your review! It will appear after a refresh.</p>;
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h3 className="font-semibold">Leave a review</h3>
      <div className="grid grid-cols-3 gap-3">
        <Stars label="Overall" value={rating} onChange={setRating} />
        <Stars label="Print quality" value={printQuality} onChange={setPrintQuality} />
        <Stars label="Design quality" value={designQuality} onChange={setDesignQuality} />
      </div>
      <input className="input" placeholder="Your name" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
      <textarea className="input" rows={3} placeholder="How did it turn out?" value={body} onChange={(e) => setBody(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit review"}</button>
    </form>
  );
}

function Stars({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>{"★".repeat(n)}</option>
        ))}
      </select>
    </div>
  );
}
