"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed");
      window.location.href = json.data.role === "ADMIN" || json.data.role === "OPERATOR" ? "/admin" : "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Demo: demo@printforge.nz / demo1234</p>

      <div className="mt-6 grid gap-2">
        <button className="btn-ghost" disabled title="Configure Clerk to enable">Continue with Google</button>
        <button className="btn-ghost" disabled title="Configure Clerk to enable">Continue with Apple</button>
        <p className="text-center text-xs text-slate-400">Social login enabled when Clerk is configured</p>
      </div>

      <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <div className="flex justify-between text-sm">
          <Link href="/forgot-password" className="text-brand-700 hover:underline">Forgot password?</Link>
          <Link href="/register" className="text-brand-700 hover:underline">Create account</Link>
        </div>
      </form>
    </div>
  );
}
