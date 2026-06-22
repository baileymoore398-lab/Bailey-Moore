"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"INDIVIDUAL" | "BUSINESS">("INDIVIDUAL");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, accountType, businessName: accountType === "BUSINESS" ? businessName : undefined })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sign up failed");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
        <div className="flex gap-2">
          {(["INDIVIDUAL", "BUSINESS"] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setAccountType(t)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${accountType === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-600"}`}
            >
              {t === "INDIVIDUAL" ? "Individual" : "Business"}
            </button>
          ))}
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        {accountType === "BUSINESS" && (
          <div>
            <label className="label">Business name</label>
            <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        <p className="text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="text-brand-700 hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
