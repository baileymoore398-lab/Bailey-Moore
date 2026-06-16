"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [step, setStep] = React.useState<1 | 2 | "done">(1);
  const [email, setEmail] = React.useState("");
  const [token, setToken] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [devToken, setDevToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await requestPasswordReset(email);
      setMessage(res.message || "If that email exists, a reset link was sent.");
      if (res.reset_token) {
        setDevToken(res.reset_token);
        setToken(res.reset_token);
        setStep(2);
      }
    } catch (err) {
      setError((err as Error).message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await confirmPasswordReset(token, newPassword);
      setMessage(res.message || "Password reset. You can now sign in.");
      setStep("done");
    } catch (err) {
      setError((err as Error).message || "Reset failed");
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
        className="w-full max-w-md"
      >
        <Card className="p-8">
          <h1 className="text-2xl font-black tracking-tight">Reset password</h1>

          {step === 1 && (
            <>
              <p className="mt-1 text-sm text-muted">
                Enter your email and we&apos;ll send a reset token.
              </p>
              <form onSubmit={handleRequest} className="mt-6 space-y-4">
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
                  {loading ? "Sending…" : "Send reset token"}
                </Button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <p className="mt-1 text-sm text-muted">
                Enter the reset token and your new password.
              </p>
              {devToken && (
                <div className="mt-3">
                  <Badge variant="warning">Dev token revealed</Badge>
                </div>
              )}
              <form onSubmit={handleConfirm} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-muted">
                    Reset token
                  </label>
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-muted">
                    New password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
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
                  {loading ? "Resetting…" : "Reset password"}
                </Button>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="mt-6 space-y-4 text-center">
              <div className="text-4xl">✅</div>
              <p className="text-sm text-emerald-300">
                {message || "Your password has been reset."}
              </p>
              <Link href="/login">
                <Button variant="accent" className="w-full">
                  Back to sign in
                </Button>
              </Link>
            </div>
          )}

          {step !== "done" && message && step === 1 && (
            <p className="mt-4 text-sm text-accent">{message}</p>
          )}

          {step !== "done" && (
            <p className="mt-6 text-center text-sm text-muted">
              Remembered it?{" "}
              <Link href="/login" className="font-medium text-accent hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
