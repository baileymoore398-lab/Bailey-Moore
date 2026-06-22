"use client";

import { useState } from "react";

export default function TrackPage() {
  const [orderNumber, setOrderNumber] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (orderNumber.trim()) window.location.href = `/orders/${orderNumber.trim()}`;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">Track your order</h1>
      <p className="mt-2 text-slate-600">Enter your order number (e.g. PF-20260622-AB12) to see live production status.</p>
      <form onSubmit={submit} className="card mt-8 flex gap-2 p-4">
        <input className="input" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="PF-…" />
        <button className="btn-primary">Track</button>
      </form>
    </div>
  );
}
