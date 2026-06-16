"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { startCheckout } from "@/lib/api";
import type { BillingPlans } from "@/lib/types";
import { cn } from "@/lib/utils";

const highlight: Record<string, boolean> = { pro: true };

export function PricingCards({ plans }: { plans: BillingPlans }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(
    plans.billing_enabled ? null : "Billing not yet enabled — checkout is in demo mode."
  );

  async function upgrade(planId: string) {
    if (planId === "free") return;
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
        setNotice("Billing not yet enabled.");
      }
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e.status === 503) {
        setNotice("Billing not yet enabled. Please check back soon.");
      } else {
        setNotice(e.message || "Could not start checkout.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {notice && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {plans.plans.map((plan, i) => {
          const featured = highlight[plan.id];
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-bg-card/70 p-6",
                featured
                  ? "border-accent/60 shadow-[0_0_40px_-12px_rgba(34,211,238,0.5)]"
                  : "border-border"
              )}
            >
              {featured && (
                <div className="absolute -top-3 left-6">
                  <Badge variant="accent">Most popular</Badge>
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
                {plan.id === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : (
                  <Button
                    variant={featured ? "accent" : "default"}
                    className="w-full"
                    onClick={() => upgrade(plan.id)}
                    disabled={busy === plan.id}
                  >
                    {busy === plan.id ? "Redirecting…" : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
