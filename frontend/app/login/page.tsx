"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { login } from "@/lib/api";
import { setSession } from "@/lib/auth";
import { LogoMark } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await login(email, password);
      setSession(res.access_token, { user_id: res.user_id, email: res.email });
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-page grid min-h-[80vh] place-items-center py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        {/* Ambient brand glow behind the card. */}
        <div className="pointer-events-none absolute -inset-x-20 -top-24 h-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mb-6 flex justify-center">
          <LogoMark className="h-12 w-12 drop-shadow-[0_0_24px_rgba(46,207,110,0.35)]" />
        </div>
        <Card className="relative p-8">
          <h1 className="text-2xl font-black tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">
            Sign in to sync your races and training.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-muted">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-accent hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}
            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            No account?{" "}
            <Link href="/register" className="font-medium text-accent hover:underline">
              Create one
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
