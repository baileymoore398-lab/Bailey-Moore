"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    setSent(true);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      {sent ? (
        <p className="card mt-6 p-6 text-sm text-slate-600">
          If an account exists for <strong>{email}</strong>, we’ve sent a reset link. Check your inbox (and in
          development, the server logs).
        </p>
      ) : (
        <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
    </div>
  );
}
