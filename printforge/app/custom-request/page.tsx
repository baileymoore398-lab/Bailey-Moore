"use client";

import { useState } from "react";

const categories = ["Mountain Bike", "Automotive", "Home", "Business", "Education", "Other"];

export default function CustomRequestPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Mountain Bike");
  const [contactEmail, setContactEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/custom-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, contactEmail })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit request");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="mt-4 text-2xl font-bold">Request received!</h1>
        <p className="mt-2 text-slate-600">
          Our design team has been notified and will get back to you with a price estimate, timeline and any
          questions — usually within one business day.
        </p>
        <a href="/" className="btn-primary mt-6">Back to home</a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Custom Design Request</h1>
      <p className="mt-2 text-slate-600">
        Got an idea but no 3D file? Describe it — like “a custom GoPro mount for my mountain bike” — and our
        team will design and quote it. Attach photos or sketches if you have them.
      </p>

      <form onSubmit={submit} className="card mt-8 space-y-5 p-6">
        <div>
          <label className="label">What do you need?</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Custom GoPro mount for my mountain bike" required />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Describe it in detail</label>
          <textarea
            className="input"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Dimensions, where it mounts, materials, how strong it needs to be, quantity…"
            required
          />
        </div>
        <div>
          <label className="label">Contact email</label>
          <input className="input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <p className="text-xs text-slate-500">
          File uploads (photos/sketches) attach to your project once you’re signed in — S3 storage is wired in production.
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-accent w-full" disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button>
      </form>
    </div>
  );
}
