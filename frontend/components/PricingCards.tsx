"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { startCheckout } from "@/lib/api";
import { PayPalSubscribeButton } from "@/components/PayPalSubscribeButton";
import type { BillingPlans } from "@/lib/types";
import { cn } from "@/lib/utils";

const highlight: Record<string, boolean> = { pro: true };

/**
 * Membership tiers. Two modes, driven by the backend's billing_enabled flag:
 *   - Preview (no Stripe configured): memberships shown as "coming soon",
 *     everything free while the platform is new.
 *   - Live (Stripe configured): real checkout on the upgrade buttons.
 * Flipping on billing requires no frontend change.
 */
export function PricingCards({ plans }: { plans: BillingPlans }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const live = plans.billing_enabled;

  async function upgrade(planId: string) {
    if (planId === "free" || !live) return;
    setBusy(planId);
    setNotice(null);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const res = await startCheckout(
        planId,
        `${origin}/dashboard?upgraded=1`,
        `${origin}/pricing`
      );
      if (res?.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        setNotice("Checkout isn't available right now — please try again soon.");
      }
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e.status === 503) {
        setNotice("Memberships aren't open yet — please check back soon.");
      } else {
        setNotice(e.message || "Could not start checkout.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-accent/40 bg-accent/10 p-8 text-center">
        <div className="text-4xl">🎉</div>
        <h2 className="mt-3 text-2xl font-black">You&apos;re a {success} member!</h2>
        <p className="mt-2 text-sm text-white/90">
          Your subscription is active. Thanks for supporting RouteForge — head
          to your dashboard and keep forging faster routes.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition hover:bg-accent/90"
        >
          Go to dashboard →
        </Link>
      </div>
    );
  }

  return (
    <div>
      {!live && (
        <div className="mb-8 rounded-2xl border border-accent/40 bg-accent/10 px-5 py-4 text-center text-sm text-accent">
          🌱 <strong>RouteForge is brand new — everything is free right now.</strong>
          <span className="mt-1 block text-accent/80">
            Memberships open once the platform matures. Early athletes keep
            founding-member perks.
          </span>
        </div>
      )}
      {notice && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {plans.plans.map((plan, i) => {
          const featured = highlight[plan.id];
          const isFree = plan.id === "free";
          const paypalPlanId = plans.paypal?.plans?.[plan.id];
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className={cn(
                "card-lift relative flex flex-col rounded-2xl border p-6",
                featured
                  ? "border-accent/60 bg-gradient-to-b from-accent/[0.07] to-bg-card/70 shadow-[0_0_40px_-12px_rgba(46,207,110,0.5)]"
                  : "border-border bg-bg-card/70",
                !live && !isFree && "opacity-90"
              )}
            >
              {featured && (
                <div className="absolute -top-3 left-6">
                  <Badge variant="accent">
                    {live ? "Most popular" : "Coming soon"}
                  </Badge>
                </div>
              )}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-black tabular-nums">
                  ${plan.price_month}
                </span>
                <span className="text-sm text-muted">/mo</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-muted">
                    <span className="mt-0.5 text-accent">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isFree ? (
                  <Button variant="outline" className="w-full" disabled>
                    {live ? "Current plan" : "✓ Free while we're new"}
                  </Button>
                ) : paypalPlanId ? (
                  <PayPalSubscribeButton
                    clientId={plans.paypal!.client_id}
                    env={plans.paypal!.env}
                    planId={paypalPlanId}
                    tier={plan.id}
                    onSuccess={() => setSuccess(plan.name)}
                  />
                ) : live && plans.billing_enabled && !plans.paypal ? (
                  <Button
                    variant={featured ? "accent" : "default"}
                    className="w-full"
                    onClick={() => upgrade(plan.id)}
                    disabled={busy === plan.id}
                  >
                    {busy === plan.id ? "Redirecting…" : `Upgrade to ${plan.name}`}
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    🔒 Opening later
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {!live && (
        <p className="mt-8 text-center text-sm text-muted">
          Want first access when memberships open?{" "}
          <Link href="/contact" className="font-semibold text-accent hover:underline">
            Get in touch
          </Link>{" "}
          — early supporters won&apos;t miss out.
        </p>
      )}
    </div>
  );
}
